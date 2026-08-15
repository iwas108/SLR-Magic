import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';

export function VerticalBarConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    barThickness,
    setBarThickness,
    barBorderRadius,
    setBarBorderRadius,
    barGap,
    setBarGap,
    barSorting,
    setBarSorting,
    barLabelPosition,
    setBarLabelPosition,
    barLabelFormat,
    setBarLabelFormat,
    barBenchmarkLine,
    setBarBenchmarkLine,
    barBenchmarkValue,
    setBarBenchmarkValue,
    barBenchmarkLabel,
    setBarBenchmarkLabel,
    barBenchmarkStyle,
    setBarBenchmarkStyle,
    barBenchmarkColor,
    setBarBenchmarkColor
  } = config;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Bar Sorting Order</label>
          <select
            value={barSorting}
            onChange={(e) => setBarSorting(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="desc">Descending (Highest First)</option>
            <option value="asc">Ascending (Lowest First)</option>
            <option value="none">Alphabetical / Natural</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Bar Width / Thickness ({barThickness}px)</label>
          <input
            type="range"
            min={10}
            max={60}
            value={barThickness}
            onChange={(e) => setBarThickness(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Corner Radius ({barBorderRadius}px)</label>
          <input
            type="range"
            min={0}
            max={16}
            value={barBorderRadius}
            onChange={(e) => setBarBorderRadius(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Data Label Format</label>
          <select
            value={barLabelFormat}
            onChange={(e) => setBarLabelFormat(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
            <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
            <option value="percent_ratio">Coarse % + Ratio (~P%, n = x/N)</option>
            <option value="ratio_only">Ratio Only (n = x/N)</option>
            <option value="count_percent">Count + Coarse % (n = x, ~P%)</option>
            <option value="percent_only">Percentage Only (~P%)</option>
            <option value="count_only">Count Only (n = x)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Bar Spacing Gap ({barGap}%)</label>
          <input
            type="range"
            min={5}
            max={50}
            value={barGap}
            onChange={(e) => setBarGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Distance to Label ({config.barLabelDistance ?? 5}px)</label>
          <input
            type="range"
            min={-15}
            max={30}
            value={config.barLabelDistance ?? 5}
            onChange={(e) => config.setBarLabelDistance(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

export function StackedBarConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    barThickness,
    setBarThickness,
    barBorderRadius,
    setBarBorderRadius,
    barGap,
    setBarGap
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Stack Column Width ({barThickness}px)</label>
          <input
            type="range"
            min={12}
            max={60}
            value={barThickness}
            onChange={(e) => setBarThickness(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Corner Radius ({barBorderRadius}px)</label>
          <input
            type="range"
            min={0}
            max={12}
            value={barBorderRadius}
            onChange={(e) => setBarBorderRadius(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Inter-Column Gap ({barGap}%)</label>
          <input
            type="range"
            min={5}
            max={50}
            value={barGap}
            onChange={(e) => setBarGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

export function LineConfigPanel() {
  const { config } = useVisualizerContext();
  const { smoothLine, setSmoothLine } = config;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-xl border border-border/40">
        <div>
          <span className="text-xs font-bold text-foreground block">Smooth Spline Interpolation</span>
          <span className="text-[10px] text-muted-foreground block">Applies cubic Bézier curve for publication temporal trend plots</span>
        </div>
        <input
          type="checkbox"
          checked={smoothLine}
          onChange={(e) => setSmoothLine(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary"
        />
      </div>
    </div>
  );
}

export function RadarConfigPanel() {
  const { config } = useVisualizerContext();
  return (
    <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/40 space-y-1">
      <span className="text-xs font-bold text-foreground block">Radar / Spider QA Assessment</span>
      <p className="text-[10px] text-muted-foreground">
        Scores are normalized across QA criteria (QA1 to QA8) from 0.0 to 1.0. Category polygons display average score distributions.
      </p>
    </div>
  );
}

export function FunnelConfigPanel() {
  const { config } = useVisualizerContext();
  return (
    <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/40 space-y-1">
      <span className="text-xs font-bold text-foreground block">Screening Yield & Attrition</span>
      <p className="text-[10px] text-muted-foreground">
        Visualizes sequential volume reduction across review phases with descending stage sorting.
      </p>
    </div>
  );
}

export function HeatmapConfigPanel() {
  const { config } = useVisualizerContext();
  return (
    <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/40 space-y-1">
      <span className="text-xs font-bold text-foreground block">Co-Occurrence Matrix Matrix Density</span>
      <p className="text-[10px] text-muted-foreground">
        Calculates cross-tabulation intersection counts between primary and secondary extraction fields with continuous color gradients.
      </p>
    </div>
  );
}

export function ScatterBubbleConfigPanel() {
  const { config } = useVisualizerContext();
  const { bubbleScale, setBubbleScale } = config;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground block">Marker Size Multiplier ({bubbleScale}x)</label>
        <input
          type="range"
          min={0.5}
          max={3.0}
          step={0.1}
          value={bubbleScale}
          onChange={(e) => setBubbleScale(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>0.5x (Dense)</span>
          <span>1.2x (Standard)</span>
          <span>3.0x (Prominent)</span>
        </div>
      </div>
    </div>
  );
}

export function GaugeConfigPanel() {
  const { config } = useVisualizerContext();
  const { gaugeMaxScale, setGaugeMaxScale } = config;

  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-foreground block">Target Scale Dial Maximum ({gaugeMaxScale})</label>
      <input
        type="number"
        min={10}
        max={1000}
        value={gaugeMaxScale}
        onChange={(e) => setGaugeMaxScale(Math.max(1, Number(e.target.value)))}
        className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
      />
    </div>
  );
}

export function TreemapConfigPanel() {
  return (
    <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/40 space-y-1">
      <span className="text-xs font-bold text-foreground block">Hierarchical Treemap Partitioning</span>
      <p className="text-[10px] text-muted-foreground">
        Renders nested rectangular bounding boxes proportional to study frequencies across extraction hierarchy levels.
      </p>
    </div>
  );
}

export function GraphConfigPanel() {
  return (
    <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/40 space-y-1">
      <span className="text-xs font-bold text-foreground block">Force-Directed Relationship Network</span>
      <p className="text-[10px] text-muted-foreground">
        Interactive physics-based force layout displaying co-occurrence links between categorical extraction entities.
      </p>
    </div>
  );
}

export function CalendarConfigPanel() {
  return (
    <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/40 space-y-1">
      <span className="text-xs font-bold text-foreground block">Annual Activity Matrix</span>
      <p className="text-[10px] text-muted-foreground">
        Maps review ingestion and publication throughput over calendar date grids.
      </p>
    </div>
  );
}

export function BoxplotConfigPanel() {
  return (
    <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/40 space-y-1">
      <span className="text-xs font-bold text-foreground block">Statistical Quartile Dispersion (5-Number Summary)</span>
      <p className="text-[10px] text-muted-foreground">
        Plots Minimum, Q1 (25th percentile), Median (50th percentile), Q3 (75th percentile), and Maximum across categories.
      </p>
    </div>
  );
}
