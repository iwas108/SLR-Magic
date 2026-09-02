import React, { useState } from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';
import { THEME_PALETTES } from '../../constants/themePalettes';
import { FONT_FAMILIES } from '../../constants/fontFamilies';
import type { ThemePreset, FontFamily } from '../../types';
import { 
  Sliders, 
  Layers, 
  Layout, 
  Type, 
  Palette, 
  Grid, 
  Maximize2, 
  Check, 
  ChevronRight,
  Sparkles,
  AlignLeft,
  Move
} from 'lucide-react';

import {
  VerticalBarConfigPanel,
  StackedBarConfigPanel,
  LineConfigPanel,
  PieDonutConfigPanel,
  SankeyConfigPanel,
  TreemapConfigPanel,
  HeatmapConfigPanel,
  RadarConfigPanel,
  FunnelConfigPanel,
  BoxplotConfigPanel,
  ScatterConfigPanel,
  BubbleConfigPanel,
  GraphConfigPanel,
  GaugeConfigPanel,
  CalendarConfigPanel
} from './ChartConfigPanels';

import { HorizontalBarConfigPanel } from './HorizontalBarConfigPanel';
import { HorizontalBarScatterConfigPanel } from './HorizontalBarScatterConfigPanel';
import { ClusteredBarConfigPanel } from './ClusteredBarConfigPanel';
import { SunburstLevelConfigPanel } from './SunburstLevelConfigPanel';
import { ScientificAxisConfigPanel } from './ScientificAxisConfigPanel';
import { UniversalLegendConfigPanel } from './UniversalLegendConfigPanel';

