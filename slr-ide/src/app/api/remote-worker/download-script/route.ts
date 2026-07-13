import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd().endsWith('slr-ide') 
  ? process.cwd() 
  : (fs.existsSync(path.join(process.cwd(), 'slr-ide')) ? path.join(process.cwd(), 'slr-ide') : process.cwd());

export async function GET(req: Request) {
  try {
    const workerScriptPath = path.join(PROJECT_ROOT, 'python_engine', 'worker_server.py');
    
    if (!fs.existsSync(workerScriptPath)) {
      return new NextResponse('Worker script not found on server', { status: 404 });
    }

    let scriptString = fs.readFileSync(workerScriptPath, 'utf-8');

    const hostUrl = req.headers.get('host');
    if (hostUrl) {
      const protocol = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https') ? 'https' : 'http');
      const fullHost = `${protocol}://${hostUrl}`;
      scriptString = scriptString.replace('"INJECT_IDE_HOST_HERE"', `"${fullHost}"`);
    }

    const scriptBuffer = Buffer.from(scriptString, 'utf-8');

    return new NextResponse(scriptBuffer, {
      headers: {
        'Content-Type': 'text/x-python',
        'Content-Disposition': 'attachment; filename="worker_server.py"',
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
