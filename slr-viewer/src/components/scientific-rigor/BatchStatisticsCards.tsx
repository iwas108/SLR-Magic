import React from 'react';
import { ShieldCheck, ShieldAlert, BarChart3, Binary } from 'lucide-react';

interface TooltipConfig {
  title: string;
  formula?: string;
  meaning: string;
}

function StatsRow({ label, value, subValue, tooltip }: { label: string; value: string; subValue?: string; tooltip?: TooltipConfig }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0 text-xs relative group/tooltip">
      {tooltip ? (
        <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40 cursor-help select-none">
          {label}
        </span>
      ) : (
        <span className="text-muted-foreground">{label}</span>
      )}
      
      <div className="text-right font-bold text-foreground">
        <span>{value}</span>
        {subValue && <span className="text-[10px] text-muted-foreground font-normal ml-1">({subValue})</span>}
      </div>

      {tooltip && (
        <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
          <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">{tooltip.title}</p>
          {tooltip.formula && (
            <p className="mb-1"><strong>Formula/Calculation:</strong> {tooltip.formula}</p>
          )}
          <p><strong>Scientific Meaning:</strong> {tooltip.meaning}</p>
        </div>
      )}
    </div>
  );
}

export default function BatchStatisticsCards({
  stats,
  auditPassed,
  batchesCount
}: {
  stats?: any;
  auditPassed?: boolean;
  batchesCount?: number;
}) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-3 bg-muted/20 border border-border/50 rounded-2xl p-6 text-center text-xs text-muted-foreground">
          No audit statistics available in this snapshot. Completed batches will calculate Sequential Quality Control statistics here.
        </div>
      </div>
    );
  }

  const { s3 = {}, s4 = {} } = stats;

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
              s3.passed !== false
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
              {s3.passed !== false ? 'PASSED' : 'FAILING'}
            </span>
          </div>

          <div className="space-y-0.5">
            <StatsRow 
              label="QA Agreement (p̂)" 
              value={`${((s3.p_hat || 0) * 100).toFixed(1)}%`} 
              tooltip={{
                title: "QA Agreement (p̂)",
                formula: "qaAgreementCount / totalQAPairs",
                meaning: "The proportion of total evaluated QA score pairs between the AI and human reviewers that match. An agreement counts if the absolute score difference is strictly less than 1.0 (allowing minor 0.5-point deviations)."
              }}
            />
            <StatsRow 
              label="Standard Error (SE)" 
              value={(s3.SE || 0).toFixed(4)} 
              tooltip={{
                title: "Standard Error (SE)",
                formula: "sqrt(p_hat * (1 - p_hat) / n)",
                meaning: "Measures the statistical variation of the agreement rate estimation across the cumulative validation cohort sample size (n)."
              }}
            />
            <StatsRow 
              label="95% CI Lower Bound" 
              value={(s3.CI_lower || 0).toFixed(3)} 
              subValue="target ≥ 0.65"
              tooltip={{
                title: "95% CI Lower Bound",
                formula: "p_hat - (1.96 * SE)",
                meaning: "The statistical lower limit of agreement. We are 95% confident the true agreement rate exceeds this boundary. The pipeline requires this lower bound to stably clear the 0.65 quality line."
              }}
            />
            <StatsRow 
              label="Critical Miss Rate" 
              value={`${(s3.critical_miss_rate || 0).toFixed(1)}%`} 
              subValue="target = 0.0%"
              tooltip={{
                title: "Critical Miss Rate",
                formula: "criticalMissCount / totalQAPairs * 100",
                meaning: "The rate of major quality assessment disagreements where absolute difference is ≥ 1.0 (e.g. human gave 1.0 and AI gave 0.0). Must strictly equal 0% for scientific rigor certification."
              }}
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
              s4.passed !== false
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
              {s4.passed !== false ? 'PASSED' : 'FAILING'}
            </span>
          </div>

          <div className="space-y-0.5">
            <StatsRow 
              label="Schema Integrity Rate" 
              value={`${(s4.schema_integrity_rate !== undefined ? s4.schema_integrity_rate : (s4.schema_integrity || 0)).toFixed(1)}%`} 
              subValue="target = 100%"
              tooltip={{
                title: "Schema Integrity Rate",
                formula: "validKeyCount / totalExpectedKeys * 100",
                meaning: "Verifies that 100% of expected literature extraction schema keys are present and correctly typed (zero dropped keys, no corrupted types)."
              }}
            />
            <StatsRow 
              label="Standard Error (SE)" 
              value={(s4.SE || 0).toFixed(4)} 
              tooltip={{
                title: "Standard Error (SE)",
                formula: "sqrt(p_hat * (1 - p_hat) / n)",
                meaning: "Standard error calculation for Stage 4 extraction yield across all cumulative papers."
              }}
            />
            <StatsRow 
              label="95% CI Lower Bound" 
              value={(s4.CI_lower || 0).toFixed(3)} 
              subValue="target ≥ 0.70"
              tooltip={{
                title: "95% CI Lower Bound",
                formula: "p_hat - (1.96 * SE)",
                meaning: "Lower bound of confidence for semantic extraction correctness. Must remain ≥ 0.70."
              }}
            />
            <StatsRow 
              label="Semantic Agreement" 
              value={`${(s4.semantic_agreement !== undefined ? s4.semantic_agreement : (s4.exact_match || 0)).toFixed(1)}%`} 
              tooltip={{
                title: "Semantic Agreement Rate",
                formula: "semanticMatchCount / totalExtractionPairs * 100",
                meaning: "Exact and fuzzy semantic token overlap between human extracted taxonomy values and AI extracted strings before normalization."
              }}
            />
          </div>
        </div>
      </div>

      {/* QC Status Certification Card */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center space-x-2">
              <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/10">
                {auditPassed ? (
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-500" />
                )}
              </div>
              <span className="text-xs font-bold text-foreground">Sequential Certification</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              auditPassed 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
              {auditPassed ? 'SATISFIED' : 'PENDING'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Sequential quality control (QC) applies Wald sequential probability ratio tests across rolling batches to verify continuous stability.
            </p>

            <div className="bg-secondary/40 border border-border/50 rounded-xl p-2.5 space-y-1 font-mono text-[10px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Completed Batches:</span>
                <span className="font-bold text-foreground">{batchesCount || 0}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Certified State:</span>
                <span className={`font-bold ${auditPassed ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {auditPassed ? 'Audit Passed' : 'In Review'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
