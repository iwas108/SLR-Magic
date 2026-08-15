import { spawn } from 'child_process';
import path from 'path';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import { getPythonExecutablePath } from '@/lib/services/python-path';
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
  activeChild: any | null;
  cancelRequested: boolean;
  listeners: Array<(msg: any) => void>;
}

export async function POST(request: Request) {
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

  if (batchState.isExecuting) {
    return NextResponse.json({ error: 'Another pipeline execution is already active.' }, { status: 400 });
  }

  try {
    const { paperId } = await request.json();
    if (!paperId) {
      return NextResponse.json({ error: 'paperId is required' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const paper = db.prepare('SELECT * FROM papers WHERE Paper_ID = ? AND Project_ID = ?').get(paperId, activeProjectId) as any;
    if (!paper) {
      return NextResponse.json({ error: 'Paper not found in active project' }, { status: 404 });
    }

    // Initialize global state for this single-run
    batchState.isExecuting = true;
    batchState.cancelRequested = false;
    batchState.isWaitingLogin = false;
    batchState.logs = [];
    batchState.progress = 0;
    batchState.currentStep = 'scan';
    batchState.statusText = 'Starting single paper matching...';
    batchState.currentItem = paper.Title;
    batchState.pipelineStats = {
      matched: 0,
      downloaded: 0,
      failed: 0,
      current: 0,
      total: 1,
      savedSpaceBytes: 0,
      originalSpaceBytes: 0
    };

    // Flag the paper as MISSING if ignored/failed
    if (paper.Local_PDF_Status === 'IGNORED' || paper.Local_PDF_Status === 'FAILED' || !paper.Local_PDF_Status) {
      db.prepare("UPDATE papers SET Local_PDF_Status = 'MISSING' WHERE Paper_ID = ? AND Project_ID = ?").run(paperId, activeProjectId);
    }

    const pythonExe = getPythonExecutablePath();
    const cacheMatcherModule = 'python_engine.entrypoints.match_cache';
    const scraperModule = 'python_engine.entrypoints.scrape_pdfs';

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const pushLog = (msg: string) => {
          batchState.logs.push(msg);
          if (batchState.logs.length > 500) batchState.logs.shift();
          const enriched = {
            event: 'log',
            message: msg,
            pct: batchState.progress,
            progress: batchState.progress,
            pipelineStats: batchState.pipelineStats,
            currentItem: batchState.currentItem
          };
          try {
            controller.enqueue(encoder.encode(JSON.stringify(enriched) + '\n'));
          } catch (e) {}
          
          // Broadcast to global listeners (dashboard widget)
          batchState.listeners.forEach(l => {
            try { l(enriched); } catch (e) {}
          });
        };

        const pushEvent = (evt: any) => {
          let enriched = evt;
          if (evt && typeof evt === 'object') {
            enriched = {
              ...evt,
              pct: batchState.progress,
              progress: batchState.progress,
              pipelineStats: batchState.pipelineStats,
              currentItem: batchState.currentItem,
              message: evt.message || batchState.statusText
            };
          }
          try {
            controller.enqueue(encoder.encode(JSON.stringify(enriched) + '\n'));
          } catch (e) {}
          
          // Broadcast to global listeners
          batchState.listeners.forEach(l => {
            try { l(enriched); } catch (e) {}
          });
        };

        pushEvent({
          event: 'step_start',
          step: 'scan',
          message: 'Starting Cached PDF matching lookup...'
        });

        // 1. Run Cache Matcher
        let matched = false;
        if (!batchState.cancelRequested) {
          await new Promise<void>((resolve) => {
            pushLog(`Spawning cache matcher for ${paperId}...`);
            const child = spawn(pythonExe, ['-u', '-m', cacheMatcherModule, '--project', activeProjectId, '--paper', paperId], { cwd: PROJECT_ROOT });
            batchState.activeChild = child;

            let buffer = '';
            child.stdout.on('data', (data) => {
              buffer += data.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.event === 'match') {
                    matched = true;
                    batchState.pipelineStats.matched = 1;
                    pushLog(`✓ Cache Match Found: ${parsed.filename} (${parsed.method})`);
                    pushEvent({ ...parsed, step: 'scan' });
                  } else if (parsed.event === 'progress') {
                    pushEvent({ ...parsed, step: 'scan', current: 1, total: 1 });
                  } else if (parsed.event === 'log') {
                    pushLog(parsed.message);
                  } else if (parsed.info) {
                    pushLog(`[INFO]: ${parsed.info}`);
                  }
                } catch {
                  pushLog(line);
                }
              }
            });

            child.stderr.on('data', (data) => {
              pushLog(`[stderr]: ${data.toString()}`);
            });

            child.on('close', (code) => {
              if (buffer.trim()) {
                pushLog(buffer.trim());
              }
              resolve();
            });

            child.on('error', (err) => {
              pushLog(`Cache Matcher Error: ${err.message}`);
              resolve();
            });
          });
        }

        // Verify match status in SQLite
        const dbStatusRow = db.prepare("SELECT Local_PDF_Status, Local_PDF_Path FROM papers WHERE Paper_ID = ? AND Project_ID = ?").get(paperId, activeProjectId) as { Local_PDF_Status: string } | undefined;
        if (dbStatusRow && (
          dbStatusRow.Local_PDF_Status === 'MATCHED' ||
          dbStatusRow.Local_PDF_Status === 'DOWNLOADED' ||
          dbStatusRow.Local_PDF_Status === 'SYNCED'
        )) {
          matched = true;
        }

        pushEvent({
          event: 'step_complete',
          step: 'scan',
          message: matched ? 'Cache match success!' : 'Cache match completed (no match found).'
        });

        // 2. Run PDF Scraper if not matched and has DOI
        if (!matched && !batchState.cancelRequested) {
          if (!paper.DOI || !paper.DOI.trim()) {
            pushLog(`[WARNING]: Paper has no DOI. Cannot execute web scraping. Skipping...`);
            db.prepare("UPDATE papers SET Local_PDF_Status = 'FAILED' WHERE Paper_ID = ? AND Project_ID = ?").run(paperId, activeProjectId);
          } else {
            pushEvent({
              event: 'step_start',
              step: 'scrape',
              message: 'Starting Web Scraper crawler (Selenium)...'
            });

            await new Promise<void>((resolve) => {
              pushLog(`Spawning browser scraper for DOI: ${paper.DOI}...`);
              const child = spawn(pythonExe, ['-u', '-m', scraperModule, '--project', activeProjectId, '--paper', paperId], { cwd: PROJECT_ROOT });
              batchState.activeChild = child;

              let buffer = '';
              child.stdout.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.event === 'waiting_login') {
                      batchState.isWaitingLogin = true;
                      batchState.statusText = parsed.message;
                      pushEvent({ ...parsed, step: 'scrape' });
                      pushLog(`[ACTION REQUIRED]: ${parsed.message}`);
                    } else if (parsed.event === 'resume') {
                      batchState.isWaitingLogin = false;
                      pushEvent({ ...parsed, step: 'scrape' });
                    } else if (parsed.event === 'paper_success') {
                      batchState.pipelineStats.downloaded = 1;
                      pushLog(`✓ Downloaded and saved PDF for ${paperId}.`);
                      pushEvent({ ...parsed, step: 'scrape' });
                    } else if (parsed.event === 'paper_fail') {
                      batchState.pipelineStats.failed = 1;
                      pushLog(`✗ Download failed: ${parsed.error}`);
                      pushEvent({ ...parsed, step: 'scrape' });
                    } else if (parsed.event === 'log') {
                      pushLog(parsed.message);
                    } else if (parsed.event === 'sleep') {
                      pushLog(`Rate limit delay: sleeping for ${parsed.duration}s...`);
                    } else {
                      pushEvent({ ...parsed, step: 'scrape' });
                    }
                  } catch {
                    pushLog(line);
                  }
                }
              });

              child.stderr.on('data', (data) => {
                pushLog(`[Scraper stderr]: ${data.toString()}`);
              });

              child.on('close', (code) => {
                if (buffer.trim()) {
                  pushLog(buffer.trim());
                }
                resolve();
              });

              child.on('error', (err) => {
                pushLog(`Scraper Error: ${err.message}`);
                resolve();
              });
            });

            pushEvent({
              event: 'step_complete',
              step: 'scrape',
              message: 'Web scraper completed.'
            });
          }
        }

        // Final status verify
        const finalPaper = db.prepare("SELECT Local_PDF_Status, Local_PDF_Path FROM papers WHERE Paper_ID = ? AND Project_ID = ?").get(paperId, activeProjectId) as any;
        const success = finalPaper && (finalPaper.Local_PDF_Status === 'MATCHED' || finalPaper.Local_PDF_Status === 'DOWNLOADED' || finalPaper.Local_PDF_Status === 'SYNCED');

        if (batchState.cancelRequested) {
          pushEvent({ event: 'complete', message: 'Acquisition cancelled by user.', isTerminal: true });
        } else if (success) {
          batchState.progress = 100;
          pushEvent({ event: 'complete', message: 'PDF acquired successfully!', isTerminal: true });
        } else {
          pushEvent({ event: 'error', message: 'Failed to acquire PDF.', isTerminal: true });
        }

        // Reset execution state
        batchState.isExecuting = false;
        batchState.activeChild = null;
        batchState.isWaitingLogin = false;

        controller.close();
      },
      cancel() {
        if (batchState.activeChild) {
          try {
            const msg = 'Terminating active subprocess...';
            batchState.logs.push(msg);
            if (batchState.logs.length > 500) batchState.logs.shift();
            batchState.listeners.forEach(l => {
              try { l({ event: 'log', message: msg }); } catch (e) {}
            });
            if (process.platform === 'win32') {
              const execSync = require('child_process').execSync;
              execSync(`taskkill /pid ${batchState.activeChild.pid} /T /F`);
            } else {
              batchState.activeChild.kill('SIGKILL');
            }
          } catch (e) {}
        }
        batchState.isExecuting = false;
        batchState.activeChild = null;
        batchState.isWaitingLogin = false;
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error: any) {
    batchState.isExecuting = false;
    batchState.activeChild = null;
    batchState.isWaitingLogin = false;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
