'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface MockupCacheInfo {
  cached: boolean;
  cache_id: number | null;
  reviewer_name: string | null;
  total_papers: number;
  total_cost_usd: number;
  total_tokens: number;
  model_id: string | null;
  paper_results: any[] | null;
  failed_count?: number;
  succeeded_count?: number;
  has_failures?: boolean;
  missing_pdf_count?: number;
  has_missing_pdfs?: boolean;
  prompt_hash: string | null;
  prompt_changed: boolean;
  created_at: string | null;
  updated_at?: string | null;
  occupied_slots: number;
  papers_count: number;
  papers_preview: any[];
}

export interface MockupProgressState {
  isRunning: boolean;
  current: number;
  total: number;
  paperId: string;
  paperTitle: string;
  decision: string;
  costSoFar: number;
  tokensSoFar: number;
  error: string | null;
  isPartialRetry?: boolean;
}

export function generateRandomReviewerName(): string {
  const randHex = Math.floor(0x1000 + Math.random() * 0xf000).toString(16);
  return `rev_${randHex}`;
}

export function isMockupResultFailed(res: any, pool?: string): boolean {
  if (!res || typeof res !== 'object') return true;
  if (res.error && String(res.error).trim().length > 0) return true;
  if (res.exclusion_code === 'ERROR') return true;
  if (res.decision === 'ERROR') return true;
  if (res.rationale && typeof res.rationale === 'string') {
    if (
      res.rationale.startsWith('LLM Call Failed') ||
      res.rationale.includes('LLM Call Failed') ||
      res.rationale.includes('Request timed out') ||
      res.rationale.includes('Missing local full-text PDF')
    ) {
      return true;
    }
  }
  return false;
}

