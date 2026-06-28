import { execSync, execFileSync, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import { NextResponse } from 'next/server';
import { promisify } from 'util';
import { processManager } from '@/lib/services/process-manager';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';

const execFileAsync = promisify(execFile);

function getGhostscriptCommand(): string | null {
  const customPath = getConfig('GHOSTSCRIPT_PATH', '');
  if (customPath && customPath.trim()) {
    if (fs.existsSync(customPath.trim())) {
      return customPath.trim();
    }
    try {
      execSync(process.platform === 'win32' ? `where "${customPath.trim()}"` : `which "${customPath.trim()}"`, { stdio: 'ignore' });
      return customPath.trim();
    } catch (e) {
      // ignore
    }
  }
  for (const cmd of ['gs', 'gswin64c', 'gswin32c']) {
    try {
      execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

async function runBackgroundExecution(steps: string[], compress: boolean) {
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
        const msg = { 
          event: 'step_start', 
          step: 'scan', 
          message: `[${stepNum}/${totalSteps}] Starting Cached PDF matching...` 
        };
        batchStateTracker.updateStateFromMsg(msg);
        streamManager.broadcast(msg);
      } else if (step === 'scrape') {
        pythonModule = 'python_engine.entrypoints.scrape_pdfs';
        const msg = { 
          event: 'step_start', 
          step: 'scrape', 
          message: `[${stepNum}/${totalSteps}] Starting Bulk PDF Scraper...` 
        };
        batchStateTracker.updateStateFromMsg(msg);
        streamManager.broadcast(msg);
      } else if (step === 'compress') {
        pythonModule = 'python_engine.entrypoints.compress_pdfs';
        const msg = { 
          event: 'step_start', 
          step: 'compress', 
          message: `[${stepNum}/${totalSteps}] Starting PDF Compression/Processing...` 
        };
        batchStateTracker.updateStateFromMsg(msg);
        streamManager.broadcast(msg);
      } else if (step === 'map_publisher') {
        pythonModule = 'python_engine.entrypoints.map_publisher';
        const msg = { 
          event: 'step_start', 
          step: 'map_publisher', 
          message: `[${stepNum}/${totalSteps}] Starting Publisher Mapping...` 
        };
        batchStateTracker.updateStateFromMsg(msg);
        streamManager.broadcast(msg);
      } else if (step === 'sync') {
        const msg = { 
          event: 'step_start', 
          step: 'sync', 
          message: `[${stepNum}/${totalSteps}] Starting ${cloudName} Cloud Sync...` 
        };
        batchStateTracker.updateStateFromMsg(msg);
        streamManager.broadcast(msg);
      }

      if (step === 'scan' || step === 'scrape' || step === 'compress' || step === 'map_publisher') {
        await new Promise<void>((resolve) => {
          if (batchState.cancelRequested) {
            resolve();
            return;
          }
          const child = processManager.spawnProcess(pythonExe, ['-u', '-m', pythonModule], { cwd: PROJECT_ROOT });

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

          child.stdout?.on('data', (data) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop() || '';
            for (const line of lines) {
              processLine(line);
            }
          });

          child.stderr?.on('data', (data) => {
            const msg = { event: 'log', message: `[${step} Error]: ${data.toString()}`, step };
            batchStateTracker.updateStateFromMsg(msg);
            streamManager.broadcast(msg);
          });

          child.on('close', (code) => {
            if (stdoutBuffer.trim()) {
              processLine(stdoutBuffer);
              stdoutBuffer = '';
            }
            const msg = { 
              event: 'step_complete', 
              step, 
              message: `[${step} Finished] with exit code ${code}` 
            };
            batchStateTracker.updateStateFromMsg(msg);
            streamManager.broadcast(msg);
            batchState.activeChild = null;
            resolve();
          });

          child.on('error', (err) => {
            if (stdoutBuffer.trim()) {
              processLine(stdoutBuffer);
              stdoutBuffer = '';
            }
            const msg = { event: 'error', message: `${step} fail: ${err.message}`, step };
            batchStateTracker.updateStateFromMsg(msg);
            streamManager.broadcast(msg);
            batchState.activeChild = null;
            resolve();
          });
        });
      }

      else if (step === 'sync') {
        try {
          const papersToSync = db.prepare(`
            SELECT Paper_ID, Local_PDF_Path FROM papers
            WHERE Project_ID = ? AND Local_PDF_Status IN ('MATCHED', 'DOWNLOADED')
          `).all(activeProjectId) as { Paper_ID: string; Local_PDF_Path: string }[];

          if (papersToSync.length > 0) {
            const gsCommand = compress ? getGhostscriptCommand() : null;
            const gsLevel = getConfig('PDF_COMPRESSION_LEVEL', '/ebook');

            if (gsCommand) {
              const startMsg = { event: 'step_start', step: 'compress', message: 'Compressing PDFs before upload...' };
              batchStateTracker.updateStateFromMsg(startMsg);
              streamManager.broadcast(startMsg);

              const startEvent = { event: 'start', step: 'compress', total: papersToSync.length };
              batchStateTracker.updateStateFromMsg(startEvent);
              streamManager.broadcast(startEvent);
            }

            let processedCount = 0;
            for (const paper of papersToSync) {
              if (batchState.cancelRequested) break;
              if (!paper.Local_PDF_Path) continue;
              const inputPath = path.join(PROJECT_ROOT, paper.Local_PDF_Path);
              const outputPath = path.join(pdfRepoDir, `${paper.Paper_ID}.pdf`);

              let origSize = 0;
              let newSize = 0;
              try {
                if (fs.existsSync(inputPath)) {
                  origSize = fs.statSync(inputPath).size;
                }
              } catch (e) {}

              if (!fs.existsSync(inputPath)) {
                batchStateTracker.updateStateFromMsg({ event: 'log', message: `Warning: Source PDF not found on disk for ${paper.Paper_ID}: ${paper.Local_PDF_Path}`, step: 'sync' });
                streamManager.broadcast({ event: 'log', message: `Warning: Source PDF not found on disk for ${paper.Paper_ID}: ${paper.Local_PDF_Path}`, step: 'sync' });
                continue;
              }

              let compressionSuccess = false;
              if (gsCommand && origSize > 0) {
                try {
                  execFileSync(gsCommand, [
                    '-sDEVICE=pdfwrite',
                    '-dCompatibilityLevel=1.4',
                    `-dPDFSETTINGS=${gsLevel}`,
                    '-dNOPAUSE',
                    '-dQUIET',
                    '-dBATCH',
                    `-sOutputFile=${outputPath}`,
                    inputPath
                  ]);
                  if (fs.existsSync(outputPath)) {
                    compressionSuccess = true;
                    newSize = fs.statSync(outputPath).size;
                  }
                } catch (e: any) {
                  batchStateTracker.updateStateFromMsg({ event: 'log', message: `Warning: Ghostscript failed for ${paper.Paper_ID}. Falling back to copy: ${e.message}`, step: 'sync' });
                  streamManager.broadcast({ event: 'log', message: `Warning: Ghostscript failed for ${paper.Paper_ID}. Falling back to copy: ${e.message}`, step: 'sync' });
                }
              }

              if (!compressionSuccess) {
                try {
                  fs.copyFileSync(inputPath, outputPath);
                  if (fs.existsSync(outputPath)) {
                    newSize = fs.statSync(outputPath).size;
                  }
                } catch (e: any) {
                  batchStateTracker.updateStateFromMsg({ event: 'log', message: `Error copying ${paper.Paper_ID}: ${e.message}`, step: 'sync' });
                  streamManager.broadcast({ event: 'log', message: `Error copying ${paper.Paper_ID}: ${e.message}`, step: 'sync' });
                  continue;
                }
              }
              processedCount++;

              if (gsCommand) {
                const ratio = origSize > 0 ? Math.round(((origSize - newSize) / origSize) * 100) : 0;
                const progressMsg = {
                  event: 'progress',
                  step: 'compress',
                  current: processedCount,
                  total: papersToSync.length,
                  paper_id: paper.Paper_ID,
                  original_size: origSize,
                  new_size: newSize,
                  ratio: ratio,
                  skipped: false
                };
                batchStateTracker.updateStateFromMsg(progressMsg);
                streamManager.broadcast(progressMsg);
              }
            }
            if (gsCommand) {
              const completeMsg = { event: 'step_complete', step: 'compress', message: `Finished processing PDFs. Compressed ${processedCount} files.` };
              batchStateTracker.updateStateFromMsg(completeMsg);
              streamManager.broadcast(completeMsg);
            } else {
              batchStateTracker.updateStateFromMsg({ event: 'log', message: `Finished processing PDFs. Copied ${processedCount} files.`, step: 'sync' });
              streamManager.broadcast({ event: 'log', message: `Finished processing PDFs. Copied ${processedCount} files.`, step: 'sync' });
            }

            const syncStartMsg = { event: 'step_start', step: 'sync', message: 'Syncing Files (Rclone)...' };
            batchStateTracker.updateStateFromMsg(syncStartMsg);
            streamManager.broadcast(syncStartMsg);
          }
        } catch (err: any) {
          batchStateTracker.updateStateFromMsg({ event: 'log', message: `Warning during pre-sync file processing: ${err.message}`, step: 'sync' });
          streamManager.broadcast({ event: 'log', message: `Warning during pre-sync file processing: ${err.message}`, step: 'sync' });
        }

        const subCommand = syncMode === 'mirror' ? 'sync' : 'copy';
        const syncArgs = [
          subCommand, 
          pdfRepoDir, 
          `${remote}:${destPath}`, 
          '-L', 
          '--create-empty-src-dirs', 
          '-v',
          '--stats', '1s',
          '--stats-one-line'
        ];
        if (configPath) {
          syncArgs.push('--config', configPath);
        }

        await new Promise<void>((resolve) => {
          if (batchState.cancelRequested) {
            resolve();
            return;
          }
          const child = processManager.spawnProcess(rclonePath, syncArgs);

          let stdoutBuffer = '';
          let stderrBuffer = '';

          const processRcloneLine = (line: string) => {
            if (line.trim()) {
              const msg = { event: 'rclone_log', message: line.trim(), step: 'sync' };
              batchStateTracker.updateStateFromMsg(msg);
              streamManager.broadcast(msg);
            }
          };

          child.stdout?.on('data', (data) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop() || '';
            for (const line of lines) {
              processRcloneLine(line);
            }
          });

          child.stderr?.on('data', (data) => {
            stderrBuffer += data.toString();
            const lines = stderrBuffer.split('\n');
            stderrBuffer = lines.pop() || '';
            for (const line of lines) {
              processRcloneLine(line);
            }
          });

          child.on('close', async (code) => {
            if (stdoutBuffer.trim()) {
              processRcloneLine(stdoutBuffer);
              stdoutBuffer = '';
            }
            if (stderrBuffer.trim()) {
              processRcloneLine(stderrBuffer);
              stderrBuffer = '';
            }

            if (code !== 0) {
              let errorMsg = `Rclone sync failed with exit code ${code}`;
              const hasAuthError = batchState.logs.some(log => 
                log.includes('empty token found') || 
                log.includes('oauth client') ||
                log.includes('reconnect') ||
                log.includes('token expired')
              );
              
              if (hasAuthError) {
                errorMsg = `Rclone authentication failed (exit code ${code}). Empty/expired token found. Please run "rclone config reconnect ${remote}:" in your terminal to re-authenticate and connect to ${cloudName}.`;
              }

              const msg = { event: 'error', message: errorMsg, step: 'sync' };
              batchStateTracker.updateStateFromMsg(msg);
              streamManager.broadcast(msg);
              batchState.activeChild = null;
              resolve();
              return;
            }

            const infoMsg = { event: 'info', message: `Sync complete. Creating ${cloudName} links...`, step: 'sync' };
            batchStateTracker.updateStateFromMsg(infoMsg);
            streamManager.broadcast(infoMsg);

            try {
              const papers = db.prepare(`
                SELECT Paper_ID FROM papers 
                WHERE Local_PDF_Status IN ('MATCHED', 'DOWNLOADED')
                  AND Project_ID = ?
              `).all(activeProjectId) as { Paper_ID: string }[];

              const startMsg = { event: 'start', total: papers.length, step: 'sync' };
              batchStateTracker.updateStateFromMsg(startMsg);
              streamManager.broadcast(startMsg);

              let linkedCount = 0;

              for (const paper of papers) {
                if (batchState.cancelRequested) break;
                const paperId = paper.Paper_ID;

                const localFile = path.join(pdfRepoDir, `${paperId}.pdf`);
                if (!fs.existsSync(localFile)) {
                  db.prepare(`
                    UPDATE papers
                    SET Local_PDF_Status = 'MISSING', PDF_Link = NULL
                    WHERE Paper_ID = ?
                  `).run(paperId);

                  const failMsg = { 
                    event: 'link_fail', 
                    paper_id: paperId, 
                    message: 'Local PDF file missing in pdf_library/repo - skipped linking',
                    step: 'sync' 
                  };
                  batchStateTracker.updateStateFromMsg(failMsg);
                  streamManager.broadcast(failMsg);
                  continue;
                }

                const linkMsg = { event: 'linking', paper_id: paperId, message: `Linking paper ${paperId}...`, step: 'sync' };
                batchStateTracker.updateStateFromMsg(linkMsg);
                streamManager.broadcast(linkMsg);

                const linkArgs = ['link', `${remote}:${destPath}/${paperId}.pdf`];
                if (configPath) {
                  linkArgs.push('--config', configPath);
                }

                try {
                  const { stdout } = await execFileAsync(rclonePath, linkArgs);
                  const linkResult = stdout.toString().trim();
                  if (linkResult && linkResult.startsWith('http')) {
                    db.prepare(`
                      UPDATE papers
                      SET PDF_Link = ?, Local_PDF_Status = 'SYNCED'
                      WHERE Paper_ID = ?
                    `).run(linkResult, paperId);

                    linkedCount++;
                    const successMsg = { 
                      event: 'link_success', 
                      paper_id: paperId, 
                      link: linkResult,
                      step: 'sync'
                    };
                    batchStateTracker.updateStateFromMsg(successMsg);
                    streamManager.broadcast(successMsg);
                  } else {
                    const failMsg = { 
                      event: 'link_fail', 
                      paper_id: paperId, 
                      message: 'Invalid link returned: ' + linkResult,
                      step: 'sync' 
                    };
                    batchStateTracker.updateStateFromMsg(failMsg);
                    streamManager.broadcast(failMsg);
                  }
                } catch (linkErr: any) {
                  const failMsg = { 
                    event: 'link_fail', 
                    paper_id: paperId, 
                    message: linkErr.message || 'Error generating link',
                    step: 'sync' 
                  };
                  batchStateTracker.updateStateFromMsg(failMsg);
                  streamManager.broadcast(failMsg);
                }
              }

              const completeMsg = { 
                event: 'step_complete', 
                step: 'sync', 
                message: `[Sync Finished] Linked ${linkedCount}/${papers.length} PDFs.` 
              };
              batchStateTracker.updateStateFromMsg(completeMsg);
              streamManager.broadcast(completeMsg);

            } catch (dbErr: any) {
              const errMsg = { event: 'error', message: dbErr.message || 'Database error', step: 'sync' };
              batchStateTracker.updateStateFromMsg(errMsg);
              streamManager.broadcast(errMsg);
            }

            batchState.activeChild = null;
            resolve();
          });

          child.on('error', (err) => {
            const errMsg = { event: 'error', message: `Sync execution fail: ${err.message}`, step: 'sync' };
            batchStateTracker.updateStateFromMsg(errMsg);
            streamManager.broadcast(errMsg);
            batchState.activeChild = null;
            resolve();
          });
        });
      }
    }

    if (batchState.cancelRequested) {
      const cancelMsg = { event: 'error', message: 'Pipeline cancelled by user.' };
      batchStateTracker.updateStateFromMsg(cancelMsg);
      streamManager.broadcast(cancelMsg);
    } else {
      const finalMsg = { event: 'complete', message: 'All requested batch operations completed.' };
      batchStateTracker.updateStateFromMsg(finalMsg);
      streamManager.broadcast(finalMsg);
    }

  } catch (err: any) {
    const errorMsg = { event: 'error', message: `Pipeline crash: ${err.message}` };
    batchStateTracker.updateStateFromMsg(errorMsg);
    streamManager.broadcast(errorMsg);
  } finally {
    batchState.isExecuting = false;
    batchState.activeChild = null;
    batchState.listeners = [];
  }
}

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
