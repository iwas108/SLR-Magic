import { 
  ArrowLeft, 
  ArrowRight, 
  Palette, 
  RotateCcw, 
  Save, 
  Upload, 
  X,
  LayoutGrid,
  Zap
} from 'lucide-react';
import { CHART_TYPES_INFO } from '../constants/chartTypes';
import { THEME_PALETTES } from '../constants/themePalettes';
import { FONT_FAMILIES } from '../constants/fontFamilies';
import { CUSTOM_GROUPING_KEY } from '../constants/defaultConfigs';
import { getNodeColor } from '../utils/colorUtils';
import { useVisualizerContext } from '../context/VisualizerContext';
import { SlotSwitcherBar } from './subcomponents/SlotSwitcherBar';
import { SunburstLevelConfigPanel } from './subcomponents/SunburstLevelConfigPanel';
import { HorizontalBarConfigPanel } from './subcomponents/HorizontalBarConfigPanel';
import { ClusteredBarConfigPanel } from './subcomponents/ClusteredBarConfigPanel';
import { ScientificAxisConfigPanel } from './subcomponents/ScientificAxisConfigPanel';
import { 
  VerticalBarConfigPanel, 
  StackedBarConfigPanel, 
  LineConfigPanel, 
  TreemapConfigPanel, 
  HeatmapConfigPanel, 
  RadarConfigPanel, 
  FunnelConfigPanel, 
  BoxplotConfigPanel, 
  GraphConfigPanel, 
  GaugeConfigPanel, 
  CalendarConfigPanel,
  ScatterBubbleConfigPanel 
} from './subcomponents/ChartConfigPanels';
import { LiveSplitPreview } from './subcomponents/LiveSplitPreview';
import { formatMetricDisplay } from '../utils/formatterUtils';
import type { ThemePreset, FontFamily, SubfigureLabelStyle } from '../types';

