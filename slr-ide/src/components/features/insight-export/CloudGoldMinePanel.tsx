'use client';

import React, { useEffect, useState } from 'react';
import { Cloud, Loader2, FolderTree, UploadCloud } from 'lucide-react';

interface CloudGoldMinePanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function CloudGoldMinePanel({ projectId, showToast }: CloudGoldMinePanelProps) {
  const [keys, setKeys] = useState<string[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchKeys() {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/export/cloud-gold-mine/keys?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setKeys(data.keys || []);
          if (data.keys && data.keys.length > 0) {
            setSelectedKey(data.keys[0]);
          }
        }
      } catch (err) {
        // ignore
      } finally {
        setLoadingKeys(false);
      }
    }
    fetchKeys();
  }, [projectId]);

  const handleExport = async () => {
    if (!projectId) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export/cloud-gold-mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, groupByKey: selectedKey })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start export');
      
      showToast(`Started cloud upload for ${data.papersCount} PDFs. Job ID: ${data.exportId}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error exporting to cloud', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
      <div className="bg-primary/10 p-6 rounded-full">
        <Cloud className="w-16 h-16 text-primary" />
      </div>
      
      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-black text-foreground">Cloud Gold Mine</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Automatically restructure and upload your final cohort's PDFs to your connected cloud storage (via rclone).
          PDFs are grouped hierarchically by their Quality Assessment score and a selected extracted variable.
        </p>
      </div>

      <div className="bg-secondary/30 border border-border p-4 rounded-xl text-left text-xs text-muted-foreground w-full max-w-lg space-y-4">
        <div className="flex items-center gap-2 font-bold text-foreground">
          <FolderTree className="w-4 h-4 text-emerald-500" />
          Directory Structure Example
        </div>
        <div className="bg-background border border-border p-3 rounded text-[10px] font-mono leading-relaxed opacity-80">
          Google_Drive/SLR_Magic/Gold_Mine_Exports/<br/>
          &nbsp;&nbsp;├── QA_High/<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp; ├── RCT/<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp; │&nbsp;&nbsp; ├── paper_123.pdf<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp; │&nbsp;&nbsp; └── paper_456.pdf<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp; └── Observational/<br/>
          &nbsp;&nbsp;│&nbsp;&nbsp; &nbsp;&nbsp;&nbsp; └── paper_789.pdf<br/>
          &nbsp;&nbsp;└── QA_Low/<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── ...
        </div>

        <div className="space-y-2">
          <label className="font-bold text-foreground block">Select Grouping Variable (from Umbrellanizer)</label>
          {loadingKeys ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading variables...
            </div>
          ) : keys.length === 0 ? (
            <div className="text-muted-foreground italic">
              No mapped variables found. PDFs will only be grouped by QA Score.
            </div>
          ) : (
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-bold"
            >
              <option value="">None (Group by QA Score only)</option>
              {keys.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting || loadingKeys}
        className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 uppercase tracking-wide text-sm"
      >
        {exporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading to Cloud...
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" />
            Start Cloud Sync
          </>
        )}
      </button>
    </div>
  );
}
