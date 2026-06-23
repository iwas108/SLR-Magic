import { spawn, execSync, execFileSync, execFile, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import { NextResponse } from 'next/server';
import { promisify } from 'util';

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
  const payload = encoder.encode(JSON.stringify(data) + '\n');
  batchState.listeners.forEach(listener => {
    try {
      listener(data);
    } catch (e) {
      // ignore closed connections
    }
  });
};

const updateStateFromMsg = (parsed: any) => {
  if (parsed.event === 'step_start') {
    batchState.currentStep = parsed.step;
    batchState.stepStartTime = Date.now();
    batchState.indexingState = null;
    batchState.isWaitingLogin = false;
    batchState.pipelineStats = {
      matched: 0,
      downloaded: 0,
      failed: 0,
      current: 0,
      total: 0,
      savedSpaceBytes: 0,
      originalSpaceBytes: 0
    };
    batchState.statusText = parsed.message;
    pushLog(`>>> ${parsed.message}`);
  } else if (parsed.event === 'step_complete') {
    batchState.indexingState = null;
    batchState.isWaitingLogin = false;
    pushLog(`<<< ${parsed.message}`);
  } else if (parsed.event === 'complete' && !parsed.step) {
    batchState.indexingState = null;
    batchState.isWaitingLogin = false;
    batchState.progress = 100;
    batchState.statusText = parsed.message;
    pushLog(`[SUCCESS]: ${parsed.message}`);
  } else if (parsed.event === 'error') {
    batchState.indexingState = null;
    batchState.isWaitingLogin = false;
    pushLog(`[ERROR]: ${parsed.message}`);
  } else if (parsed.event === 'waiting_login') {
    batchState.isWaitingLogin = true;
    batchState.statusText = parsed.message;
    pushLog(`[ACTION REQUIRED]: ${parsed.message}`);
  } else if (parsed.event === 'resume') {
    batchState.isWaitingLogin = false;
  } else if (parsed.event === 'log') {
    pushLog(parsed.message);
  } else if (parsed.info) {
    pushLog(`[INFO]: ${parsed.info}`);
  } else if (parsed.event === 'comparing') {
    batchState.currentItem = `${(batchState.currentItem || '').split(' | ')[0]} | Comparing: ${parsed.filename}`;
  } else if (parsed.event === 'indexing') {
    batchState.indexingState = {
      filename: parsed.filename,
      tool: parsed.tool,
      current: parsed.current,
      total: parsed.total
    };
    if (parsed.current === parsed.total) {
      if ((globalState as any).indexingDismissTimeout) {
        clearTimeout((globalState as any).indexingDismissTimeout);
      }
      (globalState as any).indexingDismissTimeout = setTimeout(() => {
        if (globalState.batchState) {
          globalState.batchState.indexingState = null;
          broadcast({ event: 'clear_indexing' });
        }
      }, 10000);
    }
  } else if (parsed.step === 'scan') {
    if (parsed.event === 'progress') {
      const percent = Math.round((parsed.current / parsed.total) * 100);
      batchState.pipelineStats.current = parsed.current;
      batchState.pipelineStats.total = parsed.total;
      batchState.progress = percent;
      batchState.currentItem = `Paper: ${parsed.paper_id} - "${parsed.title}"`;
      batchState.statusText = `Matching Cache: paper ${parsed.current} of ${parsed.total}...`;
    } else if (parsed.event === 'match') {
      batchState.pipelineStats.matched += 1;
      pushLog(`✓ Matched: ${parsed.paper_id} - "${parsed.filename}" (${parsed.method})`);
      batchState.statusText = `Matched paper ${parsed.paper_id}...`;
    }
  } else if (parsed.step === 'scrape') {
    if (parsed.event === 'start') {
      batchState.pipelineStats.total = parsed.total;
      batchState.pipelineStats.current = 0;
      pushLog(`Scraper starting for ${parsed.total} papers...`);
      batchState.statusText = 'Launching Scraper...';
    } else if (parsed.event === 'progress') {
      const percent = Math.round((parsed.current / parsed.total) * 100);
      batchState.pipelineStats.current = parsed.current;
      batchState.progress = percent;
      batchState.currentItem = parsed.title;
      batchState.statusText = `Scraping: paper ${parsed.current} of ${parsed.total}...`;
      pushLog(`[Scrape ${parsed.current}/${parsed.total}] Attempting download for: "${parsed.title}"`);
    } else if (parsed.event === 'paper_success') {
      batchState.pipelineStats.downloaded += 1;
      pushLog(`✓ Downloaded and saved PDF for ${parsed.paper_id}.`);
    } else if (parsed.event === 'paper_fail') {
      batchState.pipelineStats.failed += 1;
      pushLog(`✗ Download failed for ${parsed.paper_id}: ${parsed.error}`);
    } else if (parsed.event === 'sleep') {
      pushLog(`Scraper rate limit delay: sleeping for ${parsed.duration}s...`);
    }
  } else if (parsed.step === 'compress') {
    if (parsed.event === 'start') {
      batchState.pipelineStats.total = parsed.total;
      batchState.pipelineStats.current = 0;
      batchState.pipelineStats.savedSpaceBytes = 0;
      batchState.pipelineStats.originalSpaceBytes = 0;
      pushLog(`Compressor starting for ${parsed.total} files...`);
      batchState.statusText = 'Launching Compressor...';
    } else if (parsed.event === 'progress') {
      const percent = Math.round((parsed.current / parsed.total) * 100);
      batchState.pipelineStats.current = parsed.current;
      batchState.progress = percent;
      batchState.currentItem = `${parsed.paper_id}.pdf`;
      batchState.statusText = `Compressing: file ${parsed.current} of ${parsed.total}...`;
      
      const origSize = parsed.original_size || 0;
      const newSize = parsed.new_size || 0;
      if (!parsed.skipped) {
        batchState.pipelineStats.originalSpaceBytes = (batchState.pipelineStats.originalSpaceBytes || 0) + origSize;
        batchState.pipelineStats.savedSpaceBytes = (batchState.pipelineStats.savedSpaceBytes || 0) + Math.max(0, origSize - newSize);
      }
      
      const formatBytesLocal = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };
      
      const ratioText = parsed.skipped
        ? ` (${formatBytesLocal(origSize)}, Already Processed)`
        : (parsed.ratio > 0 
            ? ` (${formatBytesLocal(origSize)} -> ${formatBytesLocal(newSize)}, saved -${parsed.ratio}%)` 
            : ` (${formatBytesLocal(origSize)}, Direct Copy)`);
      pushLog(`[Compress ${parsed.current}/${parsed.total}] Processed ${parsed.paper_id}.pdf${ratioText}`);
    }
  } else if (parsed.step === 'sync') {
    if (parsed.event === 'start') {
      batchState.pipelineStats.total = parsed.total;
      batchState.pipelineStats.current = 0;
      batchState.pipelineStats.failed = 0;
    } else if (parsed.event === 'rclone_log') {
      pushLog(parsed.message);
      const match = parsed.message.match(/INFO\s*:\s*([^:]+\.pdf):\s*(.*)/i);
      if (match) {
        batchState.currentItem = `Syncing: ${match[1]} (${match[2]})`;
      }
    } else if (parsed.event === 'linking') {
      batchState.currentItem = `Linking paper: ${parsed.paper_id}`;
    } else if (parsed.event === 'link_success') {
      batchState.pipelineStats.current += 1;
      pushLog(`✓ Drive link generated for ${parsed.paper_id}: ${parsed.link}`);
    } else if (parsed.event === 'link_fail') {
      batchState.pipelineStats.failed += 1;
      pushLog(`✗ Drive link failed for ${parsed.paper_id}: ${parsed.message}`);
    }
  }
};

