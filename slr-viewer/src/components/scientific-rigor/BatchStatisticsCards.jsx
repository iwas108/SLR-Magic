import React from 'react';
import { ShieldCheck, ShieldAlert, BarChart3, Binary } from 'lucide-react';

function StatsRow({ label, value, subValue, tooltip }) {
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
              subValue="target = 0%"
              tooltip={{
                title: "Critical Miss Rate",
                formula: "(qaCriticalMissCount / totalQAPairs) * 100%",
                meaning: "The rate of critical deviations where a criteria's score differs by 1.0 or more (e.g. AI gives 1.0 while human consensus is 0.0, indicating a complete misinterpretation). Must be strictly 0% to exit."
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1 select-none">Structural Validation</div>
            <StatsRow 
              label="Schema Integrity Rate" 
              value={`${(s4.schema_integrity_rate ?? s4.schema_integrity ?? 0).toFixed(1)}%`} 
              subValue="target = 100%"
              tooltip={{
                title: "Schema Integrity Rate",
                formula: "structurallyValidPapers / papers.length",
                meaning: "The percentage of AI-generated extractions that strictly comply with the structured JSON schema format, type definitions, and required keys. Must be 100%."
              }}
            />
            <StatsRow 
              label="95% CI Lower Bound" 
              value={(s4.CI_lower ?? 0).toFixed(3)} 
              subValue="target ≥ 0.80"
              tooltip={{
                title: "95% CI Lower Bound",
                formula: "schema_integrity_rate - (1.96 * SE)",
                meaning: "The lower boundary of 95% statistical confidence for schema integrity. The audit requires this lower bound to stably clear the 0.80 line before finalizing the pipeline."
              }}
            />
            
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mt-2.5 mb-1 select-none">Content Validation</div>
            <StatsRow 
              label="Semantic Agreement" 
              value={`${(s4.semantic_agreement ?? s4.exact_match ?? 0).toFixed(1)}%`} 
              subValue="informational"
              tooltip={{
                title: "Semantic Agreement",
                formula: "matchingKeysCount / totalKeysEvaluated",
                meaning: "The matching rate of extracted entities/tokens after mapping to standardized categories via the Umbrellanizer lookup tables. Serves as an informational alignment diagnostic metric."
              }}
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
                : 'The audit must satisfy the target statistical exit thresholds across two consecutive completed batches to freeze the pipeline.'}
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
