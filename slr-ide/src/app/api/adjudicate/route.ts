import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { createHash } from 'crypto';
import { calculatePoolCDecision } from '@/lib/inter-rater/adjudication-calculations';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

export async function POST(request: Request) {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
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
      FROM calibration_papers 
      WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND calibration_pool = ?
    `);

    const updatePaperStmt = db.prepare(`
      UPDATE calibration_papers 
      SET manual_decision = ?, 
          manual_exclusion_code = ?,
          manual_rationale = ?,
          manual_quality_assessment = ?,
          manual_extracted_data = ?,
          manual_stage = ?
      WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND calibration_pool = ?
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
      const project = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(activeProjectId, activeProjectId) as any;
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
      const dbPaper = selectPaperStmt.get(paper_id, activeProjectId, activeProjectId, dbPool) as any;
      if (!dbPaper) {
        throw new Error(`Paper with ID ${paper_id} not found in ${dbPool.toUpperCase()} of the active project.`);
      }

      const previousState = JSON.stringify({
        manual_decision: dbPaper.manual_decision,
        manual_exclusion_code: dbPaper.manual_exclusion_code,
        manual_rationale: dbPaper.manual_rationale,
        manual_quality_assessment: dbPaper.manual_quality_assessment,
        manual_extracted_data: dbPaper.manual_extracted_data,
        manual_stage: dbPaper.manual_stage
      });

      // 2. Update papers table
      const targetStage = dbPool === 'pool_c' ? 3 : (dbPool === 'pool_b' ? 2 : 1);
      updatePaperStmt.run(
        calculatedDecision, 
        calculatedDecision === 'EXCLUDE' ? (calculatedEc || null) : null,
        calculatedRationale || '', 
        final_qa_scores_str,
        final_extracted_data_str,
        targetStage,
        paper_id, 
        activeProjectId,
        activeProjectId,
        dbPool
      );

      // Equalize AI decisions based on Stage
      if (targetStage === 2) {
        const hasLog = db.prepare(`
          SELECT 1 FROM llm_screening_records WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND stage = 2
          UNION ALL
          SELECT 1 FROM llm_audit_log WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND task_type = 'gatekeeper' AND status = 'SUCCESS'
          LIMIT 1
        `).get(paper_id, activeProjectId, activeProjectId, paper_id, activeProjectId, activeProjectId);
        if (!hasLog) {
          db.prepare("UPDATE calibration_papers SET ai_decision = NULL, ai_exclusion_code = NULL, ai_rationale = NULL WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))").run(paper_id, activeProjectId, activeProjectId);
        }
      } else if (targetStage === 3) {
        const hasLog = db.prepare(`
          SELECT 1 FROM llm_screening_records WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND stage = 3
          UNION ALL
          SELECT 1 FROM llm_audit_log WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND task_type = 'scientist' AND status = 'SUCCESS'
          LIMIT 1
        `).get(paper_id, activeProjectId, activeProjectId, paper_id, activeProjectId, activeProjectId);
        const hasScores = dbPaper.ai_quality_assessment && dbPaper.ai_quality_assessment !== '{}';
        if (!hasLog && !hasScores) {
          db.prepare("UPDATE calibration_papers SET ai_decision = NULL, ai_exclusion_code = NULL, ai_rationale = NULL WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))").run(paper_id, activeProjectId, activeProjectId);
        }
      }

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

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({ success: true, commit: commitEntry });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to adjudicate paper' }, { status: 500 });
  }
}
