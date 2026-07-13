import { NextResponse } from 'next/server';

export class GlobalEventManager {
  private encoder = new TextEncoder();

  public createEventStream(): Response {
    let controllerRef: ReadableStreamDefaultController | null = null;
    const globalState = (global as any);
    if (!globalState.globalListeners) {
      globalState.globalListeners = [];
    }

    const stream = new ReadableStream({
      start: (controller) => {
        controllerRef = controller;

        const listener = (msg: any) => {
          try {
            controller.enqueue(this.encoder.encode(JSON.stringify(msg) + '\n'));
          } catch (e) {
            // ignore closed streams
          }
        };

        globalState.globalListeners.push(listener);
        (controller as any)._listener = listener;
      },
      cancel: () => {
        if (controllerRef && (controllerRef as any)._listener) {
          globalState.globalListeners = globalState.globalListeners.filter((l: any) => l !== (controllerRef as any)._listener);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  }

  public broadcast(data: any): void {
    const globalState = (global as any);
    if (globalState.globalListeners) {
      globalState.globalListeners.forEach((listener: any) => {
        try {
          listener(data);
        } catch (e) {
          // ignore closed connections
        }
      });
    }
  }
}

export const globalEventManager = new GlobalEventManager();
