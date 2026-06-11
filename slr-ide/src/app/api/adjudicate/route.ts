import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const { paper_id, final_decision, final_ec, final_rationale, commit_message } = await request.json();

    if (!paper_id) {
      return NextResponse.json({ error: 'Missing paper_id' }, { status: 400 });
    }
    if (!final_decision) {
      return NextResponse.json({ error: 'Missing final_decision' }, { status: 400 });
    }
    if (!commit_message) {
      return NextResponse.json({ error: 'Missing commit_message' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    const selectPaperStmt = db.prepare(`
      SELECT Paper_ID, Human_Decision, Human_EC_Trigger, Human_Rationale 
      FROM papers 
      WHERE Paper_ID = ? AND Project_ID = ? AND calibration_pool = 'pool_a'
    `);

    const updatePaperStmt = db.prepare(`
      UPDATE papers 
      SET Human_Decision = ?, 
          Human_EC_Trigger = ?, 
          Human_Rationale = ? 
      WHERE Paper_ID = ? AND Project_ID = ?
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO calibration_commit_ledger 
        (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_ec, resolved_rationale, commit_message, timestamp)
      VALUES (?, ?, ?, 'pool_a', 'ADJUDICATOR', ?, ?, ?, ?, ?, ?)
    `);

    const commitEntry = db.transaction(() => {
      // 1. Read current paper state
      const dbPaper = selectPaperStmt.get(paper_id, activeProjectId) as any;
      if (!dbPaper) {
        throw new Error(`Paper with ID ${paper_id} not found in Pool A of the active project.`);
      }

      const previousState = JSON.stringify({
        Human_Decision: dbPaper.Human_Decision,
        Human_EC_Trigger: dbPaper.Human_EC_Trigger,
        Human_Rationale: dbPaper.Human_Rationale
      });

      // 2. Update papers table
      updatePaperStmt.run(final_decision, final_ec || null, final_rationale || '', paper_id, activeProjectId);

      // 3. Generate commit hash
      const commitHash = createHash('sha256')
        .update(paper_id + timestamp + commit_message)
        .digest('hex')
        .substring(0, 8);

      // 4. Insert into calibration_commit_ledger
      insertLedgerStmt.run(
        commitHash,
        activeProjectId,
        paper_id,
        previousState,
        final_decision,
        final_ec || null,
        final_rationale || '',
        commit_message,
        timestamp
      );

      return {
        commit_hash: commitHash,
        project_id: activeProjectId,
        paper_id,
        pool: 'pool_a',
        adjudicator: 'ADJUDICATOR',
        previous_state: previousState,
        resolved_decision: final_decision,
        resolved_ec: final_ec || null,
        resolved_rationale: final_rationale || '',
        commit_message,
        timestamp
      };
    })();

    return NextResponse.json({ success: true, commit: commitEntry });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to adjudicate paper' }, { status: 500 });
  }
}
