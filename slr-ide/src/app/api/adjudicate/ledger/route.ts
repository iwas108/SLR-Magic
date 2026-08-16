import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';
    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const ledger = db.prepare(`
      SELECT id, commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_ec, resolved_rationale, resolved_qa_scores, resolved_extracted_data, commit_message, timestamp
      FROM calibration_commit_ledger
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool = ?
      ORDER BY timestamp DESC
    `).all(activeProjectId, activeProjectId, dbPool);

    return NextResponse.json({ success: true, ledger });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch ledger entries' }, { status: 500 });
  }
}
