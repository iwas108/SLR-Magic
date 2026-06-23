import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { PROJECT_ROOT } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const pythonExe = path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe');
    const mainScript = path.join(PROJECT_ROOT, 'scrapers', 'llm', 'main.py');

    if (!fs.existsSync(pythonExe)) {
      return NextResponse.json({ error: `Python virtual env not found at ${pythonExe}` }, { status: 500 });
    }
    if (!fs.existsSync(mainScript)) {
      return NextResponse.json({ error: `Main script not found at ${mainScript}` }, { status: 500 });
    }

    // Execute check-batch synchronously
    const result = spawnSync(pythonExe, [
      mainScript,
      '--project-id', 'harvest-dummy',
      '--job-id', 'harvest-dummy-job',
      '--action', 'check-batch'
    ], {
      cwd: path.join(PROJECT_ROOT, 'scrapers'),
      env: {
        ...process.env,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      }
    });

    const stdout = result.stdout?.toString() || '';
    const stderr = result.stderr?.toString() || '';

    // Split and parse output telemetry logs
    const lines = stdout.split(/\r?\n/).filter(line => line.trim().length > 0);
    const parsedLogs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return { message: line };
      }
    });

    return NextResponse.json({
      success: result.status === 0,
      logs: parsedLogs,
      stderr: stderr
    });

  } catch (error: any) {
    console.error('Error polling batch status:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
