import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET() {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const ledger = db.prepare(`
      SELECT id, commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_ec, resolved_rationale, commit_message, timestamp
      FROM calibration_commit_ledger
      WHERE project_id = ? AND pool = 'pool_a'
      ORDER BY timestamp DESC
    `).all(activeProjectId);

    return NextResponse.json({ success: true, ledger });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch ledger entries' }, { status: 500 });
  }
}
