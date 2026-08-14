import type * as echarts from 'echarts';
import { THEME_PALETTES } from '../constants/themePalettes';
import { resolveFontFamilyCss } from '../constants/fontFamilies';
import type { ChartType, ThemePreset, FontFamily, MetricMode, SunburstLevelConfig } from '../types';
import type { ChartGeneratorContext } from './types';

import {
  generateVerticalBarOption,
  generateHorizontalBarOption,
  generateStackedBarOption
} from './categoricalBarGenerators';
import { generateClusteredBarOption } from './clusteredBarGenerators';
import { generateLineOption } from './trendLineGenerators';
import { generatePieDonutOption } from './proportionsGenerators';
import {
  generateScatterOption,
  generateBubbleOption,
  generateBoxplotOption
} from './correlationGenerators';
import {
  generateTreemapOption,
  generateSankeyOption,
  generateSunburstOption
} from './hierarchicalGenerators';
import {
  generateHeatmapOption,
  generateCalendarOption
} from './matrixGenerators';
import {
  generateRadarOption,
  generateFunnelOption,
  generateGaugeOption,
  generateGraphOption
} from './kpiNetworkGenerators';

export * from './types';
export * from './categoricalBarGenerators';
export * from './clusteredBarGenerators';
export * from './trendLineGenerators';
export * from './proportionsGenerators';
export * from './correlationGenerators';
export * from './hierarchicalGenerators';
export * from './matrixGenerators';
export * from './kpiNetworkGenerators';

export interface BuildChartOptionParams {
  chartType: ChartType;
  papers: any[];
  themePreset: ThemePreset;
  fontFamily: FontFamily;
  fontSize: number;
  chartTitle: string;
  chartSubtitle: string;
  showChartTitle: boolean;
  showChartSubtitle: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  showDataLabels: boolean;
  labelRotation: number;
  primaryField: string;
  secondaryField: string;
  metricMode: MetricMode;
  sankeyFields: string[];
  sankeyLabelPositions: Record<number, 'left' | 'right'>;
  sankeyMaxNodes: Record<number, number>;
  limitCategories: boolean;
  maxCategoriesCount: number;
  numFieldX: string;
  numFieldY: string;
  numFieldSize: string;
  useUmbrellanizer: boolean;
  splitMultiValues: boolean;
  excludeEmpty: boolean;
  donutRatio: number;
  smoothLine: boolean;
  sankeyNodeWidth: number;
  sankeyNodeGap: number;
  sankeyLeftPadding: number;
  sankeyRightPadding: number;
  bubbleScale: number;
  gaugeMaxScale: number;
  sunburstLevelConfigs: Record<number, SunburstLevelConfig>;
  sunburstSort: 'desc' | 'asc' | 'none';
  sunburstNodeClick: 'rootToNode' | 'link' | 'none';
  sunburstEmphasisFocus: 'ancestor' | 'descendant' | 'none';
  barSorting: 'desc' | 'asc' | 'none';
  barOrientation?: 'horizontal' | 'vertical';
  barThickness: number;
  barBorderRadius: number;
  barGap: number;
  barClusterGap?: number;
  barInnerGap?: number;
  enableErrorBars?: boolean;
  errorBarType?: 'std_dev' | 'std_error' | 'ci_95';
  enableHatchPatterns?: boolean;
  axisScaleType?: 'linear' | 'log';
  axisTickDirection?: 'inside' | 'outside' | 'none';
  showAxisBaseline?: boolean;
  customAxisTitleX?: string;
  customAxisTitleY?: string;
  barLabelPosition: 'right' | 'inside' | 'insideLeft' | 'insideRight';
  barLabelFormat: 'value' | 'value_pct' | 'pct_only';
  barYAxisWidth: number;
  barYAxisOverflow: 'break' | 'truncate' | 'none';
  barLineHeight?: number;
  barYAxisFontSize?: number;
  barBenchmarkLine: boolean;
  barBenchmarkValue: number;
  barBenchmarkLabel: string;
  barBenchmarkStyle: 'dashed' | 'solid';
  barBenchmarkColor: string;
  legendFormat?: 'name' | 'name_count' | 'name_percent' | 'name_count_percent';
  barLegendFormat: 'name' | 'name_count' | 'name_percent' | 'name_count_percent';
  barLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  chartScale: number;
  panX: number;
  panY: number;
  tiltAngle: number;
  rotationAngle: number;
  sunburstLegendLevel: number;
  sunburstLegendFormat: 'name' | 'name_count' | 'name_percent' | 'name_count_percent';
  sunburstLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  levelCustomGroups: Record<number, string[]>;
  levelCustomGroupLinks: Record<number, Record<string, string>>;
  customCategoryMap: Record<string, Record<string, string>>;
  enableManualOverrides: boolean;
  manualCategoryValues: Record<string, number>;
  customSliceColors: Record<string, string>;
  pieLabelPlacement?: 'outside' | 'inside' | 'legend_only' | 'edge_aligned';
  pieRadiusRatio?: number;
  pieLabelWidth?: number;
  umbrellanizerMap?: Record<string, Record<string, string>>;
}

