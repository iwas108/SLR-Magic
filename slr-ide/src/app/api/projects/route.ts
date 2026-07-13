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
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND CAST(Status AS INTEGER) >= 1 THEN 1 ELSE 0 END) as screened,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED') THEN 1 ELSE 0 END) as acquired,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND Local_PDF_Status = 'SYNCED' THEN 1 ELSE 0 END) as synced,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND calibration_pool = 'pool_a' THEN 1 ELSE 0 END) as pool_a_count,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND calibration_pool = 'pool_b' THEN 1 ELSE 0 END) as pool_b_count,
          SUM(CASE WHEN (is_duplicate IS NULL OR is_duplicate = 0) AND calibration_pool = 'pool_c' THEN 1 ELSE 0 END) as pool_c_count,
          SUM(CASE WHEN is_duplicate = 1 THEN 1 ELSE 0 END) as duplicates
        FROM papers WHERE Project_ID = ?
      `).get(proj.id) as any;

      const tagRows = db.prepare(`
        SELECT calibration_pool, calibration_tag, COUNT(*) as count 
        FROM papers 
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
        SELECT 
          Status as stage,
          SUM(CASE WHEN (
            UPPER(Human_Decision) = 'INCLUDE' OR 
            (Human_Decision IS NULL AND UPPER(manual_decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND UPPER(AI_Decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND AI_Decision IS NULL AND (
              SELECT UPPER(decision) FROM reviewer_decisions 
              WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
              ORDER BY imported_at DESC LIMIT 1
            ) = 'INCLUDE')
          ) THEN 1 ELSE 0 END) as included,
          SUM(CASE WHEN (
            UPPER(Human_Decision) = 'EXCLUDE' OR 
            (Human_Decision IS NULL AND UPPER(manual_decision) = 'EXCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND UPPER(AI_Decision) = 'EXCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND AI_Decision IS NULL AND (
              SELECT UPPER(decision) FROM reviewer_decisions 
              WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
              ORDER BY imported_at DESC LIMIT 1
            ) = 'EXCLUDE')
          ) THEN 1 ELSE 0 END) as excluded,
          SUM(CASE WHEN (
            (UPPER(Human_Decision) = 'INCLUDE' OR 
            (Human_Decision IS NULL AND UPPER(manual_decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND UPPER(AI_Decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND AI_Decision IS NULL AND (
              SELECT UPPER(decision) FROM reviewer_decisions 
              WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
              ORDER BY imported_at DESC LIMIT 1
            ) = 'INCLUDE')) AND Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED')
          ) THEN 1 ELSE 0 END) as inc_has_pdf,
          SUM(CASE WHEN (
            (UPPER(Human_Decision) = 'INCLUDE' OR 
            (Human_Decision IS NULL AND UPPER(manual_decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND UPPER(AI_Decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND AI_Decision IS NULL AND (
              SELECT UPPER(decision) FROM reviewer_decisions 
              WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
              ORDER BY imported_at DESC LIMIT 1
            ) = 'INCLUDE')) AND (DOI IS NULL OR DOI = '')
          ) THEN 1 ELSE 0 END) as inc_no_doi,
          SUM(CASE WHEN (
            (UPPER(Human_Decision) = 'INCLUDE' OR 
            (Human_Decision IS NULL AND UPPER(manual_decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND UPPER(AI_Decision) = 'INCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND AI_Decision IS NULL AND (
              SELECT UPPER(decision) FROM reviewer_decisions 
              WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
              ORDER BY imported_at DESC LIMIT 1
            ) = 'INCLUDE')) AND Local_PDF_Status = 'FAILED'
          ) THEN 1 ELSE 0 END) as inc_pdf_failed,
          COUNT(*) as total_in_stage
        FROM papers 
        WHERE Project_ID = ? AND Status IN ('1', '2') AND (is_duplicate IS NULL OR is_duplicate = 0)
        GROUP BY Status
      `).all(proj.id) as { stage: string; included: number; excluded: number; inc_has_pdf: number; inc_no_doi: number; inc_pdf_failed: number; total_in_stage: number }[];

      const stageECStatsRows = db.prepare(`
        SELECT 
          Status as stage,
          COALESCE(
            Human_EC_Trigger, 
            manual_ec_trigger, 
            AI_EC_Trigger, 
            (SELECT ec_trigger FROM reviewer_decisions 
             WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
             ORDER BY imported_at DESC LIMIT 1)
          ) as ec_trigger,
          COUNT(*) as count
        FROM papers 
        WHERE Project_ID = ? AND Status IN ('1', '2') AND (is_duplicate IS NULL OR is_duplicate = 0)
        AND (
            UPPER(Human_Decision) = 'EXCLUDE' OR 
            (Human_Decision IS NULL AND UPPER(manual_decision) = 'EXCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND UPPER(AI_Decision) = 'EXCLUDE') OR
            (Human_Decision IS NULL AND manual_decision IS NULL AND AI_Decision IS NULL AND (
              SELECT UPPER(decision) FROM reviewer_decisions 
              WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
              ORDER BY imported_at DESC LIMIT 1
            ) = 'EXCLUDE')
        )
        GROUP BY Status, ec_trigger
      `).all(proj.id) as { stage: string; ec_trigger: string | null; count: number }[];

      const ecBreakdown: Record<string, Record<string, number>> = {
        '1': {},
        '2': {}
      };

      for (const row of stageECStatsRows) {
        const s = row.stage;
        const trigger = row.ec_trigger || 'Unspecified';
        if (ecBreakdown[s]) {
          ecBreakdown[s][trigger] = (ecBreakdown[s][trigger] || 0) + row.count;
        }
      }

      const stageStats: Record<string, { included: number; excluded: number; unprocessed: number; total: number; ecBreakdown: Record<string, number>; inc_has_pdf?: number; inc_no_doi?: number; inc_pdf_failed?: number; }> = {
        '1': { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: ecBreakdown['1'], inc_has_pdf: 0, inc_no_doi: 0, inc_pdf_failed: 0 },
        '2': { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: ecBreakdown['2'], inc_has_pdf: 0, inc_no_doi: 0, inc_pdf_failed: 0 }
      };

      for (const row of stageStatsRows) {
        const s = row.stage;
        if (stageStats[s]) {
          stageStats[s].included = row.included;
          stageStats[s].excluded = row.excluded;
          stageStats[s].total = row.total_in_stage;
          stageStats[s].unprocessed = row.total_in_stage - row.included - row.excluded;
          stageStats[s].inc_has_pdf = row.inc_has_pdf || 0;
          stageStats[s].inc_no_doi = row.inc_no_doi || 0;
          stageStats[s].inc_pdf_failed = row.inc_pdf_failed || 0;
        }
      }
      
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
      cloud_provider,
      rclone_remote_name,
      pool_tags,
      ec_rules,
      reasoning_template,
      project_budget_limit,
      llm_config
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

    db.prepare(`
      INSERT INTO projects (
        id, name, folder_name, manifesto, objective, questions, qa_definition, exclusion_criteria, pool_a_size, pool_b_size, pool_c_size, gdrive_dest_path, cloud_provider, rclone_remote_name, pool_tags, ec_rules, reasoning_template, pool_b_ec_rules, pool_b_reasoning_template, pool_c_qa_rules, pool_c_extraction_rules, project_budget_limit, llm_config, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      llmConfigStr,
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
      llm_config
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
          llm_config = ?
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
      llmConfigStr,
      id
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update project' }, { status: 500 });
  }
}
