import { getConfig } from '@/lib/db';
import { NextResponse } from 'next/server';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';
import { runBackgroundExecution } from '@/lib/services/batch-pipeline-executor';

export async function POST(req: Request) {
  try {
    let body = { steps: ['scan', 'scrape', 'sync'] };
    try {
      body = await req.json();
    } catch (e) {
      // ignore
    }

    const steps = body.steps || ['scan', 'scrape', 'sync'];
    const compress = getConfig('PDF_COMPRESSION_ENABLED', 'false') === 'true';

    const batchState = batchStateTracker.getState();
    if (batchState.isExecuting) {
      return streamManager.createEventStream(() => batchStateTracker.getState());
    }

    batchStateTracker.resetBatchState(steps);

    runBackgroundExecution(steps, compress);

    return streamManager.createEventStream(() => batchStateTracker.getState());
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to execute batch' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const streamParam = url.searchParams.get('stream');

  if (streamParam === 'true') {
    return streamManager.createEventStream(() => batchStateTracker.getState());
  }

  const batchState = batchStateTracker.getState();
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
