import React, { useState } from 'react';
import { Download, Eye, Table, ShieldCheck, Loader2, GitBranch, FileCode } from 'lucide-react';
import Papa from 'papaparse';
import { useViewerData } from '@/context/ViewerContext';
import { exportFinalCohortCsv } from '@/lib/csv-export';
import { compressViewerData } from '@/utils/compression';

export default function FairDataExportPanel() {
  const { activeSession, showToast } = useViewerData();
  const [exportingViewer, setExportingViewer] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingUmbCsv, setExportingUmbCsv] = useState(false);
  const [exportingUmbJson, setExportingUmbJson] = useState(false);

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

  const handleExportUmbMappings = (format: 'csv' | 'json') => {
    if (!activeSession || !activeSession.rawData) {
      showToast('No active session to export', 'error');
      return;
    }
    if (format === 'csv') setExportingUmbCsv(true);
    else setExportingUmbJson(true);

    try {
      const cohortData = activeSession.rawData.final_cohort || {};
      const umbMap = cohortData.umbrellanizer_mappings || {};
      const papers = cohortData.papers || [];
      const projectData = activeSession.rawData.project || {};
      const projectName = projectData.name || activeSession.projectName || 'project';
      const safeProjectName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];

      const rows: any[] = [];
      const jsonOutput: Record<string, any> = {
        project_id: projectData.id || activeSession.id,
        project_name: projectName,
        exported_at: new Date().toISOString(),
        total_mapped_variables: Object.keys(umbMap).length,
        variables: {}
      };

      Object.entries(umbMap).forEach(([varKey, mappings]: [string, any]) => {
        if (!mappings || typeof mappings !== 'object') return;
        
        jsonOutput.variables[varKey] = {
          variable_key: varKey,
          terms: []
        };

        Object.entries(mappings).forEach(([rawTerm, mapInfo]: [string, any]) => {
          const umbrellaCategory = typeof mapInfo === 'string' ? mapInfo : (mapInfo?.umbrella_category || mapInfo?.umbrella || rawTerm);
          const justification = typeof mapInfo === 'object' ? (mapInfo?.justification || mapInfo?.rationale || '') : '';

          let occurrences = 0;
          const citedPaperIds: string[] = [];

          papers.forEach((p: any) => {
            const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
            const extStr = isManualDominant 
              ? (p.manual_extracted_data || p.ai_extracted_data || '') 
              : (p.ai_extracted_data || p.manual_extracted_data || '');
            if (!extStr) return;
            try {
              const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
              const extObj = parsed.extracted_data || parsed;
              const fieldVal = extObj[varKey];
              const tokens: string[] = [];
              if (Array.isArray(fieldVal)) {
                fieldVal.forEach(item => {
                  if (typeof item === 'string' && item.includes(',') && !varKey.startsWith('rq8_a')) {
                    tokens.push(...item.split(',').map(s => s.trim()).filter(Boolean));
                  } else if (item) tokens.push(String(item).trim());
                });
              } else if (typeof fieldVal === 'string') {
                if (fieldVal.includes(',') && !varKey.startsWith('rq8_a')) {
                  tokens.push(...fieldVal.split(',').map(s => s.trim()).filter(Boolean));
                } else if (fieldVal.trim()) tokens.push(fieldVal.trim());
              }
              const matches = tokens.some(t => t.toLowerCase() === rawTerm.toLowerCase());
              if (matches) {
                occurrences++;
                if (p.Paper_ID) citedPaperIds.push(p.Paper_ID);
              }
            } catch (e) {}
          });

          rows.push({
            'Variable_Key': varKey,
            'Raw_Extracted_Term': rawTerm,
            'Standardized_Umbrella_Category': umbrellaCategory,
            'Model_Justification': justification,
            'Cohort_Occurrence_Frequency': occurrences,
            'Cited_Paper_IDs': citedPaperIds.join('; ')
          });

          jsonOutput.variables[varKey].terms.push({
            raw_term: rawTerm,
            umbrella_category: umbrellaCategory,
            justification,
            occurrences,
            cited_paper_ids: citedPaperIds
          });
        });
      });

      if (format === 'csv') {
        const csvString = '\uFEFF' + Papa.unparse(rows);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeProjectName}_umbrellanizer_taxonomy_mappings_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Taxonomy mappings CSV exported successfully', 'success');
      } else {
        const jsonString = JSON.stringify(jsonOutput, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeProjectName}_umbrellanizer_taxonomy_mappings_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('Taxonomy mappings JSON exported successfully', 'success');
      }
    } catch (e: any) {
      showToast('Failed to export taxonomy mappings', 'error');
    } finally {
      if (format === 'csv') setExportingUmbCsv(false);
      else setExportingUmbJson(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
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

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* Card 3: Umbrellanizer Taxonomy Mappings Export */}
        <div className="flex flex-col justify-between p-6 bg-card border border-border rounded-xl hover:border-violet-500/50 transition-all shadow-sm group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-500 group-hover:scale-105 transition-transform">
              <GitBranch className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-foreground">Taxonomy Mappings Export</h4>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded">
                    .csv
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-violet-500/10 text-violet-500 border border-violet-500/20 rounded">
                    .json
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Export complete Umbrellanizer taxonomy mappings linking raw extracted manuscript terms to standardized umbrella categories, along with their justifications, occurrence frequencies, and study citations.
              </p>
            </div>

            <div className="p-3.5 bg-secondary/40 rounded-lg border border-border text-[11px] space-y-1.5">
              <div className="font-bold text-foreground">Included Fields:</div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Raw Extracted Term & Umbrella Category</li>
                <li>Model Justification / Semantic Rationale</li>
                <li>Cohort Frequency & Cited Paper IDs</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              onClick={() => handleExportUmbMappings('csv')}
              disabled={exportingUmbCsv || exportingUmbJson || !activeSession}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
              title="Export Taxonomy Mappings as CSV"
            >
              {exportingUmbCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>CSV File</span>
            </button>

            <button
              onClick={() => handleExportUmbMappings('json')}
              disabled={exportingUmbCsv || exportingUmbJson || !activeSession}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              title="Export Taxonomy Mappings as JSON"
            >
              {exportingUmbJson ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5 text-violet-500" />}
              <span>JSON File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
