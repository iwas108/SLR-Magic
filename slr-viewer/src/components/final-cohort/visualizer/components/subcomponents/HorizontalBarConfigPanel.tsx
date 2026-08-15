import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';

export function HorizontalBarConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    barSorting,
    setBarSorting,
    barLabelPosition,
    setBarLabelPosition,
    barLabelFormat,
    setBarLabelFormat,
    barLabelDistance = 5,
    setBarLabelDistance,
    barThickness,
    setBarThickness,
    barBorderRadius,
    setBarBorderRadius,
    barGap,
    setBarGap,
    barYAxisWidth,
    setBarYAxisWidth,
    barYAxisOverflow,
    setBarYAxisOverflow,
    barLineHeight = 14,
    setBarLineHeight,
    barYAxisFontSize = 11,
    setBarYAxisFontSize,
    barBenchmarkLine,
    setBarBenchmarkLine,
    barBenchmarkValue,
    setBarBenchmarkValue,
    barBenchmarkLabel,
    setBarBenchmarkLabel,
    barBenchmarkStyle,
    setBarBenchmarkStyle,
    barBenchmarkColor,
    setBarBenchmarkColor
  } = config;

  return (
    <div className="space-y-4">
      {/* Bar Layout & Sorting */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Sorting Order</label>
          <select
            value={barSorting}
            onChange={(e) => setBarSorting(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="desc">Descending (Largest First)</option>
            <option value="asc">Ascending (Smallest First)</option>
            <option value="none">Unsorted (Dataset Order)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Value Label Position</label>
          <select
            value={barLabelPosition}
            onChange={(e) => setBarLabelPosition(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="right">Right (Outside Bar)</option>
            <option value="inside">Inside (Center)</option>
            <option value="insideLeft">Inside (Left Edge)</option>
            <option value="insideRight">Inside (Right Edge)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Value Label Format</label>
          <select
            value={barLabelFormat}
            onChange={(e) => setBarLabelFormat(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
            <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
            <option value="percent_ratio">Coarse % + Ratio (~P%, n = x/N)</option>
            <option value="ratio_only">Ratio Only (n = x/N)</option>
            <option value="count_percent">Count + Coarse % (n = x, ~P%)</option>
            <option value="percent_only">Percentage Only (~P%)</option>
            <option value="count_only">Count Only (n = x)</option>
          </select>
        </div>

        <div className="space-y-1 sm:col-span-3 pt-1 border-t border-border/40">
          <label className="text-xs font-bold text-foreground block">
            Distance Between Bar & Label ({barLabelDistance}px)
          </label>
          <input
            type="range"
            min={-15}
            max={30}
            value={barLabelDistance}
            onChange={(e) => setBarLabelDistance(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* Bar Sizing & Corner Radius */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/20 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Bar Thickness ({barThickness}px)</label>
          <input
            type="range"
            min={8}
            max={50}
            value={barThickness}
            onChange={(e) => setBarThickness(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

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
          <label className="text-xs font-bold text-foreground block">Bar Spacing Gap ({barGap}%)</label>
          <input
            type="range"
            min={0}
            max={80}
            value={barGap}
            onChange={(e) => setBarGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* Y-Axis Label Width, Line Height & Overflow Treatment */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-secondary/20 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Y-Axis Width ({barYAxisWidth}px)</label>
          <input
            type="range"
            min={80}
            max={320}
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
            max={18}
            value={barYAxisFontSize}
            onChange={(e) => setBarYAxisFontSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Overflow Wrapping</label>
          <select
            value={barYAxisOverflow}
            onChange={(e) => setBarYAxisOverflow(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="break">Word Wrap</option>
            <option value="truncate">Truncate (...)</option>
            <option value="none">Full Length</option>
          </select>
        </div>
      </div>

      {/* Reference Benchmark Line Controls */}
      <div className="p-3 bg-secondary/30 border border-border/70 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={barBenchmarkLine}
              onChange={(e) => setBarBenchmarkLine(e.target.checked)}
              className="rounded border-border text-primary"
            />
            Show Reference Benchmark Line
          </label>
        </div>

        {barBenchmarkLine && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Target Value</label>
              <input
                type="number"
                step="any"
                value={barBenchmarkValue}
                onChange={(e) => setBarBenchmarkValue(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Benchmark Label</label>
              <input
                type="text"
                value={barBenchmarkLabel}
                onChange={(e) => setBarBenchmarkLabel(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                placeholder="Target Benchmark"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Line Style</label>
              <select
                value={barBenchmarkStyle}
                onChange={(e) => setBarBenchmarkStyle(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
              >
                <option value="dashed">Dashed Line</option>
                <option value="solid">Solid Line</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Line Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={barBenchmarkColor}
                  onChange={(e) => setBarBenchmarkColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
                />
                <input
                  type="text"
                  value={barBenchmarkColor}
                  onChange={(e) => setBarBenchmarkColor(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono font-bold text-foreground"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
