import type { LucideIcon } from 'lucide-react';
import type * as echarts from 'echarts';

export type ChartType = 
  | 'bar_vertical'
  | 'bar_horizontal'
  | 'horizontal_bar_scatter'
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

export type DecimalPrecision = 0 | 1 | 2 | 3;

export type RatioStyle = 'n_over_N' | 'fraction' | 'bracketed';

export type DisplayFormatTemplate = 
  | 'name_ratio_percent'   // Name (n = 1/18, ~6%)
  | 'ratio_percent'        // n = 1/18, ~6%
  | 'percent_ratio'        // ~6% (n = 1/18)
  | 'ratio_only'           // n = 1/18
  | 'name_ratio'           // Name (n = 1/18)
  | 'count_percent'        // n = 1 (~6%)
  | 'percent_only'         // ~6%
  | 'layer_share'          // Relative Layer Share: ~6% (Sums to 100%)
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
  | 'count_prevalence_percent'      // Explicit Prevalence: n = 18 (~39%)
  | 'dual_prevalence_tag_share'     // Dual: n = 18/46 (~39%) | Tags: 18/54 (~33%)
  | 'two_line_count_percent'        // Multi-line: n = 14\n(~30%)
  | 'two_line_count_prevalence_percent' // Multi-line Prevalence: n = 14\n(~30%)
  | 'two_line_percent_count'        // Multi-line: ~30%\n(n = 14)
  | 'two_line_ratio_percent'        // Multi-line: n = 14/46\n(~30%)
  | 'two_line_percent_ratio'        // Multi-line: ~30%\n(n = 14/46)
  | 'two_line_name_count_percent'   // Multi-line: Name\nn = 14 (~30%)
  | 'name'                 // Legacy alias for name_only
  | 'value'                // Legacy alias for count_only
  | 'value_pct'            // Legacy alias for count_percent
  | 'pct_only';            // Legacy alias for percent_only

export type LegendFormat = DisplayFormatTemplate;

export type BarOrientation = 'horizontal' | 'vertical';

export type ErrorBarType = 'std_dev' | 'std_error' | 'ci_95';

export type AxisScaleType = 'linear' | 'log';

export type AxisTickDirection = 'inside' | 'outside' | 'none';

export type AxisLocation = 'start' | 'middle' | 'center' | 'end';

export type AxisLabelFormat = 
  | 'auto' 
  | 'raw' 
  | 'percent' 
  | 'integer' 
  | 'decimal_1' 
  | 'decimal_2' 
  | 'scientific' 
  | 'currency' 
  | 'custom_prefix_suffix';

export type AxisGridLineStyle = 'dashed' | 'solid' | 'dotted';

export type AxisFontWeight = 'normal' | 'bold' | '500' | '600' | '700' | '800' | '900';

export type AxisFontStyle = 'normal' | 'italic';

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
  | 'slr_light'
  | 'cell_amethyst'
  | 'lancet_crimson'
  | 'nejm_navy'
  | 'springer_forest'
  | 'jama_cardinal'
  | 'iop_cyan'
  | 'aps_amber'
  | 'aaas_scarlet'
  | 'cambridge_cobalt'
  | 'elife_sage'
  | 'bmj_azure'
  | 'mit_monochrome'
  | 'harvard_crimson'
  | 'frontiers_oceanic'
  | 'cell_genomics_magenta'
  | 'dark_neon_science'
  | 'nature_biotech_lavender'
  | 'cell_systems_cyan'
  | 'acm_siggraph_aurora'
  | 'ieee_robotics_amber'
  | 'elsevier_geochem_terracotta'
  | 'aps_quantum_violet'
  | 'nih_nlm_clinical'
  | 'who_epidemiology_teal'
  | 'springer_humanities_sepia'
  | 'nature_climate_sky'
  | 'degrade_emerald'
  | 'degrade_crimson'
  | 'degrade_amber'
  | 'degrade_violet'
  | 'degrade_teal'
  | 'degrade_indigo'
  | 'degrade_rose'
  | 'degrade_orange'
  | 'degrade_cyan'
  | 'degrade_lime'
  | 'degrade_plum'
  | 'degrade_slate'
  | 'degrade_magma_dark'
  | 'degrade_viridis_academic'
  | 'degrade_warm_bronze'
  | 'degrade_arctic_ice'
  | 'stanford_cardinal_red'
  | 'yale_historic_blue'
  | 'princeton_orange_black'
  | 'columbia_crown_blue'
  | 'oxford_navy_gold'
  | 'caltech_persimmon'
  | 'berkeley_blue_gold'
  | 'cmu_tartan_red'
  | 'eth_zurich_red'
  | 'nature_neuro_purple'
  | 'science_robotics_cobalt'
  | 'cell_stem_cell_teal'
  | 'imperial_college_blue'
  | 'sorbonne_paris_crimson'
  | 'tokyo_todai_blue'
  | 'degrade_solar_flare'
  | 'degrade_deep_ocean'
  | 'dark_tokyo_cyber';

export type SmartColorMode = 
  | 'branch_gradient' 
  | 'parent_flow' 
  | 'value_weighted_tint' 
  | 'level_discrete' 
  | 'rainbow_discrete';

export type SmartColorPropagation = 'auto_children' | 'discrete_only';

export type FontFamily = 
  | 'serif' 
  | 'times'
  | 'computer_modern' 
  | 'sans-serif' 
  | 'inter' 
  | 'arial' 
  | 'helvetica'
  | 'calibri'
  | 'georgia'
  | 'garamond'
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
  accent?: string;
  secondary?: string;
  surface?: string;
  gridLine?: string;
  heatScale?: string[];
  isDark?: boolean;
}

export interface SunburstLevelConfig {
  r0: number;
  r: number;
  position: 'inside' | 'outside';
  rotate: 'tangential' | 'radial' | 'flat' | 'auto';
  align: 'right' | 'center' | 'left';
  minAngle: number;
  borderWidth: number;
  borderRadius?: number;
  borderColor?: string;
  fontSize: number;
  fontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  color?: string;
  colorMode?: 'auto_contrast' | 'custom' | 'inherit_theme' | 'inherit_category';
  distance?: number;
  overflow?: 'break' | 'truncate' | 'none';
  maxLabelWidth?: number;
  labelFormat?: DisplayFormatTemplate;
  hideOverlap?: boolean;
}

