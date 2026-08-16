import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    
    const paramProjectId = searchParams.get('projectId');
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const targetProjectId = paramProjectId || activeProjectId;

    let project = db.prepare('SELECT * FROM projects WHERE id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT)').get(targetProjectId, targetProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const resolvedProjectId = project.id;
    const mode = body.mode || searchParams.get('mode') || 'active';

    if (mode !== 'active' && mode !== 'all') {
      return NextResponse.json({ error: 'Invalid reset mode. Must be "active" or "all".' }, { status: 400 });
    }

    if (mode === 'active') {
      const activeBatch = db.prepare(`
        SELECT * FROM rolling_batches 
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND status != 'complete'
        LIMIT 1
      `).get(resolvedProjectId) as any;

      if (!activeBatch) {
        return NextResponse.json({ error: 'No active rolling batch found to reset.' }, { status: 404 });
      }

      db.transaction(() => {
        db.prepare('DELETE FROM rolling_batch_reviewer_decisions WHERE batch_id = ?').run(activeBatch.id);
        db.prepare('DELETE FROM rolling_batch_commit_ledger WHERE batch_id = ?').run(activeBatch.id);
        db.prepare('DELETE FROM rolling_batch_papers WHERE batch_id = ?').run(activeBatch.id);
        db.prepare('DELETE FROM rolling_batches WHERE id = ?').run(activeBatch.id);
      })();

      return NextResponse.json({ 
        success: true, 
        message: `Successfully reset Active Rolling Batch #${activeBatch.batch_number}.` 
      });
    }

    if (mode === 'all') {
      const allBatches = db.prepare(`
        SELECT id FROM rolling_batches 
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
      `).all(resolvedProjectId) as { id: string }[];

      if (allBatches.length === 0) {
        return NextResponse.json({ error: 'No rolling batches found to reset for this project.' }, { status: 404 });
      }

      const batchIds = allBatches.map(b => b.id);
      const placeholders = batchIds.map(() => '?').join(',');

      db.transaction(() => {
        db.prepare(`DELETE FROM rolling_batch_reviewer_decisions WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)`).run(resolvedProjectId);
        db.prepare(`DELETE FROM rolling_batch_commit_ledger WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)`).run(resolvedProjectId);
        db.prepare(`DELETE FROM rolling_batch_papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT) OR batch_id IN (${placeholders})`).run(resolvedProjectId, ...batchIds);
        db.prepare(`DELETE FROM rolling_batches WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)`).run(resolvedProjectId);
      })();

      return NextResponse.json({ 
        success: true, 
        message: `Successfully reset all ${allBatches.length} rolling batches for this project.` 
      });
    }

    return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to reset rolling batch:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
