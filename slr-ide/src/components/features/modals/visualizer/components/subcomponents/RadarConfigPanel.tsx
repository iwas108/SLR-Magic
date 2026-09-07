import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { THEME_PALETTES } from '../../constants/themePalettes';
import {
  Compass,
  Sparkles,
  Layers,
  CircleDot,
  Type,
  Palette,
  Ruler,
  RotateCcw,
  Sliders,
  Eye,
  Activity
} from 'lucide-react';

export function RadarConfigPanel() {
  const { config, camera, style } = useVisualizerContext();
  const palette = THEME_PALETTES[style.themePreset] || THEME_PALETTES.ieee_blue;
  const { fitOffsetY = 0, setFitOffsetY, fitOffsetX = 0, setFitOffsetX } = camera;

  const {
    showLegend = true,
    setShowLegend,
    legendPosition = 'bottom',
    setLegendPosition,
    legendDistance = 15,
    setLegendDistance,
    legendItemGap = 12,
    setLegendItemGap,
    radarMode = 'multi_variable',
    setRadarMode,
    radarShape = 'polygon',
    setRadarShape,
    radarStartAngle = 90,
    setRadarStartAngle,
    radarRadius = 65,
    setRadarRadius,
    radarCenterX,
    setRadarCenterX,
    radarCenterY,
    setRadarCenterY,
    radarAreaOpacity = 28,
    setRadarAreaOpacity,
    radarLineWidth = 2.5,
    setRadarLineWidth,
    radarSplitNumber = 5,
    setRadarSplitNumber,
    radarAxisLine = true,
    setRadarAxisLine,
    radarAxisLineWidth = 1,
    setRadarAxisLineWidth,
    radarAxisLineType = 'solid',
    setRadarAxisLineType,
    radarAxisLineColor = '',
    setRadarAxisLineColor,
    radarAxisLineOpacity = 100,
    setRadarAxisLineOpacity,
    radarSplitLine = true,
    setRadarSplitLine,
    radarSplitLineWidth = 1,
    setRadarSplitLineWidth,
    radarSplitLineType = 'solid',
    setRadarSplitLineType,
    radarSplitLineColor = '',
    setRadarSplitLineColor,
    radarSplitLineOpacity = 100,
    setRadarSplitLineOpacity,
    radarSplitArea = true,
    setRadarSplitArea,
    radarSplitAreaTheme = 'stepped',
    setRadarSplitAreaTheme,
    radarSplitAreaOpacity = 100,
    setRadarSplitAreaOpacity,
    radarSplitAreaColor1 = '',
    setRadarSplitAreaColor1,
    radarSplitAreaColor2 = '',
    setRadarSplitAreaColor2,
    radarShowAxisScaleLabels = false,
    setRadarShowAxisScaleLabels,
    radarAxisScaleFormat = 'percent',
    setRadarAxisScaleFormat,
    radarAxisScaleFontSize = 10,
    setRadarAxisScaleFontSize,
    radarAxisScaleFontWeight = 'normal',
    setRadarAxisScaleFontWeight,
    radarAxisScaleColor = '',
    setRadarAxisScaleColor,
    radarScaleMax,
    setRadarScaleMax,
    radarScaleMin,
    setRadarScaleMin,
    radarShowAxisTicks = false,
    setRadarShowAxisTicks,
    radarAxisNameMargin = 15,
    setRadarAxisNameMargin,
    radarAxisNameWidth = 120,
    setRadarAxisNameWidth,
    radarAxisNameOverflow = 'break',
    setRadarAxisNameOverflow,
    radarAxisNameLineHeight = 14,
    setRadarAxisNameLineHeight,
    radarAxisNameFontSize,
    setRadarAxisNameFontSize,
    radarAxisNameFontWeight = 'bold',
    setRadarAxisNameFontWeight,
    radarAxisNameFontStyle = 'normal',
    setRadarAxisNameFontStyle,
    radarAxisNameColor = '',
    setRadarAxisNameColor,
    radarAxisNameBgColor = '',
    setRadarAxisNameBgColor,
    radarAxisNamePadding = 4,
    setRadarAxisNamePadding,
    radarAxisNameBorderRadius = 4,
    setRadarAxisNameBorderRadius,
    radarAxisNameBorderColor = '',
    setRadarAxisNameBorderColor,
    radarAxisNameBorderWidth = 1,
    setRadarAxisNameBorderWidth,
    radarShowDataLabels = false,
    setRadarShowDataLabels,
    radarDataLabelPosition = 'top',
    setRadarDataLabelPosition,
    radarDataLabelFontSize = 10,
    setRadarDataLabelFontSize,
    radarDataLabelFontWeight = 'bold',
    setRadarDataLabelFontWeight,
    radarDataLabelColor = '',
    setRadarDataLabelColor,
    radarDataLabelFormat = 'percent',
    setRadarDataLabelFormat,
    radarSmooth = false,
    setRadarSmooth,
    radarBaselineLineStyle = 'solid',
    setRadarBaselineLineStyle,
    radarBaselineSymbol = 'circle',
    setRadarBaselineSymbol,
    radarBaselineSymbolSize = 6,
    setRadarBaselineSymbolSize,
    radarBaselineAreaColor = '',
    setRadarBaselineAreaColor,
    radarBaselineSymbolBorderColor = '',
    setRadarBaselineSymbolBorderColor,
    radarBaselineSymbolBorderWidth = 0,
    setRadarBaselineSymbolBorderWidth,
    radarIndicatorFormat = 'two_line',
    setRadarIndicatorFormat,
    radarShowTarget = true,
    setRadarShowTarget,
    radarTargetLineStyle = 'dashed',
    setRadarTargetLineStyle,
    radarTargetLineWidth = 2,
    setRadarTargetLineWidth,
    radarTargetColor = '#d9534f',
    setRadarTargetColor,
    radarTargetAreaOpacity = 8,
    setRadarTargetAreaOpacity,
    radarTargetSymbol = 'circle',
    setRadarTargetSymbol,
    radarTargetSymbolSize = 4,
    setRadarTargetSymbolSize,
    radarTargetSmooth = false,
    setRadarTargetSmooth,
    radarBaselineColor = '#1b5e20',
    setRadarBaselineColor,
    radarTagShareColor = '#c62828',
    setRadarTagShareColor,
    radarTagShareLineStyle = 'dashed',
    setRadarTagShareLineStyle,
    radarTagShareLineWidth = 2,
    setRadarTagShareLineWidth,
    radarTagShareAreaOpacity = 12,
    setRadarTagShareAreaOpacity,
    radarTagShareSymbol = 'rect',
    setRadarTagShareSymbol,
    radarTagShareSymbolSize = 5,
    setRadarTagShareSymbolSize,
    radarTagShareSmooth = false,
    setRadarTagShareSmooth
  } = config;

  const isPrevalenceVsTagShare = radarMode === 'prevalence_vs_tag_share';

  // --- 1-CLICK ACADEMIC PRESET APPLIERS ---
  const applyIeeePublicationPreset = () => {
    setRadarShape('polygon');
    setRadarSplitNumber(5);
    setRadarSplitArea(true);
    setRadarSplitAreaTheme('stepped');
    setRadarSplitAreaOpacity(100);
    setRadarAxisLine(true);
    setRadarAxisLineWidth(1);
    setRadarAxisLineType('solid');
    setRadarAxisLineColor('');
    setRadarSplitLine(true);
    setRadarSplitLineWidth(1);
    setRadarSplitLineType('solid');
    setRadarSplitLineColor('');
    setRadarLineWidth(2.5);
    setRadarBaselineLineStyle('solid');
    setRadarAreaOpacity(28);
    setRadarBaselineSymbol('circle');
    setRadarBaselineSymbolSize(6);
    setRadarSmooth(false);
    setRadarTargetSmooth(false);
    setRadarTagShareSmooth(false);
    setRadarShowAxisScaleLabels(true);
    setRadarAxisScaleFormat('percent');
    setRadarAxisScaleFontSize(10);
    setRadarShowAxisTicks(true);
    setRadarShowDataLabels(false);
    setRadarAxisNameBgColor('');
    setRadarRadius(65);
    setRadarStartAngle(90);
  };

  const applySpiderWebMinimalistPreset = () => {
    setRadarShape('polygon');
    setRadarSplitNumber(4);
    setRadarSplitArea(false);
    setRadarSplitAreaTheme('none');
    setRadarAxisLine(true);
    setRadarAxisLineWidth(0.8);
    setRadarAxisLineType('dashed');
    setRadarAxisLineColor('#9e9e9e');
    setRadarSplitLine(true);
    setRadarSplitLineWidth(0.8);
    setRadarSplitLineType('solid');
    setRadarSplitLineColor('#e0e0e0');
    setRadarLineWidth(1.8);
    setRadarBaselineLineStyle('solid');
    setRadarAreaOpacity(12);
    setRadarBaselineSymbol('circle');
    setRadarBaselineSymbolSize(4);
    setRadarSmooth(false);
    setRadarTargetSmooth(false);
    setRadarTagShareSmooth(false);
    setRadarShowAxisScaleLabels(true);
    setRadarAxisScaleFormat('percent');
    setRadarAxisScaleFontSize(9);
    setRadarShowAxisTicks(false);
    setRadarShowDataLabels(true);
    setRadarDataLabelFontSize(9);
    setRadarAxisNameBgColor('');
    setRadarRadius(66);
  };

  const applyCircularPolarProfilePreset = () => {
    setRadarShape('circle');
    setRadarSplitNumber(5);
    setRadarSplitArea(true);
    setRadarSplitAreaTheme('subtle');
    setRadarAxisLine(true);
    setRadarAxisLineWidth(1);
    setRadarAxisLineType('solid');
    setRadarSplitLine(true);
    setRadarSplitLineWidth(1);
    setRadarSplitLineType('solid');
    setRadarLineWidth(2.5);
    setRadarBaselineLineStyle('solid');
    setRadarAreaOpacity(25);
    setRadarBaselineSymbol('circle');
    setRadarBaselineSymbolSize(5);
    setRadarSmooth(true);
    setRadarTargetSmooth(true);
    setRadarTagShareSmooth(true);
    setRadarShowAxisScaleLabels(true);
    setRadarAxisScaleFormat('percent');
    setRadarShowAxisTicks(true);
    setRadarRadius(64);
  };

  const applyMultiLabelAsymmetryPreset = () => {
    setRadarShape('polygon');
    setRadarSplitNumber(5);
    setRadarSplitArea(true);
    setRadarSplitAreaTheme('stepped');
    setRadarIndicatorFormat('asymmetry_two_line');
    setRadarBaselineColor('#1b5e20');
    setRadarTagShareColor('#c62828');
    setRadarLineWidth(2.5);
    setRadarTagShareLineWidth(2);
    setRadarBaselineSymbol('circle');
    setRadarTagShareSymbol('rect');
    setRadarShowAxisScaleLabels(true);
    setRadarAxisScaleFormat('percent');
    setRadarShowDataLabels(false);
    setRadarRadius(62);
  };

  const applyHighDensityMetricPreset = () => {
    setRadarShape('polygon');
    setRadarSplitNumber(6);
    setRadarSplitArea(true);
    setRadarSplitAreaTheme('stepped');
    setRadarRadius(72);
    setRadarAxisNameFontSize(10);
    setRadarAxisNameBgColor('#f1f5f9');
    setRadarAxisNameBorderColor('#cbd5e1');
    setRadarAxisNameBorderWidth(1);
    setRadarAxisNamePadding(3);
    setRadarAxisNameBorderRadius(4);
    setRadarShowAxisScaleLabels(true);
    setRadarAxisScaleFontSize(9);
    setRadarShowAxisTicks(true);
    setRadarLineWidth(2);
    setRadarBaselineSymbolSize(5);
    setRadarScaleMax(100);
    setRadarScaleMin(0);
  };

  return (
    <div className="space-y-4">
      {/* --- SECTION 1: 1-CLICK ACADEMIC RADAR PRESETS --- */}
      <div className="p-3 bg-primary/5 rounded-2xl border border-primary/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            1-Click Academic Radar Presets
          </span>
          <span className="text-[10px] font-mono text-muted-foreground font-semibold">Publication Ready</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={applyIeeePublicationPreset}
            className="px-2 py-1.5 bg-card hover:bg-primary/10 border border-border/80 hover:border-primary/40 rounded-xl text-[11px] font-bold text-foreground text-center transition-all shadow-xs cursor-pointer"
            title="Standard IEEE polygon radar with stepped rings and concentric scale values"
          >
            IEEE Standard
          </button>
          <button
            type="button"
            onClick={applySpiderWebMinimalistPreset}
            className="px-2 py-1.5 bg-card hover:bg-primary/10 border border-border/80 hover:border-primary/40 rounded-xl text-[11px] font-bold text-foreground text-center transition-all shadow-xs cursor-pointer"
            title="Clean minimalist spider web without fill areas and crisp dashed spokes"
          >
            Spider Web Minimal
          </button>
          <button
            type="button"
            onClick={applyCircularPolarProfilePreset}
            className="px-2 py-1.5 bg-card hover:bg-primary/10 border border-border/80 hover:border-primary/40 rounded-xl text-[11px] font-bold text-foreground text-center transition-all shadow-xs cursor-pointer"
            title="Concentric circular rings with smooth spline curved polygons"
          >
            Circular Smooth
          </button>
          <button
            type="button"
            onClick={applyMultiLabelAsymmetryPreset}
            className="px-2 py-1.5 bg-card hover:bg-primary/10 border border-border/80 hover:border-primary/40 rounded-xl text-[11px] font-bold text-foreground text-center transition-all shadow-xs cursor-pointer"
            title="Optimized for multi-label study prevalence vs tag share disclosure audit"
          >
            Asymmetry Audit
          </button>
          <button
            type="button"
            onClick={applyHighDensityMetricPreset}
            className="px-2 py-1.5 bg-card hover:bg-primary/10 border border-border/80 hover:border-primary/40 rounded-xl text-[11px] font-bold text-foreground text-center transition-all shadow-xs cursor-pointer"
            title="Enlarged radius with badge indicator tags and high density ring markings"
          >
            High-Density Badge
          </button>
        </div>
      </div>

      {/* --- SECTION 2: WEB GEOMETRY & POLAR GRID --- */}
      <div className="p-3 bg-card rounded-2xl border border-border/80 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-primary" />
            Web Geometry & Polar Coordinate Grid
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Shape & Center</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Polar Grid Shape</label>
            <select
              value={radarShape}
              onChange={(e) => setRadarShape(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="polygon">Polygon (Classic Spider Web)</option>
              <option value="circle">Circle (Concentric Polar Rings)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Radius Scale ({radarRadius}%)</label>
            <input
              type="range"
              min={25}
              max={88}
              value={radarRadius}
              onChange={(e) => setRadarRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-muted-foreground block">Start Angle ({radarStartAngle}°)</label>
              <div className="flex gap-1">
                {[0, 90, 180, 270].map((ang) => (
                  <button
                    key={ang}
                    type="button"
                    onClick={() => setRadarStartAngle(ang)}
                    className={`px-1 py-0.2 text-[9px] font-mono font-bold rounded border cursor-pointer ${
                      radarStartAngle === ang ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {ang}°
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={radarStartAngle}
              onChange={(e) => setRadarStartAngle(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Center Coordinates */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">
              Center X ({radarCenterX !== undefined ? `${radarCenterX}%` : `Auto: ${50 + fitOffsetX}%`})
            </label>
            <input
              type="range"
              min={20}
              max={80}
              value={radarCenterX !== undefined ? radarCenterX : 50 + fitOffsetX}
              onChange={(e) => setRadarCenterX(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">
              Center Y ({radarCenterY !== undefined ? `${radarCenterY}%` : `Auto: ${52 + fitOffsetY}%`})
            </label>
            <input
              type="range"
              min={20}
              max={80}
              value={radarCenterY !== undefined ? radarCenterY : 52 + fitOffsetY}
              onChange={(e) => setRadarCenterY(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex items-end pb-0.5">
            <button
              type="button"
              onClick={() => {
                setRadarCenterX(undefined);
                setRadarCenterY(undefined);
                setFitOffsetX(0);
                setFitOffsetY(0);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-muted/30 hover:bg-muted/60 border border-border/80 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Center
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: RINGS, SPOKES & GRIDLINE STYLING --- */}
      <div className="p-3 bg-card rounded-2xl border border-border/80 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Rings, Spokes & Gridline Styling
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Polar Web Mesh</span>
        </div>

        {/* Concentric Split Rings Count & Area Themes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Concentric Split Rings ({radarSplitNumber})</label>
            <input
              type="range"
              min={2}
              max={10}
              value={radarSplitNumber}
              onChange={(e) => setRadarSplitNumber(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Concentric Shaded Bands</label>
            <select
              value={radarSplitAreaTheme}
              onChange={(e) => {
                const val = e.target.value as any;
                setRadarSplitAreaTheme(val);
                setRadarSplitArea(val !== 'none');
              }}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="stepped">Stepped Depth (Academic Gradient)</option>
              <option value="subtle">Subtle Alternating</option>
              <option value="solid">Solid Tint</option>
              <option value="custom">Custom Two-Tone Colors</option>
              <option value="none">None (Transparent Web)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Band Opacity ({radarSplitAreaOpacity}%)</label>
            <input
              type="range"
              min={10}
              max={100}
              value={radarSplitAreaOpacity}
              onChange={(e) => setRadarSplitAreaOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        {/* Custom Two-Tone Band Colors (if selected) */}
        {radarSplitAreaTheme === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2 bg-muted/20 rounded-xl border border-border/60">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Shaded Band Color 1</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={radarSplitAreaColor1 || '#ffffff'}
                  onChange={(e) => setRadarSplitAreaColor1(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={radarSplitAreaColor1}
                  placeholder="#ffffff or rgba(...)"
                  onChange={(e) => setRadarSplitAreaColor1(e.target.value)}
                  className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-xs font-mono font-bold"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Shaded Band Color 2</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={radarSplitAreaColor2 || '#f1f5f9'}
                  onChange={(e) => setRadarSplitAreaColor2(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={radarSplitAreaColor2}
                  placeholder="#f1f5f9 or rgba(...)"
                  onChange={(e) => setRadarSplitAreaColor2(e.target.value)}
                  className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Radial Spokes vs Concentric Ring Line Styling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
          {/* Radial Spokes (Axis Lines) */}
          <div className="space-y-2 p-2.5 bg-muted/15 rounded-xl border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground">Radial Spokes (Spoke Lines)</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-primary">
                <input
                  type="checkbox"
                  checked={radarAxisLine}
                  onChange={(e) => setRadarAxisLine(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span>Visible</span>
              </label>
            </div>
            {radarAxisLine && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Width ({radarAxisLineWidth}px)</label>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.5}
                    value={radarAxisLineWidth}
                    onChange={(e) => setRadarAxisLineWidth(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Style</label>
                  <select
                    value={radarAxisLineType}
                    onChange={(e) => setRadarAxisLineType(e.target.value as any)}
                    className="w-full bg-card border border-border rounded px-2 py-0.5 text-[11px] font-bold text-foreground"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Opacity ({radarAxisLineOpacity}%)</label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={radarAxisLineOpacity}
                    onChange={(e) => setRadarAxisLineOpacity(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Color (Auto/Custom)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={radarAxisLineColor || palette.border || '#b0bec5'}
                      onChange={(e) => setRadarAxisLineColor(e.target.value)}
                      className="w-6 h-6 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={radarAxisLineColor}
                      placeholder="Auto"
                      onChange={(e) => setRadarAxisLineColor(e.target.value)}
                      className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Concentric Split Ring Lines */}
          <div className="space-y-2 p-2.5 bg-muted/15 rounded-xl border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground">Concentric Web Rings (Split Lines)</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-primary">
                <input
                  type="checkbox"
                  checked={radarSplitLine}
                  onChange={(e) => setRadarSplitLine(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span>Visible</span>
              </label>
            </div>
            {radarSplitLine && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Width ({radarSplitLineWidth}px)</label>
                  <input
                    type="range"
                    min={0.5}
                    max={4}
                    step={0.5}
                    value={radarSplitLineWidth}
                    onChange={(e) => setRadarSplitLineWidth(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Style</label>
                  <select
                    value={radarSplitLineType}
                    onChange={(e) => setRadarSplitLineType(e.target.value as any)}
                    className="w-full bg-card border border-border rounded px-2 py-0.5 text-[11px] font-bold text-foreground"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Opacity ({radarSplitLineOpacity}%)</label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={radarSplitLineOpacity}
                    onChange={(e) => setRadarSplitLineOpacity(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground block">Color (Auto/Custom)</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={radarSplitLineColor || palette.border || '#cfd8dc'}
                      onChange={(e) => setRadarSplitLineColor(e.target.value)}
                      className="w-6 h-6 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={radarSplitLineColor}
                      placeholder="Auto"
                      onChange={(e) => setRadarSplitLineColor(e.target.value)}
                      className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- SECTION 4: CONCENTRIC SCALE RING NUMBERS & TICKS --- */}
      <div className="p-3 bg-card rounded-2xl border border-border/80 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-primary" />
            Concentric Scale Ring Numbers & Ticks
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-primary">
            <input
              type="checkbox"
              checked={radarShowAxisScaleLabels}
              onChange={(e) => setRadarShowAxisScaleLabels(e.target.checked)}
              className="rounded border-border text-primary"
            />
            <span>Show Scale Numbers</span>
          </label>
        </div>

        {radarShowAxisScaleLabels && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Number Format</label>
              <select
                value={radarAxisScaleFormat}
                onChange={(e) => setRadarAxisScaleFormat(e.target.value as any)}
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
              >
                <option value="percent">Percentage (e.g. 50%)</option>
                <option value="integer">Integer (e.g. 50)</option>
                <option value="decimal_1">1 Decimal (e.g. 50.0%)</option>
                <option value="raw">Raw Number</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Font Size ({radarAxisScaleFontSize}px)</label>
              <input
                type="range"
                min={8}
                max={16}
                value={radarAxisScaleFontSize}
                onChange={(e) => setRadarAxisScaleFontSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Font Weight</label>
              <select
                value={radarAxisScaleFontWeight}
                onChange={(e) => setRadarAxisScaleFontWeight(e.target.value as any)}
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-Bold (600)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Text Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={radarAxisScaleColor || palette.subtext || '#78909c'}
                  onChange={(e) => setRadarAxisScaleColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={radarAxisScaleColor}
                  placeholder="Auto Subtext"
                  onChange={(e) => setRadarAxisScaleColor(e.target.value)}
                  className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Ceiling Max, Floor Min, and Ticks */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">
                Scale Max ({radarScaleMax !== undefined ? radarScaleMax : 'Auto: 100'})
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                placeholder="100"
                value={radarScaleMax !== undefined ? radarScaleMax : ''}
                onChange={(e) => setRadarScaleMax(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">
                Scale Min ({radarScaleMin !== undefined ? radarScaleMin : 'Auto: 0'})
              </label>
              <input
                type="number"
                min={0}
                max={500}
                placeholder="0"
                value={radarScaleMin !== undefined ? radarScaleMin : ''}
                onChange={(e) => setRadarScaleMin(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-card border border-border rounded px-2 py-1 text-xs font-mono font-bold"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={radarShowAxisTicks}
                  onChange={(e) => setRadarShowAxisTicks(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span>Show Radial Scale Ticks</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* --- SECTION 5: VERTEX INDICATOR LABELS & TYPOGRAPHY --- */}
      <div className="p-3 bg-card rounded-2xl border border-border/80 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-primary" />
            Vertex Indicator Labels & Typography
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Spoke Names</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Label Format Preset</label>
            <select
              value={radarIndicatorFormat}
              onChange={(e) => setRadarIndicatorFormat(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="two_line">Two Lines: Variable + (Value%)</option>
              <option value="single_line">Single Line: Variable (Value%)</option>
              <option value="ratio_percent">Complete Ratio: Variable (n/N, %)</option>
              {isPrevalenceVsTagShare && (
                <option value="asymmetry_two_line">Asymmetry Audit: Prev% vs Tag%</option>
              )}
              <option value="name_only">Name Only (No Percent)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Distance Margin ({radarAxisNameMargin}px)</label>
            <input
              type="range"
              min={5}
              max={35}
              value={radarAxisNameMargin}
              onChange={(e) => setRadarAxisNameMargin(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Max Width ({radarAxisNameWidth}px)</label>
            <input
              type="range"
              min={60}
              max={220}
              value={radarAxisNameWidth}
              onChange={(e) => setRadarAxisNameWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Overflow Wrap</label>
            <select
              value={radarAxisNameOverflow}
              onChange={(e) => setRadarAxisNameOverflow(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="break">Wrap (Line Break)</option>
              <option value="truncate">Truncate (Ellipsis ...)</option>
              <option value="none">None (Full Line)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">
              Font Size ({radarAxisNameFontSize !== undefined ? `${radarAxisNameFontSize}px` : 'Auto (Theme)'})
            </label>
            <input
              type="range"
              min={8}
              max={22}
              value={radarAxisNameFontSize !== undefined ? radarAxisNameFontSize : 11}
              onChange={(e) => setRadarAxisNameFontSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Font Weight & Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={radarAxisNameFontWeight}
                onChange={(e) => setRadarAxisNameFontWeight(e.target.value as any)}
                className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-foreground font-bold"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-Bold</option>
                <option value="900">Black (900)</option>
              </select>
              <select
                value={radarAxisNameFontStyle}
                onChange={(e) => setRadarAxisNameFontStyle(e.target.value as any)}
                className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-foreground font-bold"
              >
                <option value="normal">Regular</option>
                <option value="italic">Italic</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={radarAxisNameColor || palette.text || '#212121'}
                onChange={(e) => setRadarAxisNameColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer"
              />
              <input
                type="text"
                value={radarAxisNameColor}
                placeholder="Auto Text Color"
                onChange={(e) => setRadarAxisNameColor(e.target.value)}
                className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-xs font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Pill Badge Container Styling */}
        <div className="p-2.5 bg-muted/20 rounded-xl border border-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground">Pill / Badge Background Container</span>
            {radarAxisNameBgColor && (
              <button
                type="button"
                onClick={() => setRadarAxisNameBgColor('')}
                className="text-[10px] text-destructive hover:underline font-bold cursor-pointer"
              >
                Remove Badge
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground block">Badge Background</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={radarAxisNameBgColor || '#f8fafc'}
                  onChange={(e) => setRadarAxisNameBgColor(e.target.value)}
                  className="w-6 h-6 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={radarAxisNameBgColor}
                  placeholder="Transparent"
                  onChange={(e) => setRadarAxisNameBgColor(e.target.value)}
                  className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block">Border Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={radarAxisNameBorderColor || '#cbd5e1'}
                  onChange={(e) => setRadarAxisNameBorderColor(e.target.value)}
                  className="w-6 h-6 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={radarAxisNameBorderColor}
                  placeholder="None"
                  onChange={(e) => setRadarAxisNameBorderColor(e.target.value)}
                  className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-[10px] font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block">Corner Radius ({radarAxisNameBorderRadius}px)</label>
              <input
                type="range"
                min={0}
                max={12}
                value={radarAxisNameBorderRadius}
                onChange={(e) => setRadarAxisNameBorderRadius(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block">Padding ({radarAxisNamePadding}px)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={radarAxisNamePadding}
                onChange={(e) => setRadarAxisNamePadding(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 6: SERIES & DATA POLYGON STYLING --- */}
      {/* Series 1: Empirical Baseline / Paper Prevalence */}
      <div className="p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-foreground block flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{isPrevalenceVsTagShare ? 'Paper Prevalence Series (Series 1)' : 'Empirical Baseline Series (Series 1)'}</span>
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <input
              type="checkbox"
              checked={radarSmooth}
              onChange={(e) => setRadarSmooth(e.target.checked)}
              className="rounded border-border text-emerald-600"
            />
            <span>Smooth Spline</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Stroke Width ({radarLineWidth}px)</label>
            <input
              type="range"
              min={1}
              max={6}
              step={0.5}
              value={radarLineWidth}
              onChange={(e) => setRadarLineWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Line Pattern</label>
            <select
              value={radarBaselineLineStyle}
              onChange={(e) => setRadarBaselineLineStyle(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Area Fill Opacity ({radarAreaOpacity}%)</label>
            <input
              type="range"
              min={0}
              max={80}
              value={radarAreaOpacity}
              onChange={(e) => setRadarAreaOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Stroke Color</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={radarBaselineColor || (isPrevalenceVsTagShare ? '#1b5e20' : '#0275d8')}
                onChange={(e) => setRadarBaselineColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer"
              />
              <input
                type="text"
                value={radarBaselineColor || (isPrevalenceVsTagShare ? '#1b5e20' : '#0275d8')}
                onChange={(e) => setRadarBaselineColor(e.target.value)}
                className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Custom Fill Color</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={radarBaselineAreaColor || radarBaselineColor || (isPrevalenceVsTagShare ? '#1b5e20' : '#0275d8')}
                onChange={(e) => setRadarBaselineAreaColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer"
              />
              <input
                type="text"
                value={radarBaselineAreaColor}
                placeholder="Inherit Stroke"
                onChange={(e) => setRadarBaselineAreaColor(e.target.value)}
                className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Vertex Symbol</label>
            <select
              value={radarBaselineSymbol}
              onChange={(e) => setRadarBaselineSymbol(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="circle">Circle</option>
              <option value="diamond">Diamond</option>
              <option value="triangle">Triangle</option>
              <option value="rect">Square</option>
              <option value="none">None (Clean Line)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Symbol Size ({radarBaselineSymbolSize}px)</label>
            <input
              type="range"
              min={2}
              max={12}
              value={radarBaselineSymbolSize}
              onChange={(e) => setRadarBaselineSymbolSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Symbol Ring Border</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={radarBaselineSymbolBorderColor || '#ffffff'}
                onChange={(e) => setRadarBaselineSymbolBorderColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer"
              />
              <select
                value={radarBaselineSymbolBorderWidth}
                onChange={(e) => setRadarBaselineSymbolBorderWidth(Number(e.target.value))}
                className="flex-1 bg-card border border-border rounded px-1.5 py-1 text-xs text-foreground font-bold"
              >
                <option value={0}>0px (None)</option>
                <option value={1}>1px</option>
                <option value={2}>2px</option>
                <option value={3}>3px</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Series 2: Tag Share (Mode 3) OR Requirement Target (Mode 1) */}
      {isPrevalenceVsTagShare ? (
        <div className="p-3 bg-rose-500/5 rounded-2xl border border-rose-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-foreground block flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Tag Share Series (Series 2)</span>
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-rose-600 dark:text-rose-400">
              <input
                type="checkbox"
                checked={radarTagShareSmooth}
                onChange={(e) => setRadarTagShareSmooth(e.target.checked)}
                className="rounded border-border text-rose-600"
              />
              <span>Smooth Spline</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Stroke Width ({radarTagShareLineWidth}px)</label>
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={radarTagShareLineWidth}
                onChange={(e) => setRadarTagShareLineWidth(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Line Pattern</label>
              <select
                value={radarTagShareLineStyle}
                onChange={(e) => setRadarTagShareLineStyle(e.target.value as any)}
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
              >
                <option value="dashed">Dashed</option>
                <option value="solid">Solid</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Area Fill ({radarTagShareAreaOpacity}%)</label>
              <input
                type="range"
                min={0}
                max={50}
                value={radarTagShareAreaOpacity}
                onChange={(e) => setRadarTagShareAreaOpacity(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Series Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={radarTagShareColor || '#c62828'}
                  onChange={(e) => setRadarTagShareColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={radarTagShareColor || '#c62828'}
                  onChange={(e) => setRadarTagShareColor(e.target.value)}
                  className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Vertex Symbol</label>
              <select
                value={radarTagShareSymbol}
                onChange={(e) => setRadarTagShareSymbol(e.target.value as any)}
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
              >
                <option value="rect">Square</option>
                <option value="circle">Circle</option>
                <option value="diamond">Diamond</option>
                <option value="triangle">Triangle</option>
                <option value="none">None (Clean Line)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Symbol Size ({radarTagShareSymbolSize}px)</label>
              <input
                type="range"
                min={2}
                max={12}
                value={radarTagShareSymbolSize}
                onChange={(e) => setRadarTagShareSymbolSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-destructive/5 rounded-2xl border border-destructive/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-foreground block">Benchmark Target Series (Series 2)</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={radarTargetSmooth}
                  onChange={(e) => setRadarTargetSmooth(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <span>Smooth Spline</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-destructive">
                <input
                  type="checkbox"
                  checked={radarShowTarget}
                  onChange={(e) => setRadarShowTarget(e.target.checked)}
                  className="rounded border-border text-destructive"
                />
                <span>Show Benchmark</span>
              </label>
            </div>
          </div>

          {radarShowTarget && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-destructive/10">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Stroke Width ({radarTargetLineWidth}px)</label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={radarTargetLineWidth}
                  onChange={(e) => setRadarTargetLineWidth(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Line Pattern</label>
                <select
                  value={radarTargetLineStyle}
                  onChange={(e) => setRadarTargetLineStyle(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
                >
                  <option value="dashed">Dashed</option>
                  <option value="solid">Solid</option>
                  <option value="dotted">Dotted</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Fill Opacity ({radarTargetAreaOpacity}%)</label>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={radarTargetAreaOpacity}
                  onChange={(e) => setRadarTargetAreaOpacity(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Target Color</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={radarTargetColor || '#d9534f'}
                    onChange={(e) => setRadarTargetColor(e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={radarTargetColor || '#d9534f'}
                    onChange={(e) => setRadarTargetColor(e.target.value)}
                    className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Target Symbol</label>
                <select
                  value={radarTargetSymbol}
                  onChange={(e) => setRadarTargetSymbol(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
                >
                  <option value="circle">Circle</option>
                  <option value="diamond">Diamond</option>
                  <option value="triangle">Triangle</option>
                  <option value="rect">Square</option>
                  <option value="none">None (Clean Line)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground block">Symbol Size ({radarTargetSymbolSize}px)</label>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={radarTargetSymbolSize}
                  onChange={(e) => setRadarTargetSymbolSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SECTION 7: VERTEX POINT DATA LABELS & LEGEND COORDINATION --- */}
      <div className="p-3 bg-card rounded-2xl border border-border/80 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" />
            Vertex Point Data Labels & Legend Coordination
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-primary">
            <input
              type="checkbox"
              checked={radarShowDataLabels}
              onChange={(e) => setRadarShowDataLabels(e.target.checked)}
              className="rounded border-border text-primary"
            />
            <span>Show Point Labels</span>
          </label>
        </div>

        {radarShowDataLabels && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Label Position</label>
              <select
                value={radarDataLabelPosition}
                onChange={(e) => setRadarDataLabelPosition(e.target.value as any)}
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
              >
                <option value="top">Top (Above Point)</option>
                <option value="bottom">Bottom (Below Point)</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="inside">Inside Polygon</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Format</label>
              <select
                value={radarDataLabelFormat}
                onChange={(e) => setRadarDataLabelFormat(e.target.value as any)}
                className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
              >
                <option value="percent">Percentage (e.g. 85%)</option>
                <option value="integer">Integer (e.g. 85)</option>
                <option value="decimal_1">1 Decimal (e.g. 85.0%)</option>
                <option value="raw">Raw Value</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Font Size ({radarDataLabelFontSize}px)</label>
              <input
                type="range"
                min={8}
                max={16}
                value={radarDataLabelFontSize}
                onChange={(e) => setRadarDataLabelFontSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Font Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={radarDataLabelColor || palette.text || '#212121'}
                  onChange={(e) => setRadarDataLabelColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={radarDataLabelColor}
                  placeholder="Auto Text"
                  onChange={(e) => setRadarDataLabelColor(e.target.value)}
                  className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Legend Coordination */}
        <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Legend Visibility</label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="rounded border-border text-primary"
              />
              <span>Show Legend</span>
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Placement</label>
            <select
              value={legendPosition}
              onChange={(e) => setLegendPosition(e.target.value as any)}
              className="w-full bg-card border border-border rounded-xl px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="bottom">Bottom (Standard)</option>
              <option value="top">Top</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Distance ({legendDistance}px)</label>
            <input
              type="range"
              min={5}
              max={50}
              value={legendDistance}
              onChange={(e) => setLegendDistance(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Item Gap ({legendItemGap}px)</label>
            <input
              type="range"
              min={6}
              max={30}
              value={legendItemGap}
              onChange={(e) => setLegendItemGap(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
