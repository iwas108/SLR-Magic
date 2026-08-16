'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeSyncChannel, broadcastSync } from '@/lib/sync-utils';

export interface PromptAvailability {
  fast_filter: { available: boolean; id?: string; name?: string };
  gatekeeper: { available: boolean; id?: string; name?: string };
  scientist: { available: boolean; id?: string; name?: string };
  miner: { available: boolean; id?: string; name?: string };
  total_available: number;
}

export interface AuditReport {
  availability_evaluation?: any;
  semantic_alignment_evaluation?: any;
  chainability_and_consistency?: any;
  actionable_recommendations?: string[];
  overall_status?: 'PASSED' | 'WARNING' | 'FAILED';
}

export interface BenchmarkSummaryMetrics {
  total: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  accuracy_pct: number;
  precision: number;
  recall: number;
  f1: number;
  kappa: number;
  kappa_label: string;
  prisma_gate_passed: boolean;
  gate_reasons: string[];
  train_metrics?: any;
}

export interface BenchmarkRunState {
  id: string;
  stage_num: number;
  stage_name: string;
  pool: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  total_papers: number;
  evaluated_papers: number;
  pool_papers_count?: number;
  missing_pdf_count?: number;
  missing_pdf_papers?: Array<{ paper_id: string; title: string }>;
  summary_metrics: BenchmarkSummaryMetrics;
  holdout_metrics: any;
  results: any[];
}

export interface RequestedPdfItem {
  paper_id: string;
  paper_title: string;
  technical_rationale: string;
  target_sections: string;
  on_disk: boolean;
  estimated_token_cost: string;
}

export interface OptimizationState {
  isOpen: boolean;
  stageNum: number;
  stageName: string;
  currentPrompt: any;
  hasPdfRequests: boolean;
  requestedPdfs: RequestedPdfItem[];
  approvedPdfIds: string[];
  cachedContext: string | null;
  optimizationResult: any | null;
  isLoading: boolean;
  isSaving: boolean;
}

export interface PayloadConfirmationState {
  isOpen: boolean;
  type: 'consolidation_audit' | 'stage_benchmark' | null;
  stageNum?: number;
  stageName?: string;
  poolName?: string;
  isLoading: boolean;
  previewData: any | null;
  error: string | null;
}

