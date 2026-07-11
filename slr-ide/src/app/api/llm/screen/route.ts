import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { PROJECT_ROOT, getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import { operationsManager } from '@/lib/llm-operations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, jobId, taskType, action, limit, offset, paperIds, templateId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    // Handle interactive controls (resume/cancel)
    if (action === 'resume') {
      const ok = operationsManager.resumeJob(jobId);
      return NextResponse.json({ success: ok, status: ok ? 'RUNNING' : 'FAILED' });
    }

    if (action === 'cancel') {
      const ok = operationsManager.cancelJob(jobId);
      return NextResponse.json({ success: ok, status: 'CANCELLED' });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
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
      return NextResponse.json({ error: 'Failed to decrypt Gemini API Key. Master password may be invalid or corrupt.' }, { status: 500 });
    }

    // Determine absolute paths relative to project root
    const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
    const mainScript = path.join(PROJECT_ROOT, 'python_engine', 'llm', 'main.py');

    if (!fs.existsSync(pythonExe)) {
      return NextResponse.json({ error: `Python virtual env not found at ${pythonExe}` }, { status: 500 });
    }
    if (!fs.existsSync(mainScript)) {
      return NextResponse.json({ error: `Main script not found at ${mainScript}` }, { status: 500 });
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
    if (templateId) {
      args.push('--template-id', templateId);
    }

    // Spawn the background Python process with injected API key env variable
    const child = spawn(pythonExe, args, {
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
    console.error('Error in LLM control route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
