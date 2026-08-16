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
}

export interface MockupProgressUpdate {
  type: 'progress' | 'complete' | 'error';
  current?: number;
  total?: number;
  paperId?: string;
  paperTitle?: string;
  decision?: string;
  costSoFar?: number;
  totalCost?: number;
  totalTokens?: number;
  cacheId?: number;
  reviewerName?: string;
  error?: string;
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
  
  const discountRate = customDiscount > 0 ? customDiscount : (speedMode === 'FLEX' ? defaultBatchDiscount : 0.0);
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
 * Direct Gemini REST API Call
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
  const temperature = typeof modelConfig.temperature === 'number' ? modelConfig.temperature : 0.0;
  const maxTokens = modelConfig.max_tokens || modelConfig.max_output_tokens || 4000;
  const topP = typeof modelConfig.top_p === 'number' ? modelConfig.top_p : undefined;
  const topK = typeof modelConfig.top_k === 'number' ? modelConfig.top_k : undefined;
  const timeoutSeconds = modelConfig.timeout_seconds || 900;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${geminiApiKey}`;
  
  const generationConfig: Record<string, any> = {
    temperature,
    maxOutputTokens: maxTokens,
    topP,
    topK,
    responseMimeType: 'application/json',
    responseSchema: responseSchema || undefined
  };

  if (modelConfig.thinking_level) {
    const level = String(modelConfig.thinking_level).toLowerCase();
    const budgetMap: Record<string, number> = {
      minimal: 1024,
      low: 2048,
      medium: 4096,
      high: 8192,
      none: 0,
      off: 0
    };
    const budget = budgetMap[level] ?? (typeof modelConfig.thinking_budget === 'number' ? modelConfig.thinking_budget : 0);
    if (budget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget: budget };
    }
  }

  const parts: any[] = [];

  // Check if PDF should be attached inline for full-text stages
  if (localPdfPath) {
    const fullPath = path.isAbsolute(localPdfPath) ? localPdfPath : path.join(PROJECT_ROOT, localPdfPath);
    if (fs.existsSync(fullPath)) {
      try {
        const pdfBuffer = fs.readFileSync(fullPath);
        const base64Pdf = pdfBuffer.toString('base64');
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf
          }
        });
      } catch (pdfErr) {
        console.warn(`Could not read PDF from ${fullPath}, falling back to text prompt:`, pdfErr);
      }
    }
  }

  parts.push({ text: hydratedUserPrompt });

  const apiPayload = {
    contents: [{ role: 'user', parts }],
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig
  };

  const startTime = Date.now();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutSeconds * 1000);

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
      throw new Error(`Gemini API Error (${res.status}): ${errBody}`);
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
    return {
      success: false,
      error: err.message,
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

  const hydratedUserPrompt = hydrateTemplate(promptTemplate.user_template, hydrationContext);
  const systemInstruction = promptTemplate.system_instruction || '';

  const localPdfPath = stageNum === 2 ? paper.Local_PDF_Path : null;

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

  const sciPrompt = hydrateTemplate(scientistPrompt.user_template, sciHydrationContext);
  const sciRes = await callGeminiApi(
    sciPrompt,
    scientistPrompt.system_instruction || '',
    sciSchema,
    sciConfig,
    geminiApiKey,
    paper.Local_PDF_Path
  );

  let sciCost = 0;
  let sciTokens = 0;
  let rawQAScores: any = {};

  if (sciRes.success) {
    const parsedSci = safeJsonParse(sciRes.outputText, {});
    rawQAScores = parsedSci.qa_scores || parsedSci;
    const calc = calculateMockupCost(
      sciRes.cleanModelName,
      sciRes.inputTokens,
      sciRes.outputTokens,
      sciRes.cachedTokens,
      sciConfig.execution_mode || 'FLEX',
      Number(sciConfig.discount || 0),
      taxRate
    );
    sciCost = calc.costUsd;
    sciTokens = calc.totalTokens;

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
  }

  // --- Step 2: Miner (Data Extraction) ---
  const minerConfig = safeJsonParse(minerPrompt.llm_config, {});
  const minerSchema = safeJsonParse(minerPrompt.response_schema, DEFAULT_STAGE_SCHEMAS.miner);

  const minerHydrationContext = {
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

  const minerPromptText = hydrateTemplate(minerPrompt.user_template, minerHydrationContext);
  const minerRes = await callGeminiApi(
    minerPromptText,
    minerPrompt.system_instruction || '',
    minerSchema,
    minerConfig,
    geminiApiKey,
    paper.Local_PDF_Path
  );

  let minerCost = 0;
  let minerTokens = 0;
  let rawExtractedData: any = {};

  if (minerRes.success) {
    const parsedMiner = safeJsonParse(minerRes.outputText, {});
    rawExtractedData = parsedMiner.extracted_data || parsedMiner;
    const calc = calculateMockupCost(
      minerRes.cleanModelName,
      minerRes.inputTokens,
      minerRes.outputTokens,
      minerRes.cachedTokens,
      minerConfig.execution_mode || 'FLEX',
      Number(minerConfig.discount || 0),
      taxRate
    );
    minerCost = calc.costUsd;
    minerTokens = calc.totalTokens;

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
  }

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
