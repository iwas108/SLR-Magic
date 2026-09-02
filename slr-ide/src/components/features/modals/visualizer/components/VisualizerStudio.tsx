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
  Filter,
  Target
} from 'lucide-react';
import { CHART_TYPES_INFO } from '../constants/chartTypes';
import { THEME_PALETTES } from '../constants/themePalettes';
import { FONT_FAMILIES, resolveFontFamilyCss } from '../constants/fontFamilies';
import { formatSubfigureLabel, SLOT_METADATA } from '../constants/layoutPresets';
import { resolveTargetDimensions } from '../utils/exportUtils';
import { CUSTOM_GROUPING_KEY } from '../constants/defaultConfigs';
import { extractColonPrefixPaths } from '../utils/dataExtractor';
import { useVisualizerContext } from '../context/VisualizerContext';
import { SlotSwitcherBar } from './subcomponents/SlotSwitcherBar';
import { StudioDataTab } from './subcomponents/StudioDataTab';
import { StudioChartTypeTab } from './subcomponents/StudioChartTypeTab';
import { UniversalFineTunePanel } from './subcomponents/UniversalFineTunePanel';
import { CustomGroupingModal } from './subcomponents/CustomGroupingModal';
import { CrossTabMatrixPanel } from './subcomponents/CrossTabMatrixPanel';
import { ExportPanel } from './subcomponents/ExportPanel';
import { CameraControlsOverlay } from './subcomponents/CameraControlsOverlay';
import type { ChartType, ThemePreset, FontFamily, SlotId, MetricMode, DisplayFormatTemplate } from '../types';

