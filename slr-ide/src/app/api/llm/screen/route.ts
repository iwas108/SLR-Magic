import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { PROJECT_ROOT, getVaultKey } from '@/lib/db';
import db from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword, sanitizeApiKey } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import { getPythonExecutablePath } from '@/lib/services/python-path';
import { operationsManager } from '@/lib/llm-operations';
import { pipelineLock } from '@/lib/services/pipeline-lock';

import { validatePromptSchema } from '@/lib/services/prompt-validator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      projectId, jobId, action, limit, offset, paperIds, templateId, 
      statusFilter, decisionFilter, excludeManual, paperSelectionMode,
      key, rawTokens, targetVariableName, targetResearchQuestion, targetResearchQuestionDescription
    } = body;
    let taskTypeInput = body.taskType;

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const stageMap: Record<string, string> = {
      'fast_filter': 'fast_filter',
      'screening': 'fast_filter',
      'gatekeeper': 'gatekeeper',
      'fulltext': 'gatekeeper',
      'scientist': 'scientist',
      'miner': 'miner',
      'extraction': 'miner',
      'umbrellanizer': 'umbrellanizer'
    };
    const taskType = stageMap[taskTypeInput] || taskTypeInput || 'fast_filter';

    // Handle interactive controls (resume/pause/cancel)
    if (action === 'resume') {
      const ok = operationsManager.resumeJob(jobId);
      return NextResponse.json({ success: ok, status: ok ? 'RUNNING' : 'FAILED' });
    }

    if (action === 'pause') {
      const ok = operationsManager.pauseJob(jobId);
      return NextResponse.json({ success: ok, status: ok ? 'PAUSED_USER' : 'FAILED' });
    }

    if (action === 'cancel') {
      const ok = operationsManager.cancelJob(jobId);
      return NextResponse.json({ success: ok, status: 'CANCELLED' });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Check Global Pipeline Lock
    if (pipelineLock.isLocked()) {
      return NextResponse.json({ 
        error: 'Another pipeline is currently running. Please wait for it to complete.' 
      }, { status: 409 });
    }

    // Race condition prevention: Check if any job is currently active or starting
    // inside the operationsManager to prevent multiple submissions
    const activeJobs = Array.from((operationsManager as any).jobs.values() as any[])
      .filter((j: any) => j.status === 'RUNNING' || j.status === 'PAUSED_BUDGET');
    
    if (activeJobs.length > 0) {
      return NextResponse.json({ 
        error: 'Another LLM job is currently running. Please wait for it to complete.' 
      }, { status: 409 });
    }

    pipelineLock.acquire();

    // Retrieve and decrypt Gemini API key in-memory
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault to run LLM tasks.' }, { status: 401 });
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

    // Determine absolute paths relative to project root
    const pythonExe = getPythonExecutablePath();
    const mainScript = path.join(PROJECT_ROOT, 'python_engine', 'llm', 'main.py');

    if (!fs.existsSync(pythonExe)) {
      return NextResponse.json({ error: `Python virtual env not found at ${pythonExe}` }, { status: 500 });
    }
    if (!fs.existsSync(mainScript)) {
      return NextResponse.json({ error: `Main script not found at ${mainScript}` }, { status: 500 });
    }

    let resolvedTemplateId = templateId;
    if (!resolvedTemplateId) {
      try {
        const project = db.prepare('SELECT llm_config FROM projects WHERE id = ?').get(projectId) as any;
        if (project && project.llm_config) {
          const config = JSON.parse(project.llm_config);
          resolvedTemplateId = config.default_prompts?.[taskType || 'fast_filter'];
        }
      } catch (err) {
        console.error('Failed to load project default prompts:', err);
      }
    }

    if (!resolvedTemplateId) {
      return NextResponse.json({ 
        error: `No default prompt template configured for stage '${taskType || 'fast_filter'}' in Project Settings.` 
      }, { status: 400 });
    }

    const tplRecord = db.prepare('SELECT response_schema, prompt_type FROM prompt_templates WHERE id = ?').get(resolvedTemplateId) as any;
    if (!tplRecord) {
      return NextResponse.json({ error: `Prompt template '${resolvedTemplateId}' not found in database.` }, { status: 400 });
    }

    const valResult = validatePromptSchema(taskType || tplRecord.prompt_type, tplRecord.response_schema);
    if (!valResult.isValid) {
      return NextResponse.json({ error: `Selected prompt template baseline schema validation failed: ${valResult.error}` }, { status: 400 });
    }

    // Construct command line arguments
    const args = [
      mainScript,
      '--project-id', projectId,
      '--job-id', jobId,
      '--task-type', taskType || 'fast_filter'
    ];

    if (limit) {
      args.push('--limit', String(limit));
    }
    if (offset) {
      args.push('--offset', String(offset));
    }
    if (paperIds && Array.isArray(paperIds) && paperIds.length > 0) {
      args.push('--paper-ids', paperIds.join(','));
    }
    if (resolvedTemplateId) {
      args.push('--template-id', resolvedTemplateId);
    }
    if (statusFilter !== undefined && statusFilter !== null) {
      args.push('--status-filter', String(statusFilter));
    }
    if (decisionFilter !== undefined && decisionFilter !== null && decisionFilter !== 'ALL') {
      args.push('--decision-filter', String(decisionFilter));
    }
    if (excludeManual) {
      args.push('--exclude-manual');
    }
    if (paperSelectionMode) {
      args.push('--paper-selection-mode', String(paperSelectionMode));
    }
    if (key) {
      args.push('--key', String(key));
    }
    if (rawTokens) {
      args.push('--raw-tokens', typeof rawTokens === 'string' ? rawTokens : JSON.stringify(rawTokens));
    }
    const resolvedTargetRq = targetResearchQuestion || targetVariableName || key;
    if (resolvedTargetRq) {
      args.push('--target-research-question', String(resolvedTargetRq));
    }
    if (targetResearchQuestionDescription) {
      args.push('--target-research-question-description', String(targetResearchQuestionDescription));
    }

    // Resolve model and mode details from template to write initial job record
    let modelId = 'gemini-2.5-flash';
    let executionMode = 'flex';
    if (resolvedTemplateId) {
      try {
        const template = db.prepare('SELECT llm_config FROM prompt_templates WHERE id = ?').get(resolvedTemplateId) as any;
        if (template && template.llm_config) {
          const config = JSON.parse(template.llm_config);
          modelId = config.model_id || modelId;
          executionMode = config.execution_mode || executionMode;
        }
      } catch (e) {
        console.error('Failed to resolve template config for initial job insert:', e);
      }
    }

    // Insert an initial job record to database immediately to avoid client race conditions
    try {
      db.prepare(`
        INSERT OR REPLACE INTO llm_jobs (id, project_id, task_type, model_id, mode, status, total_papers, processed_papers, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'STARTING', 0, 0, datetime('now'), datetime('now'))
      `).run(jobId, projectId, taskType, modelId, executionMode);
    } catch (e) {
      console.error('Failed to insert initial job record:', e);
    }

    // Spawn the background Python process with injected API key env variable
    const child = spawn(pythonExe, ['-u', ...args], {
      cwd: path.join(PROJECT_ROOT, 'python_engine'),
      env: {
        ...process.env,
        GEMINI_API_KEY: geminiApiKey,
      }
    });

    // Register process with operations center
    operationsManager.registerJob(jobId, projectId, child);

    return NextResponse.json({
      success: true,
      jobId,
      status: 'RUNNING'
    });

  } catch (error: any) {
    const errorMsg = sanitizeApiKey(error.message || 'Internal Server Error');
    console.error('Error in LLM control route:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
