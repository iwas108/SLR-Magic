import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Diamond,
  BarChart2,
  Layers,
  Type,
  LayoutGrid,
  Edit3,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';

export function HorizontalBarScatterConfigPanel() {
  const { config, data } = useVisualizerContext();
  const {
    barSorting,
    setBarSorting,
    scatterSortMode = 'prevalence_desc',
    setScatterSortMode,
    barThickness = 24,
    setBarThickness,
    barBorderRadius = 4,
    setBarBorderRadius,
    barColorCustom = '',
    setBarColorCustom,
    showDataLabels,
    setShowDataLabels,
    barYAxisWidth = 140,
    setBarYAxisWidth,
    barYAxisOverflow = 'break',
    setBarYAxisOverflow,
    barLineHeight = 14,
    setBarLineHeight,
    barYAxisFontSize = 11,
    setBarYAxisFontSize,
    barYAxisFontWeight = 'normal',
    setBarYAxisFontWeight,
    barYAxisFontStyle = 'normal',
    setBarYAxisFontStyle,
    barYAxisColor = '',
    setBarYAxisColor,
    barLabelFontSize = 11,
    setBarLabelFontSize,
    barLabelFontWeight = 'bold',
    setBarLabelFontWeight,
    barLabelFontStyle = 'normal',
    setBarLabelFontStyle,
    barLabelColor = '',
    setBarLabelColor,
    barLabelDistance = 5,
    setBarLabelDistance,
    axisLabelMarginY = 8,
    setAxisLabelMarginY,
    barValueCeiling = 40,
    setBarValueCeiling,
    barValueInterval = 10,
    setBarValueInterval,
    customAxisTitleX = 'Cohort Share (%)',
    setCustomAxisTitleX,
    axisTitleGapX = 32,
    setAxisTitleGapX,
    scatterAxisTitle = 'Boundary Disclosure (%)',
    setScatterAxisTitle,
    scatterAxisMax = 100,
    setScatterAxisMax,
    scatterAxisInterval = 25,
    setScatterAxisInterval,
    scatterAxisNameGap = 24,
    setScatterAxisNameGap,
    scatterSeriesName = 'Boundary Disclosure Rate (%)',
    setScatterSeriesName,
    barSeriesName = 'Cohort Prevalence (%)',
    setBarSeriesName,
    scatterSymbol = 'diamond',
    setScatterSymbol,
    scatterSymbolSize = 14,
    setScatterSymbolSize,
    scatterColor = '#d9534f',
    setScatterColor,
    scatterBorderColor = '#900',
    setScatterBorderColor,
    scatterBorderWidth = 1.5,
    setScatterBorderWidth,
    scatterShowDataLabels = false,
    setScatterShowDataLabels,
    scatterLabelPosition = 'top',
    setScatterLabelPosition,
    scatterLabelFontSize = 11,
    setScatterLabelFontSize,
    scatterLabelFontWeight = 'bold',
    setScatterLabelFontWeight,
    scatterLabelFontStyle = 'normal',
    setScatterLabelFontStyle,
    scatterLabelColor = '',
    setScatterLabelColor,
    scatterLabelDistance = 5,
    setScatterLabelDistance,
    barGridTop = 48,
    setBarGridTop,
    barGridBottom = 58,
    setBarGridBottom,
    barGridLeft = 4,
    setBarGridLeft,
    barGridRight = 4,
    setBarGridRight
  } = config;

  const {
    enableManualOverrides,
    setEnableManualOverrides,
    manualCategoryValues,
    setManualCategoryValues
  } = data;

  const [showOverrideTable, setShowOverrideTable] = useState(false);

  return (
    <div className="space-y-4">
      {/* 1. Bar Series Customization */}
      <div className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-primary" />
            1. Primary Bar Series (Cohort Prevalence / Share)
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {barThickness}px width • r={barBorderRadius}px
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Bar Legend Title</label>
            <input
              type="text"
              value={barSeriesName}
              onChange={(e) => setBarSeriesName(e.target.value)}
              placeholder="Cohort Prevalence (%)"
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Custom Bar Fill Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={barColorCustom || '#2b5c8f'}
                onChange={(e) => setBarColorCustom(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
              />
              <input
                type="text"
                value={barColorCustom}
                onChange={(e) => setBarColorCustom(e.target.value)}
                placeholder="Palette Default"
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Bar Thickness ({barThickness}px)</label>
            <input
              type="range"
              min={10}
              max={60}
              value={barThickness}
              onChange={(e) => setBarThickness(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Corner Radius ({barBorderRadius}px)</label>
            <input
              type="range"
              min={0}
              max={16}
              value={barBorderRadius}
              onChange={(e) => setBarBorderRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Show Value Labels</label>
            <div className="flex items-center h-8">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={showDataLabels}
                  onChange={(e) => setShowDataLabels(e.target.checked)}
                  className="rounded border-border text-primary w-4 h-4"
                />
                Display Bar Values ({'{c}%'})
              </label>
            </div>
          </div>
        </div>

        {showDataLabels && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-2.5 bg-card/60 rounded-lg border border-border/50">
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Label Size ({barLabelFontSize}px)</label>
              <input
                type="range"
                min={8}
                max={28}
                value={barLabelFontSize}
                onChange={(e) => setBarLabelFontSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Font Weight</label>
              <select
                value={barLabelFontWeight}
                onChange={(e) => setBarLabelFontWeight(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              >
                <option value="normal">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="bold">Bold (700)</option>
                <option value="800">ExtraBold (800)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Font Style</label>
              <select
                value={barLabelFontStyle}
                onChange={(e) => setBarLabelFontStyle(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Text Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={barLabelColor || '#111827'}
                  onChange={(e) => setBarLabelColor(e.target.value)}
                  className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent p-0"
                />
                <input
                  type="text"
                  value={barLabelColor}
                  onChange={(e) => setBarLabelColor(e.target.value)}
                  placeholder="Auto"
                  className="w-full bg-card border border-border rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-foreground"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Distance ({barLabelDistance}px)</label>
              <input
                type="range"
                min={-10}
                max={25}
                value={barLabelDistance}
                onChange={(e) => setBarLabelDistance(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Scatter Overlay Series Customization */}
      <div className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Diamond className="w-4 h-4 text-rose-500" />
            2. Overlay Scatter Series (Boundary Disclosure Rate)
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            Symbol: {scatterSymbol} ({scatterSymbolSize}px)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Scatter Legend Title</label>
            <input
              type="text"
              value={scatterSeriesName}
              onChange={(e) => setScatterSeriesName(e.target.value)}
              placeholder="Boundary Disclosure Rate (%)"
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Marker Symbol</label>
            <select
              value={scatterSymbol}
              onChange={(e) => setScatterSymbol(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="diamond">Diamond (◆)</option>
              <option value="circle">Circle (●)</option>
              <option value="triangle">Triangle (▲)</option>
              <option value="rect">Square / Rect (■)</option>
              <option value="pin">Pin (📍)</option>
              <option value="roundRect">Rounded Rect</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Marker Size ({scatterSymbolSize}px)</label>
            <input
              type="range"
              min={6}
              max={32}
              value={scatterSymbolSize}
              onChange={(e) => setScatterSymbolSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Marker Fill Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={scatterColor}
                onChange={(e) => setScatterColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
              />
              <input
                type="text"
                value={scatterColor}
                onChange={(e) => setScatterColor(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Border Stroke Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={scatterBorderColor}
                onChange={(e) => setScatterBorderColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
              />
              <input
                type="text"
                value={scatterBorderColor}
                onChange={(e) => setScatterBorderColor(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground block">Border Width ({scatterBorderWidth}px)</label>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={scatterBorderWidth}
              onChange={(e) => setScatterBorderWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Scatter Value Labels</label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground h-8">
              <input
                type="checkbox"
                checked={scatterShowDataLabels}
                onChange={(e) => setScatterShowDataLabels(e.target.checked)}
                className="rounded border-border text-primary w-4 h-4"
              />
              Display Rate on Scatter ({'{c}%'})
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Scatter Label Position</label>
            <select
              value={scatterLabelPosition}
              onChange={(e) => setScatterLabelPosition(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground font-bold"
            >
              <option value="top">Top of Marker</option>
              <option value="bottom">Bottom of Marker</option>
              <option value="right">Right of Marker</option>
              <option value="left">Left of Marker</option>
            </select>
          </div>
        </div>

        {scatterShowDataLabels && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-2.5 bg-card/60 rounded-lg border border-border/50">
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Label Size ({scatterLabelFontSize}px)</label>
              <input
                type="range"
                min={8}
                max={28}
                value={scatterLabelFontSize}
                onChange={(e) => setScatterLabelFontSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Font Weight</label>
              <select
                value={scatterLabelFontWeight}
                onChange={(e) => setScatterLabelFontWeight(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              >
                <option value="normal">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="bold">Bold (700)</option>
                <option value="800">ExtraBold (800)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Font Style</label>
              <select
                value={scatterLabelFontStyle}
                onChange={(e) => setScatterLabelFontStyle(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              >
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Text Color</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={scatterLabelColor || '#d9534f'}
                  onChange={(e) => setScatterLabelColor(e.target.value)}
                  className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent p-0"
                />
                <input
                  type="text"
                  value={scatterLabelColor}
                  onChange={(e) => setScatterLabelColor(e.target.value)}
                  placeholder="Auto"
                  className="w-full bg-card border border-border rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-foreground"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Distance ({scatterLabelDistance}px)</label>
              <input
                type="range"
                min={0}
                max={25}
                value={scatterLabelDistance}
                onChange={(e) => setScatterLabelDistance(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Category Sorting & Ordering */}
      <div className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" />
            3. Category Ranking & Sorting Mode
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Sorting Criterion</label>
            <select
              value={scatterSortMode}
              onChange={(e) => {
                setScatterSortMode(e.target.value as any);
                setBarSorting(e.target.value as any);
              }}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="prevalence_desc">Prevalence: High to Low (Dominant Top)</option>
              <option value="prevalence_asc">Prevalence: Low to High</option>
              <option value="scatter_desc">Boundary Rate: High to Low</option>
              <option value="scatter_asc">Boundary Rate: Low to High</option>
              <option value="alpha">Alphabetical (A to Z)</option>
              <option value="dataset">Natural Dataset Order</option>
            </select>
          </div>

          <div className="p-2.5 bg-card/60 rounded-lg border border-border/40 text-[11px] text-muted-foreground flex items-center">
            <span>
              💡 In ECharts horizontal layout, descending sort places the largest cohort category at the very top of the figure.
            </span>
          </div>
        </div>
      </div>

      {/* 4. Dual X-Axes Calibration */}
      <div className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            4. Dual X-Axes Scale & Interval Calibration
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            Bottom: 0–{barValueCeiling}% • Top: 0–{scatterAxisMax}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bottom Primary X-Axis (Prevalence) */}
          <div className="p-3 bg-card/70 rounded-xl border border-border/60 space-y-2.5">
            <span className="text-[11px] font-extrabold uppercase text-primary block">
              Bottom X-Axis (Cohort Share / Prevalence)
            </span>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Axis Title</label>
              <input
                type="text"
                value={customAxisTitleX}
                onChange={(e) => setCustomAxisTitleX(e.target.value)}
                placeholder="Cohort Share (%)"
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground block">Max Ceiling</label>
                <select
                  value={typeof barValueCeiling === 'number' ? String(barValueCeiling) : barValueCeiling}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'auto') setBarValueCeiling('auto');
                    else setBarValueCeiling(Number(val));
                  }}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="20">20%</option>
                  <option value="25">25%</option>
                  <option value="30">30%</option>
                  <option value="35">35%</option>
                  <option value="40">40% (Standard)</option>
                  <option value="50">50%</option>
                  <option value="60">60%</option>
                  <option value="100">100%</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground block">Step Interval</label>
                <select
                  value={typeof barValueInterval === 'number' ? String(barValueInterval) : barValueInterval}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'auto') setBarValueInterval('auto');
                    else setBarValueInterval(Number(val));
                  }}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="5">5% Steps</option>
                  <option value="10">10% Steps (Standard)</option>
                  <option value="15">15% Steps</option>
                  <option value="20">20% Steps</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Title Gap ({axisTitleGapX}px)</label>
              <input
                type="range"
                min={10}
                max={150}
                value={axisTitleGapX}
                onChange={(e) => setAxisTitleGapX(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          {/* Top Secondary X-Axis (Disclosure) */}
          <div className="p-3 bg-card/70 rounded-xl border border-border/60 space-y-2.5">
            <span className="text-[11px] font-extrabold uppercase text-rose-500 block">
              Top X-Axis (Boundary Disclosure Rate)
            </span>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Axis Title</label>
              <input
                type="text"
                value={scatterAxisTitle}
                onChange={(e) => setScatterAxisTitle(e.target.value)}
                placeholder="Boundary Disclosure (%)"
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground block">Max Ceiling</label>
                <select
                  value={String(scatterAxisMax)}
                  onChange={(e) => setScatterAxisMax(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100% (Standard)</option>
                  <option value="120">120%</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground block">Step Interval</label>
                <select
                  value={String(scatterAxisInterval)}
                  onChange={(e) => setScatterAxisInterval(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                >
                  <option value="10">10% Steps</option>
                  <option value="20">20% Steps</option>
                  <option value="25">25% Steps (Standard)</option>
                  <option value="50">50% Steps</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-muted-foreground block">Title Gap ({scatterAxisNameGap}px)</label>
              <input
                type="range"
                min={10}
                max={150}
                value={scatterAxisNameGap}
                onChange={(e) => setScatterAxisNameGap(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Canvas Grid Margins & Collision Clearance */}
      <div className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-primary" />
            5. Grid Clearance & Collision Spacing (Title/Axis/Legend)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Top Clearance ({barGridTop}px)</label>
            <input
              type="range"
              min={20}
              max={240}
              value={barGridTop}
              onChange={(e) => setBarGridTop(Number(e.target.value))}
              className="w-full accent-primary"
              title="Prevents subtitle colliding with Top X-Axis"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Bottom Clearance ({barGridBottom}px)</label>
            <input
              type="range"
              min={25}
              max={240}
              value={barGridBottom}
              onChange={(e) => setBarGridBottom(Number(e.target.value))}
              className="w-full accent-primary"
              title="Prevents bottom axis colliding with legend"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Left Margin ({barGridLeft}%)</label>
            <input
              type="range"
              min={1}
              max={30}
              value={barGridLeft}
              onChange={(e) => setBarGridLeft(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Right Margin ({barGridRight}%)</label>
            <input
              type="range"
              min={1}
              max={25}
              value={barGridRight}
              onChange={(e) => setBarGridRight(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      {/* 6. Y-Axis Categorical Typography */}
      <div className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            6. Y-Axis Categorical Label Typography & Layout
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {barYAxisFontSize}px • {barYAxisFontWeight} • {barYAxisFontStyle}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Y-Axis Width ({barYAxisWidth}px)</label>
            <input
              type="range"
              min={80}
              max={360}
              value={barYAxisWidth}
              onChange={(e) => setBarYAxisWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Line Height ({barLineHeight}px)</label>
            <input
              type="range"
              min={8}
              max={32}
              value={barLineHeight}
              onChange={(e) => setBarLineHeight(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Label Font Size ({barYAxisFontSize}px)</label>
            <input
              type="range"
              min={8}
              max={32}
              value={barYAxisFontSize}
              onChange={(e) => setBarYAxisFontSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Margin Offset ({axisLabelMarginY}px)</label>
            <input
              type="range"
              min={0}
              max={40}
              value={axisLabelMarginY}
              onChange={(e) => setAxisLabelMarginY(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 border-t border-border/40">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Font Weight</label>
            <select
              value={barYAxisFontWeight}
              onChange={(e) => setBarYAxisFontWeight(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="normal">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">SemiBold (600)</option>
              <option value="bold">Bold (700)</option>
              <option value="800">ExtraBold (800)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Font Style</label>
            <select
              value={barYAxisFontStyle}
              onChange={(e) => setBarYAxisFontStyle(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="normal">Normal / Upright</option>
              <option value="italic">Italic</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Label Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={barYAxisColor || '#111827'}
                onChange={(e) => setBarYAxisColor(e.target.value)}
                className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
              />
              <input
                type="text"
                value={barYAxisColor}
                onChange={(e) => setBarYAxisColor(e.target.value)}
                placeholder="Palette Default"
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Overflow Wrapping</label>
            <select
              value={barYAxisOverflow}
              onChange={(e) => setBarYAxisOverflow(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="break">Word Wrap</option>
              <option value="truncate">Truncate (...)</option>
              <option value="none">Full Length</option>
            </select>
          </div>
        </div>
      </div>

      {/* 7. Interactive Per-Category Values & Overrides Editor */}
      <div className="p-3.5 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowOverrideTable(!showOverrideTable)}
            className="text-xs font-extrabold text-foreground flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Edit3 className="w-4 h-4 text-primary" />
            <span>7. Per-Category Manual Values & Overrides</span>
            {showOverrideTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
              <input
                type="checkbox"
                checked={enableManualOverrides}
                onChange={(e) => setEnableManualOverrides(e.target.checked)}
                className="rounded border-border text-primary w-3.5 h-3.5"
              />
              Enable Overrides
            </label>
            {enableManualOverrides && (
              <button
                type="button"
                onClick={() => setManualCategoryValues({})}
                className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 font-bold pl-2"
                title="Reset manual overrides to computed values"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {showOverrideTable && (
          <div className="pt-2 border-t border-border/40 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Fine-tune the exact empirical values for each sector or domain:
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {[
                'Other Sectors',
                'Smart Building',
                'Aerospace',
                'Agriculture / Horticulture',
                'Automotive',
                'Traffic / Smart City',
                'Energy & Power',
                'Manufacturing'
              ].map(cat => {
                const barKey = `${cat}:::bar`;
                const scatKey = `${cat}:::scatter`;
                const currentBar = manualCategoryValues?.[barKey] ?? manualCategoryValues?.[cat] ?? '';
                const currentScat = manualCategoryValues?.[scatKey] ?? '';

                return (
                  <div key={cat} className="flex items-center justify-between gap-2 p-2 bg-card/60 rounded-lg border border-border/40 text-xs">
                    <span className="font-bold text-foreground truncate flex-1">{cat}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">Bar %:</span>
                        <input
                          type="number"
                          value={currentBar}
                          disabled={!enableManualOverrides}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = { ...manualCategoryValues };
                            if (val === undefined) {
                              delete next[barKey];
                              delete next[cat];
                            } else {
                              next[barKey] = val;
                            }
                            setManualCategoryValues(next);
                          }}
                          placeholder="auto"
                          className="w-16 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-bold text-foreground disabled:opacity-40"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground font-mono">Scatter %:</span>
                        <input
                          type="number"
                          value={currentScat}
                          disabled={!enableManualOverrides}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const next = { ...manualCategoryValues };
                            if (val === undefined) {
                              delete next[scatKey];
                            } else {
                              next[scatKey] = val;
                            }
                            setManualCategoryValues(next);
                          }}
                          placeholder="auto"
                          className="w-16 bg-card border border-border rounded px-1.5 py-0.5 text-xs font-bold text-foreground disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
