'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Download,
  RotateCcw,
  Play,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  ShieldCheck
} from 'lucide-react';
import { useMockupReview } from '@/hooks/useMockupReview';

interface MockupReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId: string;
  activeProject: any;
  activePoolTab?: 'pool_a' | 'pool_b' | 'pool_c';
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function MockupReviewModal({
  isOpen,
  onClose,
  activeProjectId,
  activeProject,
  activePoolTab = 'pool_a',
  showToast
}: MockupReviewModalProps) {
  const {
    selectedPool,
    reviewerName,
    loadingCache,
    cacheInfo,
    progressState,
    liveResults,
    includedCount,
    excludedCount,
    evaluatedCount,
    exclusionBreakdown,
    setReviewerName,
    handlePoolChange,
    handleRegenerateName,
    handleGenerate,
    handleRedownload,
    handleRerun
  } = useMockupReview(activeProjectId, activePoolTab, showToast);

  const [showPaperList, setShowPaperList] = useState(false);
  const [showResultLog, setShowResultLog] = useState(true);

  // Close on Escape key press when not actively running
  React.useEffect(() => {
    if (!isOpen || progressState.isRunning) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, progressState.isRunning, onClose]);

  if (!isOpen) return null;

  const poolMeta = {
    pool_a: {
      name: 'Pool A',
      stageName: 'Stage 1: Fast Filter',
      promptType: 'fast_filter',
      desc: 'Title & Abstract binary screening for broad domain inclusion.'
    },
    pool_b: {
      name: 'Pool B',
      stageName: 'Stage 2: Gatekeeper',
      promptType: 'gatekeeper',
      desc: 'Full-text structural screening verifying strict exclusion criteria.'
    },
    pool_c: {
      name: 'Pool C',
      stageName: 'Stage 3 & 4: Scientist + Miner',
      promptType: 'scientist_miner',
      desc: 'Two sequential calls per paper: Quality Assessment scoring + FAIR Data Extraction.'
    }
  }[selectedPool];

  const papers = cacheInfo?.papers_preview || [];
  const occupiedSlots = cacheInfo?.occupied_slots || 0;
  const isSlotsFull = occupiedSlots >= 2;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => {
        if (!progressState.isRunning) {
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Multi-Pool Mockup Review Generator</h3>
                <span className="text-xs px-2 py-0.5 font-mono font-semibold bg-muted text-muted-foreground rounded-md border border-border">
                  CTRL+M
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate LLM-driven blinded <code className="font-mono text-primary">.slr</code> files isolated from PRISMA screening records.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={progressState.isRunning}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Pool Selection Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Target Calibration Pool
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'pool_a', label: 'Pool A (Fast Filter)', badge: 'Stage 1' },
                { id: 'pool_b', label: 'Pool B (Gatekeeper)', badge: 'Stage 2' },
                { id: 'pool_c', label: 'Pool C (Scientist + Miner)', badge: 'Stage 3 & 4' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={progressState.isRunning}
                  onClick={() => handlePoolChange(tab.id as any)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    selectedPool === tab.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border bg-card/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {tab.badge}
                    </span>
                    {cacheInfo?.cached && selectedPool === tab.id && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> Cached
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{tab.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" /> {poolMeta.desc}
            </p>
          </div>

          {/* Reviewer Identity & Slot Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reviewer Name */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Reviewer Identifier
                </label>
                <button
                  type="button"
                  disabled={progressState.isRunning}
                  onClick={handleRegenerateName}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium disabled:opacity-50"
                  title="Generate new random ID"
                >
                  <RotateCcw className="w-3 h-3" /> Randomize
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  disabled={progressState.isRunning}
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. rev_a4f1"
                  className="w-full px-3.5 py-2 text-sm font-mono font-medium rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Embedded in the <code className="font-mono">metadata.reviewer_name</code> field of the exported review.
              </p>
            </div>

            {/* Slot Occupancy Notice */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Pool Slot Status
                </span>
                <span className={`text-xs px-2 py-0.5 font-bold rounded-full ${
                  isSlotsFull 
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  {occupiedSlots} / 2 Slots Occupied
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {isSlotsFull ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Both slots are occupied. Importing this review will require resetting or re-uploading an existing reviewer.
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Available slot ready for double-blind inter-rater agreement comparison.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Cached State Card (if present) */}
          {cacheInfo?.cached && !progressState.isRunning && (
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Cached Review Ready for Download
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {cacheInfo.created_at ? new Date(cacheInfo.created_at).toLocaleString() : 'Recently generated'}
                </div>
              </div>

              {/* Overview Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold">Reviewer</div>
                  <div className="font-mono font-semibold text-foreground truncate">{cacheInfo.reviewer_name || 'N/A'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold">Total Papers</div>
                  <div className="font-mono font-semibold text-foreground">{cacheInfo.total_papers} papers</div>
                </div>
                {selectedPool !== 'pool_c' ? (
                  <>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-emerald-700 dark:text-emerald-400 text-[10px] uppercase font-bold">Included</div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {includedCount} ({evaluatedCount > 0 ? ((includedCount / evaluatedCount) * 100).toFixed(1) : 0}%)
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <div className="text-rose-700 dark:text-rose-400 text-[10px] uppercase font-bold">Excluded</div>
                      <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {excludedCount} ({evaluatedCount > 0 ? ((excludedCount / evaluatedCount) * 100).toFixed(1) : 0}%)
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="text-primary text-[10px] uppercase font-bold">QA & Extracted</div>
                      <div className="font-mono font-bold text-primary">
                        {evaluatedCount} Papers
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold">Cumulative Cost</div>
                      <div className="font-mono font-semibold text-foreground">${cacheInfo.total_cost_usd?.toFixed(4)}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Exclusion Code Breakdown Chips (Pool A & B) */}
              {selectedPool !== 'pool_c' && Object.keys(exclusionBreakdown).length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5">
                    Exclusion Criteria Breakdown:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(exclusionBreakdown).map(([code, count]) => (
                      <span
                        key={code}
                        className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                      >
                        {code}: <span className="font-bold">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {cacheInfo.prompt_changed && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Default prompt has been updated since this mockup was generated. You may want to rerun.
                </div>
              )}
            </div>
          )}

          {/* Live Progress Bar (during generation) */}
          {progressState.isRunning && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2 text-primary">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Screening Calibration Papers ({progressState.current} / {progressState.total})
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  {selectedPool !== 'pool_c' && (
                    <span className="flex items-center gap-2">
                      <span className="text-emerald-600 dark:text-emerald-400">INC: {includedCount}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-rose-600 dark:text-rose-400">EXC: {excludedCount}</span>
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Cost: <span className="text-primary font-bold">${progressState.costSoFar.toFixed(4)}</span>
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(100, (progressState.current / Math.max(1, progressState.total)) * 100)}%`
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground truncate font-mono">
                Active: <span className="text-foreground">{progressState.paperTitle || 'Evaluating...'}</span>
              </div>
            </div>
          )}

          {/* Live / Cached Result Log */}
          {liveResults.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <button
                type="button"
                onClick={() => setShowResultLog(!showResultLog)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Evaluation Stream Log ({liveResults.length} records)</span>
                </div>
                {showResultLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showResultLog && (
                <div className="max-h-48 overflow-y-auto divide-y divide-border text-xs">
                  {liveResults.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-4 hover:bg-muted/20">
                      <div className="truncate flex-1">
                        <span className="font-mono font-bold text-muted-foreground mr-2">{item.paper_id}</span>
                        <span className="text-foreground">{item.title}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 font-mono">
                        {item.decision ? (
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                            item.decision.toUpperCase().startsWith('INC')
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.decision} {item.exclusion_code ? `(${item.exclusion_code})` : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Evaluated</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Paper Preview */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <button
              type="button"
              onClick={() => setShowPaperList(!showPaperList)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span>Target Pool Calibration Papers ({papers.length} papers assigned)</span>
              </div>
              {showPaperList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showPaperList && (
              <div className="max-h-56 overflow-y-auto divide-y divide-border text-xs border-t border-border">
                {papers.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    No papers currently assigned to {selectedPool.toUpperCase()}. Assign papers in the Assign view first.
                  </div>
                ) : (
                  papers.map((p: any) => (
                    <div key={p.Paper_ID} className="p-3 hover:bg-muted/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-primary">{p.Paper_ID}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{p.Year || 'N/A'}</span>
                      </div>
                      <div className="font-semibold text-foreground truncate">{p.Title}</div>
                      {p.Abstract && (
                        <p className="text-muted-foreground line-clamp-2 text-[11px]">{p.Abstract}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>PRISMA-isolated mock review</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={progressState.isRunning}
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
            >
              Close
            </button>

            {cacheInfo?.cached && !progressState.isRunning ? (
              <>
                <button
                  type="button"
                  onClick={handleRerun}
                  className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-background text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Rerun & Regenerate
                </button>
                <button
                  type="button"
                  onClick={handleRedownload}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" /> Redownload (.slr)
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={progressState.isRunning || papers.length === 0}
                onClick={handleGenerate}
                className="px-5 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {progressState.isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Generate Mockup Review
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
