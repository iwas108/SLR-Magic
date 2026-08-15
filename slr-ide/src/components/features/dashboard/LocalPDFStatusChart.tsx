import React from 'react';
import { BarChart3, Cloud, HardDrive, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface LocalPDFStatusChartProps {
  activeProject: any;
}

export default function LocalPDFStatusChart({ activeProject }: LocalPDFStatusChartProps) {
  const stats = activeProject?.stats || { total: 0, acquired: 0, synced: 0, duplicates: 0 };
  const stageStats = activeProject?.stats?.stageStats || {};
  const stage1 = stageStats['1'] || { included: 0, excluded: 0, unprocessed: 0, total: 0 };
  const targetPapers = stage1.included || 0;

  const pendingAcquisition = Math.max(0, targetPapers - stats.acquired);
  const pendingSync = Math.max(0, stats.acquired - stats.synced);

  const acquiredPct = targetPapers > 0 ? Math.round((stats.acquired / targetPapers) * 100) : 0;
  const syncedPct = stats.acquired > 0 ? Math.round((stats.synced / stats.acquired) * 100) : 0;

  return (
    <div className="bg-card border border-border/80 rounded-2xl shadow-md p-6 space-y-5 w-full">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="space-y-1">
          <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            PDF Asset Storage &amp; Cloud Telemetry
          </h3>
          <p className="text-[11px] text-muted-foreground">Real-time status distribution of local acquired PDF assets and Rclone cloud mirror matching.</p>
        </div>
        <span className="px-2.5 py-1 bg-secondary/80 text-foreground rounded-lg text-[10px] font-mono font-bold border border-border/80">
          Scope: {activeProject?.name || 'No Active Project'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
        {/* Acquired Asset Bar */}
        <div className="space-y-3 bg-secondary/15 p-4 rounded-xl border border-border/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <HardDrive className="w-4 h-4" />
              </div>
              <span>Local Cached Assets</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-500">{stats.acquired} / {targetPapers}</span>
          </div>
          <div className="space-y-1.5">
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border/40">
              <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${acquiredPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
              <span>{acquiredPct}% of S1 Inclusions</span>
              <span className="font-medium text-foreground">{pendingAcquisition > 0 ? `${pendingAcquisition} pending` : 'Complete'}</span>
            </div>
          </div>
        </div>

        {/* Cloud Sync Bar */}
        <div className="space-y-3 bg-secondary/15 p-4 rounded-xl border border-border/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <Cloud className="w-4 h-4" />
              </div>
              <span>Rclone Cloud Mirror</span>
            </div>
            <span className="text-xs font-mono font-bold text-blue-500">{stats.synced} / {stats.acquired}</span>
          </div>
          <div className="space-y-1.5">
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border/40">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${syncedPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
              <span>{syncedPct}% Mirrored</span>
              <span className="font-medium text-foreground">{pendingSync > 0 ? `${pendingSync} un-synced` : '100% Mirrored'}</span>
            </div>
          </div>
        </div>

        {/* Actionable Insights */}
        <div className="space-y-2.5 bg-secondary/15 p-4 rounded-xl border border-border/60 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span>Storage Diagnostics</span>
          </div>
          <div className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            <div className="flex items-center justify-between">
              <span>Cloud Provider:</span>
              <span className="font-bold text-foreground capitalize">{activeProject?.cloud_provider === 'onedrive' ? 'Microsoft OneDrive' : 'Google Drive'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Rclone Remote:</span>
              <code className="bg-secondary/70 px-1.5 py-0.5 rounded font-mono text-[10px] text-primary">{activeProject?.rclone_remote_name || (activeProject?.cloud_provider === 'onedrive' ? 'onedrive' : 'gdrive')}</code>
            </div>
            <div className="flex items-center justify-between">
              <span>Duplicate Exclusions:</span>
              <span className="font-mono font-bold text-foreground">{stats.duplicates || 0} papers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
