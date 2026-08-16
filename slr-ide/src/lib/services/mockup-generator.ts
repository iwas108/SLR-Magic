import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db, { PROJECT_ROOT } from '@/lib/db';
import { hydrateTemplate } from '@/lib/services/prompt-hydrator';
import { PromptType, DEFAULT_STAGE_SCHEMAS } from '@/lib/services/prompt-validator';
import { compressSlrServer } from '@/lib/slr-compression';

export interface MockupPaperResult {
  paper_id: string;
  title: string;
  decision?: string;
  exclusion_code?: string | null;
  rationale?: string;
  qa_scores?: Record<string, { value: number | null; evidence: string }>;
  extracted_data?: Record<string, { value: any; evidence: string }>;
  tokens: number;
  cost_usd: number;
  latency_ms: number;
  error?: string;
}

export interface MockupProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  current?: number;
  total?: number;
  paperId?: string;
  paperTitle?: string;
  decision?: string;
  exclusionCode?: string | null;
  costSoFar?: number;
  totalCost?: number;
  totalTokens?: number;
  cacheId?: number;
  reviewerName?: string;
  error?: string;
  isPartialRetry?: boolean;
}

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
 * Checks if a mockup paper execution failed (e.g. timeout, rate limit, API error, or missing PDF for Pool B/C)
 */
