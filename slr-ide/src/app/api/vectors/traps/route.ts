import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { PROJECT_ROOT, getConfig } from '@/lib/db';
import { vectorDaemonManager } from '@/lib/services/vector-daemon-manager';

async function runFallbackTraps(
  seedPaperId: string,
  projectId: string,
  k: number | undefined,
  signal: AbortSignal
): Promise<any> {
  const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
  const pythonModule = 'python_engine.entrypoints.find_traps';

  const args = ['-u', '-m', pythonModule, '--seed', seedPaperId, '--project', projectId];
  if (k) args.push('--k', String(k));

  const child = spawn(pythonExe, args, { cwd: PROJECT_ROOT });

  const abortHandler = () => {
    try { child.kill('SIGKILL'); } catch (err) {}
  };
  signal.addEventListener('abort', abortHandler);

  let stdoutData = '';
  let stderrData = '';

  child.stdout.on('data', (data) => { stdoutData += data.toString(); });
  child.stderr.on('data', (data) => { stderrData += data.toString(); });

  const exitCode = await new Promise<number>((resolve) => {
    child.on('close', (code) => {
      signal.removeEventListener('abort', abortHandler);
      resolve(code ?? 0);
    });
  });

  if (exitCode !== 0) {
    throw new Error(stderrData || 'Unknown fallback traps error');
  }

  const parsed = JSON.parse(stdoutData.trim());
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  return parsed;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { seedPaperId, k } = body;

    if (!seedPaperId) {
      return NextResponse.json({ error: 'seedPaperId is required' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    let parsed: any;
    try {
      // Try using the persistent background daemon
      parsed = await vectorDaemonManager.request('traps', {
        seed: seedPaperId,
        project_id: activeProjectId,
        k,
      });
    } catch (daemonErr) {
      console.warn('[API Vectors Traps]: Persistent daemon failed. Falling back to single-use subprocess...', daemonErr);
      
      // Fallback: spawn single-use find_traps.py child process
      parsed = await runFallbackTraps(
        seedPaperId,
        activeProjectId,
        k,
        request.signal
      );
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('[API Vectors Traps Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger semantic traps search' }, { status: 500 });
  }
}
