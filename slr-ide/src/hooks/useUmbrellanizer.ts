import { useState, useEffect, useCallback } from 'react';
import { normalizeExtractedTokens } from '@/lib/services/taxonomy-resolver';
import { extractEvidenceQuote, extractMappingReasoning } from '@/lib/services/trace-normalizer';

export interface UmbrellanizerResult {
  id: number;
  project_id: string;
  extracted_data_key: string;
  prompt_id: string;
  model_id: string;
  raw_tokens_input: string;
  umbrella_mapping: string; // JSON String
  status: 'PENDING' | 'SUCCESS' | 'ERROR';
  error_message?: string;
  cost_usd: number;
}

export interface MinerPaper {
  Paper_ID: string;
  Title: string;
  Authors?: string;
  Year?: number;
  extracted_data: Record<string, any>;
  logic_trace?: Record<string, any>;
}

export interface UniqueTokenWithContext {
  token: string;
  count: number;
  papers: { id: string; title: string }[];
  evidence_quotes: { paper_id: string; quote: string }[];
  logic_traces: { paper_id: string; trace: string }[];
}

export function useUmbrellanizer(
  projectId: string,
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void
) {
  const [minerPapers, setMinerPapers] = useState<MinerPaper[]>([]);
  const [umbrellaResults, setUmbrellaResults] = useState<UmbrellanizerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<number>(0); // 0 = closed
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [papersRes, resultsRes] = await Promise.all([
        fetch(`/api/umbrellanizer/papers?project_id=${projectId}`),
        fetch(`/api/umbrellanizer?project_id=${projectId}`)
      ]);

      const papersData = await papersRes.json();
      const resultsData = await resultsRes.json();

      if (papersData.success) {
        setMinerPapers(papersData.papers || []);
      }
      if (resultsData.success) {
        setUmbrellaResults(resultsData.results || []);
      }
    } catch (err) {
      console.error('Failed to load Umbrellanizer dataset:', err);
      showToast('Failed to load Umbrellanizer dataset', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract unique keys present in the papers' extracted_data
  const getExtractedKeys = useCallback(() => {
    const keys = new Set<string>();
    minerPapers.forEach((paper) => {
      if (paper.extracted_data && typeof paper.extracted_data === 'object') {
        Object.keys(paper.extracted_data).forEach((key) => {
          if (!key.startsWith('_') && key !== 'logic_trace' && key !== 'logicTrace' && key !== '_scientist_logic_trace' && key !== 'qa_scores') {
            keys.add(key);
          }
        });
      }
    });
    return Array.from(keys);
  }, [minerPapers]);

  // Get unique tokens and their occurrence counts, evidence quotes, and logic traces for a specific key
  const getUniqueTokens = useCallback((key: string): UniqueTokenWithContext[] => {
    const tokenMap: Record<string, {
      count: number;
      papers: { id: string; title: string }[];
      evidence_quotes: { paper_id: string; quote: string }[];
      logic_traces: { paper_id: string; trace: string }[];
    }> = {};

    minerPapers.forEach((paper) => {
      const data = paper.extracted_data[key];
      if (data === undefined || data === null || data === '') return;

      const rawTokens = normalizeExtractedTokens(data, key);
      if (rawTokens.length === 0) return;

      const rawEvidence = extractEvidenceQuote(key, data);
      const logicTrace = paper.logic_trace || {};
      const locateMapping = logicTrace.extraction_mapping || logicTrace || {};
      const logicTraceText = extractMappingReasoning(key, locateMapping, data);

      rawTokens.forEach((token) => {
        const t = String(token).trim();
        if (!t || t.toUpperCase() === 'NOT_STATED') return;
        if (!tokenMap[t]) {
          tokenMap[t] = { count: 0, papers: [], evidence_quotes: [], logic_traces: [] };
        }
        tokenMap[t].count += 1;
        tokenMap[t].papers.push({ id: paper.Paper_ID, title: paper.Title });

        if (rawEvidence && rawEvidence.toUpperCase() !== 'NOT_STATED') {
          if (!tokenMap[t].evidence_quotes.some(eq => eq.paper_id === paper.Paper_ID && eq.quote === rawEvidence)) {
            tokenMap[t].evidence_quotes.push({ paper_id: paper.Paper_ID, quote: rawEvidence });
          }
        }

        if (logicTraceText && logicTraceText !== 'No trace mapping logged.' && logicTraceText.trim() !== '') {
          if (!tokenMap[t].logic_traces.some(lt => lt.paper_id === paper.Paper_ID && lt.trace === logicTraceText)) {
            tokenMap[t].logic_traces.push({ paper_id: paper.Paper_ID, trace: logicTraceText });
          }
        }
      });
    });

    return Object.entries(tokenMap).map(([token, info]) => ({
      token,
      count: info.count,
      papers: info.papers,
      evidence_quotes: info.evidence_quotes,
      logic_traces: info.logic_traces
    })).sort((a, b) => b.count - a.count);
  }, [minerPapers]);

  const runUmbrellanizer = async (
    key: string,
    templateId: string,
    targetVariableName: string,
    rawTokens: string[],
    richTokens?: UniqueTokenWithContext[]
  ) => {
    setIsRunning(true);
    setRunError(null);
    const jobId = `job_${Date.now()}`;
    setActiveJobId(jobId);

    try {
      let targetDesc = '';
      try {
        const pRes = await fetch(`/api/projects/${projectId}`);
        const pData = await pRes.json();
        if (pData.success && pData.project?.llm_config) {
          const pCfg = typeof pData.project.llm_config === 'string' ? JSON.parse(pData.project.llm_config) : pData.project.llm_config;
          const rqDescs = pCfg.research_question_descriptions || {};
          const match = key.match(/^rq\s*\d+[a-z]?/i);
          const codeKey = match ? match[0].toUpperCase().replace(/\s+/g, '') : '';
          targetDesc = rqDescs[codeKey] || rqDescs[key] || '';
        }
      } catch (e) {}

      const res = await fetch('/api/umbrellanizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          key,
          templateId,
          rawTokens,
          richTokens: richTokens || [],
          targetVariableName,
          targetResearchQuestion: targetVariableName,
          targetResearchQuestionDescription: targetDesc,
          jobId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start Umbrellanizer run');
      }

      // Start polling for results
      pollJobStatus(key, jobId);
    } catch (err: any) {
      console.error(err);
      setRunError(err.message || 'Run execution failed');
      setIsRunning(false);
    }
  };

  const pollJobStatus = async (key: string, jobId: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 450) { // Limit to 15 minutes (900 seconds)
        clearInterval(interval);
        setRunError('Umbrellanizer execution timed out');
        setIsRunning(false);
        return;
      }

      try {
        const res = await fetch(`/api/umbrellanizer?project_id=${projectId}`);
        const data = await res.json();
        if (data.success) {
          const matched = data.results.find((r: any) => r.extracted_data_key === key);
          if (matched) {
            if (matched.status === 'SUCCESS') {
              clearInterval(interval);
              setIsRunning(false);
              setWizardStep(4); // Success step
              loadData();
              // Broadcast synchronization event to other tabs
              const { broadcastSync } = await import('@/lib/sync-utils');
              broadcastSync('SYNC_PAPERS');
            } else if (matched.status === 'ERROR') {
              clearInterval(interval);
              setRunError(matched.error_message || 'Umbrellanizer pipeline execution failed');
              setIsRunning(false);
            }
          }
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
    }, 2000);
  };

  const dropUmbrellanizerKey = async (key: string): Promise<boolean> => {
    if (!projectId || !key) return false;
    try {
      const res = await fetch(`/api/umbrellanizer?project_id=${encodeURIComponent(projectId)}&key=${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to drop umbrellanizer result');
      }
      showToast(`Dropped Umbrellanizer taxonomy mapping for "${key}"`, 'success');
      await loadData();
      // Broadcast synchronization event to other tabs per agents.md §3.3
      const { broadcastSync } = await import('@/lib/sync-utils');
      broadcastSync('SYNC_PAPERS');
      return true;
    } catch (err: any) {
      console.error('Failed to drop umbrellanizer mapping:', err);
      showToast(err.message || 'Failed to drop umbrellanizer mapping', 'error');
      return false;
    }
  };

  return {
    minerPapers,
    umbrellaResults,
    loading,
    wizardStep,
    setWizardStep,
    isRunning,
    runError,
    activeJobId,
    getExtractedKeys,
    getUniqueTokens,
    runUmbrellanizer,
    dropUmbrellanizerKey,
    loadData
  };
}
