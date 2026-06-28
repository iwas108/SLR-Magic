import React from 'react';
import { Folder, Database, CheckCircle2, TrendingUp } from 'lucide-react';

interface MetricSummaryCardsProps {
  activeProject: any;
}

export default function MetricSummaryCards({ activeProject }: MetricSummaryCardsProps) {
  const stats = activeProject?.stats || { total: 0, screened: 0, acquired: 0, synced: 0, duplicates: 0 };
  const screenedPct = stats.total > 0 ? Math.round((stats.screened / stats.total) * 100) : 0;
  const acquiredPct = stats.total > 0 ? Math.round((stats.acquired / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
      {/* Active Project Card */}
      <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
        <div className="space-y-1 z-10">
          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Active Project</span>
          <h4 className="font-bold text-sm text-foreground truncate max-w-[150px]">{activeProject?.name || 'Default Project'}</h4>
          <p className="text-[9px] text-muted-foreground truncate max-w-[150px]">Folder: {activeProject?.folder_name || 'default_project'}</p>
        </div>
        <Folder className="w-10 h-10 text-primary/10 absolute right-3 top-3 group-hover:scale-110 group-hover:text-primary/20 transition-all z-0" />
      </div>

      {/* Total Papers Card */}
      <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
        <div className="space-y-1 z-10">
          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Total Papers</span>
          <h4 className="font-bold text-lg text-foreground font-mono">{stats.total}</h4>
          <p className="text-[9px] text-muted-foreground">In active project scope{stats.duplicates > 0 ? ` (excluding ${stats.duplicates} duplicates)` : ''}</p>
        </div>
        <Database className="w-10 h-10 text-primary/10 absolute right-3 top-3 group-hover:scale-110 group-hover:text-primary/20 transition-all z-0" />
      </div>

      {/* Screening Progress Card */}
      <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
        <div className="flex items-center justify-between z-10 mb-1">
          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Screening Rate</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
        </div>
        <div className="z-10 flex items-baseline gap-2">
          <h4 className="font-bold text-lg text-foreground font-mono">{stats.screened}</h4>
          <span className="text-[10px] text-muted-foreground">/ {stats.total} ({screenedPct}%)</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden z-10">
          <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${screenedPct}%` }} />
        </div>
      </div>

      {/* PDF Acquisition Card */}
      <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
        <div className="flex items-center justify-between z-10 mb-1">
          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">PDF Acquisition</span>
          <TrendingUp className="w-4 h-4 text-amber-500/70" />
        </div>
        <div className="z-10 flex items-baseline gap-2">
          <h4 className="font-bold text-lg text-foreground font-mono">{stats.acquired}</h4>
          <span className="text-[10px] text-muted-foreground">/ {stats.total} ({acquiredPct}%)</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden z-10">
          <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${acquiredPct}%` }} />
        </div>
      </div>
    </div>
  );
}
