import type { LucideIcon } from 'lucide-react';
import type * as echarts from 'echarts';

export type ChartType = 
  | 'bar_vertical'
  | 'bar_horizontal'
  | 'clustered_bar'
  | 'stacked_bar'
  | 'line'
  | 'pie_donut'
  | 'scatter'
  | 'bubble'
  | 'treemap'
  | 'heatmap'
  | 'sankey'
  | 'radar'
  | 'funnel'
  | 'boxplot'
  | 'sunburst'
  | 'graph'
  | 'gauge'
  | 'calendar';

export type LayoutMode = 
  | 'single'
  | 'dual_horizontal'
  | 'dual_vertical'
  | 'tri_top_two_bottom'
  | 'quad_grid';

export type SlotId = 'slot_a' | 'slot_b' | 'slot_c' | 'slot_d';

export type SubfigureLabelStyle = 
  | 'paren_lower' // (a), (b), (c), (d)
  | 'paren_upper' // (A), (B), (C), (D)
  | 'bold_upper'  // A, B, C, D
  | 'fig_prefix'  // Fig. 1a, Fig. 1b
  | 'none';

export type ExportFormat = 'png' | 'svg' | 'pdf';

export type CanvasBackdrop = 'dark' | 'white' | 'checkerboard' | 'slate';

export type AspectRatioPreset = 
  | '16:9'    // Double Column / Full Page Landscape (IEEE/Elsevier Standard)
  | '16:10'   // 1.5 Column / Golden Academic Ratio
  | '4:3'     // Single Column Classic
  | '3:2'     // Photographic / Wide Single Column
  | '1:1'     // Square Multi-Panel
  | '21:9'    // Cinematic / Ultra-Wide
  | 'auto'    // Viewport Match
  | 'custom'; // Custom Width x Height

export type DimensionUnit = 'mm' | 'in' | 'px';

export type FittingAnchor = 
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export type PieLabelPlacement = 'outside' | 'inside' | 'legend_only' | 'edge_aligned';

export type DecimalPrecision = 0 | 1 | 2;

export type RatioStyle = 'n_over_N' | 'fraction' | 'bracketed';

export type DisplayFormatTemplate = 
  | 'name_ratio_percent'   // Name (n = 1/18, ~6%)
  | 'ratio_percent'        // n = 1/18, ~6%
  | 'percent_ratio'        // ~6% (n = 1/18)
  | 'ratio_only'           // n = 1/18
  | 'name_ratio'           // Name (n = 1/18)
  | 'count_percent'        // n = 1 (~6%)
  | 'percent_only'         // ~6%
  | 'count_only'           // n = 1
  | 'name_only'            // Name
  | 'name_count'           // Name (n = 1)
  | 'name_percent'         // Name (~6%)
  | 'name_count_percent'   // Name (n = 1, ~6%)
  | 'tag_share_ratio_percent'       // Explicit Tag Share: n = 18/54, ~33%
  | 'name_tag_share_ratio_percent'  // Name (n = 18/54, ~33%)
  | 'tag_share_percent_ratio'       // ~33% (n = 18/54)
  | 'tag_share_percent_only'        // ~33%
  | 'tag_share_ratio_only'          // n = 18/54
  | 'tag_share_count_percent'       // n = 18 (~33%)
  | 'name_tag_share_percent'        // Name (~33%)
  | 'name_tag_share_count_percent'  // Name (n = 18, ~33%)
  | 'prevalence_ratio_percent'      // Explicit Prevalence: n = 18/46, ~39%
  | 'name_prevalence_ratio_percent' // Name (n = 18/46, ~39%)
  | 'prevalence_percent_only'       // ~39%
  | 'prevalence_ratio_only'         // n = 18/46
  | 'dual_prevalence_tag_share'     // Dual: n = 18/46 (~39%) | Tags: 18/54 (~33%)
  | 'name'                 // Legacy alias for name_only
  | 'value'                // Legacy alias for count_only
  | 'value_pct'            // Legacy alias for count_percent
  | 'pct_only';            // Legacy alias for percent_only

export type LegendFormat = DisplayFormatTemplate;

export type BarOrientation = 'horizontal' | 'vertical';

export type ErrorBarType = 'std_dev' | 'std_error' | 'ci_95';

export type AxisScaleType = 'linear' | 'log';

export type AxisTickDirection = 'inside' | 'outside' | 'none';

export interface StatisticalSummary {
  mean: number;
  count: number;
  variance: number;
  stdDev: number;
  stdError: number;
  ci95Lower: number;
  ci95Upper: number;
  min: number;
  max: number;
}

