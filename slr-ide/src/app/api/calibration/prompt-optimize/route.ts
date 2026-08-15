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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      project_id: projectId, 
      stage_num: rawStageNum, 
      action = 'diagnose', 
      approved_paper_ids = [],
      cached_context = null,
      previous_interaction_id = null 
    } = body;

    const stageNum = parseInt(rawStageNum || '1', 10);
    const stageMeta = STAGE_CONFIG[stageNum] || STAGE_CONFIG[1];

    if (!projectId) {
      return NextResponse.json({ error: 'Missing required field: project_id' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: `Project '${projectId}' not found.` }, { status: 404 });
    }

    // 1. Pre-flight Authentication & Vault Checks
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

    // 2. Resolve Active Stage Prompt & Optimizer Prompt
    const stagePrompt = resolveStagePrompt(projectId, stageMeta.type);
    if (!stagePrompt) {
      return NextResponse.json({ error: `No active prompt template found for ${stageMeta.name}.` }, { status: 400 });
    }

    let optTemplate = db.prepare(`
      SELECT * FROM prompt_templates 
      WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id IS NULL) 
        AND prompt_type = 'prompt_optimizer' 
        AND is_active = 1 
      ORDER BY CASE WHEN CAST(project_id AS TEXT) = CAST(? AS TEXT) THEN 0 ELSE 1 END, created_at DESC 
      LIMIT 1
    `).get(projectId, projectId) as any;

    if (!optTemplate) {
      return NextResponse.json({ error: "No active 'prompt_optimizer' prompt template found in Prompt Library." }, { status: 400 });
    }

    // 3. Dynamic Optimizer LLM Config
    const optLlmConfig = safeJsonParse(optTemplate.llm_config, {});
    const modelId = optLlmConfig.model_id || 'gemini-2.5-pro';
    const cleanModelName = modelId.replace(/^models\//, '');
    const temperature = typeof optLlmConfig.temperature === 'number' ? optLlmConfig.temperature : 0.0;
    const maxTokens = optLlmConfig.max_tokens || 6000;
    const timeoutSeconds = optLlmConfig.timeout_seconds || 900;
    const speedMode = (optLlmConfig.execution_mode || 'STANDARD').toUpperCase();

    // 4. Fetch 70% Training Discrepancies from Latest Benchmark Run
    const latestRun = db.prepare(`
      SELECT * FROM prompt_benchmark_runs 
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) 
        AND stage_num = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(projectId, stageNum) as any;

    let discrepancies: any[] = [];
    if (latestRun) {
      discrepancies = db.prepare(`
        SELECT r.*, p.Title, p.Abstract, p.Authors, p.Year, p.DOI, p.Local_PDF_Path
        FROM prompt_benchmark_results r
        LEFT JOIN papers p ON r.paper_id = p.Paper_ID AND CAST(p.Project_ID AS TEXT) = CAST(r.project_id AS TEXT)
        WHERE r.run_id = ? 
          AND r.partition_type = 'train' 
          AND r.is_match = 0
        ORDER BY r.paper_id ASC
      `).all(latestRun.id);
    }

    if (action === 'diagnose' && !latestRun) {
      return NextResponse.json({
        error: `No benchmark evaluation found for ${stageMeta.name}. Please click 'Run Benchmark' first to identify empirical discrepancies.`
      }, { status: 400 });
    }

    if (action === 'diagnose' && discrepancies.length === 0) {
      return NextResponse.json({
        message: `No discrepancies found in calibration training set for ${stageMeta.name}! The prompt is already performing at 100% agreement on this benchmark partition.`,
        already_optimal: true
      });
    }

    // 5. Build Sibling Prompts Summary for cross-stage boundary awareness
    const s1 = resolveStagePrompt(projectId, 'fast_filter');
    const s2 = resolveStagePrompt(projectId, 'gatekeeper');
    const s3 = resolveStagePrompt(projectId, 'scientist');
    const s4 = resolveStagePrompt(projectId, 'miner');

    const siblingSummary = `
- Fast Filter (S1): ${s1 ? s1.name : 'Not configured'}
- Gatekeeper (S2): ${s2 ? s2.name : 'Not configured'}
- Scientist (S3): ${s3 ? s3.name : 'Not configured'}
- Miner (S4): ${s4 ? s4.name : 'Not configured'}
`;

    // 6. Handle Action: 'diagnose' vs 'continue_with_pdf'
    let userPromptText = '';
    if (action === 'continue_with_pdf' && cached_context) {
      // Attach approved PDF text content
      const pdfTexts: string[] = [];
      for (const paperId of approved_paper_ids) {
        const paper = db.prepare('SELECT * FROM papers WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').get(paperId, projectId) as any;
        if (paper) {
          let attachedText = `[Paper ID: ${paper.Paper_ID} | Title: ${paper.Title}]\n`;
          let pdfFound = false;
          if (paper.Local_PDF_Path) {
            const resolvedPath = path.isAbsolute(paper.Local_PDF_Path) ? paper.Local_PDF_Path : path.resolve(process.cwd(), paper.Local_PDF_Path);
            if (fs.existsSync(resolvedPath)) {
              pdfFound = true;
              try {
                // Read text snippet or buffer notice
                attachedText += `\n[LOCAL PDF FILE ATTACHED: ${path.basename(resolvedPath)}]\nAuthors: ${paper.Authors || 'N/A'} | Year: ${paper.Year || 'N/A'} | DOI: ${paper.DOI || 'N/A'}\nAbstract: ${paper.Abstract}\n`;
              } catch (e) {
                attachedText += `\n[PDF Read Warning]: Fallback to Abstract & Ingestion Metadata.\nAuthors: ${paper.Authors || 'N/A'} | Year: ${paper.Year || 'N/A'} | DOI: ${paper.DOI || 'N/A'}\nAbstract: ${paper.Abstract}\n`;
              }
            }
          }
          if (!pdfFound) {
            attachedText += `\n[PDF UNAVAILABLE ON DISK - Fallback to Metadata]:\nAuthors: ${paper.Authors || 'N/A'} | Year: ${paper.Year || 'N/A'} | DOI: ${paper.DOI || 'N/A'}\nAbstract: ${paper.Abstract || 'No Abstract'}\n`;
          }
          pdfTexts.push(attachedText);
        }
      }

      userPromptText = `${cached_context}\n\n### RESEARCHER APPROVED FULL-TEXT ATTACHMENTS:\n${pdfTexts.join('\n\n')}\n\nPlease finalize the prompt optimization revisions and diffs based on this additional context.`;
    } else {
      // Turn 1 Diagnose prompt
      const formattedDiscrepancies = discrepancies.map(d => ({
        paper_id: d.paper_id,
        title: d.Title,
        abstract: d.Abstract,
        ai_prediction: { decision: d.ai_decision, exclusion_code: d.ai_exclusion_code, rationale: d.ai_rationale, qa_scores: safeJsonParse(d.ai_qa_scores, null) },
        gold_standard: { decision: d.gold_decision, exclusion_code: d.gold_exclusion_code, rationale: d.gold_rationale, qa_scores: safeJsonParse(d.gold_qa_scores, null) },
        discrepancy_note: safeJsonParse(d.discrepancy_details, null)
      }));

      const hydrationContext = {
        project: {
          name: project.name || 'Unnamed SLR Project',
          objective: project.objective || 'Not specified',
          manifesto: project.manifesto || 'Not specified',
          rules: project.pool_b_ec_rules || project.ec_rules || project.pool_c_qa_rules || 'Standard SLR Rules',
        },
        custom: {
          stage_name: stageMeta.name,
          stage_num: stageNum,
          current_system_instruction: stagePrompt.system_instruction || '',
          current_user_template: stagePrompt.user_template || '',
          discrepancies_json: JSON.stringify(formattedDiscrepancies, null, 2),
          sibling_prompts_summary: siblingSummary
        }
      };

      userPromptText = hydrateTemplate(optTemplate.user_template, hydrationContext);
    }

    const systemInstruction = optTemplate.system_instruction || '';
    const parsedResponseSchema = safeJsonParse(optTemplate.response_schema, DEFAULT_STAGE_SCHEMAS.prompt_optimizer);

    // 7. Execute Gemini Call
    const startTime = Date.now();
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${geminiApiKey}`;

    const generationConfig: Record<string, any> = {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: parsedResponseSchema
    };

    if (optLlmConfig.thinking_level) {
      const level = String(optLlmConfig.thinking_level).toLowerCase();
      const budgetMap: Record<string, number> = {
        minimal: 1024,
        low: 2048,
        medium: 4096,
        high: 8192,
        none: 0,
        off: 0
      };
      const budget = budgetMap[level] ?? (typeof optLlmConfig.thinking_budget === 'number' ? optLlmConfig.thinking_budget : 0);
      if (budget > 0) {
        generationConfig.thinkingConfig = { thinkingBudget: budget };
      }
    }

    const apiPayload = {
      contents: [{ role: 'user', parts: [{ text: userPromptText }] }],
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
        return NextResponse.json({ error: `Gemini optimization request timed out after ${timeoutSeconds}s.` }, { status: 504 });
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

    let structuredOpt: any = null;
    try {
      structuredOpt = JSON.parse(outputText);
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to parse structured optimizer JSON: ${e.message}` }, { status: 500 });
    }

    // 8. Determine if full-text PDFs are requested by LLM
    const requestedPdfs = Array.isArray(structuredOpt.needs_full_text) ? structuredOpt.needs_full_text : [];
    const hasPdfRequests = action === 'diagnose' && requestedPdfs.length > 0;

    // Check availability on disk for requested PDFs
    const enrichedRequestedPdfs = requestedPdfs.map((reqPdf: any) => {
      const paper = db.prepare('SELECT Local_PDF_Path, Title FROM papers WHERE Paper_ID = ? AND CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').get(reqPdf.paper_id, projectId) as any;
      let onDisk = false;
      if (paper && paper.Local_PDF_Path) {
        const resolvedPath = path.isAbsolute(paper.Local_PDF_Path) ? paper.Local_PDF_Path : path.resolve(process.cwd(), paper.Local_PDF_Path);
        onDisk = fs.existsSync(resolvedPath);
      }
      return {
        ...reqPdf,
        paper_title: paper?.Title || reqPdf.paper_title || 'Unknown Title',
        on_disk: onDisk,
        estimated_token_cost: onDisk ? '~25,000 tokens ($0.007)' : 'Metadata fallback'
      };
    });

    return NextResponse.json({
      success: true,
      stage_num: stageNum,
      stage_name: stageMeta.name,
      current_prompt: {
        id: stagePrompt.id,
        name: stagePrompt.name,
        system_instruction: stagePrompt.system_instruction,
        user_template: stagePrompt.user_template
      },
      has_pdf_requests: hasPdfRequests,
      requested_pdfs: enrichedRequestedPdfs,
      cached_context: userPromptText,
      optimization_result: structuredOpt,
      usage: {
        model_id: cleanModelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: Date.now() - startTime
      }
    });
  } catch (err: any) {
    console.error('Failed to run prompt optimizer:', err);
    return NextResponse.json({ error: sanitizeApiKey(err.message) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      project_id: projectId,
      stage_num: rawStageNum,
      target_prompt_id: reqTargetPromptId,
      proposed_system_instruction,
      proposed_user_template,
      action_mode = 'apply_active', // 'apply_active' | 'fork_new'
      set_as_default = true,
      custom_name = null
    } = body;

    const stageNum = parseInt(rawStageNum || '1', 10);
    const stageMeta = STAGE_CONFIG[stageNum] || STAGE_CONFIG[1];

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE CAST(id AS TEXT) = CAST(? AS TEXT)').get(projectId) as any;
    if (!project) {
      return NextResponse.json({ error: `Project '${projectId}' not found` }, { status: 404 });
    }

    let activePrompt = resolveStagePrompt(projectId, stageMeta.type);
    const now = new Date().toISOString();
    let finalPromptId = activePrompt?.id;

    const newHash = crypto.createHash('sha256').update((proposed_system_instruction || '') + (proposed_user_template || '')).digest('hex');
    const parentHash = activePrompt ? crypto.createHash('sha256').update((activePrompt.system_instruction || '') + (activePrompt.user_template || '')).digest('hex') : null;

    if (action_mode === 'fork_new' || !activePrompt || activePrompt.project_id === null) {
      // Copy-on-Write: Create new project-scoped prompt
      finalPromptId = `prompt-${stageMeta.type}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const promptName = custom_name || `${stageMeta.name} (Optimized v${Date.now().toString().slice(-4)})`;

      db.prepare(`
        INSERT INTO prompt_templates (
          id, project_id, name, description, prompt_type, system_instruction,
          user_template, response_schema, llm_config, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        finalPromptId,
        projectId,
        promptName,
        `Surgically optimized prompt revision for ${stageMeta.name}`,
        stageMeta.type,
        proposed_system_instruction,
        proposed_user_template,
        activePrompt?.response_schema || JSON.stringify(DEFAULT_STAGE_SCHEMAS[stageMeta.type]),
        activePrompt?.llm_config || '{}',
        now,
        now
      );
    } else {
      // Update existing project-scoped prompt
      db.prepare(`
        UPDATE prompt_templates 
        SET system_instruction = ?, user_template = ?, updated_at = ?
        WHERE id = ? AND CAST(project_id AS TEXT) = CAST(? AS TEXT)
      `).run(proposed_system_instruction, proposed_user_template, now, activePrompt.id, projectId);
      finalPromptId = activePrompt.id;
    }

    // Update project default prompt setting if checked
    if (set_as_default && finalPromptId) {
      const currentProjectConfig = safeJsonParse(project.llm_config, {});
      const defaultPrompts = currentProjectConfig.default_prompts || {};
      defaultPrompts[stageMeta.type] = finalPromptId;
      currentProjectConfig.default_prompts = defaultPrompts;

      db.prepare(`
        UPDATE projects 
        SET llm_config = ? 
        WHERE CAST(id AS TEXT) = CAST(? AS TEXT)
      `).run(JSON.stringify(currentProjectConfig), projectId);
    }

    // Log optimization lineage in prompt_audit_ledger
    const lineageId = `lineage-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO prompt_audit_ledger (
        id, project_id, audit_type, status, prompt_id, prompt_hash,
        parent_prompt_id, parent_prompt_hash, created_at
      ) VALUES (?, ?, 'prompt_optimization', 'PASSED', ?, ?, ?, ?, ?)
    `).run(
      lineageId,
      projectId,
      finalPromptId,
      newHash,
      activePrompt?.id || null,
      parentHash,
      now
    );

    return NextResponse.json({
      success: true,
      prompt_id: finalPromptId,
      action_mode: action_mode,
      set_as_default: set_as_default,
      prompt_hash: newHash,
      message: `Successfully applied optimized prompt for ${stageMeta.name}!`
    });
  } catch (err: any) {
    console.error('Failed to apply prompt optimization revisions:', err);
    return NextResponse.json({ error: sanitizeApiKey(err.message) }, { status: 500 });
  }
}
