import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { createHash } from 'crypto';

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

    const filePoolType = body.metadata.pool_type || body.metadata.poolType || body.metadata.phase;
    if (filePoolType !== 'CAL_Pool_A' && filePoolType !== 'pool_a' && filePoolType !== 'title-abs') {
      return NextResponse.json({ error: `Pool mismatch: target pool is Pool A, but file pool type is "${filePoolType}"` }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    // Step 1: Extract reviewer identity or generate anon_xxxx
    let reviewerName = body.metadata.reviewer_name || body.metadata.reviewerName;
    if (!reviewerName || typeof reviewerName !== 'string' || !reviewerName.trim()) {
      const randHex = Math.floor(0x1000 + Math.random() * 0xF000).toString(16);
      reviewerName = `anon_${randHex}`;
    }
    reviewerName = reviewerName.trim();

    const timestamp = new Date().toISOString();

    // Prepare database statements
    const checkReviewerExistStmt = db.prepare(`
      SELECT DISTINCT reviewer_name 
      FROM reviewer_decisions 
      WHERE project_id = ? AND pool = 'pool_a' AND reviewer_name = ?
    `);

    const countReviewersStmt = db.prepare(`
      SELECT COUNT(DISTINCT reviewer_name) as count 
      FROM reviewer_decisions 
      WHERE project_id = ? AND pool = 'pool_a'
    `);

    const selectPaperStmt = db.prepare(`
      SELECT Paper_ID, Human_Decision, Human_EC_Trigger, Human_Rationale 
      FROM papers 
      WHERE Paper_ID = ? AND Project_ID = ? AND calibration_pool = 'pool_a'
    `);

    const deleteReviewerDecisionsStmt = db.prepare(`
      DELETE FROM reviewer_decisions 
      WHERE project_id = ? AND pool = 'pool_a' AND reviewer_name = ?
    `);

    const insertDecisionStmt = db.prepare(`
      INSERT INTO reviewer_decisions 
        (paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, imported_at)
      VALUES (?, ?, 'pool_a', ?, ?, ?, ?, ?)
    `);

    const updatePaperDecisionStmt = db.prepare(`
      UPDATE papers 
      SET Human_Decision = ?, 
          Human_EC_Trigger = ?, 
          Human_Rationale = ? 
      WHERE Paper_ID = ? AND Project_ID = ?
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO calibration_commit_ledger 
        (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_ec, resolved_rationale, commit_message, timestamp)
      VALUES (?, ?, ?, 'pool_a', ?, ?, ?, ?, ?, ?, ?)
    `);

    const getPaperDecisionsStmt = db.prepare(`
      SELECT reviewer_name, decision, ec_trigger, rationale 
      FROM reviewer_decisions 
      WHERE paper_id = ? AND project_id = ? AND pool = 'pool_a'
      ORDER BY reviewer_name ASC
    `);

    let isReupload = false;
    let papersImported = 0;
    let papersInConflict = 0;

    // We run the routing logic and database updates inside an atomic transaction
    const result = db.transaction(() => {
      // Step 2: Check if re-upload
      const existingReviewer = checkReviewerExistStmt.get(activeProjectId, reviewerName);
      if (existingReviewer) {
        isReupload = true;
      } else {
        // Step 3: Slot vacancy check (max 2)
        const reviewerCountRow = countReviewersStmt.get(activeProjectId) as { count: number };
        if (reviewerCountRow.count >= 2) {
          return { error: 'All available calibration slots (maximum 2 reviewers per pool) are fully occupied.', status: 409 };
        }
      }

      // Step 4: Snapshot sync (delete-then-insert)
      deleteReviewerDecisionsStmt.run(activeProjectId, reviewerName);

      for (const paper of body.papers) {
        const paperId = paper.Paper_ID;
        if (!paperId) continue;

        // Check if paper exists in the active project and is in pool_a
        const dbPaper = selectPaperStmt.get(paperId, activeProjectId) as any;
        if (!dbPaper) {
          // Skip papers that aren't in this project's pool_a
          continue;
        }

        const decision = paper.Human_Decision || paper.Reviewer_Decision || '';
        const ecTrigger = paper.Human_EC_Trigger || paper.Reviewer_EC_Code || null;
        const rationale = paper.Human_Rationale || paper.Reviewer_Reasoning || '';

        // Insert new decision
        insertDecisionStmt.run(
          paperId,
          activeProjectId,
          reviewerName,
          decision,
          ecTrigger,
          rationale,
          timestamp
        );

        papersImported++;
      }

      // Step 5: Update master decisions for ALL papers in the project's pool_a
      const allPoolPapers = db.prepare(`
        SELECT Paper_ID, Human_Decision, Human_EC_Trigger, Human_Rationale 
        FROM papers 
        WHERE Project_ID = ? AND calibration_pool = 'pool_a'
      `).all(activeProjectId) as any[];

      for (const paper of allPoolPapers) {
        const paperId = paper.Paper_ID;
        
        // Query decisions from all reviewers for this paper
        const decisions = getPaperDecisionsStmt.all(paperId, activeProjectId) as any[];

        let newDecision = paper.Human_Decision;
        let newEC = paper.Human_EC_Trigger;
        let newRationale = paper.Human_Rationale;

        if (decisions.length === 0) {
          continue;
        } else if (decisions.length === 1) {
          // Single reviewer decision: set as baseline
          newDecision = decisions[0].decision;
          newEC = decisions[0].ec_trigger;
          newRationale = decisions[0].rationale;
        } else if (decisions.length === 2) {
          // Two reviewers
          if (decisions[0].decision === decisions[1].decision) {
            // In agreement on decision
            newDecision = decisions[0].decision;
            if (newDecision === 'Exclude') {
              newEC = decisions[0].ec_trigger === decisions[1].ec_trigger
                ? decisions[0].ec_trigger
                : decisions[0].ec_trigger || decisions[1].ec_trigger;
            } else {
              newEC = null;
            }
            newRationale = decisions[0].rationale || decisions[1].rationale;
          } else {
            // In conflict!
            newDecision = 'PENDING_ADJUDICATION';
            newEC = null;
            newRationale = null;
            papersInConflict++;
          }
        }

        // If any field changed, update paper and write to audit ledger
        if (
          newDecision !== paper.Human_Decision ||
          newEC !== paper.Human_EC_Trigger ||
          newRationale !== paper.Human_Rationale
        ) {
          // Update papers table
          updatePaperDecisionStmt.run(newDecision, newEC, newRationale, paperId, activeProjectId);

          // Write to ledger
          const previousState = JSON.stringify({
            Human_Decision: paper.Human_Decision,
            Human_EC_Trigger: paper.Human_EC_Trigger,
            Human_Rationale: paper.Human_Rationale
          });

          const commitHash = createHash('sha256')
            .update(paperId + timestamp + reviewerName)
            .digest('hex')
            .substring(0, 8);

          insertLedgerStmt.run(
            commitHash,
            activeProjectId,
            paperId,
            `IMPORT: ${reviewerName}`,
            previousState,
            newDecision || '',
            newEC,
            newRationale || '',
            `Auto-adjudication status on import from ${reviewerName}`,
            timestamp
          );
        }
      }

      // Count final total reviewers
      const totalReviewersCountRow = countReviewersStmt.get(activeProjectId) as { count: number };

      return {
        success: true,
        reviewer_name: reviewerName,
        is_reupload: isReupload,
        papers_imported: papersImported,
        papers_in_conflict: papersInConflict,
        total_reviewers: totalReviewersCountRow.count
      };
    })();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import blinded review' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';

    if (pool !== 'pool_a' && pool !== 'CAL_Pool_A') {
      return NextResponse.json({ error: 'Inter-rater reset is only implemented for Pool A' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    db.transaction(() => {
      // 1. Delete decisions
      db.prepare(`
        DELETE FROM reviewer_decisions 
        WHERE project_id = ? AND pool = 'pool_a'
      `).run(activeProjectId);

      // 2. Delete audit ledger entries
      db.prepare(`
        DELETE FROM calibration_commit_ledger 
        WHERE project_id = ? AND pool = 'pool_a'
      `).run(activeProjectId);

      // 3. Reset papers master decisions for calibration pool
      db.prepare(`
        UPDATE papers 
        SET Human_Decision = NULL, 
            Human_EC_Trigger = NULL, 
            Human_Rationale = NULL 
        WHERE Project_ID = ? AND calibration_pool = 'pool_a'
      `).run(activeProjectId);
    })();

    return NextResponse.json({ success: true, message: 'Successfully reset all calibration data for Pool A' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset calibration decisions' }, { status: 500 });
  }
}

