import { NextResponse } from 'next/server';

export async function POST() {
  const globalState = (global as any);
  const state = globalState.batchState;
  
  if (state && state.isExecuting && state.isWaitingLogin && state.activeChild) {
    console.log(`Resuming active child process PID ${state.activeChild.pid} via Resume endpoint...`);
    try {
      state.isWaitingLogin = false;
      // Write a newline to stdin of the active child process to unblock sys.stdin.readline()
      state.activeChild.stdin?.write('\n');
      
      const msg = { event: 'log', message: '[SYSTEM]: User clicked resume. Continuing scraping pipeline...', step: 'scrape' };
      state.logs.push(msg.message);
      if (state.logs.length > 500) {
        state.logs.shift();
      }
      
      // Notify all listeners
      const resumeEvent = { event: 'resume', step: 'scrape' };
      state.listeners.forEach((send: any) => {
        try { send(resumeEvent); } catch (e) {}
        try { send(msg); } catch (e) {}
      });
      
      return NextResponse.json({ success: true, message: 'Pipeline resumed.' });
    } catch (e: any) {
      console.error('Error writing to child process stdin:', e);
      return NextResponse.json({ success: false, message: `Failed to write to child stdin: ${e.message}` }, { status: 500 });
    }
  }
  
  return NextResponse.json({ success: false, message: 'No active pipeline waiting for login.' });
}
