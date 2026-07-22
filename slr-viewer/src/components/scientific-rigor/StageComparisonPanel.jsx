import React from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

export default function StageComparisonPanel({ stageStats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(idx => (
          <div key={idx} className="bg-card border border-border p-4 rounded-xl space-y-4 h-48">
            <div className="h-4 bg-secondary rounded w-2/3" />
            <div className="h-8 bg-secondary rounded w-1/3" />
            <div className="space-y-2">
              <div className="h-3 bg-secondary rounded" />
              <div className="h-3 bg-secondary rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stageStats || stageStats.length === 0) {
    return (
      <div className="bg-card border border-border p-6 rounded-xl text-center text-muted-foreground text-xs">
        No stage comparison statistics available in this snapshot.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      {stageStats.map(stat => {
        return (
          <div key={stat.stage} className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-sm relative group">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">{stat.title}</span>
                  <span className="text-[11px] font-bold text-foreground mt-0.5 block">{stat.stageName}</span>
                </div>
                {stat.evaluated > 0 ? (
                  stat.passes ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                      <AlertTriangle className="w-3.5 h-3.5" /> FAIL
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                    <HelpCircle className="w-3.5 h-3.5" /> NO DATA
                  </span>
                )}
              </div>

              <div>
                {stat.stage === 1 && (
                  <div className="space-y-1">
                    {/* Recall */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Recall:</span>
                      <span className="font-mono font-bold">{((stat.recall || 0) * 100).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Recall Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> TP / (TP + FN)</p>
                        <p><strong>Scientific Meaning:</strong> The percentage of relevant papers successfully passed through the initial heuristic metadata screen. A 100% target ensures zero 'False Negatives' (no valid papers prematurely excluded).</p>
                      </div>
                    </div>

                    {/* F1 Score */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">F1 Score:</span>
                      <span className="font-mono font-bold">{((stat.f1 || 0) * 100).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">F1 Score Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Harmonic mean of Precision and Recall</p>
                        <p><strong>Scientific Meaning:</strong> Measures the overall balance of the fast filter. A high score proves the pipeline successfully maximizes inclusion without drowning downstream stages in irrelevant 'False Positive' noise.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 mt-1 italic">
                      Target: Recall = 100%, F1 &gt;= 85%
                    </div>
                  </div>
                )}

                {stat.stage === 2 && (
                  <div className="space-y-1">
                    {/* Precision */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Precision:</span>
                      <span className="font-mono font-bold">{((stat.precision || 0) * 100).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Precision Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> TP / (TP + FP)</p>
                        <p><strong>Scientific Meaning:</strong> The percentage of papers passed by the screen that genuinely met all inclusion criteria. Protects the final dataset from irrelevant study literature.</p>
                      </div>
                    </div>

                    {/* Recall */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Recall:</span>
                      <span className="font-mono font-bold">{((stat.recall || 0) * 100).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Recall Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> TP / (TP + FN)</p>
                        <p><strong>Scientific Meaning:</strong> Ensures the screening did not accidentally exclude valid papers. Protects against overly aggressive algorithmic pruning.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 mt-1 italic">
                      Target: Precision &gt;= 85%, Recall &gt;= 90%
                    </div>
                  </div>
                )}

                {stat.stage === 3 && (
                  <div className="space-y-1">
                    {/* Weighted Kappa */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Weighted Kappa:</span>
                      <span className="font-mono font-bold">{(stat.weighted_kappa || 0).toFixed(3)}</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Weighted Kappa Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Cohen's Weighted Kappa</p>
                        <p><strong>Scientific Meaning:</strong> Measures inter-rater reliability between the pipeline output and the Gold Standard on the ordinal rubric matrix, adjusting for chance agreement.</p>
                      </div>
                    </div>

                    {/* Raw Agreement */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Raw Agreement:</span>
                      <span className="font-mono font-bold">{(stat.raw_agreement_pct || 0).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Raw Agreement Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Exact Match %</p>
                        <p><strong>Scientific Meaning:</strong> The frequency at which the pipeline generated the exact same ordinal score as the human reviewer.</p>
                      </div>
                    </div>

                    {/* Minor Deviation */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Minor Deviation:</span>
                      <span className="font-mono font-bold">{(stat.minor_deviation_pct || 0).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Minor Deviation Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Score Delta of 0.5</p>
                        <p><strong>Scientific Meaning:</strong> The rate of acceptable subjective variance (e.g., disagreeing on whether a criterion was 'fully' versus 'partially' met).</p>
                      </div>
                    </div>

                    {/* Critical Miss */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Critical Miss:</span>
                      <span className="font-mono font-bold">{(stat.critical_miss_pct || 0).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Critical Miss Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Score Delta of 1.0</p>
                        <p><strong>Scientific Meaning:</strong> The fatal error rate where the evaluator completely misinterpreted a study parameter (e.g., scoring a failed assessment as fully matching). Must remain at 0.0%.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 mt-1 italic">
                      Target: Critical Miss = 0.0%
                    </div>
                  </div>
                )}

                {stat.stage === 4 && (
                  <div className="space-y-1">
                    {/* Schema Integrity */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Schema Integrity:</span>
                      <span className="font-mono font-bold">{(stat.schema_integrity_pct || 0).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Schema Integrity Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Boolean Type/Key Check</p>
                        <p><strong>Scientific Meaning:</strong> Proof that the extraction pipeline successfully structured the unstructured text into programmatic parameters without hallucinating or dropping target database keys.</p>
                      </div>
                    </div>

                    {/* Pre-Normalization Yield */}
                    <div className="flex justify-between text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">Pre-Norm Yield:</span>
                      <span className="font-mono font-bold">{(stat.pre_normalization_yield ?? stat.exact_match_pct ?? 0).toFixed(1)}%</span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Pre-Norm Yield Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Character-level Exact Match %</p>
                        <p><strong>Scientific Meaning:</strong> The baseline text extraction yield before semantic harmonization. Discrepancies here represent acceptable syntactic variance (e.g., 'RF' vs 'Random Forest'), not structure or format failure.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 mt-1 italic">
                      Target: Schema Integrity = 100%
                    </div>
                  </div>
                )}
              </div>

              {stat.evaluated > 0 && stat.stage <= 2 && stat.TP !== undefined && (
                <div className="grid grid-cols-4 gap-1 text-[8px] font-mono text-center border-t border-border/60 pt-2">
                  <div className="bg-secondary/40 rounded p-0.5">
                    <span className="text-muted-foreground block scale-90">TP</span>
                    <span className="font-bold text-foreground">{stat.TP}</span>
                  </div>
                  <div className="bg-secondary/40 rounded p-0.5">
                    <span className="text-muted-foreground block scale-90">TN</span>
                    <span className="font-bold text-foreground">{stat.TN}</span>
                  </div>
                  <div className="bg-secondary/40 rounded p-0.5">
                    <span className="text-muted-foreground block scale-90">FP</span>
                    <span className="font-bold text-foreground">{stat.FP}</span>
                  </div>
                  <div className="bg-secondary/40 rounded p-0.5">
                    <span className="text-muted-foreground block scale-90">FN</span>
                    <span className="font-bold text-foreground">{stat.FN}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-[9px] text-muted-foreground/75 mt-3 border-t border-border/40 pt-1.5 flex justify-between font-medium">
              <span>Evaluated: {stat.evaluated}</span>
              <span>Total Adjudicated: {stat.total || stat.evaluated}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
