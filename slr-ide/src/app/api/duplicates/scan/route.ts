import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import { NextResponse } from 'next/server';

interface GlobalBatchState {
  isExecuting: boolean;
  isWaitingLogin: boolean;
  steps: string[];
  currentStep: string | null;
  stepStartTime: number | null;
  progress: number;
  statusText: string;
  logs: string[];
  currentItem: string | null;
  indexingState: any | null;
  pipelineStats: {
    matched: number;
    downloaded: number;
    failed: number;
    current: number;
    total: number;
    savedSpaceBytes: number;
    originalSpaceBytes: number;
  };
  activeChild: ChildProcess | null;
  cancelRequested: boolean;
  listeners: Array<(msg: any) => void>;
}

const globalState = (global as any);
if (!globalState.batchState) {
  globalState.batchState = {
    isExecuting: false,
    isWaitingLogin: false,
    steps: [],
    currentStep: null,
    stepStartTime: null,
    progress: 0,
    statusText: '',
    logs: [],
    currentItem: null,
    indexingState: null,
    pipelineStats: {
      matched: 0,
      downloaded: 0,
      failed: 0,
      current: 0,
      total: 0,
      savedSpaceBytes: 0,
      originalSpaceBytes: 0
    },
    activeChild: null,
    cancelRequested: false,
    listeners: []
  };
}
const batchState = globalState.batchState as GlobalBatchState;
const encoder = new TextEncoder();

const pushLog = (msg: string) => {
  batchState.logs.push(msg);
  if (batchState.logs.length > 500) {
    batchState.logs.shift();
  }
};

const broadcast = (data: any) => {
  let enriched = data;
  if (data && typeof data === 'object') {
    enriched = {
      ...data,
      pct: batchState.progress,
      progress: batchState.progress,
      pipelineStats: batchState.pipelineStats,
      currentItem: batchState.currentItem,
      message: data.message || batchState.statusText
    };
  }
  batchState.listeners.forEach(listener => {
    try {
      listener(enriched);
    } catch (e) {
      // ignore closed connections
    }
  });
};

