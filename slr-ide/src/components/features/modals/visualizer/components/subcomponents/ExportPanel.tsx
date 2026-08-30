import React, { useRef } from 'react';
import { 
  Download, 
  Compass, 
  Eye, 
  RotateCcw, 
  FileText, 
  ArrowLeft,
  Image as ImageIcon,
  Sun,
  Moon,
  Grid,
  Square,
  PanelRightClose,
  Maximize,
  Target,
  Zap,
  Crosshair,
  FileCode,
  Save,
  Upload
} from 'lucide-react';
import { SLOT_METADATA } from '../../constants/layoutPresets';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { resolveTargetDimensions } from '../../utils/exportUtils';
import type { CanvasBackdrop, AspectRatioPreset, DimensionUnit, FittingAnchor } from '../../types';

export function ExportPanel() {
  const { layout, config, style, camera, canvas, workspace, presets } = useVisualizerContext();
  const { handleExportPreset, handleImportPreset } = presets;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { layoutMode, activeSlot, activeSlotsList } = layout;
  const { slotsConfig, setCurrentStep } = config;
  const {
    aspectRatio,
    setAspectRatio,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    dimensionUnit,
    setDimensionUnit
  } = style;
  const {
    chartScale,
    setChartScale,
    panX,
    setPanX,
    panY,
    setPanY,
    tiltAngle,
    setTiltAngle,
    rotationAngle,
    setRotationAngle,
    isCameraOverlayHidden,
    setIsCameraOverlayHidden,
    setIsCameraOverlayMinimized,
    handleResetCamera,
    fitOffsetX,
    setFitOffsetX,
    fitOffsetY,
    setFitOffsetY,
    containerPadding,
    setContainerPadding,
    showSafeGuides,
    setShowSafeGuides,
    fittingAnchor,
    setFittingAnchor,
    handleAutoFit,
    handleResetFitting
  } = camera;

  const {
    exportFormat,
    setExportFormat,
    exportScale,
    setExportScale,
    handleExportChart,
    handleExportActiveSlot
  } = canvas;

  const {
    isZenMode,
    toggleZenMode,
    canvasBackdrop,
    setCanvasBackdrop
  } = workspace;

  const activeSlotMeta = SLOT_METADATA[activeSlot];
  const activeSlotCfg = slotsConfig[activeSlot];
  const activeSlotChartType = activeSlotCfg?.chartType || 'bar_vertical';
  const activeSlotChartName = CHART_TYPES_INFO[activeSlotChartType]?.name || 'Chart';

  const backdropOptions: { id: CanvasBackdrop; label: string; icon: any }[] = [
    { id: 'slate', label: 'Default', icon: Square },
    { id: 'white', label: 'Paper', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'checkerboard', label: 'Pattern', icon: Grid }
  ];

  const { targetWidth, targetHeight } = resolveTargetDimensions(
    aspectRatio,
    customWidth,
    customHeight,
    dimensionUnit,
    1200
  );

  const totalExportWidth = Math.round(targetWidth * exportScale);
  const totalExportHeight = Math.round(targetHeight * exportScale);
  const printWidthMm = ((totalExportWidth / 300) * 25.4).toFixed(1);
  const printHeightMm = ((totalExportHeight / 300) * 25.4).toFixed(1);

  const anchorGrid: { id: FittingAnchor; label: string; title: string }[] = [
    { id: 'top-left', label: '↖', title: 'Top-Left Anchor' },
    { id: 'top', label: '↑', title: 'Top Anchor' },
    { id: 'top-right', label: '↗', title: 'Top-Right Anchor' },
    { id: 'left', label: '←', title: 'Left Anchor' },
    { id: 'center', label: '•', title: 'Center Anchor' },
    { id: 'right', label: '→', title: 'Right Anchor' },
    { id: 'bottom-left', label: '↙', title: 'Bottom-Left Anchor' },
    { id: 'bottom', label: '↓', title: 'Bottom Anchor' },
    { id: 'bottom-right', label: '↘', title: 'Bottom-Right Anchor' },
  ];

  return (
    <div className="w-full flex flex-col p-4 sm:p-5 space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            Publication Export
          </h4>
          <p className="text-[10px] text-muted-foreground">
            Scopus Q1 / IEEE / Elsevier print proofing.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleZenMode}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
          title="Collapse export panel (Shortcut: Z)"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {/* 1. Journal Column Width & Aspect Ratio Preset Selector */}
      <div className="space-y-2 p-3.5 bg-card border border-border rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Maximize className="w-3.5 h-3.5 text-primary" /> Journal Aspect Ratio
          </label>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary font-bold rounded">
            {aspectRatio.toUpperCase()}
          </span>
        </div>

        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as AspectRatioPreset)}
          className="w-full bg-secondary/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold cursor-pointer"
        >
          <option value="16:9">Double Column (16:9 / ~190 mm Full Width)</option>
          <option value="16:10">1.5 Column (16:10 / ~140 mm Academic)</option>
          <option value="4:3">Single Column (4:3 / ~90 mm Standard)</option>
          <option value="3:2">Academic Standard (3:2 / ~140 mm)</option>
          <option value="1:1">Square Panel (1:1 / ~90 mm)</option>
          <option value="21:9">Ultra-Wide Panorama (21:9)</option>
          <option value="custom">Custom Physical Dimensions...</option>
        </select>

        {aspectRatio === 'custom' && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground">Width</label>
              <input
                type="number"
                min={10}
                max={5000}
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                className="w-full bg-secondary/30 border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground">Height</label>
              <input
                type="number"
                min={10}
                max={5000}
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                className="w-full bg-secondary/30 border border-border rounded px-2 py-1 text-xs text-foreground font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground">Unit</label>
              <select
                value={dimensionUnit}
                onChange={(e) => setDimensionUnit(e.target.value as DimensionUnit)}
                className="w-full bg-secondary/30 border border-border rounded px-2 py-1 text-xs text-foreground font-bold"
              >
                <option value="mm">mm</option>
                <option value="in">in</option>
                <option value="px">px</option>
              </select>
            </div>
          </div>
        )}

        {/* Live Print Dimension Calculator Badge */}
        <div className="p-2 rounded-lg bg-secondary/30 border border-border/40 text-[10.5px] space-y-0.5 font-mono text-muted-foreground">
          <div className="flex justify-between">
            <span>Pixel Resolution:</span>
            <strong className="text-foreground">{totalExportWidth} × {totalExportHeight} px</strong>
          </div>
          <div className="flex justify-between">
            <span>Print Size (300 DPI):</span>
            <strong className="text-primary">{printWidthMm} × {printHeightMm} mm</strong>
          </div>
        </div>
      </div>

      {/* 2. Chart Fitting Point & Safe Framing Controls */}
      <div className="space-y-3 p-3.5 bg-card border border-border rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-primary" /> Chart Fitting & Placement
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleAutoFit({
                chartType: activeSlotCfg?.chartType,
                hasLegend: activeSlotCfg?.showLegend,
                legendPos: activeSlotCfg?.sunburstLegendPosition || activeSlotCfg?.barLegendPosition
              })}
              className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5"
              title="Automatically fit chart into container safe zone"
            >
              <Zap className="w-3 h-3" /> Auto
            </button>
            <button
              type="button"
              onClick={handleResetFitting}
              className="text-[10px] text-muted-foreground hover:text-foreground font-bold flex items-center gap-0.5 ml-1"
              title="Reset fitting point and margins to center default"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 9-Point Interactive Anchor Target Pad */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-semibold text-muted-foreground">Focal Anchor Point</span>
            <span className="font-mono text-primary font-bold text-[10px] uppercase">
              {fittingAnchor}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-secondary/40 p-1.5 rounded-lg border border-border/40">
            {anchorGrid.map((anc) => {
              const isSelected = fittingAnchor === anc.id;
              return (
                <button
                  key={anc.id}
                  type="button"
                  onClick={() => setFittingAnchor(anc.id)}
                  className={`py-1 rounded text-xs font-mono font-bold transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm scale-[1.05]'
                      : 'bg-card hover:bg-secondary text-foreground hover:text-primary border border-border/40'
                  }`}
                  title={anc.title}
                >
                  {anc.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Precision Fine-Tuning Fitting Sliders */}
        <div className="space-y-2 text-xs pt-1 border-t border-border/40">
          <div>
            <div className="flex justify-between font-semibold text-foreground mb-1 text-[11px]">
              <span>Fitting Offset X ({fitOffsetX > 0 ? `+${fitOffsetX}` : fitOffsetX}%)</span>
            </div>
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
              value={fitOffsetX}
              onChange={(e) => setFitOffsetX(Number(e.target.value))}
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between font-semibold text-foreground mb-1 text-[11px]">
              <span>Fitting Offset Y ({fitOffsetY > 0 ? `+${fitOffsetY}` : fitOffsetY}%)</span>
            </div>
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
              value={fitOffsetY}
              onChange={(e) => setFitOffsetY(Number(e.target.value))}
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between font-semibold text-foreground mb-1 text-[11px]">
              <span>Safe Margin Inset ({containerPadding} px)</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={2}
              value={containerPadding}
              onChange={(e) => setContainerPadding(Number(e.target.value))}
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between font-semibold text-foreground mb-1 text-[11px]">
              <span>Chart Scale (Zoom {Math.round(chartScale > 10 ? chartScale : chartScale * 100)}%)</span>
            </div>
            <input
              type="range"
              min={0.4}
              max={1.8}
              step={0.05}
              value={chartScale > 10 ? chartScale / 100 : (chartScale || 1.0)}
              onChange={(e) => setChartScale(Number(e.target.value))}
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3. Stage Backdrop & Print Safe Guides */}
      <div className="space-y-2 p-3 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground block">Preview Backdrop Theme</label>
          <button
            type="button"
            onClick={() => setShowSafeGuides(!showSafeGuides)}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 transition-all ${
              showSafeGuides 
                ? 'bg-primary/20 text-primary border-primary/40' 
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
            title="Toggle print safe zone guides"
          >
            <Crosshair className="w-2.5 h-2.5" />
            <span>Guides: {showSafeGuides ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {backdropOptions.map(opt => {
            const Icon = opt.icon;
            const isSel = canvasBackdrop === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCanvasBackdrop(opt.id)}
                className={`py-1.5 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                  isSel
                    ? 'bg-primary/10 border-primary text-primary shadow-sm'
                    : 'bg-secondary/40 border-border hover:bg-secondary text-muted-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. View & Camera Controls (Pan, Tilt, Scale & Rotation) */}
      <div className="space-y-3 p-3.5 bg-card border border-border rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-primary" /> 3D Viewport & Pitch
          </span>
          <div className="flex items-center gap-2">
            {isCameraOverlayHidden && (
              <button
                type="button"
                onClick={() => { setIsCameraOverlayHidden(false); setIsCameraOverlayMinimized(false); }}
                className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
                title="Unhide canvas camera pad"
              >
                <Eye className="w-3 h-3" /> Show Pad
              </button>
            )}
            <button
              type="button"
              onClick={handleResetCamera}
              className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1"
              title="Reset Zoom and Rotation to Default"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <div className="flex justify-between font-semibold text-foreground mb-1 text-[11px]">
              <span>3D Tilt Angle ({tiltAngle}°)</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={tiltAngle}
              onChange={(e) => setTiltAngle(Number(e.target.value))}
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between font-semibold text-foreground mb-1 text-[11px]">
              <span>Rotation Angle ({rotationAngle}°)</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={rotationAngle}
              onChange={(e) => setRotationAngle(Number(e.target.value))}
              className="w-full accent-primary h-1.5 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 5. Customization State & Preset Storage (.json) */}
      <div className="space-y-2.5 p-3.5 bg-card border border-border rounded-xl shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-primary" />
              Preset & Customization State (.json)
            </span>
            <p className="text-[10px] text-muted-foreground">
              Save or load your complete visualizer settings, fine-tuning, and layout directly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleExportPreset}
            className="py-2.5 px-3 bg-secondary/70 hover:bg-secondary text-foreground hover:text-primary border border-border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.98]"
            title="Export visualizer customizations and layout as a reusable .json preset file"
          >
            <Save className="w-3.5 h-3.5 text-primary" />
            <span>Export .JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-3 bg-secondary/70 hover:bg-secondary text-foreground hover:text-primary border border-border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.98]"
            title="Import and apply a previously saved .json preset file"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span>Import .JSON</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportPreset}
            className="hidden"
          />
        </div>
      </div>

      {/* 6. Export Format & DPI Resolution */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-foreground block">Figure Output Format</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setExportFormat('png')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                exportFormat === 'png'
                  ? 'bg-primary/10 border-primary text-primary shadow-sm'
                  : 'bg-card border-border hover:bg-secondary/40 text-foreground'
              }`}
            >
              <div>PNG</div>
              <div className="text-[9px] font-normal text-muted-foreground mt-0.5">Raster 300+ DPI</div>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('svg')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                exportFormat === 'svg'
                  ? 'bg-primary/10 border-primary text-primary shadow-sm'
                  : 'bg-card border-border hover:bg-secondary/40 text-foreground'
              }`}
            >
              <div>SVG</div>
              <div className="text-[9px] font-normal text-muted-foreground mt-0.5">Vector LaTeX</div>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('pdf')}
              className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                exportFormat === 'pdf'
                  ? 'bg-primary/10 border-primary text-primary shadow-sm'
                  : 'bg-card border-border hover:bg-secondary/40 text-foreground'
              }`}
            >
              <div>PDF</div>
              <div className="text-[9px] font-normal text-muted-foreground mt-0.5">Vector Journal</div>
            </button>
          </div>
        </div>

        {exportFormat === 'png' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">Resolution (DPI Multiplier)</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setExportScale(s)}
                  className={`py-2 rounded-xl border font-extrabold text-xs transition-colors ${
                    exportScale === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-foreground'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              3x / 4x produces 300+ to 600 DPI print-quality assets for Scopus Q1 journals.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          {/* Main Full Figure Button */}
          <button
            type="button"
            onClick={handleExportChart}
            className="w-full py-3 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            {layoutMode === 'single'
              ? `Download Figure (${exportFormat.toUpperCase()})`
              : `Download Full Composite (${activeSlotsList.length} Panels)`}
          </button>

          {/* Subfigure Single Slot Export Button */}
          {layoutMode !== 'single' && (
            <button
              type="button"
              onClick={handleExportActiveSlot}
              className="w-full py-2.5 bg-card hover:bg-secondary text-foreground border border-border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              title={`Download only ${activeSlotMeta.name} (${activeSlotChartName})`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-primary" />
              Download {activeSlotMeta.name} Only
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-card border border-border rounded-xl space-y-2 text-xs text-foreground mt-auto">
        <span className="font-bold text-primary flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          Manuscript Vector Citation
        </span>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Exported vector SVG graphics can be directly embedded into LaTeX documents (<code className="text-primary font-mono text-[9px]">\includesvg</code>) or losslessly edited in Adobe Illustrator.
        </p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className="w-full py-2 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-border"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customize
        </button>
      </div>
    </div>
  );
}
