import { useEffect, useRef } from 'react';

interface SyncCallbacks {
  loadProjects?: () => void;
  loadPapers?: () => void;
  loadCalPapers?: () => void;
  loadAssignPapers?: () => void;
  loadDuplicatesCount?: () => void;
  [key: string]: any;
}

export function useAppSync(callbacks: SyncCallbacks) {
  const latestCallbacks = useRef(callbacks);

  useEffect(() => {
    latestCallbacks.current = callbacks;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    const channel = new BroadcastChannel('slr-magic-sync');
    
    channel.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'SYNC_PROJECTS') {
        if (latestCallbacks.current.loadProjects) latestCallbacks.current.loadProjects();
        if (latestCallbacks.current.loadPapers) latestCallbacks.current.loadPapers();
        if (latestCallbacks.current.loadCalPapers) latestCallbacks.current.loadCalPapers();
        if (latestCallbacks.current.loadAssignPapers) latestCallbacks.current.loadAssignPapers();
        if (latestCallbacks.current.loadDuplicatesCount) latestCallbacks.current.loadDuplicatesCount();
      }
      if (type === 'SYNC_PAPERS' || type === 'SYNC_ADJUDICATION' || type === 'SYNC_DUPLICATES') {
        if (latestCallbacks.current.loadPapers) latestCallbacks.current.loadPapers();
        if (latestCallbacks.current.loadCalPapers) latestCallbacks.current.loadCalPapers();
        if (latestCallbacks.current.loadAssignPapers) latestCallbacks.current.loadAssignPapers();
        if (latestCallbacks.current.loadDuplicatesCount) latestCallbacks.current.loadDuplicatesCount();
      }
      if (type === 'SYNC_CALIBRATION' && latestCallbacks.current.loadCalPapers) {
        latestCallbacks.current.loadCalPapers();
      }
      if (type === 'SYNC_ASSIGN' && latestCallbacks.current.loadAssignPapers) {
        latestCallbacks.current.loadAssignPapers();
      }
    };

    return () => {
      channel.close();
    };
  }, []);
}
