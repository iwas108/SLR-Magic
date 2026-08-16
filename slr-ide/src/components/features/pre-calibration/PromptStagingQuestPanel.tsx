'use client';

import React from 'react';
import { 
  Sparkles, Layers, ShieldCheck, Cpu, ArrowDown, CheckCircle2, Lock, Flame
} from 'lucide-react';
import { usePromptStaging } from '@/hooks/usePromptStaging';
import PromptConsolidationCard from './PromptConsolidationCard';
import StageBenchmarkCard from './StageBenchmarkCard';
import PromptOptimizationDiffModal from '../modals/PromptOptimizationDiffModal';
import LlmPayloadConfirmationModal from '../modals/LlmPayloadConfirmationModal';

interface PromptStagingQuestPanelProps {
  projectId: string;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function PromptStagingQuestPanel({
  projectId,
  showToast
}: PromptStagingQuestPanelProps) {
  const {
    loadingAudit,
    auditScores,
    auditReport,
    promptAvailability,
    benchmarkRuns,
    runningBenchmarkStage,
    confirmationState,
    optimizationState,
    openAuditConfirmation,
    openBenchmarkConfirmation,
    confirmPayloadExecution,
    closePayloadConfirmation,
    runConsolidationAudit,
    runStageBenchmark,
    startPromptOptimization,
    continueOptimizationWithPdf,
    applyOptimizedPrompt,
    closeOptimizationModal
  } = usePromptStaging(projectId, showToast);

  // Determine stage unlocking progression
  const card1Passed = auditScores?.status === 'PASSED' || (promptAvailability.total_available === 4 && auditScores?.availability_score === 100);
  const s1Completed = benchmarkRuns[1]?.status === 'COMPLETED';
  const s2Completed = benchmarkRuns[2]?.status === 'COMPLETED';
  const s3Completed = benchmarkRuns[3]?.status === 'COMPLETED';
  const s4Completed = benchmarkRuns[4]?.status === 'COMPLETED';

  const isStage1Unlocked = card1Passed;
  const isStage2Unlocked = isStage1Unlocked && s1Completed;
  const isStage3Unlocked = isStage2Unlocked && s2Completed;
  const isStage4Unlocked = isStage3Unlocked && s3Completed;

  return (
    <div className="flex flex-col space-y-5 pt-4 border-t border-border">
      {/* Workflow HUD Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-gradient-to-r from-slate-50 via-sky-50/40 to-indigo-50/30 dark:from-slate-900/80 dark:via-slate-900/40 dark:to-cyan-950/20 backdrop-blur-sm shadow-xs transition-all">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                Quest Progression Engine
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Methodology Pre-Calibration
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground mt-1">
              Interactive Staging & Benchmark Optimization HUD
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
              Verify prompt chainability, sandbox benchmark against double-blind gold standard pools, and optimize prompts with Human-in-the-Loop full-text inspection.
            </p>
          </div>
        </div>

        {/* 5-Quest Step Indicator Pips */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-card border border-border font-mono text-xs shadow-xs self-start lg:self-center shrink-0">
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs ${
            card1Passed 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold' 
              : 'bg-muted/60 text-muted-foreground border border-border'
          }`}>
            <span>Q1</span>
            {card1Passed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-muted-foreground/60 text-xs">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs ${
            s1Completed 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold' 
              : isStage1Unlocked 
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold' 
              : 'bg-muted/60 text-muted-foreground/60 border border-border/60'
          }`}>
            <span>S1</span>
            {s1Completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-muted-foreground/60 text-xs">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs ${
            s2Completed 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold' 
              : isStage2Unlocked 
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold' 
              : 'bg-muted/60 text-muted-foreground/60 border border-border/60'
          }`}>
            <span>S2</span>
            {s2Completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-muted-foreground/60 text-xs">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs ${
            s3Completed 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold' 
              : isStage3Unlocked 
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold' 
              : 'bg-muted/60 text-muted-foreground/60 border border-border/60'
          }`}>
            <span>S3</span>
            {s3Completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-muted-foreground/60 text-xs">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all text-xs ${
            s4Completed 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold' 
              : isStage4Unlocked 
              ? 'bg-primary/10 text-primary border border-primary/30 font-bold' 
              : 'bg-muted/60 text-muted-foreground/60 border border-border/60'
          }`}>
            <span>S4</span>
            {s4Completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          </div>
        </div>
      </div>

      {/* Quest 1 Card: Inter-Stage Consolidation */}
      <PromptConsolidationCard
        promptAvailability={promptAvailability}
        auditScores={auditScores}
        auditReport={auditReport}
        loadingAudit={loadingAudit}
        onRunAudit={openAuditConfirmation}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center -my-2">
        <div className="h-4 w-px bg-border" />
      </div>

      {/* Quest 2 Card: Stage 1 Fast Filter (Pool A) */}
      <StageBenchmarkCard
        stageNum={1}
        stageName="Fast Filter (Metadata Screening)"
        poolName="Pool A (High-Recall Fast Filter)"
        isUnlocked={isStage1Unlocked}
        lockReason="Complete Quest 1 (Inter-Stage Consolidation Audit) to unlock Stage 1 Fast Filter Benchmark."
        benchmarkState={benchmarkRuns[1]}
        isRunning={runningBenchmarkStage === 1}
        onRunBenchmark={() => openBenchmarkConfirmation(1, 'Fast Filter (Metadata Screening)', 'Pool A')}
        onOptimizePrompt={() => startPromptOptimization(1, 'Fast Filter (Metadata Screening)')}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center -my-2">
        <div className="h-4 w-px bg-border" />
      </div>

      {/* Quest 3 Card: Stage 2 Gatekeeper (Pool B) */}
      <StageBenchmarkCard
        stageNum={2}
        stageName="Gatekeeper (Domain & Full-Text Screening)"
        poolName="Pool B (High-Precision Domain Filter)"
        isUnlocked={isStage2Unlocked}
        lockReason="Run Stage 1 Benchmark to unlock Stage 2 Gatekeeper Benchmark."
        benchmarkState={benchmarkRuns[2]}
        isRunning={runningBenchmarkStage === 2}
        onRunBenchmark={() => openBenchmarkConfirmation(2, 'Gatekeeper (Domain & Full-Text Screening)', 'Pool B')}
        onOptimizePrompt={() => startPromptOptimization(2, 'Gatekeeper (Domain & Full-Text Screening)')}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center -my-2">
        <div className="h-4 w-px bg-border" />
      </div>

      {/* Quest 4 Card: Stage 3 Scientist (Pool C) */}
      <StageBenchmarkCard
        stageNum={3}
        stageName="Scientist (Quality Appraisal)"
        poolName="Pool C (Methodological Quality Appraisal)"
        isUnlocked={isStage3Unlocked}
        lockReason="Run Stage 2 Benchmark to unlock Stage 3 Scientist Benchmark."
        benchmarkState={benchmarkRuns[3]}
        isRunning={runningBenchmarkStage === 3}
        onRunBenchmark={() => openBenchmarkConfirmation(3, 'Scientist (Quality Appraisal)', 'Pool C')}
        onOptimizePrompt={() => startPromptOptimization(3, 'Scientist (Quality Appraisal)')}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center -my-2">
        <div className="h-4 w-px bg-border" />
      </div>

      {/* Quest 5 Card: Stage 4 Miner (Pool C) */}
      <StageBenchmarkCard
        stageNum={4}
        stageName="Miner (Data Extraction)"
        poolName="Pool C (Granular Schema Extraction)"
        isUnlocked={isStage4Unlocked}
        lockReason="Run Stage 3 Benchmark to unlock Stage 4 Miner Benchmark."
        benchmarkState={benchmarkRuns[4]}
        isRunning={runningBenchmarkStage === 4}
        onRunBenchmark={() => openBenchmarkConfirmation(4, 'Miner (Data Extraction)', 'Pool C')}
        onOptimizePrompt={() => startPromptOptimization(4, 'Miner (Data Extraction)')}
      />

      {/* Transparent LLM Payload Confirmation Modal */}
      <LlmPayloadConfirmationModal
        isOpen={confirmationState.isOpen}
        isLoading={confirmationState.isLoading}
        error={confirmationState.error}
        previewData={confirmationState.previewData}
        onClose={closePayloadConfirmation}
        onConfirm={confirmPayloadExecution}
      />

      {/* Diagnostic & Diff Modal */}
      <PromptOptimizationDiffModal
        optimizationState={optimizationState}
        onClose={closeOptimizationModal}
        onContinueWithPdf={continueOptimizationWithPdf}
        onApplyPrompt={applyOptimizedPrompt}
      />
    </div>
  );
}
