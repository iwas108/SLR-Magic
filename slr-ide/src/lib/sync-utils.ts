export type SyncType = 'SYNC_PAPERS' | 'SYNC_PROJECTS' | 'SYNC_PIPELINE' | 'SYNC_ADJUDICATION';

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
