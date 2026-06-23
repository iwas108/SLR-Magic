import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET() {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    const projectsWithStats = projects.map(proj => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN Status IN ('INCLUDE', 'EXCLUDE') THEN 1 ELSE 0 END) as screened,
          SUM(CASE WHEN Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED') THEN 1 ELSE 0 END) as acquired,
          SUM(CASE WHEN Local_PDF_Status = 'SYNCED' THEN 1 ELSE 0 END) as synced,
          SUM(CASE WHEN calibration_pool = 'pool_a' THEN 1 ELSE 0 END) as pool_a_count,
          SUM(CASE WHEN calibration_pool = 'pool_b' THEN 1 ELSE 0 END) as pool_b_count,
          SUM(CASE WHEN calibration_pool = 'pool_c' THEN 1 ELSE 0 END) as pool_c_count
        FROM papers WHERE Project_ID = ?
      `).get(proj.id) as any;

      const tagRows = db.prepare(`
        SELECT calibration_pool, calibration_tag, COUNT(*) as count 
        FROM papers 
        WHERE Project_ID = ? AND calibration_pool IS NOT NULL 
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
      
      return {
        ...proj,
        stats: stats ? { ...stats, tagStats } : { total: 0, screened: 0, acquired: 0, synced: 0, pool_a_count: 0, pool_b_count: 0, pool_c_count: 0, tagStats }
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
    const budgetLimit = project_budget_limit !== undefined ? parseFloat(project_budget_limit) : 5.0;
    const llmConfigStr = llm_config ? (typeof llm_config === 'string' ? llm_config : JSON.stringify(llm_config)) : '{}';

    db.prepare(`
      INSERT INTO projects (
        id, name, folder_name, manifesto, objective, questions, qa_definition, exclusion_criteria, pool_a_size, pool_b_size, pool_c_size, gdrive_dest_path, cloud_provider, rclone_remote_name, pool_tags, ec_rules, reasoning_template, project_budget_limit, llm_config, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      budgetLimit,
      llmConfigStr,
      id
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update project' }, { status: 500 });
  }
}
