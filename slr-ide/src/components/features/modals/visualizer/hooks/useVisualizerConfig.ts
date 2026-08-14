import { useState, useCallback } from 'react';
import { INITIAL_SLOTS_CONFIG, createDefaultSlotConfig } from '../constants/defaultConfigs';
import type { 
  ChartType, 
  MetricMode, 
  SlotId, 
  SlotConfig, 
  SunburstLevelConfig 
} from '../types';

export function useVisualizerConfig(params: {
  activeSlot: SlotId;
}) {
  const { activeSlot } = params;
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [slotsConfig, setSlotsConfig] = useState<Record<SlotId, SlotConfig>>({ ...INITIAL_SLOTS_CONFIG });

  // Update helper for active slot
  const updateActiveSlot = useCallback((partial: Partial<SlotConfig>) => {
    setSlotsConfig(prev => ({
      ...prev,
      [activeSlot]: {
        ...prev[activeSlot],
        ...partial
      }
    }));
  }, [activeSlot]);

  // Update helper for any specific slot
  const updateSlot = useCallback((slotId: SlotId, partial: Partial<SlotConfig>) => {
    setSlotsConfig(prev => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        ...partial
      }
    }));
  }, []);

  // Clone config from one slot to another
  const cloneSlotConfig = useCallback((fromSlot: SlotId, toSlot: SlotId) => {
    setSlotsConfig(prev => {
      const source = prev[fromSlot] || createDefaultSlotConfig(fromSlot);
      return {
        ...prev,
        [toSlot]: JSON.parse(JSON.stringify(source))
      };
    });
  }, []);

  const setAllSlotsConfig = useCallback((configs: Record<SlotId, SlotConfig>) => {
    setSlotsConfig(configs);
  }, []);

  // Active Slot Getters
  const currentSlotConfig = slotsConfig[activeSlot] || INITIAL_SLOTS_CONFIG.slot_a;

  // Active slot field proxies
  const chartType = currentSlotConfig.chartType;
  const setChartType = useCallback((v: ChartType) => updateActiveSlot({ chartType: v }), [updateActiveSlot]);

  const subTitle = currentSlotConfig.subTitle;
  const setSubTitle = useCallback((v: string) => updateActiveSlot({ subTitle: v }), [updateActiveSlot]);

  const primaryField = currentSlotConfig.primaryField;
  const setPrimaryField = useCallback((v: string) => updateActiveSlot({ primaryField: v }), [updateActiveSlot]);

  const secondaryField = currentSlotConfig.secondaryField;
  const setSecondaryField = useCallback((v: string) => updateActiveSlot({ secondaryField: v }), [updateActiveSlot]);

  const metricMode = currentSlotConfig.metricMode;
  const setMetricMode = useCallback((v: MetricMode) => updateActiveSlot({ metricMode: v }), [updateActiveSlot]);

  const sankeyFields = currentSlotConfig.sankeyFields;
  const setSankeyFields = useCallback((v: string[]) => updateActiveSlot({ sankeyFields: v }), [updateActiveSlot]);

  const sankeyLabelPositions = currentSlotConfig.sankeyLabelPositions;
  const setSankeyLabelPositions = useCallback((v: Record<number, 'left' | 'right'>) => updateActiveSlot({ sankeyLabelPositions: v }), [updateActiveSlot]);

  const sankeyMaxNodes = currentSlotConfig.sankeyMaxNodes;
  const setSankeyMaxNodes = useCallback((v: Record<number, number>) => updateActiveSlot({ sankeyMaxNodes: v }), [updateActiveSlot]);

  const limitCategories = currentSlotConfig.limitCategories;
  const setLimitCategories = useCallback((v: boolean) => updateActiveSlot({ limitCategories: v }), [updateActiveSlot]);

  const maxCategoriesCount = currentSlotConfig.maxCategoriesCount;
  const setMaxCategoriesCount = useCallback((v: number) => updateActiveSlot({ maxCategoriesCount: v }), [updateActiveSlot]);

  const numFieldX = currentSlotConfig.numFieldX;
  const setNumFieldX = useCallback((v: string) => updateActiveSlot({ numFieldX: v }), [updateActiveSlot]);

  const numFieldY = currentSlotConfig.numFieldY;
  const setNumFieldY = useCallback((v: string) => updateActiveSlot({ numFieldY: v }), [updateActiveSlot]);

  const numFieldSize = currentSlotConfig.numFieldSize;
  const setNumFieldSize = useCallback((v: string) => updateActiveSlot({ numFieldSize: v }), [updateActiveSlot]);

  const useUmbrellanizer = currentSlotConfig.useUmbrellanizer;
  const setUseUmbrellanizer = useCallback((v: boolean) => updateActiveSlot({ useUmbrellanizer: v }), [updateActiveSlot]);

  const splitMultiValues = currentSlotConfig.splitMultiValues;
  const setSplitMultiValues = useCallback((v: boolean) => updateActiveSlot({ splitMultiValues: v }), [updateActiveSlot]);

  const excludeEmpty = currentSlotConfig.excludeEmpty;
  const setExcludeEmpty = useCallback((v: boolean) => updateActiveSlot({ excludeEmpty: v }), [updateActiveSlot]);

  // Style & Per-slot options
  const showLegend = currentSlotConfig.showLegend;
  const setShowLegend = useCallback((v: boolean) => updateActiveSlot({ showLegend: v }), [updateActiveSlot]);

  const legendPosition = currentSlotConfig.legendPosition;
  const setLegendPosition = useCallback((v: 'top' | 'bottom' | 'left' | 'right') => updateActiveSlot({ legendPosition: v }), [updateActiveSlot]);

  const showDataLabels = currentSlotConfig.showDataLabels;
  const setShowDataLabels = useCallback((v: boolean) => updateActiveSlot({ showDataLabels: v }), [updateActiveSlot]);

  const labelRotation = currentSlotConfig.labelRotation;
  const setLabelRotation = useCallback((v: number) => updateActiveSlot({ labelRotation: v }), [updateActiveSlot]);

  const donutRatio = currentSlotConfig.donutRatio;
  const setDonutRatio = useCallback((v: number) => updateActiveSlot({ donutRatio: v }), [updateActiveSlot]);

  const smoothLine = currentSlotConfig.smoothLine;
  const setSmoothLine = useCallback((v: boolean) => updateActiveSlot({ smoothLine: v }), [updateActiveSlot]);

  const sankeyNodeWidth = currentSlotConfig.sankeyNodeWidth;
  const setSankeyNodeWidth = useCallback((v: number) => updateActiveSlot({ sankeyNodeWidth: v }), [updateActiveSlot]);

  const sankeyNodeGap = currentSlotConfig.sankeyNodeGap;
  const setSankeyNodeGap = useCallback((v: number) => updateActiveSlot({ sankeyNodeGap: v }), [updateActiveSlot]);

  const sankeyLeftPadding = currentSlotConfig.sankeyLeftPadding;
  const setSankeyLeftPadding = useCallback((v: number) => updateActiveSlot({ sankeyLeftPadding: v }), [updateActiveSlot]);

  const sankeyRightPadding = currentSlotConfig.sankeyRightPadding;
  const setSankeyRightPadding = useCallback((v: number) => updateActiveSlot({ sankeyRightPadding: v }), [updateActiveSlot]);

  const bubbleScale = currentSlotConfig.bubbleScale;
  const setBubbleScale = useCallback((v: number) => updateActiveSlot({ bubbleScale: v }), [updateActiveSlot]);

  const gaugeMaxScale = currentSlotConfig.gaugeMaxScale;
  const setGaugeMaxScale = useCallback((v: number) => updateActiveSlot({ gaugeMaxScale: v }), [updateActiveSlot]);

  const sunburstLevelConfigs = currentSlotConfig.sunburstLevelConfigs;
  const setSunburstLevelConfigs = useCallback((v: Record<number, SunburstLevelConfig>) => updateActiveSlot({ sunburstLevelConfigs: v }), [updateActiveSlot]);

  const sunburstSort = currentSlotConfig.sunburstSort;
  const setSunburstSort = useCallback((v: 'desc' | 'asc' | 'none') => updateActiveSlot({ sunburstSort: v }), [updateActiveSlot]);

  const sunburstNodeClick = currentSlotConfig.sunburstNodeClick;
  const setSunburstNodeClick = useCallback((v: 'rootToNode' | 'link' | 'none') => updateActiveSlot({ sunburstNodeClick: v }), [updateActiveSlot]);

  const sunburstEmphasisFocus = currentSlotConfig.sunburstEmphasisFocus;
  const setSunburstEmphasisFocus = useCallback((v: 'ancestor' | 'descendant' | 'none') => updateActiveSlot({ sunburstEmphasisFocus: v }), [updateActiveSlot]);

  const barSorting = currentSlotConfig.barSorting;
  const setBarSorting = useCallback((v: 'desc' | 'asc' | 'none') => updateActiveSlot({ barSorting: v }), [updateActiveSlot]);

  const barOrientation = currentSlotConfig.barOrientation || 'horizontal';
  const setBarOrientation = useCallback((v: 'horizontal' | 'vertical') => updateActiveSlot({ barOrientation: v }), [updateActiveSlot]);

  const barThickness = currentSlotConfig.barThickness;
  const setBarThickness = useCallback((v: number) => updateActiveSlot({ barThickness: v }), [updateActiveSlot]);

  const barBorderRadius = currentSlotConfig.barBorderRadius;
  const setBarBorderRadius = useCallback((v: number) => updateActiveSlot({ barBorderRadius: v }), [updateActiveSlot]);

  const barGap = currentSlotConfig.barGap;
  const setBarGap = useCallback((v: number) => updateActiveSlot({ barGap: v }), [updateActiveSlot]);

  const barClusterGap = currentSlotConfig.barClusterGap ?? 20;
  const setBarClusterGap = useCallback((v: number) => updateActiveSlot({ barClusterGap: v }), [updateActiveSlot]);

  const barInnerGap = currentSlotConfig.barInnerGap ?? 15;
  const setBarInnerGap = useCallback((v: number) => updateActiveSlot({ barInnerGap: v }), [updateActiveSlot]);

  const enableErrorBars = currentSlotConfig.enableErrorBars ?? false;
  const setEnableErrorBars = useCallback((v: boolean) => updateActiveSlot({ enableErrorBars: v }), [updateActiveSlot]);

  const errorBarType = currentSlotConfig.errorBarType || 'std_error';
  const setErrorBarType = useCallback((v: 'std_dev' | 'std_error' | 'ci_95') => updateActiveSlot({ errorBarType: v }), [updateActiveSlot]);

  const enableHatchPatterns = currentSlotConfig.enableHatchPatterns ?? false;
  const setEnableHatchPatterns = useCallback((v: boolean) => updateActiveSlot({ enableHatchPatterns: v }), [updateActiveSlot]);

  const axisScaleType = currentSlotConfig.axisScaleType || 'linear';
  const setAxisScaleType = useCallback((v: 'linear' | 'log') => updateActiveSlot({ axisScaleType: v }), [updateActiveSlot]);

  const axisTickDirection = currentSlotConfig.axisTickDirection || 'outside';
  const setAxisTickDirection = useCallback((v: 'inside' | 'outside' | 'none') => updateActiveSlot({ axisTickDirection: v }), [updateActiveSlot]);

  const showAxisBaseline = currentSlotConfig.showAxisBaseline ?? true;
  const setShowAxisBaseline = useCallback((v: boolean) => updateActiveSlot({ showAxisBaseline: v }), [updateActiveSlot]);

  const customAxisTitleX = currentSlotConfig.customAxisTitleX || '';
  const setCustomAxisTitleX = useCallback((v: string) => updateActiveSlot({ customAxisTitleX: v }), [updateActiveSlot]);

  const customAxisTitleY = currentSlotConfig.customAxisTitleY || '';
  const setCustomAxisTitleY = useCallback((v: string) => updateActiveSlot({ customAxisTitleY: v }), [updateActiveSlot]);

  const barLabelPosition = currentSlotConfig.barLabelPosition;
  const setBarLabelPosition = useCallback((v: 'right' | 'inside' | 'insideLeft' | 'insideRight') => updateActiveSlot({ barLabelPosition: v }), [updateActiveSlot]);

  const barLabelFormat = currentSlotConfig.barLabelFormat;
  const setBarLabelFormat = useCallback((v: 'value' | 'value_pct' | 'pct_only') => updateActiveSlot({ barLabelFormat: v }), [updateActiveSlot]);

  const barYAxisWidth = currentSlotConfig.barYAxisWidth;
  const setBarYAxisWidth = useCallback((v: number) => updateActiveSlot({ barYAxisWidth: v }), [updateActiveSlot]);

  const barYAxisOverflow = currentSlotConfig.barYAxisOverflow;
  const setBarYAxisOverflow = useCallback((v: 'break' | 'truncate' | 'none') => updateActiveSlot({ barYAxisOverflow: v }), [updateActiveSlot]);

  const barLineHeight = currentSlotConfig.barLineHeight ?? 14;
  const setBarLineHeight = useCallback((v: number) => updateActiveSlot({ barLineHeight: v }), [updateActiveSlot]);

  const barYAxisFontSize = currentSlotConfig.barYAxisFontSize ?? 11;
  const setBarYAxisFontSize = useCallback((v: number) => updateActiveSlot({ barYAxisFontSize: v }), [updateActiveSlot]);

  const barBenchmarkLine = currentSlotConfig.barBenchmarkLine;
  const setBarBenchmarkLine = useCallback((v: boolean) => updateActiveSlot({ barBenchmarkLine: v }), [updateActiveSlot]);

  const barBenchmarkValue = currentSlotConfig.barBenchmarkValue;
  const setBarBenchmarkValue = useCallback((v: number) => updateActiveSlot({ barBenchmarkValue: v }), [updateActiveSlot]);

  const barBenchmarkLabel = currentSlotConfig.barBenchmarkLabel;
  const setBarBenchmarkLabel = useCallback((v: string) => updateActiveSlot({ barBenchmarkLabel: v }), [updateActiveSlot]);

  const barBenchmarkStyle = currentSlotConfig.barBenchmarkStyle;
  const setBarBenchmarkStyle = useCallback((v: 'dashed' | 'solid') => updateActiveSlot({ barBenchmarkStyle: v }), [updateActiveSlot]);

  const barBenchmarkColor = currentSlotConfig.barBenchmarkColor;
  const setBarBenchmarkColor = useCallback((v: string) => updateActiveSlot({ barBenchmarkColor: v }), [updateActiveSlot]);

  const legendFormat = currentSlotConfig.legendFormat || 'name';
  const setLegendFormat = useCallback((v: 'name' | 'name_count' | 'name_percent' | 'name_count_percent') => updateActiveSlot({ legendFormat: v, barLegendFormat: v, sunburstLegendFormat: v }), [updateActiveSlot]);

  const barLegendFormat = currentSlotConfig.barLegendFormat;
  const setBarLegendFormat = useCallback((v: 'name' | 'name_count' | 'name_percent' | 'name_count_percent') => updateActiveSlot({ barLegendFormat: v }), [updateActiveSlot]);

  const barLegendPosition = currentSlotConfig.barLegendPosition;
  const setBarLegendPosition = useCallback((v: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => updateActiveSlot({ barLegendPosition: v }), [updateActiveSlot]);

  const sunburstLegendLevel = currentSlotConfig.sunburstLegendLevel;
  const setSunburstLegendLevel = useCallback((v: number) => updateActiveSlot({ sunburstLegendLevel: v }), [updateActiveSlot]);

  const sunburstLegendFormat = currentSlotConfig.sunburstLegendFormat;
  const setSunburstLegendFormat = useCallback((v: 'name' | 'name_count' | 'name_percent' | 'name_count_percent') => updateActiveSlot({ sunburstLegendFormat: v }), [updateActiveSlot]);

  const sunburstLegendPosition = currentSlotConfig.sunburstLegendPosition;
  const setSunburstLegendPosition = useCallback((v: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => updateActiveSlot({ sunburstLegendPosition: v }), [updateActiveSlot]);

  const pieLabelPlacement = currentSlotConfig.pieLabelPlacement || 'outside';
  const setPieLabelPlacement = useCallback((v: 'outside' | 'inside' | 'legend_only' | 'edge_aligned') => updateActiveSlot({ pieLabelPlacement: v }), [updateActiveSlot]);

  const pieRadiusRatio = currentSlotConfig.pieRadiusRatio ?? 52;
  const setPieRadiusRatio = useCallback((v: number) => updateActiveSlot({ pieRadiusRatio: v }), [updateActiveSlot]);

  const pieLabelWidth = currentSlotConfig.pieLabelWidth ?? 140;
  const setPieLabelWidth = useCallback((v: number) => updateActiveSlot({ pieLabelWidth: v }), [updateActiveSlot]);

  const customCategoryMap = currentSlotConfig.customCategoryMap || {};
  const setCustomCategoryMap = useCallback((v: Record<string, Record<string, string>>) => updateActiveSlot({ customCategoryMap: v }), [updateActiveSlot]);

  const levelCustomGroupLinks = currentSlotConfig.levelCustomGroupLinks || {};
  const setLevelCustomGroupLinks = useCallback((v: Record<number, Record<string, string>>) => updateActiveSlot({ levelCustomGroupLinks: v }), [updateActiveSlot]);

  const customSliceColors = currentSlotConfig.customSliceColors || {};
  const setCustomSliceColors = useCallback((v: Record<string, string>) => updateActiveSlot({ customSliceColors: v }), [updateActiveSlot]);

  return {
    currentStep,
    setCurrentStep,
    slotsConfig,
    currentSlotConfig,
    updateActiveSlot,
    updateSlot,
    cloneSlotConfig,
    setAllSlotsConfig,
    // Active slot field bindings
    chartType,
    setChartType,
    subTitle,
    setSubTitle,
    primaryField,
    setPrimaryField,
    secondaryField,
    setSecondaryField,
    metricMode,
    setMetricMode,
    sankeyFields,
    setSankeyFields,
    sankeyLabelPositions,
    setSankeyLabelPositions,
    sankeyMaxNodes,
    setSankeyMaxNodes,
    limitCategories,
    setLimitCategories,
    maxCategoriesCount,
    setMaxCategoriesCount,
    numFieldX,
    setNumFieldX,
    numFieldY,
    setNumFieldY,
    numFieldSize,
    setNumFieldSize,
    useUmbrellanizer,
    setUseUmbrellanizer,
    splitMultiValues,
    setSplitMultiValues,
    excludeEmpty,
    setExcludeEmpty,
    showLegend,
    setShowLegend,
    legendPosition,
    setLegendPosition,
    showDataLabels,
    setShowDataLabels,
    labelRotation,
    setLabelRotation,
    donutRatio,
    setDonutRatio,
    smoothLine,
    setSmoothLine,
    sankeyNodeWidth,
    setSankeyNodeWidth,
    sankeyNodeGap,
    setSankeyNodeGap,
    sankeyLeftPadding,
    setSankeyLeftPadding,
    sankeyRightPadding,
    setSankeyRightPadding,
    bubbleScale,
    setBubbleScale,
    gaugeMaxScale,
    setGaugeMaxScale,
    sunburstLevelConfigs,
    setSunburstLevelConfigs,
    sunburstSort,
    setSunburstSort,
    sunburstNodeClick,
    setSunburstNodeClick,
    sunburstEmphasisFocus,
    setSunburstEmphasisFocus,
    barSorting,
    setBarSorting,
    barOrientation,
    setBarOrientation,
    barThickness,
    setBarThickness,
    barBorderRadius,
    setBarBorderRadius,
    barGap,
    setBarGap,
    barClusterGap,
    setBarClusterGap,
    barInnerGap,
    setBarInnerGap,
    enableErrorBars,
    setEnableErrorBars,
    errorBarType,
    setErrorBarType,
    enableHatchPatterns,
    setEnableHatchPatterns,
    axisScaleType,
    setAxisScaleType,
    axisTickDirection,
    setAxisTickDirection,
    showAxisBaseline,
    setShowAxisBaseline,
    customAxisTitleX,
    setCustomAxisTitleX,
    customAxisTitleY,
    setCustomAxisTitleY,
    barLabelPosition,
    setBarLabelPosition,
    barLabelFormat,
    setBarLabelFormat,
    barYAxisWidth,
    setBarYAxisWidth,
    barYAxisOverflow,
    setBarYAxisOverflow,
    barLineHeight,
    setBarLineHeight,
    barYAxisFontSize,
    setBarYAxisFontSize,
    barBenchmarkLine,
    setBarBenchmarkLine,
    barBenchmarkValue,
    setBarBenchmarkValue,
    barBenchmarkLabel,
    setBarBenchmarkLabel,
    barBenchmarkStyle,
    setBarBenchmarkStyle,
    barBenchmarkColor,
    setBarBenchmarkColor,
    legendFormat,
    setLegendFormat,
    barLegendFormat,
    setBarLegendFormat,
    barLegendPosition,
    setBarLegendPosition,
    sunburstLegendLevel,
    setSunburstLegendLevel,
    sunburstLegendFormat,
    setSunburstLegendFormat,
    sunburstLegendPosition,
    setSunburstLegendPosition,
    pieLabelPlacement,
    setPieLabelPlacement,
    pieRadiusRatio,
    setPieRadiusRatio,
    pieLabelWidth,
    setPieLabelWidth,
    customCategoryMap,
    setCustomCategoryMap,
    levelCustomGroupLinks,
    setLevelCustomGroupLinks,
    customSliceColors,
    setCustomSliceColors
  };
}
