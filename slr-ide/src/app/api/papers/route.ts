import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig } from '@/lib/db';
import crypto from 'crypto';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

function generatePaperId(rawData: { Title?: string; DOI?: string; Authors?: string; Year?: any }): string {
  const authorsField = rawData.Authors || "";
  let author = "Unknown";
  if (authorsField) {
    const firstAuthor = authorsField.split(';')[0].trim();
    if (firstAuthor) {
      if (firstAuthor.includes(',')) {
        author = firstAuthor.split(',')[0].trim();
      } else {
        author = firstAuthor.split(' ')[0].trim();
      }
      author = author.replace(/[^a-zA-Z0-9]/g, "");
    }
  }
  if (!author) author = "Unknown";

  const year = rawData.Year || "NoYear";
  const title = rawData.Title || "";
  const shortTitle = title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);

  const doi = rawData.DOI || "";
  const stringToHash = (title + doi + authorsField).toLowerCase().replace(/[^a-z0-9]/g, "");
  const finalStringToHash = stringToHash || (author + year + shortTitle);

  const hashStr = crypto.createHash('md5').update(finalStringToHash).digest('hex').substring(0, 5);

  return `${author}_${year}_${shortTitle}_${hashStr}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    // Check if only hashes/deduplication keys are requested
    if (searchParams.get('onlyHashes') === 'true') {
      const rows = db.prepare("SELECT DOI, Title FROM papers WHERE Project_ID = ?").all(activeProjectId) as { DOI: string; Title: string }[];
      return NextResponse.json(rows);
    }

    // Check if only unique publishers are requested
    if (searchParams.get('getPublishers') === 'true') {
      const rows = db.prepare("SELECT DISTINCT Publisher FROM papers WHERE Project_ID = ? AND Publisher IS NOT NULL AND Publisher != '' ORDER BY Publisher ASC").all(activeProjectId) as { Publisher: string }[];
      return NextResponse.json(rows.map(r => r.Publisher));
    }

    if (searchParams.get('getManualStages') === 'true') {
      const rows = db.prepare("SELECT DISTINCT manual_stage FROM papers WHERE Project_ID = ? AND manual_stage IS NOT NULL AND manual_stage != '' ORDER BY manual_stage ASC").all(activeProjectId) as { manual_stage: string }[];
      return NextResponse.json(rows.map(r => r.manual_stage));
    }

    if (searchParams.get('getManualDecisions') === 'true') {
      const rows = db.prepare("SELECT DISTINCT manual_decision FROM papers WHERE Project_ID = ? AND manual_decision IS NOT NULL AND manual_decision != '' ORDER BY manual_decision ASC").all(activeProjectId) as { manual_decision: string }[];
      return NextResponse.json(rows.map(r => r.manual_decision));
    }

    // Check if unique exclusion criteria codes are requested
    if (searchParams.get('getEcTriggers') === 'true') {
      const stage = searchParams.get('pipelineStage');
      let manualStageFilter = '';
      let llmTaskTypeFilter = '';
      let stageCode = 0;
      if (stage === '1') {
        manualStageFilter = 'fast_filter';
        llmTaskTypeFilter = 'fast_filter';
        stageCode = 1;
      } else if (stage === '2') {
        manualStageFilter = 'gatekeeper';
        llmTaskTypeFilter = 'gatekeeper';
        stageCode = 2;
      } else if (stage === '3') {
        manualStageFilter = 'scientist';
        llmTaskTypeFilter = 'scientist';
        stageCode = 3;
      } else if (stage === '4') {
        manualStageFilter = 'miner';
        llmTaskTypeFilter = 'miner';
        stageCode = 4;
      }

      let manualAuditQuery = "SELECT DISTINCT ec_trigger as code FROM manual_audit_log WHERE project_id = ? AND ec_trigger IS NOT NULL AND ec_trigger != '' AND ec_trigger != 'NONE'";
      let manualAuditParams = [activeProjectId];
      if (manualStageFilter) {
        manualAuditQuery += " AND manual_stage = ?";
        manualAuditParams.push(manualStageFilter);
      }

      let llmAuditQuery = "SELECT DISTINCT json_extract(structured_output, '$.final_evaluation.exclusion_code') as code FROM llm_audit_log WHERE project_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1";
      let llmAuditParams = [activeProjectId];
      if (llmTaskTypeFilter) {
        llmAuditQuery += " AND task_type = ?";
        llmAuditParams.push(llmTaskTypeFilter);
      }

      let papersAiQuery = "SELECT DISTINCT ai_exclusion_code as code FROM papers WHERE Project_ID = ? AND ai_exclusion_code IS NOT NULL AND ai_exclusion_code != ''";
      let papersAiParams: any[] = [activeProjectId];
      if (stageCode > 0) {
        papersAiQuery += " AND ai_stage = ?";
        papersAiParams.push(stageCode);
      }

      let papersManualQuery = "SELECT DISTINCT manual_exclusion_code as code FROM papers WHERE Project_ID = ? AND manual_exclusion_code IS NOT NULL AND manual_exclusion_code != ''";
      let papersManualParams: any[] = [activeProjectId];
      if (stageCode > 0) {
        papersManualQuery += " AND manual_stage = ?";
        papersManualParams.push(stageCode);
      }

      const codesSet = new Set<string>();

      try {
        const r1 = db.prepare(manualAuditQuery).all(...manualAuditParams) as { code: string }[];
        r1.forEach(r => { if (r.code) codesSet.add(r.code); });

        const r2 = db.prepare(llmAuditQuery).all(...llmAuditParams) as { code: string }[];
        r2.forEach(r => { if (r.code) codesSet.add(r.code); });

        const r3 = db.prepare(papersAiQuery).all(...papersAiParams) as { code: string }[];
        r3.forEach(r => { if (r.code) codesSet.add(r.code); });

        const r4 = db.prepare(papersManualQuery).all(...papersManualParams) as { code: string }[];
        r4.forEach(r => { if (r.code) codesSet.add(r.code); });
      } catch (err) {
        console.error("Error fetching ec triggers:", err);
      }

      return NextResponse.json(Array.from(codesSet).sort());
    }

    const search = searchParams.get('search')?.trim() || '';
    const pdfStatus = searchParams.get('pdfStatus')?.trim() || '';
    const calibrationPool = searchParams.get('calibrationPool');
    const calibrationTag = searchParams.get('calibrationTag');
    
    const publisher = searchParams.get('publisher')?.trim() || '';
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

    const isCalQuery = calibrationPool && calibrationPool !== 'none';
    const tableName = isCalQuery ? 'calibration_papers' : 'papers';
    let filterQuery = ` FROM ${tableName} WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)`;
    const params: any[] = [activeProjectId];

    if (search) {
      filterQuery += ' AND (Paper_ID LIKE ? OR Title LIKE ? OR Abstract LIKE ? OR Authors LIKE ? OR DOI LIKE ? OR Publisher LIKE ?)';
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    if (pdfStatus) {
      filterQuery += ' AND Local_PDF_Status = ?';
      params.push(pdfStatus);
    }

    if (publisher) {
      filterQuery += ' AND Publisher = ?';
      params.push(publisher);
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

    if (calibrationPool) {
      if (tableName === 'papers') {
        if (calibrationPool === 'none') {
          filterQuery += ' AND Paper_ID NOT IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ?)';
          params.push(activeProjectId);
        } else {
          filterQuery += ' AND Paper_ID IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ? AND calibration_pool = ?)';
          params.push(activeProjectId, calibrationPool);
        }
      } else {
        if (calibrationPool === 'none') {
          filterQuery += ' AND (calibration_pool IS NULL OR calibration_pool = \'\')';
        } else {
          filterQuery += ' AND calibration_pool = ?';
          params.push(calibrationPool);
        }
      }
    }

    if (calibrationTag) {
      if (tableName === 'papers') {
        if (calibrationTag === 'none') {
          filterQuery += ' AND Paper_ID NOT IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ? AND calibration_tag IS NOT NULL AND calibration_tag != \'\')';
          params.push(activeProjectId);
        } else {
          filterQuery += ' AND Paper_ID IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ? AND calibration_tag = ?)';
          params.push(activeProjectId, calibrationTag);
        }
      } else {
        if (calibrationTag === 'none') {
          filterQuery += ' AND (calibration_tag IS NULL OR calibration_tag = \'\')';
        } else {
          filterQuery += ' AND calibration_tag = ?';
          params.push(calibrationTag);
        }
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
            SELECT ec_trigger, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = '${taskType}'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.exclusion_code')) as ec_trigger, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = '${taskType}' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ), '') IN ('', 'NONE')`;
      } else {
        filterQuery += ` AND (
          SELECT ec_trigger FROM (
            SELECT ec_trigger, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = '${taskType}'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.exclusion_code')) as ec_trigger, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = '${taskType}' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE ?`;
        params.push(`%${ecTrigger}%`);
      }
      filterQuery += ` AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) = ${pipelineStage}`;
    }

    if (pipelineStage === '1') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'fast_filter'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) >= 1`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'fast_filter'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) = 1`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai') {
        filterQuery += ` AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) <= 1
          AND NOT EXISTS (
            SELECT 1 FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'fast_filter'
          )
          AND NOT EXISTS (
            SELECT 1 FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          )`;
      }
    } else if (pipelineStage === '2') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'gatekeeper'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) >= 2`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'gatekeeper'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) = 2`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai' || pipelineStatus === 'pending_pdf') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'fast_filter'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'fast_filter' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'gatekeeper'
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
        )`;

        if (pipelineStatus === 'unprocessed') {
          filterQuery += ` AND ${tableName}.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        } else if (pipelineStatus === 'ready_for_ai') {
          filterQuery += ` AND ${tableName}.Local_PDF_Status = 'SYNCED'`;
        } else {
          filterQuery += ` AND ${tableName}.Local_PDF_Status NOT IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        }
      }
    } else if (pipelineStage === '3') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'scientist'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) >= 3`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'scientist'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) = 3`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'gatekeeper'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'gatekeeper' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'scientist'
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
        )`;

        if (pipelineStatus === 'unprocessed') {
          filterQuery += ` AND ${tableName}.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        } else if (pipelineStatus === 'ready_for_ai') {
          filterQuery += ` AND ${tableName}.Local_PDF_Status = 'SYNCED'`;
        }
      }
    } else if (pipelineStage === '4') {
      if (pipelineStatus === 'included') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'miner'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'miner' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) >= 4`;
      } else if (pipelineStatus === 'excluded') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'miner'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'miner' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'EXCLUDE%'
        AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) = 4`;
      } else if (pipelineStatus === 'unprocessed' || pipelineStatus === 'ready_for_ai') {
        filterQuery += ` AND (
          SELECT decision FROM (
            SELECT decision, created_at, 1 as priority FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'scientist'
            UNION ALL
            SELECT UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision, created_at, 0 as priority FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'scientist' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          ) ORDER BY priority DESC, created_at DESC LIMIT 1
        ) LIKE 'INCLUDE%'
        AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND manual_stage = 'miner'
        )
        AND NOT EXISTS (
          SELECT 1 FROM llm_audit_log WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID AND task_type = 'miner' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
        )`;

        if (pipelineStatus === 'unprocessed') {
          filterQuery += ` AND ${tableName}.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED')`;
        } else if (pipelineStatus === 'ready_for_ai') {
          filterQuery += ` AND ${tableName}.Local_PDF_Status = 'SYNCED'`;
        }
      }
    }

    if (pipelineStage && !pipelineStatus) {
      filterQuery += ` AND MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) = ${pipelineStage}`;
    }

    // Check if only IDs matching the current query filters are requested
    if (searchParams.get('onlyIds') === 'true') {
      const rows = db.prepare(`SELECT Paper_ID ${filterQuery}`).all(...params) as { Paper_ID: string }[];
      return NextResponse.json(rows.map(r => r.Paper_ID));
    }

    // 1. Get total matching count
    const countRow = db.prepare(`SELECT COUNT(*) as count ${filterQuery}`).get(...params) as { count: number } | undefined;
    const total = countRow ? countRow.count : 0;

    // 2. Sorting whitelist validation to prevent SQL Injection
    const allowedSortColumns = ['Paper_ID', 'Title', 'Authors', 'Year', 'DOI', 'Local_PDF_Status', 'calibration_pool', 'calibration_tag', 'Publisher', 'citation_count', 'ai_stage', 'ai_decision', 'ai_exclusion_code', 'ai_rationale', 'manual_stage', 'manual_decision', 'manual_exclusion_code', 'manual_rationale'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'Paper_ID';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const calibrationPoolSubquery = tableName === 'papers'
      ? `(SELECT calibration_pool FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND cp.Project_ID = papers.Project_ID) as calibration_pool,
         (SELECT calibration_tag FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND cp.Project_ID = papers.Project_ID) as calibration_tag,`
      : '';

    // 3. Paginated and sorted query execution with AI decisions subqueries
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT *, 
             MAX(IFNULL(${tableName}.manual_stage, 0), IFNULL(${tableName}.ai_stage, 0)) as Status,
             ${calibrationPoolSubquery}
             (SELECT Title FROM papers parent WHERE parent.Paper_ID = ${tableName}.Parent_Paper_ID AND parent.Project_ID = ${tableName}.Project_ID) as Parent_Paper_Title,
             (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = ${tableName}.Paper_ID AND project_id = ${tableName}.Project_ID) > 0 as reviewer_decisions_exist
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
    return NextResponse.json({ error: error.message || 'Failed to fetch papers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { papers, syncCitations } = body;

    if (!Array.isArray(papers)) {
      return NextResponse.json({ error: 'Payload must contain a "papers" array' }, { status: 400 });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let updatedCitationsCount = 0;

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    const findByDoiStmt = db.prepare("SELECT Paper_ID, DOI FROM papers WHERE DOI = ? AND DOI IS NOT NULL AND DOI != '' AND Project_ID = ?");
    const findByTitleStmt = db.prepare("SELECT Paper_ID, DOI FROM papers WHERE LOWER(REPLACE(Title, ' ', '')) = ? AND Project_ID = ?");
    const updateCitationStmt = db.prepare("UPDATE papers SET citation_count = ? WHERE Paper_ID = ? AND Project_ID = ?");
    const updateCitationAndDoiStmt = db.prepare("UPDATE papers SET citation_count = ?, DOI = ? WHERE Paper_ID = ? AND Project_ID = ?");

    const insertStmt = db.prepare(`
      INSERT INTO papers (
        Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year, PDF_Link, manual_decision, manual_stage, Local_PDF_Status, Project_ID, Parent_Paper_ID, Original_Publisher, Publisher, citation_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Fetch all existing paper IDs globally to resolve primary key collisions
    const allPaperIds = (db.prepare('SELECT Paper_ID FROM papers').all() as { Paper_ID: string }[]).map(r => r.Paper_ID);
    const paperIdSet = new Set(allPaperIds);
    
    // Fetch paper IDs for active project to set local ID counter
    const activeProjectPaperIds = (db.prepare('SELECT Paper_ID FROM papers WHERE Project_ID = ?').all(activeProjectId) as { Paper_ID: string }[]).map(r => r.Paper_ID);
    let idCounter = 0;
    for (const id of activeProjectPaperIds) {
      if (id) {
        const match = id.match(/\d+/);
        if (match) {
          const val = parseInt(match[0], 10);
          if (!isNaN(val) && val > idCounter) {
            idCounter = val;
          }
        }
      }
    }

    const transaction = db.transaction(() => {
      for (const paper of papers) {
        const title = paper.Title?.trim();
        if (!title) {
          skippedCount++;
          continue; // Title is mandatory
        }

        const doi = paper.DOI?.trim() || '';
        
        // Double-key Deduplication:
        // 1. Normalized DOI check (if DOI exists)
        let duplicate = false;
        let existingPaperId = '';
        let existingPaperDoi = '';
        if (doi) {
          const existingDoi = findByDoiStmt.get(doi, activeProjectId) as { Paper_ID: string; DOI: string } | undefined;
          if (existingDoi) {
            duplicate = true;
            existingPaperId = existingDoi.Paper_ID;
            existingPaperDoi = existingDoi.DOI;
          }
        }

        // 2. Stripped Title check (lowercase, remove spaces)
        if (!duplicate) {
          const cleanTitle = title.toLowerCase().replace(/\s+/g, '');
          const existingTitle = findByTitleStmt.get(cleanTitle, activeProjectId) as { Paper_ID: string; DOI: string } | undefined;
          if (existingTitle) {
            duplicate = true;
            existingPaperId = existingTitle.Paper_ID;
            existingPaperDoi = existingTitle.DOI;
          }
        }

        if (duplicate) {
          if (syncCitations && existingPaperId) {
            let citationCount = 0;
            if (paper.citation_count !== undefined && paper.citation_count !== null && paper.citation_count !== '') {
              const parsedCitations = parseInt(paper.citation_count, 10);
              if (!isNaN(parsedCitations)) {
                citationCount = parsedCitations;
              }
            }
            
            // Check if the current DOI in DB is empty, but incoming CSV has a filled DOI
            const isDbDoiEmpty = !existingPaperDoi || existingPaperDoi.trim() === '';
            const isIncomingDoiFilled = !!doi && doi.trim() !== '';
            
            if (isDbDoiEmpty && isIncomingDoiFilled) {
              updateCitationAndDoiStmt.run(citationCount, doi.trim(), existingPaperId, activeProjectId);
            } else {
              updateCitationStmt.run(citationCount, existingPaperId, activeProjectId);
            }
            updatedCitationsCount++;
          }
          skippedCount++;
          continue;
        }

        // Generate Paper_ID deterministically
        let paperId = generatePaperId({
          Title: title,
          DOI: doi,
          Authors: paper.Authors,
          Year: paper.Year
        });

        // Resolve conflict if the Paper_ID already exists globally in the database
        if (paperIdSet.has(paperId)) {
          let suffix = 1;
          let candidateId = `${paperId}_${suffix}`;
          while (paperIdSet.has(candidateId)) {
            suffix++;
            candidateId = `${paperId}_${suffix}`;
          }
          paperId = candidateId;
        }
        paperIdSet.add(paperId);

        // Map values
        const importDate = paper.Import_Date || new Date().toISOString().split('T')[0];
        const importSource = paper.Import_Source || 'CSV Import';
        const source = paper.Source || '';
        const abstract = paper.Abstract || '';
        const authors = paper.Authors || '';
        
        // Safe integer parsing for year to prevent NaN bindings in SQLite
        let year: number | null = null;
        if (paper.Year) {
          const parsedYear = parseInt(paper.Year, 10);
          if (!isNaN(parsedYear)) {
            year = parsedYear;
          }
        }

        // Safe integer parsing for citation_count
        let citationCount: number | null = null;
        if (paper.citation_count !== undefined && paper.citation_count !== null && paper.citation_count !== '') {
          const parsedCitations = parseInt(paper.citation_count, 10);
          if (!isNaN(parsedCitations)) {
            citationCount = parsedCitations;
          }
        }

        const pdfLink = paper.PDF_Link || '';
        const status = (paper.Status || '').trim();
        const manualDecisionVal = (status && status !== 'PENDING') ? status : null;
        let manualStageVal = 0;
        if (status && status !== 'PENDING') {
          const parsedStage = parseInt(status, 10);
          manualStageVal = !isNaN(parsedStage) ? parsedStage : 1;
        }
        
        // Initial Local PDF status
        const localPdfStatus = 'IGNORED';
        const parentPaperId = paper.Parent_Paper_ID || null;
        const originalPublisher = paper.Original_Publisher || paper.Publisher || '';
        const publisherVal = '';

        insertStmt.run(
          paperId,
          importDate,
          importSource,
          source,
          doi,
          title,
          abstract,
          authors,
          year,
          pdfLink,
          manualDecisionVal,
          manualStageVal,
          localPdfStatus,
          activeProjectId,
          parentPaperId,
          originalPublisher,
          publisherVal,
          citationCount
        );
        importedCount++;
      }
    });

    transaction();

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({
      success: true,
      total: papers.length,
      imported: importedCount,
      skipped: skippedCount,
      updatedCitations: updatedCitationsCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import papers' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { paperIds, localPdfStatus } = body;

    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return NextResponse.json({ error: 'Payload must contain a non-empty "paperIds" array' }, { status: 400 });
    }

    if (localPdfStatus === undefined) {
      return NextResponse.json({ error: 'Payload must specify "localPdfStatus" to update' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (localPdfStatus !== undefined) {
      updates.push('Local_PDF_Status = ?');
      params.push(localPdfStatus);
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const setClause = updates.join(', ');
    const query = `UPDATE papers SET ${setClause} WHERE Paper_ID = ? AND Project_ID = ?`;

    const stmt = db.prepare(query);
    const transaction = db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(...params, id, activeProjectId);
      }
    });

    transaction(paperIds);

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({ success: true, updatedCount: paperIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update papers' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm');

    if (confirm !== 'DELETE_ALL') {
      return NextResponse.json({ error: 'Confirmation parameter confirm=DELETE_ALL is required' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    // PDF Rescue
    const { rescuePdfAssets } = require('@/lib/pdf-utils');
    const papers = db.prepare('SELECT Paper_ID FROM papers WHERE Project_ID = ?').all(activeProjectId) as { Paper_ID: string }[];
    const paperIds = papers.map(p => p.Paper_ID);
    const rescuedCount = rescuePdfAssets(paperIds);

    db.prepare('DELETE FROM papers WHERE Project_ID = ?').run(activeProjectId);

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({ 
      success: true, 
      message: `All papers deleted successfully. Rescued ${rescuedCount} PDF assets.` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete all papers' }, { status: 500 });
  }
}
