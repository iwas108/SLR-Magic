import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hasSessionMasterPassword, sanitizeApiKey } from '@/lib/session';
import { PromptType, DEFAULT_STAGE_SCHEMAS } from '@/lib/services/prompt-validator';
import { hydrateTemplate } from '@/lib/services/prompt-hydrator';

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

/**
 * Estimate token count using robust character-to-token heuristic (~4 chars/token)
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { project_id: projectId, preview_type = 'consolidation_audit', stage_num: rawStageNum } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing required field: project_id' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: `Project '${projectId}' not found.` }, { status: 404 });
    }

    const vaultUnlocked = hasSessionMasterPassword();

    // -------------------------------------------------------------
    // 1. Consolidation Audit Payload Preview (Quest 1)
    // -------------------------------------------------------------
    if (preview_type === 'consolidation_audit') {
      const s1Prompt = resolveStagePrompt(projectId, 'fast_filter');
      const s2Prompt = resolveStagePrompt(projectId, 'gatekeeper');
      const s3Prompt = resolveStagePrompt(projectId, 'scientist');
      const s4Prompt = resolveStagePrompt(projectId, 'miner');

      const availableCount = [s1Prompt, s2Prompt, s3Prompt, s4Prompt].filter(Boolean).length;

      let auditTemplate = db.prepare(`
        SELECT * FROM prompt_templates 
        WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id IS NULL) 
          AND prompt_type = 'consolidation_audit' 
          AND is_active = 1 
        ORDER BY CASE WHEN CAST(project_id AS TEXT) = CAST(? AS TEXT) THEN 0 ELSE 1 END, created_at DESC 
        LIMIT 1
      `).get(projectId, projectId) as any;

      if (!auditTemplate) {
        return NextResponse.json({
          error: "No active 'consolidation_audit' prompt template found in Prompt Library."
        }, { status: 400 });
      }

      const auditLlmConfig = safeJsonParse(auditTemplate.llm_config, {});
      const modelId = auditLlmConfig.model_id || 'gemini-2.5-flash';
      const cleanModelName = modelId.replace(/^models\//, '');
      const temperature = typeof auditLlmConfig.temperature === 'number' ? auditLlmConfig.temperature : 0.0;
      const maxTokens = auditLlmConfig.max_tokens || 4000;
      const topP = typeof auditLlmConfig.top_p === 'number' ? auditLlmConfig.top_p : undefined;
      const topK = typeof auditLlmConfig.top_k === 'number' ? auditLlmConfig.top_k : undefined;
      const speedMode = (auditLlmConfig.execution_mode || 'STANDARD').toUpperCase();

      // Hydrate audit prompt
      const hydrationContext = {
        project: {
          name: project.name || 'Unnamed SLR Project',
          objective: project.objective || 'Not specified',
          manifesto: project.manifesto || 'Not specified',
          questions: project.questions || 'Not specified',
          qa_rules: project.pool_c_qa_rules || 'Standard QA Rules',
          ec_rules: project.pool_b_ec_rules || project.ec_rules || 'Standard EC Rules',
        },
        custom: {
          s1_system_instruction: s1Prompt?.system_instruction || '',
          s1_user_template: s1Prompt?.user_template || '',
          s2_system_instruction: s2Prompt?.system_instruction || '',
          s2_user_template: s2Prompt?.user_template || '',
          s3_system_instruction: s3Prompt?.system_instruction || '',
          s3_user_template: s3Prompt?.user_template || '',
          s4_system_instruction: s4Prompt?.system_instruction || '',
          s4_user_template: s4Prompt?.user_template || '',
        }
      };

      const hydratedUserPrompt = hydrateTemplate(auditTemplate.user_template, hydrationContext);
      const systemInstruction = auditTemplate.system_instruction || '';
      const parsedResponseSchema = safeJsonParse(auditTemplate.response_schema, DEFAULT_STAGE_SCHEMAS.consolidation_audit);

      // Pricing & Token Estimations
      const pricingRow = db.prepare('SELECT * FROM llm_pricing WHERE model_id = ?').get(cleanModelName) as any;
      const inputPrice = pricingRow ? Number(pricingRow.input_token_price) : 0.075;
      const outputPrice = pricingRow ? Number(pricingRow.output_token_price) : 0.30;
      const defaultBatchDiscount = pricingRow?.batch_discount !== undefined ? Number(pricingRow.batch_discount) : 0.5;
      const discountRate = typeof auditLlmConfig.discount === 'number' ? auditLlmConfig.discount : (speedMode === 'FLEX' ? defaultBatchDiscount : 0.0);
      const projectTax = Number(project?.project_tax || 0.0);

      const estimatedInputTokens = estimateTokens(systemInstruction) + estimateTokens(hydratedUserPrompt);
      const estimatedOutputTokens = Math.min(maxTokens, 1500); // Standard expected output size for audit report
      const rawCost = ((estimatedInputTokens / 1_000_000) * inputPrice) + ((estimatedOutputTokens / 1_000_000) * outputPrice);
      const estimatedCostUsd = rawCost * (1 - discountRate) * (1 + projectTax);

      return NextResponse.json({
        preview_type: 'consolidation_audit',
        action_title: 'Quest 01: Inter-Stage Consolidation Audit',
        vault_unlocked: vaultUnlocked,
        model_id: cleanModelName,
        system_instruction: systemInstruction,
        hydrated_user_prompt: hydratedUserPrompt,
        generation_config: {
          temperature,
          max_output_tokens: maxTokens,
          top_p: topP,
          top_k: topK,
          execution_mode: speedMode,
          thinking_level: auditLlmConfig.thinking_level || 'standard'
        },
        response_schema: parsedResponseSchema,
        stage_prompts: [
          { stage: 1, type: 'fast_filter', name: s1Prompt?.name || 'Stage 1 Prompt', id: s1Prompt?.id, available: !!s1Prompt },
          { stage: 2, type: 'gatekeeper', name: s2Prompt?.name || 'Stage 2 Prompt', id: s2Prompt?.id, available: !!s2Prompt },
          { stage: 3, type: 'scientist', name: s3Prompt?.name || 'Stage 3 Prompt', id: s3Prompt?.id, available: !!s3Prompt },
          { stage: 4, type: 'miner', name: s4Prompt?.name || 'Stage 4 Prompt', id: s4Prompt?.id, available: !!s4Prompt },
        ],
        available_count: availableCount,
        metrics: {
          estimated_input_tokens: estimatedInputTokens,
          estimated_output_tokens: estimatedOutputTokens,
          estimated_total_tokens: estimatedInputTokens + estimatedOutputTokens,
          estimated_cost_usd: Number(estimatedCostUsd.toFixed(5)),
          total_calls: 1
        }
      });
    }

    // -------------------------------------------------------------
    // 2. Stage Benchmark Sandbox Payload Preview (Quests 2–5)
    // -------------------------------------------------------------
    const stageNum = parseInt(rawStageNum || '1', 10);
    const stageMeta = STAGE_CONFIG[stageNum] || STAGE_CONFIG[1];

    // Fetch adjudicated papers in target pool
    const papersWithGold = db.prepare(`
      SELECT 
        COALESCE(cp.Paper_ID, p.Paper_ID) as Paper_ID,
        COALESCE(cp.Title, p.Title) as Title,
        COALESCE(cp.Abstract, p.Abstract) as Abstract,
        COALESCE(cp.Authors, p.Authors) as Authors,
        COALESCE(cp.Year, p.Year) as Year,
        COALESCE(cp.DOI, p.DOI) as DOI,
        COALESCE(cp.Local_PDF_Path, p.Local_PDF_Path) as Local_PDF_Path,
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
        error: `No adjudicated papers found in ${stageMeta.pool} for Stage ${stageNum}. Please ensure calibration papers are reviewed and committed in the Calibration view first.`
      }, { status: 400 });
    }

    const stagePrompt = resolveStagePrompt(projectId, stageMeta.type);
    if (!stagePrompt) {
      return NextResponse.json({
        error: `No active prompt template found for ${stageMeta.name} in Prompt Library.`
      }, { status: 400 });
    }

    const promptConfig = safeJsonParse(stagePrompt.llm_config, {});
    const modelId = promptConfig.model_id || 'gemini-2.5-flash';
    const cleanModelName = modelId.replace(/^models\//, '');
    const temperature = typeof promptConfig.temperature === 'number' ? promptConfig.temperature : 0.0;
    const maxTokens = promptConfig.max_tokens || 4000;
    const topP = typeof promptConfig.top_p === 'number' ? promptConfig.top_p : undefined;
    const topK = typeof promptConfig.top_k === 'number' ? promptConfig.top_k : undefined;
    const speedMode = (promptConfig.execution_mode || 'STANDARD').toUpperCase();
    const concurrency = Math.max(1, Number(promptConfig.concurrency ?? 2));
    const delayMs = promptConfig.request_delay !== undefined && promptConfig.request_delay !== null
      ? (Number(promptConfig.request_delay) > 10 ? Number(promptConfig.request_delay) : Math.max(0, Number(promptConfig.request_delay) * 1000))
      : 400;

    const parsedResponseSchema = safeJsonParse(stagePrompt.response_schema, DEFAULT_STAGE_SCHEMAS[stageMeta.type] || {});
    const systemInstruction = stagePrompt.system_instruction || '';

    // Partition
    const totalPapers = papersWithGold?.length || 0;
    const trainCount = totalPapers >= 5 ? Math.max(1, Math.round(totalPapers * 0.7)) : totalPapers;
    const holdoutCount = totalPapers - trainCount;

    // Generate Hydrated Prompt Samples for all papers in pool
    let totalEstimatedInputTokens = 0;
    const paperSamples = (papersWithGold || []).map((paper, idx) => {
      const isTrain = idx < trainCount;
      const hydrationContext = {
        project: {
          name: project.name || 'Unnamed SLR Project',
          objective: project.objective || 'Not specified',
          manifesto: project.manifesto || 'Not specified',
          questions: project.questions || 'Not specified',
          qa_rules: project.pool_c_qa_rules || 'Standard QA Rules',
          ec_rules: project.pool_b_ec_rules || project.ec_rules || 'Standard EC Rules',
          extraction_rules: project.pool_c_extraction_rules || 'Standard Extraction Rules'
        },
        paper: {
          id: paper.Paper_ID,
          title: paper.Title || '',
          abstract: paper.Abstract || '',
          authors: paper.Authors || '',
          year: paper.Year || '',
          doi: paper.DOI || '',
          source: paper.Source || '',
          local_pdf_path: paper.Local_PDF_Path || ''
        }
      };

      const hydratedPrompt = hydrateTemplate(stagePrompt.user_template, hydrationContext);
      const paperInputTokens = estimateTokens(systemInstruction) + estimateTokens(hydratedPrompt);
      totalEstimatedInputTokens += paperInputTokens;

      return {
        paper_id: paper.Paper_ID,
        title: paper.Title || 'No Title Available',
        authors: paper.Authors || 'Unknown Authors',
        year: paper.Year || '',
        partition: isTrain ? ('train' as const) : ('holdout' as const),
        gold_decision: paper.gold_decision || 'Unadjudicated',
        gold_exclusion_code: paper.gold_exclusion_code || 'NONE',
        gold_rationale: paper.gold_rationale || '',
        hydrated_user_prompt: hydratedPrompt,
        estimated_input_tokens: paperInputTokens
      };
    });

    // Pricing & Batch Cost Calculation
    const pricingRow = db.prepare('SELECT * FROM llm_pricing WHERE model_id = ?').get(cleanModelName) as any;
    const inputPrice = pricingRow ? Number(pricingRow.input_token_price) : 0.075;
    const outputPrice = pricingRow ? Number(pricingRow.output_token_price) : 0.30;
    const defaultBatchDiscount = pricingRow?.batch_discount !== undefined ? Number(pricingRow.batch_discount) : 0.5;
    const discountRate = typeof promptConfig.discount === 'number' ? promptConfig.discount : (speedMode === 'FLEX' ? defaultBatchDiscount : 0.0);
    const projectTax = Number(project?.project_tax || 0.0);

    const avgOutputTokens = Math.min(maxTokens, stageNum === 4 ? 2000 : 800);
    const totalEstimatedOutputTokens = avgOutputTokens * Math.max(1, totalPapers);
    const rawCost = ((totalEstimatedInputTokens / 1_000_000) * inputPrice) + ((totalEstimatedOutputTokens / 1_000_000) * outputPrice);
    const estimatedCostUsd = rawCost * (1 - discountRate) * (1 + projectTax);

    return NextResponse.json({
      preview_type: 'stage_benchmark',
      stage_num: stageNum,
      stage_name: stageMeta.name,
      pool_name: stageMeta.pool,
      action_title: `Quest 0${stageNum + 1}: ${stageMeta.name} Benchmark (${stageMeta.pool})`,
      vault_unlocked: vaultUnlocked,
      model_id: cleanModelName,
      system_instruction: systemInstruction,
      generation_config: {
        temperature,
        max_output_tokens: maxTokens,
        top_p: topP,
        top_k: topK,
        concurrency,
        delay_ms: delayMs,
        execution_mode: speedMode,
        thinking_level: promptConfig.thinking_level || 'standard',
        thinking_budget: promptConfig.thinking_budget
      },
      response_schema: parsedResponseSchema,
      paper_samples: paperSamples,
      partition_summary: {
        total_papers: totalPapers,
        train_count: trainCount,
        holdout_count: holdoutCount
      },
      metrics: {
        estimated_input_tokens: totalEstimatedInputTokens,
        estimated_output_tokens: totalEstimatedOutputTokens,
        estimated_total_tokens: totalEstimatedInputTokens + totalEstimatedOutputTokens,
        estimated_cost_usd: Number(estimatedCostUsd.toFixed(5)),
        total_calls: totalPapers
      }
    });
  } catch (err: any) {
    console.error('Error generating payload preview:', err);
    return NextResponse.json({ error: sanitizeApiKey(err.message) }, { status: 500 });
  }
}
