import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Settings2, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  ArrowLeft, 
  PanelRightOpen,
  Maximize,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Square,
  Crosshair
} from 'lucide-react';
import { CHART_TYPES_INFO } from '../constants/chartTypes';
import { formatSubfigureLabel, SLOT_METADATA } from '../constants/layoutPresets';
import { resolveTargetDimensions } from '../utils/exportUtils';
import { useVisualizerContext } from '../context/VisualizerContext';
import { CameraControlsOverlay } from './subcomponents/CameraControlsOverlay';
import { ExportPanel } from './subcomponents/ExportPanel';
import type { SlotId } from '../types';

export function Step4PreviewStage() {
  const { props, layout, config, style, camera, canvas, workspace } = useVisualizerContext();
  const { papers, totalUnfilteredCount, isFiltered } = props;
  const { layoutMode, activeSlotsList, activeSlot, setActiveSlot } = layout;
  const { slotsConfig, setCurrentStep } = config;
  const {
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
    dimensionUnit
  } = style;
  const {
    chartScale,
    panX,
    panY,
    tiltAngle,
    rotationAngle,
    containerPadding,
    showSafeGuides,
    setShowSafeGuides
  } = camera;
  const { setSlotDomRef, chartInstancesRef } = canvas;
  const {
    isZenMode,
    toggleZenMode,
    canvasBackdrop,
    inspectedSlot,
    setInspectedSlot
  } = workspace;

  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 800, height: 500 });

  // Measure stage container via ResizeObserver to dynamically compute exact container-contained aspect-ratio box
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
      // Trigger ECharts resize
      activeSlotsList.forEach((slotId) => {
        chartInstancesRef.current[slotId]?.resize();
      });
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [activeSlotsList, chartInstancesRef]);

  // Trigger resize across all active ECharts instances when inspectedSlot, zen mode, or aspect ratio changes
  useEffect(() => {
    const timer = setTimeout(() => {
      activeSlotsList.forEach((slotId) => {
        chartInstancesRef.current[slotId]?.resize();
      });
    }, 60);

    return () => clearTimeout(timer);
  }, [inspectedSlot, isZenMode, aspectRatio, customWidth, customHeight, containerPadding, activeSlotsList, chartInstancesRef]);

  // Resolve target publication aspect ratio geometry
  const { targetWidth, targetHeight, aspectLabel } = resolveTargetDimensions(
    aspectRatio,
    customWidth,
    customHeight,
    dimensionUnit,
    1200
  );

  const targetRatio = targetWidth / targetHeight;

  // Compute mathematically exact Stage Frame Dimensions that fit 100% inside container without distortion or clipping
  const fittedStageStyle = useMemo(() => {
    if (inspectedSlot) {
      return { width: '100%', height: '100%' };
    }

    const padH = 36;
    const padV = 36;
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

  // Helper to resolve CSS grid classes based on layout mode
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

  // Helper for canvas background styling
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

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Main Canvas Stage View */}
      <div className="flex-1 bg-background flex flex-col p-6 overflow-hidden relative">
        
        {isFiltered && (
          <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2.5 shrink-0 shadow-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
            <span className="font-semibold text-[11px]">
              Warning: Visualizing filtered cohort dataset ({papers.length} of {totalUnfilteredCount || papers.length} total papers).
            </span>
          </div>
        )}

        {/* Top Bar Controls */}
        <div className="h-12 border-b border-border bg-card/60 rounded-t-2xl px-4 flex items-center justify-between shrink-0 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              {inspectedSlot ? (
                <span className="text-primary font-black">
                  Inspecting {SLOT_METADATA[inspectedSlot].name} ({CHART_TYPES_INFO[slotsConfig[inspectedSlot]?.chartType || 'bar_vertical']?.name})
                </span>
              ) : layoutMode === 'single' ? (
                'Single Publication Figure'
              ) : (
                `Composite Multi-Panel Figure (${activeSlotsList.length} Panels)`
              )}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({papers.length} source records)
            </span>
            {!inspectedSlot && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border" title={aspectLabel}>
                <Maximize className="w-2.5 h-2.5 text-primary" /> Frame: {aspectRatio.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Quick Chart Size / Zoom Controls */}
            <div className="flex items-center bg-secondary/80 border border-border/80 rounded-lg p-0.5 shadow-sm text-xs font-bold" title="Resize chart (zoom in / zoom out)">
              <button
                type="button"
                onClick={camera.handleZoomOut}
                className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
                title="Make chart smaller (Zoom Out: -10%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-mono font-black text-primary select-none">
                {Math.round((chartScale > 10 ? chartScale : chartScale * 100))}%
              </span>
              <button
                type="button"
                onClick={camera.handleZoomIn}
                className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
                title="Make chart larger (Zoom In: +10%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {chartScale !== 1.0 && (
                <button
                  type="button"
                  onClick={camera.handleResetCamera}
                  className="p-1 rounded hover:bg-card text-muted-foreground hover:text-primary transition-colors ml-0.5 border-l border-border/60"
                  title="Reset chart size to 100%"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Print Safe Guides Toggle */}
            <button
              type="button"
              onClick={() => setShowSafeGuides(!showSafeGuides)}
              className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${
                showSafeGuides 
                  ? 'bg-primary/20 text-primary border-primary/50 ring-1 ring-primary/40' 
                  : 'bg-secondary text-muted-foreground hover:text-foreground border-border'
              }`}
              title="Toggle printable safe margins boundary guides"
            >
              <Crosshair className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline">Safe Guides</span>
            </button>

            {!inspectedSlot && (
              <button
                type="button"
                onClick={() => {
                  camera.handleAutoFit({
                    chartType: slotsConfig.slot_a?.chartType,
                    hasLegend: slotsConfig.slot_a?.showLegend,
                    legendPos: slotsConfig.slot_a?.sunburstLegendPosition || slotsConfig.slot_a?.barLegendPosition
                  });
                  config.autoOptimizeAllSlots(papers, props.umbrellanizerMap);
                }}
                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Automatically fit chart into container and optimize parameters based on cohort dataset"
              >
                <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
                Smart Auto-Fit
              </button>
            )}

            {inspectedSlot ? (
              <button
                type="button"
                onClick={() => setInspectedSlot(null)}
                className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Return to composite grid layout (Shortcut: Esc)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Composite Grid
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-3 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-border transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Tweak Styles & Layout
              </button>
            )}

            {isZenMode && (
              <button
                type="button"
                onClick={toggleZenMode}
                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Open export and camera sidebar (Shortcut: Z)"
              >
                <PanelRightOpen className="w-3.5 h-3.5" />
                Show Export Panel
              </button>
            )}
          </div>
        </div>

        {/* Multi-Panel Stage Canvas Container with 3D and Strict Aspect Ratio Geometry */}
        <div 
          ref={stageWrapperRef}
          className={`flex-1 border border-border rounded-2xl p-4 shadow-sm relative overflow-hidden flex items-center justify-center transition-colors duration-200 ${getBackdropClasses()}`}
        >
          {/* 3D Transform Wrapper Container */}
          <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-150 ease-out overflow-hidden relative"
            style={{
              transform: `perspective(1200px) translate(${panX}%, ${panY}%) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg)`,
              transformOrigin: 'center center'
            }}
          >
            {/* Unified Mathematically Exact Aspect-Ratio Synchronized Stage Frame */}
            <div 
              className={`transition-all duration-200 flex flex-col rounded-xl border border-border/80 relative shadow-sm ${getBackdropClasses()}`}
              style={{
                ...fittedStageStyle,
                padding: `${containerPadding}px`
              }}
            >
              {/* Optional Print Safe Area Dashed Guideline Overlay */}
              {showSafeGuides && (
                <div 
                  className="absolute inset-2 border-2 border-dashed border-primary/40 rounded-lg pointer-events-none z-10 select-none flex flex-col justify-between p-1.5"
                  title="Print Safe Area (5mm Margin Inset)"
                >
                  <div className="flex justify-between text-[9px] font-mono font-bold text-primary/70">
                    <span>┌ Print Safe Margin ({containerPadding}px)</span>
                    <span>{aspectLabel} ┐</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono font-bold text-primary/70">
                    <span>└ W: {targetWidth}px</span>
                    <span>H: {targetHeight}px ┘</span>
                  </div>
                </div>
              )}

              {/* Main Figure Header (inside the aspect ratio frame) */}
              {!inspectedSlot && (showChartTitle || showChartSubtitle) && (
                <div className="w-full text-center pb-2 mb-2 border-b border-border/40 shrink-0 select-none">
                  {showChartTitle && chartTitle && (
                    <h4 className="text-sm md:text-base font-bold leading-tight">{chartTitle}</h4>
                  )}
                  {showChartSubtitle && chartSubtitle && (
                    <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{chartSubtitle}</p>
                  )}
                </div>
              )}

              {/* Multi-Panel Grid Container */}
              <div 
                className={`flex-1 w-full h-full ${inspectedSlot ? 'w-full h-full' : getGridContainerClasses()}`}
                style={{
                  gap: inspectedSlot ? '0px' : `${panelGutter}px`
                }}
              >
                {activeSlotsList.map((slotId, index) => {
                  const isInspected = inspectedSlot === slotId;
                  const isHidden = inspectedSlot !== null && !isInspected;
                  const slotCfg = slotsConfig[slotId];
                  const chartType = slotCfg?.chartType || 'bar_vertical';
                  const chartInfo = CHART_TYPES_INFO[chartType];
                  const meta = SLOT_METADATA[slotId];
                  const IconComp = chartInfo.icon;
                  const isFocused = activeSlot === slotId;
                  const subLabel = formatSubfigureLabel(index, subfigureLabelStyle);
                  const panelCaption = slotCfg?.subTitle ? `${subLabel ? `${subLabel} ` : ''}${slotCfg.subTitle}` : (subLabel || meta.name);

                  return (
                    <div
                      key={slotId}
                      onClick={() => !inspectedSlot && setActiveSlot(slotId)}
                      className={`${isHidden ? 'hidden' : 'flex'} flex-col rounded-xl overflow-hidden cursor-pointer transition-all ${
                        (isInspected || layoutMode === 'single')
                          ? 'w-full h-full flex-1 min-h-0' 
                          : getSlotSpanClasses(slotId)
                      } ${
                        showPanelBorders && !isInspected && layoutMode !== 'single' ? 'border border-border/80 bg-secondary/10' : !isInspected ? 'bg-transparent' : ''
                      } ${
                        isFocused && layoutMode !== 'single' && !isInspected ? 'ring-2 ring-primary/40 shadow-sm' : ''
                      }`}
                    >
                      {/* Subfigure Header Badge */}
                      {isInspected ? (
                        <div className="h-8 px-4 bg-secondary/40 border-b border-border flex items-center justify-between shrink-0 select-none">
                          <span className="text-xs font-bold text-primary flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-black text-[10px]">
                              {meta.name}
                            </span>
                            {slotCfg?.subTitle || chartInfo.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedSlot(null);
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-bold"
                          >
                            <Minimize2 className="w-3.5 h-3.5" /> Exit Zoom
                          </button>
                        </div>
                      ) : layoutMode !== 'single' ? (
                        <div className="h-7 px-3 bg-secondary/40 border-b border-border/40 flex items-center justify-between shrink-0 select-none">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {subLabel || meta.letter}
                            </span>
                            <span className="text-xs font-bold text-foreground truncate" title={panelCaption}>
                              {panelCaption}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] text-muted-foreground flex items-center gap-1 shrink-0 font-medium">
                              <IconComp className="w-3 h-3 text-primary" />
                              {chartInfo.name}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedSlot(slotId);
                              }}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                              title={`Inspect ${meta.name} in full resolution`}
                            >
                              <Maximize2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* Chart Div Ref Container */}
                      <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex items-center justify-center">
                        <div
                          ref={setSlotDomRef(slotId)}
                          className="w-full h-full min-h-0 transition-transform duration-150 ease-out"
                          style={{
                            transform: `scale(${chartScale > 10 ? chartScale / 100 : (chartScale || 1.0)})`,
                            transformOrigin: 'center center'
                          }}
                        />
                      </div>
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

      {/* Scientific Export Sidebar (Collapsible in Zen Mode) */}
      {!isZenMode && (
        <div className="w-full lg:w-[380px] xl:w-[420px] bg-secondary/10 flex flex-col shrink-0 overflow-hidden border-l border-border">
          <ExportPanel />
        </div>
      )}
    </div>
  );
}
