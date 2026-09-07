import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { Layout, Maximize2, Crosshair, Sparkles, Grid, Layers, ShieldCheck } from 'lucide-react';
import type { AspectRatioPreset, DimensionUnit, SubfigureLabelStyle } from '../../types';

export function UniversalLayoutMarginPanel() {
  const { config, style, camera, layout } = useVisualizerContext();
  const { layoutMode } = layout;

  const {
    gridMarginAuto = true,
    setGridMarginAuto,
    gridMarginTop = 45,
    setGridMarginTop,
    gridMarginBottom = 45,
    setGridMarginBottom,
    gridMarginLeft = 60,
    setGridMarginLeft,
    gridMarginRight = 45,
    setGridMarginRight
  } = config;

  const {
    panelGutter,
    setPanelGutter,
    showPanelBorders,
    setShowPanelBorders,
    subfigureLabelStyle,
    setSubfigureLabelStyle,
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
    containerPadding,
    setContainerPadding,
    showSafeGuides,
    setShowSafeGuides
  } = camera;

  // Preset clearance shortcuts
  const applyMarginPreset = (preset: 'compact' | 'standard' | 'generous' | 'wide_title') => {
    setGridMarginAuto(false);
    if (preset === 'compact') {
      setGridMarginTop(30);
      setGridMarginBottom(35);
      setGridMarginLeft(45);
      setGridMarginRight(25);
    } else if (preset === 'standard') {
      setGridMarginTop(50);
      setGridMarginBottom(50);
      setGridMarginLeft(65);
      setGridMarginRight(45);
    } else if (preset === 'generous') {
      setGridMarginTop(70);
      setGridMarginBottom(70);
      setGridMarginLeft(90);
      setGridMarginRight(65);
    } else if (preset === 'wide_title') {
      setGridMarginTop(95);
      setGridMarginBottom(55);
      setGridMarginLeft(75);
      setGridMarginRight(45);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Quick Clearance Presets */}
      <div className="p-3 bg-card border border-border rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Margin & Clearance Presets:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setGridMarginAuto(true)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${gridMarginAuto
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-secondary hover:bg-secondary/80 text-muted-foreground border-border'
              }`}
          >
            Auto Smart Fit
          </button>
          <button
            type="button"
            onClick={() => applyMarginPreset('compact')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Compact (IEEE)
          </button>
          <button
            type="button"
            onClick={() => applyMarginPreset('standard')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Standard (ACM)
          </button>
          <button
            type="button"
            onClick={() => applyMarginPreset('generous')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Generous (Nature)
          </button>
        </div>
      </div>

      {/* 2. Universal Chart Margins & Coordinate Clearance */}
      <div className="p-3.5 bg-card border border-border rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layout className="w-3.5 h-3.5 text-primary" />
            Universal Chart Margins
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
              gridMarginAuto ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {gridMarginAuto ? 'Auto Fit' : 'Custom'}
            </span>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={gridMarginAuto}
                onChange={(e) => setGridMarginAuto(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary"
              />
              <span>Auto Layout</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-foreground">Top ({gridMarginTop}px)</label>
            </div>
            <input
              type="range"
              min={0}
              max={250}
              value={gridMarginTop}
              onChange={(e) => {
                if (gridMarginAuto) setGridMarginAuto(false);
                setGridMarginTop(Number(e.target.value));
              }}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-foreground">Bottom ({gridMarginBottom}px)</label>
            </div>
            <input
              type="range"
              min={0}
              max={250}
              value={gridMarginBottom}
              onChange={(e) => {
                if (gridMarginAuto) setGridMarginAuto(false);
                setGridMarginBottom(Number(e.target.value));
              }}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-foreground">Left ({gridMarginLeft}px)</label>
            </div>
            <input
              type="range"
              min={0}
              max={350}
              value={gridMarginLeft}
              onChange={(e) => {
                if (gridMarginAuto) setGridMarginAuto(false);
                setGridMarginLeft(Number(e.target.value));
              }}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-foreground">Right ({gridMarginRight}px)</label>
            </div>
            <input
              type="range"
              min={0}
              max={300}
              value={gridMarginRight}
              onChange={(e) => {
                if (gridMarginAuto) setGridMarginAuto(false);
                setGridMarginRight(Number(e.target.value));
              }}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      {/* 3. Outer Stage Padding & Print Safe Boundary */}
      <div className="p-3.5 bg-card border border-border rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Container Frame & Safe Guides
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">Padding: {containerPadding}px</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Outer Canvas Padding</label>
              <span className="text-[10px] font-mono text-primary">{containerPadding}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={80}
              value={containerPadding}
              onChange={(e) => setContainerPadding(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-xl border border-border/60">
            <div>
              <span className="text-xs font-bold text-foreground block">Print-Safe Margin Guides</span>
              <span className="text-[10px] text-muted-foreground block">Display boundary overlay on stage</span>
            </div>
            <input
              type="checkbox"
              checked={showSafeGuides}
              onChange={(e) => setShowSafeGuides(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary"
            />
          </div>
        </div>
      </div>

      {/* 4. Multi-Figure Composite Panel Layout (if multi-slot active) */}
      {layoutMode !== 'single' && (
        <div className="p-3.5 bg-card border border-border rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              Composite Panel Spacing
            </span>
            <span className="text-[10px] font-mono text-primary font-bold">Multi-Panel Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Panel Gutter</label>
                <span className="text-[10px] font-mono text-primary">{panelGutter}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={48}
                value={panelGutter}
                onChange={(e) => setPanelGutter(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Subfigure Identifier Style</label>
              <select
                value={subfigureLabelStyle}
                onChange={(e) => setSubfigureLabelStyle(e.target.value as SubfigureLabelStyle)}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
              >
                <option value="paren_lower">(a), (b), (c), (d)</option>
                <option value="paren_upper">(A), (B), (C), (D)</option>
                <option value="bold_upper">A, B, C, D</option>
                <option value="fig_prefix">Fig. 1a, Fig. 1b</option>
                <option value="none">None (Clean)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-secondary/40 rounded-xl border border-border/60">
              <div>
                <span className="text-xs font-bold text-foreground block">Panel Borders</span>
                <span className="text-[10px] text-muted-foreground block">Dashed separator lines</span>
              </div>
              <input
                type="checkbox"
                checked={showPanelBorders}
                onChange={(e) => setShowPanelBorders(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Figure Target Aspect Ratio & Sizing */}
      <div className="p-3.5 bg-card border border-border rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-primary" />
            Publication Aspect Ratio & Dimensions
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">{aspectRatio}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['16:9', '16:10', '4:3', '3:2', '1:1', '21:9', 'custom'] as AspectRatioPreset[]).map((ar) => (
            <button
              key={ar}
              type="button"
              onClick={() => setAspectRatio(ar)}
              className={`p-2 rounded-xl border text-center transition-all ${aspectRatio === ar
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs ring-1 ring-primary/20'
                : 'bg-secondary/40 border-border hover:bg-secondary text-foreground text-xs font-semibold'
                }`}
            >
              <span>{ar === 'custom' ? 'Custom Size' : ar}</span>
            </button>
          ))}
        </div>

        {aspectRatio === 'custom' && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Width</label>
              <input
                type="number"
                min={100}
                max={4000}
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Height</label>
              <input
                type="number"
                min={100}
                max={4000}
                value={customHeight}
                onChange={(e) => setCustomHeight(Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Unit</label>
              <select
                value={dimensionUnit}
                onChange={(e) => setDimensionUnit(e.target.value as DimensionUnit)}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
              >
                <option value="px">Pixels (px)</option>
                <option value="mm">Millimeters (mm)</option>
                <option value="in">Inches (in)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
