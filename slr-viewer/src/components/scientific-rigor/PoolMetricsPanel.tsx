import React from 'react';

interface PoolMetricsPanelProps {
  projects: any[];
  activeProjectId: string;
}

export default function PoolMetricsPanel({
  projects,
  activeProjectId
}: PoolMetricsPanelProps) {
  const activeProj = projects.find((p: any) => String(p.id) === String(activeProjectId)) || projects[0];
  const targetA = activeProj?.pool_a_size ?? activeProj?.stats?.pool_a_size ?? 50;
  const targetB = activeProj?.pool_b_size ?? activeProj?.stats?.pool_b_size ?? 30;
  const targetC = activeProj?.pool_c_size ?? activeProj?.stats?.pool_c_size ?? 20;
  const countA = activeProj?.stats?.pool_a_count ?? activeProj?.pool_a_count ?? 0;
  const countB = activeProj?.stats?.pool_b_count ?? activeProj?.pool_b_count ?? 0;
  const countC = activeProj?.stats?.pool_c_count ?? activeProj?.pool_c_count ?? 0;

  const pctA = Math.min(100, Math.round((countA / targetA) * 100));
  const pctB = Math.min(100, Math.round((countB / targetB) * 100));
  const pctC = Math.min(100, Math.round((countC / targetC) * 100));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
      {/* Pool A Card */}
      <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
        <div className="space-y-1.5 z-10">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-indigo-400 uppercase font-black tracking-wider">Pool A (Fast Filter)</span>
            <span className="text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">PDF Not Required</span>
          </div>
          <h4 className="font-bold text-lg text-foreground font-mono">
            {countA} <span className="text-xs text-muted-foreground font-normal">/ {targetA} papers</span>
          </h4>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pctA}%` }} />
          </div>
          <p className="text-[9px] text-muted-foreground flex justify-between">
            <span>Progress: {pctA}%</span>
          </p>
        </div>
      </div>

      {/* Pool B Card */}
      <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
        <div className="space-y-1.5 z-10">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider">Pool B (Gatekeeper)</span>
            <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">PDF Required</span>
          </div>
          <h4 className="font-bold text-lg text-foreground font-mono">
            {countB} <span className="text-xs text-muted-foreground font-normal">/ {targetB} papers</span>
          </h4>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pctB}%` }} />
          </div>
          <p className="text-[9px] text-muted-foreground">Progress: {pctB}%</p>
        </div>
      </div>

      {/* Pool C Card */}
      <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
        <div className="space-y-1.5 z-10">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider">Pool C (Scientist)</span>
            <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">PDF Required</span>
          </div>
          <h4 className="font-bold text-lg text-foreground font-mono">
            {countC} <span className="text-xs text-muted-foreground font-normal">/ {targetC} papers</span>
          </h4>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pctC}%` }} />
          </div>
          <p className="text-[9px] text-muted-foreground">Progress: {pctC}%</p>
        </div>
      </div>
    </div>
  );
}
