'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Download,
  Check,
  Code2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Layers,
  Scale,
  BrainCircuit,
  SlidersHorizontal,
  RefreshCw,
  Cpu,
  FileCode
} from 'lucide-react';

interface ScientificRigorLlmModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function ScientificRigorLlmModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  showToast
}: ScientificRigorLlmModalProps) {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any>(null);

  // Section inclusion states
  const [includeAiSpecs, setIncludeAiSpecs] = useState(true);
  const [includePrisma, setIncludePrisma] = useState(true);
  const [includePreCalibration, setIncludePreCalibration] = useState(true);
  const [includePromptOptimization, setIncludePromptOptimization] = useState(true);
  const [includeStageComparison, setIncludeStageComparison] = useState(true);
  const [includeRollingBatch, setIncludeRollingBatch] = useState(true);
  const [includeLlmDirectives, setIncludeLlmDirectives] = useState(true);

  // Formatting options
  const [isPretty, setIsPretty] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);

  // Fetch complete scientific rigor payload when modal opens
  useEffect(() => {
    if (!isOpen || !projectId) return;

    async function loadRigorData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/insight/scientific-rigor?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) {
          throw new Error('Failed to fetch scientific rigor dataset');
        }
        const json = await res.json();
        setRawData(json);
      } catch (err: any) {
        showToast(err.message || 'Error loading scientific rigor dataset', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadRigorData();
  }, [isOpen, projectId, showToast]);

  // Construct filtered JSON payload according to active user toggles
  const compiledPayload = useMemo(() => {
    if (!rawData) return null;

    const payload: any = {
      export_metadata: {
        ...rawData.export_metadata,
        exported_at: new Date().toISOString()
      }
    };

    if (includeLlmDirectives && rawData.llm_narrative_guidelines) {
      payload.llm_narrative_guidelines = rawData.llm_narrative_guidelines;
    }

    if (includeAiSpecs && rawData.ai_screening_technical_specifications) {
      payload.ai_screening_technical_specifications = rawData.ai_screening_technical_specifications;
    }

    if (includePrisma && rawData.prisma_flow_data) {
      payload.prisma_flow_data = rawData.prisma_flow_data;
    }

    if (includePreCalibration && rawData.pre_calibration_data) {
      payload.pre_calibration_data = rawData.pre_calibration_data;
    }

    if (includePromptOptimization && rawData.prompt_optimization_data) {
      payload.prompt_optimization_data = rawData.prompt_optimization_data;
    }

    if (includeStageComparison && rawData.gold_standard_stage_comparison) {
      payload.gold_standard_stage_comparison = rawData.gold_standard_stage_comparison;
    }

    if (includeRollingBatch && rawData.rolling_batch_validation) {
      payload.rolling_batch_validation = rawData.rolling_batch_validation;
    }

    return payload;
  }, [
    rawData,
    includeAiSpecs,
    includePrisma,
    includePreCalibration,
    includePromptOptimization,
    includeStageComparison,
    includeRollingBatch,
    includeLlmDirectives
  ]);

  const generatedJsonString = useMemo(() => {
    if (!compiledPayload) return '';
    return isPretty ? JSON.stringify(compiledPayload, null, 2) : JSON.stringify(compiledPayload);
  }, [compiledPayload, isPretty]);

  // Compute payload statistics
  const payloadStats = useMemo(() => {
    if (!generatedJsonString) return { charCount: 0, sizeKb: '0.0', estimatedTokens: 0 };
    const charCount = generatedJsonString.length;
    const sizeKb = (new Blob([generatedJsonString]).size / 1024).toFixed(1);
    const estimatedTokens = Math.ceil(charCount / 4.0);
    return { charCount, sizeKb, estimatedTokens };
  }, [generatedJsonString]);

  const selectedCount = [
    includeAiSpecs,
    includePrisma,
    includePreCalibration,
    includePromptOptimization,
    includeStageComparison,
    includeRollingBatch,
    includeLlmDirectives
  ].filter(Boolean).length;

  // Handle Copy to Clipboard
  const handleCopyJson = async () => {
    if (!generatedJsonString) return;
    try {
      await navigator.clipboard.writeText(generatedJsonString);
      setCopied(true);
      showToast('Scientific Rigor JSON copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  // Handle Download JSON File
  const handleDownloadJson = () => {
    if (!generatedJsonString) return;
    try {
      const blob = new Blob([generatedJsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeProjName = (projectName || rawData?.export_metadata?.project_name || 'project')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `scientific_rigor_context_${safeProjName}_${dateStr}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Scientific Rigor JSON downloaded successfully', 'success');
    } catch (err) {
      showToast('Failed to download JSON file', 'error');
    }
  };

  const handleSelectAll = () => {
    setIncludeAiSpecs(true);
    setIncludePrisma(true);
    setIncludePreCalibration(true);
    setIncludePromptOptimization(true);
    setIncludeStageComparison(true);
    setIncludeRollingBatch(true);
    setIncludeLlmDirectives(true);
  };

  const handleDeselectAll = () => {
    setIncludeAiSpecs(false);
    setIncludePrisma(false);
    setIncludePreCalibration(false);
    setIncludePromptOptimization(false);
    setIncludeStageComparison(false);
    setIncludeRollingBatch(false);
    setIncludeLlmDirectives(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-foreground">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                Scientific Rigor &amp; AI Specifications Extractor
                <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  JSON Context · {selectedCount}/7 Sections
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Extract complete AI prompt specifications, Gemini JSON schemas, PRISMA data, calibration metrics, and sequential QC for journal transparency &amp; LLM writing.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-semibold">Compiling comprehensive scientific rigor &amp; AI specifications...</p>
            </div>
          ) : (
            <>
              {/* Section Selection Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Included Context Sections ({selectedCount} of 7 Active)
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1 bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-bold rounded-md transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1 bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground text-[11px] font-bold rounded-md transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  
                  {/* 1. AI Screening Technical Specifications (Highlighted) */}
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    includeAiSpecs 
                      ? 'bg-primary/5 border-primary/40 shadow-xs' 
                      : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includeAiSpecs}
                      onChange={(e) => setIncludeAiSpecs(e.target.checked)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                        AI Screening Technical Specifications
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Full system prompts, templates with variable dictionaries, native Gemini JSON response schemas, hyperparameter grids, and SHA-256 hashes across all 8 pipeline engines.
                      </p>
                    </div>
                  </label>

                  {/* 2. PRISMA 2020 Flow Data */}
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    includePrisma 
                      ? 'bg-primary/5 border-primary/40 shadow-xs' 
                      : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includePrisma}
                      onChange={(e) => setIncludePrisma(e.target.checked)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <FileCheck2 className="w-3.5 h-3.5 text-amber-500" />
                        PRISMA 2020 Flow Dataset
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Database identification counts, deduplication, abstract screening exclusions by EC code, retrieval, full-text exclusions, and included synthesis cohort.
                      </p>
                    </div>
                  </label>

                  {/* 3. Pre-Calibration Data */}
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    includePreCalibration 
                      ? 'bg-primary/5 border-primary/40 shadow-xs' 
                      : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includePreCalibration}
                      onChange={(e) => setIncludePreCalibration(e.target.checked)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Scale className="w-3.5 h-3.5 text-sky-500" />
                        Pre-Calibration Reliability
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Pool A/B/C filling status, double-blind inter-rater metrics (Cohen&apos;s Kappa, precision, weighted kappa), discrepancy counts, and consensus ledger.
                      </p>
                    </div>
                  </label>

                  {/* 4. Prompt Optimization & Audits */}
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    includePromptOptimization 
                      ? 'bg-primary/5 border-primary/40 shadow-xs' 
                      : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includePromptOptimization}
                      onChange={(e) => setIncludePromptOptimization(e.target.checked)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <BrainCircuit className="w-3.5 h-3.5 text-violet-500" />
                        Prompt Optimization &amp; Audits
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Consolidation audit scores (availability, semantics, chainability), meta-prompt optimization lineages, and 70/30 train-holdout benchmark runs.
                      </p>
                    </div>
                  </label>

                  {/* 5. Gold Standard Stage Comparisons */}
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    includeStageComparison 
                      ? 'bg-primary/5 border-primary/40 shadow-xs' 
                      : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includeStageComparison}
                      onChange={(e) => setIncludeStageComparison(e.target.checked)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Layers className="w-3.5 h-3.5 text-emerald-500" />
                        Gold Standard vs AI Comparisons
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Stage 1 Fast Filter (Recall/F1), Stage 2 Gatekeeper (Precision/Recall), Stage 3 Scientist (Weighted Kappa/Critical Miss), and Stage 4 Miner (Schema Exactness).
                      </p>
                    </div>
                  </label>

                  {/* 6. Rolling Batch Validation */}
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    includeRollingBatch 
                      ? 'bg-primary/5 border-primary/40 shadow-xs' 
                      : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includeRollingBatch}
                      onChange={(e) => setIncludeRollingBatch(e.target.checked)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Scale className="w-3.5 h-3.5 text-indigo-500" />
                        Sequential Rolling Batch QC
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Micro-batch audits (n=20/batch), Fleiss-Cohen standard errors, 95% CI lower bounds, stopping rule evaluation, and individual batch history.
                      </p>
                    </div>
                  </label>

                  {/* 7. LLM Master Directives */}
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    includeLlmDirectives 
                      ? 'bg-primary/5 border-primary/40 shadow-xs' 
                      : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includeLlmDirectives}
                      onChange={(e) => setIncludeLlmDirectives(e.target.checked)}
                      className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        LLM Narrative Directives
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Authoritative drafting instructions, PRISMA continuity equations, and AI technical disclosure guidance for writing a publication-grade Methodology section.
                      </p>
                    </div>
                  </label>

                </div>
              </div>

              {/* Formatting and Live JSON Preview */}
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs space-y-0">
                <div className="px-4 py-3 bg-secondary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-xs text-foreground">Live JSON Payload Preview</span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      ({payloadStats.sizeKb} KB · ~{payloadStats.estimatedTokens.toLocaleString()} tokens)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPretty}
                        onChange={(e) => setIsPretty(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>Pretty Print (2-space indent)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title={showPreview ? 'Collapse Preview' : 'Expand Preview'}
                    >
                      {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {showPreview && (
                  <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] max-h-80 overflow-auto select-text leading-relaxed">
                    <pre>{generatedJsonString || '// No sections selected.'}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 border-t border-border bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
            <div>
              Size: <span className="font-mono font-bold text-foreground">{payloadStats.sizeKb} KB</span>
            </div>
            <div className="h-3.5 w-px bg-border" />
            <div>
              Est. Tokens: <span className="font-mono font-bold text-foreground">~{payloadStats.estimatedTokens.toLocaleString()}</span>
            </div>
            <div className="h-3.5 w-px bg-border" />
            <div>
              Sections: <span className="font-mono font-bold text-foreground">{selectedCount} of 7</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyJson}
              disabled={loading || !generatedJsonString}
              className="flex-1 sm:flex-none px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard' : 'Copy JSON Context'}
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              disabled={loading || !generatedJsonString}
              className="flex-1 sm:flex-none px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download Rigor JSON
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
