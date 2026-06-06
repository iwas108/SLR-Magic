import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';

    if (pool !== 'pool_a' && pool !== 'CAL_Pool_A') {
      return NextResponse.json({ error: 'Inter-rater import is only implemented for Pool A' }, { status: 400 });
    }

    const body = await request.json();
    if (!body || !body.metadata || !body.papers || !Array.isArray(body.papers)) {
      return NextResponse.json({ error: 'Invalid .slr file: missing metadata or papers array' }, { status: 400 });
    }

    const filePoolType = body.metadata.poolType || body.metadata.phase;
    if (filePoolType !== 'CAL_Pool_A' && filePoolType !== 'pool_a' && filePoolType !== 'title-abs') {
      return NextResponse.json({ error: `Pool mismatch: target pool is Pool A, but file pool type is "${filePoolType}"` }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const updateStmt = db.prepare(`
      UPDATE papers
      SET Human_Decision = ?,
          Human_EC_Trigger = ?,
          Human_Rationale = ?
      WHERE Paper_ID = ? AND Project_ID = ? AND calibration_pool = 'pool_a'
    `);

    let updateCount = 0;
    const transaction = db.transaction(() => {
      for (const paper of body.papers) {
        const pid = paper.Paper_ID;
        const dec = paper.Human_Decision || paper.Reviewer_Decision || '';
        const ec = paper.Human_EC_Trigger || paper.Reviewer_EC_Code || '';
        const rat = paper.Human_Rationale || paper.Reviewer_Reasoning || '';

        if (!pid) continue;
        const info = updateStmt.run(dec, ec, rat, pid, activeProjectId);
        if (info.changes > 0) {
          updateCount++;
        }
      }
    });

    transaction();

    return NextResponse.json({
      success: true,
      message: `Successfully imported blinded review for ${updateCount} papers into Pool A.`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import blinded review' }, { status: 500 });
  }
}
