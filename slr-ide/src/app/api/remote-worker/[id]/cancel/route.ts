import { NextResponse } from 'next/server';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const worker = remoteWorkerManager.getWorker(id);
    
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    try {
      await remoteWorkerManager.proxyCommand(worker, '/cancel', 'POST');
    } catch (err) {
      console.warn(`Could not proxy cancel to worker ${id}:`, err);
    }

    // Reclaim papers immediately regardless of whether the worker acknowledged
    remoteWorkerManager.reclaimPapersForWorker(id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
