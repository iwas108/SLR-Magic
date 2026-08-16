import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 });
    }

    const results = db.prepare(`
      SELECT * FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
    `).all(projectId, projectId);

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Failed to fetch umbrellanizer results:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, key, templateId, rawTokens, targetVariableName, jobId } = body;

    if (!projectId || !key || !templateId || !rawTokens || !targetVariableName || !jobId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Check Vault unlocking and fetch keys
    const { hasSessionMasterPassword, getSessionMasterPassword, clearSessionMasterPassword } = await import('@/lib/session');
    const { getVaultKey } = await import('@/lib/db');
    const { decryptKey } = await import('@/lib/vault');

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

    const { spawn } = await import('child_process');
    const path = await import('path');
    const fs = await import('fs');
    const { PROJECT_ROOT } = await import('@/lib/db');
    const { getPythonExecutablePath } = await import('@/lib/services/python-path');

    const pythonExe = getPythonExecutablePath(PROJECT_ROOT);
    const mainScript = path.join(PROJECT_ROOT, 'python_engine', 'llm', 'main.py');
    const targetResearchQuestion = body.targetResearchQuestion || body.targetVariableName || key;
    const targetResearchQuestionDescription = body.targetResearchQuestionDescription || '';

    if (!fs.existsSync(pythonExe)) {
      return NextResponse.json({ error: `Python virtual env not found at ${pythonExe}` }, { status: 500 });
    }
    if (!fs.existsSync(mainScript)) {
      return NextResponse.json({ error: `Main LLM script not found at ${mainScript}` }, { status: 500 });
    }

    const args = [
      mainScript,
      '--project-id', projectId,
      '--job-id', jobId,
      '--task-type', 'umbrellanizer',
      '--key', key,
      '--template-id', templateId,
      '--raw-tokens', JSON.stringify(rawTokens),
      '--target-research-question', targetResearchQuestion,
      '--target-research-question-description', targetResearchQuestionDescription
    ];

    // Insert PENDING record
    db.prepare(`
      INSERT OR REPLACE INTO umbrellanizer_results 
      (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'), datetime('now'))
    `).run(projectId, key, templateId, 'gemini-2.5-flash', JSON.stringify(rawTokens), '{}');

    // Spawn the background Python process
    const child = spawn(pythonExe, ['-u', ...args], {
      cwd: path.join(PROJECT_ROOT, 'python_engine'),
      env: {
        ...process.env,
        GEMINI_API_KEY: geminiApiKey,
      }
    });

    const { operationsManager } = await import('@/lib/llm-operations');
    operationsManager.registerJob(jobId, projectId, child);

    return NextResponse.json({
      success: true,
      jobId,
      status: 'RUNNING'
    });

  } catch (error: any) {
    console.error('Umbrellanizer API execution failed:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
