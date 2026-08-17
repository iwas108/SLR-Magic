import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db, { getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword, sanitizeApiKey } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import { validatePromptSchema, PromptType, DEFAULT_STAGE_SCHEMAS } from '@/lib/services/prompt-validator';
import { hydrateTemplate } from '@/lib/services/prompt-hydrator';
import { pipelineLock } from '@/lib/services/pipeline-lock';
import { resolveGeminiThinkingConfig } from '@/lib/gemini-thinking-specs';
import { 
  calculateCohensKappa, 
  calculateWeightedKappa, 
  calculatePoolCDecision, 
  getScoreIndex 
} from '@/lib/inter-rater/adjudication-calculations';

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

const STAGE_CONFIG: Record<number, { name: string; type: PromptType; pool: string }> = {
  1: { name: 'Stage 1: Fast Filter', type: 'fast_filter', pool: 'POOL_A' },
  2: { name: 'Stage 2: Gatekeeper', type: 'gatekeeper', pool: 'POOL_B' },
  3: { name: 'Stage 3: Scientist', type: 'scientist', pool: 'POOL_C' },
  4: { name: 'Stage 4: Miner', type: 'miner', pool: 'POOL_C' },
};

function resolveStagePrompt(projectId: string, promptType: PromptType): any {
  const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
  let templateId: string | null = null;

  if (project && project.llm_config) {
    const pCfg = safeJsonParse(project.llm_config, {});
    templateId = pCfg.default_prompts?.[promptType] || null;
  }

  let template: any = null;
  if (templateId) {
    template = db.prepare('SELECT * FROM prompt_templates WHERE id = ? AND (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id IS NULL)').get(templateId, projectId);
  }

  if (!template) {
    template = db.prepare(`
      SELECT * FROM prompt_templates 
      WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id IS NULL) 
        AND prompt_type = ? 
        AND is_active = 1 
      ORDER BY CASE WHEN CAST(project_id AS TEXT) = CAST(? AS TEXT) THEN 0 ELSE 1 END, created_at DESC 
      LIMIT 1
    `).get(projectId, promptType, projectId);
  }

  return template || null;
}

export interface BenchmarkImprovementMetrics {
  accuracy_diff: number;
  recall_diff: number;
  precision_diff: number;
  f1_diff: number;
  kappa_diff: number;
  holdout_accuracy_diff?: number | null;
  holdout_f1_diff?: number | null;
  has_improved: boolean;
  has_regressed: boolean;
  is_unchanged: boolean;
  previous_created_at?: string;
  previous_run_id?: string;
  previous_summary_metrics?: any;
  previous_holdout_metrics?: any;
}

