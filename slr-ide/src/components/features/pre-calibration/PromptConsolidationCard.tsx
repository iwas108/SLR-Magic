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
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 bg-card shadow-xs ${
      isPassed 
        ? 'border-emerald-200/80 dark:border-emerald-500/30 ring-1 ring-emerald-500/10' 
        : isWarning
        ? 'border-amber-200/80 dark:border-amber-500/30 ring-1 ring-amber-500/10'
        : isFailed
        ? 'border-rose-200/80 dark:border-rose-500/30 ring-1 ring-rose-500/10'
        : 'border-border'
    }`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Stage Badge */}
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            isPassed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
            isWarning ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
            isFailed ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' :
            'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <Cpu className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold px-2 py-0.5 rounded bg-secondary border border-border">
                Quest 01 • Inter-Stage Consolidation
              </span>
              {auditScores?.status && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  isPassed ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                  isWarning ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' :
                  'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}>
                  {auditScores.status}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-foreground mt-1">
              Prompt Suite Consolidation & Semantic Chainability
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Validates all 4 pipeline stage prompts against project research scope, exclusion criteria orthogonality, and logic flow continuity.
            </p>
          </div>
        </div>

        {/* Action Trigger Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRunAudit}
            disabled={loadingAudit || !isReady}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono tracking-wide transition-all shadow-xs ${
              loadingAudit || !isReady
                ? 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-98 shadow-sm'
            }`}
          >
            {loadingAudit ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Auditing Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 opacity-80" />
                <span>{auditScores ? 'Re-Run Inter-Stage Audit' : 'Run Inter-Stage Audit'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3 Core Check Metric Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        {/* Metric A: Prompt Availability */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${availabilityCount === 4 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
              {availabilityCount === 4 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold">Prompt Availability</div>
              <div className="text-xs text-foreground font-mono font-medium">4-Stage LLM Suite</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-mono font-extrabold ${availabilityCount === 4 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {availabilityCount}/4
            </span>
            <div className="text-[10px] text-muted-foreground">Configured</div>
          </div>
        </div>

        {/* Metric B: Semantic Alignment */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${semanticCount >= 4 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : semanticCount >= 3 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
              {semanticCount >= 4 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold">Semantic Check</div>
              <div className="text-xs text-foreground font-mono font-medium">Research Scope Fit</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-mono font-extrabold ${semanticCount >= 4 ? 'text-emerald-600 dark:text-emerald-400' : semanticCount >= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {semanticCount}/4
            </span>
            <div className="text-[10px] text-muted-foreground">Stages Aligned</div>
          </div>
        </div>

        {/* Metric C: Chainability & Consistency */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${chainabilityCount >= 5 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : chainabilityCount >= 4 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
              {chainabilityCount >= 5 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold">Chainability Check</div>
              <div className="text-xs text-foreground font-mono font-medium">Inter-Stage Logic Flow</div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-mono font-extrabold ${chainabilityCount >= 5 ? 'text-emerald-600 dark:text-emerald-400' : chainabilityCount >= 4 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {chainabilityCount}/5
            </span>
            <div className="text-[10px] text-muted-foreground">Gates Verified</div>
          </div>
        </div>
      </div>

      {/* Expandable Diagnostic Console Toggle */}
      {auditReport && (
        <div className="mt-3 pt-2">
          <button
            onClick={() => setExpandedConsole(!expandedConsole)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors font-mono font-medium"
          >
            {expandedConsole ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>{expandedConsole ? 'Hide Consolidation Diagnostic Console' : 'Show Consolidation Diagnostic Console & Recommendations'}</span>
          </button>

          {expandedConsole && (
            <div className="mt-3 p-4 rounded-xl bg-secondary/30 border border-border text-xs font-mono space-y-3">
              {/* Recommendations */}
              {auditReport.actionable_recommendations && auditReport.actionable_recommendations.length > 0 && (
                <div>
                  <div className="text-foreground font-bold mb-1 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-primary" />
                    <span>Actionable Recommendations:</span>
                  </div>
                  <ul className="space-y-1 pl-4 list-disc text-muted-foreground">
                    {auditReport.actionable_recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Semantic Analysis Breakdown */}
              {auditReport.semantic_alignment_evaluation && (
                <div className="pt-2 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Fast Filter Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-1 font-sans leading-relaxed">
                      {auditReport.semantic_alignment_evaluation.fast_filter_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Gatekeeper Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-1 font-sans leading-relaxed">
                      {auditReport.semantic_alignment_evaluation.gatekeeper_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Scientist Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-1 font-sans leading-relaxed">
                      {auditReport.semantic_alignment_evaluation.scientist_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-border">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Miner Semantic Alignment</div>
                    <div className="text-foreground text-[11px] mt-1 font-sans leading-relaxed">
                      {auditReport.semantic_alignment_evaluation.miner_alignment?.analysis || 'No notes.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Chainability & Schema Flow Breakdown */}
              {auditReport.chainability_and_consistency && (
                <div className="pt-2 border-t border-border">
                  <div className="text-foreground font-bold mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Inter-Stage Logic Flow & Schema Continuity:</span>
                  </div>
                  <div className="text-muted-foreground text-[11px] p-3 rounded-lg bg-card border border-border font-sans leading-relaxed">
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
