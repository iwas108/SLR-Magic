import { useState, useEffect, useRef, useCallback } from 'react';
import { broadcastSync } from '@/lib/sync-utils';

interface UsePipelineProps {
  loadPapers: () => void;
  loadProjects: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  compressOnSync: boolean;
}

export function usePipeline({
  loadPapers,
  loadProjects,
  showToast,
  compressOnSync
}: UsePipelineProps) {
  const [batchSteps, setBatchSteps] = useState<Record<string, boolean>>({
    duplicate_scan: false,
    scan: false,
    scrape: false,
    map_publisher: false,
    sync: false
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
  const [currentStep, setCurrentStep] = useState<'scan' | 'duplicate_scan' | 'scrape' | 'compress' | 'sync' | 'map_publisher' | null>(null);
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

  // Time estimator ticker
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

  // Indexing auto-dismiss
  useEffect(() => {
    if (indexingState && indexingState.current === indexingState.total) {
      const indexingTimer = setTimeout(() => {
        setIndexingState(null);
      }, 10000);
      return () => clearTimeout(indexingTimer);
    }
  }, [indexingState]);

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
        isWaitingLogin: false,
        logs: [...prev.logs, `[ERROR]: ${data.message}`].slice(-500),
        isExecuting: false
      }));
    } else if (data.event === 'waiting_login') {
      setOperationModal(prev => ({
        ...prev,
        isWaitingLogin: true,
        statusText: data.message,
        logs: [...prev.logs, `[ACTION REQUIRED]: ${data.message}`].slice(-500)
      }));
    } else if (data.event === 'resume') {
      setOperationModal(prev => ({
        ...prev,
        isWaitingLogin: false
      }));
    } else if (data.event === 'indexing') {
      setIndexingState({
        filename: data.filename,
        tool: data.tool,
        current: data.current,
        total: data.total
      });
    } else if (data.event === 'progress') {
      setOperationModal(prev => ({
        ...prev,
        progress: data.pct || prev.progress,
        statusText: data.message || prev.statusText,
        logs: data.log ? [...prev.logs, data.log].slice(-500) : prev.logs
      }));
      if (data.currentItem) {
        setOperationModal(prev => ({
          ...prev,
          currentItem: data.currentItem
        }));
      }
      if (data.pipelineStats) {
        setPipelineStats(prev => ({
          ...prev,
          ...data.pipelineStats
        }));
      }
    } else if (data.event === 'log') {
      setOperationModal(prev => ({
        ...prev,
        logs: [...prev.logs, data.message].slice(-500)
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
      buffer = lines.pop() || '';

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
          setOperationModal(prev => ({
            ...prev,
            logs: [...prev.logs, line].slice(-500)
          }));
        }
      }
    }

    setOperationModal(prev => ({
      ...prev,
      progress: 100,
      isExecuting: false
    }));
    loadPapers();
    loadProjects();
    broadcastSync('SYNC_PIPELINE');
    broadcastSync('SYNC_PAPERS');
  }, [loadPapers, loadProjects, handleBatchEvent]);

  const subscribeToBatchStream = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await fetch('/api/pdf/batch?stream=true', {
        signal: controller.signal
      });
      await readBatchStream(res, controller);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast(`Failed to reconnect to batch stream: ${err.message}`, 'error');
      }
    }
  }, [readBatchStream, showToast]);

  const checkBatchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pdf/batch');
      if (res.ok) {
        const data = await res.json();
        if (data.isExecuting) {
          subscribeToBatchStream();
        }
      }
    } catch (e) {
      console.error('Error checking batch status:', e);
    }
  }, [subscribeToBatchStream]);

  const runBatchExecution = useCallback(async () => {
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
      // Step 1: Duplicate Scanning
      if (batchSteps.duplicate_scan) {
        setOperationModal(prev => ({
          ...prev,
          statusText: 'Starting duplicate scan...',
          logs: ['>>> Launching Duplicate Paper Detection...']
        }));
        
        const resScan = await fetch('/api/duplicates/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        });
        
        broadcastSync('SYNC_PIPELINE');
        
        if (!resScan.body) throw new Error('No duplicate scan stream returned');
        await readBatchStream(resScan, controller);

        if (controller.signal.aborted) {
          return;
        }
      }

      // Step 2: Next steps in batch execution
      const otherSteps = activeSteps.filter(k => k !== 'duplicate_scan');
      if (otherSteps.length > 0) {
        setOperationModal(prev => ({
          ...prev,
          statusText: 'Transitioning to PDF batch acquisition...',
          logs: [...prev.logs, '>>> Starting PDF Acquisition & Sync...'],
          isExecuting: true
        }));

        const res = await fetch('/api/pdf/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps: otherSteps, compress: compressOnSync }),
          signal: controller.signal
        });

        broadcastSync('SYNC_PIPELINE');

        if (!res.body) throw new Error('No body stream returned');
        await readBatchStream(res, controller);
      }

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
  }, [batchSteps, compressOnSync, loadPapers, operationModal.isExecuting, readBatchStream, showToast]);

  const handleCancelOperation = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setOperationModal(prev => ({
      ...prev,
      statusText: 'Cancelling pipeline...',
      logs: [...prev.logs, '>>> Cancellation requested by user...']
    }));

    try {
      await fetch('/api/pdf/batch/cancel', { method: 'POST' });
      setOperationModal(prev => ({
        ...prev,
        isExecuting: false,
        statusText: 'Pipeline execution cancelled.',
        logs: [...prev.logs, '[CANCELLED]: Sequential operations halted by user.']
      }));
      loadPapers();
      broadcastSync('SYNC_PIPELINE');
      broadcastSync('SYNC_PAPERS');
    } catch (e: any) {
      console.error('Error cancelling pipeline:', e);
      setOperationModal(prev => ({
        ...prev,
        isExecuting: false,
        statusText: 'Pipeline execution cancelled (error sending signal).'
      }));
    }
  }, [loadPapers]);

  const handleResumeOperation = useCallback(async () => {
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
  }, [showToast]);

  const getTimeEstimates = useCallback(() => {
    if (!stepStartTime || pipelineStats.current === 0 || pipelineStats.total === 0) {
      return { avgTime: 'calculating...', timeLeft: 'calculating...' };
    }
    const elapsedMs = Date.now() - stepStartTime;
    const elapsedSecs = elapsedMs / 1000;
    
    const avgTime = elapsedSecs / pipelineStats.current;
    const remaining = pipelineStats.total - pipelineStats.current;
    if (remaining <= 0) {
      return { avgTime: `${avgTime.toFixed(2)}s`, timeLeft: '0s' };
    }
    
    const timeLeftSecs = remaining * avgTime;
    let timeLeftStr = '';
    if (timeLeftSecs > 3600) {
      const h = Math.floor(timeLeftSecs / 3600);
      const m = Math.floor((timeLeftSecs % 3600) / 60);
      timeLeftStr = `${h}h ${m}m`;
    } else if (timeLeftSecs > 60) {
      const m = Math.floor(timeLeftSecs / 60);
      const s = Math.floor(timeLeftSecs % 60);
      timeLeftStr = `${m}m ${s}s`;
    } else {
      timeLeftStr = `${Math.round(timeLeftSecs)}s`;
    }
    
    return {
      avgTime: `${avgTime.toFixed(2)}s`,
      timeLeft: timeLeftStr
    };
  }, [stepStartTime, pipelineStats]);

  return {
    batchSteps,
    setBatchSteps,
    operationModal,
    setOperationModal,
    isModalMinimized,
    setIsModalMinimized,
    currentStep,
    setCurrentStep,
    pipelineStats,
    setPipelineStats,
    stepStartTime,
    setStepStartTime,
    timeTicker,
    indexingState,
    setIndexingState,
    abortControllerRef,
    logEndRef,
    checkBatchStatus,
    runBatchExecution,
    handleCancelOperation,
    handleResumeOperation,
    getTimeEstimates
  };
}