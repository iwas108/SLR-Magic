import { NextResponse } from 'next/server';
import db from '@/lib/db';
import {
  calculateCohensKappa,
  calculateWeightedKappa,
  getScoreIndex
} from '@/lib/inter-rater/adjudication-calculations';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 1. Fetch Project Metadata
    let project = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as any;

    if (!project) {
      const numericProjectId = parseInt(projectId, 10);
      if (!isNaN(numericProjectId)) {
        project = db
          .prepare('SELECT * FROM projects WHERE id = ?')
          .get(numericProjectId) as any;
      }
    }

    if (!project) {
      // Fallback to active project or first available project if string ID doesn't match
      project = db.prepare('SELECT * FROM projects ORDER BY id ASC LIMIT 1').get() as any;
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const resolvedProjectId = project.id;

    // 2. Compute PRISMA 2020 Flow Data
    let ecLabels: Record<string, string> = {};
    if (project.ec_rules) {
      try {
        const parsed = JSON.parse(project.ec_rules);
        if (Array.isArray(parsed)) {
          parsed.forEach((rule: any) => {
            if (rule.code && rule.description) {
              ecLabels[rule.code] = rule.description;
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse ec_rules:', e);
      }
    }

    const allPapers = db
      .prepare(
        `SELECT Import_Source, Source, is_duplicate, manual_stage, ai_stage, manual_decision, ai_decision, manual_exclusion_code, ai_exclusion_code, Local_PDF_Status 
         FROM papers WHERE Project_ID = ?`
      )
      .all(resolvedProjectId) as any[];

    // Other sources filter list
    const otherSources = ['backward snowball', 'forward snowball', 'manual search', 'manual ingestion'];
    const isOtherSource = (src: string) => {
      if (!src) return false;
      return otherSources.includes(src.trim().toLowerCase());
    };

    // Helpers to resolve decision and stage
    const resolvePaper = (p: any) => {
      const ms = p.manual_stage || 0;
      const as = p.ai_stage || 0;
      const effectiveStage = Math.max(ms, as);

      let dec = null;
      let ec = null;

      if (ms > as) {
        dec = p.manual_decision;
        ec = p.manual_exclusion_code;
      } else if (as > ms) {
        dec = p.ai_decision;
        ec = p.ai_exclusion_code;
      } else {
        dec = p.manual_decision || p.ai_decision;
        ec = p.manual_exclusion_code || p.ai_exclusion_code;
      }

      const decUpper = dec ? dec.toUpperCase() : '';
      const isIncluded = decUpper.startsWith('INCLUDE');
      const isExcluded = decUpper.startsWith('EXCLUDE');

      return {
        effectiveStage,
        isIncluded,
        isExcluded,
        ec: ec ? ec.trim() : null,
      };
    };

    // Metrics tracking
    // Left column (Databases)
    const dbSourcesMap: Record<string, number> = {};
    let dbDuplicatesRemoved = 0;
    let dbRecordsScreened = 0;
    let dbStage1Excluded = 0;
    const dbStage1ExcludedByEC: Record<string, number> = {};
    let dbReportsSought = 0;
    let dbReportsNotRetrieved = 0;
    const dbReportsExcludedStage2: Record<string, number> = {};
    let dbStage3FatalFlaw = 0;
    let dbStage3Cumulative = 0;

    // Right column (Other Methods)
    let otherDuplicatesRemoved = 0;
    let otherReportsSought = 0;
    let otherReportsNotRetrieved = 0;
    const otherReportsExcludedStage2: Record<string, number> = {};
    let otherStage3FatalFlaw = 0;
    let otherStage3Cumulative = 0;

    // Final Merged Included
    let totalIncludedStudies = 0;

    // Process all papers
    for (const paper of allPapers) {
      const isOther = isOtherSource(paper.Import_Source);
      const isDuplicate = paper.is_duplicate === 1;

      if (!isOther) {
        // Left Column: Databases
        const sourceName = paper.Source || 'Unknown Database';
        dbSourcesMap[sourceName] = (dbSourcesMap[sourceName] || 0) + 1;

        if (isDuplicate) {
          dbDuplicatesRemoved++;
          continue;
        }

        dbRecordsScreened++;

        const res = resolvePaper(paper);

        if (res.effectiveStage >= 4 && res.isIncluded) {
          totalIncludedStudies++;
        }

        if (res.effectiveStage === 1 && res.isExcluded) {
          dbStage1Excluded++;
          const code = res.ec || 'Unspecified';
          dbStage1ExcludedByEC[code] = (dbStage1ExcludedByEC[code] || 0) + 1;
        }

        const passedStage1 = res.effectiveStage > 1 || (res.effectiveStage === 1 && res.isIncluded);
        if (passedStage1) {
          dbReportsSought++;

          if (res.effectiveStage === 2 && res.isExcluded && paper.Local_PDF_Status === 'IGNORED') {
            dbReportsNotRetrieved++;
          }

          if (res.effectiveStage === 2 && res.isExcluded && paper.Local_PDF_Status !== 'IGNORED') {
            const code = res.ec || 'Unspecified';
            dbReportsExcludedStage2[code] = (dbReportsExcludedStage2[code] || 0) + 1;
          }

          if (res.effectiveStage === 3 && res.isExcluded) {
            const ecUpper = res.ec ? res.ec.toUpperCase() : '';
            if (ecUpper.includes('CUMULATIVE')) {
              dbStage3Cumulative++;
            } else {
              dbStage3FatalFlaw++;
            }
          }
        }
      } else {
        // Right Column: Other Methods
        if (isDuplicate) {
          otherDuplicatesRemoved++;
          continue;
        }

        otherReportsSought++;

        const res = resolvePaper(paper);

        if (res.effectiveStage >= 4 && res.isIncluded) {
          totalIncludedStudies++;
        }

        if (res.effectiveStage === 2 && res.isExcluded && paper.Local_PDF_Status === 'IGNORED') {
          otherReportsNotRetrieved++;
        }

        if (res.effectiveStage === 2 && res.isExcluded && paper.Local_PDF_Status !== 'IGNORED') {
          const code = res.ec || 'Unspecified';
          otherReportsExcludedStage2[code] = (otherReportsExcludedStage2[code] || 0) + 1;
        }

        if (res.effectiveStage === 3 && res.isExcluded) {
          const ecUpper = res.ec ? res.ec.toUpperCase() : '';
          if (ecUpper.includes('CUMULATIVE')) {
            otherStage3Cumulative++;
          } else {
            otherStage3FatalFlaw++;
          }
        }
      }
    }

    const databaseSources = Object.entries(dbSourcesMap).map(([source, count]) => ({
      source,
      count
    }));

    const formatECList = (map: Record<string, number>) => {
      return Object.entries(map).map(([code, count]) => ({ code, count }));
    };

    const prismaData = {
      projectName: project.name,
      databaseSources,
      dbDuplicatesRemoved,
      dbRecordsScreened,
      dbStage1Excluded,
      dbStage1ExcludedByEC: formatECList(dbStage1ExcludedByEC),
      dbReportsSought,
      dbReportsNotRetrieved,
      dbReportsAssessed: Math.max(0, dbReportsSought - dbReportsNotRetrieved),
      dbReportsExcludedStage2: formatECList(dbReportsExcludedStage2),
      dbReportsExcludedStage3: [
        { gate: 'Fatal Flaw Gate', count: dbStage3FatalFlaw },
        { gate: 'Cumulative Gate', count: dbStage3Cumulative }
      ],
      dbStudiesIncluded: totalIncludedStudies,

      otherDuplicatesRemoved,
      otherReportsSought,
      otherReportsNotRetrieved,
      otherReportsAssessed: Math.max(0, otherReportsSought - otherReportsNotRetrieved),
      otherReportsExcludedStage2: formatECList(otherReportsExcludedStage2),
      otherReportsExcludedStage3: [
        { gate: 'Fatal Flaw Gate', count: otherStage3FatalFlaw },
        { gate: 'Cumulative Gate', count: otherStage3Cumulative }
      ],
      otherStudiesIncluded: totalIncludedStudies,
      ecLabels
    };

    // 3. Stage Comparison / Agreement Metrics
    let stageComparisons: any[] = [];
    try {
      const ledgerEntries = db.prepare(`
        SELECT l.paper_id, l.pool, l.resolved_decision as adjudicated_decision, l.resolved_qa_scores, l.resolved_extracted_data
        FROM calibration_commit_ledger l
        JOIN (
          SELECT paper_id, MAX(timestamp) as max_ts
          FROM calibration_commit_ledger
          WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
          GROUP BY paper_id
        ) latest ON l.paper_id = latest.paper_id AND l.timestamp = latest.max_ts
        WHERE CAST(l.project_id AS TEXT) = CAST(? AS TEXT)
      `).all(resolvedProjectId, resolvedProjectId) as any[];

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

      const computeStatsForPool = (targetPool: string, stageNum: number) => {
        const poolEntries = ledgerEntries.filter(e => e.pool === targetPool);
        
        if (stageNum === 3) {
          const O = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
          let totalRatings = 0;
          let evaluatedCount = 0;
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
            `).get(resolvedProjectId, entry.paper_id) as { structured_output: string } | undefined;

            if (auditRow?.structured_output && entry.resolved_qa_scores) {
              evaluatedCount++;
              try {
                const aiBody = JSON.parse(auditRow.structured_output);
                const aiQa = aiBody.qa_scores || {};
                const goldQa = JSON.parse(entry.resolved_qa_scores || '{}');

                for (const rule of qaRules) {
                  const codeLower = rule.code.toLowerCase();
                  const matchKey = Object.keys(aiQa).find(k => k.toLowerCase().startsWith(codeLower));
                  
                  const aiVal = matchKey ? aiQa[matchKey]?.value : undefined;
                  const goldVal = goldQa[rule.code]?.value !== undefined ? goldQa[rule.code]?.value : goldQa[rule.code.toLowerCase()]?.value;

                  const idx1 = getScoreIndex(goldVal);
                  const idx2 = getScoreIndex(aiVal);
                  O[idx1][idx2]++;
                  totalRatings++;

                  const goldNum = parseFloat(String(goldVal || 0));
                  const aiNum = parseFloat(String(aiVal || 0));
                  const diff = Math.abs(goldNum - aiNum);
                  
                  totalRatingComparisons++;
                  if (diff === 0) rawAgreementCount++;
                  else if (diff === 0.5) minorDeviationCount++;
                  else if (diff >= 1.0) criticalMissCount++;
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
          let evaluatedCount = 0;
          let totalKeysEvaluated = 0;
          let missingKeysCount = 0;
          let typeMatchesCount = 0;
          let exactMatchesCount = 0;

          const normalizeVal = (val: any): string => {
            if (Array.isArray(val)) {
              return val.map(v => String(v).trim().toLowerCase()).sort().join(', ');
            }
            if (val && typeof val === 'object' && val.value !== undefined) {
              return normalizeVal(val.value);
            }
            return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
          };

          const getTokens = (val: any): string[] => {
            if (Array.isArray(val)) {
              return val.flatMap(v => getTokens(v));
            }
            if (val && typeof val === 'object' && val.value !== undefined) {
              return getTokens(val.value);
            }
            return String(val || '')
              .toLowerCase()
              .split(/[\s,;|\/\(\)\[\]\-]+/)
              .map(t => t.trim())
              .filter(t => t.length > 1);
          };

          const checkFuzzyMatch = (gold: any, ai: any): boolean => {
            const gNorm = normalizeVal(gold);
            const aNorm = normalizeVal(ai);
            if (gNorm === aNorm) return true;

            const gTokens = getTokens(gold);
            const aTokens = getTokens(ai);
            if (gTokens.length === 0 || aTokens.length === 0) {
              return gNorm === aNorm;
            }

            const intersection = gTokens.filter(t => aTokens.includes(t));
            const union = Array.from(new Set([...gTokens, ...aTokens]));
            const jaccard = intersection.length / union.length;

            const isSubset = gTokens.every(t => aTokens.includes(t)) || aTokens.every(t => gTokens.includes(t));
            
            return jaccard >= 0.4 || isSubset;
          };

          for (const entry of poolEntries) {
            const auditRow = db.prepare(`
              SELECT structured_output 
              FROM llm_audit_log 
              WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND paper_id = ? AND task_type = 'miner' AND status = 'SUCCESS'
              ORDER BY created_at DESC LIMIT 1
            `).get(resolvedProjectId, entry.paper_id) as { structured_output: string } | undefined;

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
                  if (aiItem === undefined) {
                    missingKeysCount++;
                  } else {
                    typeMatchesCount++;
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

        let TP = 0, TN = 0, FP = 0, FN = 0;
        for (const entry of poolEntries) {
          const goldDec = (entry.adjudicated_decision || '').toUpperCase();
          const auditRow = db.prepare(`
            SELECT structured_output 
            FROM llm_audit_log 
            WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND paper_id = ? AND task_type = ? AND status = 'SUCCESS'
            ORDER BY created_at DESC LIMIT 1
          `).get(resolvedProjectId, entry.paper_id, stageNum === 1 ? 'fast_filter' : 'gatekeeper') as { structured_output: string } | undefined;

          let aiDec = 'PENDING';
          if (auditRow?.structured_output) {
            try {
              const body = JSON.parse(auditRow.structured_output);
              const finalEval = body.final_evaluation || body;
              if (finalEval && finalEval.decision) aiDec = finalEval.decision.toUpperCase();
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
          total: poolEntries.length,
          evaluated: totalEvaluated,
          TP, TN, FP, FN,
          recall, precision, f1,
          kappa
        };
      };

      const pA = computeStatsForPool('pool_a', 1);
      const pB = computeStatsForPool('pool_b', 2);
      const pC3 = computeStatsForPool('pool_c', 3);
      const pC4 = computeStatsForPool('pool_c', 4);

      stageComparisons = [
        {
          stage: 1,
          title: 'Pool A (Fast Filter)',
          stageName: 'Stage 1: Fast Filter',
          recall: pA.recall ?? 0,
          f1: pA.f1 ?? 0,
          evaluated: pA.evaluated ?? 0,
          total: pA.total ?? 0,
          TP: pA.TP ?? 0,
          TN: pA.TN ?? 0,
          FP: pA.FP ?? 0,
          FN: pA.FN ?? 0,
          passes: (pA.evaluated ?? 0) > 0 && (pA.recall ?? 0) >= 1.0 && (pA.f1 ?? 0) >= 0.85,
          thresholds: { recall_target: 1.0, f1_target: 0.85 }
        },
        {
          stage: 2,
          title: 'Pool B (Gatekeeper)',
          stageName: 'Stage 2: Gatekeeper',
          precision: pB.precision ?? 0,
          recall: pB.recall ?? 0,
          evaluated: pB.evaluated ?? 0,
          total: pB.total ?? 0,
          TP: pB.TP ?? 0,
          TN: pB.TN ?? 0,
          FP: pB.FP ?? 0,
          FN: pB.FN ?? 0,
          passes: (pB.evaluated ?? 0) > 0 && (pB.precision ?? 0) >= 0.85 && (pB.recall ?? 0) >= 0.90,
          thresholds: { precision_target: 0.85, recall_target: 0.90 }
        },
        {
          stage: 3,
          title: 'Pool C (Scientist)',
          stageName: 'Stage 3: Scientist',
          weighted_kappa: pC3.weighted_kappa ?? 0,
          raw_agreement_pct: pC3.raw_agreement_pct ?? 0,
          minor_deviation_pct: pC3.minor_deviation_pct ?? 0,
          critical_miss_pct: pC3.critical_miss_pct ?? 0,
          evaluated: pC3.evaluated ?? 0,
          total: pC3.total ?? 0,
          passes: (pC3.evaluated ?? 0) > 0 && (pC3.critical_miss_pct ?? 0) === 0.0,
          thresholds: { kappa_target: 0.65 }
        },
        {
          stage: 4,
          title: 'Pool C (Miner)',
          stageName: 'Stage 4: Miner',
          schema_integrity_pct: pC4.schema_integrity_pct ?? 0,
          pre_normalization_yield: pC4.pre_normalization_yield ?? 0,
          exact_match_pct: pC4.pre_normalization_yield ?? 0,
          evaluated: pC4.evaluated ?? 0,
          total: pC4.total ?? 0,
          passes: (pC4.evaluated ?? 0) > 0 && (pC4.schema_integrity_pct ?? 0) === 100.0,
          thresholds: { schema_match_target: 1.0 }
        }
      ];
    } catch (e) {
      console.error('Failed to compute stage comparisons:', e);
    }

    // 4. Pre-Calibration Pool Filling Status
    let poolMetrics: any = {
      pool_a: { target: 50, filled: 0, completed: 0 },
      pool_b: { target: 30, filled: 0, completed: 0 },
      pool_c: { target: 20, filled: 0, completed: 0 },
      pool_a_count: 0,
      pool_b_count: 0,
      pool_c_count: 0,
      pool_a_size: 50,
      pool_b_size: 30,
      pool_c_size: 20
    };

    try {
      const calCounts = db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM calibration_papers WHERE Project_ID = ? AND calibration_pool IN ('pool_a', 'CAL_Pool_A') AND (is_duplicate IS NULL OR is_duplicate = 0)) as pool_a_count,
          (SELECT COUNT(*) FROM calibration_papers WHERE Project_ID = ? AND calibration_pool IN ('pool_b', 'CAL_Pool_B') AND (is_duplicate IS NULL OR is_duplicate = 0)) as pool_b_count,
          (SELECT COUNT(*) FROM calibration_papers WHERE Project_ID = ? AND calibration_pool IN ('pool_c', 'CAL_Pool_C') AND (is_duplicate IS NULL OR is_duplicate = 0)) as pool_c_count
      `).get(resolvedProjectId, resolvedProjectId, resolvedProjectId) as any;

      if (calCounts) {
        poolMetrics.pool_a_count = calCounts.pool_a_count || 0;
        poolMetrics.pool_b_count = calCounts.pool_b_count || 0;
        poolMetrics.pool_c_count = calCounts.pool_c_count || 0;
        poolMetrics.pool_a.filled = calCounts.pool_a_count || 0;
        poolMetrics.pool_b.filled = calCounts.pool_b_count || 0;
        poolMetrics.pool_c.filled = calCounts.pool_c_count || 0;
      }
    } catch (e) {
      console.error('Failed to compute pool metrics:', e);
    }

    // 5. Rolling Batch QC Status
    const minerKeys = [
      'rq1_operational_domains',
      'rq2_a_autonomy_level',
      'rq2_b_control_paradigm',
      'rq3_computational_topologies',
      'rq4_network_protocols',
      'rq5_semantic_frameworks',
      'rq6_deployed_forecasting_engines',
      'rq7_accuracy_metrics',
      'rq8_a_edge_hardware',
      'rq8_b_execution_footprint',
      'rq9_deployment_barriers'
    ];

    const arrayKeys = [
      'rq4_network_protocols',
      'rq6_deployed_forecasting_engines',
      'rq7_accuracy_metrics',
      'rq8_b_execution_footprint',
      'rq9_deployment_barriers'
    ];

    const computeCI = (p_hat: number, n: number) => {
      if (n <= 0) return { SE: 0, CI_lower: 0 };
      const SE = Math.sqrt((p_hat * (1 - p_hat)) / n);
      const CI_lower = Math.max(0, p_hat - (1.96 * SE));
      return { SE, CI_lower };
    };

    const calculateCohortStats = (papers: any[], qaRules: any[], umbMap: Record<string, Record<string, any>>) => {
      let totalQAPairs = 0;
      let qaAgreementCount = 0;
      let qaCriticalMissCount = 0;

      let structurallyValidPapers = 0;
      let totalKeysEvaluated = 0;
      let semanticMatchesCount = 0;

      const resolveToken = (val: string, key: string) => {
        if (val === undefined || val === null) return '';
        const raw = String(val).trim().toLowerCase().replace(/\s+/g, ' ');
        const map = umbMap[key] || {};
        const matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === raw);
        if (!matchedKey) return raw;
        const mappedVal = map[matchedKey];
        if (!mappedVal) return raw;
        if (typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
          return String(mappedVal.umbrella_category || '').trim().toLowerCase();
        }
        if (Array.isArray(mappedVal)) {
          return String(mappedVal[0] || '').trim().toLowerCase();
        }
        return String(mappedVal).trim().toLowerCase();
      };

      const resolveArray = (val: any, key: string) => {
        if (Array.isArray(val)) {
          return val.map(item => resolveToken(String(item), key)).filter(Boolean).sort();
        }
        if (typeof val === 'string') {
          return val.split(',').map(item => resolveToken(item.trim(), key)).filter(Boolean).sort();
        }
        return [];
      };

      for (const paper of papers) {
        try {
          const aiQaBody = JSON.parse(paper.ai_quality_assessment || '{}');
          const aiQa = aiQaBody.qa_scores || aiQaBody || {};
          const goldQaBody = JSON.parse(paper.manual_quality_assessment || '{}');
          const goldQa = goldQaBody.qa_scores || goldQaBody || {};

          for (const rule of qaRules) {
            const codeLower = rule.code ? rule.code.toLowerCase() : '';
            if (!codeLower) continue;
            const aiMatchKey = Object.keys(aiQa).find(k => {
              const kl = k.toLowerCase();
              return kl === codeLower || kl.startsWith(codeLower + '_');
            });
            const goldMatchKey = Object.keys(goldQa).find(k => {
              const kl = k.toLowerCase();
              return kl === codeLower || kl.startsWith(codeLower + '_');
            });

            const aiVal = aiMatchKey ? aiQa[aiMatchKey]?.value : undefined;
            const goldVal = goldMatchKey ? goldQa[goldMatchKey]?.value : undefined;

            if (aiVal !== undefined && goldVal !== undefined) {
              const aiScore = parseFloat(String(aiVal));
              const goldScore = parseFloat(String(goldVal));
              if (!isNaN(aiScore) && !isNaN(goldScore)) {
                const diff = Math.abs(aiScore - goldScore);
                totalQAPairs++;
                if (diff < 1.0) qaAgreementCount++;
                if (diff >= 1.0) qaCriticalMissCount++;
              }
            }
          }
        } catch (e) {}

        let isStructurallyValid = true;
        let parsedAiMiner: any = null;
        let parsedGoldMiner: any = null;

        try { parsedAiMiner = JSON.parse(paper.ai_extracted_data || '{}'); } catch (e) { isStructurallyValid = false; }
        try { parsedGoldMiner = JSON.parse(paper.manual_extracted_data || '{}'); } catch (e) {}

        if (isStructurallyValid && parsedAiMiner) {
          const aiExt = parsedAiMiner.extracted_data || parsedAiMiner;
          for (const key of minerKeys) {
            const field = aiExt[key];
            if (!field || typeof field !== 'object' || field.value === undefined) {
              isStructurallyValid = false;
              break;
            }
            if (arrayKeys.includes(key)) {
              if (!Array.isArray(field.value)) { isStructurallyValid = false; break; }
            } else {
              if (typeof field.value !== 'string' && typeof field.value !== 'number') { isStructurallyValid = false; break; }
            }
          }
        } else {
          isStructurallyValid = false;
        }

        if (isStructurallyValid) structurallyValidPapers++;

        if (parsedAiMiner && parsedGoldMiner) {
          const aiExt = parsedAiMiner.extracted_data || parsedAiMiner;
          const goldExt = parsedGoldMiner.extracted_data || parsedGoldMiner;

          for (const key of minerKeys) {
            const aiField = aiExt[key];
            const goldField = goldExt[key];

            if (aiField && goldField && aiField.value !== undefined && goldField.value !== undefined) {
              totalKeysEvaluated++;
              if (arrayKeys.includes(key)) {
                const aiArr = resolveArray(aiField.value, key);
                const goldArr = resolveArray(goldField.value, key);
                if (aiArr.length === goldArr.length && aiArr.every((v, idx) => v === goldArr[idx])) {
                  semanticMatchesCount++;
                }
              } else {
                const aiStr = resolveToken(String(aiField.value), key);
                const goldStr = resolveToken(String(goldField.value), key);
                if (aiStr === goldStr) semanticMatchesCount++;
              }
            }
          }
        }
      }

      const p_hat_s3 = totalQAPairs > 0 ? qaAgreementCount / totalQAPairs : 0;
      const critical_miss_rate = totalQAPairs > 0 ? (qaCriticalMissCount / totalQAPairs) * 100 : 0;
      const s3CI = computeCI(p_hat_s3, totalQAPairs);

      const schema_integrity_rate = papers.length > 0 ? structurallyValidPapers / papers.length : 0;
      const semantic_agreement = totalKeysEvaluated > 0 ? (semanticMatchesCount / totalKeysEvaluated) * 100 : 0;
      const s4CI = computeCI(schema_integrity_rate, papers.length);

      const s3_passed = s3CI.CI_lower >= 0.65 && critical_miss_rate === 0;
      const s4_passed = s4CI.CI_lower >= 0.80 && schema_integrity_rate === 1.0;

      return {
        s3: {
          p_hat: p_hat_s3,
          SE: s3CI.SE,
          CI_lower: s3CI.CI_lower,
          critical_miss_rate,
          passed: s3_passed
        },
        s4: {
          p_hat: schema_integrity_rate,
          SE: s4CI.SE,
          CI_lower: s4CI.CI_lower,
          schema_integrity_rate: schema_integrity_rate * 100,
          semantic_agreement,
          passed: s4_passed
        }
      };
    };

    let rollingBatchQC: any = {
      batches: [],
      overall_status: 'NOT_STARTED',
      exit_triggered: false,
      cumulative_stats: null,
      individual_batch_stats: [],
      audit_passed: false
    };

    try {
      const completedBatches = db.prepare(`
        SELECT * FROM rolling_batches 
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND status = 'complete'
        ORDER BY batch_number ASC
      `).all(resolvedProjectId) as any[];

      const allBatches = db.prepare(`
        SELECT * FROM rolling_batches WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) ORDER BY batch_number ASC
      `).all(resolvedProjectId) as any[];

      rollingBatchQC.batches = allBatches;
      rollingBatchQC.overall_status = allBatches.length > 0 && allBatches.every((b: any) => b.status === 'PASSED' || b.status === 'complete')
        ? 'PASSED'
        : 'IN_PROGRESS';
      rollingBatchQC.exit_triggered = allBatches.some((b: any) => b.exit_triggered === 1);

      let qaRules: any[] = [];
      if (project.pool_c_qa_rules) {
        try {
          qaRules = typeof project.pool_c_qa_rules === 'string' 
            ? JSON.parse(project.pool_c_qa_rules) 
            : project.pool_c_qa_rules;
        } catch (e) {}
      }

      const umbRows = db.prepare('SELECT * FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId) as any[];
      const umbMap: Record<string, Record<string, string>> = {};
      for (const row of umbRows) {
        try {
          const keyName = row.extracted_data_key || row.field_name;
          const rawMapping = row.umbrella_mapping || row.taxonomy_mapping || '{}';
          if (keyName) {
            umbMap[keyName] = JSON.parse(rawMapping);
          }
        } catch (e) {
          if (row.extracted_data_key) {
            umbMap[row.extracted_data_key] = {};
          }
        }
      }

      if (completedBatches.length > 0) {
        const completedBatchIds = completedBatches.map(b => b.id);
        const placeholders = completedBatchIds.map(() => '?').join(',');
        const allCompletedPapers = db.prepare(`
          SELECT * FROM rolling_batch_papers 
          WHERE batch_id IN (${placeholders})
        `).all(...completedBatchIds) as any[];

        rollingBatchQC.cumulative_stats = calculateCohortStats(allCompletedPapers, qaRules, umbMap);

        rollingBatchQC.individual_batch_stats = completedBatches.map(batch => {
          const batchPapers = db.prepare(`
            SELECT * FROM rolling_batch_papers 
            WHERE batch_id = ?
          `).all(batch.id) as any[];

          return {
            batchNumber: batch.batch_number,
            batchId: batch.id,
            finalizedAt: batch.finalized_at || batch.created_at,
            stats: calculateCohortStats(batchPapers, qaRules, umbMap)
          };
        });

        let auditPassed = false;
        if (completedBatches.length >= 2) {
          const currentCohortPassed = rollingBatchQC.cumulative_stats.s3.passed && rollingBatchQC.cumulative_stats.s4.passed;
          if (currentCohortPassed) {
            const previousBatches = completedBatches.slice(0, -1);
            const previousBatchIds = previousBatches.map(b => b.id);
            const prevPlaceholders = previousBatchIds.map(() => '?').join(',');

            const previousPapers = db.prepare(`
              SELECT * FROM rolling_batch_papers 
              WHERE batch_id IN (${prevPlaceholders})
            `).all(...previousBatchIds) as any[];

            const previousStats = calculateCohortStats(previousPapers, qaRules, umbMap);
            if (previousStats.s3.passed && previousStats.s4.passed) {
              auditPassed = true;
            }
          }
        }
        rollingBatchQC.audit_passed = auditPassed;
      }
    } catch (e) {
      console.error('Failed to compute rolling batch QC:', e);
    }

    // 6. Fetch Final Cohort Papers (Stage 4 INCLUDE, with multi-tier fallback if Stage 4 is incomplete)
    let cohortPapers: any[] = [];
    try {
      cohortPapers = db
        .prepare(
          `SELECT p.*,
                  (SELECT structured_output FROM llm_audit_log 
                   WHERE paper_id = p.Paper_ID AND task_type = 'scientist'
                   ORDER BY id DESC LIMIT 1) as scientist_structured_output
           FROM papers p
           WHERE p.Project_ID = ?
             AND MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) = 4
             AND CASE 
                 WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
                 WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
                 ELSE COALESCE(p.manual_decision, p.ai_decision)
             END LIKE 'INCLUDE%'
           ORDER BY p.Year DESC, p.Title ASC`
        )
        .all(resolvedProjectId) as any[];
    } catch (e) {
      console.error('Failed to fetch Stage 4 cohort papers:', e);
    }

    // Fallback Tier 1: Any INCLUDED papers regardless of stage
    if (cohortPapers.length === 0) {
      try {
        cohortPapers = db
          .prepare(
            `SELECT p.*,
                    (SELECT structured_output FROM llm_audit_log 
                     WHERE paper_id = p.Paper_ID AND task_type = 'scientist'
                     ORDER BY id DESC LIMIT 1) as scientist_structured_output
             FROM papers p
             WHERE p.Project_ID = ?
               AND (p.is_duplicate IS NULL OR p.is_duplicate = 0)
               AND CASE 
                   WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
                   WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
                   ELSE COALESCE(p.manual_decision, p.ai_decision)
               END LIKE 'INCLUDE%'
             ORDER BY p.Year DESC, p.Title ASC`
          )
          .all(resolvedProjectId) as any[];
      } catch (e) {
        console.error('Failed fallback Tier 1 cohort papers:', e);
      }
    }

    // Fallback Tier 2: All non-duplicate papers in the project
    if (cohortPapers.length === 0) {
      try {
        cohortPapers = db
          .prepare(
            `SELECT p.*,
                    (SELECT structured_output FROM llm_audit_log 
                     WHERE paper_id = p.Paper_ID AND task_type = 'scientist'
                     ORDER BY id DESC LIMIT 1) as scientist_structured_output
             FROM papers p
             WHERE p.Project_ID = ?
               AND (p.is_duplicate IS NULL OR p.is_duplicate = 0)
             ORDER BY p.Year DESC, p.Title ASC`
          )
          .all(resolvedProjectId) as any[];
      } catch (e) {
        console.error('Failed fallback Tier 2 cohort papers:', e);
      }
    }

    // Fallback Tier 3: All papers in project
    if (cohortPapers.length === 0) {
      try {
        cohortPapers = db
          .prepare(
            `SELECT p.* FROM papers p WHERE p.Project_ID = ? ORDER BY p.Year DESC, p.Title ASC`
          )
          .all(resolvedProjectId) as any[];
      } catch (e) {
        console.error('Failed fallback Tier 3 cohort papers:', e);
      }
    }

    const processedPapers = cohortPapers.map((paper: any) => {
      let aiQa = null;
      let manualQa = null;
      let aiExtracted = null;
      let manualExtracted = null;

      try {
        if (paper.ai_quality_assessment) {
          aiQa = JSON.parse(paper.ai_quality_assessment);
        }
      } catch (e) {}

      try {
        if (paper.manual_quality_assessment) {
          manualQa = JSON.parse(paper.manual_quality_assessment);
        }
      } catch (e) {}

      try {
        if (paper.ai_extracted_data) {
          aiExtracted = JSON.parse(paper.ai_extracted_data);
        }
      } catch (e) {}

      try {
        if (paper.manual_extracted_data) {
          manualExtracted = JSON.parse(paper.manual_extracted_data);
        }
      } catch (e) {}

      if (aiQa && paper.scientist_structured_output) {
        try {
          const scientistOutput = JSON.parse(paper.scientist_structured_output);
          if (scientistOutput?.logic_trace) {
            aiQa.logic_trace = {
              ...(aiQa.logic_trace || {}),
              ...scientistOutput.logic_trace
            };
            if (scientistOutput.logic_trace.appraisal_reasoning) {
              aiQa._scientist_logic_trace = scientistOutput.logic_trace.appraisal_reasoning;
            }
          }
        } catch (e) {}
      }

      const { scientist_structured_output, ...cleanPaper } = paper;

      return {
        ...cleanPaper,
        ai_quality_assessment: aiQa,
        manual_quality_assessment: manualQa,
        ai_extracted_data: aiExtracted,
        manual_extracted_data: manualExtracted,
      };
    });

    // 7. Fetch Umbrellanizer Taxonomy Mappings
    let umbrellanizerMappings: Record<string, any> = {};
    try {
      const umbRows = db
        .prepare(`SELECT * FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)`)
        .all(resolvedProjectId) as any[];

      umbRows.forEach((row: any) => {
        try {
          const rawMapping = row.umbrella_mapping || row.taxonomy_mapping || '{}';
          const keyName = row.extracted_data_key || row.field_name;
          if (keyName) {
            const parsed = JSON.parse(rawMapping);
            umbrellanizerMappings[keyName] = parsed;
          }
        } catch (e) {}
      });
    } catch (e) {
      console.error('Failed to fetch umbrellanizer mappings:', e);
    }

    // 8. Fetch Accounting Data
    let pipelineBreakdown: any[] = [];
    let totalCostUsd = 0;
    let totalTokens = 0;
    let totalCalls = 0;
    let expensiveCalls: any[] = [];
    let overallStatsRow: any = null;

    try {
      const llmStats = db
        .prepare(
          `SELECT task_type, 
                  COUNT(*) as call_count,
                  SUM(cost_usd) as total_cost,
                  SUM(total_tokens) as total_tokens,
                  MIN(CASE WHEN cost_usd > 0 THEN cost_usd ELSE NULL END) as min_cost,
                  AVG(cost_usd) as avg_cost,
                  MAX(cost_usd) as max_cost,
                  MIN(CASE WHEN total_tokens > 0 THEN total_tokens ELSE NULL END) as min_tokens,
                  AVG(total_tokens) as avg_tokens,
                  MAX(total_tokens) as max_tokens
           FROM llm_audit_log
           WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
           GROUP BY task_type`
        )
        .all(resolvedProjectId) as any[];

      const umbStats = db
        .prepare(
          `SELECT 'umbrellanizer' as task_type,
                  COUNT(*) as call_count,
                  SUM(cost_usd) as total_cost,
                  SUM(input_tokens + output_tokens + thinking_tokens) as total_tokens,
                  MIN(CASE WHEN cost_usd > 0 THEN cost_usd ELSE NULL END) as min_cost,
                  AVG(cost_usd) as avg_cost,
                  MAX(cost_usd) as max_cost,
                  MIN(CASE WHEN (input_tokens + output_tokens + thinking_tokens) > 0 THEN (input_tokens + output_tokens + thinking_tokens) ELSE NULL END) as min_tokens,
                  AVG(input_tokens + output_tokens + thinking_tokens) as avg_tokens,
                  MAX(input_tokens + output_tokens + thinking_tokens) as max_tokens
           FROM umbrellanizer_results
           WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)`
        )
        .get(resolvedProjectId) as any;

      pipelineBreakdown = [...llmStats];
      if (umbStats && umbStats.call_count > 0) {
        pipelineBreakdown.push(umbStats);
      }

      overallStatsRow = db
        .prepare(
          `SELECT 
            SUM(cost_usd) as total_cost,
            SUM(total_tokens) as total_tokens,
            MIN(CASE WHEN cost_usd > 0 THEN cost_usd ELSE NULL END) as min_cost,
            MAX(cost_usd) as max_cost,
            AVG(cost_usd) as avg_cost,
            MIN(CASE WHEN total_tokens > 0 THEN total_tokens ELSE NULL END) as min_tokens,
            MAX(total_tokens) as max_tokens,
            AVG(total_tokens) as avg_tokens,
            COUNT(*) as total_calls
          FROM (
            SELECT cost_usd, total_tokens FROM llm_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
            UNION ALL
            SELECT cost_usd, (input_tokens + output_tokens + thinking_tokens) as total_tokens FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
          )`
        )
        .get(resolvedProjectId, resolvedProjectId) as any;

      totalCostUsd = overallStatsRow?.total_cost || 0;
      totalTokens = overallStatsRow?.total_tokens || 0;
      totalCalls = overallStatsRow?.total_calls || 0;

      expensiveCalls = db
        .prepare(
          `SELECT task_type, model_id, total_tokens, cost_usd, timestamp, paper_id, latency_ms
           FROM (
             SELECT 
               task_type, 
               model_id, 
               total_tokens, 
               cost_usd, 
               created_at AS timestamp, 
               paper_id, 
               latency_ms
             FROM llm_audit_log
             WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)

             UNION ALL

             SELECT 
               'umbrellanizer' as task_type, 
               model_id, 
               (input_tokens + output_tokens + thinking_tokens) as total_tokens, 
               cost_usd, 
               created_at AS timestamp, 
               NULL as paper_id, 
               NULL as latency_ms
             FROM umbrellanizer_results
             WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
           )
           ORDER BY cost_usd DESC
           LIMIT 5000`
        )
        .all(resolvedProjectId, resolvedProjectId) as any[];
    } catch (e) {
      console.error('Failed to fetch accounting data:', e);
    }

    let promptTemplates: any[] = [];
    try {
      promptTemplates = db
        .prepare(`SELECT * FROM prompt_templates WHERE project_id = ? OR project_id IS NULL ORDER BY created_at ASC`)
        .all(resolvedProjectId) as any[];
    } catch (e) {
      console.error('Failed to query prompt_templates for export:', e);
    }

    const exportPayload = {
      schema_version: '1.0.0',
      type: 'slr-viewer-export',
      export_date: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description || '',
        research_manifesto: project.manifesto || project.research_manifesto || '',
        research_objective: project.objective || project.research_objective || '',
        research_questions: project.questions || project.research_questions || '',
        exclusion_criteria: project.exclusion_criteria || '',
        quality_assurance_definition: project.qa_definition || project.quality_assurance_definition || '',
        manifesto: project.manifesto || project.research_manifesto || '',
        objective: project.objective || project.research_objective || '',
        questions: project.questions || project.research_questions || '',
        qa_definition: project.qa_definition || project.quality_assurance_definition || '',
        ec_rules: project.ec_rules || '[]',
        pool_c_qa_rules: project.pool_c_qa_rules || '[]',
        pool_c_extraction_rules: project.pool_c_extraction_rules || '[]',
        prompt_templates: promptTemplates,
        pool_a_count: poolMetrics.pool_a_count,
        pool_b_count: poolMetrics.pool_b_count,
        pool_c_count: poolMetrics.pool_c_count,
        pool_a_size: poolMetrics.pool_a_size,
        pool_b_size: poolMetrics.pool_b_size,
        pool_c_size: poolMetrics.pool_c_size,
        created_at: project.created_at || '',
        updated_at: project.updated_at || '',
      },
      prompt_templates: promptTemplates,
      scientific_rigor: {
        prisma: prismaData,
        stage_comparisons: stageComparisons,
        pool_metrics: poolMetrics,
        rolling_batch_qc: rollingBatchQC,
      },
      final_cohort: {
        papers: processedPapers,
        umbrellanizer_mappings: umbrellanizerMappings,
        total_count: processedPapers.length,
      },
      accounting: {
        summary: {
          total_cost_usd: totalCostUsd,
          total_tokens: totalTokens,
          total_calls: totalCalls,
          min_cost: overallStatsRow?.min_cost || null,
          avg_cost: overallStatsRow?.avg_cost || null,
          max_cost: overallStatsRow?.max_cost || null,
          min_tokens: overallStatsRow?.min_tokens || null,
          avg_tokens: overallStatsRow?.avg_tokens || null,
          max_tokens: overallStatsRow?.max_tokens || null,
        },
        pipeline_breakdown: pipelineBreakdown,
        top_expensive_calls: expensiveCalls,
      },
    };

    const sanitizedProjectName = (project.name || 'project')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${sanitizedProjectName}_slr_export_${dateStr}.slr-viewer`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting SLR Viewer dataset:', error);
    return NextResponse.json(
      { error: 'Failed to export SLR Viewer dataset', details: error.message },
      { status: 500 }
    );
  }
}
