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
  tailLabelStyle?: 'comma_list' | 'other_count' | 'other_items' | 'plain_other';
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
  sankeyTopPadding?: number;
  sankeyBottomPadding?: number;
  sankeyOrient?: 'horizontal' | 'vertical';
  sankeyNodeAlign?: 'justify' | 'left' | 'right';
  sankeyCurveness?: number;
  sankeyLinkColorMode?: 'gradient' | 'source' | 'target';
  sankeyLinkOpacity?: number;
  sankeyNodeBorderRadius?: number;
  sankeyNodeBorderWidth?: number;
  sankeyLayoutIterations?: number;
  sankeyDraggable?: boolean;
  sankeyLabelPosition?: 'auto' | 'left' | 'right' | 'inside' | 'top' | 'bottom';
  sankeyLabelDistance?: number;
  sankeyLabelOverflow?: 'break' | 'truncate' | 'none';
  sankeyMaxLabelWidth?: number;
  sankeyLabelFontSize?: number;
  sankeyLabelRotate?: number;
  sankeyEmphasisFocus?: 'adjacency' | 'trajectory' | 'series' | 'none';
  sankeyLevelLabelFormats?: Record<number, DisplayFormatTemplate>;
  sankeyLevelNodeGaps?: Record<number, number>;
  sankeyLevelLabelDistances?: Record<number, number>;
  sankeyLevelNodeWidths?: Record<number, number>;
  sankeyLevelPathFilters?: Record<number, string>;
  sankeySort?: 'desc' | 'asc' | 'alpha' | 'none';
  sankeyLabelLineHeight?: number;
  sankeyLabelFontWeight?: 'normal' | 'bold' | '500' | '600' | '700' | '800';
  sankeyLabelColor?: string;
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
  legendWidth?: number;
  legendLineHeight?: number;
  legendItemGap?: number;
  legendFontSize?: number;
  legendOverflow?: 'break' | 'truncate' | 'none';
  fitOffsetX?: number;
  fitOffsetY?: number;
  containerPadding?: number;
  umbrellanizerMap?: Record<string, Record<string, string>>;
  // Rich chart customization parameters
  lineWidth?: number;
  showLineMarkers?: boolean;
  lineMarkerSize?: number;
  lineAreaOpacity?: number;
  lineStepMode?: 'none' | 'start' | 'middle' | 'end';
  roseType?: 'none' | 'radius' | 'area';
  piePadAngle?: number;
  pieCornerRadius?: number;
  treemapAlgorithm?: 'squarified' | 'sliceAndDice' | 'binary';
  treemapVisibleDepth?: number;
  treemapGapWidth?: number;
  treemapBorderWidth?: number;
  heatmapCellRadius?: number;
  heatmapColorPreset?: 'academic' | 'viridis' | 'plasma' | 'thermal' | 'coolwarm';
  radarShape?: 'polygon' | 'circle';
  radarAreaOpacity?: number;
  radarLineWidth?: number;
  radarSplitNumber?: number;
  radarRadius?: number;
  radarAxisLine?: boolean;
  radarSplitLine?: boolean;
  radarSplitArea?: boolean;
  radarAxisNameMargin?: number;
  radarAxisNameWidth?: number;
  radarAxisNameOverflow?: 'break' | 'truncate' | 'none';
  radarAxisNameLineHeight?: number;
  radarShowDataLabels?: boolean;
  radarDataLabelPosition?: 'top' | 'bottom' | 'inside' | 'outside' | 'auto';
  radarBaselineLineStyle?: 'solid' | 'dashed' | 'dotted';
  radarBaselineSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarBaselineSymbolSize?: number;
  radarMode?: 'multi_variable' | 'qa_breakdown';
  radarVariables?: string[];
  radarVariableAliases?: Record<string, string>;
  radarVariableTargets?: Record<string, number>;
  radarIndicatorFormat?: 'two_line' | 'single_line' | 'ratio_percent' | 'name_only';
  radarShowTarget?: boolean;
  radarTargetName?: string;
  radarTargetValue?: number;
  radarTargetLineStyle?: 'dashed' | 'solid' | 'dotted';
  radarTargetLineWidth?: number;
  radarTargetColor?: string;
  radarTargetAreaOpacity?: number;
  radarTargetSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarTargetSymbolSize?: number;
  radarBaselineName?: string;
  radarBaselineColor?: string;
  funnelAlign?: 'center' | 'left' | 'right';
  funnelGap?: number;
  funnelNeckWidth?: number;
  funnelNeckHeight?: number;
  boxplotBoxWidth?: number;
  boxplotShowScatter?: boolean;
  boxplotOrientation?: 'vertical' | 'horizontal';
  scatterPointSize?: number;
  scatterPointOpacity?: number;
  scatterShowRegression?: boolean;
  scatterRegressionType?: 'linear' | 'mean';
  graphRepulsion?: number;
  graphEdgeLength?: number;
  graphGravity?: number;
  graphCurveness?: number;
  graphShowLinkWeights?: boolean;
  gaugeStartAngle?: number;
  gaugeEndAngle?: number;
  gaugePointerWidth?: number;
  gaugeDialWidth?: number;
  calendarCellSize?: number;
  calendarYear?: string;
  stackedNormalized?: boolean;
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

