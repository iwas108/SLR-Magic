import React from 'react';
import { 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Edit3, 
  Info 
} from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CrossTabMatrixPanel } from './CrossTabMatrixPanel';
import { formatPercentage, formatRatio } from '../../utils/formatterUtils';

export function BreakdownTablePanel() {
  const { config, style, data } = useVisualizerContext();
  const { chartType, metricMode } = config;
  const {
    realDataBreakdown,
    enableManualOverrides,
    setEnableManualOverrides,
    manualCategoryValues,
    setManualCategoryValues,
    normalizePercentages,
    revertToRealData
  } = data;

  if (['clustered_bar', 'stacked_bar'].includes(chartType)) {
    return (
      <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-3">
        <CrossTabMatrixPanel />
      </div>
    );
  }

  const isTagShareMode = metricMode === 'tag_share';
  const isBalanced = Math.abs(realDataBreakdown.activeSum - 100) < 0.05;

  return (
    <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Cohort Data Breakdown & Percentage Validation</span>
          {realDataBreakdown.isMultiLabel && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1">
              <Info className="w-3 h-3" /> Multi-label Field ({realDataBreakdown.totalItems} tags across {realDataBreakdown.totalCohortPapers} papers)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Validation / Mode Badge */}
          {isTagShareMode ? (
            <div className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 ${
              isBalanced
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
            }`}>
              {isBalanced ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
              Tag Share Sum: {formatPercentage(realDataBreakdown.activeSum, style.decimalPrecision, style.useTildeForCoarse)} {!isBalanced && '(!= 100%)'}
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-secondary border border-border text-muted-foreground flex items-center gap-1.5">
              <span>Mode: <strong className="text-foreground">{metricMode === 'paper_prevalence' ? 'Paper Prevalence (%)' : 'Paper Count (N)'}</strong></span>
            </div>
          )}

          {/* Actions */}
          {enableManualOverrides && (
            <button
              onClick={normalizePercentages}
              className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              title="Rescale values proportionately to sum to 100.00%"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Normalize to 100%
            </button>
          )}

          {enableManualOverrides ? (
            <button
              onClick={revertToRealData}
              className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              title="Revert all manual edits back to calculated cohort real data"
            >
              <RotateCcw className="w-3 h-3" />
              Revert to Real Data
            </button>
          ) : (
            <button
              onClick={() => setEnableManualOverrides(true)}
              className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3 text-primary" />
              Unlock Manual Edit
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-60 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 text-[11px] font-bold text-muted-foreground">
              <th className="py-1.5 px-2">Category / Group Name</th>
              <th className="py-1.5 px-2 text-right">Unique Papers (N)</th>
              <th className="py-1.5 px-2 text-right">Paper Prev. %</th>
              <th className="py-1.5 px-2 text-right">Tag Occurrences</th>
              <th className="py-1.5 px-2 text-right">Tag Share %</th>
              <th className="py-1.5 px-2 text-right">Active Chart Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {realDataBreakdown.rows.map((row, rowIdx) => (
              <tr key={`${row.parentName ? `${row.parentName}_` : ''}${row.name}_${rowIdx}`} className="hover:bg-secondary/40">
                <td className="py-1.5 px-2 font-bold text-foreground">
                  {row.parentName && <span className="text-muted-foreground font-normal text-[10px] mr-1">└ {row.parentName} →</span>}
                  {row.name}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                  {formatRatio(row.paperCount, realDataBreakdown.totalCohortPapers, style.ratioStyle)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                  {formatPercentage(row.paperPrevalencePct, style.decimalPrecision, style.useTildeForCoarse)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{row.tagCount}</td>
                <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">
                  {formatPercentage(row.tagSharePct, style.decimalPrecision, style.useTildeForCoarse)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-bold text-foreground">
                  {enableManualOverrides ? (
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={100}
                      value={manualCategoryValues[row.name] ?? row.realPct}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setManualCategoryValues((prev: Record<string, number>) => ({ ...prev, [row.name]: val }));
                      }}
                      className="w-24 bg-card border border-border rounded px-2 py-0.5 text-xs font-mono font-bold text-foreground text-right focus:outline-none focus:border-primary"
                    />
                  ) : (
                    <span>
                      {metricMode === 'count' 
                        ? formatRatio(row.count, realDataBreakdown.totalCohortPapers, style.ratioStyle) 
                        : formatPercentage(row.activeVal, style.decimalPrecision, style.useTildeForCoarse)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
