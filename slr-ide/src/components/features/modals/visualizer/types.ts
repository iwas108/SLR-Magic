import type { LucideIcon } from 'lucide-react';
import type * as echarts from 'echarts';

export type ChartType = 
  | 'bar_vertical'
  | 'bar_horizontal'
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

export type PieLabelPlacement = 'outside' | 'inside' | 'legend_only' | 'edge_aligned';

export type LegendFormat = 'name' | 'name_count' | 'name_percent' | 'name_count_percent';

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
  realPct: number;
  activeVal: number;
}

export interface RealDataBreakdownResult {
  rows: BreakdownRow[];
  totalItems: number;
  activeSum: number;
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
  barThickness: number;
  barBorderRadius: number;
  barGap: number;
  barLabelPosition: 'right' | 'inside' | 'insideLeft' | 'insideRight';
  barLabelFormat: 'value' | 'value_pct' | 'pct_only';
  barYAxisWidth: number;
  barYAxisOverflow: 'break' | 'truncate' | 'none';
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
  levelCustomGroups: Record<number, string[]>;
  levelCustomGroupLinks: Record<number, Record<string, string>>;
  customCategoryMap: Record<string, Record<string, string>>;
  enableManualOverrides: boolean;
  manualCategoryValues: Record<string, number>;
  customSliceColors: Record<string, string>;
  pieLabelPlacement?: PieLabelPlacement;
  pieRadiusRatio?: number;
  pieLabelWidth?: number;
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
  barThickness?: number;
  barBorderRadius?: number;
  barGap?: number;
  barLabelPosition?: 'right' | 'inside' | 'insideLeft' | 'insideRight';
  barLabelFormat?: 'value' | 'value_pct' | 'pct_only';
  barYAxisWidth?: number;
  barYAxisOverflow?: 'break' | 'truncate' | 'none';
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
  aspectRatio?: AspectRatioPreset;
  customWidth?: number;
  customHeight?: number;
  dimensionUnit?: DimensionUnit;
}