function calculateImprovementMetrics(
  latestMetrics: any,
  previousMetrics: any,
  latestHoldout?: any,
  previousHoldout?: any,
  previousRunMeta?: { id?: string; created_at?: string }
): BenchmarkImprovementMetrics | null {
  if (!latestMetrics || !previousMetrics) return null;

  const latAcc = Number(latestMetrics.accuracy_pct ?? 0);
  const prevAcc = Number(previousMetrics.accuracy_pct ?? 0);
  const accuracy_diff = parseFloat((latAcc - prevAcc).toFixed(2));

  const latRec = Number(latestMetrics.recall ?? 0);
  const prevRec = Number(previousMetrics.recall ?? 0);
  const recall_diff = parseFloat(((latRec - prevRec) * 100).toFixed(2));

  const latPrec = Number(latestMetrics.precision ?? 0);
  const prevPrec = Number(previousMetrics.precision ?? 0);
  const precision_diff = parseFloat(((latPrec - prevPrec) * 100).toFixed(2));

  const latF1 = Number(latestMetrics.f1 ?? 0);
  const prevF1 = Number(previousMetrics.f1 ?? 0);
  const f1_diff = parseFloat((latF1 - prevF1).toFixed(4));

  const latKappa = Number(latestMetrics.kappa ?? 0);
  const prevKappa = Number(previousMetrics.kappa ?? 0);
  const kappa_diff = parseFloat((latKappa - prevKappa).toFixed(4));

  let holdout_accuracy_diff: number | null = null;
  let holdout_f1_diff: number | null = null;

  if (latestHoldout && previousHoldout && latestHoldout.accuracy_pct !== undefined && previousHoldout.accuracy_pct !== undefined) {
    holdout_accuracy_diff = parseFloat((Number(latestHoldout.accuracy_pct) - Number(previousHoldout.accuracy_pct)).toFixed(2));
  }
  if (latestHoldout && previousHoldout && latestHoldout.f1 !== undefined && previousHoldout.f1 !== undefined) {
    holdout_f1_diff = parseFloat((Number(latestHoldout.f1) - Number(previousHoldout.f1)).toFixed(4));
  }

  const has_improved = accuracy_diff > 0.001 || f1_diff > 0.001 || recall_diff > 0.001 || precision_diff > 0.001 || kappa_diff > 0.001;
  const has_regressed = accuracy_diff < -0.001 || f1_diff < -0.001 || recall_diff < -0.001 || precision_diff < -0.001 || kappa_diff < -0.001;
  const is_unchanged = !has_improved && !has_regressed;

  return {
    accuracy_diff,
    recall_diff,
    precision_diff,
    f1_diff,
    kappa_diff,
    holdout_accuracy_diff,
    holdout_f1_diff,
    has_improved,
    has_regressed,
    is_unchanged,
    previous_created_at: previousRunMeta?.created_at,
    previous_run_id: previousRunMeta?.id,
    previous_summary_metrics: previousMetrics,
    previous_holdout_metrics: previousHoldout || null
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const stageNum = parseInt(searchParams.get('stageNum') || '1', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId parameter' }, { status: 400 });
    }

    const stageMeta = STAGE_CONFIG[stageNum] || STAGE_CONFIG[1];

    // Fetch pool papers to compute availability and PDF presence
    const poolPapers = db.prepare(`
      SELECT 
        COALESCE(cp.Paper_ID, p.Paper_ID) as Paper_ID,
        COALESCE(cp.Title, p.Title) as Title,
        COALESCE(cp.Local_PDF_Path, p.Local_PDF_Path) as Local_PDF_Path,
        COALESCE(cp.Local_PDF_Status, p.Local_PDF_Status) as Local_PDF_Status
      FROM calibration_commit_ledger latest_ccl
      JOIN (
        SELECT paper_id, project_id, MAX(timestamp) as max_ts
        FROM calibration_commit_ledger
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
        GROUP BY paper_id, project_id
      ) latest ON latest_ccl.paper_id = latest.paper_id 
              AND CAST(latest.project_id AS TEXT) = CAST(latest_ccl.project_id AS TEXT) 
              AND latest_ccl.timestamp = latest.max_ts
      LEFT JOIN calibration_papers cp ON latest_ccl.paper_id = cp.Paper_ID AND CAST(cp.Project_ID AS TEXT) = CAST(latest_ccl.project_id AS TEXT)
      LEFT JOIN papers p ON latest_ccl.paper_id = p.Paper_ID AND CAST(p.Project_ID AS TEXT) = CAST(latest_ccl.project_id AS TEXT)
      WHERE CAST(latest_ccl.project_id AS TEXT) = CAST(? AS TEXT)
        AND (
          UPPER(latest_ccl.pool) = UPPER(?) 
          OR UPPER(COALESCE(cp.calibration_tag, '')) = UPPER(?) 
          OR UPPER(COALESCE(cp.calibration_pool, '')) = UPPER(?)
          OR UPPER(COALESCE(p.calibration_tag, '')) = UPPER(?) 
          OR UPPER(COALESCE(p.calibration_pool, '')) = UPPER(?)
        )
      ORDER BY latest_ccl.paper_id ASC
    `).all(projectId, projectId, stageMeta.pool, stageMeta.pool, stageMeta.pool, stageMeta.pool, stageMeta.pool) as any[];

    const totalPoolPapers = poolPapers.length;
    const missingPdfPapers = poolPapers.filter(paper => {
      const resolvedPdfPath = paper.Local_PDF_Path 
        ? (path.isAbsolute(paper.Local_PDF_Path) ? paper.Local_PDF_Path : path.resolve(process.cwd(), paper.Local_PDF_Path))
        : null;
      return !resolvedPdfPath || !fs.existsSync(resolvedPdfPath) || paper.Local_PDF_Status === 'MISSING' || paper.Local_PDF_Status === 'FAILED';
    });

    // Fetch top 2 benchmark runs for this stage to allow comparing with previous benchmark
    const benchmarkRuns = db.prepare(`
      SELECT * FROM prompt_benchmark_runs 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) 
        AND stage_num = ?
        AND status = 'COMPLETED'
      ORDER BY created_at DESC 
      LIMIT 2
    `).all(projectId, projectId, stageNum) as any[];

    // Fallback: If no completed run is found, check if any run exists (e.g. running or failed)
    let latestRun = benchmarkRuns[0] || null;
    let previousRun = benchmarkRuns.length > 1 ? benchmarkRuns[1] : null;

    if (!latestRun) {
      latestRun = db.prepare(`
        SELECT * FROM prompt_benchmark_runs 
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) 
          AND stage_num = ?
        ORDER BY created_at DESC 
        LIMIT 1
      `).get(projectId, projectId, stageNum) as any;
    }

    const latestSummary = latestRun ? safeJsonParse(latestRun.summary_metrics, {}) : null;
    const latestHoldout = latestRun ? safeJsonParse(latestRun.holdout_metrics, {}) : null;
    const prevSummary = previousRun ? safeJsonParse(previousRun.summary_metrics, {}) : null;
    const prevHoldout = previousRun ? safeJsonParse(previousRun.holdout_metrics, {}) : null;

    const improvementMetrics = (latestRun && previousRun && latestSummary && prevSummary)
      ? calculateImprovementMetrics(latestSummary, prevSummary, latestHoldout, prevHoldout, previousRun)
      : null;

    let paperResults: any[] = [];
    if (latestRun) {
      paperResults = db.prepare(`
        SELECT r.*, p.Title, p.Abstract, p.Authors, p.Year, p.DOI, p.Local_PDF_Path
        FROM prompt_benchmark_results r
        LEFT JOIN papers p ON r.paper_id = p.Paper_ID AND (CAST(p.Project_ID AS TEXT) = CAST(r.project_id AS TEXT) OR p.Project_ID = r.project_id)
        WHERE r.run_id = ? AND (CAST(r.project_id AS TEXT) = CAST(? AS TEXT) OR r.project_id = ?)
        ORDER BY r.is_match ASC, r.paper_id ASC
      `).all(latestRun.id, projectId, projectId);
    }

    return NextResponse.json({
      project_id: projectId,
      stage_num: stageNum,
      stage_name: stageMeta.name,
      pool: stageMeta.pool,
      pool_papers_count: totalPoolPapers,
      missing_pdf_count: missingPdfPapers.length,
      missing_pdf_papers: missingPdfPapers.map(p => ({ paper_id: p.Paper_ID, title: p.Title })),
      latest_run: latestRun ? {
        ...latestRun,
        summary_metrics: latestSummary,
        holdout_metrics: latestHoldout
      } : null,
      previous_run: previousRun ? {
        ...previousRun,
        summary_metrics: prevSummary,
        holdout_metrics: prevHoldout
      } : null,
      improvement_metrics: improvementMetrics,
      results: paperResults.map(r => ({
        ...r,
        ai_qa_scores: safeJsonParse(r.ai_qa_scores, null),
        ai_extracted_data: safeJsonParse(r.ai_extracted_data, null),
        gold_qa_scores: safeJsonParse(r.gold_qa_scores, null),
        gold_extracted_data: safeJsonParse(r.gold_extracted_data, null),
        discrepancy_details: safeJsonParse(r.discrepancy_details, null),
        raw_response: safeJsonParse(r.raw_response, null)
      }))
    });
  } catch (err: any) {
    console.error('Error fetching benchmark status:', err);
    return NextResponse.json({ error: sanitizeApiKey(err.message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { project_id: projectId, stage_num: rawStageNum } = body;
    const stageNum = parseInt(rawStageNum || '1', 10);
    const stageMeta = STAGE_CONFIG[stageNum] || STAGE_CONFIG[1];

    if (!projectId) {
      return NextResponse.json({ error: 'Missing required field: project_id' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: `Project '${projectId}' not found.` }, { status: 404 });
    }

    // 1. Pipeline Lock & Vault Authentication
    if (pipelineLock.isLocked()) {
      return NextResponse.json({ error: 'Another pipeline task is active. Please wait.' }, { status: 409 });
    }

    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault in Settings.' }, { status: 401 });
    }

    const password = getSessionMasterPassword();
    const keyRow = getVaultKey('GEMINI_API_KEY');
    if (!keyRow || !password) {
      return NextResponse.json({ error: 'Gemini API Key not found in vault.' }, { status: 400 });
    }

    let geminiApiKey: string;
    try {
      geminiApiKey = await decryptKey({
        ciphertext: keyRow.encrypted_value,
        salt: keyRow.salt,
        iv: keyRow.iv,
        tag: keyRow.tag,
      }, password);
    } catch (decryptErr) {
      clearSessionMasterPassword();
      return NextResponse.json({ error: 'Failed to decrypt Gemini API Key.' }, { status: 401 });
    }

    // 2. Fetch Adjudicated Target Pool Papers with Latest Commit Join
    const papersWithGold = db.prepare(`
      SELECT 
        COALESCE(cp.Paper_ID, p.Paper_ID) as Paper_ID,
        COALESCE(cp.Title, p.Title) as Title,
        COALESCE(cp.Abstract, p.Abstract) as Abstract,
        COALESCE(cp.Authors, p.Authors) as Authors,
        COALESCE(cp.Year, p.Year) as Year,
        COALESCE(cp.DOI, p.DOI) as DOI,
        COALESCE(cp.Local_PDF_Path, p.Local_PDF_Path) as Local_PDF_Path,
        COALESCE(cp.Local_PDF_Status, p.Local_PDF_Status) as Local_PDF_Status,
        COALESCE(cp.PDF_Link, p.PDF_Link) as PDF_Link,
        COALESCE(cp.Source, p.Source) as Source,
        latest_ccl.resolved_decision as gold_decision,
        latest_ccl.resolved_ec as gold_exclusion_code,
        latest_ccl.resolved_qa_scores as gold_qa_scores,
        latest_ccl.resolved_extracted_data as gold_extracted_data,
        latest_ccl.commit_message as gold_rationale
      FROM calibration_commit_ledger latest_ccl
      JOIN (
        SELECT paper_id, project_id, MAX(timestamp) as max_ts
        FROM calibration_commit_ledger
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
        GROUP BY paper_id, project_id
      ) latest ON latest_ccl.paper_id = latest.paper_id 
              AND CAST(latest.project_id AS TEXT) = CAST(latest_ccl.project_id AS TEXT) 
              AND latest_ccl.timestamp = latest.max_ts
      LEFT JOIN calibration_papers cp ON latest_ccl.paper_id = cp.Paper_ID AND CAST(cp.Project_ID AS TEXT) = CAST(latest_ccl.project_id AS TEXT)
      LEFT JOIN papers p ON latest_ccl.paper_id = p.Paper_ID AND CAST(p.Project_ID AS TEXT) = CAST(latest_ccl.project_id AS TEXT)
      WHERE CAST(latest_ccl.project_id AS TEXT) = CAST(? AS TEXT)
        AND (
          UPPER(latest_ccl.pool) = UPPER(?) 
          OR UPPER(COALESCE(cp.calibration_tag, '')) = UPPER(?) 
          OR UPPER(COALESCE(cp.calibration_pool, '')) = UPPER(?)
          OR UPPER(COALESCE(p.calibration_tag, '')) = UPPER(?) 
          OR UPPER(COALESCE(p.calibration_pool, '')) = UPPER(?)
        )
      ORDER BY latest_ccl.paper_id ASC
    `).all(projectId, projectId, stageMeta.pool, stageMeta.pool, stageMeta.pool, stageMeta.pool, stageMeta.pool) as any[];

    if (!papersWithGold || papersWithGold.length === 0) {
      return NextResponse.json({
        error: `No adjudicated papers found in ${stageMeta.pool} for Stage ${stageNum}. Please ensure calibration papers are 100% reviewed and committed in the Calibration view first.`
      }, { status: 400 });
    }

    // PDF Mandatory Guard for Quest 03, Quest 04, Quest 05 (Stage 2 Gatekeeper, Stage 3 Scientist, Stage 4 Miner)
    if (stageNum >= 2) {
      const missingPdfPapers = papersWithGold.filter(paper => {
        const resolvedPdfPath = paper.Local_PDF_Path 
          ? (path.isAbsolute(paper.Local_PDF_Path) ? paper.Local_PDF_Path : path.resolve(process.cwd(), paper.Local_PDF_Path))
          : null;
        return !resolvedPdfPath || !fs.existsSync(resolvedPdfPath) || paper.Local_PDF_Status === 'MISSING' || paper.Local_PDF_Status === 'FAILED';
      });

      if (missingPdfPapers.length > 0) {
        const sample = missingPdfPapers.slice(0, 3).map(p => `"${p.Paper_ID}: ${p.Title || 'Untitled'}"`).join(', ');
        const extra = missingPdfPapers.length > 3 ? ` and ${missingPdfPapers.length - 3} more` : '';
        return NextResponse.json({
          error: `Quest 0${stageNum + 1} (${stageMeta.name}) requires a local PDF file for every paper in ${stageMeta.pool}. Found ${missingPdfPapers.length} paper(s) with missing or unset PDFs (${sample}${extra}). Please acquire or upload all PDF files before running this benchmark.`
        }, { status: 400 });
      }
    }

    // 3. Resolve Active Stage Prompt Template
    const stagePrompt = resolveStagePrompt(projectId, stageMeta.type);
    if (!stagePrompt) {
      return NextResponse.json({
        error: `No active prompt template found for ${stageMeta.name} in Prompt Library.`
      }, { status: 400 });
    }

    // 4. Dynamic LLM Config Parsing (100% adherence to prompt template settings)
    const promptConfig = safeJsonParse(stagePrompt.llm_config, {});
    const modelId = promptConfig.model_id || 'gemini-2.5-flash';
    const cleanModelName = modelId.replace(/^models\//, '');
    const temperature = typeof promptConfig.temperature === 'number' ? promptConfig.temperature : 0.0;
    const maxTokens = promptConfig.max_tokens ?? promptConfig.max_output_tokens ?? 4000;
    const topP = typeof promptConfig.top_p === 'number' ? promptConfig.top_p : (promptConfig.top_p !== undefined ? Number(promptConfig.top_p) : undefined);
    const topK = typeof promptConfig.top_k === 'number' ? promptConfig.top_k : (promptConfig.top_k !== undefined ? Number(promptConfig.top_k) : undefined);
    const timeoutSeconds = promptConfig.timeout_seconds ? Number(promptConfig.timeout_seconds) : 900;
    const speedMode = (promptConfig.execution_mode || 'STANDARD').toUpperCase();
    const concurrency = Math.max(1, Number(promptConfig.concurrency ?? 2));
    const rawDelay = promptConfig.request_delay;
    const delayMs = rawDelay !== undefined && rawDelay !== null 
      ? (Number(rawDelay) > 10 ? Number(rawDelay) : Math.max(0, Number(rawDelay) * 1000))
      : 400;

    // 5. Partition 70% Calibration Tuning / 30% Holdout Validation
    const totalPapers = papersWithGold.length;
    const trainCount = totalPapers >= 5 ? Math.max(1, Math.round(totalPapers * 0.7)) : totalPapers;
    const holdoutCount = totalPapers - trainCount;

    const trainPapers = papersWithGold.slice(0, trainCount);
    const holdoutPapers = papersWithGold.slice(trainCount);

    const partitionMap = new Map<string, 'train' | 'holdout'>();
    trainPapers.forEach(p => partitionMap.set(p.Paper_ID, 'train'));
    holdoutPapers.forEach(p => partitionMap.set(p.Paper_ID, 'holdout'));

    // 5.1 Pre-flight check: Project Budget Limit
    const budgetLimit = Number(project.project_budget_limit || 0);
    if (budgetLimit > 0) {
      const currentSpendRow = db.prepare(`
        SELECT COALESCE((
          SELECT SUM(cost_usd) FROM (
            SELECT cost_usd FROM llm_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
            UNION ALL
            SELECT cost_usd FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
          )
        ), p.project_current_spend, 0.0) as current_spend
        FROM projects p
        WHERE CAST(p.id AS TEXT) = CAST(? AS TEXT)
      `).get(projectId, projectId, projectId) as { current_spend: number } | undefined;

      const currentSpend = Number(currentSpendRow?.current_spend || 0);
      if (currentSpend >= budgetLimit) {
        return NextResponse.json({
          error: `Project budget limit exceeded. Current Spend: $${currentSpend.toFixed(4)}, Limit: $${budgetLimit.toFixed(4)}`
        }, { status: 400 });
      }
    }

    // 6. Create Benchmark Run Record
    const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const promptHash = crypto.createHash('sha256').update((stagePrompt.system_instruction || '') + (stagePrompt.user_template || '')).digest('hex');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO prompt_benchmark_runs (
        id, project_id, stage_num, stage_name, pool, prompt_template_id,
        prompt_hash, status, total_papers, evaluated_papers, train_count,
        holdout_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'RUNNING', ?, 0, ?, ?, ?, ?)
    `).run(runId, projectId, stageNum, stageMeta.name, stageMeta.pool, stagePrompt.id, promptHash, totalPapers, trainCount, holdoutCount, now, now);

    // 7. Execute Benchmark Evaluation on Papers
    const pricingRow = db.prepare('SELECT * FROM llm_pricing WHERE model_id = ?').get(cleanModelName) as any;
    const inputPrice = pricingRow ? Number(pricingRow.input_token_price) : 0.075;
    const outputPrice = pricingRow ? Number(pricingRow.output_token_price) : 0.30;
    const defaultBatchDiscount = pricingRow?.batch_discount !== undefined ? Number(pricingRow.batch_discount) : 0.5;
    const discountRate = typeof promptConfig.discount === 'number' ? promptConfig.discount : (speedMode === 'FLEX' ? defaultBatchDiscount : 0.0);
    const projectTax = Number(project?.project_tax || 0.0);

    let evaluatedCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    const resultsAccumulator: any[] = [];

    // Helper to evaluate single paper
    const evaluatePaper = async (paper: any) => {
      const partition = partitionMap.get(paper.Paper_ID) || 'train';
      const hydrationContext = {
        project: {
          name: project.name || 'Unnamed SLR Project',
          objective: project.objective || 'Not specified',
          manifesto: project.manifesto || 'Not specified',
          questions: project.questions || 'Not specified',
          qa_rules: project.pool_c_qa_rules || 'Standard QA Rules',
          ec_rules: project.pool_b_ec_rules || project.ec_rules || 'Standard EC Rules',
          extraction_rules: project.pool_c_extraction_rules || ''
        },
        paper: {
          id: paper.Paper_ID,
          title: paper.Title,
          abstract: paper.Abstract,
          doi: paper.DOI,
          authors: paper.Authors,
          year: paper.Year,
          source: paper.Source || paper.Import_Source,
          local_pdf_path: paper.Local_PDF_Path
        }
      };

      const hydratedUserPrompt = hydrateTemplate(stagePrompt.user_template, hydrationContext);
      const systemInstruction = stagePrompt.system_instruction || '';
      const parsedResponseSchema = safeJsonParse(stagePrompt.response_schema, DEFAULT_STAGE_SCHEMAS[stageMeta.type]);

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${geminiApiKey}`;
      const generationConfig: Record<string, any> = {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        responseSchema: parsedResponseSchema
      };

      if (topP !== undefined && !isNaN(topP)) {
        generationConfig.topP = topP;
      }
      if (topK !== undefined && !isNaN(topK)) {
        generationConfig.topK = topK;
      }

      const thinkingConfig = resolveGeminiThinkingConfig(cleanModelName, promptConfig.thinking_level);
      if (thinkingConfig) {
        generationConfig.thinkingConfig = thinkingConfig;
      }

      const parts: any[] = [];

      // Check if PDF should be attached inline for full-text stages (< 19.5MB inline limit)
      if (paper.Local_PDF_Path) {
        const resolvedPath = path.isAbsolute(paper.Local_PDF_Path) 
          ? paper.Local_PDF_Path 
          : path.resolve(process.cwd(), paper.Local_PDF_Path);
        if (fs.existsSync(resolvedPath)) {
          try {
            const stat = fs.statSync(resolvedPath);
            if (stat.size <= 19.5 * 1024 * 1024) {
              const pdfBuffer = fs.readFileSync(resolvedPath);
              parts.push({
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfBuffer.toString('base64')
                }
              });
            } else {
              console.warn(`PDF file ${resolvedPath} is too large (${(stat.size / 1024 / 1024).toFixed(1)}MB) for inline attachment.`);
            }
          } catch (pdfErr) {
            console.warn(`Could not read PDF from ${resolvedPath}:`, pdfErr);
          }
        }
      }

      parts.push({ text: hydratedUserPrompt });

      const apiPayload = {
        contents: [{ role: 'user', parts }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutSeconds * 1000);

      const paperStartTime = Date.now();
      let paperInpTokens = 0;
      let paperOutTokens = 0;
      let paperCostItem = 0.0;
      let rawResponseObj: any = null;
      let outputText = '';
      let isMatch = 0;
      let aiDecision: string | null = null;
      let aiExclusionCode: string | null = null;
      let aiRationale: string | null = null;
      let aiQaScores: any = null;
      let aiExtractedData: any = null;
      let discrepancyDetails: any = null;

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
          signal: abortController.signal
        });
        clearTimeout(timeoutId);

        const resJson = await res.json();
        rawResponseObj = resJson;

        if (res.ok) {
          const candidate = resJson.candidates?.[0];
          outputText = candidate?.content?.parts?.[0]?.text || '';
          const usage = resJson.usageMetadata || {};
          const inp = usage.promptTokenCount || 0;
          const outp = usage.candidatesTokenCount || 0;
          paperInpTokens = inp;
          paperOutTokens = outp;
          totalInputTokens += inp;
          totalOutputTokens += outp;

          const rawCost = ((inp / 1_000_000) * inputPrice) + ((outp / 1_000_000) * outputPrice);
          const costItem = rawCost * (1 - discountRate) * (1 + projectTax);
          paperCostItem = costItem;
          totalCostUsd += costItem;

          const parsed = JSON.parse(outputText);

          // Extract decisions & QA scores
          if (stageNum === 1 || stageNum === 2) {
            const finalEval = parsed.final_evaluation || {};
            aiDecision = finalEval.decision ? (String(finalEval.decision).toUpperCase().startsWith('INCLUDE') ? 'Include' : 'Exclude') : 'Exclude';
            aiExclusionCode = finalEval.exclusion_code || 'NONE';
            aiRationale = finalEval.reasoning || '';

            const goldDecNorm = String(paper.gold_decision || '').toUpperCase().startsWith('INCLUDE') ? 'Include' : 'Exclude';
            isMatch = (aiDecision === goldDecNorm) ? 1 : 0;
            if (!isMatch) {
              discrepancyDetails = {
                type: 'DECISION_MISMATCH',
                ai_decision: aiDecision,
                gold_decision: goldDecNorm,
                ai_exclusion_code: aiExclusionCode,
                gold_exclusion_code: paper.gold_exclusion_code
              };
            }
          } else if (stageNum === 3) {
            aiQaScores = parsed.qa_scores || {};
            const finalEval = parsed.final_evaluation || {};
            aiDecision = finalEval.decision ? (String(finalEval.decision).toUpperCase().startsWith('INCLUDE') ? 'Include' : 'Exclude') : 'Exclude';
            aiExclusionCode = finalEval.exclusion_code || null;
            aiRationale = finalEval.reasoning || '';

            const goldScoresParsed = safeJsonParse(paper.gold_qa_scores, {});
            let scoreDiffCount = 0;
            const cleanKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

            for (const [gKey, gVal] of Object.entries(goldScoresParsed)) {
              const matchedAiKey = Object.keys(aiQaScores).find(ak => cleanKey(ak) === cleanKey(gKey) || cleanKey(ak).startsWith(cleanKey(gKey)));
              const aiVal = matchedAiKey ? aiQaScores[matchedAiKey] : null;
              const aiNum = aiVal !== null ? (typeof aiVal === 'object' ? parseFloat(aiVal.score ?? 0) : parseFloat(String(aiVal))) : 0;
              const goldNum = typeof gVal === 'object' ? parseFloat((gVal as any).score ?? 0) : parseFloat(String(gVal));
              if (Math.abs(aiNum - goldNum) > 0.5) {
                scoreDiffCount++;
              }
            }

            const goldDecNorm = String(paper.gold_decision || '').toUpperCase().startsWith('INCLUDE') ? 'Include' : 'Exclude';
            isMatch = (aiDecision === goldDecNorm && scoreDiffCount === 0) ? 1 : 0;
            if (!isMatch) {
              discrepancyDetails = {
                type: 'QA_SCORE_DISCREPANCY',
                score_divergences_count: scoreDiffCount,
                ai_decision: aiDecision,
                gold_decision: goldDecNorm
              };
            }
          } else if (stageNum === 4) {
            aiExtractedData = parsed.extracted_data || {};
            const goldExtracted = safeJsonParse(paper.gold_extracted_data, {});
            const goldKeys = Object.keys(goldExtracted);

            if (goldKeys.length > 0) {
              const missingKeys = goldKeys.filter(k => !(k in aiExtractedData) || aiExtractedData[k] === null || aiExtractedData[k] === '');
              isMatch = missingKeys.length === 0 ? 1 : 0;
              if (!isMatch) {
                discrepancyDetails = {
                  type: 'SCHEMA_EXTRACTION_MISMATCH',
                  missing_keys: missingKeys,
                  extracted_keys_count: Object.keys(aiExtractedData).length,
                  gold_keys_count: goldKeys.length
                };
              }
            } else {
              isMatch = Object.keys(aiExtractedData).length > 0 ? 1 : 0;
              if (!isMatch) {
                discrepancyDetails = {
                  type: 'EMPTY_EXTRACTION',
                  message: 'No extracted_data keys yielded by AI Miner prompt.'
                };
              }
            }
          }
        } else {
          discrepancyDetails = { type: 'API_ERROR', error: resJson?.error?.message || `HTTP ${res.status}` };
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        discrepancyDetails = { type: 'EXECUTION_ERROR', error: sanitizeApiKey(err.message) };
      }

      // Persist individual paper benchmark result
      db.prepare(`
        INSERT INTO prompt_benchmark_results (
          run_id, project_id, paper_id, partition_type, ai_decision,
          ai_exclusion_code, ai_rationale, ai_qa_scores, ai_extracted_data,
          gold_decision, gold_exclusion_code, gold_rationale, gold_qa_scores,
          gold_extracted_data, is_match, discrepancy_details, raw_response, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        runId,
        projectId,
        paper.Paper_ID,
        partition,
        aiDecision,
        aiExclusionCode,
        aiRationale,
        aiQaScores ? JSON.stringify(aiQaScores) : null,
        aiExtractedData ? JSON.stringify(aiExtractedData) : null,
        paper.gold_decision,
        paper.gold_exclusion_code,
        paper.gold_rationale,
        paper.gold_qa_scores ? (typeof paper.gold_qa_scores === 'string' ? paper.gold_qa_scores : JSON.stringify(paper.gold_qa_scores)) : null,
        paper.gold_extracted_data ? (typeof paper.gold_extracted_data === 'string' ? paper.gold_extracted_data : JSON.stringify(paper.gold_extracted_data)) : null,
        isMatch,
        discrepancyDetails ? JSON.stringify(discrepancyDetails) : null,
        rawResponseObj ? JSON.stringify(rawResponseObj) : null,
        new Date().toISOString()
      );

      // Persist to immutable llm_audit_log
      try {
        const paperLatencyMs = Date.now() - paperStartTime;
        const paperPromptHash = crypto.createHash('sha256').update((stagePrompt.system_instruction || '') + (hydratedUserPrompt || '')).digest('hex');
        const totalPaperTokens = paperInpTokens + paperOutTokens;
        db.prepare(`
          INSERT INTO llm_audit_log (
            project_id, paper_id, job_id, interaction_id, model_id, task_type,
            input_tokens, output_tokens, thinking_tokens, total_tokens,
            cost_usd, flex_discount, speed_mode, prompt_hash, raw_prompt, raw_response,
            response_schema_name, structured_output, status, latency_ms, api_version, created_at
          ) VALUES (?, ?, ?, ?, ?, 'prompt_benchmark', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google-genai-2.5-rest', ?)
        `).run(
          projectId,
          paper.Paper_ID,
          runId,
          `bm-int-${crypto.randomBytes(4).toString('hex')}`,
          cleanModelName,
          paperInpTokens,
          paperOutTokens,
          totalPaperTokens,
          paperCostItem,
          discountRate,
          speedMode,
          paperPromptHash,
          hydratedUserPrompt,
          outputText,
          `${stageMeta.type}_schema`,
          outputText,
          rawResponseObj && !discrepancyDetails?.type?.includes('ERROR') ? 'SUCCESS' : 'ERROR',
          paperLatencyMs,
          new Date().toISOString()
        );
      } catch (auditErr) {
        console.error('Failed to log benchmark paper interaction to llm_audit_log:', auditErr);
      }

      evaluatedCount++;
      resultsAccumulator.push({
        paper_id: paper.Paper_ID,
        partition,
        is_match: isMatch,
        ai_decision: aiDecision,
        gold_decision: paper.gold_decision,
        ai_qa_scores: aiQaScores,
        gold_qa_scores: paper.gold_qa_scores,
        discrepancy_details: discrepancyDetails
      });
    };

    // Sequential Pacing with dynamic concurrency from prompt template llm_config
    for (let i = 0; i < papersWithGold.length; i += concurrency) {
      const batch = papersWithGold.slice(i, i + concurrency);
      await Promise.all(batch.map(p => evaluatePaper(p)));
      if (delayMs > 0 && i + concurrency < papersWithGold.length) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }

    // 8. Calculate Statistical Metrics via Pure Functions
    const calcMetricsForSubset = (items: any[]) => {
      if (!items || items.length === 0) return { total: 0, accuracy_pct: 0, recall: 0, precision: 0, f1: 0, kappa: 0, kappa_label: 'Poor' };
      const total = items.length;
      let tp = 0, tn = 0, fp = 0, fn = 0;

      if (stageNum === 4) {
        const matchCount = items.filter(it => it.is_match === 1).length;
        const schemaIntegrityPct = total > 0 ? (matchCount / total) * 100 : 0;
        const scoreRatio = total > 0 ? matchCount / total : 0;
        return {
          total,
          tp: matchCount,
          tn: 0,
          fp: 0,
          fn: total - matchCount,
          accuracy_pct: parseFloat(schemaIntegrityPct.toFixed(2)),
          precision: parseFloat(scoreRatio.toFixed(4)),
          recall: parseFloat(scoreRatio.toFixed(4)),
          f1: parseFloat(scoreRatio.toFixed(4)),
          kappa: parseFloat(scoreRatio.toFixed(4)),
          kappa_label: matchCount === total ? 'Almost Perfect' : (matchCount > 0 ? 'Moderate' : 'Poor')
        };
      }

      items.forEach(it => {
        const aiInc = String(it.ai_decision || '').toUpperCase().startsWith('INCLUDE');
        const goldInc = String(it.gold_decision || '').toUpperCase().startsWith('INCLUDE');
        if (aiInc && goldInc) tp++;
        else if (!aiInc && !goldInc) tn++;
        else if (aiInc && !goldInc) fp++;
        else if (!aiInc && goldInc) fn++;
      });

      const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;
      const precision = (tp + fp) > 0 ? tp / (tp + fp) : 1.0;
      const recall = (tp + fn) > 0 ? tp / (tp + fn) : 1.0;
      const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      
      let computedKappa = 0;
      let computedKappaLabel: string = 'Poor';

      if (stageNum === 3) {
        // Compute Linear Weighted Kappa across ordinal QA scores for Stage 3
        const O = [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0]
        ];
        let totalQARatings = 0;

        items.forEach(it => {
          const aiScores = it.ai_qa_scores || {};
          const goldScores = safeJsonParse(it.gold_qa_scores, {});
          const cleanKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

          for (const [gKey, gVal] of Object.entries(goldScores)) {
            const matchedAiKey = Object.keys(aiScores).find(ak => cleanKey(ak) === cleanKey(gKey) || cleanKey(ak).startsWith(cleanKey(gKey)));
            const aiVal = matchedAiKey ? aiScores[matchedAiKey] : null;

            const rowIdx = getScoreIndex(gVal);
            const colIdx = getScoreIndex(aiVal);
            O[rowIdx][colIdx]++;
            totalQARatings++;
          }
        });

        if (totalQARatings > 0) {
          const wKappaRes = calculateWeightedKappa(O, totalQARatings);
          computedKappa = wKappaRes.weighted_kappa;
          computedKappaLabel = wKappaRes.kappa_label;
        } else {
          const kappaRes = calculateCohensKappa(total, tp, tn, fp, fn);
          computedKappa = kappaRes.cohens_kappa;
          computedKappaLabel = kappaRes.kappa_label;
        }
      } else {
        const kappaRes = calculateCohensKappa(total, tp, tn, fp, fn);
        computedKappa = kappaRes.cohens_kappa;
        computedKappaLabel = kappaRes.kappa_label;
      }

      return {
        total,
        tp,
        tn,
        fp,
        fn,
        accuracy_pct: parseFloat(accuracy.toFixed(2)),
        precision: parseFloat(precision.toFixed(4)),
        recall: parseFloat(recall.toFixed(4)),
        f1: parseFloat(f1.toFixed(4)),
        kappa: computedKappa,
        kappa_label: computedKappaLabel
      };
    };

    const overallMetrics = calcMetricsForSubset(resultsAccumulator);
    const trainMetrics = calcMetricsForSubset(resultsAccumulator.filter(r => r.partition === 'train'));
    const holdoutMetrics = calcMetricsForSubset(resultsAccumulator.filter(r => r.partition === 'holdout'));

    // PRISMA Hard Gates Evaluation
    let prismaGatePassed = true;
    const gateReasons: string[] = [];

    if (stageNum === 1) {
      if (overallMetrics.recall < 1.0) {
        prismaGatePassed = false;
        gateReasons.push(`Stage 1 PRISMA Gate Failed: Recall is ${(overallMetrics.recall * 100).toFixed(1)}% (requires 100%, 0 false negatives).`);
      }
      if (overallMetrics.f1 < 0.85) {
        prismaGatePassed = false;
        gateReasons.push(`Stage 1 F1 Target Failed: F1 is ${overallMetrics.f1.toFixed(3)} (target >= 0.850).`);
      }
    } else if (stageNum === 2) {
      if (overallMetrics.precision < 0.85) {
        prismaGatePassed = false;
        gateReasons.push(`Stage 2 Precision Target Failed: Precision is ${(overallMetrics.precision * 100).toFixed(1)}% (target >= 85%).`);
      }
      if (overallMetrics.recall < 0.90) {
        prismaGatePassed = false;
        gateReasons.push(`Stage 2 Recall Target Failed: Recall is ${(overallMetrics.recall * 100).toFixed(1)}% (target >= 90%).`);
      }
    } else if (stageNum === 3) {
      if (overallMetrics.kappa < 0.65) {
        prismaGatePassed = false;
        gateReasons.push(`Stage 3 Weighted Kappa Target Failed: Kappa is ${overallMetrics.kappa.toFixed(3)} (target >= 0.650).`);
      }
    } else if (stageNum === 4) {
      if (overallMetrics.accuracy_pct < 100) {
        prismaGatePassed = false;
        gateReasons.push(`Stage 4 Schema Conformance Target Failed: Schema match is ${overallMetrics.accuracy_pct}% (target 100%).`);
      }
    }

    const summaryPayload = {
      ...overallMetrics,
      train_metrics: trainMetrics,
      prisma_gate_passed: prismaGatePassed,
      gate_reasons: gateReasons
    };

    // 9. Update Final Benchmark Run Record
    db.prepare(`
      UPDATE prompt_benchmark_runs 
      SET status = 'COMPLETED', evaluated_papers = ?, summary_metrics = ?, holdout_metrics = ?, updated_at = ?
      WHERE id = ?
    `).run(evaluatedCount, JSON.stringify(summaryPayload), JSON.stringify(holdoutMetrics), new Date().toISOString(), runId);

    // Update project current spend
    try {
      db.prepare(`
        UPDATE projects 
        SET project_current_spend = COALESCE(project_current_spend, 0.0) + ? 
        WHERE CAST(id AS TEXT) = CAST(? AS TEXT)
      `).run(totalCostUsd, projectId);
    } catch (e) {}

    // Find preceding completed benchmark run for delta comparison
    const prevCompletedRun = db.prepare(`
      SELECT * FROM prompt_benchmark_runs 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) 
        AND stage_num = ?
        AND status = 'COMPLETED'
        AND id != ?
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(projectId, projectId, stageNum, runId) as any;

    const previousRunMetrics = prevCompletedRun ? safeJsonParse(prevCompletedRun.summary_metrics, null) : null;
    const previousHoldoutMetrics = prevCompletedRun ? safeJsonParse(prevCompletedRun.holdout_metrics, null) : null;
    const improvementMetrics = prevCompletedRun ? calculateImprovementMetrics(
      summaryPayload,
      previousRunMetrics,
      holdoutMetrics,
      previousHoldoutMetrics,
      prevCompletedRun
    ) : null;

    return NextResponse.json({
      success: true,
      run_id: runId,
      stage_num: stageNum,
      stage_name: stageMeta.name,
      total_evaluated: evaluatedCount,
      summary_metrics: summaryPayload,
      holdout_metrics: holdoutMetrics,
      previous_run: prevCompletedRun ? {
        ...prevCompletedRun,
        summary_metrics: previousRunMetrics,
        holdout_metrics: previousHoldoutMetrics
      } : null,
      improvement_metrics: improvementMetrics,
      usage: {
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_cost_usd: totalCostUsd
      }
    });
  } catch (err: any) {
    console.error('Failed to execute prompt benchmark:', err);
    return NextResponse.json({ error: sanitizeApiKey(err.message) }, { status: 500 });
  }
}
