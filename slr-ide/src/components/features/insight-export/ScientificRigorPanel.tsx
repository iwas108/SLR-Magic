'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, Download, FileJson, ShieldCheck } from 'lucide-react';
import PoolMetricsPanel from '../pre-calibration/PoolMetricsPanel';
import BlindedAdjudicationPanel from '../pre-calibration/BlindedAdjudicationPanel';
import StageComparisonPanel from '../pre-calibration/StageComparisonPanel';
import RollingBatchView from '../post-validation/RollingBatchView';
import PrismaFlowDiagram from './PrismaFlowDiagram';
import ScientificRigorLlmModal from '../modals/ScientificRigorLlmModal';

interface ScientificRigorPanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function ScientificRigorPanel({ projectId, showToast }: ScientificRigorPanelProps) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [stageStats, setStageStats] = useState<any[]>([]);
  const [blindedStats, setBlindedStats] = useState<any>(null);
  const [isLlmModalOpen, setIsLlmModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!projectId) return;
      setLoading(true);
      try {
        // Fetch project for PoolMetrics
        const projRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
        if (projRes.ok) {
          const projData = await projRes.json();
          const projectObj = projData.project || projData;
          setProject(projectObj);
        }

        // Fetch blinded review & adjudication stats for all pools
        const blindedRes = await fetch(`/api/adjudicate/stats?mode=all_pools&projectId=${encodeURIComponent(projectId)}`);
        if (blindedRes.ok) {
          const blindedData = await blindedRes.json();
          setBlindedStats(blindedData);
        }

        // Fetch stage stats
        const stageRes = await fetch(`/api/adjudicate/stats?mode=stage_comparison&projectId=${encodeURIComponent(projectId)}`);
        if (stageRes.ok) {
          const stageData = await stageRes.json();
          setStageStats(stageData.poolStats || []);
        }
      } catch (err) {
        showToast('Error loading scientific rigor data', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId, showToast]);

  const handleDirectDownload = async () => {
    if (!projectId) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/insight/scientific-rigor?projectId=${encodeURIComponent(projectId)}&download=true`);
      if (!res.ok) throw new Error('Failed to download scientific rigor dataset');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeProjName = (project?.name || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
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
      <div className="p-4 flex flex-col items-center justify-center text-muted-foreground h-full gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        Loading rigor metrics...
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
        <PrismaFlowDiagram projectId={projectId} showToast={showToast} />
      </div>

      {/* 1. Pool Metrics */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Pre-Calibration Filling Status</h3>
        <PoolMetricsPanel projects={project ? [project] : []} activeProjectId={projectId} />
      </div>

      {/* 1.5 Blinded Review & Adjudication Results */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Blinded Review &amp; Adjudication Results</h3>
        <BlindedAdjudicationPanel stats={blindedStats} loading={loading} />
      </div>

      {/* 2. Stage Comparison */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Gold Standard vs AI Stage Comparisons</h3>
        <StageComparisonPanel stageStats={stageStats} loading={loading} />
      </div>

      {/* 3. Rolling Batch Validation (Sequential QC) */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Rolling Batch Validation (Sequential QC)</h3>
        <div className="bg-card border border-border rounded-xl p-1">
          <RollingBatchView projectId={projectId} showToast={showToast} reportingOnly={true} />
        </div>
      </div>

      {/* Scientific Rigor & LLM Context Extractor Modal */}
      <ScientificRigorLlmModal
        isOpen={isLlmModalOpen}
        onClose={() => setIsLlmModalOpen(false)}
        projectId={projectId}
        projectName={project?.name}
        showToast={showToast}
      />
    </div>
  );
}

