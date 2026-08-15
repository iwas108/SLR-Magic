import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';

export function ScientificAxisConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    primaryField,
    secondaryField,
    metricMode,
    barOrientation = 'horizontal',
    axisScaleType = 'linear',
    setAxisScaleType,
    axisTickDirection = 'outside',
    setAxisTickDirection,
    showAxisBaseline = true,
    setShowAxisBaseline,
    customAxisTitleX = '',
    setCustomAxisTitleX,
    customAxisTitleY = '',
    setCustomAxisTitleY
  } = config;

  const isHorizontal = barOrientation === 'horizontal';

  const defaultMetricTitle = metricMode === 'paper_prevalence'
    ? 'Prevalence (% of Cohort)'
    : metricMode === 'tag_share'
    ? 'Tag Share (%)'
    : metricMode === 'avg_qa'
    ? 'Average QA Score (%)'
    : metricMode === 'avg_citation'
    ? 'Average Citation Count'
    : 'Study Count (N)';

  const autoTitleX = isHorizontal ? defaultMetricTitle : primaryField;
  const autoTitleY = isHorizontal ? primaryField : defaultMetricTitle;

  return (
    <div className="p-3.5 bg-secondary/30 border border-border/70 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          Scientific Axis & Publishing Gridlines
        </label>
        <span className="text-[10px] uppercase font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border">
          {isHorizontal ? 'Horizontal Layout' : 'Vertical Layout'}
        </span>
      </div>

      {/* Axis Titles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground block">
            X-Axis Label / Title
          </label>
          <input
            type="text"
            value={customAxisTitleX}
            onChange={(e) => setCustomAxisTitleX(e.target.value)}
            placeholder={`Auto: ${autoTitleX}`}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground block">
            Y-Axis Label / Title
          </label>
          <input
            type="text"
            value={customAxisTitleY}
            onChange={(e) => setCustomAxisTitleY(e.target.value)}
            placeholder={`Auto: ${autoTitleY}`}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Scientific Ticks & Scale */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground block">Tick Marks</label>
          <select
            value={axisTickDirection}
            onChange={(e) => setAxisTickDirection(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="outside">Outward (Journal Standard)</option>
            <option value="inside">Inward (Compact)</option>
            <option value="none">None (Borderless)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-muted-foreground block">Value Axis Scale</label>
          <select
            value={axisScaleType}
            onChange={(e) => setAxisScaleType(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="linear">Linear Scale (Standard)</option>
            <option value="log">Logarithmic Scale (log₁₀)</option>
          </select>
        </div>

        <div className="space-y-1 flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground pb-1">
            <input
              type="checkbox"
              checked={showAxisBaseline}
              onChange={(e) => setShowAxisBaseline(e.target.checked)}
              className="rounded border-border text-primary"
            />
            Show Journal Baseline Border
          </label>
        </div>
      </div>
    </div>
  );
}
