import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET() {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    const projectsWithStats = projects.map(proj => {
      const stats = db.prepare(`
        SELECT 
          COUNT(CASE WHEN is_duplicate IS NULL OR is_duplicate = 0 THEN 1 END) as total,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) >= 1 THEN 1 ELSE 0 END) as screened,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED') THEN 1 ELSE 0 END) as acquired,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND Local_PDF_Status = 'SYNCED' THEN 1 ELSE 0 END) as synced,
          (SELECT COUNT(*) FROM calibration_papers WHERE Project_ID = ? AND calibration_pool = 'pool_a' AND (is_duplicate IS NULL OR is_duplicate = 0)) as pool_a_count,
          (SELECT COUNT(*) FROM calibration_papers WHERE Project_ID = ? AND calibration_pool = 'pool_b' AND (is_duplicate IS NULL OR is_duplicate = 0)) as pool_b_count,
          (SELECT COUNT(*) FROM calibration_papers WHERE Project_ID = ? AND calibration_pool = 'pool_c' AND (is_duplicate IS NULL OR is_duplicate = 0)) as pool_c_count,
          SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicates
        FROM papers WHERE Project_ID = ?
      `).get(proj.id, proj.id, proj.id, proj.id) as any;

      const tagRows = db.prepare(`
        SELECT calibration_pool, calibration_tag, COUNT(*) as count 
        FROM calibration_papers 
        WHERE Project_ID = ? AND calibration_pool IS NOT NULL AND (is_duplicate IS NULL OR is_duplicate = 0)
        GROUP BY calibration_pool, calibration_tag
      `).all(proj.id) as { calibration_pool: string; calibration_tag: string | null; count: number }[];

      const tagStats: Record<string, Record<string, number>> = {
        pool_a: {},
        pool_b: {},
        pool_c: {}
      };

      for (const row of tagRows) {
        const p = row.calibration_pool;
        const tag = row.calibration_tag || '__general';
        if (tagStats[p]) {
          tagStats[p][tag] = row.count;
        }
      }

      const stageStatsRows = db.prepare(`
        WITH combined_logs AS (
          SELECT paper_id, task_type, 
                 UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision,
                 UPPER(json_extract(structured_output, '$.final_evaluation.exclusion_code')) as ec_trigger,
                 created_at,
                 0 as priority
          FROM llm_audit_log
          WHERE project_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          UNION ALL
          SELECT paper_id, manual_stage as task_type,
                 UPPER(decision) as decision,
                 UPPER(ec_trigger) as ec_trigger,
                 created_at,
                 1 as priority
          FROM manual_audit_log
          WHERE project_id = ?
        ),
        ranked_decisions AS (
          SELECT *, ROW_NUMBER() OVER(PARTITION BY paper_id, task_type ORDER BY priority DESC, created_at DESC) as rn
          FROM combined_logs
        )
        SELECT 
          CASE d.task_type 
            WHEN 'fast_filter' THEN '1' 
            WHEN 'gatekeeper' THEN '2' 
            WHEN 'scientist' THEN '3'
            WHEN 'miner' THEN '4'
            ELSE d.task_type 
          END as stage,
          SUM(CASE WHEN d.task_type = 'miner' OR d.decision LIKE 'INCLUDE%' THEN 1 ELSE 0 END) as included,
          SUM(CASE WHEN d.decision LIKE 'EXCLUDE%' THEN 1 ELSE 0 END) as excluded,
          SUM(CASE WHEN d.decision LIKE 'INCLUDE%' AND p.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED') THEN 1 ELSE 0 END) as inc_has_pdf,
          SUM(CASE WHEN d.decision LIKE 'INCLUDE%' AND (p.DOI IS NULL OR p.DOI = '') THEN 1 ELSE 0 END) as inc_no_doi,
          SUM(CASE WHEN d.decision LIKE 'INCLUDE%' AND p.Local_PDF_Status = 'FAILED' THEN 1 ELSE 0 END) as inc_pdf_failed
        FROM ranked_decisions d
        JOIN papers p ON p.Paper_ID = d.paper_id
        WHERE d.rn = 1 AND (p.is_duplicate IS NULL OR p.is_duplicate = 0) AND d.task_type IN ('fast_filter', 'gatekeeper', 'scientist', 'miner')
        GROUP BY d.task_type
      `).all(proj.id, proj.id) as { stage: string; included: number; excluded: number; inc_has_pdf: number; inc_no_doi: number; inc_pdf_failed: number; }[];

      const stageECStatsRows = db.prepare(`
        WITH combined_logs AS (
          SELECT paper_id, task_type, 
                 UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision,
                 UPPER(json_extract(structured_output, '$.final_evaluation.exclusion_code')) as ec_trigger,
                 created_at,
                 0 as priority
          FROM llm_audit_log
          WHERE project_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          UNION ALL
          SELECT paper_id, manual_stage as task_type,
                 UPPER(decision) as decision,
                 UPPER(ec_trigger) as ec_trigger,
                 created_at,
                 1 as priority
          FROM manual_audit_log
          WHERE project_id = ?
        ),
        ranked_decisions AS (
          SELECT *, ROW_NUMBER() OVER(PARTITION BY paper_id, task_type ORDER BY priority DESC, created_at DESC) as rn
          FROM combined_logs
        )
        SELECT 
          CASE d.task_type 
            WHEN 'fast_filter' THEN '1' 
            WHEN 'gatekeeper' THEN '2' 
            WHEN 'scientist' THEN '3'
            WHEN 'miner' THEN '4'
            ELSE d.task_type 
          END as stage,
          COALESCE(d.ec_trigger, 'Unspecified') as ec_trigger,
          COUNT(p.Paper_ID) as count
        FROM ranked_decisions d
        JOIN papers p ON p.Paper_ID = d.paper_id
        WHERE d.rn = 1 AND (p.is_duplicate IS NULL OR p.is_duplicate = 0) 
          AND d.task_type IN ('fast_filter', 'gatekeeper', 'scientist', 'miner')
          AND d.decision LIKE 'EXCLUDE%'
        GROUP BY d.task_type, d.ec_trigger
      `).all(proj.id, proj.id) as { stage: string; ec_trigger: string | null; count: number }[];

      const stage1Unprocessed = db.prepare(`
        SELECT COUNT(p.Paper_ID) as count
        FROM papers p
        WHERE p.Project_ID = ? AND (p.is_duplicate IS NULL OR p.is_duplicate = 0) AND MAX(p.manual_stage, p.ai_stage) <= 1
          AND NOT EXISTS (
            SELECT 1 FROM llm_audit_log l 
            WHERE l.paper_id = p.Paper_ID AND l.status = 'SUCCESS' AND json_valid(l.structured_output) = 1
              AND l.task_type = 'fast_filter'
          )
          AND NOT EXISTS (
            SELECT 1 FROM manual_audit_log m
            WHERE m.paper_id = p.Paper_ID AND m.manual_stage = 'fast_filter'
          )
      `).get(proj.id) as { count: number };

      const stage2Unprocessed = db.prepare(`
        WITH combined_logs AS (
          SELECT paper_id, task_type, 
                 UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision,
                 created_at,
                 0 as priority
          FROM llm_audit_log
          WHERE project_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          UNION ALL
          SELECT paper_id, manual_stage as task_type,
                 UPPER(decision) as decision,
                 created_at,
                 1 as priority
          FROM manual_audit_log
          WHERE project_id = ?
        ),
        ranked_decisions AS (
          SELECT *, ROW_NUMBER() OVER(PARTITION BY paper_id, task_type ORDER BY priority DESC, created_at DESC) as rn
          FROM combined_logs
        ),
        stage1_includes AS (
          SELECT paper_id
          FROM ranked_decisions
          WHERE rn = 1 AND task_type = 'fast_filter' AND decision LIKE 'INCLUDE%'
        )
        SELECT 
          SUM(CASE WHEN p.Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED') THEN 1 ELSE 0 END) as unprocessed,
          SUM(CASE WHEN p.Local_PDF_Status NOT IN ('MATCHED', 'DOWNLOADED', 'SYNCED') THEN 1 ELSE 0 END) as pending_pdf
        FROM stage1_includes s1
        JOIN papers p ON p.Paper_ID = s1.paper_id
        WHERE (p.is_duplicate IS NULL OR p.is_duplicate = 0)
          AND NOT EXISTS (
            SELECT 1 FROM ranked_decisions r
            WHERE r.paper_id = s1.paper_id AND r.rn = 1 AND r.task_type = 'gatekeeper'
          )
      `).get(proj.id, proj.id) as { unprocessed: number | null; pending_pdf: number | null };

      const stage3Unprocessed = db.prepare(`
        WITH combined_logs AS (
          SELECT paper_id, task_type, 
                 UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision,
                 created_at,
                 0 as priority
          FROM llm_audit_log
          WHERE project_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          UNION ALL
          SELECT paper_id, manual_stage as task_type,
                 UPPER(decision) as decision,
                 created_at,
                 1 as priority
          FROM manual_audit_log
          WHERE project_id = ?
        ),
        ranked_decisions AS (
          SELECT *, ROW_NUMBER() OVER(PARTITION BY paper_id, task_type ORDER BY priority DESC, created_at DESC) as rn
          FROM combined_logs
        ),
        stage2_includes AS (
          SELECT paper_id
          FROM ranked_decisions
          WHERE rn = 1 AND task_type = 'gatekeeper' AND decision LIKE 'INCLUDE%'
        )
        SELECT COUNT(p.Paper_ID) as count
        FROM stage2_includes s2
        JOIN papers p ON p.Paper_ID = s2.paper_id
        WHERE (p.is_duplicate IS NULL OR p.is_duplicate = 0)
          AND NOT EXISTS (
            SELECT 1 FROM ranked_decisions r
            WHERE r.paper_id = s2.paper_id AND r.rn = 1 AND r.task_type = 'scientist'
          )
      `).get(proj.id, proj.id) as { count: number };

      const stage4Unprocessed = db.prepare(`
        WITH combined_logs AS (
          SELECT paper_id, task_type, 
                 UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision,
                 created_at,
                 0 as priority
          FROM llm_audit_log
          WHERE project_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          UNION ALL
          SELECT paper_id, manual_stage as task_type,
                 UPPER(decision) as decision,
                 created_at,
                 1 as priority
          FROM manual_audit_log
          WHERE project_id = ?
        ),
        ranked_decisions AS (
          SELECT *, ROW_NUMBER() OVER(PARTITION BY paper_id, task_type ORDER BY priority DESC, created_at DESC) as rn
          FROM combined_logs
        ),
        stage3_includes AS (
          SELECT paper_id
          FROM ranked_decisions
          WHERE rn = 1 AND task_type = 'scientist' AND decision LIKE 'INCLUDE%'
        )
        SELECT COUNT(p.Paper_ID) as count
        FROM stage3_includes s3
        JOIN papers p ON p.Paper_ID = s3.paper_id
        WHERE (p.is_duplicate IS NULL OR p.is_duplicate = 0)
          AND NOT EXISTS (
            SELECT 1 FROM ranked_decisions r
            WHERE r.paper_id = s3.paper_id AND r.rn = 1 AND r.task_type = 'miner'
          )
      `).get(proj.id, proj.id) as { count: number };

      const ecBreakdown: Record<string, Record<string, number>> = {
        '1': {},
        '2': {},
        '3': {},
        '4': {}
      };

      for (const row of stageECStatsRows) {
        const s = row.stage;
        const trigger = row.ec_trigger || 'Unspecified';
        if (ecBreakdown[s]) {
          if (trigger.includes(',')) {
            const parts = trigger.split(',').map(p => p.trim()).filter(Boolean);
            for (const part of parts) {
              ecBreakdown[s][part] = (ecBreakdown[s][part] || 0) + row.count;
            }
          } else {
            ecBreakdown[s][trigger] = (ecBreakdown[s][trigger] || 0) + row.count;
          }
        }
      }

      // Fetch and aggregate NOT_STATED metrics for Stage 4
      const processedMinerPapers = db.prepare(`
        SELECT Paper_ID, manual_stage, ai_stage, manual_extracted_data, ai_extracted_data
        FROM papers
        WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
          AND (
            manual_stage = 4
            OR ai_stage = 4
            OR EXISTS (
              SELECT 1 FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND task_type = 'miner' AND status = 'SUCCESS' AND json_valid(structured_output) = 1
            )
            OR EXISTS (
              SELECT 1 FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND manual_stage = 'miner'
            )
          )
      `).all(proj.id) as { Paper_ID: string; manual_stage: number; ai_stage: number; manual_extracted_data: string | null; ai_extracted_data: string | null; }[];

      const notStatedCounts: Record<string, number> = {};
      const isNotStated = (val: any): boolean => {
        if (typeof val === 'string') {
          return val.trim().toUpperCase() === 'NOT_STATED';
        }
        if (Array.isArray(val)) {
          return val.some(item => typeof item === 'string' && item.trim().toUpperCase() === 'NOT_STATED');
        }
        return false;
      };

      for (const paper of processedMinerPapers) {
        let rawExtData = null;
        if (paper.manual_stage >= paper.ai_stage) {
          rawExtData = paper.manual_extracted_data || paper.ai_extracted_data;
        } else {
          rawExtData = paper.ai_extracted_data || paper.manual_extracted_data;
        }

        if (!rawExtData) continue;

        try {
          const parsed = JSON.parse(rawExtData);
          const extDataObj = parsed.extracted_data || parsed;
          if (extDataObj && typeof extDataObj === 'object') {
            for (const [key, fieldObj] of Object.entries(extDataObj)) {
              if (fieldObj && typeof fieldObj === 'object') {
                const val = (fieldObj as any).value;
                if (isNotStated(val)) {
                  notStatedCounts[key] = (notStatedCounts[key] || 0) + 1;
                }
              } else {
                if (isNotStated(fieldObj)) {
                  notStatedCounts[key] = (notStatedCounts[key] || 0) + 1;
                }
              }
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      const stageStats: Record<string, { included: number; excluded: number; unprocessed: number; total: number; ecBreakdown: Record<string, number>; inc_has_pdf?: number; inc_no_doi?: number; inc_pdf_failed?: number; pending_pdf?: number; notStatedMetrics?: Record<string, number>; }> = {
        '1': { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: ecBreakdown['1'], inc_has_pdf: 0, inc_no_doi: 0, inc_pdf_failed: 0 },
        '2': { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: ecBreakdown['2'], inc_has_pdf: 0, inc_no_doi: 0, inc_pdf_failed: 0, pending_pdf: 0 },
        '3': { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: ecBreakdown['3'] },
        '4': { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: ecBreakdown['4'], notStatedMetrics: notStatedCounts }
      };

      for (const row of stageStatsRows) {
        const s = row.stage;
        if (stageStats[s]) {
          stageStats[s].included = row.included;
          stageStats[s].excluded = row.excluded;
          stageStats[s].inc_has_pdf = row.inc_has_pdf || 0;
          stageStats[s].inc_no_doi = row.inc_no_doi || 0;
          stageStats[s].inc_pdf_failed = row.inc_pdf_failed || 0;
        }
      }

      stageStats['1'].unprocessed = stage1Unprocessed.count;
      stageStats['2'].unprocessed = stage2Unprocessed.unprocessed || 0;
      stageStats['2'].pending_pdf = stage2Unprocessed.pending_pdf || 0;
      stageStats['3'].unprocessed = stage3Unprocessed.count;
      stageStats['4'].unprocessed = stage4Unprocessed.count;

      // Calculate totals based on actual processed + unprocessed
      stageStats['1'].total = stageStats['1'].included + stageStats['1'].excluded + stageStats['1'].unprocessed;
      stageStats['2'].total = stageStats['2'].included + stageStats['2'].excluded + stageStats['2'].unprocessed + (stageStats['2'].pending_pdf || 0);
      stageStats['3'].total = stageStats['3'].included + stageStats['3'].excluded + stageStats['3'].unprocessed;
      stageStats['4'].total = stageStats['4'].included + stageStats['4'].excluded + stageStats['4'].unprocessed;
      
      return {
        ...proj,
        stats: stats ? { ...stats, tagStats, stageStats } : { total: 0, screened: 0, acquired: 0, synced: 0, pool_a_count: 0, pool_b_count: 0, pool_c_count: 0, tagStats, stageStats }
      };
    });

    return NextResponse.json({ projects: projectsWithStats, activeProjectId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      name, 
      folder_name, 
      manifesto, 
      objective, 
      questions, 
      qa_definition, 
      exclusion_criteria, 
      pool_a_size, 
      pool_b_size, 
      pool_c_size,
      gdrive_dest_path,
      goldmine_dest_path,
      cloud_provider,
      rclone_remote_name,
      pool_tags,
      ec_rules,
      reasoning_template,
      project_budget_limit,
      project_tax,
      llm_config,
      rolling_batch_size
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is mandatory' }, { status: 400 });
    }

    if (!folder_name || !folder_name.trim()) {
      return NextResponse.json({ error: 'Folder name is mandatory' }, { status: 400 });
    }

    // Sanitize folder name: lowercase, replace spaces/special chars with underscores
    const sanitizedFolder = folder_name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    // Check if folder name is unique
    const existingFolder = db.prepare('SELECT id FROM projects WHERE folder_name = ?').get(sanitizedFolder);
    if (existingFolder) {
      return NextResponse.json({ error: 'Folder name must be unique' }, { status: 400 });
    }

    const id = `proj-${Date.now()}`;
    const poolA = parseInt(pool_a_size || '50', 10) || 50;
    const poolB = parseInt(pool_b_size || '30', 10) || 30;
    const poolC = parseInt(pool_c_size || '20', 10) || 20;
    const gdriveDest = (gdrive_dest_path || 'SLR_Magic/PDFs').trim();
    const goldmineDest = goldmine_dest_path ? String(goldmine_dest_path).trim() : '';
    const cloudProvider = cloud_provider || 'gdrive';
    const remoteName = rclone_remote_name ? rclone_remote_name.trim() : '';
    const poolTags = pool_tags ? (typeof pool_tags === 'string' ? pool_tags : JSON.stringify(pool_tags)) : '{}';
    const ecRules = ec_rules ? (typeof ec_rules === 'string' ? ec_rules : JSON.stringify(ec_rules)) : '[]';
    const reasoningTemplate = reasoning_template ? (typeof reasoning_template === 'string' ? reasoning_template : JSON.stringify(reasoning_template)) : '[]';
    const poolBEcRules = body.pool_b_ec_rules ? (typeof body.pool_b_ec_rules === 'string' ? body.pool_b_ec_rules : JSON.stringify(body.pool_b_ec_rules)) : '[]';
    const poolBReasoningTemplate = body.pool_b_reasoning_template ? (typeof body.pool_b_reasoning_template === 'string' ? body.pool_b_reasoning_template : JSON.stringify(body.pool_b_reasoning_template)) : '[]';
    const poolCQaRules = body.pool_c_qa_rules ? (typeof body.pool_c_qa_rules === 'string' ? body.pool_c_qa_rules : JSON.stringify(body.pool_c_qa_rules)) : '[]';
    const poolCExtractionRules = body.pool_c_extraction_rules ? (typeof body.pool_c_extraction_rules === 'string' ? body.pool_c_extraction_rules : JSON.stringify(body.pool_c_extraction_rules)) : '[]';
    const budgetLimit = project_budget_limit !== undefined ? parseFloat(project_budget_limit) : 5.0;
    const llmConfigStr = llm_config ? (typeof llm_config === 'string' ? llm_config : JSON.stringify(llm_config)) : '{}';
    const taxRate = project_tax !== undefined ? parseFloat(project_tax) : 0.0;
    const rollingBatchSize = rolling_batch_size !== undefined ? parseInt(rolling_batch_size, 10) : 20;

    db.prepare(`
      INSERT INTO projects (
        id, name, folder_name, manifesto, objective, questions, qa_definition, exclusion_criteria, pool_a_size, pool_b_size, pool_c_size, gdrive_dest_path, goldmine_dest_path, cloud_provider, rclone_remote_name, pool_tags, ec_rules, reasoning_template, pool_b_ec_rules, pool_b_reasoning_template, pool_c_qa_rules, pool_c_extraction_rules, project_budget_limit, project_tax, llm_config, rolling_batch_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      sanitizedFolder,
      manifesto ? String(manifesto).trim() : '',
      objective ? String(objective).trim() : '',
      questions ? String(questions).trim() : '',
      qa_definition ? String(qa_definition).trim() : '',
      exclusion_criteria ? String(exclusion_criteria).trim() : '',
      poolA,
      poolB,
      poolC,
      gdriveDest,
      goldmineDest,
      cloudProvider,
      remoteName,
      poolTags,
      ecRules,
      reasoningTemplate,
      poolBEcRules,
      poolBReasoningTemplate,
      poolCQaRules,
      poolCExtractionRules,
      budgetLimit,
      taxRate,
      llmConfigStr,
      rollingBatchSize,
      new Date().toISOString()
    );

    return NextResponse.json({ success: true, project: { id, name, folder_name: sanitizedFolder } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create project' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 
      id,
      name, 
      manifesto, 
      objective, 
      questions, 
      qa_definition, 
      exclusion_criteria, 
      pool_a_size, 
      pool_b_size, 
      pool_c_size,
      gdrive_dest_path,
      goldmine_dest_path,
      cloud_provider,
      rclone_remote_name,
      pool_tags,
      ec_rules,
      reasoning_template,
      pool_b_ec_rules,
      pool_b_reasoning_template,
      pool_c_qa_rules,
      pool_c_extraction_rules,
      project_budget_limit,
      project_tax,
      llm_config,
      rolling_batch_size
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is mandatory' }, { status: 400 });
    }

    const poolA = parseInt(pool_a_size || '50', 10) || 50;
    const poolB = parseInt(pool_b_size || '30', 10) || 30;
    const poolC = parseInt(pool_c_size || '20', 10) || 20;
    const gdriveDest = (gdrive_dest_path || 'SLR_Magic/PDFs').trim();
    const goldmineDest = goldmine_dest_path ? String(goldmine_dest_path).trim() : '';
    const cloudProvider = cloud_provider || 'gdrive';
    const remoteName = rclone_remote_name ? rclone_remote_name.trim() : '';
    const poolTags = pool_tags ? (typeof pool_tags === 'string' ? pool_tags : JSON.stringify(pool_tags)) : '{}';
    const ecRules = ec_rules ? (typeof ec_rules === 'string' ? ec_rules : JSON.stringify(ec_rules)) : '[]';
    const reasoningTemplate = reasoning_template ? (typeof reasoning_template === 'string' ? reasoning_template : JSON.stringify(reasoning_template)) : '[]';
    const poolBEcRules = pool_b_ec_rules ? (typeof pool_b_ec_rules === 'string' ? pool_b_ec_rules : JSON.stringify(pool_b_ec_rules)) : '[]';
    const poolBReasoningTemplate = pool_b_reasoning_template ? (typeof pool_b_reasoning_template === 'string' ? pool_b_reasoning_template : JSON.stringify(pool_b_reasoning_template)) : '[]';
    const poolCQaRules = pool_c_qa_rules ? (typeof pool_c_qa_rules === 'string' ? pool_c_qa_rules : JSON.stringify(pool_c_qa_rules)) : '[]';
    const poolCExtractionRules = pool_c_extraction_rules ? (typeof pool_c_extraction_rules === 'string' ? pool_c_extraction_rules : JSON.stringify(pool_c_extraction_rules)) : '[]';
    const budgetLimit = project_budget_limit !== undefined ? parseFloat(project_budget_limit) : 5.0;
    const llmConfigStr = llm_config ? (typeof llm_config === 'string' ? llm_config : JSON.stringify(llm_config)) : '{}';
    const taxRate = project_tax !== undefined ? parseFloat(project_tax) : 0.0;
    const rollingBatchSize = rolling_batch_size !== undefined ? parseInt(rolling_batch_size, 10) : 20;

    db.prepare(`
      UPDATE projects
      SET name = ?,
          manifesto = ?,
          objective = ?,
          questions = ?,
          qa_definition = ?,
          exclusion_criteria = ?,
          pool_a_size = ?,
          pool_b_size = ?,
          pool_c_size = ?,
          gdrive_dest_path = ?,
          goldmine_dest_path = ?,
          cloud_provider = ?,
          rclone_remote_name = ?,
          pool_tags = ?,
          ec_rules = ?,
          reasoning_template = ?,
          pool_b_ec_rules = ?,
          pool_b_reasoning_template = ?,
          pool_c_qa_rules = ?,
          pool_c_extraction_rules = ?,
          project_budget_limit = ?,
          project_tax = ?,
          llm_config = ?,
          rolling_batch_size = ?
      WHERE id = ?
    `).run(
      name.trim(),
      manifesto ? String(manifesto).trim() : '',
      objective ? String(objective).trim() : '',
      questions ? String(questions).trim() : '',
      qa_definition ? String(qa_definition).trim() : '',
      exclusion_criteria ? String(exclusion_criteria).trim() : '',
      poolA,
      poolB,
      poolC,
      gdriveDest,
      goldmineDest,
      cloudProvider,
      remoteName,
      poolTags,
      ecRules,
      reasoningTemplate,
      poolBEcRules,
      poolBReasoningTemplate,
      poolCQaRules,
      poolCExtractionRules,
      budgetLimit,
      taxRate,
      llmConfigStr,
      rollingBatchSize,
      id
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update project' }, { status: 500 });
  }
}
