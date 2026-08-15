'use client';

import React from 'react';
import { 
  Sparkles, Layers, ShieldCheck, Cpu, ArrowDown, CheckCircle2, Lock, Flame
} from 'lucide-react';
import { usePromptStaging } from '@/hooks/usePromptStaging';
import PromptConsolidationCard from './PromptConsolidationCard';
import StageBenchmarkCard from './StageBenchmarkCard';
import PromptOptimizationDiffModal from '../modals/PromptOptimizationDiffModal';

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
    optimizationState,
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
    <div className="flex flex-col space-y-6 pt-4 border-t border-slate-200 dark:border-border">
      {/* Cyberpunk HUD Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-sky-200 dark:border-cyan-500/30 bg-gradient-to-r from-sky-50/90 via-cyan-50/70 to-indigo-50/60 dark:from-slate-900/90 dark:via-slate-950/90 dark:to-cyan-950/20 backdrop-blur-xl shadow-sm dark:shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-100 border border-cyan-300 text-cyan-700 dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-500/20 dark:border-cyan-500/30 dark:text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Flame className="w-6 h-6 animate-pulse text-cyan-600 dark:text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-800 dark:text-cyan-400 font-bold px-2.5 py-0.5 rounded-full bg-cyan-200/70 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-500/30 shadow-sm">
                QUEST-LINE PROGRESSION ENGINE
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
              <span>Interactive Staging & Benchmark Optimization HUD</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Verify prompt chainability, sandbox benchmark against double-blind gold standard pools, and optimize prompts with Human-in-the-Loop full-text inspection.
            </p>
          </div>
        </div>

        {/* 5-Quest Step Indicator Pips */}
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 font-mono text-xs shadow-sm">
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            card1Passed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold' : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800'
          }`}>
            <span className="font-bold">Q1</span>
            {card1Passed && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-slate-400 dark:text-slate-600">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            s1Completed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold' : isStage1Unlocked ? 'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold' : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800'
          }`}>
            <span className="font-bold">S1</span>
            {s1Completed && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-slate-400 dark:text-slate-600">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            s2Completed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold' : isStage2Unlocked ? 'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold' : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800'
          }`}>
            <span className="font-bold">S2</span>
            {s2Completed && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-slate-400 dark:text-slate-600">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            s3Completed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold' : isStage3Unlocked ? 'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold' : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800'
          }`}>
            <span className="font-bold">S3</span>
            {s3Completed && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <span className="text-slate-400 dark:text-slate-600">→</span>
          <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
            s4Completed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-bold' : isStage4Unlocked ? 'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40 font-bold' : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:text-slate-600 dark:border-slate-800'
          }`}>
            <span className="font-bold">S4</span>
            {s4Completed && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
          </div>
        </div>
      </div>

      {/* Quest 1 Card: Inter-Stage Consolidation */}
      <PromptConsolidationCard
        promptAvailability={promptAvailability}
        auditScores={auditScores}
        auditReport={auditReport}
        loadingAudit={loadingAudit}
        onRunAudit={runConsolidationAudit}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center">
        <div className="h-6 w-[2px] bg-gradient-to-b from-cyan-500/40 to-blue-500/40" />
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
        onRunBenchmark={() => runStageBenchmark(1)}
        onOptimizePrompt={() => startPromptOptimization(1, 'Fast Filter (Metadata Screening)')}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center">
        <div className="h-6 w-[2px] bg-gradient-to-b from-blue-500/40 to-indigo-500/40" />
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
        onRunBenchmark={() => runStageBenchmark(2)}
        onOptimizePrompt={() => startPromptOptimization(2, 'Gatekeeper (Domain & Full-Text Screening)')}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center">
        <div className="h-6 w-[2px] bg-gradient-to-b from-indigo-500/40 to-purple-500/40" />
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
        onRunBenchmark={() => runStageBenchmark(3)}
        onOptimizePrompt={() => startPromptOptimization(3, 'Scientist (Quality Appraisal)')}
      />

      {/* Quest Connector Line */}
      <div className="flex items-center justify-center">
        <div className="h-6 w-[2px] bg-gradient-to-b from-purple-500/40 to-pink-500/40" />
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
        onRunBenchmark={() => runStageBenchmark(4)}
        onOptimizePrompt={() => startPromptOptimization(4, 'Miner (Data Extraction)')}
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