export function isMockupResultFailed(res: any, pool?: string): boolean {
  if (!res || typeof res !== 'object') return true;
  if (res.error && String(res.error).trim().length > 0) return true;
  if (res.exclusion_code === 'ERROR') return true;
  if (res.decision === 'ERROR') return true;
  if (res.rationale && typeof res.rationale === 'string') {
    if (
      res.rationale.startsWith('LLM Call Failed') ||
      res.rationale.includes('LLM Call Failed') ||
      res.rationale.includes('Request timed out') ||
      res.rationale.includes('Missing local full-text PDF')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves the active default prompt template for a stage in a project
 */
export function resolveMockupStagePrompt(projectId: string, promptType: PromptType): any {
  const project = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId) as any;
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
      ORDER BY CASE WHEN (CAST(project_id AS TEXT) = CAST(? AS TEXT)) THEN 0 ELSE 1 END, created_at DESC 
      LIMIT 1
    `).get(projectId, promptType, projectId);
  }

  return template || null;
}

/**
 * Calculates actual cost based on model pricing table and project discount/tax
 */
export function calculateMockupCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0,
  speedMode: string = 'FLEX',
  customDiscount: number = 0,
  taxRate: number = 0
): { costUsd: number; totalTokens: number } {
  const cleanModelName = modelId.replace(/^models\//, '');
  const pricingRow = db.prepare('SELECT * FROM llm_pricing WHERE model_id = ?').get(cleanModelName) as any;
  
  const inputPrice = pricingRow ? Number(pricingRow.input_token_price) : 0.075;
  const outputPrice = pricingRow ? Number(pricingRow.output_token_price) : 0.30;
  const defaultBatchDiscount = pricingRow?.batch_discount !== undefined ? Number(pricingRow.batch_discount) : 0.5;
  
  const discountRate = customDiscount > 0 ? customDiscount : (speedMode.toUpperCase() === 'FLEX' ? defaultBatchDiscount : 0.0);
  const billableInputTokens = Math.max(0, inputTokens - cachedTokens);
  
  const rawCost = ((billableInputTokens / 1_000_000.0) * inputPrice * (1.0 - discountRate)) +
                  ((outputTokens / 1_000_000.0) * outputPrice * (1.0 - discountRate));
  
  const finalCost = rawCost * (1.0 + taxRate);
  const totalTokens = inputTokens + outputTokens;

  return { costUsd: finalCost, totalTokens };
}

/**
 * Logs interaction to llm_audit_log with dedicated mockup_pool_* task_type
 */
export function logMockupAuditInteraction(params: {
  paperId: string;
  projectId: string;
  taskType: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  costUsd: number;
  rawPrompt: string;
  rawResponse: string;
  responseSchemaName: string;
  structuredOutput: string;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  latencyMs: number;
}) {
  try {
    const promptHash = crypto.createHash('sha256').update(params.rawPrompt).digest('hex');
    const totalTokens = params.inputTokens + params.outputTokens;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO llm_audit_log (
        paper_id, project_id, job_id, interaction_id, previous_interaction_id,
        model_id, task_type, input_tokens, output_tokens, thinking_tokens,
        cached_tokens, total_tokens, cost_usd, flex_discount, speed_mode,
        prompt_hash, raw_prompt, raw_response, response_schema_name,
        structured_output, status, error_message, error_code, latency_ms,
        retry_count, api_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.paperId,
      params.projectId,
      `mockup-${Date.now()}`,
      `mock-int-${crypto.randomBytes(4).toString('hex')}`,
      null,
      params.modelId,
      params.taskType,
      params.inputTokens,
      params.outputTokens,
      params.thinkingTokens,
      params.cachedTokens,
      totalTokens,
      params.costUsd,
      0.0,
      'FLEX',
      promptHash,
      params.rawPrompt,
      params.rawResponse,
      params.responseSchemaName,
      params.structuredOutput,
      params.status,
      params.errorMessage || null,
      null,
      params.latencyMs,
      0,
      'google-genai-2.5-rest',
      nowIso
    );
  } catch (err) {
    console.error('Failed to log mockup interaction to llm_audit_log:', err);
  }
}

/**
 * Direct Gemini REST API Call with 100% LLM Parameters Compliance
 */
async function callGeminiApi(
  hydratedUserPrompt: string,
  systemInstruction: string,
  responseSchema: any,
  modelConfig: any,
  geminiApiKey: string,
  localPdfPath?: string | null
): Promise<any> {
  const modelId = modelConfig.model_id || 'gemini-2.5-flash';
  const cleanModelName = modelId.replace(/^models\//, '');
  
  // 1. Temperature (0.0 to 2.0)
  const rawTemp = modelConfig.temperature;
  const temperature = (typeof rawTemp === 'number' && Number.isFinite(rawTemp)) 
    ? Math.max(0.0, Math.min(2.0, rawTemp))
    : (rawTemp !== undefined && !isNaN(Number(rawTemp)) ? Math.max(0.0, Math.min(2.0, Number(rawTemp))) : 0.0);

  // 2. Max Tokens (1 to 64000)
  const rawMaxTokens = modelConfig.max_tokens || modelConfig.max_output_tokens;
  const maxTokens = (typeof rawMaxTokens === 'number' && rawMaxTokens > 0)
    ? Math.min(64000, Math.max(1, rawMaxTokens))
    : (Number(rawMaxTokens) > 0 ? Math.min(64000, Math.max(1, Number(rawMaxTokens))) : 4000);

  // 3. Top-P (0.0 to 1.0)
  const rawTopP = modelConfig.top_p;
  const topP = (typeof rawTopP === 'number' && Number.isFinite(rawTopP) && rawTopP >= 0 && rawTopP <= 1)
    ? rawTopP
    : (rawTopP !== undefined && !isNaN(Number(rawTopP)) && Number(rawTopP) >= 0 && Number(rawTopP) <= 1 ? Number(rawTopP) : undefined);

  // 4. Top-K (1 to 100)
  const rawTopK = modelConfig.top_k;
  const topK = (typeof rawTopK === 'number' && Number.isInteger(rawTopK) && rawTopK >= 1)
    ? Math.min(100, rawTopK)
    : (rawTopK !== undefined && !isNaN(parseInt(rawTopK, 10)) && parseInt(rawTopK, 10) >= 1 ? Math.min(100, parseInt(rawTopK, 10)) : undefined);

  // 5. Timeout Seconds (30 to 3600s, default 900)
  const rawTimeout = modelConfig.timeout_seconds;
  const timeoutSeconds = (typeof rawTimeout === 'number' && rawTimeout >= 5)
    ? Math.min(3600, rawTimeout)
    : (Number(rawTimeout) >= 5 ? Math.min(3600, Number(rawTimeout)) : 900);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${geminiApiKey}`;
  
  const generationConfig: Record<string, any> = {
    temperature,
    maxOutputTokens: maxTokens,
    responseMimeType: 'application/json',
    responseSchema: (responseSchema && typeof responseSchema === 'object' && Object.keys(responseSchema).length > 0) ? responseSchema : undefined
  };

  if (topP !== undefined) generationConfig.topP = topP;
  if (topK !== undefined) generationConfig.topK = topK;

  // 6. Thinking level (Gemini 2.5 models)
  const isThinkingCapable = cleanModelName.includes('2.5') || cleanModelName.includes('gemini-2.');
  if (isThinkingCapable) {
    const level = String(modelConfig.thinking_level || 'none').toLowerCase();
    const budgetMap: Record<string, number> = {
      none: 0,
      off: 0,
      minimal: 1024,
      low: 2048,
      medium: 4096,
      high: 8192
    };
    let budget = budgetMap[level];
    if (budget === undefined && typeof modelConfig.thinking_budget === 'number') {
      budget = modelConfig.thinking_budget;
    }
    if (budget === undefined) budget = 0;
    
    // Explicitly configure thinkingBudget to ensure 'none' shuts off reasoning tokens
    generationConfig.thinkingConfig = { thinkingBudget: budget };
  }

  const parts: any[] = [];

  // Check if PDF should be attached inline for full-text stages (< 20MB inline limit)
  if (localPdfPath) {
    const fullPath = path.isAbsolute(localPdfPath) ? localPdfPath : path.join(PROJECT_ROOT, localPdfPath);
    if (fs.existsSync(fullPath)) {
      try {
        const stat = fs.statSync(fullPath);
        // 19.5 MB limit to stay safely below Google GenAI 20MB limit
        if (stat.size <= 19.5 * 1024 * 1024) {
          const pdfBuffer = fs.readFileSync(fullPath);
          const base64Pdf = pdfBuffer.toString('base64');
          parts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf
            }
          });
        } else {
          console.warn(`PDF file ${fullPath} is too large (${(stat.size / 1024 / 1024).toFixed(1)}MB) for inline attachment. Relying on metadata prompt.`);
        }
      } catch (pdfErr) {
        console.warn(`Could not read PDF from ${fullPath}, falling back to text prompt:`, pdfErr);
      }
    }
  }

  parts.push({ text: hydratedUserPrompt });

  const apiPayload = {
    contents: [{ role: 'user', parts }],
    systemInstruction: (systemInstruction && systemInstruction.trim()) ? { parts: [{ text: systemInstruction.trim() }] } : undefined,
    generationConfig
  };

  const startTime = Date.now();
  const abortController = new AbortController();
  let isTimedOut = false;
  const timeoutId = setTimeout(() => {
    isTimedOut = true;
    abortController.abort();
  }, timeoutSeconds * 1000);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
      signal: abortController.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errBody = await res.text();
      // Sanitize API key from error output
      const cleanErr = errBody.replace(/key=[^&\s"]+/gi, 'key=***');
      throw new Error(`Gemini API Error (${res.status}): ${cleanErr}`);
    }

    const resJson = await res.json();
    const usage = resJson.usageMetadata || {};
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;
    const thinkingTokens = usage.candidatesThinkingTokenCount || 0;
    const cachedTokens = usage.cachedContentTokenCount || 0;

    let outputText = '';
    const candidate = resJson.candidates?.[0];
    if (candidate?.content?.parts) {
      outputText = candidate.content.parts.map((p: any) => p.text || '').join('');
    }

    return {
      success: true,
      outputText,
      inputTokens,
      outputTokens,
      thinkingTokens,
      cachedTokens,
      latencyMs,
      rawResponse: JSON.stringify(resJson),
      cleanModelName
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isAborted = isTimedOut || err.name === 'AbortError' || abortController.signal.aborted;
    const cleanErrorMsg = isAborted
      ? `Request timed out after ${timeoutSeconds} seconds`
      : (err.message ? String(err.message).replace(/key=[^&\s"]+/gi, 'key=***') : 'Unknown LLM error');

    return {
      success: false,
      error: cleanErrorMsg,
      latencyMs,
      cleanModelName
    };
  }
}

/**
 * Extracts decision, exclusion code, and rationale from structured output
 */
function parseScreeningOutput(parsedJson: any): { decision: string; ecTrigger: string | null; rationale: string } {
  if (!parsedJson || typeof parsedJson !== 'object') {
    return { decision: 'EXCLUDE', ecTrigger: null, rationale: 'Invalid LLM response' };
  }

  let decision = parsedJson.decision;
  let ecTrigger = parsedJson.exclusion_trigger || parsedJson.exclusion_code || parsedJson.primary_exclusion_criterion || null;
  let rationale = parsedJson.rationale || parsedJson.reasoning || '';

  // Check sub-objects like final_evaluation
  if (parsedJson.final_evaluation && typeof parsedJson.final_evaluation === 'object') {
    const fe = parsedJson.final_evaluation;
    if (fe.decision) decision = fe.decision;
    if (fe.exclusion_code || fe.exclusion_trigger) ecTrigger = fe.exclusion_code || fe.exclusion_trigger;
    if (fe.rationale || fe.reasoning) rationale = fe.rationale || fe.reasoning;
  }

  const decUpper = String(decision || 'EXCLUDE').toUpperCase();
  const normalizedDecision = decUpper.startsWith('INC') ? 'INCLUDE' : 'EXCLUDE';

  return {
    decision: normalizedDecision,
    ecTrigger: normalizedDecision === 'INCLUDE' ? null : ecTrigger,
    rationale: String(rationale || '')
  };
}

/**
 * Evaluates a single paper for Pool A or Pool B
 */
export async function evaluateMockupPaperScreening(
  project: any,
  paper: any,
  stageNum: 1 | 2,
  promptTemplate: any,
  geminiApiKey: string,
  taskType: 'mockup_pool_a' | 'mockup_pool_b'
): Promise<MockupPaperResult> {
  const modelConfig = safeJsonParse(promptTemplate.llm_config, {});
  const stagePromptType: PromptType = stageNum === 1 ? 'fast_filter' : 'gatekeeper';
  const responseSchema = safeJsonParse(promptTemplate.response_schema, DEFAULT_STAGE_SCHEMAS[stagePromptType]);

  const hydrationContext = {
    project: {
      name: project.name || '',
      objective: project.objective || '',
      manifesto: project.manifesto || '',
      questions: project.questions || '',
      ec_rules: stageNum === 2 ? (project.pool_b_ec_rules || project.ec_rules) : project.ec_rules
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

  const userTemplate = promptTemplate.user_template || promptTemplate.user_prompt_template || '';
  const systemInstruction = promptTemplate.system_instruction || promptTemplate.system_prompt || '';

  const hydratedUserPrompt = hydrateTemplate(userTemplate, hydrationContext);
  const localPdfPath = stageNum === 2 ? paper.Local_PDF_Path : null;

  // Enforce mandatory local PDF check for Pool B (Gatekeeper Stage 2)
  if (stageNum === 2 || taskType === 'mockup_pool_b') {
    const hasValidPdf = Boolean(paper.Local_PDF_Path && fs.existsSync(paper.Local_PDF_Path));
    if (!hasValidPdf) {
      return {
        paper_id: paper.Paper_ID,
        title: paper.Title,
        decision: 'EXCLUDE',
        exclusion_code: 'ERROR',
        rationale: 'Missing local full-text PDF file. Pool B Gatekeeper screening requires a verified local PDF file on disk.',
        error: 'Missing local full-text PDF file (required for Pool B)',
        tokens: 0,
        cost_usd: 0,
        latency_ms: 0
      };
    }
  }

  const apiRes = await callGeminiApi(
    hydratedUserPrompt,
    systemInstruction,
    responseSchema,
    modelConfig,
    geminiApiKey,
    localPdfPath
  );

  const discount = Number(modelConfig.discount || 0);
  const taxRate = Number(project.project_tax || 0);

  if (!apiRes.success) {
    logMockupAuditInteraction({
      paperId: paper.Paper_ID,
      projectId: String(project.id),
      taskType,
      modelId: apiRes.cleanModelName || 'gemini-2.5-flash',
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      cachedTokens: 0,
      costUsd: 0,
      rawPrompt: hydratedUserPrompt,
      rawResponse: '',
      responseSchemaName: responseSchema?.name || 'custom_schema',
      structuredOutput: '',
      status: 'ERROR',
      errorMessage: apiRes.error,
      latencyMs: apiRes.latencyMs
    });

    return {
      paper_id: paper.Paper_ID,
      title: paper.Title,
      decision: 'EXCLUDE',
      exclusion_code: 'ERROR',
      rationale: `LLM Call Failed: ${apiRes.error}`,
      error: apiRes.error,
      tokens: 0,
      cost_usd: 0,
      latency_ms: apiRes.latencyMs
    };
  }

  const parsedOutput = safeJsonParse(apiRes.outputText, {});
  const { decision, ecTrigger, rationale } = parseScreeningOutput(parsedOutput);
  
  const { costUsd, totalTokens } = calculateMockupCost(
    apiRes.cleanModelName,
    apiRes.inputTokens,
    apiRes.outputTokens,
    apiRes.cachedTokens,
    modelConfig.execution_mode || 'FLEX',
    discount,
    taxRate
  );

  logMockupAuditInteraction({
    paperId: paper.Paper_ID,
    projectId: String(project.id),
    taskType,
    modelId: apiRes.cleanModelName,
    inputTokens: apiRes.inputTokens,
    outputTokens: apiRes.outputTokens,
    thinkingTokens: apiRes.thinkingTokens,
    cachedTokens: apiRes.cachedTokens,
    costUsd,
    rawPrompt: hydratedUserPrompt,
    rawResponse: apiRes.rawResponse,
    responseSchemaName: responseSchema?.name || 'custom_schema',
    structuredOutput: apiRes.outputText,
    status: 'SUCCESS',
    latencyMs: apiRes.latencyMs
  });

  return {
    paper_id: paper.Paper_ID,
    title: paper.Title,
    decision,
    exclusion_code: ecTrigger,
    rationale,
    tokens: totalTokens,
    cost_usd: costUsd,
    latency_ms: apiRes.latencyMs
  };
}

/**
 * Evaluates a single paper for Pool C (Sequential Scientist QA + Miner Extraction)
 */
export async function evaluateMockupPaperPoolC(
  project: any,
  paper: any,
  scientistPrompt: any,
  minerPrompt: any,
  geminiApiKey: string,
  qaRules: any[],
  extractionRules: any[]
): Promise<MockupPaperResult> {
  const taxRate = Number(project.project_tax || 0);

  // --- Step 1: Scientist (QA Scoring) ---
  const sciConfig = safeJsonParse(scientistPrompt.llm_config, {});
  const sciSchema = safeJsonParse(scientistPrompt.response_schema, DEFAULT_STAGE_SCHEMAS.scientist);

  const sciHydrationContext = {
    project: {
      name: project.name || '',
      objective: project.objective || '',
      manifesto: project.manifesto || '',
      questions: project.questions || '',
      qa_rules: project.pool_c_qa_rules || project.qa_rules
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

  const sciUserTemplate = scientistPrompt.user_template || scientistPrompt.user_prompt_template || '';
  const sciSysInstruction = scientistPrompt.system_instruction || scientistPrompt.system_prompt || '';

  // Enforce mandatory local PDF check for Pool C (Scientist QA + Miner Extraction)
  const hasValidPdf = Boolean(paper.Local_PDF_Path && fs.existsSync(paper.Local_PDF_Path));
  if (!hasValidPdf) {
    return {
      paper_id: paper.Paper_ID,
      title: paper.Title,
      decision: 'EXCLUDE',
      exclusion_code: 'ERROR',
      rationale: 'Missing local full-text PDF file. Pool C Scientist + Miner evaluation requires a verified local PDF file on disk.',
      error: 'Missing local full-text PDF file (required for Pool C)',
      qa_scores: {},
      extracted_data: {},
      tokens: 0,
      cost_usd: 0,
      latency_ms: 0
    };
  }

  const sciPrompt = hydrateTemplate(sciUserTemplate, sciHydrationContext);
  const sciRes = await callGeminiApi(
    sciPrompt,
    sciSysInstruction,
    sciSchema,
    sciConfig,
    geminiApiKey,
    paper.Local_PDF_Path
  );

  let sciCost = 0;
  let sciTokens = 0;
  let rawQAScores: any = {};

  if (!sciRes.success) {
    logMockupAuditInteraction({
      paperId: paper.Paper_ID,
      projectId: String(project.id),
      taskType: 'mockup_pool_c',
      modelId: sciRes.cleanModelName || 'gemini-2.5-flash',
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      cachedTokens: 0,
      costUsd: 0,
      rawPrompt: sciPrompt,
      rawResponse: '',
      responseSchemaName: sciSchema?.name || 'scientist_schema',
      structuredOutput: '',
      status: 'ERROR',
      errorMessage: sciRes.error,
      latencyMs: sciRes.latencyMs
    });

    return {
      paper_id: paper.Paper_ID,
      title: paper.Title,
      exclusion_code: 'ERROR',
      rationale: `LLM Call Failed (Scientist QA): ${sciRes.error}`,
      error: `Scientist QA Failed: ${sciRes.error}`,
      tokens: 0,
      cost_usd: 0,
      latency_ms: sciRes.latencyMs
    };
  }

  const parsedSci = safeJsonParse(sciRes.outputText, {});
  rawQAScores = parsedSci.qa_scores || parsedSci;
  const sciCalc = calculateMockupCost(
    sciRes.cleanModelName,
    sciRes.inputTokens,
    sciRes.outputTokens,
    sciRes.cachedTokens,
    sciConfig.execution_mode || 'FLEX',
    Number(sciConfig.discount || 0),
    taxRate
  );
  sciCost = sciCalc.costUsd;
  sciTokens = sciCalc.totalTokens;

  logMockupAuditInteraction({
    paperId: paper.Paper_ID,
    projectId: String(project.id),
    taskType: 'mockup_pool_c',
    modelId: sciRes.cleanModelName,
    inputTokens: sciRes.inputTokens,
    outputTokens: sciRes.outputTokens,
    thinkingTokens: sciRes.thinkingTokens,
    cachedTokens: sciRes.cachedTokens,
    costUsd: sciCost,
    rawPrompt: sciPrompt,
    rawResponse: sciRes.rawResponse,
    responseSchemaName: sciSchema?.name || 'scientist_schema',
    structuredOutput: sciRes.outputText,
    status: 'SUCCESS',
    latencyMs: sciRes.latencyMs
  });

  // --- Step 2: Miner (Data Extraction) with Interaction Chaining Support ---
  const minerConfig = safeJsonParse(minerPrompt.llm_config, {});
  const minerSchema = safeJsonParse(minerPrompt.response_schema, DEFAULT_STAGE_SCHEMAS.miner);
  const isChaining = minerConfig.interaction_chaining !== false;

  const minerHydrationContext: any = {
    project: {
      name: project.name || '',
      objective: project.objective || '',
      manifesto: project.manifesto || '',
      questions: project.questions || '',
      extraction_rules: project.pool_c_extraction_rules
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

  if (isChaining) {
    minerHydrationContext.custom = {
      scientist_qa_scores: rawQAScores,
      qa_scores: rawQAScores,
      qa_summary: sciRes.outputText
    };
  }

  const minerUserTemplate = minerPrompt.user_template || minerPrompt.user_prompt_template || '';
  const minerSysInstruction = minerPrompt.system_instruction || minerPrompt.system_prompt || '';

  const minerPromptText = hydrateTemplate(minerUserTemplate, minerHydrationContext);
  const minerRes = await callGeminiApi(
    minerPromptText,
    minerSysInstruction,
    minerSchema,
    minerConfig,
    geminiApiKey,
    paper.Local_PDF_Path
  );

  let minerCost = 0;
  let minerTokens = 0;
  let rawExtractedData: any = {};

  if (!minerRes.success) {
    logMockupAuditInteraction({
      paperId: paper.Paper_ID,
      projectId: String(project.id),
      taskType: 'mockup_pool_c',
      modelId: minerRes.cleanModelName || 'gemini-2.5-flash',
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      cachedTokens: 0,
      costUsd: 0,
      rawPrompt: minerPromptText,
      rawResponse: '',
      responseSchemaName: minerSchema?.name || 'miner_schema',
      structuredOutput: '',
      status: 'ERROR',
      errorMessage: minerRes.error,
      latencyMs: minerRes.latencyMs
    });

    return {
      paper_id: paper.Paper_ID,
      title: paper.Title,
      exclusion_code: 'ERROR',
      rationale: `LLM Call Failed (Miner Extraction): ${minerRes.error}`,
      error: `Miner Extraction Failed: ${minerRes.error}`,
      tokens: sciTokens,
      cost_usd: sciCost,
      latency_ms: (sciRes.latencyMs || 0) + (minerRes.latencyMs || 0)
    };
  }

  const parsedMiner = safeJsonParse(minerRes.outputText, {});
  rawExtractedData = parsedMiner.extracted_data || parsedMiner;
  const minerCalc = calculateMockupCost(
    minerRes.cleanModelName,
    minerRes.inputTokens,
    minerRes.outputTokens,
    minerRes.cachedTokens,
    minerConfig.execution_mode || 'FLEX',
    Number(minerConfig.discount || 0),
    taxRate
  );
  minerCost = minerCalc.costUsd;
  minerTokens = minerCalc.totalTokens;

  logMockupAuditInteraction({
    paperId: paper.Paper_ID,
    projectId: String(project.id),
    taskType: 'mockup_pool_c',
    modelId: minerRes.cleanModelName,
    inputTokens: minerRes.inputTokens,
    outputTokens: minerRes.outputTokens,
    thinkingTokens: minerRes.thinkingTokens,
    cachedTokens: minerRes.cachedTokens,
    costUsd: minerCost,
    rawPrompt: minerPromptText,
    rawResponse: minerRes.rawResponse,
    responseSchemaName: minerSchema?.name || 'miner_schema',
    structuredOutput: minerRes.outputText,
    status: 'SUCCESS',
    latencyMs: minerRes.latencyMs
  });

  // Normalize QA Scores
  const normalizedQA: Record<string, { value: number | null; evidence: string }> = {};
  qaRules.forEach((rule: any) => {
    const code = rule.code;
    const item = rawQAScores[code];
    if (item && typeof item === 'object') {
      normalizedQA[code] = {
        value: typeof item.value === 'number' ? item.value : (item.score !== undefined ? Number(item.score) : null),
        evidence: String(item.evidence || item.rationale || '')
      };
    } else if (typeof item === 'number') {
      normalizedQA[code] = { value: item, evidence: '' };
    } else {
      normalizedQA[code] = { value: null, evidence: '' };
    }
  });

  // Normalize Extracted Data
  const normalizedExt: Record<string, { value: any; evidence: string }> = {};
  extractionRules.forEach((rule: any) => {
    const key = rule.json_key;
    const item = rawExtractedData[key];
    if (item && typeof item === 'object') {
      normalizedExt[key] = {
        value: item.value !== undefined ? (typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)) : '',
        evidence: String(item.evidence || item.quote || '')
      };
    } else if (item !== undefined && item !== null) {
      normalizedExt[key] = {
        value: typeof item === 'object' ? JSON.stringify(item) : String(item),
        evidence: ''
      };
    } else {
      normalizedExt[key] = { value: '', evidence: '' };
    }
  });

  return {
    paper_id: paper.Paper_ID,
    title: paper.Title,
    qa_scores: normalizedQA,
    extracted_data: normalizedExt,
    tokens: sciTokens + minerTokens,
    cost_usd: sciCost + minerCost,
    latency_ms: (sciRes.latencyMs || 0) + (minerRes.latencyMs || 0)
  };
}

/**
 * Assembles the full .slr payload and compresses it to GZIP Buffer
 */
export function buildMockupSlrFile(
  project: any,
  dbPool: 'pool_a' | 'pool_b' | 'pool_c',
  reviewerName: string,
  papers: any[],
  resultsMap: Map<string, MockupPaperResult>
): Buffer {
  let qaRules = [];
  let extractionRules = [];

  if (dbPool === 'pool_c') {
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

  const blindedPapers = papers.map(paper => {
    const res = resultsMap.get(paper.Paper_ID);
    const base = {
      Paper_ID: paper.Paper_ID || '',
      Title: paper.Title || '',
      Year: paper.Year !== null ? String(paper.Year) : '',
      Authors: paper.Authors || '',
      Abstract: paper.Abstract || '',
      DOI: paper.DOI || '',
      Publisher: paper.Publisher || '',
      PDF_Link: paper.PDF_Link || '',
      Local_PDF_Status: paper.Local_PDF_Status || 'IGNORED',
      PDF_Base64: null // Kept lightweight for database health and high performance
    };

    if (dbPool === 'pool_c') {
      return {
        ...base,
        Human_QA_Scores: res?.qa_scores || {},
        Human_Extracted_Data: res?.extracted_data || {}
      };
    } else {
      return {
        ...base,
        Human_Decision: res?.decision || 'EXCLUDE',
        Human_EC_Trigger: res?.exclusion_code || '',
        Human_Rationale: res?.rationale || ''
      };
    }
  });

  const metadata: any = {
    project_id: String(project.id),
    project_name: project.name || 'Unnamed Project',
    reviewer_name: reviewerName.trim(),
    research_manifesto: project.manifesto || '',
    research_objective: project.objective || '',
    research_questions: project.questions || '',
    quality_assurance_definition: project.qa_definition || '',
    exclusion_criteria: project.exclusion_criteria || '',
    pool_type: dbPool === 'pool_b' ? 'CAL_Pool_B' : dbPool === 'pool_c' ? 'CAL_Pool_C' : 'CAL_Pool_A',
    export_date: new Date().toISOString()
  };

  if (dbPool === 'pool_c') {
    metadata.qa_rules = qaRules;
    metadata.extraction_rules = extractionRules;
    let reasoningTemplate = [];
    const reasoningField = project.pool_c_reasoning_template || project.reasoning_template;
    if (reasoningField) {
      try {
        reasoningTemplate = typeof reasoningField === 'string' ? JSON.parse(reasoningField) : reasoningField;
      } catch {}
    }
    metadata.reasoning_template = reasoningTemplate;
  } else {
    let ecRules = [];
    const ecRulesField = dbPool === 'pool_b' ? project.pool_b_ec_rules : project.ec_rules;
    if (ecRulesField) {
      try {
        ecRules = typeof ecRulesField === 'string' ? JSON.parse(ecRulesField) : ecRulesField;
      } catch {}
    }
    metadata.ec_rules = ecRules;

    let reasoningTemplate = [];
    const reasoningField = dbPool === 'pool_b' ? project.pool_b_reasoning_template : project.reasoning_template;
    if (reasoningField) {
      try {
        reasoningTemplate = typeof reasoningField === 'string' ? JSON.parse(reasoningField) : reasoningField;
      } catch {}
    }
    metadata.reasoning_template = reasoningTemplate;
  }

  const payload = {
    metadata,
    papers: blindedPapers
  };

  return compressSlrServer(payload);
}
