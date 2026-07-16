import db, { getConfig } from '@/lib/db';
import { ChildProcess } from 'child_process';
import { streamManager } from './stream-manager';

export interface GlobalBatchState {
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

export class BatchStateTracker {
  private static instance: BatchStateTracker;

  private constructor() {
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
  }

  public static getInstance(): BatchStateTracker {
    if (!BatchStateTracker.instance) {
      BatchStateTracker.instance = new BatchStateTracker();
    }
    return BatchStateTracker.instance;
  }

  public getState(): GlobalBatchState {
    const globalState = (global as any);
    return globalState.batchState as GlobalBatchState;
  }

  public resetBatchState(steps: string[]): void {
    const state = this.getState();
    state.isExecuting = true;
    state.steps = steps;
    state.currentStep = null;
    state.stepStartTime = null;
    state.progress = 0;
    state.statusText = 'Initializing pipeline...';
    state.logs = [];
    state.currentItem = null;
    state.indexingState = null;
    state.pipelineStats = {
      matched: 0,
      downloaded: 0,
      failed: 0,
      current: 0,
      total: 0,
      savedSpaceBytes: 0,
      originalSpaceBytes: 0
    };
    state.activeChild = null;
    state.cancelRequested = false;
  }

  public pushLog(msg: string): void {
    const state = this.getState();
    state.logs.push(msg);
    if (state.logs.length > 500) {
      state.logs.shift();
    }
  }