export function usePromptStaging(projectId: string, showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void) {
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditScores, setAuditScores] = useState<any>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [promptAvailability, setPromptAvailability] = useState<PromptAvailability>({
    fast_filter: { available: false },
    gatekeeper: { available: false },
    scientist: { available: false },
    miner: { available: false },
    total_available: 0
  });

  const [benchmarkRuns, setBenchmarkRuns] = useState<Record<number, BenchmarkRunState | null>>({
    1: null,
    2: null,
    3: null,
    4: null
  });
  const [runningBenchmarkStage, setRunningBenchmarkStage] = useState<number | null>(null);

  const [confirmationState, setConfirmationState] = useState<PayloadConfirmationState>({
    isOpen: false,
    type: null,
    isLoading: false,
    previewData: null,
    error: null
  });

  const [optimizationState, setOptimizationState] = useState<OptimizationState>({
    isOpen: false,
    stageNum: 1,
    stageName: 'Stage 1: Fast Filter',
    currentPrompt: null,
    hasPdfRequests: false,
    requestedPdfs: [],
    approvedPdfIds: [],
    cachedContext: null,
    optimizationResult: null,
    isLoading: false,
    isSaving: false
  });

  // Mutable refs to prevent stale closure data losses during background syncs
  const activeProjectIdRef = useRef(projectId);
  activeProjectIdRef.current = projectId;

  const optStateRef = useRef(optimizationState);
  optStateRef.current = optimizationState;

  // 1. Fetch Audit Status and Availability
  const fetchAuditStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/calibration/stage-audit?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.prompt_availability) {
        setPromptAvailability(data.prompt_availability);
      }

      if (data.latest_audit) {
        setAuditScores({
          availability_score: data.latest_audit.availability_score,
          semantic_score: data.latest_audit.semantic_score,
          chainability_score: data.latest_audit.chainability_score,
          status: data.latest_audit.status
        });
        if (data.latest_audit.audit_report) {
          setAuditReport(data.latest_audit.audit_report);
        } else {
          setAuditReport(null);
        }
      } else {
        setAuditScores(null);
        setAuditReport(null);
      }
    } catch (err) {
      console.error('Failed to fetch audit status:', err);
    }
  }, [projectId]);

  // 2. Fetch Stage Benchmark History
  const fetchStageBenchmark = useCallback(async (stageNum: number) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/calibration/benchmark?projectId=${encodeURIComponent(projectId)}&stageNum=${stageNum}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.latest_run) {
        setBenchmarkRuns(prev => ({
          ...prev,
          [stageNum]: {
            ...data.latest_run,
            stage_name: data.stage_name,
            pool: data.pool,
            pool_papers_count: data.pool_papers_count,
            missing_pdf_count: data.missing_pdf_count,
            missing_pdf_papers: data.missing_pdf_papers || [],
            results: data.results || []
          }
        }));
      } else {
        setBenchmarkRuns(prev => ({
          ...prev,
          [stageNum]: {
            id: '',
            stage_num: stageNum,
            stage_name: data.stage_name,
            pool: data.pool,
            status: 'PENDING',
            total_papers: 0,
            evaluated_papers: 0,
            pool_papers_count: data.pool_papers_count ?? 0,
            missing_pdf_count: data.missing_pdf_count ?? 0,
            missing_pdf_papers: data.missing_pdf_papers || [],
            summary_metrics: {
              total: 0,
              tp: 0,
              tn: 0,
              fp: 0,
              fn: 0,
              accuracy_pct: 0,
              precision: 0,
              recall: 0,
              f1: 0,
              kappa: 0,
              kappa_label: 'Pending Run',
              prisma_gate_passed: false,
              gate_reasons: []
            },
            holdout_metrics: null,
            results: []
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch benchmark for stage ${stageNum}:`, err);
    }
  }, [projectId]);

  const refreshAllBenchmarks = useCallback(async () => {
    await Promise.all([
      fetchAuditStatus(),
      fetchStageBenchmark(1),
      fetchStageBenchmark(2),
      fetchStageBenchmark(3),
      fetchStageBenchmark(4)
    ]);
  }, [fetchAuditStatus, fetchStageBenchmark]);

  const refreshAllBenchmarksRef = useRef(refreshAllBenchmarks);
  refreshAllBenchmarksRef.current = refreshAllBenchmarks;

  // Initial Load & Project switch
  useEffect(() => {
    refreshAllBenchmarks();
  }, [refreshAllBenchmarks]);

  // Multi-Tab Sync Subscription (Mutable ref pattern per agents.md §3.3)
  useEffect(() => {
    const unsub = subscribeSyncChannel((syncType) => {
      if (syncType === 'SYNC_PROJECTS' || syncType === 'SYNC_PROMPTS' || syncType === 'SYNC_PAPERS') {
        // Only refresh metadata without resetting active modal editing state
        if (!optStateRef.current.isOpen) {
          refreshAllBenchmarksRef.current?.();
        }
      }
    });
    return () => unsub();
  }, []);

  // 3. Trigger Inter-Stage Consolidation Audit (Card 1)
  const runConsolidationAudit = async () => {
    if (!projectId) {
      showToast?.('No active project selected.', 'error');
      return;
    }
    setLoadingAudit(true);
    try {
      const res = await fetch('/api/calibration/stage-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to run consolidation audit.');
      }

      setAuditScores(data.scores ? { ...data.scores, status: data.status } : null);
      setAuditReport(data.report || null);
      showToast?.(`Inter-stage audit complete: Status ${data.status}`, data.status === 'PASSED' ? 'success' : 'warning');
      broadcastSync('SYNC_PROMPTS');
    } catch (err: any) {
      showToast?.(err.message, 'error');
    } finally {
      setLoadingAudit(false);
    }
  };

  // 4. Trigger Stage Benchmark Sandbox Run (Cards 2–5)
  const runStageBenchmark = async (stageNum: number) => {
    if (!projectId) {
      showToast?.('No active project selected.', 'error');
      return;
    }

    const stageState = benchmarkRuns[stageNum];
    if (stageNum >= 2 && stageState && (stageState.missing_pdf_count || 0) > 0) {
      showToast?.(`Quest 0${stageNum + 1} requires a local PDF file for all papers in ${stageState.pool}. Please acquire missing PDFs first.`, 'error');
      return;
    }

    setRunningBenchmarkStage(stageNum);
    try {
      const res = await fetch('/api/calibration/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, stage_num: stageNum })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to run benchmark for Stage ${stageNum}.`);
      }

      await fetchStageBenchmark(stageNum);
      const gatePassed = data.summary_metrics?.prisma_gate_passed;
      showToast?.(
        `Stage ${stageNum} benchmark complete (${data.total_evaluated} papers). ${gatePassed ? 'PRISMA Hard Gate PASSED!' : 'Warning: Targets not met.'}`,
        gatePassed ? 'success' : 'warning'
      );
      broadcastSync('SYNC_PAPERS');
    } catch (err: any) {
      showToast?.(err.message, 'error');
    } finally {
      setRunningBenchmarkStage(null);
    }
  };

  // 5. Trigger Prompt Optimization Magic (Turn 1: Diagnose)
  const startPromptOptimization = async (stageNum: number, stageName: string) => {
    if (!projectId) return;
    setOptimizationState(prev => ({
      ...prev,
      isOpen: true,
      stageNum,
      stageName,
      isLoading: true,
      optimizationResult: null,
      hasPdfRequests: false,
      requestedPdfs: [],
      approvedPdfIds: []
    }));

    try {
      const res = await fetch('/api/calibration/prompt-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          stage_num: stageNum,
          action: 'diagnose'
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to diagnose discrepancies.');
      }

      if (data.already_optimal) {
        showToast?.(data.message, 'info');
        setOptimizationState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        return;
      }

      setOptimizationState(prev => ({
        ...prev,
        isLoading: false,
        currentPrompt: data.current_prompt,
        hasPdfRequests: !!data.has_pdf_requests,
        requestedPdfs: data.requested_pdfs || [],
        cachedContext: data.cached_context || null,
        optimizationResult: data.optimization_result || null
      }));
    } catch (err: any) {
      showToast?.(err.message, 'error');
      setOptimizationState(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  // 6. Continue Prompt Optimization with Approved PDFs (Turn 2: Chained)
  const continueOptimizationWithPdf = async (approvedIds: string[]) => {
    if (!projectId) return;
    setOptimizationState(prev => ({ ...prev, isLoading: true, approvedPdfIds: approvedIds }));

    try {
      const res = await fetch('/api/calibration/prompt-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          stage_num: optimizationState.stageNum,
          action: 'continue_with_pdf',
          approved_paper_ids: approvedIds,
          cached_context: optimizationState.cachedContext
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to continue optimization with PDFs.');
      }

      setOptimizationState(prev => ({
        ...prev,
        isLoading: false,
        hasPdfRequests: false,
        optimizationResult: data.optimization_result || prev.optimizationResult
      }));
      showToast?.('Full-text analysis attached! Prompt optimization refined.', 'success');
    } catch (err: any) {
      showToast?.(err.message, 'error');
      setOptimizationState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // 7. Apply Optimized Revisions or Fork Prompt
  const applyOptimizedPrompt = async (
    proposedSystemInstruction: string,
    proposedUserTemplate: string,
    actionMode: 'apply_active' | 'fork_new',
    setAsDefault = true,
    customName?: string
  ) => {
    if (!projectId) return;
    setOptimizationState(prev => ({ ...prev, isSaving: true }));

    try {
      const res = await fetch('/api/calibration/prompt-optimize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          stage_num: optimizationState.stageNum,
          proposed_system_instruction: proposedSystemInstruction,
          proposed_user_template: proposedUserTemplate,
          action_mode: actionMode,
          set_as_default: setAsDefault,
          custom_name: customName
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply prompt update.');
      }

      showToast?.(data.message || 'Optimized prompt saved successfully!', 'success');
      setOptimizationState(prev => ({ ...prev, isOpen: false, isSaving: false }));
      broadcastSync('SYNC_PROMPTS');
      broadcastSync('SYNC_PROJECTS');
      await refreshAllBenchmarks();
    } catch (err: any) {
      showToast?.(err.message, 'error');
      setOptimizationState(prev => ({ ...prev, isSaving: false }));
    }
  };

  const closeOptimizationModal = () => {
    setOptimizationState(prev => ({ ...prev, isOpen: false }));
  };

  // 8. Trigger Dry-Run Confirmation Modals (Transparent Human-in-the-Loop)
  const openAuditConfirmation = async () => {
    if (!projectId) {
      showToast?.('No active project selected.', 'error');
      return;
    }
    setConfirmationState({
      isOpen: true,
      type: 'consolidation_audit',
      isLoading: true,
      previewData: null,
      error: null
    });

    try {
      const res = await fetch('/api/calibration/payload-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, preview_type: 'consolidation_audit' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to prepare audit payload preview.');
      }
      setConfirmationState(prev => ({
        ...prev,
        isLoading: false,
        previewData: data
      }));
    } catch (err: any) {
      setConfirmationState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message
      }));
    }
  };

  const openBenchmarkConfirmation = async (stageNum: number, stageName?: string, poolName?: string) => {
    if (!projectId) {
      showToast?.('No active project selected.', 'error');
      return;
    }

    const stageState = benchmarkRuns[stageNum];
    if (stageNum >= 2 && stageState && (stageState.missing_pdf_count || 0) > 0) {
      showToast?.(`Quest 0${stageNum + 1} (${stageName || stageState.stage_name}) requires a local PDF file for all papers in ${poolName || stageState.pool}. Found ${stageState.missing_pdf_count} paper(s) with missing PDFs.`, 'error');
      return;
    }

    setConfirmationState({
      isOpen: true,
      type: 'stage_benchmark',
      stageNum,
      stageName,
      poolName,
      isLoading: true,
      previewData: null,
      error: null
    });

    try {
      const res = await fetch('/api/calibration/payload-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, preview_type: 'stage_benchmark', stage_num: stageNum })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to prepare Stage ${stageNum} benchmark payload preview.`);
      }
      setConfirmationState(prev => ({
        ...prev,
        isLoading: false,
        previewData: data
      }));
    } catch (err: any) {
      setConfirmationState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message
      }));
    }
  };

  const confirmPayloadExecution = () => {
    const currentType = confirmationState.type;
    const currentStage = confirmationState.stageNum;
    setConfirmationState(prev => ({ ...prev, isOpen: false }));

    if (currentType === 'consolidation_audit') {
      runConsolidationAudit();
    } else if (currentType === 'stage_benchmark' && currentStage !== undefined) {
      runStageBenchmark(currentStage);
    }
  };

  const closePayloadConfirmation = () => {
    setConfirmationState(prev => ({ ...prev, isOpen: false }));
  };

  return {
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
    closeOptimizationModal,
    refreshAllBenchmarks
  };
}
