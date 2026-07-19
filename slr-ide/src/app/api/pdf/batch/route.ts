import db, { getConfig } from '@/lib/db';
import { NextResponse } from 'next/server';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';
import { runBackgroundExecution } from '@/lib/services/batch-pipeline-executor';
import { pipelineLock } from '@/lib/services/pipeline-lock';

export async function POST(req: Request) {
  try {
    if (pipelineLock.isLocked()) {
      return new Response(JSON.stringify({ error: 'Another pipeline is currently running. Please wait for it to complete.' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: any = { steps: ['scan', 'verify', 'scrape', 'sync'] };
    try {
      body = await req.json();
    } catch (e) {
      // ignore
    }

    const steps = body.steps || ['scan', 'verify', 'scrape', 'sync'];
    const compress = getConfig('PDF_COMPRESSION_ENABLED', 'false') === 'true';
    const forceUpdate = body.force_update === true;

    // Auto-update IGNORED papers with valid DOIs, stage > 0, and screening decision 'Include' to MISSING so the pipeline captures them
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    db.prepare(`
      UPDATE papers
      SET Local_PDF_Status = 'MISSING'
      WHERE Project_ID = ?
        AND (manual_stage > 0 OR ai_stage > 0)
        AND (Local_PDF_Status = 'IGNORED' OR Local_PDF_Status = 'Ignored')
        AND DOI IS NOT NULL
        AND DOI != ''
        AND TRIM(DOI) != ''
        AND (CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision ELSE COALESCE(manual_decision, ai_decision) END) LIKE 'INCLUDE%'
    `).run(activeProjectId);

    const batchState = batchStateTracker.getState();
    if (batchState.isExecuting) {
      return streamManager.createEventStream(() => batchStateTracker.getState());
    }

    batchStateTracker.resetBatchState(steps, forceUpdate);

    pipelineLock.acquire();
    runBackgroundExecution(steps, compress, forceUpdate);

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
    forceUpdate: batchState.forceUpdate,
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
