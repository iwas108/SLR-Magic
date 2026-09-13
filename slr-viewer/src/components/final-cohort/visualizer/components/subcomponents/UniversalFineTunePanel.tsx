import React, { useState, useMemo } from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';
import { 
  Sliders, 
  Palette, 
  Tag, 
  Grid, 
  Layers, 
  Maximize2, 
  ChevronsDown, 
  ChevronsUp,
  RotateCcw
} from 'lucide-react';
import { CollapsibleToolbox } from './CollapsibleToolbox';
import { UniversalPaletteFontPanel } from './UniversalPaletteFontPanel';
import { UniversalDataLabelPanel } from './UniversalDataLabelPanel';
import { ScientificAxisConfigPanel } from './ScientificAxisConfigPanel';
import { UniversalLegendConfigPanel } from './UniversalLegendConfigPanel';
import { UniversalLayoutMarginPanel } from './UniversalLayoutMarginPanel';

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
import { DEFAULT_SUNBURST_LEVEL_CONFIGS, DEFAULT_TREEMAP_LEVEL_CONFIGS } from '../../constants/defaultConfigs';

export function UniversalFineTunePanel() {
  const { config, style } = useVisualizerContext();
  const { chartType, showDataLabels, setShowDataLabels, legendPosition } = config;
  const { themePreset, fontFamily } = style;
  const chartInfo = CHART_TYPES_INFO[chartType];

  const isDedicatedHorizontalBarScatter = chartType === 'horizontal_bar_scatter';

  // Determine chart-specific feature support
  const hasCartesianAxes = useMemo(() => [
    'bar_vertical',
    'bar_horizontal',
    'horizontal_bar_scatter',
    'clustered_bar',
    'stacked_bar',
    'line',
    'heatmap',
    'boxplot',
    'scatter',
    'bubble'
  ].includes(chartType), [chartType]);

  const hasDataLabels = useMemo(() => [
    'bar_vertical',
    'bar_horizontal',
    'horizontal_bar_scatter',
    'clustered_bar',
    'stacked_bar',
    'line',
    'pie_donut',
    'funnel',
    'heatmap',
    'sunburst',
    'treemap',
    'scatter',
    'bubble',
    'radar',
    'graph'
  ].includes(chartType), [chartType]);

  const hasLegend = chartType !== 'gauge' && chartType !== 'sankey';

  // Collapsible Toolboxes Open States (Premiere Effect Controls style)
  const [openToolboxes, setOpenToolboxes] = useState<Record<string, boolean>>({
    palette: true,
    geometry: true,
    labels: false,
    axes: false,
    legend: false,
    margins: false
  });

  const toggleToolbox = (id: string) => {
    setOpenToolboxes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    setOpenToolboxes({
      palette: true,
      geometry: true,
      labels: true,
      axes: true,
      legend: true,
      margins: true
    });
  };

  const collapseAll = () => {
    setOpenToolboxes({
      palette: false,
      geometry: false,
      labels: false,
      axes: false,
      legend: false,
      margins: false
    });
  };

  return (
    <div className="space-y-3">
      {/* Studio Header Toolbar: Premiere-style Expand/Collapse All */}
      <div className="flex items-center justify-between pb-1 px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Sliders className="w-3 h-3 text-primary" />
            Effect Controls
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
            {chartInfo?.name || 'Chart'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={expandAll}
            className="px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
            title="Expand all toolboxes"
          >
            <ChevronsDown className="w-3 h-3" />
            <span className="hidden sm:inline">Expand All</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
            title="Collapse all toolboxes"
          >
            <ChevronsUp className="w-3 h-3" />
            <span className="hidden sm:inline">Collapse All</span>
          </button>
        </div>
      </div>

      {/* 1. Academic Palette & Global Typography Toolbox */}
      <CollapsibleToolbox
        id="palette"
        title="Color & Typography"
        icon={Palette}
        isOpen={openToolboxes.palette ?? true}
        onToggle={() => toggleToolbox('palette')}
        summaryBadge={`${themePreset || 'Academic'} • ${fontFamily || 'Default'}`}
        onReset={() => {
          style.setThemePreset('academic_grayscale');
          style.setFontFamily('roboto');
          style.setFontSize(12);
          style.setShowChartTitle(false);
          style.setShowChartSubtitle(false);
        }}
      >
        <UniversalPaletteFontPanel embedded={true} />
      </CollapsibleToolbox>

      {/* 2. Dedicated Per-Chart Geometry & Mechanics Toolbox */}
      <CollapsibleToolbox
        id="geometry"
        title={`${chartInfo?.name || 'Chart'} Geometry & Mechanics`}
        icon={Sliders}
        isOpen={openToolboxes.geometry ?? true}
        onToggle={() => toggleToolbox('geometry')}
        summaryBadge={chartInfo?.name || chartType}
        onReset={() => {
          if (chartType === 'bar_vertical') {
            config.updateActiveSlot({ barThickness: 28, barBorderRadius: 2, barGap: 30, barSorting: 'desc' });
          } else if (chartType === 'bar_horizontal') {
            config.updateActiveSlot({ barThickness: 24, barBorderRadius: 2, barSorting: 'desc' });
          } else if (chartType === 'horizontal_bar_scatter') {
            config.updateActiveSlot({ barThickness: 24, barBorderRadius: 4, barSorting: 'desc', scatterSymbolSize: 14, scatterSymbol: 'diamond' });
          } else if (chartType === 'clustered_bar') {
            config.updateActiveSlot({ barThickness: 22, barBorderRadius: 2, barGap: 20, barSorting: 'desc' });
          } else if (chartType === 'stacked_bar') {
            config.updateActiveSlot({ barThickness: 26, barBorderRadius: 2, barGap: 24, barSorting: 'desc' });
          } else if (chartType === 'line') {
            config.updateActiveSlot({ lineWidth: 2.5, smoothLine: true, lineMarkerSize: 4, lineAreaOpacity: 0 });
          } else if (chartType === 'pie_donut') {
            config.updateActiveSlot({ donutRatio: 50, roseType: 'none', pieCornerRadius: 4, piePadAngle: 2 });
          } else if (chartType === 'sankey') {
            config.updateActiveSlot({ sankeyNodeWidth: 20, sankeyNodeGap: 18, sankeyCurveness: 0.5, sankeyLinkOpacity: 45, sankeyOrient: 'horizontal', sankeyNodeAlign: 'justify' });
          } else if (chartType === 'sunburst') {
            config.updateActiveSlot({ sunburstLevelConfigs: { ...DEFAULT_SUNBURST_LEVEL_CONFIGS }, sunburstSort: 'desc', sunburstNodeClick: 'rootToNode', sunburstEmphasisFocus: 'ancestor' });
          } else if (chartType === 'treemap') {
            config.updateActiveSlot({ treemapLevelConfigs: { ...DEFAULT_TREEMAP_LEVEL_CONFIGS }, treemapRoam: false });
          } else if (chartType === 'heatmap') {
            config.updateActiveSlot({ heatmapCellRadius: 4, heatmapColorPreset: 'academic' });
          } else if (chartType === 'radar') {
            config.updateActiveSlot({ radarShape: 'polygon', radarSplitNumber: 5, radarLineWidth: 2, radarAreaOpacity: 25 });
          } else if (chartType === 'funnel') {
            config.updateActiveSlot({ funnelAlign: 'center', funnelGap: 2, funnelNeckWidth: 30, funnelNeckHeight: 25 });
          } else if (chartType === 'boxplot') {
            config.updateActiveSlot({ boxplotOrientation: 'vertical', boxplotBoxWidth: 28, boxplotShowScatter: true });
          } else if (chartType === 'scatter') {
            config.updateActiveSlot({ scatterPointSize: 10, scatterPointOpacity: 85, scatterShowRegression: false });
          } else if (chartType === 'bubble') {
            config.updateActiveSlot({ bubbleScale: 1.2, bubbleOpacity: 85, bubbleMinRadius: 12, bubbleMaxRadius: 65, bubbleBorderWidth: 1.5 });
          } else if (chartType === 'graph') {
            config.updateActiveSlot({ graphRepulsion: 120, graphEdgeLength: 60, graphGravity: 0.1 });
          } else if (chartType === 'gauge') {
            config.updateActiveSlot({ gaugeMaxScale: 100, gaugePointerWidth: 8, gaugeDialWidth: 12 });
          } else if (chartType === 'calendar') {
            config.updateActiveSlot({ calendarCellSize: 18 });
          }
        }}
      >
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
      </CollapsibleToolbox>

      {/* 3. Data Labels & Direct Callouts Toolbox */}
      {hasDataLabels && (
        <CollapsibleToolbox
          id="labels"
          title="Data Labels & Callouts"
          icon={Tag}
          isOpen={openToolboxes.labels ?? false}
          onToggle={() => toggleToolbox('labels')}
          summaryBadge={showDataLabels ? 'Enabled' : 'Disabled'}
          toggleSwitch={{
            checked: !!showDataLabels,
            onChange: (checked) => setShowDataLabels(checked),
            label: 'Show Labels'
          }}
          onReset={() => {
            setShowDataLabels(false);
            config.setLabelFormat('ratio_percent');
            config.setUniversalLabelPosition('auto');
            config.setUniversalLabelDistance(6);
            config.setUniversalLabelRotate(0);
          }}
        >
          <UniversalDataLabelPanel embedded={true} />
        </CollapsibleToolbox>
      )}

      {/* 4. Scientific Axis & Publishing Gridlines Toolbox */}
      {hasCartesianAxes && (
        <CollapsibleToolbox
          id="axes"
          title="Axes & Scientific Gridlines"
          icon={Grid}
          isOpen={openToolboxes.axes ?? false}
          onToggle={() => toggleToolbox('axes')}
          summaryBadge="Cartesian X/Y"
          onReset={() => {
            config.setAxisScaleType('linear');
            config.setShowAxisBaseline(true);
            config.setCustomAxisTitleX('');
            config.setCustomAxisTitleY('');
            config.setShowGridLinesX(false);
            config.setShowGridLinesY(true);
            config.setGridLineStyle('dashed');
          }}
        >
          <ScientificAxisConfigPanel embedded={true} />
        </CollapsibleToolbox>
      )}

      {/* 5. Universal Legend & Keys Configurator Toolbox */}
      {hasLegend && (
        <CollapsibleToolbox
          id="legend"
          title="Legend & Series Keys"
          icon={Layers}
          isOpen={openToolboxes.legend ?? false}
          onToggle={() => toggleToolbox('legend')}
          summaryBadge={config.showLegend ? (legendPosition ? `Position: ${legendPosition}` : 'Visible') : 'Hidden'}
          toggleSwitch={{
            checked: !!config.showLegend,
            onChange: (checked) => config.setShowLegend(checked),
            label: 'Show Legend'
          }}
          onReset={() => {
            config.setShowLegend(true);
            config.setLegendPosition('top');
            config.setLegendFontFamily('inherit');
            config.setLegendFontSize(10);
            config.setLegendItemGap(12);
            config.setLegendDistance(20);
          }}
        >
          <UniversalLegendConfigPanel embedded={true} />
        </CollapsibleToolbox>
      )}

      {/* 6. Universal Canvas Layout & Margins Toolbox */}
      <CollapsibleToolbox
        id="margins"
        title="Canvas Layout & Margins"
        icon={Maximize2}
        isOpen={openToolboxes.margins ?? false}
        onToggle={() => toggleToolbox('margins')}
        summaryBadge="Padding & Margins"
        onReset={() => {
          config.setGridMarginAuto(true);
          config.setGridMarginTop(45);
          config.setGridMarginBottom(45);
          config.setGridMarginLeft(60);
          config.setGridMarginRight(45);
        }}
      >
        <UniversalLayoutMarginPanel />
      </CollapsibleToolbox>
    </div>
  );
}
