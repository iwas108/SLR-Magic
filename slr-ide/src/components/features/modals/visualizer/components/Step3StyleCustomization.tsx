import React from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Palette, 
  RotateCcw, 
  Save, 
  Upload, 
  X,
  LayoutGrid
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
import { LiveSplitPreview } from './subcomponents/LiveSplitPreview';
import type { ThemePreset, FontFamily, SubfigureLabelStyle } from '../types';

export function Step3StyleCustomization() {
  const { layout, config, style, data, presets, workspace } = useVisualizerContext();
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
    setPieLabelWidth
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
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold text-foreground tracking-tight">Step 3: Customize Publication Style</h3>
          <p className="text-xs text-muted-foreground">
            Tailor journal themes, high-contrast scientific palettes, typography, and composite layout.
          </p>
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
                  <option value="name">Category Name Only</option>
                  <option value="name_count">Name + Count (N=X)</option>
                  <option value="name_percent">Name + Percent (XX.X%)</option>
                  <option value="name_count_percent">Name + Count + Percent (N=X, XX.X%)</option>
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
            </div>

            {['bar_vertical', 'line', 'stacked_bar', 'heatmap', 'boxplot'].includes(chartType) && (
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
          </div>

          {/* Sunburst-specific legend controls */}
          {chartType === 'sunburst' && showLegend && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Legend Level</label>
                <select
                  value={sunburstLegendLevel}
                  onChange={(e) => setSunburstLegendLevel(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  {sankeyFields.map((fKey: string, lIdx: number) => (
                    <option key={lIdx} value={lIdx}>
                      Level {lIdx + 1} ({fKey === CUSTOM_GROUPING_KEY ? 'Custom Grouping' : fKey.startsWith('ext:') ? fKey.substring(4) : fKey})
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
                  <option value="name">Name Only</option>
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
            </div>
          )}

          {/* Horizontal Bar specific legend controls */}
          {chartType === 'bar_horizontal' && showLegend && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Legend Label Format</label>
                <select
                  value={barLegendFormat}
                  onChange={(e) => setBarLegendFormat(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="name">Category Name Only</option>
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
          <span className="text-[10px] font-extrabold uppercase text-primary block">
            {chartInfo.name} Specific Parameters
          </span>

          {chartType === 'bar_horizontal' && (
            <HorizontalBarConfigPanel />
          )}

          {chartType === 'sunburst' && (
            <SunburstLevelConfigPanel />
          )}

          {chartType === 'pie_donut' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Donut Hole Radius ({donutRatio}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={75}
                    value={donutRatio}
                    onChange={(e) => setDonutRatio(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>0% (Solid Pie)</span>
                    <span>50% (Standard)</span>
                    <span>75% (Thin)</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Outer Radius Scale ({pieRadiusRatio}%)</label>
                  <input
                    type="range"
                    min={40}
                    max={65}
                    value={pieRadiusRatio}
                    onChange={(e) => setPieRadiusRatio(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>40% (Compact)</span>
                    <span>52% (Optimal)</span>
                    <span>65% (Large)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                {pieLabelPlacement !== 'inside' && pieLabelPlacement !== 'legend_only' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Outer Label Max Width ({pieLabelWidth}px)</label>
                    <input
                      type="range"
                      min={80}
                      max={240}
                      step={10}
                      value={pieLabelWidth}
                      onChange={(e) => setPieLabelWidth(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                      <span>80px (Narrow)</span>
                      <span>140px (Standard)</span>
                      <span>240px (Wide)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {chartType === 'line' && (
            <label className="flex items-center justify-between text-xs font-bold text-foreground cursor-pointer">
              Smooth Spline Curve
              <input
                type="checkbox"
                checked={smoothLine}
                onChange={(e) => setSmoothLine(e.target.checked)}
                className="rounded border-border text-primary"
              />
            </label>
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
                          L{idx + 1}: {fieldVal.startsWith('ext:') ? fieldVal.substring(4) : fieldVal}
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
            </div>
          )}

          {chartType === 'gauge' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Gauge Max Scale Target Value ({gaugeMaxScale})</label>
              <input
                type="number"
                min={10}
                max={1000}
                value={gaugeMaxScale}
                onChange={(e) => setGaugeMaxScale(Math.max(1, Number(e.target.value)))}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              />
            </div>
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
