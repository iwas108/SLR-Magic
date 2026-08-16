import { useState, useCallback, useRef, useEffect } from 'react';
import { Paper } from '@/types';
import { broadcastSync, subscribeSyncChannel } from '@/lib/sync-utils';
import { useNdjsonStream } from './useNdjsonStream';

export function useManualScreening(
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void,
  activeProjectId?: string
) {
  // Papers list state
  const [screeningPapers, setScreeningPapers] = useState<Paper[]>([]);
  const [screeningLoading, setScreeningLoading] = useState(true);
  const [screeningTotal, setScreeningTotal] = useState(0);
  const [screeningPage, setScreeningPage] = useState(1);
  const [screeningTotalPages, setScreeningTotalPages] = useState(1);
  const [screeningLimit, setScreeningLimit] = useState(20);

  // Search & Filters state
  const [screeningSearch, setScreeningSearch] = useState('');
  const [screeningSearchMode, setScreeningSearchMode] = useState<'keyword' | 'semantic'>('keyword');
  const [screeningStageFilter, setScreeningStageFilter] = useState('');
  const [screeningDecisionFilter, setScreeningDecisionFilter] = useState('');
  
  // Paper Database Table Filters Parity
  const [pdfFilter, setPdfFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [doiStatusFilter, setDoiStatusFilter] = useState('');
  const [pdfLinkFilter, setPdfLinkFilter] = useState('');
  const [pipelineStageFilter, setPipelineStageFilter] = useState('');
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState('');
  const [ecTriggerFilter, setEcTriggerFilter] = useState('');
  const [ecTriggers, setEcTriggers] = useState<string[]>([]);
  const [loadingEcTriggers, setLoadingEcTriggers] = useState(false);

  const [screeningSortBy, setScreeningSortBy] = useState('Paper_ID');
  const [screeningSortOrder, setScreeningSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [screeningSearchTime, setScreeningSearchTime] = useState<number | null>(null);

  const [vectorIndexStatus, setVectorIndexStatus] = useState<{
    indexed: boolean;
    pdf_count: number;
    paper_count: number;
    project_id?: string;
    total_project_papers?: number;
    indexed_project_papers?: number;
    missing_project_papers?: number;
    coverage_pct?: number;
    model?: string;
  } | null>(null);

  const loadVectorStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/vectors/status${activeProjectId ? `?projectId=${encodeURIComponent(activeProjectId)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setVectorIndexStatus(data);
      }
    } catch (err) {
      console.error('Failed to load vector status in manual screening:', err);
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadVectorStatus();
  }, [loadVectorStatus]);


  // Fetch EC triggers when pipelineStageFilter changes
  useEffect(() => {
    const fetchEcTriggers = async () => {
      setLoadingEcTriggers(true);
      try {
        const res = await fetch(`/api/papers?getEcTriggers=true&pipelineStage=${pipelineStageFilter}${activeProjectId ? `&projectId=${encodeURIComponent(activeProjectId)}` : ''}`);
        if (res.ok) {
          const data = await res.json();
          setEcTriggers(data || []);
        }
      } catch (err) {
        console.error('Failed to load EC triggers:', err);
      } finally {
        setLoadingEcTriggers(false);
      }
    };
    fetchEcTriggers();
  }, [pipelineStageFilter, activeProjectId]);
  
  // Project-wide stats state
  const [screeningStats, setScreeningStats] = useState<{
    total: number;
    screened: number;
    pending: number;
    stageCounts: Record<string, number>;
    decisionCounts: Record<string, number>;
  }>({
    total: 0,
    screened: 0,
    pending: 0,
    stageCounts: {},
    decisionCounts: {}
  });

  // Selected paper state
  const [screeningSelectedPaper, setScreeningSelectedPaper] = useState<Paper | null>(null);

  // Form editing states
  const [manualDecision, setManualDecision] = useState<string>('');
  const [manualEcTrigger, setManualEcTrigger] = useState<string>('');
  const [manualRationale, setManualRationale] = useState<string>('');
  const [manualStage, setManualStage] = useState<string>('fast_filter');
  const [manualQaScores, setManualQaScores] = useState<Record<string, { value: number | null; evidence: string }>>({});
  const [manualExtractedData, setManualExtractedData] = useState<Record<string, { value: string; evidence: string }>>({});
  
  const [screeningSaving, setScreeningSaving] = useState(false);
  const [screeningError, setScreeningError] = useState<string | null>(null);

  // Single PDF Acquisition Stream State
  const [manualPdfLogs, setManualPdfLogs] = useState<any[]>([]);
  const [manualPdfIsRunning, setManualPdfIsRunning] = useState(false);
  const [manualPdfStatusText, setManualPdfStatusText] = useState('');
  const [manualPdfProgress, setManualPdfProgress] = useState(0);
  const [manualPdfWaitingLogin, setManualPdfWaitingLogin] = useState(false);
  const currentRunningPaperIdRef = useRef<string | null>(null);

  const { connect: connectNdjson, cancelStream: cancelSinglePaperPipeline, abortControllerRef: singlePipelineAbortControllerRef } = useNdjsonStream({
    onEvent: (parsed) => {
      if (parsed.event === 'log') {
        setManualPdfLogs(prev => [...prev, parsed.message]);
      } else if (parsed.event === 'step_start') {
        setManualPdfStatusText(parsed.message);
        if (parsed.step === 'scan') {
          setManualPdfProgress(15);
        } else if (parsed.step === 'scrape') {
          setManualPdfProgress(45);
        }
      } else if (parsed.event === 'step_complete') {
        setManualPdfStatusText(parsed.message);
      } else if (parsed.event === 'waiting_login') {
        setManualPdfWaitingLogin(true);
        setManualPdfStatusText(parsed.message);
      } else if (parsed.event === 'resume') {
        setManualPdfWaitingLogin(false);
      } else if (parsed.event === 'paper_success') {
        setManualPdfProgress(90);
        showToast('Paper PDF acquired successfully!', 'success');
      } else if (parsed.event === 'paper_fail') {
        setManualPdfProgress(100);
        showToast(`Scrape failed: ${parsed.error}`, 'error');
      } else if (parsed.event === 'complete') {
        setManualPdfProgress(100);
        setManualPdfStatusText(parsed.message);
        showToast(parsed.message, 'success');
      } else if (parsed.event === 'error') {
        setManualPdfProgress(100);
        setManualPdfStatusText(parsed.message);
        showToast(parsed.message, 'error');
      }
    },
    onComplete: async () => {
      const targetPaperId = currentRunningPaperIdRef.current || screeningSelectedPaper?.Paper_ID;
      if (targetPaperId) {
        try {
          const paperRes = await fetch(`/api/papers/${encodeURIComponent(targetPaperId)}`);
          if (paperRes.ok) {
            const updatedPaper = await paperRes.json();
            setScreeningSelectedPaper(updatedPaper);
            setScreeningPapers(prev => prev.map(p => p.Paper_ID === targetPaperId ? { ...p, ...updatedPaper } : p));
          }
        } catch (e) {
          console.error('Failed to re-fetch paper in manual screening:', e);
        }
        loadScreeningStats();
        broadcastSync('SYNC_PAPERS');
        broadcastSync('SYNC_PROJECTS');
      }
      setManualPdfIsRunning(false);
      setManualPdfWaitingLogin(false);
    },
    onError: (err) => {
      showToast(`Pipeline execution failed: ${err.message}`, 'error');
      setManualPdfIsRunning(false);
      setManualPdfWaitingLogin(false);
    }
  });

  const runSinglePaperPipeline = useCallback(async (paperId: string) => {
    if (manualPdfIsRunning) {
      showToast('A PDF acquisition process is already active.', 'warning');
      return;
    }

    currentRunningPaperIdRef.current = paperId;
    setManualPdfIsRunning(true);
    setManualPdfLogs([]);
    setManualPdfProgress(0);
    setManualPdfStatusText('Starting single paper acquisition...');
    setManualPdfWaitingLogin(false);

    try {
      await connectNdjson('/api/pdf/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId, projectId: activeProjectId || screeningSelectedPaper?.Project_ID || '' })
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        showToast('Pipeline cancelled by user.', 'info');
      } else {
        showToast(`Pipeline execution failed: ${err.message}`, 'error');
      }
      setManualPdfIsRunning(false);
    }
  }, [manualPdfIsRunning, showToast, connectNdjson, activeProjectId, screeningSelectedPaper]);

  // Setup form states when paper selection changes
  const lastLoadedPaperRef = useRef<Paper | null>(null);

  // Setup form states when paper selection changes
  useEffect(() => {
    if (screeningSelectedPaper) {
      const isNewPaper = !lastLoadedPaperRef.current || lastLoadedPaperRef.current.Paper_ID !== screeningSelectedPaper.Paper_ID;
      
      // Determine if the form fields in the database actually changed (e.g. from another tab sync)
      const dbValuesChanged = lastLoadedPaperRef.current && (
        lastLoadedPaperRef.current.manual_decision !== screeningSelectedPaper.manual_decision ||
        lastLoadedPaperRef.current.manual_rationale !== screeningSelectedPaper.manual_rationale ||
        lastLoadedPaperRef.current.manual_stage !== screeningSelectedPaper.manual_stage ||
        JSON.stringify(lastLoadedPaperRef.current.manual_quality_assessment) !== JSON.stringify(screeningSelectedPaper.manual_quality_assessment) ||
        JSON.stringify(lastLoadedPaperRef.current.manual_extracted_data) !== JSON.stringify(screeningSelectedPaper.manual_extracted_data)
      );

      lastLoadedPaperRef.current = screeningSelectedPaper;

      if (isNewPaper || dbValuesChanged) {
        setManualDecision(screeningSelectedPaper.manual_decision || '');
        setManualEcTrigger(screeningSelectedPaper.manual_exclusion_code || '');
        setManualRationale(screeningSelectedPaper.manual_rationale || '');
        
        const numToStageMap: Record<number, string> = {
          0: 'unscreened',
          1: 'fast_filter',
          2: 'gatekeeper',
          3: 'scientist',
          4: 'miner'
        };
        setManualStage(numToStageMap[screeningSelectedPaper.manual_stage || 0] || 'fast_filter');
        
        // Safe parsing of JSON fields
        let parsedQa: Record<string, { value: number | null; evidence: string }> = {};
        const qaField = screeningSelectedPaper.manual_quality_assessment;
        if (qaField) {
          try {
            parsedQa = typeof qaField === 'string'
              ? JSON.parse(qaField)
              : qaField;
          } catch (e) {
            console.error("Failed to parse manual_quality_assessment JSON", e);
          }
        }
        setManualQaScores(parsedQa);

        let parsedExt: Record<string, { value: string; evidence: string }> = {};
        if (screeningSelectedPaper.manual_extracted_data) {
          try {
            parsedExt = typeof screeningSelectedPaper.manual_extracted_data === 'string'
              ? JSON.parse(screeningSelectedPaper.manual_extracted_data)
              : screeningSelectedPaper.manual_extracted_data;
          } catch (e) {
            console.error("Failed to parse manual_extracted_data JSON", e);
          }
        }
        setManualExtractedData(parsedExt);

        if (dbValuesChanged && !isNewPaper) {
          showToast('Screening data was updated in another session. Form refreshed.', 'info');
        }
      }
    } else if (!screeningSelectedPaper) {
      lastLoadedPaperRef.current = null;
      setManualDecision('');
      setManualEcTrigger('');
      setManualRationale('');
      setManualStage('fast_filter');
      setManualQaScores({});
      setManualExtractedData({});
    }
  }, [screeningSelectedPaper, showToast]);

  // Active State Rehydration: Sync selected paper with list updates (e.g. PDF path / status changes in background)
  useEffect(() => {
    if (screeningSelectedPaper && screeningPapers.length > 0) {
      const updated = screeningPapers.find(p => p.Paper_ID === screeningSelectedPaper.Paper_ID);
      if (updated) {
        // Guard: Don't downgrade if active selection has newly acquired PDF
        const activeHasPdf = !!screeningSelectedPaper.Local_PDF_Path && screeningSelectedPaper.Local_PDF_Status !== 'MISSING';
        const listHasNoPdf = !updated.Local_PDF_Path || updated.Local_PDF_Status === 'MISSING';
        if (activeHasPdf && listHasNoPdf) {
          return;
        }
        if (JSON.stringify(updated) !== JSON.stringify(screeningSelectedPaper)) {
          setScreeningSelectedPaper(updated);
        }
      }
    }
  }, [screeningPapers, screeningSelectedPaper]);

  // Load project stats
  const loadScreeningStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/papers/manual-screening?getStats=true${activeProjectId ? `&projectId=${encodeURIComponent(activeProjectId)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setScreeningStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch screening statistics', err);
    }
  }, [activeProjectId]);

  // Load stats on project selection or change
  useEffect(() => {
    loadScreeningStats();
  }, [activeProjectId, loadScreeningStats]);

  // Load normal paginated list
  const loadScreeningPapers = useCallback(async () => {
    if (screeningSearchMode === 'semantic') return; // Handled separately
    setScreeningLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeProjectId) params.append('projectId', activeProjectId);
      if (screeningSearch) params.append('search', screeningSearch);
      if (screeningStageFilter) params.append('manualStage', screeningStageFilter);
      if (screeningDecisionFilter) params.append('manualDecision', screeningDecisionFilter);
      if (pdfFilter) params.append('pdfStatus', pdfFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (doiStatusFilter) params.append('doiStatus', doiStatusFilter);
      if (pdfLinkFilter) params.append('pdfLink', pdfLinkFilter);
      if (pipelineStageFilter) params.append('pipelineStage', pipelineStageFilter);
      if (pipelineStatusFilter) params.append('pipelineStatus', pipelineStatusFilter);
      if (ecTriggerFilter) params.append('ecTrigger', ecTriggerFilter);
      
      params.append('sortBy', screeningSortBy);
      params.append('sortOrder', screeningSortOrder);
      params.append('page', String(screeningPage));
      params.append('limit', String(screeningLimit));

      const res = await fetch(`/api/papers/manual-screening?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setScreeningPapers(data.papers || []);
        setScreeningTotal(data.total || 0);
        setScreeningTotalPages(data.totalPages || 1);
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to load screening papers', 'error');
      }
    } catch (err: any) {
      showToast(`Error loading papers: ${err.message || err}`, 'error');
    } finally {
      setScreeningLoading(false);
    }
  }, [
    screeningPage, screeningLimit, screeningSortBy, screeningSortOrder, 
    screeningSearch, screeningStageFilter, screeningDecisionFilter,
    pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter,
    pipelineStageFilter, pipelineStatusFilter, ecTriggerFilter,
    screeningSearchMode, showToast, activeProjectId
  ]);

  // Multi-tab sync subscription per agents.md §3.3
  useEffect(() => {
    const unsub = subscribeSyncChannel((syncType) => {
      if (syncType === 'SYNC_PAPERS' || syncType === 'SYNC_PROJECTS') {
        loadScreeningPapers();
        loadScreeningStats();
      }
    });
    return unsub;
  }, [loadScreeningPapers, loadScreeningStats]);

  // Trigger semantic (vector) search
  const triggerSemanticSearch = useCallback(async () => {
    if (!screeningSearch || !screeningSearch.trim()) {
      showToast('Please enter a query for semantic search', 'warning');
      return;
    }
    setScreeningLoading(true);
    const startTime = performance.now();
    try {
      const res = await fetch('/api/vectors/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: screeningSearch,
          k: 100, // retrieve more to allow frontend pagination/filtering
          pool: 'all',
          mode: 'papers',
          publisher: 'all'
        })
      });

      if (res.ok) {
        const data = await res.json();
        let results = data.results || [];
        
        // Frontend post-filtering for manual screen decision and stage since turbovec only handles pool/publisher
        if (screeningDecisionFilter) {
          results = results.filter((p: Paper) => 
            screeningDecisionFilter === 'none' 
              ? (!p.manual_decision || p.manual_decision === '') 
              : p.manual_decision === screeningDecisionFilter
          );
        }
        if (screeningStageFilter) {
          const stageFilterMap: Record<string, number> = {
            'fast_filter': 1,
            'gatekeeper': 2,
            'scientist': 3,
            'miner': 4
          };
          results = results.filter((p: Paper) => 
            screeningStageFilter === 'none' 
              ? (!p.manual_stage || p.manual_stage === 0) 
              : p.manual_stage === (stageFilterMap[screeningStageFilter] || 0)
          );
        }
        if (pdfFilter) {
          results = results.filter((p: Paper) => p.Local_PDF_Status === pdfFilter);
        }
        if (sourceFilter) {
          results = results.filter((p: Paper) => {
            if (sourceFilter === 'manual') {
              return p.Import_Source === 'Manual Search' || p.Import_Source === 'Manual Ingestion';
            } else if (sourceFilter === 'backward') {
              return p.Import_Source === 'Backward Snowball';
            } else if (sourceFilter === 'forward') {
              return p.Import_Source === 'Forward Snowball';
            } else if (sourceFilter === 'csv') {
              return !['Manual Search', 'Manual Ingestion', 'Backward Snowball', 'Forward Snowball'].includes(p.Import_Source || '');
            }
            return true;
          });
        }
        if (doiStatusFilter) {
          results = results.filter((p: Paper) => 
            doiStatusFilter === 'empty' ? (!p.DOI || p.DOI.trim() === '') : (p.DOI && p.DOI.trim() !== '')
          );
        }
        if (pdfLinkFilter) {
          results = results.filter((p: Paper) => 
            pdfLinkFilter === 'empty' ? (!p.PDF_Link || p.PDF_Link.trim() === '') : (p.PDF_Link && p.PDF_Link.trim() !== '')
          );
        }

        setScreeningPapers(results);
        setScreeningTotal(results.length);
        setScreeningTotalPages(1);
        setScreeningPage(1);
        setScreeningSearchTime(Math.round(performance.now() - startTime));
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to execute semantic search', 'error');
      }
    } catch (err: any) {
      showToast(`Semantic search failed: ${err.message || err}`, 'error');
    } finally {
      setScreeningLoading(false);
    }
  }, [
    screeningSearch, screeningDecisionFilter, screeningStageFilter,
    pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, showToast
  ]);

  // Save manual screening decision
  const saveManualDecision = useCallback(async (paperId: string) => {
    setScreeningSaving(true);
    setScreeningError(null);
    try {
      const payload = {
        Title: screeningSelectedPaper?.Title,
        manual_decision: manualDecision || null,
        manual_exclusion_code: manualDecision === 'EXCLUDE' ? (manualEcTrigger || null) : null,
        manual_rationale: manualRationale || null,
        manual_stage: manualStage || null,
        manual_quality_assessment: JSON.stringify(manualQaScores || {}),
        manual_extracted_data: JSON.stringify(manualExtractedData || {})
      };

      const res = await fetch(`/api/papers/${paperId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Screening decision saved successfully', 'success');
        
        const stageMap: Record<string, number> = {
          'unscreened': 0,
          'fast_filter': 1,
          'gatekeeper': 2,
          'scientist': 3,
          'miner': 4
        };
        const numStage = stageMap[manualStage] || 0;

        // Update list inline to avoid total reload
        setScreeningPapers(prev => prev.map(p => 
          p.Paper_ID === paperId 
            ? { 
                ...p, 
                manual_decision: manualDecision || null,
                manual_exclusion_code: manualDecision === 'EXCLUDE' ? (manualEcTrigger || null) : null,
                manual_rationale: manualRationale || null,
                manual_stage: numStage,
                manual_quality_assessment: JSON.stringify(manualQaScores || {}),
                manual_extracted_data: JSON.stringify(manualExtractedData || {})
              } 
            : p
        ));

        // Sync selected paper object
        setScreeningSelectedPaper(prev => prev ? {
          ...prev,
          manual_decision: manualDecision || null,
          manual_exclusion_code: manualDecision === 'EXCLUDE' ? (manualEcTrigger || null) : null,
          manual_rationale: manualRationale || null,
          manual_stage: numStage,
          manual_quality_assessment: JSON.stringify(manualQaScores || {}),
          manual_extracted_data: JSON.stringify(manualExtractedData || {})
        } : null);

        broadcastSync('SYNC_PAPERS');
      } else {
        const errData = await res.json();
        const msg = errData.error || 'Failed to save screening decision';
        setScreeningError(msg);
        showToast(msg, 'error');
      }
    } catch (err: any) {
      setScreeningError(err.message || err);
      showToast(`Error: ${err.message || err}`, 'error');
    } finally {
      setScreeningSaving(false);
    }
  }, [screeningSelectedPaper, manualDecision, manualEcTrigger, manualRationale, manualStage, manualQaScores, manualExtractedData, showToast]);

  // Clear manual screening decision
  const clearManualDecision = useCallback(async (paperId: string) => {
    setScreeningSaving(true);
    setScreeningError(null);
    try {
      const payload = {
        Title: screeningSelectedPaper?.Title,
        manual_decision: null,
        manual_exclusion_code: null,
        manual_rationale: null,
        manual_stage: null,
        manual_quality_assessment: null,
        manual_extracted_data: null
      };

      const res = await fetch(`/api/papers/${paperId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Screening decision cleared', 'info');
        
        // Reset states
        setManualDecision('');
        setManualEcTrigger('');
        setManualRationale('');
        setManualStage('fast_filter');
        setManualQaScores({});
        setManualExtractedData({});

        setScreeningPapers(prev => prev.map(p => 
          p.Paper_ID === paperId 
            ? { 
                ...p, 
                manual_decision: null,
                manual_exclusion_code: null,
                manual_rationale: null,
                manual_stage: 0,
                manual_quality_assessment: null,
                manual_extracted_data: null
              } 
            : p
        ));

        setScreeningSelectedPaper(prev => prev ? {
          ...prev,
          manual_decision: null,
          manual_exclusion_code: null,
          manual_rationale: null,
          manual_stage: 0,
          manual_quality_assessment: null,
          manual_extracted_data: null
        } : null);

        broadcastSync('SYNC_PAPERS');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to clear decision', 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message || err}`, 'error');
    } finally {
      setScreeningSaving(false);
    }
  }, [screeningSelectedPaper, showToast]);

  // Ref callbacks for preventing stale closures on app sync notifications (Rule 3.3)
  const loadPapersRef = useRef(loadScreeningPapers);
  useEffect(() => {
    loadPapersRef.current = loadScreeningPapers;
  }, [loadScreeningPapers]);

  // Load effect
  useEffect(() => {
    if (screeningSearchMode === 'keyword') {
      loadScreeningPapers();
    }
  }, [loadScreeningPapers, screeningSearchMode]);

  const clearAllFilters = useCallback(() => {
    setScreeningStageFilter('');
    setScreeningDecisionFilter('');
    setPdfFilter('');
    setSourceFilter('');
    setDoiStatusFilter('');
    setPdfLinkFilter('');
    setPipelineStageFilter('');
    setPipelineStatusFilter('');
    setEcTriggerFilter('');
  }, []);

  // Auto-reset pagination on filter edits
  useEffect(() => {
    setScreeningPage(1);
  }, [
    screeningSearch, screeningStageFilter, screeningDecisionFilter,
    pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter,
    pipelineStageFilter, pipelineStatusFilter, ecTriggerFilter
  ]);

  return {
    screeningPapers,
    screeningLoading,
    screeningTotal,
    screeningPage,
    setScreeningPage,
    screeningTotalPages,
    screeningLimit,
    setScreeningLimit,
    screeningSearch,
    setScreeningSearch,
    screeningSearchMode,
    setScreeningSearchMode,
    screeningStageFilter,
    setScreeningStageFilter,
    screeningDecisionFilter,
    setScreeningDecisionFilter,
    pdfFilter, setPdfFilter,
    sourceFilter, setSourceFilter,
    doiStatusFilter, setDoiStatusFilter,
    pdfLinkFilter, setPdfLinkFilter,
    pipelineStageFilter, setPipelineStageFilter,
    pipelineStatusFilter, setPipelineStatusFilter,
    ecTriggerFilter, setEcTriggerFilter,
    ecTriggers, loadingEcTriggers,
    clearAllFilters,
    screeningStats,
    loadScreeningStats,
    screeningSortBy,
    setScreeningSortBy,
    screeningSortOrder,
    setScreeningSortOrder,
    screeningSearchTime,
    screeningSelectedPaper,
    setScreeningSelectedPaper,
    manualDecision,
    setManualDecision,
    manualEcTrigger,
    setManualEcTrigger,
    manualRationale,
    setManualRationale,
    manualStage,
    setManualStage,
    manualQaScores,
    setManualQaScores,
    manualExtractedData,
    setManualExtractedData,
    screeningSaving,
    screeningError,
    loadScreeningPapers,
    triggerSemanticSearch,
    saveManualDecision,
    clearManualDecision,
    manualPdfLogs,
    manualPdfIsRunning,
    manualPdfStatusText,
    manualPdfProgress,
    manualPdfWaitingLogin,
    runSinglePaperPipeline,
    cancelSinglePaperPipeline,
    singlePipelineAbortControllerRef,
    vectorIndexStatus,
    loadVectorStatus
  };
}
