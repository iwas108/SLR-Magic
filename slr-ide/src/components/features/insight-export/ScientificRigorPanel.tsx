'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PoolMetricsPanel from '../pre-calibration/PoolMetricsPanel';
import StageComparisonPanel from '../pre-calibration/StageComparisonPanel';
import RollingBatchView from '../post-validation/RollingBatchView';
import PrismaFlowDiagram from './PrismaFlowDiagram';

interface ScientificRigorPanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function ScientificRigorPanel({ projectId, showToast }: ScientificRigorPanelProps) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [stageStats, setStageStats] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!projectId) return;
      setLoading(true);
      try {
        // Fetch project for PoolMetrics
        const projRes = await fetch(`/api/projects/${projectId}`);
        if (projRes.ok) {
          const projData = await projRes.json();
          // The API returns { success: true, project: ... } or raw project object.
          // Let's check both structures to be safe.
          const projectObj = projData.project || projData;
          setProject(projectObj);
        }

        // Fetch stage stats
        const stageRes = await fetch('/api/adjudicate/stats?mode=stage_comparison');
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

  if (loading) {
    return <div className="p-4 flex flex-col items-center justify-center text-muted-foreground h-full gap-2">
      <Loader2 className="w-6 h-6 animate-spin" />
      Loading rigor metrics...
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* 0. PRISMA Flowchart */}
      <div>
        <PrismaFlowDiagram projectId={projectId} showToast={showToast} />
      </div>

      {/* 1. Pool Metrics */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">Pre-Calibration Filling Status</h3>
        <PoolMetricsPanel projects={project ? [project] : []} activeProjectId={projectId} />
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
    </div>
  );
}
