import React from 'react';
import { ShieldCheck, ShieldAlert, BarChart3, Binary, Percent } from 'lucide-react';

interface StatsRowProps {
  label: string;
  value: string;
  subValue?: string;
}

function StatsRow({ label, value, subValue }: StatsRowProps) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right font-bold text-foreground">
        <span>{value}</span>
        {subValue && <span className="text-[10px] text-muted-foreground font-normal ml-1">({subValue})</span>}
      </div>
    </div>
  );
}

interface BatchStatisticsCardsProps {
  stats: any | null;
  auditPassed: boolean;
  batchesCount: number;
}

export default function BatchStatisticsCards({
  stats,
  auditPassed,
  batchesCount
}: BatchStatisticsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3 bg-muted/20 border border-border/50 rounded-2xl p-6 text-center text-xs text-muted-foreground">
          No audit statistics available. Completed batches will calculate Sequential Quality Control statistics here.
        </div>
      </div>
    );
  }

  const { s3, s4 } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
      {/* Stage 3 Card */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/10">
                <BarChart3 className="w-4.5 h-4.5 text-blue-500" />
              </div>
              <span className="text-xs font-bold text-foreground">Stage 3: Scientist</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              s3.passed 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
              {s3.passed ? 'PASSED' : 'FAILING'}
            </span>
          </div>

          <div className="space-y-0.5">
            <StatsRow 
              label="QA Agreement (p̂)" 
              value={`${(s3.p_hat * 100).toFixed(1)}%`} 
            />
            <StatsRow 
              label="Standard Error (SE)" 
              value={s3.SE.toFixed(4)} 
            />
            <StatsRow 
              label="95% CI Lower Bound" 
              value={s3.CI_lower.toFixed(3)} 
              subValue="target ≥ 0.65"
            />
            <StatsRow 
              label="Critical Miss Rate" 
              value={`${s3.critical_miss_rate.toFixed(1)}%`} 
              subValue="target = 0%"
            />
          </div>
        </div>
      </div>

      {/* Stage 4 Card */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center space-x-2">
              <div className="bg-purple-500/10 p-1.5 rounded-lg border border-purple-500/10">
                <Binary className="w-4.5 h-4.5 text-purple-500" />
              </div>
              <span className="text-xs font-bold text-foreground">Stage 4: Miner</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              s4.passed 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
              {s4.passed ? 'PASSED' : 'FAILING'}
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1 select-none">Structural Validation</div>
            <StatsRow 
              label="Schema Integrity Rate" 
              value={`${s4.schema_integrity_rate.toFixed(1)}%`} 
              subValue="target = 100%"
            />
            <StatsRow 
              label="95% CI Lower Bound" 
              value={s4.CI_lower.toFixed(3)} 
              subValue="target ≥ 0.80"
            />
            
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mt-2.5 mb-1 select-none">Content Validation</div>
            <StatsRow 
              label="Semantic Agreement" 
              value={`${s4.semantic_agreement.toFixed(1)}%`} 
              subValue="informational"
            />
          </div>
        </div>
      </div>

      {/* Audit Stopping Criteria Card */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center space-x-2">
              <div className={`p-1.5 rounded-lg border ${
                auditPassed 
                  ? 'bg-emerald-500/10 border-emerald-500/10' 
                  : 'bg-amber-500/10 border-amber-500/10'
              }`}>
                {auditPassed ? (
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-500" />
                )}
              </div>
              <span className="text-xs font-bold text-foreground">Sequential QC Audit</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              auditPassed 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
              {auditPassed ? 'COMPLETE' : 'INCOMPLETE'}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {auditPassed 
                ? 'Excellent! The sequential quality control audit stopping criteria have been satisfied over two consecutive batches.' 
                : 'The audit must satisfied the target statistical exit thresholds across two consecutive completed batches to freeze the pipeline.'}
            </p>

            <div className="pt-1.5 border-t border-border/40 space-y-0.5">
              <StatsRow 
                label="Completed Batches" 
                value={`${batchesCount}`} 
              />
              <StatsRow 
                label="Status Over 2 Batches" 
                value={auditPassed ? "Audit passed" : "Waiting for stable pass"} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
