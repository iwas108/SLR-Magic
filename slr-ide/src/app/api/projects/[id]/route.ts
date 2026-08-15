import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import db, { PROJECT_ROOT, getConfig } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

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
    `).get(projectId, projectId, projectId, projectId) as any;

    project.stats = stats ? { ...stats } : { total: 0, screened: 0, acquired: 0, synced: 0, pool_a_count: 0, pool_b_count: 0, pool_c_count: 0, duplicates: 0 };

    // Calculate live spend from llm_audit_log and umbrellanizer_results
    const liveSpendRow = db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0.0) as live_spend
      FROM (
        SELECT cost_usd FROM llm_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
        UNION ALL
        SELECT cost_usd FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
      )
    `).get(projectId, projectId) as { live_spend: number } | undefined;

    project.project_current_spend = liveSpendRow ? Number(liveSpendRow.live_spend || 0) : 0;

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error('Failed to get project:', error);
    return NextResponse.json({ error: error.message || 'Failed to get project' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // 1. Fetch project to get folder_name for repository directory deletion
    const project = db.prepare('SELECT id, folder_name, name FROM projects WHERE id = ?').get(projectId) as { id: string; folder_name?: string; name: string } | undefined;

    // 2. Delete project repository folder if present (pdf_library/repo/<folder_name>/)
    // Raw and cached PDF library folders remain 100% untouched as eternal storage
    if (project?.folder_name) {
      const repoDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', project.folder_name);
      if (fs.existsSync(repoDir)) {
        try {
          fs.rmSync(repoDir, { recursive: true, force: true });
        } catch (err) {
          console.error(`Failed to delete repo folder ${repoDir}:`, err);
        }
      }
    }

    // 3. Run deletion across all 15 project-scoped tables inside an atomic transaction
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM reviewer_decisions WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM calibration_commit_ledger WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM calibration_papers WHERE Project_ID = ?').run(projectId);
      db.prepare('DELETE FROM manual_audit_log WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM llm_audit_log WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM duplicate_pairs WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM rolling_batches WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM rolling_batch_papers WHERE Project_ID = ?').run(projectId);
      db.prepare('DELETE FROM rolling_batch_reviewer_decisions WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM rolling_batch_commit_ledger WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM umbrellanizer_results WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM llm_jobs WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM prompt_templates WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM prompt_audit_ledger WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
      db.prepare('DELETE FROM prompt_benchmark_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
      db.prepare('DELETE FROM prompt_benchmark_runs WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').run(projectId);
      
      // Delete papers
      db.prepare('DELETE FROM papers WHERE Project_ID = ?').run(projectId);

      // Finally delete the project itself
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

      // If active project is the deleted one, reset config to next available project or empty string
      const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
      if (activeProjectId === projectId) {
        const nextProject = db.prepare('SELECT id FROM projects WHERE id != ? LIMIT 1').get(projectId) as { id: string } | undefined;
        const newActiveId = nextProject ? nextProject.id : '';
        db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', ?)").run(newActiveId);
      }
    });

    deleteTransaction();

    // 4. Reclaim SQLite database disk space with checkpoint and VACUUM
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.exec('VACUUM');
      db.pragma('optimize');
    } catch (vErr) {
      console.warn('Post-deletion VACUUM warning:', vErr);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Project '${project?.name || projectId}' and its repository folder wiped. Database space reclaimed.` 
    });
  } catch (error: any) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
  }
}
