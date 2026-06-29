import { useState, useEffect, useRef, useCallback } from 'react';
import { Paper } from '@/types';

interface UseCalibrationProps {
  papers: Paper[];
  loadPapers: () => void;
  loadProjects: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  activeTab: string;
}

export function useCalibration({
  papers,
  loadPapers,
  loadProjects,
  showToast,
  activeTab
}: UseCalibrationProps) {
  // Calibration view states
  const [calActivePool, setCalActivePool] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');
  const [calPapers, setCalPapers] = useState<Paper[]>([]);
  const [calTotalPapers, setCalTotalPapers] = useState(0);
  const [calPage, setCalPage] = useState(1);
  const [calLimit, setCalLimit] = useState(50);
  const [calTotalPages, setCalTotalPages] = useState(1);
  const [calLoading, setCalLoading] = useState(true);

  const [calSearchTerm, setCalSearchTerm] = useState('');
  const [calStatusFilter, setCalStatusFilter] = useState('');
  const [calPdfFilter, setCalPdfFilter] = useState('');
  const [calTagFilter, setCalTagFilter] = useState('');
  
  const [calSortBy, setCalSortBy] = useState('Paper_ID');
  const [calSortOrder, setCalSortOrder] = useState<'asc' | 'desc'>('asc');

  const [calStats, setCalStats] = useState<{
    TP: number;
    TN: number;
    FP: number;
    FN: number;
    agreementRate: number;
    kappa: string;
    reviewedCount: number;
  }>({ TP: 0, TN: 0, FP: 0, FN: 0, agreementRate: 0, kappa: 'N/A', reviewedCount: 0 });

  // Assignment modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeAssignDropdown, setActiveAssignDropdown] = useState<string | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignPoolFilter, setAssignPoolFilter] = useState('unassigned');
  const [assignPapers, setAssignPapers] = useState<Paper[]>([]);
  const [assignSelectedPaper, setAssignSelectedPaper] = useState<Paper | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPage, setAssignPage] = useState(1);
  const [assignLimit, setAssignLimit] = useState(50);
  const [assignTotalPapers, setAssignTotalPapers] = useState(0);
  const [assignTotalPages, setAssignTotalPages] = useState(1);

  // Single paper crawler states (within assignment details pane)
  const [assignLogs, setAssignLogs] = useState<string[]>([]);
  const [assignIsRunning, setAssignIsRunning] = useState(false);
  const [assignStatusText, setAssignStatusText] = useState('Idle');
  const [assignProgress, setAssignProgress] = useState(0);
  const [assignWaitingLogin, setAssignWaitingLogin] = useState(false);

  const singlePipelineAbortControllerRef = useRef<AbortController | null>(null);

  // Fetch calibration papers
  const loadCalPapers = useCallback(async () => {
    setCalLoading(true);
    try {
      const params = new URLSearchParams();
      if (calSearchTerm) params.append('search', calSearchTerm);
      if (calStatusFilter) params.append('status', calStatusFilter);
      if (calPdfFilter) params.append('pdfStatus', calPdfFilter);
      if (calTagFilter) params.append('calibrationTag', calTagFilter);
      params.append('calibrationPool', calActivePool);
      
      params.append('sortBy', calSortBy);
      params.append('sortOrder', calSortOrder);
      params.append('page', String(calPage));
      params.append('limit', String(calLimit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCalPapers(data.papers || []);
        setCalTotalPapers(data.total || 0);
        setCalTotalPages(data.totalPages || 1);
      }

      // Fetch all Pool A papers to compute consensus scorecard metrics (bypassing pagination)
      const statsRes = await fetch(`/api/papers?calibrationPool=pool_a&limit=1000`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const poolAPapers = statsData.papers || [];
        let TP = 0, TN = 0, FP = 0, FN = 0, reviewed = 0;
        for (const p of poolAPapers) {
          const hDec = p.Human_Decision;
          const aiDec = p.Status;
          if (hDec) {
            reviewed++;
            if (hDec === 'INCLUDE' && aiDec === 'INCLUDE') TP++;
            else if (hDec === 'EXCLUDE' && aiDec === 'EXCLUDE') TN++;
            else if (hDec === 'EXCLUDE' && aiDec === 'INCLUDE') FP++;
            else if (hDec === 'INCLUDE' && aiDec === 'EXCLUDE') FN++;
          }
        }
        const totalReviewed = TP + TN + FP + FN;
        let agreementRate = 0;
        let kappaStr = 'N/A';
        if (totalReviewed > 0) {
          agreementRate = ((TP + TN) / totalReviewed) * 100;
          const p_o = (TP + TN) / totalReviewed;
          const p_yes = ((TP + FP) * (TP + FN)) / (totalReviewed * totalReviewed);
          const p_no = ((TN + FN) * (TN + FP)) / (totalReviewed * totalReviewed);
          const p_e = p_yes + p_no;
          if (p_e === 1) {
            kappaStr = '1.000';
          } else {
            kappaStr = ((p_o - p_e) / (1 - p_e)).toFixed(3);
          }
        }
        setCalStats({ TP, TN, FP, FN, agreementRate, kappa: kappaStr, reviewedCount: reviewed });
      }
    } catch (err) {
      console.error('Error fetching calibration papers:', err);
    } finally {
      setCalLoading(false);
    }
  }, [calActivePool, calSearchTerm, calStatusFilter, calPdfFilter, calTagFilter, calSortBy, calSortOrder, calPage, calLimit]);

  // Fetch papers for pool assignment
  const loadAssignPapers = useCallback(async () => {
    setAssignLoading(true);
    try {
      const params = new URLSearchParams();
      if (assignSearch) params.append('search', assignSearch);
      
      if (assignPoolFilter === 'unassigned') {
        params.append('calibrationPool', 'none');
      } else if (assignPoolFilter && assignPoolFilter !== 'all') {
        params.append('calibrationPool', assignPoolFilter);
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
      console.error('Error loading papers for pool assignment:', err);
    } finally {
      setAssignLoading(false);
    }
  }, [assignSearch, assignPoolFilter, assignPage, assignLimit]);

  // Assign or unassign papers to pools
  const handleAssignPool = useCallback(async (paperId: string, pool: string | null, tag: string | null = null) => {
    try {
      const paperObj = papers.find(p => p.Paper_ID === paperId) || calPapers.find(p => p.Paper_ID === paperId) || assignPapers.find(p => p.Paper_ID === paperId);
      if (!paperObj) return;

      let nextPdfStatus = paperObj.Local_PDF_Status;
      if (pool === 'pool_b' || pool === 'pool_c') {
        if (paperObj.Local_PDF_Status === 'IGNORED' || !paperObj.Local_PDF_Status) {
          nextPdfStatus = 'MISSING';
        }
      }

      const res = await fetch(`/api/papers/${paperId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Title: paperObj.Title,
          calibration_pool: pool,
          calibration_tag: tag,
          Local_PDF_Status: nextPdfStatus
        })
      });

      if (res.ok) {
        showToast(`Paper successfully ${pool ? `assigned to ${pool.replace('_', ' ')}` : 'unassigned'}.`, 'success');
        
        await loadProjects();
        if (activeTab === 'pre-calibration') {
          await loadCalPapers();
        }
        if (showAssignModal) {
          await loadAssignPapers();
        }
        loadPapers();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to assign pool', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to assign pool', 'error');
    }
  }, [papers, calPapers, assignPapers, loadProjects, activeTab, loadCalPapers, showAssignModal, loadAssignPapers, loadPapers, showToast]);

  // Single paper PDF acquisition pipeline
  const runSinglePaperPipeline = useCallback(async (paperId: string) => {
    if (assignIsRunning) {
      showToast('A PDF acquisition process is already active.', 'warning');
      return;
    }

    setAssignIsRunning(true);
    setAssignLogs([]);
    setAssignProgress(0);
    setAssignStatusText('Starting single paper acquisition...');
    setAssignWaitingLogin(false);

    try {
      const abortController = new AbortController();
      singlePipelineAbortControllerRef.current = abortController;

      const res = await fetch('/api/pdf/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId }),
        signal: abortController.signal
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to run single paper matching/scraping', 'error');
        setAssignIsRunning(false);
        return;
      }

      if (!res.body) {
        showToast('Streaming response not available.', 'error');
        setAssignIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.event === 'log') {
              setAssignLogs(prev => [...prev, parsed.message]);
            } else if (parsed.event === 'step_start') {
              setAssignStatusText(parsed.message);
              if (parsed.step === 'scan') {
                setAssignProgress(15);
              } else if (parsed.step === 'scrape') {
                setAssignProgress(45);
              }
            } else if (parsed.event === 'step_complete') {
              setAssignStatusText(parsed.message);
            } else if (parsed.event === 'waiting_login') {
              setAssignWaitingLogin(true);
              setAssignStatusText(parsed.message);
            } else if (parsed.event === 'resume') {
              setAssignWaitingLogin(false);
            } else if (parsed.event === 'paper_success') {
              setAssignProgress(90);
              showToast('Paper PDF acquired successfully!', 'success');
            } else if (parsed.event === 'paper_fail') {
              setAssignProgress(100);
              showToast(`Scrape failed: ${parsed.error}`, 'error');
            } else if (parsed.event === 'complete') {
              setAssignProgress(100);
              setAssignStatusText(parsed.message);
              showToast(parsed.message, 'success');
            } else if (parsed.event === 'error') {
              setAssignProgress(100);
              setAssignStatusText(parsed.message);
              showToast(parsed.message, 'error');
            }
          } catch (e) {
            setAssignLogs(prev => [...prev, line]);
          }
        }
      }

      await loadProjects();
      if (activeTab === 'pre-calibration') {
        await loadCalPapers();
      }
      if (showAssignModal) {
        await loadAssignPapers();
      }
      loadPapers();

    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Pipeline cancelled by user.', 'info');
      } else {
        showToast(err.message || 'Error running pipeline', 'error');
      }
    } finally {
      setAssignIsRunning(false);
      singlePipelineAbortControllerRef.current = null;
    }
  }, [assignIsRunning, showToast, loadProjects, activeTab, loadCalPapers, showAssignModal, loadAssignPapers, loadPapers]);

  const handleCalSort = useCallback((field: string) => {
    if (calSortBy === field) {
      setCalSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCalSortBy(field);
      setCalSortOrder('asc');
    }
    setCalPage(1);
  }, [calSortBy]);

  // Trigger calibration papers load
  useEffect(() => {
    if (activeTab === 'pre-calibration') {
      loadCalPapers();
    }
  }, [calActivePool, calSearchTerm, calStatusFilter, calPdfFilter, calTagFilter, calSortBy, calSortOrder, calPage, calLimit, activeTab, loadCalPapers]);

  // Trigger assignment papers load
  useEffect(() => {
    if (showAssignModal) {
      loadAssignPapers();
    }
  }, [showAssignModal, assignSearch, assignPoolFilter, assignPage, assignLimit, loadAssignPapers]);

  // Reset calibration pagination when filter changes
  useEffect(() => {
    setCalPage(1);
  }, [calSearchTerm, calStatusFilter, calPdfFilter, calTagFilter, calActivePool]);

  // Reset assignment pagination when filter changes
  useEffect(() => {
    setAssignPage(1);
  }, [assignSearch, assignPoolFilter]);

  return {
    calActivePool, setCalActivePool,
    calPapers, setCalPapers,
    calTotalPapers, setCalTotalPapers,
    calPage, setCalPage,
    calLimit, setCalLimit,
    calTotalPages, setCalTotalPages,
    calStats, setCalStats,
    calSearchTerm, setCalSearchTerm,
    calStatusFilter, setCalStatusFilter,
    calPdfFilter, setCalPdfFilter,
    calTagFilter, setCalTagFilter,
    calSortBy, setCalSortBy,
    calSortOrder, setCalSortOrder,
    calLoading, setCalLoading,
    
    showAssignModal, setShowAssignModal,
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
    
    singlePipelineAbortControllerRef,
    loadCalPapers,
    loadAssignPapers,
    handleAssignPool,
    runSinglePaperPipeline,
    handleCalSort
  };
}