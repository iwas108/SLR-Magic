import { useState, useRef, useEffect, useCallback } from 'react';
import { broadcastSync } from '@/lib/sync-utils';

export function usePipeline(showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void, loadPapers: () => void) {
  const [batchSteps, setBatchSteps] = useState<Record<string, boolean>>({
    scan: true,
    scrape: true,
    sync: true
  });

  const [operationModal, setOperationModal] = useState<{
    isOpen: boolean;
    type: 'scan' | 'scrape' | 'sync' | null;
    title: string;
    progress: number;
    statusText: string;
    logs: string[];
    currentItem?: string;
    isExecuting?: boolean;
    isWaitingLogin?: boolean;
  }>({
    isOpen: false,
    type: null,
    title: '',
    progress: 0,
    statusText: '',
    logs: [],
    isExecuting: false,
    isWaitingLogin: false
  });

  const [isModalMinimized, setIsModalMinimized] = useState(false);
  const [currentStep, setCurrentStep] = useState<'scan' | 'scrape' | 'compress' | 'sync' | null>(null);
  const [pipelineStats, setPipelineStats] = useState({
    matched: 0,
    downloaded: 0,
    failed: 0,
    current: 0,
    total: 0,
    savedSpaceBytes: 0,
    originalSpaceBytes: 0
  });

  const [stepStartTime, setStepStartTime] = useState<number | null>(null);
  const [timeTicker, setTimeTicker] = useState(0);
  const [indexingState, setIndexingState] = useState<{
    filename: string;
    tool: string;
    current: number;
    total: number;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (operationModal.isExecuting) {
      interval = setInterval(() => {
        setTimeTicker(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [operationModal.isExecuting]);

  useEffect(() => {
    if (logEndRef.current && operationModal.isOpen) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [operationModal.logs, operationModal.isOpen]);

  const handleBatchEvent = useCallback((data: any) => {
    if (data.event === 'step_start') {
      setCurrentStep(data.step);
      setStepStartTime(Date.now());
      setIndexingState(null);
      setPipelineStats(prev => ({
        ...prev,
        current: 0,
        total: 0,
        savedSpaceBytes: 0,
        originalSpaceBytes: 0
      }));
      setOperationModal(prev => ({
        ...prev,
        statusText: data.message,
        isWaitingLogin: false,
        logs: [...prev.logs, `>>> ${data.message}`].slice(-500)
      }));
    } else if (data.event === 'step_complete') {
      setIndexingState(null);
      setOperationModal(prev => ({
        ...prev,
        isWaitingLogin: false,
        logs: [...prev.logs, `<<< ${data.message}`].slice(-500)
      }));
    } else if (data.event === 'complete' && !data.step) {
      setIndexingState(null);
      setOperationModal(prev => ({
        ...prev,
        progress: 100,
        statusText: data.message,
        isWaitingLogin: false,
        logs: [...prev.logs, `[SUCCESS]: ${data.message}`].slice(-500),
        isExecuting: false
      }));
    } else if (data.event === 'error') {
      setIndexingState(null);
      setOperationModal(prev => ({
        ...prev,
        statusText: `Error: ${data.message}`,
        isWaitingLogin: false,
        logs: [...prev.logs, `[ERROR]: ${data.message}`].slice(-500),
        isExecuting: false
      }));
    } else if (data.event === 'progress') {
      if (data.currentItem) {
        setPipelineStats(prev => ({
          ...prev,
          current: data.current || prev.current,
          total: data.total || prev.total
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: data.total ? Math.round(((data.current || 0) / data.total) * 100) : prev.progress,
          currentItem: data.currentItem,
          isWaitingLogin: false,
          logs: [...prev.logs, data.message].slice(-500)
        }));
      } else {
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, data.message].slice(-500)
        }));
      }
    } else if (data.event === 'waiting_login') {
      setOperationModal(prev => ({
        ...prev,
        statusText: data.message,
        isWaitingLogin: true,
        logs: [...prev.logs, `[ACTION REQUIRED]: ${data.message}`].slice(-500)
      }));
    } else if (data.event === 'indexing_progress') {
      setIndexingState({
        filename: data.filename,
        tool: data.tool,
        current: data.current,
        total: data.total
      });
      if (data.current === data.total) {
        setTimeout(() => {
          setIndexingState(null);
        }, 10000);
      }
    } else if (data.event === 'stats_update') {
      setPipelineStats(prev => ({
        ...prev,
        matched: data.stats?.matched ?? prev.matched,
        downloaded: data.stats?.downloaded ?? prev.downloaded,
        failed: data.stats?.failed ?? prev.failed,
        savedSpaceBytes: data.stats?.savedSpaceBytes ?? prev.savedSpaceBytes,
        originalSpaceBytes: data.stats?.originalSpaceBytes ?? prev.originalSpaceBytes
      }));
    }
  }, []);

  const readBatchStream = useCallback(async (res: Response, controller: AbortController) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    setOperationModal(prev => ({
      ...prev,
      isOpen: true,
      isExecuting: true
    }));

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep last partial line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.event === 'restore') {
            setOperationModal({
              isOpen: true,
              type: 'scrape',
              title: 'Batch PDF Pipeline Execution',
              progress: data.progress,
              statusText: data.statusText,
              logs: data.logs ? data.logs.slice(-500) : [],
              currentItem: data.currentItem,
              isExecuting: data.isExecuting,
              isWaitingLogin: data.isWaitingLogin
            });
            setCurrentStep(data.currentStep);
            setStepStartTime(data.stepStartTime);
            setPipelineStats(data.pipelineStats);
            setIndexingState(data.indexingState);
          } else {
            handleBatchEvent(data);
          }
        } catch (e) {
          console.error("Failed to parse stream line:", line);
        }
      }
    }
  }, [handleBatchEvent]);

  const runBatchExecution = useCallback(async (compressOnSync: boolean) => {
    if (operationModal.isExecuting) return;
    const activeSteps = Object.keys(batchSteps).filter(k => batchSteps[k]);
    if (activeSteps.length === 0) {
      showToast('Please select at least one step to execute', 'warning');
      return;
    }

    setIsModalMinimized(false);
    setCurrentStep(null);
    setStepStartTime(null);
    setTimeTicker(0);
    setIndexingState(null);
    setPipelineStats({
      matched: 0,
      downloaded: 0,
      failed: 0,
      current: 0,
      total: 0,
      savedSpaceBytes: 0,
      originalSpaceBytes: 0
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setOperationModal({
      isOpen: true,
      type: 'scrape',
      title: 'Batch PDF Pipeline Execution',
      progress: 0,
      statusText: 'Initializing pipeline...',
      logs: [],
      isExecuting: true
    });

    try {
      const res = await fetch('/api/pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: activeSteps, compress: compressOnSync }),
        signal: controller.signal
      });

      broadcastSync('SYNC_PIPELINE');

      if (!res.body) throw new Error('No body stream returned');
      await readBatchStream(res, controller);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setOperationModal(prev => ({
          ...prev,
          statusText: 'Pipeline execution failed.',
          logs: [...prev.logs, `[ERROR]: ${err.message}`].slice(-500),
          isExecuting: false
        }));
      }
      loadPapers();
    }
  }, [batchSteps, operationModal.isExecuting, readBatchStream, showToast, loadPapers]);

  const handleCancelOperation = async () => {
    try {
      const res = await fetch('/api/pdf/batch/cancel', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Pipeline cancellation requested.', 'info');
      } else {
        showToast(data.message, 'warning');
      }
    } catch (e: any) {
      showToast(`Cancellation error: ${e.message}`, 'error');
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    broadcastSync('SYNC_PIPELINE');
  };

  const handleResumeOperation = async () => {
    setOperationModal(prev => ({ ...prev, isWaitingLogin: false }));
    try {
      const res = await fetch('/api/pdf/batch/resume', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Pipeline resume requested.', 'info');
      } else {
        showToast(data.message, 'warning');
        setOperationModal(prev => ({ ...prev, isWaitingLogin: true }));
      }
    } catch (e: any) {
      showToast(`Resume error: ${e.message}`, 'error');
      setOperationModal(prev => ({ ...prev, isWaitingLogin: true }));
    }
  };

  const getTimeEstimates = () => {
    if (!stepStartTime || pipelineStats.current === 0 || pipelineStats.total === 0) {
      return { avgTime: 'calculating...', timeLeft: 'calculating...' };
    }
    const elapsedMs = Date.now() - stepStartTime;
    const elapsedSecs = elapsedMs / 1000;
    
    const avgTime = elapsedSecs / pipelineStats.current;
    const remaining = pipelineStats.total - pipelineStats.current;
    if (remaining <= 0) {
      return { avgTime: `${avgTime.toFixed(1)}s / paper`, timeLeft: 'finishing up...' };
    }
    
    const timeLeftSecs = remaining * avgTime;
    let timeLeftStr = '';
    if (timeLeftSecs > 3600) {
      timeLeftStr = `${Math.floor(timeLeftSecs / 3600)}h ${Math.floor((timeLeftSecs % 3600) / 60)}m`;
    } else if (timeLeftSecs > 60) {
      timeLeftStr = `${Math.floor(timeLeftSecs / 60)}m ${Math.floor(timeLeftSecs % 60)}s`;
    } else {
      timeLeftStr = `${Math.floor(timeLeftSecs)}s`;
    }
    
    return { avgTime: `${avgTime.toFixed(1)}s / paper`, timeLeft: timeLeftStr };
  };

  return {
    batchSteps, setBatchSteps,
    operationModal, setOperationModal,
    isModalMinimized, setIsModalMinimized,
    currentStep, setCurrentStep,
    pipelineStats, setPipelineStats,
    indexingState, setIndexingState,
    logEndRef,
    runBatchExecution,
    handleCancelOperation,
    handleResumeOperation,
    getTimeEstimates
  };
}
