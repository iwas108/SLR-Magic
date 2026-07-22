import { ChildProcess, execSync } from 'child_process';
import fs from 'fs';

export interface GoldMineStats {
  totalPapers: number;
  stagedFiles: number;
  uploadedFiles: number;
  skippedQa: number;
  transferSpeed: string;
  categories: number;
}

export interface GoldMineState {
  isExecuting: boolean;
  phase: 'idle' | 'staging' | 'uploading' | 'complete' | 'error' | 'cancelled';
  progress: number;
  statusText: string;
  currentItem: string | null;
  logs: string[];
  stats: GoldMineStats;
  activeChild: ChildProcess | null;
  cancelRequested: boolean;
  exportSessionId: string | null;
  exportTempDir: string | null;
  listeners: Array<(msg: any) => void>;
}

export class GoldMineStateTracker {
  private static instance: GoldMineStateTracker;

  private constructor() {
    const globalState = (global as any);
    if (!globalState.goldMineState) {
      globalState.goldMineState = this.getInitialState();
    }
  }

  public static getInstance(): GoldMineStateTracker {
    if (!GoldMineStateTracker.instance) {
      GoldMineStateTracker.instance = new GoldMineStateTracker();
    }
    return GoldMineStateTracker.instance;
  }

  private getInitialState(): GoldMineState {
    return {
      isExecuting: false,
      phase: 'idle',
      progress: 0,
      statusText: '',
      currentItem: null,
      logs: [],
      stats: {
        totalPapers: 0,
        stagedFiles: 0,
        uploadedFiles: 0,
        skippedQa: 0,
        transferSpeed: '0 B/s',
        categories: 0
      },
      activeChild: null,
      cancelRequested: false,
      exportSessionId: null,
      exportTempDir: null,
      listeners: []
    };
  }

  public getState(): GoldMineState {
    return (global as any).goldMineState;
  }

  public reset(): void {
    const state = this.getState();
    const listeners = state.listeners;
    (global as any).goldMineState = this.getInitialState();
    (global as any).goldMineState.listeners = listeners;
  }

  public updateState(partial: Partial<GoldMineState>): void {
    const state = this.getState();
    Object.assign(state, partial);
  }

  public addLog(line: string): void {
    const state = this.getState();
    state.logs.push(line);
    if (state.logs.length > 200) {
      state.logs.shift();
    }
  }

  public broadcast(msg: any): void {
    const state = this.getState();
    const fullMsg = {
      ...msg,
      isExecuting: state.isExecuting,
      phase: state.phase,
      progress: state.progress,
      statusText: state.statusText,
      currentItem: state.currentItem,
      stats: state.stats
    };

    state.listeners.forEach((listener) => {
      try {
        listener(fullMsg);
      } catch (e) {
        // ignore subscriber errors
      }
    });
  }

  public subscribe(listener: (msg: any) => void): () => void {
    const state = this.getState();
    state.listeners.push(listener);
    return () => {
      state.listeners = state.listeners.filter((l) => l !== listener);
    };
  }

  public createEventStream(req: Request): Response {
    const state = this.getState();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start: (controller) => {
        // Send initial restore snapshot immediately
        const restoreMsg = {
          event: 'restore',
          isExecuting: state.isExecuting,
          phase: state.phase,
          progress: state.progress,
          statusText: state.statusText,
          currentItem: state.currentItem,
          stats: state.stats,
          logs: state.logs
        };
        controller.enqueue(encoder.encode(JSON.stringify(restoreMsg) + '\n'));

        const listener = (msg: any) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(msg) + '\n'));
          } catch (e) {
            // Stream closed
          }
        };

        const unsubscribe = this.subscribe(listener);

        if (req.signal) {
          req.signal.addEventListener('abort', () => {
            unsubscribe();
          });
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });
  }

  public requestCancel(): void {
    const state = this.getState();
    state.cancelRequested = true;
    state.statusText = 'Cancelling Gold Mine export...';

    if (state.activeChild) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${state.activeChild.pid} /T /F`);
        } else {
          state.activeChild.kill('SIGKILL');
        }
      } catch (e) {
        console.error('Failed to kill rclone process:', e);
      }
      state.activeChild = null;
    }

    if (state.exportTempDir && fs.existsSync(state.exportTempDir)) {
      try {
        fs.rmSync(state.exportTempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to clean export temp dir on cancel:', e);
      }
    }

    state.isExecuting = false;
    state.phase = 'cancelled';
    state.statusText = 'Export cancelled by user';

    this.broadcast({
      event: 'cancelled',
      isTerminal: true,
      message: 'Export cancelled by user'
    });
  }
}

export const goldMineStateTracker = GoldMineStateTracker.getInstance();
