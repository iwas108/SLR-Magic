import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db, { getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword, sanitizeApiKey } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import { validatePromptSchema, PromptType, DEFAULT_STAGE_SCHEMAS } from '@/lib/services/prompt-validator';
import { hydrateTemplate } from '@/lib/services/prompt-hydrator';
import { pipelineLock } from '@/lib/services/pipeline-lock';
import { resolveGeminiThinkingConfig } from '@/lib/gemini-thinking-specs';

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

/**
 * Resolve active prompt template for a specific stage
 */
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId parameter' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: `Project '${projectId}' not found` }, { status: 404 });
    }

    // 1. Resolve 4 stage prompts
    const s1Prompt = resolveStagePrompt(projectId, 'fast_filter');
    const s2Prompt = resolveStagePrompt(projectId, 'gatekeeper');
    const s3Prompt = resolveStagePrompt(projectId, 'scientist');
    const s4Prompt = resolveStagePrompt(projectId, 'miner');

    const promptAvailability = {
      fast_filter: { available: !!s1Prompt, id: s1Prompt?.id, name: s1Prompt?.name, prompt_type: 'fast_filter' },
      gatekeeper: { available: !!s2Prompt, id: s2Prompt?.id, name: s2Prompt?.name, prompt_type: 'gatekeeper' },
      scientist: { available: !!s3Prompt, id: s3Prompt?.id, name: s3Prompt?.name, prompt_type: 'scientist' },
      miner: { available: !!s4Prompt, id: s4Prompt?.id, name: s4Prompt?.name, prompt_type: 'miner' },
      total_available: [s1Prompt, s2Prompt, s3Prompt, s4Prompt].filter(Boolean).length
    };

    // 2. Fetch latest audit run from prompt_audit_ledger
    const latestAudit = db.prepare(`
      SELECT * FROM prompt_audit_ledger 
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) 
        AND audit_type = 'consolidation_audit'
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(projectId) as any;

    let parsedAuditReport = null;
    if (latestAudit && latestAudit.audit_report) {
      parsedAuditReport = safeJsonParse(latestAudit.audit_report, null);
    }

    return NextResponse.json({
      project_id: projectId,
      prompt_availability: promptAvailability,
      latest_audit: latestAudit ? {
        ...latestAudit,
        audit_report: parsedAuditReport,
        train_paper_ids: safeJsonParse(latestAudit.train_paper_ids, []),
        holdout_paper_ids: safeJsonParse(latestAudit.holdout_paper_ids, [])
      } : null
    });
  } catch (err: any) {
    console.error('Error fetching stage audit status:', err);
    return NextResponse.json({ error: sanitizeApiKey(err.message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { project_id: projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing required field: project_id' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: `Project '${projectId}' not found.` }, { status: 404 });
    }

    // 1. Pre-flight check: Pipeline Lock
    if (pipelineLock.isLocked()) {
      return NextResponse.json({ 
        error: 'Another pipeline task is currently running. Please wait for it to complete.' 
      }, { status: 409 });
    }

    // 2. Pre-flight check: Vault Authentication
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault in Settings to run Inter-Stage Audit.' }, { status: 401 });
    }

    const password = getSessionMasterPassword();
    const keyRow = getVaultKey('GEMINI_API_KEY');
    if (!keyRow || !password) {
      return NextResponse.json({ error: 'Gemini API Key is not configured in the vault. Please set it in Settings.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Failed to decrypt Gemini API Key. Master password may be invalid. Vault locked.' }, { status: 401 });
    }

    // 3. Resolve 4 stage prompts
    const s1Prompt = resolveStagePrompt(projectId, 'fast_filter');
    const s2Prompt = resolveStagePrompt(projectId, 'gatekeeper');
    const s3Prompt = resolveStagePrompt(projectId, 'scientist');
    const s4Prompt = resolveStagePrompt(projectId, 'miner');

    const availableCount = [s1Prompt, s2Prompt, s3Prompt, s4Prompt].filter(Boolean).length;
    if (availableCount < 4) {
      return NextResponse.json({
        error: `Incomplete pipeline prompt suite. Only ${availableCount}/4 stage prompts are configured. Please assign prompts for all 4 stages in the Prompt Library.`
      }, { status: 400 });
    }

    // 4. Resolve Consolidation Audit Prompt Template
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

    // 5. Pre-flight check: Project Budget Limit
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

    // 6. Dynamic LLM Config Parsing from auditTemplate
    const auditLlmConfig = safeJsonParse(auditTemplate.llm_config, {});
    const modelId = auditLlmConfig.model_id || 'gemini-2.5-flash';
    const cleanModelName = modelId.replace(/^models\//, '');
    const temperature = typeof auditLlmConfig.temperature === 'number' ? auditLlmConfig.temperature : 0.0;
    const maxTokens = auditLlmConfig.max_tokens ?? auditLlmConfig.max_output_tokens ?? 4000;
    const topP = typeof auditLlmConfig.top_p === 'number' ? auditLlmConfig.top_p : (auditLlmConfig.top_p !== undefined ? Number(auditLlmConfig.top_p) : undefined);
    const topK = typeof auditLlmConfig.top_k === 'number' ? auditLlmConfig.top_k : (auditLlmConfig.top_k !== undefined ? Number(auditLlmConfig.top_k) : undefined);
    const timeoutSeconds = auditLlmConfig.timeout_seconds ? Number(auditLlmConfig.timeout_seconds) : 900;
    const speedMode = (auditLlmConfig.execution_mode || 'STANDARD').toUpperCase();

    // 7. Hydrate Audit User Template
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
        s1_system_instruction: s1Prompt.system_instruction || '',
        s1_user_template: s1Prompt.user_template || '',
        s2_system_instruction: s2Prompt.system_instruction || '',
        s2_user_template: s2Prompt.user_template || '',
        s3_system_instruction: s3Prompt.system_instruction || '',
        s3_user_template: s3Prompt.user_template || '',
        s4_system_instruction: s4Prompt.system_instruction || '',
        s4_user_template: s4Prompt.user_template || '',
      }
    };

    const hydratedUserPrompt = hydrateTemplate(auditTemplate.user_template, hydrationContext);
    const systemInstruction = auditTemplate.system_instruction || '';
    const parsedResponseSchema = safeJsonParse(auditTemplate.response_schema, DEFAULT_STAGE_SCHEMAS.consolidation_audit);

    // 8. Execute Gemini API Call adhering 100% to Prompt llm_config
    const startTime = Date.now();
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

    const thinkingConfig = resolveGeminiThinkingConfig(cleanModelName, auditLlmConfig.thinking_level);
    if (thinkingConfig) {
      generationConfig.thinkingConfig = thinkingConfig;
    }

    const apiPayload = {
      contents: [{ role: 'user', parts: [{ text: hydratedUserPrompt }] }],
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig
    };

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutSeconds * 1000);

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
        signal: abortController.signal
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        return NextResponse.json({ error: `Gemini audit request timed out after ${timeoutSeconds}s.` }, { status: 504 });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    const rawResult = await response.json();
    if (!response.ok) {
      const errorMsg = rawResult?.error?.message || `Gemini API returned status ${response.status}`;
      return NextResponse.json({ error: sanitizeApiKey(errorMsg) }, { status: response.status });
    }

    const candidate = rawResult.candidates?.[0];
    const outputText = candidate?.content?.parts?.[0]?.text || '';
    const usageMetadata = rawResult.usageMetadata || {};

    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || (inputTokens + outputTokens);

    let structuredAudit: any = null;
    try {
      structuredAudit = JSON.parse(outputText);
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to parse structured audit JSON from LLM: ${e.message}` }, { status: 500 });
    }

    // 9. Pricing Calculation
    const pricingRow = db.prepare('SELECT * FROM llm_pricing WHERE model_id = ?').get(cleanModelName) as any;
    const inputPrice = pricingRow ? Number(pricingRow.input_token_price) : 0.075;
    const outputPrice = pricingRow ? Number(pricingRow.output_token_price) : 0.30;
    const defaultBatchDiscount = pricingRow?.batch_discount !== undefined ? Number(pricingRow.batch_discount) : 0.5;
    const discountRate = typeof auditLlmConfig.discount === 'number' ? auditLlmConfig.discount : (speedMode === 'FLEX' ? defaultBatchDiscount : 0.0);
    const projectTax = Number(project?.project_tax || 0.0);

    const rawCost = ((inputTokens / 1_000_000) * inputPrice) + ((outputTokens / 1_000_000) * outputPrice);
    const costAfterDiscount = rawCost * (1 - discountRate);
    const finalCostUsd = costAfterDiscount * (1 + projectTax);

    // 10. Compute Aggregate Scores
    const availabilityScore = (availableCount / 4) * 100;
    const semanticPassedCount = structuredAudit.semantic_alignment_evaluation?.semantic_passed_count ?? 4;
    const semanticScore = (semanticPassedCount / 4) * 100;
    const chainabilityPassedCount = structuredAudit.chainability_and_consistency?.chainability_passed_count ?? 5;
    const chainabilityScore = (chainabilityPassedCount / 5) * 100;
    const overallStatus = structuredAudit.overall_status || (availabilityScore === 100 && semanticScore >= 75 && chainabilityScore >= 80 ? 'PASSED' : 'WARNING');

    // 11. Persist to prompt_audit_ledger
    const auditId = `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO prompt_audit_ledger (
        id, project_id, audit_type, status, prompt_id, availability_score,
        semantic_score, chainability_score, audit_report, raw_prompt, raw_response,
        model_id, input_tokens, output_tokens, cost_usd, created_at
      ) VALUES (?, ?, 'consolidation_audit', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      projectId,
      overallStatus,
      auditTemplate.id,
      availabilityScore,
      semanticScore,
      chainabilityScore,
      JSON.stringify(structuredAudit),
      hydratedUserPrompt,
      outputText,
      cleanModelName,
      inputTokens,
      outputTokens,
      finalCostUsd,
      now
    );

    // 12. Persist to immutable llm_audit_log
    const promptHash = crypto.createHash('sha256').update((auditTemplate.system_instruction || '') + (hydratedUserPrompt || '')).digest('hex');
    const latencyMs = Date.now() - startTime;
    try {
      db.prepare(`
        INSERT INTO llm_audit_log (
          project_id, paper_id, job_id, interaction_id, model_id, task_type,
          input_tokens, output_tokens, thinking_tokens, total_tokens,
          cost_usd, flex_discount, speed_mode, prompt_hash, raw_prompt, raw_response,
          response_schema_name, structured_output, status, latency_ms, api_version, created_at
        ) VALUES (?, ?, ?, ?, ?, 'consolidation_audit', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'consolidation_audit_schema', ?, ?, ?, 'google-genai-2.5-rest', ?)
      `).run(
        projectId,
        null,
        auditId,
        `audit-int-${crypto.randomBytes(4).toString('hex')}`,
        cleanModelName,
        inputTokens,
        outputTokens,
        totalTokens,
        finalCostUsd,
        discountRate,
        speedMode,
        promptHash,
        hydratedUserPrompt,
        outputText,
        JSON.stringify(structuredAudit),
        overallStatus === 'FAILED' ? 'ERROR' : 'SUCCESS',
        latencyMs,
        now
      );
    } catch (auditErr) {
      console.error('Failed to log stage-audit interaction to llm_audit_log:', auditErr);
    }

    // Update project current spend
    try {
      db.prepare(`
        UPDATE projects 
        SET project_current_spend = COALESCE(project_current_spend, 0.0) + ? 
        WHERE CAST(id AS TEXT) = CAST(? AS TEXT)
      `).run(finalCostUsd, projectId);
    } catch (e) {}

    return NextResponse.json({
      success: true,
      audit_id: auditId,
      status: overallStatus,
      scores: {
        availability_score: availabilityScore,
        semantic_score: semanticScore,
        chainability_score: chainabilityScore,
        available_count: availableCount,
        semantic_passed_count: semanticPassedCount,
        chainability_passed_count: chainabilityPassedCount
      },
      report: structuredAudit,
      usage: {
        model_id: cleanModelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: finalCostUsd,
        latency_ms: Date.now() - startTime
      }
    });
  } catch (err: any) {
    console.error('Failed to run inter-stage consolidation audit:', err);
    return NextResponse.json({ error: sanitizeApiKey(err.message) }, { status: 500 });
  }
}
