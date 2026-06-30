import { spawn } from 'child_process';
import path from 'path';
import { PROJECT_ROOT } from '@/lib/db';

export async function POST(request: Request) {
  try {
    let rebuild = false;
    try {
      const body = await request.json();
      rebuild = !!body.rebuild;
    } catch {
      // Body might be empty, ignore
    }

    const pythonExe = path.join(PROJECT_ROOT, 'python_engine', 'venv', 'Scripts', 'python.exe');
    const pythonModule = 'python_engine.entrypoints.build_vectors';

    const args = ['-u', '-m', pythonModule];
    if (rebuild) {
      args.push('--rebuild');
    }

    const child = spawn(pythonExe, args, { cwd: PROJECT_ROOT });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        child.stdout.on('data', (data) => {
          controller.enqueue(encoder.encode(data.toString()));
        });

        child.stderr.on('data', (data) => {
          console.error('[Vector Builder Error]:', data.toString());
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
    return new Response(JSON.stringify({ error: error.message || 'Failed to trigger vector builder' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
