import type { SunburstLevelConfig, SlotConfig, SlotId } from '../types';

export const CUSTOM_GROUPING_KEY = '__custom_grouping__';
export const CUSTOM_GROUPING_LABEL = '✨ [Custom Grouping Layer]';

export const DEFAULT_SUNBURST_LEVEL_CONFIGS: Record<number, SunburstLevelConfig> = {
  0: { r0: 15, r: 40, position: 'inside', rotate: 'tangential', align: 'center', minAngle: 0, borderWidth: 2, fontSize: 12, overflow: 'none' },
  1: { r0: 40, r: 75, position: 'inside', rotate: 'tangential', align: 'center', minAngle: 0, borderWidth: 1, fontSize: 11, overflow: 'none' },
  2: { r0: 75, r: 77, position: 'outside', rotate: 'radial', align: 'right', minAngle: 0, borderWidth: 2, fontSize: 10, overflow: 'none' }
};

export const DEFAULT_CUSTOM_GROUPS: Record<number, string[]> = {
  0: ['High-Maturity Indoor', 'Other Domains', 'Agriculture']
};

export const DEFAULT_CUSTOM_GROUP_LINKS: Record<number, Record<string, string>> = {
  0: {
    'Manufacturing': 'High-Maturity Indoor',
    'Energy/Power': 'High-Maturity Indoor',
    'Traffic/Smart City': 'Other Domains',
    'Smart Building': 'Other Domains',
    'Electronics': 'Other Domains',
    'Aerospace': 'Other Domains',
    'Environmental Monitoring': 'Other Domains',
    'Agriculture/Horticulture': 'Agriculture'
  }
};

export function createDefaultSlotConfig(slotId: SlotId): SlotConfig {
  const isSlotA = slotId === 'slot_a';
  const isSlotB = slotId === 'slot_b';
  const isSlotC = slotId === 'slot_c';

  return {
    chartType: isSlotA ? 'bar_vertical' : isSlotB ? 'sunburst' : isSlotC ? 'line' : 'pie_donut',
    subTitle: isSlotA ? 'Distribution Overview' : isSlotB ? 'Hierarchical Taxonomy' : isSlotC ? 'Temporal Trend' : 'Proportional Share',
    primaryField: isSlotA ? 'Year' : isSlotB ? CUSTOM_GROUPING_KEY : isSlotC ? 'Year' : 'Import_Source',
    secondaryField: isSlotA ? 'Import_Source' : 'Local_PDF_Status',
    metricMode: 'count',
    sankeyFields: ['Year', 'Import_Source', 'Local_PDF_Status'],
    sankeyLabelPositions: {},
    sankeyMaxNodes: {},
    limitCategories: false,
    maxCategoriesCount: 10,
    numFieldX: 'Overall_QA',
    numFieldY: 'citation_count',
    numFieldSize: 'Year',
    useUmbrellanizer: true,
    splitMultiValues: true,
    excludeEmpty: true,
    showLegend: true,
    legendPosition: 'top',
    showDataLabels: true,
    labelRotation: 0,
    donutRatio: 50,
    smoothLine: true,
    sankeyNodeWidth: 20,
    sankeyNodeGap: 18,
    sankeyLeftPadding: 8,
    sankeyRightPadding: 20,
    bubbleScale: 1.2,
    gaugeMaxScale: 100,
    sunburstLevelConfigs: { ...DEFAULT_SUNBURST_LEVEL_CONFIGS },
    sunburstSort: 'desc',
    sunburstNodeClick: 'rootToNode',
    sunburstEmphasisFocus: 'ancestor',
    barSorting: 'desc',
    barOrientation: 'horizontal',
    barThickness: 26,
    barBorderRadius: 4,
    barGap: 24,
    barClusterGap: 20,
    barInnerGap: 15,
    enableErrorBars: false,
    errorBarType: 'std_error',
    enableHatchPatterns: false,
    axisScaleType: 'linear',
    axisTickDirection: 'outside',
    showAxisBaseline: true,
    customAxisTitleX: '',
    customAxisTitleY: '',
    barLabelPosition: 'right',
    barLabelFormat: 'value_pct',
    barYAxisWidth: 140,
    barYAxisOverflow: 'break',
    barLineHeight: 14,
    barYAxisFontSize: 11,
    barBenchmarkLine: false,
    barBenchmarkValue: 50,
    barBenchmarkLabel: 'Target Benchmark',
    barBenchmarkStyle: 'dashed',
    barBenchmarkColor: '#ef4444',
    legendFormat: 'name',
    barLegendFormat: 'name',
    barLegendPosition: 'bottom-center',
    sunburstLegendLevel: 0,
    sunburstLegendFormat: 'name',
    sunburstLegendPosition: 'bottom-center',
    levelCustomGroups: { ...DEFAULT_CUSTOM_GROUPS },
    levelCustomGroupLinks: { ...DEFAULT_CUSTOM_GROUP_LINKS },
    customCategoryMap: {},
    enableManualOverrides: false,
    manualCategoryValues: {},
    customSliceColors: {},
    pieLabelPlacement: 'outside',
    pieRadiusRatio: 54,
    pieLabelWidth: 140
  };
}

export const INITIAL_SLOTS_CONFIG: Record<SlotId, SlotConfig> = {
  slot_a: createDefaultSlotConfig('slot_a'),
  slot_b: createDefaultSlotConfig('slot_b'),
  slot_c: createDefaultSlotConfig('slot_c'),
  slot_d: createDefaultSlotConfig('slot_d')
};
