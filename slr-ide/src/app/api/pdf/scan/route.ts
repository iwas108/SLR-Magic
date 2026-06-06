import { spawn } from 'child_process';
import path from 'path';
import { PROJECT_ROOT } from '@/lib/db';

export async function POST() {
  try {
    const pythonExe = path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(PROJECT_ROOT, 'scrapers', 'cache_matcher.py');

    const child = spawn(pythonExe, [scriptPath]);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        child.stdout.on('data', (data) => {
          const chunk = data.toString();
          controller.enqueue(encoder.encode(chunk));
        });

        child.stderr.on('data', (data) => {
          console.error('[Cache Matcher Error]:', data.toString());
        });

        child.on('close', (code) => {
          controller.close();
        });

        child.on('error', (err) => {
          controller.enqueue(encoder.encode(JSON.stringify({ event: 'error', message: err.message }) + '\n'));
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to trigger cache matcher' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
