import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { PROJECT_ROOT, getConfig } from '@/lib/db';
import { getCachedSemanticSearch, saveCachedSemanticSearch } from '@/lib/services/semantic-search-cache';
import { vectorDaemonManager } from '@/lib/services/vector-daemon-manager';

async function runFallbackSearch(
  query: string,
  projectId: string,
  k: number | undefined,
  normalizedPool: string | undefined,
  mode: string | undefined,
  excludeReviews: boolean | undefined,
  publisher: string | undefined,
  signal: AbortSignal
): Promise<any> {
  const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
  const pythonModule = 'python_engine.entrypoints.semantic_search';

  const args = ['-u', '-m', pythonModule, '--query', query, '--project', projectId];
  if (k) args.push('--k', String(k));
  if (normalizedPool) args.push('--pool', normalizedPool);
  if (mode) args.push('--mode', mode);
  if (excludeReviews) args.push('--exclude-reviews');
  if (publisher && publisher !== 'all') args.push('--publisher', publisher);

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
    throw new Error(stderrData || 'Unknown fallback search error');
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
    const { action, query, k, pool, mode, excludeReviews, publisher } = body;

    // Handle pre-warm action to start Python vector worker daemon in the background
    if (action === 'warmup') {
      vectorDaemonManager.ensureStarted().catch((err) => {
        console.warn('[API Vectors Search]: Background pre-warm failed:', err);
      });
      return NextResponse.json({ success: true, status: 'warming_up' });
    }

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const normalizedPool = pool === 'unassigned' ? 'none' : pool;
    let cachePoolKey = excludeReviews ? `${normalizedPool}_exclude_reviews` : normalizedPool;
    if (publisher && publisher !== 'all') {
      cachePoolKey += `_pub_${publisher}`;
    }

    // 1. Perform Cache Lookup (only return if cache contains sufficient candidates for requested k)
    if (mode === 'papers') {
      const cachedResults = getCachedSemanticSearch(activeProjectId, query, cachePoolKey);
      const targetK = typeof k === 'number' && k > 0 ? k : 1000;
      if (cachedResults !== null && (cachedResults.length >= Math.min(targetK, 100) || cachedResults.length === 0)) {
        return NextResponse.json({ results: cachedResults });
      }
    }

    let parsed: any;
    try {
      // Try using the persistent background daemon
      parsed = await vectorDaemonManager.request('search', {
        query,
        project_id: activeProjectId,
        k,
        pool: normalizedPool,
        mode,
        exclude_reviews: excludeReviews,
        publisher,
      });
    } catch (daemonErr) {
      console.warn('[API Vectors Search]: Persistent daemon failed. Falling back to single-use subprocess...', daemonErr);
      
      // Fallback: spawn single-use semantic_search.py child process
      parsed = await runFallbackSearch(
        query,
        activeProjectId,
        k,
        normalizedPool,
        mode,
        excludeReviews,
        publisher,
        request.signal
      );
    }

    // 2. Cache the parsed results
    if (mode === 'papers' && parsed.results) {
      saveCachedSemanticSearch(activeProjectId, query, cachePoolKey, parsed.results);
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('[API Vectors Search Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to trigger semantic search' }, { status: 500 });
  }
}
