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
            bubbleScale: parsed.bubbleScale ?? 1.2,
            gaugeMaxScale: parsed.gaugeMaxScale ?? 100,
            sunburstLevelConfigs: parsed.sunburstLevelConfigs || { ...INITIAL_SLOTS_CONFIG.slot_a.sunburstLevelConfigs },
            sunburstSort: parsed.sunburstSort || 'desc',
            sunburstNodeClick: parsed.sunburstNodeClick || 'rootToNode',
            sunburstEmphasisFocus: parsed.sunburstEmphasisFocus || 'ancestor',
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
            legendDistance: parsed.legendDistance ?? 20,
            legendWidth: parsed.legendWidth,
            legendLineHeight: parsed.legendLineHeight ?? 15,
            legendItemGap: parsed.legendItemGap ?? 12,
            legendFontSize: parsed.legendFontSize,
            legendOverflow: parsed.legendOverflow || 'break'
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
