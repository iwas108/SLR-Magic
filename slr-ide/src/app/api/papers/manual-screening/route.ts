import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');

    // Support getStats parameter for project-wide statistics
    const getStats = searchParams.get('getStats') === 'true';
    if (getStats) {
      // 1. Total papers in project (excluding duplicates)
      const totalRow = db.prepare(`
        SELECT COUNT(*) as count 
        FROM papers 
        WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)
      `).get(activeProjectId, activeProjectId) as { count: number };
      const total = totalRow ? totalRow.count : 0;

      // 2. Screened papers (decision is set)
      const screenedRow = db.prepare(`
        SELECT COUNT(*) as count 
        FROM papers 
        WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)
          AND manual_decision IS NOT NULL AND manual_decision != ''
      `).get(activeProjectId, activeProjectId) as { count: number };
      const screened = screenedRow ? screenedRow.count : 0;

      // 3. Stage counts grouping
      const stages = db.prepare(`
        SELECT manual_stage, COUNT(*) as count 
        FROM papers 
        WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)
        GROUP BY manual_stage
      `).all(activeProjectId, activeProjectId) as { manual_stage: string; count: number }[];
      
      const stageCounts: Record<string, number> = {};
      stages.forEach(s => {
        const key = s.manual_stage || 'none';
        stageCounts[key] = s.count;
      });

      // 4. Decision counts grouping
      const decisions = db.prepare(`
        SELECT manual_decision, COUNT(*) as count 
        FROM papers 
        WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)
        GROUP BY manual_decision
      `).all(activeProjectId, activeProjectId) as { manual_decision: string; count: number }[];

      const decisionCounts: Record<string, number> = {};
      decisions.forEach(d => {
        const key = d.manual_decision || 'none';
        decisionCounts[key] = d.count;
      });

      return NextResponse.json({
        total,
        screened,
        pending: total - screened,
        stageCounts,
        decisionCounts
      });
    }

    const search = searchParams.get('search')?.trim() || '';
    const manualStage = searchParams.get('manualStage')?.trim() || '';
    const manualDecision = searchParams.get('manualDecision')?.trim() || '';
    
    // Additional Paper Database filters for full parity
    const pdfStatus = searchParams.get('pdfStatus')?.trim() || '';
    const source = searchParams.get('source')?.trim() || '';
    const doiStatus = searchParams.get('doiStatus')?.trim() || '';
    const pdfLink = searchParams.get('pdfLink')?.trim() || '';
    const pipelineStage = searchParams.get('pipelineStage')?.trim() || '';
    const pipelineStatus = searchParams.get('pipelineStatus')?.trim() || '';
    const ecTrigger = searchParams.get('ecTrigger')?.trim() || '';

    // Sort parameters
    const sortBy = searchParams.get('sortBy')?.trim() || 'Paper_ID';
    const sortOrder = searchParams.get('sortOrder')?.trim() || 'ASC';
    
    // Pagination parameters
    const pageVal = parseInt(searchParams.get('page') || '1', 10);
    const page = !isNaN(pageVal) && pageVal > 0 ? pageVal : 1;
    
    const limitVal = parseInt(searchParams.get('limit') || '50', 10);
    const limit = !isNaN(limitVal) && limitVal > 0 ? limitVal : 50;

    let filterQuery = ' FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)';
    const params: any[] = [activeProjectId, activeProjectId];

    if (search) {
      filterQuery += ' AND (Paper_ID LIKE ? OR Title LIKE ? OR Abstract LIKE ? OR Authors LIKE ? OR DOI LIKE ? OR Publisher LIKE ?)';
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    if (manualStage) {
      if (manualStage === 'none') {
        filterQuery += ' AND (manual_stage IS NULL OR manual_stage = \'\')';
      } else {
        filterQuery += ' AND manual_stage = ?';
        params.push(manualStage);
      }
    }

    if (manualDecision) {
      if (manualDecision === 'none') {
        filterQuery += ' AND (manual_decision IS NULL OR manual_decision = \'\')';
      } else if (manualDecision.startsWith('EXCLUDE (')) {
        const match = manualDecision.match(/EXCLUDE \(([^)]+)\)/);
        if (match) {
          filterQuery += " AND manual_decision = 'EXCLUDE' AND manual_exclusion_code = ?";
          params.push(match[1]);
        } else {
          filterQuery += ' AND manual_decision = ?';
          params.push(manualDecision);
        }
      } else {
        filterQuery += ' AND manual_decision = ?';
        params.push(manualDecision);
      }
    }

    if (pdfStatus) {
      filterQuery += ' AND Local_PDF_Status = ?';
      params.push(pdfStatus);
    }

    if (source) {
      if (source === 'manual') {
        filterQuery += " AND (Import_Source = 'Manual Search' OR Import_Source = 'Manual Ingestion')";
      } else if (source === 'backward') {
        filterQuery += " AND Import_Source = 'Backward Snowball'";
      } else if (source === 'forward') {
        filterQuery += " AND Import_Source = 'Forward Snowball'";
      } else if (source === 'csv') {
        filterQuery += " AND Import_Source NOT IN ('Manual Search', 'Manual Ingestion', 'Backward Snowball', 'Forward Snowball')";
      }
    }

    if (doiStatus) {
      if (doiStatus === 'empty') {
        filterQuery += " AND (DOI IS NULL OR DOI = '')";
      } else if (doiStatus === 'has_doi') {
        filterQuery += " AND DOI IS NOT NULL AND DOI != ''";
      }
    }

    if (pdfLink) {
      if (pdfLink === 'empty') {
        filterQuery += " AND (PDF_Link IS NULL OR PDF_Link = '')";
      } else if (pdfLink === 'has_link') {
        filterQuery += " AND PDF_Link IS NOT NULL AND PDF_Link != ''";
      }
    }

    if (ecTrigger && pipelineStage) {
      const taskTypeMap: Record<string, string> = {
        '1': 'fast_filter',
        '2': 'gatekeeper',
        '3': 'scientist',
        '4': 'miner'
      };
      const taskType = taskTypeMap[pipelineStage] || 'fast_filter';
      if (ecTrigger === 'Unspecified') {
        filterQuery += ` AND COALESCE((
          SELECT ec_trigger FROM (
            SELECT ec_trigger, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = '${taskType}'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.exclusion_code')) as ec_trigger, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = '${taskType}' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ), '') IN ('', 'NONE')`;
      } else {
        filterQuery += ` AND (
          SELECT ec_trigger FROM (
            SELECT ec_trigger, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = '${taskType}'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.exclusion_code')) as ec_trigger, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = '${taskType}' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE ?`;
        params.push(`%${ecTrigger}%`);
      }
      filterQuery += ` AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) = ${pipelineStage}`;
    }

    if (pipelineStage === '1') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'fast_filter'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 1
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) >= 1`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'fast_filter'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 1
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) = 1`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai') {
        filterQuery += ` AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) <= 1
          AND NOT EXISTS (
            SELECT 1 FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'fast_filter'
          )
          AND NOT EXISTS (
            SELECT 1 FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 1
          )
          AND NOT EXISTS (
            SELECT 1 FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          )`;
      }
    } else if (pipelineStage === '2') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'gatekeeper'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 2
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) >= 2`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'gatekeeper'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 2
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) = 2`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai' || pipelineStatus === 'pending_pdf') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'fast_filter'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 1
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'gatekeeper'
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 2
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
        )`;

        if (pipelineStatus === 'unprocessed') {
          filterQuery += ` AND papers.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        } else if (pipelineStatus === 'ready_for_ai') {
          filterQuery += ` AND papers.Local_PDF_Status = 'SYNCED'`;
        } else {
          filterQuery += ` AND papers.Local_PDF_Status NOT IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        }
      }
    } else if (pipelineStage === '3') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'scientist'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 3
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) >= 3`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'scientist'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 3
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) = 3`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'gatekeeper'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 2
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'scientist'
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 3
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
        )`;

        if (pipelineStatus === 'unprocessed') {
          filterQuery += ` AND papers.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        } else if (pipelineStatus === 'ready_for_ai') {
          filterQuery += ` AND papers.Local_PDF_Status = 'SYNCED'`;
        }
      }
    } else if (pipelineStage === '4') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'miner'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 4
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'miner' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) >= 4`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'miner'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 4
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'miner' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) = 4`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 2 as priority FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'scientist'
            UNION ALL
            SELECT decision, updated_at as created_at, 1 as priority FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 3
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND manual_stage = 'miner'
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_screening_records WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND stage = 4
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND task_type = 'miner' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
        )`;

        if (pipelineStatus === 'unprocessed') {
          filterQuery += ` AND papers.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        } else if (pipelineStatus === 'ready_for_ai') {
          filterQuery += ` AND papers.Local_PDF_Status = 'SYNCED'`;
        }
      }
    }

    if (pipelineStage && !pipelineStatus) {
      filterQuery += ` AND MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) = ${pipelineStage}`;
    }

    // 1. Get total matching count
    const countRow = db.prepare(`SELECT COUNT(*) as count ${filterQuery}`).get(...params) as { count: number } | undefined;
    const total = countRow ? countRow.count : 0;

    const allowedSortColumns = [
      'Paper_ID', 'Title', 'Authors', 'Year', 'DOI', 'Local_PDF_Status', 
      'calibration_pool', 'calibration_tag', 'Publisher', 'citation_count', 
      'manual_decision', 'manual_exclusion_code', 'manual_stage', 'manual_rationale', 'ai_decision', 'ai_exclusion_code', 'ai_stage'
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'Paper_ID';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // 3. Paginated and sorted query execution
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT *, 
             MAX(IFNULL(papers.manual_stage, 0), IFNULL(papers.ai_stage, 0)) as Status,
             (SELECT calibration_pool FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND (cp.Project_ID = papers.Project_ID OR CAST(cp.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as calibration_pool,
             (SELECT calibration_tag FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND (cp.Project_ID = papers.Project_ID OR CAST(cp.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as calibration_tag,
             (SELECT Title FROM papers parent WHERE parent.Paper_ID = papers.Parent_Paper_ID AND (parent.Project_ID = papers.Project_ID OR CAST(parent.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as Parent_Paper_Title,
             (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT))) > 0 as reviewer_decisions_exist
      ${filterQuery} 
      ORDER BY ${safeSortBy} ${safeSortOrder} 
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];

    const papers = db.prepare(dataQuery).all(...dataParams);
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      papers,
      total,
      page,
      limit,
      totalPages
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch manual screening papers' }, { status: 500 });
  }
}
