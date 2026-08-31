import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  Type, 
  RotateCw, 
  Hash, 
  Grid, 
  ChevronRight, 
  Sparkles,
  Palette,
  Eye,
  EyeOff
} from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import type { AxisLocation, AxisLabelFormat, AxisGridLineStyle, AxisFontWeight, AxisFontStyle } from '../../types';

type AxisPanelSubTab = 'titles' | 'labels' | 'format' | 'grid';

export function ScientificAxisConfigPanel() {
  const { config, style } = useVisualizerContext();
  const {
    chartType,
    primaryField,
    secondaryField,
    metricMode,
    barOrientation = 'horizontal',
    lineMode = 'cohort_trend',
    numFieldX = 'Year',
    numFieldY = 'Quality_Score',
    // Scale & Baseline
    axisScaleType = 'linear',
    setAxisScaleType,
    axisTickDirection = 'outside',
    setAxisTickDirection,
    showAxisBaseline = true,
    setShowAxisBaseline,
    // Axis Titles Customization
    customAxisTitleX = '',
    setCustomAxisTitleX,
    customAxisTitleY = '',
    setCustomAxisTitleY,
    showAxisTitleX = true,
    setShowAxisTitleX,
    showAxisTitleY = true,
    setShowAxisTitleY,
    axisTitleFontSizeX = 11,
    setAxisTitleFontSizeX,
    axisTitleFontSizeY = 11,
    setAxisTitleFontSizeY,
    axisTitleFontWeightX = 'bold',
    setAxisTitleFontWeightX,
    axisTitleFontWeightY = 'bold',
    setAxisTitleFontWeightY,
    axisTitleFontStyleX = 'normal',
    setAxisTitleFontStyleX,
    axisTitleFontStyleY = 'normal',
    setAxisTitleFontStyleY,
    axisTitleColorX = '',
    setAxisTitleColorX,
    axisTitleColorY = '',
    setAxisTitleColorY,
    axisTitleLocationX = 'middle',
    setAxisTitleLocationX,
    axisTitleLocationY = 'middle',
    setAxisTitleLocationY,
    axisTitleGapX = 28,
    setAxisTitleGapX,
    axisTitleGapY = 38,
    setAxisTitleGapY,
    // Axis Tick Labels Customization
    showAxisLabelX = true,
    setShowAxisLabelX,
    showAxisLabelY = true,
    setShowAxisLabelY,
    axisLabelFontSizeX = 11,
    setAxisLabelFontSizeX,
    axisLabelFontSizeY = 11,
    setAxisLabelFontSizeY,
    axisLabelFontWeightX = 'normal',
    setAxisLabelFontWeightX,
    axisLabelFontWeightY = 'normal',
    setAxisLabelFontWeightY,
    axisLabelColorX = '',
    setAxisLabelColorX,
    axisLabelColorY = '',
    setAxisLabelColorY,
    axisLabelRotateX = 0,
    setAxisLabelRotateX,
    axisLabelRotateY = 0,
    setAxisLabelRotateY,
    axisLabelMarginX = 8,
    setAxisLabelMarginX,
    axisLabelMarginY = 8,
    setAxisLabelMarginY,
    axisLabelOverflowX = 'none',
    setAxisLabelOverflowX,
    axisLabelOverflowY = 'none',
    setAxisLabelOverflowY,
    axisLabelWidthX = 120,
    setAxisLabelWidthX,
    axisLabelWidthY = 140,
    setAxisLabelWidthY,
    axisLabelLineHeightX = 14,
    setAxisLabelLineHeightX,
    axisLabelLineHeightY = 14,
    setAxisLabelLineHeightY,
    axisLabelFormatX = 'auto',
    setAxisLabelFormatX,
    axisLabelFormatY = 'auto',
    setAxisLabelFormatY,
    axisLabelPrefixX = '',
    setAxisLabelPrefixX,
    axisLabelSuffixX = '',
    setAxisLabelSuffixX,
    axisLabelPrefixY = '',
    setAxisLabelPrefixY,
    axisLabelSuffixY = '',
    setAxisLabelSuffixY,
    axisLabelIntervalX = 'auto',
    setAxisLabelIntervalX,
    axisLabelIntervalY = 'auto',
    setAxisLabelIntervalY,
    // Scientific Gridlines
    showGridLinesX = false,
    setShowGridLinesX,
    showGridLinesY = true,
    setShowGridLinesY,
    gridLineStyle = 'dashed',
    setGridLineStyle,
    gridLineColor = '',
    setGridLineColor,
    gridLineOpacity = 100,
    setGridLineOpacity,
    lineTimeStepIntervalName,
    lineYAxisTitle
  } = config;

  const [subTab, setSubTab] = useState<AxisPanelSubTab>('titles');

  const isHorizontal = chartType === 'bar_horizontal' || (chartType === 'clustered_bar' && barOrientation === 'horizontal');

  const defaultMetricTitle = metricMode === 'paper_prevalence'
    ? 'Prevalence (% of Cohort)'
    : metricMode === 'tag_share'
    ? 'Tag Share (%)'
    : metricMode === 'avg_qa'
    ? 'Average QA Score'
    : metricMode === 'avg_citation'
    ? 'Average Citation Count'
    : 'Study Count (N)';

  let autoTitleX = primaryField;
  let autoTitleY = defaultMetricTitle;

  if (chartType === 'line') {
    if (lineMode === 'epistemic_simulation') {
      autoTitleX = lineTimeStepIntervalName || 'Time Steps k (15-min intervals / 24-h Cycle)';
      autoTitleY = lineYAxisTitle || 'State Uncertainty Tr(P)';
    } else {
      autoTitleX = primaryField;
      autoTitleY = defaultMetricTitle;
    }
  } else if (chartType === 'scatter') {
    autoTitleX = numFieldX;
    autoTitleY = numFieldY;
  } else if (chartType === 'bubble') {
    autoTitleX = primaryField || numFieldX;
    autoTitleY = secondaryField || numFieldY;
  } else if (chartType === 'boxplot') {
    autoTitleX = isHorizontal ? numFieldY : primaryField;
    autoTitleY = isHorizontal ? primaryField : numFieldY;
  } else if (chartType === 'heatmap') {
    autoTitleX = primaryField;
    autoTitleY = secondaryField;
  } else if (isHorizontal) {
    autoTitleX = defaultMetricTitle;
    autoTitleY = primaryField;
  }

  return (
    <div className="p-3.5 bg-secondary/30 border border-border/80 rounded-2xl space-y-3.5 shadow-xs">
      {/* Header with Title and Mode Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-border/50">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="text-xs font-black text-foreground">Scientific Axis & Publishing Gridlines</span>
        </div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full border border-border">
          {isHorizontal ? 'Horizontal Value (X) × Cat (Y)' : 'Standard Vertical (X) × Value (Y)'}
        </span>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-1 bg-card/60 p-1 rounded-xl border border-border/60">
        <button
          type="button"
          onClick={() => setSubTab('titles')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'titles'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Titles</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('labels')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'labels'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Ticks & Angles</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('format')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'format'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          <span>Units & Formats</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('grid')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'grid'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Grid & Ticks</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SUBTAB 1: AXIS TITLES & TYPOGRAPHY                       */}
      {/* ======================================================== */}
      {subTab === 'titles' && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* X-Axis Title Card */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>X-Axis Title / Domain Label</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAxisTitleX(!showAxisTitleX)}
                className={`p-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  showAxisTitleX ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-secondary'
                }`}
                title={showAxisTitleX ? 'Hide X-Axis Title' : 'Show X-Axis Title'}
              >
                {showAxisTitleX ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{showAxisTitleX ? 'Visible' : 'Hidden'}</span>
              </button>
            </div>

            <input
              type="text"
              value={customAxisTitleX}
              onChange={(e) => setCustomAxisTitleX(e.target.value)}
              placeholder={`Auto: ${autoTitleX}`}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground placeholder:text-muted-foreground/60"
            />

            {showAxisTitleX && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40 text-[11px]">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Font Size ({axisTitleFontSizeX}px)</label>
                  <input
                    type="range"
                    min={8}
                    max={20}
                    value={axisTitleFontSizeX}
                    onChange={(e) => setAxisTitleFontSizeX(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Weight & Style</label>
                  <div className="flex items-center gap-1">
                    <select
                      value={axisTitleFontWeightX}
                      onChange={(e) => setAxisTitleFontWeightX(e.target.value as AxisFontWeight)}
                      className="flex-1 bg-card border border-border rounded-lg px-1.5 py-1 text-[10.5px] font-bold text-foreground"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="600">Semi-Bold</option>
                      <option value="700">Extra Bold</option>
                    </select>
                    <select
                      value={axisTitleFontStyleX}
                      onChange={(e) => setAxisTitleFontStyleX(e.target.value as AxisFontStyle)}
                      className="w-16 bg-card border border-border rounded-lg px-1 py-1 text-[10.5px] font-bold text-foreground"
                    >
                      <option value="normal">Plain</option>
                      <option value="italic">Italic</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Location</label>
                  <select
                    value={axisTitleLocationX}
                    onChange={(e) => setAxisTitleLocationX(e.target.value as AxisLocation)}
                    className="w-full bg-card border border-border rounded-lg px-1.5 py-1 text-[10.5px] font-bold text-foreground"
                  >
                    <option value="middle">Middle / Center</option>
                    <option value="start">Start (Left)</option>
                    <option value="end">End (Right)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Gap ({axisTitleGapX}px)</label>
                  <input
                    type="range"
                    min={10}
                    max={120}
                    value={axisTitleGapX}
                    onChange={(e) => setAxisTitleGapX(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Y-Axis Title Card */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Y-Axis Title / Metric Label</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAxisTitleY(!showAxisTitleY)}
                className={`p-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  showAxisTitleY ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-secondary'
                }`}
                title={showAxisTitleY ? 'Hide Y-Axis Title' : 'Show Y-Axis Title'}
              >
                {showAxisTitleY ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{showAxisTitleY ? 'Visible' : 'Hidden'}</span>
              </button>
            </div>

            <input
              type="text"
              value={customAxisTitleY}
              onChange={(e) => setCustomAxisTitleY(e.target.value)}
              placeholder={`Auto: ${autoTitleY}`}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground placeholder:text-muted-foreground/60"
            />

            {showAxisTitleY && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40 text-[11px]">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Font Size ({axisTitleFontSizeY}px)</label>
                  <input
                    type="range"
                    min={8}
                    max={20}
                    value={axisTitleFontSizeY}
                    onChange={(e) => setAxisTitleFontSizeY(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Weight & Style</label>
                  <div className="flex items-center gap-1">
                    <select
                      value={axisTitleFontWeightY}
                      onChange={(e) => setAxisTitleFontWeightY(e.target.value as AxisFontWeight)}
                      className="flex-1 bg-card border border-border rounded-lg px-1.5 py-1 text-[10.5px] font-bold text-foreground"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                      <option value="600">Semi-Bold</option>
                      <option value="700">Extra Bold</option>
                    </select>
                    <select
                      value={axisTitleFontStyleY}
                      onChange={(e) => setAxisTitleFontStyleY(e.target.value as AxisFontStyle)}
                      className="w-16 bg-card border border-border rounded-lg px-1 py-1 text-[10.5px] font-bold text-foreground"
                    >
                      <option value="italic">Italic</option>
                      <option value="normal">Plain</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Location</label>
                  <select
                    value={axisTitleLocationY}
                    onChange={(e) => setAxisTitleLocationY(e.target.value as AxisLocation)}
                    className="w-full bg-card border border-border rounded-lg px-1.5 py-1 text-[10.5px] font-bold text-foreground"
                  >
                    <option value="middle">Middle / Center</option>
                    <option value="end">Top / End</option>
                    <option value="start">Bottom / Start</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Gap ({axisTitleGapY}px)</label>
                  <input
                    type="range"
                    min={10}
                    max={120}
                    value={axisTitleGapY}
                    onChange={(e) => setAxisTitleGapY(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 2: TICK LABELS & ROTATION ANGLES                  */}
      {/* ======================================================== */}
      {subTab === 'labels' && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* X-Axis Tick Label Controls */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>X-Axis Tick Marks & Category Wrapping</span>
              </span>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAxisLabelX}
                  onChange={(e) => setShowAxisLabelX(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span>Show X Ticks</span>
              </label>
            </div>

            {showAxisLabelX && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="space-y-1">
                    <label className="font-bold text-muted-foreground block">Label Size ({axisLabelFontSizeX}px)</label>
                    <input
                      type="range"
                      min={8}
                      max={18}
                      value={axisLabelFontSizeX}
                      onChange={(e) => setAxisLabelFontSizeX(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-muted-foreground block">Max Width ({axisLabelWidthX}px)</label>
                    <input
                      type="range"
                      min={50}
                      max={320}
                      value={axisLabelWidthX}
                      onChange={(e) => setAxisLabelWidthX(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-muted-foreground block">Line Height ({axisLabelLineHeightX}px)</label>
                    <input
                      type="range"
                      min={10}
                      max={28}
                      value={axisLabelLineHeightX}
                      onChange={(e) => setAxisLabelLineHeightX(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-muted-foreground block">Overflow Wrap</label>
                    <select
                      value={axisLabelOverflowX}
                      onChange={(e) => setAxisLabelOverflowX(e.target.value as any)}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="break">Word Wrap</option>
                      <option value="truncate">Truncate (...)</option>
                      <option value="none">Full Length</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="space-y-1">
                    <label className="font-bold text-muted-foreground block">Tick Margin ({axisLabelMarginX}px)</label>
                    <input
                      type="range"
                      min={2}
                      max={35}
                      value={axisLabelMarginX}
                      onChange={(e) => setAxisLabelMarginX(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-muted-foreground block">Density / Interval</label>
                    <select
                      value={String(axisLabelIntervalX)}
                      onChange={(e) => {
                        const val = e.target.value === 'auto' ? 'auto' : Number(e.target.value);
                        setAxisLabelIntervalX(val);
                      }}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="auto">Auto (Balanced)</option>
                      <option value="0">Show All (0, 1, 2, ...)</option>
                      <option value="1">Every 2nd (0, 2, 4, ...)</option>
                      <option value="2">Every 3rd (0, 3, 6, ...)</option>
                      <option value="3">Every 4th (0, 4, 8, ...)</option>
                      <option value="7">Every 8th (0, 8, 16, ...)</option>
                      <option value="11">Every 12th (0, 12, 24, ...)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Angle Presets & Slider */}
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-muted-foreground">
                      Rotation Angle ({axisLabelRotateX}°)
                    </label>
                    <div className="flex items-center gap-1">
                      {[0, 15, 30, 45, 90, -45].map(deg => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => setAxisLabelRotateX(deg)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            axisLabelRotateX === deg
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary hover:bg-secondary/80 text-foreground'
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={5}
                    value={axisLabelRotateX}
                    onChange={(e) => setAxisLabelRotateX(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </>
            )}
          </div>

          {/* Y-Axis Tick Label & Word Wrapping Controls */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Y-Axis Tick Marks & Category Wrapping</span>
              </span>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAxisLabelY}
                  onChange={(e) => setShowAxisLabelY(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span>Show Y Ticks</span>
              </label>
            </div>

            {showAxisLabelY && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Label Size ({axisLabelFontSizeY}px)</label>
                  <input
                    type="range"
                    min={8}
                    max={18}
                    value={axisLabelFontSizeY}
                    onChange={(e) => setAxisLabelFontSizeY(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Max Width ({axisLabelWidthY}px)</label>
                  <input
                    type="range"
                    min={80}
                    max={320}
                    value={axisLabelWidthY}
                    onChange={(e) => setAxisLabelWidthY(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Line Height ({axisLabelLineHeightY}px)</label>
                  <input
                    type="range"
                    min={10}
                    max={28}
                    value={axisLabelLineHeightY}
                    onChange={(e) => setAxisLabelLineHeightY(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-muted-foreground block">Overflow Wrap</label>
                  <select
                    value={axisLabelOverflowY}
                    onChange={(e) => setAxisLabelOverflowY(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  >
                    <option value="break">Word Wrap</option>
                    <option value="truncate">Truncate (...)</option>
                    <option value="none">Full Length</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 3: VALUE FORMATTING, UNITS, PREFIX & SUFFIX        */}
      {/* ======================================================== */}
      {subTab === 'format' && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* X-Axis Number Format Card */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <span className="text-xs font-bold text-foreground block">
              X-Axis Metric / Value Formatting
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Number Format</label>
                <select
                  value={axisLabelFormatX}
                  onChange={(e) => setAxisLabelFormatX(e.target.value as AxisLabelFormat)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="auto">Auto Format</option>
                  <option value="percent">Percentage (e.g. 50%)</option>
                  <option value="integer">Integer (e.g. 50)</option>
                  <option value="decimal_1">1 Decimal (e.g. 50.0)</option>
                  <option value="decimal_2">2 Decimals (e.g. 50.00)</option>
                  <option value="scientific">Scientific (e.g. 1.25e+2)</option>
                  <option value="currency">Currency ($)</option>
                  <option value="raw">Raw Unformatted</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Prefix String</label>
                <input
                  type="text"
                  value={axisLabelPrefixX}
                  onChange={(e) => setAxisLabelPrefixX(e.target.value)}
                  placeholder="e.g. n="
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Suffix String</label>
                <input
                  type="text"
                  value={axisLabelSuffixX}
                  onChange={(e) => setAxisLabelSuffixX(e.target.value)}
                  placeholder="e.g. % or papers"
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Y-Axis Number Format Card */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <span className="text-xs font-bold text-foreground block">
              Y-Axis Metric / Value Formatting
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Number Format</label>
                <select
                  value={axisLabelFormatY}
                  onChange={(e) => setAxisLabelFormatY(e.target.value as AxisLabelFormat)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="auto">Auto Format</option>
                  <option value="percent">Percentage (e.g. 50%)</option>
                  <option value="integer">Integer (e.g. 50)</option>
                  <option value="decimal_1">1 Decimal (e.g. 50.0)</option>
                  <option value="decimal_2">2 Decimals (e.g. 50.00)</option>
                  <option value="scientific">Scientific (e.g. 1.25e+2)</option>
                  <option value="currency">Currency ($)</option>
                  <option value="raw">Raw Unformatted</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Prefix String</label>
                <input
                  type="text"
                  value={axisLabelPrefixY}
                  onChange={(e) => setAxisLabelPrefixY(e.target.value)}
                  placeholder="e.g. ε="
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Suffix String</label>
                <input
                  type="text"
                  value={axisLabelSuffixY}
                  onChange={(e) => setAxisLabelSuffixY(e.target.value)}
                  placeholder="e.g. % or studies"
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 4: GRIDLINES, TICKS & LOGARITHMIC SCALE          */}
      {/* ======================================================== */}
      {subTab === 'grid' && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* Scientific Ticks & Scale */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <span className="text-xs font-bold text-foreground block">
              Journal Ticks, Scale & Baseline
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Tick Marks</label>
                <select
                  value={axisTickDirection}
                  onChange={(e) => setAxisTickDirection(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="outside">Outward (Journal Standard)</option>
                  <option value="inside">Inward (Compact)</option>
                  <option value="none">None (Borderless)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Value Scale</label>
                <select
                  value={axisScaleType}
                  onChange={(e) => setAxisScaleType(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
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
                  <span>Show Baseline Border</span>
                </label>
              </div>
            </div>
          </div>

          {/* Publishing Gridlines */}
          <div className="p-3 bg-card/40 rounded-xl border border-border/60 space-y-2.5">
            <span className="text-xs font-bold text-foreground block">
              Publishing Background Gridlines
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="space-y-1 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground pb-1">
                  <input
                    type="checkbox"
                    checked={showGridLinesY}
                    onChange={(e) => setShowGridLinesY(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  <span>Horizontal (Y-Grid)</span>
                </label>
              </div>

              <div className="space-y-1 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground pb-1">
                  <input
                    type="checkbox"
                    checked={showGridLinesX}
                    onChange={(e) => setShowGridLinesX(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  <span>Vertical (X-Grid)</span>
                </label>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Line Pattern</label>
                <select
                  value={gridLineStyle}
                  onChange={(e) => setGridLineStyle(e.target.value as AxisGridLineStyle)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="dashed">Dashed Pattern</option>
                  <option value="solid">Solid Line</option>
                  <option value="dotted">Dotted Line</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground block">Grid Opacity ({gridLineOpacity}%)</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={gridLineOpacity}
                  onChange={(e) => setGridLineOpacity(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
