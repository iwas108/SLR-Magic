import React from 'react';
import { Database, UserCheck, HelpCircle } from 'lucide-react';

interface ScreeningStats {
  total: number;
  screened: number;
  pending: number;
  stageCounts: Record<string, number>;
  decisionCounts: Record<string, number>;
}

interface ManualScreeningStatsHeaderProps {
  stats: ScreeningStats;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
}

export default function ManualScreeningStatsHeader({
  stats,
  isFullscreen,
  onFullscreenToggle
}: ManualScreeningStatsHeaderProps) {
  const { total, screened, pending, stageCounts, decisionCounts } = stats;

  // Calculate percentages
  const getPct = (part: number, whole: number) => {
    if (whole <= 0) return '0%';
    return `${Math.round((part / whole) * 100)}%`;
  };

  const includeCount = decisionCounts['INCLUDE'] || 0;
  const excludeCount = decisionCounts['EXCLUDE'] || 0;
  const uncertainCount = decisionCounts['UNCERTAIN'] || 0;

  return (
    <div className="flex items-center gap-3 bg-secondary/20 p-2 rounded-xl border border-border/80 text-[10px] font-bold text-muted-foreground select-none shrink-0 flex-wrap">
      {/* Total papers */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-background/50 rounded-lg shadow-sm border border-border/40">
        <Database className="w-3.5 h-3.5 text-primary" />
        <span>Total: <span className="text-foreground">{total}</span></span>
      </div>

      {/* Screened Papers */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-background/50 rounded-lg shadow-sm border border-border/40">
        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Screened: <span className="text-emerald-500">{screened}</span> <span className="text-muted-foreground/60 text-[9px]">({getPct(screened, total)})</span></span>
      </div>

      {/* Pending Papers */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-background/50 rounded-lg shadow-sm border border-border/40">
        <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
        <span>Pending: <span className="text-amber-500">{pending}</span> <span className="text-muted-foreground/60 text-[9px]">({getPct(pending, total)})</span></span>
      </div>

      {/* Stages Summary */}
      <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
        <span className="text-[8px] uppercase tracking-wider text-muted-foreground/60">Stages:</span>
        <span className="px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[9px]">
          FF: {stageCounts['fast_filter'] || 0} <span className="text-[8px] opacity-60">({getPct(stageCounts['fast_filter'] || 0, total)})</span>
        </span>
        <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px]">
          GK: {stageCounts['gatekeeper'] || 0} <span className="text-[8px] opacity-60">({getPct(stageCounts['gatekeeper'] || 0, total)})</span>
        </span>
        <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[9px]">
          SC: {stageCounts['scientist'] || 0} <span className="text-[8px] opacity-60">({getPct(stageCounts['scientist'] || 0, total)})</span>
        </span>
        <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded text-[9px]">
          MN: {stageCounts['miner'] || 0} <span className="text-[8px] opacity-60">({getPct(stageCounts['miner'] || 0, total)})</span>
        </span>
      </div>

      {/* Decisions Summary */}
      <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
        <span className="text-[8px] uppercase tracking-wider text-muted-foreground/60">Results:</span>
        <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px]">
          Include: {includeCount} <span className="text-[8px] opacity-60">({getPct(includeCount, screened)})</span>
        </span>
        <span className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded text-[9px]">
          Exclude: {excludeCount} <span className="text-[8px] opacity-60">({getPct(excludeCount, screened)})</span>
        </span>
        <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[9px]">
          Uncertain: {uncertainCount} <span className="text-[8px] opacity-60">({getPct(uncertainCount, screened)})</span>
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
