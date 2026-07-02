import { NextResponse } from 'next/server';

export class StreamManager {
  private encoder = new TextEncoder();

  public createEventStream(getState: () => any): Response {
    let controllerRef: ReadableStreamDefaultController | null = null;
    const globalState = (global as any);
    const state = globalState.batchState;

    const stream = new ReadableStream({
      start: (controller) => {
        controllerRef = controller;

        if (state) {
          const restoreMsg = {
            event: 'restore',
            isExecuting: state.isExecuting,
            isWaitingLogin: state.isWaitingLogin,
            steps: state.steps,
            currentStep: state.currentStep,
            stepStartTime: state.stepStartTime,
            progress: state.progress,
            statusText: state.statusText,
            logs: state.logs,
            currentItem: state.currentItem,
            indexingState: state.indexingState,
            pipelineStats: state.pipelineStats
          };
          controller.enqueue(this.encoder.encode(JSON.stringify(restoreMsg) + '\n'));

          const listener = (msg: any) => {
            try {
              controller.enqueue(this.encoder.encode(JSON.stringify(msg) + '\n'));
            } catch (e) {
              // ignore closed streams
            }
          };

          state.listeners.push(listener);
          (controller as any)._listener = listener;
        }
      },
      cancel: () => {
        if (controllerRef && (controllerRef as any)._listener && state) {
          state.listeners = state.listeners.filter((l: any) => l !== (controllerRef as any)._listener);
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
    const state = globalState.batchState;
    if (state && state.listeners) {
      let enrichedData = data;
      if (data && typeof data === 'object') {
        enrichedData = {
          ...data,
          pct: state.progress,
          progress: state.progress,
          pipelineStats: state.pipelineStats,
          currentItem: state.currentItem,
          message: data.message || state.statusText
        };
      }
      state.listeners.forEach((listener: any) => {
        try {
          listener(enrichedData);
        } catch (e) {
          // ignore closed connections
        }
      });
    }
  }

  public startHeartbeat(intervalMs: number = 15000): NodeJS.Timeout {
    return setInterval(() => {
      this.broadcast({ event: 'heartbeat', timestamp: Date.now() });
    }, intervalMs);
  }

  public closeStream(): void {
    const globalState = (global as any);
    const state = globalState.batchState;
    if (state) {
      state.listeners = [];
    }
  }
}

export const streamManager = new StreamManager();
