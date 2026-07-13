import { useState, useCallback, useRef, useEffect } from 'react';
import { Paper } from '@/types';
import { broadcastSync } from '@/lib/sync-utils';

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
  const [screeningPoolFilter, setScreeningPoolFilter] = useState('');
  const [screeningStageFilter, setScreeningStageFilter] = useState('');
  const [screeningDecisionFilter, setScreeningDecisionFilter] = useState('');
  const [screeningPublisherFilter, setScreeningPublisherFilter] = useState('');
  const [screeningSortBy, setScreeningSortBy] = useState('Paper_ID');
  const [screeningSortOrder, setScreeningSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [screeningSearchTime, setScreeningSearchTime] = useState<number | null>(null);

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

  // Setup form states when paper selection changes
  const lastLoadedPaperRef = useRef<Paper | null>(null);

  // Setup form states when paper selection changes
  useEffect(() => {
    if (screeningSelectedPaper) {
      const isNewPaper = !lastLoadedPaperRef.current || lastLoadedPaperRef.current.Paper_ID !== screeningSelectedPaper.Paper_ID;
      
      // Determine if the form fields in the database actually changed (e.g. from another tab sync)
      const dbValuesChanged = lastLoadedPaperRef.current && (
        lastLoadedPaperRef.current.manual_decision !== screeningSelectedPaper.manual_decision ||
        lastLoadedPaperRef.current.manual_ec_trigger !== screeningSelectedPaper.manual_ec_trigger ||
        lastLoadedPaperRef.current.manual_rationale !== screeningSelectedPaper.manual_rationale ||
        lastLoadedPaperRef.current.manual_stage !== screeningSelectedPaper.manual_stage ||
        JSON.stringify(lastLoadedPaperRef.current.manual_qa_scores) !== JSON.stringify(screeningSelectedPaper.manual_qa_scores) ||
        JSON.stringify(lastLoadedPaperRef.current.manual_extracted_data) !== JSON.stringify(screeningSelectedPaper.manual_extracted_data)
      );

      lastLoadedPaperRef.current = screeningSelectedPaper;

      if (isNewPaper || dbValuesChanged) {
        setManualDecision(screeningSelectedPaper.manual_decision || '');
        setManualEcTrigger(screeningSelectedPaper.manual_ec_trigger || '');
        setManualRationale(screeningSelectedPaper.manual_rationale || '');
        setManualStage(screeningSelectedPaper.manual_stage || 'fast_filter');
        
        // Safe parsing of JSON fields
        let parsedQa: Record<string, { value: number | null; evidence: string }> = {};
        if (screeningSelectedPaper.manual_qa_scores) {
          try {
            parsedQa = typeof screeningSelectedPaper.manual_qa_scores === 'string'
              ? JSON.parse(screeningSelectedPaper.manual_qa_scores)
              : screeningSelectedPaper.manual_qa_scores;
          } catch (e) {
            console.error("Failed to parse manual_qa_scores JSON", e);
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
    } else {
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
      if (updated && JSON.stringify(updated) !== JSON.stringify(screeningSelectedPaper)) {
        setScreeningSelectedPaper(updated);
      }
    }
  }, [screeningPapers, screeningSelectedPaper]);

  // Load normal paginated list
  const loadScreeningPapers = useCallback(async () => {
    if (screeningSearchMode === 'semantic') return; // Handled separately
    setScreeningLoading(true);
    try {
      const params = new URLSearchParams();
      if (screeningSearch) params.append('search', screeningSearch);
      if (screeningPoolFilter) params.append('calibrationPool', screeningPoolFilter);
      if (screeningStageFilter) params.append('manualStage', screeningStageFilter);
      if (screeningDecisionFilter) params.append('manualDecision', screeningDecisionFilter);
      if (screeningPublisherFilter) params.append('publisher', screeningPublisherFilter);
      
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
    screeningSearch, screeningPoolFilter, screeningStageFilter, 
    screeningDecisionFilter, screeningPublisherFilter, screeningSearchMode, showToast
  ]);

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
          pool: screeningPoolFilter || 'all',
          mode: 'papers',
          publisher: screeningPublisherFilter || 'all'
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
          results = results.filter((p: Paper) => 
            screeningStageFilter === 'none' 
              ? (!p.manual_stage || p.manual_stage === '') 
              : p.manual_stage === screeningStageFilter
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
  }, [screeningSearch, screeningPoolFilter, screeningPublisherFilter, screeningDecisionFilter, screeningStageFilter, showToast]);

  // Save manual screening decision
  const saveManualDecision = useCallback(async (paperId: string) => {
    setScreeningSaving(true);
    setScreeningError(null);
    try {
      const payload = {
        Title: screeningSelectedPaper?.Title, // Title is mandatory in PUT handler
        manual_decision: manualDecision || null,
        manual_ec_trigger: manualEcTrigger || null,
        manual_rationale: manualRationale || null,
        manual_stage: manualStage || null,
        manual_qa_scores: JSON.stringify(manualQaScores || {}),
        manual_extracted_data: JSON.stringify(manualExtractedData || {})
      };

      const res = await fetch(`/api/papers/${paperId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Screening decision saved successfully', 'success');
        
        // Update list inline to avoid total reload
        setScreeningPapers(prev => prev.map(p => 
          p.Paper_ID === paperId 
            ? { 
                ...p, 
                manual_decision: manualDecision || null,
                manual_ec_trigger: manualEcTrigger || null,
                manual_rationale: manualRationale || null,
                manual_stage: manualStage || null,
                manual_qa_scores: JSON.stringify(manualQaScores || {}),
                manual_extracted_data: JSON.stringify(manualExtractedData || {})
              } 
            : p
        ));

        // Sync selected paper object
        setScreeningSelectedPaper(prev => prev ? {
          ...prev,
          manual_decision: manualDecision || null,
          manual_ec_trigger: manualEcTrigger || null,
          manual_rationale: manualRationale || null,
          manual_stage: manualStage || null,
          manual_qa_scores: JSON.stringify(manualQaScores || {}),
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
        manual_ec_trigger: null,
        manual_rationale: null,
        manual_stage: null,
        manual_qa_scores: null,
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
                manual_ec_trigger: null,
                manual_rationale: null,
                manual_stage: null,
                manual_qa_scores: null,
                manual_extracted_data: null
              } 
            : p
        ));

        setScreeningSelectedPaper(prev => prev ? {
          ...prev,
          manual_decision: null,
          manual_ec_trigger: null,
          manual_rationale: null,
          manual_stage: null,
          manual_qa_scores: null,
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

  // Import decisions from calibration (Human_Decision)
  const importFromCalibration = useCallback((paper: Paper) => {
    if (!paper) return;
    const humanDec = (paper.Human_Decision || '').toUpperCase();
    setManualDecision(humanDec);
    setManualEcTrigger(paper.Human_EC_Trigger || '');
    setManualRationale(paper.Human_Rationale || '');
    
    // Assign appropriate stage based on pool type
    if (paper.calibration_pool === 'pool_c') {
      setManualStage('scientist');
    } else if (paper.calibration_pool === 'pool_b') {
      setManualStage('gatekeeper');
    } else {
      setManualStage('fast_filter');
    }

    // Copy QA Scores if available
    let parsedQa: Record<string, { value: number | null; evidence: string }> = {};
    if (paper.Human_QA_Scores) {
      try {
        parsedQa = typeof paper.Human_QA_Scores === 'string'
          ? JSON.parse(paper.Human_QA_Scores)
          : paper.Human_QA_Scores;
      } catch (e) {
        console.error(e);
      }
    }
    setManualQaScores(parsedQa);

    // Copy Extracted Data if available
    let parsedExt: Record<string, { value: string; evidence: string }> = {};
    if (paper.Human_Extracted_Data) {
      try {
        parsedExt = typeof paper.Human_Extracted_Data === 'string'
          ? JSON.parse(paper.Human_Extracted_Data)
          : paper.Human_Extracted_Data;
      } catch (e) {
        console.error(e);
      }
    }
    setManualExtractedData(parsedExt);
    
    showToast('Calibration review details pre-filled. Review and click save.', 'info');
  }, [showToast]);

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

  // Auto-reset pagination on filter edits
  useEffect(() => {
    setScreeningPage(1);
  }, [screeningSearch, screeningPoolFilter, screeningStageFilter, screeningDecisionFilter, screeningPublisherFilter]);

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
    screeningPoolFilter,
    setScreeningPoolFilter,
    screeningStageFilter,
    setScreeningStageFilter,
    screeningDecisionFilter,
    setScreeningDecisionFilter,
    screeningPublisherFilter,
    setScreeningPublisherFilter,
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
    importFromCalibration
  };
}
