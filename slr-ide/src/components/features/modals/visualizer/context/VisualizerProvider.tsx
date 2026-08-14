import React, { useCallback, useMemo } from 'react';
import { useVisualizerLayout } from '../hooks/useVisualizerLayout';
import { useVisualizerConfig } from '../hooks/useVisualizerConfig';
import { useVisualizerData } from '../hooks/useVisualizerData';
import { useVisualizerStyle } from '../hooks/useVisualizerStyle';
import { useVisualizerCamera } from '../hooks/useVisualizerCamera';
import { useVisualizerWorkspace } from '../hooks/useVisualizerWorkspace';
import { useVisualizerPresets } from '../hooks/useVisualizerPresets';
import { useChartCanvas } from '../hooks/useChartCanvas';
import { buildChartOption } from '../generators';
import { VisualizerContext, type VisualizerContextValue } from './VisualizerContext';
import type { VisualizerModalProps, SlotId } from '../types';

interface VisualizerProviderProps {
  children: React.ReactNode;
  props: VisualizerModalProps;
}

export function VisualizerProvider({ children, props }: VisualizerProviderProps) {
  const { papers, isOpen, umbrellanizerMap = {} } = props;

  const layout = useVisualizerLayout();

  const config = useVisualizerConfig({
    activeSlot: layout.activeSlot
  });

  const data = useVisualizerData({
    papers,
    activeSlot: layout.activeSlot,
    currentSlotConfig: config.currentSlotConfig,
    updateActiveSlot: config.updateActiveSlot,
    umbrellanizerMap
  });

  const style = useVisualizerStyle();
  const camera = useVisualizerCamera();

  const workspace = useVisualizerWorkspace({
    isOpen,
    currentStep: config.currentStep,
    setCurrentStep: config.setCurrentStep,
    onClose: props.onClose
  });

  const presets = useVisualizerPresets({
    layout,
    config,
    style,
    camera
  });

  const generateSlotOption = useCallback((slotId: SlotId) => {
    const slotConfig = config.slotsConfig[slotId] || config.currentSlotConfig;
    const isSingle = layout.layoutMode === 'single';

    return buildChartOption({
      chartType: slotConfig.chartType,
      papers,
      themePreset: style.themePreset,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      chartTitle: isSingle ? style.chartTitle : '',
      chartSubtitle: isSingle ? style.chartSubtitle : '',
      showChartTitle: isSingle ? style.showChartTitle : false,
      showChartSubtitle: isSingle ? style.showChartSubtitle : false,
      showLegend: slotConfig.showLegend,
      legendPosition: slotConfig.legendPosition,
      showDataLabels: slotConfig.showDataLabels,
      labelRotation: slotConfig.labelRotation,
      primaryField: slotConfig.primaryField,
      secondaryField: slotConfig.secondaryField,
      metricMode: slotConfig.metricMode,
      sankeyFields: slotConfig.sankeyFields,
      sankeyLabelPositions: slotConfig.sankeyLabelPositions,
      sankeyMaxNodes: slotConfig.sankeyMaxNodes,
      limitCategories: slotConfig.limitCategories,
      maxCategoriesCount: slotConfig.maxCategoriesCount,
      numFieldX: slotConfig.numFieldX,
      numFieldY: slotConfig.numFieldY,
      numFieldSize: slotConfig.numFieldSize,
      useUmbrellanizer: slotConfig.useUmbrellanizer,
      splitMultiValues: slotConfig.splitMultiValues,
      excludeEmpty: slotConfig.excludeEmpty,
      donutRatio: slotConfig.donutRatio,
      smoothLine: slotConfig.smoothLine,
      sankeyNodeWidth: slotConfig.sankeyNodeWidth,
      sankeyNodeGap: slotConfig.sankeyNodeGap,
      sankeyLeftPadding: slotConfig.sankeyLeftPadding,
      sankeyRightPadding: slotConfig.sankeyRightPadding,
      bubbleScale: slotConfig.bubbleScale,
      gaugeMaxScale: slotConfig.gaugeMaxScale,
      sunburstLevelConfigs: slotConfig.sunburstLevelConfigs,
      sunburstSort: slotConfig.sunburstSort,
      sunburstNodeClick: slotConfig.sunburstNodeClick,
      sunburstEmphasisFocus: slotConfig.sunburstEmphasisFocus,
      barSorting: slotConfig.barSorting,
      barThickness: slotConfig.barThickness,
      barBorderRadius: slotConfig.barBorderRadius,
      barGap: slotConfig.barGap,
      barLabelPosition: slotConfig.barLabelPosition,
      barLabelFormat: slotConfig.barLabelFormat,
      barYAxisWidth: slotConfig.barYAxisWidth,
      barYAxisOverflow: slotConfig.barYAxisOverflow,
      barBenchmarkLine: slotConfig.barBenchmarkLine,
      barBenchmarkValue: slotConfig.barBenchmarkValue,
      barBenchmarkLabel: slotConfig.barBenchmarkLabel,
      barBenchmarkStyle: slotConfig.barBenchmarkStyle,
      barBenchmarkColor: slotConfig.barBenchmarkColor,
      legendFormat: slotConfig.legendFormat || 'name',
      barLegendFormat: slotConfig.barLegendFormat,
      barLegendPosition: slotConfig.barLegendPosition,
      chartScale: camera.chartScale,
      panX: camera.panX,
      panY: camera.panY,
      tiltAngle: camera.tiltAngle,
      rotationAngle: camera.rotationAngle,
      sunburstLegendLevel: slotConfig.sunburstLegendLevel,
      sunburstLegendFormat: slotConfig.sunburstLegendFormat,
      sunburstLegendPosition: slotConfig.sunburstLegendPosition,
      levelCustomGroups: slotConfig.levelCustomGroups,
      levelCustomGroupLinks: slotConfig.levelCustomGroupLinks,
      customCategoryMap: slotConfig.customCategoryMap,
      enableManualOverrides: slotConfig.enableManualOverrides,
      manualCategoryValues: slotConfig.manualCategoryValues,
      customSliceColors: slotConfig.customSliceColors,
      pieLabelPlacement: slotConfig.pieLabelPlacement,
      pieRadiusRatio: slotConfig.pieRadiusRatio,
      pieLabelWidth: slotConfig.pieLabelWidth,
      umbrellanizerMap
    });
  }, [config.slotsConfig, config.currentSlotConfig, layout.layoutMode, papers, style, camera, umbrellanizerMap]);

  const canvas = useChartCanvas({
    isOpen,
    currentStep: config.currentStep,
    layoutMode: layout.layoutMode,
    activeSlotsList: layout.activeSlotsList,
    activeSlot: layout.activeSlot,
    themePreset: style.themePreset,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    chartTitle: style.chartTitle,
    chartSubtitle: style.chartSubtitle,
    showChartTitle: style.showChartTitle,
    showChartSubtitle: style.showChartSubtitle,
    subfigureLabelStyle: style.subfigureLabelStyle,
    panelGutter: style.panelGutter,
    showPanelBorders: style.showPanelBorders,
    aspectRatio: style.aspectRatio,
    customWidth: style.customWidth,
    customHeight: style.customHeight,
    dimensionUnit: style.dimensionUnit,
    slotsConfig: config.slotsConfig,
    chartScale: camera.chartScale,
    panX: camera.panX,
    panY: camera.panY,
    tiltAngle: camera.tiltAngle,
    rotationAngle: camera.rotationAngle,
    inspectedSlot: workspace.inspectedSlot,
    generateSlotOption
  });

  const value: VisualizerContextValue = useMemo(() => ({
    props,
    layout,
    config,
    data,
    style,
    camera,
    workspace,
    presets,
    canvas,
    generateSlotOption
  }), [props, layout, config, data, style, camera, workspace, presets, canvas, generateSlotOption]);

  return (
    <VisualizerContext.Provider value={value}>
      {children}
    </VisualizerContext.Provider>
  );
}
