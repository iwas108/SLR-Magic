'use client';

import React from 'react';
import { Maximize2, X } from 'lucide-react';

interface MinimizedPipelineBannerProps {
  pipelineHook: {
    operationModal: any;
    setOperationModal: React.Dispatch<React.SetStateAction<any>>;
    isModalMinimized: boolean;
    setIsModalMinimized: React.Dispatch<React.SetStateAction<boolean>>;
    pipelineStats: any;
    currentStep: any;
    setCurrentStep: React.Dispatch<React.SetStateAction<any>>;
    getTimeEstimates: () => { avgTime: string; timeLeft: string };
    indexingState: any;
    handleResumeOperation: () => void;
    handleCancelOperation: () => void;
  };
  activeTab: string;
  formatBytes: (bytes: number) => string;
}

export default function MinimizedPipelineBanner({
  pipelineHook,
  activeTab,
  formatBytes
}: MinimizedPipelineBannerProps) {
  const {
    operationModal,
    setOperationModal,
    isModalMinimized,
    setIsModalMinimized,
    pipelineStats,
    currentStep,
    setCurrentStep,
    getTimeEstimates,
    indexingState,
    handleResumeOperation,
    handleCancelOperation
  } = pipelineHook;

  if (!operationModal?.isOpen || !isModalMinimized || activeTab === 'full-execution') {
    return null;
  }

  let statsFound = 0;
  let statsNotFound = 0;
  let statsTotal = pipelineStats?.total || 0;
  let statsCurrent = pipelineStats?.current || 0;

  if (currentStep === 'scan') {
    statsFound = pipelineStats?.matched || 0;
    statsNotFound = Math.max(0, (pipelineStats?.current || 0) - (pipelineStats?.matched || 0));
  } else if (currentStep === 'duplicate_scan') {
    statsFound = pipelineStats?.matched || 0;
    statsNotFound = 0;
  } else if (currentStep === 'scrape') {
    statsFound = pipelineStats?.downloaded || 0;
    statsNotFound = pipelineStats?.failed || 0;
  } else if (currentStep === 'compress') {
    statsFound = pipelineStats?.current || 0;
    statsNotFound = 0;
  } else if (currentStep === 'map_publisher') {
    statsFound = (pipelineStats?.current || 0) - (pipelineStats?.failed || 0);
    statsNotFound = pipelineStats?.failed || 0;
  } else if (currentStep === 'sync') {
    statsFound = pipelineStats?.current || 0;
    statsNotFound = pipelineStats?.failed || 0;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 bg-card/95 border border-border rounded-xl shadow-2xl p-4 flex flex-col gap-3 backdrop-blur-lg animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold text-foreground">Pipeline running...</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsModalMinimized(false)}
            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
            title="Expand Window"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Expand
          </button>
          {!operationModal.isExecuting && (
            <button 
              onClick={() => {
                setOperationModal((prev: any) => ({ ...prev, isOpen: false }));
                setCurrentStep(null);
              }}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center text-[9px] font-bold uppercase text-muted-foreground">
          <span className="truncate max-w-[200px]">{operationModal.statusText}</span>
          <span>{operationModal.progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary border border-border rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 rounded-full" 
            style={{ width: `${operationModal.progress}%` }} 
          />
        </div>
      </div>

      {currentStep && (
        (() => {
          if (currentStep === 'compress') {
            const ratio = (pipelineStats?.originalSpaceBytes || 0) > 0 
              ? ((pipelineStats?.savedSpaceBytes || 0) / pipelineStats.originalSpaceBytes) * 100 
              : 0;
            return (
              <div className="grid grid-cols-3 gap-2 text-[9px] text-center select-none pt-1 border-t border-border/50">
                <div className="flex flex-col">
                  <span className="font-semibold text-emerald-400">Processed</span>
                  <span className="font-black text-emerald-400 text-xs mt-0.5">{statsCurrent}/{statsTotal || '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-primary">Saved</span>
                  <span className="font-black text-primary text-xs mt-0.5">{formatBytes(pipelineStats?.savedSpaceBytes || 0)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-muted-foreground">Original</span>
                  <span className="font-black text-foreground text-xs mt-0.5">
                    {formatBytes(pipelineStats?.originalSpaceBytes || 0)} {ratio > 0 ? `(-${ratio.toFixed(1)}%)` : ''}
                  </span>
                </div>
              </div>
            );
          }

          if (currentStep === 'sync') {
            const isLinking = (pipelineStats?.total || 0) > 0;
            const syncStatus = isLinking ? "Linking" : "Syncing";
            return (
              <div className="grid grid-cols-3 gap-2 text-[9px] text-center select-none pt-1 border-t border-border/50 animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col">
                  <span className="font-semibold text-primary">Phase</span>
                  <span className="font-black text-primary text-[10px] mt-0.5">{syncStatus}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-emerald-400">Linked</span>
                  <span className="font-black text-emerald-400 text-[10px] mt-0.5">{statsFound}/{statsTotal || '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className={`font-semibold ${statsNotFound > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}>Failures</span>
                  <span className={`font-black text-[10px] mt-0.5 ${statsNotFound > 0 ? 'text-destructive' : 'text-foreground'}`}>{statsNotFound}</span>
                </div>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-3 gap-2 text-[9px] text-center select-none pt-1 border-t border-border/50">
              <div className="flex flex-col">
                <span className="font-semibold text-emerald-400">Found</span>
                <span className="font-black text-emerald-400 text-xs mt-0.5">{statsFound}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-destructive">Not Found</span>
                <span className="font-black text-destructive text-xs mt-0.5">{statsNotFound}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-muted-foreground">Total</span>
                <span className="font-black text-foreground text-xs mt-0.5">{statsCurrent}/{statsTotal || '—'}</span>
              </div>
            </div>
          );
        })()
      )}

      {currentStep && (
        (() => {
          const { timeLeft } = getTimeEstimates();
          return (
            <div className="text-[9px] text-muted-foreground flex justify-between items-center select-none pt-1 border-t border-border/30">
              <span>Time Remaining:</span>
              <span className="font-bold text-primary">{timeLeft}</span>
            </div>
          );
        })()
      )}

      {indexingState && (
        <div className="text-[9px] text-muted-foreground flex justify-between items-center select-none pt-1 border-t border-border/30 gap-2">
          <span className="truncate max-w-[170px] font-semibold text-primary">
            Indexing: <span className="text-foreground">{indexingState.filename}</span>
          </span>
          <span className="font-bold shrink-0">
            Tool: <span className="text-foreground uppercase bg-primary/10 text-primary px-1 rounded text-[8px]">{indexingState.tool}</span> ({indexingState.current}/{indexingState.total})
          </span>
        </div>
      )}

      {operationModal.isExecuting && operationModal.isWaitingLogin && (
        <button
          onClick={handleResumeOperation}
          className="w-full py-1 text-center bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold uppercase rounded-lg transition-colors mt-1 animate-pulse"
        >
          Resume Download
        </button>
      )}
      {operationModal.isExecuting && (
        <button
          onClick={handleCancelOperation}
          className="w-full py-1 text-center border border-destructive/20 hover:bg-destructive/10 text-destructive text-[9px] font-bold uppercase rounded-lg transition-colors mt-1"
        >
          Cancel Process
        </button>
      )}
    </div>
  );
}
