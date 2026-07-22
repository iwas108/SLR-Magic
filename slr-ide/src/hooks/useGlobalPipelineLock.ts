import { useState, useEffect } from 'react';

export function useGlobalPipelineLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkLock = async () => {
    try {
      const res = await fetch('/api/pipeline-lock');
      const data = await res.json();
      setIsLocked(data.locked);
    } catch (e) {
      console.error('Failed to check global pipeline lock', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkLock();
    // Poll every 5 seconds to keep lock state updated across tabs
    const interval = setInterval(checkLock, 5000);
    return () => clearInterval(interval);
  }, []);

  const forceUnlock = async () => {
    try {
      await fetch('/api/pipeline-lock/force-unlock', { method: 'POST' });
      await checkLock();
    } catch (e) {
      console.error('Failed to force unlock', e);
    }
  };

  return { isLocked, isLoading, forceUnlock, checkLock };
}
