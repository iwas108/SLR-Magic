import { NextRequest } from 'next/server';
import { operationsManager } from '@/lib/llm-operations';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return new Response('Missing jobId', { status: 400 });
  }

  const encoder = new TextEncoder();

  const customStream = new ReadableStream({
    start(controller) {
      const listener = (data: string) => {
        try {
          // SSE protocol formatting
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (e) {
          console.error('SSE enqueue error:', e);
        }
      };

      // Subscribe to active job logging from operations manager
      operationsManager.subscribe(jobId, listener);

      // Keepalive heartbeat every 15 seconds to prevent browser/gateway timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          // Socket closed or failed, ignore
        }
      }, 15000);

      // Gracefully unsubscribe when SSE connection is aborted (tab closed / navigated away)
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        operationsManager.unsubscribe(jobId, listener);
        console.log(`SSE connection closed for job ${jobId}`);
      });
    }
  });

  return new Response(customStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
