import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batch_id parameter' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    // Fetch batch details
    const batch = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE id = ? AND project_id = ?
    `).get(batchId, activeProjectId) as any;

    if (!batch) {
      return NextResponse.json({ error: 'Rolling batch not found' }, { status: 404 });
    }

    // Fetch papers in this batch
    const papers = db.prepare(`
      SELECT * FROM rolling_batch_papers 
      WHERE batch_id = ? AND Project_ID = ?
    `).all(batchId, activeProjectId) as any[];

    // Fetch reviewer decisions for this batch
    const decisions = db.prepare(`
      SELECT * FROM rolling_batch_reviewer_decisions 
      WHERE batch_id = ? AND project_id = ?
    `).all(batchId, activeProjectId) as any[];

    // Fetch ledger commit entries for this batch
    const ledger = db.prepare(`
      SELECT * FROM rolling_batch_commit_ledger 
      WHERE batch_id = ? AND project_id = ?
      ORDER BY timestamp DESC
    `).all(batchId, activeProjectId) as any[];

    return NextResponse.json({
      success: true,
      batch,
      papers,
      decisions,
      ledger
    });
  } catch (error: any) {
    console.error('Failed to fetch decisions feed for rolling batch:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
