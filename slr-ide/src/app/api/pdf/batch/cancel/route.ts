import { NextResponse } from 'next/server';
import { processManager } from '@/lib/services/process-manager';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';

export async function POST() {
  const state = batchStateTracker.getState();
  
  if (state && state.isExecuting) {
    state.cancelRequested = true;
    processManager.terminateProcessTree();
    
    const msg = { event: 'error', message: 'Pipeline cancelled by user.' };
    streamManager.broadcast(msg);
    
    state.isExecuting = false;
    state.statusText = 'Pipeline cancelled by user.';
    batchStateTracker.pushLog('[SYSTEM]: Pipeline terminated by client cancel request.');
    streamManager.closeStream();
    
    return NextResponse.json({ success: true, message: 'Pipeline cancelled.' });
  }
  
  return NextResponse.json({ success: false, message: 'No active pipeline executing.' });
}
