import React, { useState } from 'react';
import { Play, Minus, X, Database, BrainCircuit } from 'lucide-react';
import LLMOperationsCenter from './LLMOperationsCenter';
import { useAppState } from '@/hooks/AppStateProvider';

export default function PipelineExecutionView() {
  const props = useAppState();
  const { 
    activeProject, 
    loadProjects, 
    showToast,
    batchSteps,
    setBatchSteps,
    operationModal,
    runBatchExecution,
    cloudProvider,
    cloudName,
    pipelineStats,
    currentStep,
    formatBytes,
    getTimeEstimates,
    indexingState,
    logEndRef,
    handleResumeOperation,
    handleCancelOperation
  } = props;

  const [activeTab, setActiveTab] = useState<'acquisition' | 'llm'>('acquisition');

  let statsFound = 0;
  let statsNotFound = 0;
  let statsTotal = pipelineStats?.total || 0;
  let statsCurrent = pipelineStats?.current || 0;

  if (currentStep === 'scan') {
    statsFound = pipelineStats.matched;
    statsNotFound = Math.max(0, pipelineStats.current - pipelineStats.matched);
  } else if (currentStep === 'duplicate_scan') {
    statsFound = pipelineStats.matched;
    statsNotFound = 0;
  } else if (currentStep === 'scrape') {
    statsFound = pipelineStats.downloaded;
    statsNotFound = pipelineStats.failed;
  } else if (currentStep === 'map_publisher') {
    statsFound = pipelineStats.current - pipelineStats.failed;
    statsNotFound = pipelineStats.failed;
  } else if (currentStep === 'sync') {
    statsFound = pipelineStats.current;
    statsNotFound = pipelineStats.failed;
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300 relative">
      {/* Top Bar for Tabs */}
      <div className="flex border-b border-border/80 text-[11px] font-bold uppercase tracking-wider gap-6 pb-0.5 select-none shrink-0">
        <button
          onClick={() => setActiveTab('acquisition')}
          className={`flex items-center gap-2 pb-2 transition-all relative ${
            activeTab === 'acquisition'
              ? 'text-foreground border-b-2 border-primary font-black'
              : 'text-muted-foreground hover:text-foreground font-semibold'
          }`}
        >
          <Database className="w-4 h-4" />
          Data Acquisition Pipeline
        </button>
        <button
          onClick={() => setActiveTab('llm')}
          className={`flex items-center gap-2 pb-2 transition-all relative ${
            activeTab === 'llm'
              ? 'text-foreground border-b-2 border-primary font-black'
              : 'text-muted-foreground hover:text-foreground font-semibold'
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          LLM Pipeline Operations
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        {activeTab === 'acquisition' && (
          <div className="h-full flex flex-col bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
             <div className="p-4 border-b border-border/50 bg-secondary/30 flex justify-between items-center shrink-0">
                <h3 className="font-semibold text-sm">Data Acquisition Pipeline</h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-4 border border-border/80 bg-background rounded-lg px-3 py-1.5 shadow-sm">
                    <label className={`flex items-center gap-1.5 font-semibold transition-colors ${operationModal?.isExecuting ? 'text-muted-foreground/50 cursor-not-allowed opacity-50 select-none' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={batchSteps?.duplicate_scan || false}
                        disabled={operationModal?.isExecuting}
                        onChange={(e) => setBatchSteps?.((prev: any) => ({ ...prev, duplicate_scan: e.target.checked }))}
                        className={`rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 ${operationModal?.isExecuting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                      Execute and Review Anti-Duplicate Job
                    </label>

                    <label className={`flex items-center gap-1.5 font-semibold transition-colors ${operationModal?.isExecuting ? 'text-muted-foreground/50 cursor-not-allowed opacity-50 select-none' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={batchSteps?.scan || false}
                        disabled={operationModal?.isExecuting}
                        onChange={(e) => setBatchSteps?.((prev: any) => ({ ...prev, scan: e.target.checked }))}
                        className={`rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 ${operationModal?.isExecuting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                      Match Cache
                    </label>

                    <label className={`flex items-center gap-1.5 font-semibold transition-colors ${operationModal?.isExecuting ? 'text-muted-foreground/50 cursor-not-allowed opacity-50 select-none' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={batchSteps?.scrape || false}
                        disabled={operationModal?.isExecuting}
                        onChange={(e) => setBatchSteps?.((prev: any) => ({ ...prev, scrape: e.target.checked }))}
                        className={`rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 ${operationModal?.isExecuting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                      Scrape PDFs
                    </label>

                    <label className={`flex items-center gap-1.5 font-semibold transition-colors ${operationModal?.isExecuting ? 'text-muted-foreground/50 cursor-not-allowed opacity-50 select-none' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={batchSteps?.map_publisher || false}
                        disabled={operationModal?.isExecuting}
                        onChange={(e) => setBatchSteps?.((prev: any) => ({ ...prev, map_publisher: e.target.checked }))}
                        className={`rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 ${operationModal?.isExecuting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                      Map Publisher
                    </label>

                    <label className={`flex items-center gap-1.5 font-semibold transition-colors group relative flex ${operationModal?.isExecuting ? 'text-muted-foreground/50 cursor-not-allowed opacity-50 select-none' : 'text-muted-foreground hover:text-foreground cursor-pointer'}`} title={`${cloudName} Cloud Synchronization`}>
                      <input
                        type="checkbox"
                        checked={batchSteps?.sync || false}
                        disabled={operationModal?.isExecuting}
                        onChange={(e) => setBatchSteps?.((prev: any) => ({ ...prev, sync: e.target.checked }))}
                        className={`rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 ${operationModal?.isExecuting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                      <span className={batchSteps?.sync ? (operationModal?.isExecuting ? "text-amber-500/50" : "text-amber-500") : ""}>Sync Cloud</span>
                    </label>
                  </div>
                  <button
                    onClick={runBatchExecution}
                    disabled={operationModal?.isExecuting}
                    className={`px-3 py-1.5 font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wide text-[10px] ${operationModal?.isExecuting ? 'bg-muted text-muted-foreground/50 border border-border/50 cursor-not-allowed opacity-50 shadow-none' : 'bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-lg'}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Execute Pipeline
                  </button>
                </div>
             </div>

             <div className="flex-1 p-4 overflow-hidden flex flex-col space-y-4">
                {operationModal?.isOpen ? (
                  <>
                    <div className="space-y-1.5 shrink-0">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground">
                        <span>{operationModal.statusText}</span>
                        <span>{operationModal.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-secondary border border-border rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300 rounded-full" 
                          style={{ width: `${operationModal.progress}%` }} 
                        />
                      </div>
                    </div>

                    {/* Stats Row */}
                    {currentStep && (
                      <div className="grid grid-cols-3 gap-3 shrink-0 text-[10px] select-none">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 flex flex-col items-center justify-center">
                          <span className="font-bold text-emerald-400 uppercase tracking-wide">Processed / Found</span>
                          <span className="text-sm font-black text-emerald-400 mt-0.5">{statsFound} / {statsCurrent}</span>
                        </div>
                        <div className={`rounded-lg p-2 flex flex-col items-center justify-center border ${statsNotFound > 0 ? 'bg-destructive/5 border-destructive/20 text-destructive animate-pulse' : 'bg-secondary border-border text-muted-foreground'}`}>
                          <span className="font-bold uppercase tracking-wide">Failures</span>
                          <span className="text-sm font-black mt-0.5">{statsNotFound}</span>
                        </div>
                        <div className="bg-secondary border border-border rounded-lg p-2 flex flex-col items-center justify-center">
                          <span className="font-bold text-muted-foreground uppercase tracking-wide">Total Target</span>
                          <span className="text-sm font-black text-foreground mt-0.5">{statsTotal || '—'}</span>
                        </div>
                      </div>
                    )}

                    {currentStep && (
                      <div className="bg-secondary/15 border border-border/80 rounded-lg p-2.5 flex items-center justify-between text-[10px] select-none shrink-0 font-semibold text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>Average Speed:</span>
                          <span className="text-foreground font-black">{getTimeEstimates?.().avgTime || '?'} / paper</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>Time Remaining:</span>
                          <span className="text-primary font-black tracking-wide">{getTimeEstimates?.().timeLeft || '?'}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 bg-black text-[10px] text-green-400/90 font-mono rounded-lg p-3 overflow-y-auto custom-scrollbar flex flex-col space-y-1 select-text">
                      {operationModal.logs.slice(-200).map((log: string, idx: number) => (
                        <div key={idx} className={
                          log.includes('✓') || log.includes('[SUCCESS]') || log.includes('>>>') ? 'text-emerald-400' :
                          log.includes('✗') || log.includes('[ERROR]') || log.includes('<<<') ? 'text-destructive' :
                          log.includes('[START]') ? 'text-primary font-bold' :
                          log.includes('[SKIPPED]') ? 'text-amber-500/70' :
                          log.includes('[SCANNING]') ? 'text-muted-foreground/60' : 'text-muted-foreground'
                        }>
                          {log.replace('Γ£ô', '✓').replace('Γ£ù', '✗')}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>

                    <div className="flex justify-end gap-3 shrink-0">
                      {operationModal.isExecuting && operationModal.isWaitingLogin && (
                        <button
                          onClick={handleResumeOperation}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow-md transition-colors animate-pulse"
                        >
                          Resume Download
                        </button>
                      )}
                      {operationModal.isExecuting && (
                        <button
                          onClick={handleCancelOperation}
                          className="px-4 py-1.5 border border-border text-xs font-semibold rounded hover:bg-secondary text-foreground transition-colors"
                        >
                          Cancel Process
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground/50 text-xs flex-col gap-2">
                    <Play className="w-8 h-8 opacity-20" />
                    No acquisition pipeline running.
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'llm' && (
          <div className="h-full">
            <LLMOperationsCenter activeProject={activeProject} />
          </div>
        )}
      </div>
    </div>
  );
}
