import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { PROJECT_ROOT } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, k, pool, mode } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
    const pythonModule = 'python_engine.entrypoints.semantic_search';

    const args = ['-u', '-m', pythonModule, '--query', query];
    if (k) {
      args.push('--k', String(k));
    }
    if (pool) {
      args.push('--pool', pool);
    }
    if (mode) {
      args.push('--mode', mode);
    }

    const child = spawn(pythonExe, args, { cwd: PROJECT_ROOT });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      child.on('close', resolve);
    });

    if (exitCode !== 0) {
      console.error('[Semantic Search Error Stderr]:', stderrData);
      return NextResponse.json({ error: `Python execution failed: ${stderrData || 'Unknown error'}` }, { status: 500 });
    }

    try {
      const parsed = JSON.parse(stdoutData.trim());
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 500 });
      }
      return NextResponse.json(parsed);
    } catch (e: any) {
      console.error('[Semantic Search Parse Error]:', e, 'Stdout was:', stdoutData);
      return NextResponse.json({ error: `Failed to parse Python output: ${e.message}` }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to trigger semantic search' }, { status: 500 });
  }
}
