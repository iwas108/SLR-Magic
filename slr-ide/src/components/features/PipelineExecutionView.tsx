import React, { useState } from 'react';
import { Play, Minus, X, Database, BrainCircuit } from 'lucide-react';
import LLMOperationsCenter from './LLMOperationsCenter';
import PipelineProgressPanel from './dashboard/PipelineProgressPanel';

interface PipelineExecutionViewProps {
  projectsHook: {
    activeProject: any;
    loadProjects: () => Promise<any>;
  };
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  formatBytes: (bytes: number) => string;
  pipelineHook: {
    batchSteps: any;
    setBatchSteps: React.Dispatch<React.SetStateAction<any>>;
    operationModal: any;
    runBatchExecution: () => void;
    pipelineStats: any;
    currentStep: any;
    setCurrentStep: React.Dispatch<React.SetStateAction<any>>;
    getTimeEstimates: () => { avgTime: string; timeLeft: string };
    indexingState: any;
    logEndRef: React.RefObject<HTMLDivElement | null>;
    handleResumeOperation: () => void;
    handleCancelOperation: () => void;
    setOperationModal: React.Dispatch<React.SetStateAction<any>>;
  };
}

export default function PipelineExecutionView({
  projectsHook,
  showToast,
  formatBytes,
  pipelineHook
}: PipelineExecutionViewProps) {
  const { activeProject, loadProjects } = projectsHook;
  const {
    batchSteps,
    setBatchSteps,
    operationModal,
    runBatchExecution,
    pipelineStats,
    currentStep,
    setCurrentStep,
    getTimeEstimates,
    indexingState,
    logEndRef,
    handleResumeOperation,
    handleCancelOperation,
    setOperationModal
  } = pipelineHook;

  const cloudProvider = activeProject?.cloud_provider || 'gdrive';
  const cloudName = cloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive';

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

             <div className="flex-1 overflow-hidden p-4">
                {operationModal?.isOpen ? (
                  <PipelineProgressPanel
                    operationModal={operationModal}
                    setOperationModal={setOperationModal}
                    currentStep={currentStep}
                    setCurrentStep={setCurrentStep}
                    pipelineStats={pipelineStats}
                    indexingState={indexingState}
                    logEndRef={logEndRef}
                    formatBytes={formatBytes}
                    getTimeEstimates={getTimeEstimates}
                    handleResumeOperation={handleResumeOperation}
                    handleCancelOperation={handleCancelOperation}
                    cloudName={cloudName}
                    isMinimizable={false}
                  />
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
