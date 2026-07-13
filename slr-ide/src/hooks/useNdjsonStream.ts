import { useRef, useCallback, useEffect } from 'react';

interface UseNdjsonStreamOptions {
  onEvent?: (data: any) => void;
  onComplete?: () => void;
  onError?: (err: Error) => void;
}

export function useNdjsonStream(options?: UseNdjsonStreamOptions) {
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
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            // Standardized terminal event detection (Epoch 2 standard)
            const isTerminal = data.isTerminal || data.event === 'complete' || data.event === 'error';

            if (optionsRef.current?.onEvent) {
              optionsRef.current.onEvent(data);
            }
            
            if (isTerminal) {
              cancelStream();
              if (optionsRef.current?.onComplete) optionsRef.current.onComplete();
              return; // break out of the while loop entirely
            }
          } catch (e) {
            console.error('Failed to parse NDJSON line:', line, e);
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
