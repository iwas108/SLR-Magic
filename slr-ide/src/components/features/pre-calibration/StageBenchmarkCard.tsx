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
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 bg-card shadow-xs ${
      !isUnlocked 
        ? 'border-border/60 bg-muted/20 opacity-75' 
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
            isCompleted && gatePassed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
            isCompleted && !gatePassed ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
            'bg-primary/10 border-primary/20 text-primary'
          }`}>
            {!isUnlocked ? <Lock className="w-5 h-5" /> : <BarChart2 className="w-5 h-5" />}
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
              {isCompleted && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  gatePassed 
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}>
                  {gatePassed ? 'PRISMA GATE PASSED' : 'TARGET DISCREPANCY'}
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
            disabled={!isUnlocked || isRunning}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono tracking-wide transition-all shadow-xs ${
              isRunning || !isUnlocked
                ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-98 shadow-sm'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Benchmark...</span>
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
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono tracking-wide transition-all bg-secondary text-foreground hover:bg-secondary/80 border border-border active:scale-98 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Prompt Optimization</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row (When completed) */}
      {isCompleted && metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-border">
          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="text-[10px] text-muted-foreground font-mono uppercase font-bold">{stageNum === 4 ? 'Schema Integrity' : 'Accuracy'}</div>
            <div className="text-base font-mono font-extrabold text-foreground mt-0.5">{metrics.accuracy_pct}%</div>
            <div className="text-[10px] text-muted-foreground font-mono">{metrics.tp + metrics.tn}/{metrics.total} papers</div>
          </div>

          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="text-[10px] text-muted-foreground font-mono uppercase font-bold">Recall</div>
            <div className={`text-base font-mono font-extrabold mt-0.5 ${metrics.recall >= (stageNum === 1 ? 1.0 : 0.9) ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {(metrics.recall * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">Target: {stageNum === 1 ? '100%' : '>=90%'}</div>
          </div>

          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="text-[10px] text-muted-foreground font-mono uppercase font-bold">Precision</div>
            <div className={`text-base font-mono font-extrabold mt-0.5 ${metrics.precision >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {(metrics.precision * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">Target: &gt;=85%</div>
          </div>

          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="text-[10px] text-muted-foreground font-mono uppercase font-bold">F1-Score</div>
            <div className={`text-base font-mono font-extrabold mt-0.5 ${metrics.f1 >= 0.85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {metrics.f1.toFixed(3)}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">Target: &gt;=0.850</div>
          </div>

          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="text-[10px] text-muted-foreground font-mono uppercase font-bold">{stageNum === 3 ? 'Weighted Kappa' : "Cohen's Kappa"}</div>
            <div className="text-base font-mono font-extrabold text-foreground mt-0.5">{metrics.kappa.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{stageNum === 3 ? 'Target: >=0.650' : metrics.kappa_label}</div>
          </div>

          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="text-[10px] text-muted-foreground font-mono uppercase font-bold">Holdout (30%)</div>
            <div className="text-base font-mono font-extrabold text-foreground mt-0.5">
              {holdout ? `${holdout.accuracy_pct}%` : 'N/A'}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">F1: {holdout?.f1?.toFixed(2) || 'N/A'}</div>
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
