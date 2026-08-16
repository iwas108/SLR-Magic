import React from 'react';
import { CheckCircle2, AlertTriangle, HelpCircle, Users, Scale, Clock, ShieldCheck, CheckSquare, Layers } from 'lucide-react';

export interface PoolBlindedStats {
  pool: 'pool_a' | 'pool_b' | 'pool_c' | string;
  title: string;
  stageName: string;
  isCalibrated: boolean;
  message?: string;
  reviewers?: string[];
  total_reviewers?: number;
  total_intersection?: number;
  
  // Agreement statistics
  cohens_kappa?: number;
  weighted_kappa?: number;
  kappa_label?: string;
  raw_agreement_pct?: number;
  expected_agreement_pct?: number;
  kappa_warning?: boolean;
  
  // Decisions breakdown
  agree_include?: number;
  agree_exclude?: number;
  r1_inc_r2_exc?: number;
  r1_exc_r2_inc?: number;
  r1_include_count?: number;
  r2_include_count?: number;
  
  // Pool B precision
  r1_precision?: number;
  r2_precision?: number;
  precision_warning?: boolean;
  
  // Pool C schema metrics
  missing_keys_pct?: number;
  type_match_pct?: number;
  
  // Discrepancies & Adjudication resolution
  total_discrepancies?: number;
  resolved_discrepancies?: number;
  pending_discrepancies?: number;
  resolution_pct?: number;
  
  // Passes overall evaluation criteria
  passes?: boolean;
}

interface BlindedAdjudicationPanelProps {
  stats: {
    pools?: {
      pool_a?: PoolBlindedStats;
      pool_b?: PoolBlindedStats;
      pool_c?: PoolBlindedStats;
    };
    pool_a?: PoolBlindedStats;
    pool_b?: PoolBlindedStats;
    pool_c?: PoolBlindedStats;
    poolList?: PoolBlindedStats[];
  } | PoolBlindedStats[] | null;
  loading?: boolean;
}

