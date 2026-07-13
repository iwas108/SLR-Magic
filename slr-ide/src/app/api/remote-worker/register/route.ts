import { NextResponse } from 'next/server';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workers = remoteWorkerManager.getWorkers();
    return NextResponse.json(workers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { label, host } = await req.json();
    if (!label || !host) {
      return NextResponse.json({ error: 'Missing label or host' }, { status: 400 });
    }

    const worker = remoteWorkerManager.registerWorker(label, host);
    return NextResponse.json(worker);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
