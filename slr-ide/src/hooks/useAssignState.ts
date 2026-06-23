import { useState, useRef } from 'react';
import { Paper } from '@/types';

export function useAssignState(
  papers: Paper[],
  calPapers: Paper[],
  activeTab: string,
  showAssignModal: boolean,
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void,
  loadProjects: () => Promise<any>,
  loadCalPapers: () => void,
  loadPapers: () => void
) {
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
  const [activeAssignDropdown, setActiveAssignDropdown] = useState<string | null>(null);

  const singlePipelineAbortControllerRef = useRef<AbortController | null>(null);

  const loadAssignPapers = async () => {
    setAssignLoading(true);
    try {
      const params = new URLSearchParams();
      if (assignSearch) params.append('search', assignSearch);
      
      if (assignPoolFilter === 'unassigned') {
        params.append('calibrationPool', 'none');
      } else if (assignPoolFilter && assignPoolFilter !== 'all') {
        params.append('calibrationPool', assignPoolFilter);
      }

      params.append('sortBy', 'Paper_ID');
      params.append('sortOrder', 'asc');
      params.append('page', String(assignPage));
      params.append('limit', String(assignLimit));

      const res = await fetch(`/api/papers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssignPapers(data.papers || []);
        setAssignTotalPapers(data.total || 0);
        setAssignTotalPages(data.totalPages || 1);
        
        if (data.papers && data.papers.length > 0) {
          const found = data.papers.find((p: any) => p.Paper_ID === assignSelectedPaper?.Paper_ID);
          if (!found) {
            setAssignSelectedPaper(data.papers[0]);
          } else {
            setAssignSelectedPaper(found);
          }
        } else {
          setAssignSelectedPaper(null);
        }
      }
    } catch (e: any) {
      console.error(e);
      showToast('Failed to load assign papers', 'error');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignPool = async (paperId: string, pool: string | null, tag: string | null = null) => {
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
          loadCalPapers();
        }
        if (showAssignModal) {
          loadAssignPapers();
        }
        loadPapers();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to assign pool', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to assign pool', 'error');
    }
  };

  const runSinglePaperPipeline = async (paperId: string) => {
    if (assignIsRunning) {
      showToast('A PDF acquisition process is already active.', 'warning');
      return;
    }
    setAssignIsRunning(true);
    setAssignLogs([]);
    setAssignProgress(0);
    setAssignStatusText('Starting acquisition...');
    setAssignWaitingLogin(false);

    const abortController = new AbortController();
    singlePipelineAbortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/pipeline/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'single_paper',
          paperIds: [paperId]
        }),
        signal: abortController.signal
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'progress') {
              setAssignProgress(data.data.percent || 0);
              if (data.data.status) setAssignStatusText(data.data.status);
              if (data.data.waitingLogin !== undefined) setAssignWaitingLogin(data.data.waitingLogin);
            }
            if (data.type === 'log') {
              setAssignLogs(prev => [...prev, data.data.message]);
            }
          } catch (e) {
            // Ignore parse errors from partial streams
          }
        }
      }
      
      showToast('PDF acquisition complete', 'success');
      loadAssignPapers();
      loadCalPapers();
      loadPapers();
      
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setAssignLogs(prev => [...prev, '[SYSTEM] Process aborted by user.']);
        showToast('Acquisition aborted', 'info');
      } else {
        setAssignLogs(prev => [...prev, `[ERROR] ${e.message}`]);
        showToast('Acquisition failed', 'error');
      }
    } finally {
      setAssignIsRunning(false);
      singlePipelineAbortControllerRef.current = null;
    }
  };

  return {
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
    activeAssignDropdown, setActiveAssignDropdown,
    loadAssignPapers, handleAssignPool, runSinglePaperPipeline,
    singlePipelineAbortControllerRef
  };
}
