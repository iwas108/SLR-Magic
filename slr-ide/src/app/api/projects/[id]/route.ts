import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { rescuePdfAssets } from '@/lib/pdf-utils';

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

    // 1. Fetch papers for the project to rescue their PDFs
    const papers = db.prepare('SELECT Paper_ID FROM papers WHERE Project_ID = ?').all(projectId) as { Paper_ID: string }[];
    const paperIds = papers.map(p => p.Paper_ID);
    
    // 2. Perform PDF rescue
    const rescuedCount = rescuePdfAssets(paperIds);

    // 3. Run deletion inside a transaction
    const deleteTransaction = db.transaction(() => {
      // Clear all related tables to be absolutely sure the database is fully clear of this project data
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
      
      // Delete papers
      db.prepare('DELETE FROM papers WHERE Project_ID = ?').run(projectId);

      // Finally delete the project itself
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

      // If active project is the deleted one, reset or set config to empty/default-project
      const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
      if (activeProjectId === projectId) {
        // Find another project to set active if possible, otherwise default-project
        const nextProject = db.prepare('SELECT id FROM projects WHERE id != ? LIMIT 1').get(projectId) as { id: string } | undefined;
        const newActiveId = nextProject ? nextProject.id : 'default-project';
        db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', ?)").run(newActiveId);
      }
    });

    deleteTransaction();

    return NextResponse.json({ 
      success: true, 
      message: `Project and associated data deleted successfully. Rescued ${rescuedCount} PDF assets.` 
    });
  } catch (error: any) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
  }
}