export function Step3StyleCustomization() {
  const { props, layout, config, style, data, presets, workspace } = useVisualizerContext();
  const { papers, umbrellanizerMap } = props;
  const { layoutMode } = layout;
  const { showLivePreview } = workspace;
  const {
    chartType,
    setCurrentStep,
    sankeyFields,
    sankeyLabelPositions,
    setSankeyLabelPositions,
    showLegend,
    setShowLegend,
    legendPosition,
    setLegendPosition,
    showDataLabels,
    setShowDataLabels,
    labelRotation,
    setLabelRotation,
    donutRatio,
    setDonutRatio,
    smoothLine,
    setSmoothLine,
    sankeyNodeWidth,
    setSankeyNodeWidth,
    sankeyNodeGap,
    setSankeyNodeGap,
    sankeyLeftPadding,
    setSankeyLeftPadding,
    sankeyRightPadding,
    setSankeyRightPadding,
    bubbleScale,
    setBubbleScale,
    gaugeMaxScale,
    setGaugeMaxScale,
    legendFormat,
    setLegendFormat,
    barLegendFormat,
    setBarLegendFormat,
    barLegendPosition,
    setBarLegendPosition,
    sunburstLegendLevel,
    setSunburstLegendLevel,
    sunburstLegendFormat,
    setSunburstLegendFormat,
    sunburstLegendPosition,
    setSunburstLegendPosition,
    pieLabelPlacement,
    setPieLabelPlacement,
    pieRadiusRatio,
    setPieRadiusRatio,
    pieLabelWidth,
    setPieLabelWidth,
    pieLeaderLineLength,
    setPieLeaderLineLength,
    pieLeaderLineLength2,
    setPieLeaderLineLength2,
    pieLabelDistance,
    setPieLabelDistance,
    pieLineHeight,
    setPieLineHeight,
    legendDistance,
    setLegendDistance,
    legendWidth,
    setLegendWidth,
    legendLineHeight,
    setLegendLineHeight,
    legendItemGap,
    setLegendItemGap,
    legendFontSize,
    setLegendFontSize,
    legendOverflow,
    setLegendOverflow
  } = config;

  const {
    chartTitle,
    setChartTitle,
    chartSubtitle,
    setChartSubtitle,
    showChartTitle,
    setShowChartTitle,
    showChartSubtitle,
    setShowChartSubtitle,
    themePreset,
    setThemePreset,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    subfigureLabelStyle,
    setSubfigureLabelStyle,
    panelGutter,
    setPanelGutter,
    showPanelBorders,
    setShowPanelBorders
  } = style;

  const {
    detectedCategories,
    customSliceColors,
    setCustomSliceColors
  } = data;

  const {
    handleExportPreset,
    handleImportPreset
  } = presets;

  const chartInfo = CHART_TYPES_INFO[chartType];

  return (
    <div className={`flex-1 overflow-hidden w-full h-full ${showLivePreview ? 'flex flex-col lg:flex-row' : 'flex flex-col'}`}>
      <div className={`flex-1 overflow-y-auto p-6 flex flex-col items-center mx-auto w-full space-y-6 ${showLivePreview ? 'max-w-4xl' : 'max-w-5xl'}`}>
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-0.5">
            <h3 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Step 3: Customize Publication Style
            </h3>
            <p className="text-xs text-muted-foreground">
              Tailor journal themes, high-contrast scientific palettes, typography, and chart parameters.
            </p>
          </div>

          <button
            type="button"
            onClick={() => config.handleAutoOptimizeActiveSlot(papers, umbrellanizerMap)}
            className="px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all hover:scale-105 shrink-0"
            title="Automatically compute best layout, orientation, axis width, sorting and radius parameters for this chart"
          >
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            Smart Auto-Optimize
          </button>
        </div>

        <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        
        {/* Global Title and Subtitle Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground block">Figure Main Title</label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showChartTitle}
                  onChange={(e) => setShowChartTitle(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                Show Title
              </label>
            </div>
            <input
              type="text"
              value={chartTitle}
              disabled={!showChartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary disabled:opacity-40"
              placeholder="e.g. Systematic Literature Review Synthesis"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground block">Figure Subtitle / Caption</label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showChartSubtitle}
                  onChange={(e) => setShowChartSubtitle(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                Show Subtitle
              </label>
            </div>
            <input
              type="text"
              value={chartSubtitle}
              disabled={!showChartSubtitle}
              onChange={(e) => setChartSubtitle(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary disabled:opacity-40"
              placeholder="e.g. Synthesis across 45 included studies (2018–2025)"
            />
          </div>
        </div>

        {/* Multi-Block Academic Subfigure & Layout Settings */}
        {layoutMode !== 'single' && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Multi-Panel Academic Formatting</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Subfigure Labeling Style</label>
                <select
                  value={subfigureLabelStyle}
                  onChange={(e) => setSubfigureLabelStyle(e.target.value as SubfigureLabelStyle)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="paren_lower">(a), (b), (c), (d) — ACM / IEEE Standard</option>
                  <option value="paren_upper">(A), (B), (C), (D) — Nature / Science Standard</option>
                  <option value="bold_upper">A, B, C, D — Bold Letter Prefix</option>
                  <option value="fig_prefix">Fig. 1a, Fig. 1b — Direct Figure Citation</option>
                  <option value="none">None (Hide Subfigure Badges)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Panel Gutter Spacing ({panelGutter}px)</label>
                <input
                  type="range"
                  min={8}
                  max={32}
                  step={4}
                  value={panelGutter}
                  onChange={(e) => setPanelGutter(Number(e.target.value))}
                  className="w-full accent-primary mt-2"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={showPanelBorders}
                    onChange={(e) => setShowPanelBorders(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  Show Subtle Panel Divider Borders
                </label>
                <span className="text-[10px] text-muted-foreground pl-5 block">
                  Outlines individual subfigures cleanly for print.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Scientific Theme & Palette Grid */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
            Academic Journal Theme & Palette (16 Curated Scientific Palettes)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(THEME_PALETTES) as [ThemePreset, typeof THEME_PALETTES[ThemePreset]][]).map(([key, pal]) => {
              const isSelected = themePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setThemePreset(key)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                      : 'border-border bg-card hover:bg-secondary/40'
                  }`}
                >
                  <div className="space-y-1 pb-2">
                    <span className={`text-xs font-bold block ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {pal.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">{pal.subtext}</span>
                  </div>

                  <div className="flex items-center gap-1 h-3.5 w-full rounded overflow-hidden">
                    {pal.colors.slice(0, 6).map((c: string, i: number) => (
                      <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Typography & Font Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-secondary/20 border border-border/80 rounded-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">Typography Style</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as FontFamily)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
            >
              {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([k, f]) => (
                <option key={k} value={k}>{f.name} — {f.useCase}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">Base Font Size ({fontSize}px)</label>
            <input
              type="range"
              min={10}
              max={20}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-primary mt-2"
            />
          </div>
        </div>

        {/* Reviewer Statistical Precision & Granularity Settings */}
        <div className="p-5 bg-card border border-primary/30 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-foreground block">
                  Peer Reviewer Statistical Granularity (Cohort N = {papers.length})
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Tackle reviewer demand by replacing pseudo-precise decimals with coarse rounding and absolute count ratios.
                </span>
              </div>
            </div>
            {papers.length <= 30 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-bold">
                Small Sample Mode (N ≤ 30)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Decimal Precision</label>
              <select
                value={style.decimalPrecision}
                onChange={(e) => style.setDecimalPrecision(Number(e.target.value) as any)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value={0}>0 Decimals — Coarse Integers (~6%) [Reviewer Standard]</option>
                <option value={1}>1 Decimal Place (6.1%)</option>
                <option value={2}>2 Decimal Places (6.11%) [Legacy]</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Ratio Format Style</label>
              <select
                value={style.ratioStyle}
                onChange={(e) => style.setRatioStyle(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="n_over_N">n = x/N (e.g. n = 11/18)</option>
                <option value="fraction">x/N (e.g. 11/18)</option>
                <option value="bracketed">(x/N) (e.g. (11/18))</option>
              </select>
            </div>

            <div className="space-y-2 flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={style.useTildeForCoarse}
                  onChange={(e) => style.setUseTildeForCoarse(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                Approx Tilde (~) on 0 Decimals
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={style.forceCohortDenominator}
                  onChange={(e) => style.setForceCohortDenominator(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                Force Cohort Papers N={papers.length} for Tag Share
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Global Default Value Label Format</label>
              <select
                value={style.defaultLabelFormat}
                onChange={(e) => style.setDefaultLabelFormat(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <optgroup label="Standard (Follows Chart Metric)">
                  <option value="ratio_percent">Ratio + Coarse % — n = 11/18, ~61% (Recommended)</option>
                  <option value="name_ratio_percent">Name + Ratio + Coarse % — Domain (n = 11/18, ~61%)</option>
                  <option value="percent_ratio">Coarse % + Ratio — ~61% (n = 11/18)</option>
                  <option value="ratio_only">Ratio Only — n = 11/18</option>
                  <option value="name_ratio">Name + Ratio — Domain (n = 11/18)</option>
                  <option value="count_percent">Count + Coarse % — n = 11 (~61%)</option>
                  <option value="percent_only">Percentage Only — ~61%</option>
                  <option value="count_only">Count Only — n = 11</option>
                  <option value="name_count">Name + Count — Domain (n = 11)</option>
                  <option value="name_percent">Name + Coarse % — Domain (~61%)</option>
                  <option value="name_count_percent">Name + Count + % — Domain (n = 11, ~61%)</option>
                  <option value="name_only">Name Only — Domain</option>
                </optgroup>
                <optgroup label="Explicit Tag Share (Denominator = Total Extracted Tags)">
                  <option value="tag_share_ratio_percent">Tag Share Ratio + % — n = 18/54, ~33%</option>
                  <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + % — Domain (n = 18/54, ~33%)</option>
                  <option value="tag_share_percent_ratio">Tag Share % + Ratio — ~33% (n = 18/54)</option>
                  <option value="tag_share_percent_only">Tag Share % Only — ~33%</option>
                  <option value="tag_share_ratio_only">Tag Share Ratio Only — n = 18/54</option>
                  <option value="tag_share_count_percent">Tag Count + % — n = 18 (~33%)</option>
                  <option value="name_tag_share_percent">Name + Tag Share % — Domain (~33%)</option>
                  <option value="name_tag_share_count_percent">Name + Tag Count + % — Domain (n = 18, ~33%)</option>
                </optgroup>
                <optgroup label="Explicit Paper Prevalence (Denominator = Total Cohort Papers)">
                  <option value="prevalence_ratio_percent">Prevalence Ratio + % — n = 18/46, ~39%</option>
                  <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + % — Domain (n = 18/46, ~39%)</option>
                  <option value="prevalence_percent_only">Prevalence % Only — ~39%</option>
                  <option value="prevalence_ratio_only">Prevalence Ratio Only — n = 18/46</option>
                </optgroup>
                <optgroup label="Dual / Combined Multi-Metric">
                  <option value="dual_prevalence_tag_share">Dual: n = 18/46 (~39%) | Tags: 18/54 (~33%)</option>
                </optgroup>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Global Default Legend Format</label>
              <select
                value={style.defaultLegendFormat}
                onChange={(e) => style.setDefaultLegendFormat(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <optgroup label="Standard (Follows Chart Metric)">
                  <option value="name_only">Name Only — Domain (Standard)</option>
                  <option value="name_ratio_percent">Name + Ratio + Coarse % — Domain (n = 11/18, ~61%)</option>
                  <option value="name_ratio">Name + Ratio — Domain (n = 11/18)</option>
                  <option value="name_count">Name + Count — Domain (n = 11)</option>
                  <option value="name_percent">Name + Coarse % — Domain (~61%)</option>
                  <option value="name_count_percent">Name + Count + % — Domain (n = 11, ~61%)</option>
                  <option value="ratio_percent">Ratio + Coarse % — n = 11/18, ~61%</option>
                </optgroup>
                <optgroup label="Explicit Tag Share (Denominator = Total Extracted Tags)">
                  <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + % — Domain (n = 18/54, ~33%)</option>
                  <option value="name_tag_share_percent">Name + Tag Share % — Domain (~33%)</option>
                  <option value="name_tag_share_count_percent">Name + Tag Count + % — Domain (n = 18, ~33%)</option>
                  <option value="tag_share_ratio_percent">Tag Share Ratio + % — n = 18/54, ~33%</option>
                  <option value="tag_share_percent_only">Tag Share % Only — ~33%</option>
                </optgroup>
                <optgroup label="Explicit Paper Prevalence (Denominator = Total Cohort Papers)">
                  <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + % — Domain (n = 18/46, ~39%)</option>
                  <option value="prevalence_ratio_percent">Prevalence Ratio + % — n = 18/46, ~39%</option>
                  <option value="prevalence_percent_only">Prevalence % Only — ~39%</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Live Preview Sample Banner */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <span className="font-bold text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              Live Reviewer Sample Preview:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-card border border-border font-mono font-bold text-foreground text-[11px]">
                Label: {formatMetricDisplay({
                  name: 'Industrial IoT',
                  count: 11,
                  paperCount: 11,
                  totalCohortPapers: papers.length || 18,
                  template: style.defaultLabelFormat,
                  decimalPrecision: style.decimalPrecision,
                  useTildeForCoarse: style.useTildeForCoarse,
                  ratioStyle: style.ratioStyle,
                  forceCohortDenominator: style.forceCohortDenominator
                })}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-card border border-border font-mono font-bold text-foreground text-[11px]">
                Legend: {formatMetricDisplay({
                  name: 'Industrial IoT',
                  count: 11,
                  paperCount: 11,
                  totalCohortPapers: papers.length || 18,
                  template: style.defaultLegendFormat,
                  decimalPrecision: style.decimalPrecision,
                  useTildeForCoarse: style.useTildeForCoarse,
                  ratioStyle: style.ratioStyle,
                  forceCohortDenominator: style.forceCohortDenominator
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Slot Switcher for Panel-Specific Styles */}
        {layoutMode !== 'single' && (
          <SlotSwitcherBar showSubtitleEdit={true} />
        )}

        {/* General Legend & Label Settings for Active Slot */}
        <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-4">
          <span className="text-[10px] font-extrabold uppercase text-primary block">
            Active Panel ({chartInfo.name}) Legend & Data Labels
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold text-foreground cursor-pointer">
                Show Legend
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  className="rounded border-border text-primary"
                />
              </label>
              {showLegend && chartType !== 'sunburst' && chartType !== 'bar_horizontal' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Legend Position</label>
                  <select
                    value={legendPosition}
                    onChange={(e) => setLegendPosition(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                  >
                    <option value="top">Top Center</option>
                    <option value="bottom">Bottom Center</option>
                    <option value="left">Left Side</option>
                    <option value="right">Right Side</option>
                  </select>
                </div>
              )}
            </div>

            {showLegend && chartType !== 'sunburst' && chartType !== 'bar_horizontal' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Legend Label Format</label>
                <select
                  value={legendFormat}
                  onChange={(e) => setLegendFormat(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                >
                  <optgroup label="Standard (Follows Chart Metric)">
                    <option value="name_only">Category Name Only</option>
                    <option value="name_ratio_percent">Name + Ratio + Coarse % (n=x/N, ~P%)</option>
                    <option value="name_ratio">Name + Ratio (n=x/N)</option>
                    <option value="name_count">Name + Count (n=X)</option>
                    <option value="name_percent">Name + Percent (~P%)</option>
                    <option value="name_count_percent">Name + Count + Percent (n=X, ~P%)</option>
                    <option value="ratio_percent">Ratio + Percent (n=x/N, ~P%)</option>
                  </optgroup>
                  <optgroup label="Explicit Tag Share (Total Extracted Tags Denominator)">
                    <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + % (n=x/TotalTags, ~P%)</option>
                    <option value="name_tag_share_percent">Name + Tag Share % (~P%)</option>
                    <option value="name_tag_share_count_percent">Name + Tag Count + % (n=x, ~P%)</option>
                    <option value="tag_share_ratio_percent">Tag Share Ratio + % (n=x/TotalTags, ~P%)</option>
                    <option value="tag_share_percent_only">Tag Share % Only (~P%)</option>
                  </optgroup>
                  <optgroup label="Explicit Paper Prevalence (Total Cohort Denominator)">
                    <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + % (n=x/CohortN, ~P%)</option>
                    <option value="prevalence_ratio_percent">Prevalence Ratio + % (n=x/CohortN, ~P%)</option>
                    <option value="prevalence_percent_only">Prevalence % Only (~P%)</option>
                  </optgroup>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold text-foreground cursor-pointer">
                Show Value Labels
                <input
                  type="checkbox"
                  checked={showDataLabels}
                  onChange={(e) => setShowDataLabels(e.target.checked)}
                  className="rounded border-border text-primary"
                />
              </label>
              {showDataLabels && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Active Slot Label Format Override</label>
                  <select
                    value={config.labelFormat}
                    onChange={(e) => config.setLabelFormat(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                  >
                    <optgroup label="Standard (Follows Chart Metric)">
                      <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
                      <option value="name_ratio_percent">Name + Ratio + % (Domain, n = x/N, ~P%)</option>
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
                      <option value="name_tag_share_percent">Name + Tag Share %</option>
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
              )}
            </div>

            {['bar_vertical', 'clustered_bar', 'line', 'stacked_bar', 'heatmap', 'boxplot'].includes(chartType) && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Label Rotation Angle</label>
                <select
                  value={labelRotation}
                  onChange={(e) => setLabelRotation(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-semibold"
                >
                  <option value={0}>0° (Horizontal)</option>
                  <option value={30}>30° Inclined</option>
                  <option value={45}>45° Inclined</option>
                  <option value={90}>90° Vertical</option>
                </select>
              </div>
            )}
            {showLegend && (
              <div className="space-y-1.5 sm:col-span-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <label>Legend Distance to Main Chart ({legendDistance ?? 20}px)</label>
                </div>
                <input
                  type="range"
                  min={5}
                  max={120}
                  value={legendDistance ?? 20}
                  onChange={(e) => setLegendDistance(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[
                    { label: 'Edge', val: 10 },
                    { label: 'Standard', val: 20 },
                    { label: 'Spaced', val: 45 },
                    { label: 'Close to Chart', val: 75 }
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setLegendDistance(preset.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        (legendDistance ?? 20) === preset.val 
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'bg-card text-muted-foreground border-border hover:text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Advanced Legend Typography & Text Wrapping Controls */}
          {showLegend && (
            <div className="p-3.5 bg-card/60 border border-border/80 rounded-xl space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <span>📐 Legend Typography, Width & Multi-line Wrapping</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Width: {legendWidth ? `${legendWidth}px` : 'Auto'} | Line Height: {legendLineHeight ?? 15}px | Gap: {legendItemGap ?? 12}px
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. Legend Text Width */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <label>Legend Text Width ({legendWidth ? `${legendWidth}px` : 'Auto / Natural'})</label>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={400}
                    step={10}
                    value={legendWidth || 0}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLegendWidth(v > 0 ? v : undefined);
                    }}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                    {[
                      { label: 'Auto', val: undefined },
                      { label: '140px', val: 140 },
                      { label: '180px', val: 180 },
                      { label: '220px', val: 220 },
                      { label: '280px', val: 280 },
                      { label: '340px', val: 340 }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setLegendWidth(preset.val)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition-colors ${
                          legendWidth === preset.val 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Legend Line Height */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <label>Legend Line Height ({legendLineHeight ?? 15}px)</label>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={32}
                    value={legendLineHeight ?? 15}
                    onChange={(e) => setLegendLineHeight(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                    {[
                      { label: 'Tight', val: 12 },
                      { label: 'Standard', val: 15 },
                      { label: 'Relaxed', val: 18 },
                      { label: 'Spaced', val: 22 }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setLegendLineHeight(preset.val)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition-colors ${
                          (legendLineHeight ?? 15) === preset.val 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Legend Item Gap */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <label>Item Spacing / Gap ({legendItemGap ?? 12}px)</label>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={36}
                    value={legendItemGap ?? 12}
                    onChange={(e) => setLegendItemGap(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                    {[
                      { label: 'Compact', val: 6 },
                      { label: 'Standard', val: 12 },
                      { label: 'Spaced', val: 18 },
                      { label: 'Wide', val: 26 }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setLegendItemGap(preset.val)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition-colors ${
                          (legendItemGap ?? 12) === preset.val 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Legend Text Overflow Mode</label>
                  <select
                    value={legendOverflow || 'break'}
                    onChange={(e) => setLegendOverflow(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold"
                  >
                    <option value="break">Break Words (Multi-line text wrapping)</option>
                    <option value="truncate">Truncate with Ellipsis (...)</option>
                    <option value="none">Single Line (No wrapping / No overflow)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Legend Font Size</label>
                  <select
                    value={legendFontSize !== undefined ? legendFontSize : -1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLegendFontSize(v === -1 ? undefined : v);
                    }}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-semibold"
                  >
                    <option value={-1}>Inherit Base Font Size ({Math.max(9, fontSize - 1)}px)</option>
                    <option value={9}>9px — Fine Small</option>
                    <option value={10}>10px — Compact</option>
                    <option value={11}>11px — Standard Academic</option>
                    <option value={12}>12px — Medium</option>
                    <option value={13}>13px — Prominent</option>
                    <option value={14}>14px — Large</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Sunburst-specific legend controls */}
          {chartType === 'sunburst' && showLegend && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Legend Level</label>
                <select
                  value={sunburstLegendLevel}
                  onChange={(e) => setSunburstLegendLevel(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  {sankeyFields.map((fKey: string, lIdx: number) => (
                    <option key={lIdx} value={lIdx}>
                      Level {lIdx + 1} ({fKey === CUSTOM_GROUPING_KEY ? 'Custom Grouping' : fKey.startsWith('raw:ext:') ? `${fKey.substring(8)} (Raw)` : fKey.startsWith('ext:') ? fKey.substring(4) : fKey})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Legend Label Format</label>
                <select
                  value={sunburstLegendFormat}
                  onChange={(e) => setSunburstLegendFormat(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="name">Category Name Only</option>
                  <option value="name_count">Name + Count (N=X)</option>
                  <option value="name_percent">Name + Percent (XX.X%)</option>
                  <option value="name_count_percent">Name + Count + Percent (N=X, XX.X%)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Legend Position</label>
                <select
                  value={sunburstLegendPosition}
                  onChange={(e) => setSunburstLegendPosition(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="top-left">Top-Left</option>
                  <option value="top-center">Top-Center</option>
                  <option value="top-right">Top-Right</option>
                  <option value="left">Left (Vertical)</option>
                  <option value="right">Right (Vertical)</option>
                  <option value="bottom-left">Bottom-Left</option>
                  <option value="bottom-center">Bottom-Center</option>
                  <option value="bottom-right">Bottom-Right</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Distance to Chart ({legendDistance ?? 20}px)</label>
                <input
                  type="range"
                  min={5}
                  max={120}
                  value={legendDistance ?? 20}
                  onChange={(e) => setLegendDistance(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Bar specific legend controls */}
          {['bar_horizontal', 'clustered_bar'].includes(chartType) && showLegend && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Legend Label Format</label>
                <select
                  value={barLegendFormat}
                  onChange={(e) => setBarLegendFormat(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="name">Category/Series Name Only</option>
                  <option value="name_count">Name + Paper Count (N=X)</option>
                  <option value="name_percent">Name + Prevalence % (XX.X%)</option>
                  <option value="name_count_percent">Name + Count + Percent (N=X, XX.X%)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Legend Position</label>
                <select
                  value={barLegendPosition}
                  onChange={(e) => setBarLegendPosition(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="top-left">Top-Left</option>
                  <option value="top-center">Top-Center</option>
                  <option value="top-right">Top-Right</option>
                  <option value="left">Left (Vertical)</option>
                  <option value="right">Right (Vertical)</option>
                  <option value="bottom-left">Bottom-Left</option>
                  <option value="bottom-center">Bottom-Center</option>
                  <option value="bottom-right">Bottom-Right</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Specific Chart Type Parameters for Active Slot */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-primary block">
              {chartInfo.name} Specific Parameters
            </span>
            <button
              type="button"
              onClick={() => config.handleAutoOptimizeActiveSlot(papers, umbrellanizerMap)}
              className="text-[10px] font-extrabold text-primary hover:underline flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-primary animate-pulse" />
              Auto-Tune Parameters
            </button>
          </div>

          {chartType === 'bar_vertical' && (
            <VerticalBarConfigPanel />
          )}

          {chartType === 'bar_horizontal' && (
            <HorizontalBarConfigPanel />
          )}

          {chartType === 'clustered_bar' && (
            <div className="space-y-4">
              <ClusteredBarConfigPanel />
              <ScientificAxisConfigPanel />
            </div>
          )}

          {chartType === 'stacked_bar' && (
            <StackedBarConfigPanel />
          )}

          {chartType === 'sunburst' && (
            <SunburstLevelConfigPanel />
          )}

          {chartType === 'pie_donut' && (
            <div className="space-y-4">
              {/* Section 1: Chart Sizing & Proportions */}
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/40 space-y-3">
                <span className="text-xs font-bold text-foreground block flex items-center justify-between">
                  <span>📐 Chart Size & Radius</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Current Size: {pieRadiusRatio || 64}%</span>
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <label>Outer Radius / Chart Size ({pieRadiusRatio || 64}%)</label>
                    </div>
                    <input
                      type="range"
                      min={25}
                      max={85}
                      value={pieRadiusRatio || 64}
                      onChange={(e) => setPieRadiusRatio(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {[
                        { label: 'Compact', val: 45 },
                        { label: 'Standard', val: 60 },
                        { label: 'Large', val: 72 },
                        { label: 'Fill Canvas', val: 82 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setPieRadiusRatio(preset.val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            (pieRadiusRatio || 64) === preset.val 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-card text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <label>Donut Hole Radius ({donutRatio}%)</label>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={donutRatio}
                      onChange={(e) => setDonutRatio(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {[
                        { label: 'Solid Pie', val: 0 },
                        { label: 'Standard', val: 50 },
                        { label: 'Thin Ring', val: 75 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setDonutRatio(preset.val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            donutRatio === preset.val 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-card text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Distance Between Chart and Label */}
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/40 space-y-3">
                <span className="text-xs font-bold text-foreground block flex items-center justify-between">
                  <span>📏 Distance Between Chart & Label</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Leader Line: {pieLeaderLineLength ?? 12}px</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Leader Line Length / Distance to Label ({pieLeaderLineLength ?? 12}px)
                    </label>
                    <input
                      type="range"
                      min={2}
                      max={50}
                      value={pieLeaderLineLength ?? 12}
                      onChange={(e) => setPieLeaderLineLength(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {[
                        { label: 'Tight', val: 5 },
                        { label: 'Normal', val: 12 },
                        { label: 'Spaced', val: 24 },
                        { label: 'Extended', val: 38 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setPieLeaderLineLength(preset.val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            (pieLeaderLineLength ?? 12) === preset.val 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-card text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Leader Line Horizontal Elbow Gap ({pieLeaderLineLength2 ?? 14}px)
                    </label>
                    <input
                      type="range"
                      min={2}
                      max={40}
                      value={pieLeaderLineLength2 ?? 14}
                      onChange={(e) => setPieLeaderLineLength2(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>2px (Minimal)</span>
                      <span>14px (Standard)</span>
                      <span>40px (Wide)</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Slice Label Placement</label>
                    <select
                      value={pieLabelPlacement}
                      onChange={(e) => setPieLabelPlacement(e.target.value as any)}
                      className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                    >
                      <option value="outside">Outer with Leader Lines (Standard)</option>
                      <option value="inside">Inside Slices (Compact)</option>
                      <option value="edge_aligned">Edge-Aligned (Clean Bounding Box)</option>
                      <option value="legend_only">Legend Only (No Slice Labels)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">
                      Label Line Height ({pieLineHeight ?? 15}px)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={32}
                      value={pieLineHeight ?? 15}
                      onChange={(e) => setPieLineHeight(Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex items-center gap-1 pt-0.5">
                      {[
                        { label: 'Tight', val: 12 },
                        { label: 'Standard', val: 15 },
                        { label: 'Relaxed', val: 20 },
                        { label: 'Spaced', val: 26 }
                      ].map(preset => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setPieLineHeight(preset.val)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            (pieLineHeight ?? 15) === preset.val 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-card text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {pieLabelPlacement !== 'inside' && pieLabelPlacement !== 'legend_only' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-foreground block">Outer Label Max Width ({pieLabelWidth}px)</label>
                      <input
                        type="range"
                        min={80}
                        max={280}
                        step={10}
                        value={pieLabelWidth}
                        onChange={(e) => setPieLabelWidth(Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                        <span>80px (Narrow)</span>
                        <span>140px (Standard)</span>
                        <span>280px (Wide)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {chartType === 'line' && (
            <LineConfigPanel />
          )}

          {chartType === 'treemap' && (
            <TreemapConfigPanel />
          )}

          {chartType === 'heatmap' && (
            <HeatmapConfigPanel />
          )}

          {chartType === 'radar' && (
            <RadarConfigPanel />
          )}

          {chartType === 'funnel' && (
            <FunnelConfigPanel />
          )}

          {chartType === 'boxplot' && (
            <BoxplotConfigPanel />
          )}

          {chartType === 'graph' && (
            <GraphConfigPanel />
          )}

          {chartType === 'calendar' && (
            <CalendarConfigPanel />
          )}

          {chartType === 'sankey' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Node Width ({sankeyNodeWidth}px)</label>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    value={sankeyNodeWidth}
                    onChange={(e) => setSankeyNodeWidth(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Node Gap ({sankeyNodeGap}px)</label>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    value={sankeyNodeGap}
                    onChange={(e) => setSankeyNodeGap(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-primary/20">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Left Node Outer Margin Padding ({sankeyLeftPadding}%)</label>
                  <input
                    type="range"
                    min={2}
                    max={40}
                    value={sankeyLeftPadding}
                    onChange={(e) => setSankeyLeftPadding(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Right Node Outer Margin Padding ({sankeyRightPadding}%)</label>
                  <input
                    type="range"
                    min={2}
                    max={40}
                    value={sankeyRightPadding}
                    onChange={(e) => setSankeyRightPadding(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-primary/20">
                <label className="text-xs font-bold text-foreground block">
                  Per-Level Node Label Position (Left vs Right Alignment)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {sankeyFields.map((fieldVal: string, idx: number) => {
                    const currentPos = sankeyLabelPositions[idx] || (idx === sankeyFields.length - 1 ? 'left' : 'right');
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-secondary/40 border border-border rounded-lg">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[110px]" title={fieldVal}>
                          L{idx + 1}: {fieldVal.startsWith('raw:ext:') ? `${fieldVal.substring(8)} (Raw)` : fieldVal.startsWith('ext:') ? fieldVal.substring(4) : fieldVal}
                        </span>
                        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSankeyLabelPositions({ ...sankeyLabelPositions, [idx]: 'left' })}
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-colors ${
                              currentPos === 'left' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Left
                          </button>
                          <button
                            type="button"
                            onClick={() => setSankeyLabelPositions({ ...sankeyLabelPositions, [idx]: 'right' })}
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-colors ${
                              currentPos === 'right' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Right
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {['scatter', 'bubble'].includes(chartType) && (
            <ScatterBubbleConfigPanel />
          )}

          {chartType === 'gauge' && (
            <GaugeConfigPanel />
          )}
        </div>

        {/* Category & Slice Color Override Panel for Active Slot */}
        <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Slice & Category Color Customization</span>
            </div>
            {Object.keys(customSliceColors).length > 0 && (
              <button
                type="button"
                onClick={() => setCustomSliceColors({})}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Custom Colors
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Pick individual colors for category slices in the active panel. Overriding a parent category color applies shaded color gradients to child sectors.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {detectedCategories.map((cat: { name: string; parentName?: string; levelLabel: string }, idx: number) => {
              const currentColor = getNodeColor(cat.name, cat.parentName, idx, THEME_PALETTES[themePreset].colors);
              const isCustom = Boolean(customSliceColors[cat.name]);
              const isInherited = Boolean(!isCustom && cat.parentName && customSliceColors[cat.parentName]);

              return (
                <div key={`${cat.name}-${idx}`} className="flex items-center justify-between p-2 bg-card border border-border rounded-lg text-xs">
                  <div className="flex flex-col truncate max-w-[170px]">
                    <span className="font-bold text-foreground truncate" title={cat.name}>{cat.name}</span>
                    <span className="text-[9.5px] text-muted-foreground truncate">
                      {cat.levelLabel} {cat.parentName && `(Sub of ${cat.parentName})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isInherited && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        Shaded Parent
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 bg-secondary/50 border border-border rounded-md px-1.5 py-1">
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => {
                          const newColor = e.target.value;
                          setCustomSliceColors({ ...customSliceColors, [cat.name]: newColor });
                        }}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="font-mono text-[10px] uppercase font-bold text-foreground">{currentColor}</span>
                    </div>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => {
                          const copy = { ...customSliceColors };
                          delete copy[cat.name];
                          setCustomSliceColors(copy);
                        }}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title="Reset to theme color"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preset Manager Card */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-primary shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">Universal Visualization Presets</span>
              <span className="text-[11px] text-muted-foreground block">Save or import complete multi-block layout mappings & style definitions (.json)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPreset}
              className="px-3 py-1.5 bg-card border border-border text-foreground hover:bg-secondary rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-primary" />
              Save Preset (.json)
            </button>

            <label className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Import Preset
              <input
                type="file"
                accept=".json"
                onChange={handleImportPreset}
                className="hidden"
              />
            </label>
          </div>
        </div>

      </div>

      {/* Step 3 Footer */}
      <div className="w-full flex justify-between pt-2">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-5 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border border-border"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Data Mapping
        </button>
        <button
          onClick={() => setCurrentStep(4)}
          className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
        >
          Generate Composite Visualization
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      </div>

      {showLivePreview && <LiveSplitPreview />}
    </div>
  );
}
