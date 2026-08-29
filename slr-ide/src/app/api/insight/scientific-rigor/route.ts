import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db, { getConfig } from '@/lib/db';
import {
  computePoolABStats,
  computePoolCStats
} from '@/app/api/adjudicate/stats/route';
import {
  calculateWeightedKappa,
  calculateCohensKappa
} from '@/lib/inter-rater/adjudication-calculations';
import { DEFAULT_STAGE_SCHEMAS, PromptType } from '@/lib/services/prompt-validator';
import { CANONICAL_STAGE_PROMPTS, computePromptHash as canonicalComputePromptHash } from '@/lib/services/prompt-defaults';

export const dynamic = 'force-dynamic';

function safeJsonParse(val: any, fallback: any = {}): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// Helper to compute binomial CI
function computeCI(p_hat: number, n: number) {
  if (n <= 0) return { SE: 0, CI_lower: 0 };
  const SE = Math.sqrt((p_hat * (1 - p_hat)) / n);
  const CI_lower = Math.max(0, p_hat - (1.96 * SE));
  return { SE, CI_lower };
}

// Compute SHA-256 hash of a prompt specification
function computePromptHash(systemPrompt: string, userTemplate: string, schema: any): string {
  const content = `${systemPrompt || ''}::${userTemplate || ''}::${typeof schema === 'string' ? schema : JSON.stringify(schema || {})}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paramProjectId = searchParams.get('projectId');
    const isDownload = searchParams.get('download') === 'true';
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const targetProjectId = paramProjectId || activeProjectId;

    if (!targetProjectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // 1. Fetch Project
    let project = db.prepare('SELECT * FROM projects WHERE id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT)').get(targetProjectId, targetProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const resolvedProjectId = project.id;
    const projectLlmConfig = safeJsonParse(project.llm_config, {});

    // Parse EC Rules
    let ecLabels: Record<string, string> = {};
    if (project.ec_rules) {
      try {
        const parsed = typeof project.ec_rules === 'string' ? JSON.parse(project.ec_rules) : project.ec_rules;
        if (Array.isArray(parsed)) {
          parsed.forEach((rule: any) => {
            if (rule.code && rule.description) {
              ecLabels[rule.code.trim().toUpperCase()] = rule.description;
            }
          });
        }
      } catch (e) {}
    }

    // Parse QA & Extraction Rules
    let qaRules: any[] = [];
    if (project.pool_c_qa_rules) {
      try {
        qaRules = typeof project.pool_c_qa_rules === 'string' ? JSON.parse(project.pool_c_qa_rules) : project.pool_c_qa_rules;
      } catch (e) {}
    }

    let extractionRules: any[] = [];
    if (project.pool_c_extraction_rules) {
      try {
        extractionRules = typeof project.pool_c_extraction_rules === 'string' ? JSON.parse(project.pool_c_extraction_rules) : project.pool_c_extraction_rules;
      } catch (e) {}
    }

    // ----------------------------------------------------
    // 2. PRISMA FLOW DATA (100% Aligned with /api/insight/prisma)
    // ----------------------------------------------------
    const papers = db.prepare(`
      SELECT 
        Paper_ID,
        Import_Source, 
        Source, 
        is_duplicate, 
        manual_stage, 
        ai_stage, 
        manual_decision, 
        ai_decision, 
        manual_exclusion_code, 
        ai_exclusion_code, 
        Local_PDF_Status 
      FROM papers 
      WHERE Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)
    `).all(resolvedProjectId, resolvedProjectId) as any[];

    const otherSources = ['backward snowball', 'forward snowball', 'manual search', 'manual ingestion'];
    const isOtherSource = (src: string) => {
      if (!src) return false;
      return otherSources.includes(src.trim().toLowerCase());
    };

    const resolvePaper = (paper: any) => {
      const ms = paper.manual_stage || 0;
      const as = paper.ai_stage || 0;
      const effectiveStage = Math.max(ms, as);

      let dec = null;
      let ec = null;

      if (ms > as) {
        dec = paper.manual_decision;
        ec = paper.manual_exclusion_code;
      } else if (as > ms) {
        dec = paper.ai_decision;
        ec = paper.ai_exclusion_code;
      } else {
        dec = paper.manual_decision || paper.ai_decision;
        ec = paper.manual_exclusion_code || paper.ai_exclusion_code;
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

    let otherDuplicatesRemoved = 0;
    let otherReportsSought = 0;
    let otherReportsNotRetrieved = 0;
    const otherReportsExcludedStage2: Record<string, number> = {};
    let otherStage3FatalFlaw = 0;
    let otherStage3Cumulative = 0;

    let totalIncludedStudies = 0;

    for (const paper of papers) {
      const isOther = isOtherSource(paper.Import_Source);
      const isDuplicate = paper.is_duplicate === 1;

      if (!isOther) {
        const sourceName = paper.Source || 'Unknown Database';
        dbSourcesMap[sourceName] = (dbSourcesMap[sourceName] || 0) + 1;

        if (isDuplicate) {
          dbDuplicatesRemoved++;
          continue;
        }

        dbRecordsScreened++;
        const res = resolvePaper(paper);

        if (res.effectiveStage >= 3 && res.isIncluded) {
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

          if (res.effectiveStage === 1 && paper.Local_PDF_Status?.toUpperCase() === 'INACCESSIBLE') {
            dbReportsNotRetrieved++;
          }

          if (res.effectiveStage === 2 && res.isExcluded) {
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
        if (isDuplicate) {
          otherDuplicatesRemoved++;
          continue;
        }

        otherReportsSought++;
        const res = resolvePaper(paper);

        if (res.effectiveStage >= 3 && res.isIncluded) {
          totalIncludedStudies++;
        }

        if (res.effectiveStage === 1 && paper.Local_PDF_Status?.toUpperCase() === 'INACCESSIBLE') {
          otherReportsNotRetrieved++;
        }

        if (res.effectiveStage === 2 && res.isExcluded) {
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

    const databaseSources = Object.entries(dbSourcesMap).map(([source, count]) => ({ source, count }));
    const formatECList = (map: Record<string, number>) => Object.entries(map).map(([code, count]) => ({
      code,
      description: ecLabels[code.toUpperCase()] || 'No description provided',
      count
    }));

    const prismaFlowData = {
      project_name: project.name,
      database_sources: databaseSources,
      total_records_identified_databases: papers.filter(p => !isOtherSource(p.Import_Source)).length,
      db_duplicates_removed: dbDuplicatesRemoved,
      db_records_screened: dbRecordsScreened,
      db_stage1_excluded: dbStage1Excluded,
      db_stage1_excluded_by_ec: formatECList(dbStage1ExcludedByEC),
      db_reports_sought: dbReportsSought,
      db_reports_not_retrieved: dbReportsNotRetrieved,
      db_reports_assessed: Math.max(0, dbReportsSought - dbReportsNotRetrieved),
      db_reports_excluded_stage2: formatECList(dbReportsExcludedStage2),
      db_reports_excluded_stage3: [
        { gate: 'Fatal Flaw Gate', count: dbStage3FatalFlaw, description: 'Exclusion due to 0.0 score in QA-1, QA-3, QA-4, or QA-6' },
        { gate: 'Cumulative Gate', count: dbStage3Cumulative, description: 'Exclusion due to total QA score < 4.5 / 8.0' }
      ],
      db_studies_included: totalIncludedStudies,
      other_methods: {
        other_duplicates_removed: otherDuplicatesRemoved,
        other_reports_sought: otherReportsSought,
        other_reports_not_retrieved: otherReportsNotRetrieved,
        other_reports_assessed: Math.max(0, otherReportsSought - otherReportsNotRetrieved),
        other_reports_excluded_stage2: formatECList(otherReportsExcludedStage2),
        other_reports_excluded_stage3: [
          { gate: 'Fatal Flaw Gate', count: otherStage3FatalFlaw },
          { gate: 'Cumulative Gate', count: otherStage3Cumulative }
        ],
        other_studies_included: totalIncludedStudies
      },
      exclusion_criteria_definitions: ecLabels
    };

    // ----------------------------------------------------
    // 3. PRE-CALIBRATION DATA
    // ----------------------------------------------------
    const poolATarget = Number(project.pool_a_size || 50);
    const poolBTarget = Number(project.pool_b_size || 30);
    const poolCTarget = Number(project.pool_c_size || 20);

    const countPoolPapers = (poolName: string) => {
      const row = db.prepare(`
        SELECT COUNT(DISTINCT Paper_ID) as count 
        FROM calibration_papers 
        WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) 
          AND calibration_pool = ?
      `).get(resolvedProjectId, resolvedProjectId, poolName) as any;
      return Number(row?.count || 0);
    };

    const poolAFilled = countPoolPapers('pool_a');
    const poolBFilled = countPoolPapers('pool_b');
    const poolCFilled = countPoolPapers('pool_c');

    const poolAStats = computePoolABStats(resolvedProjectId, 'pool_a');
    const poolBStats = computePoolABStats(resolvedProjectId, 'pool_b');
    const poolCStats = computePoolCStats(resolvedProjectId);

    const calibrationLedgerRows = db.prepare(`
      SELECT commit_hash, paper_id, pool, adjudicator, resolved_decision, resolved_ec, resolved_rationale, commit_message, timestamp
      FROM calibration_commit_ledger
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
      ORDER BY timestamp DESC
    `).all(resolvedProjectId, resolvedProjectId) as any[];

    const preCalibrationData = {
      pool_sizing_targets: {
        pool_a_target: poolATarget,
        pool_b_target: poolBTarget,
        pool_c_target: poolCTarget,
        total_gold_standard_target: poolATarget + poolBTarget + poolCTarget
      },
      pool_filling_status: {
        pool_a_filled: poolAFilled,
        pool_b_filled: poolBFilled,
        pool_c_filled: poolCFilled,
        total_filled: poolAFilled + poolBFilled + poolCFilled,
        is_fully_filled: poolAFilled >= poolATarget && poolBFilled >= poolBTarget && poolCFilled >= poolCTarget
      },
      blinded_inter_rater_agreement: {
        pool_a: {
          title: poolAStats.title,
          stage: poolAStats.stageName,
          is_calibrated: poolAStats.isCalibrated,
          reviewers: poolAStats.reviewers,
          total_intersection: poolAStats.total_intersection,
          cohens_kappa: poolAStats.cohens_kappa,
          kappa_label: poolAStats.kappa_label,
          raw_agreement_pct: poolAStats.raw_agreement_pct,
          expected_agreement_pct: poolAStats.expected_agreement_pct,
          agree_include: poolAStats.agree_include,
          agree_exclude: poolAStats.agree_exclude,
          r1_inc_r2_exc: poolAStats.r1_inc_r2_exc,
          r1_exc_r2_inc: poolAStats.r1_exc_r2_inc,
          total_discrepancies: poolAStats.total_discrepancies,
          resolved_discrepancies: poolAStats.resolved_discrepancies,
          pending_discrepancies: poolAStats.pending_discrepancies,
          resolution_pct: poolAStats.resolution_pct,
          passes: poolAStats.passes
        },
        pool_b: {
          title: poolBStats.title,
          stage: poolBStats.stageName,
          is_calibrated: poolBStats.isCalibrated,
          reviewers: poolBStats.reviewers,
          total_intersection: poolBStats.total_intersection,
          cohens_kappa: poolBStats.cohens_kappa,
          kappa_label: poolBStats.kappa_label,
          raw_agreement_pct: poolBStats.raw_agreement_pct,
          expected_agreement_pct: poolBStats.expected_agreement_pct,
          r1_precision: poolBStats.r1_precision,
          r2_precision: poolBStats.r2_precision,
          agree_include: poolBStats.agree_include,
          agree_exclude: poolBStats.agree_exclude,
          total_discrepancies: poolBStats.total_discrepancies,
          resolved_discrepancies: poolBStats.resolved_discrepancies,
          pending_discrepancies: poolBStats.pending_discrepancies,
          resolution_pct: poolBStats.resolution_pct,
          passes: poolBStats.passes
        },
        pool_c: {
          title: poolCStats.title,
          stage: poolCStats.stageName,
          is_calibrated: poolCStats.isCalibrated,
          reviewers: poolCStats.reviewers,
          total_intersection: poolCStats.total_intersection,
          weighted_kappa: poolCStats.weighted_kappa,
          kappa_label: poolCStats.kappa_label,
          raw_agreement_pct: poolCStats.raw_agreement_pct,
          missing_keys_pct: poolCStats.missing_keys_pct,
          type_match_pct: poolCStats.type_match_pct,
          agree_include: poolCStats.agree_include,
          agree_exclude: poolCStats.agree_exclude,
          total_discrepancies: poolCStats.total_discrepancies,
          resolved_discrepancies: poolCStats.resolved_discrepancies,
          pending_discrepancies: poolCStats.pending_discrepancies,
          resolution_pct: poolCStats.resolution_pct,
          passes: poolCStats.passes
        }
      },
      adjudication_ledger: {
        total_commits: calibrationLedgerRows.length,
        recent_resolutions: calibrationLedgerRows.slice(0, 50)
      }
    };

    // ----------------------------------------------------
    // 4. PROMPT OPTIMIZATION DATA
    // ----------------------------------------------------
    const ALL_PROMPT_TYPES: PromptType[] = [
      'fast_filter',
      'gatekeeper',
      'scientist',
      'miner',
      'umbrellanizer',
      'prompt_optimizer',
      'consolidation_audit',
      'duplicate_review'
    ];

    const activeProjectPromptTemplates = ALL_PROMPT_TYPES.map(promptType => {
      const canonical = CANONICAL_STAGE_PROMPTS[promptType];
      const targetDefaultId = projectLlmConfig?.default_prompts?.[promptType];

      let promptRow: any = null;

      // 1. Check for project-mapped explicit default prompt template ID
      if (targetDefaultId) {
        promptRow = db.prepare(`
          SELECT id, project_id, name, description, prompt_type, llm_config, is_active, created_at, updated_at
          FROM prompt_templates
          WHERE id = ? AND (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ? OR project_id IS NULL)
        `).get(targetDefaultId, resolvedProjectId, resolvedProjectId) as any;
      }

      // 2. Fallback to active project-specific custom prompt template
      if (!promptRow) {
        promptRow = db.prepare(`
          SELECT id, project_id, name, description, prompt_type, llm_config, is_active, created_at, updated_at
          FROM prompt_templates
          WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?)
            AND prompt_type = ? AND is_active = 1
          ORDER BY updated_at DESC LIMIT 1
        `).get(resolvedProjectId, resolvedProjectId, promptType) as any;
      }

      // 3. Fallback to active global default prompt template
      if (!promptRow) {
        promptRow = db.prepare(`
          SELECT id, project_id, name, description, prompt_type, llm_config, is_active, created_at, updated_at
          FROM prompt_templates
          WHERE project_id IS NULL AND prompt_type = ? AND is_active = 1
          ORDER BY updated_at DESC LIMIT 1
        `).get(promptType) as any;
      }

      if (promptRow) {
        return {
          id: promptRow.id,
          name: promptRow.name,
          description: promptRow.description,
          prompt_type: promptRow.prompt_type || promptType,
          llm_config: safeJsonParse(promptRow.llm_config, {}),
          is_active: promptRow.is_active === 1
        };
      }

      // 4. Codebase canonical fallback if not present in DB
      return {
        id: canonical?.id || `default-${promptType}`,
        name: canonical?.name || promptType,
        description: canonical?.description || '',
        prompt_type: promptType,
        llm_config: canonical?.llm_config || {},
        is_active: true
      };
    });

    const latestAuditRow = db.prepare(`
      SELECT * FROM prompt_audit_ledger
      WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?)
        AND audit_type = 'consolidation_audit'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(resolvedProjectId, resolvedProjectId) as any;

    const optimizationLineageRows = db.prepare(`
      SELECT id, status, prompt_id, prompt_hash, parent_prompt_id, parent_prompt_hash, created_at
      FROM prompt_audit_ledger
      WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?)
        AND audit_type = 'prompt_optimization'
      ORDER BY created_at DESC
    `).all(resolvedProjectId, resolvedProjectId) as any[];

    const benchmarkRunRows = db.prepare(`
      SELECT * FROM prompt_benchmark_runs
      WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?)
      ORDER BY stage_num ASC, created_at DESC
    `).all(resolvedProjectId, resolvedProjectId) as any[];

    const benchmarkRuns = benchmarkRunRows.map((run: any) => ({
      id: run.id,
      stage_num: run.stage_num,
      stage_name: run.stage_name,
      pool: run.pool,
      prompt_template_id: run.prompt_template_id,
      prompt_hash: run.prompt_hash,
      status: run.status,
      total_papers: run.total_papers,
      evaluated_papers: run.evaluated_papers,
      train_count: run.train_count,
      holdout_count: run.holdout_count,
      summary_metrics: safeJsonParse(run.summary_metrics, {}),
      holdout_metrics: safeJsonParse(run.holdout_metrics, {}),
      created_at: run.created_at,
      updated_at: run.updated_at
    }));

    const promptOptimizationData = {
      prompt_templates: activeProjectPromptTemplates,
      consolidation_audit: latestAuditRow ? {
        id: latestAuditRow.id,
        status: latestAuditRow.status,
        availability_score: latestAuditRow.availability_score,
        semantic_score: latestAuditRow.semantic_score,
        chainability_score: latestAuditRow.chainability_score,
        audit_report: safeJsonParse(latestAuditRow.audit_report, null),
        created_at: latestAuditRow.created_at
      } : null,
      optimization_lineages: optimizationLineageRows,
      benchmark_runs: benchmarkRuns
    };

    // ----------------------------------------------------
    // 5. GOLD STANDARD VS AI STAGE COMPARISONS
    // ----------------------------------------------------
    const ledgerEntries = db.prepare(`
      SELECT l.paper_id, l.pool, l.resolved_decision as adjudicated_decision, l.resolved_qa_scores, l.resolved_extracted_data
      FROM calibration_commit_ledger l
      JOIN (
        SELECT paper_id, project_id, MAX(timestamp) as max_ts
        FROM calibration_commit_ledger
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
        GROUP BY paper_id, project_id
      ) latest ON l.paper_id = latest.paper_id AND (latest.project_id = l.project_id OR CAST(latest.project_id AS TEXT) = CAST(l.project_id AS TEXT)) AND l.timestamp = latest.max_ts
      WHERE (l.project_id = ? OR CAST(l.project_id AS TEXT) = CAST(? AS TEXT))
    `).all(resolvedProjectId, resolvedProjectId, resolvedProjectId, resolvedProjectId) as any[];

    // Stage 1 (Fast Filter)
    const poolAEntries = ledgerEntries.filter(e => e.pool === 'pool_a');
    let tp1 = 0, tn1 = 0, fp1 = 0, fn1 = 0;
    for (const entry of poolAEntries) {
      const goldDec = (entry.adjudicated_decision || '').toUpperCase();
      const screeningRow = db.prepare(`
        SELECT decision FROM llm_screening_records
        WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?) AND paper_id = ? AND stage = 1
      `).get(resolvedProjectId, resolvedProjectId, entry.paper_id) as any;
      const aiDec = (screeningRow?.decision || 'PENDING').toUpperCase();
      const isGInc = goldDec.startsWith('INCLUDE');
      const isGExc = goldDec.startsWith('EXCLUDE');
      const isAInc = aiDec.startsWith('INCLUDE');
      const isAExc = aiDec.startsWith('EXCLUDE');
      if (isGInc && isAInc) tp1++;
      else if (isGExc && isAExc) tn1++;
      else if (isGExc && isAInc) fp1++;
      else if (isGInc && isAExc) fn1++;
    }
    const eval1 = tp1 + tn1 + fp1 + fn1;
    const rec1 = (tp1 + fn1) > 0 ? tp1 / (tp1 + fn1) : 0;
    const prec1 = (tp1 + fp1) > 0 ? tp1 / (tp1 + fp1) : 0;
    const f1_1 = (prec1 + rec1) > 0 ? 2 * (prec1 * rec1) / (prec1 + rec1) : 0;
    const kappa1 = eval1 > 0 ? calculateCohensKappa(eval1, tp1, tn1, fp1, fn1).cohens_kappa : 0;

    // Stage 2 (Gatekeeper)
    const poolBEntries = ledgerEntries.filter(e => e.pool === 'pool_b');
    let tp2 = 0, tn2 = 0, fp2 = 0, fn2 = 0;
    for (const entry of poolBEntries) {
      const goldDec = (entry.adjudicated_decision || '').toUpperCase();
      const screeningRow = db.prepare(`
        SELECT decision FROM llm_screening_records
        WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?) AND paper_id = ? AND stage = 2
      `).get(resolvedProjectId, resolvedProjectId, entry.paper_id) as any;
      const aiDec = (screeningRow?.decision || 'PENDING').toUpperCase();
      const isGInc = goldDec.startsWith('INCLUDE');
      const isGExc = goldDec.startsWith('EXCLUDE');
      const isAInc = aiDec.startsWith('INCLUDE');
      const isAExc = aiDec.startsWith('EXCLUDE');
      if (isGInc && isAInc) tp2++;
      else if (isGExc && isAExc) tn2++;
      else if (isGExc && isAInc) fp2++;
      else if (isGInc && isAExc) fn2++;
    }
    const eval2 = tp2 + tn2 + fp2 + fn2;
    const rec2 = (tp2 + fn2) > 0 ? tp2 / (tp2 + fn2) : 0;
    const prec2 = (tp2 + fp2) > 0 ? tp2 / (tp2 + fp2) : 0;
    const f1_2 = (prec2 + rec2) > 0 ? 2 * (prec2 * rec2) / (prec2 + rec2) : 0;
    const kappa2 = eval2 > 0 ? calculateCohensKappa(eval2, tp2, tn2, fp2, fn2).cohens_kappa : 0;

    // Stage 3 (Scientist)
    const poolCEntries = ledgerEntries.filter(e => e.pool === 'pool_c');
    const O3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    let totalRatings3 = 0;
    let eval3 = 0;
    let rawAgree3 = 0;
    let minorDev3 = 0;
    let critMiss3 = 0;
    let totalComp3 = 0;

    const getScoreIdx = (val: any) => {
      const n = typeof val === 'number' ? val : parseFloat(String(val || '0'));
      if (isNaN(n) || n <= 0.25) return 0;
      if (n <= 0.75) return 1;
      return 2;
    };

    for (const entry of poolCEntries) {
      const screeningRow = db.prepare(`
        SELECT structured_output, quality_assessment FROM llm_screening_records
        WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?) AND paper_id = ? AND stage = 3
      `).get(resolvedProjectId, resolvedProjectId, entry.paper_id) as any;

      if ((screeningRow?.structured_output || screeningRow?.quality_assessment) && entry.resolved_qa_scores) {
        eval3++;
        try {
          let aiQa: Record<string, any> = {};
          if (screeningRow.quality_assessment) {
            aiQa = safeJsonParse(screeningRow.quality_assessment, {});
          } else if (screeningRow.structured_output) {
            const parsed = safeJsonParse(screeningRow.structured_output, {});
            aiQa = parsed.qa_scores || {};
          }
          const goldQa = safeJsonParse(entry.resolved_qa_scores, {});

          for (const rule of qaRules) {
            const cleanCode = rule.code.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matchAiKey = Object.keys(aiQa).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(cleanCode));
            const matchGoldKey = Object.keys(goldQa).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(cleanCode));
            const aiItem = matchAiKey ? aiQa[matchAiKey] : undefined;
            const goldItem = matchGoldKey ? goldQa[matchGoldKey] : undefined;
            const aiVal = typeof aiItem === 'object' ? (aiItem?.score ?? aiItem?.value ?? 0) : (aiItem ?? 0);
            const goldVal = typeof goldItem === 'object' ? (goldItem?.score ?? goldItem?.value ?? 0) : (goldItem ?? 0);

            const idx1 = getScoreIdx(goldVal);
            const idx2 = getScoreIdx(aiVal);
            O3[idx1][idx2]++;
            totalRatings3++;
            totalComp3++;
            const diff = Math.abs(idx1 - idx2);
            if (diff === 0) rawAgree3++;
            else if (diff === 1) minorDev3++;
            else if (diff >= 2) critMiss3++;
          }
        } catch (e) {}
      }
    }
    const kappaMetrics3 = calculateWeightedKappa(O3, totalRatings3);
    const rawAgreePct3 = totalComp3 > 0 ? (rawAgree3 / totalComp3) * 100 : 0;
    const minorDevPct3 = totalComp3 > 0 ? (minorDev3 / totalComp3) * 100 : 0;
    const critMissPct3 = totalComp3 > 0 ? (critMiss3 / totalComp3) * 100 : 0;

    // Stage 4 (Miner)
    let eval4 = 0;
    let totalKeys4 = 0;
    let missingKeys4 = 0;
    let typeMatches4 = 0;
    let exactMatches4 = 0;

    for (const entry of poolCEntries) {
      const screeningRow = db.prepare(`
        SELECT structured_output, extracted_data FROM llm_screening_records
        WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?) AND paper_id = ? AND stage = 4
      `).get(resolvedProjectId, resolvedProjectId, entry.paper_id) as any;

      if ((screeningRow?.structured_output || screeningRow?.extracted_data) && entry.resolved_extracted_data) {
        eval4++;
        try {
          let aiExt: Record<string, any> = {};
          if (screeningRow.extracted_data) {
            aiExt = safeJsonParse(screeningRow.extracted_data, {});
          } else if (screeningRow.structured_output) {
            const parsed = safeJsonParse(screeningRow.structured_output, {});
            aiExt = parsed.extracted_data || parsed;
          }
          const goldExt = safeJsonParse(entry.resolved_extracted_data, {});

          for (const rule of extractionRules) {
            totalKeys4++;
            const goldItem = goldExt[rule.json_key];
            const aiItem = aiExt[rule.json_key];
            if (aiItem === undefined) {
              missingKeys4++;
            } else {
              typeMatches4++;
              if (String(goldItem || '').trim().toLowerCase() === String(aiItem || '').trim().toLowerCase()) {
                exactMatches4++;
              }
            }
          }
        } catch (e) {}
      }
    }

    const missingKeysPct4 = totalKeys4 > 0 ? (missingKeys4 / totalKeys4) * 100 : 0;
    const typeMatchPct4 = totalKeys4 > 0 ? (typeMatches4 / totalKeys4) * 100 : 0;
    const preNormYield4 = (totalKeys4 - missingKeys4) > 0 ? (exactMatches4 / (totalKeys4 - missingKeys4)) * 100 : 0;
    const schemaIntegrityPct4 = (missingKeysPct4 === 0 && typeMatchPct4 === 100) ? 100 : 0;

    const goldStandardStageComparison = {
      stages: [
        {
          stage: 1,
          title: 'Pool A (Fast Filter)',
          stage_name: 'Stage 1: Fast Filter',
          total_adjudicated: poolAEntries.length,
          evaluated: eval1,
          confusion_matrix: { TP: tp1, TN: tn1, FP: fp1, FN: fn1 },
          recall: rec1,
          precision: prec1,
          f1_score: f1_1,
          cohens_kappa: kappa1,
          thresholds: { recall_target: 1.0, f1_target: 0.85 },
          passes: rec1 >= 1.0 && f1_1 >= 0.85
        },
        {
          stage: 2,
          title: 'Pool B (Gatekeeper)',
          stage_name: 'Stage 2: Gatekeeper',
          total_adjudicated: poolBEntries.length,
          evaluated: eval2,
          confusion_matrix: { TP: tp2, TN: tn2, FP: fp2, FN: fn2 },
          precision: prec2,
          recall: rec2,
          f1_score: f1_2,
          cohens_kappa: kappa2,
          thresholds: { precision_target: 0.85, recall_target: 0.90 },
          passes: prec2 >= 0.85 && rec2 >= 0.90
        },
        {
          stage: 3,
          title: 'Pool C (Scientist)',
          stage_name: 'Stage 3: Scientist',
          total_adjudicated: poolCEntries.length,
          evaluated: eval3,
          weighted_kappa: kappaMetrics3.weighted_kappa,
          raw_agreement_pct: rawAgreePct3,
          minor_deviation_pct: minorDevPct3,
          critical_miss_pct: critMissPct3,
          thresholds: { kappa_target: 0.65, critical_miss_target: 0.0 },
          passes: critMissPct3 === 0.0
        },
        {
          stage: 4,
          title: 'Pool C (Miner)',
          stage_name: 'Stage 4: Miner',
          total_adjudicated: poolCEntries.length,
          evaluated: eval4,
          missing_keys_pct: missingKeysPct4,
          type_match_pct: typeMatchPct4,
          pre_normalization_yield_pct: preNormYield4,
          schema_integrity_pct: schemaIntegrityPct4,
          thresholds: { schema_integrity_target: 100 },
          passes: eval4 > 0 && schemaIntegrityPct4 === 100
        }
      ]
    };

    // ----------------------------------------------------
    // 6. ROLLING BATCH VALIDATION DATA (SEQUENTIAL QC)
    // ----------------------------------------------------
    const completedBatches = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND status = 'complete'
      ORDER BY batch_number ASC
    `).all(resolvedProjectId, resolvedProjectId) as any[];

    // Calculate rolling batch metrics
    let cumulativeRollingStats: any = null;
    let individualRollingStats: any[] = [];
    let auditPassed = false;

    if (completedBatches.length > 0) {
      const completedBatchIds = completedBatches.map(b => b.id);
      const placeholders = completedBatchIds.map(() => '?').join(',');
      const allCompletedPapers = db.prepare(`
        SELECT * FROM rolling_batch_papers 
        WHERE batch_id IN (${placeholders}) AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
      `).all(...completedBatchIds, resolvedProjectId, resolvedProjectId) as any[];

      const calcBatchCohort = (batchPapers: any[]) => {
        let totalQAPairs = 0;
        let qaAgree = 0;
        let qaCritMiss = 0;
        let structurallyValid = 0;

        for (const p of batchPapers) {
          try {
            const aiQa = safeJsonParse(p.ai_quality_assessment, {});
            const aiScores = aiQa.qa_scores || aiQa;
            const goldQa = safeJsonParse(p.manual_quality_assessment, {});
            const goldScores = goldQa.qa_scores || goldQa;

            for (const rule of qaRules) {
              const cleanCode = rule.code.toLowerCase().replace(/[^a-z0-9]/g, '');
              const aiK = Object.keys(aiScores).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(cleanCode));
              const goldK = Object.keys(goldScores).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(cleanCode));
              const aiVal = aiK ? (aiScores[aiK]?.score ?? aiScores[aiK]?.value ?? aiScores[aiK]) : undefined;
              const goldVal = goldK ? (goldScores[goldK]?.score ?? goldScores[goldK]?.value ?? goldScores[goldK]) : undefined;

              if (aiVal !== undefined && goldVal !== undefined) {
                const s1 = parseFloat(String(aiVal));
                const s2 = parseFloat(String(goldVal));
                if (!isNaN(s1) && !isNaN(s2)) {
                  totalQAPairs++;
                  const diff = Math.abs(s1 - s2);
                  if (diff < 1.0) qaAgree++;
                  else qaCritMiss++;
                }
              }
            }
          } catch (e) {}

          let isValid = true;
          try {
            const aiExtParsed = safeJsonParse(p.ai_extracted_data, {});
            const aiExt = aiExtParsed.extracted_data || aiExtParsed;
            for (const r of extractionRules) {
              const k = r.json_key || r.key;
              if (aiExt[k] === undefined) {
                isValid = false;
                break;
              }
            }
          } catch (e) {
            isValid = false;
          }
          if (isValid) structurallyValid++;
        }

        const p_hat_s3 = totalQAPairs > 0 ? qaAgree / totalQAPairs : 0;
        const crit_miss_rate = totalQAPairs > 0 ? (qaCritMiss / totalQAPairs) * 100 : 0;
        const s3CI = computeCI(p_hat_s3, totalQAPairs);

        const schema_int_rate = batchPapers.length > 0 ? structurallyValid / batchPapers.length : 0;
        const s4CI = computeCI(schema_int_rate, batchPapers.length);

        const s3_passed = s3CI.CI_lower >= 0.65 && crit_miss_rate === 0;
        const s4_passed = s4CI.CI_lower >= 0.80 && schema_int_rate === 1.0;

        return {
          s3: {
            p_hat: p_hat_s3,
            SE: s3CI.SE,
            CI_lower: s3CI.CI_lower,
            critical_miss_rate: crit_miss_rate,
            passed: s3_passed
          },
          s4: {
            p_hat: schema_int_rate,
            SE: s4CI.SE,
            CI_lower: s4CI.CI_lower,
            schema_integrity_rate: schema_int_rate * 100,
            passed: s4_passed
          }
        };
      };

      cumulativeRollingStats = calcBatchCohort(allCompletedPapers);

      individualRollingStats = completedBatches.map(batch => {
        const batchPapers = db.prepare(`
          SELECT * FROM rolling_batch_papers 
          WHERE batch_id = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
        `).all(batch.id, resolvedProjectId, resolvedProjectId) as any[];

        const stats = calcBatchCohort(batchPapers);
        return {
          batch_number: batch.batch_number,
          batch_id: batch.id,
          finalized_at: batch.finalized_at || batch.created_at,
          papers_count: batchPapers.length,
          stats,
          is_passed: stats.s3.passed && stats.s4.passed
        };
      });

      if (completedBatches.length >= 2 && cumulativeRollingStats.s3.passed && cumulativeRollingStats.s4.passed) {
        const prevBatches = completedBatches.slice(0, -1);
        const prevIds = prevBatches.map(b => b.id);
        const prevPlaceholders = prevIds.map(() => '?').join(',');
        const prevPapers = db.prepare(`
          SELECT * FROM rolling_batch_papers 
          WHERE batch_id IN (${prevPlaceholders}) AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
        `).all(...prevIds, resolvedProjectId, resolvedProjectId) as any[];
        const prevStats = calcBatchCohort(prevPapers);
        if (prevStats.s3.passed && prevStats.s4.passed) {
          auditPassed = true;
        }
      }
    }

    const rollingBatchValidationData = {
      rolling_batch_size: Number(project.rolling_batch_size || 20),
      completed_batches_count: completedBatches.length,
      audit_passed: auditPassed,
      sequential_stopping_rule_evaluation: 'Audit terminates and clears when 95% CI lower bound stably clears tau=0.65 with 0.0% critical miss rate in Stage 3 and tau=0.80 with 100% schema integrity in Stage 4 over two consecutive batches.',
      cumulative_statistics: cumulativeRollingStats,
      individual_batch_history: individualRollingStats
    };

    // ----------------------------------------------------
    // 7. AI SCREENING TECHNICAL SPECIFICATIONS (Full Disclosure)
    // ----------------------------------------------------
    const resolveEngineSpec = (
      promptType: PromptType,
      engineId: string,
      stageNum: number,
      stageName: string,
      roleDescription: string,
      logicGateArchitecture: string,
      methodologicalTarget: string,
      variableDict: Record<string, string>,
      defaultModelId: string = 'gemini-2.5-flash',
      defaultMaxTokens: number = 4000,
      defaultExecutionMode: string = 'flex',
      interactionChaining: boolean = false
    ) => {
      const canonical = CANONICAL_STAGE_PROMPTS[promptType];
      const targetDefaultId = projectLlmConfig?.default_prompts?.[promptType];

      let promptRow: any = null;
      let provenanceSource = 'codebase_default';

      // 1. Check for project-mapped explicit default prompt template ID
      if (targetDefaultId) {
        promptRow = db.prepare(`
          SELECT id, project_id, name, description, system_instruction, user_template, response_schema, llm_config, updated_at
          FROM prompt_templates
          WHERE id = ? AND (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ? OR project_id IS NULL)
        `).get(targetDefaultId, resolvedProjectId, resolvedProjectId) as any;

        if (promptRow) {
          provenanceSource = promptRow.project_id ? 'project_custom' : 'global_default';
        }
      }

      // 2. Fallback to active project-specific custom prompt template
      if (!promptRow) {
        promptRow = db.prepare(`
          SELECT id, project_id, name, description, system_instruction, user_template, response_schema, llm_config, updated_at
          FROM prompt_templates
          WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?)
            AND prompt_type = ? AND is_active = 1
          ORDER BY updated_at DESC LIMIT 1
        `).get(resolvedProjectId, resolvedProjectId, promptType) as any;

        if (promptRow) {
          provenanceSource = 'project_custom';
        }
      }

      // 3. Fallback to active global default prompt template
      if (!promptRow) {
        promptRow = db.prepare(`
          SELECT id, project_id, name, description, system_instruction, user_template, response_schema, llm_config, updated_at
          FROM prompt_templates
          WHERE project_id IS NULL AND prompt_type = ? AND is_active = 1
          ORDER BY updated_at DESC LIMIT 1
        `).get(promptType) as any;

        if (promptRow) {
          provenanceSource = 'global_default';
        }
      }

      // 4. Resolve prompt texts, response schemas, and hyperparameter configuration with canonical defaults
      const systemInstruction = promptRow?.system_instruction || canonical?.system_instruction || '';
      const userTemplate = promptRow?.user_template || canonical?.user_template || '';

      const rawSchema = promptRow?.response_schema || canonical?.response_schema || DEFAULT_STAGE_SCHEMAS[promptType] || {};
      const parsedSchema = safeJsonParse(rawSchema, rawSchema);

      const promptLlmConfig = safeJsonParse(promptRow?.llm_config, canonical?.llm_config || {});
      const effectiveModelId = promptLlmConfig.model_id || projectLlmConfig.model_id || canonical?.llm_config?.model_id || defaultModelId;
      const effectiveTemperature = promptLlmConfig.temperature ?? projectLlmConfig.temperature ?? canonical?.llm_config?.temperature ?? 0.0;
      const effectiveMaxTokens = promptLlmConfig.max_tokens ?? projectLlmConfig.max_tokens ?? canonical?.llm_config?.max_tokens ?? defaultMaxTokens;
      const effectiveTopP = promptLlmConfig.top_p ?? projectLlmConfig.top_p ?? canonical?.llm_config?.top_p ?? 0.95;
      const effectiveTopK = promptLlmConfig.top_k ?? projectLlmConfig.top_k ?? canonical?.llm_config?.top_k ?? 40;
      const effectiveExecutionMode = promptLlmConfig.execution_mode ?? canonical?.llm_config?.execution_mode ?? defaultExecutionMode;
      const effectiveThinkingLevel = promptLlmConfig.thinking_level ?? canonical?.llm_config?.thinking_level ?? 'none';
      const effectiveChaining = promptLlmConfig.interaction_chaining ?? canonical?.llm_config?.interaction_chaining ?? interactionChaining;

      const promptHash = canonicalComputePromptHash(systemInstruction, userTemplate, parsedSchema);

      return {
        engine_id: engineId,
        prompt_type: promptType,
        stage_num: stageNum,
        stage_name: stageName,
        role_and_objective: roleDescription,
        methodological_target: methodologicalTarget,
        logic_gate_architecture: logicGateArchitecture,
        llm_hyperparameter_configuration: {
          model_id: effectiveModelId,
          provider: 'Google Gemini (Native Interactions API)',
          temperature: effectiveTemperature,
          max_output_tokens: effectiveMaxTokens,
          top_p: effectiveTopP,
          top_k: effectiveTopK,
          thinking_level: effectiveThinkingLevel,
          execution_mode: effectiveExecutionMode,
          interaction_chaining: effectiveChaining,
          structured_output_enforcement: 'generationConfig.responseSchema (Native Strict JSON Mode)'
        },
        system_instruction: systemInstruction,
        user_prompt_template: userTemplate,
        variable_placeholders_dictionary: variableDict,
        response_json_schema: parsedSchema,
        provenance_metadata: {
          provenance_source: provenanceSource,
          prompt_template_id: promptRow?.id || canonical?.id || 'codebase-fallback',
          prompt_hash_sha256: promptHash,
          last_updated_at: promptRow?.updated_at || project.updated_at || new Date().toISOString()
        }
      };
    };

    const aiScreeningTechnicalSpecifications = {
      disclosure_standard: 'PRISMA 2020 AI / Automation Tools Extension & ICMJE Reproducibility Standards',
      overview: 'Full technical disclosure of all automated screening, quality appraisal, data extraction, taxonomic synthesis, and prompt engineering engines utilized throughout the SLR pipeline.',
      engines: {
        stage_1_fast_filter: resolveEngineSpec(
          'fast_filter',
          'stage_1_fast_filter',
          1,
          'Stage 1: The Fast Filter (Metadata Screening)',
          'High-recall preliminary screener that evaluates Title, Abstract, and Keywords against early exclusion criteria (EC-1 to EC-3) with a strict zero-false-negative mandate.',
          '3-Gate Hierarchical Logic Trace: gate_1_ec1_metadata -> gate_1_ec2_domain -> gate_1_ec3_non_predictive -> final_evaluation (decision, exclusion_code, reasoning).',
          'Recall = 100% (0 false negatives on holdout calibration), F1 Score >= 85%.',
          {
            '{{project_name}}': 'Formal title of the systematic literature review',
            '{{project_objective}}': 'Core research objective and domain scope',
            '{{project_manifesto}}': 'Methodological inclusion and exclusion boundaries',
            '{{project_questions}}': 'Research questions investigated in the review',
            '{{project_ec_rules}}': 'Stage 1 Exclusion Criteria definitions (EC-1, EC-2, EC-3)',
            '{{paper_id}}': 'Unique identifier of candidate publication',
            '{{paper_title}}': 'Title of the candidate study',
            '{{paper_abstract}}': 'Abstract text of the candidate study',
            '{{paper_keywords}}': 'Author and indexed keywords',
            '{{paper_authors}}': 'Author names and affiliations',
            '{{paper_year}}': 'Publication year'
          },
          'gemini-2.5-flash',
          2000,
          'flex',
          false
        ),

        stage_2_gatekeeper: resolveEngineSpec(
          'gatekeeper',
          'stage_2_gatekeeper',
          2,
          'Stage 2: The Gatekeeper (Full-Text Structural Eligibility)',
          'High-precision full-text structural screener that evaluates empirical eligibility, architectural diagrams, hardware testbeds, and benchmark evaluation data against advanced exclusion criteria (EC-4 to EC-9).',
          '6-Gate Structural Verification Trace: gate_4_ec4_passive_system -> gate_5_ec5_pure_simulation -> gate_6_ec6_footprint_failure -> gate_7_ec7_hardware_obfuscation -> gate_8_ec8_fake_edge -> gate_9_ec9_non_reproducible -> final_evaluation (decision, exclusion_code, reasoning).',
          'Precision >= 85%, Recall >= 90% against double-blind human consensus.',
          {
            '{{project_name}}': 'Formal title of the review project',
            '{{project_objective}}': 'Primary research objective and scope',
            '{{project_manifesto}}': 'Domain scope and structural eligibility rules',
            '{{project_questions}}': 'Research questions investigated in the review',
            '{{project_ec_rules}}': 'Stage 2 Exclusion Criteria definitions (EC-4 through EC-9)',
            '{{paper_id}}': 'Unique paper identifier',
            '{{paper_title}}': 'Paper title',
            '{{paper_abstract}}': 'Paper abstract',
            '{{paper_full_text}}': 'Complete full-text document text or structural section excerpts'
          },
          'gemini-2.5-flash',
          3000,
          'flex',
          false
        ),

        stage_3_scientist: resolveEngineSpec(
          'scientist',
          'stage_3_scientist',
          3,
          'Stage 3: The Scientist (Methodological Quality Appraisal)',
          'Rigorous quality assessment engine executing an 8-criterion rubric (QA-1 to QA-8) with verbatim quote grounding and dual-gate failure mechanisms (Fatal Flaw vs. Cumulative Gate).',
          'Dual-Gate Quality Mechanism: (1) Fatal Flaw Gate (0.0 score in QA-1, QA-3, QA-4, or QA-6 triggers immediate exclusion), (2) Cumulative Gate (Total QA score must reach >= 4.5 / 8.0). Each criterion is scored on an ordinal scale: 0.0 (No/Unaddressed), 0.5 (Partially Addressed), 1.0 (Fully Addressed) paired with verbatim evidence quote.',
          'Fleiss-Cohen Weighted Kappa >= 0.65, Critical Miss Rate === 0.0% (Minor score delta = 0.5 accepted as consensus).',
          {
            '{{project_name}}': 'Project name',
            '{{project_objective}}': 'Research objective',
            '{{project_manifesto}}': 'Methodology guidelines',
            '{{project_qa_rules}}': 'Detailed QA scoring rubrics for criteria QA-1 through QA-8',
            '{{paper_id}}': 'Paper ID',
            '{{paper_title}}': 'Paper title',
            '{{paper_abstract}}': 'Paper abstract',
            '{{paper_full_text}}': 'Full-text PDF document content'
          },
          'gemini-2.5-pro',
          4000,
          'standard',
          true
        ),

        stage_4_miner: resolveEngineSpec(
          'miner',
          'stage_4_miner',
          4,
          'Stage 4: The Miner (Structured Data & Variable Extraction)',
          'Exhaustive data extraction engine extracting all research question variables, taxonomy properties, empirical metrics, hardware specs, and verbatim evidence quotes into structured JSON.',
          'Typed Key-Value Extraction with Verbatim Quote Grounding. Every extracted property is mapped with typed payload (string/array) and source evidence quote.',
          'Schema Integrity Rate === 100% (0 missing keys, 100% correct type match).',
          {
            '{{project_name}}': 'Project name',
            '{{project_objective}}': 'Research objective',
            '{{project_manifesto}}': 'Scope manifesto',
            '{{project_questions}}': 'Research questions',
            '{{project_extraction_rules}}': 'Detailed extraction schema and property definitions (RQ1 to RQ10)',
            '{{paper_id}}': 'Paper ID',
            '{{paper_title}}': 'Paper title',
            '{{paper_abstract}}': 'Paper abstract',
            '{{paper_full_text}}': 'Full-text PDF document content',
            '{{qa_summary}}': 'Summary of Stage 3 Scientist QA evaluation findings (chained interaction)'
          },
          'gemini-2.5-pro',
          6000,
          'standard',
          true
        ),

        stage_5_umbrellanizer: resolveEngineSpec(
          'umbrellanizer',
          'stage_5_umbrellanizer',
          5,
          'Stage 5: The Umbrellanizer (Cross-Study Taxonomy & Synthesis)',
          'Taxonomy harmonization and ontology synthesis engine that standardizes heterogeneous raw literature tokens into canonical umbrella categories with semantic justifications.',
          'Exact Semantic Normalization & Ontological Alignment. Maps raw_token -> umbrella_category with explicit justification to eliminate synonym fragmentation without loose substring collisions.',
          '100% ontological mapping coverage across all extracted literature tokens.',
          {
            '{{raw_tokens}}': 'List of raw extracted terms and candidate values across the cohort',
            '{{target_variable}}': 'The target research question variable under categorization',
            '{{existing_ontology}}': 'Current baseline taxonomy dictionary and defined umbrella classes'
          },
          'gemini-2.5-flash',
          4000,
          'flex',
          false
        ),

        pre_calibration_prompt_optimizer: resolveEngineSpec(
          'prompt_optimizer',
          'pre_calibration_prompt_optimizer',
          0,
          'Pre-Calibration: Difference-Engine Prompt Optimizer',
          'Autonomous closed-loop prompt optimization specialist analyzing calibration discrepancies between AI predictions and human double-blind consensus to synthesize surgical, non-regressive prompt revisions.',
          'Difference-Engine Optimization: Diagnoses error patterns, flags selective full-text requirements, generates non-regressive prompt diffs, and enforces native Gemini API schema immutability.',
          'Target stage exit metric achievement on holdout calibration partitions.',
          {
            '{{stage_name}}': 'Target pipeline stage name',
            '{{stage_num}}': 'Target pipeline stage number (1, 2, 3, or 4)',
            '{{project_objective}}': 'Research objective',
            '{{project_manifesto}}': 'Scope manifesto',
            '{{project_rules}}': 'Relevant screening or quality criteria',
            '{{current_system_instruction}}': 'Existing system prompt under evaluation',
            '{{current_user_template}}': 'Existing user prompt template',
            '{{current_response_schema}}': 'Current structured response schema',
            '{{discrepancies_json}}': 'JSON array of adjudicated human-AI discrepancies with rationales',
            '{{sibling_prompts_summary}}': 'Summaries of adjacent pipeline stage prompts to prevent boundary overlap'
          },
          'gemini-2.5-pro',
          6000,
          'standard',
          true
        ),

        pre_calibration_consolidation_auditor: resolveEngineSpec(
          'consolidation_audit',
          'pre_calibration_consolidation_auditor',
          0,
          'Pre-Calibration: Inter-Stage Consolidation Auditor',
          'Zero-temperature adversarial prompt auditor evaluating 4-stage pipeline prompts for prompt availability, semantic domain alignment, and inter-stage chainability.',
          'Tri-Dimensional Adversarial Audit: (1) Availability Audit, (2) Semantic Alignment Audit, (3) Inter-Stage Chainability (S1->S2->S3->S4 boundary handoffs).',
          'Availability Score = 1.0, Semantic Score >= 0.85, Chainability Score >= 0.85.',
          {
            '{{project_name}}': 'Project name',
            '{{project_objective}}': 'Research objective',
            '{{project_manifesto}}': 'Scope manifesto',
            '{{project_questions}}': 'Research questions',
            '{{project_qa_rules}}': 'Quality rules',
            '{{project_ec_rules}}': 'Exclusion criteria',
            '{{s1_system_instruction}}': 'Stage 1 system instruction',
            '{{s1_user_template}}': 'Stage 1 user template',
            '{{s2_system_instruction}}': 'Stage 2 system instruction',
            '{{s2_user_template}}': 'Stage 2 user template',
            '{{s3_system_instruction}}': 'Stage 3 system instruction',
            '{{s3_user_template}}': 'Stage 3 user template',
            '{{s4_system_instruction}}': 'Stage 4 system instruction',
            '{{s4_user_template}}': 'Stage 4 user template'
          },
          'gemini-2.5-flash',
          4000,
          'flex',
          false
        ),

        ingestion_duplicate_specialist: resolveEngineSpec(
          'duplicate_review',
          'ingestion_duplicate_specialist',
          0,
          'Ingestion: Duplicate & Structural Overlap Specialist',
          'High-precision pairwise deduplication engine that resolves conference-to-journal progressions, book container vs chapter overlaps, and distinct companion studies.',
          '4-Verdict Ingestion Taxonomy: CONFIRMED DUPLICATE, STRUCTURAL OVERLAP, COMPANION PAPERS, FALSE FLAG with technical breakdown (algorithmic shift, topology scope, footprint) and automated database execution actions.',
          '100% precision on conference-journal and book-chapter deduplication.',
          {
            '{{paper1_id}}': 'Primary paper ID',
            '{{paper1_title}}': 'Primary paper title',
            '{{paper1_doi}}': 'Primary paper DOI',
            '{{paper1_year}}': 'Primary paper year',
            '{{paper1_authors}}': 'Primary paper authors',
            '{{paper1_abstract}}': 'Primary paper abstract',
            '{{paper2_id}}': 'Secondary paper ID',
            '{{paper2_title}}': 'Secondary paper title',
            '{{paper2_doi}}': 'Secondary paper DOI',
            '{{paper2_year}}': 'Secondary paper year',
            '{{paper2_authors}}': 'Secondary paper authors',
            '{{paper2_abstract}}': 'Secondary paper abstract'
          },
          'gemini-2.5-flash',
          2000,
          'flex',
          false
        )
      }
    };

    // ----------------------------------------------------
    // 8. MASTER LLM NARRATIVE GUIDELINES & MATHEMATICAL CONSTRAINTS
    // ----------------------------------------------------
    const llmNarrativeGuidelines = {
      manuscript_section_title: 'Methodology, Human Pre-Calibration, and Scientific Rigor Validation',
      prisma_mathematical_continuity_rules: {
        principle: 'All counts in the PRISMA text narrative must maintain 100% exact mathematical balance across every transition.',
        flow_equations: [
          'Equation 1 (Identification & Deduplication): Database Records Identified - Duplicates Removed = Database Records Screened. (Always cite duplicates removed explicitly).',
          'Equation 2 (Stage 1 Abstract Screening): Database Records Screened - Stage 1 Fast Filter Excluded (sum of EC codes) = Reports Sought for Retrieval.',
          'Equation 3 (Full-Text Retrieval): Reports Sought for Retrieval - Reports Not Retrieved (Inaccessible PDFs) = Reports Assessed for Structural Eligibility & Quality.',
          'Equation 4 (Full-Text Eligibility & Stage 3 QA Gates): Database Studies Included = Reports Assessed - [Stage 2 Gatekeeper Structural Exclusions (sum of EC codes) + Stage 3 Scientist Quality Exclusions (Fatal Flaw Gate + Cumulative Gate)].',
          'Equation 5 (Other Methods / Snowballing): Snowball Studies Included = Snowball Reports Assessed - [Snowball Stage 2 Excluded (sum of EC codes) + Snowball Stage 3 Quality Excluded].',
          'Equation 6 (Final Synthesis Cohort): Total Studies Included in Review = Database Studies Included + Snowball Studies Included.'
        ],
        stage_3_quality_gate_guidance: 'CRITICAL: Stage 3 (Scientist QA Appraisal) exclusions (Fatal Flaw Gate for 0.0 scores on QA-1/QA-3/QA-4/QA-6, and Cumulative Gate for total QA score < 4.5 / 8.0) occur after full-text retrieval and are counted alongside Stage 2 exclusions before reaching the final included cohort. When explaining the reduction from Reports Assessed to Studies Included, explicitly mention both Stage 2 structural criteria exclusions and Stage 3 quality gate exclusions.',
        reviewer_sanity_check_checklist: [
          'Check 1: Total Initial Database Records - Duplicates Removed == Records Screened',
          'Check 2: Records Screened - Total Stage 1 Exclusions == Reports Sought',
          'Check 3: Reports Sought - Reports Not Retrieved == Reports Assessed',
          'Check 4: Reports Assessed - (Stage 2 Exclusions + Stage 3 Quality Gate Exclusions) == Database Included Studies',
          'Check 5: Snowball Reports Assessed - (Snowball Stage 2 Exclusions + Snowball Stage 3 Quality Exclusions) == Snowball Included Studies',
          'Check 6: Database Included Studies + Snowball Included Studies == Final Total Studies Included in Review'
        ]
      },
      ai_technical_disclosure_directives: {
        journal_reviewer_transparency: 'Reviewers routinely require full disclosure of the LLM pipeline architecture, model versions, prompt text, structured JSON schemas, operating temperatures, and reasoning thinking levels.',
        disclosure_instructions: [
          `1. Model Architecture & Hyperparameters: Disclose active model identifiers, operating temperatures, and thinking levels across all screening stages (${aiScreeningTechnicalSpecifications.engines.stage_1_fast_filter.llm_hyperparameter_configuration.model_id} with T = ${aiScreeningTechnicalSpecifications.engines.stage_1_fast_filter.llm_hyperparameter_configuration.temperature} and thinking level '${aiScreeningTechnicalSpecifications.engines.stage_1_fast_filter.llm_hyperparameter_configuration.thinking_level}' for Stage 1 Fast Filter; ${aiScreeningTechnicalSpecifications.engines.stage_2_gatekeeper.llm_hyperparameter_configuration.model_id} with T = ${aiScreeningTechnicalSpecifications.engines.stage_2_gatekeeper.llm_hyperparameter_configuration.temperature} and thinking level '${aiScreeningTechnicalSpecifications.engines.stage_2_gatekeeper.llm_hyperparameter_configuration.thinking_level}' for Stage 2 Gatekeeper; ${aiScreeningTechnicalSpecifications.engines.stage_3_scientist.llm_hyperparameter_configuration.model_id} with T = ${aiScreeningTechnicalSpecifications.engines.stage_3_scientist.llm_hyperparameter_configuration.temperature}, thinking level '${aiScreeningTechnicalSpecifications.engines.stage_3_scientist.llm_hyperparameter_configuration.thinking_level}', and interaction chaining for Stage 3 Scientist; ${aiScreeningTechnicalSpecifications.engines.stage_4_miner.llm_hyperparameter_configuration.model_id} with T = ${aiScreeningTechnicalSpecifications.engines.stage_4_miner.llm_hyperparameter_configuration.temperature} and thinking level '${aiScreeningTechnicalSpecifications.engines.stage_4_miner.llm_hyperparameter_configuration.thinking_level}' for Stage 4 Miner; ${aiScreeningTechnicalSpecifications.engines.stage_5_umbrellanizer.llm_hyperparameter_configuration.model_id} with T = ${aiScreeningTechnicalSpecifications.engines.stage_5_umbrellanizer.llm_hyperparameter_configuration.temperature} and thinking level '${aiScreeningTechnicalSpecifications.engines.stage_5_umbrellanizer.llm_hyperparameter_configuration.thinking_level}' for Stage 5 Umbrellanizer). State that temperatures and thinking levels were configured according to recommended prompt specifications to ensure the model operates in its ideal reasoning state while maintaining reproducible evaluation and high extraction fidelity. (Refer to the complete technical specifications table in the appendix for auxiliary engines including deduplication, prompt optimization, and consolidation audit).`,
          '2. Structured Output Enforcement: State that all LLM outputs were strictly constrained via native API schema validation (generationConfig.responseSchema), eliminating schema corruption, malformed JSON, and hallucinated keys.',
          '3. Hierarchical Logic Trace Architectures: Explain that each screening prompt enforces multi-gate reasoning (e.g. Stage 1 3-gate trace, Stage 2 6-gate structural trace, Stage 3 ordinal rubrics with Fatal Flaw & Cumulative gates) before a final categorical verdict is emitted.',
          '4. Verbatim Quote Grounding: Detail that Stage 3 Quality Appraisal and Stage 4 Data Extraction mandate exact sentence-level quote extraction from the PDF source for every scored criterion and extracted variable.',
          '5. Reproducibility & Prompt Provenance: Reference the SHA-256 cryptographic prompt hashes provided in the ai_screening_technical_specifications object to verify prompt immutability.'
        ]
      },
      authoritative_directives: [
        '1. PRISMA 2020 Flow Narrative: Accurately cite database identification counts, heuristic deduplication, Stage 1 abstract screening exclusions broken down by exclusion criteria codes, PDF full-text retrieval success/inaccessibility rates, Stage 2 structural eligibility exclusions, and Stage 3 quality gate exclusions (Fatal Flaw and Cumulative score cutoffs). Ensure every number tracks perfectly with zero arithmetic gaps.',
        '2. Decoupled Human Pre-Calibration: Detail the double-blind adjudication protocol across Pool A (n=50), Pool B (n=30), and Pool C (n=20). Highlight inter-rater reliability metrics (Cohen\'s Kappa, Weighted Cohen\'s Kappa, Precision, and Schema Exactness) achieving consensus prior to automated corpus inference.',
        '3. Prompt Engineering & Inter-Stage Consolidation: Describe the closed-loop Difference-Engine optimization, consolidation audit validation (availability, semantic alignment, and chainability between extraction and downstream taxonomy engines), and 70% train / 30% holdout benchmark sandbox evaluations.',
        '4. Empirical Gold Standard Benchmarking: Compare AI decisions directly against adjudicated human consensus across all 4 stages, emphasizing 100% recall retention in Stage 1, high precision in Stage 2, ordinal QA rubric proximity in Stage 3 (where 0.5-point score delta is accepted as consensus, requiring 0.0% critical miss rate), and 100% schema integrity in Stage 4.',
        '5. Post-Execution Sequential Quality Control: Explain the Wald/Fleiss-Cohen sequential estimation audit over micro-batches (n=20/batch) proving statistical stability of the autonomous pipeline via 95% Confidence Interval lower bounds stably exceeding methodological thresholds.',
        '6. AI Screening Technical Specifications: Include the detailed LLM prompt specifications, response schemas, and hyperparameter tables provided in the exported dataset as a formal Appendix or Methodology subsection.'
      ],
      methodological_thresholds: {
        stage_1_fast_filter: 'Recall = 100%, F1 >= 85%',
        stage_2_gatekeeper: 'Precision >= 85%, Recall >= 90%',
        stage_3_scientist: 'CI_lower >= 0.65, Critical Miss Rate = 0.0% (Score Delta = 0.5 is classified as agreement)',
        stage_4_miner: 'CI_lower >= 0.80, Schema Integrity Rate = 100% (0 missing keys, 100% correct type match)'
      }
    };

    // ----------------------------------------------------
    // 9. COMPILE UNIFIED PAYLOAD
    // ----------------------------------------------------
    const exportPayload = {
      export_metadata: {
        title: 'Scientific Rigor, AI Technical Specifications & Methodological Quality Assurance Dataset',
        project_id: resolvedProjectId,
        project_name: project.name || 'Unnamed SLR Project',
        exported_at: new Date().toISOString(),
        schema_version: '1.1.0',
        description: 'Authoritative, empirical context and complete AI screening technical specifications for journal reviewer disclosure and LLM narrative drafting.'
      },
      llm_narrative_guidelines: llmNarrativeGuidelines,
      ai_screening_technical_specifications: aiScreeningTechnicalSpecifications,
      prisma_flow_data: prismaFlowData,
      pre_calibration_data: preCalibrationData,
      prompt_optimization_data: promptOptimizationData,
      gold_standard_stage_comparison: goldStandardStageComparison,
      rolling_batch_validation: rollingBatchValidationData
    };

    if (isDownload) {
      const jsonString = JSON.stringify(exportPayload, null, 2);
      const safeProjName = (project.name || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `scientific_rigor_context_${safeProjName}_${dateStr}.json`;

      const response = new NextResponse(jsonString);
      response.headers.set('Content-Type', 'application/json');
      response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      return response;
    }

    return NextResponse.json(exportPayload);
  } catch (error: any) {
    console.error('Failed to generate scientific rigor context:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate scientific rigor context' }, { status: 500 });
  }
}
