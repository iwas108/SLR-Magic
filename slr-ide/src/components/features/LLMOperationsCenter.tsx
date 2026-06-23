import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Play, Pause, XCircle, RotateCcw, AlertTriangle, CloudRain } from 'lucide-react';

interface LLMOperationsCenterProps {
  activeProject: any;
}

export default function LLMOperationsCenter({ activeProject }: LLMOperationsCenterProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('IDLE');
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, processed: 0, cost: 0.0, tokens: 0 });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Parse config to know default mode
  const config = activeProject?.llm_config ? JSON.parse(activeProject.llm_config) : {};
  const executionMode = config.execution_mode || 'standard';

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!activeProject) return;
    
    setLoading(true);
    fetch(`/api/llm/jobs/active?projectId=${activeProject.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.jobs.length > 0) {
          const activeJob = data.jobs[0];
          setJobId(activeJob.job_id);
          setJobStatus(activeJob.status);
          
          if (['RUNNING', 'STARTING', 'PAUSED_BUDGET'].includes(activeJob.status)) {
             connectSSE(activeJob.job_id);
          }
        }
      })
      .catch(err => console.error("Failed to load active jobs", err))
      .finally(() => setLoading(false));

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeProject?.id]); // only re-run if project ID changes

  const connectSSE = async (targetJobId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setConnecting(true);

    try {
      const response = await fetch(`/api/llm/screen/logs?jobId=${targetJobId}`, {
        signal: controller.signal
      });

      setConnecting(false);

      if (!response.body) throw new Error('No body stream returned');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || ''; 

        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            const dataStr = chunk.replace('data: ', '').trim();
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              handleSSEEvent(data);
            } catch (e) {
              // Ignore keepalive heartbeats or parse errors
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
         setLogs(prev => [...prev, { event: 'system', type: 'ERROR', message: `Stream error: ${err.message}` }]);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleSSEEvent = (data: any) => {
    if (data.event === 'log') {
       setLogs(prev => [...prev, data]);
    } else if (data.event === 'progress' || data.event === 'metrics') {
       if (data.metrics) {
         setMetrics(prev => ({ ...prev, ...data.metrics }));
       }
       if (data.message) {
         setLogs(prev => [...prev, data]);
       }
    } else if (data.event === 'status') {
       setJobStatus(data.status);
       setLogs(prev => [...prev, { event: 'system', type: 'INFO', message: `Status transitioned to ${data.status}` }]);
    }
  };

  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    let targetJobId = jobId;
    if (action === 'start') {
      targetJobId = `job-${Date.now()}`;
      setJobId(targetJobId);
      setLogs([{ event: 'system', type: 'INFO', message: 'Initializing new screening job...' }]);
      setMetrics({ total: 0, processed: 0, cost: 0.0, tokens: 0 });
      setJobStatus('STARTING');
    }

    try {
      const res = await fetch('/api/llm/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'start' ? undefined : action,
          mode: action === 'start' ? executionMode : undefined,
          projectId: activeProject.id,
          jobId: targetJobId
        })
      });

      const result = await res.json();
      if (!result.success && !result.jobId) throw new Error(result.error);

      if (action === 'start' || action === 'resume') {
        connectSSE(targetJobId!);
      } else if (action === 'cancel') {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setJobStatus('CANCELLED');
      }

    } catch (err: any) {
       setLogs(prev => [...prev, { event: 'system', type: 'ERROR', message: `Action failed: ${err.message}` }]);
    }
  };

  const handleCheckBatch = async () => {
    setLogs(prev => [...prev, { event: 'system', type: 'INFO', message: 'Triggering Cloud Harvester...' }]);
    // We will build this endpoint in the batch epoch if needed.
    // For now, it's a placeholder for the UI.
    try {
      const res = await fetch(`/api/llm/batch/status?projectId=${activeProject.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => [...prev, { event: 'system', type: 'INFO', message: data.message || 'Harvester complete.' }]);
        if (data.status) setJobStatus(data.status);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setLogs(prev => [...prev, { event: 'system', type: 'ERROR', message: `Harvester error: ${err.message}` }]);
    }
  };

  if (!activeProject) return null;
  if (loading) return <div className="h-full flex items-center justify-center text-muted-foreground"><Activity className="animate-spin w-8 h-8" /></div>;

  const costLimit = activeProject.project_budget_limit || 5.0;
  const costPercentage = Math.min(100, (metrics.cost / costLimit) * 100);
  const isBudgetWarning = costPercentage > 85;

  return (
    <div className="bg-card border border-border/60 rounded-xl shadow-sm flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="px-5 py-4 border-b border-border/50 bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Operations Center</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                jobStatus === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-500' :
                jobStatus === 'PAUSED_BUDGET' ? 'bg-amber-500/20 text-amber-500' :
                jobStatus === 'PROCESSING_BATCH' ? 'bg-blue-500/20 text-blue-500' :
                jobStatus === 'FAILED' ? 'bg-destructive/20 text-destructive' :
                'bg-muted text-muted-foreground'
              }`}>
                {jobStatus}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">{jobId || 'No active session'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {jobStatus === 'IDLE' || jobStatus === 'COMPLETED' || jobStatus === 'FAILED' || jobStatus === 'CANCELLED' ? (
            <button
              onClick={() => handleAction('start')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Start Screening
            </button>
          ) : jobStatus === 'PAUSED_BUDGET' ? (
            <>
              <button
                onClick={() => handleAction('resume')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Resume
              </button>
              <button
                onClick={() => handleAction('cancel')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold rounded-lg transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            </>
          ) : jobStatus === 'PROCESSING_BATCH' ? (
            <button
              onClick={handleCheckBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <CloudRain className="w-3.5 h-3.5" /> Check Batch Status
            </button>
          ) : (
            <button
              onClick={() => handleAction('cancel')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold rounded-lg shadow transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Terminate Job
            </button>
          )}
        </div>
      </div>

      <div className="p-5 border-b border-border/50 grid grid-cols-4 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Papers Processed</p>
          <p className="text-xl font-mono">{metrics.processed} <span className="text-sm text-muted-foreground">/ {metrics.total || '?'}</span></p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Tokens</p>
          <p className="text-xl font-mono">{metrics.tokens.toLocaleString()}</p>
        </div>
        <div className="col-span-2 space-y-1.5">
          <div className="flex justify-between items-end">
             <p className="text-[10px] uppercase font-bold text-muted-foreground">Budget Utilization</p>
             <p className={`text-sm font-mono font-bold ${isBudgetWarning ? 'text-amber-500' : 'text-emerald-500'}`}>
                ${metrics.cost.toFixed(4)} <span className="text-xs text-muted-foreground font-normal">/ ${costLimit.toFixed(2)}</span>
             </p>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
             <div 
               className={`h-full transition-all duration-500 ${isBudgetWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
               style={{ width: `${costPercentage}%` }}
             />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-black text-green-400 font-mono text-[11px] p-4 overflow-y-auto relative custom-scrollbar leading-relaxed">
        {connecting && (
          <div className="absolute top-4 right-4 flex items-center gap-2 text-green-500/50">
            <Activity className="w-3.5 h-3.5 animate-spin" />
            Connecting to stream...
          </div>
        )}
        
        {logs.length === 0 && !connecting && (
          <div className="h-full flex items-center justify-center text-green-500/30 select-none">
            READY FOR INSTRUCTIONS
          </div>
        )}

        <div className="space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-white/5 px-1 py-0.5 rounded transition-colors break-words">
              <span className="text-green-500/50 shrink-0 select-none">
                {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
              </span>
              <span className={`shrink-0 font-black w-16 ${
                log.type === 'ERROR' ? 'text-red-400' : 
                log.type === 'WARNING' ? 'text-yellow-400' : 
                log.type === 'SUCCESS' ? 'text-emerald-400' : 
                'text-green-300'
              }`}>
                [{log.type || 'INFO'}]
              </span>
              <span className={log.type === 'ERROR' ? 'text-red-300' : 'text-green-400/90'}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logEndRef} className="h-1" />
        </div>
      </div>
    </div>
  );
}
