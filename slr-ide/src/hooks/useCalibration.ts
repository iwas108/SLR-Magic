import { useState, useEffect, useRef, useCallback } from 'react';
import { useNdjsonStream } from './useNdjsonStream';
import { Paper } from '@/types';
import { calculateCohensKappa } from '@/lib/inter-rater/adjudication-calculations';
import { broadcastSync, subscribeSyncChannel } from '@/lib/sync-utils';

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
  const [debouncedKeywordSearch, setDebouncedKeywordSearch] = useState('');
  const [activeSemanticQuery, setActiveSemanticQuery] = useState('');
  const assignAbortControllerRef = useRef<AbortController | null>(null);

  const [assignPoolFilter, setAssignPoolFilter] = useState('all');
  const [assignSortBy, setAssignSortBy] = useState<string>('Paper_ID');
  const [assignSortOrder, setAssignSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [assignPapers, setAssignPapers] = useState<Paper[]>([]);
  const [assignSelectedPaper, setAssignSelectedPaper] = useState<Paper | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPage, setAssignPage] = useState(1);
  const [assignLimit, setAssignLimit] = useState(50);
  const [assignTotalPapers, setAssignTotalPapers] = useState(0);
  const [assignTotalPages, setAssignTotalPages] = useState(1);
  const [assignSearchMode, setAssignSearchMode] = useState<'keyword' | 'semantic'>('keyword');
  const [assignExcludeReviews, setAssignExcludeReviews] = useState(false);
  const [assignPublisherFilter, setAssignPublisherFilter] = useState('all');
  const [assignStageFilter, setAssignStageFilter] = useState('');
  const [assignDecisionFilter, setAssignDecisionFilter] = useState('');
  
  const [uniquePublishers, setUniquePublishers] = useState<string[]>([]);
  const [uniqueManualStages, setUniqueManualStages] = useState<string[]>([]);
  const [uniqueManualDecisions, setUniqueManualDecisions] = useState<string[]>([]);
  
  const [vectorIndexStatus, setVectorIndexStatus] = useState<{
    indexed: boolean;
    pdf_count: number;
    paper_count: number;
  } | null>(null);

  // Single paper crawler states (within assignment details pane)
  const [assignLogs, setAssignLogs] = useState<string[]>([]);
  const [assignIsRunning, setAssignIsRunning] = useState(false);
  const [assignStatusText, setAssignStatusText] = useState('Idle');
  const [assignProgress, setAssignProgress] = useState(0);
  const [assignWaitingLogin, setAssignWaitingLogin] = useState(false);
  const [assignSearchTime, setAssignSearchTime] = useState<number | null>(null);

  const { connect: connectNdjson, cancelStream: cancelSinglePipeline, abortControllerRef } = useNdjsonStream({
    onEvent: (parsed) => {
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
    },
    onComplete: async () => {
      if (assignSelectedPaper) {
        const paperId = assignSelectedPaper.Paper_ID;
        const paperRes = await fetch(`/api/papers/${paperId}`);
        if (paperRes.ok) {
          const updatedPaper = await paperRes.json();
          setAssignSelectedPaper(updatedPaper);
          setAssignPapers(prev => prev.map(p => p.Paper_ID === paperId ? { ...p, ...updatedPaper } : p));
          setCalPapers(prev => prev.map(p => p.Paper_ID === paperId ? { ...p, ...updatedPaper } : p));
        }

        await loadProjects();
        loadPapers();
      }
      setAssignIsRunning(false);
    },
    onError: (err) => {
      showToast(err.message || 'Failed to run single paper matching/scraping', 'error');
      setAssignIsRunning(false);
    }
  });

  // Debounce keyword search input
  useEffect(() => {
    if (assignSearchMode !== 'keyword') return;
    const timer = setTimeout(() => {
      setDebouncedKeywordSearch(assignSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [assignSearch, assignSearchMode]);

  // Reset active query and pagination when switching mode
  useEffect(() => {
    setAssignPage(1);
    if (assignSearchMode === 'keyword') {
      setDebouncedKeywordSearch(assignSearch);
    } else {
      setActiveSemanticQuery('');
    }
  }, [assignSearchMode]);

  // Abort on unmount or when modal is closed
  useEffect(() => {
    if (!showAssignModal && assignAbortControllerRef.current) {
      assignAbortControllerRef.current.abort();
      assignAbortControllerRef.current = null;
    }
  }, [showAssignModal]);

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

      // Fetch all active pool papers to compute consensus scorecard metrics (bypassing pagination)
      const statsRes = await fetch(`/api/papers?calibrationPool=${calActivePool}&limit=1000`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const poolPapers = statsData.papers || [];
        let TP = 0, TN = 0, FP = 0, FN = 0, reviewed = 0;
        for (const p of poolPapers) {
          const hDec = (p.Human_Decision || '').toUpperCase();
          const aiDec = (p.AI_Decision || '').toUpperCase();
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
          const kappaMetrics = calculateCohensKappa(totalReviewed, TP, TN, FP, FN);
          agreementRate = kappaMetrics.raw_agreement_pct;
          kappaStr = kappaMetrics.cohens_kappa.toFixed(3);
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
    if (assignAbortControllerRef.current) {
      assignAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    assignAbortControllerRef.current = controller;

    setAssignLoading(true);
    setAssignSearchTime(null);
    const startTime = Date.now();

    const currentQuery = assignSearchMode === 'semantic' ? activeSemanticQuery : debouncedKeywordSearch;

    try {
      if (assignSearchMode === 'semantic' && currentQuery.trim()) {
        const res = await fetch('/api/vectors/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            query: currentQuery,
            pool: assignPoolFilter,
            k: 200,
            mode: 'papers',
            excludeReviews: assignExcludeReviews,
            publisher: assignPublisherFilter
          })
        });

        if (res.ok) {
          const data = await res.json();
          let results = data.results || [];
          
          if (assignDecisionFilter) {
            results = results.filter((p: Paper) => 
              assignDecisionFilter === 'none' 
                ? (!p.manual_decision || p.manual_decision === '') 
                : p.manual_decision === assignDecisionFilter
            );
          }
          if (assignStageFilter) {
            const stageFilterMap: Record<string, number> = {
              'fast_filter': 1,
              'gatekeeper': 2,
              'scientist': 3,
              'miner': 4
            };
            results = results.filter((p: Paper) => 
              assignStageFilter === 'none' 
                ? (!p.manual_stage || p.manual_stage === 0) 
                : p.manual_stage === (stageFilterMap[assignStageFilter] || 0)
            );
          }
          
          // In-memory sorting for semantic results
          if (assignSortBy === 'Year') {
            results.sort((a: any, b: any) => {
              const yA = a.Year || 0;
              const yB = b.Year || 0;
              return assignSortOrder === 'DESC' ? yB - yA : yA - yB;
            });
          } else if (assignSortBy === 'citation_count') {
            results.sort((a: any, b: any) => {
              const cA = a.citation_count || 0;
              const cB = b.citation_count || 0;
              return assignSortOrder === 'DESC' ? cB - cA : cA - cB;
            });
          } else if (assignSortBy === 'semantic_score') {
            results.sort((a: any, b: any) => {
              const sA = a.semantic_score || 0;
              const sB = b.semantic_score || 0;
              return assignSortOrder === 'DESC' ? sB - sA : sA - sB;
            });
          } else {
            results.sort((a: any, b: any) => (b.semantic_score || 0) - (a.semantic_score || 0));
          }

          const total = results.length;
          const startIndex = (assignPage - 1) * assignLimit;
          const sliced = results.slice(startIndex, startIndex + assignLimit);

          setAssignPapers(sliced);
          setAssignTotalPapers(total);
          setAssignTotalPages(Math.ceil(total / assignLimit));
          setAssignSearchTime(Date.now() - startTime);
        } else {
          setAssignPapers([]);
          setAssignTotalPapers(0);
          setAssignTotalPages(1);
        }
      } else {
        const params = new URLSearchParams();
        if (currentQuery) params.append('search', currentQuery);
        
        if (assignPoolFilter === 'unassigned') {
          params.append('calibrationPool', 'none');
        } else if (assignPoolFilter && assignPoolFilter !== 'all') {
          params.append('calibrationPool', assignPoolFilter);
        }
        
        if (assignPublisherFilter && assignPublisherFilter !== 'all') {
          params.append('publisher', assignPublisherFilter);
        }

        if (assignStageFilter) {
          params.append('manualStage', assignStageFilter);
        }

        if (assignDecisionFilter) {
          params.append('manualDecision', assignDecisionFilter);
        }
        
        params.append('sortBy', assignSortBy);
        params.append('sortOrder', assignSortOrder);
        params.append('page', String(assignPage));
        params.append('limit', String(assignLimit));

        const res = await fetch(`/api/papers?${params.toString()}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          setAssignPapers(data.papers || []);
          setAssignTotalPapers(data.total || 0);
          setAssignTotalPages(data.totalPages || 1);
          setAssignSearchTime(Date.now() - startTime);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Expected cancellation, do not log or update loading state
      }
      console.error('Error loading papers for pool assignment:', err);
    } finally {
      if (assignAbortControllerRef.current === controller) {
        setAssignLoading(false);
      }
    }
  }, [assignSearchMode, activeSemanticQuery, debouncedKeywordSearch, assignPoolFilter, assignPage, assignLimit, assignSortBy, assignSortOrder, assignExcludeReviews, assignPublisherFilter]);

  const triggerSemanticSearch = useCallback(() => {
    setActiveSemanticQuery(assignSearch);
    setAssignPage(1);
  }, [assignSearch]);

  // Assign or unassign papers to pools
  const handleAssignPool = useCallback(async (paperId: string, pool: string | null, tag: string | null = null) => {
    try {
      const paperObj = (assignSelectedPaper?.Paper_ID === paperId ? assignSelectedPaper : null) ||
                       papers.find(p => p.Paper_ID === paperId) ||
                       calPapers.find(p => p.Paper_ID === paperId) ||
                       assignPapers.find(p => p.Paper_ID === paperId);
      if (!paperObj) return;

      let nextPdfStatus = paperObj.Local_PDF_Status;
      if (pool === 'pool_b' || pool === 'pool_c') {
        if (paperObj.Local_PDF_Status === 'IGNORED' || !paperObj.Local_PDF_Status) {
          nextPdfStatus = 'MISSING';
        }
      }

      if (nextPdfStatus !== paperObj.Local_PDF_Status) {
        await fetch(`/api/papers/${paperId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Title: paperObj.Title,
            Local_PDF_Status: nextPdfStatus
          })
        });
      }

      const res = await fetch('/api/calibration/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId,
          projectId: paperObj.Project_ID,
          calibration_pool: pool,
          calibration_tag: tag
        })
      });

      if (res.ok) {
        showToast(`Paper successfully ${pool ? `assigned to ${pool.replace('_', ' ')}` : 'unassigned'}.`, 'success');
        
        setAssignSelectedPaper(prev => {
          if (!prev || prev.Paper_ID !== paperId) return prev;
          return {
            ...prev,
            calibration_pool: pool,
            calibration_tag: tag,
            Local_PDF_Status: nextPdfStatus
          };
        });

        await loadProjects();
        if (activeTab === 'pre-calibration') {
          await loadCalPapers();
        }
        if (showAssignModal) {
          await loadAssignPapers();
        }
        loadPapers();
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to assign pool', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to assign pool', 'error');
    }
  }, [papers, calPapers, assignPapers, loadProjects, activeTab, loadCalPapers, showAssignModal, loadAssignPapers, loadPapers, showToast, assignSelectedPaper, setAssignSelectedPaper]);

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
      await connectNdjson('/api/pdf/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId })
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Pipeline cancelled by user.', 'info');
      } else {
        showToast(`Pipeline execution failed: ${err.message}`, 'error');
      }
      setAssignIsRunning(false);
    }
  }, [assignIsRunning, showToast, loadProjects, loadPapers, assignSelectedPaper, connectNdjson]);

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

  // Fetch vector status
  const loadVectorStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/vectors/status');
      if (res.ok) {
        const data = await res.json();
        setVectorIndexStatus(data);
      }
    } catch (err) {
      console.error('Error loading vector status:', err);
    }
  }, []);

  // Debounce keyword search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeywordSearch(assignSearch);
    }, 250);
    return () => clearTimeout(handler);
  }, [assignSearch]);

  // Trigger vector status check
  useEffect(() => {
    if (showAssignModal) {
      loadVectorStatus();
    }
  }, [showAssignModal, loadVectorStatus]);

  // Load unique publishers list on modal mount
  useEffect(() => {
    if (showAssignModal) {
      const fetchPublishers = async () => {
        try {
          const res = await fetch('/api/papers?getPublishers=true');
          if (res.ok) {
            const data = await res.json();
            setUniquePublishers(data || []);
          }
        } catch (err) {
          console.error('Failed to fetch publishers:', err);
        }
      };
      const fetchStages = async () => {
        try {
          const res = await fetch('/api/papers?getManualStages=true');
          if (res.ok) {
            const data = await res.json();
            setUniqueManualStages(data || []);
          }
        } catch (err) {}
      };
      const fetchDecisions = async () => {
        try {
          const res = await fetch('/api/papers?getManualDecisions=true');
          if (res.ok) {
            const data = await res.json();
            setUniqueManualDecisions(data || []);
          }
        } catch (err) {}
      };
      fetchPublishers();
      fetchStages();
      fetchDecisions();
    }
  }, [showAssignModal]);

  useEffect(() => {
    if (showAssignModal) {
      loadAssignPapers();
    }
  }, [showAssignModal, activeSemanticQuery, debouncedKeywordSearch, assignPoolFilter, assignPage, assignLimit, assignExcludeReviews, assignPublisherFilter, assignStageFilter, assignDecisionFilter, loadAssignPapers]);

  // Reset calibration pagination when filter changes
  useEffect(() => {
    setCalPage(1);
  }, [calSearchTerm, calStatusFilter, calPdfFilter, calTagFilter, calActivePool]);

  // Reset assignment pagination when filter changes
  useEffect(() => {
    setAssignPage(1);
  }, [activeSemanticQuery, debouncedKeywordSearch, assignPoolFilter, assignSearchMode, assignExcludeReviews, assignPublisherFilter]);

  const loadCalPapersRef = useRef(loadCalPapers);
  const loadAssignPapersRef = useRef(loadAssignPapers);
  const loadPapersRef = useRef(loadPapers);
  const loadProjectsRef = useRef(loadProjects);
  const loadVectorStatusRef = useRef(loadVectorStatus);

  useEffect(() => {
    loadCalPapersRef.current = loadCalPapers;
    loadAssignPapersRef.current = loadAssignPapers;
    loadPapersRef.current = loadPapers;
    loadProjectsRef.current = loadProjects;
    loadVectorStatusRef.current = loadVectorStatus;
  });

  const assignSelectedPaperRef = useRef(assignSelectedPaper);
  useEffect(() => {
    assignSelectedPaperRef.current = assignSelectedPaper;
  }, [assignSelectedPaper]);

  const rehydrateSelectedPaper = useCallback(async () => {
    const selected = assignSelectedPaperRef.current;
    if (!selected) return;
    try {
      const res = await fetch(`/api/papers/${selected.Paper_ID}`);
      if (res.ok) {
        const updated = await res.json();
        setAssignSelectedPaper(updated);
      }
    } catch (err) {
      console.error('Error rehydrating selected paper:', err);
    }
  }, [setAssignSelectedPaper]);

  const rehydrateSelectedPaperRef = useRef(rehydrateSelectedPaper);
  useEffect(() => {
    rehydrateSelectedPaperRef.current = rehydrateSelectedPaper;
  });

  useEffect(() => {
    const unsubscribe = subscribeSyncChannel((type) => {
      if (type === 'SYNC_PROJECTS') {
        loadProjectsRef.current();
      }
      if (type === 'SYNC_PAPERS') {
        loadPapersRef.current();
        if (activeTab === 'pre-calibration') {
          loadCalPapersRef.current();
        }
        if (showAssignModal) {
          loadAssignPapersRef.current();
          loadVectorStatusRef.current();
        }
        rehydrateSelectedPaperRef.current();
      }
    });
    return unsubscribe;
  }, [activeTab, showAssignModal]);

  // Reset sort column if switching search mode
  useEffect(() => {
    if (assignSearchMode !== 'semantic' && assignSortBy === 'semantic_score') {
      setAssignSortBy('Paper_ID');
      setAssignSortOrder('ASC');
    }
  }, [assignSearchMode, assignSortBy]);

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
    assignSearchMode, setAssignSearchMode,
    assignSortBy, setAssignSortBy,
    assignSortOrder, setAssignSortOrder,
    vectorIndexStatus, setVectorIndexStatus,
    assignSearchTime,
    assignExcludeReviews, setAssignExcludeReviews,
    assignStageFilter, setAssignStageFilter,
    assignDecisionFilter, setAssignDecisionFilter,
    assignPublisherFilter, setAssignPublisherFilter,
    uniquePublishers, setUniquePublishers,
    uniqueManualStages, setUniqueManualStages,
    uniqueManualDecisions, setUniqueManualDecisions,
    
    assignLogs, setAssignLogs,
    assignIsRunning, setAssignIsRunning,
    assignStatusText, setAssignStatusText,
    assignProgress, setAssignProgress,
    assignWaitingLogin, setAssignWaitingLogin,
    
    singlePipelineAbortControllerRef: abortControllerRef,
    loadCalPapers,
    loadAssignPapers,
    triggerSemanticSearch,
    handleAssignPool,
    runSinglePaperPipeline,
    handleCalSort,
    loadVectorStatus
  };
}