export function UniversalFineTunePanel() {
  const { config, style, camera } = useVisualizerContext();
  const { chartType } = config;
  const chartInfo = CHART_TYPES_INFO[chartType];

  const {
    showChartTitle,
    setShowChartTitle,
    chartTitle,
    setChartTitle,
    showChartSubtitle,
    setShowChartSubtitle,
    chartSubtitle,
    setChartSubtitle,
    themePreset,
    setThemePreset,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize
  } = style;

  const { chartScale, setChartScale } = camera;

  const [activeSection, setActiveSection] = useState<'series' | 'axis' | 'legend' | 'style'>('series');

  const hasCartesianAxes = [
    'bar_vertical',
    'bar_horizontal',
    'horizontal_bar_scatter',
    'clustered_bar',
    'stacked_bar',
    'line',
    'scatter',
    'bubble',
    'boxplot',
    'heatmap'
  ].includes(chartType);

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-xl border border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSection('series')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSection === 'series'
              ? 'bg-card text-primary shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{chartInfo?.name.split(' (')[0] || 'Series'}</span>
        </button>

        {hasCartesianAxes && (
          <button
            type="button"
            onClick={() => setActiveSection('axis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeSection === 'axis'
                ? 'bg-card text-primary shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Axes & Scales</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveSection('legend')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSection === 'legend'
              ? 'bg-card text-primary shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>Legend & Keys</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('style')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
            activeSection === 'style'
              ? 'bg-card text-primary shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Typography & Palette</span>
        </button>
      </div>

      {/* 1. Series Parameters Section */}
      {activeSection === 'series' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              {chartInfo?.name} Specific Parameters
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Live Sync</span>
          </div>

          {chartType === 'bar_vertical' && <VerticalBarConfigPanel />}
          {chartType === 'bar_horizontal' && <HorizontalBarConfigPanel />}
          {chartType === 'horizontal_bar_scatter' && <HorizontalBarScatterConfigPanel />}
          {chartType === 'clustered_bar' && <ClusteredBarConfigPanel />}
          {chartType === 'stacked_bar' && <StackedBarConfigPanel />}
          {chartType === 'line' && <LineConfigPanel />}
          {chartType === 'pie_donut' && <PieDonutConfigPanel />}
          {chartType === 'sankey' && <SankeyConfigPanel />}
          {chartType === 'sunburst' && <SunburstLevelConfigPanel />}
          {chartType === 'treemap' && <TreemapConfigPanel />}
          {chartType === 'heatmap' && <HeatmapConfigPanel />}
          {chartType === 'radar' && <RadarConfigPanel />}
          {chartType === 'funnel' && <FunnelConfigPanel />}
          {chartType === 'boxplot' && <BoxplotConfigPanel />}
          {chartType === 'scatter' && <ScatterConfigPanel />}
          {chartType === 'bubble' && <BubbleConfigPanel />}
          {chartType === 'graph' && <GraphConfigPanel />}
          {chartType === 'gauge' && <GaugeConfigPanel />}
          {chartType === 'calendar' && <CalendarConfigPanel />}
        </div>
      )}

      {/* 2. Axes & Scales Section */}
      {activeSection === 'axis' && hasCartesianAxes && (
        <div className="space-y-4">
          <ScientificAxisConfigPanel />
        </div>
      )}

      {/* 3. Universal Legend & Keys Section */}
      {activeSection === 'legend' && (
        <div className="space-y-4">
          <UniversalLegendConfigPanel />
        </div>
      )}

      {/* 4. Universal Palette, Typography & Figure Titles Section */}
      {activeSection === 'style' && (
        <div className="space-y-5">
          {/* Global Font Family & Base Font Size */}
          <div className="p-3.5 bg-card border border-border rounded-2xl shadow-xs space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
              Global Typography & Base Sizing
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                  className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                >
                  {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([id, f]) => (
                    <option key={id} value={id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Base Font Size</label>
                  <span className="text-[10px] font-mono font-bold text-primary">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={32}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Figure Main Title Typography */}
          <div className="space-y-3 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Main Figure Title
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Display Title</label>
                <input
                  type="checkbox"
                  checked={showChartTitle}
                  onChange={(e) => setShowChartTitle(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-primary"
                />
              </div>
            </div>

            {showChartTitle && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">Title Text</label>
                  <input
                    type="text"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                    placeholder="Enter figure title..."
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Size ({style.titleFontSize}px)</label>
                    <input
                      type="range"
                      min={10}
                      max={36}
                      value={style.titleFontSize}
                      onChange={(e) => style.setTitleFontSize(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Weight</label>
                    <select
                      value={style.titleFontWeight}
                      onChange={(e) => style.setTitleFontWeight(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                    >
                      <option value="normal">Normal</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">SemiBold (600)</option>
                      <option value="bold">Bold (700)</option>
                      <option value="800">ExtraBold (800)</option>
                      <option value="900">Black (900)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Style</label>
                    <select
                      value={style.titleFontStyle}
                      onChange={(e) => style.setTitleFontStyle(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                    >
                      <option value="normal">Normal</option>
                      <option value="italic">Italic</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Align</label>
                    <select
                      value={style.titleAlign}
                      onChange={(e) => style.setTitleAlign(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                    >
                      <option value="center">Center</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Custom Title Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.titleColor || '#171717'}
                      onChange={(e) => style.setTitleColor(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={style.titleColor}
                      onChange={(e) => style.setTitleColor(e.target.value)}
                      placeholder="Auto / Default (#171717)"
                      className="flex-1 bg-secondary border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subtitle / Caption Typography */}
          <div className="space-y-3 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                Figure Subtitle / Caption
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Display Subtitle</label>
                <input
                  type="checkbox"
                  checked={showChartSubtitle}
                  onChange={(e) => setShowChartSubtitle(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-primary"
                />
              </div>
            </div>

            {showChartSubtitle && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">Subtitle Text</label>
                  <input
                    type="text"
                    value={chartSubtitle}
                    onChange={(e) => setChartSubtitle(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                    placeholder="Enter subtitle or methodological caption..."
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Size ({style.subtitleFontSize}px)</label>
                    <input
                      type="range"
                      min={8}
                      max={24}
                      value={style.subtitleFontSize}
                      onChange={(e) => style.setSubtitleFontSize(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Weight</label>
                    <select
                      value={style.subtitleFontWeight}
                      onChange={(e) => style.setSubtitleFontWeight(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                    >
                      <option value="normal">Normal (400)</option>
                      <option value="500">Medium (500)</option>
                      <option value="600">SemiBold (600)</option>
                      <option value="bold">Bold (700)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Style</label>
                    <select
                      value={style.subtitleFontStyle}
                      onChange={(e) => style.setSubtitleFontStyle(e.target.value as any)}
                      className="w-full bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                    >
                      <option value="normal">Normal</option>
                      <option value="italic">Italic</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Gap to Title ({style.titleGap}px)</label>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={style.titleGap}
                      onChange={(e) => style.setTitleGap(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Line Height ({style.subtitleLineHeight}px)</label>
                    <input
                      type="range"
                      min={10}
                      max={36}
                      value={style.subtitleLineHeight}
                      onChange={(e) => style.setSubtitleLineHeight(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground">Custom Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={style.subtitleColor || '#737373'}
                        onChange={(e) => style.setSubtitleColor(e.target.value)}
                        className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={style.subtitleColor}
                        onChange={(e) => style.setSubtitleColor(e.target.value)}
                        placeholder="Auto / Default (#737373)"
                        className="flex-1 bg-secondary border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Academic Color Palette */}
          <div className="space-y-2 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
              Academic Color Palette (16 Presets)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-1">
              {(Object.entries(THEME_PALETTES) as [ThemePreset, typeof THEME_PALETTES[ThemePreset]][]).map(([id, p]) => {
                const isSelected = themePreset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setThemePreset(id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-secondary/40 border-border hover:bg-secondary text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold block truncate">{p.name}</span>
                    <div className="flex items-center gap-1 mt-1.5">
                      {p.colors.slice(0, 5).map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
