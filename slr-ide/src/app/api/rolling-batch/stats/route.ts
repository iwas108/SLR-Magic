import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

interface QaRule {
  code: string;
}

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

// Helper to compute binomial CI
function computeCI(p_hat: number, n: number) {
  if (n <= 0) return { SE: 0, CI_lower: 0 };
  const SE = Math.sqrt((p_hat * (1 - p_hat)) / n);
  const CI_lower = Math.max(0, p_hat - (1.96 * SE));
  return { SE, CI_lower };
}

// Function to calculate cohort statistics
function calculateCohortStats(papers: any[], qaRules: QaRule[], extractionRules: any[], umbMap: Record<string, Record<string, any>>) {
  // Stage 3 Scientist variables
  let totalQAPairs = 0;
  let qaAgreementCount = 0;
  let qaCriticalMissCount = 0;

  // Stage 4 Miner variables
  let structurallyValidPapers = 0;
  let totalKeysEvaluated = 0;
  let semanticMatchesCount = 0;

  // Helper to normalize tokens
  const resolveToken = (val: string, key: string) => {
    if (val === undefined || val === null) return '';
    const raw = String(val).trim().toLowerCase().replace(/\s+/g, ' ');
    const map = umbMap[key] || {};
    
    // Case-insensitive key matching
    const matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === raw);
    if (!matchedKey) return raw; // Fallback to raw string if unmapped
    
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

  const criticalMissDetails: Array<{ paper_id: string; title: string; rule_code: string; aiScore: number; goldScore: number; diff: number }> = [];
  const schemaDiscrepancies: Array<{ paper_id: string; title: string; missing_key: string }> = [];

  for (const paper of papers) {
    try {
      const aiQaBody = JSON.parse(paper.ai_quality_assessment || '{}');
      const aiQa = aiQaBody.qa_scores || aiQaBody || {};
      const goldQaBody = JSON.parse(paper.manual_quality_assessment || '{}');
      const goldQa = goldQaBody.qa_scores || goldQaBody || {};

      for (const rule of qaRules) {
        const codeLower = rule.code.toLowerCase();
        const cleanCode = codeLower.replace(/[^a-z0-9]/g, '');
        
        const aiMatchKey = Object.keys(aiQa).find(k => {
          const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return kl === cleanCode || kl.startsWith(cleanCode);
        });
        const goldMatchKey = Object.keys(goldQa).find(k => {
          const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return kl === cleanCode || kl.startsWith(cleanCode);
        });

        const aiItem = aiMatchKey ? aiQa[aiMatchKey] : undefined;
        const aiVal = typeof aiItem === 'object' ? (aiItem?.score ?? aiItem?.value ?? aiItem?.val) : aiItem;

        const goldItem = goldMatchKey ? goldQa[goldMatchKey] : undefined;
        const goldVal = typeof goldItem === 'object' ? (goldItem?.score ?? goldItem?.value ?? goldItem?.val) : goldItem;

        if (aiVal !== undefined && goldVal !== undefined) {
          const aiScore = parseFloat(String(aiVal));
          const goldScore = parseFloat(String(goldVal));
          if (!isNaN(aiScore) && !isNaN(goldScore)) {
            const diff = Math.abs(aiScore - goldScore);
            totalQAPairs++;
            if (diff < 1.0) {
              qaAgreementCount++;
            }
            if (diff >= 1.0) {
              qaCriticalMissCount++;
              criticalMissDetails.push({
                paper_id: paper.Paper_ID,
                title: paper.Title || paper.Paper_ID,
                rule_code: rule.code,
                aiScore,
                goldScore,
                diff
              });
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error parsing Stage 3 assessments for paper ${paper.Paper_ID}:`, e);
    }

    // --- STAGE 4 (Miner) Evaluation ---
    let isStructurallyValid = true;
    let parsedAiMiner: any = null;
    let parsedGoldMiner: any = null;

    try {
      parsedAiMiner = JSON.parse(paper.ai_extracted_data || '{}');
    } catch (e) {
      isStructurallyValid = false;
    }

    try {
      parsedGoldMiner = JSON.parse(paper.manual_extracted_data || '{}');
    } catch (e) {}

    const targetRules = extractionRules.length > 0 
      ? extractionRules 
      : minerKeys.map(k => ({ json_key: k }));

    // Check structural schema integrity
    if (isStructurallyValid && parsedAiMiner) {
      const aiExt = parsedAiMiner.extracted_data || parsedAiMiner;
      for (const rule of targetRules) {
        const key = rule.json_key || rule.key || rule.code;
        const cleanKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchKey = Object.keys(aiExt).find(k => {
          const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return kl === cleanKey || kl.startsWith(cleanKey);
        });
        const field = matchKey ? aiExt[matchKey] : undefined;
        if (!field) {
          isStructurallyValid = false;
          schemaDiscrepancies.push({
            paper_id: paper.Paper_ID,
            title: paper.Title || paper.Paper_ID,
            missing_key: String(key)
          });
          break;
        }
      }
    } else {
      isStructurallyValid = false;
    }

    if (isStructurallyValid) {
      structurallyValidPapers++;
    }

    // Compare values for semantic agreement if human consensus is present
    if (parsedAiMiner && parsedGoldMiner) {
      const aiExt = parsedAiMiner.extracted_data || parsedAiMiner;
      const goldExt = parsedGoldMiner.extracted_data || parsedGoldMiner;

      for (const rule of targetRules) {
        const key = rule.json_key || rule.key || rule.code;
        const cleanKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

        const aiMatchKey = Object.keys(aiExt).find(k => {
          const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return kl === cleanKey || kl.startsWith(cleanKey);
        });
        const goldMatchKey = Object.keys(goldExt).find(k => {
          const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return kl === cleanKey || kl.startsWith(cleanKey);
        });

        const aiField = aiMatchKey ? aiExt[aiMatchKey] : undefined;
        const goldField = goldMatchKey ? goldExt[goldMatchKey] : undefined;

        const getFieldVal = (f: any) => {
          if (f === undefined || f === null) return undefined;
          if (typeof f === 'object') return f.value ?? f.val ?? f.text ?? f;
          return f;
        };

        const aiVal = getFieldVal(aiField);
        const goldVal = getFieldVal(goldField);

        if (aiVal !== undefined && goldVal !== undefined) {
          totalKeysEvaluated++;
          if (Array.isArray(aiVal) || Array.isArray(goldVal)) {
            const aiArr = resolveArray(aiVal, key);
            const goldArr = resolveArray(goldVal, key);
            if (aiArr.length === goldArr.length && aiArr.every((v, idx) => v === goldArr[idx])) {
              semanticMatchesCount++;
            }
          } else {
            const aiStr = resolveToken(String(aiVal), key);
            const goldStr = resolveToken(String(goldVal), key);
            if (aiStr === goldStr) {
              semanticMatchesCount++;
            }
          }
        }
      }
    }
  }

  // Calculate Stage 3 stats
  const p_hat_s3 = totalQAPairs > 0 ? qaAgreementCount / totalQAPairs : 0;
  const critical_miss_rate = totalQAPairs > 0 ? (qaCriticalMissCount / totalQAPairs) * 100 : 0;
  const s3CI = computeCI(p_hat_s3, totalQAPairs);

  // Calculate Stage 4 stats
  const schema_integrity_rate = papers.length > 0 ? structurallyValidPapers / papers.length : 0;
  const semantic_agreement = totalKeysEvaluated > 0 ? (semanticMatchesCount / totalKeysEvaluated) * 100 : 0;
  const s4CI = computeCI(schema_integrity_rate, papers.length);

  // Gating evaluation (ref: methodology.md §2.3.1 and agents.md §3.7)
  // Stage 3 passes only when BOTH conditions hold simultaneously:
  //   1. CI_lower >= 0.65  (QA ordinal agreement rate is statistically stable)
  //   2. critical_miss_rate === 0%  (zero full 1.0-point deviations in any QA dimension)
  const s3_passed = s3CI.CI_lower >= 0.65 && critical_miss_rate === 0;
  const s4_passed = s4CI.CI_lower >= 0.80 && schema_integrity_rate === 1.0;

  return {
    s3: {
      p_hat: p_hat_s3,
      SE: s3CI.SE,
      CI_lower: s3CI.CI_lower,
      critical_miss_rate,
      passed: s3_passed,
      criticalMissDetails
    },
    s4: {
      p_hat: schema_integrity_rate, // governed by Schema Integrity Rate
      SE: s4CI.SE,
      CI_lower: s4CI.CI_lower,
      schema_integrity_rate: schema_integrity_rate * 100,
      semantic_agreement,
      passed: s4_passed,
      schemaDiscrepancies
    }
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeProjectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    const project = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(activeProjectId, activeProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    let qaRules: QaRule[] = [];
    if (project.pool_c_qa_rules) {
      try {
        qaRules = typeof project.pool_c_qa_rules === 'string' 
          ? JSON.parse(project.pool_c_qa_rules) 
          : project.pool_c_qa_rules;
      } catch (e) {}
    }

    let extractionRules: any[] = [];
    if (project.pool_c_extraction_rules) {
      try {
        extractionRules = typeof project.pool_c_extraction_rules === 'string' 
          ? JSON.parse(project.pool_c_extraction_rules) 
          : project.pool_c_extraction_rules;
      } catch (e) {}
    }

    // Fetch Umbrellanizer lookup map
    const umbRows = db.prepare('SELECT extracted_data_key, umbrella_mapping FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))').all(activeProjectId, activeProjectId) as any[];
    const umbMap: Record<string, Record<string, string>> = {};
    for (const row of umbRows) {
      try {
        umbMap[row.extracted_data_key] = JSON.parse(row.umbrella_mapping || '{}');
      } catch (e) {
        umbMap[row.extracted_data_key] = {};
      }
    }

    // Get completed batches in sequential order
    const completedBatches = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND status = 'complete'
      ORDER BY batch_number ASC
    `).all(activeProjectId, activeProjectId) as any[];

    if (completedBatches.length === 0) {
      return NextResponse.json({
        success: true,
        cumulativeStats: null,
        individualBatchStats: [],
        auditPassed: false,
        completedBatchesCount: 0
      });
    }

    // Fetch papers belonging to all completed batches
    const completedBatchIds = completedBatches.map(b => b.id);
    const placeholders = completedBatchIds.map(() => '?').join(',');
    const allCompletedPapers = db.prepare(`
      SELECT * FROM rolling_batch_papers 
      WHERE batch_id IN (${placeholders}) AND Project_ID = ?
    `).all(...completedBatchIds, activeProjectId) as any[];

    // Calculate current cohort statistics
    const cumulativeStats = calculateCohortStats(allCompletedPapers, qaRules, extractionRules, umbMap);

    // Calculate individual stats for each completed batch
    const individualBatchStats = completedBatches.map(batch => {
      const batchPapers = db.prepare(`
        SELECT * FROM rolling_batch_papers 
        WHERE batch_id = ? AND Project_ID = ?
      `).all(batch.id, activeProjectId) as any[];
      
      const stats = calculateCohortStats(batchPapers, qaRules, extractionRules, umbMap);
      return {
        batchNumber: batch.batch_number,
        batchId: batch.id,
        finalizedAt: batch.finalized_at || batch.created_at,
        stats
      };
    });

    // Evaluate Sequential stopping rule (passed for 2 consecutive batches)
    let auditPassed = false;
    if (completedBatches.length >= 2) {
      // Calculate Cohort B (all completed batches)
      const currentCohortPassed = cumulativeStats.s3.passed && cumulativeStats.s4.passed;

      if (currentCohortPassed) {
        // Calculate Cohort B-1 (completed batches except the last one)
        const previousBatches = completedBatches.slice(0, -1);
        const previousBatchIds = previousBatches.map(b => b.id);
        const prevPlaceholders = previousBatchIds.map(() => '?').join(',');
        
        const previousPapers = db.prepare(`
          SELECT * FROM rolling_batch_papers 
          WHERE batch_id IN (${prevPlaceholders}) AND Project_ID = ?
        `).all(...previousBatchIds, activeProjectId) as any[];

        const previousStats = calculateCohortStats(previousPapers, qaRules, extractionRules, umbMap);
        const previousCohortPassed = previousStats.s3.passed && previousStats.s4.passed;

        if (previousCohortPassed) {
          auditPassed = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      cumulativeStats,
      individualBatchStats,
      auditPassed,
      completedBatchesCount: completedBatches.length
    });
  } catch (error: any) {
    console.error('Failed to compute rolling batch statistics:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
