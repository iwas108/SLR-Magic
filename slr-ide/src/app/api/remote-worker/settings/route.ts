import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const batchSizeStr = getConfig('REMOTE_WORKER_BATCH_SIZE', '10');
    const localScraperEnabledStr = getConfig('REMOTE_WORKER_LOCAL_SCRAPER_ENABLED', 'true');

    return NextResponse.json({
      batch_size: parseInt(batchSizeStr, 10) || 10,
      local_scraper_enabled: localScraperEnabledStr === 'true'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { batch_size, local_scraper_enabled } = await req.json();

    if (typeof batch_size === 'number') {
      db.prepare(`INSERT OR REPLACE INTO configs (key, value) VALUES ('REMOTE_WORKER_BATCH_SIZE', ?)`).run(batch_size.toString());
    }

    if (typeof local_scraper_enabled === 'boolean') {
      db.prepare(`INSERT OR REPLACE INTO configs (key, value) VALUES ('REMOTE_WORKER_LOCAL_SCRAPER_ENABLED', ?)`).run(local_scraper_enabled ? 'true' : 'false');
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
