import db from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const activeProjectRow = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
    const activeProjectId = activeProjectRow?.value || 'default-project';

    // Get all pending pairs
    const pairs = db.prepare(`
      SELECT * FROM duplicate_pairs 
      WHERE project_id = ? AND status = 'PENDING'
      ORDER BY similarity_score DESC, created_at DESC
    `).all(activeProjectId) as any[];

    // For each pair, fetch both papers
    const resolvedPairs = [];
    const getPaperStmt = db.prepare(`SELECT * FROM papers WHERE Paper_ID = ? AND Project_ID = ?`);
    
    for (const pair of pairs) {
      const paper1 = getPaperStmt.get(pair.paper1_id, activeProjectId);
      const paper2 = getPaperStmt.get(pair.paper2_id, activeProjectId);
      if (paper1 && paper2) {
        resolvedPairs.push({
          ...pair,
          paper1,
          paper2
        });
      }
    }

    return NextResponse.json({
      pairs: resolvedPairs,
      count: resolvedPairs.length
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch duplicate pairs' },
      { status: 500 }
    );
  }
}
