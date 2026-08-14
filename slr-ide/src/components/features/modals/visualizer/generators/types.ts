import type { 
  ThemePalette, 
  MetricMode, 
  SunburstLevelConfig 
} from '../types';

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
  legendFormat?: 'name' | 'name_count' | 'name_percent' | 'name_count_percent';
  barLegendFormat: 'name' | 'name_count' | 'name_percent' | 'name_count_percent';
  barLegendPosition: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  chartScale: number;
  panX: number;
  panY: number;
  tiltAngle: number;
  rotationAngle: number;
  showLegend: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
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

export function formatLegendLabel(
  name: string,
  stats: { paperCount?: number; percent?: number | string; prevalencePct?: number | string },
  format: 'name' | 'name_count' | 'name_percent' | 'name_count_percent' = 'name'
): string {
  const pCount = stats.paperCount;
  const pctRaw = stats.percent ?? stats.prevalencePct;
  const pctStr = pctRaw !== undefined ? (typeof pctRaw === 'number' ? pctRaw.toFixed(2) : pctRaw) : undefined;

  if (format === 'name_count' && pCount !== undefined) {
    return `${name} (N=${pCount})`;
  }
  if (format === 'name_percent' && pctStr !== undefined) {
    return `${name} (${pctStr}%)`;
  }
  if (format === 'name_count_percent' && pCount !== undefined) {
    return `${name} (N=${pCount}, ${pctStr || '0.00'}%)`;
  }
  return name;
}
