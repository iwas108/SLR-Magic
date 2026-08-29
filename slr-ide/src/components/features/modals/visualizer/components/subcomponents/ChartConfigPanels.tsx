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
    barLabelFormat,
    setBarLabelFormat,
    barLabelDistance,
    setBarLabelDistance,
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

  return (
    <div className="space-y-4">
      {/* Sorting, Dimensions & Radii */}
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
          <label className="text-xs font-bold text-foreground block">Bar Width ({barThickness}px)</label>
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

      {/* Label Format & Spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
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
          <label className="text-xs font-bold text-foreground block">Distance to Label ({barLabelDistance ?? 5}px)</label>
          <input
            type="range"
            min={-15}
            max={30}
            value={barLabelDistance ?? 5}
            onChange={(e) => setBarLabelDistance(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* Target Benchmark Reference Line */}
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
    setBarGap,
    stackedNormalized,
    setStackedNormalized
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

      <div className="p-3 bg-secondary/30 rounded-xl border border-border/40 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-foreground block">100% Normalized Stack Share</span>
          <span className="text-[10px] text-muted-foreground block">Scales all category stacks to 100% height for proportion comparison</span>
        </div>
        <input
          type="checkbox"
          checked={stackedNormalized}
          onChange={(e) => setStackedNormalized(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary"
        />
      </div>
    </div>
  );
}

export function LineConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    smoothLine,
    setSmoothLine,
    lineWidth,
    setLineWidth,
    showLineMarkers,
    setShowLineMarkers,
    lineMarkerSize,
    setLineMarkerSize,
    lineAreaOpacity,
    setLineAreaOpacity,
    lineStepMode,
    setLineStepMode
  } = config;

  return (
    <div className="space-y-3">
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

      <div className="space-y-1 pt-1">
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
    pieLabelPlacement,
    setPieLabelPlacement,
    pieLeaderLineLength,
    setPieLeaderLineLength,
    pieLeaderLineLength2,
    setPieLeaderLineLength2
  } = config;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
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
      </div>

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
  );
}

export function RadarConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    radarShape,
    setRadarShape,
    radarAreaOpacity,
    setRadarAreaOpacity,
    radarLineWidth,
    setRadarLineWidth,
    radarSplitNumber,
    setRadarSplitNumber
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Radar Web Geometry</label>
          <select
            value={radarShape}
            onChange={(e) => setRadarShape(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="polygon">Polygon (Standard Multi-Axis)</option>
            <option value="circle">Concentric Circular Rings</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Concentric Split Rings ({radarSplitNumber})</label>
          <input
            type="range"
            min={3}
            max={8}
            value={radarSplitNumber}
            onChange={(e) => setRadarSplitNumber(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Area Fill Opacity ({radarAreaOpacity}%)</label>
          <input
            type="range"
            min={5}
            max={60}
            value={radarAreaOpacity}
            onChange={(e) => setRadarAreaOpacity(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Stroke Line Width ({radarLineWidth}px)</label>
          <input
            type="range"
            min={1}
            max={5}
            value={radarLineWidth}
            onChange={(e) => setRadarLineWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

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
    setFunnelNeckHeight
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            max={10}
            value={funnelGap}
            onChange={(e) => setFunnelGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
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
    </div>
  );
}

export function HeatmapConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    heatmapColorPreset,
    setHeatmapColorPreset,
    heatmapCellRadius,
    setHeatmapCellRadius
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>
    </div>
  );
}

export function TreemapConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    treemapAlgorithm,
    setTreemapAlgorithm,
    treemapVisibleDepth,
    setTreemapVisibleDepth,
    treemapGapWidth,
    setTreemapGapWidth,
    treemapBorderWidth,
    setTreemapBorderWidth
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Partitioning Algorithm</label>
          <select
            value={treemapAlgorithm}
            onChange={(e) => setTreemapAlgorithm(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="squarified">Squarified (Golden Ratio Standard)</option>
            <option value="sliceAndDice">Slice & Dice (Alternating)</option>
            <option value="binary">Binary Partition</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Visible Hierarchy Depth ({treemapVisibleDepth})</label>
          <input
            type="range"
            min={1}
            max={4}
            value={treemapVisibleDepth}
            onChange={(e) => setTreemapVisibleDepth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Inter-Tile Gap ({treemapGapWidth}px)</label>
          <input
            type="range"
            min={0}
            max={6}
            value={treemapGapWidth}
            onChange={(e) => setTreemapGapWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Tile Border ({treemapBorderWidth}px)</label>
          <input
            type="range"
            min={1}
            max={6}
            value={treemapBorderWidth}
            onChange={(e) => setTreemapBorderWidth(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

export function BoxplotConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    boxplotBoxWidth,
    setBoxplotBoxWidth,
    boxplotOrientation,
    setBoxplotOrientation,
    boxplotShowScatter,
    setBoxplotShowScatter
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

export function ScatterBubbleConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    bubbleScale,
    setBubbleScale,
    scatterPointSize,
    setScatterPointSize,
    scatterPointOpacity,
    setScatterPointOpacity,
    scatterShowRegression,
    setScatterShowRegression,
    scatterRegressionType,
    setScatterRegressionType
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Point Size ({scatterPointSize}px)</label>
          <input
            type="range"
            min={4}
            max={24}
            value={scatterPointSize}
            onChange={(e) => setScatterPointSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Bubble Scale ({bubbleScale}x)</label>
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
    setGraphCurveness
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
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
    setGaugeDialWidth
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
    setCalendarYear
  } = config;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>
    </div>
  );
}

