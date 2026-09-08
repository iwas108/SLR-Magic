import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';
import { Sliders } from 'lucide-react';
import { UniversalPaletteFontPanel } from './UniversalPaletteFontPanel';

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
import { UniversalLayoutMarginPanel } from './UniversalLayoutMarginPanel';

export function UniversalFineTunePanel() {
  const { config } = useVisualizerContext();
  const { chartType } = config;
  const chartInfo = CHART_TYPES_INFO[chartType];

  const isDedicatedHorizontalBarScatter = chartType === 'horizontal_bar_scatter';

  const hasCartesianAxes = [
    'bar_vertical',
    'bar_horizontal',
    'clustered_bar',
    'stacked_bar',
    'line',
    'heatmap',
    'boxplot',
    'scatter',
    'bubble'
  ].includes(chartType);

  const hasLegend = chartType !== 'gauge' && !isDedicatedHorizontalBarScatter;

  return (
    <div className="space-y-4">
      {/* 1. Academic Palette & Global Typography (Available for Every Chart) */}
      <UniversalPaletteFontPanel />

      {/* 2. Dedicated Per-Chart Customization (100% Specific to Active Chart) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            {chartInfo?.name || 'Chart'} Customization
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">Chart Specific</span>
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

      {/* 3. Scientific Axis & Publishing Gridlines (For all Cartesian Charts) */}
      {hasCartesianAxes && <ScientificAxisConfigPanel />}

      {/* 4. Universal Legend & Keys Configurator */}
      {hasLegend && <UniversalLegendConfigPanel />}

      {/* 5. Universal Chart Margins & Canvas Padding */}
      {!isDedicatedHorizontalBarScatter && <UniversalLayoutMarginPanel />}
    </div>
  );
}
