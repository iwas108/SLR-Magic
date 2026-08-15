import type { 
  ThemePalette, 
  MetricMode, 
  SunburstLevelConfig,
  DecimalPrecision,
  RatioStyle,
  DisplayFormatTemplate
} from '../types';
import { formatMetricDisplay } from '../utils/formatterUtils';

export interface ChartGeneratorContext {
  papers: any[];
  palette: ThemePalette;
  font: string;
  fontSize: number;
  baseTitle: any;
  baseLegend: any;
  baseTooltip: any;
  renderCategoryTooltip: (dataObj: any, fallbackName?: string) => string;
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
  showDataLabels: boolean;
  labelRotation: number;
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
  labelFormat?: DisplayFormatTemplate;
  barLabelPosition: 'right' | 'inside' | 'insideLeft' | 'insideRight';
  barLabelFormat: DisplayFormatTemplate;
  barYAxisWidth: number;
  barYAxisOverflow: 'break' | 'truncate' | 'none';
  barLineHeight?: number;
  barYAxisFontSize?: number;
  barBenchmarkLine: boolean;
  barBenchmarkValue: number;
  barBenchmarkLabel: string;
  barBenchmarkStyle: 'dashed' | 'solid';
  barBenchmarkColor: string;
  legendFormat?: DisplayFormatTemplate;
  barLegendFormat: DisplayFormatTemplate;
  barLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  decimalPrecision?: DecimalPrecision;
  useTildeForCoarse?: boolean;
  ratioStyle?: RatioStyle;
  forceCohortDenominator?: boolean;
  chartScale: number;
  panX: number;
  panY: number;
  tiltAngle: number;
  rotationAngle: number;
  showLegend: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  sunburstLegendLevel: number;
  sunburstLegendFormat: DisplayFormatTemplate;
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
  pieLeaderLineLength?: number;
  pieLeaderLineLength2?: number;
  pieLabelDistance?: number;
  pieLineHeight?: number;
  barLabelDistance?: number;
  legendDistance?: number;
  umbrellanizerMap?: Record<string, Record<string, string>>;
}

export function formatLegendLabel(
  name: string,
  stats: { 
    paperCount?: number; 
    tagCount?: number;
    count?: number;
    percent?: number | string; 
    prevalencePct?: number | string; 
    tagSharePct?: number | string;
    totalCohortPapers?: number;
    totalExtractedTags?: number;
    metricMode?: MetricMode;
    decimalPrecision?: DecimalPrecision;
    useTildeForCoarse?: boolean;
    ratioStyle?: RatioStyle;
    forceCohortDenominator?: boolean;
  },
  format: DisplayFormatTemplate = 'name'
): string {
  return formatMetricDisplay({
    name,
    paperCount: stats.paperCount,
    tagCount: stats.tagCount,
    count: stats.count,
    totalCohortPapers: stats.totalCohortPapers,
    totalExtractedTags: stats.totalExtractedTags,
    metricMode: stats.metricMode,
    prevalencePct: stats.prevalencePct,
    tagSharePct: stats.tagSharePct,
    activePct: stats.percent,
    template: format,
    decimalPrecision: stats.decimalPrecision ?? 0,
    useTildeForCoarse: stats.useTildeForCoarse ?? true,
    ratioStyle: stats.ratioStyle ?? 'n_over_N',
    forceCohortDenominator: stats.forceCohortDenominator ?? false
  });
}

