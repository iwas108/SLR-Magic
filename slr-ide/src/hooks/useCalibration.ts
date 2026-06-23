import { useState, useCallback, useRef, useEffect } from 'react';
import { Paper } from '@/types';
import { broadcastSync } from '@/lib/sync-utils';

export function useCalibration(
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void,
  showAssignModal: boolean
) {
  // Pre-Calibration States
  const [calActivePool, setCalActivePool] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');
  const [paperModal, setPaperModal] = useState<{ isOpen: boolean; mode: 'view' | 'edit'; paper: any | null }>({ isOpen: false, mode: 'view', paper: null });
  const [calStats, setCalStats] = useState({ TP: 0, TN: 0, FP: 0, FN: 0, agreementRate: 0, kappa: 'N/A', reviewedCount: 0 });
  const [calPapers, setCalPapers] = useState<Paper[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calSearchTerm, setCalSearchTerm] = useState('');
  const [calStatusFilter, setCalStatusFilter] = useState('');
  const [calPdfFilter, setCalPdfFilter] = useState('');
  const [calTagFilter, setCalTagFilter] = useState('');
  const [calPage, setCalPage] = useState(1);
  const [calLimit, setCalLimit] = useState(50);
  const [calTotalPapers, setCalTotalPapers] = useState(0);
  const [calTotalPages, setCalTotalPages] = useState(1);
  const [calSortBy, setCalSortBy] = useState('Paper_ID');
  const [calSortOrder, setCalSortOrder] = useState<'asc' | 'desc'>('asc');

  // Assign Papers modal states
  const [activeAssignDropdown, setActiveAssignDropdown] = useState<{ paperId: string; poolId: string } | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignPoolFilter, setAssignPoolFilter] = useState('all');
  const [assignPapers, setAssignPapers] = useState<Paper[]>([]);
  const [assignSelectedPaper, setAssignSelectedPaper] = useState<Paper | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPage, setAssignPage] = useState(1);
  const [assignLimit, setAssignLimit] = useState(25);
  const [assignTotalPapers, setAssignTotalPapers] = useState(0);
  const [assignTotalPages, setAssignTotalPages] = useState(1);
  const [assignLogs, setAssignLogs] = useState<string[]>([]);
  const [assignIsRunning, setAssignIsRunning] = useState(false);
  const [assignStatusText, setAssignStatusText] = useState('');
  const [assignProgress, setAssignProgress] = useState(0);
  const [assignWaitingLogin, setAssignWaitingLogin] = useState(false);

  const loadCalPapers = useCallback(async () => {
    setCalLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('pool', calActivePool);
      if (calSearchTerm) params.append('search', calSearchTerm);
      if (calStatusFilter) params.append('status', calStatusFilter);
      if (calPdfFilter) params.append('pdfStatus', calPdfFilter);
      if (calTagFilter) params.append('poolTag', calTagFilter);
      if (calSortBy) {
        params.append('sortBy', calSortBy);
        params.append('sortOrder', calSortOrder);
      }
      params.append('page', String(calPage));
      params.append('limit', String(calLimit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCalPapers(data.papers || []);
        setCalTotalPapers(data.total || 0);
        setCalTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching calibration papers:', err);
    } finally {
      setCalLoading(false);
    }
  }, [calActivePool, calSearchTerm, calStatusFilter, calPdfFilter, calTagFilter, calSortBy, calSortOrder, calPage, calLimit]);

  const loadAssignPapers = useCallback(async () => {
    setAssignLoading(true);
    try {
      const params = new URLSearchParams();
      if (assignSearch) params.append('search', assignSearch);
      
      if (assignPoolFilter === 'unassigned') {
        params.append('unassigned', 'true');
      } else if (assignPoolFilter !== 'all') {
        params.append('pool', assignPoolFilter);
      }

      params.append('page', String(assignPage));
      params.append('limit', String(assignLimit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssignPapers(data.papers || []);
        setAssignTotalPapers(data.total || 0);
        setAssignTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching assign papers:', err);
    } finally {
      setAssignLoading(false);
    }
  }, [assignSearch, assignPoolFilter, assignPage, assignLimit]);

  // Load papers on mount and when dependencies change
  useEffect(() => {
    loadCalPapers();
  }, [loadCalPapers]);

  useEffect(() => {
    if (showAssignModal) {
      loadAssignPapers();
    }
  }, [showAssignModal, loadAssignPapers]);

  // Sync Listener (Mutable Ref Pattern)
  const loadCalPapersRef = useRef(loadCalPapers);
  const loadAssignPapersRef = useRef(loadAssignPapers);
  useEffect(() => {
    loadCalPapersRef.current = loadCalPapers;
    loadAssignPapersRef.current = loadAssignPapers;
  }, [loadCalPapers, loadAssignPapers]);

  useEffect(() => {
    const channel = new BroadcastChannel('slr-sync');
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_PAPERS' || event.data.type === 'SYNC_PROJECTS') {
        loadCalPapersRef.current();
        if (showAssignModal) {
          loadAssignPapersRef.current();
        }
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [showAssignModal]);

  const handleCalSort = (field: string) => {
    if (calSortBy === field) {
      setCalSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCalSortBy(field);
      setCalSortOrder('asc');
    }
    setCalPage(1);
  };

  const handleAssignPool = async (paperId: string, pool: 'pool_a' | 'pool_b' | 'pool_c' | null) => {
    try {
      const res = await fetch(`/api/papers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: paperId, pool: pool || '' })
      });
      if (res.ok) {
        showToast(`Paper ${pool ? 'assigned to ' + pool.replace('_', ' ').toUpperCase() : 'unassigned'} successfully`, 'success');
        setActiveAssignDropdown(null);
        broadcastSync('SYNC_PAPERS');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to assign paper', 'error');
      }
    } catch (err: any) {
      showToast(`Error assigning paper: ${err.message || err}`, 'error');
    }
  };

  const handleExportCalPoolA = async () => {
    try {
      const res = await fetch(`/api/export?pool=pool_a`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slr_export_pool_a_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('Pool A exported successfully', 'success');
      } else {
        showToast('Failed to export Pool A', 'error');
      }
    } catch (err: any) {
      showToast(`Error exporting Pool A: ${err.message || err}`, 'error');
    }
  };

  return {
    paperModal, setPaperModal,
    calActivePool, setCalActivePool,
    calStats, setCalStats,
    calPapers, setCalPapers,
    calLoading, setCalLoading,
    calSearchTerm, setCalSearchTerm,
    calStatusFilter, setCalStatusFilter,
    calPdfFilter, setCalPdfFilter,
    calTagFilter, setCalTagFilter,
    calPage, setCalPage,
    calLimit, setCalLimit,
    calTotalPapers, setCalTotalPapers,
    calTotalPages, setCalTotalPages,
    calSortBy, setCalSortBy,
    calSortOrder, setCalSortOrder,
    activeAssignDropdown, setActiveAssignDropdown,
    assignSearch, setAssignSearch,
    assignPoolFilter, setAssignPoolFilter,
    assignPapers, setAssignPapers,
    assignSelectedPaper, setAssignSelectedPaper,
    assignLoading, setAssignLoading,
    assignPage, setAssignPage,
    assignLimit, setAssignLimit,
    assignTotalPapers, setAssignTotalPapers,
    assignTotalPages, setAssignTotalPages,
    assignLogs, setAssignLogs,
    assignIsRunning, setAssignIsRunning,
    assignStatusText, setAssignStatusText,
    assignProgress, setAssignProgress,
    assignWaitingLogin, setAssignWaitingLogin,
    handleCalSort,
    handleAssignPool,
    handleExportCalPoolA,
    
    loadCalPapers,
    loadAssignPapers
  };
}
