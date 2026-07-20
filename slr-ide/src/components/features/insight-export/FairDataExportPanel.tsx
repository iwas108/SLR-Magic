'use client';

import React, { useState } from 'react';
import { Download, Database, ShieldCheck, Loader2 } from 'lucide-react';

interface FairDataExportPanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function FairDataExportPanel({ projectId, showToast }: FairDataExportPanelProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!projectId) return;
    setExporting(true);
    
    // Create an invisible iframe or anchor to trigger the download
    const url = `/api/export/fair-data?projectId=${projectId}`;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `fair_export_${projectId}.slr`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setExporting(false);
      showToast('FAIR data export initiated.', 'success');
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
      <div className="bg-primary/10 p-6 rounded-full">
        <Database className="w-16 h-16 text-primary" />
      </div>
      
      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-black text-foreground">FAIR Data Export</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Export your entire project's dataset in a JSON structure compliant with FAIR principles (Findable, Accessible, Interoperable, and Reusable). 
        </p>
      </div>

      <div className="bg-secondary/30 border border-border p-4 rounded-xl text-left text-xs text-muted-foreground w-full max-w-lg space-y-3">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Included Data Tables
        </div>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Project Metadata</li>
          <li>Screening & Extraction Data (Papers)</li>
          <li>LLM & Manual Audit Logs</li>
          <li>Umbrellanizer Aggregation Results</li>
          <li>Inter-Rater Calibration & Decisions</li>
        </ul>
        <div className="text-[10px] italic mt-2 opacity-80">
          * Note: Sensitive configuration (like API keys) are not included in this export.
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 uppercase tracking-wide text-sm"
      >
        {exporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing Export...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Download FAIR Dataset (.slr)
          </>
        )}
      </button>
    </div>
  );
}
