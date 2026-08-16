import { spawn } from 'child_process';
import path from 'path';
import { PROJECT_ROOT, getConfig } from '@/lib/db';
import { getPythonExecutablePath } from '@/lib/services/python-path';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const activeProjectId = body.projectId || body.project_id || searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    const pythonExe = getPythonExecutablePath();

    const child = spawn(pythonExe, ['-m', 'python_engine.entrypoints.scrape_pdfs', '--project', activeProjectId], {
      cwd: PROJECT_ROOT
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        child.stdout.on('data', (data) => {
          const chunk = data.toString();
          controller.enqueue(encoder.encode(chunk));
        });

        child.stderr.on('data', (data) => {
          console.error('[Scraper Error]:', data.toString());
        });

        child.on('close', (code) => {
          controller.close();
        });

        child.on('error', (err) => {
          controller.enqueue(encoder.encode(JSON.stringify({ event: 'error', message: err.message }) + '\n'));
          controller.close();
        });
      },
      cancel() {
        console.log('Download request cancelled by client. Terminating Python scraper...');
        child.kill('SIGKILL');
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
    return new Response(JSON.stringify({ error: error.message || 'Failed to trigger bulk downloader' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
