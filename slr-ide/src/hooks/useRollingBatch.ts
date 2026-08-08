import { useState, useEffect, useCallback, useRef } from 'react';
import { broadcastSync } from '@/lib/sync-utils';

interface UseRollingBatchProps {
  projectId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function useRollingBatch({ projectId, showToast }: UseRollingBatchProps) {
  const [currentBatch, setCurrentBatch] = useState<any | null>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [cumulativeStats, setCumulativeStats] = useState<any | null>(null);
  const [individualBatchStats, setIndividualBatchStats] = useState<any[]>([]);
  const [auditPassed, setAuditPassed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  
  const [showAdjudicationModal, setShowAdjudicationModal] = useState<boolean>(false);

  // Load active status
  const loadStatus = useCallback(async () => {
    setLoading(true);
    setCurrentBatch(null);
    setPapers([]);
    setReviewers([]);
    setHistory([]);
    try {
      const statusRes = await fetch(`/api/rolling-batch/status?projectId=${projectId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setCurrentBatch(data.activeBatch);
        setPapers(data.papers || []);
        setReviewers(data.reviewers || []);
        setHistory(data.history || []);
      }
    } catch (err: any) {
      console.error('Error fetching rolling batch status:', err);
      showToast(err.message || 'Failed to fetch rolling batch status', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  // Load cumulative statistics
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setCumulativeStats(null);
    setIndividualBatchStats([]);
    try {
      const statsRes = await fetch(`/api/rolling-batch/stats?projectId=${projectId}`);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setCumulativeStats(data.cumulativeStats);
        setIndividualBatchStats(data.individualBatchStats || []);
        setAuditPassed(!!data.auditPassed);
      }
    } catch (err: any) {
      console.error('Error computing rolling batch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [projectId]);

  // Initialize new batch
  const initializeBatch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rolling-batch/initialize?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Successfully initialized Rolling Batch #${data.batch.batchNumber}!`, 'success');
        broadcastSync('SYNC_PAPERS');
        await loadStatus();
        await loadStats();
      } else {
        showToast(data.error || 'Failed to initialize batch', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to initialize batch', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Download .slr file for review
  const downloadBatchSlr = () => {
    if (!currentBatch) {
      showToast('No active batch found to download', 'error');
      return;
    }
    window.open(`/api/rolling-batch/export?projectId=${projectId}`, '_blank');
    showToast(`Downloading blinded batch review file...`, 'info');
  };

  // Import reviewer decisions
  const importReviewerSlr = async (file: File) => {
    if (!currentBatch) {
      showToast('No active batch to upload reviewer decisions to', 'error');
      return false;
    }
    try {
      const text = await file.text();
      const res = await fetch(`/api/rolling-batch/import?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text
      });
      const data = await res.json();
      if (res.ok) {
        const result = data.importResult;
        showToast(
          `Imported results for ${result.reviewerName}! (${result.papersImported} papers processed).`,
          'success'
        );
        broadcastSync('SYNC_PAPERS');
        await loadStatus();
        await loadStats();
        return true;
      } else {
        showToast(data.error || 'Failed to import reviewer decisions', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing reviewer file', 'error');
      return false;
    }
  };

  // Reset rolling batch (mode: 'active' | 'all')
  const resetBatch = async (mode: 'active' | 'all'): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rolling-batch/reset?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Rolling batch reset successfully', 'success');
        broadcastSync('SYNC_PAPERS');
        await loadStatus();
        await loadStats();
        return true;
      } else {
        showToast(data.error || 'Failed to reset rolling batch', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset rolling batch', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Set up BroadcastChannel state rehydration
  const latestLoaders = useRef({ loadStatus, loadStats });
  useEffect(() => {
    latestLoaders.current = { loadStatus, loadStats };
  });

  useEffect(() => {
    loadStatus();
    loadStats();
  }, [loadStatus, loadStats]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;
    const channel = new BroadcastChannel('slr-magic-sync');
    channel.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'SYNC_PAPERS' || type === 'SYNC_ADJUDICATION') {
        latestLoaders.current.loadStatus();
        latestLoaders.current.loadStats();
      }
    };
    return () => {
      channel.close();
    };
  }, []);

  return {
    currentBatch,
    papers,
    reviewers,
    history,
    cumulativeStats,
    individualBatchStats,
    auditPassed,
    loading,
    statsLoading,
    showAdjudicationModal,
    setShowAdjudicationModal,
    loadStatus,
    loadStats,
    initializeBatch,
    downloadBatchSlr,
    importReviewerSlr,
    resetBatch
  };
}