export function useMockupReview(
  projectId: string,
  initialPool: 'pool_a' | 'pool_b' | 'pool_c' = 'pool_a',
  showToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void
) {
  const [selectedPool, setSelectedPool] = useState<'pool_a' | 'pool_b' | 'pool_c'>(initialPool);
  const [reviewerName, setReviewerName] = useState<string>(() => generateRandomReviewerName());
  const [loadingCache, setLoadingCache] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<MockupCacheInfo | null>(null);
  
  const [progressState, setProgressState] = useState<MockupProgressState>({
    isRunning: false,
    current: 0,
    total: 0,
    paperId: '',
    paperTitle: '',
    decision: '',
    costSoFar: 0,
    tokensSoFar: 0,
    error: null,
    isPartialRetry: false
  });

  const [liveResults, setLiveResults] = useState<any[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);

  // Keep ref for active project ID to prevent stale closure during stream
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // Fetch cache info and paper previews
  const fetchCacheInfo = useCallback(async (poolToFetch = selectedPool) => {
    if (!projectIdRef.current) return;
    setLoadingCache(true);
    try {
      const res = await fetch(`/api/mockup/generate?projectId=${encodeURIComponent(projectIdRef.current)}&pool=${poolToFetch}`);
      if (!res.ok) {
        throw new Error('Failed to fetch mockup cache status');
      }
      const data = await res.json();
      setCacheInfo(data);
      if (data.reviewer_name) {
        setReviewerName(data.reviewer_name);
      }
      if (data.paper_results && Array.isArray(data.paper_results)) {
        setLiveResults(data.paper_results);
      } else {
        setLiveResults([]);
      }
    } catch (err: any) {
      console.error('Error loading mockup cache status:', err);
    } finally {
      setLoadingCache(false);
    }
  }, [selectedPool]);

  // Sync on mount or pool switch
  useEffect(() => {
    fetchCacheInfo(selectedPool);
  }, [selectedPool, fetchCacheInfo]);

  // Sync with parent active pool tab when changed
  useEffect(() => {
    if (initialPool) {
      setSelectedPool(initialPool);
    }
  }, [initialPool]);

  const handlePoolChange = (newPool: 'pool_a' | 'pool_b' | 'pool_c') => {
    setSelectedPool(newPool);
    setSelectedPaperIds([]);
    setReviewerName(generateRandomReviewerName());
    setProgressState(prev => ({ ...prev, isRunning: false, current: 0, total: 0, costSoFar: 0, error: null, isPartialRetry: false }));
  };

  const handleRegenerateName = () => {
    setReviewerName(generateRandomReviewerName());
  };

  // Selection handlers
  const togglePaperSelection = useCallback((paperId: string) => {
    setSelectedPaperIds(prev =>
      prev.includes(paperId) ? prev.filter(id => id !== paperId) : [...prev, paperId]
    );
  }, []);

  const selectAllPapers = useCallback(() => {
    const allIds = (cacheInfo?.papers_preview || []).map((p: any) => String(p.Paper_ID));
    setSelectedPaperIds(allIds);
  }, [cacheInfo?.papers_preview]);

  const deselectAllPapers = useCallback(() => {
    setSelectedPaperIds([]);
  }, []);

  const selectFailedPapers = useCallback(() => {
    const failedIds = liveResults
      .filter(r => isMockupResultFailed(r, selectedPool))
      .map(r => String(r.paper_id));
    setSelectedPaperIds(failedIds);
  }, [liveResults, selectedPool]);

  const selectSucceededPapers = useCallback(() => {
    const succeededIds = liveResults
      .filter(r => !isMockupResultFailed(r, selectedPool))
      .map(r => String(r.paper_id));
    setSelectedPaperIds(succeededIds);
  }, [liveResults, selectedPool]);

  const isPaperSelected = useCallback((paperId: string) => {
    return selectedPaperIds.includes(paperId);
  }, [selectedPaperIds]);

  // Shared SSE generator execution handler
  const executeGeneration = async (options: { failedOnly?: boolean; paperIds?: string[] } = {}) => {
    if (!projectIdRef.current) {
      showToast?.('No active project selected.', 'error');
      return;
    }

    const effectiveReviewer = (cacheInfo?.reviewer_name || reviewerName).trim();
    if (!effectiveReviewer) {
      showToast?.('Please specify a valid Reviewer Name.', 'warning');
      return;
    }

    const isPartial = Boolean(options.failedOnly || (options.paperIds && options.paperIds.length > 0));
    
    // Estimate total items to process
    let totalToProcess = cacheInfo?.papers_count || 0;
    if (options.failedOnly) {
      totalToProcess = liveResults.filter(r => isMockupResultFailed(r, selectedPool)).length || 1;
    } else if (options.paperIds) {
      totalToProcess = options.paperIds.length;
    }

    const startTitle = isPartial
      ? (options.paperIds ? `Targeting ${options.paperIds.length} selected paper(s) for rerun...` : 'Targeting failed executions for partial rerun...')
      : 'Initializing Gemini pipeline...';

    setProgressState({
      isRunning: true,
      current: 0,
      total: totalToProcess,
      paperId: '',
      paperTitle: startTitle,
      decision: '',
      costSoFar: isPartial ? (cacheInfo?.total_cost_usd || 0) : 0,
      tokensSoFar: isPartial ? (cacheInfo?.total_tokens || 0) : 0,
      error: null,
      isPartialRetry: isPartial
    });

    if (!isPartial) {
      setLiveResults([]);
    }

    try {
      const res = await fetch('/api/mockup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectIdRef.current,
          pool: selectedPool,
          reviewerName: effectiveReviewer,
          failedOnly: options.failedOnly,
          paperIds: options.paperIds
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${res.status})`);
      }

      if (!res.body) {
        throw new Error('ReadableStream not supported by response');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(trimmed.slice(6));
              
              if (eventData.type === 'progress') {
                setProgressState(prev => ({
                  ...prev,
                  current: eventData.current,
                  total: eventData.total,
                  paperId: eventData.paperId,
                  paperTitle: eventData.paperTitle,
                  decision: eventData.decision,
                  costSoFar: eventData.costSoFar,
                  tokensSoFar: eventData.tokensSoFar,
                  isPartialRetry: isPartial
                }));

                setLiveResults(prev => {
                  const existingIdx = prev.findIndex(r => String(r.paper_id) === String(eventData.paperId));
                  const updatedItem = {
                    paper_id: eventData.paperId,
                    title: eventData.paperTitle,
                    decision: eventData.decision,
                    exclusion_code: eventData.exclusionCode,
                    error: eventData.error,
                    rationale: eventData.error ? `LLM Call Failed: ${eventData.error}` : undefined
                  };

                  if (existingIdx >= 0) {
                    const next = [...prev];
                    next[existingIdx] = updatedItem;
                    return next;
                  }
                  return [...prev, updatedItem];
                });
              } else if (eventData.type === 'complete') {
                setProgressState(prev => ({
                  ...prev,
                  isRunning: false,
                  costSoFar: eventData.totalCost,
                  tokensSoFar: eventData.totalTokens,
                  isPartialRetry: false
                }));

                const successMsg = isPartial
                  ? (options.paperIds
                      ? `Selective rerun completed (${eventData.targetPapersEvaluated} paper(s) re-evaluated)! Total cost: $${Number(eventData.totalCost || 0).toFixed(4)}. Initiating download...`
                      : `Partial rerun completed (${eventData.targetPapersEvaluated} failed papers re-evaluated)! Total cost: $${Number(eventData.totalCost || 0).toFixed(4)}. Initiating download...`)
                  : `Mockup review completed (${eventData.totalPapers} papers, $${Number(eventData.totalCost || 0).toFixed(4)})! Initiating download...`;

                showToast?.(successMsg, 'success');

                // Trigger automatic browser download
                if (eventData.downloadUrl) {
                  const link = document.createElement('a');
                  link.href = eventData.downloadUrl;
                  link.setAttribute('download', '');
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }

                await fetchCacheInfo(selectedPool);
              } else if (eventData.type === 'error') {
                throw new Error(eventData.error || 'Mockup generation failed');
              }
            } catch (pErr: any) {
              console.error('Error parsing SSE event data:', pErr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Mockup generation error:', err);
      setProgressState(prev => ({
        ...prev,
        isRunning: false,
        error: err.message || 'Generation failed',
        isPartialRetry: false
      }));
      showToast?.(err.message || 'Failed to generate mockup review', 'error');
    }
  };

  // Standard full generation trigger
  const handleGenerate = async () => {
    await executeGeneration();
  };

  // Targeted partial retry for failed papers only
  const handleRetryFailed = async () => {
    await executeGeneration({ failedOnly: true });
  };

  // Targeted selective rerun for selected papers only
  const handleRerunSelected = async (targetIds?: string[]) => {
    const idsToRun = targetIds || selectedPaperIds;
    if (!idsToRun || idsToRun.length === 0) {
      showToast?.('Please select at least one paper to rerun.', 'warning');
      return;
    }
    await executeGeneration({ paperIds: idsToRun });
  };

  // Redownload cached .slr file using the active Reviewer Identifier
  const handleRedownload = async (customReviewer?: string) => {
    if (!cacheInfo?.cached) return;
    const effectiveReviewer = (customReviewer || reviewerName || cacheInfo?.reviewer_name || '').trim();
    const reviewerParam = effectiveReviewer ? `&reviewerName=${encodeURIComponent(effectiveReviewer)}` : '';
    const downloadUrl = `/api/mockup/generate?projectId=${encodeURIComponent(projectIdRef.current)}&pool=${selectedPool}&download=true${reviewerParam}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.(`Redownloading cached ${selectedPool.toUpperCase()} review file (.slr) as "${effectiveReviewer || 'review'}"...`, 'info');

    if (effectiveReviewer && effectiveReviewer !== cacheInfo?.reviewer_name) {
      await fetchCacheInfo(selectedPool);
    }
  };

  // Invalidate cache and rerun all
  const handleRerun = async () => {
    if (!projectIdRef.current) return;
    try {
      await fetch(`/api/mockup/generate?projectId=${encodeURIComponent(projectIdRef.current)}&pool=${selectedPool}`, {
        method: 'DELETE'
      });
      await fetchCacheInfo(selectedPool);
      await handleGenerate();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to rerun mockup review', 'error');
    }
  };

  // Compute live / cached result overview statistics
  const failedCount = liveResults.filter(r => isMockupResultFailed(r, selectedPool)).length;
  const succeededCount = liveResults.length - failedCount;
  const hasFailedPapers = failedCount > 0;

  const includedCount = liveResults.filter(r => !isMockupResultFailed(r, selectedPool) && r.decision && String(r.decision).toUpperCase().startsWith('INC')).length;
  const excludedCount = liveResults.filter(r => !isMockupResultFailed(r, selectedPool) && r.decision && String(r.decision).toUpperCase().startsWith('EXC')).length;
  const evaluatedCount = liveResults.length;

  const exclusionBreakdown = liveResults.reduce<Record<string, number>>((acc, r) => {
    if (!isMockupResultFailed(r, selectedPool) && r.decision && String(r.decision).toUpperCase().startsWith('EXC') && r.exclusion_code) {
      acc[r.exclusion_code] = (acc[r.exclusion_code] || 0) + 1;
    }
    return acc;
  }, {});

  // Compute missing PDF stats for Pool B and Pool C
  const missingPdfCount = cacheInfo?.missing_pdf_count ?? (
    (selectedPool === 'pool_b' || selectedPool === 'pool_c')
      ? (cacheInfo?.papers_preview || []).filter(p => !p.Local_PDF_Path || p.Local_PDF_Status === 'MISSING').length
      : 0
  );
  const hasMissingPdfs = (selectedPool === 'pool_b' || selectedPool === 'pool_c') && missingPdfCount > 0;

  return {
    selectedPool,
    reviewerName,
    loadingCache,
    cacheInfo,
    progressState,
    liveResults,
    selectedPaperIds,
    includedCount,
    excludedCount,
    evaluatedCount,
    failedCount,
    succeededCount,
    hasFailedPapers,
    missingPdfCount,
    hasMissingPdfs,
    exclusionBreakdown,
    setReviewerName,
    handlePoolChange,
    handleRegenerateName,
    handleGenerate,
    handleRetryFailed,
    handleRerunSelected,
    handleRedownload,
    handleRerun,
    fetchCacheInfo,
    togglePaperSelection,
    selectAllPapers,
    deselectAllPapers,
    selectFailedPapers,
    selectSucceededPapers,
    isPaperSelected
  };
}


