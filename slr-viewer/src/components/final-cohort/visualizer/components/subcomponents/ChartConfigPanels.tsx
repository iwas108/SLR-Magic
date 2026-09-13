import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { THEME_PALETTES } from '../../constants/themePalettes';
import { Sparkles, Palette, RotateCcw } from 'lucide-react';

export function VerticalBarConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    metricMode,
    barThickness,
    setBarThickness,
    barBorderRadius,
    setBarBorderRadius,
    barGap,
    setBarGap,
    barSorting,
    setBarSorting,
    showDataLabels,
    setShowDataLabels,
    barLabelPosition = 'top',
    setBarLabelPosition,
    barLabelFormat,
    setBarLabelFormat,
    barLabelDistance = 5,
    setBarLabelDistance,
    barLabelFontSize = 11,
    setBarLabelFontSize,
    barLabelFontWeight = 'bold',
    setBarLabelFontWeight,
    barLabelColor = '',
    setBarLabelColor,
    barLabelRotate = 0,
    setBarLabelRotate,
    labelRotation = 0,
    setLabelRotation,
    barValueCeiling = 'auto',
    setBarValueCeiling,
    barValueInterval = 'auto',
    setBarValueInterval,
    enableErrorBars,
    setEnableErrorBars,
    errorBarType,
    setErrorBarType,
    enableHatchPatterns,
    setEnableHatchPatterns,
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

  const isAvgMetric = metricMode === 'avg_qa' || metricMode === 'avg_citation';

  return (
    <div className="space-y-4">
      {/* 1. Sorting, Column Dimensions & Spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Column Sorting Order</label>
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
          <label className="text-xs font-bold text-foreground block">Column Width ({barThickness}px)</label>
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

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Category Gap ({barGap}%)</label>
          <input
            type="range"
            min={0}
            max={80}
            value={barGap}
            onChange={(e) => setBarGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 2. Value Data Labels & Placement */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDataLabels}
              onChange={(e) => setShowDataLabels(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary"
            />
            <span className="text-xs font-bold text-foreground">
              Enable Data Labels
            </span>
          </label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {barLabelFontSize}px • {barLabelFontWeight} • {barLabelPosition}
          </span>
        </div>

        {showDataLabels && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Position</label>
                <select
                  value={barLabelPosition}
                  onChange={(e) => setBarLabelPosition(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="top">Top (Above Column)</option>
                  <option value="inside">Inside (Center of Column)</option>
                  <option value="insideTop">Inside Top</option>
                  <option value="insideBottom">Inside Base</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Data Label Format</label>
                <select
                  value={barLabelFormat}
                  onChange={(e) => setBarLabelFormat(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <optgroup label="Standard (Follows Chart Metric)">
                    <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
                    <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
                    <option value="percent_ratio">Coarse % + Ratio (~P%, n = x/N)</option>
                    <option value="ratio_only">Ratio Only (n = x/N)</option>
                    <option value="count_percent">Count + Coarse % (n = x, ~P%)</option>
                    <option value="percent_only">Percentage Only (~P%)</option>
                    <option value="count_only">Count Only (n = x)</option>
                  </optgroup>
                  <optgroup label="Explicit Tag Share (Total Extracted Tags Denominator)">
                    <option value="tag_share_ratio_percent">Tag Share Ratio + % (n = x/TotalTags, ~P%)</option>
                    <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + %</option>
                    <option value="tag_share_percent_ratio">Tag Share % + Ratio (~P%, n = x/TotalTags)</option>
                    <option value="tag_share_percent_only">Tag Share % Only (~P%)</option>
                    <option value="tag_share_ratio_only">Tag Share Ratio Only (n = x/TotalTags)</option>
                    <option value="tag_share_count_percent">Tag Count + % (n = x, ~P%)</option>
                  </optgroup>
                  <optgroup label="Explicit Paper Prevalence (Total Cohort Denominator)">
                    <option value="prevalence_ratio_percent">Prevalence Ratio + % (n = x/CohortN, ~P%)</option>
                    <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + %</option>
                    <option value="prevalence_percent_only">Prevalence % Only (~P%)</option>
                    <option value="prevalence_ratio_only">Prevalence Ratio Only (n = x/CohortN)</option>
                  </optgroup>
                  <optgroup label="Dual / Combined Multi-Metric">
                    <option value="dual_prevalence_tag_share">Dual: Prev (n=x/N) | Tags (n=x/Total)</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Typography & Color */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
                  <span>Font Size</span>
                  <span className="text-primary font-mono">{barLabelFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={barLabelFontSize}
                  onChange={(e) => setBarLabelFontSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Font Weight</label>
                <select
                  value={barLabelFontWeight}
                  onChange={(e) => setBarLabelFontWeight(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="normal">Normal (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semi-Bold (600)</option>
                  <option value="bold">Bold (700)</option>
                  <option value="800">Black (800)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Distance ({barLabelDistance}px)</label>
                <input
                  type="range"
                  min={-10}
                  max={25}
                  value={barLabelDistance}
                  onChange={(e) => setBarLabelDistance(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Label Color</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={barLabelColor || '#111827'}
                    onChange={(e) => setBarLabelColor(e.target.value)}
                    className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={barLabelColor}
                    onChange={(e) => setBarLabelColor(e.target.value)}
                    placeholder="Auto Contrast"
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Scales, Ceiling & Category Rotation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">X-Axis Label Rotation</label>
          <select
            value={labelRotation}
            onChange={(e) => setLabelRotation(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value={0}>0° (Horizontal)</option>
            <option value={30}>30° (Slanted)</option>
            <option value={45}>45° (Diagonal)</option>
            <option value={60}>60° (Steep)</option>
            <option value={90}>90° (Vertical)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Grid Step Interval</label>
          <input
            type="text"
            value={barValueInterval}
            onChange={(e) => setBarValueInterval(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) || 'auto'))}
            placeholder="auto or e.g. 10"
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Scale Ceiling Limit</label>
          <input
            type="text"
            value={barValueCeiling}
            onChange={(e) => setBarValueCeiling(e.target.value === 'auto' ? 'auto' : (Number(e.target.value) || 'auto'))}
            placeholder="auto or e.g. 50"
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground font-mono"
          />
        </div>
      </div>

      {/* 4. Target Benchmark Reference Line */}
      <div className="pt-2 border-t border-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={barBenchmarkLine}
              onChange={(e) => setBarBenchmarkLine(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary"
            />
            <span>Enable Target Benchmark Reference Line</span>
          </label>
        </div>

        {barBenchmarkLine && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 bg-secondary/30 rounded-xl border border-border/60">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Target Value</label>
              <input
                type="number"
                value={barBenchmarkValue}
                onChange={(e) => setBarBenchmarkValue(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Line Label</label>
              <input
                type="text"
                value={barBenchmarkLabel}
                onChange={(e) => setBarBenchmarkLabel(e.target.value)}
                placeholder="Target Benchmark"
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Style</label>
              <select
                value={barBenchmarkStyle}
                onChange={(e) => setBarBenchmarkStyle(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              >
                <option value="dashed">Dashed Line</option>
                <option value="solid">Solid Line</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={barBenchmarkColor}
                  onChange={(e) => setBarBenchmarkColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={barBenchmarkColor}
                  onChange={(e) => setBarBenchmarkColor(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-foreground"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Scientific Publishing Accessibility & Error Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
        {/* Texture Hatching for Monochrome Print */}
        <div className="p-3 bg-secondary/30 border border-border/70 rounded-xl space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={enableHatchPatterns}
              onChange={(e) => setEnableHatchPatterns(e.target.checked)}
              className="rounded border-border text-primary"
            />
            Academic Texture Hatching (Print / Grayscale)
          </label>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Applies distinct monochrome SVG patterns (stripes, cross-hatch, stippling) to differentiate columns in black-and-white print.
          </p>
        </div>

        {/* Statistical Error Bars */}
        <div className="p-3 bg-secondary/30 border border-border/70 rounded-xl space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={enableErrorBars}
              disabled={!isAvgMetric}
              onChange={(e) => setEnableErrorBars(e.target.checked)}
              className="rounded border-border text-primary disabled:opacity-50"
            />
            Scientific Error Bars (Variance Indicators)
          </label>
          {isAvgMetric ? (
            <div className="space-y-1">
              <select
                value={errorBarType}
                disabled={!enableErrorBars}
                onChange={(e) => setErrorBarType(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold disabled:opacity-50"
              >
                <option value="std_error">Standard Error (± SE)</option>
                <option value="std_dev">Standard Deviation (± SD)</option>
                <option value="ci_95">95% Confidence Interval (± 1.96 SE)</option>
              </select>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-tight">
              Error bars are active when metric is set to Average QA Score or Average Citation Count.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export { StackedBarConfigPanel } from './StackedBarConfigPanel';

export function LineConfigPanel() {
  const { config, style } = useVisualizerContext();
  const { themePreset } = style;
  const palette = THEME_PALETTES[themePreset] || THEME_PALETTES.ieee_blue;

  const defaultColor1 = palette.colors[0] || '#2E7D32';
  const defaultColor2 = palette.colors[1] || '#00838F';
  const defaultColor3 = palette.colors[2] || palette.text || '#292b2c';

  const {
    showLegend = true,
    setShowLegend,
    legendPosition = 'top',
    setLegendPosition,
    legendDistance = 10,
    setLegendDistance,
    legendItemGap = 14,
    setLegendItemGap,
    legendFontSize,
    setLegendFontSize,
    legendType = 'plain',
    setLegendType,
    legendAlign = 'auto',
    setLegendAlign,
    legendIcon = 'inherit',
    setLegendIcon,
    legendItemWidth = 25,
    setLegendItemWidth,
    legendItemHeight = 14,
    setLegendItemHeight,
    legendFontWeight = 'normal',
    setLegendFontWeight,
    legendTextColor = '',
    setLegendTextColor,
    legendBackgroundColor = 'transparent',
    setLegendBackgroundColor,
    legendBorderColor = 'transparent',
    setLegendBorderColor,
    legendBorderWidth = 0,
    setLegendBorderWidth,
    legendBorderRadius = 4,
    setLegendBorderRadius,
    legendPadding = 5,
    setLegendPadding,
    lineMode = 'cohort_trend',
    setLineMode,
    lineTimeSteps = 96,
    setLineTimeSteps,
    lineTimeStepIntervalName = 'Time Steps k (15-min intervals / 24-h Cycle)',
    setLineTimeStepIntervalName,
    lineYAxisTitle = 'State Uncertainty Tr(P)',
    setLineYAxisTitle,
    lineYMin = 0,
    setLineYMin,
    lineYMax = 4.5,
    setLineYMax,
    lineBaselineA = 0.15,
    setLineBaselineA,
    lineBaselineB = 0.038,
    setLineBaselineB,
    lineBaselineName = 'Static Architecture (24% CNN / 15% Filter Cohort)',
    setLineBaselineName,
    lineBaselineColor = '',
    setLineBaselineColor,
    lineBaselineStyle = 'dashed',
    setLineBaselineStyle,
    lineEstimatorInitial = 0.15,
    setLineEstimatorInitial,
    lineEstimatorDrift = 0.11,
    setLineEstimatorDrift,
    lineEstimatorModulation = 0.05,
    setLineEstimatorModulation,
    lineEstimatorName = 'Discrete Recursive Estimator (Proposed Gated Pipeline)',
    setLineEstimatorName,
    lineEstimatorColor = '',
    setLineEstimatorColor,
    lineEstimatorStyle = 'solid',
    setLineEstimatorStyle,
    lineThresholdValue = 1.0,
    setLineThresholdValue,
    lineThresholdName = 'Semantic Trigger Threshold (ε)',
    setLineThresholdName,
    lineThresholdLabel = 'Threshold ε = 1.00',
    setLineThresholdLabel,
    lineThresholdColor = '',
    setLineThresholdColor,
    lineThresholdStyle = 'dotted',
    setLineThresholdStyle,
    lineThresholdPosition = 'insideEndTop',
    setLineThresholdPosition,
    lineThresholdLineWidth = 1.5,
    setLineThresholdLineWidth,
    lineAxisPointerType = 'cross',
    setLineAxisPointerType,
    lineMarkerSymbol = 'circle',
    setLineMarkerSymbol,
    lineXAxisInterval = 'auto',
    setLineXAxisInterval,
    lineShowGridLines = true,
    setLineShowGridLines,
    lineGridLeft = 60,
    setLineGridLeft,
    lineGridRight = 40,
    setLineGridRight,
    lineGridTop = 65,
    setLineGridTop,
    lineGridBottom = 65,
    setLineGridBottom,
    lineBaselineAreaOpacity = 0,
    setLineBaselineAreaOpacity,
    lineEstimatorAreaOpacity = 8,
    setLineEstimatorAreaOpacity,
    lineBaselineFillMode = 'none',
    setLineBaselineFillMode,
    lineEstimatorFillMode = 'subtle_gradient',
    setLineEstimatorFillMode,
    lineShowTxEvents = true,
    setLineShowTxEvents,
    lineTxEventSymbol = 'triangle',
    setLineTxEventSymbol,
    lineTxEventColor = '',
    setLineTxEventColor,
    lineTxEventSize = 12,
    setLineTxEventSize,
    lineShowTxLabels = true,
    setLineShowTxLabels,
    lineTxEventLabel = 'TX',
    setLineTxEventLabel,
    lineTxEventSeriesName = 'Physical Radio TX Events',
    setLineTxEventSeriesName,
    smoothLine,
    setSmoothLine,
    lineWidth = 2.5,
    setLineWidth,
    showLineMarkers,
    setShowLineMarkers,
    lineMarkerSize = 4,
    setLineMarkerSize,
    lineAreaOpacity = 0,
    setLineAreaOpacity,
    lineStepMode = 'none',
    setLineStepMode,
    showDataLabels,
    setShowDataLabels,
    labelFormat,
    setLabelFormat,
    universalLabelPosition,
    setUniversalLabelPosition,
    universalLabelFontSize,
    setUniversalLabelFontSize,
    universalLabelColor,
    setUniversalLabelColor
  } = config;

  const activeColor1 = (lineBaselineColor && lineBaselineColor.trim() !== '') ? lineBaselineColor : defaultColor1;
  const isColor1Custom = Boolean(lineBaselineColor && lineBaselineColor.trim() !== '');

  const activeColor2 = (lineEstimatorColor && lineEstimatorColor.trim() !== '') ? lineEstimatorColor : defaultColor2;
  const isColor2Custom = Boolean(lineEstimatorColor && lineEstimatorColor.trim() !== '');

  const activeColor3 = (lineThresholdColor && lineThresholdColor.trim() !== '') ? lineThresholdColor : defaultColor3;
  const isColor3Custom = Boolean(lineThresholdColor && lineThresholdColor.trim() !== '');

  const hasAnyCustomColors = isColor1Custom || isColor2Custom || isColor3Custom;

  return (
    <div className="space-y-4">
      {/* Line Chart Paradigm Selector */}
      <div className="p-3 bg-secondary/30 rounded-2xl border border-border/80 space-y-2">
        <span className="text-xs font-black text-foreground block flex items-center justify-between">
          <span>Line Chart Paradigm</span>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">
            {lineMode === 'epistemic_simulation' ? 'Simulation Trajectory' : 'Literature Trend'}
          </span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLineMode('cohort_trend')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left ${
              lineMode !== 'epistemic_simulation'
                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="font-bold">Cohort Trend</div>
            <div className="text-[10px] opacity-75">Empirical Synthesis</div>
          </button>
          <button
            type="button"
            onClick={() => setLineMode('epistemic_simulation')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left ${
              lineMode === 'epistemic_simulation'
                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="font-bold">Epistemic Simulation</div>
            <div className="text-[10px] opacity-75">Uncertainty Trajectory</div>
          </button>
        </div>
      </div>

      {/* Academic Color Palette Integration Bar */}
      <div className="p-3 bg-secondary/30 rounded-2xl border border-border/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary shrink-0" />
          <div>
            <span className="text-xs font-bold text-foreground block">Academic Color Theme Binding</span>
            <span className="text-[10px] text-muted-foreground block">
              Active: <strong className="text-primary capitalize">{themePreset.replace(/_/g, ' ')}</strong>
            </span>
          </div>
        </div>
        {hasAnyCustomColors ? (
          <button
            type="button"
            onClick={() => {
              setLineBaselineColor('');
              setLineEstimatorColor('');
              setLineThresholdColor('');
              setLineTxEventColor('');
            }}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors"
            title="Reset custom colors to automatically follow the selected Academic Color Palette"
          >
            <RotateCcw className="w-3 h-3" />
            Sync with Palette
          </button>
        ) : (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            ✓ Bound to Academic Palette
          </span>
        )}
      </div>

      {lineMode === 'epistemic_simulation' ? (
        <>
          {/* Section: Curve 1 - Exponential Baseline */}
          <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground block flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColor1 }} />
                <span>Static Architecture Baseline (Exponential Drift)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">y(k) = A · e^(B·k)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Baseline Series Legend Title</label>
                <input
                  type="text"
                  value={lineBaselineName}
                  onChange={(e) => setLineBaselineName(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Initial Uncertainty A ({lineBaselineA})</label>
                <input
                  type="range"
                  min={0.05}
                  max={0.50}
                  step={0.01}
                  value={lineBaselineA}
                  onChange={(e) => setLineBaselineA(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Exponential Drift Rate B ({lineBaselineB})</label>
                <input
                  type="range"
                  min={0.01}
                  max={0.08}
                  step={0.002}
                  value={lineBaselineB}
                  onChange={(e) => setLineBaselineB(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-muted-foreground block">Curve Color</label>
                  {isColor1Custom && (
                    <button
                      type="button"
                      onClick={() => setLineBaselineColor('')}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Use Palette Color
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeColor1}
                    onChange={(e) => setLineBaselineColor(e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={lineBaselineColor || `Auto (${defaultColor1})`}
                    onChange={(e) => setLineBaselineColor(e.target.value)}
                    placeholder={defaultColor1}
                    className="flex-1 bg-card border border-border rounded-xl px-2 py-1 text-xs text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Line Style</label>
                <select
                  value={lineBaselineStyle}
                  onChange={(e) => setLineBaselineStyle(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="dashed">Dashed Line (---)</option>
                  <option value="solid">Solid Line (—)</option>
                  <option value="dotted">Dotted Line (···)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Curve 2 - Discrete Recursive Estimator */}
          <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground block flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColor2 }} />
                <span>Discrete Recursive Estimator (Proposed Gated Pipeline)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Reset at ε</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Estimator Series Legend Title</label>
                <input
                  type="text"
                  value={lineEstimatorName}
                  onChange={(e) => setLineEstimatorName(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Initial P0 ({lineEstimatorInitial})</label>
                <input
                  type="range"
                  min={0.05}
                  max={0.50}
                  step={0.01}
                  value={lineEstimatorInitial}
                  onChange={(e) => setLineEstimatorInitial(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Step Drift Δ ({lineEstimatorDrift})</label>
                <input
                  type="range"
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={lineEstimatorDrift}
                  onChange={(e) => setLineEstimatorDrift(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-muted-foreground block">Curve Color</label>
                  {isColor2Custom && (
                    <button
                      type="button"
                      onClick={() => setLineEstimatorColor('')}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Use Palette Color
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeColor2}
                    onChange={(e) => setLineEstimatorColor(e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={lineEstimatorColor || `Auto (${defaultColor2})`}
                    onChange={(e) => setLineEstimatorColor(e.target.value)}
                    placeholder={defaultColor2}
                    className="flex-1 bg-card border border-border rounded-xl px-2 py-1 text-xs text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Line Style</label>
                <select
                  value={lineEstimatorStyle}
                  onChange={(e) => setLineEstimatorStyle(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="solid">Solid Line (—)</option>
                  <option value="dashed">Dashed Line (---)</option>
                  <option value="dotted">Dotted Line (···)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Curve 3 - Semantic Trigger Threshold */}
          <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground block flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColor3 }} />
                <span>Semantic Trigger / Benchmark Threshold (ε)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">MarkLine</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Threshold Value ε ({lineThresholdValue})</label>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={lineThresholdValue}
                  onChange={(e) => setLineThresholdValue(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Threshold MarkLine Label</label>
                <input
                  type="text"
                  value={lineThresholdLabel}
                  onChange={(e) => setLineThresholdLabel(e.target.value)}
                  placeholder="e.g. Threshold ε = 1.00"
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Label Position</label>
                <select
                  value={lineThresholdPosition}
                  onChange={(e) => setLineThresholdPosition(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="insideEndTop">Inside End Top (Right)</option>
                  <option value="insideStartTop">Inside Start Top (Left)</option>
                  <option value="insideMiddleTop">Inside Center Top</option>
                  <option value="end">Outside End (Right)</option>
                  <option value="start">Outside Start (Left)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Threshold Legend Name</label>
                <input
                  type="text"
                  value={lineThresholdName}
                  onChange={(e) => setLineThresholdName(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-muted-foreground block">Threshold Line Color</label>
                  {isColor3Custom && (
                    <button
                      type="button"
                      onClick={() => setLineThresholdColor('')}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Use Palette Color
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeColor3}
                    onChange={(e) => setLineThresholdColor(e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={lineThresholdColor || `Auto (${defaultColor3})`}
                    onChange={(e) => setLineThresholdColor(e.target.value)}
                    placeholder={defaultColor3}
                    className="flex-1 bg-card border border-border rounded-xl px-2 py-1 text-xs text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Threshold Line Style</label>
                <select
                  value={lineThresholdStyle}
                  onChange={(e) => setLineThresholdStyle(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="dotted">Dotted Line (···)</option>
                  <option value="dashed">Dashed Line (---)</option>
                  <option value="solid">Solid Line (—)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Physical Radio TX Transmission Events */}
          <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-foreground block flex items-center gap-1.5">
                  <span className="text-primary font-bold">▲</span>
                  <span>Physical Radio Transmission Events (TX Peaks)</span>
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Explicit upward markers at exact peaks where green sawtooth reaches threshold ε = 1.00.
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground cursor-pointer shrink-0">
                <span>Enable TX Markers</span>
                <input
                  type="checkbox"
                  checked={lineShowTxEvents}
                  onChange={(e) => setLineShowTxEvents(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary"
                />
              </label>
            </div>

            {lineShowTxEvents && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground block">Marker Shape</label>
                  <select
                    value={lineTxEventSymbol}
                    onChange={(e) => setLineTxEventSymbol(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                  >
                    <option value="triangle">Upward Triangle (▲)</option>
                    <option value="pin">Map Pin Symbol</option>
                    <option value="diamond">Diamond (◆)</option>
                    <option value="circle">Circle (●)</option>
                    <option value="arrow">Arrow (↑)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground block">Marker Size ({lineTxEventSize}px)</label>
                  <input
                    type="range"
                    min={6}
                    max={24}
                    value={lineTxEventSize}
                    onChange={(e) => setLineTxEventSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-muted-foreground block">Marker Color</label>
                    {lineTxEventColor && (
                      <button
                        type="button"
                        onClick={() => setLineTxEventColor('')}
                        className="text-[10px] text-primary hover:underline font-bold"
                      >
                        Palette Auto
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={lineTxEventColor || (palette.colors[2] || '#d9534f')}
                      onChange={(e) => setLineTxEventColor(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={lineTxEventColor || `Auto (${palette.colors[2] || '#d9534f'})`}
                      onChange={(e) => setLineTxEventColor(e.target.value)}
                      placeholder={palette.colors[2] || '#d9534f'}
                      className="flex-1 bg-card border border-border rounded-xl px-2 py-1 text-xs text-foreground font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground block">Label Tag Text</label>
                  <input
                    type="text"
                    value={lineTxEventLabel}
                    onChange={(e) => setLineTxEventLabel(e.target.value)}
                    placeholder="e.g. TX"
                    className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground block">Series Legend Title</label>
                  <input
                    type="text"
                    value={lineTxEventSeriesName}
                    onChange={(e) => setLineTxEventSeriesName(e.target.value)}
                    placeholder="e.g. Physical Radio TX Events"
                    className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-card/60 rounded-xl border border-border/40 self-end">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Show Step Labels</span>
                    <span className="text-[10px] text-muted-foreground block">e.g. "TX #1", "TX #2"</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={lineShowTxLabels}
                    onChange={(e) => setLineShowTxLabels(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Area Shading & Overlap Elimination (Print Clarity) */}
          <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
            <div>
              <span className="text-xs font-black text-foreground block">Area Shading & Print Clarity</span>
              <span className="text-[10px] text-muted-foreground block">
                Independent alpha gradients eliminate muddy center overlap in academic prints.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2.5 bg-card/60 rounded-xl border border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">Baseline Curve Fill</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{lineBaselineAreaOpacity}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={lineBaselineFillMode}
                    onChange={(e) => setLineBaselineFillMode(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                  >
                    <option value="none">None (No Fill)</option>
                    <option value="subtle_gradient">Subtle Gradient</option>
                    <option value="solid">Solid Fill</option>
                  </select>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={lineBaselineAreaOpacity}
                    onChange={(e) => setLineBaselineAreaOpacity(Number(e.target.value))}
                    disabled={lineBaselineFillMode === 'none'}
                    className="w-full accent-primary disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-card/60 rounded-xl border border-border/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">Estimator Trajectory Fill</span>
                  <span className="text-[10px] font-mono text-primary font-bold">{lineEstimatorAreaOpacity}% (alpha)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={lineEstimatorFillMode}
                    onChange={(e) => setLineEstimatorFillMode(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                  >
                    <option value="subtle_gradient">Subtle Alpha Gradient (≤0.08)</option>
                    <option value="solid">Solid Fill</option>
                    <option value="none">None (No Fill)</option>
                  </select>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={lineEstimatorAreaOpacity}
                    onChange={(e) => setLineEstimatorAreaOpacity(Number(e.target.value))}
                    disabled={lineEstimatorFillMode === 'none'}
                    className="w-full accent-primary disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Time Horizon, Axis Bounds & Label Interval */}
          <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
            <span className="text-xs font-black text-foreground block">Time Horizon, Axis Bounds & Frequency</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Time Steps Count ({lineTimeSteps} steps)</label>
                <input
                  type="range"
                  min={24}
                  max={192}
                  step={12}
                  value={lineTimeSteps}
                  onChange={(e) => setLineTimeSteps(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">X-Axis Label Frequency</label>
                <select
                  value={String(lineXAxisInterval)}
                  onChange={(e) => {
                    const val = e.target.value === 'auto' ? 'auto' : Number(e.target.value);
                    setLineXAxisInterval(val);
                  }}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="auto">Auto (Balanced Spacing)</option>
                  <option value="0">Show All Numbers (0, 1, 2, ...)</option>
                  <option value="1">Every 2nd Step (0, 2, 4, 6, ...)</option>
                  <option value="3">Every 4th Step (0, 4, 8, 12, ...)</option>
                  <option value="7">Every 8th Step (0, 8, 16, 24, ...)</option>
                  <option value="11">Every 12th Step (0, 12, 24, 36, ...)</option>
                  <option value="23">Every 24th Step (0, 24, 48, 72, ...)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">X-Axis Label (Time Domain)</label>
                <input
                  type="text"
                  value={lineTimeStepIntervalName}
                  onChange={(e) => setLineTimeStepIntervalName(e.target.value)}
                  placeholder="e.g. Time Steps k (15-min intervals / 24-h Cycle)"
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Y-Axis Label (Metric)</label>
                <input
                  type="text"
                  value={lineYAxisTitle}
                  onChange={(e) => setLineYAxisTitle(e.target.value)}
                  placeholder="e.g. State Uncertainty Tr(P)"
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Y-Axis Min Bound</label>
                <input
                  type="number"
                  step="0.5"
                  value={lineYMin}
                  onChange={(e) => setLineYMin(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Y-Axis Max Bound</label>
                <input
                  type="number"
                  step="0.5"
                  value={lineYMax}
                  onChange={(e) => setLineYMax(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Axis Pointer Style</label>
                <select
                  value={lineAxisPointerType}
                  onChange={(e) => setLineAxisPointerType(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="cross">Crosshair Pointer (Axis Cross)</option>
                  <option value="line">Vertical Line Pointer</option>
                  <option value="shadow">Shadow Band</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-card/60 rounded-xl border border-border/40 self-end">
                <div>
                  <span className="text-xs font-bold text-foreground block">Horizontal Gridlines</span>
                  <span className="text-[10px] text-muted-foreground block">Dashed guide markers</span>
                </div>
                <input
                  type="checkbox"
                  checked={lineShowGridLines}
                  onChange={(e) => setLineShowGridLines(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary"
                />
              </div>
            </div>
          </div>

          {/* Section: Point Markers */}
          <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground block">Point Markers & Spline Smoothing</span>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground cursor-pointer">
                <span>Show Point Markers</span>
                <input
                  type="checkbox"
                  checked={showLineMarkers}
                  onChange={(e) => setShowLineMarkers(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Marker Symbol</label>
                <select
                  value={lineMarkerSymbol}
                  onChange={(e) => setLineMarkerSymbol(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="circle">Filled Circle (●)</option>
                  <option value="emptyCircle">Hollow Circle (○)</option>
                  <option value="rect">Square (■)</option>
                  <option value="triangle">Triangle (▲)</option>
                  <option value="diamond">Diamond (◆)</option>
                  <option value="none">None (Hidden)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Marker Size ({lineMarkerSize}px)</label>
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={lineMarkerSize}
                  onChange={(e) => setLineMarkerSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="flex items-center justify-between p-2 bg-card/60 rounded-xl border border-border/40 self-end">
                <div>
                  <span className="text-xs font-bold text-foreground block">Smooth Spline Curve</span>
                  <span className="text-[10px] text-muted-foreground block">Cubic Bézier</span>
                </div>
                <input
                  type="checkbox"
                  checked={smoothLine}
                  onChange={(e) => setSmoothLine(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1 border-t border-border/40">
              <label className="text-[11px] font-bold text-muted-foreground block">Line Width ({lineWidth}px)</label>
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Standard Cohort Trend Customization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border/40">
              <div>
                <span className="text-xs font-bold text-foreground block">Smooth Spline Curve</span>
                <span className="text-[10px] text-muted-foreground block">Cubic Bézier interpolation</span>
              </div>
              <input
                type="checkbox"
                checked={smoothLine}
                onChange={(e) => setSmoothLine(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border/40">
              <div>
                <span className="text-xs font-bold text-foreground block">Show Point Markers</span>
                <span className="text-[10px] text-muted-foreground block">Displays vertex symbols</span>
              </div>
              <input
                type="checkbox"
                checked={showLineMarkers}
                onChange={(e) => setShowLineMarkers(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Line Width ({lineWidth}px)</label>
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Marker Size ({lineMarkerSize}px)</label>
              <input
                type="range"
                min={4}
                max={16}
                value={lineMarkerSize}
                onChange={(e) => setLineMarkerSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Area Fill Opacity ({lineAreaOpacity}%)</label>
              <input
                type="range"
                min={0}
                max={60}
                value={lineAreaOpacity}
                onChange={(e) => setLineAreaOpacity(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Marker Symbol</label>
              <select
                value={lineMarkerSymbol}
                onChange={(e) => setLineMarkerSymbol(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="circle">Filled Circle (●)</option>
                <option value="emptyCircle">Hollow Circle (○)</option>
                <option value="rect">Square (■)</option>
                <option value="triangle">Triangle (▲)</option>
                <option value="diamond">Diamond (◆)</option>
                <option value="none">None (Hidden)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Step Line Transition</label>
              <select
                value={lineStepMode}
                onChange={(e) => setLineStepMode(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="none">Continuous / Linear</option>
                <option value="start">Step at Start</option>
                <option value="middle">Step at Middle</option>
                <option value="end">Step at End</option>
              </select>
            </div>
          </div>

          {/* Point Data Labels */}
          <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDataLabels}
                  onChange={(e) => setShowDataLabels(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary"
                />
                <span className="text-xs font-bold text-foreground">
                  Enable Point Data Labels
                </span>
              </label>
            </div>

            {showDataLabels && (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground block">Label Format Template</label>
                  <select
                    value={labelFormat || 'ratio_percent'}
                    onChange={(e) => setLabelFormat(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                  >
                    <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
                    <option value="count_only">Count Only (n = x)</option>
                    <option value="percent_only">Percentage Only (~P%)</option>
                    <option value="count_percent">Count + Coarse % (n = x, ~P%)</option>
                    <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-muted-foreground block">Placement</label>
                    <select
                      value={universalLabelPosition || 'top'}
                      onChange={(e) => setUniversalLabelPosition(e.target.value as any)}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="top">Above (Top)</option>
                      <option value="bottom">Below (Bottom)</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-muted-foreground block">Font Size ({universalLabelFontSize ?? 11}px)</label>
                    <input
                      type="range"
                      min={8}
                      max={22}
                      value={universalLabelFontSize ?? 11}
                      onChange={(e) => setUniversalLabelFontSize(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PieDonutConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    donutRatio,
    setDonutRatio,
    pieRadiusRatio,
    setPieRadiusRatio,
    roseType,
    setRoseType,
    piePadAngle,
    setPiePadAngle,
    pieCornerRadius,
    setPieCornerRadius,
    pieSort = 'desc',
    setPieSort,
    pieStartAngle = 90,
    setPieStartAngle,
    pieMinAngle = 0,
    setPieMinAngle,
    showDataLabels,
    setShowDataLabels,
    labelFormat,
    setLabelFormat,
    pieLabelPlacement,
    setPieLabelPlacement,
    pieLabelFontWeight = 'normal',
    setPieLabelFontWeight,
    pieLabelFontStyle = 'normal',
    setPieLabelFontStyle,
    pieLabelColor = '',
    setPieLabelColor,
    pieLeaderLineLength,
    setPieLeaderLineLength,
    pieLeaderLineLength2,
    setPieLeaderLineLength2
  } = config;

  return (
    <div className="space-y-4">
      {/* 1. Radii, Donut Hole & Rose Type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Outer Radius ({pieRadiusRatio}%)</label>
          <input
            type="range"
            min={30}
            max={85}
            value={pieRadiusRatio}
            onChange={(e) => setPieRadiusRatio(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Donut Hole ({donutRatio}%)</label>
          <input
            type="range"
            min={0}
            max={80}
            value={donutRatio}
            onChange={(e) => setDonutRatio(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Rose Type (Nightingale)</label>
          <select
            value={roseType}
            onChange={(e) => setRoseType(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="none">Standard Equal Radius</option>
            <option value="radius">Radius Proportional</option>
            <option value="area">Area Proportional</option>
          </select>
        </div>
      </div>

      {/* 2. Slice Sorting & Angles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Slice Sorting Order</label>
          <select
            value={pieSort}
            onChange={(e) => setPieSort(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="desc">Descending (Largest First)</option>
            <option value="asc">Ascending (Smallest First)</option>
            <option value="none">Alphabetical / Natural</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Start Angle ({pieStartAngle}°)</label>
          <input
            type="range"
            min={0}
            max={360}
            step={15}
            value={pieStartAngle}
            onChange={(e) => setPieStartAngle(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Min Slice Angle ({pieMinAngle}°)</label>
          <input
            type="range"
            min={0}
            max={20}
            value={pieMinAngle}
            onChange={(e) => setPieMinAngle(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 3. Slice Geometry & Corner Radii */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Slice Corner Radius ({pieCornerRadius}px)</label>
          <input
            type="range"
            min={0}
            max={12}
            value={pieCornerRadius}
            onChange={(e) => setPieCornerRadius(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Slice Gap Angle ({piePadAngle}°)</label>
          <input
            type="range"
            min={0}
            max={8}
            value={piePadAngle}
            onChange={(e) => setPiePadAngle(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 3. Slice Data Labels & Format */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDataLabels}
              onChange={(e) => setShowDataLabels(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary"
            />
            <span className="text-xs font-bold text-foreground">
              Enable Slice Data Labels
            </span>
          </label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {pieLabelPlacement}
          </span>
        </div>

        {showDataLabels && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Placement</label>
                <select
                  value={pieLabelPlacement}
                  onChange={(e) => setPieLabelPlacement(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="outside">Outside with Leader Lines</option>
                  <option value="inside">Inside Slices</option>
                  <option value="edge_aligned">Edge Aligned</option>
                  <option value="legend_only">Legend Only (No Canvas Labels)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Format Template</label>
                <select
                  value={labelFormat || 'name_ratio_percent'}
                  onChange={(e) => setLabelFormat(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
                  <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
                  <option value="percent_ratio">Coarse % + Ratio (~P%, n = x/N)</option>
                  <option value="percent_only">Percentage Only (~P%)</option>
                  <option value="count_percent">Count + Coarse % (n = x, ~P%)</option>
                  <option value="count_only">Count Only (n = x)</option>
                  <option value="name_percent">Name + % Only</option>
                </select>
              </div>
            </div>

            {pieLabelPlacement !== 'legend_only' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Label Weight</label>
                  <select
                    value={pieLabelFontWeight}
                    onChange={(e) => setPieLabelFontWeight(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                  >
                    <option value="normal">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">SemiBold (600)</option>
                    <option value="bold">Bold (700)</option>
                    <option value="800">ExtraBold (800)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Label Style</label>
                  <select
                    value={pieLabelFontStyle}
                    onChange={(e) => setPieLabelFontStyle(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                  >
                    <option value="normal">Normal</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Label Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={pieLabelColor || '#111827'}
                      onChange={(e) => setPieLabelColor(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={pieLabelColor}
                      onChange={(e) => setPieLabelColor(e.target.value)}
                      placeholder="Auto Contrast"
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            {pieLabelPlacement === 'outside' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Leader Line 1 ({pieLeaderLineLength ?? 12}px)</label>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    value={pieLeaderLineLength ?? 12}
                    onChange={(e) => setPieLeaderLineLength(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Leader Line 2 ({pieLeaderLineLength2 ?? 14}px)</label>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    value={pieLeaderLineLength2 ?? 14}
                    onChange={(e) => setPieLeaderLineLength2(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { RadarConfigPanel } from './RadarConfigPanel';



export function FunnelConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    funnelAlign,
    setFunnelAlign,
    funnelGap,
    setFunnelGap,
    funnelNeckWidth,
    setFunnelNeckWidth,
    funnelNeckHeight,
    setFunnelNeckHeight,
    funnelSort = 'descending',
    setFunnelSort,
    showDataLabels,
    setShowDataLabels,
    funnelLabelPosition = 'inside',
    setFunnelLabelPosition,
    labelFormat,
    setLabelFormat,
    funnelLabelFontSize = 11,
    setFunnelLabelFontSize,
    funnelLabelFontWeight = 'bold',
    setFunnelLabelFontWeight,
    funnelLabelColor = '',
    setFunnelLabelColor
  } = config;

  return (
    <div className="space-y-4">
      {/* 1. Geometry & Alignment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Funnel Sorting</label>
          <select
            value={funnelSort}
            onChange={(e) => setFunnelSort(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="descending">Descending (Widest at Top)</option>
            <option value="ascending">Ascending (Narrowest at Top / Inverted Pyramid)</option>
            <option value="none">Dataset / Natural Order</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Funnel Alignment</label>
          <select
            value={funnelAlign}
            onChange={(e) => setFunnelAlign(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="center">Centered</option>
            <option value="left">Left Aligned</option>
            <option value="right">Right Aligned</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Stage Spacing Gap ({funnelGap}px)</label>
          <input
            type="range"
            min={0}
            max={50}
            value={funnelGap}
            onChange={(e) => setFunnelGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Base Neck Width ({funnelNeckWidth}%)</label>
          <input
            type="range"
            min={10}
            max={60}
            value={funnelNeckWidth}
            onChange={(e) => setFunnelNeckWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Neck Height ({funnelNeckHeight}%)</label>
          <input
            type="range"
            min={10}
            max={50}
            value={funnelNeckHeight}
            onChange={(e) => setFunnelNeckHeight(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 2. Stage Data Labels */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDataLabels}
              onChange={(e) => setShowDataLabels(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary"
            />
            <span className="text-xs font-bold text-foreground">
              Enable Stage Data Labels
            </span>
          </label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {funnelLabelPosition}
          </span>
        </div>

        {showDataLabels && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Placement</label>
                <select
                  value={funnelLabelPosition}
                  onChange={(e) => setFunnelLabelPosition?.(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="inside">Inside Section</option>
                  <option value="outside">Outside</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Format Template</label>
                <select
                  value={labelFormat || 'name_ratio_percent'}
                  onChange={(e) => setLabelFormat(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
                  <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
                  <option value="percent_only">Percentage Only (~P%)</option>
                  <option value="count_only">Count Only (n = x)</option>
                  <option value="count_percent">Count + Coarse % (n = x, ~P%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Font Size ({funnelLabelFontSize}px)</label>
                <input
                  type="range"
                  min={9}
                  max={24}
                  value={funnelLabelFontSize}
                  onChange={(e) => setFunnelLabelFontSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Font Weight</label>
                <select
                  value={funnelLabelFontWeight}
                  onChange={(e) => setFunnelLabelFontWeight(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="normal">Normal (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">SemiBold (600)</option>
                  <option value="bold">Bold (700)</option>
                  <option value="800">ExtraBold (800)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Color</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={funnelLabelColor || '#ffffff'}
                    onChange={(e) => setFunnelLabelColor(e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={funnelLabelColor}
                    onChange={(e) => setFunnelLabelColor(e.target.value)}
                    placeholder="Auto"
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HeatmapConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    heatmapColorPreset,
    setHeatmapColorPreset,
    heatmapCellRadius,
    setHeatmapCellRadius,
    showDataLabels,
    setShowDataLabels,
    labelRotation = 0,
    setLabelRotation
  } = config;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Color Gradient Palette</label>
          <select
            value={heatmapColorPreset}
            onChange={(e) => setHeatmapColorPreset(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="academic">Academic Theme Tint</option>
            <option value="viridis">Viridis (Scientific Standard)</option>
            <option value="plasma">Plasma (High Contrast)</option>
            <option value="thermal">Thermal Spectrum</option>
            <option value="coolwarm">Coolwarm Divergent</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Cell Corner Radius ({heatmapCellRadius}px)</label>
          <input
            type="range"
            min={0}
            max={8}
            value={heatmapCellRadius}
            onChange={(e) => setHeatmapCellRadius(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Column Header Rotation</label>
          <select
            value={labelRotation}
            onChange={(e) => setLabelRotation(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value={0}>0° (Horizontal)</option>
            <option value={30}>30° (Slanted)</option>
            <option value={45}>45° (Diagonal)</option>
            <option value={60}>60° (Steep)</option>
            <option value={90}>90° (Vertical)</option>
          </select>
        </div>
      </div>

      {/* Cell Values & Visual Map */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-foreground block">Display Cell Numbers</span>
            <span className="text-[10px] text-muted-foreground block">Render co-occurrence frequency counts inside matrix cells</span>
          </div>
          <input
            type="checkbox"
            checked={showDataLabels}
            onChange={(e) => setShowDataLabels(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary"
          />
        </div>
      </div>
    </div>
  );
}

export { TreemapConfigPanel } from './TreemapConfigPanel';

export function BoxplotConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    boxplotBoxWidth,
    setBoxplotBoxWidth,
    boxplotOrientation,
    setBoxplotOrientation,
    boxplotShowScatter,
    setBoxplotShowScatter,
    boxplotFillColor = '',
    setBoxplotFillColor,
    boxplotBorderColor = '',
    setBoxplotBorderColor
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Box Plot Orientation</label>
          <select
            value={boxplotOrientation}
            onChange={(e) => setBoxplotOrientation(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Box Width ({boxplotBoxWidth}px)</label>
          <input
            type="range"
            min={15}
            max={60}
            value={boxplotBoxWidth}
            onChange={(e) => setBoxplotBoxWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Box Fill Color</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={boxplotFillColor || '#3b82f6'}
              onChange={(e) => setBoxplotFillColor(e.target.value)}
              className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={boxplotFillColor}
              onChange={(e) => setBoxplotFillColor(e.target.value)}
              placeholder="Theme Tint"
              className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Box & Whisker Border Color</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={boxplotBorderColor || '#1e3a8a'}
              onChange={(e) => setBoxplotBorderColor(e.target.value)}
              className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={boxplotBorderColor}
              onChange={(e) => setBoxplotBorderColor(e.target.value)}
              placeholder="Theme Default"
              className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="p-3 bg-secondary/30 rounded-xl border border-border/40 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-foreground block">Jitter Scatter Overlay</span>
          <span className="text-[10px] text-muted-foreground block">Plots individual study data points transparently over quartile boxes</span>
        </div>
        <input
          type="checkbox"
          checked={boxplotShowScatter}
          onChange={(e) => setBoxplotShowScatter(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary"
        />
      </div>
    </div>
  );
}

export function ScatterConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    scatterPointSize,
    setScatterPointSize,
    scatterPointOpacity,
    setScatterPointOpacity,
    scatterSymbol = 'circle',
    setScatterSymbol,
    scatterColor = '',
    setScatterColor,
    scatterBorderColor = '',
    setScatterBorderColor,
    scatterBorderWidth = 0,
    setScatterBorderWidth,
    scatterShowRegression,
    setScatterShowRegression,
    scatterRegressionType,
    setScatterRegressionType
  } = config;

  return (
    <div className="space-y-4">
      {/* 1. Point Geometry & Symbol */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Point Symbol</label>
          <select
            value={scatterSymbol}
            onChange={(e) => setScatterSymbol(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="circle">Circle (Default)</option>
            <option value="diamond">Diamond</option>
            <option value="rect">Square / Rectangle</option>
            <option value="triangle">Triangle</option>
            <option value="roundRect">Rounded Square</option>
            <option value="pin">Pin Marker</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Point Size ({scatterPointSize}px)</label>
          <input
            type="range"
            min={4}
            max={28}
            value={scatterPointSize}
            onChange={(e) => setScatterPointSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Point Opacity ({scatterPointOpacity}%)</label>
          <input
            type="range"
            min={20}
            max={100}
            value={scatterPointOpacity}
            onChange={(e) => setScatterPointOpacity(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 2. Color & Border Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Point Fill Color</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={scatterColor || '#3b82f6'}
              onChange={(e) => setScatterColor(e.target.value)}
              className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={scatterColor}
              onChange={(e) => setScatterColor(e.target.value)}
              placeholder="Theme Default"
              className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Border Color</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={scatterBorderColor || '#1e3a8a'}
              onChange={(e) => setScatterBorderColor(e.target.value)}
              className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={scatterBorderColor}
              onChange={(e) => setScatterBorderColor(e.target.value)}
              placeholder="None"
              className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Border Width ({scatterBorderWidth}px)</label>
          <input
            type="range"
            min={0}
            max={6}
            step={0.5}
            value={scatterBorderWidth}
            onChange={(e) => setScatterBorderWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 3. Statistical Regression */}
      <div className="pt-2 border-t border-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scatterShowRegression}
              onChange={(e) => setScatterShowRegression(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary"
            />
            <span>Overlay Statistical Regression / Trend Line</span>
          </label>
        </div>

        {scatterShowRegression && (
          <div className="p-2.5 bg-secondary/30 rounded-xl border border-border/60">
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Regression Trend Model</label>
            <select
              value={scatterRegressionType}
              onChange={(e) => setScatterRegressionType(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
            >
              <option value="linear">Linear Ordinary Least Squares (OLS Fit)</option>
              <option value="mean">Cohort Horizontal Mean Reference</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

export function BubbleConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    bubbleScale = 1.2,
    setBubbleScale,
    bubbleMinRadius = 12,
    setBubbleMinRadius,
    bubbleMaxRadius = 65,
    setBubbleMaxRadius,
    bubbleOpacity = 85,
    setBubbleOpacity,
    bubbleBorderWidth = 1.5,
    setBubbleBorderWidth,
    bubbleBorderColor = '#333333',
    setBubbleBorderColor,
    bubbleShowLabels = true,
    setBubbleShowLabels,
    bubbleLabelFormat = 'count_n',
    setBubbleLabelFormat,
    bubbleLabelFontSize = 11,
    setBubbleLabelFontSize,
    bubbleLabelColor = '#ffffff',
    setBubbleLabelColor,
    bubbleColorMode = 'color_by_x',
    setBubbleColorMode,
    bubbleSeriesName = 'Deployments',
    setBubbleSeriesName,
    bubbleLegendMode = 'category_series',
    setBubbleLegendMode
  } = config;

  return (
    <div className="space-y-4">
      {/* --- SECTION 1: BUBBLE SIZING & DYNAMIC SCALING --- */}
      <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
        <span className="text-xs font-black text-foreground block flex items-center justify-between">
          <span>Bubble Sizing & Dynamic Scaling</span>
          <span className="text-[10px] text-muted-foreground font-mono">Scale: {bubbleScale}x</span>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Bubble Scale Factor ({bubbleScale}x)</label>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={bubbleScale}
              onChange={(e) => setBubbleScale(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Min Bubble Diameter ({bubbleMinRadius}px)</label>
            <input
              type="range"
              min={6}
              max={24}
              value={bubbleMinRadius}
              onChange={(e) => setBubbleMinRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Max Bubble Diameter ({bubbleMaxRadius}px)</label>
            <input
              type="range"
              min={25}
              max={140}
              value={bubbleMaxRadius}
              onChange={(e) => setBubbleMaxRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      {/* --- SECTION 2: BUBBLE AESTHETICS & COLORING --- */}
      <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
        <span className="text-xs font-black text-foreground block flex items-center justify-between">
          <span>Bubble Aesthetics & Visual Styling</span>
          <span className="text-[10px] text-muted-foreground font-mono">Border & Fill</span>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Color Partitioning Mode</label>
            <select
              value={bubbleColorMode}
              onChange={(e) => setBubbleColorMode(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="color_by_x">Color by X-Axis Category (Domain Palette)</option>
              <option value="color_by_y">Color by Y-Axis Category (Spectrum Palette)</option>
              <option value="color_by_metric">Color by Metric Density (Gradient Intensity)</option>
              <option value="custom_compliance">Custom Compliance & Classification Rules</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Bubble Fill Opacity ({bubbleOpacity}%)</label>
            <input
              type="range"
              min={30}
              max={100}
              value={bubbleOpacity}
              onChange={(e) => setBubbleOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Bubble Border Width ({bubbleBorderWidth}px)</label>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={bubbleBorderWidth}
              onChange={(e) => setBubbleBorderWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Border Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bubbleBorderColor || '#333333'}
                onChange={(e) => setBubbleBorderColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer p-0"
              />
              <input
                type="text"
                value={bubbleBorderColor || '#333333'}
                onChange={(e) => setBubbleBorderColor(e.target.value)}
                className="flex-1 bg-card border border-border rounded-xl px-2 py-1 text-xs text-foreground font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: INSIDE-BUBBLE VALUE LABELS --- */}
      <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-foreground block">Inside-Bubble Value Labels</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={bubbleShowLabels}
              onChange={(e) => setBubbleShowLabels(e.target.checked)}
              className="rounded border-border text-primary"
            />
            <span>Show Labels</span>
          </label>
        </div>

        {bubbleShowLabels && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Label Format</label>
              <select
                value={bubbleLabelFormat}
                onChange={(e) => setBubbleLabelFormat(e.target.value as any)}
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="count_n">"n=X" (e.g. n=7)</option>
                <option value="count_only">"X" (Count Only e.g. 7)</option>
                <option value="percent">"P%" (Prevalence % e.g. 15.2%)</option>
                <option value="label">Intersection Title</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Label Font Size ({bubbleLabelFontSize}px)</label>
              <input
                type="range"
                min={8}
                max={32}
                value={bubbleLabelFontSize}
                onChange={(e) => setBubbleLabelFontSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Label Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bubbleLabelColor || '#ffffff'}
                  onChange={(e) => setBubbleLabelColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer p-0"
                />
                <input
                  type="text"
                  value={bubbleLabelColor || '#ffffff'}
                  onChange={(e) => setBubbleLabelColor(e.target.value)}
                  className="flex-1 bg-card border border-border rounded-xl px-2 py-1 text-xs text-foreground font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- SECTION 4: BUBBLE CATEGORY & SERIES DISPLAY --- */}
      <div className="p-3 bg-secondary/20 rounded-2xl border border-border/60 space-y-3">
        <span className="text-xs font-black text-foreground block">Series Legend Mode</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Series Display Mode</label>
            <select
              value={bubbleLegendMode}
              onChange={(e) => setBubbleLegendMode(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="category_series">Category Chips (Multi-Series Filter)</option>
              <option value="single_series">Single Cohort Series (Custom Title)</option>
            </select>
          </div>

          {bubbleLegendMode === 'single_series' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Custom Series Title</label>
              <input
                type="text"
                value={bubbleSeriesName}
                onChange={(e) => setBubbleSeriesName(e.target.value)}
                placeholder="e.g. Deployments"
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground font-bold"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Alias for backward compatibility
export const ScatterBubbleConfigPanel = ScatterConfigPanel;

export function GraphConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    graphRepulsion,
    setGraphRepulsion,
    graphEdgeLength,
    setGraphEdgeLength,
    graphGravity,
    setGraphGravity,
    graphCurveness,
    setGraphCurveness,
    graphNodeSize,
    setGraphNodeSize,
    graphDraggable,
    setGraphDraggable,
    showDataLabels,
    setShowDataLabels,
    graphShowLinkWeights,
    setGraphShowLinkWeights
  } = config;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Repulsion Force ({graphRepulsion})</label>
          <input
            type="range"
            min={40}
            max={300}
            value={graphRepulsion}
            onChange={(e) => setGraphRepulsion(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Link Distance ({graphEdgeLength}px)</label>
          <input
            type="range"
            min={40}
            max={200}
            value={graphEdgeLength}
            onChange={(e) => setGraphEdgeLength(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Center Gravity ({graphGravity})</label>
          <input
            type="range"
            min={0.01}
            max={0.5}
            step={0.02}
            value={graphGravity}
            onChange={(e) => setGraphGravity(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Edge Curvature ({graphCurveness})</label>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.05}
            value={graphCurveness}
            onChange={(e) => setGraphCurveness(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Base Node Size ({graphNodeSize}px)</label>
          <input
            type="range"
            min={8}
            max={50}
            value={graphNodeSize}
            onChange={(e) => setGraphNodeSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* Node Labels, Draggability & Edge Weights */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-foreground block">Draggable Vertices</span>
            <span className="text-[10px] text-muted-foreground block">Allow manual vertex dragging to untangle network clusters</span>
          </div>
          <input
            type="checkbox"
            checked={graphDraggable}
            onChange={(e) => setGraphDraggable(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary"
          />
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-foreground block">Display Node Labels</span>
            <span className="text-[10px] text-muted-foreground block">Show entity names next to vertices</span>
          </div>
          <input
            type="checkbox"
            checked={showDataLabels}
            onChange={(e) => setShowDataLabels(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary"
          />
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-foreground block">Display Edge Weight Labels</span>
            <span className="text-[10px] text-muted-foreground block">Show co-occurrence counts along connecting lines</span>
          </div>
          <input
            type="checkbox"
            checked={graphShowLinkWeights}
            onChange={(e) => setGraphShowLinkWeights(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary"
          />
        </div>
      </div>
    </div>
  );
}

export function GaugeConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    gaugeMaxScale,
    setGaugeMaxScale,
    gaugeStartAngle,
    setGaugeStartAngle,
    gaugeEndAngle,
    setGaugeEndAngle,
    gaugePointerWidth,
    setGaugePointerWidth,
    gaugeDialWidth,
    setGaugeDialWidth,
    gaugeUnit,
    setGaugeUnit,
    gaugeSplitNumber,
    setGaugeSplitNumber
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Scale Maximum Target</label>
          <input
            type="number"
            min={10}
            max={1000}
            value={gaugeMaxScale}
            onChange={(e) => setGaugeMaxScale(Math.max(1, Number(e.target.value)))}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Dial Thickness ({gaugeDialWidth}px)</label>
          <input
            type="range"
            min={6}
            max={28}
            value={gaugeDialWidth}
            onChange={(e) => setGaugeDialWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Metric Unit Suffix</label>
          <select
            value={gaugeUnit}
            onChange={(e) => setGaugeUnit(e.target.value)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
          >
            <option value="auto">Auto (Percent for Ratios, Blank for Counts)</option>
            <option value="%">Percent (%)</option>
            <option value="cit">Citations (cit)</option>
            <option value="pts">Points (pts)</option>
            <option value="papers">Papers</option>
            <option value="none">None (Raw Number)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Scale Ticks / Splits ({gaugeSplitNumber})</label>
          <input
            type="range"
            min={2}
            max={10}
            value={gaugeSplitNumber}
            onChange={(e) => setGaugeSplitNumber(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Start Angle ({gaugeStartAngle}°)</label>
          <input
            type="range"
            min={180}
            max={270}
            value={gaugeStartAngle}
            onChange={(e) => setGaugeStartAngle(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">End Angle ({gaugeEndAngle}°)</label>
          <input
            type="range"
            min={-90}
            max={0}
            value={gaugeEndAngle}
            onChange={(e) => setGaugeEndAngle(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Pointer Width ({gaugePointerWidth}px)</label>
          <input
            type="range"
            min={2}
            max={12}
            value={gaugePointerWidth}
            onChange={(e) => setGaugePointerWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

export function CalendarConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    calendarCellSize,
    setCalendarCellSize,
    calendarYear,
    setCalendarYear,
    calendarColorPreset,
    setCalendarColorPreset
  } = config;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Date Grid Cell Size ({calendarCellSize}px)</label>
          <input
            type="range"
            min={10}
            max={24}
            value={calendarCellSize}
            onChange={(e) => setCalendarCellSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Year Filter Range</label>
          <input
            type="text"
            value={calendarYear}
            onChange={(e) => setCalendarYear(e.target.value)}
            placeholder="auto or e.g. 2025"
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Heat Color Theme</label>
          <select
            value={calendarColorPreset}
            onChange={(e) => setCalendarColorPreset(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
          >
            <option value="academic">Academic Blue/Slate</option>
            <option value="viridis">Viridis Scientific</option>
            <option value="plasma">Plasma High-Contrast</option>
            <option value="thermal">Thermal Heatmap</option>
            <option value="coolwarm">Cool-Warm Divergent</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export { SankeyConfigPanel } from './SankeyConfigPanel';
