import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Database,
  Layers,
  Sliders,
  Palette,
  Download,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Square,
  Crosshair,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Zap,
  Eye,
  Grid,
  FileCode,
  Table,
  Check,
  Filter
} from 'lucide-react';
import { CHART_TYPES_INFO } from '../constants/chartTypes';
import { THEME_PALETTES } from '../constants/themePalettes';
import { FONT_FAMILIES } from '../constants/fontFamilies';
import { formatSubfigureLabel, SLOT_METADATA } from '../constants/layoutPresets';
import { resolveTargetDimensions } from '../utils/exportUtils';
import { CUSTOM_GROUPING_KEY } from '../constants/defaultConfigs';
import { extractColonPrefixPaths } from '../utils/dataExtractor';
import { useVisualizerContext } from '../context/VisualizerContext';
import { SlotSwitcherBar } from './subcomponents/SlotSwitcherBar';
import { LayoutTemplateSelector } from './subcomponents/LayoutTemplateSelector';
import { CustomGroupingManager } from './subcomponents/CustomGroupingManager';
import { BreakdownTablePanel } from './subcomponents/BreakdownTablePanel';
import { CrossTabMatrixPanel } from './subcomponents/CrossTabMatrixPanel';
import { HorizontalBarConfigPanel } from './subcomponents/HorizontalBarConfigPanel';
import { ClusteredBarConfigPanel } from './subcomponents/ClusteredBarConfigPanel';
import { SunburstLevelConfigPanel } from './subcomponents/SunburstLevelConfigPanel';
import { ScientificAxisConfigPanel } from './subcomponents/ScientificAxisConfigPanel';
import {
  VerticalBarConfigPanel,
  StackedBarConfigPanel,
  LineConfigPanel,
  PieDonutConfigPanel,
  RadarConfigPanel,
  FunnelConfigPanel,
  HeatmapConfigPanel,
  TreemapConfigPanel,
  BoxplotConfigPanel,
  ScatterConfigPanel,
  BubbleConfigPanel,
  ScatterBubbleConfigPanel,
  GraphConfigPanel,
  GaugeConfigPanel,
  CalendarConfigPanel,
  SankeyConfigPanel
} from './subcomponents/ChartConfigPanels';
import { RadarDataMappingPanel } from './subcomponents/RadarDataMappingPanel';
import { FieldAutocomplete } from './subcomponents/FieldAutocomplete';
import { ExportPanel } from './subcomponents/ExportPanel';
import { CameraControlsOverlay } from './subcomponents/CameraControlsOverlay';
import type { ChartType, ThemePreset, FontFamily, SlotId, MetricMode, DisplayFormatTemplate } from '../types';

type StudioTab = 'data' | 'chart' | 'params' | 'style' | 'export';

function formatFieldLabel(f: string): string {
  if (f === CUSTOM_GROUPING_KEY) return '✨ [Custom Grouping Layer]';
  if (f.startsWith('ext:macro:')) return `Extracted: ${f.substring(10)} [Level 1: Macro Domain]`;
  if (f.startsWith('ext:sub:')) return `Extracted: ${f.substring(8)} [Level 2: Sub-Category]`;
  if (f.startsWith('ext:leaf:') || f.startsWith('ext:tail:')) return `Extracted: ${f.substring(9)} [Level 3: Taxonomy Leaf / Tail]`;
  if (f.startsWith('raw:leaf:ext:') || f.startsWith('raw:tail:ext:')) return `Extracted: ${f.substring(13)} [Raw Leaf Token (Tail after ':')]`;
  if (f.startsWith('raw:ext:')) return `Extracted: ${f.substring(8)} [Raw Tokens (Full String)]`;
  if (f.startsWith('ext:')) return `Extracted: ${f.substring(4)} [Full Taxonomy String]`;
  return f;
}

function renderFieldOptions(availableFields: string[]) {
  const customGroupFields = availableFields.filter(f => f === CUSTOM_GROUPING_KEY);
  const metadataFields = availableFields.filter(f => !f.startsWith('ext:') && !f.startsWith('raw:ext:') && !f.startsWith('raw:leaf:') && !f.startsWith('raw:tail:') && f !== CUSTOM_GROUPING_KEY);
  const extractedFields = availableFields.filter(f => f.startsWith('ext:') || f.startsWith('raw:ext:') || f.startsWith('raw:leaf:') || f.startsWith('raw:tail:'));

  return (
    <>
      {customGroupFields.length > 0 && (
        <optgroup label="✨ Custom Grouping Layer">
          {customGroupFields.map(f => (
            <option key={f} value={f}>{formatFieldLabel(f)}</option>
          ))}
        </optgroup>
      )}
      {extractedFields.length > 0 && (
        <optgroup label="✨ Extracted Variables (3-Tier Taxonomy: Macro / Subcategory / Leaf Tail / Raw)">
          {extractedFields.map(f => (
            <option key={f} value={f}>{formatFieldLabel(f)}</option>
          ))}
        </optgroup>
      )}
      {metadataFields.length > 0 && (
        <optgroup label="Standard Metadata Fields">
          {metadataFields.map(f => (
            <option key={f} value={f}>{formatFieldLabel(f)}</option>
          ))}
        </optgroup>
      )}
    </>
  );
}

