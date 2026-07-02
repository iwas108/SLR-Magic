import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { createHash } from 'crypto';
import { calculatePoolCDecision } from '@/lib/inter-rater/adjudication-calculations';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';
    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    if (dbPool !== 'pool_a' && dbPool !== 'pool_b' && dbPool !== 'pool_c') {
      return NextResponse.json({ error: 'Invalid pool specified' }, { status: 400 });
    }

    const body = await request.json();
    if (!body || !body.metadata || !body.papers || !Array.isArray(body.papers)) {
      return NextResponse.json({ error: 'Invalid .slr file: missing metadata or papers array' }, { status: 400 });
    }

    const filePoolType = (body.metadata.pool_type || body.metadata.poolType || body.metadata.phase || '').toLowerCase();
    const isValidPool = 
      (dbPool === 'pool_a' && (filePoolType === 'cal_pool_a' || filePoolType === 'pool_a' || filePoolType === 'title-abs')) ||
      (dbPool === 'pool_b' && (filePoolType === 'cal_pool_b' || filePoolType === 'pool_b')) ||
      (dbPool === 'pool_c' && (filePoolType === 'cal_pool_c' || filePoolType === 'pool_c'));

    if (!isValidPool) {
      return NextResponse.json({ error: `Pool mismatch: target pool is ${dbPool.toUpperCase()}, but file pool type is "${filePoolType}"` }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    // Parse QA and Extraction rules for Pool C
    let qaRules: any[] = [];
    let extractionRules: any[] = [];
    if (dbPool === 'pool_c') {
      if (project.pool_c_qa_rules) {
        try {
          qaRules = typeof project.pool_c_qa_rules === 'string' 
            ? JSON.parse(project.pool_c_qa_rules) 
            : project.pool_c_qa_rules;
        } catch (e) {
          console.error("Error parsing pool_c_qa_rules in import", e);
        }
      }
      if (project.pool_c_extraction_rules) {
        try {
          extractionRules = typeof project.pool_c_extraction_rules === 'string' 
            ? JSON.parse(project.pool_c_extraction_rules) 
            : project.pool_c_extraction_rules;
        } catch (e) {
          console.error("Error parsing pool_c_extraction_rules in import", e);
        }
      }
    }
    
    // Extract reviewer identity or generate anon_xxxx
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
      WHERE project_id = ? AND pool = ? AND reviewer_name = ?
    `);

    const countReviewersStmt = db.prepare(`
      SELECT COUNT(DISTINCT reviewer_name) as count 
      FROM reviewer_decisions 
      WHERE project_id = ? AND pool = ?
    `);

    const selectPaperStmt = db.prepare(`
      SELECT Paper_ID, Human_Decision, Human_EC_Trigger, Human_Rationale, Human_QA_Scores, Human_Extracted_Data
      FROM papers 
      WHERE Paper_ID = ? AND Project_ID = ? AND calibration_pool = ?
    `);

    const deleteReviewerDecisionsStmt = db.prepare(`
      DELETE FROM reviewer_decisions 
      WHERE project_id = ? AND pool = ? AND reviewer_name = ?
    `);

    const insertDecisionStmt = db.prepare(`
      INSERT INTO reviewer_decisions 
        (paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, qa_scores, extracted_data, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updatePaperDecisionStmt = db.prepare(`
      UPDATE papers 
      SET Human_Decision = ?, 
          Human_EC_Trigger = ?, 
          Human_Rationale = ?,
          Human_QA_Scores = ?,
          Human_Extracted_Data = ?
      WHERE Paper_ID = ? AND Project_ID = ?
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO calibration_commit_ledger 
        (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_ec, resolved_rationale, resolved_qa_scores, resolved_extracted_data, commit_message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const getPaperDecisionsStmt = db.prepare(`
      SELECT reviewer_name, decision, ec_trigger, rationale, qa_scores, extracted_data 
      FROM reviewer_decisions 
      WHERE paper_id = ? AND project_id = ? AND pool = ?
      ORDER BY reviewer_name ASC
    `);

    let isReupload = false;
    let papersImported = 0;
    let papersInConflict = 0;

    // We run the routing logic and database updates inside an atomic transaction
    const result = db.transaction(() => {
      // Check if re-upload
      const existingReviewer = checkReviewerExistStmt.get(activeProjectId, dbPool, reviewerName);
      if (existingReviewer) {
        isReupload = true;
      } else {
        // Slot vacancy check (max 2)
        const reviewerCountRow = countReviewersStmt.get(activeProjectId, dbPool) as { count: number };
        if (reviewerCountRow.count >= 2) {
          return { error: 'All available calibration slots (maximum 2 reviewers per pool) are fully occupied.', status: 409 };
        }
      }

      // Snapshot sync (delete-then-insert)
      deleteReviewerDecisionsStmt.run(activeProjectId, dbPool, reviewerName);

      for (const paper of body.papers) {
        const paperId = paper.Paper_ID;
        if (!paperId) continue;

        const dbPaper = selectPaperStmt.get(paperId, activeProjectId, dbPool) as any;
        if (!dbPaper) {
          continue; // Skip papers that aren't in this project's target pool
        }

        if (dbPool === 'pool_c') {
          const qaScoresJson = paper.Human_QA_Scores ? JSON.stringify(paper.Human_QA_Scores) : '{}';
          const extractedDataJson = paper.Human_Extracted_Data ? JSON.stringify(paper.Human_Extracted_Data) : '{}';
          
          insertDecisionStmt.run(
            paperId,
            activeProjectId,
            dbPool,
            reviewerName,
            null, // decision
            null, // ecTrigger
            null, // rationale
            qaScoresJson,
            extractedDataJson,
            timestamp
          );
        } else {
          const decision = paper.Human_Decision || paper.Reviewer_Decision || '';
          const ecTrigger = paper.Human_EC_Trigger || paper.Reviewer_EC_Code || null;
          const rationale = paper.Human_Rationale || paper.Reviewer_Reasoning || '';

          insertDecisionStmt.run(
            paperId,
            activeProjectId,
            dbPool,
            reviewerName,
            decision,
            ecTrigger,
            rationale,
            null, // qaScores
            null, // extractedData
            timestamp
          );
        }

        papersImported++;
      }

      // Update master decisions for ALL papers in the project's target pool
      const allPoolPapers = db.prepare(`
        SELECT *
        FROM papers 
        WHERE Project_ID = ? AND calibration_pool = ?
      `).all(activeProjectId, dbPool) as any[];

      for (const paper of allPoolPapers) {
        const paperId = paper.Paper_ID;
        
        // Query decisions from all reviewers for this paper
        const decisions = getPaperDecisionsStmt.all(paperId, activeProjectId, dbPool) as any[];

        let newDecision = paper.Human_Decision;
        let newEC = paper.Human_EC_Trigger;
        let newRationale = paper.Human_Rationale;
        let newQAScores = paper.Human_QA_Scores;
        let newExtractedData = paper.Human_Extracted_Data;

        if (decisions.length === 0) {
          continue;
        } 
        
        if (dbPool === 'pool_c') {
          if (decisions.length === 1) {
            // Single reviewer decision: calculate decision dynamically
            const qaScoresObj = JSON.parse(decisions[0].qa_scores || '{}');
            const { decision, exclusionCode, rationale } = calculatePoolCDecision(qaScoresObj, qaRules);
            
            newDecision = decision;
            newEC = exclusionCode;
            newRationale = rationale;
            newQAScores = decisions[0].qa_scores;
            newExtractedData = decisions[0].extracted_data;
          } else if (decisions.length === 2) {
            // Two reviewers: detect conflicts on values
            const r1_qa = JSON.parse(decisions[0].qa_scores || '{}');
            const r2_qa = JSON.parse(decisions[1].qa_scores || '{}');
            const r1_ext = JSON.parse(decisions[0].extracted_data || '{}');
            const r2_ext = JSON.parse(decisions[1].extracted_data || '{}');

            let isConflict = false;

            // Compare QA values
            for (const rule of qaRules) {
              const v1 = r1_qa[rule.code]?.value;
              const v2 = r2_qa[rule.code]?.value;
              if (v1 !== v2) {
                isConflict = true;
                break;
              }
            }

            // Compare Extracted Data values (normalized)
            if (!isConflict) {
              for (const rule of extractionRules) {
                const v1 = (r1_ext[rule.json_key]?.value || '').trim().replace(/\s+/g, ' ');
                const v2 = (r2_ext[rule.json_key]?.value || '').trim().replace(/\s+/g, ' ');
                if (v1 !== v2) {
                  isConflict = true;
                  break;
                }
              }
            }

            if (isConflict) {
              newDecision = 'PENDING_ADJUDICATION';
              newEC = null;
              newRationale = null;
              newQAScores = null;
              newExtractedData = null;
              papersInConflict++;
            } else {
              // They agree exactly on values, so we auto-adjudicate
              const { decision, exclusionCode, rationale } = calculatePoolCDecision(r1_qa, qaRules);
              newDecision = decision;
              newEC = exclusionCode;
              newRationale = rationale;
              newQAScores = decisions[0].qa_scores;
              newExtractedData = decisions[0].extracted_data;
            }
          }
        } else {
          // Pool A or B decisions comparison
          if (decisions.length === 1) {
            newDecision = decisions[0].decision;
            newEC = decisions[0].ec_trigger;
            newRationale = decisions[0].rationale;
          } else if (decisions.length === 2) {
            if (decisions[0].decision === decisions[1].decision) {
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
              newDecision = 'PENDING_ADJUDICATION';
              newEC = null;
              newRationale = null;
              papersInConflict++;
            }
          }
        }

        // If any field changed, update paper and write to audit ledger
        if (
          newDecision !== paper.Human_Decision ||
          newEC !== paper.Human_EC_Trigger ||
          newRationale !== paper.Human_Rationale ||
          newQAScores !== paper.Human_QA_Scores ||
          newExtractedData !== paper.Human_Extracted_Data
        ) {
          updatePaperDecisionStmt.run(newDecision, newEC, newRationale, newQAScores, newExtractedData, paperId, activeProjectId);

          const previousState = JSON.stringify({
            Human_Decision: paper.Human_Decision,
            Human_EC_Trigger: paper.Human_EC_Trigger,
            Human_Rationale: paper.Human_Rationale,
            Human_QA_Scores: paper.Human_QA_Scores,
            Human_Extracted_Data: paper.Human_Extracted_Data
          });

          const commitHash = createHash('sha256')
            .update(paperId + timestamp + reviewerName)
            .digest('hex')
            .substring(0, 8);

          insertLedgerStmt.run(
            commitHash,
            activeProjectId,
            paperId,
            dbPool,
            `IMPORT: ${reviewerName}`,
            previousState,
            newDecision || '',
            newEC,
            newRationale || '',
            newQAScores,
            newExtractedData,
            `Auto-adjudication status on import from ${reviewerName}`,
            timestamp
          );
        }
      }

      // Count final total reviewers
      const totalReviewersCountRow = countReviewersStmt.get(activeProjectId, dbPool) as { count: number };

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

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import blinded review' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';
    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    if (dbPool !== 'pool_a' && dbPool !== 'pool_b' && dbPool !== 'pool_c') {
      return NextResponse.json({ error: 'Invalid pool specified' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    db.transaction(() => {
      // 1. Delete decisions
      db.prepare(`
        DELETE FROM reviewer_decisions 
        WHERE project_id = ? AND pool = ?
      `).run(activeProjectId, dbPool);

      // 2. Delete audit ledger entries
      db.prepare(`
        DELETE FROM calibration_commit_ledger 
        WHERE project_id = ? AND pool = ?
      `).run(activeProjectId, dbPool);

      // 3. Reset papers master decisions for calibration pool
      db.prepare(`
        UPDATE papers 
        SET Human_Decision = NULL, 
            Human_EC_Trigger = NULL, 
            Human_Rationale = NULL,
            Human_QA_Scores = NULL,
            Human_Extracted_Data = NULL
        WHERE Project_ID = ? AND calibration_pool = ?
      `).run(activeProjectId, dbPool);
    })();

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({ success: true, message: `Successfully reset all calibration data for ${dbPool.toUpperCase()}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset calibration decisions' }, { status: 500 });
  }
}