export interface CrossTabCell {
  primaryCat: string;
  seriesKey: string;
  count: number;
  prevalencePct: number;
  tagSharePct: number;
  activeMetricVal: number;
  stats?: StatisticalSummary;
}

export interface CrossTabMatrix {
  categories: string[];
  seriesList: string[];
  matrix: Record<string, Record<string, CrossTabCell>>;
  rowTotals: Record<string, { count: number; activeMetricVal: number }>;
  colTotals: Record<string, { count: number; activeMetricVal: number }>;
  grandTotalCount: number;
  grandTotalMetricVal: number;
}

export type ThemePreset = 
  | 'academic_grayscale'
  | 'ieee_blue'
  | 'nature_emerald'
  | 'science_contrast'
  | 'acs_crimson'
  | 'pnas_gold'
  | 'oxford_burgundy'
  | 'wiley_indigo'
  | 'taylor_sapphire'
  | 'plos_coral'
  | 'frontiers_violet'
  | 'bmc_teal'
  | 'mdpi_vermilion'
  | 'rsc_ultramarine'
  | 'dark_modern'
  | 'slr_light';

export type FontFamily = 
  | 'serif' 
  | 'sans-serif' 
  | 'inter' 
  | 'computer_modern' 
  | 'arial' 
  | 'roboto' 
  | 'mono';

export type MetricMode = 
  | 'count' 
  | 'paper_prevalence' 
  | 'tag_share' 
  | 'avg_citation' 
  | 'avg_qa';

export interface ChartTypeMeta {
  name: string;
  category: string;
  description: string;
  slrUseCase: string;
  icon: LucideIcon;
}

export interface LayoutPresetMeta {
  id: LayoutMode;
  name: string;
  description: string;
  slotCount: number;
  slots: SlotId[];
  icon: LucideIcon;
}

export interface ThemePalette {
  name: string;
  colors: string[];
  bg: string;
  text: string;
  subtext: string;
  border: string;
}

export interface SunburstLevelConfig {
  r0: number;
  r: number;
  position: 'inside' | 'outside';
  rotate: 'tangential' | 'radial' | 'flat';
  align: 'right' | 'center' | 'left';
  minAngle: number;
  borderWidth: number;
  fontSize: number;
  color?: string;
  overflow?: 'break' | 'truncate' | 'none';
  maxLabelWidth?: number;
  labelFormat?: DisplayFormatTemplate;
}

export interface VisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  papers: any[];
  totalUnfilteredCount?: number;
  isFiltered?: boolean;
  umbrellanizerMap?: Record<string, Record<string, string>>;
}

export interface BreakdownRow {
  name: string;
  parentName?: string;
  count: number;
  paperCount: number;
  tagCount: number;
  paperPrevalencePct: number;
  tagSharePct: number;
  realPct: number;
  activeVal: number;
}

export interface RealDataBreakdownResult {
  rows: BreakdownRow[];
  totalItems: number;
  totalCohortPapers: number;
  activeSum: number;
  isMultiLabel: boolean;
}

export interface DetectedCategory {
  name: string;
  levelLabel: string;
  parentName?: string;
}

