import React from 'react';
import { useViewerData } from '@/context/ViewerContext';
import PrismaFlowDiagram from './PrismaFlowDiagram';
import PoolMetricsPanel from './PoolMetricsPanel';
import BlindedAdjudicationPanel from './BlindedAdjudicationPanel';
import StageComparisonPanel from './StageComparisonPanel';
import RollingBatchPanel from './RollingBatchPanel';
import { AlertCircle } from 'lucide-react';

export default function ScientificRigorPanel() {
  const { activeSession, loading } = useViewerData();

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

  const { rawData } = activeSession;
  const rigorData = rawData.scientific_rigor || {};
  const prismaData = rigorData.prisma || null;
  const stageStats = rigorData.stage_comparisons || [];
  const poolMetrics = rigorData.pool_metrics || null;
  const blindedAdjudicationStats = rigorData.blinded_adjudication_stats || rigorData.blinded_review_adjudication || null;
  const rollingBatchQC = rigorData.rolling_batch_qc || null;
  const projectConfig = rawData.project || null;

  return (
    <div className="space-y-6">
      {/* 0. PRISMA Flowchart */}
      <div>
        <PrismaFlowDiagram 
          prismaData={prismaData} 
          projectName={projectConfig?.name}
          showToast={() => {}}
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
        <BlindedAdjudicationPanel stats={blindedAdjudicationStats} loading={false} />
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
          <RollingBatchPanel rollingBatchQC={rollingBatchQC} />
        </div>
      </div>
    </div>
  );
}