export function buildChartOption(params: BuildChartOptionParams): echarts.EChartsOption {
  const {
    chartType,
    papers,
    themePreset,
    fontFamily,
    fontSize,
    chartTitle,
    chartSubtitle,
    showChartTitle,
    showChartSubtitle,
    showLegend,
    legendPosition,
    metricMode
  } = params;

  const palette = THEME_PALETTES[themePreset] || THEME_PALETTES.ieee_blue;
  const font = resolveFontFamilyCss(fontFamily);

  const baseTitle = (!showChartTitle && !showChartSubtitle) ? { show: false } : {
    show: showChartTitle || showChartSubtitle,
    text: showChartTitle ? (chartTitle || '') : '',
    subtext: showChartSubtitle ? (chartSubtitle || '') : '',
    left: 'center',
    top: 15,
    textStyle: { fontFamily: font, fontSize: fontSize + 4, fontWeight: 'bold' as const, color: palette.text },
    subtextStyle: { fontFamily: font, fontSize: Math.max(10, fontSize - 2), color: palette.subtext }
  };

  const baseLegend = {
    show: showLegend,
    type: 'scroll' as const,
    left: legendPosition === 'left' ? 'left' : legendPosition === 'right' ? 'right' : 'center',
    top: legendPosition === 'top' ? 65 : legendPosition === 'bottom' ? 'bottom' : 'center',
    orient: (legendPosition === 'left' || legendPosition === 'right') ? 'vertical' as const : 'horizontal' as const,
    textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
  };

  const baseTooltip = {
    trigger: 'item' as const,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
  };

  const renderCategoryTooltip = (dataObj: any, fallbackName: string = '') => {
    if (!dataObj) return `${fallbackName}`;
    const name = dataObj.name || fallbackName;
    const paperCount = dataObj.paperCount ?? 0;
    const tagCount = dataObj.tagCount ?? dataObj.value ?? 0;
    const prevPct = dataObj.prevalencePct ?? (papers.length > 0 ? ((paperCount / papers.length) * 100).toFixed(2) : '0.00');
    const tagPct = dataObj.tagPct ?? '0.00';

    let activeMetricHeader = '';
    if (metricMode === 'avg_citation') {
      activeMetricHeader = `<span style="color:${palette.subtext};">Average Citations:</span> <strong>${dataObj.value} citations</strong><br/>`;
    } else if (metricMode === 'avg_qa') {
      activeMetricHeader = `<span style="color:${palette.subtext};">Average QA Score:</span> <strong>${dataObj.value}%</strong><br/>`;
    } else if (metricMode === 'tag_share') {
      activeMetricHeader = `<span style="color:${palette.subtext};">Active Metric (Tag Share):</span> <strong>${dataObj.value}%</strong><br/>`;
    }

    return `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">
      <strong style="color:${palette.text};font-size:13px;">${name}</strong><br/>
      ${activeMetricHeader}
      <span style="color:${palette.subtext};">Cohort Paper Count:</span> <strong>N = ${paperCount} papers</strong> <span style="color:${palette.subtext};font-size:11px;">(${prevPct}% of cohort)</span><br/>
      <span style="color:${palette.subtext};">Share of Tags:</span> <strong>${tagPct}%</strong> <span style="color:${palette.subtext};font-size:11px;">(${tagCount} tags)</span>
    </div>`;
  };

  const ctx: ChartGeneratorContext = {
    ...params,
    palette,
    font,
    baseTitle,
    baseLegend,
    baseTooltip,
    renderCategoryTooltip
  };

  switch (chartType) {
    case 'bar_vertical':
      return generateVerticalBarOption(ctx);
    case 'bar_horizontal':
      return generateHorizontalBarOption(ctx);
    case 'clustered_bar':
      return generateClusteredBarOption(ctx);
    case 'stacked_bar':
      return generateStackedBarOption(ctx);
    case 'line':
      return generateLineOption(ctx);
    case 'pie_donut':
      return generatePieDonutOption(ctx);
    case 'scatter':
      return generateScatterOption(ctx);
    case 'bubble':
      return generateBubbleOption(ctx);
    case 'treemap':
      return generateTreemapOption(ctx);
    case 'heatmap':
      return generateHeatmapOption(ctx);
    case 'sankey':
      return generateSankeyOption(ctx);
    case 'radar':
      return generateRadarOption(ctx);
    case 'funnel':
      return generateFunnelOption(ctx);
    case 'boxplot':
      return generateBoxplotOption(ctx);
    case 'sunburst':
      return generateSunburstOption(ctx);
    case 'graph':
      return generateGraphOption(ctx);
    case 'gauge':
      return generateGaugeOption(ctx);
    case 'calendar':
      return generateCalendarOption(ctx);
    default:
      return { backgroundColor: palette.bg, title: baseTitle };
  }
}
