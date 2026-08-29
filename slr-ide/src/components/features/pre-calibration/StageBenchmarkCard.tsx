'use client';

import React, { useState } from 'react';
import { 
  Lock, Unlock, Play, Sparkles, CheckCircle2, XCircle, AlertTriangle, 
  ChevronDown, ChevronRight, RefreshCw, BarChart2, ShieldCheck, FileText, Database,
  TrendingUp, TrendingDown, Minus, History
} from 'lucide-react';
import { BenchmarkRunState } from '@/hooks/usePromptStaging';
import { extractMappingReasoning, extractEvidenceQuote } from '@/lib/services/trace-normalizer';

interface StageBenchmarkCardProps {
  stageNum: number;
  stageName: string;
  poolName: string;
  isUnlocked: boolean;
  lockReason?: string;
  benchmarkState: BenchmarkRunState | null;
  isRunning: boolean;
  isAnyTaskRunning?: boolean;
  onRunBenchmark: () => void;
  onOptimizePrompt: () => void;
}

export default function StageBenchmarkCard({
  stageNum,
  stageName,
  poolName,
  isUnlocked,
  lockReason,
  benchmarkState,
  isRunning,
  isAnyTaskRunning = false,
  onRunBenchmark,
  onOptimizePrompt
}: StageBenchmarkCardProps) {
  const [expandedResults, setExpandedResults] = useState(false);

  const metrics = benchmarkState?.summary_metrics;
  const holdout = benchmarkState?.holdout_metrics;
  const improvements = benchmarkState?.improvement_metrics;
  const results = benchmarkState?.results || [];
  const discrepancies = results.filter(r => r.is_match === 0);

  const isCompleted = benchmarkState?.status === 'COMPLETED';
  const gatePassed = metrics?.prisma_gate_passed;
  const hasMissingPdfs = stageNum >= 2 && Boolean(benchmarkState?.missing_pdf_count && benchmarkState.missing_pdf_count > 0);
  const hasZeroPoolPapers = benchmarkState?.pool_papers_count === 0;
  const isRunDisabled = !isUnlocked || isRunning || hasMissingPdfs || hasZeroPoolPapers || (isAnyTaskRunning && !isRunning);

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 bg-card shadow-xs ${
      !isUnlocked 
        ? 'border-border/60 bg-muted/20 opacity-75' 
        : hasMissingPdfs
        ? 'border-amber-200/80 dark:border-amber-500/30 ring-1 ring-amber-500/10'
        : isCompleted && gatePassed
        ? 'border-emerald-200/80 dark:border-emerald-500/30 ring-1 ring-emerald-500/10'
        : isCompleted && !gatePassed
        ? 'border-amber-200/80 dark:border-amber-500/30 ring-1 ring-amber-500/10'
        : 'border-border'
    }`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Stage Details */}
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            !isUnlocked ? 'bg-muted text-muted-foreground border-border' :
            hasMissingPdfs ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
            isCompleted && gatePassed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
            isCompleted && !gatePassed ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
            'bg-primary/10 border-primary/20 text-primary'
          }`}>
            {!isUnlocked ? <Lock className="w-5 h-5" /> : hasMissingPdfs ? <AlertTriangle className="w-5 h-5" /> : <BarChart2 className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold px-2 py-0.5 rounded bg-secondary border border-border">
                Quest 0{stageNum + 1} • {stageName}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold bg-secondary text-secondary-foreground border border-border">
                {poolName}
              </span>
              {!isUnlocked && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border">
                  LOCKED
                </span>
              )}
              {hasMissingPdfs && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  PDF Missing ({benchmarkState?.missing_pdf_count})
                </span>
              )}
              {isCompleted && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  gatePassed 
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}>
                  {gatePassed ? 'PRISMA GATE PASSED' : 'TARGET DISCREPANCY'}
                </span>
              )}
              {isCompleted && improvements && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                  improvements.has_improved 
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                    : improvements.has_regressed
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                    : 'bg-secondary text-secondary-foreground border-border'
                }`}>
                  {improvements.has_improved ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        IMPROVED ({improvements.accuracy_diff > 0 ? `+${improvements.accuracy_diff.toFixed(1)}% Acc` : improvements.f1_diff > 0 ? `+${improvements.f1_diff.toFixed(3)} F1` : `+${improvements.recall_diff.toFixed(1)}% Rec`})
                      </span>
                    </>
                  ) : improvements.has_regressed ? (
                    <>
                      <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span>REGRESSED ({improvements.accuracy_diff < 0 ? `${improvements.accuracy_diff.toFixed(1)}% Acc` : `${improvements.f1_diff.toFixed(3)} F1`})</span>
                    </>
                  ) : (
                    <>
                      <Minus className="w-3 h-3 opacity-60" />
                      <span>BASELINE MATCHED</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-foreground mt-1">
              Sandbox Benchmark & Prompt Optimization Test
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {!isUnlocked 
                ? (lockReason || 'Complete prior stages and adjudicate calibration pool to unlock.')
                : `Runs active prompt against double-blind adjudicated ${poolName} dataset with 70% Calibration Tuning / 30% Holdout Split.`
              }
            </p>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={onRunBenchmark}
            disabled={isRunDisabled}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono tracking-wide transition-all shadow-xs ${
              isRunDisabled
                ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-98 shadow-sm'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Benchmark...</span>
              </>
            ) : hasMissingPdfs ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>PDF Required ({benchmarkState?.missing_pdf_count} Missing)</span>
              </>
            ) : hasZeroPoolPapers ? (
              <>
                <Database className="w-3.5 h-3.5 opacity-60" />
                <span>No Papers in Pool</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current opacity-80" />
                <span>{isCompleted ? 'Re-Run Benchmark' : 'Run Benchmark'}</span>
              </>
            )}
          </button>

          {isCompleted && discrepancies.length > 0 && (
            <button
              onClick={onOptimizePrompt}
              disabled={isAnyTaskRunning}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono tracking-wide transition-all shadow-xs ${
                isAnyTaskRunning
                  ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
                  : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border active:scale-98'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Prompt Optimization</span>
            </button>
          )}
        </div>
      </div>

      {/* Missing PDF Warning Box for Quest 03, 04, 05 */}
      {hasMissingPdfs && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-sans">
            <span className="font-bold">PDF Files Required for Quest 0{stageNum + 1}:</span> {benchmarkState?.missing_pdf_count} paper(s) in {poolName} do not have local PDF files available on disk. Full-text appraisal and extraction require valid local PDF files for 100% of the papers before this benchmark can run.
          </div>
        </div>
      )}

      {/* Metrics Row (When completed) */}
      {isCompleted && metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-border">
          {/* 1. Accuracy */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">
                  {stageNum === 4 ? 'Schema Integrity' : 'Accuracy'}
                </span>
                {improvements && (
                  <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                    improvements.accuracy_diff > 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : improvements.accuracy_diff < 0 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {improvements.accuracy_diff > 0 ? <TrendingUp className="w-3 h-3" /> : improvements.accuracy_diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {improvements.accuracy_diff > 0 ? `+${improvements.accuracy_diff.toFixed(1)}%` : `${improvements.accuracy_diff.toFixed(1)}%`}
                  </span>
                )}
              </div>
              <div className="text-base font-mono font-extrabold text-foreground mt-0.5">{metrics.accuracy_pct}%</div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              <div>{metrics.tp + metrics.tn}/{metrics.total} papers</div>
              {improvements?.previous_summary_metrics && (
                <div className="text-muted-foreground/75 text-[9px]">
                  Prev: {improvements.previous_summary_metrics.accuracy_pct}%
                </div>
              )}
            </div>
          </div>

          {/* 2. Recall */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">Recall</span>
                {improvements && (
                  <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                    improvements.recall_diff > 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : improvements.recall_diff < 0 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {improvements.recall_diff > 0 ? <TrendingUp className="w-3 h-3" /> : improvements.recall_diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {improvements.recall_diff > 0 ? `+${improvements.recall_diff.toFixed(1)}%` : `${improvements.recall_diff.toFixed(1)}%`}
                  </span>
                )}
              </div>
              <div className={`text-base font-mono font-extrabold mt-0.5 ${metrics.recall >= (stageNum === 1 ? 1.0 : 0.9) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {(metrics.recall * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              <div>Target: {stageNum === 1 ? '100%' : '>=90%'}</div>
              {improvements?.previous_summary_metrics && (
                <div className="text-muted-foreground/75 text-[9px]">
                  Prev: {(improvements.previous_summary_metrics.recall * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          {/* 3. Precision */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">Precision</span>
                {improvements && (
                  <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                    improvements.precision_diff > 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : improvements.precision_diff < 0 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {improvements.precision_diff > 0 ? <TrendingUp className="w-3 h-3" /> : improvements.precision_diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {improvements.precision_diff > 0 ? `+${improvements.precision_diff.toFixed(1)}%` : `${improvements.precision_diff.toFixed(1)}%`}
                  </span>
                )}
              </div>
              <div className={`text-base font-mono font-extrabold mt-0.5 ${metrics.precision >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {(metrics.precision * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              <div>Target: &gt;=85%</div>
              {improvements?.previous_summary_metrics && (
                <div className="text-muted-foreground/75 text-[9px]">
                  Prev: {(improvements.previous_summary_metrics.precision * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          {/* 4. F1-Score */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">F1-Score</span>
                {improvements && (
                  <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                    improvements.f1_diff > 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : improvements.f1_diff < 0 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {improvements.f1_diff > 0 ? <TrendingUp className="w-3 h-3" /> : improvements.f1_diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {improvements.f1_diff > 0 ? `+${improvements.f1_diff.toFixed(3)}` : `${improvements.f1_diff.toFixed(3)}`}
                  </span>
                )}
              </div>
              <div className={`text-base font-mono font-extrabold mt-0.5 ${metrics.f1 >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {metrics.f1.toFixed(3)}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              <div>Target: &gt;=0.850</div>
              {improvements?.previous_summary_metrics && (
                <div className="text-muted-foreground/75 text-[9px]">
                  Prev: {improvements.previous_summary_metrics.f1.toFixed(3)}
                </div>
              )}
            </div>
          </div>

          {/* 5. Kappa */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">
                  {stageNum === 3 ? 'Weighted Kappa' : "Cohen's Kappa"}
                </span>
                {improvements && (
                  <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                    improvements.kappa_diff > 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : improvements.kappa_diff < 0 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {improvements.kappa_diff > 0 ? <TrendingUp className="w-3 h-3" /> : improvements.kappa_diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {improvements.kappa_diff > 0 ? `+${improvements.kappa_diff.toFixed(3)}` : `${improvements.kappa_diff.toFixed(3)}`}
                  </span>
                )}
              </div>
              <div className="text-base font-mono font-extrabold text-foreground mt-0.5">{metrics.kappa.toFixed(3)}</div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              <div>{stageNum === 3 ? 'Target: >=0.650' : metrics.kappa_label}</div>
              {improvements?.previous_summary_metrics && (
                <div className="text-muted-foreground/75 text-[9px]">
                  Prev: {improvements.previous_summary_metrics.kappa.toFixed(3)}
                </div>
              )}
            </div>
          </div>

          {/* 6. Holdout */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold">Holdout (30%)</span>
                {improvements && improvements.holdout_accuracy_diff !== null && improvements.holdout_accuracy_diff !== undefined && (
                  <span className={`text-[10px] font-mono font-bold flex items-center gap-0.5 ${
                    improvements.holdout_accuracy_diff > 0 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : improvements.holdout_accuracy_diff < 0 
                      ? 'text-rose-600 dark:text-rose-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {improvements.holdout_accuracy_diff > 0 ? <TrendingUp className="w-3 h-3" /> : improvements.holdout_accuracy_diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {improvements.holdout_accuracy_diff > 0 ? `+${improvements.holdout_accuracy_diff.toFixed(1)}%` : `${improvements.holdout_accuracy_diff.toFixed(1)}%`}
                  </span>
                )}
              </div>
              <div className="text-base font-mono font-extrabold text-foreground mt-0.5">
                {holdout ? `${holdout.accuracy_pct}%` : 'N/A'}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              <div>F1: {holdout?.f1 !== undefined ? holdout.f1.toFixed(2) : 'N/A'}</div>
              {improvements?.previous_holdout_metrics && (
                <div className="text-muted-foreground/75 text-[9px]">
                  Prev: {improvements.previous_holdout_metrics.accuracy_pct ?? 'N/A'}% (F1: {improvements.previous_holdout_metrics.f1 !== undefined ? improvements.previous_holdout_metrics.f1.toFixed(2) : 'N/A'})
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comparison History Bar (When previous benchmark run is available) */}
      {isCompleted && improvements && (
        <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-secondary/30 border border-border flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <History className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              Benchmark Improvement vs Previous Run ({improvements.previous_created_at ? new Date(improvements.previous_created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + new Date(improvements.previous_created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Previous Run'})
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] font-semibold flex-wrap">
            <span className={improvements.accuracy_diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : improvements.accuracy_diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}>
              Accuracy: {improvements.accuracy_diff > 0 ? `+${improvements.accuracy_diff.toFixed(1)}%` : `${improvements.accuracy_diff.toFixed(1)}%`}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className={improvements.recall_diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : improvements.recall_diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}>
              Recall: {improvements.recall_diff > 0 ? `+${improvements.recall_diff.toFixed(1)}%` : `${improvements.recall_diff.toFixed(1)}%`}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className={improvements.f1_diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : improvements.f1_diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}>
              F1: {improvements.f1_diff > 0 ? `+${improvements.f1_diff.toFixed(3)}` : `${improvements.f1_diff.toFixed(3)}`}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className={improvements.kappa_diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : improvements.kappa_diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}>
              Kappa: {improvements.kappa_diff > 0 ? `+${improvements.kappa_diff.toFixed(3)}` : `${improvements.kappa_diff.toFixed(3)}`}
            </span>
          </div>
        </div>
      )}

      {/* Discrepancies & Results Inspector Toggle */}
      {isCompleted && results.length > 0 && (
        <div className="mt-3 pt-2">
          <button
            onClick={() => setExpandedResults(!expandedResults)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors font-mono font-medium"
          >
            {expandedResults ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>
              {expandedResults ? 'Hide Discrepancy Breakdown' : `Inspect Paper-by-Paper Discrepancies (${discrepancies.length} mismatches / ${results.length} total)`}
            </span>
          </button>

          {expandedResults && (
            <div className="mt-3 p-3 rounded-xl bg-secondary/30 border border-border text-xs font-mono space-y-2 max-h-96 overflow-y-auto">
              {results.map(res => {
                const isMatch = res.is_match === 1;
                return (
                  <div
                    key={res.paper_id}
                    className={`p-3 rounded-lg border transition-all ${
                      isMatch
                        ? 'bg-card border-border'
                        : 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {isMatch ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        )}
                        <span className="font-bold text-foreground">{res.paper_id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground border border-border">
                          {res.partition_type === 'train' ? '70% Train' : '30% Holdout'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">AI: </span>
                          <span className={res.ai_decision === 'Include' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                            {res.ai_decision || 'N/A'} {res.ai_exclusion_code && res.ai_exclusion_code !== 'NONE' ? `(${res.ai_exclusion_code})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Gold: </span>
                          <span className={res.gold_decision?.startsWith('Include') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                            {res.gold_decision || 'N/A'} {res.gold_exclusion_code ? `(${res.gold_exclusion_code})` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-foreground text-[11px] mt-1 font-sans line-clamp-1 font-medium">
                      {res.Title || 'No Title'}
                    </div>

                    {/* Reasoning Quotes & Traces via Centralized trace-normalizer */}
                    {res.ai_rationale && (
                      <div className="mt-1.5 text-[10px] text-muted-foreground bg-secondary/50 p-2 rounded-md border border-border font-sans leading-relaxed">
                        <span className="text-foreground font-semibold">AI Rationale: </span>
                        {extractMappingReasoning(res.ai_rationale) || res.ai_rationale}
                      </div>
                    )}

                    {res.gold_rationale && !isMatch && (
                      <div className="mt-1 text-[10px] text-amber-800 dark:text-amber-300 bg-amber-500/10 p-2 rounded-md border border-amber-500/20 font-sans leading-relaxed">
                        <span className="font-semibold">Human Consensus Rationale: </span>
                        {res.gold_rationale}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
