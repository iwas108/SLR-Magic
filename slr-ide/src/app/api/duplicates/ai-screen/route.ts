import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db, { getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword, sanitizeApiKey } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import { validatePromptSchema } from '@/lib/services/prompt-validator';
import { pipelineLock } from '@/lib/services/pipeline-lock';
import { resolveGeminiThinkingConfig } from '@/lib/gemini-thinking-specs';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pair_id, project_id: reqProjectId, template_id: reqTemplateId } = body;

    if (!pair_id) {
      return NextResponse.json({ error: 'Missing required field: pair_id' }, { status: 400 });
    }

    // 1. Resolve duplicate pair & project
    const pair = db.prepare('SELECT * FROM duplicate_pairs WHERE id = ?').get(pair_id) as any;
    if (!pair) {
      return NextResponse.json({ error: 'Duplicate pair not found.' }, { status: 404 });
    }

    const activeProjectRow = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
    const projectId = pair.project_id || reqProjectId || activeProjectRow?.value || '';

    if (!projectId) {
      return NextResponse.json({ error: 'No active Project ID found.' }, { status: 400 });
    }

    // 2. Fetch paper 1 and paper 2 with project isolation
    const paper1 = db.prepare('SELECT * FROM papers WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))').get(pair.paper1_id, projectId, projectId) as any;
    const paper2 = db.prepare('SELECT * FROM papers WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))').get(pair.paper2_id, projectId, projectId) as any;

    if (!paper1 || !paper2) {
      return NextResponse.json({ error: 'One or both candidate papers not found in database.' }, { status: 404 });
    }

    // 3. Pre-flight check: Pipeline Lock
    if (pipelineLock.isLocked()) {
      return NextResponse.json({ 
        error: 'Another pipeline is currently running. Please wait for it to complete.' 
      }, { status: 409 });
    }

    // 4. Pre-flight check: Vault Authentication
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault in Settings to run AI Duplicate Screening.' }, { status: 401 });
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
      return NextResponse.json({ error: 'Failed to decrypt Gemini API Key. Master password may be invalid or corrupt. Vault locked.' }, { status: 401 });
    }

    // 5. Pre-flight check: Prompt Template Resolution
    let templateId = reqTemplateId;
    const project = db.prepare('SELECT * FROM projects WHERE id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId, projectId) as any;

    if (!templateId && project && project.llm_config) {
      try {
        const pCfg = JSON.parse(project.llm_config);
        templateId = pCfg.default_prompts?.duplicate_review;
      } catch (e) {}
    }

    let template: any = null;
    if (templateId) {
      template = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(templateId);
    }

    // Fallback: active duplicate_review template for project or global
    if (!template) {
      template = db.prepare(`
        SELECT * FROM prompt_templates 
        WHERE ((project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) OR project_id IS NULL) 
          AND prompt_type = 'duplicate_review' 
          AND is_active = 1 
        ORDER BY CASE WHEN (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) THEN 0 ELSE 1 END, created_at DESC 
        LIMIT 1
      `).get(projectId, projectId, projectId, projectId);
    }

    if (!template) {
      return NextResponse.json({
        error: "No active 'duplicate_review' prompt template found in Prompt Library. Please create or configure one in the Prompt Library."
      }, { status: 400 });
    }

    const valResult = validatePromptSchema('duplicate_review', template.response_schema);
    if (!valResult.isValid) {
      return NextResponse.json({
        error: `Selected prompt template baseline schema validation failed: ${valResult.error}`
      }, { status: 400 });
    }

    // 6. Pre-flight check: Project Budget Limit
    const budgetLimit = Number(project?.project_budget_limit || 0);
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
        WHERE p.id = ? OR CAST(p.id AS TEXT) = CAST(? AS TEXT)
      `).get(projectId, projectId, projectId, projectId) as { current_spend: number } | undefined;

      const currentSpend = Number(currentSpendRow?.current_spend || 0);
      if (currentSpend >= budgetLimit) {
        return NextResponse.json({
          error: `Project budget limit exceeded. Current Spend: $${currentSpend.toFixed(4)}, Limit: $${budgetLimit.toFixed(4)}`
        }, { status: 400 });
      }
    }

    // 7. Parse LLM configuration
    let llmConfig: any = {};
    try {
      llmConfig = template.llm_config ? JSON.parse(template.llm_config) : {};
    } catch (e) {
      llmConfig = {};
    }

    const modelId = llmConfig.model_id || 'gemini-2.5-flash';
    const cleanModelName = modelId.startsWith('models/') ? modelId.slice(7) : modelId;
    const temperature = typeof llmConfig.temperature === 'number' ? llmConfig.temperature : 0.0;
    const maxTokens = typeof llmConfig.max_tokens === 'number' ? llmConfig.max_tokens : 2000;
    const topP = typeof llmConfig.top_p === 'number' ? llmConfig.top_p : 0.9;
    const topK = typeof llmConfig.top_k === 'number' ? llmConfig.top_k : 40;
    const thinkingLevel = (llmConfig.thinking_level || 'none').toLowerCase();
    const speedMode = (llmConfig.execution_mode || 'flex').toUpperCase();
    const timeoutSeconds = typeof llmConfig.timeout_seconds === 'number' ? llmConfig.timeout_seconds : 900;

    // 8. Compile user prompt template
    const userPrompt = (template.user_template || '')
      .replace(/\{\{\s*paper1_id\s*\}\}/g, paper1.Paper_ID || '')
      .replace(/\{\{\s*paper1_title\s*\}\}/g, paper1.Title || '')
      .replace(/\{\{\s*paper1_doi\s*\}\}/g, paper1.DOI || 'None')
      .replace(/\{\{\s*paper1_year\s*\}\}/g, String(paper1.Year || 'N/A'))
      .replace(/\{\{\s*paper1_authors\s*\}\}/g, paper1.Authors || 'None')
      .replace(/\{\{\s*paper1_abstract\s*\}\}/g, paper1.Abstract || 'None')
      .replace(/\{\{\s*paper2_id\s*\}\}/g, paper2.Paper_ID || '')
      .replace(/\{\{\s*paper2_title\s*\}\}/g, paper2.Title || '')
      .replace(/\{\{\s*paper2_doi\s*\}\}/g, paper2.DOI || 'None')
      .replace(/\{\{\s*paper2_year\s*\}\}/g, String(paper2.Year || 'N/A'))
      .replace(/\{\{\s*paper2_authors\s*\}\}/g, paper2.Authors || 'None')
      .replace(/\{\{\s*paper2_abstract\s*\}\}/g, paper2.Abstract || 'None');

    const systemPrompt = template.system_instruction || '';
    const parsedResponseSchema = JSON.parse(template.response_schema);

    // Build thinkingConfig strictly adhering to model specs
    const thinkingConfig = resolveGeminiThinkingConfig(cleanModelName, thinkingLevel);

    // 9. Execute Google GenAI REST API Call with timeout and strict config
    const startTime = Date.now();
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${geminiApiKey}`;

    const generationConfig: Record<string, any> = {
      temperature,
      maxOutputTokens: maxTokens,
      topP,
      topK,
      responseMimeType: 'application/json',
      responseSchema: parsedResponseSchema
    };

    if (thinkingConfig) {
      generationConfig.thinkingConfig = thinkingConfig;
    }

    const apiPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: systemPrompt ? {
        parts: [{ text: systemPrompt }]
      } : undefined,
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
        return NextResponse.json({
          error: `Gemini API request timed out after ${timeoutSeconds} seconds (configured in prompt LLM settings).`
        }, { status: 504 });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startTime;
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
    const thinkingTokens = usageMetadata.thinkingTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || (inputTokens + outputTokens + thinkingTokens);

    let structuredOutput: any = null;
    try {
      structuredOutput = JSON.parse(outputText);
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to parse structured JSON from LLM: ${e.message}` }, { status: 500 });
    }

    // 10. Calculate token cost with model pricing and prompt-configured discount rate
    const pricingRow = db.prepare('SELECT * FROM llm_pricing WHERE model_id = ?').get(cleanModelName) as any;
    const inputPrice = pricingRow ? Number(pricingRow.input_token_price) : 0.075;
    const outputPrice = pricingRow ? Number(pricingRow.output_token_price) : 0.30;
    const thinkingPrice = pricingRow?.thinking_token_price ? Number(pricingRow.thinking_token_price) : outputPrice;
    const defaultBatchDiscount = pricingRow?.batch_discount !== undefined ? Number(pricingRow.batch_discount) : 0.5;

    const discountRate = typeof llmConfig.discount === 'number' 
      ? llmConfig.discount 
      : (speedMode === 'FLEX' ? defaultBatchDiscount : 0.0);

    const projectTax = Number(project?.project_tax || 0.0);

    const rawCost = (inputTokens / 1_000_000.0) * inputPrice 
                  + (outputTokens / 1_000_000.0) * outputPrice 
                  + (thinkingTokens / 1_000_000.0) * thinkingPrice;

    const discountedCost = rawCost * (1.0 - Math.min(1.0, Math.max(0.0, discountRate)));
    const costUsd = discountedCost * (1.0 + projectTax);

    const promptHash = crypto.createHash('sha256').update(userPrompt).digest('hex');

    // 11. Write to llm_audit_log
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO llm_audit_log (
        project_id, paper_id, model_id, task_type,
        input_tokens, output_tokens, thinking_tokens, total_tokens,
        cost_usd, flex_discount, speed_mode, prompt_hash, raw_prompt, raw_response,
        response_schema_name, structured_output, status, latency_ms, api_version, created_at
      ) VALUES (?, ?, ?, 'duplicate_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, 'v1beta', ?)
    `).run(
      projectId,
      `${pair.paper1_id},${pair.paper2_id}`,
      cleanModelName,
      inputTokens,
      outputTokens,
      thinkingTokens,
      totalTokens,
      costUsd,
      discountRate,
      speedMode,
      promptHash,
      userPrompt,
      outputText,
      'duplicate_review',
      JSON.stringify(structuredOutput),
      latencyMs,
      now
    );

    // 12. Update duplicate_pairs record with AI findings
    const verdict = structuredOutput.verdict || 'FALSE FLAG';
    const suggestedPrimaryId = structuredOutput.database_execution?.recommended_primary_paper_id || null;
    const analysisJson = JSON.stringify({
      primary_action: structuredOutput.primary_action,
      technical_breakdown: structuredOutput.technical_breakdown,
      database_execution: structuredOutput.database_execution
    });

    db.prepare(`
      UPDATE duplicate_pairs
      SET ai_verdict = ?, ai_analysis = ?, ai_suggested_primary_id = ?
      WHERE id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
    `).run(verdict, analysisJson, suggestedPrimaryId, pair_id, projectId, projectId);

    // 13. Atomically update project_current_spend
    db.prepare(`
      UPDATE projects 
      SET project_current_spend = project_current_spend + ? 
      WHERE id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT)
    `).run(costUsd, projectId, projectId);

    return NextResponse.json({
      success: true,
      verdict,
      suggested_primary_id: suggestedPrimaryId,
      analysis: {
        primary_action: structuredOutput.primary_action,
        technical_breakdown: structuredOutput.technical_breakdown,
        database_execution: structuredOutput.database_execution
      },
      tokens: {
        input: inputTokens,
        output: outputTokens,
        thinking: thinkingTokens,
        total: totalTokens
      },
      llm_config_applied: {
        model: cleanModelName,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        top_k: topK,
        thinking_level: thinkingLevel,
        speed_mode: speedMode,
        discount_rate: discountRate,
        timeout_seconds: timeoutSeconds
      },
      cost_usd: costUsd,
      latency_ms: latencyMs
    });

  } catch (error: any) {
    const errorMsg = sanitizeApiKey(error.message || 'Internal Server Error');
    console.error('Error in AI duplicate screening route:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
