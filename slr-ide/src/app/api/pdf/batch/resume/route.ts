import { NextResponse } from 'next/server';
import { processManager } from '@/lib/services/process-manager';
import { streamManager } from '@/lib/services/stream-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';

export async function POST() {
  const state = batchStateTracker.getState();
  
  if (state && state.isExecuting && state.isWaitingLogin && state.activeChild) {
    console.log(`Resuming active child process PID ${state.activeChild.pid} via Resume endpoint...`);
    try {
      state.isWaitingLogin = false;
      state.activeChild.stdin?.write('\n');
      
      const msg = { event: 'log', message: '[SYSTEM]: User clicked resume. Continuing scraping pipeline...', step: 'scrape' };
      batchStateTracker.pushLog(msg.message);
      
      const resumeEvent = { event: 'resume', step: 'scrape' };
      streamManager.broadcast(resumeEvent);
      streamManager.broadcast(msg);
      
      return NextResponse.json({ success: true, message: 'Pipeline resumed.' });
    } catch (e: any) {
      console.error('Error writing to child process stdin:', e);
      return NextResponse.json({ success: false, message: `Failed to write to child stdin: ${e.message}` }, { status: 500 });
    }
  }
  
  return NextResponse.json({ success: false, message: 'No active pipeline waiting for login.' });
}
