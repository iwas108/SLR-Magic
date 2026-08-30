import { useState, useCallback } from 'react';
import { INITIAL_SLOTS_CONFIG, createDefaultSlotConfig } from '../constants/defaultConfigs';
import { optimizeSlotConfig } from '../utils/smartOptimizer';
import type { 
  ChartType, 
  MetricMode, 
  SlotId, 
  SlotConfig, 
  SunburstLevelConfig,
  DecimalPrecision,
  RatioStyle,
  DisplayFormatTemplate
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

  // Intelligent Parameter Optimization Helpers
  const autoOptimizeSlot = useCallback((slotId: SlotId, papers: any[], umbrellanizerMap?: Record<string, Record<string, string>>) => {
    setSlotsConfig(prev => {
      const current = prev[slotId] || createDefaultSlotConfig(slotId);
      const optimized = optimizeSlotConfig(current, papers, { umbrellanizerMap });
      return {
        ...prev,
        [slotId]: optimized
      };
    });
  }, []);

  const autoOptimizeAllSlots = useCallback((papers: any[], umbrellanizerMap?: Record<string, Record<string, string>>) => {
    setSlotsConfig(prev => {
      const next = { ...prev };
      (Object.keys(next) as SlotId[]).forEach((slotId) => {
        next[slotId] = optimizeSlotConfig(next[slotId], papers, { umbrellanizerMap });
      });
      return next;
    });
  }, []);

  const handleAutoOptimizeActiveSlot = useCallback((papers: any[], umbrellanizerMap?: Record<string, Record<string, string>>) => {
    autoOptimizeSlot(activeSlot, papers, umbrellanizerMap);
  }, [activeSlot, autoOptimizeSlot]);

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

  const tailLabelStyle = currentSlotConfig.tailLabelStyle || 'comma_list';
  const setTailLabelStyle = useCallback((v: 'comma_list' | 'other_count' | 'other_items' | 'plain_other') => updateActiveSlot({ tailLabelStyle: v }), [updateActiveSlot]);

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

  const sankeyTopPadding = currentSlotConfig.sankeyTopPadding;
  const setSankeyTopPadding = useCallback((v: number) => updateActiveSlot({ sankeyTopPadding: v }), [updateActiveSlot]);

  const sankeyBottomPadding = currentSlotConfig.sankeyBottomPadding;
  const setSankeyBottomPadding = useCallback((v: number) => updateActiveSlot({ sankeyBottomPadding: v }), [updateActiveSlot]);

  const sankeyOrient = currentSlotConfig.sankeyOrient || 'horizontal';
  const setSankeyOrient = useCallback((v: 'horizontal' | 'vertical') => updateActiveSlot({ sankeyOrient: v }), [updateActiveSlot]);

  const sankeyNodeAlign = currentSlotConfig.sankeyNodeAlign || 'justify';
  const setSankeyNodeAlign = useCallback((v: 'justify' | 'left' | 'right') => updateActiveSlot({ sankeyNodeAlign: v }), [updateActiveSlot]);

  const sankeyCurveness = currentSlotConfig.sankeyCurveness ?? 0.5;
  const setSankeyCurveness = useCallback((v: number) => updateActiveSlot({ sankeyCurveness: v }), [updateActiveSlot]);

  const sankeyLinkColorMode = currentSlotConfig.sankeyLinkColorMode || 'gradient';
  const setSankeyLinkColorMode = useCallback((v: 'gradient' | 'source' | 'target') => updateActiveSlot({ sankeyLinkColorMode: v }), [updateActiveSlot]);

  const sankeyLinkOpacity = currentSlotConfig.sankeyLinkOpacity ?? 45;
  const setSankeyLinkOpacity = useCallback((v: number) => updateActiveSlot({ sankeyLinkOpacity: v }), [updateActiveSlot]);

  const sankeyNodeBorderRadius = currentSlotConfig.sankeyNodeBorderRadius ?? 2;
  const setSankeyNodeBorderRadius = useCallback((v: number) => updateActiveSlot({ sankeyNodeBorderRadius: v }), [updateActiveSlot]);

  const sankeyNodeBorderWidth = currentSlotConfig.sankeyNodeBorderWidth ?? 1;
  const setSankeyNodeBorderWidth = useCallback((v: number) => updateActiveSlot({ sankeyNodeBorderWidth: v }), [updateActiveSlot]);

  const sankeyLayoutIterations = currentSlotConfig.sankeyLayoutIterations ?? 32;
  const setSankeyLayoutIterations = useCallback((v: number) => updateActiveSlot({ sankeyLayoutIterations: v }), [updateActiveSlot]);

  const sankeyDraggable = currentSlotConfig.sankeyDraggable ?? true;
  const setSankeyDraggable = useCallback((v: boolean) => updateActiveSlot({ sankeyDraggable: v }), [updateActiveSlot]);

  const sankeyLabelPosition = currentSlotConfig.sankeyLabelPosition || 'auto';
  const setSankeyLabelPosition = useCallback((v: 'auto' | 'left' | 'right' | 'inside' | 'top' | 'bottom') => updateActiveSlot({ sankeyLabelPosition: v }), [updateActiveSlot]);

  const sankeyLabelDistance = currentSlotConfig.sankeyLabelDistance ?? 6;
  const setSankeyLabelDistance = useCallback((v: number) => updateActiveSlot({ sankeyLabelDistance: v }), [updateActiveSlot]);

  const sankeyLabelOverflow = currentSlotConfig.sankeyLabelOverflow || 'break';
  const setSankeyLabelOverflow = useCallback((v: 'break' | 'truncate' | 'none') => updateActiveSlot({ sankeyLabelOverflow: v }), [updateActiveSlot]);

  const sankeyMaxLabelWidth = currentSlotConfig.sankeyMaxLabelWidth ?? 120;
  const setSankeyMaxLabelWidth = useCallback((v: number) => updateActiveSlot({ sankeyMaxLabelWidth: v }), [updateActiveSlot]);

  const sankeyLabelFontSize = currentSlotConfig.sankeyLabelFontSize;
  const setSankeyLabelFontSize = useCallback((v: number | undefined) => updateActiveSlot({ sankeyLabelFontSize: v }), [updateActiveSlot]);

  const sankeyLabelRotate = currentSlotConfig.sankeyLabelRotate ?? 0;
  const setSankeyLabelRotate = useCallback((v: number) => updateActiveSlot({ sankeyLabelRotate: v }), [updateActiveSlot]);

  const sankeyEmphasisFocus = currentSlotConfig.sankeyEmphasisFocus || 'adjacency';
  const setSankeyEmphasisFocus = useCallback((v: 'adjacency' | 'trajectory' | 'series' | 'none') => updateActiveSlot({ sankeyEmphasisFocus: v }), [updateActiveSlot]);

  const sankeyLevelLabelFormats = currentSlotConfig.sankeyLevelLabelFormats || {};
  const setSankeyLevelLabelFormats = useCallback((v: Record<number, DisplayFormatTemplate>) => updateActiveSlot({ sankeyLevelLabelFormats: v }), [updateActiveSlot]);

  const sankeyLevelNodeGaps = currentSlotConfig.sankeyLevelNodeGaps || {};
  const setSankeyLevelNodeGaps = useCallback((v: Record<number, number>) => updateActiveSlot({ sankeyLevelNodeGaps: v }), [updateActiveSlot]);

  const sankeyLevelLabelDistances = currentSlotConfig.sankeyLevelLabelDistances || {};
  const setSankeyLevelLabelDistances = useCallback((v: Record<number, number>) => updateActiveSlot({ sankeyLevelLabelDistances: v }), [updateActiveSlot]);

  const sankeyLevelNodeWidths = currentSlotConfig.sankeyLevelNodeWidths || {};
  const setSankeyLevelNodeWidths = useCallback((v: Record<number, number>) => updateActiveSlot({ sankeyLevelNodeWidths: v }), [updateActiveSlot]);

  const sankeyLevelPathFilters = currentSlotConfig.sankeyLevelPathFilters || {};
  const setSankeyLevelPathFilters = useCallback((v: Record<number, string>) => updateActiveSlot({ sankeyLevelPathFilters: v }), [updateActiveSlot]);

  const sankeySort = currentSlotConfig.sankeySort || 'desc';
  const setSankeySort = useCallback((v: 'desc' | 'asc' | 'alpha' | 'none') => updateActiveSlot({ sankeySort: v }), [updateActiveSlot]);

  const sankeyLabelLineHeight = currentSlotConfig.sankeyLabelLineHeight ?? 14;
  const setSankeyLabelLineHeight = useCallback((v: number) => updateActiveSlot({ sankeyLabelLineHeight: v }), [updateActiveSlot]);

  const sankeyLabelFontWeight = currentSlotConfig.sankeyLabelFontWeight || '600';
  const setSankeyLabelFontWeight = useCallback((v: 'normal' | 'bold' | '500' | '600' | '700' | '800') => updateActiveSlot({ sankeyLabelFontWeight: v }), [updateActiveSlot]);

  const sankeyLabelColor = currentSlotConfig.sankeyLabelColor || '';
  const setSankeyLabelColor = useCallback((v: string) => updateActiveSlot({ sankeyLabelColor: v }), [updateActiveSlot]);

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

  const labelFormat = currentSlotConfig.labelFormat || 'ratio_percent';
  const setLabelFormat = useCallback((v: DisplayFormatTemplate) => updateActiveSlot({ labelFormat: v, barLabelFormat: v }), [updateActiveSlot]);

  const barLabelPosition = currentSlotConfig.barLabelPosition;
  const setBarLabelPosition = useCallback((v: 'right' | 'inside' | 'insideLeft' | 'insideRight') => updateActiveSlot({ barLabelPosition: v }), [updateActiveSlot]);

  const barLabelFormat = currentSlotConfig.barLabelFormat || 'ratio_percent';
  const setBarLabelFormat = useCallback((v: DisplayFormatTemplate) => updateActiveSlot({ barLabelFormat: v, labelFormat: v }), [updateActiveSlot]);

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
  const setLegendFormat = useCallback((v: DisplayFormatTemplate) => updateActiveSlot({ legendFormat: v, barLegendFormat: v, sunburstLegendFormat: v }), [updateActiveSlot]);

  const barLegendFormat = currentSlotConfig.barLegendFormat || 'name';
  const setBarLegendFormat = useCallback((v: DisplayFormatTemplate) => updateActiveSlot({ barLegendFormat: v, legendFormat: v }), [updateActiveSlot]);

  const barLegendPosition = currentSlotConfig.barLegendPosition;
  const setBarLegendPosition = useCallback((v: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => updateActiveSlot({ barLegendPosition: v }), [updateActiveSlot]);

  const sunburstLegendLevel = currentSlotConfig.sunburstLegendLevel;
  const setSunburstLegendLevel = useCallback((v: number) => updateActiveSlot({ sunburstLegendLevel: v }), [updateActiveSlot]);

  const sunburstLegendFormat = currentSlotConfig.sunburstLegendFormat || 'name';
  const setSunburstLegendFormat = useCallback((v: DisplayFormatTemplate) => updateActiveSlot({ sunburstLegendFormat: v, legendFormat: v }), [updateActiveSlot]);

  const sunburstLegendPosition = currentSlotConfig.sunburstLegendPosition;
  const setSunburstLegendPosition = useCallback((v: 'top-left' | 'top-center' | 'top-right' | 'left' | 'right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => updateActiveSlot({ sunburstLegendPosition: v }), [updateActiveSlot]);

  const decimalPrecision = currentSlotConfig.decimalPrecision;
  const setDecimalPrecision = useCallback((v?: DecimalPrecision) => updateActiveSlot({ decimalPrecision: v }), [updateActiveSlot]);

  const useTildeForCoarse = currentSlotConfig.useTildeForCoarse;
  const setUseTildeForCoarse = useCallback((v?: boolean) => updateActiveSlot({ useTildeForCoarse: v }), [updateActiveSlot]);

  const ratioStyle = currentSlotConfig.ratioStyle;
  const setRatioStyle = useCallback((v?: RatioStyle) => updateActiveSlot({ ratioStyle: v }), [updateActiveSlot]);

  const forceCohortDenominator = currentSlotConfig.forceCohortDenominator;
  const setForceCohortDenominator = useCallback((v?: boolean) => updateActiveSlot({ forceCohortDenominator: v }), [updateActiveSlot]);

  const pieLabelPlacement = currentSlotConfig.pieLabelPlacement || 'outside';
  const setPieLabelPlacement = useCallback((v: 'outside' | 'inside' | 'legend_only' | 'edge_aligned') => updateActiveSlot({ pieLabelPlacement: v }), [updateActiveSlot]);

  const pieRadiusRatio = currentSlotConfig.pieRadiusRatio ?? 52;
  const setPieRadiusRatio = useCallback((v: number) => updateActiveSlot({ pieRadiusRatio: v }), [updateActiveSlot]);

  const pieLabelWidth = currentSlotConfig.pieLabelWidth ?? 140;
  const setPieLabelWidth = useCallback((v: number) => updateActiveSlot({ pieLabelWidth: v }), [updateActiveSlot]);

  const pieLeaderLineLength = currentSlotConfig.pieLeaderLineLength ?? 12;
  const setPieLeaderLineLength = useCallback((v: number) => updateActiveSlot({ pieLeaderLineLength: v }), [updateActiveSlot]);

  const pieLeaderLineLength2 = currentSlotConfig.pieLeaderLineLength2 ?? 14;
  const setPieLeaderLineLength2 = useCallback((v: number) => updateActiveSlot({ pieLeaderLineLength2: v }), [updateActiveSlot]);

  const pieLabelDistance = currentSlotConfig.pieLabelDistance ?? 6;
  const setPieLabelDistance = useCallback((v: number) => updateActiveSlot({ pieLabelDistance: v }), [updateActiveSlot]);

  const pieLineHeight = currentSlotConfig.pieLineHeight ?? 15;
  const setPieLineHeight = useCallback((v: number) => updateActiveSlot({ pieLineHeight: v }), [updateActiveSlot]);

  const barLabelDistance = currentSlotConfig.barLabelDistance ?? 5;
  const setBarLabelDistance = useCallback((v: number) => updateActiveSlot({ barLabelDistance: v }), [updateActiveSlot]);

  const legendDistance = currentSlotConfig.legendDistance ?? 20;
  const setLegendDistance = useCallback((v: number) => updateActiveSlot({ legendDistance: v }), [updateActiveSlot]);

  const legendWidth = currentSlotConfig.legendWidth;
  const setLegendWidth = useCallback((v?: number) => updateActiveSlot({ legendWidth: v }), [updateActiveSlot]);

  const legendLineHeight = currentSlotConfig.legendLineHeight ?? 15;
  const setLegendLineHeight = useCallback((v: number) => updateActiveSlot({ legendLineHeight: v }), [updateActiveSlot]);

  const legendItemGap = currentSlotConfig.legendItemGap ?? 12;
  const setLegendItemGap = useCallback((v: number) => updateActiveSlot({ legendItemGap: v }), [updateActiveSlot]);

  const legendFontSize = currentSlotConfig.legendFontSize;
  const setLegendFontSize = useCallback((v?: number) => updateActiveSlot({ legendFontSize: v }), [updateActiveSlot]);

  const legendOverflow = currentSlotConfig.legendOverflow || 'break';
  const setLegendOverflow = useCallback((v: 'break' | 'truncate' | 'none') => updateActiveSlot({ legendOverflow: v }), [updateActiveSlot]);

  const customCategoryMap = currentSlotConfig.customCategoryMap || {};
  const setCustomCategoryMap = useCallback((v: Record<string, Record<string, string>>) => updateActiveSlot({ customCategoryMap: v }), [updateActiveSlot]);

  const levelCustomGroupLinks = currentSlotConfig.levelCustomGroupLinks || {};
  const setLevelCustomGroupLinks = useCallback((v: Record<number, Record<string, string>>) => updateActiveSlot({ levelCustomGroupLinks: v }), [updateActiveSlot]);

  const customSliceColors = currentSlotConfig.customSliceColors || {};
  const setCustomSliceColors = useCallback((v: Record<string, string>) => updateActiveSlot({ customSliceColors: v }), [updateActiveSlot]);

  // Enhanced Scientific Customization Setters
  const lineWidth = currentSlotConfig.lineWidth ?? 2.5;
  const setLineWidth = useCallback((v: number) => updateActiveSlot({ lineWidth: v }), [updateActiveSlot]);

  const showLineMarkers = currentSlotConfig.showLineMarkers ?? true;
  const setShowLineMarkers = useCallback((v: boolean) => updateActiveSlot({ showLineMarkers: v }), [updateActiveSlot]);

  const lineMarkerSize = currentSlotConfig.lineMarkerSize ?? 8;
  const setLineMarkerSize = useCallback((v: number) => updateActiveSlot({ lineMarkerSize: v }), [updateActiveSlot]);

  const lineAreaOpacity = currentSlotConfig.lineAreaOpacity ?? 15;
  const setLineAreaOpacity = useCallback((v: number) => updateActiveSlot({ lineAreaOpacity: v }), [updateActiveSlot]);

  const lineStepMode = currentSlotConfig.lineStepMode || 'none';
  const setLineStepMode = useCallback((v: 'none' | 'start' | 'middle' | 'end') => updateActiveSlot({ lineStepMode: v }), [updateActiveSlot]);

  const roseType = currentSlotConfig.roseType || 'none';
  const setRoseType = useCallback((v: 'none' | 'radius' | 'area') => updateActiveSlot({ roseType: v }), [updateActiveSlot]);

  const piePadAngle = currentSlotConfig.piePadAngle ?? 2;
  const setPiePadAngle = useCallback((v: number) => updateActiveSlot({ piePadAngle: v }), [updateActiveSlot]);

  const pieCornerRadius = currentSlotConfig.pieCornerRadius ?? 4;
  const setPieCornerRadius = useCallback((v: number) => updateActiveSlot({ pieCornerRadius: v }), [updateActiveSlot]);

  const treemapAlgorithm = currentSlotConfig.treemapAlgorithm || 'squarified';
  const setTreemapAlgorithm = useCallback((v: 'squarified' | 'sliceAndDice' | 'binary') => updateActiveSlot({ treemapAlgorithm: v }), [updateActiveSlot]);

  const treemapVisibleDepth = currentSlotConfig.treemapVisibleDepth ?? 2;
  const setTreemapVisibleDepth = useCallback((v: number) => updateActiveSlot({ treemapVisibleDepth: v }), [updateActiveSlot]);

  const treemapGapWidth = currentSlotConfig.treemapGapWidth ?? 2;
  const setTreemapGapWidth = useCallback((v: number) => updateActiveSlot({ treemapGapWidth: v }), [updateActiveSlot]);

  const treemapBorderWidth = currentSlotConfig.treemapBorderWidth ?? 2;
  const setTreemapBorderWidth = useCallback((v: number) => updateActiveSlot({ treemapBorderWidth: v }), [updateActiveSlot]);

  const heatmapCellRadius = currentSlotConfig.heatmapCellRadius ?? 0;
  const setHeatmapCellRadius = useCallback((v: number) => updateActiveSlot({ heatmapCellRadius: v }), [updateActiveSlot]);

  const heatmapColorPreset = currentSlotConfig.heatmapColorPreset || 'academic';
  const setHeatmapColorPreset = useCallback((v: 'academic' | 'viridis' | 'plasma' | 'thermal' | 'coolwarm') => updateActiveSlot({ heatmapColorPreset: v }), [updateActiveSlot]);

  const radarShape = currentSlotConfig.radarShape || 'polygon';
  const setRadarShape = useCallback((v: 'polygon' | 'circle') => updateActiveSlot({ radarShape: v }), [updateActiveSlot]);

  const radarAreaOpacity = currentSlotConfig.radarAreaOpacity ?? 28;
  const setRadarAreaOpacity = useCallback((v: number) => updateActiveSlot({ radarAreaOpacity: v }), [updateActiveSlot]);

  const radarLineWidth = currentSlotConfig.radarLineWidth ?? 2.5;
  const setRadarLineWidth = useCallback((v: number) => updateActiveSlot({ radarLineWidth: v }), [updateActiveSlot]);

  const radarSplitNumber = currentSlotConfig.radarSplitNumber ?? 5;
  const setRadarSplitNumber = useCallback((v: number) => updateActiveSlot({ radarSplitNumber: v }), [updateActiveSlot]);

  const radarMode = currentSlotConfig.radarMode || 'multi_variable';
  const setRadarMode = useCallback((v: 'multi_variable' | 'qa_breakdown') => updateActiveSlot({ radarMode: v }), [updateActiveSlot]);

  const radarVariables = currentSlotConfig.radarVariables || [];
  const setRadarVariables = useCallback((v: string[]) => updateActiveSlot({ radarVariables: v }), [updateActiveSlot]);

  const radarVariableAliases = currentSlotConfig.radarVariableAliases || {};
  const setRadarVariableAliases = useCallback((v: Record<string, string>) => updateActiveSlot({ radarVariableAliases: v }), [updateActiveSlot]);

  const radarVariableTargets = currentSlotConfig.radarVariableTargets || {};
  const setRadarVariableTargets = useCallback((v: Record<string, number>) => updateActiveSlot({ radarVariableTargets: v }), [updateActiveSlot]);

  const radarRadius = currentSlotConfig.radarRadius ?? 65;
  const setRadarRadius = useCallback((v: number) => updateActiveSlot({ radarRadius: v }), [updateActiveSlot]);

  const radarAxisLine = currentSlotConfig.radarAxisLine ?? true;
  const setRadarAxisLine = useCallback((v: boolean) => updateActiveSlot({ radarAxisLine: v }), [updateActiveSlot]);

  const radarSplitLine = currentSlotConfig.radarSplitLine ?? true;
  const setRadarSplitLine = useCallback((v: boolean) => updateActiveSlot({ radarSplitLine: v }), [updateActiveSlot]);

  const radarSplitArea = currentSlotConfig.radarSplitArea ?? true;
  const setRadarSplitArea = useCallback((v: boolean) => updateActiveSlot({ radarSplitArea: v }), [updateActiveSlot]);

  const radarAxisNameMargin = currentSlotConfig.radarAxisNameMargin ?? 15;
  const setRadarAxisNameMargin = useCallback((v: number) => updateActiveSlot({ radarAxisNameMargin: v }), [updateActiveSlot]);

  const radarAxisNameWidth = currentSlotConfig.radarAxisNameWidth ?? 120;
  const setRadarAxisNameWidth = useCallback((v: number) => updateActiveSlot({ radarAxisNameWidth: v }), [updateActiveSlot]);

  const radarAxisNameOverflow = currentSlotConfig.radarAxisNameOverflow || 'break';
  const setRadarAxisNameOverflow = useCallback((v: 'break' | 'truncate' | 'none') => updateActiveSlot({ radarAxisNameOverflow: v }), [updateActiveSlot]);

  const radarAxisNameLineHeight = currentSlotConfig.radarAxisNameLineHeight ?? 14;
  const setRadarAxisNameLineHeight = useCallback((v: number) => updateActiveSlot({ radarAxisNameLineHeight: v }), [updateActiveSlot]);

  const radarShowDataLabels = currentSlotConfig.radarShowDataLabels ?? false;
  const setRadarShowDataLabels = useCallback((v: boolean) => updateActiveSlot({ radarShowDataLabels: v }), [updateActiveSlot]);

  const radarDataLabelPosition = currentSlotConfig.radarDataLabelPosition || 'top';
  const setRadarDataLabelPosition = useCallback((v: 'top' | 'bottom' | 'inside' | 'outside' | 'auto') => updateActiveSlot({ radarDataLabelPosition: v }), [updateActiveSlot]);

  const radarBaselineLineStyle = currentSlotConfig.radarBaselineLineStyle || 'solid';
  const setRadarBaselineLineStyle = useCallback((v: 'solid' | 'dashed' | 'dotted') => updateActiveSlot({ radarBaselineLineStyle: v }), [updateActiveSlot]);

  const radarBaselineSymbol = currentSlotConfig.radarBaselineSymbol || 'circle';
  const setRadarBaselineSymbol = useCallback((v: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none') => updateActiveSlot({ radarBaselineSymbol: v }), [updateActiveSlot]);

  const radarBaselineSymbolSize = currentSlotConfig.radarBaselineSymbolSize ?? 6;
  const setRadarBaselineSymbolSize = useCallback((v: number) => updateActiveSlot({ radarBaselineSymbolSize: v }), [updateActiveSlot]);

  const radarTargetSymbol = currentSlotConfig.radarTargetSymbol || 'circle';
  const setRadarTargetSymbol = useCallback((v: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none') => updateActiveSlot({ radarTargetSymbol: v }), [updateActiveSlot]);

  const radarTargetSymbolSize = currentSlotConfig.radarTargetSymbolSize ?? 4;
  const setRadarTargetSymbolSize = useCallback((v: number) => updateActiveSlot({ radarTargetSymbolSize: v }), [updateActiveSlot]);

  const radarIndicatorFormat = currentSlotConfig.radarIndicatorFormat || 'two_line';
  const setRadarIndicatorFormat = useCallback((v: 'two_line' | 'single_line' | 'ratio_percent' | 'name_only') => updateActiveSlot({ radarIndicatorFormat: v }), [updateActiveSlot]);

  const radarShowTarget = currentSlotConfig.radarShowTarget ?? true;
  const setRadarShowTarget = useCallback((v: boolean) => updateActiveSlot({ radarShowTarget: v }), [updateActiveSlot]);

  const radarTargetName = currentSlotConfig.radarTargetName || 'Horticultural Requirement Target';
  const setRadarTargetName = useCallback((v: string) => updateActiveSlot({ radarTargetName: v }), [updateActiveSlot]);

  const radarTargetValue = currentSlotConfig.radarTargetValue ?? 100;
  const setRadarTargetValue = useCallback((v: number) => updateActiveSlot({ radarTargetValue: v }), [updateActiveSlot]);

  const radarTargetLineStyle = currentSlotConfig.radarTargetLineStyle || 'dashed';
  const setRadarTargetLineStyle = useCallback((v: 'dashed' | 'solid' | 'dotted') => updateActiveSlot({ radarTargetLineStyle: v }), [updateActiveSlot]);

  const radarTargetLineWidth = currentSlotConfig.radarTargetLineWidth ?? 2;
  const setRadarTargetLineWidth = useCallback((v: number) => updateActiveSlot({ radarTargetLineWidth: v }), [updateActiveSlot]);

  const radarTargetColor = currentSlotConfig.radarTargetColor || '#d9534f';
  const setRadarTargetColor = useCallback((v: string) => updateActiveSlot({ radarTargetColor: v }), [updateActiveSlot]);

  const radarTargetAreaOpacity = currentSlotConfig.radarTargetAreaOpacity ?? 8;
  const setRadarTargetAreaOpacity = useCallback((v: number) => updateActiveSlot({ radarTargetAreaOpacity: v }), [updateActiveSlot]);

  const radarBaselineName = currentSlotConfig.radarBaselineName || 'Empirical Cohort Baseline (n={n})';
  const setRadarBaselineName = useCallback((v: string) => updateActiveSlot({ radarBaselineName: v }), [updateActiveSlot]);

  const radarBaselineColor = currentSlotConfig.radarBaselineColor || '';
  const setRadarBaselineColor = useCallback((v: string) => updateActiveSlot({ radarBaselineColor: v }), [updateActiveSlot]);

  const funnelAlign = currentSlotConfig.funnelAlign || 'center';
  const setFunnelAlign = useCallback((v: 'center' | 'left' | 'right') => updateActiveSlot({ funnelAlign: v }), [updateActiveSlot]);

  const funnelGap = currentSlotConfig.funnelGap ?? 2;
  const setFunnelGap = useCallback((v: number) => updateActiveSlot({ funnelGap: v }), [updateActiveSlot]);

  const funnelNeckWidth = currentSlotConfig.funnelNeckWidth ?? 30;
  const setFunnelNeckWidth = useCallback((v: number) => updateActiveSlot({ funnelNeckWidth: v }), [updateActiveSlot]);

  const funnelNeckHeight = currentSlotConfig.funnelNeckHeight ?? 25;
  const setFunnelNeckHeight = useCallback((v: number) => updateActiveSlot({ funnelNeckHeight: v }), [updateActiveSlot]);

  const boxplotBoxWidth = currentSlotConfig.boxplotBoxWidth ?? 30;
  const setBoxplotBoxWidth = useCallback((v: number) => updateActiveSlot({ boxplotBoxWidth: v }), [updateActiveSlot]);

  const boxplotShowScatter = currentSlotConfig.boxplotShowScatter ?? false;
  const setBoxplotShowScatter = useCallback((v: boolean) => updateActiveSlot({ boxplotShowScatter: v }), [updateActiveSlot]);

  const boxplotOrientation = currentSlotConfig.boxplotOrientation || 'vertical';
  const setBoxplotOrientation = useCallback((v: 'vertical' | 'horizontal') => updateActiveSlot({ boxplotOrientation: v }), [updateActiveSlot]);

  const scatterPointSize = currentSlotConfig.scatterPointSize ?? 10;
  const setScatterPointSize = useCallback((v: number) => updateActiveSlot({ scatterPointSize: v }), [updateActiveSlot]);

  const scatterPointOpacity = currentSlotConfig.scatterPointOpacity ?? 80;
  const setScatterPointOpacity = useCallback((v: number) => updateActiveSlot({ scatterPointOpacity: v }), [updateActiveSlot]);

  const scatterShowRegression = currentSlotConfig.scatterShowRegression ?? false;
  const setScatterShowRegression = useCallback((v: boolean) => updateActiveSlot({ scatterShowRegression: v }), [updateActiveSlot]);

  const scatterRegressionType = currentSlotConfig.scatterRegressionType || 'linear';
  const setScatterRegressionType = useCallback((v: 'linear' | 'mean') => updateActiveSlot({ scatterRegressionType: v }), [updateActiveSlot]);

  const graphRepulsion = currentSlotConfig.graphRepulsion ?? 120;
  const setGraphRepulsion = useCallback((v: number) => updateActiveSlot({ graphRepulsion: v }), [updateActiveSlot]);

  const graphEdgeLength = currentSlotConfig.graphEdgeLength ?? 90;
  const setGraphEdgeLength = useCallback((v: number) => updateActiveSlot({ graphEdgeLength: v }), [updateActiveSlot]);

  const graphGravity = currentSlotConfig.graphGravity ?? 0.1;
  const setGraphGravity = useCallback((v: number) => updateActiveSlot({ graphGravity: v }), [updateActiveSlot]);

  const graphCurveness = currentSlotConfig.graphCurveness ?? 0.2;
  const setGraphCurveness = useCallback((v: number) => updateActiveSlot({ graphCurveness: v }), [updateActiveSlot]);

  const graphShowLinkWeights = currentSlotConfig.graphShowLinkWeights ?? true;
  const setGraphShowLinkWeights = useCallback((v: boolean) => updateActiveSlot({ graphShowLinkWeights: v }), [updateActiveSlot]);

  const gaugeStartAngle = currentSlotConfig.gaugeStartAngle ?? 225;
  const setGaugeStartAngle = useCallback((v: number) => updateActiveSlot({ gaugeStartAngle: v }), [updateActiveSlot]);

  const gaugeEndAngle = currentSlotConfig.gaugeEndAngle ?? -45;
  const setGaugeEndAngle = useCallback((v: number) => updateActiveSlot({ gaugeEndAngle: v }), [updateActiveSlot]);

  const gaugePointerWidth = currentSlotConfig.gaugePointerWidth ?? 6;
  const setGaugePointerWidth = useCallback((v: number) => updateActiveSlot({ gaugePointerWidth: v }), [updateActiveSlot]);

  const gaugeDialWidth = currentSlotConfig.gaugeDialWidth ?? 14;
  const setGaugeDialWidth = useCallback((v: number) => updateActiveSlot({ gaugeDialWidth: v }), [updateActiveSlot]);

  const calendarCellSize = currentSlotConfig.calendarCellSize ?? 14;
  const setCalendarCellSize = useCallback((v: number) => updateActiveSlot({ calendarCellSize: v }), [updateActiveSlot]);

  const calendarYear = currentSlotConfig.calendarYear || 'auto';
  const setCalendarYear = useCallback((v: string) => updateActiveSlot({ calendarYear: v }), [updateActiveSlot]);

  const stackedNormalized = currentSlotConfig.stackedNormalized ?? false;
  const setStackedNormalized = useCallback((v: boolean) => updateActiveSlot({ stackedNormalized: v }), [updateActiveSlot]);

  return {
    currentStep,
    setCurrentStep,
    slotsConfig,
    currentSlotConfig,
    updateActiveSlot,
    updateSlot,
    cloneSlotConfig,
    setAllSlotsConfig,
    autoOptimizeSlot,
    autoOptimizeAllSlots,
    handleAutoOptimizeActiveSlot,
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
    tailLabelStyle,
    setTailLabelStyle,
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
    sankeyTopPadding,
    setSankeyTopPadding,
    sankeyBottomPadding,
    setSankeyBottomPadding,
    sankeyOrient,
    setSankeyOrient,
    sankeyNodeAlign,
    setSankeyNodeAlign,
    sankeyCurveness,
    setSankeyCurveness,
    sankeyLinkColorMode,
    setSankeyLinkColorMode,
    sankeyLinkOpacity,
    setSankeyLinkOpacity,
    sankeyNodeBorderRadius,
    setSankeyNodeBorderRadius,
    sankeyNodeBorderWidth,
    setSankeyNodeBorderWidth,
    sankeyLayoutIterations,
    setSankeyLayoutIterations,
    sankeyDraggable,
    setSankeyDraggable,
    sankeyLabelPosition,
    setSankeyLabelPosition,
    sankeyLabelDistance,
    setSankeyLabelDistance,
    sankeyLabelOverflow,
    setSankeyLabelOverflow,
    sankeyMaxLabelWidth,
    setSankeyMaxLabelWidth,
    sankeyLabelFontSize,
    setSankeyLabelFontSize,
    sankeyLabelRotate,
    setSankeyLabelRotate,
    sankeyEmphasisFocus,
    setSankeyEmphasisFocus,
    sankeyLevelLabelFormats,
    setSankeyLevelLabelFormats,
    sankeyLevelNodeGaps,
    setSankeyLevelNodeGaps,
    sankeyLevelLabelDistances,
    setSankeyLevelLabelDistances,
    sankeyLevelNodeWidths,
    setSankeyLevelNodeWidths,
    sankeyLevelPathFilters,
    setSankeyLevelPathFilters,
    sankeySort,
    setSankeySort,
    sankeyLabelLineHeight,
    setSankeyLabelLineHeight,
    sankeyLabelFontWeight,
    setSankeyLabelFontWeight,
    sankeyLabelColor,
    setSankeyLabelColor,
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
    labelFormat,
    setLabelFormat,
    barLabelPosition,
    setBarLabelPosition,
    barLabelFormat,
    setBarLabelFormat,
    decimalPrecision,
    setDecimalPrecision,
    useTildeForCoarse,
    setUseTildeForCoarse,
    ratioStyle,
    setRatioStyle,
    forceCohortDenominator,
    setForceCohortDenominator,
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
    pieLeaderLineLength,
    setPieLeaderLineLength,
    pieLeaderLineLength2,
    setPieLeaderLineLength2,
    pieLabelDistance,
    setPieLabelDistance,
    pieLineHeight,
    setPieLineHeight,
    barLabelDistance,
    setBarLabelDistance,
    legendDistance,
    setLegendDistance,
    legendWidth,
    setLegendWidth,
    legendLineHeight,
    setLegendLineHeight,
    legendItemGap,
    setLegendItemGap,
    legendFontSize,
    setLegendFontSize,
    legendOverflow,
    setLegendOverflow,
    customCategoryMap,
    setCustomCategoryMap,
    levelCustomGroupLinks,
    setLevelCustomGroupLinks,
    customSliceColors,
    setCustomSliceColors,
    lineWidth,
    setLineWidth,
    showLineMarkers,
    setShowLineMarkers,
    lineMarkerSize,
    setLineMarkerSize,
    lineAreaOpacity,
    setLineAreaOpacity,
    lineStepMode,
    setLineStepMode,
    roseType,
    setRoseType,
    piePadAngle,
    setPiePadAngle,
    pieCornerRadius,
    setPieCornerRadius,
    treemapAlgorithm,
    setTreemapAlgorithm,
    treemapVisibleDepth,
    setTreemapVisibleDepth,
    treemapGapWidth,
    setTreemapGapWidth,
    treemapBorderWidth,
    setTreemapBorderWidth,
    heatmapCellRadius,
    setHeatmapCellRadius,
    heatmapColorPreset,
    setHeatmapColorPreset,
    radarShape,
    setRadarShape,
    radarAreaOpacity,
    setRadarAreaOpacity,
    radarLineWidth,
    setRadarLineWidth,
    radarSplitNumber,
    setRadarSplitNumber,
    radarMode,
    setRadarMode,
    radarVariables,
    setRadarVariables,
    radarVariableAliases,
    setRadarVariableAliases,
    radarVariableTargets,
    setRadarVariableTargets,
    radarRadius,
    setRadarRadius,
    radarAxisLine,
    setRadarAxisLine,
    radarSplitLine,
    setRadarSplitLine,
    radarSplitArea,
    setRadarSplitArea,
    radarAxisNameMargin,
    setRadarAxisNameMargin,
    radarAxisNameWidth,
    setRadarAxisNameWidth,
    radarAxisNameOverflow,
    setRadarAxisNameOverflow,
    radarAxisNameLineHeight,
    setRadarAxisNameLineHeight,
    radarShowDataLabels,
    setRadarShowDataLabels,
    radarDataLabelPosition,
    setRadarDataLabelPosition,
    radarBaselineLineStyle,
    setRadarBaselineLineStyle,
    radarBaselineSymbol,
    setRadarBaselineSymbol,
    radarBaselineSymbolSize,
    setRadarBaselineSymbolSize,
    radarTargetSymbol,
    setRadarTargetSymbol,
    radarTargetSymbolSize,
    setRadarTargetSymbolSize,
    radarIndicatorFormat,
    setRadarIndicatorFormat,
    radarShowTarget,
    setRadarShowTarget,
    radarTargetName,
    setRadarTargetName,
    radarTargetValue,
    setRadarTargetValue,
    radarTargetLineStyle,
    setRadarTargetLineStyle,
    radarTargetLineWidth,
    setRadarTargetLineWidth,
    radarTargetColor,
    setRadarTargetColor,
    radarTargetAreaOpacity,
    setRadarTargetAreaOpacity,
    radarBaselineName,
    setRadarBaselineName,
    radarBaselineColor,
    setRadarBaselineColor,
    funnelAlign,
    setFunnelAlign,
    funnelGap,
    setFunnelGap,
    funnelNeckWidth,
    setFunnelNeckWidth,
    funnelNeckHeight,
    setFunnelNeckHeight,
    boxplotBoxWidth,
    setBoxplotBoxWidth,
    boxplotShowScatter,
    setBoxplotShowScatter,
    boxplotOrientation,
    setBoxplotOrientation,
    scatterPointSize,
    setScatterPointSize,
    scatterPointOpacity,
    setScatterPointOpacity,
    scatterShowRegression,
    setScatterShowRegression,
    scatterRegressionType,
    setScatterRegressionType,
    graphRepulsion,
    setGraphRepulsion,
    graphEdgeLength,
    setGraphEdgeLength,
    graphGravity,
    setGraphGravity,
    graphCurveness,
    setGraphCurveness,
    graphShowLinkWeights,
    setGraphShowLinkWeights,
    gaugeStartAngle,
    setGaugeStartAngle,
    gaugeEndAngle,
    setGaugeEndAngle,
    gaugePointerWidth,
    setGaugePointerWidth,
    gaugeDialWidth,
    setGaugeDialWidth,
    calendarCellSize,
    setCalendarCellSize,
    calendarYear,
    setCalendarYear,
    stackedNormalized,
    setStackedNormalized
  };
}
