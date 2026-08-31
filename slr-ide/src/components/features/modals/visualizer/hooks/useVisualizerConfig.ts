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
  DisplayFormatTemplate,
  AxisLocation,
  AxisLabelFormat,
  AxisGridLineStyle,
  AxisFontWeight,
  AxisFontStyle
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

  const legendType = currentSlotConfig.legendType || 'plain';
  const setLegendType = useCallback((v: 'plain' | 'scroll') => updateActiveSlot({ legendType: v }), [updateActiveSlot]);

  const legendAlign = currentSlotConfig.legendAlign || 'auto';
  const setLegendAlign = useCallback((v: 'auto' | 'left' | 'right') => updateActiveSlot({ legendAlign: v }), [updateActiveSlot]);

  const legendIcon = currentSlotConfig.legendIcon || 'inherit';
  const setLegendIcon = useCallback((v: 'inherit' | 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond' | 'pin' | 'arrow' | 'none' | 'line') => updateActiveSlot({ legendIcon: v }), [updateActiveSlot]);

  const legendItemWidth = currentSlotConfig.legendItemWidth ?? 25;
  const setLegendItemWidth = useCallback((v: number) => updateActiveSlot({ legendItemWidth: v }), [updateActiveSlot]);

  const legendItemHeight = currentSlotConfig.legendItemHeight ?? 14;
  const setLegendItemHeight = useCallback((v: number) => updateActiveSlot({ legendItemHeight: v }), [updateActiveSlot]);

  const legendFontWeight = currentSlotConfig.legendFontWeight || 'normal';
  const setLegendFontWeight = useCallback((v: 'normal' | 'bold' | '500' | '600' | '700') => updateActiveSlot({ legendFontWeight: v }), [updateActiveSlot]);

  const legendTextColor = currentSlotConfig.legendTextColor || '';
  const setLegendTextColor = useCallback((v: string) => updateActiveSlot({ legendTextColor: v }), [updateActiveSlot]);

  const legendBackgroundColor = currentSlotConfig.legendBackgroundColor || 'transparent';
  const setLegendBackgroundColor = useCallback((v: string) => updateActiveSlot({ legendBackgroundColor: v }), [updateActiveSlot]);

  const legendBorderColor = currentSlotConfig.legendBorderColor || 'transparent';
  const setLegendBorderColor = useCallback((v: string) => updateActiveSlot({ legendBorderColor: v }), [updateActiveSlot]);

  const legendBorderWidth = currentSlotConfig.legendBorderWidth ?? 0;
  const setLegendBorderWidth = useCallback((v: number) => updateActiveSlot({ legendBorderWidth: v }), [updateActiveSlot]);

  const legendBorderRadius = currentSlotConfig.legendBorderRadius ?? 4;
  const setLegendBorderRadius = useCallback((v: number) => updateActiveSlot({ legendBorderRadius: v }), [updateActiveSlot]);

  const legendPadding = currentSlotConfig.legendPadding ?? 5;
  const setLegendPadding = useCallback((v: number) => updateActiveSlot({ legendPadding: v }), [updateActiveSlot]);

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

  // Axis Titles Customization
  const showAxisTitleX = currentSlotConfig.showAxisTitleX ?? true;
  const setShowAxisTitleX = useCallback((v: boolean) => updateActiveSlot({ showAxisTitleX: v }), [updateActiveSlot]);

  const showAxisTitleY = currentSlotConfig.showAxisTitleY ?? true;
  const setShowAxisTitleY = useCallback((v: boolean) => updateActiveSlot({ showAxisTitleY: v }), [updateActiveSlot]);

  const axisTitleFontSizeX = currentSlotConfig.axisTitleFontSizeX ?? 11;
  const setAxisTitleFontSizeX = useCallback((v: number) => updateActiveSlot({ axisTitleFontSizeX: v }), [updateActiveSlot]);

  const axisTitleFontSizeY = currentSlotConfig.axisTitleFontSizeY ?? 11;
  const setAxisTitleFontSizeY = useCallback((v: number) => updateActiveSlot({ axisTitleFontSizeY: v }), [updateActiveSlot]);

  const axisTitleFontWeightX = currentSlotConfig.axisTitleFontWeightX || 'bold';
  const setAxisTitleFontWeightX = useCallback((v: AxisFontWeight) => updateActiveSlot({ axisTitleFontWeightX: v }), [updateActiveSlot]);

  const axisTitleFontWeightY = currentSlotConfig.axisTitleFontWeightY || 'bold';
  const setAxisTitleFontWeightY = useCallback((v: AxisFontWeight) => updateActiveSlot({ axisTitleFontWeightY: v }), [updateActiveSlot]);

  const axisTitleFontStyleX = currentSlotConfig.axisTitleFontStyleX || 'normal';
  const setAxisTitleFontStyleX = useCallback((v: AxisFontStyle) => updateActiveSlot({ axisTitleFontStyleX: v }), [updateActiveSlot]);

  const axisTitleFontStyleY = currentSlotConfig.axisTitleFontStyleY || 'normal';
  const setAxisTitleFontStyleY = useCallback((v: AxisFontStyle) => updateActiveSlot({ axisTitleFontStyleY: v }), [updateActiveSlot]);

  const axisTitleColorX = currentSlotConfig.axisTitleColorX || '';
  const setAxisTitleColorX = useCallback((v: string) => updateActiveSlot({ axisTitleColorX: v }), [updateActiveSlot]);

  const axisTitleColorY = currentSlotConfig.axisTitleColorY || '';
  const setAxisTitleColorY = useCallback((v: string) => updateActiveSlot({ axisTitleColorY: v }), [updateActiveSlot]);

  const axisTitleLocationX = currentSlotConfig.axisTitleLocationX || 'middle';
  const setAxisTitleLocationX = useCallback((v: AxisLocation) => updateActiveSlot({ axisTitleLocationX: v }), [updateActiveSlot]);

  const axisTitleLocationY = currentSlotConfig.axisTitleLocationY || 'middle';
  const setAxisTitleLocationY = useCallback((v: AxisLocation) => updateActiveSlot({ axisTitleLocationY: v }), [updateActiveSlot]);

  const axisTitleGapX = currentSlotConfig.axisTitleGapX ?? 28;
  const setAxisTitleGapX = useCallback((v: number) => updateActiveSlot({ axisTitleGapX: v }), [updateActiveSlot]);

  const axisTitleGapY = currentSlotConfig.axisTitleGapY ?? 38;
  const setAxisTitleGapY = useCallback((v: number) => updateActiveSlot({ axisTitleGapY: v }), [updateActiveSlot]);

  // Axis Tick Labels Customization
  const showAxisLabelX = currentSlotConfig.showAxisLabelX ?? true;
  const setShowAxisLabelX = useCallback((v: boolean) => updateActiveSlot({ showAxisLabelX: v }), [updateActiveSlot]);

  const showAxisLabelY = currentSlotConfig.showAxisLabelY ?? true;
  const setShowAxisLabelY = useCallback((v: boolean) => updateActiveSlot({ showAxisLabelY: v }), [updateActiveSlot]);

  const axisLabelFontSizeX = currentSlotConfig.axisLabelFontSizeX ?? 11;
  const setAxisLabelFontSizeX = useCallback((v: number) => updateActiveSlot({ axisLabelFontSizeX: v }), [updateActiveSlot]);

  const axisLabelFontSizeY = currentSlotConfig.axisLabelFontSizeY ?? 11;
  const setAxisLabelFontSizeY = useCallback((v: number) => updateActiveSlot({ axisLabelFontSizeY: v }), [updateActiveSlot]);

  const axisLabelFontWeightX = currentSlotConfig.axisLabelFontWeightX || 'normal';
  const setAxisLabelFontWeightX = useCallback((v: AxisFontWeight) => updateActiveSlot({ axisLabelFontWeightX: v }), [updateActiveSlot]);

  const axisLabelFontWeightY = currentSlotConfig.axisLabelFontWeightY || 'normal';
  const setAxisLabelFontWeightY = useCallback((v: AxisFontWeight) => updateActiveSlot({ axisLabelFontWeightY: v }), [updateActiveSlot]);

  const axisLabelColorX = currentSlotConfig.axisLabelColorX || '';
  const setAxisLabelColorX = useCallback((v: string) => updateActiveSlot({ axisLabelColorX: v }), [updateActiveSlot]);

  const axisLabelColorY = currentSlotConfig.axisLabelColorY || '';
  const setAxisLabelColorY = useCallback((v: string) => updateActiveSlot({ axisLabelColorY: v }), [updateActiveSlot]);

  const axisLabelRotateX = currentSlotConfig.axisLabelRotateX ?? 0;
  const setAxisLabelRotateX = useCallback((v: number) => updateActiveSlot({ axisLabelRotateX: v }), [updateActiveSlot]);

  const axisLabelRotateY = currentSlotConfig.axisLabelRotateY ?? 0;
  const setAxisLabelRotateY = useCallback((v: number) => updateActiveSlot({ axisLabelRotateY: v }), [updateActiveSlot]);

  const axisLabelMarginX = currentSlotConfig.axisLabelMarginX ?? 8;
  const setAxisLabelMarginX = useCallback((v: number) => updateActiveSlot({ axisLabelMarginX: v }), [updateActiveSlot]);

  const axisLabelMarginY = currentSlotConfig.axisLabelMarginY ?? 8;
  const setAxisLabelMarginY = useCallback((v: number) => updateActiveSlot({ axisLabelMarginY: v }), [updateActiveSlot]);

  const axisLabelOverflowX = currentSlotConfig.axisLabelOverflowX || 'none';
  const setAxisLabelOverflowX = useCallback((v: 'none' | 'truncate' | 'break') => updateActiveSlot({ axisLabelOverflowX: v }), [updateActiveSlot]);

  const axisLabelOverflowY = currentSlotConfig.axisLabelOverflowY || 'none';
  const setAxisLabelOverflowY = useCallback((v: 'none' | 'truncate' | 'break') => updateActiveSlot({ axisLabelOverflowY: v }), [updateActiveSlot]);

  const axisLabelWidthX = currentSlotConfig.axisLabelWidthX ?? 120;
  const setAxisLabelWidthX = useCallback((v: number) => updateActiveSlot({ axisLabelWidthX: v }), [updateActiveSlot]);

  const axisLabelWidthY = currentSlotConfig.axisLabelWidthY ?? 140;
  const setAxisLabelWidthY = useCallback((v: number) => updateActiveSlot({ axisLabelWidthY: v }), [updateActiveSlot]);

  const axisLabelLineHeightX = currentSlotConfig.axisLabelLineHeightX ?? 14;
  const setAxisLabelLineHeightX = useCallback((v: number) => updateActiveSlot({ axisLabelLineHeightX: v }), [updateActiveSlot]);

  const axisLabelLineHeightY = currentSlotConfig.axisLabelLineHeightY ?? 14;
  const setAxisLabelLineHeightY = useCallback((v: number) => updateActiveSlot({ axisLabelLineHeightY: v }), [updateActiveSlot]);

  const axisLabelFormatX = currentSlotConfig.axisLabelFormatX || 'auto';
  const setAxisLabelFormatX = useCallback((v: AxisLabelFormat) => updateActiveSlot({ axisLabelFormatX: v }), [updateActiveSlot]);

  const axisLabelFormatY = currentSlotConfig.axisLabelFormatY || 'auto';
  const setAxisLabelFormatY = useCallback((v: AxisLabelFormat) => updateActiveSlot({ axisLabelFormatY: v }), [updateActiveSlot]);

  const axisLabelPrefixX = currentSlotConfig.axisLabelPrefixX || '';
  const setAxisLabelPrefixX = useCallback((v: string) => updateActiveSlot({ axisLabelPrefixX: v }), [updateActiveSlot]);

  const axisLabelSuffixX = currentSlotConfig.axisLabelSuffixX || '';
  const setAxisLabelSuffixX = useCallback((v: string) => updateActiveSlot({ axisLabelSuffixX: v }), [updateActiveSlot]);

  const axisLabelPrefixY = currentSlotConfig.axisLabelPrefixY || '';
  const setAxisLabelPrefixY = useCallback((v: string) => updateActiveSlot({ axisLabelPrefixY: v }), [updateActiveSlot]);

  const axisLabelSuffixY = currentSlotConfig.axisLabelSuffixY || '';
  const setAxisLabelSuffixY = useCallback((v: string) => updateActiveSlot({ axisLabelSuffixY: v }), [updateActiveSlot]);

  const axisLabelIntervalX = currentSlotConfig.axisLabelIntervalX ?? 'auto';
  const setAxisLabelIntervalX = useCallback((v: 'auto' | number) => updateActiveSlot({ axisLabelIntervalX: v }), [updateActiveSlot]);

  const axisLabelIntervalY = currentSlotConfig.axisLabelIntervalY ?? 'auto';
  const setAxisLabelIntervalY = useCallback((v: 'auto' | number) => updateActiveSlot({ axisLabelIntervalY: v }), [updateActiveSlot]);

  // Scientific Gridlines
  const showGridLinesX = currentSlotConfig.showGridLinesX ?? false;
  const setShowGridLinesX = useCallback((v: boolean) => updateActiveSlot({ showGridLinesX: v }), [updateActiveSlot]);

  const showGridLinesY = currentSlotConfig.showGridLinesY ?? true;
  const setShowGridLinesY = useCallback((v: boolean) => updateActiveSlot({ showGridLinesY: v }), [updateActiveSlot]);

  const gridLineStyle = currentSlotConfig.gridLineStyle || 'dashed';
  const setGridLineStyle = useCallback((v: AxisGridLineStyle) => updateActiveSlot({ gridLineStyle: v }), [updateActiveSlot]);

  const gridLineColor = currentSlotConfig.gridLineColor || '';
  const setGridLineColor = useCallback((v: string) => updateActiveSlot({ gridLineColor: v }), [updateActiveSlot]);

  const gridLineOpacity = currentSlotConfig.gridLineOpacity ?? 100;
  const setGridLineOpacity = useCallback((v: number) => updateActiveSlot({ gridLineOpacity: v }), [updateActiveSlot]);

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
  const lineMode = currentSlotConfig.lineMode || 'cohort_trend';
  const setLineMode = useCallback((v: 'cohort_trend' | 'epistemic_simulation') => updateActiveSlot({ lineMode: v }), [updateActiveSlot]);

  const lineTimeSteps = currentSlotConfig.lineTimeSteps ?? 96;
  const setLineTimeSteps = useCallback((v: number) => updateActiveSlot({ lineTimeSteps: v }), [updateActiveSlot]);

  const lineTimeStepIntervalName = currentSlotConfig.lineTimeStepIntervalName || 'Time Steps k (15-min intervals / 24-h Cycle)';
  const setLineTimeStepIntervalName = useCallback((v: string) => updateActiveSlot({ lineTimeStepIntervalName: v }), [updateActiveSlot]);

  const lineYAxisTitle = currentSlotConfig.lineYAxisTitle || 'State Uncertainty Tr(P)';
  const setLineYAxisTitle = useCallback((v: string) => updateActiveSlot({ lineYAxisTitle: v }), [updateActiveSlot]);

  const lineYMin = currentSlotConfig.lineYMin ?? 0;
  const setLineYMin = useCallback((v: number) => updateActiveSlot({ lineYMin: v }), [updateActiveSlot]);

  const lineYMax = currentSlotConfig.lineYMax ?? 4.5;
  const setLineYMax = useCallback((v: number) => updateActiveSlot({ lineYMax: v }), [updateActiveSlot]);

  const lineBaselineA = currentSlotConfig.lineBaselineA ?? 0.15;
  const setLineBaselineA = useCallback((v: number) => updateActiveSlot({ lineBaselineA: v }), [updateActiveSlot]);

  const lineBaselineB = currentSlotConfig.lineBaselineB ?? 0.038;
  const setLineBaselineB = useCallback((v: number) => updateActiveSlot({ lineBaselineB: v }), [updateActiveSlot]);

  const lineBaselineName = currentSlotConfig.lineBaselineName || 'Static Architecture (24% CNN / 15% Filter Cohort)';
  const setLineBaselineName = useCallback((v: string) => updateActiveSlot({ lineBaselineName: v }), [updateActiveSlot]);

  const lineBaselineColor = currentSlotConfig.lineBaselineColor || '';
  const setLineBaselineColor = useCallback((v: string) => updateActiveSlot({ lineBaselineColor: v }), [updateActiveSlot]);

  const lineBaselineStyle = currentSlotConfig.lineBaselineStyle || 'dashed';
  const setLineBaselineStyle = useCallback((v: 'solid' | 'dashed' | 'dotted') => updateActiveSlot({ lineBaselineStyle: v }), [updateActiveSlot]);

  const lineEstimatorInitial = currentSlotConfig.lineEstimatorInitial ?? 0.15;
  const setLineEstimatorInitial = useCallback((v: number) => updateActiveSlot({ lineEstimatorInitial: v }), [updateActiveSlot]);

  const lineEstimatorDrift = currentSlotConfig.lineEstimatorDrift ?? 0.11;
  const setLineEstimatorDrift = useCallback((v: number) => updateActiveSlot({ lineEstimatorDrift: v }), [updateActiveSlot]);

  const lineEstimatorModulation = currentSlotConfig.lineEstimatorModulation ?? 0.05;
  const setLineEstimatorModulation = useCallback((v: number) => updateActiveSlot({ lineEstimatorModulation: v }), [updateActiveSlot]);

  const lineEstimatorName = currentSlotConfig.lineEstimatorName || 'Discrete Recursive Estimator (Proposed Gated Pipeline)';
  const setLineEstimatorName = useCallback((v: string) => updateActiveSlot({ lineEstimatorName: v }), [updateActiveSlot]);

  const lineEstimatorColor = currentSlotConfig.lineEstimatorColor || '';
  const setLineEstimatorColor = useCallback((v: string) => updateActiveSlot({ lineEstimatorColor: v }), [updateActiveSlot]);

  const lineEstimatorStyle = currentSlotConfig.lineEstimatorStyle || 'solid';
  const setLineEstimatorStyle = useCallback((v: 'solid' | 'dashed' | 'dotted') => updateActiveSlot({ lineEstimatorStyle: v }), [updateActiveSlot]);

  const lineThresholdValue = currentSlotConfig.lineThresholdValue ?? 1.0;
  const setLineThresholdValue = useCallback((v: number) => updateActiveSlot({ lineThresholdValue: v }), [updateActiveSlot]);

  const lineThresholdName = currentSlotConfig.lineThresholdName || 'Semantic Trigger Threshold (ε)';
  const setLineThresholdName = useCallback((v: string) => updateActiveSlot({ lineThresholdName: v }), [updateActiveSlot]);

  const lineThresholdLabel = currentSlotConfig.lineThresholdLabel || 'Threshold ε = 1.00';
  const setLineThresholdLabel = useCallback((v: string) => updateActiveSlot({ lineThresholdLabel: v }), [updateActiveSlot]);

  const lineThresholdColor = currentSlotConfig.lineThresholdColor || '';
  const setLineThresholdColor = useCallback((v: string) => updateActiveSlot({ lineThresholdColor: v }), [updateActiveSlot]);

  const lineThresholdStyle = currentSlotConfig.lineThresholdStyle || 'dotted';
  const setLineThresholdStyle = useCallback((v: 'dotted' | 'dashed' | 'solid') => updateActiveSlot({ lineThresholdStyle: v }), [updateActiveSlot]);

  const lineThresholdPosition = currentSlotConfig.lineThresholdPosition || 'insideEndTop';
  const setLineThresholdPosition = useCallback((v: 'insideEndTop' | 'insideStartTop' | 'insideMiddleTop' | 'end' | 'start') => updateActiveSlot({ lineThresholdPosition: v }), [updateActiveSlot]);

  const lineThresholdLineWidth = currentSlotConfig.lineThresholdLineWidth ?? 1.5;
  const setLineThresholdLineWidth = useCallback((v: number) => updateActiveSlot({ lineThresholdLineWidth: v }), [updateActiveSlot]);

  const lineAxisPointerType = currentSlotConfig.lineAxisPointerType || 'cross';
  const setLineAxisPointerType = useCallback((v: 'cross' | 'line' | 'shadow') => updateActiveSlot({ lineAxisPointerType: v }), [updateActiveSlot]);

  const lineMarkerSymbol = currentSlotConfig.lineMarkerSymbol || 'circle';
  const setLineMarkerSymbol = useCallback((v: 'circle' | 'rect' | 'triangle' | 'diamond' | 'none' | 'emptyCircle') => updateActiveSlot({ lineMarkerSymbol: v }), [updateActiveSlot]);

  const lineXAxisInterval = currentSlotConfig.lineXAxisInterval ?? 'auto';
  const setLineXAxisInterval = useCallback((v: number | 'auto') => updateActiveSlot({ lineXAxisInterval: v }), [updateActiveSlot]);

  const lineShowGridLines = currentSlotConfig.lineShowGridLines ?? true;
  const setLineShowGridLines = useCallback((v: boolean) => updateActiveSlot({ lineShowGridLines: v }), [updateActiveSlot]);

  const lineGridLeft = currentSlotConfig.lineGridLeft ?? 60;
  const setLineGridLeft = useCallback((v: number) => updateActiveSlot({ lineGridLeft: v }), [updateActiveSlot]);

  const lineGridRight = currentSlotConfig.lineGridRight ?? 40;
  const setLineGridRight = useCallback((v: number) => updateActiveSlot({ lineGridRight: v }), [updateActiveSlot]);

  const lineGridTop = currentSlotConfig.lineGridTop ?? 65;
  const setLineGridTop = useCallback((v: number) => updateActiveSlot({ lineGridTop: v }), [updateActiveSlot]);

  const lineGridBottom = currentSlotConfig.lineGridBottom ?? 65;
  const setLineGridBottom = useCallback((v: number) => updateActiveSlot({ lineGridBottom: v }), [updateActiveSlot]);

  const lineWidth = currentSlotConfig.lineWidth ?? 2.5;
  const setLineWidth = useCallback((v: number) => updateActiveSlot({ lineWidth: v }), [updateActiveSlot]);

  const showLineMarkers = currentSlotConfig.showLineMarkers ?? true;
  const setShowLineMarkers = useCallback((v: boolean) => updateActiveSlot({ showLineMarkers: v }), [updateActiveSlot]);

  const lineMarkerSize = currentSlotConfig.lineMarkerSize ?? 8;
  const setLineMarkerSize = useCallback((v: number) => updateActiveSlot({ lineMarkerSize: v }), [updateActiveSlot]);

  const lineAreaOpacity = currentSlotConfig.lineAreaOpacity ?? 0;
  const setLineAreaOpacity = useCallback((v: number) => updateActiveSlot({ lineAreaOpacity: v }), [updateActiveSlot]);

  const lineBaselineAreaOpacity = currentSlotConfig.lineBaselineAreaOpacity ?? 0;
  const setLineBaselineAreaOpacity = useCallback((v: number) => updateActiveSlot({ lineBaselineAreaOpacity: v }), [updateActiveSlot]);

  const lineEstimatorAreaOpacity = currentSlotConfig.lineEstimatorAreaOpacity ?? 8;
  const setLineEstimatorAreaOpacity = useCallback((v: number) => updateActiveSlot({ lineEstimatorAreaOpacity: v }), [updateActiveSlot]);

  const lineBaselineFillMode = currentSlotConfig.lineBaselineFillMode || 'none';
  const setLineBaselineFillMode = useCallback((v: 'none' | 'subtle_gradient' | 'solid') => updateActiveSlot({ lineBaselineFillMode: v }), [updateActiveSlot]);

  const lineEstimatorFillMode = currentSlotConfig.lineEstimatorFillMode || 'subtle_gradient';
  const setLineEstimatorFillMode = useCallback((v: 'none' | 'subtle_gradient' | 'solid') => updateActiveSlot({ lineEstimatorFillMode: v }), [updateActiveSlot]);

  const lineShowTxEvents = currentSlotConfig.lineShowTxEvents ?? true;
  const setLineShowTxEvents = useCallback((v: boolean) => updateActiveSlot({ lineShowTxEvents: v }), [updateActiveSlot]);

  const lineTxEventSymbol = currentSlotConfig.lineTxEventSymbol || 'triangle';
  const setLineTxEventSymbol = useCallback((v: 'triangle' | 'pin' | 'diamond' | 'circle' | 'arrow') => updateActiveSlot({ lineTxEventSymbol: v }), [updateActiveSlot]);

  const lineTxEventColor = currentSlotConfig.lineTxEventColor || '';
  const setLineTxEventColor = useCallback((v: string) => updateActiveSlot({ lineTxEventColor: v }), [updateActiveSlot]);

  const lineTxEventSize = currentSlotConfig.lineTxEventSize ?? 12;
  const setLineTxEventSize = useCallback((v: number) => updateActiveSlot({ lineTxEventSize: v }), [updateActiveSlot]);

  const lineShowTxLabels = currentSlotConfig.lineShowTxLabels ?? true;
  const setLineShowTxLabels = useCallback((v: boolean) => updateActiveSlot({ lineShowTxLabels: v }), [updateActiveSlot]);

  const lineTxEventLabel = currentSlotConfig.lineTxEventLabel || 'TX';
  const setLineTxEventLabel = useCallback((v: string) => updateActiveSlot({ lineTxEventLabel: v }), [updateActiveSlot]);

  const lineTxEventSeriesName = currentSlotConfig.lineTxEventSeriesName || 'Physical Radio TX Events';
  const setLineTxEventSeriesName = useCallback((v: string) => updateActiveSlot({ lineTxEventSeriesName: v }), [updateActiveSlot]);

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

  const bubbleMode = currentSlotConfig.bubbleMode || 'categorical_matrix';
  const setBubbleMode = useCallback((v: 'categorical_matrix' | 'numerical_3d') => updateActiveSlot({ bubbleMode: v }), [updateActiveSlot]);

  const bubbleMinRadius = currentSlotConfig.bubbleMinRadius ?? 12;
  const setBubbleMinRadius = useCallback((v: number) => updateActiveSlot({ bubbleMinRadius: v }), [updateActiveSlot]);

  const bubbleMaxRadius = currentSlotConfig.bubbleMaxRadius ?? 65;
  const setBubbleMaxRadius = useCallback((v: number) => updateActiveSlot({ bubbleMaxRadius: v }), [updateActiveSlot]);

  const bubbleOpacity = currentSlotConfig.bubbleOpacity ?? 85;
  const setBubbleOpacity = useCallback((v: number) => updateActiveSlot({ bubbleOpacity: v }), [updateActiveSlot]);

  const bubbleBorderWidth = currentSlotConfig.bubbleBorderWidth ?? 1.5;
  const setBubbleBorderWidth = useCallback((v: number) => updateActiveSlot({ bubbleBorderWidth: v }), [updateActiveSlot]);

  const bubbleBorderColor = currentSlotConfig.bubbleBorderColor || '#333333';
  const setBubbleBorderColor = useCallback((v: string) => updateActiveSlot({ bubbleBorderColor: v }), [updateActiveSlot]);

  const bubbleShowLabels = currentSlotConfig.bubbleShowLabels ?? true;
  const setBubbleShowLabels = useCallback((v: boolean) => updateActiveSlot({ bubbleShowLabels: v }), [updateActiveSlot]);

  const bubbleLabelFormat = currentSlotConfig.bubbleLabelFormat || 'count_n';
  const setBubbleLabelFormat = useCallback((v: 'count_n' | 'count_only' | 'percent' | 'label') => updateActiveSlot({ bubbleLabelFormat: v }), [updateActiveSlot]);

  const bubbleLabelFontSize = currentSlotConfig.bubbleLabelFontSize ?? 11;
  const setBubbleLabelFontSize = useCallback((v: number) => updateActiveSlot({ bubbleLabelFontSize: v }), [updateActiveSlot]);

  const bubbleLabelColor = currentSlotConfig.bubbleLabelColor || '#ffffff';
  const setBubbleLabelColor = useCallback((v: string) => updateActiveSlot({ bubbleLabelColor: v }), [updateActiveSlot]);

  const bubbleColorMode = currentSlotConfig.bubbleColorMode || 'color_by_x';
  const setBubbleColorMode = useCallback((v: 'color_by_x' | 'color_by_y' | 'color_by_metric' | 'custom_compliance') => updateActiveSlot({ bubbleColorMode: v }), [updateActiveSlot]);

  const bubbleShowGridLines = currentSlotConfig.bubbleShowGridLines ?? true;
  const setBubbleShowGridLines = useCallback((v: boolean) => updateActiveSlot({ bubbleShowGridLines: v }), [updateActiveSlot]);

  const bubbleComplianceRules = currentSlotConfig.bubbleComplianceRules || {};
  const setBubbleComplianceRules = useCallback((v: Record<string, { label?: string; compliance?: string; color?: string }>) => updateActiveSlot({ bubbleComplianceRules: v }), [updateActiveSlot]);

  const bubbleXAxisName = currentSlotConfig.bubbleXAxisName || '';
  const setBubbleXAxisName = useCallback((v: string) => updateActiveSlot({ bubbleXAxisName: v }), [updateActiveSlot]);

  const bubbleYAxisName = currentSlotConfig.bubbleYAxisName || '';
  const setBubbleYAxisName = useCallback((v: string) => updateActiveSlot({ bubbleYAxisName: v }), [updateActiveSlot]);

  const bubbleXAxisNameGap = currentSlotConfig.bubbleXAxisNameGap ?? 55;
  const setBubbleXAxisNameGap = useCallback((v: number) => updateActiveSlot({ bubbleXAxisNameGap: v }), [updateActiveSlot]);

  const bubbleYAxisNameGap = currentSlotConfig.bubbleYAxisNameGap ?? 95;
  const setBubbleYAxisNameGap = useCallback((v: number) => updateActiveSlot({ bubbleYAxisNameGap: v }), [updateActiveSlot]);

  const bubbleXAxisNameLocation = currentSlotConfig.bubbleXAxisNameLocation || 'middle';
  const setBubbleXAxisNameLocation = useCallback((v: 'middle' | 'start' | 'end') => updateActiveSlot({ bubbleXAxisNameLocation: v }), [updateActiveSlot]);

  const bubbleYAxisNameLocation = currentSlotConfig.bubbleYAxisNameLocation || 'middle';
  const setBubbleYAxisNameLocation = useCallback((v: 'middle' | 'start' | 'end') => updateActiveSlot({ bubbleYAxisNameLocation: v }), [updateActiveSlot]);

  const bubbleAxisTitleFontSize = currentSlotConfig.bubbleAxisTitleFontSize ?? 12;
  const setBubbleAxisTitleFontSize = useCallback((v: number) => updateActiveSlot({ bubbleAxisTitleFontSize: v }), [updateActiveSlot]);

  const bubbleAxisTitleFontWeight = currentSlotConfig.bubbleAxisTitleFontWeight || 'bold';
  const setBubbleAxisTitleFontWeight = useCallback((v: 'bold' | 'normal' | 'bolder') => updateActiveSlot({ bubbleAxisTitleFontWeight: v }), [updateActiveSlot]);

  const bubbleAxisTitleColor = currentSlotConfig.bubbleAxisTitleColor || '';
  const setBubbleAxisTitleColor = useCallback((v: string) => updateActiveSlot({ bubbleAxisTitleColor: v }), [updateActiveSlot]);

  const bubbleGridLeft = currentSlotConfig.bubbleGridLeft ?? 120;
  const setBubbleGridLeft = useCallback((v: number) => updateActiveSlot({ bubbleGridLeft: v }), [updateActiveSlot]);

  const bubbleGridBottom = currentSlotConfig.bubbleGridBottom ?? 90;
  const setBubbleGridBottom = useCallback((v: number) => updateActiveSlot({ bubbleGridBottom: v }), [updateActiveSlot]);

  const bubbleGridTop = currentSlotConfig.bubbleGridTop ?? 65;
  const setBubbleGridTop = useCallback((v: number) => updateActiveSlot({ bubbleGridTop: v }), [updateActiveSlot]);

  const bubbleGridRight = currentSlotConfig.bubbleGridRight ?? 50;
  const setBubbleGridRight = useCallback((v: number) => updateActiveSlot({ bubbleGridRight: v }), [updateActiveSlot]);

  const bubbleSeriesName = currentSlotConfig.bubbleSeriesName || 'Deployments';
  const setBubbleSeriesName = useCallback((v: string) => updateActiveSlot({ bubbleSeriesName: v }), [updateActiveSlot]);

  const bubbleLegendMode = currentSlotConfig.bubbleLegendMode || 'category_series';
  const setBubbleLegendMode = useCallback((v: 'category_series' | 'single_series' | 'none') => updateActiveSlot({ bubbleLegendMode: v }), [updateActiveSlot]);

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
    legendType,
    setLegendType,
    legendAlign,
    setLegendAlign,
    legendIcon,
    setLegendIcon,
    legendItemWidth,
    setLegendItemWidth,
    legendItemHeight,
    setLegendItemHeight,
    legendFontWeight,
    setLegendFontWeight,
    legendTextColor,
    setLegendTextColor,
    legendBackgroundColor,
    setLegendBackgroundColor,
    legendBorderColor,
    setLegendBorderColor,
    legendBorderWidth,
    setLegendBorderWidth,
    legendBorderRadius,
    setLegendBorderRadius,
    legendPadding,
    setLegendPadding,
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
    // Axis Titles Customization
    showAxisTitleX,
    setShowAxisTitleX,
    showAxisTitleY,
    setShowAxisTitleY,
    axisTitleFontSizeX,
    setAxisTitleFontSizeX,
    axisTitleFontSizeY,
    setAxisTitleFontSizeY,
    axisTitleFontWeightX,
    setAxisTitleFontWeightX,
    axisTitleFontWeightY,
    setAxisTitleFontWeightY,
    axisTitleFontStyleX,
    setAxisTitleFontStyleX,
    axisTitleFontStyleY,
    setAxisTitleFontStyleY,
    axisTitleColorX,
    setAxisTitleColorX,
    axisTitleColorY,
    setAxisTitleColorY,
    axisTitleLocationX,
    setAxisTitleLocationX,
    axisTitleLocationY,
    setAxisTitleLocationY,
    axisTitleGapX,
    setAxisTitleGapX,
    axisTitleGapY,
    setAxisTitleGapY,
    // Axis Tick Labels Customization
    showAxisLabelX,
    setShowAxisLabelX,
    showAxisLabelY,
    setShowAxisLabelY,
    axisLabelFontSizeX,
    setAxisLabelFontSizeX,
    axisLabelFontSizeY,
    setAxisLabelFontSizeY,
    axisLabelFontWeightX,
    setAxisLabelFontWeightX,
    axisLabelFontWeightY,
    setAxisLabelFontWeightY,
    axisLabelColorX,
    setAxisLabelColorX,
    axisLabelColorY,
    setAxisLabelColorY,
    axisLabelRotateX,
    setAxisLabelRotateX,
    axisLabelRotateY,
    setAxisLabelRotateY,
    axisLabelMarginX,
    setAxisLabelMarginX,
    axisLabelMarginY,
    setAxisLabelMarginY,
    axisLabelOverflowX,
    setAxisLabelOverflowX,
    axisLabelOverflowY,
    setAxisLabelOverflowY,
    axisLabelWidthX,
    setAxisLabelWidthX,
    axisLabelWidthY,
    setAxisLabelWidthY,
    axisLabelLineHeightX,
    setAxisLabelLineHeightX,
    axisLabelLineHeightY,
    setAxisLabelLineHeightY,
    axisLabelFormatX,
    setAxisLabelFormatX,
    axisLabelFormatY,
    setAxisLabelFormatY,
    axisLabelPrefixX,
    setAxisLabelPrefixX,
    axisLabelSuffixX,
    setAxisLabelSuffixX,
    axisLabelPrefixY,
    setAxisLabelPrefixY,
    axisLabelSuffixY,
    setAxisLabelSuffixY,
    axisLabelIntervalX,
    setAxisLabelIntervalX,
    axisLabelIntervalY,
    setAxisLabelIntervalY,
    // Scientific Gridlines
    showGridLinesX,
    setShowGridLinesX,
    showGridLinesY,
    setShowGridLinesY,
    gridLineStyle,
    setGridLineStyle,
    gridLineColor,
    setGridLineColor,
    gridLineOpacity,
    setGridLineOpacity,
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
    lineMode,
    setLineMode,
    lineTimeSteps,
    setLineTimeSteps,
    lineTimeStepIntervalName,
    setLineTimeStepIntervalName,
    lineYAxisTitle,
    setLineYAxisTitle,
    lineYMin,
    setLineYMin,
    lineYMax,
    setLineYMax,
    lineBaselineA,
    setLineBaselineA,
    lineBaselineB,
    setLineBaselineB,
    lineBaselineName,
    setLineBaselineName,
    lineBaselineColor,
    setLineBaselineColor,
    lineBaselineStyle,
    setLineBaselineStyle,
    lineEstimatorInitial,
    setLineEstimatorInitial,
    lineEstimatorDrift,
    setLineEstimatorDrift,
    lineEstimatorModulation,
    setLineEstimatorModulation,
    lineEstimatorName,
    setLineEstimatorName,
    lineEstimatorColor,
    setLineEstimatorColor,
    lineEstimatorStyle,
    setLineEstimatorStyle,
    lineThresholdValue,
    setLineThresholdValue,
    lineThresholdName,
    setLineThresholdName,
    lineThresholdLabel,
    setLineThresholdLabel,
    lineThresholdColor,
    setLineThresholdColor,
    lineThresholdStyle,
    setLineThresholdStyle,
    lineThresholdPosition,
    setLineThresholdPosition,
    lineThresholdLineWidth,
    setLineThresholdLineWidth,
    lineAxisPointerType,
    setLineAxisPointerType,
    lineMarkerSymbol,
    setLineMarkerSymbol,
    lineXAxisInterval,
    setLineXAxisInterval,
    lineShowGridLines,
    setLineShowGridLines,
    lineGridLeft,
    setLineGridLeft,
    lineGridRight,
    setLineGridRight,
    lineGridTop,
    setLineGridTop,
    lineGridBottom,
    setLineGridBottom,
    lineWidth,
    setLineWidth,
    showLineMarkers,
    setShowLineMarkers,
    lineMarkerSize,
    setLineMarkerSize,
    lineAreaOpacity,
    setLineAreaOpacity,
    lineBaselineAreaOpacity,
    setLineBaselineAreaOpacity,
    lineEstimatorAreaOpacity,
    setLineEstimatorAreaOpacity,
    lineBaselineFillMode,
    setLineBaselineFillMode,
    lineEstimatorFillMode,
    setLineEstimatorFillMode,
    lineShowTxEvents,
    setLineShowTxEvents,
    lineTxEventSymbol,
    setLineTxEventSymbol,
    lineTxEventColor,
    setLineTxEventColor,
    lineTxEventSize,
    setLineTxEventSize,
    lineShowTxLabels,
    setLineShowTxLabels,
    lineTxEventLabel,
    setLineTxEventLabel,
    lineTxEventSeriesName,
    setLineTxEventSeriesName,
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
    bubbleMode,
    setBubbleMode,
    bubbleMinRadius,
    setBubbleMinRadius,
    bubbleMaxRadius,
    setBubbleMaxRadius,
    bubbleOpacity,
    setBubbleOpacity,
    bubbleBorderWidth,
    setBubbleBorderWidth,
    bubbleBorderColor,
    setBubbleBorderColor,
    bubbleShowLabels,
    setBubbleShowLabels,
    bubbleLabelFormat,
    setBubbleLabelFormat,
    bubbleLabelFontSize,
    setBubbleLabelFontSize,
    bubbleLabelColor,
    setBubbleLabelColor,
    bubbleColorMode,
    setBubbleColorMode,
    bubbleShowGridLines,
    setBubbleShowGridLines,
    bubbleComplianceRules,
    setBubbleComplianceRules,
    bubbleXAxisName,
    setBubbleXAxisName,
    bubbleYAxisName,
    setBubbleYAxisName,
    bubbleXAxisNameGap,
    setBubbleXAxisNameGap,
    bubbleYAxisNameGap,
    setBubbleYAxisNameGap,
    bubbleXAxisNameLocation,
    setBubbleXAxisNameLocation,
    bubbleYAxisNameLocation,
    setBubbleYAxisNameLocation,
    bubbleAxisTitleFontSize,
    setBubbleAxisTitleFontSize,
    bubbleAxisTitleFontWeight,
    setBubbleAxisTitleFontWeight,
    bubbleAxisTitleColor,
    setBubbleAxisTitleColor,
    bubbleGridLeft,
    setBubbleGridLeft,
    bubbleGridBottom,
    setBubbleGridBottom,
    bubbleGridTop,
    setBubbleGridTop,
    bubbleGridRight,
    setBubbleGridRight,
    bubbleSeriesName,
    setBubbleSeriesName,
    bubbleLegendMode,
    setBubbleLegendMode,
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
