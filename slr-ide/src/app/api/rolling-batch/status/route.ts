import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeProjectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    
    // Find active batch (not completed)
    const activeBatch = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND status != 'complete'
      ORDER BY batch_number DESC LIMIT 1
    `).get(activeProjectId, activeProjectId) as any;

    let papers: any[] = [];
    let reviewers: any[] = [];

    if (activeBatch) {
      papers = db.prepare(`
        SELECT * FROM rolling_batch_papers 
        WHERE batch_id = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
      `).all(activeBatch.id, activeProjectId, activeProjectId) as any[];

      // Count reviewer decision submissions
      reviewers = db.prepare(`
        SELECT reviewer_name, COUNT(DISTINCT paper_id) as papers_reviewed 
        FROM rolling_batch_reviewer_decisions 
        WHERE batch_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
        GROUP BY reviewer_name
      `).all(activeBatch.id, activeProjectId, activeProjectId) as any[];
    }

    // Get the list of all batches to see history
    const history = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
      ORDER BY batch_number ASC
    `).all(activeProjectId, activeProjectId) as any[];

    return NextResponse.json({
      success: true,
      activeBatch: activeBatch || null,
      papers,
      reviewers,
      history
    });
  } catch (error: any) {
    console.error('Failed to fetch rolling batch status:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
