import db from '@/lib/db';
import { randomUUID } from 'crypto';

export type WorkerStatus = 'OFFLINE' | 'IDLE' | 'SCRAPING' | 'WAITING_LOGIN' | 'ERROR';

export interface RemoteWorker {
  id: string;
  label: string;
  host: string;
  session_token: string | null;
  status: WorkerStatus;
  last_seen_at: string | null;
  is_enabled: number;
  created_at: string;
  telemetry?: any;
}

class RemoteWorkerManager {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor() {
    // We don't start polling immediately on class load because Next.js reloads modules often in dev.
    // We will start it when explicitly called or on first use.
    this.startPolling();
  }

  public startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    
    this.pollingInterval = setInterval(() => {
      this.autoReclaimStuckPapers();
    }, 60 * 1000); // Check for stuck papers every 1 minute
  }

  public stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  public getWorkers(): RemoteWorker[] {
    return db.prepare('SELECT * FROM remote_workers ORDER BY created_at DESC').all() as RemoteWorker[];
  }

  public getOnlineWorkers(): RemoteWorker[] {
    return db.prepare('SELECT * FROM remote_workers WHERE is_enabled = 1 AND session_token IS NOT NULL').all() as RemoteWorker[];
  }

  public getWorker(id: string): RemoteWorker | undefined {
    return db.prepare('SELECT * FROM remote_workers WHERE id = ?').get(id) as RemoteWorker | undefined;
  }

  public registerWorker(label: string, host: string): RemoteWorker {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO remote_workers (id, label, host, status, is_enabled, created_at)
      VALUES (?, ?, ?, 'OFFLINE', 1, ?)
    `).run(id, label, host, now);
    
    return this.getWorker(id)!;
  }

  public removeWorker(id: string) {
    db.prepare('DELETE FROM remote_workers WHERE id = ?').run(id);
    this.reclaimPapersForWorker(id);
  }

  public updateWorkerStatus(id: string, status: WorkerStatus, lastSeenAt: string) {
    db.prepare('UPDATE remote_workers SET status = ?, last_seen_at = ? WHERE id = ?').run(status, lastSeenAt, id);
  }

  public updateWorkerToken(id: string, token: string) {
    db.prepare('UPDATE remote_workers SET session_token = ?, status = ? WHERE id = ?').run(token, 'IDLE', id);
  }

  public toggleWorker(id: string, is_enabled: number) {
    db.prepare('UPDATE remote_workers SET is_enabled = ? WHERE id = ?').run(is_enabled, id);
    if (!is_enabled) {
      this.reclaimPapersForWorker(id);
    }
  }

  public reclaimPapersForWorker(workerId: string) {
    const stmt = db.prepare(`
      UPDATE papers 
      SET Local_PDF_Status = 'MISSING', remote_worker_id = NULL, scrape_claimed_at = NULL 
      WHERE Local_PDF_Status = 'IN_PROGRESS' AND remote_worker_id = ?
    `);
    const info = stmt.run(workerId);
    if (info.changes > 0) {
      console.log(`[RemoteWorkerManager] Reclaimed ${info.changes} papers from worker ${workerId}`);
    }
  }

  public autoReclaimStuckPapers() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const stmt = db.prepare(`
      UPDATE papers 
      SET Local_PDF_Status = 'MISSING', remote_worker_id = NULL, scrape_claimed_at = NULL 
      WHERE Local_PDF_Status = 'IN_PROGRESS' 
        AND (scrape_claimed_at IS NULL OR scrape_claimed_at < ?)
    `);
    const info = stmt.run(fiveMinutesAgo);
    if (info.changes > 0) {
      console.log(`[RemoteWorkerManager] Auto-reclaimed ${info.changes} papers stuck in IN_PROGRESS for >5m`);
    }
  }

  public async proxyCommand(worker: RemoteWorker, endpoint: string, method: string = 'POST', body?: any) {
    if (!worker.session_token && endpoint !== '/pair') {
      throw new Error('Worker not paired');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (worker.session_token) {
      headers['Authorization'] = `Bearer ${worker.session_token}`;
    }

    const url = new URL(endpoint, worker.host).toString();
    const init: RequestInit = {
      method,
      headers,
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    // Set a timeout for the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    init.signal = controller.signal;

    try {
      const res = await fetch(url, init);
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`Worker returned ${res.status}: ${await res.text()}`);
      }
      
      return await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request to worker timed out');
      }
      throw err;
    }
  }

  public getWorkerStatuses(): RemoteWorker[] {
    return this.getWorkers();
  }

  public async resumeWorker(workerId: string) {
    const worker = this.getWorker(workerId);
    if (worker) {
      return this.proxyCommand(worker, '/resume', 'POST');
    }
  }

  public async cancelWorker(workerId: string) {
    const worker = this.getWorker(workerId);
    if (worker) {
      try {
        await this.proxyCommand(worker, '/cancel', 'POST');
      } catch (err) {
        console.warn(`Could not proxy cancel to worker ${workerId}:`, err);
      }
      this.reclaimPapersForWorker(workerId);
    }
  }

  public async startDispatch(projectId: string) {
    const workers = this.getOnlineWorkers();
    // Wake up online workers by sending them the project ID to start polling claims
    for (const w of workers) {
      this.proxyCommand(w, '/start', 'POST', { project_id: projectId }).catch(e => {
        console.warn(`Failed to start worker ${w.id}:`, e);
      });
    }
  }

  public async stopDispatch() {
    const workers = this.getOnlineWorkers();
    for (const w of workers) {
      this.cancelWorker(w.id).catch(e => {});
    }
  }
}

export const remoteWorkerManager = new RemoteWorkerManager();