type StudioTab = 'data' | 'chart' | 'style' | 'export';

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
    otherCategoryLabel,
    setOtherCategoryLabel,
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
    titleFontSize,
    titleFontWeight,
    titleFontStyle,
    titleColor,
    titleAlign,
    subtitleFontSize,
    subtitleFontWeight,
    subtitleFontStyle,
    subtitleColor,
    subtitleLineHeight,
    titleGap,
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
    isCameraOverlayHidden,
    setIsCameraOverlayHidden,
    setIsCameraOverlayMinimized,
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
  const [customGroupingSlotIndex, setCustomGroupingSlotIndex] = useState<number | undefined>(undefined);
  const [showCrossTabModal, setShowCrossTabModal] = useState<boolean>(false);

  // Live Canvas Stage Ref
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  // Update live stage dimensions on resize
  useEffect(() => {
    if (!stageWrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setStageDimensions({
            width: Math.floor(entry.contentRect.width),
            height: Math.floor(entry.contentRect.height)
          });
        }
      }
    });
    observer.observe(stageWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute paper target dimensions
  const { targetWidth, targetHeight } = useMemo(() => {
    return resolveTargetDimensions(
      aspectRatio,
      customWidth,
      customHeight,
      dimensionUnit,
      1200
    );
  }, [aspectRatio, customWidth, customHeight, dimensionUnit]);

  // Responsive Auto-Fit Scale: guarantees figure canvas fits stage viewport with comfortable breathing room
  const autoFitScale = useMemo(() => {
    if (stageDimensions.width <= 0 || stageDimensions.height <= 0 || targetWidth <= 0 || targetHeight <= 0) return 1.0;
    const scaleX = (stageDimensions.width - 48) / targetWidth;
    const scaleY = (stageDimensions.height - 48) / targetHeight;
    return Math.min(scaleX, scaleY, 1.0);
  }, [stageDimensions.width, stageDimensions.height, targetWidth, targetHeight]);

  const effectiveScale = Number((autoFitScale * chartScale).toFixed(3));

  // Layout Grid CSS classes
  const gridLayoutClass = useMemo(() => {
    switch (layoutMode) {
      case 'single':
        return 'grid-cols-1 grid-rows-1';
      case 'dual_horizontal':
        return 'grid-cols-2 grid-rows-1';
      case 'dual_vertical':
        return 'grid-cols-1 grid-rows-2';
      case 'tri_top_two_bottom':
        return 'grid-cols-2 grid-rows-2';
      case 'quad_grid':
        return 'grid-cols-2 grid-rows-2';
      default:
        return 'grid-cols-1 grid-rows-1';
    }
  }, [layoutMode]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden w-full h-full bg-background select-none">
      
      {/* LEFT / CENTER: LIVE CANVAS STAGE */}
      <div className={`flex-1 flex flex-col overflow-hidden relative ${isZenMode ? 'w-full' : ''}`}>
        
        {/* Canvas Toolbar Header */}
        <div className="h-10 px-4 border-b border-border bg-card/60 backdrop-blur-xs flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">
              {CHART_TYPES_INFO[chartType]?.name || 'Scientific Visualization Studio'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setChartScale(Math.max(0.4, Number((chartScale - 0.1).toFixed(1))))}
              className="p-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors"
              title="Zoom Out (Ctrl -)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold text-muted-foreground w-10 text-center font-mono">
              {Math.round(chartScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setChartScale(Math.min(2.5, Number((chartScale + 0.1).toFixed(1))))}
              className="p-1.5 rounded-lg hover:bg-secondary text-foreground transition-colors"
              title="Zoom In (Ctrl +)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
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
              onClick={() => {
                if (isCameraOverlayHidden) {
                  setIsCameraOverlayHidden(false);
                  setIsCameraOverlayMinimized(false);
                } else {
                  setIsCameraOverlayHidden(true);
                }
              }}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold ${
                !isCameraOverlayHidden ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-secondary text-muted-foreground'
              }`}
              title="Toggle Chart Fitting & Placement Pad"
            >
              <Target className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fitting</span>
            </button>
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
          style={{
            backgroundColor: canvasBackdrop === 'white' 
              ? '#ffffff' 
              : canvasBackdrop === 'slate' 
                ? '#1e293b' 
                : '#0b0f19'
          }}
        >
          {/* Virtual Camera Pan/Zoom Scaler */}
          <div
            style={{
              transform: `translate(${panX + fitOffsetX}px, ${panY + fitOffsetY}px) scale(${effectiveScale}) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.05s ease-out'
            }}
            className="flex items-center justify-center p-4 relative"
          >
            {/* Visual Figure Canvas Frame */}
            <div
              id="slr-multi-figure-stage"
              style={{
                width: `${targetWidth}px`,
                height: `${targetHeight}px`,
                padding: `${containerPadding}px`,
                backgroundColor: '#ffffff',
                boxShadow: '0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.08)'
              }}
              className="relative rounded-lg flex flex-col justify-between overflow-hidden"
            >
              {/* Optional Figure Title & Subtitle */}
              {showChartTitle && chartTitle && (
                <div 
                  className="pb-3 pt-1 shrink-0 px-4"
                  style={{
                    textAlign: titleAlign
                  }}
                >
                  <h3 
                    className="tracking-tight leading-tight"
                    style={{ 
                      fontFamily: resolveFontFamilyCss(fontFamily),
                      fontSize: `${titleFontSize}px`,
                      fontWeight: titleFontWeight,
                      fontStyle: titleFontStyle,
                      color: titleColor || '#171717'
                    }}
                  >
                    {chartTitle}
                  </h3>
                  {showChartSubtitle && chartSubtitle && (
                    <p 
                      className="tracking-normal"
                      style={{ 
                        fontFamily: resolveFontFamilyCss(fontFamily),
                        fontSize: `${subtitleFontSize}px`,
                        fontWeight: subtitleFontWeight,
                        fontStyle: subtitleFontStyle,
                        color: subtitleColor || '#737373',
                        lineHeight: `${subtitleLineHeight}px`,
                        marginTop: `${titleGap}px`
                      }}
                    >
                      {chartSubtitle}
                    </p>
                  )}
                </div>
              )}

              {/* Sub-Slot Grid Layout */}
              <div 
                className={`flex-1 w-full h-full grid ${gridLayoutClass}`}
                style={{ gap: `${panelGutter}px` }}
              >
                {activeSlotsList.map((slotId, idx) => {
                  const isSingleLayout = layoutMode === 'single' || activeSlotsList.length <= 1;
                  const subfigureLabel = !isSingleLayout ? formatSubfigureLabel(idx, subfigureLabelStyle, isSingleLayout) : '';
                  const isInspected = inspectedSlot === slotId;
                  const isTopHero = layoutMode === 'tri_top_two_bottom' && slotId === 'slot_a';

                  return (
                    <div
                      key={slotId}
                      style={{
                        gridColumn: isTopHero ? '1 / 3' : undefined,
                        gridRow: isTopHero ? '1 / 2' : undefined,
                        border: showPanelBorders && !isSingleLayout ? '1px dashed #e2e8f0' : undefined
                      }}
                      onClick={() => setActiveSlot(slotId)}
                      className={`relative w-full h-full rounded-md flex flex-col overflow-hidden transition-all ${
                        activeSlot === slotId && !isSingleLayout ? 'ring-2 ring-primary ring-offset-1' : ''
                      }`}
                    >
                      {/* Subfigure Letter Identifier */}
                      {!isSingleLayout && subfigureLabel && (
                        <div className="absolute top-1 left-2 z-10 font-bold text-xs text-neutral-800 bg-white/80 backdrop-blur-xs px-1.5 py-0.5 rounded shadow-xs">
                          {subfigureLabel}
                        </div>
                      )}

                      {/* ECharts Canvas Mount Point */}
                      <div
                        ref={setSlotDomRef(slotId)}
                        className="w-full h-full flex-1"
                        style={{ minHeight: '120px' }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Print Safe Margin Guides */}
              {showSafeGuides && (
                <div 
                  className="absolute inset-0 pointer-events-none border-2 border-dashed border-red-400/40 m-4 rounded"
                  title="Print Safe Boundary"
                />
              )}
            </div>
          </div>

          {/* Camera Fitting Pad Overlay */}
          <CameraControlsOverlay />
        </div>
      </div>

      {/* RIGHT: CONFIGURATION & CUSTOMIZATION SIDEBAR */}
      {!isZenMode && (
        <div className="w-full lg:w-[460px] xl:w-[500px] h-auto lg:h-full border-t lg:border-t-0 lg:border-l border-border bg-card flex flex-col z-20 shrink-0 overflow-hidden">
          
          {/* Top Tab Switcher (4 Streamlined Workflow Steps) */}
          <div className="flex items-center justify-between border-b border-border bg-secondary/30 p-1.5 shrink-0 overflow-x-auto">
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
              onClick={() => setActiveTab('style')}
              className={`flex-1 min-w-[95px] py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                activeTab === 'style'
                  ? 'bg-card text-primary border border-border shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Style & Fine-Tune</span>
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

            {/* TAB 1: DATA & MAPPING */}
            {activeTab === 'data' && (
              <StudioDataTab 
                onOpenCustomGroupingModal={(slotIdx) => {
                  setCustomGroupingSlotIndex(slotIdx);
                  setShowCustomGroupingModal(true);
                }}
                onOpenCrossTabModal={() => setShowCrossTabModal(true)}
              />
            )}

            {/* TAB 2: CHART TYPE & LAYOUT */}
            {activeTab === 'chart' && (
              <StudioChartTypeTab 
                chartCategoryFilter={chartCategoryFilter}
                setChartCategoryFilter={setChartCategoryFilter}
              />
            )}

            {/* TAB 3: UNIFIED STYLE & FINE-TUNE */}
            {activeTab === 'style' && (
              <UniversalFineTunePanel />
            )}

            {/* TAB 4: EXPORT & PROOFING */}
            {activeTab === 'export' && (
              <ExportPanel />
            )}
          </div>
        </div>
      )}

      {/* Sub-Modal 1: Universal Custom Grouping & Thematic Stratification */}
      <CustomGroupingModal 
        isOpen={showCustomGroupingModal}
        onClose={() => setShowCustomGroupingModal(false)}
        targetSlotIndex={customGroupingSlotIndex}
      />

      {/* Sub-Modal 2: 2D Cross-Tabulation Matrix */}
      {showCrossTabModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setShowCrossTabModal(false)}
        >
          <div 
            className="w-full max-w-4xl max-h-[85vh] bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
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