  public persistCheckpoint(checkpointData: any): void {
    try {
      db.prepare(`
        INSERT INTO configs (key, value) VALUES ('BATCH_CHECKPOINT', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(JSON.stringify(checkpointData));
    } catch (e) {
      console.error('Failed to persist checkpoint in db:', e);
    }
  }

  public updateStateFromMsg(parsed: any): void {
    const state = this.getState();
    const globalState = (global as any);

    if (parsed.event === 'step_start') {
      state.currentStep = parsed.step;
      state.stepStartTime = Date.now();
      state.indexingState = null;
      state.isWaitingLogin = false;
      state.pipelineStats = {
        matched: 0,
        downloaded: 0,
        failed: 0,
        current: 0,
        total: 0,
        savedSpaceBytes: 0,
        originalSpaceBytes: 0
      };
      state.statusText = parsed.message;
      this.pushLog(`>>> ${parsed.message}`);
    } else if (parsed.event === 'step_complete') {
      state.indexingState = null;
      state.isWaitingLogin = false;
      this.pushLog(`<<< ${parsed.message}`);
    } else if (parsed.event === 'complete' && !parsed.step) {
      state.indexingState = null;
      state.isWaitingLogin = false;
      state.progress = 100;
      state.statusText = parsed.message;
      this.pushLog(`[SUCCESS]: ${parsed.message}`);
    } else if (parsed.event === 'error') {
      state.indexingState = null;
      state.isWaitingLogin = false;
      this.pushLog(`[ERROR]: ${parsed.message}`);
    } else if (parsed.event === 'waiting_login') {
      state.isWaitingLogin = true;
      state.statusText = parsed.message;
      this.pushLog(`[ACTION REQUIRED]: ${parsed.message}`);
    } else if (parsed.event === 'resume') {
      state.isWaitingLogin = false;
    } else if (parsed.event === 'log') {
      this.pushLog(parsed.message);
    } else if (parsed.info) {
      this.pushLog(`[INFO]: ${parsed.info}`);
    } else if (parsed.event === 'comparing') {
      state.currentItem = `${(state.currentItem || '').split(' | ')[0]} | Comparing: ${parsed.filename}`;
    } else if (parsed.event === 'indexing') {
      state.indexingState = {
        filename: parsed.filename,
        tool: parsed.tool,
        current: parsed.current,
        total: parsed.total
      };
      if (parsed.current === parsed.total) {
        if (globalState.indexingDismissTimeout) {
          clearTimeout(globalState.indexingDismissTimeout);
        }
        globalState.indexingDismissTimeout = setTimeout(() => {
          if (globalState.batchState) {
            globalState.batchState.indexingState = null;
            streamManager.broadcast({ event: 'clear_indexing' });
          }
        }, 10000);
      }
    } else if (parsed.step === 'scan') {
      if (parsed.event === 'progress') {
        const percent = Math.round((parsed.current / parsed.total) * 100);
        state.pipelineStats.current = parsed.current;
        state.pipelineStats.total = parsed.total;
        state.progress = percent;
        state.currentItem = `Paper: ${parsed.paper_id} - "${parsed.title}"`;
        state.statusText = `Matching Cache: paper ${parsed.current} of ${parsed.total}...`;
      } else if (parsed.event === 'match') {
        state.pipelineStats.matched += 1;
        this.pushLog(`✓ Matched: ${parsed.paper_id} - "${parsed.filename}" (${parsed.method})`);
        state.statusText = `Matched paper ${parsed.paper_id}...`;
      }
    } else if (parsed.step === 'scrape') {
      if (parsed.event === 'start') {
        state.pipelineStats.total = parsed.total;
        state.pipelineStats.current = 0;
        this.pushLog(`Scraper starting for ${parsed.total} papers...`);
        state.statusText = 'Launching Scraper...';
      } else if (parsed.event === 'progress') {
        const percent = Math.round((parsed.current / parsed.total) * 100);
        state.pipelineStats.current = parsed.current;
        state.progress = percent;
        state.currentItem = parsed.title;
        state.statusText = `Scraping: paper ${parsed.current} of ${parsed.total}...`;
        this.pushLog(`[Scrape ${parsed.current}/${parsed.total}] Attempting download for: "${parsed.title}"`);
      } else if (parsed.event === 'paper_success') {
        state.pipelineStats.downloaded += 1;
        this.pushLog(`✓ Downloaded and saved PDF for ${parsed.paper_id}.`);
      } else if (parsed.event === 'paper_fail') {
        state.pipelineStats.failed += 1;
        this.pushLog(`✗ Download failed for ${parsed.paper_id}: ${parsed.error}`);
      } else if (parsed.event === 'sleep') {
        this.pushLog(`Scraper rate limit delay: sleeping for ${parsed.duration}s...`);
      }
    } else if (parsed.step === 'compress') {
      if (parsed.event === 'start') {
        state.pipelineStats.total = parsed.total;
        state.pipelineStats.current = 0;
        state.pipelineStats.savedSpaceBytes = 0;
        state.pipelineStats.originalSpaceBytes = 0;
        this.pushLog(`Compressor starting for ${parsed.total} files...`);
        state.statusText = 'Launching Compressor...';
      } else if (parsed.event === 'progress') {
        const percent = Math.round((parsed.current / parsed.total) * 100);
        state.pipelineStats.current = parsed.current;
        state.progress = percent;
        state.currentItem = `${parsed.paper_id}.pdf`;
        const isCompressEnabled = getConfig('PDF_COMPRESSION_ENABLED', 'false') === 'true';
        state.statusText = isCompressEnabled
          ? `Compressing: file ${parsed.current} of ${parsed.total}...`
          : `Copying: file ${parsed.current} of ${parsed.total}...`;
        
        const origSize = parsed.original_size || 0;
        const newSize = parsed.new_size || 0;
        if (!parsed.skipped) {
          state.pipelineStats.originalSpaceBytes = (state.pipelineStats.originalSpaceBytes || 0) + origSize;
          state.pipelineStats.savedSpaceBytes = (state.pipelineStats.savedSpaceBytes || 0) + Math.max(0, origSize - newSize);
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
        this.pushLog(`[Compress ${parsed.current}/${parsed.total}] Processed ${parsed.paper_id}.pdf${ratioText}`);
      }
    } else if (parsed.step === 'map_publisher') {
      if (parsed.event === 'start') {
        state.pipelineStats.total = parsed.total;
        state.pipelineStats.current = 0;
        state.pipelineStats.failed = 0;
        this.pushLog(`Publisher mapping starting for ${parsed.total} papers...`);
        state.statusText = 'Launching Publisher Mapper...';
      } else if (parsed.event === 'progress') {
        const percent = Math.round((parsed.current / parsed.total) * 100);
        state.pipelineStats.current = parsed.current;
        state.progress = percent;
        state.currentItem = parsed.title;
        state.statusText = `Mapping Publisher: paper ${parsed.current} of ${parsed.total}...`;
        this.pushLog(`[Map ${parsed.current}/${parsed.total}] Processing publisher for: "${parsed.title}"`);
      } else if (parsed.event === 'paper_success') {
        this.pushLog(`✓ Mapped publisher for ${parsed.paper_id}.`);
      } else if (parsed.event === 'paper_fail') {
        state.pipelineStats.failed += 1;
        this.pushLog(`✗ Publisher mapping failed for ${parsed.paper_id}: ${parsed.error}`);
      }
    } else if (parsed.step === 'verify') {
      if (parsed.event === 'start') {
        state.pipelineStats.total = parsed.total;
        state.pipelineStats.current = 0;
        state.pipelineStats.failed = 0;
        this.pushLog(`PDF Integrity Verification starting for ${parsed.total} papers...`);
        state.statusText = 'Launching PDF Integrity Verifier...';
      } else if (parsed.event === 'progress') {
        const percent = Math.round((parsed.current / parsed.total) * 100);
        state.pipelineStats.current = parsed.current;
        state.progress = percent;
        state.currentItem = parsed.title;
        state.statusText = `Verifying PDF: paper ${parsed.current} of ${parsed.total}...`;
        this.pushLog(`[Verify ${parsed.current}/${parsed.total}] Auditing PDF for: "${parsed.title}"`);
      } else if (parsed.event === 'paper_success') {
        this.pushLog(`✓ Verification passed for ${parsed.paper_id}.`);
      } else if (parsed.event === 'paper_fail') {
        state.pipelineStats.failed += 1;
        this.pushLog(`✗ Verification failed for ${parsed.paper_id}: ${parsed.error}`);
      }
    } else if (parsed.step === 'sync') {
      if (parsed.event === 'start') {
        state.pipelineStats.total = parsed.total;
        state.pipelineStats.current = 0;
        state.pipelineStats.failed = 0;
      } else if (parsed.event === 'rclone_log') {
        this.pushLog(parsed.message);
        const match = parsed.message.match(/INFO\s*:\s*([^:]+\.pdf):\s*(.*)/i);
        if (match) {
          state.currentItem = `Syncing: ${match[1]} (${match[2]})`;
        }
      } else if (parsed.event === 'linking') {
        state.currentItem = `Linking paper: ${parsed.paper_id}`;
      } else if (parsed.event === 'link_success') {
        state.pipelineStats.current += 1;
        this.pushLog(`✓ Drive link generated for ${parsed.paper_id}: ${parsed.link}`);
      } else if (parsed.event === 'link_fail') {
        state.pipelineStats.failed += 1;
        this.pushLog(`✗ Drive link failed for ${parsed.paper_id}: ${parsed.message}`);
      }
    }
  }

  public updateScrapingProgress(projectId: string): void {
    const state = this.getState();
    const totalRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND DOI IS NOT NULL AND DOI != ''`).get(projectId) as { c: number };
    const leftRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND DOI IS NOT NULL AND DOI != '' AND (Local_PDF_Status IS NULL OR Local_PDF_Status = 'MISSING' OR Local_PDF_Status = 'IN_PROGRESS')`).get(projectId) as { c: number };
    const doneRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND Local_PDF_Status = 'DOWNLOADED'`).get(projectId) as { c: number };
    const failedRow = db.prepare(`SELECT count(*) as c FROM papers WHERE Project_ID = ? AND Local_PDF_Status = 'FAILED'`).get(projectId) as { c: number };

    const total = totalRow.c;
    const completed = total - leftRow.c;
    
    state.pipelineStats.total = total;
    state.pipelineStats.current = completed;
    state.pipelineStats.downloaded = doneRow.c;
    state.pipelineStats.failed = failedRow.c;
    
    if (total > 0) {
      state.progress = Math.round((completed / total) * 100);
    }
  }
}

export const batchStateTracker = BatchStateTracker.getInstance();
