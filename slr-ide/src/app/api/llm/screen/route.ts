import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { PROJECT_ROOT } from '@/lib/db';
import { operationsManager } from '@/lib/llm-operations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, jobId, mode, action } = body;

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

    // Determine absolute paths relative to project root
    const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
    const mainScript = path.join(PROJECT_ROOT, 'python_engine', 'llm', 'main.py');

    if (!fs.existsSync(pythonExe)) {
      return NextResponse.json({ error: `Python virtual env not found at ${pythonExe}` }, { status: 500 });
    }
    if (!fs.existsSync(mainScript)) {
      return NextResponse.json({ error: `Main script not found at ${mainScript}` }, { status: 500 });
    }

    // Spawn the background Python process
    const child = spawn(pythonExe, [
      mainScript,
      '--project-id', projectId,
      '--job-id', jobId,
      '--mode', mode || 'standard'
    ], {
      cwd: path.join(PROJECT_ROOT, 'scrapers'),
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
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
