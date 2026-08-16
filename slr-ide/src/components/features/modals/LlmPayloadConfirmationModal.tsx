'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, X, Copy, Check, Terminal, Sliders, Database, Layers, 
  FileText, ShieldCheck, ShieldAlert, Cpu, DollarSign, BarChart2,
  ChevronDown, AlertTriangle, Play, RefreshCw, Lock, Eye, Zap, Clock
} from 'lucide-react';

export interface LlmPayloadPreviewData {
  preview_type: 'consolidation_audit' | 'stage_benchmark';
  action_title: string;
  vault_unlocked: boolean;
  model_id: string;
  system_instruction: string;
  hydrated_user_prompt?: string;
  generation_config: {
    temperature: number;
    max_output_tokens: number;
    top_p?: number;
    top_k?: number;
    execution_mode?: string;
    thinking_level?: string;
    thinking_budget?: number;
    concurrency?: number;
    delay_ms?: number;
  };
  response_schema: Record<string, any>;
  stage_prompts?: Array<{
    stage: number;
    type: string;
    name: string;
    id?: string;
    available: boolean;
  }>;
  available_count?: number;
  paper_samples?: Array<{
    paper_id: string;
    title: string;
    authors: string;
    year: string | number;
    partition: 'train' | 'holdout';
    gold_decision: string;
    gold_exclusion_code: string;
    gold_rationale: string;
    hydrated_user_prompt: string;
    estimated_input_tokens: number;
  }>;
  partition_summary?: {
    total_papers: number;
    train_count: number;
    holdout_count: number;
  };
  metrics: {
    estimated_input_tokens: number;
    estimated_output_tokens: number;
    estimated_total_tokens: number;
    estimated_cost_usd: number;
    total_calls: number;
  };
}

interface LlmPayloadConfirmationModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  previewData: LlmPayloadPreviewData | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LlmPayloadConfirmationModal({
  isOpen,
  isLoading,
  error,
  previewData,
  onClose,
  onConfirm
}: LlmPayloadConfirmationModalProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'config' | 'scope'>('prompt');
  const [selectedPaperIndex, setSelectedPaperIndex] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedSystem, setCopiedSystem] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Reset selected paper index when modal opens or preview data changes
  useEffect(() => {
    if (isOpen) {
      setSelectedPaperIndex(0);
    }
  }, [isOpen, previewData?.action_title]);

  if (!isOpen) return null;

  const isBenchmark = previewData?.preview_type === 'stage_benchmark';
  const paperSamples = previewData?.paper_samples || [];
  const safePaperIndex = selectedPaperIndex < paperSamples.length ? selectedPaperIndex : 0;
  const currentPaper = paperSamples[safePaperIndex] || paperSamples[0] || null;

  const currentPromptText = isBenchmark 
    ? (currentPaper?.hydrated_user_prompt || '') 
    : (previewData?.hydrated_user_prompt || '');

  const copyToClipboard = async (text: string, type: 'prompt' | 'system' | 'schema') => {
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      if (type === 'prompt') {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      } else if (type === 'system') {
        setCopiedSystem(true);
        setTimeout(() => setCopiedSystem(false), 2000);
      } else if (type === 'schema') {
        setCopiedSchema(true);
        setTimeout(() => setCopiedSchema(false), 2000);
      }
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        
        {/* Top Highlight Accent */}
        <div className="h-1 bg-primary" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  LLM Dispatch Preview
                </span>
                {previewData && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                    previewData.vault_unlocked
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  }`}>
                    {previewData.vault_unlocked ? <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                    {previewData.vault_unlocked ? 'Vault Unlocked' : 'Vault Locked'}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-foreground mt-1">
                {previewData?.action_title || 'Inspect Data Sent to LLM API'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <div className="text-sm font-mono text-foreground font-semibold">
              Hydrating prompt template & calculating token metrics...
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm text-center">
              Generating exact server-side payload dry-run without making paid API calls.
            </p>
          </div>
        )}

        {/* Error View */}
        {!isLoading && error && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Unable to Prepare Payload Preview</h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 text-center max-w-md bg-rose-50 dark:bg-rose-950/30 p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 font-mono">
              {error}
            </p>
          </div>
        )}

        {/* Content View */}
        {!isLoading && !error && previewData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Top Metric Badges Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
              {/* Metric 1: Model ID */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono font-semibold text-slate-500 dark:text-slate-400">Target Model</div>
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
                    {previewData.model_id}
                  </div>
                </div>
              </div>

              {/* Metric 2: Estimated Tokens */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono font-semibold text-slate-500 dark:text-slate-400">Est. Tokens</div>
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                    ~{previewData.metrics.estimated_total_tokens.toLocaleString()} tokens
                  </div>
                </div>
              </div>

              {/* Metric 3: Projected Cost */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono font-semibold text-slate-500 dark:text-slate-400">Projected Cost</div>
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ${previewData.metrics.estimated_cost_usd < 0.0001 ? '< $0.0001' : previewData.metrics.estimated_cost_usd.toFixed(4)} USD
                  </div>
                </div>
              </div>

              {/* Metric 4: API Calls / Batch Size */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono font-semibold text-slate-500 dark:text-slate-400">
                    {isBenchmark ? 'Batch Papers' : 'Execution Scope'}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                    {isBenchmark 
                      ? `${previewData.partition_summary?.total_papers || 0} papers (${previewData.partition_summary?.train_count}T / ${previewData.partition_summary?.holdout_count}H)`
                      : '4 Pipeline Stages'}
                  </div>
                </div>
              </div>
            </div>

            {/* Locked Vault Warning Alert */}
            {!previewData.vault_unlocked && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Vault is currently locked.</strong> You can inspect the prompt payload below, but you must unlock the vault in <strong>Settings</strong> to execute the API call.
                </span>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex items-center gap-1.5 px-4 pt-3 border-b border-slate-200 dark:border-slate-800 shrink-0 select-none">
              <button
                onClick={() => setActiveTab('prompt')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition-all ${
                  activeTab === 'prompt'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30 rounded-t-lg'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Hydrated Prompt & Context</span>
              </button>

              <button
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition-all ${
                  activeTab === 'config'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30 rounded-t-lg'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Model & JSON Schema</span>
              </button>

              <button
                onClick={() => setActiveTab('scope')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition-all ${
                  activeTab === 'scope'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30 rounded-t-lg'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isBenchmark ? 'Dataset Partition' : 'Resolved Stage Prompts'}</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* TAB 1: Hydrated Prompt & Context */}
              {activeTab === 'prompt' && (
                <div className="space-y-4">
                  {/* System Instruction Box */}
                  {previewData.system_instruction && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>System Instruction:</span>
                        </span>
                        <button
                          onClick={() => copyToClipboard(previewData.system_instruction, 'system')}
                          className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          {copiedSystem ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedSystem ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-36 overflow-y-auto p-2.5 rounded bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                        {previewData.system_instruction}
                      </pre>
                    </div>
                  )}

                  {/* Benchmark Paper Selector (If multiple papers) */}
                  {isBenchmark && paperSamples.length > 0 && (
                    <div className="p-3 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                        <div>
                          <div className="text-[11px] font-mono font-bold text-cyan-900 dark:text-cyan-300">
                            Select Paper Payload Sample ({paperSamples.length} total)
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Showing prompt hydrated with paper metadata & gold labels
                          </div>
                        </div>
                      </div>

                      <select
                        value={selectedPaperIndex}
                        onChange={(e) => setSelectedPaperIndex(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        {paperSamples.map((p, idx) => (
                          <option key={p.paper_id} value={idx}>
                            [{p.partition.toUpperCase()}] {p.paper_id} — {p.title.slice(0, 45)}... ({p.gold_decision})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Hydrated User Prompt Content */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Hydrated User Prompt ({currentPromptText.length.toLocaleString()} characters)
                        </span>
                        {isBenchmark && currentPaper && (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            currentPaper.partition === 'train' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          }`}>
                            {currentPaper.partition === 'train' ? '70% Train' : '30% Holdout'}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => copyToClipboard(currentPromptText, 'prompt')}
                        className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 shadow-sm"
                      >
                        {copiedPrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedPrompt ? 'Copied Full Prompt' : 'Copy Prompt'}</span>
                      </button>
                    </div>

                    <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-80 overflow-y-auto p-3.5 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-inner leading-relaxed">
                      {currentPromptText || 'No prompt content hydrated.'}
                    </pre>
                  </div>
                </div>
              )}

              {/* TAB 2: Model & JSON Schema */}
              {activeTab === 'config' && (
                <div className="space-y-4">
                  {/* Generation Config Parameters Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Temperature</div>
                      <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {previewData.generation_config.temperature}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Max Tokens</div>
                      <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {previewData.generation_config.max_output_tokens.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Top-P / Top-K</div>
                      <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {previewData.generation_config.top_p ?? 'Auto'} / {previewData.generation_config.top_k ?? 'Auto'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Speed Mode</div>
                      <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        {previewData.generation_config.execution_mode || 'STANDARD'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">Thinking Level</div>
                      <div className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 mt-0.5 capitalize">
                        {previewData.generation_config.thinking_level || 'standard'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                        {isBenchmark ? 'Workers / Delay' : 'Call Strategy'}
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {isBenchmark 
                          ? `${previewData.generation_config.concurrency || 2}w (${previewData.generation_config.delay_ms || 400}ms)` 
                          : 'Single Direct Call'}
                      </div>
                    </div>
                  </div>

                  {/* Formatted JSON Schema */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Enforced Structured JSON Schema (responseSchema)
                      </span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(previewData.response_schema, null, 2), 'schema')}
                        className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                      >
                        {copiedSchema ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSchema ? 'Copied' : 'Copy Schema'}</span>
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-cyan-800 dark:text-cyan-300 whitespace-pre-wrap max-h-72 overflow-y-auto p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-inner">
                      {JSON.stringify(previewData.response_schema, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* TAB 3: Scope / Dataset Partition */}
              {activeTab === 'scope' && (
                <div className="space-y-4">
                  {/* Consolidation Audit Stage Prompts Scope */}
                  {!isBenchmark && previewData.stage_prompts && (
                    <div className="space-y-2">
                      <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Resolved 4 Pipeline Stage Prompts Analyzed:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {previewData.stage_prompts.map((st) => (
                          <div
                            key={st.stage}
                            className={`p-3 rounded-xl border transition-all ${
                              st.available
                                ? 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                                : 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100">
                                Stage {st.stage}: {st.type}
                              </span>
                              <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold ${
                                st.available 
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' 
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                              }`}>
                                {st.available ? 'CONFIGURED' : 'MISSING'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                              {st.name || 'Unnamed Template'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Benchmark Pool Partition Breakdown */}
                  {isBenchmark && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Adjudicated Dataset Pool ({paperSamples.length} Papers):
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {previewData.partition_summary?.train_count} Calibration Tuning (70%) • {previewData.partition_summary?.holdout_count} Holdout Validation (30%)
                        </span>
                      </div>

                      <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="p-2.5">Paper ID</th>
                              <th className="p-2.5">Partition</th>
                              <th className="p-2.5">Title</th>
                              <th className="p-2.5">Gold Decision</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                            {paperSamples.map((p) => (
                              <tr key={p.paper_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{p.paper_id}</td>
                                <td className="p-2.5">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    p.partition === 'train'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                      : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  }`}>
                                    {p.partition.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-800 dark:text-slate-300 truncate max-w-[280px]">
                                  {p.title}
                                </td>
                                <td className="p-2.5">
                                  <span className={`font-bold ${
                                    p.gold_decision.startsWith('Include')
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {p.gold_decision} {p.gold_exclusion_code !== 'NONE' ? `(${p.gold_exclusion_code})` : ''}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            Cancel / Abort
          </button>

          <div className="flex items-center gap-3">
            {previewData && (
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Total Projected Cost</div>
                <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ~${previewData.metrics.estimated_cost_usd.toFixed(4)} USD
                </div>
              </div>
            )}

            <button
              onClick={onConfirm}
              disabled={isLoading || !previewData || !previewData.vault_unlocked}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold tracking-wide transition-all shadow-md ${
                !previewData?.vault_unlocked || isLoading || !previewData
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white shadow-cyan-600/20 hover:shadow-cyan-600/40 border border-cyan-400/30 active:scale-98'
              }`}
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              <span>Confirm & Execute LLM Run</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
