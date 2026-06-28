import React from 'react';
import { BarChart3, Cloud, HardDrive, AlertCircle } from 'lucide-react';

interface LocalPDFStatusChartProps {
  activeProject: any;
}

export default function LocalPDFStatusChart({ activeProject }: LocalPDFStatusChartProps) {
  const stats = activeProject?.stats || { total: 0, acquired: 0, synced: 0, duplicates: 0 };
  const pendingAcquisition = Math.max(0, stats.total - stats.acquired);
  const pendingSync = Math.max(0, stats.acquired - stats.synced);

  const acquiredPct = stats.total > 0 ? Math.round((stats.acquired / stats.total) * 100) : 0;
  const syncedPct = stats.acquired > 0 ? Math.round((stats.synced / stats.acquired) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl shadow-md p-6 space-y-5 w-full">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="space-y-1">
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Local PDF Asset &amp; Cloud Synchronization Chart
          </h3>
          <p className="text-[10px] text-muted-foreground">Real-time status distribution of acquired PDF assets and Rclone cloud mirror matching.</p>
        </div>
        <span className="px-2 py-1 bg-secondary text-foreground rounded text-[10px] font-mono font-bold border border-border">
          Scope: {activeProject?.name || 'Default Project'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {/* Acquired Asset Bar */}
        <div className="space-y-2 bg-secondary/10 p-4 rounded-xl border border-border/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <HardDrive className="w-4 h-4 text-emerald-500" />
              <span>Local Cached Assets</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-500">{stats.acquired} / {stats.total}</span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border/30">
              <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${acquiredPct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              {pendingAcquisition > 0 ? `${pendingAcquisition} papers pending scraper acquisition` : 'All project papers successfully acquired locally.'}
            </p>
          </div>
        </div>

        {/* Cloud Sync Bar */}
        <div className="space-y-2 bg-secondary/10 p-4 rounded-xl border border-border/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Cloud className="w-4 h-4 text-blue-500" />
              <span>Rclone Cloud Mirror</span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-500">{stats.synced} / {stats.acquired}</span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border/30">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${syncedPct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              {pendingSync > 0 ? `${pendingSync} acquired assets pending push to cloud storage` : '100% of acquired assets mirrored to cloud.'}
            </p>
          </div>
        </div>

        {/* Actionable Insights */}
        <div className="space-y-2 bg-secondary/10 p-4 rounded-xl border border-border/60 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Harmonization Insights</span>
          </div>
          <div className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
            <p>
              • <span className="font-semibold text-foreground">Cloud Provider:</span> {activeProject?.cloud_provider === 'onedrive' ? 'Microsoft OneDrive' : 'Google Drive'}
            </p>
            <p>
              • <span className="font-semibold text-foreground">Remote Name:</span> <code className="bg-secondary px-1 py-0.5 rounded font-mono text-[10px]">{activeProject?.rclone_remote_name || 'gdrive'}</code>
            </p>
            <p>
              • <span className="font-semibold text-foreground">Resolved Duplicates:</span> {stats.duplicates} excluded from batch processing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
