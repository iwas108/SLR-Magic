import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST() {
  const globalState = (global as any);
  const state = globalState.batchState;
  
  if (state && state.isExecuting) {
    state.cancelRequested = true;
    if (state.activeChild) {
      console.log(`Killing active child process PID ${state.activeChild.pid} via Cancel endpoint...`);
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${state.activeChild.pid} /T /F`);
        } else {
          state.activeChild.kill('SIGKILL');
        }
      } catch (e) {
        console.error('Error killing child process:', e);
      }
    }
    
    const msg = { event: 'error', message: 'Pipeline cancelled by user.' };
    state.listeners.forEach((send: any) => {
      try { send(msg); } catch (e) {}
    });
    
    state.isExecuting = false;
    state.statusText = 'Pipeline cancelled by user.';
    state.logs.push('[SYSTEM]: Pipeline terminated by client cancel request.');
    if (state.logs.length > 500) {
      state.logs.shift();
    }
    state.listeners = [];
    
    return NextResponse.json({ success: true, message: 'Pipeline cancelled.' });
  }
  
  return NextResponse.json({ success: false, message: 'No active pipeline executing.' });
}
