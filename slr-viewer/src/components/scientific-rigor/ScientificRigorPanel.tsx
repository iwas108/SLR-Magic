import React, { useState, useMemo } from 'react';
import { useViewerData } from '@/context/ViewerContext';
import PrismaFlowDiagram from './PrismaFlowDiagram';
import PoolMetricsPanel from './PoolMetricsPanel';
import BlindedAdjudicationPanel from './BlindedAdjudicationPanel';
import StageComparisonPanel from './StageComparisonPanel';
import RollingBatchPanel from './RollingBatchPanel';
import ScientificRigorLlmModal from './ScientificRigorLlmModal';
import { AlertCircle, ShieldCheck, Download, Sparkles, Loader2 } from 'lucide-react';

export default function ScientificRigorPanel() {
  const { activeSession, loading, showToast } = useViewerData();
  const [isLlmModalOpen, setIsLlmModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { rawData } = activeSession || {};
  const rigorData = rawData?.scientific_rigor || {};
  const prismaData = rigorData.prisma || null;
  const stageStats = rigorData.stage_comparisons || [];
  const poolMetrics = rigorData.pool_metrics || null;
  const blindedAdjudicationStats = rigorData.blinded_adjudication_stats || rigorData.blinded_review_adjudication || null;
  const rollingBatchQC = rigorData.rolling_batch_qc || null;
  const projectConfig = rawData?.project || null;

  const fullRigorPayload = useMemo(() => {
    if (!activeSession?.rawData) return null;
    return {
      export_metadata: {
        title: 'Scientific Rigor, AI Technical Specifications & Methodological Quality Assurance Dataset',
        project_id: projectConfig?.id || activeSession.id,
        project_name: projectConfig?.name || activeSession.projectName || 'SLR Project',
        exported_at: new Date().toISOString(),
        schema_version: rawData.schema_version || '1.2.0',
        description: 'Authoritative, empirical context and complete AI screening technical specifications for journal reviewer disclosure and LLM narrative drafting.'
      },
      llm_narrative_guidelines: rigorData.llm_narrative_guidelines || {
        authoritative_directives: [
          "1. PRISMA 2020 Flow Narrative: Accurately cite database identification counts, heuristic deduplication, Stage 1 abstract screening exclusions broken down by exclusion criteria codes, PDF full-text retrieval success/inaccessibility rates, Stage 2 structural eligibility exclusions, and Stage 3 quality gate exclusions (Fatal Flaw and Cumulative score cutoffs). Ensure every number tracks perfectly with zero arithmetic gaps.",
          "2. Decoupled Human Pre-Calibration: Detail the double-blind adjudication protocol across Pool A (n=50), Pool B (n=30), and Pool C (n=20). Highlight inter-rater reliability metrics (Cohen's Kappa, Weighted Cohen's Kappa, Precision, and Schema Exactness) achieving consensus prior to automated corpus inference.",
          "3. Prompt Engineering & Inter-Stage Consolidation: Describe the closed-loop Difference-Engine optimization, consolidation audit validation (availability, semantic alignment, and chainability between extraction and downstream taxonomy engines), and 70% train / 30% holdout benchmark sandbox evaluations.",
          "4. Empirical Gold Standard Benchmarking: Compare AI decisions directly against adjudicated human consensus across all 4 stages, emphasizing 100% recall retention in Stage 1, high precision in Stage 2, ordinal QA rubric proximity in Stage 3 (where 0.5-point score delta is accepted as consensus, requiring 0.0% critical miss rate), and 100% schema integrity in Stage 4.",
          "5. Post-Execution Sequential Quality Control: Explain the Wald/Fleiss-Cohen sequential estimation audit over micro-batches (n=20/batch) proving statistical stability of the autonomous pipeline via 95% Confidence Interval lower bounds stably exceeding methodological thresholds.",
          "6. AI Screening Technical Specifications: Include the detailed LLM prompt specifications, response schemas, and hyperparameter tables provided in the exported dataset as a formal Appendix or Methodology subsection.",
          "7. Literature Search & Systematic Search Strategy Disclosure: Explicitly disclose the exact database search strings, Boolean logic, search dates, and bibliographic limiters (e.g. publication years, language restrictions, subject filters) for all consulted repositories (Scopus, Web of Science, PubMed, etc.) as detailed in the systematic_search_strategies object, adhering strictly to PRISMA 2020 Items 6 and 7."
        ]
      },
      ai_screening_technical_specifications: rigorData.ai_screening_technical_specifications || {
        engines: {
          prompt_templates: rawData.prompt_templates || projectConfig?.prompt_templates || []
        }
      },
      systematic_search_strategies: rigorData.systematic_search_strategies || prismaData?.systematic_search_strategies || {
        total_databases_documented: (projectConfig?.search_queries || []).length,
        databases: Array.from(new Set((projectConfig?.search_queries || []).map((q: any) => q.source || 'Scopus'))),
        search_queries: projectConfig?.search_queries || [],
        legacy_strings: {
          scopus_search_string: projectConfig?.scopus_search_string || '',
          manual_search_string: projectConfig?.manual_search_string || ''
        }
      },
      prisma_flow_data: rigorData.prisma_flow_data || prismaData,
      pre_calibration_data: rigorData.pre_calibration_data || poolMetrics,
      prompt_optimization_data: rigorData.prompt_optimization_data || null,
      gold_standard_stage_comparison: rigorData.gold_standard_stage_comparison || stageStats,
      rolling_batch_validation: rigorData.rolling_batch_validation || rollingBatchQC
    };
  }, [activeSession, rawData, projectConfig, rigorData, prismaData, poolMetrics, stageStats, rollingBatchQC]);

  const handleDirectDownload = () => {
    if (!fullRigorPayload) return;
    setIsDownloading(true);
    try {
      const jsonString = JSON.stringify(fullRigorPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeProjName = (projectConfig?.name || activeSession?.projectName || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `scientific_rigor_context_${safeProjName}_${dateStr}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Scientific Rigor JSON downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error downloading scientific rigor JSON', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Loading rigor metrics...</span>
      </div>
    );
  }

  if (!activeSession || !activeSession.rawData) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-muted-foreground gap-3 text-center border border-dashed border-border rounded-xl">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-semibold">No active workspace session loaded.</p>
        <p className="text-xs text-muted-foreground">Please import or select a `.slr-viewer` snapshot file from the top header.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Action Banner: Scientific Rigor & LLM Context Extractor */}
      <div className="bg-gradient-to-r from-card via-card to-secondary/30 border border-border p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0 mt-0.5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-foreground">
                Scientific Rigor &amp; Methodological Assurance
              </h2>
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                PRISMA 2020 Validated
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Consolidated empirical metrics across PRISMA study flow, human pre-calibration pools, prompt optimization audit trails, gold standard benchmark comparisons, and sequential rolling batch QC.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={handleDirectDownload}
            disabled={isDownloading}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Instant 1-Click JSON Download"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Download className="w-4 h-4 text-primary" />}
            <span>Download Rigor JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLlmModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Open LLM Context Builder & Narrative Payload Preview"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Extract LLM Context</span>
          </button>
        </div>
      </div>

      {/* 0. PRISMA Flowchart */}
      <div>
        <PrismaFlowDiagram 
          prismaData={prismaData} 
          projectName={projectConfig?.name}
          showToast={showToast}
        />
      </div>

      {/* 1. Pool Metrics */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Pre-Calibration Filling Status</h3>
        <PoolMetricsPanel 
          projects={projectConfig ? [projectConfig] : []}
          activeProjectId={projectConfig?.id}
        />
      </div>

      {/* 1.5 Blinded Review & Adjudication Results */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Blinded Review &amp; Adjudication Results</h3>
        <BlindedAdjudicationPanel stats={blindedAdjudicationStats} loading={false} projectConfig={projectConfig} />
      </div>

      {/* 2. Stage Comparison */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Gold Standard vs AI Stage Comparisons</h3>
        <StageComparisonPanel stageStats={stageStats} loading={false} />
      </div>

      {/* 3. Rolling Batch Validation (Sequential QC) */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Rolling Batch Validation (Sequential QC)</h3>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <RollingBatchPanel rollingBatchQC={rollingBatchQC} projectConfig={projectConfig} />
        </div>
      </div>

      {/* Scientific Rigor & LLM Context Extractor Modal */}
      <ScientificRigorLlmModal
        isOpen={isLlmModalOpen}
        onClose={() => setIsLlmModalOpen(false)}
        projectId={String(projectConfig?.id || activeSession?.id || '')}
        projectName={projectConfig?.name || activeSession?.projectName}
        initialData={fullRigorPayload}
        showToast={showToast}
      />
    </div>
  );
}
