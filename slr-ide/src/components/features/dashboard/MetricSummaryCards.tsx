import React from 'react';
import { Folder, Database, CheckCircle2, TrendingUp, DollarSign, PieChart } from 'lucide-react';

interface MetricSummaryCardsProps {
  activeProject: any;
}

export default function MetricSummaryCards({ activeProject }: MetricSummaryCardsProps) {
  const stats = activeProject?.stats || { total: 0, screened: 0, acquired: 0, synced: 0, duplicates: 0 };
  const screenedPct = stats.total > 0 ? Math.round((stats.screened / stats.total) * 100) : 0;
  const acquiredPct = stats.total > 0 ? Math.round((stats.acquired / stats.total) * 100) : 0;
  
  const budgetLimit = activeProject?.project_budget_limit || 0;
  const currentSpend = activeProject?.project_current_spend || 0;
  const spendPct = budgetLimit > 0 ? Math.round((currentSpend / budgetLimit) * 100) : 0;

  const stageStats = activeProject?.stats?.stageStats || {};
  const stage1 = stageStats['1'] || { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: {} };
  const stage2 = stageStats['2'] || { included: 0, excluded: 0, unprocessed: 0, total: 0, ecBreakdown: {} };

  const renderStageBar = (stageData: { 
    included: number; 
    excluded: number; 
    unprocessed: number; 
    total: number; 
    ecBreakdown?: Record<string, number>;
    inc_has_pdf?: number;
    inc_no_doi?: number;
    inc_pdf_failed?: number;
  }, showPdfBreakdown: boolean = true) => {
    const stageTotal = stageData.total || 0;
    if (stageTotal === 0) return <div className="text-[10px] text-muted-foreground mt-2">No papers in this stage</div>;
    
    const actualUnprocessed = stageData.unprocessed;
    const incPct = Math.round((stageData.included / stageTotal) * 100);
    const excPct = Math.round((stageData.excluded / stageTotal) * 100);
    const unpPct = Math.max(0, 100 - incPct - excPct);

    let incBreakdownList = null;
    if (showPdfBreakdown && stageData.included > 0 && stageData.inc_has_pdf !== undefined) {
      const hasPdfPct = Math.round((stageData.inc_has_pdf / stageData.included) * 100) || 0;
      const noDoiPct = Math.round((stageData.inc_no_doi! / stageData.included) * 100) || 0;
      const failedPdfPct = Math.round((stageData.inc_pdf_failed! / stageData.included) * 100) || 0;
      
      incBreakdownList = (
        <div className="mt-2 text-[9px] text-muted-foreground border-t border-border pt-2 grid grid-cols-2 gap-1">
          <div className="flex justify-between items-center bg-secondary/50 px-1.5 py-0.5 rounded">
            <span className="truncate max-w-[80px]" title="Has PDF">Has PDF</span>
            <span className="font-mono text-emerald-500">{stageData.inc_has_pdf} ({hasPdfPct}%)</span>
          </div>
          <div className="flex justify-between items-center bg-secondary/50 px-1.5 py-0.5 rounded">
            <span className="truncate max-w-[80px]" title="No DOI">No DOI</span>
            <span className="font-mono text-amber-500">{stageData.inc_no_doi} ({noDoiPct}%)</span>
          </div>
          <div className="flex justify-between items-center bg-secondary/50 px-1.5 py-0.5 rounded">
            <span className="truncate max-w-[80px]" title="PDF Failed">PDF Failed</span>
            <span className="font-mono text-rose-500">{stageData.inc_pdf_failed} ({failedPdfPct}%)</span>
          </div>
        </div>
      );
    }

    let topEcList = null;
    if (stageData.excluded > 0 && stageData.ecBreakdown) {
      const sortedEc = Object.entries(stageData.ecBreakdown).sort((a, b) => b[1] - a[1]);
      const top3 = sortedEc.slice(0, 3);
      const otherCount = sortedEc.slice(3).reduce((acc, curr) => acc + curr[1], 0);
      const otherDetails = sortedEc.slice(3).map(([trigger, count]) => `${trigger}: ${count}`).join('\n');
      
      topEcList = (
        <div className="mt-2 text-[9px] text-muted-foreground border-t border-border pt-2 grid grid-cols-2 gap-1">
          {top3.map(([trigger, count], idx) => {
            const pct = Math.round((count / stageData.excluded) * 100);
            return (
              <div key={idx} className="flex justify-between items-center bg-secondary/50 px-1.5 py-0.5 rounded">
                <span className="truncate max-w-[80px]" title={trigger}>{trigger}</span>
                <span className="font-mono text-rose-500">{count} ({pct}%)</span>
              </div>
            );
          })}
          {otherCount > 0 && (
            <div className="group relative flex justify-between items-center bg-secondary/50 px-1.5 py-0.5 rounded cursor-help">
              <span className="truncate max-w-[80px]">Other</span>
              <span className="font-mono text-rose-500">{otherCount} ({Math.round((otherCount / stageData.excluded) * 100)}%)</span>
              
              <div className="absolute bottom-full right-0 mb-1 hidden group-hover:flex flex-col bg-popover text-popover-foreground border border-border text-[9px] p-2 rounded shadow-md w-max z-50">
                <div className="font-bold border-b border-border/50 pb-1 mb-1 text-left">Other Exclusions</div>
                {sortedEc.slice(3).map(([trigger, count], idx) => (
                  <div key={idx} className="flex justify-between gap-4">
                    <span>{trigger}</span>
                    <span className="font-mono text-rose-500">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="mt-3 space-y-1 z-10 relative">
        <div className="flex justify-between text-[10px] font-bold">
          <span className="text-emerald-500">Include: {stageData.included} ({incPct}%)</span>
          <span className="text-rose-500">Exclude: {stageData.excluded} ({excPct}%)</span>
          <span className="text-slate-400">Unproc: {actualUnprocessed} ({unpPct}%)</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-secondary">
          <div className="bg-emerald-500 h-full" style={{ width: `${incPct}%` }} />
          <div className="bg-rose-500 h-full" style={{ width: `${excPct}%` }} />
          <div className="bg-slate-400 h-full" style={{ width: `${unpPct}%` }} />
        </div>
        {incBreakdownList}
        {topEcList}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 shrink-0">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

        {/* Budget & Spend Card */}
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between z-10 mb-1">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Budget Spent</span>
            <DollarSign className="w-4 h-4 text-indigo-500/70" />
          </div>
          <div className="z-10 flex items-baseline gap-2">
            <h4 className="font-bold text-lg text-foreground font-mono">${currentSpend.toFixed(2)}</h4>
            <span className="text-[10px] text-muted-foreground">/ ${budgetLimit.toFixed(2)} ({spendPct}%)</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden z-10">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${spendPct > 90 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(spendPct, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stage 1 Metrics Card */}
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between z-10 mb-1">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Stage 1: Fast Filter Metrics</span>
            <PieChart className="w-4 h-4 text-blue-500/70" />
          </div>
          {renderStageBar(stage1, true)}
        </div>

        {/* Stage 2 Metrics Card */}
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between z-10 mb-1">
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Stage 2: Gatekeeper Metrics</span>
            <PieChart className="w-4 h-4 text-purple-500/70" />
          </div>
          {renderStageBar(stage2, false)}
        </div>
      </div>
    </div>
  );
}
