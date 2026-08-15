'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Eye, Table, ShieldCheck, Loader2, FolderKanban, CheckCircle2, FileText, Database } from 'lucide-react';
import { Project } from '@/types';

interface FairDataExportPanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const FairDataExportPanel: React.FC<FairDataExportPanelProps> = ({
  projectId,
  showToast,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [exportingViewer, setExportingViewer] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Load projects list
  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const list: Project[] = data.projects || [];
        setProjects(list);
        if (!selectedProjectId && list.length > 0) {
          const active = data.activeProjectId || list[0].id;
          setSelectedProjectId(String(active));
        }
      }
    } catch (e) {
      console.error('Failed to load projects list in FairDataExportPanel:', e);
    } finally {
      setLoadingProjects(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId]);

  const currentProject = projects.find(p => String(p.id) === String(selectedProjectId)) || projects[0];

  const handleExportViewer = async () => {
    const targetId = selectedProjectId || projectId;
    if (!targetId) {
      showToast('Please select a project to export', 'warning');
      return;
    }
    setExportingViewer(true);
    try {
      const response = await fetch(`/api/export/slr-viewer?projectId=${encodeURIComponent(targetId)}`);
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate SLR Viewer export');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `slr_export_${targetId}.slr-viewer`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`Exported "${currentProject?.name || targetId}" snapshot (.slr-viewer) successfully!`, 'success');
    } catch (err: any) {
      console.error('Export SLR Viewer Error:', err);
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setExportingViewer(false);
    }
  };

  const handleExportCsv = async () => {
    const targetId = selectedProjectId || projectId;
    if (!targetId) {
      showToast('Please select a project to export', 'warning');
      return;
    }
    setExportingCsv(true);
    try {
      const response = await fetch(`/api/export/csv-tabular?projectId=${encodeURIComponent(targetId)}`);
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate CSV export');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `cohort_export_${targetId}.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`Exported "${currentProject?.name || targetId}" cohort tabular CSV successfully!`, 'success');
    } catch (err: any) {
      console.error('Export CSV Error:', err);
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      {/* Header Banner matching app theme */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-card border border-border rounded-xl shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">FAIR Data Export Hub</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export Findable, Accessible, Interoperable, and Reusable datasets in open formats.
            </p>
          </div>
        </div>

        {/* Explicit Project Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Target Project:</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={loadingProjects || projects.length === 0}
            className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-bold focus:outline-none focus:border-primary cursor-pointer max-w-xs truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Target Project Verification Card */}
      {currentProject && (
        <div className="p-4 bg-secondary/30 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary text-primary font-bold">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">{currentProject.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border">
                  ID: {currentProject.id}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                {currentProject.description || currentProject.manifesto || 'No description provided'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 font-medium">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pool A: {currentProject.pool_a_size || 50}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pool B: {currentProject.pool_b_size || 30}</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Side-by-Side Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: SLR Viewer Export */}
        <div className="flex flex-col justify-between p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-all shadow-sm group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
              <Eye className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-foreground">SLR Viewer Export</h4>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded">
                  .slr-viewer
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Export an interactive snapshot containing pre-computed PRISMA flow data, stage comparison metrics, final cohort paper records, taxonomy mappings, and complete token spend accounting.
              </p>
            </div>

            <div className="p-3.5 bg-secondary/40 rounded-lg border border-border text-[11px] space-y-1.5">
              <div className="font-bold text-foreground">Included Modules:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Scientific Rigor (PRISMA, Calibration, Sequential QC)</li>
                <li>Final Cohort (Papers, Umbrellanizer taxonomy)</li>
                <li>Accounting (Stage spend breakdown, top calls)</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleExportViewer}
            disabled={exportingViewer || !selectedProjectId}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm uppercase tracking-wide cursor-pointer"
          >
            {exportingViewer ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Snapshot...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export .slr-viewer File
              </>
            )}
          </button>
        </div>

        {/* Card 2: CSV Tabular Export */}
        <div className="flex flex-col justify-between p-6 bg-card border border-border rounded-xl hover:border-emerald-500/50 transition-all shadow-sm group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
              <Table className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-foreground">CSV Tabular Export</h4>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded">
                  .csv
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Export the complete "Final Cohort Table View" into a FAIR-compliant tabular CSV format. Includes all bibliographic metadata, quality criteria scores with evidence quotes, and extracted research questions with taxonomy mappings.
              </p>
            </div>

            <div className="p-3.5 bg-secondary/40 rounded-lg border border-border text-[11px] space-y-1.5">
              <div className="font-bold text-foreground">Included Columns:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Bibliographic Metadata & DOIs</li>
                <li>QA Scores (QA-1 to QA-8) + Justification Quotes</li>
                <li>Extracted Variables (RQ-1 to RQ-9) + Umbrella Categories</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={exportingCsv || !selectedProjectId}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm uppercase tracking-wide cursor-pointer"
          >
            {exportingCsv ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating CSV...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export .csv File
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FairDataExportPanel;
