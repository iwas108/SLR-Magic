'use client';

import React, { useState } from 'react';
import { 
  Lock, Unlock, Play, Sparkles, CheckCircle2, XCircle, AlertTriangle, 
  ChevronDown, ChevronRight, RefreshCw, BarChart2, ShieldCheck, FileText, Database
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
  onRunBenchmark,
  onOptimizePrompt
}: StageBenchmarkCardProps) {
  const [expandedResults, setExpandedResults] = useState(false);

  const metrics = benchmarkState?.summary_metrics;
  const holdout = benchmarkState?.holdout_metrics;
  const results = benchmarkState?.results || [];
  const discrepancies = results.filter(r => r.is_match === 0);

  const isCompleted = benchmarkState?.status === 'COMPLETED';
  const gatePassed = metrics?.prisma_gate_passed;

  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 backdrop-blur-md ${
      !isUnlocked 
        ? 'border-slate-200 dark:border-border bg-slate-50/70 dark:bg-card/60 opacity-80' 
        : isCompleted && gatePassed
        ? 'border-emerald-200 dark:border-emerald-500/40 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 dark:from-emerald-950/20 dark:via-slate-900/60 dark:to-slate-950/80 shadow-sm dark:shadow-[0_0_20px_rgba(16,185,129,0.08)]'
        : isCompleted && !gatePassed
        ? 'border-amber-200 dark:border-amber-500/40 bg-gradient-to-br from-amber-50/80 via-white to-yellow-50/60 dark:from-amber-950/20 dark:via-slate-900/60 dark:to-slate-950/80 shadow-sm dark:shadow-[0_0_20px_rgba(245,158,11,0.08)]'
        : 'border-sky-200 dark:border-cyan-500/40 bg-gradient-to-br from-sky-50/80 via-white to-cyan-50/60 dark:from-cyan-950/20 dark:via-slate-900/60 dark:to-slate-950/80 shadow-sm dark:shadow-[0_0_20px_rgba(6,182,212,0.08)]'
    }`}>
      {/* Decorative neon top highlight */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
        !isUnlocked ? 'bg-slate-200 dark:bg-slate-800' :
        isCompleted && gatePassed ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
        isCompleted && !gatePassed ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
        'bg-gradient-to-r from-cyan-500 to-blue-400'
      }`} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Stage Details */}
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg border ${
            !isUnlocked ? 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-secondary dark:text-muted-foreground dark:border-border' :
            isCompleted && gatePassed ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' :
            isCompleted && !gatePassed ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400' :
            'bg-cyan-100 border-cyan-300 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400'
          }`}>
            {!isUnlocked ? <Lock className="w-5 h-5" /> : <BarChart2 className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-800 dark:text-cyan-400 font-bold px-2.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800/40">
                Quest 0{stageNum + 1} • {stageName}
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-secondary dark:text-secondary-foreground dark:border-border">
                {poolName}
              </span>
              {!isUnlocked && (
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/40">
                  LOCKED
                </span>
              )}
              {isCompleted && (
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
                  gatePassed 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/40' 
                    : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/40'
                }`}>
                  {gatePassed ? 'PRISMA GATE PASSED' : 'TARGET DISCREPANCY'}
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              Sandbox Benchmark & Prompt Optimization Test
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {!isUnlocked 
                ? (lockReason || 'Complete prior stages and adjudicate calibration pool to unlock.')
                : `Runs active prompt against double-blind adjudicated ${poolName} dataset with 70% Calibration Tuning / 30% Holdout Split.`
              }
            </p>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRunBenchmark}
            disabled={!isUnlocked || isRunning}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono tracking-wide transition-all shadow-md ${
              isRunning
                ? 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-secondary dark:text-muted-foreground dark:border-border cursor-not-allowed'
                : isUnlocked
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-600/20 hover:shadow-blue-600/40 border border-blue-400/30 active:scale-98'
                : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-secondary/60 dark:text-muted-foreground dark:border-border cursor-not-allowed'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Running Benchmark...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-blue-200" />
                <span>{isCompleted ? 'Re-Run Benchmark' : 'Run Benchmark'}</span>
              </>
            )}
          </button>

          {isCompleted && discrepancies.length > 0 && (
            <button
              onClick={onOptimizePrompt}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono tracking-wide transition-all bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-purple-600/20 hover:shadow-purple-600/40 border border-purple-400/30 active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-200 animate-pulse" />
              <span>Prompt Optimization Magic</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row (When completed) */}
      {isCompleted && metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/60">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold">{stageNum === 4 ? 'Schema Integrity' : 'Accuracy'}</div>
            <div className="text-base font-mono font-extrabold text-slate-900 dark:text-slate-100">{metrics.accuracy_pct}%</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{metrics.tp + metrics.tn}/{metrics.total} papers</div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold">Recall</div>
            <div className={`text-base font-mono font-extrabold ${metrics.recall >= (stageNum === 1 ? 1.0 : 0.9) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {(metrics.recall * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Target: {stageNum === 1 ? '100%' : '>=90%'}</div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold">Precision</div>
            <div className={`text-base font-mono font-extrabold ${metrics.precision >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {(metrics.precision * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Target: &gt;=85%</div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold">F1-Score</div>
            <div className={`text-base font-mono font-extrabold ${metrics.f1 >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {metrics.f1.toFixed(3)}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Target: &gt;=0.850</div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold">{stageNum === 3 ? 'Weighted Kappa' : "Cohen's Kappa"}</div>
            <div className="text-base font-mono font-extrabold text-cyan-700 dark:text-cyan-300">{metrics.kappa.toFixed(3)}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{stageNum === 3 ? 'Target: >=0.650' : metrics.kappa_label}</div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase font-bold">Holdout (30%)</div>
            <div className="text-base font-mono font-extrabold text-purple-700 dark:text-purple-300">
              {holdout ? `${holdout.accuracy_pct}%` : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">F1: {holdout?.f1?.toFixed(2) || 'N/A'}</div>
          </div>
        </div>
      )}

      {/* Discrepancies & Results Inspector Toggle */}
      {isCompleted && results.length > 0 && (
        <div className="mt-3 pt-2">
          <button
            onClick={() => setExpandedResults(!expandedResults)}
            className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 transition-colors font-mono"
          >
            {expandedResults ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>
              {expandedResults ? 'Hide Discrepancy Breakdown' : `Inspect Paper-by-Paper Discrepancies (${discrepancies.length} mismatches / ${results.length} total)`}
            </span>
          </button>

          {expandedResults && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 text-xs font-mono space-y-2 max-h-96 overflow-y-auto shadow-inner">
              {results.map(res => {
                const isMatch = res.is_match === 1;
                return (
                  <div
                    key={res.paper_id}
                    className={`p-2.5 rounded border transition-all ${
                      isMatch
                        ? 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 shadow-sm'
                        : 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
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

                    <div className="text-slate-800 dark:text-slate-300 text-[11px] mt-1 line-clamp-1 font-sans">
                      {res.Title || 'No Title'}
                    </div>

                    {/* Reasoning Quotes & Traces via Centralized trace-normalizer */}
                    {res.ai_rationale && (
                      <div className="mt-1.5 text-[10px] text-slate-700 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800/40 font-sans">
                        <span className="text-cyan-700 dark:text-cyan-400 font-semibold">AI Rationale: </span>
                        {extractMappingReasoning(res.ai_rationale) || res.ai_rationale}
                      </div>
                    )}

                    {res.gold_rationale && !isMatch && (
                      <div className="mt-1 text-[10px] text-amber-900 dark:text-slate-300 bg-amber-50/90 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-500/30 font-sans">
                        <span className="text-amber-700 dark:text-amber-300 font-semibold">Human Consensus Rationale: </span>
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
