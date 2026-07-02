import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { PROJECT_ROOT, getConfig } from '@/lib/db';
import { getCachedSemanticSearch, saveCachedSemanticSearch } from '@/lib/services/semantic-search-cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, k, pool, mode } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const normalizedPool = pool === 'unassigned' ? 'none' : pool;

    // 1. Perform Cache Lookup
    if (mode === 'papers') {
      const cachedResults = getCachedSemanticSearch(activeProjectId, query, normalizedPool);
      if (cachedResults !== null) {
        return NextResponse.json({ results: cachedResults });
      }
    }

    // Kill any existing active semantic search subprocess
    const globalRef = global as any;
    if (globalRef.activeSemanticSearchChild) {
      try {
        console.log('[API Vectors Search]: Terminating active semantic search child process...');
        globalRef.activeSemanticSearchChild.kill('SIGKILL');
      } catch (err) {
        console.error('Failed to kill previous semantic search child:', err);
      }
      globalRef.activeSemanticSearchChild = null;
    }

    const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
    const pythonModule = 'python_engine.entrypoints.semantic_search';

    const args = ['-u', '-m', pythonModule, '--query', query];
    if (k) {
      args.push('--k', String(k));
    }
    if (normalizedPool) {
      args.push('--pool', normalizedPool);
    }
    if (mode) {
      args.push('--mode', mode);
    }

    const child = spawn(pythonExe, args, { cwd: PROJECT_ROOT });
    globalRef.activeSemanticSearchChild = child;

    const abortHandler = () => {
      console.log('[API Vectors Search]: Request aborted by client, terminating python child process...');
      try {
        child.kill('SIGKILL');
      } catch (err) {}
      if (globalRef.activeSemanticSearchChild === child) {
        globalRef.activeSemanticSearchChild = null;
      }
    };
    request.signal.addEventListener('abort', abortHandler);

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      child.on('close', (code) => {
        if (globalRef.activeSemanticSearchChild === child) {
          globalRef.activeSemanticSearchChild = null;
        }
        request.signal.removeEventListener('abort', abortHandler);
        resolve(code ?? 0);
      });
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
      
      // 2. Cache the parsed results
      if (mode === 'papers' && parsed.results) {
        saveCachedSemanticSearch(activeProjectId, query, normalizedPool, parsed.results);
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
