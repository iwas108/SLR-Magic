import React from 'react';
import { Play, Minus, X, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

interface PipelineProgressPanelProps {
  operationModal: {
    isOpen: boolean;
    type: 'scan' | 'scrape' | 'sync' | null;
    title: string;
    progress: number;
    statusText: string;
    logs: string[];
    currentItem?: string;
    isExecuting?: boolean;
    isWaitingLogin?: boolean;
  };
  setOperationModal: (val: any) => void;
  currentStep: 'scan' | 'duplicate_scan' | 'verify' | 'scrape' | 'compress' | 'sync' | 'map_publisher' | null;
  setCurrentStep: (step: any) => void;
  pipelineStats: {
    matched: number;
    downloaded: number;
    failed: number;
    current: number;
    total: number;
    savedSpaceBytes: number;
    originalSpaceBytes: number;
  };
  indexingState: {
    filename: string;
    tool: string;
    current: number;
    total: number;
  } | null;
  logEndRef: React.RefObject<HTMLDivElement | null>;
  formatBytes: (bytes: number, decimals?: number) => string;
  getTimeEstimates: () => { avgTime: string; timeLeft: string };
  handleResumeOperation: () => void;
  handleCancelOperation: () => void;
  cloudName?: string;
  isMinimizable?: boolean;
  setIsModalMinimized?: (minimized: boolean) => void;
}

export default function PipelineProgressPanel({
  operationModal,
  setOperationModal,
  currentStep,
  setCurrentStep,
  pipelineStats,
  indexingState,
  logEndRef,
  formatBytes,
  getTimeEstimates,
  handleResumeOperation,
  handleCancelOperation,
  cloudName = 'Cloud',
  isMinimizable = false,
  setIsModalMinimized
}: PipelineProgressPanelProps) {
  let statsFound = 0;
  let statsNotFound = 0;
  const statsTotal = pipelineStats?.total || 0;
  const statsCurrent = pipelineStats?.current || 0;

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
  } else if (currentStep === 'verify') {
    statsFound = pipelineStats.current - pipelineStats.failed;
    statsNotFound = pipelineStats.failed;
  } else if (currentStep === 'sync') {
    statsFound = pipelineStats.current;
    statsNotFound = pipelineStats.failed;
  }

  const handleClose = () => {
    setOperationModal((prev: any) => ({ ...prev, isOpen: false }));
    setCurrentStep(null);
  };

  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/25 shrink-0">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-primary fill-current animate-pulse" />
          <h3 className="font-bold text-sm">{operationModal.title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isMinimizable && setIsModalMinimized && (
            <button
              type="button"
              onClick={() => setIsModalMinimized(true)}
              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"
              title="Minimize to Widget"
            >
              <Minus className="w-4 h-4" />
              Minimize
            </button>
          )}
          {!operationModal.isExecuting && (
            <button 
              onClick={handleClose} 
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto flex flex-col space-y-4">
        {/* Progress bar */}
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

        {/* Statistics Row */}
        {currentStep && (
          (() => {
            if (currentStep === 'compress') {
              const ratio = pipelineStats.originalSpaceBytes > 0 
                ? (pipelineStats.savedSpaceBytes / pipelineStats.originalSpaceBytes) * 100 
                : 0;
              return (
                <div className="grid grid-cols-3 gap-3 shrink-0 text-[10px] select-none">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 flex flex-col items-center justify-center">
                    <span className="font-bold text-emerald-400 uppercase tracking-wide">Processed / Total</span>
                    <span className="text-sm font-black text-emerald-400 mt-0.5">{statsCurrent} / {statsTotal || '—'}</span>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 flex flex-col items-center justify-center">
                    <span className="font-bold text-primary uppercase tracking-wide">Space Saved</span>
                    <span className="text-sm font-black text-primary mt-0.5">{formatBytes(pipelineStats.savedSpaceBytes)}</span>
                  </div>
                  <div className="bg-secondary border border-border rounded-lg p-2 flex flex-col items-center justify-center">
                    <span className="font-bold text-muted-foreground uppercase tracking-wide">Original Total Size</span>
                    <span className="text-sm font-black text-foreground mt-0.5">
                      {formatBytes(pipelineStats.originalSpaceBytes)} {ratio > 0 ? `(-${ratio.toFixed(1)}%)` : ''}
                    </span>
                  </div>
                </div>
              );
            }

            if (currentStep === 'sync') {
              const isLinking = pipelineStats.total > 0;
              const syncStatus = isLinking ? "Generating Links..." : "Syncing Files (Rclone)...";
              return (
                <div className="grid grid-cols-3 gap-3 shrink-0 text-[10px] select-none animate-in fade-in zoom-in duration-200">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 flex flex-col items-center justify-center">
                    <span className="font-bold text-primary uppercase tracking-wide">Sync Phase</span>
                    <span className="text-sm font-black text-primary mt-0.5">{syncStatus}</span>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 flex flex-col items-center justify-center">
                    <span className="font-bold text-emerald-400 uppercase tracking-wide">Links Generated</span>
                    <span className="text-sm font-black text-emerald-400 mt-0.5">{statsFound} / {statsTotal || '—'}</span>
                  </div>
                  <div className={`rounded-lg p-2 flex flex-col items-center justify-center border ${statsNotFound > 0 ? 'bg-destructive/5 border-destructive/20 text-destructive animate-pulse' : 'bg-secondary border-border text-muted-foreground'}`}>
                    <span className={`font-bold uppercase tracking-wide ${statsNotFound > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>Link Failures</span>
                    <span className={`text-sm font-black mt-0.5 ${statsNotFound > 0 ? 'text-destructive' : 'text-foreground'}`}>{statsNotFound}</span>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-3 gap-3 shrink-0 text-[10px] select-none">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 flex flex-col items-center justify-center">
                  <span className="font-bold text-emerald-400 uppercase tracking-wide">Found / Success</span>
                  <span className="text-sm font-black text-emerald-400 mt-0.5">{statsFound}</span>
                </div>
                <div className={`rounded-lg p-2 flex flex-col items-center justify-center border ${statsNotFound > 0 ? 'bg-destructive/5 border-destructive/20 text-destructive animate-pulse' : 'bg-secondary border-border text-muted-foreground'}`}>
                  <span className="font-bold uppercase tracking-wide">Not Found / Fail</span>
                  <span className="text-sm font-black mt-0.5">{statsNotFound}</span>
                </div>
                <div className="bg-secondary border border-border rounded-lg p-2 flex flex-col items-center justify-center">
                  <span className="font-bold text-muted-foreground uppercase tracking-wide">Processed / Total</span>
                  <span className="text-sm font-black text-foreground mt-0.5">{statsCurrent} / {statsTotal || '—'}</span>
                </div>
              </div>
            );
          })()
        )}

        {/* Time Estimations */}
        {currentStep && (
          (() => {
            const { avgTime, timeLeft } = getTimeEstimates();
            return (
              <div className="bg-secondary/15 border border-border/80 rounded-lg p-2.5 flex items-center justify-between text-[10px] select-none shrink-0 font-semibold text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
                  <span>Average Speed:</span>
                  <span className="text-foreground font-black">{avgTime} / paper</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Time Remaining:</span>
                  <span className="text-primary font-black tracking-wide">{timeLeft}</span>
                </div>
              </div>
            );
          })()
        )}

        {/* Indexing state */}
        {indexingState && (
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 flex items-center justify-between text-[10px] select-none shrink-0 font-semibold text-muted-foreground animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 text-primary max-w-[70%]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
              <span className="shrink-0 font-bold">Indexing Cache:</span>
              <span className="text-foreground font-black truncate" title={indexingState.filename}>
                {indexingState.filename}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span>
                Tool: <span className="text-foreground font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px]">{indexingState.tool}</span>
              </span>
              <span className="text-primary font-bold">
                ({indexingState.current}/{indexingState.total})
              </span>
            </div>
          </div>
        )}

        {/* Current Active Item */}
        {operationModal.currentItem && (
          <div className="bg-secondary/30 border border-border rounded-lg p-2.5 text-[10px] font-bold text-foreground shrink-0 whitespace-normal break-words">
            Current paper: {operationModal.currentItem}
          </div>
        )}

        {/* Logs terminal */}
        <div className="bg-black text-[10px] text-green-400/90 font-mono rounded-lg p-3 overflow-y-auto flex flex-col space-y-1 select-text resize-y min-h-[250px] max-h-[800px] h-[380px]">
          {operationModal.logs.slice(-500).map((log: string, idx: number) => (
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
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border flex items-center justify-end bg-secondary/25 shrink-0 gap-3">
        {operationModal.isExecuting && operationModal.isWaitingLogin && (
          <button
            onClick={handleResumeOperation}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white hover:text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5 animate-pulse"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Resume Download
          </button>
        )}
        {operationModal.isExecuting && (
          <button
            onClick={handleCancelOperation}
            className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
          >
            Cancel Process
          </button>
        )}
        {!operationModal.isExecuting && (
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors"
          >
            Close Window
          </button>
        )}
      </div>
    </div>
  );
}
