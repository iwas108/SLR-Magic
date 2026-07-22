import React from 'react';
interface PoolStatsHeaderProps {
  projects: any[];
  activeProjectId: string;
}

export default function PoolStatsHeader({ projects, activeProjectId }: PoolStatsHeaderProps) {

  const getActiveProjectPoolTags = (poolId: string): { code: string; label: string }[] => {
    const activeProj = projects.find((p: any) => String(p.id) === String(activeProjectId));
    if (!activeProj || !activeProj.pool_tags) return [];
    try {
      const parsed = typeof activeProj.pool_tags === 'string' ? JSON.parse(activeProj.pool_tags) : activeProj.pool_tags;
      return parsed[poolId] || [];
    } catch (e) {
      return [];
    }
  };

  const activeProj = projects.find((p: any) => String(p.id) === String(activeProjectId));
  const targetA = activeProj?.pool_a_size || 50;
  const targetB = activeProj?.pool_b_size || 30;
  const targetC = activeProj?.pool_c_size || 20;
  const countA = activeProj?.stats?.pool_a_count || 0;
  const countB = activeProj?.stats?.pool_b_count || 0;
  const countC = activeProj?.stats?.pool_c_count || 0;
  const tagStats = activeProj?.stats?.tagStats;

  const pctA = Math.min(100, Math.round((countA / targetA) * 100));
  const pctB = Math.min(100, Math.round((countB / targetB) * 100));
  const pctC = Math.min(100, Math.round((countC / targetC) * 100));

  return (
    <div className="hidden xl:flex items-center gap-6 text-[10px] select-none">
      {/* Pool A */}
      <div className="w-48 space-y-1 group relative cursor-pointer">
        <div className="flex justify-between font-bold">
          <span className="text-indigo-400">Pool A</span>
          <span className="text-muted-foreground">{countA} / {targetA}</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${pctA}%` }} />
        </div>

        {/* Floating Balloon */}
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
            <span>Pool A Tag Breakdown</span>
            <span>Count</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            <div className="flex justify-between text-muted-foreground hover:text-foreground">
              <span className="truncate max-w-[170px]">General (No Tag)</span>
              <span className="font-mono">{tagStats?.['pool_a']?.['__general'] || 0}</span>
            </div>
            {getActiveProjectPoolTags('pool_a').map(tag => {
              const cnt = tagStats?.['pool_a']?.[tag.code] || 0;
              return (
                <div key={tag.code} className="flex justify-between hover:text-foreground">
                  <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                    <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                  </span>
                  <span className="font-mono">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pool B */}
      <div className="w-48 space-y-1 group relative cursor-pointer">
        <div className="flex justify-between font-bold">
          <span className="text-emerald-400">Pool B</span>
          <span className="text-muted-foreground">{countB} / {targetB}</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pctB}%` }} />
        </div>

        {/* Floating Balloon */}
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
            <span>Pool B Tag Breakdown</span>
            <span>Count</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            <div className="flex justify-between text-muted-foreground hover:text-foreground">
              <span className="truncate max-w-[170px]">General (No Tag)</span>
              <span className="font-mono">{tagStats?.['pool_b']?.['__general'] || 0}</span>
            </div>
            {getActiveProjectPoolTags('pool_b').map(tag => {
              const cnt = tagStats?.['pool_b']?.[tag.code] || 0;
              return (
                <div key={tag.code} className="flex justify-between hover:text-foreground">
                  <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                    <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                  </span>
                  <span className="font-mono">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pool C */}
      <div className="w-48 space-y-1 group relative cursor-pointer">
        <div className="flex justify-between font-bold">
          <span className="text-amber-400">Pool C</span>
          <span className="text-muted-foreground">{countC} / {targetC}</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border/50">
          <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${pctC}%` }} />
        </div>

        {/* Floating Balloon */}
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-lg p-2.5 w-56 hidden group-hover:block z-50 text-[10px] font-semibold text-foreground space-y-1.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          <div className="font-bold text-primary border-b border-border/40 pb-1 flex justify-between">
            <span>Pool C Tag Breakdown</span>
            <span>Count</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            <div className="flex justify-between text-muted-foreground hover:text-foreground">
              <span className="truncate max-w-[170px]">General (No Tag)</span>
              <span className="font-mono">{tagStats?.['pool_c']?.['__general'] || 0}</span>
            </div>
            {getActiveProjectPoolTags('pool_c').map(tag => {
              const cnt = tagStats?.['pool_c']?.[tag.code] || 0;
              return (
                <div key={tag.code} className="flex justify-between hover:text-foreground">
                  <span className="truncate max-w-[170px]" title={`${tag.code}: ${tag.label}`}>
                    <span className="font-bold text-primary mr-1">{tag.code}</span>{tag.label}
                  </span>
                  <span className="font-mono">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
