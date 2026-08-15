'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, ShieldAlert, Sparkles, RefreshCw, CheckCircle2, XCircle, 
  ChevronDown, ChevronRight, AlertTriangle, Cpu, Terminal, ArrowRight, BookOpen
} from 'lucide-react';
import { PromptAvailability, AuditReport } from '@/hooks/usePromptStaging';

interface PromptConsolidationCardProps {
  promptAvailability: PromptAvailability;
  auditScores: any;
  auditReport: AuditReport | null;
  loadingAudit: boolean;
  onRunAudit: () => void;
}

export default function PromptConsolidationCard({
  promptAvailability,
  auditScores,
  auditReport,
  loadingAudit,
  onRunAudit
}: PromptConsolidationCardProps) {
  const [expandedConsole, setExpandedConsole] = useState(false);

  const isReady = promptAvailability.total_available === 4;
  const isPassed = auditScores?.status === 'PASSED';
  const isWarning = auditScores?.status === 'WARNING';
  const isFailed = auditScores?.status === 'FAILED';

  const availabilityCount = promptAvailability.total_available;
  const semanticCount = auditScores?.semantic_passed_count ?? (isPassed ? 4 : (isWarning ? 3 : 0));
  const chainabilityCount = auditScores?.chainability_passed_count ?? (isPassed ? 5 : (isWarning ? 4 : 0));

  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-300 backdrop-blur-md ${
      isPassed 
        ? 'border-emerald-200 dark:border-emerald-500/40 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 dark:from-emerald-950/20 dark:via-slate-900/60 dark:to-slate-950/80 shadow-sm dark:shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
        : isWarning
        ? 'border-amber-200 dark:border-amber-500/40 bg-gradient-to-br from-amber-50/80 via-white to-yellow-50/60 dark:from-amber-950/20 dark:via-slate-900/60 dark:to-slate-950/80 shadow-sm dark:shadow-[0_0_20px_rgba(245,158,11,0.1)]'
        : isFailed
        ? 'border-rose-200 dark:border-rose-500/40 bg-gradient-to-br from-rose-50/80 via-white to-red-50/60 dark:from-rose-950/20 dark:via-slate-900/60 dark:to-slate-950/80 shadow-sm dark:shadow-[0_0_20px_rgba(244,63,94,0.1)]'
        : 'border-sky-200 dark:border-cyan-500/40 bg-gradient-to-br from-sky-50/80 via-white to-cyan-50/60 dark:from-cyan-950/20 dark:via-slate-900/60 dark:to-slate-950/80 shadow-sm dark:shadow-[0_0_20px_rgba(6,182,212,0.1)]'
    }`}>
      {/* Decorative neon top highlight */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
        isPassed ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
        isWarning ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
        isFailed ? 'bg-gradient-to-r from-rose-500 to-red-400' :
        'bg-gradient-to-r from-cyan-500 to-blue-400'
      }`} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Stage Badge */}
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg border ${
            isPassed ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400' :
            isWarning ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400' :
            isFailed ? 'bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400' :
            'bg-cyan-100 border-cyan-300 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400'
          }`}>
            <Cpu className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-800 dark:text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800/40">
                Quest 01 • Inter-Stage Consolidation
              </span>
              {auditScores?.status && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  isPassed ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/40' :
                  isWarning ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/40' :
                  'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/40'
                }`}>
                  {auditScores.status}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              Prompt Suite Consolidation & Semantic Chainability
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Validates all 4 pipeline stage prompts against project research scope, exclusion criteria orthogonality, and logic flow continuity.
            </p>
          </div>
        </div>

        {/* Action Trigger Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRunAudit}
            disabled={loadingAudit || !isReady}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-wide transition-all shadow-md ${
              loadingAudit
                ? 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed'
                : isReady
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-cyan-600/20 hover:shadow-cyan-600/40 border border-cyan-400/30 active:scale-98'
                : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 cursor-not-allowed'
            }`}
          >
            {loadingAudit ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Auditing Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                <span>{auditScores ? 'Re-Run Inter-Stage Audit' : 'Run Inter-Stage Audit'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3 Core Check Metric Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/60">
        {/* Metric A: Prompt Availability */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-md ${availabilityCount === 4 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
              {availabilityCount === 4 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Prompt Availability</div>
              <div className="text-xs text-slate-900 dark:text-slate-100 font-mono font-medium">4-Stage LLM Suite</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-mono font-extrabold ${availabilityCount === 4 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {availabilityCount}/4
            </span>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Configured</div>
          </div>
        </div>

        {/* Metric B: Semantic Alignment */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-md ${semanticCount >= 4 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : semanticCount >= 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}`}>
              {semanticCount >= 4 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Semantic Check</div>
              <div className="text-xs text-slate-900 dark:text-slate-100 font-mono font-medium">Research Scope Fit</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-mono font-extrabold ${semanticCount >= 4 ? 'text-emerald-600 dark:text-emerald-400' : semanticCount >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {semanticCount}/4
            </span>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Stages Aligned</div>
          </div>
        </div>

        {/* Metric C: Chainability & Consistency */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-md ${chainabilityCount >= 5 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : chainabilityCount >= 4 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}`}>
              {chainabilityCount >= 5 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Chainability Check</div>
              <div className="text-xs text-slate-900 dark:text-slate-100 font-mono font-medium">Inter-Stage Logic Flow</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-mono font-extrabold ${chainabilityCount >= 5 ? 'text-emerald-600 dark:text-emerald-400' : chainabilityCount >= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
              {chainabilityCount}/5
            </span>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">Gates Verified</div>
          </div>
        </div>
      </div>

      {/* Expandable Diagnostic Console Toggle */}
      {auditReport && (
        <div className="mt-3 pt-2">
          <button
            onClick={() => setExpandedConsole(!expandedConsole)}
            className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 transition-colors font-mono"
          >
            {expandedConsole ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>{expandedConsole ? 'Hide Consolidation Diagnostic Console' : 'Show Consolidation Diagnostic Console & Recommendations'}</span>
          </button>

          {expandedConsole && (
            <div className="mt-3 p-4 rounded-lg bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 text-xs font-mono space-y-3 shadow-inner">
              {/* Recommendations */}
              {auditReport.actionable_recommendations && auditReport.actionable_recommendations.length > 0 && (
                <div>
                  <div className="text-cyan-700 dark:text-cyan-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Actionable Recommendations:</span>
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-slate-800 dark:text-slate-300">
                    {auditReport.actionable_recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Semantic Analysis Breakdown */}
              {auditReport.semantic_alignment_evaluation && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 shadow-sm">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold">Fast Filter Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-0.5 font-sans">
                      {auditReport.semantic_alignment_evaluation.fast_filter_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 shadow-sm">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold">Gatekeeper Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-0.5 font-sans">
                      {auditReport.semantic_alignment_evaluation.gatekeeper_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 shadow-sm">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold">Scientist Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-0.5 font-sans">
                      {auditReport.semantic_alignment_evaluation.scientist_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 shadow-sm">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold">Miner Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-0.5 font-sans">
                      {auditReport.semantic_alignment_evaluation.miner_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Chainability & Schema Flow Breakdown */}
              {auditReport.chainability_and_consistency && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <div className="text-cyan-700 dark:text-cyan-300 font-semibold mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Inter-Stage Logic Flow & Schema Continuity:</span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-300 text-[11px] p-2.5 rounded bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 font-sans shadow-sm">
                    {auditReport.chainability_and_consistency.notes || 
                     (typeof auditReport.chainability_and_consistency === 'string' ? auditReport.chainability_and_consistency : 'All 5 inter-stage gates passed logic flow and exclusion criteria continuity.')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
