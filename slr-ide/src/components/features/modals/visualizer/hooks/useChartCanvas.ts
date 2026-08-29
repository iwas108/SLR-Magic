import { useState, useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import { exportFigure, exportMultiPanelFigure } from '../utils/exportUtils';
import type { 
  ThemePreset, 
  FontFamily, 
  LayoutMode, 
  SlotId, 
  SlotConfig, 
  SubfigureLabelStyle,
  AspectRatioPreset,
  DimensionUnit,
  ExportFormat
} from '../types';

export function useChartCanvas(params: {
  isOpen: boolean;
  currentStep: number;
  layoutMode: LayoutMode;
  activeSlotsList: SlotId[];
  activeSlot: SlotId;
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
  aspectRatio?: AspectRatioPreset;
  customWidth?: number;
  customHeight?: number;
  dimensionUnit?: DimensionUnit;
  slotsConfig: Record<SlotId, SlotConfig>;
  chartScale: number;
  panX: number;
  panY: number;
  tiltAngle: number;
  rotationAngle: number;
  fitOffsetX?: number;
  fitOffsetY?: number;
  containerPadding?: number;
  inspectedSlot?: SlotId | null;
  generateSlotOption: (slotId: SlotId) => echarts.EChartsOption;
}) {
  const {
    isOpen,
    currentStep,
    layoutMode,
    activeSlotsList,
    activeSlot,
    themePreset,
    fontFamily,
    fontSize,
    chartTitle,
    chartSubtitle,
    showChartTitle,
    showChartSubtitle,
    subfigureLabelStyle,
    panelGutter,
    showPanelBorders,
    aspectRatio = '16:9',
    customWidth = 190,
    customHeight = 107,
    dimensionUnit = 'mm',
    slotsConfig,
    chartScale = 1.0,
    panX = 0,
    panY = 0,
    tiltAngle,
    rotationAngle,
    fitOffsetX = 0,
    fitOffsetY = 0,
    containerPadding = 12,
    inspectedSlot = null,
    generateSlotOption
  } = params;

  const slotDomRefs = useRef<Record<SlotId, HTMLDivElement | null>>({
    slot_a: null,
    slot_b: null,
    slot_c: null,
    slot_d: null
  });

  const chartInstancesRef = useRef<Record<SlotId, echarts.ECharts | null>>({
    slot_a: null,
    slot_b: null,
    slot_c: null,
    slot_d: null
  });

  // Step 4 State: Export Settings
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportScale, setExportScale] = useState<number>(3);

  // Synchronize a specific slot's ECharts instance with its DOM node
  const syncSlotInstance = useCallback((slotId: SlotId) => {
    const dom = slotDomRefs.current[slotId];
    if (!dom) return;

    let instance = chartInstancesRef.current[slotId];

    // If existing instance is attached to a different/dead DOM element or disposed, recreate it
    if (instance) {
      if (instance.isDisposed() || instance.getDom() !== dom) {
        try {
          instance.dispose();
        } catch {
          // ignore
        }
        instance = null;
        chartInstancesRef.current[slotId] = null;
      }
    }

    if (!instance) {
      instance = echarts.init(dom, undefined, {
        renderer: exportFormat === 'svg' || exportFormat === 'pdf' ? 'svg' : 'canvas'
      });
      chartInstancesRef.current[slotId] = instance;
    }

    try {
      const option = generateSlotOption(slotId);
      instance.setOption(option, true);
      instance.resize();
    } catch (e) {
      console.error(`Failed to set option for slot ${slotId}:`, e);
    }
  }, [exportFormat, generateSlotOption]);

  const setSlotDomRef = useCallback((slotId: SlotId) => (el: HTMLDivElement | null) => {
    const prevEl = slotDomRefs.current[slotId];
    slotDomRefs.current[slotId] = el;

    if (el && el !== prevEl && isOpen) {
      // Defer slightly to ensure layout calculation is finished
      requestAnimationFrame(() => {
        syncSlotInstance(slotId);
      });
    }
  }, [isOpen, syncSlotInstance]);

  // Initialize and update ECharts instances for all active slots
  useEffect(() => {
    if (!isOpen) return;

    // 1. Dispose instances for inactive slots to prevent memory leaks
    const allKnownSlots: SlotId[] = ['slot_a', 'slot_b', 'slot_c', 'slot_d'];
    allKnownSlots.forEach((slotId) => {
      if (!activeSlotsList.includes(slotId) && chartInstancesRef.current[slotId]) {
        try {
          chartInstancesRef.current[slotId]?.dispose();
        } catch {}
        chartInstancesRef.current[slotId] = null;
      }
    });

    // 2. Sync all active slots
    activeSlotsList.forEach((slotId) => {
      syncSlotInstance(slotId);
    });

    // 3. Trigger bulk resize across all instances after frame
    const timer = setTimeout(() => {
      activeSlotsList.forEach((slotId) => {
        chartInstancesRef.current[slotId]?.resize();
      });
    }, 50);

    const handleResize = () => {
      activeSlotsList.forEach((slotId) => {
        chartInstancesRef.current[slotId]?.resize();
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    isOpen,
    currentStep,
    layoutMode,
    activeSlotsList,
    exportFormat,
    inspectedSlot,
    syncSlotInstance
  ]);

  // Handle disposal on unmount or modal close
  useEffect(() => {
    if (!isOpen) {
      const allKnownSlots: SlotId[] = ['slot_a', 'slot_b', 'slot_c', 'slot_d'];
      allKnownSlots.forEach((slotId) => {
        if (chartInstancesRef.current[slotId]) {
          try {
            chartInstancesRef.current[slotId]?.dispose();
          } catch {}
          chartInstancesRef.current[slotId] = null;
        }
      });
    }
  }, [isOpen]);

  // Export Full Composite Figure (or Single Figure in Single Mode)
  const handleExportChart = useCallback(() => {
    exportMultiPanelFigure({
      layoutMode,
      activeSlotsList,
      chartInstances: chartInstancesRef.current,
      slotsConfig,
      exportFormat,
      exportScale,
      themePreset,
      fontFamily,
      fontSize,
      chartTitle,
      chartSubtitle,
      showChartTitle,
      showChartSubtitle,
      subfigureLabelStyle,
      panelGutter,
      showPanelBorders,
      aspectRatio,
      customWidth,
      customHeight,
      dimensionUnit,
      chartScale,
      panX,
      panY,
      fitOffsetX,
      fitOffsetY,
      containerPadding,
      tiltAngle,
      rotationAngle,
      generateSlotOption
    });
  }, [
    layoutMode,
    activeSlotsList,
    slotsConfig,
    exportFormat,
    exportScale,
    themePreset,
    fontFamily,
    fontSize,
    chartTitle,
    chartSubtitle,
    showChartTitle,
    showChartSubtitle,
    subfigureLabelStyle,
    panelGutter,
    showPanelBorders,
    aspectRatio,
    customWidth,
    customHeight,
    dimensionUnit,
    chartScale,
    panX,
    panY,
    fitOffsetX,
    fitOffsetY,
    containerPadding,
    tiltAngle,
    rotationAngle,
    generateSlotOption
  ]);

  // Export Single Active Subfigure Only
  const handleExportActiveSlot = useCallback(() => {
    const instance = chartInstancesRef.current[activeSlot];
    const cfg = slotsConfig[activeSlot];
    if (!instance || !cfg) return;

    exportFigure({
      chartInstance: instance,
      chartType: cfg.chartType,
      exportFormat,
      exportScale,
      themePreset,
      chartScale,
      panX,
      panY,
      fitOffsetX,
      fitOffsetY,
      containerPadding,
      tiltAngle,
      rotationAngle,
      subTitle: cfg.subTitle || activeSlot
    });
  }, [activeSlot, slotsConfig, exportFormat, exportScale, themePreset, chartScale, panX, panY, fitOffsetX, fitOffsetY, containerPadding, tiltAngle, rotationAngle]);

  return {
    setSlotDomRef,
    chartInstancesRef,
    exportFormat,
    setExportFormat,
    exportScale,
    setExportScale,
    handleExportChart,
    handleExportActiveSlot
  };
}
