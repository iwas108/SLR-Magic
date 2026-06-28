import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { createHash } from 'crypto';

// Helper function to calculate Pool C dynamic decisions based on QA scores and project rules
function calculatePoolCDecision(qaScores: Record<string, { value: any }>, qaRules: any[]) {
  let hasFatalFlaw = false;
  let totalScore = 0;
  
  const ruleKeys = Object.keys(qaScores);
  for (const code of ruleKeys) {
    const scoreVal = parseFloat(String(qaScores[code]?.value || 0));
    totalScore += scoreVal;
    
    // Check if this rule is flagged as a fatal flaw
    const ruleDef = qaRules.find(r => r.code.toLowerCase() === code.toLowerCase());
    const isFatal = ruleDef ? !!ruleDef.is_fatal_flaw : ['qa1', 'qa2', 'qa3', 'qa4', 'qa6'].includes(code.toLowerCase());
    
    if (isFatal && scoreVal === 0) {
      hasFatalFlaw = true;
    }
  }
  
  const meetsCumulative = totalScore >= 4.5;
  const decision = (!hasFatalFlaw && meetsCumulative) ? 'Include' : 'Exclude';
  
  let exclusionCode = null;
  if (decision === 'Exclude') {
    if (hasFatalFlaw) {
      const failedCode = ruleKeys.find(code => {
        const scoreVal = parseFloat(String(qaScores[code]?.value || 0));
        const ruleDef = qaRules.find(r => r.code.toLowerCase() === code.toLowerCase());
        const isFatal = ruleDef ? !!ruleDef.is_fatal_flaw : ['qa1', 'qa2', 'qa3', 'qa4', 'qa6'].includes(code.toLowerCase());
        return isFatal && scoreVal === 0;
      });
      exclusionCode = `FATAL_FLAW_${failedCode?.toUpperCase() || 'QA'}`;
    } else {
      exclusionCode = 'CUMULATIVE_BELOW_4.5';
    }
  }
  
  const rationale = `Adjudicated Pool C Decision: ${decision}. Total QA Score: ${totalScore.toFixed(1)}/8.0.${decision === 'Exclude' ? ` Exclusion reason: ${exclusionCode}.` : ''}`;
  
  return { decision, exclusionCode, rationale };
}

export async function POST(request: Request) {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const { 
      paper_id, 
      pool, 
      final_decision, 
      final_ec, 
      final_rationale, 
      final_qa_scores, 
      final_extracted_data, 
      commit_message 
    } = await request.json();

    if (!paper_id) {
      return NextResponse.json({ error: 'Missing paper_id' }, { status: 400 });
    }
    if (!commit_message) {
      return NextResponse.json({ error: 'Missing commit_message' }, { status: 400 });
    }

    const poolVal = pool || 'pool_a';
    const dbPool = (poolVal === 'pool_b' || poolVal === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (poolVal === 'pool_c' || poolVal === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    if (dbPool !== 'pool_c' && !final_decision) {
      return NextResponse.json({ error: 'Missing final_decision' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    const selectPaperStmt = db.prepare(`
      SELECT * 
      FROM papers 
      WHERE Paper_ID = ? AND Project_ID = ? AND calibration_pool = ?
    `);

    const updatePaperStmt = db.prepare(`
      UPDATE papers 
      SET Human_Decision = ?, 
          Human_EC_Trigger = ?, 
          Human_Rationale = ?,
          Human_QA_Scores = ?,
          Human_Extracted_Data = ?
      WHERE Paper_ID = ? AND Project_ID = ? AND calibration_pool = ?
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO calibration_commit_ledger 
        (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_ec, resolved_rationale, resolved_qa_scores, resolved_extracted_data, commit_message, timestamp)
      VALUES (?, ?, ?, ?, 'ADJUDICATOR', ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let calculatedDecision = final_decision;
    let calculatedEc = final_ec;
    let calculatedRationale = final_rationale;

    let final_qa_scores_str: string | null = null;
    let final_extracted_data_str: string | null = null;

    if (dbPool === 'pool_c') {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
      let qaRules = [];
      if (project && project.pool_c_qa_rules) {
        try {
          qaRules = typeof project.pool_c_qa_rules === 'string' ? JSON.parse(project.pool_c_qa_rules) : project.pool_c_qa_rules;
        } catch {}
      }

      const qaScoresObj = typeof final_qa_scores === 'string' ? JSON.parse(final_qa_scores) : final_qa_scores;
      const { decision, exclusionCode, rationale } = calculatePoolCDecision(qaScoresObj || {}, qaRules);
      calculatedDecision = decision;
      calculatedEc = exclusionCode;
      calculatedRationale = rationale;

      final_qa_scores_str = typeof final_qa_scores === 'string' ? final_qa_scores : JSON.stringify(final_qa_scores || {});
      final_extracted_data_str = typeof final_extracted_data === 'string' ? final_extracted_data : JSON.stringify(final_extracted_data || {});
    }

    const commitEntry = db.transaction(() => {
      // 1. Read current paper state
      const dbPaper = selectPaperStmt.get(paper_id, activeProjectId, dbPool) as any;
      if (!dbPaper) {
        throw new Error(`Paper with ID ${paper_id} not found in ${dbPool.toUpperCase()} of the active project.`);
      }

      const previousState = JSON.stringify({
        Human_Decision: dbPaper.Human_Decision,
        Human_EC_Trigger: dbPaper.Human_EC_Trigger,
        Human_Rationale: dbPaper.Human_Rationale,
        Human_QA_Scores: dbPaper.Human_QA_Scores,
        Human_Extracted_Data: dbPaper.Human_Extracted_Data
      });

      // 2. Update papers table
      updatePaperStmt.run(
        calculatedDecision, 
        calculatedEc || null, 
        calculatedRationale || '', 
        final_qa_scores_str,
        final_extracted_data_str,
        paper_id, 
        activeProjectId,
        dbPool
      );

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
        dbPool,
        previousState,
        calculatedDecision,
        calculatedEc || null,
        calculatedRationale || '',
        final_qa_scores_str,
        final_extracted_data_str,
        commit_message,
        timestamp
      );

      return {
        commit_hash: commitHash,
        project_id: activeProjectId,
        paper_id,
        pool: dbPool,
        adjudicator: 'ADJUDICATOR',
        previous_state: previousState,
        resolved_decision: calculatedDecision,
        resolved_ec: calculatedEc || null,
        resolved_rationale: calculatedRationale || '',
        resolved_qa_scores: final_qa_scores_str,
        resolved_extracted_data: final_extracted_data_str,
        commit_message,
        timestamp
      };
    })();

    return NextResponse.json({ success: true, commit: commitEntry });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to adjudicate paper' }, { status: 500 });
  }
}
