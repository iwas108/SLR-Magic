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
  prompt_hash: string | null;
  prompt_changed: boolean;
  created_at: string | null;
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
}

export function generateRandomReviewerName(): string {
  const randHex = Math.floor(0x1000 + Math.random() * 0xf000).toString(16);
  return `rev_${randHex}`;
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
    error: null
  });

  const [liveResults, setLiveResults] = useState<any[]>([]);

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
    setReviewerName(generateRandomReviewerName());
    setProgressState(prev => ({ ...prev, isRunning: false, current: 0, total: 0, costSoFar: 0, error: null }));
  };

  const handleRegenerateName = () => {
    setReviewerName(generateRandomReviewerName());
  };

  // Trigger Mockup Generation via SSE
  const handleGenerate = async () => {
    if (!projectIdRef.current) {
      showToast?.('No active project selected.', 'error');
      return;
    }

    if (!reviewerName.trim()) {
      showToast?.('Please specify a valid Reviewer Name.', 'warning');
      return;
    }

    setProgressState({
      isRunning: true,
      current: 0,
      total: cacheInfo?.papers_count || 0,
      paperId: '',
      paperTitle: 'Initializing Gemini pipeline...',
      decision: '',
      costSoFar: 0,
      tokensSoFar: 0,
      error: null
    });
    setLiveResults([]);

    try {
      const res = await fetch('/api/mockup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectIdRef.current,
          pool: selectedPool,
          reviewerName: reviewerName.trim()
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
                  tokensSoFar: eventData.tokensSoFar
                }));

                setLiveResults(prev => [
                  ...prev,
                  {
                    paper_id: eventData.paperId,
                    title: eventData.paperTitle,
                    decision: eventData.decision,
                    exclusion_code: eventData.exclusionCode
                  }
                ]);
              } else if (eventData.type === 'complete') {
                setProgressState(prev => ({
                  ...prev,
                  isRunning: false,
                  costSoFar: eventData.totalCost,
                  tokensSoFar: eventData.totalTokens
                }));

                showToast?.(`Mockup review completed (${eventData.totalPapers} papers, $${eventData.totalCost.toFixed(4)})! Initiating download...`, 'success');

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
        error: err.message || 'Generation failed'
      }));
      showToast?.(err.message || 'Failed to generate mockup review', 'error');
    }
  };

  // Redownload cached .slr file
  const handleRedownload = () => {
    if (!cacheInfo?.cached) return;
    const downloadUrl = `/api/mockup/generate?projectId=${encodeURIComponent(projectIdRef.current)}&pool=${selectedPool}&download=true`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.(`Redownloading cached ${selectedPool.toUpperCase()} review file (.slr)...`, 'info');
  };

  // Invalidate cache and rerun
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
  const includedCount = liveResults.filter(r => r.decision && String(r.decision).toUpperCase().startsWith('INC')).length;
  const excludedCount = liveResults.filter(r => r.decision && String(r.decision).toUpperCase().startsWith('EXC')).length;
  const evaluatedCount = liveResults.length;

  const exclusionBreakdown = liveResults.reduce<Record<string, number>>((acc, r) => {
    if (r.decision && String(r.decision).toUpperCase().startsWith('EXC') && r.exclusion_code) {
      acc[r.exclusion_code] = (acc[r.exclusion_code] || 0) + 1;
    }
    return acc;
  }, {});

  return {
    selectedPool,
    reviewerName,
    loadingCache,
    cacheInfo,
    progressState,
    liveResults,
    includedCount,
    excludedCount,
    evaluatedCount,
    exclusionBreakdown,
    setReviewerName,
    handlePoolChange,
    handleRegenerateName,
    handleGenerate,
    handleRedownload,
    handleRerun,
    fetchCacheInfo
  };
}