export interface SlotConfig {
  chartType: ChartType;
  subTitle: string;
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
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
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
  barOrientation?: BarOrientation;
  barThickness: number;
  barBorderRadius: number;
  barGap: number;
  barClusterGap?: number;
  barInnerGap?: number;
  enableErrorBars?: boolean;
  errorBarType?: ErrorBarType;
  enableHatchPatterns?: boolean;
  axisScaleType?: AxisScaleType;
  axisTickDirection?: AxisTickDirection;
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
  legendFormat?: LegendFormat;
  barLegendFormat: LegendFormat;
  barLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  sunburstLegendLevel: number;
  sunburstLegendFormat: LegendFormat;
  sunburstLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  decimalPrecision?: DecimalPrecision;
  useTildeForCoarse?: boolean;
  ratioStyle?: RatioStyle;
  forceCohortDenominator?: boolean;
  levelCustomGroups: Record<number, string[]>;
  levelCustomGroupLinks: Record<number, Record<string, string>>;
  customCategoryMap: Record<string, Record<string, string>>;
  enableManualOverrides: boolean;
  manualCategoryValues: Record<string, number>;
  customSliceColors: Record<string, string>;
  pieLabelPlacement?: PieLabelPlacement;
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
  // Enhanced Scientific Customization Properties
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

export interface GlobalStyleConfig {
  layoutMode: LayoutMode;
  themePreset: ThemePreset;
  fontFamily: FontFamily;
  fontSize: number;
  chartTitle: string;
  chartSubtitle: string;
  showChartTitle: boolean;
  showChartSubtitle: boolean;
  subfigureLabelStyle: SubfigureLabelStyle;
  panelGutter: number;
  showPanelBorders: boolean;
  aspectRatio: AspectRatioPreset;
  customWidth: number;
  customHeight: number;
  dimensionUnit: DimensionUnit;
  decimalPrecision: DecimalPrecision;
  useTildeForCoarse: boolean;
  ratioStyle: RatioStyle;
  forceCohortDenominator: boolean;
  defaultLabelFormat: DisplayFormatTemplate;
  defaultLegendFormat: DisplayFormatTemplate;
  fitOffsetX?: number;
  fitOffsetY?: number;
  containerPadding?: number;
  showSafeGuides?: boolean;
}

export interface VisualizerPresetPayload {
  version: '1.0' | '2.0' | '3.0';
  exportedAt: string;
  layoutMode?: LayoutMode;
  globalStyle?: Partial<GlobalStyleConfig>;
  slots?: Partial<Record<SlotId, Partial<SlotConfig>>>;
  // Legacy fields for v1/v2 backward compatibility
  chartType?: ChartType;
  primaryField?: string;
  secondaryField?: string;
  metricMode?: MetricMode;
  sankeyFields?: string[];
  sankeyLabelPositions?: Record<number, 'left' | 'right'>;
  sankeyMaxNodes?: Record<number, number>;
  tailLabelStyle?: 'comma_list' | 'other_count' | 'other_items' | 'plain_other';
  limitCategories?: boolean;
  maxCategoriesCount?: number;
  numFieldX?: string;
  numFieldY?: string;
  numFieldSize?: string;
  useUmbrellanizer?: boolean;
  splitMultiValues?: boolean;
  excludeEmpty?: boolean;
  chartTitle?: string;
  chartSubtitle?: string;
  showChartTitle?: boolean;
  showChartSubtitle?: boolean;
  themePreset?: ThemePreset;
  fontFamily?: FontFamily;
  fontSize?: number;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showDataLabels?: boolean;
  labelRotation?: number;
  donutRatio?: number;
  smoothLine?: boolean;
  sankeyNodeWidth?: number;
  sankeyNodeGap?: number;
  sankeyLeftPadding?: number;
  sankeyRightPadding?: number;
  bubbleScale?: number;
  gaugeMaxScale?: number;
  sunburstLevelConfigs?: Record<number, SunburstLevelConfig>;
  sunburstSort?: 'desc' | 'asc' | 'none';
  sunburstNodeClick?: 'rootToNode' | 'link' | 'none';
  sunburstEmphasisFocus?: 'ancestor' | 'descendant' | 'none';
  barSorting?: 'desc' | 'asc' | 'none';
  barOrientation?: BarOrientation;
  barThickness?: number;
  barBorderRadius?: number;
  barGap?: number;
  barClusterGap?: number;
  barInnerGap?: number;
  enableErrorBars?: boolean;
  errorBarType?: ErrorBarType;
  enableHatchPatterns?: boolean;
  axisScaleType?: AxisScaleType;
  axisTickDirection?: AxisTickDirection;
  showAxisBaseline?: boolean;
  customAxisTitleX?: string;
  customAxisTitleY?: string;
  barLabelPosition?: 'right' | 'inside' | 'insideLeft' | 'insideRight';
  barLabelFormat?: 'value' | 'value_pct' | 'pct_only';
  barYAxisWidth?: number;
  barYAxisOverflow?: 'break' | 'truncate' | 'none';
  barLineHeight?: number;
  barYAxisFontSize?: number;
  barBenchmarkLine?: boolean;
  barBenchmarkValue?: number;
  barBenchmarkLabel?: string;
  barBenchmarkStyle?: 'dashed' | 'solid';
  barBenchmarkColor?: string;
  legendFormat?: LegendFormat;
  barLegendFormat?: LegendFormat;
  barLegendPosition?: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  chartScale?: number;
  panX?: number;
  panY?: number;
  tiltAngle?: number;
  rotationAngle?: number;
  sunburstLegendLevel?: number;
  sunburstLegendFormat?: LegendFormat;
  sunburstLegendPosition?: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  levelCustomGroups?: Record<number, string[]>;
  levelCustomGroupLinks?: Record<number, Record<string, string>>;
  customCategoryMap?: Record<string, Record<string, string>>;
  enableManualOverrides?: boolean;
  manualCategoryValues?: Record<string, number>;
  customSliceColors?: Record<string, string>;
  pieLabelPlacement?: PieLabelPlacement;
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
  aspectRatio?: AspectRatioPreset;
  customWidth?: number;
  customHeight?: number;
  dimensionUnit?: DimensionUnit;
  fitOffsetX?: number;
  fitOffsetY?: number;
  containerPadding?: number;
  showSafeGuides?: boolean;
}
