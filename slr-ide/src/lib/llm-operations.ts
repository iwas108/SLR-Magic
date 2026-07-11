import { ChildProcess, exec } from 'child_process';
import { clearSessionMasterPassword, sanitizeApiKey } from '@/lib/session';

export interface LLMJobState {
  id: string;
  projectId: string;
  process: ChildProcess | null;
  status: 'PENDING' | 'RUNNING' | 'PAUSED_BUDGET' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  logs: string[];
  listeners: Set<(data: string) => void>;
  error: string | null;
}

export class LLMOperationsManager {
  private jobs = new Map<string, LLMJobState>();

  getJob(jobId: string): LLMJobState | undefined {
    return this.jobs.get(jobId);
  }

  registerJob(jobId: string, projectId: string, childProcess: ChildProcess) {
    let job = this.jobs.get(jobId);
    if (!job) {
      job = {
        id: jobId,
        projectId,
        process: childProcess,
        status: 'RUNNING',
        logs: [],
        listeners: new Set(),
        error: null,
      };
      this.jobs.set(jobId, job);
    } else {
      job.process = childProcess;
      job.status = 'RUNNING';
    }

    const processStdout = (chunk: Buffer) => {
      const text = sanitizeApiKey(chunk.toString());
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Detect budget pause signals from telemetry stream
        if (line.includes('"status": "PAUSED_BUDGET"') || line.includes('PAUSED_BUDGET')) {
          job!.status = 'PAUSED_BUDGET';
        }
        
        job!.logs.push(line);
        this.broadcast(jobId, line);
      }
    };

    childProcess.stdout?.on('data', processStdout);
    childProcess.stderr?.on('data', (chunk) => {
      const text = sanitizeApiKey(chunk.toString());
      console.error(`[Job ${jobId} STDERR]:`, text);
      // Python's logging module routes ALL levels (INFO, WARNING, ERROR …) to
      // stderr. Do NOT blindly prefix every line with "ERROR:" – instead pass
      // the line through as-is so the UI can display the correct severity.
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        job!.logs.push(line);
        this.broadcast(jobId, line);
      }
    });

    childProcess.on('exit', (code, signal) => {
      console.log(`[Job ${jobId}] exited with code ${code}, signal ${signal}`);
      if (job!.status === 'RUNNING') {
        if (code === 0) {
          job!.status = 'COMPLETED';
        } else {
          job!.status = 'FAILED';
          job!.error = `Exit code ${code}`;
          clearSessionMasterPassword(); // Auto-lock vault on background failures
        }
      }
      job!.process = null;
      this.broadcast(jobId, JSON.stringify({ status: job!.status, error: job!.error }));
    });
  }

  subscribe(jobId: string, callback: (data: string) => void) {
    const job = this.jobs.get(jobId);
    if (!job) {
      // Pre-create the job slot so the user interface can bind listeners early
      const shellJob: LLMJobState = {
        id: jobId,
        projectId: '',
        process: null,
        status: 'PENDING',
        logs: [],
        listeners: new Set([callback]),
        error: null,
      };
      this.jobs.set(jobId, shellJob);
      return;
    }
    
    job.listeners.add(callback);
    // Instantly stream the existing log cache to the newly connected SSE socket
    for (const log of job.logs) {
      callback(log);
    }
  }

  unsubscribe(jobId: string, callback: (data: string) => void) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.listeners.delete(callback);
    }
  }

  resumeJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job && job.process && job.status === 'PAUSED_BUDGET') {
      console.log(`Resuming job ${jobId}...`);
      job.status = 'RUNNING';
      job.process.stdin?.write('\n');
      this.broadcast(jobId, JSON.stringify({ status: 'RUNNING', info: 'Resuming processing' }));
      return true;
    }
    return false;
  }

  cancelJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'CANCELLED';
      if (job.process) {
        const pid = job.process.pid;
        if (pid) {
          console.log(`Cancelling job ${jobId} (PID: ${pid})...`);
          // Windows recursive process termination to prevent zombie subprocesses
          exec(`taskkill /F /T /PID ${pid}`, (err) => {
            if (err) {
              console.error(`Failed to kill process tree for job ${jobId}:`, err);
            }
          });
        }
        job.process = null;
      }
      this.broadcast(jobId, JSON.stringify({ status: 'CANCELLED' }));
      return true;
    }
    return false;
  }

  private broadcast(jobId: string, data: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      for (const listener of job.listeners) {
        try {
          listener(data);
        } catch (e) {
          console.error(`Error sending to listener for job ${jobId}:`, e);
        }
      }
    }
  }
}

declare global {
  var llmOperationsManager: LLMOperationsManager | undefined;
}

export const operationsManager = globalThis.llmOperationsManager || new LLMOperationsManager();
if (process.env.NODE_ENV !== 'production') {
  globalThis.llmOperationsManager = operationsManager;
}
