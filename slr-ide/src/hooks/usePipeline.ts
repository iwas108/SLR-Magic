import { useState, useRef, useEffect, useCallback } from 'react';
import { broadcastSync } from '@/lib/sync-utils';

export function usePipeline(showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void, loadPapers: () => void) {
  const [batchSteps, setBatchSteps] = useState<Record<string, boolean>>({
    duplicate_scan: false,
    scan: false,
    scrape: false,
    map_publisher: false,
    sync: false
  });

  const [operationModal, setOperationModal] = useState<{
    isOpen: boolean;
    type: 'scan' | 'scrape' | 'sync' | 'map_publisher' | null;
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
    // 1. Step Start/Complete markers
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
      if (data.current === data.total) {
        if ((window as any).indexingTimer) {
          clearTimeout((window as any).indexingTimer);
        }
        (window as any).indexingTimer = setTimeout(() => {
          setIndexingState(null);
        }, 10000);
      }
    } else if (data.event === 'clear_indexing') {
      setIndexingState(null);
    } else if (data.event === 'log') {
      setOperationModal(prev => ({
        ...prev,
        logs: [...prev.logs, data.message].slice(-500)
      }));
    } else if (data.info) {
      setOperationModal(prev => ({
        ...prev,
        logs: [...prev.logs, `[INFO]: ${data.info}`].slice(-500)
      }));
    } else if (data.event === 'comparing') {
      setOperationModal(prev => ({
        ...prev,
        currentItem: `${prev.currentItem?.split(' | ')[0] || prev.currentItem} | Comparing: ${data.filename}`
      }));
    }
    
    // 2. Step specific events
    // Cache Scan Matcher events
    else if (data.step === 'scan') {
      if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        setPipelineStats(prev => ({
          ...prev,
          current: data.current,
          total: data.total
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: `Paper: ${data.paper_id} - "${data.title}"`,
          statusText: `Matching Cache: paper ${data.current} of ${data.total}...`
        }));
      } else if (data.event === 'match') {
        setPipelineStats(prev => ({
          ...prev,
          matched: prev.matched + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ Matched: ${data.paper_id} - "${data.filename}" (${data.method})`].slice(-500),
          statusText: `Matched paper ${data.paper_id}...`
        }));
      }
    } 
    
    // Duplicate scan events
    else if (data.step === 'duplicate_scan') {
      if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        setPipelineStats(prev => ({
          ...prev,
          current: data.current,
          total: data.total,
          matched: data.matched !== undefined ? data.matched : prev.matched
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: data.currentItem ? `Comparing: "${data.currentItem}"` : undefined,
          statusText: `Scanning duplicates: paper ${data.current} of ${data.total}...`
        }));
      }
    }    
    // Scraper events
    else if (data.step === 'scrape') {
      if (data.event === 'start') {
        setPipelineStats(prev => ({
          ...prev,
          total: data.total,
          current: 0
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `Scraper starting for ${data.total} papers...`].slice(-500),
          statusText: 'Launching Scraper...'
        }));
      } else if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        setPipelineStats(prev => ({
          ...prev,
          current: data.current
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: data.title,
          statusText: `Scraping: paper ${data.current} of ${data.total}...`,
          logs: [...prev.logs, `[Scrape ${data.current}/${data.total}] Attempting download for: "${data.title}"`].slice(-500)
        }));
      } else if (data.event === 'paper_success') {
        setPipelineStats(prev => ({
          ...prev,
          downloaded: prev.downloaded + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ Downloaded and saved PDF for ${data.paper_id}.`].slice(-500)
        }));
      } else if (data.event === 'paper_fail') {
        setPipelineStats(prev => ({
          ...prev,
          failed: prev.failed + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✗ Download failed for ${data.paper_id}: ${data.error}`].slice(-500)
        }));
      } else if (data.event === 'sleep') {
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `Scraper rate limit delay: sleeping for ${data.duration}s...`].slice(-500)
        }));
      }
    } 
    
    // Compressor events
    else if (data.step === 'compress') {
      if (data.event === 'start') {
        setPipelineStats(prev => ({
          ...prev,
          total: data.total,
          current: 0
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `Compressor starting for ${data.total} files...`].slice(-500),
          statusText: 'Launching Compressor...'
        }));
      } else if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        const origSize = data.original_size || 0;
        const newSize = data.new_size || 0;
        const savedSpace = Math.max(0, origSize - newSize);

        setPipelineStats(prev => ({
          ...prev,
          current: data.current,
          originalSpaceBytes: (prev.originalSpaceBytes || 0) + (data.skipped ? 0 : origSize),
          savedSpaceBytes: (prev.savedSpaceBytes || 0) + (data.skipped ? 0 : savedSpace)
        }));

        const formatBytesLocal = (bytes: number) => {
          if (!bytes || bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        const ratioText = data.skipped
          ? ` (${formatBytesLocal(origSize)}, Already Processed)`
          : (data.ratio > 0 
              ? ` (${formatBytesLocal(origSize)} -> ${formatBytesLocal(newSize)}, saved -${data.ratio}%)` 
              : ` (${formatBytesLocal(origSize)}, Direct Copy)`);

        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: `${data.paper_id}.pdf`,
          statusText: `Compressing: file ${data.current} of ${data.total}...`,
          logs: [...prev.logs, `[Compress ${data.current}/${data.total}] Processed ${data.paper_id}.pdf${ratioText}`].slice(-500)
        }));
      }
    } 
    
    // Map Publisher events
    else if (data.step === 'map_publisher') {
      if (data.event === 'start') {
        setPipelineStats(prev => ({
          ...prev,
          total: data.total,
          current: 0,
          failed: 0
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `Publisher mapping starting for ${data.total} papers...`].slice(-500),
          statusText: 'Launching Publisher Mapper...'
        }));
      } else if (data.event === 'progress') {
        const percent = Math.round((data.current / data.total) * 100);
        setPipelineStats(prev => ({
          ...prev,
          current: data.current
        }));
        setOperationModal(prev => ({
          ...prev,
          progress: percent,
          currentItem: data.title,
          statusText: `Mapping Publisher: paper ${data.current} of ${data.total}...`,
          logs: [...prev.logs, `[Map ${data.current}/${data.total}] Processing publisher for: "${data.title}"`].slice(-500)
        }));
      } else if (data.event === 'paper_success') {
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ Mapped publisher for ${data.paper_id}.`].slice(-500)
        }));
      } else if (data.event === 'paper_fail') {
        setPipelineStats(prev => ({
          ...prev,
          failed: prev.failed + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✗ Publisher mapping failed for ${data.paper_id}: ${data.error}`].slice(-500)
        }));
      }
    }
    
    // Sync events
    else if (data.step === 'sync') {
      if (data.event === 'start') {
        setPipelineStats(prev => ({
          ...prev,
          total: data.total,
          current: 0,
          failed: 0
        }));
      } else if (data.event === 'rclone_log') {
        const match = data.message.match(/INFO\s*:\s*([^:]+\.pdf):\s*(.*)/i);
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, data.message].slice(-500),
          currentItem: match ? `Syncing: ${match[1]} (${match[2]})` : prev.currentItem
        }));
      } else if (data.event === 'linking') {
        setOperationModal(prev => ({
          ...prev,
          currentItem: `Linking paper: ${data.paper_id}`
        }));
      } else if (data.event === 'link_success') {
        setPipelineStats(prev => ({
          ...prev,
          current: prev.current + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✓ link generated for ${data.paper_id}: ${data.link}`].slice(-500)
        }));
      } else if (data.event === 'link_fail') {
        setPipelineStats(prev => ({
          ...prev,
          failed: prev.failed + 1
        }));
        setOperationModal(prev => ({
          ...prev,
          logs: [...prev.logs, `✗ link failed for ${data.paper_id}: ${data.message}`].slice(-500)
        }));
      }
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
      // Step 1: Sequential Duplicate Scanning
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

        // Check if aborted/cancelled during duplicate scan
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