function createSubscribedStream() {
  let controllerRef: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;

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
    cancel() {
      if (controllerRef && (controllerRef as any)._listener) {
        batchState.listeners = batchState.listeners.filter(l => l !== (controllerRef as any)._listener);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}

async function runBackgroundExecution(steps: string[], compress: boolean) {
  const pythonExe = path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe');
  
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
        updateStateFromMsg(msg);
        broadcast(msg);
      } else if (step === 'scrape') {
        pythonModule = 'python_engine.pdf_scraper';
        const msg = { 
          event: 'step_start', 
          step: 'scrape', 
          message: `[${stepNum}/${totalSteps}] Starting Bulk PDF Scraper...` 
        };
        updateStateFromMsg(msg);
        broadcast(msg);
      } else if (step === 'compress') {
        pythonModule = 'python_engine.entrypoints.compress_pdfs';
        const msg = { 
          event: 'step_start', 
          step: 'compress', 
          message: `[${stepNum}/${totalSteps}] Starting PDF Compression/Processing...` 
        };
        updateStateFromMsg(msg);
        broadcast(msg);
      } else if (step === 'sync') {
        const msg = { 
          event: 'step_start', 
          step: 'sync', 
          message: `[${stepNum}/${totalSteps}] Starting ${cloudName} Cloud Sync...` 
        };
        updateStateFromMsg(msg);
        broadcast(msg);
      }

      if (step === 'scan' || step === 'scrape' || step === 'compress') {
        await new Promise<void>((resolve) => {
          if (batchState.cancelRequested) {
            resolve();
            return;
          }
          const child = spawn(pythonExe, ['-u', '-m', pythonModule], { cwd: PROJECT_ROOT });
          batchState.activeChild = child;

          let stdoutBuffer = '';
          const processLine = (line: string) => {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.event === 'complete') {
                  // Ignore python script-level complete events to avoid premature pipeline exit
                  return;
                }
                updateStateFromMsg({ ...parsed, step });
                broadcast({ ...parsed, step });
              } catch {
                updateStateFromMsg({ event: 'log', message: line, step });
                broadcast({ event: 'log', message: line, step });
              }
            }
          };

          child.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop() || '';
            for (const line of lines) {
              processLine(line);
            }
          });

          child.stderr.on('data', (data) => {
            const msg = { event: 'log', message: `[${step} Error]: ${data.toString()}`, step };
            updateStateFromMsg(msg);
            broadcast(msg);
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
            updateStateFromMsg(msg);
            broadcast(msg);
            batchState.activeChild = null;
            resolve();
          });

          child.on('error', (err) => {
            if (stdoutBuffer.trim()) {
              processLine(stdoutBuffer);
              stdoutBuffer = '';
            }
            const msg = { event: 'error', message: `${step} fail: ${err.message}`, step };
            updateStateFromMsg(msg);
            broadcast(msg);
            batchState.activeChild = null;
            resolve();
          });
        });
      }

      else if (step === 'sync') {
        // Prepare/Compress PDFs before syncing
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
              updateStateFromMsg(startMsg);
              broadcast(startMsg);

              const startEvent = { event: 'start', step: 'compress', total: papersToSync.length };
              updateStateFromMsg(startEvent);
              broadcast(startEvent);
            }

            let processedCount = 0;
            for (const paper of papersToSync) {
              if (batchState.cancelRequested) break;
              if (!paper.Local_PDF_Path) continue;
              const inputPath = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, paper.Local_PDF_Path);
              const outputPath = path.join(pdfRepoDir, `${paper.Paper_ID}.pdf`);

              let origSize = 0;
              let newSize = 0;
              try {
                if (fs.existsSync(inputPath)) {
                  origSize = fs.statSync(inputPath).size;
                }
              } catch (e) {}

              if (!fs.existsSync(inputPath)) {
                updateStateFromMsg({ event: 'log', message: `Warning: Source PDF not found on disk for ${paper.Paper_ID}: ${paper.Local_PDF_Path}`, step: 'sync' });
                broadcast({ event: 'log', message: `Warning: Source PDF not found on disk for ${paper.Paper_ID}: ${paper.Local_PDF_Path}`, step: 'sync' });
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
                  updateStateFromMsg({ event: 'log', message: `Warning: Ghostscript failed for ${paper.Paper_ID}. Falling back to copy: ${e.message}`, step: 'sync' });
                  broadcast({ event: 'log', message: `Warning: Ghostscript failed for ${paper.Paper_ID}. Falling back to copy: ${e.message}`, step: 'sync' });
                }
              }

              if (!compressionSuccess) {
                try {
                  fs.copyFileSync(inputPath, outputPath);
                  if (fs.existsSync(outputPath)) {
                    newSize = fs.statSync(outputPath).size;
                  }
                } catch (e: any) {
                  updateStateFromMsg({ event: 'log', message: `Error copying ${paper.Paper_ID}: ${e.message}`, step: 'sync' });
                  broadcast({ event: 'log', message: `Error copying ${paper.Paper_ID}: ${e.message}`, step: 'sync' });
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
                updateStateFromMsg(progressMsg);
                broadcast(progressMsg);
              }
            }
            if (gsCommand) {
              const completeMsg = { event: 'step_complete', step: 'compress', message: `Finished processing PDFs. Compressed ${processedCount} files.` };
              updateStateFromMsg(completeMsg);
              broadcast(completeMsg);
            } else {
              updateStateFromMsg({ event: 'log', message: `Finished processing PDFs. Copied ${processedCount} files.`, step: 'sync' });
              broadcast({ event: 'log', message: `Finished processing PDFs. Copied ${processedCount} files.`, step: 'sync' });
            }

            // Explicitly transition back to sync step in UI
            const syncStartMsg = { event: 'step_start', step: 'sync', message: 'Syncing Files (Rclone)...' };
            updateStateFromMsg(syncStartMsg);
            broadcast(syncStartMsg);
          }
        } catch (err: any) {
          updateStateFromMsg({ event: 'log', message: `Warning during pre-sync file processing: ${err.message}`, step: 'sync' });
          broadcast({ event: 'log', message: `Warning during pre-sync file processing: ${err.message}`, step: 'sync' });
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
          const child = spawn(rclonePath, syncArgs);
          batchState.activeChild = child;

          let stdoutBuffer = '';
          let stderrBuffer = '';

          const processRcloneLine = (line: string) => {
            if (line.trim()) {
              const msg = { event: 'rclone_log', message: line.trim(), step: 'sync' };
              updateStateFromMsg(msg);
              broadcast(msg);
            }
          };

          child.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop() || '';
            for (const line of lines) {
              processRcloneLine(line);
            }
          });

          child.stderr.on('data', (data) => {
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
              updateStateFromMsg(msg);
              broadcast(msg);
              batchState.activeChild = null;
              resolve();
              return;
            }

            const infoMsg = { event: 'info', message: `Sync complete. Creating ${cloudName} links...`, step: 'sync' };
            updateStateFromMsg(infoMsg);
            broadcast(infoMsg);

            try {
              const papers = db.prepare(`
                SELECT Paper_ID FROM papers 
                WHERE Local_PDF_Status IN ('MATCHED', 'DOWNLOADED')
                  AND Project_ID = ?
              `).all(activeProjectId) as { Paper_ID: string }[];

              const startMsg = { event: 'start', total: papers.length, step: 'sync' };
              updateStateFromMsg(startMsg);
              broadcast(startMsg);

              let linkedCount = 0;

              for (const paper of papers) {
                if (batchState.cancelRequested) break;
                const paperId = paper.Paper_ID;

                // Verify local PDF exists before generating link
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
                  updateStateFromMsg(failMsg);
                  broadcast(failMsg);
                  continue;
                }

                const linkMsg = { event: 'linking', paper_id: paperId, message: `Linking paper ${paperId}...`, step: 'sync' };
                updateStateFromMsg(linkMsg);
                broadcast(linkMsg);

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
                    updateStateFromMsg(successMsg);
                    broadcast(successMsg);
                  } else {
                    const failMsg = { 
                      event: 'link_fail', 
                      paper_id: paperId, 
                      message: 'Invalid link returned: ' + linkResult,
                      step: 'sync' 
                    };
                    updateStateFromMsg(failMsg);
                    broadcast(failMsg);
                  }
                } catch (linkErr: any) {
                  const failMsg = { 
                    event: 'link_fail', 
                    paper_id: paperId, 
                    message: linkErr.message || 'Error generating link',
                    step: 'sync' 
                  };
                  updateStateFromMsg(failMsg);
                  broadcast(failMsg);
                }
              }

              const completeMsg = { 
                event: 'step_complete', 
                step: 'sync', 
                message: `[Sync Finished] Linked ${linkedCount}/${papers.length} PDFs.` 
              };
              updateStateFromMsg(completeMsg);
              broadcast(completeMsg);

            } catch (dbErr: any) {
              const errMsg = { event: 'error', message: dbErr.message || 'Database error', step: 'sync' };
              updateStateFromMsg(errMsg);
              broadcast(errMsg);
            }

            batchState.activeChild = null;
            resolve();
          });

          child.on('error', (err) => {
            const errMsg = { event: 'error', message: `Sync execution fail: ${err.message}`, step: 'sync' };
            updateStateFromMsg(errMsg);
            broadcast(errMsg);
            batchState.activeChild = null;
            resolve();
          });
        });
      }
    }

    if (batchState.cancelRequested) {
      const cancelMsg = { event: 'error', message: 'Pipeline cancelled by user.' };
      updateStateFromMsg(cancelMsg);
      broadcast(cancelMsg);
    } else {
      const finalMsg = { event: 'complete', message: 'All requested batch operations completed.' };
      updateStateFromMsg(finalMsg);
      broadcast(finalMsg);
    }

  } catch (err: any) {
    const errorMsg = { event: 'error', message: `Pipeline crash: ${err.message}` };
    updateStateFromMsg(errorMsg);
    broadcast(errorMsg);
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

    if (batchState.isExecuting) {
      return createSubscribedStream();
    }

    batchState.isExecuting = true;
    batchState.steps = steps;
    batchState.currentStep = null;
    batchState.stepStartTime = null;
    batchState.progress = 0;
    batchState.statusText = 'Initializing pipeline...';
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

    // Run execution in the background asynchronously
    runBackgroundExecution(steps, compress);

    return createSubscribedStream();
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
