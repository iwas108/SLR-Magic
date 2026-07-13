import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const worker_id = url.searchParams.get('worker_id');
    const project_id = url.searchParams.get('project_id');

    if (!worker_id || !project_id) {
      return NextResponse.json({ error: 'Missing worker_id or project_id' }, { status: 400 });
    }

    const worker = remoteWorkerManager.getWorker(worker_id);
    if (!worker || worker.status === 'OFFLINE' || worker.is_enabled === 0) {
      return NextResponse.json({ error: 'Worker is offline, disabled, or not found' }, { status: 403 });
    }

    // Read batch_size from server-side config
    const batchSizeStr = getConfig('REMOTE_WORKER_BATCH_SIZE', '10');
    const batchSize = parseInt(batchSizeStr, 10) || 10;

    // Begin transaction for atomicity
    const transaction = db.transaction(() => {
      // Find papers
      const rows = db.prepare(`
        SELECT Paper_ID, DOI, Title, PDF_Link
        FROM papers
        WHERE Project_ID = ? AND Local_PDF_Status = 'MISSING'
        LIMIT ?
      `).all(project_id, batchSize) as any[];

      if (rows.length === 0) {
        return [];
      }

      // Claim them
      const now = new Date().toISOString();
      const paperIds = rows.map(r => r.Paper_ID);
      
      const updateStmt = db.prepare(`
        UPDATE papers 
        SET Local_PDF_Status = 'IN_PROGRESS', 
            remote_worker_id = ?, 
            scrape_claimed_at = ?
        WHERE Paper_ID = ?
      `);

      for (const id of paperIds) {
        updateStmt.run(worker_id, now, id);
      }

      return rows;
    });

    const papers = transaction();

    // Prepare scraper config payload using the current ScraperSettingsTab keys
    const scraperConfig = {
      delay_seconds: parseFloat(getConfig('SCRAPER_DELAY_SECONDS', '20')),
      jitter_seconds: parseFloat(getConfig('SCRAPER_JITTER_SECONDS', '5')),
      headed_mode: getConfig('SCRAPER_HEADED_MODE', 'false') === 'true'
    };

    const proxyBaseUrl = getConfig('SCRAPER_PROXY_BASE_URL', 'https://doi.org/');

    return NextResponse.json({
      papers: papers.map(p => ({ paper_id: p.Paper_ID, doi: p.DOI, title: p.Title, pdf_link: p.PDF_Link })),
      proxy_base_url: proxyBaseUrl,
      scraper_config: scraperConfig,
      batch_size: batchSize
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
