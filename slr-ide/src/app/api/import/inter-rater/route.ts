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
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND pool = ? AND reviewer_name = ?
    `);

    const countReviewersStmt = db.prepare(`
      SELECT COUNT(DISTINCT reviewer_name) as count 
      FROM reviewer_decisions 
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND pool = ?
    `);

    const selectPaperStmt = db.prepare(`
      SELECT Paper_ID, manual_decision, manual_exclusion_code, manual_rationale, manual_quality_assessment, manual_extracted_data
      FROM calibration_papers 
      WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT) AND (calibration_pool = ? OR calibration_pool = ?)
    `);

    const deleteReviewerDecisionsStmt = db.prepare(`
      DELETE FROM reviewer_decisions 
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND pool = ? AND reviewer_name = ?
    `);

    const insertDecisionStmt = db.prepare(`
      INSERT INTO reviewer_decisions 
        (paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, qa_scores, extracted_data, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updatePaperDecisionStmt = db.prepare(`
      UPDATE calibration_papers 
      SET manual_decision = ?, 
          manual_exclusion_code = ?,
          manual_rationale = ?,
          manual_quality_assessment = ?,
          manual_extracted_data = ?,
          manual_stage = ?
      WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO calibration_commit_ledger 
        (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_ec, resolved_rationale, resolved_qa_scores, resolved_extracted_data, commit_message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const getPaperDecisionsStmt = db.prepare(`
      SELECT reviewer_name, decision, ec_trigger, rationale, qa_scores, extracted_data 
      FROM reviewer_decisions 
      WHERE paper_id = ? AND CAST(project_id AS TEXT) = CAST(? AS TEXT) AND pool = ?
      ORDER BY reviewer_name ASC
    `);

    let isReupload = false;
    let papersImported = 0;
    let papersInConflict = 0;

    // We run the routing logic and database updates inside an atomic transaction
    const result = db.transaction(() => {
      // Check if re-upload
      const existingReviewer = checkReviewerExistStmt.get(resolvedProjectId, dbPool, reviewerName);
      if (existingReviewer) {
        isReupload = true;
      } else {
        // Slot vacancy check (max 2)
        const reviewerCountRow = countReviewersStmt.get(resolvedProjectId, dbPool) as { count: number };
        if (reviewerCountRow.count >= 2) {
          return { error: 'All available calibration slots (maximum 2 reviewers per pool) are fully occupied.', status: 409 };
        }
      }

      // Snapshot sync (delete-then-insert)
      deleteReviewerDecisionsStmt.run(resolvedProjectId, dbPool, reviewerName);

      const calPoolAlt = dbPool === 'pool_c' ? 'CAL_Pool_C' : dbPool === 'pool_b' ? 'CAL_Pool_B' : 'CAL_Pool_A';

      for (const paper of body.papers) {
        const paperId = paper.Paper_ID;
        if (!paperId) continue;

        let dbPaper = selectPaperStmt.get(paperId, resolvedProjectId, dbPool, calPoolAlt) as any;
        if (!dbPaper) {
          // Check if paper exists in main papers table for this project
          const mainPaper = db.prepare("SELECT Paper_ID FROM papers WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)").get(paperId, resolvedProjectId) as any;
          if (mainPaper) {
            // Auto-clone to calibration_papers with target pool
            db.prepare(`
              INSERT OR IGNORE INTO calibration_papers (
                Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
                PDF_Link, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
                Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
                remote_worker_id, scrape_claimed_at, notes, calibration_pool,
                ai_stage, ai_decision, ai_exclusion_code, ai_rationale, ai_quality_assessment, ai_extracted_data,
                manual_stage, manual_decision, manual_exclusion_code, manual_rationale, manual_quality_assessment, manual_extracted_data
              )
              SELECT 
                Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
                PDF_Link, Local_PDF_Status, Local_PDF_Path, COALESCE(Project_ID, ?), Parent_Paper_ID,
                Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
                remote_worker_id, scrape_claimed_at, notes, ?,
                ai_stage, ai_decision, ai_exclusion_code, ai_rationale, ai_quality_assessment, ai_extracted_data,
                manual_stage, manual_decision, manual_exclusion_code, manual_rationale, manual_quality_assessment, manual_extracted_data
              FROM papers WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)
            `).run(resolvedProjectId, dbPool, paperId, resolvedProjectId);

            db.prepare("UPDATE calibration_papers SET calibration_pool = ? WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)").run(dbPool, paperId, resolvedProjectId);

            dbPaper = selectPaperStmt.get(paperId, resolvedProjectId, dbPool, calPoolAlt) as any;
          }
        }

        if (!dbPaper) {
          continue; // Skip papers that aren't in this project's target pool
        }

        if (dbPool === 'pool_c') {
          const qaScoresJson = paper.Human_QA_Scores ? JSON.stringify(paper.Human_QA_Scores) : '{}';
          const extractedDataJson = paper.Human_Extracted_Data ? JSON.stringify(paper.Human_Extracted_Data) : '{}';
          
          insertDecisionStmt.run(
            paperId,
            resolvedProjectId,
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
            resolvedProjectId,
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
        FROM calibration_papers 
        WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT) AND calibration_pool = ?
      `).all(resolvedProjectId, dbPool) as any[];

      for (const paper of allPoolPapers) {
        const paperId = paper.Paper_ID;
        
        // Query decisions from all reviewers for this paper
        const decisions = getPaperDecisionsStmt.all(paperId, resolvedProjectId, dbPool) as any[];

        let newDecision = paper.manual_decision;
        let newEC = paper.manual_exclusion_code || null;
        let newRationale = paper.manual_rationale;
        let newQAScores = paper.manual_quality_assessment;
        let newExtractedData = paper.manual_extracted_data;

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
            
            const r1_dec_res = calculatePoolCDecision(r1_qa, qaRules);
            const r2_dec_res = calculatePoolCDecision(r2_qa, qaRules);
            
            if (r1_dec_res.decision !== r2_dec_res.decision) {
              papersInConflict++;
            } else {
              // Same decision, check details
              newDecision = r1_dec_res.decision;
              newEC = r1_dec_res.exclusionCode;
              
              // Simple consensus for text/scores: if identical, use it. Otherwise, flag conflict.
              let qaConflict = false;
              for (const rule of qaRules) {
                if (r1_qa[rule.code] !== r2_qa[rule.code]) {
                  qaConflict = true;
                  break;
                }
              }
              
              let extConflict = false;
              if (project.pool_c_extraction_rules) {
                let extRules = [];
                try {
                  extRules = typeof project.pool_c_extraction_rules === 'string' 
                    ? JSON.parse(project.pool_c_extraction_rules) 
                    : project.pool_c_extraction_rules;
                } catch {}
                
                for (const rule of extRules) {
                  if (JSON.stringify(r1_ext[rule.json_key]) !== JSON.stringify(r2_ext[rule.json_key])) {
                    extConflict = true;
                    break;
                  }
                }
              }
              
              if (qaConflict || extConflict) {
                papersInConflict++;
              } else {
                newRationale = `Consensus achieved: ${reviewerName} & historical. ${r1_dec_res.rationale}`;
                newQAScores = decisions[0].qa_scores;
                newExtractedData = decisions[0].extracted_data;
              }
            }
          }
        } else {
          // Pool A & Pool B: Simple decision matching
          if (decisions.length === 1) {
            newDecision = decisions[0].decision;
            newEC = decisions[0].ec_trigger;
            newRationale = decisions[0].rationale;
          } else if (decisions.length === 2) {
            const dec1 = decisions[0].decision || '';
            const dec2 = decisions[1].decision || '';
            
            if (dec1.toUpperCase() !== dec2.toUpperCase()) {
              papersInConflict++;
            } else {
              newDecision = decisions[0].decision;
              newEC = decisions[0].ec_trigger;
              newRationale = `Consensus: both reviewers chose ${newDecision}. Rationale 1: ${decisions[0].rationale || 'none'}. Rationale 2: ${decisions[1].rationale || 'none'}`;
            }
          }
        }

        // If any field changed, update paper and write to audit ledger
        const targetStage = dbPool === 'pool_c' ? 3 : (dbPool === 'pool_b' ? 2 : 1);
        if (
          newDecision !== paper.manual_decision ||
          newEC !== paper.manual_exclusion_code ||
          newRationale !== paper.manual_rationale ||
          newQAScores !== paper.manual_quality_assessment ||
          newExtractedData !== paper.manual_extracted_data ||
          paper.manual_stage !== targetStage
        ) {
          updatePaperDecisionStmt.run(newDecision, newEC, newRationale, newQAScores, newExtractedData, targetStage, paperId, resolvedProjectId);

          // Equalize AI decisions based on Stage
          if (targetStage === 2) {
            const hasLog = db.prepare("SELECT 1 FROM llm_audit_log WHERE paper_id = ? AND CAST(project_id AS TEXT) = CAST(? AS TEXT) AND task_type = 'gatekeeper' AND status = 'SUCCESS' LIMIT 1").get(paperId, resolvedProjectId);
            if (!hasLog) {
              db.prepare("UPDATE calibration_papers SET ai_decision = NULL, ai_exclusion_code = NULL, ai_rationale = NULL WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)").run(paperId, resolvedProjectId);
            }
          } else if (targetStage === 3) {
            const hasLog = db.prepare("SELECT 1 FROM llm_audit_log WHERE paper_id = ? AND CAST(project_id AS TEXT) = CAST(? AS TEXT) AND task_type = 'scientist' AND status = 'SUCCESS' LIMIT 1").get(paperId, resolvedProjectId);
            const hasScores = paper.ai_quality_assessment && paper.ai_quality_assessment !== '{}';
            if (!hasLog && !hasScores) {
              db.prepare("UPDATE calibration_papers SET ai_decision = NULL, ai_exclusion_code = NULL, ai_rationale = NULL WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)").run(paperId, resolvedProjectId);
            }
          }

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

          insertLedgerStmt.run(
            commitHash,
            resolvedProjectId,
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
      const totalReviewersCountRow = countReviewersStmt.get(resolvedProjectId, dbPool) as { count: number };

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

    // Invalidate semantic search cache for the target project
    clearSemanticSearchCache(String(resolvedProjectId));

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

    db.transaction(() => {
      // 1. Delete decisions
      db.prepare(`
        DELETE FROM reviewer_decisions 
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND pool = ?
      `).run(resolvedProjectId, dbPool);

      // 2. Delete audit ledger entries
      db.prepare(`
        DELETE FROM calibration_commit_ledger 
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND pool = ?
      `).run(resolvedProjectId, dbPool);

      // 3. Reset papers master decisions for calibration pool
      db.prepare(`
        UPDATE calibration_papers 
        SET manual_decision = NULL, 
            manual_exclusion_code = NULL,
            manual_stage = 0, 
            manual_rationale = NULL,
            manual_quality_assessment = NULL,
            manual_extracted_data = NULL
        WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT) AND calibration_pool = ?
      `).run(resolvedProjectId, dbPool);
    })();


    // Invalidate semantic search cache for the target project
    clearSemanticSearchCache(String(resolvedProjectId));

    return NextResponse.json({ success: true, message: `Successfully reset all calibration data for ${dbPool.toUpperCase()}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset calibration decisions' }, { status: 500 });
  }
}
