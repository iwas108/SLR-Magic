import { NextResponse } from 'next/server';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const worker = remoteWorkerManager.getWorker(id);
    
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    const data = await remoteWorkerManager.proxyCommand(worker, '/resume', 'POST');
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
