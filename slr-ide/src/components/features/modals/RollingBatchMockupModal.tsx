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
  ShieldCheck,
  AlertCircle,
  CheckSquare,
  Square,
  MinusSquare,
  Cpu,
  Sliders,
  Zap,
  Copy,
  Check,
  Terminal
} from 'lucide-react';
import { useRollingBatchMockup, isMockupResultFailed } from '@/hooks/useRollingBatchMockup';

interface RollingBatchMockupModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId: string;
  activeProject?: any;
  batchId?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function RollingBatchMockupModal({
  isOpen,
  onClose,
  activeProjectId,
  activeProject,
  batchId,
  showToast
}: RollingBatchMockupModalProps) {
  const {
    activeBatch,
    reviewerName,
    loadingCache,
    cacheInfo,
    progressState,
    liveResults,
    selectedPaperIds,
    failedCount,
    succeededCount,
    hasFailedPapers,
    missingPdfCount,
    hasMissingPdfs,
    setReviewerName,
    handleRegenerateName,
    handleGenerate,
    handleRetryFailed,
    handleRerunSelected,
    handleRedownload,
    handleRerun,
    togglePaperSelection,
    selectAllPapers,
    deselectAllPapers,
    selectFailedPapers,
    selectSucceededPapers,
    isPaperSelected
  } = useRollingBatchMockup(activeProjectId, batchId, showToast);

  const [showPaperList, setShowPaperList] = useState(false);
  const [showResultLog, setShowResultLog] = useState(true);
  const [logFilter, setLogFilter] = useState<'ALL' | 'SUCCEEDED' | 'FAILED'>('ALL');
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [activePromptStageIndex, setActivePromptStageIndex] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldId: string) => {
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
      showToast('Copied to clipboard', 'info');
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

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

  const papers = cacheInfo?.papers_preview || [];
  const occupiedSlots = cacheInfo?.occupied_slots || 0;
  const isSlotsFull = occupiedSlots >= 2;
  const isPdfBlocked = hasMissingPdfs;

  // Selected papers stats
  const selectedCount = selectedPaperIds.length;
  const totalPapersCount = papers.length;
  const isAllSelected = totalPapersCount > 0 && selectedCount === totalPapersCount;
  const isPartiallySelected = selectedCount > 0 && selectedCount < totalPapersCount;

  // Missing PDF validation specifically for selected papers
  const selectedMissingPdfs = papers.filter(
    p => selectedPaperIds.includes(String(p.Paper_ID)) && (!p.Local_PDF_Path || p.Local_PDF_Status === 'MISSING')
  );
  const isSelectedPdfBlocked = selectedMissingPdfs.length > 0;

  // Filtered live results for log view
  const filteredLogResults = liveResults.filter((item) => {
    const isFailed = isMockupResultFailed(item, 'pool_c');
    if (logFilter === 'FAILED') return isFailed;
    if (logFilter === 'SUCCEEDED') return !isFailed;
    return true;
  });

  // Prompt configurations
  const promptConfigs = cacheInfo?.prompt_configs || [];
  const safeStageIndex = activePromptStageIndex < promptConfigs.length ? activePromptStageIndex : 0;
  const activePromptConfig = promptConfigs[safeStageIndex] || promptConfigs[0] || null;

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
                <h3 className="text-lg font-bold">Rolling Batch Mockup Review Generator</h3>
                <span className="text-xs px-2 py-0.5 font-mono font-semibold bg-muted text-muted-foreground rounded-md border border-border">
                  CTRL+M
                </span>
                <span className="text-xs px-2 py-0.5 font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md border border-amber-500/20">
                  Sequential QC
                </span>
                {activePromptConfig?.clean_model_name && (
                  <span className="text-xs px-2 py-0.5 font-mono font-semibold bg-primary/10 text-primary rounded-md border border-primary/20 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5" />
                    {activePromptConfig.clean_model_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate LLM-driven blinded <code className="font-mono text-primary">.slr</code> files for Sequential Quality Control (QC_Batch) isolated from PRISMA screening records.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={progressState.isRunning}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Active Batch Banner */}
          {activeBatch ? (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-foreground">
                      Active Rolling Batch #{activeBatch.batch_number}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      ID: {activeBatch.id}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {papers.length} Papers
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Evaluates Stage 3 (Scientist QA Scoring) + Stage 4 (Miner Data Extraction) using mandatory local PDFs.
                  </p>
                </div>
              </div>

              {cacheInfo?.cached && (
                <div className="flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-end">
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
                    hasFailedPapers
                      ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20'
                      : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  }`}>
                    {hasFailedPapers ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" /> {failedCount} Failed
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Cached Ready
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Audit Pipeline Standby</h4>
                <p className="text-xs mt-1 text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                  No active rolling batch is currently running for this project. Please initialize the next audit batch in the Rolling Batch view to enable mockup review generation.
                </p>
              </div>
            </div>
          )}

          {/* Active Prompt & Model Configuration HUD */}
          <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Active Prompt &amp; Model Configuration
                    </span>
                    {activePromptConfig?.clean_model_name && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {activePromptConfig.clean_model_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Essential parameters configured in Prompt Library applied during sequential QC generation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPromptDetails(!showPromptDetails)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                {showPromptDetails ? 'Hide Parameters' : 'View Parameters'}
                {showPromptDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Multi-Stage Tabs for Scientist QA & Miner Extraction */}
            {promptConfigs.length > 1 && (
              <div className="flex items-center gap-2 border-b border-border pb-2">
                {promptConfigs.map((cfg, idx) => (
                  <button
                    key={cfg.prompt_type || idx}
                    type="button"
                    onClick={() => setActivePromptStageIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      safeStageIndex === idx
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
                    }`}
                  >
                    <span>{cfg.stage_label || `Stage ${cfg.stage_num}`}</span>
                    <span className="text-[10px] font-mono opacity-80">({cfg.clean_model_name})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Essential Parameters Grid */}
            {activePromptConfig ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Model Type</div>
                    <div className="font-mono font-bold text-foreground truncate flex items-center gap-1 mt-0.5" title={activePromptConfig.model_id}>
                      <Cpu className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{activePromptConfig.clean_model_name}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Temperature</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {activePromptConfig.temperature.toFixed(2)}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Thinking Budget</div>
                    <div className="font-mono font-bold text-foreground mt-0.5 flex items-center gap-1">
                      <span className="capitalize">{activePromptConfig.thinking_level}</span>
                      {activePromptConfig.thinking_budget !== undefined && activePromptConfig.thinking_budget > 0 && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({activePromptConfig.thinking_budget}t)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Max Tokens</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {activePromptConfig.max_tokens.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Execution Mode</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                        {activePromptConfig.execution_mode}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Request Delay</div>
                    <div className="font-mono font-bold text-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>{activePromptConfig.request_delay}s ({activePromptConfig.request_delay_ms}ms)</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Timeout</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {activePromptConfig.timeout_seconds}s
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Strict Schema</div>
                    <div className="font-mono font-bold text-foreground truncate mt-0.5 flex items-center gap-1" title={activePromptConfig.response_schema_name}>
                      <Terminal className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{activePromptConfig.response_schema_name}</span>
                    </div>
                  </div>
                </div>

                {/* Collapsible Prompt Preview */}
                {showPromptDetails && (
                  <div className="pt-2 border-t border-border space-y-3 animate-in fade-in duration-150">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-foreground">System Instruction</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activePromptConfig.system_instruction || '', `sys_${activePromptConfig.prompt_type}`)}
                          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-background cursor-pointer"
                        >
                          {copiedField === `sys_${activePromptConfig.prompt_type}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === `sys_${activePromptConfig.prompt_type}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono bg-muted/50 p-2.5 rounded-lg border border-border/60 overflow-x-auto max-h-28 text-muted-foreground whitespace-pre-wrap">
                        {activePromptConfig.system_instruction || '(No System Instruction configured)'}
                      </pre>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-foreground">User Prompt Template</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activePromptConfig.user_template || '', `usr_${activePromptConfig.prompt_type}`)}
                          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-background cursor-pointer"
                        >
                          {copiedField === `usr_${activePromptConfig.prompt_type}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === `usr_${activePromptConfig.prompt_type}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="text-[10px] font-mono bg-muted/50 p-2.5 rounded-lg border border-border/60 overflow-x-auto max-h-32 text-muted-foreground whitespace-pre-wrap">
                        {activePromptConfig.user_template || '(No User Template configured)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                Loading prompt configurations...
              </div>
            )}
          </div>

          {/* Partial Execution Alert Banner for Failed Papers */}
          {cacheInfo?.cached && hasFailedPapers && !progressState.isRunning && (
            <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-card-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    Partial Execution Available ({failedCount} Failed Paper{failedCount !== 1 ? 's' : ''})
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Previous review execution encountered {failedCount} failed paper(s) (API timeout, missing PDF, or parsing error). You can retry only the failed subset without re-evaluating the {succeededCount} successfully completed papers, saving API costs and tokens.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={isPdfBlocked}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-center disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Failed Only ({failedCount})</span>
              </button>
            </div>
          )}

          {/* Missing PDF Warning Banner */}
          {hasMissingPdfs && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-card-foreground flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-destructive">
                  Mandatory Full-Text PDF Requirement
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {missingPdfCount} paper(s) in this batch do not have verified full-text PDF files on disk. Rolling Batch Validation requires PDFs for Quality Assessment &amp; Data Extraction. Papers lacking PDFs will fail execution.
                </p>
              </div>
            </div>
          )}

          {/* Reviewer Identifier Configuration */}
          <div className="p-4 rounded-xl border border-border bg-card/60 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-foreground">
                  Reviewer Identifier
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Blinded name embedded in the generated <code className="font-mono text-primary">.slr</code> package and database cache.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  disabled={progressState.isRunning}
                  placeholder="e.g. rev_a4f1"
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary w-36 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleRegenerateName}
                  disabled={progressState.isRunning}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                  title="Generate Random Reviewer ID"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Slot Occupancy Warning */}
            {isSlotsFull ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  All 2 reviewer slots for this batch are currently occupied. Importing this file will require resetting batch decisions first.
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-muted/40 text-muted-foreground text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Slot Availability: <strong>{occupiedSlots}/2</strong> slots occupied for this rolling batch.
                </span>
              </div>
            )}
          </div>

          {/* Interactive Paper Selection Checklist & Toolbar */}
          {papers.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaperList(!showPaperList)}
                  className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Batch Papers Preview ({papers.length} Papers)</span>
                  {showPaperList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showPaperList && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground mr-1">
                      {selectedCount}/{totalPapersCount} Selected
                    </span>
                    <button
                      type="button"
                      onClick={selectAllPapers}
                      disabled={progressState.isRunning}
                      className="px-2 py-1 text-[11px] font-semibold rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllPapers}
                      disabled={progressState.isRunning || selectedCount === 0}
                      className="px-2 py-1 text-[11px] font-semibold rounded-md border border-border bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Clear
                    </button>
                    {hasFailedPapers && (
                      <button
                        type="button"
                        onClick={selectFailedPapers}
                        disabled={progressState.isRunning}
                        className="px-2 py-1 text-[11px] font-semibold rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Select Failed ({failedCount})
                      </button>
                    )}
                    {succeededCount > 0 && (
                      <button
                        type="button"
                        onClick={selectSucceededPapers}
                        disabled={progressState.isRunning}
                        className="px-2 py-1 text-[11px] font-semibold rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Select Succeeded ({succeededCount})
                      </button>
                    )}
                    {selectedCount > 0 && (
                      <button
                        type="button"
                        onClick={handleRerunSelected}
                        disabled={progressState.isRunning || isSelectedPdfBlocked}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Rerun Selected ({selectedCount})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {showPaperList && (
                <div className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-y-auto bg-card/50">
                  {papers.map((p: any, idx: number) => {
                    const isSelected = isPaperSelected(p.Paper_ID);
                    const isMissingPdf = !p.Local_PDF_Path || p.Local_PDF_Status === 'MISSING';
                    const prevResult = liveResults.find((r) => r.paper_id === p.Paper_ID);
                    const isFailed = prevResult && isMockupResultFailed(prevResult, 'pool_c');

                    return (
                      <div
                        key={p.Paper_ID || idx}
                        onClick={() => !progressState.isRunning && togglePaperSelection(p.Paper_ID)}
                        className={`p-3 text-xs flex items-start gap-3 transition-colors cursor-pointer ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 text-muted-foreground">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-primary">{p.Paper_ID}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-semibold text-foreground truncate max-w-md" title={p.Title}>
                              {p.Title}
                            </span>
                            {p.Year && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                {p.Year}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {p.Authors || 'Unknown Authors'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isMissingPdf ? (
                            <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> No PDF
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              PDF Ready
                            </span>
                          )}

                          {prevResult && (
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              isFailed
                                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {isFailed ? 'FAILED' : (prevResult.decision || 'EVALUATED')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Running Progress Ticker */}
          {progressState.isRunning && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <span className="font-bold text-foreground">
                    {progressState.isPartialRetry ? 'Retrying Target Subset...' : 'Evaluating Rolling Batch Papers...'}
                  </span>
                </div>
                <div className="font-mono font-bold text-primary">
                  {progressState.current} / {progressState.total} ({Math.round((progressState.current / (progressState.total || 1)) * 100)}%)
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((progressState.current / (progressState.total || 1)) * 100))}%`
                  }}
                />
              </div>

              {progressState.paperId && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
                  <div className="truncate max-w-md">
                    <span className="font-mono font-bold text-foreground mr-1">
                      {progressState.paperId}:
                    </span>
                    <span>{progressState.paperTitle}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                    <span>${progressState.costSoFar.toFixed(4)}</span>
                    <span>•</span>
                    <span>{progressState.tokensSoFar.toLocaleString()} tokens</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stream Log */}
          {liveResults.length > 0 && !progressState.isRunning && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Evaluation Results ({liveResults.length})
                  </span>
                  <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLogFilter('ALL')}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                        logFilter === 'ALL' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      All ({liveResults.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFilter('SUCCEEDED')}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                        logFilter === 'SUCCEEDED' ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Success ({succeededCount})
                    </button>
                    {failedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setLogFilter('FAILED')}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                          logFilter === 'FAILED' ? 'bg-background text-destructive shadow-xs' : 'text-muted-foreground'
                        }`}
                      >
                        Failed ({failedCount})
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowResultLog(!showResultLog)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showResultLog ? 'Collapse Log' : 'Expand Log'}
                  {showResultLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showResultLog && (
                <div className="border border-border rounded-xl divide-y divide-border max-h-52 overflow-y-auto bg-muted/20">
                  {filteredLogResults.map((res: any, idx: number) => {
                    const isFailed = isMockupResultFailed(res, 'pool_c');
                    return (
                      <div key={res.paper_id || idx} className="p-3 text-xs flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">{res.paper_id}</span>
                            <span className="text-muted-foreground truncate">{res.title}</span>
                          </div>
                          {res.error && (
                            <div className="text-[11px] text-destructive mt-0.5 font-mono">
                              Error: {res.error}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isFailed
                              ? 'bg-destructive/10 text-destructive border border-destructive/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {isFailed ? 'FAILED' : (res.decision || 'EVALUATED')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {cacheInfo?.cached && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Cached review package available (${Number(cacheInfo.total_cost_usd || 0).toFixed(4)})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            {cacheInfo?.cached && (
              <button
                type="button"
                onClick={handleRedownload}
                disabled={progressState.isRunning}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4 text-primary" />
                <span>Redownload (.slr)</span>
              </button>
            )}

            {cacheInfo?.cached && hasFailedPapers && (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={progressState.isRunning || isPdfBlocked}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Failed ({failedCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={cacheInfo?.cached ? handleRerun : handleGenerate}
              disabled={progressState.isRunning || isPdfBlocked || !activeBatch}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {progressState.isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Review...</span>
                </>
              ) : cacheInfo?.cached ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Rerun &amp; Regenerate</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Generate Review</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
