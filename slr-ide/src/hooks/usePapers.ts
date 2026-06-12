import { useState, useCallback } from 'react';
import { Paper } from '@/types';
import { broadcastSync } from '@/lib/sync-utils';

export function usePapers(showToast: (msg: string, type: string) => void) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);

  const loadPapers = useCallback(async () => {
    setLoadingPapers(true);
    try {
      const res = await fetch('/api/papers');
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
      } else {
        showToast('Failed to load papers', 'error');
      }
    } catch (err: any) {
      showToast(`Error loading papers: ${err.message || err}`, 'error');
    } finally {
      setLoadingPapers(false);
    }
  }, [showToast]);

  const deletePaper = useCallback(async (paperId: string) => {
    try {
      const res = await fetch(`/api/papers?id=${encodeURIComponent(paperId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Paper deleted successfully', 'success');
        await loadPapers();
        broadcastSync('SYNC_PAPERS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete paper', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error deleting paper: ${err.message || err}`, 'error');
      return false;
    }
  }, [loadPapers, showToast]);

  const updatePaperStatus = useCallback(async (paperId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/papers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: paperId, status: newStatus })
      });
      if (res.ok) {
        await loadPapers();
        broadcastSync('SYNC_PAPERS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update paper status', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error updating paper status: ${err.message || err}`, 'error');
      return false;
    }
  }, [loadPapers, showToast]);

  const updateLocalPdfStatus = useCallback(async (paperId: string, newStatus: string) => {
      try {
        const res = await fetch(`/api/papers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: paperId, localPdfStatus: newStatus })
        });
        if (res.ok) {
          await loadPapers();
          broadcastSync('SYNC_PAPERS');
          return true;
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to update local PDF status', 'error');
          return false;
        }
      } catch (err: any) {
        showToast(`Error updating local PDF status: ${err.message || err}`, 'error');
        return false;
      }
  }, [loadPapers, showToast]);

  return {
    papers,
    loadingPapers,
    loadPapers,
    deletePaper,
    updatePaperStatus,
    updateLocalPdfStatus
  };
}
