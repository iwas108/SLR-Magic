import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { globalEventManager } from '@/lib/services/global-event-manager';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd().endsWith('slr-ide') 
  ? process.cwd() 
  : (fs.existsSync(path.join(process.cwd(), 'slr-ide')) ? path.join(process.cwd(), 'slr-ide') : process.cwd());

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const worker_id = formData.get('worker_id') as string;
    const paper_id = formData.get('paper_id') as string;
    const status = formData.get('status') as string;
    const error_reason = formData.get('error_reason') as string;
    
    if (!worker_id || !paper_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const worker = remoteWorkerManager.getWorker(worker_id);
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    if (status === 'DOWNLOADED') {
      const file = formData.get('file') as File;
      if (!file) {
        db.prepare(`UPDATE papers SET Local_PDF_Status = 'FAILED', remote_worker_id = NULL, scrape_claimed_at = NULL WHERE Paper_ID = ?`).run(paper_id);
        globalEventManager.broadcast({ type: 'SYNC_PAPERS' });
        return NextResponse.json({ error: 'Missing file payload for DOWNLOADED status' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Basic validation (Node-side)
      if (buffer.length < 5 * 1024) {
        // Size too small
        db.prepare(`UPDATE papers SET Local_PDF_Status = 'FAILED', remote_worker_id = NULL, scrape_claimed_at = NULL WHERE Paper_ID = ?`).run(paper_id);
        globalEventManager.broadcast({ type: 'SYNC_PAPERS' });
        return NextResponse.json({ error: 'File too small (likely paywall html)' }, { status: 400 });
      }

      const header = buffer.subarray(0, 1024).toString('ascii');
      if (!header.includes('%PDF-')) {
        db.prepare(`UPDATE papers SET Local_PDF_Status = 'FAILED', remote_worker_id = NULL, scrape_claimed_at = NULL WHERE Paper_ID = ?`).run(paper_id);
        globalEventManager.broadcast({ type: 'SYNC_PAPERS' });
        return NextResponse.json({ error: 'Invalid PDF header' }, { status: 400 });
      }

      // Save to raw/
      const rawPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'raw');
      if (!fs.existsSync(rawPdfDir)) {
        fs.mkdirSync(rawPdfDir, { recursive: true });
      }
      
      const filePath = path.join(rawPdfDir, `${paper_id}.pdf`);
      fs.writeFileSync(filePath, buffer);
      
      const dbPath = `pdf_library/raw/${paper_id}.pdf`;

      db.prepare(`
        UPDATE papers 
        SET Local_PDF_Status = 'DOWNLOADED', 
            Local_PDF_Path = ?, 
            remote_worker_id = NULL, 
            scrape_claimed_at = NULL 
        WHERE Paper_ID = ?
      `).run(dbPath, paper_id);

      streamManager.broadcast({ event: 'progress', log: `[Remote Worker] Downloaded paper ${paper_id}` });

    } else if (status === 'FAILED') {
      db.prepare(`
        UPDATE papers 
        SET Local_PDF_Status = 'FAILED', 
            remote_worker_id = NULL, 
            scrape_claimed_at = NULL 
        WHERE Paper_ID = ?
      `).run(paper_id);
      if (error_reason) {
        console.warn(`Worker ${worker_id} failed to scrape ${paper_id}: ${error_reason}`);
        streamManager.broadcast({ event: 'progress', log: `[Remote Worker] Failed ${paper_id}: ${error_reason}` });
      }
    } else {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    // Refresh telemetry and progress metrics in batchStateTracker
    const paperRow = db.prepare(`SELECT Project_ID FROM papers WHERE Paper_ID = ?`).get(paper_id) as { Project_ID: string } | undefined;
    if (paperRow) {
      batchStateTracker.updateScrapingProgress(paperRow.Project_ID);
    }

    globalEventManager.broadcast({ type: 'SYNC_PAPERS' });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
