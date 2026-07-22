import { NextResponse } from 'next/server';
import { remoteWorkerManager, WorkerStatus } from '@/lib/services/remote-worker-manager';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const worker = remoteWorkerManager.getWorker(id);
    
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    if (!worker.session_token) {
      return NextResponse.json({ ...worker, telemetry: null });
    }

    try {
      const data = await remoteWorkerManager.proxyCommand(worker, '/status', 'GET');
      
      const newStatus = (data.status as WorkerStatus) || 'IDLE';
      const now = new Date().toISOString();
      
      remoteWorkerManager.updateWorkerStatus(id, newStatus, now);
      
      return NextResponse.json({
        ...worker,
        status: newStatus,
        last_seen_at: now,
        telemetry: data.telemetry || data
      });
    } catch (err: any) {
      // If poll fails, mark as offline
      remoteWorkerManager.updateWorkerStatus(id, 'OFFLINE', worker.last_seen_at || new Date().toISOString());
      return NextResponse.json({
        ...worker,
        status: 'OFFLINE',
        telemetry: null
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
