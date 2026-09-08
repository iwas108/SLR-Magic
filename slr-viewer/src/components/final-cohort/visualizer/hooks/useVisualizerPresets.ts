import { useCallback } from 'react';
import { INITIAL_SLOTS_CONFIG, createDefaultSlotConfig } from '../constants/defaultConfigs';
import type { 
  LayoutMode,
  SlotId,
  SlotConfig,
  GlobalStyleConfig,
  VisualizerPresetPayload
} from '../types';

export function useVisualizerPresets(params: {
  layout: {
    layoutMode: LayoutMode;
    setLayoutMode: (mode: LayoutMode) => void;
    activeSlot: SlotId;
  };
  config: {
    slotsConfig: Record<SlotId, SlotConfig>;
    setAllSlotsConfig: (configs: Record<SlotId, SlotConfig>) => void;
  };
  style: {
    getGlobalStyleConfig: (layoutMode: LayoutMode) => GlobalStyleConfig;
    setGlobalStyleConfig: (cfg: Partial<GlobalStyleConfig>) => void;
  };
  camera: {
    chartScale: number;
    setChartScale: (v: number) => void;
    panX: number;
    setPanX: (v: number) => void;
    panY: number;
    setPanY: (v: number) => void;
    tiltAngle: number;
    setTiltAngle: (v: number) => void;
    rotationAngle: number;
    setRotationAngle: (v: number) => void;
    fitOffsetX?: number;
    setFitOffsetX?: (v: number) => void;
    fitOffsetY?: number;
    setFitOffsetY?: (v: number) => void;
    containerPadding?: number;
    setContainerPadding?: (v: number) => void;
  };
}) {
  const { layout, config, style, camera } = params;

  // Export Unified Multi-Block v3.0 JSON preset
  const handleExportPreset = useCallback(() => {
    const globalStyle = style.getGlobalStyleConfig(layout.layoutMode);
    const presetObj: VisualizerPresetPayload = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      layoutMode: layout.layoutMode,
      globalStyle,
      slots: config.slotsConfig,
      chartScale: camera.chartScale,
      panX: camera.panX,
      panY: camera.panY,
      tiltAngle: camera.tiltAngle,
      rotationAngle: camera.rotationAngle,
      fitOffsetX: camera.fitOffsetX,
      fitOffsetY: camera.fitOffsetY,
      containerPadding: camera.containerPadding
    };

    const jsonStr = JSON.stringify(presetObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slr-visualizer-preset-${layout.layoutMode}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [layout, config, style, camera]);

  // Import JSON preset with automatic legacy v1/v2 schema migration
  const handleImportPreset = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed: VisualizerPresetPayload = JSON.parse(evt.target?.result as string);

        if (parsed.version === '3.0' && parsed.slots) {
          // Hydrate v3.0 Multi-Block preset
          if (parsed.layoutMode) {
            layout.setLayoutMode(parsed.layoutMode);
          }
          if (parsed.globalStyle) {
            style.setGlobalStyleConfig(parsed.globalStyle);
          }
          const mergedSlots: Record<SlotId, SlotConfig> = {
            slot_a: { ...createDefaultSlotConfig('slot_a'), ...(parsed.slots.slot_a || {}) },
            slot_b: { ...createDefaultSlotConfig('slot_b'), ...(parsed.slots.slot_b || {}) },
            slot_c: { ...createDefaultSlotConfig('slot_c'), ...(parsed.slots.slot_c || {}) },
            slot_d: { ...createDefaultSlotConfig('slot_d'), ...(parsed.slots.slot_d || {}) }
          };
          config.setAllSlotsConfig(mergedSlots);
        } else {
          // Legacy v1/v2 single-chart preset migration into Slot A
          layout.setLayoutMode('single');
          
          if (parsed.themePreset || parsed.fontFamily || parsed.fontSize || parsed.chartTitle) {
            style.setGlobalStyleConfig({
              themePreset: parsed.themePreset,
              fontFamily: parsed.fontFamily,
              fontSize: parsed.fontSize,
              chartTitle: parsed.chartTitle,
              chartSubtitle: parsed.chartSubtitle,
              showChartTitle: parsed.showChartTitle,
              showChartSubtitle: parsed.showChartSubtitle
            });
          }

          const legacySlotA: SlotConfig = {
            ...createDefaultSlotConfig('slot_a'),
            chartType: parsed.chartType || 'bar_vertical',
            subTitle: parsed.chartSubtitle || 'Single Analysis',
            primaryField: parsed.primaryField || 'Year',
            secondaryField: parsed.secondaryField || 'Import_Source',
            metricMode: parsed.metricMode || 'count',
            sankeyFields: parsed.sankeyFields || ['Year', 'Import_Source', 'Local_PDF_Status'],
            sankeyLabelPositions: parsed.sankeyLabelPositions || {},
            sankeyMaxNodes: parsed.sankeyMaxNodes || {},
            tailLabelStyle: parsed.tailLabelStyle || 'comma_list',
            limitCategories: parsed.limitCategories ?? false,
            maxCategoriesCount: parsed.maxCategoriesCount ?? 10,
            numFieldX: parsed.numFieldX || 'Overall_QA',
            numFieldY: parsed.numFieldY || 'citation_count',
            numFieldSize: parsed.numFieldSize || 'Year',
            useUmbrellanizer: parsed.useUmbrellanizer ?? true,
            splitMultiValues: parsed.splitMultiValues ?? true,
            excludeEmpty: parsed.excludeEmpty ?? true,
            showLegend: parsed.showLegend ?? true,
            legendPosition: parsed.legendPosition || 'top',
            showDataLabels: parsed.showDataLabels ?? true,
            labelRotation: parsed.labelRotation ?? 0,
            donutRatio: parsed.donutRatio ?? 50,
            smoothLine: parsed.smoothLine ?? true,
            sankeyNodeWidth: parsed.sankeyNodeWidth ?? 20,
            sankeyNodeGap: parsed.sankeyNodeGap ?? 18,
            sankeyLeftPadding: parsed.sankeyLeftPadding ?? 8,
            sankeyRightPadding: parsed.sankeyRightPadding ?? 20,
            sankeyTopPadding: parsed.sankeyTopPadding ?? 12,
            sankeyBottomPadding: parsed.sankeyBottomPadding ?? 8,
            sankeyOrient: parsed.sankeyOrient || 'horizontal',
            sankeyNodeAlign: parsed.sankeyNodeAlign || 'justify',
            sankeyCurveness: parsed.sankeyCurveness ?? 0.5,
            sankeyLinkColorMode: parsed.sankeyLinkColorMode || 'gradient',
            sankeyLinkOpacity: parsed.sankeyLinkOpacity ?? 45,
            sankeyNodeBorderRadius: parsed.sankeyNodeBorderRadius ?? 2,
            sankeyNodeBorderWidth: parsed.sankeyNodeBorderWidth ?? 1,
            sankeyLayoutIterations: parsed.sankeyLayoutIterations ?? (parsed.sankeyPinUnstatedToBottom !== false ? 0 : 32),
            sankeyDraggable: parsed.sankeyDraggable ?? true,
            sankeyLabelPosition: parsed.sankeyLabelPosition || 'auto',
            sankeyLabelDistance: parsed.sankeyLabelDistance ?? 6,
            sankeyLabelOverflow: parsed.sankeyLabelOverflow || 'break',
            sankeyMaxLabelWidth: parsed.sankeyMaxLabelWidth ?? 120,
            sankeyLabelFontSize: parsed.sankeyLabelFontSize,
            sankeyLabelRotate: parsed.sankeyLabelRotate ?? 0,
            sankeyEmphasisFocus: parsed.sankeyEmphasisFocus || 'adjacency',
            sankeyLevelLabelFormats: parsed.sankeyLevelLabelFormats || {},
            sankeyLevelNodeGaps: parsed.sankeyLevelNodeGaps || {},
            sankeyLevelLabelDistances: parsed.sankeyLevelLabelDistances || {},
            sankeyLevelNodeWidths: parsed.sankeyLevelNodeWidths || {},
            sankeyLevelPathFilters: parsed.sankeyLevelPathFilters || {},
            sankeySort: parsed.sankeySort || 'desc',
            sankeyPinUnstatedToBottom: parsed.sankeyPinUnstatedToBottom ?? true,
            sankeyFlowConservation: parsed.sankeyFlowConservation ?? true,
            sankeyLevelNodeOrders: parsed.sankeyLevelNodeOrders || {},
            levelSegmentIndices: parsed.levelSegmentIndices || {},
            levelScopeFilters: parsed.levelScopeFilters || {},
            sankeyLabelLineHeight: parsed.sankeyLabelLineHeight ?? 14,
            sankeyLabelFontWeight: parsed.sankeyLabelFontWeight || '600',
            sankeyLabelColor: parsed.sankeyLabelColor || '',
            bubbleScale: parsed.bubbleScale ?? 1.2,
            gaugeMaxScale: parsed.gaugeMaxScale ?? 100,
            sunburstLevelConfigs: parsed.sunburstLevelConfigs || { ...INITIAL_SLOTS_CONFIG.slot_a.sunburstLevelConfigs },
            sunburstSort: parsed.sunburstSort || 'desc',
            sunburstNodeClick: parsed.sunburstNodeClick || 'rootToNode',
            sunburstEmphasisFocus: parsed.sunburstEmphasisFocus || 'ancestor',
            sunburstColorMode: parsed.sunburstColorMode || 'branch_gradient',
            treemapAlgorithm: parsed.treemapAlgorithm || 'squarified',
            treemapSquareRatio: parsed.treemapSquareRatio ?? (0.5 * (1 + Math.sqrt(5))),
            treemapVisibleDepth: parsed.treemapVisibleDepth ?? 2,
            treemapGapWidth: parsed.treemapGapWidth ?? 2,
            treemapBorderWidth: parsed.treemapBorderWidth ?? 2,
            treemapBorderRadius: parsed.treemapBorderRadius ?? 0,
            treemapBorderColorMode: parsed.treemapBorderColorMode || 'auto_bg',
            treemapBorderColor: parsed.treemapBorderColor || '',
            treemapNodeClick: parsed.treemapNodeClick || 'zoomToNode',
            treemapRoam: parsed.treemapRoam ?? false,
            treemapDrillDownIcon: parsed.treemapDrillDownIcon || '▶',
            treemapShowBreadcrumb: parsed.treemapShowBreadcrumb ?? false,
            treemapBreadcrumbPosition: parsed.treemapBreadcrumbPosition || 'bottom',
            treemapBreadcrumbHeight: parsed.treemapBreadcrumbHeight ?? 22,
            treemapColorMode: parsed.treemapColorMode || 'branch_gradient',
            treemapCohortMode: parsed.treemapCohortMode || 'grouped',
            treemapColorMappingBy: parsed.treemapColorMappingBy || 'index',
            treemapColorAlphaMin: parsed.treemapColorAlphaMin ?? 0.7,
            treemapColorAlphaMax: parsed.treemapColorAlphaMax ?? 1.0,
            treemapColorSaturationMin: parsed.treemapColorSaturationMin ?? 0.6,
            treemapColorSaturationMax: parsed.treemapColorSaturationMax ?? 1.0,
            treemapShowLabels: parsed.treemapShowLabels ?? true,
            treemapLabelPosition: parsed.treemapLabelPosition || 'inside',
            treemapLabelFormat: parsed.treemapLabelFormat || 'name_count',
            treemapLabelFontSize: parsed.treemapLabelFontSize ?? 11,
            treemapLabelFontWeight: parsed.treemapLabelFontWeight || '600',
            treemapLabelFontStyle: parsed.treemapLabelFontStyle || 'normal',
            treemapLabelColorMode: parsed.treemapLabelColorMode || 'auto_contrast',
            treemapLabelColor: parsed.treemapLabelColor || '',
            treemapLabelOverflow: parsed.treemapLabelOverflow || 'break',
            treemapLabelWidth: parsed.treemapLabelWidth ?? 120,
            treemapLabelLineHeight: parsed.treemapLabelLineHeight ?? 14,
            treemapShowUpperLabel: parsed.treemapShowUpperLabel ?? false,
            treemapUpperLabelHeight: parsed.treemapUpperLabelHeight ?? 24,
            treemapUpperLabelWidth: parsed.treemapUpperLabelWidth,
            treemapUpperLabelPosition: parsed.treemapUpperLabelPosition || 'inside',
            treemapUpperLabelFormat: parsed.treemapUpperLabelFormat || 'name',
            treemapUpperLabelFontSize: parsed.treemapUpperLabelFontSize ?? 11,
            treemapUpperLabelFontWeight: parsed.treemapUpperLabelFontWeight || 'bold',
            treemapUpperLabelColorMode: parsed.treemapUpperLabelColorMode || 'auto_contrast',
            treemapUpperLabelColor: parsed.treemapUpperLabelColor || '',
            treemapUpperLabelBgColor: parsed.treemapUpperLabelBgColor || 'rgba(0,0,0,0.18)',
            treemapVisibleMin: parsed.treemapVisibleMin ?? 10,
            treemapChildrenVisibleMin: parsed.treemapChildrenVisibleMin ?? 0,
            treemapLevelConfigs: parsed.treemapLevelConfigs || { ...INITIAL_SLOTS_CONFIG.slot_a.treemapLevelConfigs },
            barSorting: parsed.barSorting || 'desc',
            barThickness: parsed.barThickness ?? 20,
            barBorderRadius: parsed.barBorderRadius ?? 4,
            barGap: parsed.barGap ?? 30,
            barLabelPosition: parsed.barLabelPosition || 'right',
            barLabelFormat: parsed.barLabelFormat || 'value',
            barYAxisWidth: parsed.barYAxisWidth ?? 160,
            barYAxisOverflow: parsed.barYAxisOverflow || 'break',
            barBenchmarkLine: parsed.barBenchmarkLine ?? false,
            barBenchmarkValue: parsed.barBenchmarkValue ?? 50,
            barBenchmarkLabel: parsed.barBenchmarkLabel || 'Target Benchmark',
            barBenchmarkStyle: parsed.barBenchmarkStyle || 'dashed',
            barBenchmarkColor: parsed.barBenchmarkColor || '#ef4444',
            legendFormat: parsed.legendFormat || parsed.barLegendFormat || 'name',
            barLegendFormat: parsed.barLegendFormat || parsed.legendFormat || 'name',
            barLegendPosition: parsed.barLegendPosition || 'bottom-center',
            legendContextScope: parsed.legendContextScope || 'global_cohort',
            syncLegendAndBarMetrics: parsed.syncLegendAndBarMetrics ?? false,
            barLabelContextScope: parsed.barLabelContextScope || 'auto',
            legendShowParentPrefix: parsed.legendShowParentPrefix ?? false,
            sunburstLegendLevel: parsed.sunburstLegendLevel ?? 0,
            sunburstLegendFormat: parsed.sunburstLegendFormat || 'name',
            sunburstLegendPosition: parsed.sunburstLegendPosition || 'bottom-center',
            levelCustomGroups: parsed.levelCustomGroups || { ...INITIAL_SLOTS_CONFIG.slot_a.levelCustomGroups },
            levelCustomGroupLinks: parsed.levelCustomGroupLinks || { ...INITIAL_SLOTS_CONFIG.slot_a.levelCustomGroupLinks },
            customCategoryMap: parsed.customCategoryMap || {},
            enableManualOverrides: parsed.enableManualOverrides ?? false,
            manualCategoryValues: parsed.manualCategoryValues || {},
            customSliceColors: parsed.customSliceColors || {},
            pieLabelPlacement: parsed.pieLabelPlacement || 'outside',
            pieRadiusRatio: parsed.pieRadiusRatio || 52,
            pieLabelWidth: parsed.pieLabelWidth ?? 140,
            pieLeaderLineLength: parsed.pieLeaderLineLength ?? 12,
            pieLeaderLineLength2: parsed.pieLeaderLineLength2 ?? 14,
            pieLabelDistance: parsed.pieLabelDistance ?? 6,
            pieLineHeight: parsed.pieLineHeight ?? 15,
            barLabelDistance: parsed.barLabelDistance ?? 5,
            barLabelDecimals: parsed.barLabelDecimals,
            legendDistance: parsed.legendDistance ?? 20,
            legendWidth: parsed.legendWidth,
            legendLineHeight: parsed.legendLineHeight ?? 15,
            legendItemGap: parsed.legendItemGap ?? 12,
            legendFontSize: parsed.legendFontSize,
            legendOverflow: parsed.legendOverflow || 'break',
            radarShape: parsed.radarShape || 'polygon',
            radarStartAngle: parsed.radarStartAngle ?? 90,
            radarAreaOpacity: parsed.radarAreaOpacity ?? 28,
            radarLineWidth: parsed.radarLineWidth ?? 2.5,
            radarSplitNumber: parsed.radarSplitNumber ?? 5,
            radarRadius: parsed.radarRadius ?? 65,
            radarAxisLine: parsed.radarAxisLine ?? true,
            radarSplitLine: parsed.radarSplitLine ?? true,
            radarSplitArea: parsed.radarSplitArea ?? true,
            radarSplitAreaTheme: parsed.radarSplitAreaTheme || 'stepped',
            radarAxisNameMargin: parsed.radarAxisNameMargin ?? 15,
            radarAxisNameWidth: parsed.radarAxisNameWidth ?? 120,
            radarAxisNameOverflow: parsed.radarAxisNameOverflow || 'break',
            radarAxisNameLineHeight: parsed.radarAxisNameLineHeight ?? 14,
            radarAxisNameFontSize: parsed.radarAxisNameFontSize ?? parsed.radarLabelFontSize,
            radarAxisNameFontWeight: parsed.radarAxisNameFontWeight || parsed.radarLabelFontWeight || 'bold',
            radarAxisNameFontStyle: parsed.radarAxisNameFontStyle || parsed.radarLabelFontStyle || 'normal',
            radarAxisNameColor: parsed.radarAxisNameColor || parsed.radarLabelColor || '',
            radarShowDataLabels: parsed.radarShowDataLabels ?? false,
            radarDataLabelPosition: parsed.radarDataLabelPosition || 'top',
            radarBaselineLineStyle: parsed.radarBaselineLineStyle || 'solid',
            radarBaselineSymbol: parsed.radarBaselineSymbol || 'circle',
            radarBaselineSymbolSize: parsed.radarBaselineSymbolSize ?? 6,
            radarMode: parsed.radarMode || 'multi_variable',
            radarVariables: parsed.radarVariables || [],
            radarVariableAliases: parsed.radarVariableAliases || {},
            radarVariableTargets: parsed.radarVariableTargets || {},
            radarIndicatorFormat: parsed.radarIndicatorFormat || 'two_line',
            radarShowTarget: parsed.radarShowTarget ?? true,
            radarTargetName: parsed.radarTargetName || 'Horticultural Requirement Target',
            radarTargetValue: parsed.radarTargetValue ?? 100,
            radarTargetLineStyle: parsed.radarTargetLineStyle || 'dashed',
            radarTargetLineWidth: parsed.radarTargetLineWidth ?? 2,
            radarTargetColor: parsed.radarTargetColor || '#d9534f',
            radarTargetAreaOpacity: parsed.radarTargetAreaOpacity ?? 8,
            radarTargetSymbol: parsed.radarTargetSymbol || 'circle',
            radarTargetSymbolSize: parsed.radarTargetSymbolSize ?? 4,
            radarBaselineName: parsed.radarBaselineName || 'Empirical Cohort Baseline (n={n})',
            radarBaselineColor: parsed.radarBaselineColor || '#0275d8',
            radarTagShareName: parsed.radarTagShareName || 'Tag Share (% of Disclosed Tags, N={N})',
            radarTagShareColor: parsed.radarTagShareColor || '#c62828',
            radarTagShareLineStyle: parsed.radarTagShareLineStyle || 'dashed',
            radarTagShareLineWidth: parsed.radarTagShareLineWidth ?? 2,
            radarTagShareAreaOpacity: parsed.radarTagShareAreaOpacity ?? 12,
            radarTagShareSymbol: parsed.radarTagShareSymbol || 'rect',
            radarTagShareSymbolSize: parsed.radarTagShareSymbolSize ?? 5,
            bubbleMode: parsed.bubbleMode || 'categorical_matrix',
            bubbleMinRadius: parsed.bubbleMinRadius ?? 12,
            bubbleMaxRadius: parsed.bubbleMaxRadius ?? 65,
            bubbleOpacity: parsed.bubbleOpacity ?? 85,
            bubbleBorderWidth: parsed.bubbleBorderWidth ?? 1.5,
            bubbleBorderColor: parsed.bubbleBorderColor || '#333333',
            bubbleShowLabels: parsed.bubbleShowLabels ?? true,
            bubbleLabelFormat: parsed.bubbleLabelFormat || 'count_n',
            bubbleLabelFontSize: parsed.bubbleLabelFontSize ?? 11,
            bubbleLabelColor: parsed.bubbleLabelColor || '#ffffff',
            bubbleColorMode: parsed.bubbleColorMode || 'color_by_x',
            bubbleShowGridLines: parsed.bubbleShowGridLines ?? true,
            bubbleComplianceRules: parsed.bubbleComplianceRules || {},
            bubbleXAxisName: parsed.bubbleXAxisName || '',
            bubbleYAxisName: parsed.bubbleYAxisName || '',
            bubbleXAxisNameGap: parsed.bubbleXAxisNameGap ?? 55,
            bubbleYAxisNameGap: parsed.bubbleYAxisNameGap ?? 95,
            bubbleXAxisNameLocation: parsed.bubbleXAxisNameLocation || 'middle',
            bubbleYAxisNameLocation: parsed.bubbleYAxisNameLocation || 'middle',
            bubbleAxisTitleFontSize: parsed.bubbleAxisTitleFontSize ?? 12,
            bubbleAxisTitleFontWeight: parsed.bubbleAxisTitleFontWeight || 'bold',
            bubbleAxisTitleColor: parsed.bubbleAxisTitleColor || '',
            bubbleGridLeft: parsed.bubbleGridLeft ?? 120,
            bubbleGridBottom: parsed.bubbleGridBottom ?? 90,
            bubbleGridTop: parsed.bubbleGridTop ?? 65,
            bubbleGridRight: parsed.bubbleGridRight ?? 50,
            bubbleSeriesName: parsed.bubbleSeriesName || 'Deployments',
            bubbleLegendMode: parsed.bubbleLegendMode || 'category_series',
            lineMode: parsed.lineMode || 'cohort_trend',
            lineTimeSteps: parsed.lineTimeSteps ?? 96,
            lineTimeStepIntervalName: parsed.lineTimeStepIntervalName || 'Time Steps k (15-min intervals / 24-h Cycle)',
            lineYAxisTitle: parsed.lineYAxisTitle || 'State Uncertainty Tr(P)',
            lineYMin: parsed.lineYMin ?? 0,
            lineYMax: parsed.lineYMax ?? 4.5,
            lineBaselineA: parsed.lineBaselineA ?? 0.15,
            lineBaselineB: parsed.lineBaselineB ?? 0.038,
            lineBaselineName: parsed.lineBaselineName || 'Static Architecture (24% CNN / 15% Filter Cohort)',
            lineBaselineColor: parsed.lineBaselineColor || '#d9534f',
            lineBaselineStyle: parsed.lineBaselineStyle || 'dashed',
            lineEstimatorInitial: parsed.lineEstimatorInitial ?? 0.15,
            lineEstimatorDrift: parsed.lineEstimatorDrift ?? 0.11,
            lineEstimatorModulation: parsed.lineEstimatorModulation ?? 0.05,
            lineEstimatorName: parsed.lineEstimatorName || 'Discrete Recursive Estimator (Proposed Gated Pipeline)',
            lineEstimatorColor: parsed.lineEstimatorColor || '#0275d8',
            lineEstimatorStyle: parsed.lineEstimatorStyle || 'solid',
            lineThresholdValue: parsed.lineThresholdValue ?? 1.0,
            lineThresholdName: parsed.lineThresholdName || 'Semantic Trigger Threshold (ε)',
            lineThresholdLabel: parsed.lineThresholdLabel || 'Threshold ε = 1.00',
            lineThresholdColor: parsed.lineThresholdColor || '',
            lineThresholdStyle: parsed.lineThresholdStyle || 'dotted',
            lineThresholdPosition: parsed.lineThresholdPosition || 'insideEndTop',
            lineThresholdLineWidth: parsed.lineThresholdLineWidth ?? 1.5,
            lineAxisPointerType: parsed.lineAxisPointerType || 'cross',
            lineMarkerSymbol: parsed.lineMarkerSymbol || 'circle',
            lineXAxisInterval: parsed.lineXAxisInterval ?? 'auto',
            lineShowGridLines: parsed.lineShowGridLines ?? true,
            lineGridLeft: parsed.lineGridLeft ?? 60,
            lineGridRight: parsed.lineGridRight ?? 40,
            lineGridTop: parsed.lineGridTop ?? 65,
            lineGridBottom: parsed.lineGridBottom ?? 65,
            lineBaselineAreaOpacity: parsed.lineBaselineAreaOpacity ?? 0,
            lineEstimatorAreaOpacity: parsed.lineEstimatorAreaOpacity ?? 8,
            lineBaselineFillMode: parsed.lineBaselineFillMode || 'none',
            lineEstimatorFillMode: parsed.lineEstimatorFillMode || 'subtle_gradient',
            lineShowTxEvents: parsed.lineShowTxEvents ?? true,
            lineTxEventSymbol: parsed.lineTxEventSymbol || 'triangle',
            lineTxEventColor: parsed.lineTxEventColor || '',
            lineTxEventSize: parsed.lineTxEventSize ?? 12,
            lineShowTxLabels: parsed.lineShowTxLabels ?? true,
            lineTxEventLabel: parsed.lineTxEventLabel || 'TX',
            lineTxEventSeriesName: parsed.lineTxEventSeriesName || 'Physical Radio TX Events',
            legendType: parsed.legendType || 'plain',
            legendAlign: parsed.legendAlign || 'auto',
            legendIcon: parsed.legendIcon || 'inherit',
            legendItemWidth: parsed.legendItemWidth ?? 25,
            legendItemHeight: parsed.legendItemHeight ?? 14,
            legendFontWeight: (parsed.legendFontWeight as any) || 'normal',
            legendTextColor: parsed.legendTextColor || '',
            legendBackgroundColor: parsed.legendBackgroundColor || 'transparent',
            legendBorderColor: parsed.legendBorderColor || 'transparent',
            legendBorderWidth: parsed.legendBorderWidth ?? 0,
            legendBorderRadius: parsed.legendBorderRadius ?? 4,
            legendPadding: parsed.legendPadding ?? 5,
            // Universal Layout Margins
            gridMarginAuto: parsed.gridMarginAuto ?? true,
            gridMarginTop: parsed.gridMarginTop ?? 45,
            gridMarginBottom: parsed.gridMarginBottom ?? 45,
            gridMarginLeft: parsed.gridMarginLeft ?? 60,
            gridMarginRight: parsed.gridMarginRight ?? 45,
            // Universal Data Labels
            universalLabelPosition: parsed.universalLabelPosition || 'auto',
            universalLabelDistance: parsed.universalLabelDistance ?? 6,
            universalLabelOverflow: parsed.universalLabelOverflow || 'break',
            universalMaxLabelWidth: parsed.universalMaxLabelWidth ?? 140,
            universalLabelLineHeight: parsed.universalLabelLineHeight ?? 14,
            universalLabelFontSize: parsed.universalLabelFontSize,
            universalLabelFontWeight: parsed.universalLabelFontWeight || '600',
            universalLabelFontStyle: parsed.universalLabelFontStyle || 'normal',
            universalLabelColor: parsed.universalLabelColor || '',
            universalLabelColorMode: parsed.universalLabelColorMode || 'auto_contrast',
            universalLabelRotate: parsed.universalLabelRotate ?? 0,
            universalLabelMinThreshold: parsed.universalLabelMinThreshold ?? 0,
            universalLabelShowZero: parsed.universalLabelShowZero ?? true,
            // Smart Color Modes
            smartColorMode: parsed.smartColorMode || parsed.sunburstColorMode || 'branch_gradient',
            smartColorPropagation: parsed.smartColorPropagation || 'auto_children'
          };

          config.setAllSlotsConfig({
            ...INITIAL_SLOTS_CONFIG,
            slot_a: legacySlotA
          });
        }

        if (typeof parsed.chartScale === 'number') camera.setChartScale(parsed.chartScale);
        if (typeof parsed.panX === 'number') camera.setPanX(parsed.panX);
        if (typeof parsed.panY === 'number') camera.setPanY(parsed.panY);
        if (typeof parsed.tiltAngle === 'number') camera.setTiltAngle(parsed.tiltAngle);
        if (typeof parsed.rotationAngle === 'number') camera.setRotationAngle(parsed.rotationAngle);
        if (typeof parsed.fitOffsetX === 'number' && camera.setFitOffsetX) camera.setFitOffsetX(parsed.fitOffsetX);
        if (typeof parsed.fitOffsetY === 'number' && camera.setFitOffsetY) camera.setFitOffsetY(parsed.fitOffsetY);
        if (typeof parsed.containerPadding === 'number' && camera.setContainerPadding) camera.setContainerPadding(parsed.containerPadding);
      } catch (err) {
        alert('Invalid preset JSON file format.');
      }
    };
    reader.readAsText(file);
  }, [layout, config, style, camera]);

  return {
    handleExportPreset,
    handleImportPreset
  };
}
