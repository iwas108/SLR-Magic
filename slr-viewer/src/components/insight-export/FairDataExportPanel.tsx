import React, { useState } from 'react';
import { Download, Eye, Table, ShieldCheck, Loader2 } from 'lucide-react';
import { useViewerData } from '@/context/ViewerContext';
import { exportFinalCohortCsv } from '@/lib/csv-export';
import { compressViewerData } from '@/utils/compression';

export default function FairDataExportPanel() {
  const { activeSession, showToast } = useViewerData();
  const [exportingViewer, setExportingViewer] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportViewer = async () => {
    if (!activeSession || !activeSession.rawData) {
      showToast('No active session to export', 'error');
      return;
    }
    setExportingViewer(true);
    try {
      const blob = await compressViewerData(activeSession.rawData);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (activeSession.projectName || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `${safeName}_slr_export_${dateStr}.slr-viewer`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('SLR Viewer snapshot exported successfully', 'success');
    } catch (e: any) {
      showToast('Failed to export .slr-viewer file', 'error');
    } finally {
      setExportingViewer(false);
    }
  };

  const handleExportCsv = () => {
    if (!activeSession || !activeSession.rawData) {
      showToast('No active session to export', 'error');
      return;
    }
    setExportingCsv(true);
    try {
      const cohortData = activeSession.rawData.final_cohort || {};
      const projectData = activeSession.rawData.project || {};
      const papers = cohortData.papers || [];

      exportFinalCohortCsv({ final_cohort: cohortData, project: projectData }, papers);
      showToast('CSV Tabular export generated successfully', 'success');
    } catch (e: any) {
      showToast('Failed to export CSV file', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4">
      {/* Header Banner */}
      <div className="flex items-center justify-between p-5 bg-card border border-border rounded-xl shadow-sm">
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
      </div>

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
            disabled={exportingViewer || !activeSession}
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
            disabled={exportingCsv || !activeSession}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm uppercase tracking-wide cursor-pointer"
          >
            {exportingCsv ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting CSV...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export Tabular CSV File
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
