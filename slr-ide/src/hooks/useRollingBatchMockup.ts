import { useState, useEffect, useCallback, useRef } from 'react';
import type { MockupPromptConfig } from '@/lib/services/mockup-generator';
import { subscribeSyncChannel } from '@/lib/sync-utils';

export type { MockupPromptConfig };

export interface RollingBatchMockupCacheInfo {
  cached: boolean;
  activeBatch: any | null;
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
  prompt_configs?: MockupPromptConfig[];
}

export interface RollingBatchMockupProgressState {
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

export function useRollingBatchMockup(
  projectId: string,
  batchId?: string,
  showToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void
) {
  const [reviewerName, setReviewerName] = useState<string>(() => generateRandomReviewerName());
  const [loadingCache, setLoadingCache] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<RollingBatchMockupCacheInfo | null>(null);

  const [progressState, setProgressState] = useState<RollingBatchMockupProgressState>({
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

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const batchIdRef = useRef(batchId);
  batchIdRef.current = batchId;

  // Fetch cache info and batch preview
  const fetchCacheInfo = useCallback(async () => {
    if (!projectIdRef.current) return;
    setLoadingCache(true);
    try {
      const bParam = batchIdRef.current ? `&batchId=${encodeURIComponent(batchIdRef.current)}` : '';
      const res = await fetch(`/api/rolling-batch/mockup?projectId=${encodeURIComponent(projectIdRef.current)}${bParam}`);
      if (!res.ok) {
        throw new Error('Failed to fetch rolling batch mockup status');
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
      console.error('Error loading rolling batch mockup status:', err);
    } finally {
      setLoadingCache(false);
    }
  }, []);

  useEffect(() => {
    fetchCacheInfo();
  }, [projectId, batchId, fetchCacheInfo]);

  // Subscribe to multi-tab sync channel
  const latestLoadersRef = useRef({ fetchCacheInfo });
  useEffect(() => {
    latestLoadersRef.current = { fetchCacheInfo };
  });

  useEffect(() => {
    const unsub = subscribeSyncChannel((type) => {
      if (type === 'SYNC_PAPERS' || type === 'SYNC_ADJUDICATION') {
        latestLoadersRef.current.fetchCacheInfo();
      }
    });
    return () => unsub();
  }, []);

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
      .filter(r => isMockupResultFailed(r, 'pool_c'))
      .map(r => String(r.paper_id));
    setSelectedPaperIds(failedIds);
  }, [liveResults]);

  const selectSucceededPapers = useCallback(() => {
    const succeededIds = liveResults
      .filter(r => !isMockupResultFailed(r, 'pool_c'))
      .map(r => String(r.paper_id));
    setSelectedPaperIds(succeededIds);
  }, [liveResults]);

  const isPaperSelected = useCallback((paperId: string) => {
    return selectedPaperIds.includes(paperId);
  }, [selectedPaperIds]);

  // SSE generator execution
  const executeGeneration = async (options: { failedOnly?: boolean; paperIds?: string[] } = {}) => {
    if (!projectIdRef.current) {
      showToast?.('No active project selected.', 'error');
      return;
    }

    if (!cacheInfo?.activeBatch) {
      showToast?.('No active rolling batch found to evaluate. Please initialize a batch first.', 'warning');
      return;
    }

    const effectiveReviewer = (cacheInfo?.reviewer_name || reviewerName).trim();
    if (!effectiveReviewer) {
      showToast?.('Please specify a valid Reviewer Name.', 'warning');
      return;
    }

    const isPartial = Boolean(options.failedOnly || (options.paperIds && options.paperIds.length > 0));

    let totalToProcess = cacheInfo?.papers_count || 0;
    if (options.failedOnly) {
      totalToProcess = liveResults.filter(r => isMockupResultFailed(r, 'pool_c')).length || 1;
    } else if (options.paperIds) {
      totalToProcess = options.paperIds.length;
    }

    setProgressState({
      isRunning: true,
      current: 0,
      total: totalToProcess,
      paperId: '',
      paperTitle: '',
      decision: '',
      costSoFar: 0,
      tokensSoFar: 0,
      error: null,
      isPartialRetry: isPartial
    });

    try {
      const response = await fetch('/api/rolling-batch/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectIdRef.current,
          batchId: cacheInfo.activeBatch.id,
          reviewerName: effectiveReviewer,
          failedOnly: options.failedOnly || false,
          paperIds: options.paperIds
        })
      });

      if (!response.ok) {
        let errMessage = 'Failed to generate rolling batch review';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch {
          errMessage = `Server error HTTP ${response.status}`;
        }
        throw new Error(errMessage);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser environment.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.substring(6);

          try {
            const eventData = JSON.parse(jsonStr);

            if (eventData.type === 'progress') {
              setProgressState({
                isRunning: true,
                current: eventData.current || 0,
                total: eventData.total || totalToProcess,
                paperId: eventData.paperId || '',
                paperTitle: eventData.paperTitle || '',
                decision: eventData.decision || '',
                costSoFar: eventData.costSoFar || 0,
                tokensSoFar: eventData.tokensSoFar || 0,
                error: eventData.error || null,
                isPartialRetry: isPartial
              });

              setLiveResults(prev => {
                const idx = prev.findIndex(p => p.paper_id === eventData.paperId);
                const updatedItem = {
                  paper_id: eventData.paperId,
                  title: eventData.paperTitle,
                  decision: eventData.decision,
                  exclusion_code: eventData.exclusionCode,
                  error: eventData.error,
                  cost_usd: eventData.costSoFar,
                  tokens: eventData.tokensSoFar
                };
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = { ...copy[idx], ...updatedItem };
                  return copy;
                }
                return [...prev, updatedItem];
              });
            } else if (eventData.type === 'complete') {
              setProgressState(prev => ({
                ...prev,
                isRunning: false,
                current: eventData.totalPapers || prev.total,
                total: eventData.totalPapers || prev.total,
                costSoFar: eventData.totalCost || prev.costSoFar,
                tokensSoFar: eventData.totalTokens || prev.tokensSoFar
              }));

              showToast?.(
                isPartial
                  ? `Successfully retried ${eventData.targetPapersEvaluated || totalToProcess} paper(s) for ${eventData.reviewerName}!`
                  : `Mockup Review generation complete for ${eventData.reviewerName}! Total cost: $${Number(eventData.totalCost || 0).toFixed(4)}`,
                'success'
              );

              await fetchCacheInfo();
              setSelectedPaperIds([]);

              // Auto-trigger download
              if (eventData.downloadUrl) {
                const link = document.createElement('a');
                link.href = eventData.downloadUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            } else if (eventData.type === 'error') {
              setProgressState(prev => ({ ...prev, isRunning: false, error: eventData.error }));
              showToast?.(eventData.error || 'Evaluation stream reported an error', 'error');
            }
          } catch (parseErr) {
            console.error('Failed to parse SSE line:', jsonStr, parseErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Rolling batch mockup generation error:', err);
      setProgressState(prev => ({ ...prev, isRunning: false, error: err.message }));
      showToast?.(err.message || 'Error occurred during review generation', 'error');
    }
  };

  const handleGenerate = () => executeGeneration({ failedOnly: false });
  const handleRetryFailed = () => executeGeneration({ failedOnly: true });
  const handleRerunSelected = () => {
    if (selectedPaperIds.length === 0) {
      showToast?.('Please select at least one paper to rerun.', 'warning');
      return;
    }
    executeGeneration({ paperIds: selectedPaperIds });
  };

  const handleRedownload = async () => {
    if (!cacheInfo?.cached || !cacheInfo.activeBatch) {
      showToast?.('No cached mockup review found to download.', 'warning');
      return;
    }
    const targetReviewer = reviewerName.trim() || cacheInfo.reviewer_name || 'review';
    const downloadUrl = `/api/rolling-batch/mockup?projectId=${encodeURIComponent(projectIdRef.current)}&batchId=${encodeURIComponent(cacheInfo.activeBatch.id)}&reviewerName=${encodeURIComponent(targetReviewer)}&download=true`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast?.(`Downloading cached .slr review for ${targetReviewer}...`, 'info');
    await fetchCacheInfo();
  };

  const handleRerun = async () => {
    if (cacheInfo?.activeBatch) {
      try {
        await fetch(`/api/rolling-batch/mockup?projectId=${encodeURIComponent(projectIdRef.current)}&batchId=${encodeURIComponent(cacheInfo.activeBatch.id)}`, {
          method: 'DELETE'
        });
      } catch (delErr) {
        console.warn('Failed to clear cache on rerun:', delErr);
      }
    }
    await executeGeneration({ failedOnly: false });
  };

  // Derived failure statistics
  const failedCount = liveResults.filter(r => isMockupResultFailed(r, 'pool_c')).length;
  const succeededCount = liveResults.filter(r => !isMockupResultFailed(r, 'pool_c')).length;
  const hasFailedPapers = failedCount > 0;

  // Derived missing PDF statistics
  const missingPdfCount = (cacheInfo?.papers_preview || []).filter(p => {
    if (!p.Local_PDF_Path || p.Local_PDF_Status === 'MISSING') return true;
    return false;
  }).length;
  const hasMissingPdfs = Boolean(cacheInfo?.has_missing_pdfs || missingPdfCount > 0);

  return {
    activeBatch: cacheInfo?.activeBatch || null,
    reviewerName,
    loadingCache,
    cacheInfo,
    progressState,
    liveResults,
    selectedPaperIds,
    failedCount,
    succeededCount,
    hasFailedPapers,
    missingPdfCount,
    hasMissingPdfs,
    setReviewerName,
    handleRegenerateName,
    handleGenerate,
    handleRetryFailed,
    handleRerunSelected,
    handleRedownload,
    handleRerun,
    togglePaperSelection,
    selectAllPapers,
    deselectAllPapers,
    selectFailedPapers,
    selectSucceededPapers,
    isPaperSelected,
    refetchCache: fetchCacheInfo
  };
}
