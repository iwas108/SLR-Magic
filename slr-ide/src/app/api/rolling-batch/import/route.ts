import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { createHash } from 'crypto';
import { calculatePoolCDecision } from '@/lib/inter-rater/adjudication-calculations';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || !body.metadata || !body.papers || !Array.isArray(body.papers)) {
      return NextResponse.json({ error: 'Invalid .slr file: missing metadata or papers array' }, { status: 400 });
    }

    const filePoolType = (body.metadata.pool_type || body.metadata.poolType || '').toLowerCase();
    if (filePoolType !== 'qc_batch') {
      return NextResponse.json({ 
        error: `Pool mismatch: expected pool type "QC_Batch", but file pool type is "${filePoolType}"` 
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const paramProjectId = searchParams.get('projectId');
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const targetProjectId = paramProjectId || activeProjectId;

    let project = db.prepare('SELECT * FROM projects WHERE id = ?').get(targetProjectId) as any;
    if (!project) {
      const numericProjectId = parseInt(targetProjectId, 10);
      if (!isNaN(numericProjectId)) {
        project = db.prepare('SELECT * FROM projects WHERE id = ?').get(numericProjectId) as any;
      }
    }
    if (!project) {
      project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const resolvedProjectId = project.id;

    // Check project ID matching if present in file metadata
    const fileProjectId = body.metadata.project_id || body.metadata.projectId;
    if (fileProjectId && String(fileProjectId) !== String(resolvedProjectId)) {
      return NextResponse.json({ 
        error: `Project ID mismatch: file was exported for project "${fileProjectId}", but target project is "${resolvedProjectId}"` 
      }, { status: 400 });
    }

    // Get active batch
    const activeBatch = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND status != 'complete'
      LIMIT 1
    `).get(resolvedProjectId) as any;

    if (!activeBatch) {
      return NextResponse.json({ error: 'No active rolling batch found to import review into.' }, { status: 400 });
    }

    // Check if the uploaded file's batch matches the active batch
    const fileBatchId = body.metadata.batch_id;
    if (fileBatchId && fileBatchId !== activeBatch.id) {
      return NextResponse.json({ 
        error: `Batch ID mismatch: file is for batch "${fileBatchId}", but active batch is "${activeBatch.id}"` 
      }, { status: 400 });
    }

    let reviewerName = body.metadata.reviewer_name || body.metadata.reviewerName;
    if (!reviewerName || typeof reviewerName !== 'string' || !reviewerName.trim()) {
      const randHex = Math.floor(0x1000 + Math.random() * 0xF000).toString(16);
      reviewerName = `anon_${randHex}`;
    }
    reviewerName = reviewerName.trim();

    const timestamp = new Date().toISOString();

    // Parse QA and Extraction rules
    let qaRules: any[] = [];
    if (project.pool_c_qa_rules) {
      try {
        qaRules = typeof project.pool_c_qa_rules === 'string' 
          ? JSON.parse(project.pool_c_qa_rules) 
          : project.pool_c_qa_rules;
      } catch (e) {}
    }

    // Count existing unique reviewers for this batch
    const reviewerCountRow = db.prepare(`
      SELECT COUNT(DISTINCT reviewer_name) as count 
      FROM rolling_batch_reviewer_decisions 
      WHERE batch_id = ? AND project_id = ?
    `).get(activeBatch.id, resolvedProjectId) as { count: number };

    const checkReviewerExist = db.prepare(`
      SELECT 1 FROM rolling_batch_reviewer_decisions 
      WHERE batch_id = ? AND project_id = ? AND reviewer_name = ?
      LIMIT 1
    `).get(activeBatch.id, resolvedProjectId, reviewerName);

    const isReupload = !!checkReviewerExist;

    if (!isReupload && reviewerCountRow.count >= 2) {
      return NextResponse.json({ 
        error: 'All available rolling batch review slots (maximum 2 reviewers) are occupied.' 
      }, { status: 409 });
    }

    // Execute atomic transaction for import updates
    const result = db.transaction(() => {
      // Clear previous inputs if re-upload
      db.prepare(`
        DELETE FROM rolling_batch_reviewer_decisions 
        WHERE batch_id = ? AND project_id = ? AND reviewer_name = ?
      `).run(activeBatch.id, resolvedProjectId, reviewerName);

      let importedCount = 0;

      for (const paper of body.papers) {
        const paperId = paper.Paper_ID;
        if (!paperId) continue;

        // Verify paper belongs to active batch
        const dbPaper = db.prepare(`
          SELECT * FROM rolling_batch_papers 
          WHERE Paper_ID = ? AND batch_id = ?
        `).get(paperId, activeBatch.id) as any;

        if (!dbPaper) continue;

        const qaScoresJson = paper.Human_QA_Scores ? JSON.stringify(paper.Human_QA_Scores) : '{}';
        const extractedDataJson = paper.Human_Extracted_Data ? JSON.stringify(paper.Human_Extracted_Data) : '{}';

        db.prepare(`
          INSERT INTO rolling_batch_reviewer_decisions 
            (batch_id, batch_number, paper_id, project_id, reviewer_name, qa_scores, extracted_data, imported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(activeBatch.id, activeBatch.batch_number, paperId, resolvedProjectId, reviewerName, qaScoresJson, extractedDataJson, timestamp);

        importedCount++;
      }

      // Re-evaluate agreements across ALL papers in this batch
      const allBatchPapers = db.prepare(`
        SELECT * FROM rolling_batch_papers WHERE batch_id = ?
      `).all(activeBatch.id) as any[];

      let papersInConflict = 0;

      for (const paper of allBatchPapers) {
        const paperId = paper.Paper_ID;
        
        // Fetch all reviewer decisions for this paper in the active batch
        const decisions = db.prepare(`
          SELECT reviewer_name, qa_scores, extracted_data 
          FROM rolling_batch_reviewer_decisions 
          WHERE paper_id = ? AND batch_id = ?
          ORDER BY reviewer_name ASC
        `).all(paperId, activeBatch.id) as any[];

        let newDecision = paper.manual_decision;
        let newEC = paper.manual_exclusion_code;
        let newRationale = paper.manual_rationale;
        let newQAScores = paper.manual_quality_assessment;
        let newExtractedData = paper.manual_extracted_data;
        let newStage = paper.manual_stage;

        if (decisions.length === 1) {
          // Single reviewer: compute decision
          const r1_qa = JSON.parse(decisions[0].qa_scores || '{}');
          const { decision, exclusionCode, rationale } = calculatePoolCDecision(r1_qa, qaRules);
          newDecision = decision;
          newEC = exclusionCode;
          newRationale = rationale;
          newQAScores = decisions[0].qa_scores;
          newExtractedData = decisions[0].extracted_data;
          newStage = 3;
        } else if (decisions.length === 2) {
          // Two reviewers: compare and detect conflicts
          const r1_qa = JSON.parse(decisions[0].qa_scores || '{}');
          const r2_qa = JSON.parse(decisions[1].qa_scores || '{}');
          const r1_ext = JSON.parse(decisions[0].extracted_data || '{}');
          const r2_ext = JSON.parse(decisions[1].extracted_data || '{}');

          const r1_dec_res = calculatePoolCDecision(r1_qa, qaRules);
          const r2_dec_res = calculatePoolCDecision(r2_qa, qaRules);

          if (r1_dec_res.decision !== r2_dec_res.decision) {
            // Include/Exclude conflict
            newDecision = 'PENDING_ADJUDICATION';
            newEC = null;
            newRationale = 'Adjudication required: include/exclude decision conflict.';
            newQAScores = '{}';
            newExtractedData = '{}';
            newStage = 0; // Set stage to 0 to represent pending/unresolved state
            papersInConflict++;
          } else {
            // Same decision, check detail conflicts
            let qaConflict = false;
            for (const rule of qaRules) {
              if (r1_qa[rule.code]?.value !== r2_qa[rule.code]?.value) {
                qaConflict = true;
                break;
              }
            }

            let extConflict = false;
            let extRules = [];
            if (project.pool_c_extraction_rules) {
              try {
                extRules = typeof project.pool_c_extraction_rules === 'string' 
                  ? JSON.parse(project.pool_c_extraction_rules) 
                  : project.pool_c_extraction_rules;
              } catch {}
            }

            for (const rule of extRules) {
              const val1 = r1_ext[rule.json_key]?.value || '';
              const val2 = r2_ext[rule.json_key]?.value || '';
              if (val1 !== val2) {
                extConflict = true;
                break;
              }
            }

            if (qaConflict || extConflict) {
              newDecision = 'PENDING_ADJUDICATION';
              newEC = null;
              newRationale = 'Adjudication required: QA scores or extracted variables conflict.';
              newQAScores = '{}';
              newExtractedData = '{}';
              newStage = 0;
              papersInConflict++;
            } else {
              // Consensus achieved!
              newDecision = r1_dec_res.decision;
              newEC = r1_dec_res.exclusionCode;
              newRationale = `Consensus achieved between reviewers. ${r1_dec_res.rationale}`;
              newQAScores = decisions[0].qa_scores;
              newExtractedData = decisions[0].extracted_data;
              newStage = 3;
            }
          }
        }

        // Update paper if changed
        if (
          newDecision !== paper.manual_decision ||
          newEC !== paper.manual_exclusion_code ||
          newRationale !== paper.manual_rationale ||
          newQAScores !== paper.manual_quality_assessment ||
          newExtractedData !== paper.manual_extracted_data ||
          newStage !== paper.manual_stage
        ) {
          db.prepare(`
            UPDATE rolling_batch_papers
            SET manual_decision = ?,
                manual_exclusion_code = ?,
                manual_rationale = ?,
                manual_quality_assessment = ?,
                manual_extracted_data = ?,
                manual_stage = ?
            WHERE Paper_ID = ? AND batch_id = ?
          `).run(newDecision, newEC, newRationale, newQAScores, newExtractedData, newStage, paperId, activeBatch.id);

          // Write to audit ledger
          const previousState = JSON.stringify({
            manual_decision: paper.manual_decision,
            manual_exclusion_code: paper.manual_exclusion_code,
            manual_rationale: paper.manual_rationale,
            manual_quality_assessment: paper.manual_quality_assessment,
            manual_extracted_data: paper.manual_extracted_data,
            manual_stage: paper.manual_stage
          });

          const commitHash = createHash('sha256')
            .update(paperId + timestamp + reviewerName)
            .digest('hex')
            .substring(0, 8);

          db.prepare(`
            INSERT INTO rolling_batch_commit_ledger 
              (commit_hash, batch_id, batch_number, project_id, paper_id, adjudicator, previous_state, resolved_qa_scores, resolved_extracted_data, commit_message, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            commitHash, activeBatch.id, activeBatch.batch_number, resolvedProjectId, paperId,
            `IMPORT: ${reviewerName}`, previousState, newQAScores, newExtractedData,
            `Auto-adjudication state on import from ${reviewerName}`, timestamp
          );
        }
      }

      // Check final reviewer count for batch state transition
      const totalReviewersCount = db.prepare(`
        SELECT COUNT(DISTINCT reviewer_name) as count 
        FROM rolling_batch_reviewer_decisions 
        WHERE batch_id = ?
      `).get(activeBatch.id) as { count: number };

      if (totalReviewersCount.count >= 2) {
        db.prepare(`
          UPDATE rolling_batches 
          SET status = 'awaiting_adjudication' 
          WHERE id = ?
        `).run(activeBatch.id);
      }

      return {
        reviewerName,
        isReupload,
        papersImported: importedCount,
        papersInConflict,
        totalReviewers: totalReviewersCount.count
      };
    })();

    return NextResponse.json({ success: true, importResult: result });
  } catch (error: any) {
    console.error('Failed to import rolling batch review:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
