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
import { useMockupReview, isMockupResultFailed } from '@/hooks/useMockupReview';

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
    selectedPaperIds,
    includedCount,
    excludedCount,
    evaluatedCount,
    failedCount,
    succeededCount,
    hasFailedPapers,
    missingPdfCount,
    hasMissingPdfs,
    exclusionBreakdown,
    setReviewerName,
    handlePoolChange,
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
  } = useMockupReview(activeProjectId, activePoolTab, showToast);

  const [showPaperList, setShowPaperList] = useState(false);
  const [showResultLog, setShowResultLog] = useState(true);
  const [logFilter, setLogFilter] = useState<'ALL' | 'SUCCEEDED' | 'FAILED'>('ALL');
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [activePromptStageIndex, setActivePromptStageIndex] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Reset stage tab when pool changes
  React.useEffect(() => {
    setActivePromptStageIndex(0);
  }, [selectedPool]);

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
      desc: 'Full-text structural screening verifying strict exclusion criteria (Mandatory PDF).'
    },
    pool_c: {
      name: 'Pool C',
      stageName: 'Stage 3 & 4: Scientist + Miner',
      promptType: 'scientist_miner',
      desc: 'Two sequential calls per paper: Quality Assessment scoring + FAIR Data Extraction (Mandatory PDF).'
    }
  }[selectedPool];

  const papers = cacheInfo?.papers_preview || [];
  const occupiedSlots = cacheInfo?.occupied_slots || 0;
  const isSlotsFull = occupiedSlots >= 2;
  const isPdfBlocked = (selectedPool === 'pool_b' || selectedPool === 'pool_c') && hasMissingPdfs;

  // Selected papers stats
  const selectedCount = selectedPaperIds.length;
  const totalPapersCount = papers.length;
  const isAllSelected = totalPapersCount > 0 && selectedCount === totalPapersCount;
  const isPartiallySelected = selectedCount > 0 && selectedCount < totalPapersCount;

  // Missing PDF validation specifically for selected papers
  const selectedMissingPdfs = (selectedPool === 'pool_b' || selectedPool === 'pool_c')
    ? papers.filter(p => selectedPaperIds.includes(String(p.Paper_ID)) && (!p.Local_PDF_Path || p.Local_PDF_Status === 'MISSING'))
    : [];
  const isSelectedPdfBlocked = (selectedPool === 'pool_b' || selectedPool === 'pool_c') && selectedMissingPdfs.length > 0;

  // Filtered live results for log view
  const filteredLogResults = liveResults.filter((item) => {
    const isFailed = isMockupResultFailed(item, selectedPool);
    if (logFilter === 'FAILED') return isFailed;
    if (logFilter === 'SUCCEEDED') return !isFailed;
    return true;
  });

  // Prompt configurations for active pool
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
                <h3 className="text-lg font-bold">Multi-Pool Mockup Review Generator</h3>
                <span className="text-xs px-2 py-0.5 font-mono font-semibold bg-muted text-muted-foreground rounded-md border border-border">
                  CTRL+M
                </span>
                {activePromptConfig?.clean_model_name && (
                  <span className="text-xs px-2 py-0.5 font-mono font-semibold bg-primary/10 text-primary rounded-md border border-primary/20 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5" />
                    {activePromptConfig.clean_model_name}
                  </span>
                )}
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
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        hasFailedPapers
                          ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      }`}>
                        {hasFailedPapers ? (
                          <>
                            <AlertTriangle className="w-3 h-3" /> {failedCount} Failed
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Cached
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{tab.label}</div>
                  {selectedPool === tab.id && activePromptConfig?.clean_model_name && (
                    <div className="text-[10px] font-mono text-muted-foreground mt-1 flex items-center gap-1 truncate">
                      <Cpu className="w-3 h-3 text-primary shrink-0" />
                      <span>{activePromptConfig.clean_model_name}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" /> {poolMeta.desc}
            </p>
          </div>

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
                    Essential parameters configured in Prompt Library applied during mockup review generation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPromptDetails(!showPromptDetails)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                {showPromptDetails ? 'Hide Parameters' : 'View Parameters'}
                {showPromptDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Multi-Stage Tabs for Pool C (Scientist & Miner) */}
            {promptConfigs.length > 1 && (
              <div className="flex items-center gap-2 border-b border-border pb-2">
                {promptConfigs.map((cfg, idx) => (
                  <button
                    key={cfg.prompt_type || idx}
                    type="button"
                    onClick={() => setActivePromptStageIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
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
                      <span>{activePromptConfig.clean_model_name}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Temperature &amp; Thinking</div>
                    <div className="font-mono font-semibold text-foreground truncate mt-0.5">
                      T: <span className="font-bold text-primary">{activePromptConfig.temperature}</span>
                      <span className="text-muted-foreground mx-1">|</span>
                      <span className="capitalize font-bold text-foreground">
                        {activePromptConfig.thinking_level === 'none' || activePromptConfig.thinking_level === 'off'
                          ? 'Off'
                          : activePromptConfig.thinking_level}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Max Output Tokens</div>
                    <div className="font-mono font-semibold text-foreground truncate mt-0.5">
                      <span className="font-bold text-foreground">{activePromptConfig.max_tokens.toLocaleString()}</span> tokens
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Mode &amp; Delay</div>
                    <div className="font-mono font-semibold text-foreground truncate mt-0.5">
                      <span className="font-bold text-primary">{activePromptConfig.execution_mode}</span>
                      <span className="text-muted-foreground mx-1">|</span>
                      {activePromptConfig.request_delay >= 1
                        ? `${activePromptConfig.request_delay}s`
                        : `${activePromptConfig.request_delay}s (${activePromptConfig.request_delay_ms || Math.round(activePromptConfig.request_delay * 1000)}ms)`}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {showPromptDetails && (
                  <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3 animate-in fade-in duration-150">
                    {/* Secondary Parameter Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-background border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">Template</span>
                        <span className="font-semibold text-foreground truncate block" title={activePromptConfig.template_name}>
                          {activePromptConfig.template_name}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-bold inline-block mt-1 ${
                          activePromptConfig.is_project_custom
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {activePromptConfig.is_project_custom ? 'Project Custom' : 'System Default'}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-background border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">Timeout &amp; Top-P/K</span>
                        <span className="font-semibold text-foreground block">
                          {activePromptConfig.timeout_seconds}s timeout
                        </span>
                        <span className="text-[10px] text-muted-foreground block mt-1">
                          Top-P: {activePromptConfig.top_p ?? 'Auto'} | Top-K: {activePromptConfig.top_k ?? 'Auto'}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-background border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">Response Schema</span>
                        <span className="font-semibold text-foreground truncate block font-mono" title={activePromptConfig.response_schema_name}>
                          {activePromptConfig.response_schema_name || 'Standard Schema'}
                        </span>
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-sans font-bold inline-block mt-1">
                          Strict JSON Enforced
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-background border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-bold">
                          {activePromptConfig.prompt_type === 'miner' ? 'Interaction Chaining' : 'Stage Scope'}
                        </span>
                        {activePromptConfig.prompt_type === 'miner' ? (
                          <span className={`text-[10px] font-bold block mt-1 ${
                            activePromptConfig.interaction_chaining !== false
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {activePromptConfig.interaction_chaining !== false ? '✓ Uses QA Context' : '✗ Chaining Disabled'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground block mt-1">
                            Single Stage Pass
                          </span>
                        )}
                      </div>
                    </div>

                    {/* System Instruction Drawer */}
                    {activePromptConfig.system_instruction && (
                      <div className="border border-border rounded-lg bg-background overflow-hidden text-xs">
                        <div className="px-3 py-1.5 flex items-center justify-between bg-muted/40 border-b border-border">
                          <span className="font-bold text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-primary" /> System Instruction Preview
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(activePromptConfig.system_instruction || '', 'system')}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            {copiedField === 'system' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            {copiedField === 'system' ? 'Copied' : 'Copy System Instruction'}
                          </button>
                        </div>
                        <pre className="p-3 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed bg-muted/10">
                          {activePromptConfig.system_instruction}
                        </pre>
                      </div>
                    )}

                    {/* User Template Drawer */}
                    {activePromptConfig.user_template && (
                      <div className="border border-border rounded-lg bg-background overflow-hidden text-xs">
                        <div className="px-3 py-1.5 flex items-center justify-between bg-muted/40 border-b border-border">
                          <span className="font-bold text-[11px] text-muted-foreground uppercase flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-primary" /> User Template Seed ({activePromptConfig.prompt_type})
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(activePromptConfig.user_template || '', 'template')}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            {copiedField === 'template' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            {copiedField === 'template' ? 'Copied' : 'Copy Template Seed'}
                          </button>
                        </div>
                        <pre className="p-3 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed bg-muted/10">
                          {activePromptConfig.user_template}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs text-muted-foreground flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Loading prompt configuration for {selectedPool.toUpperCase()}...</span>
              </div>
            )}
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

          {/* Missing PDF Warning Alert Banner (Mandatory for Pool B and Pool C) */}
          {isPdfBlocked && !progressState.isRunning && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Mandatory PDF Requirement: {missingPdfCount} of {papers.length} Papers Lack Local Full-Text PDFs</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono">
                  PDF Required for {selectedPool === 'pool_b' ? 'Pool B (Gatekeeper)' : 'Pool C (Scientist + Miner)'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedPool === 'pool_b' 
                  ? 'Stage 2 Gatekeeper structural screening evaluates full-text PDFs. Full-pool execution is blocked until all papers in this pool have verified local PDFs.'
                  : 'Stage 3 QA scoring and Stage 4 Data Extraction require full-text PDFs. Full-pool execution is blocked until all papers in this pool have verified local PDFs.'}
                You can acquire or match missing PDFs in the <strong>PDF Pipeline</strong>, or select only verified papers below for targeted execution.
              </p>
            </div>
          )}

          {/* Targeted Selective Selection HUD Banner */}
          {selectedCount > 0 && !progressState.isRunning && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/10 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <CheckSquare className="w-4 h-4 shrink-0" />
                  <span>Targeted Paper Selection Active ({selectedCount} of {papers.length} selected)</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">
                  {totalPapersCount > selectedCount ? `Saves ${totalPapersCount - selectedCount} Unselected Papers` : 'All Papers Selected'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Executing a targeted rerun will evaluate only your {selectedCount} selected paper(s) and seamlessly merge their new outputs into the cached review file, preserving all other existing paper evaluations.
              </p>
              {isSelectedPdfBlocked && (
                <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedMissingPdfs.length} selected paper(s) lack a local PDF ({selectedMissingPdfs.slice(0, 3).map(p => p.Paper_ID).join(', ')}{selectedMissingPdfs.length > 3 ? '...' : ''}). Please deselect missing PDF papers or acquire their files.</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSelectedPdfBlocked}
                  onClick={() => handleRerunSelected()}
                  className="px-3.5 py-1.5 bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Rerun Selected Papers ({selectedCount})
                </button>
                <button
                  type="button"
                  onClick={deselectAllPapers}
                  className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium rounded-lg transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Partial Execution Banner (if failures exist in finished execution and user hasn't selected specific subset) */}
          {cacheInfo?.cached && hasFailedPapers && selectedCount === 0 && !progressState.isRunning && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Partial Execution Available ({failedCount} of {cacheInfo.total_papers} papers failed)</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
                  Saves Rerun Cost for {succeededCount} Papers
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Targeted partial execution allows you to re-evaluate only the {failedCount} failed papers (e.g. from timeouts, rate limits, or previously missing PDFs), seamlessly preserving the {succeededCount} already completed evaluations and avoiding unnecessary rerun expenditure.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isPdfBlocked}
                  onClick={handleRetryFailed}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Failed Papers Only ({failedCount})
                </button>
                <button
                  type="button"
                  onClick={selectFailedPapers}
                  className="px-3 py-1.5 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Select Failed in Table
                </button>
              </div>
            </div>
          )}

          {/* Cached State Card (if present) */}
          {cacheInfo?.cached && !progressState.isRunning && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              hasFailedPapers 
                ? 'border-amber-500/20 bg-amber-500/5' 
                : 'border-emerald-500/20 bg-emerald-500/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 font-bold text-sm ${
                  hasFailedPapers ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {hasFailedPapers ? (
                    <>
                      <AlertCircle className="w-4 h-4" /> Cached Review Available ({failedCount} Failures / Rerun Needed)
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Cached Review Complete &amp; Ready for Download
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {cacheInfo.updated_at || cacheInfo.created_at ? new Date(cacheInfo.updated_at || cacheInfo.created_at!).toLocaleString() : 'Recently generated'}
                </div>
              </div>

              {/* Overview Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold">Reviewer</div>
                  <div className="font-mono font-semibold text-foreground truncate">{cacheInfo.reviewer_name || 'N/A'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-card/60 border border-border">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold">Model Used</div>
                  <div className="font-mono font-bold text-foreground truncate flex items-center gap-1" title={cacheInfo.model_id || 'gemini-2.5-flash'}>
                    <Cpu className="w-3 h-3 text-primary shrink-0" />
                    <span>{cacheInfo.model_id?.replace(/^models\//, '') || 'gemini-2.5-flash'}</span>
                  </div>
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
                        {includedCount} ({succeededCount > 0 ? ((includedCount / succeededCount) * 100).toFixed(1) : 0}%)
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <div className="text-rose-700 dark:text-rose-400 text-[10px] uppercase font-bold">Excluded</div>
                      <div className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {excludedCount} ({succeededCount > 0 ? ((excludedCount / succeededCount) * 100).toFixed(1) : 0}%)
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="text-primary text-[10px] uppercase font-bold">QA &amp; Extracted</div>
                      <div className="font-mono font-bold text-primary">
                        {succeededCount} / {cacheInfo.total_papers} Papers
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
                  {progressState.isPartialRetry ? 'Executing Targeted Paper Rerun' : 'Screening Calibration Papers'} ({progressState.current} / {progressState.total})
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

          {/* Quick Selection Toolbar (when papers exist) */}
          {papers.length > 0 && !progressState.isRunning && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-muted/20 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isAllSelected ? deselectAllPapers : selectAllPapers}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted font-semibold text-foreground transition-colors"
                  title={isAllSelected ? 'Deselect all papers' : 'Select all papers in pool'}
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  ) : isPartiallySelected ? (
                    <MinusSquare className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>{isAllSelected ? 'Deselect All' : 'Select All'} ({papers.length})</span>
                </button>

                {liveResults.length > 0 && (
                  <>
                    {failedCount > 0 && (
                      <button
                        type="button"
                        onClick={selectFailedPapers}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold transition-colors"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Select Failed ({failedCount})</span>
                      </button>
                    )}
                    {succeededCount > 0 && (
                      <button
                        type="button"
                        onClick={selectSucceededPapers}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Select Succeeded ({succeededCount})</span>
                      </button>
                    )}
                  </>
                )}

                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={deselectAllPapers}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium underline px-1.5 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className={`px-2 py-0.5 rounded font-bold ${
                  selectedCount > 0
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {selectedCount} / {papers.length} Selected for Rerun
                </span>
              </div>
            </div>
          )}

          {/* Live / Cached Result Log */}
          {liveResults.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="px-4 py-2.5 flex items-center justify-between text-xs font-bold bg-muted/40 border-b border-border">
                <button
                  type="button"
                  onClick={() => setShowResultLog(!showResultLog)}
                  className="flex items-center gap-2 hover:text-foreground transition-colors"
                >
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Evaluation Stream Log ({liveResults.length} records)</span>
                  {showResultLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setLogFilter('ALL')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      logFilter === 'ALL' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All ({liveResults.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('SUCCEEDED')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      logFilter === 'SUCCEEDED' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Succeeded ({succeededCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('FAILED')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      logFilter === 'FAILED' ? 'bg-rose-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Failed ({failedCount})
                  </button>
                </div>
              </div>

              {showResultLog && (
                <div className="max-h-56 overflow-y-auto divide-y divide-border text-xs">
                  {filteredLogResults.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-xs">
                      No records match the active filter ({logFilter}).
                    </div>
                  ) : (
                    filteredLogResults.map((item, idx) => {
                      const isFailed = isMockupResultFailed(item, selectedPool);
                      const isSelected = isPaperSelected(item.paper_id);
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (!progressState.isRunning) {
                              togglePaperSelection(item.paper_id);
                            }
                          }}
                          className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected 
                              ? 'bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary' 
                              : 'hover:bg-muted/20'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <div 
                            className="shrink-0 flex items-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!progressState.isRunning) {
                                togglePaperSelection(item.paper_id);
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={progressState.isRunning}
                              onChange={() => togglePaperSelection(item.paper_id)}
                              className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 cursor-pointer disabled:opacity-50"
                            />
                          </div>

                          <div className="truncate flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-muted-foreground">{item.paper_id}</span>
                              <span className="text-foreground font-medium truncate">{item.title}</span>
                            </div>
                            {isFailed && (
                              <p className="text-[11px] text-rose-500 font-mono mt-0.5 truncate" title={item.error || item.rationale}>
                                ⚠️ {item.error || item.rationale || 'Evaluation failed'}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-2 font-mono">
                            {isFailed ? (
                              <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> FAILED
                              </span>
                            ) : item.decision ? (
                              <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                                String(item.decision).toUpperCase().startsWith('INC')
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
                      );
                    })
                  )}
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
                {selectedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-primary/20 text-primary font-mono text-[10px]">
                    {selectedCount} selected
                  </span>
                )}
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
                  papers.map((p: any) => {
                    const hasPdf = Boolean(p.Local_PDF_Path && p.Local_PDF_Status !== 'MISSING');
                    const isSelected = isPaperSelected(p.Paper_ID);
                    return (
                      <div 
                        key={p.Paper_ID} 
                        onClick={() => {
                          if (!progressState.isRunning) {
                            togglePaperSelection(p.Paper_ID);
                          }
                        }}
                        className={`p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary' 
                            : 'hover:bg-muted/20'
                        }`}
                      >
                        {/* Checkbox */}
                        <div 
                          className="pt-0.5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!progressState.isRunning) {
                              togglePaperSelection(p.Paper_ID);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={progressState.isRunning}
                            onChange={() => togglePaperSelection(p.Paper_ID)}
                            className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 cursor-pointer disabled:opacity-50"
                          />
                        </div>

                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary">{p.Paper_ID}</span>
                              <span className="text-[11px] text-muted-foreground font-mono">{p.Year || 'N/A'}</span>
                            </div>
                            {/* PDF Status Pill */}
                            {selectedPool === 'pool_a' ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                Title &amp; Abstract Ready
                              </span>
                            ) : hasPdf ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> PDF Ready
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1 font-mono">
                                <AlertTriangle className="w-3 h-3" /> PDF Missing
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-foreground truncate">{p.Title}</div>
                          {p.Abstract && (
                            <p className="text-muted-foreground line-clamp-2 text-[11px]">{p.Abstract}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {selectedCount > 0 ? (
              isSelectedPdfBlocked ? (
                <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Rerun blocked: {selectedMissingPdfs.length} selected paper(s) missing PDF
                </span>
              ) : (
                <span className="text-primary font-semibold">
                  {selectedCount} paper(s) selected for targeted rerun
                </span>
              )
            ) : isPdfBlocked ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Full run blocked: {missingPdfCount} papers missing PDF file
              </span>
            ) : (
              <span>PRISMA-isolated mock review</span>
            )}
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

            {/* If user has manually selected papers, present the prominent "Rerun Selected" button */}
            {selectedCount > 0 && (
              <>
                {cacheInfo?.cached && !progressState.isRunning && (
                  <button
                    type="button"
                    onClick={() => handleRedownload()}
                    className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-background text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Redownload (.slr)
                  </button>
                )}
                <button
                  type="button"
                  disabled={progressState.isRunning || isSelectedPdfBlocked}
                  onClick={() => handleRerunSelected()}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95"
                  title={isSelectedPdfBlocked ? `${selectedMissingPdfs.length} selected paper(s) lack a local PDF` : undefined}
                >
                  {progressState.isRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Rerunning ({progressState.current}/{progressState.total})...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" /> Rerun Selected ({selectedCount})
                    </>
                  )}
                </button>
              </>
            )}

            {/* Standard buttons when no subset is selected */}
            {selectedCount === 0 && (
              cacheInfo?.cached && !progressState.isRunning ? (
                <>
                  {hasFailedPapers && (
                    <button
                      type="button"
                      disabled={isPdfBlocked}
                      onClick={handleRetryFailed}
                      className="px-4 py-2 text-sm font-bold rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" /> Retry Failed Only ({failedCount})
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPdfBlocked}
                    onClick={handleRerun}
                    className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Rerun All &amp; Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRedownload()}
                    className="px-5 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" /> Redownload (.slr)
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={progressState.isRunning || papers.length === 0 || isPdfBlocked}
                  onClick={handleGenerate}
                  className="px-5 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isPdfBlocked ? `Execution blocked: ${missingPdfCount} papers missing local PDF files` : undefined}
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
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