export default function BlindedAdjudicationPanel({ stats, loading }: BlindedAdjudicationPanelProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map(idx => (
          <div key={idx} className="bg-card border border-border p-4 rounded-xl space-y-4 h-56">
            <div className="h-4 bg-secondary rounded w-2/3" />
            <div className="h-8 bg-secondary rounded w-1/3" />
            <div className="space-y-2">
              <div className="h-3 bg-secondary rounded" />
              <div className="h-3 bg-secondary rounded w-5/6" />
              <div className="h-3 bg-secondary rounded w-4/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Normalize stats into array of 3 pools
  const getNormalizedPools = (): PoolBlindedStats[] => {
    if (!stats) return [];
    if (Array.isArray(stats)) return stats;
    if (stats.poolList && Array.isArray(stats.poolList) && stats.poolList.length > 0) {
      return stats.poolList;
    }
    const poolSource = stats.pools || stats;
    const poolA = poolSource.pool_a || {
      pool: 'pool_a',
      title: 'Pool A (Fast Filter)',
      stageName: 'Stage 1: Fast Filter',
      isCalibrated: false,
      total_reviewers: 0,
      total_intersection: 0
    };
    const poolB = poolSource.pool_b || {
      pool: 'pool_b',
      title: 'Pool B (Gatekeeper)',
      stageName: 'Stage 2: Gatekeeper',
      isCalibrated: false,
      total_reviewers: 0,
      total_intersection: 0
    };
    const poolC = poolSource.pool_c || {
      pool: 'pool_c',
      title: 'Pool C (Scientist & Miner)',
      stageName: 'Stage 3 & 4: QA & Miner',
      isCalibrated: false,
      total_reviewers: 0,
      total_intersection: 0
    };
    return [poolA, poolB, poolC] as PoolBlindedStats[];
  };

  const poolList = getNormalizedPools();

  if (poolList.length === 0) {
    return (
      <div className="bg-card border border-border p-6 rounded-xl text-center text-muted-foreground text-xs">
        No blinded review or adjudication data available. Upload reviewer decisions in the Inter-Rater Dashboard.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
      {poolList.map((stat) => {
        const poolKey = stat.pool || 'pool_a';
        const isPoolA = poolKey === 'pool_a';
        const isPoolB = poolKey === 'pool_b';
        const isPoolC = poolKey === 'pool_c';

        const isAwaiting = !stat.isCalibrated || (stat.total_reviewers || 0) < 2;
        const totalDisc = stat.total_discrepancies ?? 0;
        const resolvedDisc = stat.resolved_discrepancies ?? 0;
        const pendingDisc = stat.pending_discrepancies ?? (totalDisc - resolvedDisc);
        const resPct = stat.resolution_pct ?? (totalDisc > 0 ? Math.round((resolvedDisc / totalDisc) * 100) : 100);
        const hasPending = pendingDisc > 0;

        return (
          <div
            key={stat.pool}
            className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between shadow-xs relative group transition-all duration-200 hover:border-border/80"
          >
            <div className="space-y-3">
              {/* Header & Status Badge */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
                      {stat.title || (isPoolA ? 'Pool A (Fast Filter)' : isPoolB ? 'Pool B (Gatekeeper)' : 'Pool C (Scientist & Miner)')}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-foreground mt-0.5 block">
                    {stat.stageName || (isPoolA ? 'Stage 1: Fast Filter' : isPoolB ? 'Stage 2: Gatekeeper' : 'Stage 3 & 4: QA & Miner')}
                  </span>
                </div>

                {isAwaiting ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border shrink-0">
                    <Clock className="w-3 h-3" /> AWAITING 2ND
                  </span>
                ) : hasPending ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                    <AlertTriangle className="w-3 h-3" /> {pendingDisc} PENDING
                  </span>
                ) : stat.passes ? (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> CALIBRATED
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 shrink-0">
                    <ShieldCheck className="w-3 h-3" /> RESOLVED
                  </span>
                )}
              </div>

              {/* Rater & Intersection Context */}
              <div className="flex items-center justify-between text-[10px] bg-secondary/35 px-2.5 py-1.5 rounded-lg border border-border/50">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3 h-3 text-muted-foreground/70" />
                  <span>
                    {stat.total_reviewers && stat.total_reviewers >= 2
                      ? `${stat.reviewers?.[0] || 'Alpha'} & ${stat.reviewers?.[1] || 'Beta'}`
                      : `${stat.total_reviewers || 0}/2 Reviewers`}
                  </span>
                </div>
                <div className="font-mono font-semibold text-foreground">
                  {stat.total_intersection ?? 0} paired papers
                </div>
              </div>

              {/* Core Agreement Metrics with Tooltips */}
              <div className="space-y-1.5 pt-0.5">
                {isPoolA && (
                  <>
                    {/* Cohen's Kappa */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Cohen&apos;s Kappa (&kappa;):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">
                          {(stat.cohens_kappa ?? 0).toFixed(3)}
                        </span>
                        {stat.kappa_label && stat.kappa_label !== 'N/A' && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                            (stat.cohens_kappa ?? 0) >= 0.8
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : (stat.cohens_kappa ?? 0) >= 0.6
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}>
                            {stat.kappa_label}
                          </span>
                        )}
                      </div>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Cohen&apos;s Kappa (&kappa;) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> &kappa; = (P<sub>o</sub> - P<sub>e</sub>) / (1 - P<sub>e</sub>)</p>
                        <p><strong>Scientific Meaning:</strong> Evaluates inter-rater agreement on title/abstract screening decisions while strictly accounting for chance concordance. A target of &ge; 0.80 demonstrates robust double-blind human consensus before calibrating automated prompts.</p>
                      </div>
                    </div>

                    {/* Observed Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Observed Agreement:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.raw_agreement_pct ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Observed Agreement (P<sub>o</sub>) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> (Agreed<sub>INC</sub> + Agreed<sub>EXC</sub>) / N<sub>Total</sub></p>
                        <p><strong>Scientific Meaning:</strong> The empirical proportion of candidate papers where both blinded reviewers made the identical inclusion or exclusion decision.</p>
                      </div>
                    </div>

                    {/* Expected Chance Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Expected Chance (P<sub>e</sub>):
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.expected_agreement_pct ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Expected Agreement (P<sub>e</sub>) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> (P<sub>1,inc</sub> &times; P<sub>2,inc</sub>) + (P<sub>1,exc</sub> &times; P<sub>2,exc</sub>)</p>
                        <p><strong>Scientific Meaning:</strong> The hypothetical agreement probability that would occur purely by random chance given each reviewer&apos;s baseline marginal inclusion frequency.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 italic">
                      Target: &kappa; &ge; 0.80, 100% Adjudication Resolution
                    </div>
                  </>
                )}

                {isPoolB && (
                  <>
                    {/* Cohen's Kappa */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Cohen&apos;s Kappa (&kappa;):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">
                          {(stat.cohens_kappa ?? 0).toFixed(3)}
                        </span>
                        {stat.kappa_label && stat.kappa_label !== 'N/A' && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                            (stat.cohens_kappa ?? 0) >= 0.8
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : (stat.cohens_kappa ?? 0) >= 0.6
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}>
                            {stat.kappa_label}
                          </span>
                        )}
                      </div>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Gatekeeper Kappa (&kappa;) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Full-text inter-rater Cohen&apos;s Kappa</p>
                        <p><strong>Scientific Meaning:</strong> Measures blinded agreement on full-text study eligibility criteria (EC-1 through EC-5). Ensures methodological alignment before AI screening calibration.</p>
                      </div>
                    </div>

                    {/* Observed Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Observed Agreement:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.raw_agreement_pct ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-64 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Observed Agreement (P<sub>o</sub>) Tooltip</p>
                        <p><strong>Scientific Meaning:</strong> Percentage of full-text papers where both reviewers agreed on inclusion or the exact exclusion criteria code.</p>
                      </div>
                    </div>

                    {/* Methodological Precision */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Precision (&alpha; / &beta;):
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.r1_precision ?? 0).toFixed(1)}% / {(stat.r2_precision ?? 0).toFixed(1)}%
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Methodological Precision Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Agreed<sub>INC</sub> / Total<sub>Rater,INC</sub></p>
                        <p><strong>Scientific Meaning:</strong> Rater-specific inclusion precision. Confirms that neither human reviewer was overly inclusive or suffered concept conflation on ambiguous borderline papers (Target &ge; 85%).</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 italic">
                      Target: &kappa; &ge; 0.80, Precision &ge; 85%, 100% Resolved
                    </div>
                  </>
                )}

                {isPoolC && (
                  <>
                    {/* Weighted Kappa */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Weighted Kappa (&kappa;<sub>w</sub>):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">
                          {(stat.weighted_kappa ?? 0).toFixed(3)}
                        </span>
                        {stat.kappa_label && stat.kappa_label !== 'N/A' && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                            (stat.weighted_kappa ?? 0) >= 0.81
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : (stat.weighted_kappa ?? 0) >= 0.65
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}>
                            {stat.kappa_label}
                          </span>
                        )}
                      </div>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Weighted Cohen&apos;s Kappa (&kappa;<sub>w</sub>) Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Linear Weighted Kappa across ordinal scale [0.0, 0.5, 1.0]</p>
                        <p><strong>Scientific Meaning:</strong> Assesses ordinal agreement across QA quality appraisal criteria. Critical misses (0.0 vs 1.0) are penalized twice as heavily as minor step variances (0.0 vs 0.5). Target &ge; 0.65 (Substantial).</p>
                      </div>
                    </div>

                    {/* Dual-Gate Cutoff Agreement */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Dual-Gate Concordance:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {stat.agree_include ?? 0} INC / {stat.agree_exclude ?? 0} EXC
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Dual-Gate Quality Cutoff Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Dual-gate decision concordance</p>
                        <p><strong>Scientific Meaning:</strong> Demonstrates agreement between reviewers on overall study quality synthesis combining Fatal Flaw gates (score 0 = fatal exclude) and Cumulative score (&ge; 4.5/8.0).</p>
                      </div>
                    </div>

                    {/* Miner Schema Exactness */}
                    <div className="flex justify-between items-center text-[11px] relative group/tooltip cursor-help">
                      <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40">
                        Miner Schema Match:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {(stat.type_match_pct ?? 100).toFixed(0)}% Type / {(stat.missing_keys_pct ?? 0).toFixed(0)}% Miss
                      </span>
                      <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                        <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Miner Schema Exactness Tooltip</p>
                        <p className="mb-1"><strong>Statistic:</strong> Type match % &amp; Missing keys %</p>
                        <p><strong>Scientific Meaning:</strong> Verifies that both reviewers extracted all required entity keys (RQ-1 to RQ-9) in the exact expected schema data types without missing fields.</p>
                      </div>
                    </div>

                    <div className="text-[8px] text-muted-foreground/80 italic">
                      Target: &kappa;<sub>w</sub> &ge; 0.65, 0% Missing Keys, 100% Resolved
                    </div>
                  </>
                )}
              </div>

              {/* Decision Concordance Mini Breakdown */}
              <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-center border-t border-border/60 pt-2">
                <div className="bg-secondary/40 rounded p-1">
                  <span className="text-muted-foreground block scale-90">Agreed INC</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {stat.agree_include ?? 0}
                  </span>
                </div>
                <div className="bg-secondary/40 rounded p-1">
                  <span className="text-muted-foreground block scale-90">Agreed EXC</span>
                  <span className="font-bold text-foreground">
                    {stat.agree_exclude ?? 0}
                  </span>
                </div>
                <div className="bg-secondary/40 rounded p-1">
                  <span className="text-muted-foreground block scale-90">Conflicts</span>
                  <span className={`font-bold ${totalDisc > 0 ? 'text-amber-500' : 'text-foreground'}`}>
                    {totalDisc}
                  </span>
                </div>
              </div>

              {/* Adjudication Progress Bar & Tooltip */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] relative group/tooltip cursor-help">
                  <span className="text-muted-foreground border-b border-dotted border-muted-foreground/40 font-medium">
                    Adjudication:
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {resolvedDisc} / {totalDisc} resolved ({resPct}%)
                  </span>
                  <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-20 w-68 p-2.5 bg-popover border border-border rounded-lg shadow-xl text-left text-[9px] text-popover-foreground pointer-events-none">
                    <p className="font-extrabold text-[10px] border-b border-border pb-0.5 mb-1 text-primary">Discrepancy Adjudication Tooltip</p>
                    <p className="mb-1"><strong>Statistic:</strong> Resolved / Total Conflicts &times; 100%</p>
                    <p><strong>Scientific Meaning:</strong> Every discrepancy between reviewers must be formally adjudicated with an explicit rationale and committed to the ledger to establish the unassailable Gold Standard benchmark.</p>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      resPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${resPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="text-[9px] text-muted-foreground/75 mt-3 border-t border-border/40 pt-1.5 flex justify-between font-medium">
              <span>Conflicts: {totalDisc}</span>
              <span className={pendingDisc === 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                {pendingDisc === 0 ? 'All Resolved' : `${pendingDisc} Pending Arbitration`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
