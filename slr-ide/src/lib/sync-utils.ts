export type SyncType = 'SYNC_PAPERS' | 'SYNC_PROJECTS' | 'SYNC_PIPELINE' | 'SYNC_ADJUDICATION' | 'SYNC_DUPLICATES' | 'SYNC_LLM_JOB';

export function broadcastSync(type: SyncType) {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel('slr-magic-sync');
      channel.postMessage({ type, timestamp: Date.now() });
      channel.close();
    } catch (e) {
      console.error('[broadcastSync] Failed to broadcast sync event:', e);
    }
  }
}

export function subscribeSyncChannel(callback: (type: SyncType) => void): () => void {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel('slr-magic-sync');
      channel.onmessage = (e) => {
        if (e.data?.type) {
          callback(e.data.type as SyncType);
        }
      };
      return () => channel.close();
    } catch (e) {
      console.error('[subscribeSyncChannel] Failed to subscribe:', e);
      return () => {};
    }
  }
  return () => {};
}
