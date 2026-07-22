import { useRef, useCallback, useEffect } from 'react';

interface UseSseStreamOptions {
  onEvent?: (data: any) => void;
  onComplete?: () => void;
  onError?: (err: Error) => void;
}

export function useSseStream(options?: UseSseStreamOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelStream();
  }, [cancelStream]);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async (url: string, fetchOptions: RequestInit = {}) => {
    cancelStream();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      if (!res.body) {
        throw new Error('No body stream returned');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            const dataStr = chunk.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              cancelStream();
              if (optionsRef.current?.onComplete) optionsRef.current.onComplete();
              return; // break out of loop
            }

            try {
              const data = JSON.parse(dataStr);
              const isTerminal = data.isTerminal || data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED';

              if (optionsRef.current?.onEvent) {
                optionsRef.current.onEvent(data);
              }

              if (isTerminal) {
                cancelStream();
                if (optionsRef.current?.onComplete) optionsRef.current.onComplete();
                return;
              }
            } catch (e) {
              // Not JSON, might be a raw message
              if (optionsRef.current?.onEvent) {
                optionsRef.current.onEvent({ status: 'INFO', message: dataStr });
              }
            }
          }
        }
      }
      
      if (optionsRef.current?.onComplete) optionsRef.current.onComplete();

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        if (optionsRef.current?.onError) optionsRef.current.onError(err);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [cancelStream]);

  return { connect, cancelStream, abortControllerRef };
}
