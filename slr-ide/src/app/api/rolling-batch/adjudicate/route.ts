import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { createHash } from 'crypto';
import { calculatePoolCDecision } from '@/lib/inter-rater/adjudication-calculations';

export async function POST(request: Request) {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const { 
      paper_id, 
      batch_id, 
      final_qa_scores, 
      final_extracted_data, 
      commit_message 
    } = await request.json();

    if (!paper_id || !batch_id) {
      return NextResponse.json({ error: 'Missing paper_id or batch_id' }, { status: 400 });
    }
    if (!commit_message) {
      return NextResponse.json({ error: 'Missing commit_message' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT)').get(activeProjectId, activeProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    // Verify batch exists
    const batch = db.prepare('SELECT * FROM rolling_batches WHERE id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))').get(batch_id, activeProjectId, activeProjectId) as any;
    if (!batch) {
      return NextResponse.json({ error: 'Rolling batch not found' }, { status: 404 });
    }

    const timestamp = new Date().toISOString();

    // Parse QA rules to compute decision
    let qaRules = [];
    if (project.pool_c_qa_rules) {
      try {
        qaRules = typeof project.pool_c_qa_rules === 'string' 
          ? JSON.parse(project.pool_c_qa_rules) 
          : project.pool_c_qa_rules;
      } catch (e) {}
    }

    const qaScoresObj = typeof final_qa_scores === 'string' ? JSON.parse(final_qa_scores) : final_qa_scores;
    const { decision, exclusionCode, rationale } = calculatePoolCDecision(qaScoresObj || {}, qaRules);

    const final_qa_scores_str = typeof final_qa_scores === 'string' ? final_qa_scores : JSON.stringify(final_qa_scores || {});
    const final_extracted_data_str = typeof final_extracted_data === 'string' ? final_extracted_data : JSON.stringify(final_extracted_data || {});

    const result = db.transaction(() => {
      // 1. Read current state from rolling_batch_papers
      const dbPaper = db.prepare(`
        SELECT * FROM rolling_batch_papers 
        WHERE Paper_ID = ? AND batch_id = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)
      `).get(paper_id, batch_id, activeProjectId) as any;

      if (!dbPaper) {
        throw new Error(`Paper ${paper_id} not found in this rolling batch.`);
      }

      const previousState = JSON.stringify({
        manual_decision: dbPaper.manual_decision,
        manual_exclusion_code: dbPaper.manual_exclusion_code,
        manual_rationale: dbPaper.manual_rationale,
        manual_quality_assessment: dbPaper.manual_quality_assessment,
        manual_extracted_data: dbPaper.manual_extracted_data,
        manual_stage: dbPaper.manual_stage
      });

      // 2. Update rolling_batch_papers
      db.prepare(`
        UPDATE rolling_batch_papers 
        SET manual_decision = ?,
            manual_exclusion_code = ?,
            manual_rationale = ?,
            manual_quality_assessment = ?,
            manual_extracted_data = ?,
            manual_stage = 3
        WHERE Paper_ID = ? AND batch_id = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)
      `).run(decision, exclusionCode || null, rationale || '', final_qa_scores_str, final_extracted_data_str, paper_id, batch_id, activeProjectId);

      // 3. Generate commit hash
      const commitHash = createHash('sha256')
        .update(paper_id + timestamp + commit_message)
        .digest('hex')
        .substring(0, 8);

      // 4. Insert into rolling_batch_commit_ledger
      db.prepare(`
        INSERT INTO rolling_batch_commit_ledger 
          (commit_hash, batch_id, batch_number, project_id, paper_id, adjudicator, previous_state, resolved_qa_scores, resolved_extracted_data, commit_message, timestamp)
        VALUES (?, ?, ?, ?, ?, 'ADJUDICATOR', ?, ?, ?, ?, ?)
      `).run(
        commitHash, batch_id, batch.batch_number, activeProjectId, paper_id,
        previousState, final_qa_scores_str, final_extracted_data_str, commit_message, timestamp
      );

      // 5. Check if all papers in this batch are resolved
      const unresolvedCountRow = db.prepare(`
        SELECT COUNT(*) as count FROM rolling_batch_papers 
        WHERE batch_id = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (manual_decision = 'PENDING_ADJUDICATION' OR manual_decision IS NULL)
      `).get(batch_id, activeProjectId, activeProjectId) as { count: number };

      let batchFinalized = false;
      if (unresolvedCountRow.count === 0) {
        db.prepare(`
          UPDATE rolling_batches 
          SET status = 'complete', finalized_at = ? 
          WHERE id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
        `).run(timestamp, batch_id, activeProjectId, activeProjectId);
        batchFinalized = true;
      }

      return {
        commitHash,
        resolvedDecision: decision,
        resolvedEc: exclusionCode,
        batchFinalized
      };
    })();

    return NextResponse.json({ success: true, adjudication: result });
  } catch (error: any) {
    console.error('Failed to adjudicate paper in rolling batch:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
