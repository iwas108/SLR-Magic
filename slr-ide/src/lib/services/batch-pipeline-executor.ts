import path from 'path';
import fs from 'fs';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';
import { runSubprocessStep } from './pipeline/subprocess-runner';
import { runCloudSync, generateCloudLinks } from './pipeline/rclone-sync';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';

export async function runBackgroundExecution(steps: string[], compress: boolean, forceUpdate: boolean = false) {
  const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
  
  const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
  const project = db.prepare('SELECT folder_name, gdrive_dest_path, cloud_provider, rclone_remote_name FROM projects WHERE id = ?').get(activeProjectId) as { folder_name: string; gdrive_dest_path: string; cloud_provider?: string; rclone_remote_name?: string } | undefined;
  const folderName = project ? project.folder_name : 'default_project';
  const gdriveDest = project ? project.gdrive_dest_path : 'SLR_Magic/PDFs';

  const rawPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'raw');
  const pdfRepoDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', folderName);
  if (!fs.existsSync(rawPdfDir)) fs.mkdirSync(rawPdfDir, { recursive: true });
  if (!fs.existsSync(pdfRepoDir)) fs.mkdirSync(pdfRepoDir, { recursive: true });

  const rclonePath = getConfig('RCLONE_EXECUTABLE_PATH', 'rclone');
  const cloudProvider = project?.cloud_provider || 'gdrive';
  const remote = project?.rclone_remote_name || (cloudProvider === 'onedrive' ? 'onedrive' : 'gdrive');
  const cloudName = cloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive';
  const destPath = `${gdriveDest}/${folderName}`;
  const configPath = getConfig('RCLONE_CONFIG_PATH', '');
  const syncMode = getConfig('RCLONE_SYNC_MODE', 'incremental');

  const batchState = batchStateTracker.getState();

  try {
    for (let i = 0; i < steps.length; i++) {
      if (batchState.cancelRequested) break;
      const step = steps[i];
      const stepNum = i + 1;
      const totalSteps = steps.length;

      let pythonModule = '';
      if (step === 'scan') {
        pythonModule = 'python_engine.entrypoints.match_cache';
      } else if (step === 'scrape') {
        pythonModule = 'python_engine.entrypoints.scrape_pdfs';
      } else if (step === 'verify') {
        pythonModule = 'python_engine.entrypoints.verify_pdfs';
      } else if (step === 'compress') {
        pythonModule = 'python_engine.entrypoints.compress_pdfs';
      } else if (step === 'map_publisher') {
        pythonModule = 'python_engine.entrypoints.map_publisher';
      }

      if (step === 'scan' || step === 'scrape' || step === 'verify' || step === 'compress' || step === 'map_publisher') {
        if (step === 'scrape') {
          const onlineWorkers = remoteWorkerManager.getOnlineWorkers();
          const localEnabled = getConfig('REMOTE_WORKER_LOCAL_SCRAPER_ENABLED', 'true') === 'true';

          if (onlineWorkers.length > 0) {
            const msg = `Starting dispatch to ${onlineWorkers.length} remote worker(s)...`;
            batchStateTracker.updateStateFromMsg({ event: 'log', message: msg, step: 'scrape' });
            streamManager.broadcast({ event: 'log', message: msg, step: 'scrape' });
            await remoteWorkerManager.startDispatch(activeProjectId);
          }

          try {
            if (localEnabled || onlineWorkers.length === 0) {
              await runSubprocessStep(step, pythonExe, pythonModule, PROJECT_ROOT, stepNum, totalSteps, batchState, forceUpdate);
            } else {
              // Local scraper is disabled, but we have remote workers. 
              // We must block this orchestration thread until all papers are processed or user cancels.
              const stepStartMsg = { event: 'step_start', step: 'scrape', message: `[${stepNum}/${totalSteps}] Orchestrating remote scraping...` };
              batchStateTracker.updateStateFromMsg(stepStartMsg);
              streamManager.broadcast(stepStartMsg);

              let loopCount = 0;
              while (!batchState.cancelRequested) {
                const totalRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND DOI IS NOT NULL AND DOI != ''`).get(activeProjectId) as { c: number };
                const leftRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND DOI IS NOT NULL AND DOI != '' AND (Local_PDF_Status IS NULL OR Local_PDF_Status = 'MISSING' OR Local_PDF_Status = 'IN_PROGRESS')`).get(activeProjectId) as { c: number };
                
                if (leftRow.c === 0) break;
                
                if (loopCount % 2 === 0) { // Broadcast progress roughly every 4 seconds
                  const doneRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND Local_PDF_Status = 'DOWNLOADED'`).get(activeProjectId) as { c: number };
                  const failedRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND Local_PDF_Status = 'FAILED'`).get(activeProjectId) as { c: number };
                  
                  streamManager.broadcast({ 
                    event: 'progress', 
                    step: 'scrape', 
                    current: totalRow.c - leftRow.c, 
                    total: totalRow.c, 
                    downloaded: doneRow.c, 
                    failed: failedRow.c 
                  });
                }
                
                await new Promise(r => setTimeout(r, 2000));
                loopCount++;
              }
              
              if (batchState.cancelRequested) {
                 batchStateTracker.updateStateFromMsg({ event: 'log', message: 'Scrape step cancelled by user.', step: 'scrape' });
              }
            }
          } finally {
            if (onlineWorkers.length > 0) {
               const stopMsg = 'Stopping remote worker dispatch...';
               batchStateTracker.updateStateFromMsg({ event: 'log', message: stopMsg, step: 'scrape' });
               streamManager.broadcast({ event: 'log', message: stopMsg, step: 'scrape' });
               await remoteWorkerManager.stopDispatch();
            }
          }
        } else {
          await runSubprocessStep(step, pythonExe, pythonModule, PROJECT_ROOT, stepNum, totalSteps, batchState, forceUpdate);
        }
      }

      else if (step === 'sync') {
        const stepStartMsg = { 
          event: 'step_start', 
          step: 'sync', 
          message: `[${stepNum}/${totalSteps}] Starting ${cloudName} Cloud Sync...` 
        };
        batchStateTracker.updateStateFromMsg(stepStartMsg);
        streamManager.broadcast(stepStartMsg);

        // Run Python compressor subprocess unconditionally to prepare the repository (copies or compresses)
        try {
          await runSubprocessStep('compress', pythonExe, 'python_engine.entrypoints.compress_pdfs', PROJECT_ROOT, stepNum, totalSteps, batchState, forceUpdate);
          if (batchState.cancelRequested) continue;

          const syncStartMsg = { event: 'step_start', step: 'sync', message: 'Syncing Files (Rclone)...' };
          batchStateTracker.updateStateFromMsg(syncStartMsg);
          streamManager.broadcast(syncStartMsg);
        } catch (err: any) {
          batchStateTracker.updateStateFromMsg({ event: 'log', message: `Warning during pre-sync file processing: ${err.message}`, step: 'sync' });
          streamManager.broadcast({ event: 'log', message: `Warning during pre-sync file processing: ${err.message}`, step: 'sync' });
        }

        const syncSuccess = await runCloudSync(
          syncMode,
          pdfRepoDir,
          remote,
          destPath,
          configPath,
          rclonePath,
          cloudName,
          activeProjectId,
          batchState
        );

        if (syncSuccess) {
          const infoMsg = { event: 'info', message: `Sync complete. Creating ${cloudName} links...`, step: 'sync' };
          batchStateTracker.updateStateFromMsg(infoMsg);
          streamManager.broadcast(infoMsg);

          await generateCloudLinks(
            activeProjectId,
            pdfRepoDir,
            remote,
            destPath,
            configPath,
            rclonePath,
            cloudName,
            batchState,
            forceUpdate
          );
        }
      }
    }

    if (batchState.cancelRequested) {
      const cancelMsg = { event: 'error', message: 'Pipeline cancelled by user.', isTerminal: true };
      batchStateTracker.updateStateFromMsg(cancelMsg);
      streamManager.broadcast(cancelMsg);
    } else {
      const finalMsg = { event: 'complete', message: 'All requested batch operations completed.', isTerminal: true };
      batchStateTracker.updateStateFromMsg(finalMsg);
      streamManager.broadcast(finalMsg);
    }

  } catch (err: any) {
    const errorMsg = { event: 'error', message: `Pipeline crash: ${err.message}`, isTerminal: true };
    batchStateTracker.updateStateFromMsg(errorMsg);
    streamManager.broadcast(errorMsg);
  } finally {
    batchState.isExecuting = false;
    batchState.activeChild = null;
    batchState.listeners = [];
    
    // Auto-release the global pipeline lock when execution finishes or crashes
    const { pipelineLock } = require('@/lib/services/pipeline-lock');
    pipelineLock.release();
  }
}
