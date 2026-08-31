import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';

export function HorizontalBarConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    metricMode,
    barSorting,
    setBarSorting,
    barLabelPosition,
    setBarLabelPosition,
    barLabelFormat,
    setBarLabelFormat,
    barLabelDistance = 5,
    setBarLabelDistance,
    barLabelFontSize = 11,
    setBarLabelFontSize,
    barLabelFontWeight = 'bold',
    setBarLabelFontWeight,
    barLabelFontStyle = 'normal',
    setBarLabelFontStyle,
    barLabelColor = '',
    setBarLabelColor,
    barLabelRotate = 0,
    setBarLabelRotate,
    barLabelShowZero = true,
    setBarLabelShowZero,
    barLabelMinThreshold = 0,
    setBarLabelMinThreshold,
    barLabelLineHeight = 14,
    setBarLabelLineHeight,
    barValueCeiling = 'auto',
    setBarValueCeiling,
    barValueInterval = 'auto',
    setBarValueInterval,
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
            <optgroup label="Standard (Follows Chart Metric)">
              <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
              <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
              <option value="percent_ratio">Coarse % + Ratio (~P%, n = x/N)</option>
              <option value="ratio_only">Ratio Only (n = x/N)</option>
              <option value="count_percent">Count + Coarse % (n = x, ~P%)</option>
              <option value="percent_only">Percentage Only (~P%)</option>
              <option value="count_only">Count Only (n = x)</option>
            </optgroup>
            <optgroup label="Multi-Line Stacked">
              <option value="two_line_count_percent">Two-Line: Count & % (n = x \n ~P%)</option>
              <option value="two_line_percent_count">Two-Line: % & Count (~P% \n n = x)</option>
              <option value="two_line_ratio_percent">Two-Line: Ratio & % (n = x/N \n ~P%)</option>
              <option value="two_line_percent_ratio">Two-Line: % & Ratio (~P% \n n = x/N)</option>
              <option value="two_line_name_count_percent">Two-Line: Name \n Count & %</option>
            </optgroup>
            <optgroup label="Explicit Tag Share (Total Extracted Tags Denominator)">
              <option value="tag_share_ratio_percent">Tag Share Ratio + % (n = x/TotalTags, ~P%)</option>
              <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + %</option>
              <option value="tag_share_percent_ratio">Tag Share % + Ratio (~P%, n = x/TotalTags)</option>
              <option value="tag_share_percent_only">Tag Share % Only (~P%)</option>
              <option value="tag_share_ratio_only">Tag Share Ratio Only (n = x/TotalTags)</option>
              <option value="tag_share_count_percent">Tag Count + % (n = x, ~P%)</option>
            </optgroup>
            <optgroup label="Explicit Paper Prevalence (Total Cohort Denominator)">
              <option value="prevalence_ratio_percent">Prevalence Ratio + % (n = x/CohortN, ~P%)</option>
              <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + %</option>
              <option value="prevalence_percent_only">Prevalence % Only (~P%)</option>
              <option value="prevalence_ratio_only">Prevalence Ratio Only (n = x/CohortN)</option>
            </optgroup>
            <optgroup label="Dual / Combined Multi-Metric">
              <option value="dual_prevalence_tag_share">Dual: Prev (n=x/N) | Tags (n=x/Total)</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Bar Value Typography & Multi-Line Tuning */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-bold text-foreground">
            Value Labels Typography & Multi-Line Tuning
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {barLabelFontSize}px • {barLabelFontWeight} • {barLabelRotate}°
          </span>
        </div>

        {/* Font Size, Weight, Style & Color */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
              <span>Font Size</span>
              <span className="text-primary font-mono">{barLabelFontSize}px</span>
            </div>
            <input
              type="range"
              min={8}
              max={22}
              value={barLabelFontSize}
              onChange={(e) => setBarLabelFontSize(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-foreground block">Font Weight</label>
            <select
              value={barLabelFontWeight}
              onChange={(e) => setBarLabelFontWeight(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="normal">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">Semi-Bold (600)</option>
              <option value="bold">Bold (700)</option>
              <option value="800">Black (800)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-foreground block">Font Style</label>
            <select
              value={barLabelFontStyle}
              onChange={(e) => setBarLabelFontStyle(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="normal">Plain / Upright</option>
              <option value="italic">Italic</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-foreground block">Text Color Mode</label>
            <select
              value={barLabelColor === '' ? 'theme' : barLabelColor}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'theme') setBarLabelColor('');
                else setBarLabelColor(val);
              }}
              className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="theme">Theme High-Contrast Text</option>
              <option value="#111827">Solid Dark Slate (#111827)</option>
              <option value="#ffffff">Solid Pure White (#FFFFFF)</option>
            </select>
          </div>
        </div>

        {/* Distance, Line Height, Rotation & Clutter Filtering */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
              <span>Offset Distance</span>
              <span className="text-primary font-mono">{barLabelDistance}px</span>
            </div>
            <input
              type="range"
              min={-10}
              max={30}
              value={barLabelDistance}
              onChange={(e) => setBarLabelDistance(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
              <span>Line Height</span>
              <span className="text-primary font-mono">{barLabelLineHeight}px</span>
            </div>
            <input
              type="range"
              min={10}
              max={26}
              value={barLabelLineHeight}
              onChange={(e) => setBarLabelLineHeight(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
              <span>Text Rotation</span>
              <span className="text-primary font-mono">{barLabelRotate}°</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="range"
                min={-90}
                max={90}
                step={15}
                value={barLabelRotate}
                onChange={(e) => setBarLabelRotate(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <button
                type="button"
                onClick={() => setBarLabelRotate(0)}
                className="text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground font-mono"
                title="Reset angle to 0°"
              >
                0°
              </button>
            </div>
          </div>

          <div className="space-y-1 flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-foreground py-1">
              <input
                type="checkbox"
                checked={!barLabelShowZero}
                onChange={(e) => setBarLabelShowZero(!e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary"
              />
              <span>Hide Zero Values</span>
            </label>
          </div>
        </div>
      </div>

      {/* Axis Ceiling & Standard Grid Increments */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            X-Axis (Value) Ceiling & Standard Grid Steps
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            Ceiling: {barValueCeiling === 'auto' ? 'Auto Smart Step' : `${barValueCeiling}${metricMode === 'paper_prevalence' || metricMode === 'tag_share' ? '%' : ''}`} • Interval: {barValueInterval === 'auto' ? 'Auto' : `${barValueInterval}${metricMode === 'paper_prevalence' || metricMode === 'tag_share' ? '%' : ''}`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Axis Ceiling (Max Scale) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              Axis Upper Ceiling (Max Range)
            </label>
            <div className="flex gap-1.5">
              <select
                value={typeof barValueCeiling === 'number' ? String(barValueCeiling) : barValueCeiling}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'auto') setBarValueCeiling('auto');
                  else setBarValueCeiling(Number(val));
                }}
                className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="auto">Auto (Scientific Smart Step)</option>
                {metricMode === 'paper_prevalence' || metricMode === 'tag_share' ? (
                  <>
                    <option value="25">25% (Compact)</option>
                    <option value="30">30% (Tight)</option>
                    <option value="35">35% (Standard 5% Steps)</option>
                    <option value="40">40% (Standard 10% Steps)</option>
                    <option value="45">45%</option>
                    <option value="50">50% (Half Scale)</option>
                    <option value="60">60%</option>
                    <option value="75">75%</option>
                    <option value="100">100% (Full Cohort)</option>
                  </>
                ) : (
                  <>
                    <option value="10">10 (Standard)</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                    <option value="25">25</option>
                    <option value="30">30</option>
                    <option value="40">40</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </>
                )}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Rounds the chart axis ceiling to clean, standard publications intervals (e.g. 35% or 40%).
            </p>
          </div>

          {/* Grid Step Interval */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              Grid Line Increment (Step Interval)
            </label>
            <div className="flex gap-1.5">
              <select
                value={typeof barValueInterval === 'number' ? String(barValueInterval) : barValueInterval}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'auto') setBarValueInterval('auto');
                  else setBarValueInterval(Number(val));
                }}
                className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="auto">Auto (Adaptive Spacing)</option>
                {metricMode === 'paper_prevalence' || metricMode === 'tag_share' ? (
                  <>
                    <option value="5">5% Steps (0%, 5%, 10%, 15%, 20%, 25%, 30%, 35%)</option>
                    <option value="10">10% Steps (0%, 10%, 20%, 30%, 40%)</option>
                    <option value="15">15% Steps (0%, 15%, 30%, 45%)</option>
                    <option value="20">20% Steps (0%, 20%, 40%, 60%)</option>
                    <option value="25">25% Steps (0%, 25%, 50%, 75%)</option>
                  </>
                ) : (
                  <>
                    <option value="2">2 Units Step</option>
                    <option value="5">5 Units Step</option>
                    <option value="10">10 Units Step</option>
                    <option value="20">20 Units Step</option>
                  </>
                )}
              </select>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Forces ticks and background horizontal grid lines to align on uniform increments.
            </p>
          </div>
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
