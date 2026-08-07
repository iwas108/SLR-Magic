import { useState, useEffect, useCallback } from 'react';

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
      if (paper.extracted_data) {
        Object.keys(paper.extracted_data).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [minerPapers]);

  // Get unique tokens and their occurrence counts for a specific key
  const getUniqueTokens = useCallback((key: string) => {
    const counts: Record<string, { count: number; papers: { id: string; title: string }[] }> = {};
    minerPapers.forEach((paper) => {
      const data = paper.extracted_data[key];
      if (!data) return;

      const rawVal = data.value;
      const rawEvidence = data.evidence || '';
      
      const addToken = (token: string) => {
        const t = String(token).trim();
        if (!t || t === 'NOT_STATED') return;
        if (!counts[t]) {
          counts[t] = { count: 0, papers: [] };
        }
        counts[t].count += 1;
        counts[t].papers.push({ id: paper.Paper_ID, title: paper.Title });
      };

      if (Array.isArray(rawVal)) {
        rawVal.forEach((val) => addToken(val));
      } else if (typeof rawVal === 'string') {
        addToken(rawVal);
      }
    });

    return Object.entries(counts).map(([token, info]) => ({
      token,
      count: info.count,
      papers: info.papers
    })).sort((a, b) => b.count - a.count);
  }, [minerPapers]);

  const runUmbrellanizer = async (
    key: string,
    templateId: string,
    targetVariableName: string,
    rawTokens: string[]
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
    loadData
  };
}
