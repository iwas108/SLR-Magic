import React from 'react';
import { Layers, Database, UserCheck, HelpCircle } from 'lucide-react';
import { Paper } from '@/types';

interface ManualScreeningStatsHeaderProps {
  papers: Paper[];
  totalCount: number;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
}

export default function ManualScreeningStatsHeader({
  papers,
  totalCount,
  isFullscreen,
  onFullscreenToggle
}: ManualScreeningStatsHeaderProps) {
  // Compute summary stats dynamically for the loaded list
  const screenedCount = papers.filter(p => !!p.manual_decision).length;
  
  const stageCounts = papers.reduce((acc, p) => {
    if (p.manual_stage) {
      acc[p.manual_stage] = (acc[p.manual_stage] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const decisionCounts = papers.reduce((acc, p) => {
    if (p.manual_decision) {
      acc[p.manual_decision] = (acc[p.manual_decision] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex items-center gap-4 bg-secondary/20 p-2.5 rounded-xl border border-border/80 text-[10px] font-bold text-muted-foreground select-none shrink-0 flex-wrap">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-background/50 rounded-lg shadow-sm border border-border/40">
        <Database className="w-3.5 h-3.5 text-primary" />
        <span>Total: <span className="text-foreground">{totalCount}</span></span>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-1 bg-background/50 rounded-lg shadow-sm border border-border/40">
        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Screened: <span className="text-emerald-500">{screenedCount}</span></span>
      </div>

      {/* Stage Watermark Summary */}
      <div className="flex items-center gap-2 border-l border-border/60 pl-3">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Stages:</span>
        <span className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded">
          Fast Filter: {stageCounts['fast_filter'] || 0}
        </span>
        <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">
          Gatekeeper: {stageCounts['gatekeeper'] || 0}
        </span>
        <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
          Scientist: {stageCounts['scientist'] || 0}
        </span>
        <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded">
          Miner: {stageCounts['miner'] || 0}
        </span>
      </div>

      {/* Decisions Summary */}
      <div className="flex items-center gap-2 border-l border-border/60 pl-3">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Results:</span>
        <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">
          Include: {decisionCounts['INCLUDE'] || 0}
        </span>
        <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded">
          Exclude: {decisionCounts['EXCLUDE'] || 0}
        </span>
        <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded">
          QA Wait: {decisionCounts['QA_WAIT'] || 0}
        </span>
      </div>

      {/* Screen Mode Control */}
      <button
        onClick={onFullscreenToggle}
        className="ml-auto px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 rounded-lg shadow-md uppercase tracking-wide text-[9px] font-black cursor-pointer"
      >
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Workspace'}
      </button>
    </div>
  );
}