export interface TreemapLevelConfig {
  gapWidth?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  labelFormat?: DisplayFormatTemplate;
  fontSize?: number;
  fontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  fontStyle?: 'normal' | 'italic';
  colorMode?: 'auto_contrast' | 'inherit_theme' | 'custom';
  color?: string;
  overflow?: 'break' | 'truncate' | 'none';
  lineHeight?: number;
  labelLineHeight?: number;
  labelWidth?: number;
  upperLabelWidth?: number;
  showUpperLabel?: boolean;
  upperLabelHeight?: number;
  upperLabelPosition?: 'inside' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  upperLabelFormat?: DisplayFormatTemplate;
  upperLabelFontSize?: number;
  upperLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  upperLabelColorMode?: 'auto_contrast' | 'inherit_theme' | 'custom';
  upperLabelColor?: string;
  upperLabelBgColor?: string;
  visibleMin?: number;
  childrenVisibleMin?: number;
  colorAlpha?: [number, number];
  colorSaturation?: [number, number];
}

export interface VisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  papers: any[];
  allCohortPapers?: any[];
  projectId?: string | number;
  totalUnfilteredCount?: number;
  isFiltered?: boolean;
  umbrellanizerMap?: Record<string, Record<string, string>>;
  autoFetchFromDb?: boolean;
  initialCohortScope?: 'full' | 'filtered';
  savedCharts?: any[];
  isViewerMode?: boolean;
  onViewerSaveChart?: (chart: any) => void;
  onViewerDeleteChart?: (id: string) => void;
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
  sankeySort?: 'desc' | 'asc' | 'alpha' | 'barycenter' | 'none';
  sankeyPinUnstatedToBottom?: boolean;
  sankeyFlowConservation?: boolean;
  sankeyLevelNodeOrders?: Record<number, string[]>;
  levelSegmentIndices?: Record<number, number>;
  levelScopeFilters?: Record<number, string>;
  sankeyLabelLineHeight?: number;
  sankeyLabelFontWeight?: 'normal' | 'bold' | '500' | '600' | '700' | '800';
  sankeyLabelColor?: string;
  bubbleScale: number;
  gaugeMaxScale: number;
  sunburstLevelConfigs: Record<number, SunburstLevelConfig>;
  sunburstSort: 'desc' | 'asc' | 'none';
  sunburstNodeClick: 'rootToNode' | 'link' | 'none';
  sunburstEmphasisFocus: 'ancestor' | 'descendant' | 'none';
  sunburstColorMode?: 'branch_gradient' | 'level_discrete' | 'rainbow_discrete';
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
  // Comprehensive Scientific Axis Titles Customization
  showAxisTitleX?: boolean;
  showAxisTitleY?: boolean;
  axisTitleFontSizeX?: number;
  axisTitleFontSizeY?: number;
  axisTitleFontWeightX?: AxisFontWeight;
  axisTitleFontWeightY?: AxisFontWeight;
  axisTitleFontStyleX?: AxisFontStyle;
  axisTitleFontStyleY?: AxisFontStyle;
  axisTitleColorX?: string;
  axisTitleColorY?: string;
  axisTitleLocationX?: AxisLocation;
  axisTitleLocationY?: AxisLocation;
  axisTitleGapX?: number;
  axisTitleGapY?: number;
  axisTitleRotateX?: number;
  axisTitleRotateY?: number;
  axisTitleAlignX?: 'left' | 'center' | 'right';
  axisTitleAlignY?: 'left' | 'center' | 'right';
  axisTitleOffsetX_X?: number;
  axisTitleOffsetY_X?: number;
  axisTitleOffsetX_Y?: number;
  axisTitleOffsetY_Y?: number;
  axisTitlePrefixX?: string;
  axisTitleSuffixX?: string;
  axisTitlePrefixY?: string;
  axisTitleSuffixY?: string;
  // Comprehensive Scientific Axis Tick Labels Customization
  showAxisLabelX?: boolean;
  showAxisLabelY?: boolean;
  axisLabelFontSizeX?: number;
  axisLabelFontSizeY?: number;
  axisLabelFontWeightX?: AxisFontWeight;
  axisLabelFontWeightY?: AxisFontWeight;
  axisLabelFontStyleX?: AxisFontStyle;
  axisLabelFontStyleY?: AxisFontStyle;
  axisLabelColorX?: string;
  axisLabelColorY?: string;
  axisLabelRotateX?: number;
  axisLabelRotateY?: number;
  axisLabelMarginX?: number;
  axisLabelMarginY?: number;
  axisLabelOverflowX?: 'none' | 'truncate' | 'break';
  axisLabelOverflowY?: 'none' | 'truncate' | 'break';
  axisLabelWidthX?: number;
  axisLabelWidthY?: number;
  axisLabelLineHeightX?: number;
  axisLabelLineHeightY?: number;
  axisLabelFormatX?: AxisLabelFormat;
  axisLabelFormatY?: AxisLabelFormat;
  axisLabelPrefixX?: string;
  axisLabelSuffixX?: string;
  axisLabelPrefixY?: string;
  axisLabelSuffixY?: string;
  axisLabelIntervalX?: 'auto' | number;
  axisLabelIntervalY?: 'auto' | number;
  axisLabelDecimalsX?: number;
  axisLabelDecimalsY?: number;
  // Scientific Gridlines
  showGridLinesX?: boolean;
  showGridLinesY?: boolean;
  gridLineStyle?: AxisGridLineStyle;
  gridLineColor?: string;
  gridLineOpacity?: number;
  labelFormat?: DisplayFormatTemplate;
  barLabelPosition: 'right' | 'inside' | 'insideLeft' | 'insideRight';
  barLabelFormat: DisplayFormatTemplate;
  barYAxisWidth: number;
  barYAxisOverflow: 'break' | 'truncate' | 'none';
  barLineHeight?: number;
  barYAxisFontSize?: number;
  barYAxisFontWeight?: AxisFontWeight;
  barYAxisFontStyle?: AxisFontStyle;
  barYAxisColor?: string;
  barBenchmarkLine: boolean;
  barBenchmarkValue: number;
  barBenchmarkLabel: string;
  barBenchmarkStyle: 'dashed' | 'solid';
  barBenchmarkColor: string;
  legendFormat?: LegendFormat;
  barLegendFormat: LegendFormat;
  barLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  legendContextScope?: 'global_cohort' | 'parent_layer' | 'surviving_flow' | 'in_chart_flow';
  syncLegendAndBarMetrics?: boolean;
  barLabelContextScope?: 'auto' | 'layer_share' | 'cohort_prevalence' | 'global_cohort';
  legendShowParentPrefix?: boolean;
  legendParentPrefixStyle?: 'abbreviated' | 'full' | 'colliding_only' | 'none';
  legendGroupByParent?: boolean;
  sunburstLegendLevel: number;
  sunburstLegendFormat: LegendFormat;
  sunburstLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  decimalPrecision?: DecimalPrecision;
  useTildeForCoarse?: boolean;
  ratioStyle?: RatioStyle;
  forceCohortDenominator?: boolean;
  levelCustomGroups: Record<number, string[]>;
  levelCustomGroupLinks: Record<number, Record<string, string>>;
  levelTargetFields?: Record<number, string>;
  primaryScopeFilter?: string;
  secondaryScopeFilter?: string;
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
  barLabelFontSize?: number;
  barLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  barLabelFontStyle?: 'normal' | 'italic';
  barLabelColor?: string;
  barLabelRotate?: number;
  barLabelShowZero?: boolean;
  barLabelMinThreshold?: number;
  barLabelLineHeight?: number;
  barLabelDecimals?: number;
  barValueCeiling?: number | 'auto';
  barValueInterval?: number | 'auto';
  legendDistance?: number;
  legendWidth?: number;
  legendWrapWidth?: number;
  legendLineHeight?: number;
  legendItemGap?: number;
  legendFontSize?: number;
  legendFontFamily?: string;
  legendFontStyle?: 'normal' | 'italic';
  legendLetterSpacing?: number;
  legendOverflow?: 'break' | 'truncate' | 'none';
  fitOffsetX?: number;
  fitOffsetY?: number;
  containerPadding?: number;
  // Enhanced Scientific Customization Properties
  lineMode?: 'cohort_trend' | 'epistemic_simulation';
  lineTimeSteps?: number;
  lineTimeStepIntervalName?: string;
  lineYAxisTitle?: string;
  lineYMin?: number;
  lineYMax?: number;
  lineBaselineA?: number;
  lineBaselineB?: number;
  lineBaselineName?: string;
  lineBaselineColor?: string;
  lineBaselineStyle?: 'solid' | 'dashed' | 'dotted';
  lineEstimatorInitial?: number;
  lineEstimatorDrift?: number;
  lineEstimatorModulation?: number;
  lineEstimatorName?: string;
  lineEstimatorColor?: string;
  lineEstimatorStyle?: 'solid' | 'dashed' | 'dotted';
  lineThresholdValue?: number;
  lineThresholdName?: string;
  lineThresholdLabel?: string;
  lineThresholdColor?: string;
  lineThresholdStyle?: 'dotted' | 'dashed' | 'solid';
  lineThresholdPosition?: 'insideEndTop' | 'insideStartTop' | 'insideMiddleTop' | 'end' | 'start';
  lineThresholdLineWidth?: number;
  lineAxisPointerType?: 'cross' | 'line' | 'shadow';
  lineMarkerSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none' | 'emptyCircle';
  lineXAxisInterval?: number | 'auto';
  lineShowGridLines?: boolean;
  lineGridLeft?: number;
  lineGridRight?: number;
  lineGridTop?: number;
  lineGridBottom?: number;
  lineWidth?: number;
  showLineMarkers?: boolean;
  lineMarkerSize?: number;
  lineAreaOpacity?: number;
  lineBaselineAreaOpacity?: number;
  lineEstimatorAreaOpacity?: number;
  lineBaselineFillMode?: 'none' | 'subtle_gradient' | 'solid';
  lineEstimatorFillMode?: 'none' | 'subtle_gradient' | 'solid';
  lineShowTxEvents?: boolean;
  lineTxEventSymbol?: 'triangle' | 'pin' | 'diamond' | 'circle' | 'arrow';
  lineTxEventColor?: string;
  lineTxEventSize?: number;
  lineShowTxLabels?: boolean;
  lineTxEventLabel?: string;
  lineTxEventSeriesName?: string;
  lineStepMode?: 'none' | 'start' | 'middle' | 'end';
  roseType?: 'none' | 'radius' | 'area';
  piePadAngle?: number;
  pieCornerRadius?: number;
  pieSort?: 'desc' | 'asc' | 'none';
  pieStartAngle?: number;
  pieMinAngle?: number;
  treemapAlgorithm?: 'squarified' | 'sliceAndDice' | 'binary';
  treemapSquareRatio?: number;
  treemapVisibleDepth?: number;
  treemapGapWidth?: number;
  treemapBorderWidth?: number;
  treemapBorderRadius?: number;
  treemapBorderColorMode?: 'auto_bg' | 'contrast' | 'custom' | 'transparent';
  treemapBorderColor?: string;
  treemapNodeClick?: 'zoomToNode' | 'link' | 'none';
  treemapRoam?: boolean | 'scale' | 'move';
  treemapDrillDownIcon?: string;
  treemapShowBreadcrumb?: boolean;
  treemapBreadcrumbPosition?: 'bottom' | 'top';
  treemapBreadcrumbHeight?: number;
  treemapColorMode?: 'branch_gradient' | 'depth_fade' | 'value_weighted' | 'level_discrete' | 'rainbow_discrete';
  treemapCohortMode?: 'grouped' | 'global';
  treemapColorMappingBy?: 'index' | 'value' | 'id';
  treemapColorAlphaMin?: number;
  treemapColorAlphaMax?: number;
  treemapColorSaturationMin?: number;
  treemapColorSaturationMax?: number;
  treemapShowLabels?: boolean;
  treemapLabelPosition?: 'inside' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  treemapLabelFormat?: DisplayFormatTemplate;
  treemapLabelFontSize?: number;
  treemapLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  treemapLabelFontStyle?: 'normal' | 'italic';
  treemapLabelColorMode?: 'auto_contrast' | 'inherit_theme' | 'custom';
  treemapLabelColor?: string;
  treemapLabelOverflow?: 'break' | 'truncate' | 'none';
  treemapLabelWidth?: number;
  treemapLabelLineHeight?: number;
  treemapShowUpperLabel?: boolean;
  treemapUpperLabelHeight?: number;
  treemapUpperLabelWidth?: number;
  treemapUpperLabelPosition?: 'inside' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  treemapUpperLabelFormat?: DisplayFormatTemplate;
  treemapUpperLabelFontSize?: number;
  treemapUpperLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  treemapUpperLabelColorMode?: 'auto_contrast' | 'inherit_theme' | 'custom';
  treemapUpperLabelColor?: string;
  treemapUpperLabelBgColor?: string;
  treemapVisibleMin?: number;
  treemapChildrenVisibleMin?: number;
  treemapLevelConfigs?: Record<number, TreemapLevelConfig>;
  heatmapCellRadius?: number;
  heatmapColorPreset?: 'academic' | 'viridis' | 'plasma' | 'thermal' | 'coolwarm';
  radarShape?: 'polygon' | 'circle';
  radarStartAngle?: number;
  radarAreaOpacity?: number;
  radarLineWidth?: number;
  radarSplitNumber?: number;
  radarRadius?: number;
  radarCenterX?: number;
  radarCenterY?: number;
  radarAxisLine?: boolean;
  radarAxisLineWidth?: number;
  radarAxisLineType?: 'solid' | 'dashed' | 'dotted';
  radarAxisLineColor?: string;
  radarAxisLineOpacity?: number;
  radarSplitLine?: boolean;
  radarSplitLineWidth?: number;
  radarSplitLineType?: 'solid' | 'dashed' | 'dotted';
  radarSplitLineColor?: string;
  radarSplitLineOpacity?: number;
  radarSplitArea?: boolean;
  radarSplitAreaTheme?: 'stepped' | 'subtle' | 'solid' | 'none' | 'custom';
  radarSplitAreaOpacity?: number;
  radarSplitAreaColor1?: string;
  radarSplitAreaColor2?: string;
  radarShowAxisScaleLabels?: boolean;
  radarAxisScaleFormat?: 'percent' | 'integer' | 'decimal_1' | 'raw';
  radarAxisScaleFontSize?: number;
  radarAxisScaleFontWeight?: 'normal' | '500' | '600' | 'bold';
  radarAxisScaleColor?: string;
  radarScaleMax?: number;
  radarScaleMin?: number;
  radarShowAxisTicks?: boolean;
  radarAxisNameMargin?: number;
  radarAxisNameWidth?: number;
  radarAxisNameOverflow?: 'break' | 'truncate' | 'none';
  radarAxisNameLineHeight?: number;
  radarAxisNameFontSize?: number;
  radarAxisNameFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  radarAxisNameFontStyle?: 'normal' | 'italic';
  radarAxisNameColor?: string;
  radarAxisNameBgColor?: string;
  radarAxisNamePadding?: number;
  radarAxisNameBorderRadius?: number;
  radarAxisNameBorderColor?: string;
  radarAxisNameBorderWidth?: number;
  radarShowDataLabels?: boolean;
  radarDataLabelPosition?: 'top' | 'bottom' | 'inside' | 'outside' | 'auto';
  radarDataLabelFontSize?: number;
  radarDataLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  radarDataLabelColor?: string;
  radarDataLabelFormat?: 'percent' | 'integer' | 'decimal_1' | 'raw' | 'detailed';
  radarSmooth?: boolean;
  radarBaselineLineStyle?: 'solid' | 'dashed' | 'dotted';
  radarBaselineSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarBaselineSymbolSize?: number;
  radarBaselineAreaColor?: string;
  radarBaselineSymbolBorderColor?: string;
  radarBaselineSymbolBorderWidth?: number;
  radarMode?: 'multi_variable' | 'qa_breakdown' | 'prevalence_vs_tag_share';
  radarVariables?: string[];
  radarVariableAliases?: Record<string, string>;
  radarVariableTargets?: Record<string, number>;
  radarIndicatorFormat?: 'two_line' | 'single_line' | 'ratio_percent' | 'asymmetry_two_line' | 'name_only';
  radarShowTarget?: boolean;
  radarTargetName?: string;
  radarTargetValue?: number;
  radarTargetLineStyle?: 'dashed' | 'solid' | 'dotted';
  radarTargetLineWidth?: number;
  radarTargetColor?: string;
  radarTargetAreaOpacity?: number;
  radarTargetSmooth?: boolean;
  radarTargetSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarTargetSymbolSize?: number;
  radarBaselineName?: string;
  radarBaselineColor?: string;
  radarTagShareName?: string;
  radarTagShareColor?: string;
  radarTagShareLineStyle?: 'dashed' | 'solid' | 'dotted';
  radarTagShareLineWidth?: number;
  radarTagShareAreaOpacity?: number;
  radarTagShareSmooth?: boolean;
  radarTagShareSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarTagShareSymbolSize?: number;
  funnelAlign?: 'center' | 'left' | 'right';
  funnelGap?: number;
  funnelNeckWidth?: number;
  funnelNeckHeight?: number;
  funnelLabelPosition?: 'inside' | 'outside' | 'left' | 'right';
  funnelSort?: 'descending' | 'ascending' | 'none';
  boxplotBoxWidth?: number;
  boxplotShowScatter?: boolean;
  boxplotOrientation?: 'vertical' | 'horizontal';
  boxplotFillColor?: string;
  boxplotBorderColor?: string;
  scatterPointSize?: number;
  scatterPointOpacity?: number;
  scatterShowRegression?: boolean;
  scatterRegressionType?: 'linear' | 'mean';
  bubbleMode?: 'categorical_matrix' | 'numerical_3d';
  bubbleMinRadius?: number;
  bubbleMaxRadius?: number;
  bubbleOpacity?: number;
  bubbleBorderWidth?: number;
  bubbleBorderColor?: string;
  bubbleShowLabels?: boolean;
  bubbleLabelFormat?: 'count_n' | 'count_only' | 'percent' | 'label';
  bubbleLabelFontSize?: number;
  bubbleLabelColor?: string;
  bubbleColorMode?: 'color_by_x' | 'color_by_y' | 'color_by_metric' | 'custom_compliance';
  bubbleShowGridLines?: boolean;
  bubbleComplianceRules?: Record<string, { label?: string; compliance?: string; color?: string }>;
  bubbleXAxisName?: string;
  bubbleYAxisName?: string;
  bubbleXAxisNameGap?: number;
  bubbleYAxisNameGap?: number;
  bubbleXAxisNameLocation?: 'middle' | 'start' | 'end';
  bubbleYAxisNameLocation?: 'middle' | 'start' | 'end';
  bubbleAxisTitleFontSize?: number;
  bubbleAxisTitleFontWeight?: 'bold' | 'normal' | 'bolder';
  bubbleAxisTitleColor?: string;
  bubbleGridLeft?: number;
  bubbleGridBottom?: number;
  bubbleGridTop?: number;
  bubbleGridRight?: number;
  bubbleSeriesName?: string;
  bubbleLegendMode?: 'category_series' | 'single_series' | 'none';
  graphRepulsion?: number;
  graphEdgeLength?: number;
  graphGravity?: number;
  graphCurveness?: number;
  graphShowLinkWeights?: boolean;
  graphNodeSize?: number;
  graphDraggable?: boolean;
  gaugeStartAngle?: number;
  gaugeEndAngle?: number;
  gaugePointerWidth?: number;
  gaugeDialWidth?: number;
  gaugeUnit?: string;
  gaugeSplitNumber?: number;
  calendarCellSize?: number;
  calendarYear?: string;
  calendarColorPreset?: 'academic' | 'viridis' | 'plasma' | 'thermal' | 'coolwarm';
  stackedNormalized?: boolean;
  stackedReverseOrder?: boolean;
  stackedPerBarSorting?: 'none' | 'desc' | 'asc';
  stackedShowTotalLabel?: boolean;
  stackedTotalLabelPosition?: 'top' | 'insideTop' | 'right';
  stackedTotalLabelFormat?: string;
  stackedTotalFontSize?: number;
  stackedTotalFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  stackedTotalColor?: string;
  stackedTotalLabelDistance?: number;
  legendType?: 'plain' | 'scroll';
  legendAlign?: 'auto' | 'left' | 'right';
  legendIcon?: 'inherit' | 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond' | 'pin' | 'arrow' | 'none' | 'line';
  legendItemWidth?: number;
  legendItemHeight?: number;
  legendFontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number | string;
  legendTextColor?: string;
  legendBackgroundColor?: string;
  legendBorderColor?: string;
  legendBorderWidth?: number;
  legendBorderRadius?: number;
  legendPadding?: number;
  // Dual-Axis & Horizontal Bar + Scatter Combo Parameters
  scatterAxisTitle?: string;
  scatterAxisMin?: number;
  scatterAxisMax?: number;
  scatterAxisInterval?: number;
  scatterAxisNameGap?: number;
  scatterSeriesName?: string;
  barSeriesName?: string;
  scatterSymbol?: 'diamond' | 'circle' | 'rect' | 'triangle' | 'pin' | 'roundRect';
  scatterSymbolSize?: number;
  scatterColor?: string;
  scatterBorderColor?: string;
  scatterBorderWidth?: number;
  scatterValues?: Record<string, number>;
  scatterShowDataLabels?: boolean;
  scatterLabelPosition?: 'top' | 'bottom' | 'right' | 'left' | 'inside';
  scatterLabelFontSize?: number;
  scatterLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  scatterLabelFontStyle?: 'normal' | 'italic';
  scatterLabelColor?: string;
  scatterLabelDistance?: number;
  scatterLabelLineHeight?: number;
  lineLabelFontSize?: number;
  lineLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  lineLabelFontStyle?: 'normal' | 'italic';
  lineLabelColor?: string;
  pieLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  pieLabelFontStyle?: 'normal' | 'italic';
  pieLabelColor?: string;
  radarLabelFontSize?: number;
  radarLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  radarLabelFontStyle?: 'normal' | 'italic';
  radarLabelColor?: string;
  heatmapLabelFontSize?: number;
  heatmapLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  heatmapLabelFontStyle?: 'normal' | 'italic';
  heatmapLabelColor?: string;
  funnelLabelFontSize?: number;
  funnelLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  funnelLabelFontStyle?: 'normal' | 'italic';
  funnelLabelColor?: string;
  boxplotLabelFontSize?: number;
  boxplotLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  boxplotLabelFontStyle?: 'normal' | 'italic';
  boxplotLabelColor?: string;
  bubbleLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  bubbleLabelFontStyle?: 'normal' | 'italic';
  barColorCustom?: string;
  barGridTop?: number;
  barGridBottom?: number;
  barGridLeft?: number;
  barGridRight?: number;
  // Universal Layout Margins & Canvas Padding
  gridMarginAuto?: boolean;
  gridMarginTop?: number;
  gridMarginBottom?: number;
  gridMarginLeft?: number;
  gridMarginRight?: number;
  // Universal Data Label Styling
  universalLabelPosition?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'insideLeft' | 'insideRight' | 'outside';
  universalLabelDistance?: number;
  universalLabelOverflow?: 'break' | 'truncate' | 'none';
  universalMaxLabelWidth?: number;
  universalLabelLineHeight?: number;
  universalLabelFontSize?: number;
  universalLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  universalLabelFontStyle?: 'normal' | 'italic';
  universalLabelColor?: string;
  universalLabelColorMode?: 'auto_contrast' | 'theme' | 'custom';
  universalLabelRotate?: number;
  universalLabelMinThreshold?: number;
  universalLabelShowZero?: boolean;
  // Smart Color Modes & Interactive Propagation
  smartColorMode?: SmartColorMode;
  smartColorPropagation?: SmartColorPropagation;
  scatterSortMode?: 'prevalence_desc' | 'prevalence_asc' | 'scatter_desc' | 'scatter_asc' | 'alpha' | 'dataset';
  otherCategoryLabel?: string;
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
  titleFontSize?: number;
  titleFontWeight?: 'normal' | '500' | '600' | 'bold' | '700' | '800' | '900';
  titleFontStyle?: 'normal' | 'italic';
  titleColor?: string;
  titleAlign?: 'left' | 'center' | 'right';
  subtitleFontSize?: number;
  subtitleFontWeight?: 'normal' | '500' | '600' | 'bold' | '700';
  subtitleFontStyle?: 'normal' | 'italic';
  subtitleColor?: string;
  subtitleLineHeight?: number;
  titleGap?: number;
  subfigureLabelStyle: SubfigureLabelStyle;
  subfigureLabelFontSize?: number;
  subfigureLabelFontWeight?: 'normal' | 'bold' | '800';
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
  sankeySort?: 'desc' | 'asc' | 'alpha' | 'barycenter' | 'none';
  sankeyPinUnstatedToBottom?: boolean;
  sankeyFlowConservation?: boolean;
  sankeyLevelNodeOrders?: Record<number, string[]>;
  levelSegmentIndices?: Record<number, number>;
  levelScopeFilters?: Record<number, string>;
  sankeyLabelLineHeight?: number;
  sankeyLabelFontWeight?: 'normal' | 'bold' | '500' | '600' | '700' | '800';
  sankeyLabelColor?: string;
  bubbleScale?: number;
  gaugeMaxScale?: number;
  sunburstLevelConfigs?: Record<number, SunburstLevelConfig>;
  sunburstSort?: 'desc' | 'asc' | 'none';
  sunburstNodeClick?: 'rootToNode' | 'link' | 'none';
  sunburstEmphasisFocus?: 'ancestor' | 'descendant' | 'none';
  sunburstColorMode?: 'branch_gradient' | 'level_discrete' | 'rainbow_discrete';
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
  // Comprehensive Scientific Axis Titles Customization
  showAxisTitleX?: boolean;
  showAxisTitleY?: boolean;
  axisTitleFontSizeX?: number;
  axisTitleFontSizeY?: number;
  axisTitleFontWeightX?: AxisFontWeight;
  axisTitleFontWeightY?: AxisFontWeight;
  axisTitleFontStyleX?: AxisFontStyle;
  axisTitleFontStyleY?: AxisFontStyle;
  axisTitleColorX?: string;
  axisTitleColorY?: string;
  axisTitleLocationX?: AxisLocation;
  axisTitleLocationY?: AxisLocation;
  axisTitleGapX?: number;
  axisTitleGapY?: number;
  axisTitleRotateX?: number;
  axisTitleRotateY?: number;
  axisTitleAlignX?: 'left' | 'center' | 'right';
  axisTitleAlignY?: 'left' | 'center' | 'right';
  axisTitleOffsetX_X?: number;
  axisTitleOffsetY_X?: number;
  axisTitleOffsetX_Y?: number;
  axisTitleOffsetY_Y?: number;
  axisTitlePrefixX?: string;
  axisTitleSuffixX?: string;
  axisTitlePrefixY?: string;
  axisTitleSuffixY?: string;
  // Comprehensive Scientific Axis Tick Labels Customization
  showAxisLabelX?: boolean;
  showAxisLabelY?: boolean;
  axisLabelFontSizeX?: number;
  axisLabelFontSizeY?: number;
  axisLabelFontWeightX?: AxisFontWeight;
  axisLabelFontWeightY?: AxisFontWeight;
  axisLabelFontStyleX?: AxisFontStyle;
  axisLabelFontStyleY?: AxisFontStyle;
  axisLabelColorX?: string;
  axisLabelColorY?: string;
  axisLabelRotateX?: number;
  axisLabelRotateY?: number;
  axisLabelMarginX?: number;
  axisLabelMarginY?: number;
  axisLabelOverflowX?: 'none' | 'truncate' | 'break';
  axisLabelOverflowY?: 'none' | 'truncate' | 'break';
  axisLabelWidthX?: number;
  axisLabelWidthY?: number;
  axisLabelLineHeightX?: number;
  axisLabelLineHeightY?: number;
  axisLabelFormatX?: AxisLabelFormat;
  axisLabelFormatY?: AxisLabelFormat;
  axisLabelPrefixX?: string;
  axisLabelSuffixX?: string;
  axisLabelPrefixY?: string;
  axisLabelSuffixY?: string;
  axisLabelIntervalX?: 'auto' | number;
  axisLabelIntervalY?: 'auto' | number;
  axisLabelDecimalsX?: number;
  axisLabelDecimalsY?: number;
  // Scientific Gridlines
  showGridLinesX?: boolean;
  showGridLinesY?: boolean;
  gridLineStyle?: AxisGridLineStyle;
  gridLineColor?: string;
  gridLineOpacity?: number;
  barLabelPosition?: 'right' | 'inside' | 'insideLeft' | 'insideRight';
  barLabelFormat?: 'value' | 'value_pct' | 'pct_only';
  barLabelFontSize?: number;
  barLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  barLabelFontStyle?: 'normal' | 'italic';
  barLabelColor?: string;
  barLabelRotate?: number;
  barLabelShowZero?: boolean;
  barLabelMinThreshold?: number;
  barLabelLineHeight?: number;
  barYAxisWidth?: number;
  barYAxisOverflow?: 'break' | 'truncate' | 'none';
  barLineHeight?: number;
  barYAxisFontSize?: number;
  barYAxisFontWeight?: AxisFontWeight;
  barYAxisFontStyle?: AxisFontStyle;
  barYAxisColor?: string;
  barBenchmarkLine?: boolean;
  barBenchmarkValue?: number;
  barBenchmarkLabel?: string;
  barBenchmarkStyle?: 'dashed' | 'solid';
  barBenchmarkColor?: string;
  legendFormat?: LegendFormat;
  barLegendFormat?: LegendFormat;
  barLegendPosition?: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  legendContextScope?: 'global_cohort' | 'parent_layer' | 'surviving_flow' | 'in_chart_flow';
  syncLegendAndBarMetrics?: boolean;
  barLabelContextScope?: 'auto' | 'layer_share' | 'cohort_prevalence' | 'global_cohort';
  legendShowParentPrefix?: boolean;
  legendParentPrefixStyle?: 'abbreviated' | 'full' | 'colliding_only' | 'none';
  legendGroupByParent?: boolean;
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
  levelTargetFields?: Record<number, string>;
  primaryScopeFilter?: string;
  secondaryScopeFilter?: string;
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
  barLabelDecimals?: number;
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
  radarShape?: 'polygon' | 'circle';
  radarStartAngle?: number;
  radarAreaOpacity?: number;
  radarLineWidth?: number;
  radarSplitNumber?: number;
  radarRadius?: number;
  radarCenterX?: number;
  radarCenterY?: number;
  radarAxisLine?: boolean;
  radarAxisLineWidth?: number;
  radarAxisLineType?: 'solid' | 'dashed' | 'dotted';
  radarAxisLineColor?: string;
  radarAxisLineOpacity?: number;
  radarSplitLine?: boolean;
  radarSplitLineWidth?: number;
  radarSplitLineType?: 'solid' | 'dashed' | 'dotted';
  radarSplitLineColor?: string;
  radarSplitLineOpacity?: number;
  radarSplitArea?: boolean;
  radarSplitAreaTheme?: 'stepped' | 'subtle' | 'solid' | 'none' | 'custom';
  radarSplitAreaOpacity?: number;
  radarSplitAreaColor1?: string;
  radarSplitAreaColor2?: string;
  radarShowAxisScaleLabels?: boolean;
  radarAxisScaleFormat?: 'percent' | 'integer' | 'decimal_1' | 'raw';
  radarAxisScaleFontSize?: number;
  radarAxisScaleFontWeight?: 'normal' | '500' | '600' | 'bold';
  radarAxisScaleColor?: string;
  radarScaleMax?: number;
  radarScaleMin?: number;
  radarShowAxisTicks?: boolean;
  radarAxisNameMargin?: number;
  radarAxisNameWidth?: number;
  radarAxisNameOverflow?: 'break' | 'truncate' | 'none';
  radarAxisNameLineHeight?: number;
  radarAxisNameFontSize?: number;
  radarAxisNameFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  radarAxisNameFontStyle?: 'normal' | 'italic';
  radarAxisNameColor?: string;
  radarAxisNameBgColor?: string;
  radarAxisNamePadding?: number;
  radarAxisNameBorderRadius?: number;
  radarAxisNameBorderColor?: string;
  radarAxisNameBorderWidth?: number;
  radarShowDataLabels?: boolean;
  radarDataLabelPosition?: 'top' | 'bottom' | 'inside' | 'outside' | 'auto';
  radarDataLabelFontSize?: number;
  radarDataLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  radarDataLabelColor?: string;
  radarDataLabelFormat?: 'percent' | 'integer' | 'decimal_1' | 'raw' | 'detailed';
  radarSmooth?: boolean;
  radarBaselineLineStyle?: 'solid' | 'dashed' | 'dotted';
  radarBaselineSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarBaselineSymbolSize?: number;
  radarBaselineAreaColor?: string;
  radarBaselineSymbolBorderColor?: string;
  radarBaselineSymbolBorderWidth?: number;
  radarMode?: 'multi_variable' | 'qa_breakdown' | 'prevalence_vs_tag_share';
  radarVariables?: string[];
  radarVariableAliases?: Record<string, string>;
  radarVariableTargets?: Record<string, number>;
  radarIndicatorFormat?: 'two_line' | 'single_line' | 'ratio_percent' | 'asymmetry_two_line' | 'name_only';
  radarShowTarget?: boolean;
  radarTargetName?: string;
  radarTargetValue?: number;
  radarTargetLineStyle?: 'dashed' | 'solid' | 'dotted';
  radarTargetLineWidth?: number;
  radarTargetColor?: string;
  radarTargetAreaOpacity?: number;
  radarTargetSmooth?: boolean;
  radarTargetSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarTargetSymbolSize?: number;
  radarBaselineName?: string;
  radarBaselineColor?: string;
  radarTagShareName?: string;
  radarTagShareColor?: string;
  radarTagShareLineStyle?: 'dashed' | 'solid' | 'dotted';
  radarTagShareLineWidth?: number;
  radarTagShareAreaOpacity?: number;
  radarTagShareSmooth?: boolean;
  radarTagShareSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none';
  radarTagShareSymbolSize?: number;
  bubbleMode?: 'categorical_matrix' | 'numerical_3d';
  bubbleMinRadius?: number;
  bubbleMaxRadius?: number;
  bubbleOpacity?: number;
  bubbleBorderWidth?: number;
  bubbleBorderColor?: string;
  bubbleShowLabels?: boolean;
  bubbleLabelFormat?: 'count_n' | 'count_only' | 'percent' | 'label';
  bubbleLabelFontSize?: number;
  bubbleLabelColor?: string;
  bubbleColorMode?: 'color_by_x' | 'color_by_y' | 'color_by_metric' | 'custom_compliance';
  bubbleShowGridLines?: boolean;
  bubbleComplianceRules?: Record<string, { label?: string; compliance?: string; color?: string }>;
  bubbleXAxisName?: string;
  bubbleYAxisName?: string;
  bubbleXAxisNameGap?: number;
  bubbleYAxisNameGap?: number;
  bubbleXAxisNameLocation?: 'middle' | 'start' | 'end';
  bubbleYAxisNameLocation?: 'middle' | 'start' | 'end';
  bubbleAxisTitleFontSize?: number;
  bubbleAxisTitleFontWeight?: 'bold' | 'normal' | 'bolder';
  bubbleAxisTitleColor?: string;
  bubbleGridLeft?: number;
  bubbleGridBottom?: number;
  bubbleGridTop?: number;
  bubbleGridRight?: number;
  bubbleSeriesName?: string;
  bubbleLegendMode?: 'category_series' | 'single_series' | 'none';
  lineMode?: 'cohort_trend' | 'epistemic_simulation';
  lineTimeSteps?: number;
  lineTimeStepIntervalName?: string;
  lineYAxisTitle?: string;
  lineYMin?: number;
  lineYMax?: number;
  lineBaselineA?: number;
  lineBaselineB?: number;
  lineBaselineName?: string;
  lineBaselineColor?: string;
  lineBaselineStyle?: 'solid' | 'dashed' | 'dotted';
  lineEstimatorInitial?: number;
  lineEstimatorDrift?: number;
  lineEstimatorModulation?: number;
  lineEstimatorName?: string;
  lineEstimatorColor?: string;
  lineEstimatorStyle?: 'solid' | 'dashed' | 'dotted';
  lineThresholdValue?: number;
  lineThresholdName?: string;
  lineThresholdLabel?: string;
  lineThresholdColor?: string;
  lineThresholdStyle?: 'dotted' | 'dashed' | 'solid';
  lineThresholdPosition?: 'insideEndTop' | 'insideStartTop' | 'insideMiddleTop' | 'end' | 'start';
  lineThresholdLineWidth?: number;
  lineAxisPointerType?: 'cross' | 'line' | 'shadow';
  lineMarkerSymbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none' | 'emptyCircle';
  lineXAxisInterval?: number | 'auto';
  lineShowGridLines?: boolean;
  lineGridLeft?: number;
  lineGridRight?: number;
  lineGridTop?: number;
  lineGridBottom?: number;
  lineBaselineAreaOpacity?: number;
  lineEstimatorAreaOpacity?: number;
  lineBaselineFillMode?: 'none' | 'subtle_gradient' | 'solid';
  lineEstimatorFillMode?: 'none' | 'subtle_gradient' | 'solid';
  lineShowTxEvents?: boolean;
  lineTxEventSymbol?: 'triangle' | 'pin' | 'diamond' | 'circle' | 'arrow';
  lineTxEventColor?: string;
  lineTxEventSize?: number;
  lineShowTxLabels?: boolean;
  lineTxEventLabel?: string;
  lineTxEventSeriesName?: string;
  stackedNormalized?: boolean;
  setStackedNormalized?: (v: boolean) => void;
  stackedReverseOrder?: boolean;
  setStackedReverseOrder?: (v: boolean) => void;
  stackedPerBarSorting?: 'none' | 'desc' | 'asc';
  setStackedPerBarSorting?: (v: 'none' | 'desc' | 'asc') => void;
  stackedShowTotalLabel?: boolean;
  setStackedShowTotalLabel?: (v: boolean) => void;
  stackedTotalLabelPosition?: 'top' | 'insideTop' | 'right';
  setStackedTotalLabelPosition?: (v: 'top' | 'insideTop' | 'right') => void;
  stackedTotalLabelFormat?: string;
  setStackedTotalLabelFormat?: (v: string) => void;
  stackedTotalFontSize?: number;
  setStackedTotalFontSize?: (v: number) => void;
  stackedTotalFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  setStackedTotalFontWeight?: (v: 'normal' | '500' | '600' | 'bold' | '800') => void;
  stackedTotalColor?: string;
  setStackedTotalColor?: (v: string) => void;
  stackedTotalLabelDistance?: number;
  setStackedTotalLabelDistance?: (v: number) => void;
  setLegendContextScope?: (v: 'global_cohort' | 'parent_layer' | 'surviving_flow' | 'in_chart_flow') => void;
  setSyncLegendAndBarMetrics?: (v: boolean) => void;
  setBarLabelContextScope?: (v: 'auto' | 'layer_share' | 'cohort_prevalence' | 'global_cohort') => void;
  setLegendShowParentPrefix?: (v: boolean) => void;
  setLegendParentPrefixStyle?: (v: 'abbreviated' | 'full' | 'colliding_only' | 'none') => void;
  setLegendGroupByParent?: (v: boolean) => void;
  setPrimaryScopeFilter?: (v: string) => void;
  setSecondaryScopeFilter?: (v: string) => void;
  legendType?: 'plain' | 'scroll';
  legendAlign?: 'auto' | 'left' | 'right';
  legendIcon?: 'inherit' | 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond' | 'pin' | 'arrow' | 'none' | 'line';
  legendItemWidth?: number;
  legendItemHeight?: number;
  legendFontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number | string;
  legendTextColor?: string;
  legendBackgroundColor?: string;
  legendBorderColor?: string;
  legendBorderWidth?: number;
  legendBorderRadius?: number;
  legendPadding?: number;
  // Dual-Axis & Horizontal Bar + Scatter Combo Parameters
  scatterAxisTitle?: string;
  scatterAxisMin?: number;
  scatterAxisMax?: number;
  scatterAxisInterval?: number;
  scatterAxisNameGap?: number;
  scatterSeriesName?: string;
  barSeriesName?: string;
  scatterSymbol?: 'diamond' | 'circle' | 'rect' | 'triangle' | 'pin' | 'roundRect';
  scatterSymbolSize?: number;
  scatterColor?: string;
  scatterBorderColor?: string;
  scatterBorderWidth?: number;
  scatterValues?: Record<string, number>;
  scatterShowDataLabels?: boolean;
  scatterLabelPosition?: 'top' | 'bottom' | 'right' | 'left' | 'inside';
  scatterLabelFontSize?: number;
  scatterLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  scatterLabelFontStyle?: 'normal' | 'italic';
  scatterLabelColor?: string;
  scatterLabelDistance?: number;
  scatterLabelLineHeight?: number;
  lineLabelFontSize?: number;
  lineLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  lineLabelFontStyle?: 'normal' | 'italic';
  lineLabelColor?: string;
  pieLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  pieLabelFontStyle?: 'normal' | 'italic';
  pieLabelColor?: string;
  radarLabelFontSize?: number;
  radarLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  radarLabelFontStyle?: 'normal' | 'italic';
  radarLabelColor?: string;
  heatmapLabelFontSize?: number;
  heatmapLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  heatmapLabelFontStyle?: 'normal' | 'italic';
  heatmapLabelColor?: string;
  treemapLabelFontSize?: number;
  treemapLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  treemapLabelFontStyle?: 'normal' | 'italic';
  treemapLabelColor?: string;
  treemapAlgorithm?: 'squarified' | 'sliceAndDice' | 'binary';
  treemapSquareRatio?: number;
  treemapVisibleDepth?: number;
  treemapGapWidth?: number;
  treemapBorderWidth?: number;
  treemapBorderRadius?: number;
  treemapBorderColorMode?: 'auto_bg' | 'contrast' | 'custom' | 'transparent';
  treemapBorderColor?: string;
  treemapNodeClick?: 'zoomToNode' | 'link' | 'none';
  treemapRoam?: boolean | 'scale' | 'move';
  treemapDrillDownIcon?: string;
  treemapShowBreadcrumb?: boolean;
  treemapBreadcrumbPosition?: 'bottom' | 'top';
  treemapBreadcrumbHeight?: number;
  treemapColorMode?: 'branch_gradient' | 'depth_fade' | 'value_weighted' | 'level_discrete' | 'rainbow_discrete';
  treemapCohortMode?: 'grouped' | 'global';
  treemapColorMappingBy?: 'index' | 'value' | 'id';
  treemapColorAlphaMin?: number;
  treemapColorAlphaMax?: number;
  treemapColorSaturationMin?: number;
  treemapColorSaturationMax?: number;
  treemapShowLabels?: boolean;
  treemapLabelPosition?: 'inside' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  treemapLabelFormat?: DisplayFormatTemplate;
  treemapLabelColorMode?: 'auto_contrast' | 'inherit_theme' | 'custom';
  treemapLabelOverflow?: 'break' | 'truncate' | 'none';
  treemapLabelWidth?: number;
  treemapLabelLineHeight?: number;
  treemapShowUpperLabel?: boolean;
  treemapUpperLabelHeight?: number;
  treemapUpperLabelWidth?: number;
  treemapUpperLabelPosition?: 'inside' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  treemapUpperLabelFormat?: DisplayFormatTemplate;
  treemapUpperLabelFontSize?: number;
  treemapUpperLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  treemapUpperLabelColorMode?: 'auto_contrast' | 'inherit_theme' | 'custom';
  treemapUpperLabelColor?: string;
  treemapUpperLabelBgColor?: string;
  treemapVisibleMin?: number;
  treemapChildrenVisibleMin?: number;
  treemapLevelConfigs?: Record<number, TreemapLevelConfig>;
  funnelLabelPosition?: 'inside' | 'outside' | 'left' | 'right';
  funnelSort?: 'descending' | 'ascending' | 'none';
  funnelLabelFontSize?: number;
  funnelLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  funnelLabelFontStyle?: 'normal' | 'italic';
  funnelLabelColor?: string;
  boxplotLabelFontSize?: number;
  boxplotLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  boxplotLabelFontStyle?: 'normal' | 'italic';
  boxplotLabelColor?: string;
  bubbleLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  bubbleLabelFontStyle?: 'normal' | 'italic';
  barColorCustom?: string;
  barGridTop?: number;
  barGridBottom?: number;
  barGridLeft?: number;
  barGridRight?: number;
  // Universal Layout Margins & Canvas Padding
  gridMarginAuto?: boolean;
  gridMarginTop?: number;
  gridMarginBottom?: number;
  gridMarginLeft?: number;
  gridMarginRight?: number;
  // Universal Data Label Styling
  universalLabelPosition?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'inside' | 'insideLeft' | 'insideRight' | 'outside';
  universalLabelDistance?: number;
  universalLabelOverflow?: 'break' | 'truncate' | 'none';
  universalMaxLabelWidth?: number;
  universalLabelLineHeight?: number;
  universalLabelFontSize?: number;
  universalLabelFontWeight?: 'normal' | '500' | '600' | 'bold' | '800';
  universalLabelFontStyle?: 'normal' | 'italic';
  universalLabelColor?: string;
  universalLabelColorMode?: 'auto_contrast' | 'theme' | 'custom';
  universalLabelRotate?: number;
  universalLabelMinThreshold?: number;
  universalLabelShowZero?: boolean;
  // Smart Color Modes & Interactive Propagation
  smartColorMode?: SmartColorMode;
  smartColorPropagation?: SmartColorPropagation;
  scatterSortMode?: 'prevalence_desc' | 'prevalence_asc' | 'scatter_desc' | 'scatter_asc' | 'alpha' | 'dataset';
  otherCategoryLabel?: string;
}

export interface SavedChart {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  chart_type: string;
  layout_mode: string;
  config_payload: string;
  created_at: string;
  updated_at: string;
}
