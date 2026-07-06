import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import path from 'path';
import { PROJECT_ROOT, getConfig } from '@/lib/db';

export class VectorDaemonManager {
  private static instance: VectorDaemonManager | null = null;

  private child: ChildProcess | null = null;
  private isReady = false;
  private startupPromise: Promise<void> | null = null;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private requestCounter = 0;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      createdAt: number;
    }
  >();

  private readonly INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): VectorDaemonManager {
    if (!VectorDaemonManager.instance) {
      VectorDaemonManager.instance = new VectorDaemonManager();
    }
    return VectorDaemonManager.instance;
  }

  /**
   * Lazily starts the Python vector worker daemon.
   * Returns a promise that resolves once the daemon outputs {"status": "ready"}.
   */
  public async ensureStarted(): Promise<void> {
    if (this.child && this.isReady) {
      this.resetInactivityTimer();
      return;
    }

    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = new Promise<void>((resolve, reject) => {
      try {
        console.log('[VectorDaemonManager]: Starting Python vector worker daemon...');
        
        const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
        const pythonModule = 'python_engine.entrypoints.vector_worker';

        // Spawn with -u for unbuffered stdout/stderr
        this.child = spawn(pythonExe, ['-u', '-m', pythonModule], {
          cwd: PROJECT_ROOT,
        });

        // Set up line-by-line reading of stdout
        const rl = readline.createInterface({
          input: this.child.stdout!,
          terminal: false,
        });

        rl.on('line', (line) => {
          this.handleStdoutLine(line, resolve);
        });

        // Listen for stderr to log Python errors/warnings
        this.child.stderr!.on('data', (data) => {
          const msg = data.toString().trim();
          if (msg) {
            console.warn(`[VectorDaemon Stderr]: ${msg}`);
          }
        });

        // Handle child process exit
        this.child.on('close', (code) => {
          console.log(`[VectorDaemonManager]: Daemon process exited with code ${code}`);
          this.handleUnexpectedShutdown(new Error(`Daemon exited with code ${code}`));
        });

        this.child.on('error', (err) => {
          console.error('[VectorDaemonManager]: Daemon process encountered error:', err);
          this.handleUnexpectedShutdown(err);
        });

        // Setup a safety timeout of 30 seconds for model loading
        const timeout = setTimeout(() => {
          if (!this.isReady) {
            console.error('[VectorDaemonManager]: Safety timeout triggered. Daemon failed to start in 30s.');
            this.stop();
            reject(new Error('Model loading timeout (30 seconds) exceeded.'));
          }
        }, 30000);

        // Keep reference of resolver/rejecter for cleanup if needed
        // but resolve will trigger when we receive {"status": "ready"}
      } catch (err) {
        console.error('[VectorDaemonManager]: Failed to spawn daemon process:', err);
        this.child = null;
        this.startupPromise = null;
        reject(err);
      }
    });

    return this.startupPromise;
  }

  /**
   * Handles stdout line-by-line.
   */
  private handleStdoutLine(line: string, startupResolver?: () => void) {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);

      // Handle startup ready signal
      if (parsed.status === 'ready' && !this.isReady) {
        console.log('[VectorDaemonManager]: Daemon is fully loaded and ready.');
        this.isReady = true;
        this.startupPromise = null;
        this.resetInactivityTimer();
        if (startupResolver) startupResolver();
        return;
      }

      // Handle actual query responses
      if (parsed.id) {
        const reqId = String(parsed.id);
        const callbacks = this.pendingRequests.get(reqId);
        if (callbacks) {
          this.pendingRequests.delete(reqId);
          if (parsed.status === 'ok') {
            callbacks.resolve(parsed);
          } else {
            callbacks.reject(new Error(parsed.error || 'Unknown error returned by daemon'));
          }
        }
      }
    } catch (err) {
      console.error('[VectorDaemonManager]: Failed to parse daemon stdout line:', trimmed, err);
    }
  }

  /**
   * Cleans up pending requests and resets manager state if the process shuts down unexpectedly.
   */
  private handleUnexpectedShutdown(err: Error) {
    this.isReady = false;
    this.child = null;
    this.startupPromise = null;
    this.clearInactivityTimer();

    // Reject all pending requests
    for (const [id, callbacks] of this.pendingRequests.entries()) {
      callbacks.reject(new Error(`Daemon process exited unexpectedly: ${err.message}`));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Sends a request to the persistent daemon and returns the parsed result.
   */
  public async request(action: string, payload: any): Promise<any> {
    await this.ensureStarted();

    if (!this.child || !this.child.stdin || !this.child.stdin.writable) {
      throw new Error('Vector daemon is not running or stdin is not writable');
    }

    this.requestCounter++;
    const reqId = `req_${Date.now()}_${this.requestCounter}`;
    
    // Fetch active project ID dynamically
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    const requestBody = {
      id: reqId,
      action,
      project_id: activeProjectId,
      ...payload,
    };

    const promise = new Promise<any>((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve,
        reject,
        createdAt: Date.now(),
      });
    });

    // Write to daemon stdin
    this.child.stdin.write(JSON.stringify(requestBody) + '\n');
    
    // Reset inactivity timer on request
    this.resetInactivityTimer();

    return promise;
  }

  /**
   * Resets the inactivity timer. If no requests are made in 10 minutes, the daemon stops.
   */
  private resetInactivityTimer() {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      console.log('[VectorDaemonManager]: Inactivity timeout reached. Shutting down daemon...');
      this.stop();
    }, this.INACTIVITY_TIMEOUT_MS);
  }

  private clearInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Stop the daemon process.
   */
  public stop() {
    this.clearInactivityTimer();
    this.isReady = false;
    this.startupPromise = null;

    if (this.child) {
      console.log('[VectorDaemonManager]: Terminating daemon child process tree...');
      try {
        // Kill cleanly
        this.child.kill('SIGTERM');
        // Force kill after 2 seconds if still running
        const pid = this.child.pid;
        setTimeout(() => {
          if (this.child && this.child.pid === pid) {
            try {
              this.child.kill('SIGKILL');
            } catch (e) {}
          }
        }, 2000);
      } catch (err) {
        console.error('[VectorDaemonManager]: Error stopping daemon child process:', err);
      }
      this.child = null;
    }

    // Reject remaining queries
    for (const [id, callbacks] of this.pendingRequests.entries()) {
      callbacks.reject(new Error('Vector daemon stopped by manager'));
      this.pendingRequests.delete(id);
    }
  }
}

export const vectorDaemonManager = VectorDaemonManager.getInstance();
