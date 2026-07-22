import { NextResponse } from 'next/server';
import { remoteWorkerManager } from '@/lib/services/remote-worker-manager';

export async function POST(req: Request) {
  try {
    const { worker_id, pairing_code } = await req.json();
    if (!worker_id || !pairing_code) {
      return NextResponse.json({ error: 'Missing worker_id or pairing_code' }, { status: 400 });
    }

    const worker = remoteWorkerManager.getWorker(worker_id);
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    // Call the worker's /pair endpoint
    const data = await remoteWorkerManager.proxyCommand(worker, '/pair', 'POST', { pairing_code, worker_id });
    
    if (!data.session_token) {
      throw new Error('Worker did not return a session_token');
    }

    remoteWorkerManager.updateWorkerToken(worker_id, data.session_token);

    return NextResponse.json({ success: true, worker: remoteWorkerManager.getWorker(worker_id) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
