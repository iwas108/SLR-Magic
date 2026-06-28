import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface AgreementMetricsPanelProps {
  activePoolTab: 'pool_a' | 'pool_b' | 'pool_c';
  stats: {
    isCalibrated: boolean;
    cohens_kappa?: number;
    weighted_kappa?: number;
    kappa_label?: string;
    total_intersection?: number;
    kappa_warning?: boolean;
    agree_include?: number;
    agree_exclude?: number;
    r1_include_count?: number;
    r2_include_count?: number;
    raw_agreement_pct?: number;
    expected_agreement_pct?: number;
    missing_keys_pct?: number;
    type_match_pct?: number;
    r1_precision?: number;
    r2_precision?: number;
    precision_warning?: boolean;
    r1_inc_r2_exc?: number;
    r1_exc_r2_inc?: number;
  };
}

export default function AgreementMetricsPanel({ activePoolTab, stats }: AgreementMetricsPanelProps) {
  if (!stats || !stats.isCalibrated) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Scorecard 1: Reliability / Cohen's Kappa */}
      {activePoolTab === 'pool_c' ? (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Weighted Kappa (QA Rules)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-4xl font-extrabold text-foreground tracking-tight">{stats.weighted_kappa}</h3>
              <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${(stats.weighted_kappa || 0) >= 0.81
                ? 'bg-green-500/15 text-green-600'
                : (stats.weighted_kappa || 0) >= 0.65
                  ? 'bg-blue-500/15 text-blue-600'
                  : 'bg-amber-500/15 text-amber-600'
              }`}>
                {stats.kappa_label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Measures ordinal agreement on the scale of [0.0, 0.5, 1.0] across all QA ratings. Target is &gt;= 0.65.
            </p>
          </div>
          {stats.kappa_warning && (
            <div className="bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-bold">Low Ordinal Agreement</span>
                <p className="mt-0.5">Weighted Kappa is below 0.65. Check ordinal QA scoring differences.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Inter-Rater Reliability</span>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-4xl font-extrabold text-foreground tracking-tight">{stats.cohens_kappa}</h3>
              <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${(stats.cohens_kappa || 0) >= 0.8
                ? 'bg-green-500/15 text-green-600'
                : (stats.cohens_kappa || 0) >= 0.6
                  ? 'bg-blue-500/15 text-blue-600'
                  : 'bg-amber-500/15 text-amber-600'
              }`}>
                {stats.kappa_label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Calculated over the paired intersection of <strong className="text-foreground">{stats.total_intersection}</strong> papers reviewed by both raters.
            </p>
          </div>
          {stats.kappa_warning && (
            <div className="bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-xl flex gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-bold">Low Agreement Threshold</span>
                <p className="mt-0.5">Cohen's Kappa is below 0.80. Align on calibration discrepancies before starting bulk reviews.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scorecard 2: Agreement Rates / Gates */}
      {activePoolTab === 'pool_c' ? (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dual-Gate Quality Cutoff</span>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Agreed Include</span>
                <h4 className="text-2xl font-bold text-green-600 mt-1">{stats.agree_include} <span className="text-xs text-muted-foreground">papers</span></h4>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Agreed Exclude</span>
                <h4 className="text-2xl font-bold text-red-650 mt-1">{stats.agree_exclude} <span className="text-xs text-muted-foreground">papers</span></h4>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground pt-4 border-t border-border mt-4">
            Reviewer Alpha Included: {stats.r1_include_count} | Reviewer Beta Included: {stats.r2_include_count}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Agreement Rates</span>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Observed Agreement</span>
                <h4 className="text-2xl font-bold text-foreground mt-1">{stats.raw_agreement_pct}%</h4>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Expected (By Chance)</span>
                <h4 className="text-2xl font-bold text-foreground mt-1">{stats.expected_agreement_pct}%</h4>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground pt-4 border-t border-border mt-4">
            Intersection sets isolate papers evaluated by both raters, ensuring unbiased score denominator.
          </div>
        </div>
      )}

      {/* Scorecard 3: Confusion Matrix / Precision / Schema Exactness */}
      {activePoolTab === 'pool_c' ? (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Miner Schema Exactness</span>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Missing Keys</span>
                <h4 className={`text-2xl font-bold mt-1 ${stats.missing_keys_pct && stats.missing_keys_pct > 0 ? 'text-amber-500 font-extrabold' : 'text-foreground'}`}>
                  {stats.missing_keys_pct}%
                </h4>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Type Match</span>
                <h4 className={`text-2xl font-bold mt-1 ${stats.type_match_pct && stats.type_match_pct < 100 ? 'text-amber-500 font-extrabold' : 'text-foreground'}`}>
                  {stats.type_match_pct}%
                </h4>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground pt-4 border-t border-border mt-4">
            Target: 0% Missing Keys, 100% Type Match (Strings).
          </div>
        </div>
      ) : activePoolTab === 'pool_b' ? (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Methodological Precision</span>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground text-blue-600 block">Alpha Precision</span>
                <h4 className="text-2xl font-bold text-foreground mt-1">{stats.r1_precision}%</h4>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground text-emerald-600 block">Beta Precision</span>
                <h4 className="text-2xl font-bold text-foreground mt-1">{stats.r2_precision}%</h4>
              </div>
            </div>
          </div>
          {stats.precision_warning && (
            <div className="bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl flex gap-2 text-[10px] mt-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Precision is below target (&gt;= 85%). Verify concept conflations.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">Confusion Matrix</span>

          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
            <div className="col-span-1"></div>
            <div className="font-bold text-muted-foreground pb-1">Beta INC</div>
            <div className="font-bold text-muted-foreground pb-1">Beta EXC</div>

            <div className="font-bold text-muted-foreground text-left self-center">Alpha INC</div>
            <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 p-2.5 rounded-xl font-bold">
              {stats.agree_include}
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl font-medium">
              {stats.r1_inc_r2_exc}
            </div>

            <div className="font-bold text-muted-foreground text-left self-center">Alpha EXC</div>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl font-medium">
              {stats.r1_exc_r2_inc}
            </div>
            <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-2.5 rounded-xl font-bold">
              {stats.agree_exclude}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
