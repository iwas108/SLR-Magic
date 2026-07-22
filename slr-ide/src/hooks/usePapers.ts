import { useState, useCallback, useRef, useEffect } from 'react';
import { Paper } from '@/types';
import { broadcastSync } from '@/lib/sync-utils';

export function usePapers(showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void, loadProjects?: () => void) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [pdfFilter, setPdfFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [doiStatusFilter, setDoiStatusFilter] = useState('');
  const [pdfLinkFilter, setPdfLinkFilter] = useState('');
  const [pipelineStageFilter, setPipelineStageFilter] = useState('');
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState('');
  const [ecTriggerFilter, setEcTriggerFilter] = useState('');
  
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
  const [deletingPaper, setDeletingPaper] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState('');
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);

  const loadDuplicatesCount = useCallback(async () => {
    try {
      const res = await fetch('/api/duplicates');
      if (res.ok) {
        const data = await res.json();
        setDuplicatesCount(data.count || 0);
      }
    } catch (err) {
      console.error('Error loading duplicates count:', err);
    }
  }, []);

  const loadPapers = useCallback(async () => {
    setLoadingPapers(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (pdfFilter) params.append('pdfStatus', pdfFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (doiStatusFilter) params.append('doiStatus', doiStatusFilter);
      if (pdfLinkFilter) params.append('pdfLink', pdfLinkFilter);
      if (pipelineStageFilter) params.append('pipelineStage', pipelineStageFilter);
      if (pipelineStatusFilter) params.append('pipelineStatus', pipelineStatusFilter);
      if (ecTriggerFilter) params.append('ecTrigger', ecTriggerFilter);
      
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
        setTotalPapers(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        showToast('Failed to load papers', 'error');
      }
      await loadDuplicatesCount();
    } catch (err: any) {
      showToast(`Error loading papers: ${err.message || err}`, 'error');
    } finally {
      setLoadingPapers(false);
    }
  }, [page, limit, sortBy, sortOrder, searchTerm, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, pipelineStageFilter, pipelineStatusFilter, ecTriggerFilter, showToast, loadDuplicatesCount]);

  // Load papers on mount and when filters change
  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // Clear selectedPaperIds when filters or search change
  useEffect(() => {
    setSelectedPaperIds([]);
  }, [searchTerm, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, pipelineStageFilter, pipelineStatusFilter, ecTriggerFilter]);

  // Reset page to 1 when filters or search terms change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, pipelineStageFilter, pipelineStatusFilter, ecTriggerFilter]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const deletePaper = useCallback(async () => {
    if (!deleteConfirm.paper) return false;
    setDeletingPaper(true);
    try {
      const res = await fetch(`/api/papers/${deleteConfirm.paper.Paper_ID}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Paper deleted successfully', 'success');
        setDeleteConfirm({ isOpen: false, paper: null });
        if (paperModal.isOpen && paperModal.paper?.Paper_ID === deleteConfirm.paper.Paper_ID) {
          setPaperModal({ isOpen: false, mode: 'view', paper: null });
        }
        await loadPapers();
        broadcastSync('SYNC_PAPERS');
        return true;
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete paper', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error deleting paper: ${err.message || err}`, 'error');
      return false;
    } finally {
      setDeletingPaper(false);
    }
  }, [deleteConfirm.paper, paperModal, loadPapers, showToast]);

  const handleDeleteAllPapers = useCallback(async () => {
    if (deleteAllConfirmationText !== 'DELETE ALL') return false;
    try {
      const res = await fetch('/api/papers?confirm=DELETE_ALL', {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'All papers deleted successfully', 'success');
        setDeleteAllConfirm(false);
        setDeleteAllConfirmationText('');
        await loadPapers();
        if (loadProjects) loadProjects();
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
        return true;
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete all papers', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(`Error deleting all papers: ${err.message || err}`, 'error');
      return false;
    }
  }, [deleteAllConfirmationText, loadPapers, loadProjects, showToast]);

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
        pdfStatus: pdfFilter,
        source: sourceFilter
      });
      if (doiStatusFilter) query.append('doiStatus', doiStatusFilter);
      if (pdfLinkFilter) query.append('pdfLink', pdfLinkFilter);
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
  }, [searchTerm, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, showToast]);

  const activePaperRef = useRef<any>(null);
  activePaperRef.current = paperModal.paper;

  // Active State Rehydration: Sync paperModal.paper with list updates (e.g. PDF path / status changes in background)
  useEffect(() => {
    if (paperModal.isOpen && activePaperRef.current && papers.length > 0) {
      const updated = papers.find(p => p.Paper_ID === activePaperRef.current?.Paper_ID);
      if (updated && JSON.stringify(updated) !== JSON.stringify(activePaperRef.current)) {
        setPaperModal(prev => ({ ...prev, paper: updated }));
      }
    }
  }, [papers, paperModal.isOpen]);

  return {
    papers,
    setPapers,
    loadingPapers,
    duplicatesCount,
    setDuplicatesCount,
    loadDuplicatesCount,
    searchTerm, setSearchTerm,
    pdfFilter, setPdfFilter,
    sourceFilter, setSourceFilter,
    doiStatusFilter, setDoiStatusFilter,
    pdfLinkFilter, setPdfLinkFilter,
    pipelineStageFilter, setPipelineStageFilter,
    pipelineStatusFilter, setPipelineStatusFilter,
    ecTriggerFilter, setEcTriggerFilter,
    page, setPage,
    limit, setLimit,
    totalPapers,
    totalPages,
    sortBy,
    sortOrder,
    paperModal, setPaperModal,
    deleteConfirm, setDeleteConfirm,
    deletingPaper, setDeletingPaper,
    deleteAllConfirm, setDeleteAllConfirm,
    deleteAllConfirmationText, setDeleteAllConfirmationText,
    handleSort,
    loadPapers,
    deletePaper,
    handleDeleteAllPapers,
    updatePaperStatus,
    updateLocalPdfStatus,
    selectedPaperIds,
    setSelectedPaperIds,
    bulkUpdatePapers,
    selectAllMatchingPapers
  };
}
