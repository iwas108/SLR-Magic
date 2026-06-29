import { processManager } from '@/lib/services/process-manager';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';

export async function runSubprocessStep(
  step: string,
  pythonExe: string,
  pythonModule: string,
  projectRoot: string,
  stepNum: number,
  totalSteps: number,
  batchState: any
): Promise<void> {
  let stepStartMsg = '';
  if (step === 'scan') {
    stepStartMsg = `[${stepNum}/${totalSteps}] Starting Cached PDF matching...`;
  } else if (step === 'scrape') {
    stepStartMsg = `[${stepNum}/${totalSteps}] Starting Bulk PDF Scraper...`;
  } else if (step === 'compress') {
    stepStartMsg = `[${stepNum}/${totalSteps}] Starting PDF Compression/Processing...`;
  } else if (step === 'map_publisher') {
    stepStartMsg = `[${stepNum}/${totalSteps}] Starting Publisher Mapping...`;
  }

  const msg = { 
    event: 'step_start', 
    step, 
    message: stepStartMsg 
  };
  batchStateTracker.updateStateFromMsg(msg);
  streamManager.broadcast(msg);

  await new Promise<void>((resolve) => {
    if (batchState.cancelRequested) {
      resolve();
      return;
    }
    const child = processManager.spawnProcess(pythonExe, ['-u', '-m', pythonModule], { cwd: projectRoot });

    let stdoutBuffer = '';
    const processLine = (line: string) => {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.event === 'complete') {
            return;
          }
          batchStateTracker.updateStateFromMsg({ ...parsed, step });
          streamManager.broadcast({ ...parsed, step });
        } catch {
          batchStateTracker.updateStateFromMsg({ event: 'log', message: line, step });
          streamManager.broadcast({ event: 'log', message: line, step });
        }
      }
    };

    child.stdout?.on('data', (data: any) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line);
      }
    });

    child.stderr?.on('data', (data: any) => {
      const logMsg = { event: 'log', message: `[${step} Error]: ${data.toString()}`, step };
      batchStateTracker.updateStateFromMsg(logMsg);
      streamManager.broadcast(logMsg);
    });

    child.on('close', (code: any) => {
      if (stdoutBuffer.trim()) {
        processLine(stdoutBuffer);
        stdoutBuffer = '';
      }
      const completeMsg = { 
        event: 'step_complete', 
        step, 
        message: `[${step} Finished] with exit code ${code}` 
      };
      batchStateTracker.updateStateFromMsg(completeMsg);
      streamManager.broadcast(completeMsg);
      batchState.activeChild = null;
      resolve();
    });

    child.on('error', (err: any) => {
      if (stdoutBuffer.trim()) {
        processLine(stdoutBuffer);
        stdoutBuffer = '';
      }
      const errorMsg = { event: 'error', message: `${step} fail: ${err.message}`, step };
      batchStateTracker.updateStateFromMsg(errorMsg);
      streamManager.broadcast(errorMsg);
      batchState.activeChild = null;
      resolve();
    });
  });
}