export function VisualizerStudio() {
  const { props, layout, config, data, style, camera, canvas, workspace } = useVisualizerContext();
  const { papers, totalUnfilteredCount, isFiltered } = props;
  const { layoutMode, activeSlotsList, activeSlot, setActiveSlot } = layout;
  const {
    currentSlotConfig,
    chartType,
    setChartType,
    primaryField,
    setPrimaryField,
    secondaryField,
    setSecondaryField,
    metricMode,
    setMetricMode,
    sankeyFields,
    setSankeyFields,
    sankeyMaxNodes,
    setSankeyMaxNodes,
    sankeyLevelPathFilters,
    setSankeyLevelPathFilters,
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
    bubbleMode,
    setBubbleMode,
    lineMode,
    setLineMode,
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
    slotsConfig
  } = config;

  const {
    chartTitle,
    setChartTitle,
    chartSubtitle,
    setChartSubtitle,
    showChartTitle,
    setShowChartTitle,
    showChartSubtitle,
    setShowChartSubtitle,
    themePreset,
    setThemePreset,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    subfigureLabelStyle,
    setSubfigureLabelStyle,
    panelGutter,
    setPanelGutter,
    showPanelBorders,
    setShowPanelBorders,
    aspectRatio,
    setAspectRatio,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    dimensionUnit,
    setDimensionUnit,
    decimalPrecision,
    setDecimalPrecision,
    useTildeForCoarse,
    setUseTildeForCoarse,
    ratioStyle,
    setRatioStyle,
    forceCohortDenominator,
    setForceCohortDenominator,
    defaultLabelFormat,
    setDefaultLabelFormat,
    defaultLegendFormat,
    setDefaultLegendFormat
  } = style;

  const {
    chartScale,
    setChartScale,
    panX,
    setPanX,
    panY,
    setPanY,
    tiltAngle,
    rotationAngle,
    containerPadding,
    setContainerPadding,
    showSafeGuides,
    setShowSafeGuides,
    fitOffsetX,
    fitOffsetY,
    handleResetCamera
  } = camera;

  const { setSlotDomRef, chartInstancesRef } = canvas;
  const {
    isZenMode,
    toggleZenMode,
    canvasBackdrop,
    inspectedSlot,
    setInspectedSlot
  } = workspace;

  const { availableFields, discoveredVariables, numericalFields, detectedCategories } = data;

  // Active Inspector Tab
  const [activeTab, setActiveTab] = useState<StudioTab>('data');
  const [chartCategoryFilter, setChartCategoryFilter] = useState<string>('all');
  const [showCustomGroupingModal, setShowCustomGroupingModal] = useState<boolean>(false);
  const [showBreakdownTable, setShowBreakdownTable] = useState<boolean>(false);
  const [showCrossTabModal, setShowCrossTabModal] = useState<boolean>(false);

  // Detect unique colon prefix paths for each active hierarchy level
  const levelColonPaths = useMemo(() => {
    return sankeyFields.map(f => {
      return extractColonPrefixPaths(papers, f, {
        useUmbrellanizer,
        umbrellanizerMap: props.umbrellanizerMap
      });
    });
  }, [papers, sankeyFields, useUmbrellanizer, props.umbrellanizerMap]);

  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 800, height: 500 });

  // Measure stage container size via ResizeObserver
  useEffect(() => {
    const el = stageWrapperRef.current;
    if (!el) return;

    const handleResize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setContainerSize({ width: w, height: h });
      }
    };

    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
      activeSlotsList.forEach((slotId) => {
        chartInstancesRef.current[slotId]?.resize();
      });
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [activeSlotsList, chartInstancesRef]);

  // Trigger ECharts resize when options or tabs change
  useEffect(() => {
    const timer = setTimeout(() => {
      activeSlotsList.forEach((slotId) => {
        chartInstancesRef.current[slotId]?.resize();
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTab, inspectedSlot, isZenMode, aspectRatio, customWidth, customHeight, containerPadding, activeSlotsList, chartInstancesRef]);

  // Resolve target publication aspect ratio geometry
  const { targetWidth, targetHeight, aspectLabel } = resolveTargetDimensions(
    aspectRatio,
    customWidth,
    customHeight,
    dimensionUnit,
    1200
  );

  const targetRatio = targetWidth / targetHeight;

  // Mathematically exact fitted stage frame style
  const fittedStageStyle = useMemo(() => {
    if (inspectedSlot) {
      return { width: '100%', height: '100%' };
    }

    const padH = 32;
    const padV = 32;
    const availW = Math.max(120, containerSize.width - padH);
    const availH = Math.max(120, containerSize.height - padV);

    let fitW: number;
    let fitH: number;

    if (availW / availH > targetRatio) {
      fitH = availH;
      fitW = Math.round(availH * targetRatio);
    } else {
      fitW = availW;
      fitH = Math.round(availW / targetRatio);
    }

    return {
      width: `${fitW}px`,
      height: `${fitH}px`,
      maxWidth: '100%',
      maxHeight: '100%'
    };
  }, [inspectedSlot, containerSize, targetRatio]);

  const getGridContainerClasses = () => {
    switch (layoutMode) {
      case 'dual_horizontal':
        return 'grid grid-cols-1 md:grid-cols-2 h-full';
      case 'dual_vertical':
        return 'grid grid-cols-1 grid-rows-2 h-full';
      case 'tri_top_two_bottom':
        return 'grid grid-cols-1 md:grid-cols-2 grid-rows-2 h-full';
      case 'quad_grid':
        return 'grid grid-cols-1 md:grid-cols-2 grid-rows-2 h-full';
      case 'single':
      default:
        return 'w-full h-full flex flex-col flex-1 min-h-0';
    }
  };

  const getSlotSpanClasses = (slotId: SlotId) => {
    if (layoutMode === 'tri_top_two_bottom' && slotId === 'slot_a') {
      return 'md:col-span-2';
    }
    return '';
  };

  const getBackdropClasses = () => {
    switch (canvasBackdrop) {
      case 'dark':
        return 'bg-slate-950 text-slate-100';
      case 'white':
        return 'bg-white text-slate-900 shadow-md';
      case 'checkerboard':
        return 'bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#475569_1px,transparent_1px)]';
      case 'slate':
      default:
        return 'bg-card text-foreground';
    }
  };

  // Filtered Chart Types
  const chartTypesList = Object.entries(CHART_TYPES_INFO) as [ChartType, typeof CHART_TYPES_INFO[ChartType]][];
  const filteredChartTypes = chartTypesList.filter(([id, meta]) => {
    if (chartCategoryFilter === 'all') return true;
    if (chartCategoryFilter === 'categorical') return ['bar_vertical', 'bar_horizontal', 'clustered_bar', 'stacked_bar', 'pie_donut'].includes(id);
    if (chartCategoryFilter === 'hierarchical') return ['sunburst', 'treemap', 'sankey'].includes(id);
    if (chartCategoryFilter === 'trend') return ['line', 'calendar'].includes(id);
    if (chartCategoryFilter === 'correlation') return ['scatter', 'bubble', 'boxplot'].includes(id);
    if (chartCategoryFilter === 'matrix_flow') return ['heatmap', 'radar', 'funnel', 'graph', 'gauge'].includes(id);
    return true;
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative w-full h-full bg-background">
      
      {/* ======================================================== */}
      {/* 1. CENTER STAGE (Main Live Reactive Canvas)             */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden relative p-3 sm:p-4 bg-secondary/15 min-w-0">
        
        {/* Filtered Cohort Banner if active */}
        {isFiltered && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span className="font-semibold text-[11px]">
                Showing filtered cohort: {papers.length} of {totalUnfilteredCount || papers.length} papers
              </span>
            </div>
            <span className="text-[10px] font-mono opacity-80">Scientific Normalization Active</span>
          </div>
        )}

        {/* Stage Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
          {/* Layout Mode & Slot Pill Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {layoutMode !== 'single' ? (
              <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border/80">
                {activeSlotsList.map((slotId, sIdx) => {
                  const isCur = activeSlot === slotId;
                  const sMeta = SLOT_METADATA[slotId];
                  const sType = slotsConfig[slotId]?.chartType || 'bar_vertical';
                  const sTypeMeta = CHART_TYPES_INFO[sType];
                  const sLabel = formatSubfigureLabel(sIdx, subfigureLabelStyle);

                  return (
                    <button
                      key={slotId}
                      type="button"
                      onClick={() => setActiveSlot(slotId)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isCur
                          ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40 scale-[1.02]'
                          : 'hover:bg-secondary text-foreground'
                      }`}
                    >
                      <span className={`text-[10px] px-1 py-0.2 rounded font-black ${isCur ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'}`}>
                        {sLabel || sMeta.letter}
                      </span>
                      <span className="truncate max-w-[90px]">{sTypeMeta?.name.split(' (')[0]}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary/60 border border-border text-xs font-bold text-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{CHART_TYPES_INFO[chartType]?.name}</span>
              </div>
            )}
          </div>

          {/* Canvas Direct Actions Toolbar */}
          <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border/80 text-xs">
            <button
              type="button"
              onClick={() => setChartScale(Math.min(2.0, Number((chartScale + 0.1).toFixed(1))))}
              className="p-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartScale(Math.max(0.4, Number((chartScale - 0.1).toFixed(1))))}
              className="p-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetCamera}
              className="p-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors flex items-center gap-1"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold font-mono">100%</span>
            </button>
            <div className="w-[1px] h-3.5 bg-border mx-0.5" />
            <button
              type="button"
              onClick={() => setShowSafeGuides(!showSafeGuides)}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold ${
                showSafeGuides ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-secondary text-muted-foreground'
              }`}
              title="Toggle Print Safe Margin Boundary"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guides</span>
            </button>
            <button
              type="button"
              onClick={toggleZenMode}
              className={`p-1.5 rounded-lg transition-colors text-[10px] font-bold flex items-center gap-1 ${
                isZenMode ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-muted-foreground'
              }`}
              title={isZenMode ? 'Exit Theater View' : 'Theater / Zen View'}
            >
              {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isZenMode ? 'Restore' : 'Zen'}</span>
            </button>
          </div>
        </div>

        {/* Live Canvas Area with Aspect-Ratio Frame */}
        <div 
          ref={stageWrapperRef} 
          className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden select-none"
        >
          {/* 3D Perspective Pitch, Translation & Rotation Transform Wrapper */}
          <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-150 ease-out overflow-hidden relative"
            style={{
              transform: `perspective(1200px) translate(${panX}%, ${panY}%) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <div
              style={{
                ...fittedStageStyle,
                padding: `${containerPadding}px`
              }}
              className={`relative transition-all duration-150 flex flex-col rounded-xl overflow-hidden ${
                showPanelBorders ? 'border border-border/80 shadow-md' : 'shadow-xs'
              } ${getBackdropClasses()}`}
            >
              {/* Safe Margin Guide Overlay */}
              {showSafeGuides && (
                <div className="absolute inset-2 border border-dashed border-sky-400/40 pointer-events-none z-30 flex items-start justify-end p-1">
                  <span className="text-[9px] font-mono text-sky-500/80 bg-sky-500/10 px-1 py-0.2 rounded">
                    Print Margin Safe ({aspectLabel})
                  </span>
                </div>
              )}

              {/* Main Figure Header Title */}
              {(showChartTitle || showChartSubtitle) && (
                <div className="p-3 text-center border-b border-border/40 shrink-0 select-text z-20">
                  {showChartTitle && (
                    <h2 
                      className="font-bold tracking-tight text-foreground"
                      style={{ fontSize: `${fontSize + 3}px` }}
                    >
                      {chartTitle || 'Systematic Review Synthesis'}
                    </h2>
                  )}
                  {showChartSubtitle && (
                    <p 
                      className="text-muted-foreground mt-0.5"
                      style={{ fontSize: `${Math.max(10, fontSize - 2)}px` }}
                    >
                      {chartSubtitle}
                    </p>
                  )}
                </div>
              )}

              {/* Composite Multi-Slot Canvas Body */}
              <div 
                className={`flex-1 min-h-0 relative ${getGridContainerClasses()}`}
                style={{ gap: `${panelGutter}px`, padding: `${panelGutter / 2}px` }}
              >
                {activeSlotsList.map((slotId, index) => {
                  const isSelected = activeSlot === slotId;
                  const slotMeta = SLOT_METADATA[slotId];
                  const slotCfg = slotsConfig[slotId] || currentSlotConfig;
                  const chartInfo = CHART_TYPES_INFO[slotCfg?.chartType || 'bar_vertical'];
                  const subfigureLabel = formatSubfigureLabel(index, subfigureLabelStyle);

                  return (
                    <div
                      key={slotId}
                      onClick={() => setActiveSlot(slotId)}
                      className={`relative flex flex-col flex-1 min-h-0 rounded-lg overflow-hidden transition-all group ${getSlotSpanClasses(slotId)} ${
                        showPanelBorders ? 'border border-border/60' : ''
                      } ${isSelected && layoutMode !== 'single' ? 'ring-2 ring-primary shadow-sm' : ''}`}
                    >
                      {/* Subfigure Letter Badge & Sub-title Header */}
                      {layoutMode !== 'single' && (
                        <div className="px-2.5 py-1 bg-secondary/30 border-b border-border/40 flex items-center justify-between z-10">
                          <div className="flex items-center gap-1.5">
                            {subfigureLabel && (
                              <span className="font-black text-xs text-primary px-1.5 py-0.2 rounded bg-primary/10 border border-primary/20">
                                {subfigureLabel}
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-foreground truncate max-w-[160px]">
                              {slotCfg?.subTitle || slotMeta.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {chartInfo?.name.split(' (')[0]}
                          </span>
                        </div>
                      )}

                      {/* ECharts Canvas Container */}
                      <div
                        ref={setSlotDomRef(slotId)}
                        className="w-full h-full flex-1 min-h-[140px]"
                        style={{
                          transform: `scale(${chartScale}) translate(${fitOffsetX ?? 0}px, ${fitOffsetY ?? 0}px)`,
                          transformOrigin: 'center center'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Floating Camera & Pan Overlay Control Pad */}
          <CameraControlsOverlay />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. INTEGRATED TABBED INSPECTOR DOCK                     */}
      {/* ======================================================== */}
      <div className={`w-full lg:w-[460px] xl:w-[500px] bg-card border-t lg:border-t-0 lg:border-l border-border flex flex-col shrink-0 overflow-hidden shadow-lg ${
        isZenMode ? 'hidden' : 'flex'
      }`}>
        
        {/* Inspector Navigation Tabs */}
        <div className="flex items-center border-b border-border bg-secondary/20 p-1 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`flex-1 min-w-[75px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              activeTab === 'data'
                ? 'bg-card text-primary border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`flex-1 min-w-[75px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              activeTab === 'chart'
                ? 'bg-card text-primary border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Layout</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`flex-1 min-w-[75px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              activeTab === 'params'
                ? 'bg-card text-primary border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Fine-Tune</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('style')}
            className={`flex-1 min-w-[75px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              activeTab === 'style'
                ? 'bg-card text-primary border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Style</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 min-w-[75px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
              activeTab === 'export'
                ? 'bg-card text-primary border border-border shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>

        {/* Tab Content Panel (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Slot Switcher if Composite Layout */}
          {layoutMode !== 'single' && (
            <SlotSwitcherBar showSubtitleEdit={true} />
          )}

          {/* ======================================================== */}
          {/* TAB 1: DATA & MAPPING                                    */}
          {/* ======================================================== */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              
              {/* Radar Multi-Variable / Boundary Paradox Mapping */}
              {chartType === 'radar' && <RadarDataMappingPanel />}

              {/* Line Chart Paradigm Switcher */}
              {chartType === 'line' && (
                <div className="space-y-3.5 p-3 bg-secondary/30 rounded-2xl border border-border/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">Line Chart Paradigm</span>
                      <span className="text-[10px] text-muted-foreground block">
                        {lineMode === 'epistemic_simulation'
                          ? 'Epistemic Simulation & Trajectory Model (Comparative Estimators)'
                          : 'Empirical Literature Cohort Trend (Synthesis Variables)'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLineMode('cohort_trend')}
                      className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border text-left ${
                        lineMode !== 'epistemic_simulation'
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-bold">Cohort Trend</div>
                      <div className="text-[10px] opacity-75">Empirical Synthesis</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineMode('epistemic_simulation')}
                      className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border text-left ${
                        lineMode === 'epistemic_simulation'
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-bold">Epistemic Simulation</div>
                      <div className="text-[10px] opacity-75">Uncertainty Trajectory</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Categorical Variable */}
              {((chartType === 'line' && lineMode !== 'epistemic_simulation') || ['bar_vertical', 'bar_horizontal', 'stacked_bar', 'clustered_bar', 'pie_donut', 'funnel', 'heatmap', 'graph', 'boxplot'].includes(chartType)) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Primary Variable / X-Axis Category:</span>
                    {primaryField === CUSTOM_GROUPING_KEY && (
                      <button
                        type="button"
                        onClick={() => setShowCustomGroupingModal(true)}
                        className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        Expand Modal
                      </button>
                    )}
                  </label>
                  <FieldAutocomplete
                    value={primaryField}
                    onChange={(newVal) => setPrimaryField(newVal)}
                    discoveredVariables={discoveredVariables}
                    availableFields={availableFields}
                  />
                </div>
              )}

              {/* Secondary Series / Grouping Variable */}
              {['stacked_bar', 'clustered_bar', 'heatmap', 'graph'].includes(chartType) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">
                      Secondary Variable / Series Dimension:
                    </label>
                    <div className="flex items-center gap-2">
                      {secondaryField === CUSTOM_GROUPING_KEY && (
                        <button
                          type="button"
                          onClick={() => setShowCustomGroupingModal(true)}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Expand Modal
                        </button>
                      )}
                      {secondaryField && secondaryField !== CUSTOM_GROUPING_KEY && (
                        <button
                          type="button"
                          onClick={() => setShowCrossTabModal(true)}
                          className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <Table className="w-3 h-3" />
                          View 2D Matrix
                        </button>
                      )}
                    </div>
                  </div>
                  <FieldAutocomplete
                    value={secondaryField}
                    onChange={(newVal) => setSecondaryField(newVal)}
                    discoveredVariables={discoveredVariables}
                    availableFields={availableFields}
                  />
                </div>
              )}

              {/* Inline Custom Grouping Configuration Card */}
              {(primaryField === CUSTOM_GROUPING_KEY || secondaryField === CUSTOM_GROUPING_KEY || sankeyFields.includes(CUSTOM_GROUPING_KEY)) && (
                <div className="pt-1">
                  <CustomGroupingManager />
                </div>
              )}

              {/* Multi-Level Hierarchy Builder (Sankey, Treemap, Sunburst) */}
              {['sankey', 'treemap', 'sunburst'].includes(chartType) && (
                <div className="space-y-2.5 p-3 bg-secondary/30 rounded-2xl border border-border/80">
                  {/* Header with Title & Level Operations */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        Multi-Level Hierarchy Rings / Depth
                      </label>
                      <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                        {sankeyFields.length} {sankeyFields.length === 1 ? 'Level' : 'Levels'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Remove Last Level Button */}
                      <button
                        type="button"
                        disabled={sankeyFields.length <= (chartType === 'sankey' ? 2 : 1)}
                        onClick={() => {
                          if (sankeyFields.length > (chartType === 'sankey' ? 2 : 1)) {
                            setSankeyFields(sankeyFields.slice(0, sankeyFields.length - 1));
                          }
                        }}
                        className="px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          sankeyFields.length <= (chartType === 'sankey' ? 2 : 1)
                            ? `Minimum ${chartType === 'sankey' ? '2 levels' : '1 level'} required for ${chartType}`
                            : 'Remove the outermost/last hierarchy level'
                        }
                      >
                        <Minus className="w-3 h-3" />
                        <span>Remove Level</span>
                      </button>

                      {/* Add Level Button */}
                      <button
                        type="button"
                        disabled={sankeyFields.length >= 8}
                        onClick={() => setSankeyFields([...sankeyFields, availableFields[0] || 'Year'])}
                        className="px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10px] font-bold flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Add an additional deeper hierarchy level / ring"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Level</span>
                      </button>
                    </div>
                  </div>

                  {/* 1-Click Auto-Expand 3-Tier Hierarchy Preset (if macro variables exist) */}
                  {availableFields.some((f: string) => f.startsWith('ext:macro:')) && (
                    <div className="flex items-center gap-1.5 bg-card/60 border border-amber-500/30 rounded-xl px-2.5 py-1.5 shadow-xs">
                      <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 shrink-0" />
                      <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                        ⚡ Quick 3-Tier:
                      </span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const k = e.target.value;
                            setSankeyFields([
                              `ext:macro:${k}`,
                              `ext:sub:${k}`,
                              `ext:leaf:${k}`
                            ]);
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 bg-secondary/60 border border-border rounded-lg px-2 py-0.5 text-[11px] font-bold text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="" disabled>Select Extracted Variable...</option>
                        {Array.from(new Set(
                          availableFields
                            .filter((f: string) => f.startsWith('ext:macro:'))
                            .map((f: string) => f.substring(10))
                        )).map((k: string) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Level Rows with Move Up, Move Down, and Dedicated Remove Button */}
                  <div className="space-y-1.5">
                    {sankeyFields.map((field, idx) => {
                      const minLevels = chartType === 'sankey' ? 2 : 1;
                      const canDelete = sankeyFields.length > minLevels;
                      const roleLabel = idx === 0 
                        ? (chartType === 'sankey' ? 'Source / Root' : 'Root Ring') 
                        : idx === sankeyFields.length - 1 
                        ? (chartType === 'sankey' ? 'Target / Leaf' : 'Outer Ring') 
                        : 'Sub-Category';

                      const availablePaths = levelColonPaths[idx] || { fullPaths: [], segments: [] };
                      const hasPaths = (availablePaths.fullPaths?.length || 0) > 0 || (availablePaths.segments?.length || 0) > 0;

                      return (
                        <div key={idx} className="space-y-1 bg-card/40 p-1.5 rounded-xl border border-border/60">
                          <div className="flex items-center gap-1.5">
                            {/* Level Badge */}
                            <span 
                              className="w-6 h-6 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-black shrink-0"
                              title={`Level ${idx + 1}: ${roleLabel}`}
                            >
                              L{idx + 1}
                            </span>

                            {/* Variable Autocomplete Combobox */}
                            <div className="flex-1 min-w-0">
                              <FieldAutocomplete
                                value={field}
                                onChange={(newVal) => {
                                  const next = [...sankeyFields];
                                  next[idx] = newVal;
                                  setSankeyFields(next);
                                  if (sankeyLevelPathFilters[idx]) {
                                    const nextFilters = { ...sankeyLevelPathFilters };
                                    delete nextFilters[idx];
                                    setSankeyLevelPathFilters(nextFilters);
                                  }
                                }}
                                discoveredVariables={discoveredVariables}
                                availableFields={availableFields}
                                size="sm"
                                showIntegrityWarning={false}
                              />
                            </div>

                            {/* Reorder Buttons: Move Up / Move Down */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  if (idx > 0) {
                                    const next = [...sankeyFields];
                                    const temp = next[idx - 1];
                                    next[idx - 1] = next[idx];
                                    next[idx] = temp;
                                    setSankeyFields(next);

                                    const nextFilters = { ...sankeyLevelPathFilters };
                                    const filterA = nextFilters[idx - 1];
                                    const filterB = nextFilters[idx];
                                    if (filterB) nextFilters[idx - 1] = filterB; else delete nextFilters[idx - 1];
                                    if (filterA) nextFilters[idx] = filterA; else delete nextFilters[idx];
                                    setSankeyLevelPathFilters(nextFilters);
                                  }
                                }}
                                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Move level up (towards root/inner ring)"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === sankeyFields.length - 1}
                                onClick={() => {
                                  if (idx < sankeyFields.length - 1) {
                                    const next = [...sankeyFields];
                                    const temp = next[idx + 1];
                                    next[idx + 1] = next[idx];
                                    next[idx] = temp;
                                    setSankeyFields(next);

                                    const nextFilters = { ...sankeyLevelPathFilters };
                                    const filterA = nextFilters[idx];
                                    const filterB = nextFilters[idx + 1];
                                    if (filterB) nextFilters[idx] = filterB; else delete nextFilters[idx];
                                    if (filterA) nextFilters[idx + 1] = filterA; else delete nextFilters[idx + 1];
                                    setSankeyLevelPathFilters(nextFilters);
                                  }
                                }}
                                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Move level down (towards outer ring/leaf)"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Dedicated Remove Button */}
                            <button
                              type="button"
                              disabled={!canDelete}
                              onClick={() => {
                                if (canDelete) {
                                  setSankeyFields(sankeyFields.filter((_, i) => i !== idx));
                                  const nextFilters = { ...sankeyLevelPathFilters };
                                  delete nextFilters[idx];
                                  setSankeyLevelPathFilters(nextFilters);
                                }
                              }}
                              className={`p-1 rounded-md transition-colors shrink-0 ${
                                canDelete
                                  ? 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                                  : 'opacity-30 cursor-not-allowed text-muted-foreground'
                              }`}
                              title={
                                canDelete
                                  ? `Remove Level ${idx + 1} (${formatFieldLabel(field)})`
                                  : `Cannot remove: minimum ${minLevels} level(s) required for ${chartType}`
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Optional Colon-Separated Path Filter Selector */}
                          {hasPaths && (
                            <div className="flex items-center gap-1.5 pt-1 border-t border-border/40 pl-7 text-[10.5px]">
                              <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0">
                                <Filter className="w-3 h-3 text-primary/70" />
                                <span>Filter Path:</span>
                              </span>
                              <select
                                value={sankeyLevelPathFilters[idx] || ''}
                                onChange={(e) => {
                                  const nextFilters = { ...sankeyLevelPathFilters };
                                  if (e.target.value) {
                                    nextFilters[idx] = e.target.value;
                                  } else {
                                    delete nextFilters[idx];
                                  }
                                  setSankeyLevelPathFilters(nextFilters);
                                }}
                                className="flex-1 bg-secondary/40 border border-border/70 rounded px-2 py-0.5 text-[10.5px] font-bold text-foreground focus:outline-none focus:border-primary truncate"
                              >
                                <option value="">All Paths (Full Hierarchy Tree)</option>
                                {availablePaths.segments && availablePaths.segments.length > 0 && (
                                  <optgroup label="🌟 Cross-Parent Segments (Includes All Parents)">
                                    {availablePaths.segments.map(seg => (
                                      <option key={`seg:${seg}`} value={`* : ${seg}`}>
                                        Segment: {seg} (All Parents)
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {availablePaths.fullPaths && availablePaths.fullPaths.length > 0 && (
                                  <optgroup label="🌳 Specific Hierarchy Branches">
                                    {availablePaths.fullPaths.map(p => (
                                      <option key={`path:${p}`} value={p}>
                                        Branch: {p}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                              {sankeyLevelPathFilters[idx] && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextFilters = { ...sankeyLevelPathFilters };
                                    delete nextFilters[idx];
                                    setSankeyLevelPathFilters(nextFilters);
                                  }}
                                  className="text-[10px] text-primary hover:underline font-bold shrink-0 ml-1"
                                  title="Clear path filter"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bubble Chart 2D Categorical Cross-Tabulation Matrix & Continuous 3D Mapping */}
              {chartType === 'bubble' && (
                <div className="space-y-3.5 p-3 bg-secondary/30 rounded-2xl border border-border/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">Bubble Chart Paradigm</span>
                      <span className="text-[10px] text-muted-foreground block">
                        {bubbleMode === 'categorical_matrix'
                          ? '2D Categorical Matrix (Standard SLR)'
                          : 'Continuous 3D Scatter (Numerical X × Y × Size)'}
                      </span>
                    </div>
                    <select
                      value={bubbleMode || 'categorical_matrix'}
                      onChange={(e) => setBubbleMode(e.target.value as any)}
                      className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="categorical_matrix">2D Categorical Matrix (Standard SLR)</option>
                      <option value="numerical_3d">Continuous 3D Scatter</option>
                    </select>
                  </div>

                  {bubbleMode === 'categorical_matrix' ? (
                    <div className="space-y-3 pt-2 border-t border-border/60">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center justify-between">
                          <span>Primary Dimension / X-Axis Category (e.g. Hardware Tier):</span>
                          {primaryField === CUSTOM_GROUPING_KEY && (
                            <button
                              type="button"
                              onClick={() => setShowCustomGroupingModal(true)}
                              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              Edit Custom Groups
                            </button>
                          )}
                        </label>
                        <FieldAutocomplete
                          value={primaryField}
                          onChange={(newVal) => setPrimaryField(newVal)}
                          discoveredVariables={discoveredVariables}
                          availableFields={availableFields}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-foreground">
                            Secondary Dimension / Y-Axis Category (e.g. Autonomy Spectrum):
                          </label>
                          {secondaryField && (
                            <button
                              type="button"
                              onClick={() => setShowCrossTabModal(true)}
                              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <Table className="w-3 h-3" />
                              View 2D Matrix
                            </button>
                          )}
                        </div>
                        <FieldAutocomplete
                          value={secondaryField}
                          onChange={(newVal) => setSecondaryField(newVal)}
                          discoveredVariables={discoveredVariables}
                          availableFields={availableFields}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-foreground block">X-Axis Continuous Field</label>
                        <select
                          value={numFieldX}
                          onChange={(e) => setNumFieldX(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                        >
                          {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-foreground block">Y-Axis Continuous Field</label>
                        <select
                          value={numFieldY}
                          onChange={(e) => setNumFieldY(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                        >
                          {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-foreground block">Bubble Size Dimension</label>
                        <select
                          value={numFieldSize}
                          onChange={(e) => setNumFieldSize(e.target.value)}
                          className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                        >
                          {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Numerical Fields for Scatter / Boxplot */}
              {['scatter', 'boxplot'].includes(chartType) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-2xl border border-border/80">
                  {chartType !== 'boxplot' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-foreground block">X-Axis Continuous Field</label>
                      <select
                        value={numFieldX}
                        onChange={(e) => setNumFieldX(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                      >
                        {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">
                      {chartType === 'boxplot' ? 'Continuous Numerical Metric' : 'Y-Axis Continuous Field'}
                    </label>
                    <select
                      value={numFieldY}
                      onChange={(e) => setNumFieldY(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                    >
                      {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Scientific Metric Calculation Mode */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <label className="text-xs font-bold text-foreground block">
                  Scientific Metric & Quota Calculation:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetricMode('paper_prevalence')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      metricMode === 'paper_prevalence'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-card border-border hover:bg-secondary/40 text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold block">Unique Paper Prevalence %</span>
                    <span className="text-[10px] text-muted-foreground block font-mono">n / N_cohort (Capped)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetricMode('tag_share')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      metricMode === 'tag_share'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-card border-border hover:bg-secondary/40 text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold block">Tag Share Distribution %</span>
                    <span className="text-[10px] text-muted-foreground block font-mono">k / TotalTags (Sums 100%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetricMode('count')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      metricMode === 'count'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-card border-border hover:bg-secondary/40 text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold block">Raw Absolute Study Count (N)</span>
                    <span className="text-[10px] text-muted-foreground block font-mono">Direct frequency</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetricMode('avg_qa')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      metricMode === 'avg_qa'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-card border-border hover:bg-secondary/40 text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold block">Average QA Quality Score</span>
                    <span className="text-[10px] text-muted-foreground block font-mono">Continuous mean</span>
                  </button>
                </div>
              </div>

              {/* Data Extraction & Normalization Controls */}
              <div className="space-y-2 p-3 bg-secondary/30 rounded-2xl border border-border/80">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Extraction Protocols & Normalization
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useUmbrellanizer}
                      onChange={(e) => setUseUmbrellanizer(e.target.checked)}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span className="font-semibold text-foreground">Apply Taxonomy Normalizer</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={splitMultiValues}
                      onChange={(e) => setSplitMultiValues(e.target.checked)}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span className="font-semibold text-foreground">Split Multi-Value Tags</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeEmpty}
                      onChange={(e) => setExcludeEmpty(e.target.checked)}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span className="font-semibold text-foreground">Exclude Empty / Null</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={limitCategories}
                      onChange={(e) => setLimitCategories(e.target.checked)}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span className="font-semibold text-foreground">Limit Top N Categories</span>
                  </label>
                </div>

                {limitCategories && (
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Max Items</label>
                      <input
                        type="number"
                        min={3}
                        max={30}
                        value={maxCategoriesCount}
                        onChange={(e) => setMaxCategoriesCount(Number(e.target.value))}
                        className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Tail Group Style</label>
                      <select
                        value={tailLabelStyle}
                        onChange={(e) => setTailLabelStyle(e.target.value as any)}
                        className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                      >
                        <option value="comma_list">Item Names List</option>
                        <option value="other_count">Other (N items)</option>
                        <option value="plain_other">Plain "Other"</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Real Data Breakdown Inspector Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowBreakdownTable(!showBreakdownTable)}
                  className="w-full p-2.5 rounded-xl border border-border bg-card hover:bg-secondary/60 text-foreground font-bold text-xs flex items-center justify-between transition-colors shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-primary" />
                    {showBreakdownTable ? 'Hide Cohort Statistical Breakdown' : 'Inspect Cohort Statistical Breakdown'}
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showBreakdownTable ? 'rotate-90' : ''}`} />
                </button>

                {showBreakdownTable && (
                  <div className="mt-2">
                    <BreakdownTablePanel />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CHART TYPE & LAYOUT                               */}
          {/* ======================================================== */}
          {activeTab === 'chart' && (
            <div className="space-y-5">
              
              {/* Figure Layout Template Selector */}
              <LayoutTemplateSelector />

              {/* Chart Format Filter Pills */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Scientific Visualization Format (18 Charts)
                </label>
                
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'categorical', label: 'Categorical' },
                    { id: 'hierarchical', label: 'Hierarchical' },
                    { id: 'trend', label: 'Trend' },
                    { id: 'correlation', label: 'Correlation' },
                    { id: 'matrix_flow', label: 'Flow & Matrix' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setChartCategoryFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        chartCategoryFilter === tab.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Chart Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto p-1">
                  {filteredChartTypes.map(([id, info]) => {
                    const isSelected = chartType === id;
                    const IconComp = info.icon;

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setChartType(id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]'
                            : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <div>
                          <span className={`text-xs font-bold block leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {info.name.split(' (')[0]}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                            {info.category}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CHART FINE-TUNING (Context-Aware)                  */}
          {/* ======================================================== */}
          {activeTab === 'params' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  {CHART_TYPES_INFO[chartType]?.name} Parameters
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">Live Updated</span>
              </div>

              {/* Dynamic Chart Customization Panels */}
              {chartType === 'bar_vertical' && <VerticalBarConfigPanel />}
              {chartType === 'bar_horizontal' && <HorizontalBarConfigPanel />}
              {chartType === 'clustered_bar' && <ClusteredBarConfigPanel />}
              {chartType === 'stacked_bar' && <StackedBarConfigPanel />}
              {chartType === 'line' && <LineConfigPanel />}
              {chartType === 'pie_donut' && <PieDonutConfigPanel />}
              {chartType === 'sankey' && <SankeyConfigPanel />}
              {chartType === 'sunburst' && <SunburstLevelConfigPanel />}
              {chartType === 'treemap' && <TreemapConfigPanel />}
              {chartType === 'heatmap' && <HeatmapConfigPanel />}
              {chartType === 'radar' && <RadarConfigPanel />}
              {chartType === 'funnel' && <FunnelConfigPanel />}
              {chartType === 'boxplot' && <BoxplotConfigPanel />}
              {chartType === 'scatter' && <ScatterConfigPanel />}
              {chartType === 'bubble' && <BubbleConfigPanel />}
              {chartType === 'graph' && <GraphConfigPanel />}
              {chartType === 'gauge' && <GaugeConfigPanel />}
              {chartType === 'calendar' && <CalendarConfigPanel />}

              {/* Axis Parameters for Cartesian Charts */}
              {['bar_vertical', 'bar_horizontal', 'clustered_bar', 'stacked_bar', 'line', 'scatter', 'bubble', 'boxplot'].includes(chartType) && (
                <div className="pt-3 border-t border-border/60">
                  <ScientificAxisConfigPanel />
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: STYLE & PEER REVIEWER PRECISION                   */}
          {/* ======================================================== */}
          {activeTab === 'style' && (
            <div className="space-y-5">
              
              {/* Figure Title & Subtitle */}
              <div className="space-y-2.5 p-3 bg-secondary/30 rounded-2xl border border-border/80">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Figure Title & Header
                </span>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Main Title</label>
                      <input
                        type="checkbox"
                        checked={showChartTitle}
                        onChange={(e) => setShowChartTitle(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-primary"
                      />
                    </div>
                    <input
                      type="text"
                      value={chartTitle}
                      onChange={(e) => setChartTitle(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Subtitle / Caption</label>
                      <input
                        type="checkbox"
                        checked={showChartSubtitle}
                        onChange={(e) => setShowChartSubtitle(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-primary"
                      />
                    </div>
                    <input
                      type="text"
                      value={chartSubtitle}
                      onChange={(e) => setChartSubtitle(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Academic Palette Presets */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Academic Color Palette (16 Presets)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-1">
                  {(Object.entries(THEME_PALETTES) as [ThemePreset, typeof THEME_PALETTES[ThemePreset]][]).map(([id, p]) => {
                    const isSelected = themePreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setThemePreset(id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                            : 'bg-card border-border hover:bg-secondary/40 text-foreground'
                        }`}
                      >
                        <span className="text-xs font-bold block truncate">{p.name}</span>
                        <div className="flex items-center gap-1 mt-1.5">
                          {p.colors.slice(0, 5).map((c, i) => (
                            <span key={i} className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Typography & Fonts */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Font Family</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([id, f]) => (
                      <option key={id} value={id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Base Font Size ({fontSize}px)</label>
                  <input
                    type="range"
                    min={10}
                    max={18}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Peer Reviewer Statistical Granularity */}
              <div className="space-y-2.5 p-3 bg-secondary/30 rounded-2xl border border-border/80">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Peer Reviewer Precision & Ratio Formatting
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-foreground">Decimal Precision</label>
                    <select
                      value={decimalPrecision ?? 0}
                      onChange={(e) => setDecimalPrecision(Number(e.target.value) as any)}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                    >
                      <option value={0}>0 Decimals (e.g. ~33%)</option>
                      <option value={1}>1 Decimal (e.g. 33.3%)</option>
                      <option value={2}>2 Decimals (e.g. 33.33%)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-foreground">Ratio Style</label>
                    <select
                      value={ratioStyle ?? 'n_over_N'}
                      onChange={(e) => setRatioStyle(e.target.value as any)}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="n_over_N">n = x/N</option>
                      <option value="fraction">x/N</option>
                      <option value="bracketed">[x/N]</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useTildeForCoarse ?? true}
                      onChange={(e) => setUseTildeForCoarse(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-primary"
                    />
                    <span className="font-semibold text-foreground">Tilde ~ for Coarse Pct</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceCohortDenominator ?? false}
                      onChange={(e) => setForceCohortDenominator(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-primary"
                    />
                    <span className="font-semibold text-foreground">Cohort Denominator Lock</span>
                  </label>
                </div>
              </div>

              {/* Legend & Subfigure Formatting */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Legend Position</label>
                  <select
                    value={legendPosition}
                    onChange={(e) => setLegendPosition(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="top">Top Horizontal</option>
                    <option value="bottom">Bottom Horizontal</option>
                    <option value="left">Left Vertical</option>
                    <option value="right">Right Vertical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Subfigure Letter Style</label>
                  <select
                    value={subfigureLabelStyle}
                    onChange={(e) => setSubfigureLabelStyle(e.target.value as any)}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="paren_lower">(a), (b), (c)</option>
                    <option value="paren_upper">(A), (B), (C)</option>
                    <option value="bold_upper">A., B., C.</option>
                    <option value="fig_prefix">Fig. 1a, Fig. 1b</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: EXPORT & PROOFING                                 */}
          {/* ======================================================== */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <ExportPanel />
            </div>
          )}
        </div>
      </div>

      {/* Sub-Modals: Custom Grouping & 2D Matrix */}
      {showCustomGroupingModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6"
          onClick={() => setShowCustomGroupingModal(false)}
        >
          <div 
            className="w-full max-w-4xl max-h-[85vh] bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Custom Grouping Layer Manager
              </h4>
              <button
                type="button"
                onClick={() => setShowCustomGroupingModal(false)}
                className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-bold text-foreground transition-all"
              >
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1">
              <CustomGroupingManager />
            </div>
          </div>
        </div>
      )}

      {showCrossTabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl max-h-[85vh] bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Table className="w-4 h-4 text-primary" />
                2D Cross-Tabulation Matrix
              </h4>
              <button
                type="button"
                onClick={() => setShowCrossTabModal(false)}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CrossTabMatrixPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