function createSubscribedStream() {
  const stream = new ReadableStream({
    start(controller) {
      // Send the current accumulated state as the first message
      const restoreMsg = {
        event: 'restore',
        isExecuting: batchState.isExecuting,
        isWaitingLogin: batchState.isWaitingLogin,
        steps: batchState.steps,
        currentStep: batchState.currentStep,
        stepStartTime: batchState.stepStartTime,
        progress: batchState.progress,
        statusText: batchState.statusText,
        logs: batchState.logs,
        currentItem: batchState.currentItem,
        indexingState: batchState.indexingState,
        pipelineStats: batchState.pipelineStats
      };
      controller.enqueue(encoder.encode(JSON.stringify(restoreMsg) + '\n'));

      const listener = (msg: any) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'));
        } catch (e) {
          // ignore closed streams
        }
      };
      
      batchState.listeners.push(listener);
      (controller as any)._listener = listener;
    },
    cancel(controller) {
      const listener = (controller as any)._listener;
      if (listener) {
        batchState.listeners = batchState.listeners.filter(l => l !== listener);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}

function runBackgroundScan(activeProjectId: string) {
  // Resolve python paths
  const pythonPath = process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'python_engine', 'venv', 'bin', 'python');

  const args = ['-m', 'python_engine.entrypoints.detect_duplicates', '--project', activeProjectId];

  const child = spawn(pythonPath, args, {
    cwd: PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  batchState.activeChild = child;

  let buffer = '';

  child.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        
        // Map python events to batchState updates
        if (parsed.event === 'start') {
          batchState.pipelineStats.total = parsed.total;
          batchState.pipelineStats.current = 0;
          batchState.pipelineStats.matched = 0; // We reuse 'matched' count for 'found duplicates' in stats display
          batchState.statusText = `Scanning references for duplicates...`;
          pushLog(`>>> Starting duplicate scanning (Total references: ${parsed.total})`);
          broadcast({ event: 'step_start', step: 'duplicate_scan', message: `Scanning references for duplicates...` });
        } else if (parsed.event === 'progress') {
          batchState.pipelineStats.current = parsed.current;
          batchState.pipelineStats.matched = parsed.found_duplicates || 0;
          batchState.progress = Math.round((parsed.current / parsed.total) * 100);
          broadcast({
            event: 'progress',
            step: 'duplicate_scan',
            current: parsed.current,
            total: parsed.total,
            progress: batchState.progress,
            currentItem: parsed.title,
            matched: parsed.found_duplicates || 0
          });
        } else if (parsed.event === 'log') {
          pushLog(parsed.message);
          broadcast({ event: 'log', message: parsed.message });
        } else if (parsed.event === 'complete') {
          pushLog(`<<< Duplicate scan complete. Found ${parsed.found_duplicates} candidate pairs.`);
          broadcast({
            event: 'step_complete',
            step: 'duplicate_scan',
            message: `<<< Duplicate scan complete. Found ${parsed.found_duplicates} candidate pairs.`
          });
        } else if (parsed.event === 'error') {
          pushLog(`[ERROR]: ${parsed.message}`);
          broadcast({ event: 'error', message: parsed.message });
        }
      } catch (e) {
        // Fallback for non-JSON lines
        pushLog(trimmed);
        broadcast({ event: 'log', message: trimmed });
      }
    }
  });

  child.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      pushLog(`[STDERR]: ${msg}`);
      broadcast({ event: 'log', message: `[STDERR]: ${msg}` });
    }
  });

  child.on('close', (code) => {
    batchState.isExecuting = false;
    batchState.activeChild = null;

    if (batchState.cancelRequested) {
      const cancelMsg = { event: 'error', message: 'Pipeline cancelled by user.' };
      pushLog(`[CANCELLED]: ${cancelMsg.message}`);
      broadcast(cancelMsg);
    } else if (code !== 0) {
      const errorMsg = { event: 'error', message: `Duplicate scan failed with exit code ${code}` };
      pushLog(`[ERROR]: ${errorMsg.message}`);
      broadcast(errorMsg);
    } else {
      const finalMsg = { event: 'complete', message: 'Duplicate scan completed successfully.' };
      pushLog(`[SUCCESS]: ${finalMsg.message}`);
      broadcast(finalMsg);
    }
    
    batchState.listeners = [];
  });

  child.on('error', (err) => {
    batchState.isExecuting = false;
    batchState.activeChild = null;
    const errorMsg = { event: 'error', message: `Failed to spawn process: ${err.message}` };
    pushLog(`[ERROR]: ${errorMsg.message}`);
    broadcast(errorMsg);
    batchState.listeners = [];
  });
}

export async function POST(req: Request) {
  try {
    if (batchState.isExecuting) {
      return createSubscribedStream();
    }

    // Get active project ID
    const activeProjectRow = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
    const activeProjectId = activeProjectRow?.value || 'default-project';

    batchState.isExecuting = true;
    batchState.steps = ['duplicate_scan'];
    batchState.currentStep = 'duplicate_scan';
    batchState.stepStartTime = Date.now();
    batchState.progress = 0;
    batchState.statusText = 'Starting duplicate scan...';
    batchState.logs = [];
    batchState.currentItem = null;
    batchState.indexingState = null;
    batchState.pipelineStats = {
      matched: 0,
      downloaded: 0,
      failed: 0,
      current: 0,
      total: 0,
      savedSpaceBytes: 0,
      originalSpaceBytes: 0
    };
    batchState.activeChild = null;
    batchState.cancelRequested = false;

    runBackgroundScan(activeProjectId);

    return createSubscribedStream();
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to scan duplicates' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const streamParam = url.searchParams.get('stream');

  if (streamParam === 'true') {
    return createSubscribedStream();
  }

  return NextResponse.json({
    isExecuting: batchState.isExecuting,
    isWaitingLogin: batchState.isWaitingLogin,
    steps: batchState.steps,
    currentStep: batchState.currentStep,
    stepStartTime: batchState.stepStartTime,
    progress: batchState.progress,
    statusText: batchState.statusText,
    logs: batchState.logs,
    currentItem: batchState.currentItem,
    indexingState: batchState.indexingState,
    pipelineStats: batchState.pipelineStats
  });
}
