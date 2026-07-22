import { NextResponse } from 'next/server';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const worker = remoteWorkerManager.getWorker(id);
    
    if (worker) {
      // Best effort to cancel current worker tasks
      try {
        await remoteWorkerManager.proxyCommand(worker, '/cancel', 'POST');
      } catch (err) {
        console.warn(`Could not cancel worker ${id} before removal:`, err);
      }
    }

    remoteWorkerManager.removeWorker(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { is_enabled } = await req.json();
    
    remoteWorkerManager.toggleWorker(id, is_enabled ? 1 : 0);
    return NextResponse.json({ success: true, worker: remoteWorkerManager.getWorker(id) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
