import { useState, useCallback, useRef, useEffect } from 'react';
import { Paper } from '@/types';
import { broadcastSync } from '@/lib/sync-utils';

export function usePapers(showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pdfFilter, setPdfFilter] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPapers, setTotalPapers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Sorting
  const [sortBy, setSortBy] = useState('Paper_ID');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [paperModal, setPaperModal] = useState<{ isOpen: boolean; mode: 'view' | 'edit'; paper: Paper | null }>({
    isOpen: false,
    mode: 'view',
    paper: null
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; paper: Paper | null }>({
    isOpen: false,
    paper: null
  });
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState('');
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);

  const loadPapers = useCallback(async () => {
    setLoadingPapers(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
        search: searchTerm,
        status: statusFilter,
        pdfStatus: pdfFilter
      });
      const res = await fetch(`/api/papers?${query}`);
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
        setTotalPapers(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        showToast('Failed to load papers', 'error');
      }
    } catch (err: any) {
      showToast(`Error loading papers: ${err.message || err}`, 'error');
    } finally {
      setLoadingPapers(false);
    }
  }, [page, limit, sortBy, sortOrder, searchTerm, statusFilter, pdfFilter, showToast]);

  // Load papers on mount and when filters change
  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // Clear selectedPaperIds when filters or search change
  useEffect(() => {
    setSelectedPaperIds([]);
  }, [searchTerm, statusFilter, pdfFilter]);

  // Sync Listener (Mutable Ref Pattern to avoid stale closures)
  const loadPapersRef = useRef(loadPapers);
  useEffect(() => {
    loadPapersRef.current = loadPapers;
  }, [loadPapers]);

  useEffect(() => {
    const channel = new BroadcastChannel('slr-sync');
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_PAPERS' || event.data.type === 'SYNC_PROJECTS') {
        loadPapersRef.current();
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, []);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1); // Reset page on sort change
  };

  const deletePaper = useCallback(async (paperId: string) => {
    try {
      const res = await fetch(`/api/papers?id=${encodeURIComponent(paperId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Paper deleted successfully', 'success');
        await loadPapers();
        broadcastSync('SYNC_PAPERS');
        setDeleteConfirm({ isOpen: false, paper: null });
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

  const bulkUpdatePapers = useCallback(async (updates: { status?: string; localPdfStatus?: string }) => {
    if (selectedPaperIds.length === 0) return false;
    try {
      const res = await fetch(`/api/papers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperIds: selectedPaperIds,
          ...updates
        })
      });
      if (res.ok) {
        showToast(`Successfully updated ${selectedPaperIds.length} papers`, 'success');
        setSelectedPaperIds([]);
        await loadPapers();
        broadcastSync('SYNC_PAPERS');
        return true;
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to bulk update papers', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error bulk updating papers: ${err.message || err}`, 'error');
      return false;
    }
  }, [selectedPaperIds, loadPapers, showToast]);

  const selectAllMatchingPapers = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        onlyIds: 'true',
        search: searchTerm,
        status: statusFilter,
        pdfStatus: pdfFilter
      });
      const res = await fetch(`/api/papers?${query}`);
      if (res.ok) {
        const ids = await res.json();
        setSelectedPaperIds(ids);
        showToast(`Selected all ${ids.length} matching papers`, 'success');
      } else {
        showToast('Failed to select all papers', 'error');
      }
    } catch (err: any) {
      showToast(`Error selecting all papers: ${err.message || err}`, 'error');
    }
  }, [searchTerm, statusFilter, pdfFilter, showToast]);

  return {
    papers,
    loadingPapers,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    pdfFilter, setPdfFilter,
    page, setPage,
    limit, setLimit,
    totalPapers,
    totalPages,
    sortBy,
    sortOrder,
    paperModal, setPaperModal,
    deleteConfirm, setDeleteConfirm,
    deleteAllConfirm, setDeleteAllConfirm,
    deleteAllConfirmationText, setDeleteAllConfirmationText,
    handleSort,
    loadPapers,
    deletePaper,
    updatePaperStatus,
    updateLocalPdfStatus,
    selectedPaperIds,
    setSelectedPaperIds,
    bulkUpdatePapers,
    selectAllMatchingPapers
  };
}
