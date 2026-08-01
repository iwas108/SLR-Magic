import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import {
  calculatePoolCDecision,
  getScoreIndex,
  calculateCohensKappa,
  calculateWeightedKappa,
  calculatePoolBPrecision,
  calculateSchemaExactness
} from '@/lib/inter-rater/adjudication-calculations';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    if (mode === 'stage_comparison') {
      // Fetch only the latest adjudicated state for each paper from calibration_commit_ledger
      // The ledger stores historical commits, so we query the latest resolved decision.
      const ledgerEntries = db.prepare(`
        SELECT l.paper_id, l.pool, l.resolved_decision as adjudicated_decision, l.resolved_qa_scores, l.resolved_extracted_data
        FROM calibration_commit_ledger l
        JOIN (
          SELECT paper_id, project_id, MAX(timestamp) as max_ts
          FROM calibration_commit_ledger
          WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
          GROUP BY paper_id, project_id
        ) latest ON l.paper_id = latest.paper_id AND CAST(latest.project_id AS TEXT) = CAST(l.project_id AS TEXT) AND l.timestamp = latest.max_ts
        WHERE CAST(l.project_id AS TEXT) = CAST(? AS TEXT)
      `).all(activeProjectId, activeProjectId) as { paper_id: string; pool: string; adjudicated_decision: string; resolved_qa_scores: string; resolved_extracted_data: string }[];

      // Query project rules to parse fatal flaws and keys
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
      let qaRules: any[] = [];
      let extractionRules: any[] = [];
      if (project) {
        if (project.pool_c_qa_rules) {
          try {
            qaRules = typeof project.pool_c_qa_rules === 'string' ? JSON.parse(project.pool_c_qa_rules) : project.pool_c_qa_rules;
          } catch {}
        }
        if (project.pool_c_extraction_rules) {
          try {
            extractionRules = typeof project.pool_c_extraction_rules === 'string' ? JSON.parse(project.pool_c_extraction_rules) : project.pool_c_extraction_rules;
          } catch {}
        }
      }

      // Group by pool to compute stats for each stage
      // Pool A (Fast Filter, Stage 1)
      // Pool B (Gatekeeper, Stage 2)
      // Pool C (Scientist, Stage 3)
      // Pool C (Miner, Stage 4 - represented in pool C but separately calculated for schemas or decisions)
      
      const computeStatsForPool = (targetPool: string, stageNum: number) => {
        const poolEntries = ledgerEntries.filter(e => e.pool === targetPool);
        
        if (stageNum === 3) {
          // Scientist Stage: Calculate Weighted Cohen's Kappa of QA scores
          // comparing gold resolved_qa_scores vs AI structured_output.qa_scores
          const O = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
          let totalRatings = 0;
          let evaluatedCount = 0;

          // Track deviation count categories
          let rawAgreementCount = 0;
          let minorDeviationCount = 0;
          let criticalMissCount = 0;
          let totalRatingComparisons = 0;

          for (const entry of poolEntries) {
            const auditRow = db.prepare(`
              SELECT structured_output 
              FROM llm_audit_log 
              WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND paper_id = ? AND task_type = 'scientist' AND status = 'SUCCESS'
              ORDER BY created_at DESC LIMIT 1
            `).get(activeProjectId, entry.paper_id) as { structured_output: string } | undefined;

            if (auditRow?.structured_output && entry.resolved_qa_scores) {
              evaluatedCount++;
              try {
                const aiBody = JSON.parse(auditRow.structured_output);
                const aiQa = aiBody.qa_scores || {};
                const goldQa = JSON.parse(entry.resolved_qa_scores || '{}');

                for (const rule of qaRules) {
                  // Resolve case-insensitive prefix matching (e.g. qa1_aims matching QA1)
                  const codeLower = rule.code.toLowerCase();
                  const matchKey = Object.keys(aiQa).find(k => k.toLowerCase().startsWith(codeLower));
                  
                  const aiVal = matchKey ? aiQa[matchKey]?.value : undefined;
                  const goldVal = goldQa[rule.code]?.value !== undefined ? goldQa[rule.code]?.value : goldQa[rule.code.toLowerCase()]?.value;
                  
                  const idx1 = getScoreIndex(goldVal);
                  const idx2 = getScoreIndex(aiVal);
                  O[idx1][idx2]++;
                  totalRatings++;

                  // Ordinal tier deviations (0.0, 0.5, 1.0)
                  const goldNum = parseFloat(String(goldVal || 0));
                  const aiNum = parseFloat(String(aiVal || 0));
                  const diff = Math.abs(goldNum - aiNum);
                  
                  totalRatingComparisons++;
                  if (diff === 0) {
                    rawAgreementCount++;
                  } else if (diff === 0.5) {
                    minorDeviationCount++;
                  } else if (diff === 1.0) {
                    criticalMissCount++;
                  }
                }
              } catch {}
            }
          }

          const kappaMetrics = calculateWeightedKappa(O, totalRatings);
          const raw_agreement_pct = totalRatingComparisons > 0 ? (rawAgreementCount / totalRatingComparisons) * 100 : 0;
          const minor_deviation_pct = totalRatingComparisons > 0 ? (minorDeviationCount / totalRatingComparisons) * 100 : 0;
          const critical_miss_pct = totalRatingComparisons > 0 ? (criticalMissCount / totalRatingComparisons) * 100 : 0;

          return {
            pool: targetPool,
            stage: stageNum,
            total: poolEntries.length,
            evaluated: evaluatedCount,
            weighted_kappa: kappaMetrics.weighted_kappa,
            kappa_label: kappaMetrics.kappa_label,
            raw_agreement_pct,
            minor_deviation_pct,
            critical_miss_pct
          };
        }

        if (stageNum === 4) {
          // Miner Stage: Schema Match (Missing keys %, Type match %) and Literal Exact Value Match
          let evaluatedCount = 0;
          let totalKeysEvaluated = 0;
          let missingKeysCount = 0;
          let typeMatchesCount = 0;
          let exactMatchesCount = 0;

          // Helper to normalize values (handling arrays, whitespaces and casing)
          const normalizeVal = (val: any): string => {
            if (Array.isArray(val)) {
              return val.map(v => String(v).trim().toLowerCase()).sort().join(', ');
            }
            if (val && typeof val === 'object' && val.value !== undefined) {
              return normalizeVal(val.value);
            }
            return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
          };

          // Helper to parse strings/arrays into lists of words/tokens for fuzzy matching
          const getTokens = (val: any): string[] => {
            if (Array.isArray(val)) {
              return val.flatMap(v => getTokens(v));
            }
            if (val && typeof val === 'object' && val.value !== undefined) {
              return getTokens(val.value);
            }
            // Split by punctuation, comma, space, slash, etc.
            return String(val || '')
              .toLowerCase()
              .split(/[\s,;|\/\(\)\[\]\-]+/)
              .map(t => t.trim())
              .filter(t => t.length > 1); // Ignore single characters
          };

          const checkFuzzyMatch = (gold: any, ai: any): boolean => {
            const gNorm = normalizeVal(gold);
            const aNorm = normalizeVal(ai);
            if (gNorm === aNorm) return true;

            // Compute Token Intersection / Jaccard Similarity
            const gTokens = getTokens(gold);
            const aTokens = getTokens(ai);
            if (gTokens.length === 0 || aTokens.length === 0) {
              return gNorm === aNorm; // Fallback to raw match
            }

            const intersection = gTokens.filter(t => aTokens.includes(t));
            const union = Array.from(new Set([...gTokens, ...aTokens]));
            const jaccard = intersection.length / union.length;

            // If they share more than 40% of key tokens, or if one list is a complete subset of the other
            const isSubset = gTokens.every(t => aTokens.includes(t)) || aTokens.every(t => gTokens.includes(t));
            
            return jaccard >= 0.4 || isSubset;
          };

          for (const entry of poolEntries) {
            const auditRow = db.prepare(`
              SELECT structured_output 
              FROM llm_audit_log 
              WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND paper_id = ? AND task_type = 'miner' AND status = 'SUCCESS'
              ORDER BY created_at DESC LIMIT 1
            `).get(activeProjectId, entry.paper_id) as { structured_output: string } | undefined;

            if (auditRow?.structured_output && entry.resolved_extracted_data) {
              evaluatedCount++;
              try {
                const aiBody = JSON.parse(auditRow.structured_output);
                const aiExt = aiBody.extracted_data || aiBody;
                const goldExt = JSON.parse(entry.resolved_extracted_data || '{}');

                for (const rule of extractionRules) {
                  totalKeysEvaluated++;
                  
                  const goldItem = goldExt[rule.json_key];
                  const aiItem = aiExt[rule.json_key];

                  // Schema matches: check presence and type
                  if (aiItem === undefined) {
                    missingKeysCount++;
                  } else {
                    typeMatchesCount++; // Keys exist in JSON schema context
                    
                    // Exact value match check: compare normalized values or fuzzy tokens
                    if (checkFuzzyMatch(goldItem, aiItem)) {
                      exactMatchesCount++;
                    }
                  }
                }
              } catch {}
            }
          }

          const missing_keys_pct = totalKeysEvaluated > 0 ? (missingKeysCount / totalKeysEvaluated) * 100 : 0;
          const type_match_pct = totalKeysEvaluated > 0 ? (typeMatchesCount / totalKeysEvaluated) * 100 : 0;
          const pre_normalization_yield = totalKeysEvaluated - missingKeysCount > 0 ? (exactMatchesCount / (totalKeysEvaluated - missingKeysCount)) * 100 : 0;
          const schema_integrity_pct = (missing_keys_pct === 0 && type_match_pct === 100) ? 100 : 0;

          return {
            pool: targetPool,
            stage: stageNum,
            total: poolEntries.length,
            evaluated: evaluatedCount,
            missing_keys_pct,
            type_match_pct,
            pre_normalization_yield,
            schema_integrity_pct
          };
        }

        // Standard stats for Stage 1 & 2
        let TP = 0, TN = 0, FP = 0, FN = 0;
        let total = poolEntries.length;

        for (const entry of poolEntries) {
          const goldDec = (entry.adjudicated_decision || '').toUpperCase();

          // Query the latest LLM audit log decision for this paper at this stage
          // llm_audit_log has paper_id, project_id, task_type, and structured_output
          const auditRow = db.prepare(`
            SELECT structured_output 
            FROM llm_audit_log 
            WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND paper_id = ? AND task_type = ? AND status = 'SUCCESS'
            ORDER BY created_at DESC LIMIT 1
          `).get(activeProjectId, entry.paper_id, stageNum === 1 ? 'fast_filter' : 'gatekeeper') as { structured_output: string } | undefined;

          let aiDec = 'PENDING';
          if (auditRow?.structured_output) {
            try {
              const body = JSON.parse(auditRow.structured_output);
              const finalEval = body.final_evaluation || body;
              if (finalEval && finalEval.decision) {
                aiDec = finalEval.decision.toUpperCase();
              }
            } catch {}
          }

          const isGoldInc = goldDec.startsWith('INCLUDE');
          const isGoldExc = goldDec.startsWith('EXCLUDE');
          const isAiInc = aiDec.startsWith('INCLUDE');
          const isAiExc = aiDec.startsWith('EXCLUDE');

          if (isGoldInc && isAiInc) TP++;
          else if (isGoldExc && isAiExc) TN++;
          else if (isGoldExc && isAiInc) FP++;
          else if (isGoldInc && isAiExc) FN++;
        }

        const totalEvaluated = TP + TN + FP + FN;
        const recall = (TP + FN) > 0 ? TP / (TP + FN) : 0;
        const precision = (TP + FP) > 0 ? TP / (TP + FP) : 0;
        const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

        let kappa = 0;
        if (totalEvaluated > 0) {
          const kappaMetrics = calculateCohensKappa(totalEvaluated, TP, TN, FP, FN);
          kappa = kappaMetrics.cohens_kappa;
        }

        return {
          pool: targetPool,
          stage: stageNum,
          total,
          evaluated: totalEvaluated,
          TP, TN, FP, FN,
          recall,
          precision,
          f1,
          kappa
        };
      };

      const poolAStats = computeStatsForPool('pool_a', 1) as { recall: number; f1: number; evaluated: number; total: number };
      const poolBStats = computeStatsForPool('pool_b', 2) as { precision: number; recall: number; evaluated: number; total: number };
      const poolCStage3Stats = computeStatsForPool('pool_c', 3) as { weighted_kappa: number; evaluated: number; total: number; raw_agreement_pct: number; minor_deviation_pct: number; critical_miss_pct: number };
      const poolCStage4Stats = computeStatsForPool('pool_c', 4) as { evaluated: number; total: number; missing_keys_pct: number; type_match_pct: number; pre_normalization_yield: number; schema_integrity_pct: number };

      return NextResponse.json({
        poolStats: [
          {
            ...poolAStats,
            title: 'Pool A (Fast Filter)',
            stageName: 'Stage 1: Fast Filter',
            thresholds: { recall_target: 1.0, f1_target: 0.85 },
            passes: (poolAStats.recall ?? 0) >= 1.0 && (poolAStats.f1 ?? 0) >= 0.85
          },
          {
            ...poolBStats,
            title: 'Pool B (Gatekeeper)',
            stageName: 'Stage 2: Gatekeeper',
            thresholds: { precision_target: 0.85, recall_target: 0.90 },
            passes: (poolBStats.precision ?? 0) >= 0.85 && (poolBStats.recall ?? 0) >= 0.90
          },
          {
            ...poolCStage3Stats,
            title: 'Pool C (Scientist)',
            stageName: 'Stage 3: Scientist',
            thresholds: { kappa_target: 0.65 },
            passes: (poolCStage3Stats.critical_miss_pct ?? 0) === 0.0
          },
          {
            ...poolCStage4Stats,
            title: 'Pool C (Miner)',
            stageName: 'Stage 4: Miner',
            thresholds: { schema_match_target: 1.0 },
            passes: poolCStage4Stats.evaluated > 0 && (poolCStage4Stats.schema_integrity_pct ?? 0) === 100
          }
        ]
      });
    }

    const pool = searchParams.get('pool') || 'pool_a';
    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    // 1. Query distinct reviewers for this pool
    const reviewerRows = db.prepare(`
      SELECT DISTINCT reviewer_name 
      FROM reviewer_decisions 
      WHERE project_id = ? AND pool = ?
      ORDER BY reviewer_name ASC
    `).all(activeProjectId, dbPool) as { reviewer_name: string }[];

    const reviewers = reviewerRows.map(r => r.reviewer_name);
    const total_reviewers = reviewers.length;

    // 2. NaN guard if < 2 reviewers
    if (total_reviewers < 2) {
      return NextResponse.json({
        isCalibrated: false,
        message: 'Awaiting second reviewer data',
        reviewers,
        total_reviewers
      });
    }

    const r1 = reviewers[0];
    const r2 = reviewers[1];

    if (dbPool === 'pool_c') {
      // Query project rules to parse fatal flaws and keys
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
      let qaRules: any[] = [];
      let extractionRules: any[] = [];
      if (project) {
        if (project.pool_c_qa_rules) {
          try {
            qaRules = typeof project.pool_c_qa_rules === 'string' ? JSON.parse(project.pool_c_qa_rules) : project.pool_c_qa_rules;
          } catch {}
        }
        if (project.pool_c_extraction_rules) {
          try {
            extractionRules = typeof project.pool_c_extraction_rules === 'string' ? JSON.parse(project.pool_c_extraction_rules) : project.pool_c_extraction_rules;
          } catch {}
        }
      }

      // Query paired decisions for Pool C
      const pairedDecisions = db.prepare(`
        SELECT rd.paper_id,
               p.Title as title,
               p.Abstract as abstract,
               p.Local_PDF_Path as local_pdf_path,
               p.Authors as authors,
               p.Year as year,
               p.DOI as doi,
               p.Source as source,
               p.PDF_Link as pdf_link,
               p.Publisher as publisher,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.qa_scores END) as r1_qa_scores,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.qa_scores END) as r2_qa_scores,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.extracted_data END) as r1_extracted_data,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.extracted_data END) as r2_extracted_data
        FROM reviewer_decisions rd
        JOIN calibration_papers p ON rd.paper_id = p.Paper_ID AND rd.project_id = p.Project_ID
        WHERE rd.project_id = ? AND rd.pool = 'pool_c'
        GROUP BY rd.paper_id
        HAVING COUNT(DISTINCT rd.reviewer_name) = 2
      `).all(r1, r2, r1, r2, activeProjectId) as any[];

      const discrepancies: any[] = [];
      const total_intersection = pairedDecisions.length;

      // 3x3 Confusion Matrix for QA scores: [0.0, 0.5, 1.0]
      const O = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

      let totalRatings = 0;
      let r1_include_count = 0;
      let r2_include_count = 0;
      let agree_include = 0;
      let agree_exclude = 0;

      let missingKeysCount = 0;
      let typeMatchesCount = 0;

      for (const row of pairedDecisions) {
        const r1_qa = JSON.parse(row.r1_qa_scores || '{}');
        const r2_qa = JSON.parse(row.r2_qa_scores || '{}');
        const r1_ext = JSON.parse(row.r1_extracted_data || '{}');
        const r2_ext = JSON.parse(row.r2_extracted_data || '{}');

        // Compile Kappa Ratings
        for (const rule of qaRules) {
          const idx1 = getScoreIndex(r1_qa[rule.code]?.value);
          const idx2 = getScoreIndex(r2_qa[rule.code]?.value);
          O[idx1][idx2]++;
          totalRatings++;
        }

        // Calculate dynamic decisions for rates
        const d1 = calculatePoolCDecision(r1_qa, qaRules);
        const d2 = calculatePoolCDecision(r2_qa, qaRules);

        if (d1.decision === 'Include') r1_include_count++;
        if (d2.decision === 'Include') r2_include_count++;
        if (d1.decision === 'Include' && d2.decision === 'Include') agree_include++;
        if (d1.decision === 'Exclude' && d2.decision === 'Exclude') agree_exclude++;

        // Calculate Schema Exactness
        for (const rule of extractionRules) {
          if (r1_ext[rule.json_key] === undefined) {
            missingKeysCount++;
          } else {
            if (typeof r1_ext[rule.json_key]?.value === 'string') {
              typeMatchesCount++;
            }
          }

          if (r2_ext[rule.json_key] === undefined) {
            missingKeysCount++;
          } else {
            if (typeof r2_ext[rule.json_key]?.value === 'string') {
              typeMatchesCount++;
            }
          }
        }

        // Conflict check
        let hasConflict = false;
        for (const rule of qaRules) {
          if (r1_qa[rule.code]?.value !== r2_qa[rule.code]?.value) {
            hasConflict = true;
            break;
          }
        }
        if (!hasConflict) {
          for (const rule of extractionRules) {
            const v1 = (r1_ext[rule.json_key]?.value || '').trim().replace(/\s+/g, ' ');
            const v2 = (r2_ext[rule.json_key]?.value || '').trim().replace(/\s+/g, ' ');
            if (v1 !== v2) {
              hasConflict = true;
              break;
            }
          }
        }

        if (hasConflict) {
          discrepancies.push({
            paper_id: row.paper_id,
            title: row.title,
            abstract: row.abstract,
            local_pdf_path: row.local_pdf_path,
            authors: row.authors,
            year: row.year,
            doi: row.doi,
            source: row.source,
            pdf_link: row.pdf_link,
            publisher: row.publisher,
            r1_qa_scores: row.r1_qa_scores,
            r2_qa_scores: row.r2_qa_scores,
            r1_extracted_data: row.r1_extracted_data,
            r2_extracted_data: row.r2_extracted_data
          });
        }
      }

      // Linear Weighted Kappa Calculation
      const kappaMetrics = calculateWeightedKappa(O, totalRatings);
      // Schema metrics
      const schemaMetrics = calculateSchemaExactness(total_intersection, extractionRules.length, missingKeysCount, typeMatchesCount);

      return NextResponse.json({
        isCalibrated: true,
        reviewers,
        total_reviewers,
        total_intersection,
        weighted_kappa: kappaMetrics.weighted_kappa,
        kappa_label: kappaMetrics.kappa_label,
        raw_agreement_pct: kappaMetrics.raw_agreement_pct,
        expected_agreement_pct: kappaMetrics.expected_agreement_pct,
        kappa_warning: kappaMetrics.kappa_warning,
        agree_include,
        agree_exclude,
        r1_include_count,
        r2_include_count,
        missing_keys_pct: schemaMetrics.missing_keys_pct,
        type_match_pct: schemaMetrics.type_match_pct,
        discrepancies
      });

    } else {
      // Pool A & Pool B Standard Stats
      const pairedDecisions = db.prepare(`
        SELECT rd.paper_id,
               p.Title as title,
               p.Abstract as abstract,
               p.Local_PDF_Path as local_pdf_path,
               p.Authors as authors,
               p.Year as year,
               p.DOI as doi,
               p.Source as source,
               p.PDF_Link as pdf_link,
               p.Publisher as publisher,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.decision END) as r1_decision,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.decision END) as r2_decision,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.rationale END) as r1_rationale,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.rationale END) as r2_rationale,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.ec_trigger END) as r1_ec,
               MAX(CASE WHEN rd.reviewer_name = ? THEN rd.ec_trigger END) as r2_ec
        FROM reviewer_decisions rd
        JOIN calibration_papers p ON rd.paper_id = p.Paper_ID AND rd.project_id = p.Project_ID
        WHERE rd.project_id = ? AND rd.pool = ?
        GROUP BY rd.paper_id
        HAVING COUNT(DISTINCT rd.reviewer_name) = 2
      `).all(r1, r2, r1, r2, r1, r2, activeProjectId, dbPool) as any[];

      let agree_include = 0;
      let agree_exclude = 0;
      let r1_inc_r2_exc = 0;
      let r1_exc_r2_inc = 0;

      const discrepancies: any[] = [];
      const total_intersection = pairedDecisions.length;

      for (const row of pairedDecisions) {
        const dec1 = (row.r1_decision || '').trim().toLowerCase();
        const dec2 = (row.r2_decision || '').trim().toLowerCase();

        const isInc1 = dec1 === 'include';
        const isInc2 = dec2 === 'include';
        const isExc1 = dec1 === 'exclude';
        const isExc2 = dec2 === 'exclude';

        if (isInc1 && isInc2) {
          agree_include++;
        } else if (isExc1 && isExc2) {
          agree_exclude++;
        } else if (isInc1 && isExc2) {
          r1_inc_r2_exc++;
        } else if (isExc1 && isInc2) {
          r1_exc_r2_inc++;
        }

        if (dec1 !== dec2) {
          discrepancies.push({
            paper_id: row.paper_id,
            title: row.title,
            abstract: row.abstract,
            local_pdf_path: row.local_pdf_path,
            authors: row.authors,
            year: row.year,
            doi: row.doi,
            source: row.source,
            pdf_link: row.pdf_link,
            publisher: row.publisher,
            r1_decision: row.r1_decision,
            r2_decision: row.r2_decision,
            r1_rationale: row.r1_rationale,
            r2_rationale: row.r2_rationale,
            r1_ec: row.r1_ec,
            r2_ec: row.r2_ec
          });
        }
      }

      // Cohen's Kappa
      const kappaMetrics = calculateCohensKappa(total_intersection, agree_include, agree_exclude, r1_inc_r2_exc, r1_exc_r2_inc);

      // Precision calculation for Pool B
      let r1_precision = 0;
      let r2_precision = 0;
      let precision_warning = false;
      if (dbPool === 'pool_b') {
        const precMetrics = calculatePoolBPrecision(agree_include, r1_exc_r2_inc, r1_inc_r2_exc);
        r1_precision = precMetrics.r1_precision;
        r2_precision = precMetrics.r2_precision;
        precision_warning = precMetrics.precision_warning;
      }

      return NextResponse.json({
        isCalibrated: true,
        reviewers,
        total_reviewers,
        agree_include,
        agree_exclude,
        r1_inc_r2_exc,
        r1_exc_r2_inc,
        total_intersection,
        cohens_kappa: kappaMetrics.cohens_kappa,
        kappa_label: kappaMetrics.kappa_label,
        raw_agreement_pct: kappaMetrics.raw_agreement_pct,
        expected_agreement_pct: kappaMetrics.expected_agreement_pct,
        kappa_warning: kappaMetrics.kappa_warning,
        r1_precision,
        r2_precision,
        precision_warning,
        discrepancies
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to calculate statistics' }, { status: 500 });
  }
}
