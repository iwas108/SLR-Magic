import React from 'react';
import { AlignHorizontalJustifyStart, AlignVerticalJustifyStart, Sparkles } from 'lucide-react';
import { THEME_PALETTES } from '../../constants/themePalettes';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { getMappedFieldValue } from '../../utils/dataExtractor';

export function ClusteredBarConfigPanel() {
  const { props, config, style } = useVisualizerContext();
  const { papers, umbrellanizerMap } = props;
  const {
    secondaryField,
    metricMode,
    barSorting,
    setBarSorting,
    barOrientation = 'horizontal',
    setBarOrientation,
    barThickness,
    setBarThickness,
    barBorderRadius,
    setBarBorderRadius,
    barClusterGap = 20,
    setBarClusterGap,
    barInnerGap = 15,
    setBarInnerGap,
    enableErrorBars = false,
    setEnableErrorBars,
    errorBarType = 'std_error',
    setErrorBarType,
    enableHatchPatterns = false,
    setEnableHatchPatterns,
    barLabelPosition,
    setBarLabelPosition,
    barLabelFormat,
    setBarLabelFormat,
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
    setBarBenchmarkColor,
    customSliceColors,
    updateActiveSlot,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields
  } = config;

  const isHorizontal = barOrientation === 'horizontal';
  const isAvgMetric = metricMode === 'avg_qa' || metricMode === 'avg_citation';

  // Discover all unique series values for the series color overrides
  const mappedOpts = {
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    primaryField: secondaryField
  };

  const detectedSeries = React.useMemo(() => {
    const set = new Set<string>();
    papers.forEach(p => {
      const vals = getMappedFieldValue(p, secondaryField, mappedOpts);
      vals.forEach(v => set.add(v));
    });
    return Array.from(set).sort();
  }, [papers, secondaryField, mappedOpts]);

  return (
    <div className="space-y-4">
      {/* 1. Orientation Switcher */}
      <div className="p-3 bg-secondary/40 border border-border/70 rounded-xl space-y-2">
        <label className="text-xs font-bold text-foreground block">
          Bar Layout Orientation (Scientific Publishing Format)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBarOrientation('horizontal')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              isHorizontal
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card border-border hover:bg-secondary/60 text-muted-foreground'
            }`}
          >
            <AlignHorizontalJustifyStart className="w-4 h-4" />
            Horizontal Bars (Recommended for Long Labels)
          </button>

          <button
            type="button"
            onClick={() => setBarOrientation('vertical')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              !isHorizontal
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card border-border hover:bg-secondary/60 text-muted-foreground'
            }`}
          >
            <AlignVerticalJustifyStart className="w-4 h-4" />
            Vertical Columns (Standard Grid)
          </button>
        </div>
      </div>

      {/* 2. Sorting & Label Customization */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Cluster Sorting</label>
          <select
            value={barSorting}
            onChange={(e) => setBarSorting(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="desc">Descending (Largest Cluster Total)</option>
            <option value="asc">Ascending (Smallest Cluster Total)</option>
            <option value="none">Alphabetical / Natural Order</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Value Label Position</label>
          <select
            value={barLabelPosition}
            onChange={(e) => setBarLabelPosition(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="right">{isHorizontal ? 'Right (Outside Bar)' : 'Top (Outside Column)'}</option>
            <option value="inside">Inside (Center of Bar)</option>
            <option value="insideLeft">Inside (Left Base)</option>
            <option value="insideRight">Inside (Bar Edge)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Value Label Format</label>
          <select
            value={barLabelFormat}
            onChange={(e) => setBarLabelFormat(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="value">Metric Value Only</option>
            <option value="value_pct">Value + Percentage (N & %)</option>
            <option value="pct_only">Percentage Only (%)</option>
          </select>
        </div>
      </div>

      {/* 3. Sizing & Multi-Series Gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-secondary/20 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Bar Thickness ({barThickness}px)</label>
          <input
            type="range"
            min={6}
            max={40}
            value={barThickness}
            onChange={(e) => setBarThickness(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Intra-Series Gap ({barInnerGap}%)</label>
          <input
            type="range"
            min={0}
            max={60}
            value={barInnerGap}
            onChange={(e) => setBarInnerGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Cluster Spacing ({barClusterGap}%)</label>
          <input
            type="range"
            min={0}
            max={80}
            value={barClusterGap}
            onChange={(e) => setBarClusterGap(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Corner Radius ({barBorderRadius}px)</label>
          <input
            type="range"
            min={0}
            max={12}
            value={barBorderRadius}
            onChange={(e) => setBarBorderRadius(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 4. Y-Axis Label Width, Line Height & Overflow (When Horizontal) */}
      {isHorizontal && (
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
              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="break">Word Wrap</option>
              <option value="truncate">Truncate (...)</option>
              <option value="none">Full Length</option>
            </select>
          </div>
        </div>
      )}

      {/* 5. Scientific Publishing Accessibility & Error Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Texture Hatching for Monochrome Print */}
        <div className="p-3 bg-secondary/30 border border-border/70 rounded-xl space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={enableHatchPatterns}
              onChange={(e) => setEnableHatchPatterns(e.target.checked)}
              className="rounded border-border text-primary"
            />
            Academic Texture Hatching (Print / Grayscale)
          </label>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Applies distinct monochrome SVG patterns (stripes, cross-hatch, stippling) to differentiate series in black-and-white print.
          </p>
        </div>

        {/* Statistical Error Bars */}
        <div className="p-3 bg-secondary/30 border border-border/70 rounded-xl space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={enableErrorBars}
              disabled={!isAvgMetric}
              onChange={(e) => setEnableErrorBars(e.target.checked)}
              className="rounded border-border text-primary disabled:opacity-50"
            />
            Scientific Error Bars (Variance Indicators)
          </label>
          {isAvgMetric ? (
            <div className="space-y-1">
              <select
                value={errorBarType}
                disabled={!enableErrorBars}
                onChange={(e) => setErrorBarType(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold disabled:opacity-50"
              >
                <option value="std_error">Standard Error (± SE)</option>
                <option value="std_dev">Standard Deviation (± SD)</option>
                <option value="ci_95">95% Confidence Interval (± 1.96 SE)</option>
              </select>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              Active only when metric is Average QA Score or Average Citation Count.
            </p>
          )}
        </div>
      </div>

      {/* 6. Series Custom Color Palette Overrides */}
      {detectedSeries.length > 0 && (
        <div className="p-3 bg-secondary/20 border border-border/60 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Comparison Series Custom Color Overrides
            </label>
            <span className="text-[10px] text-muted-foreground">
              {detectedSeries.length} series detected
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {detectedSeries.map((sName, sIdx) => {
              const palette = THEME_PALETTES[style.themePreset] || THEME_PALETTES.ieee_blue;
              const currentVal = customSliceColors[sName] || palette.colors[sIdx % palette.colors.length] || '#3b82f6';
              return (
                <div key={sName} className="p-2 rounded-lg bg-card border border-border/60 space-y-1">
                  <span className="text-[11px] font-bold text-foreground block truncate" title={sName}>
                    {sName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={currentVal}
                      onChange={(e) => {
                        updateActiveSlot({
                          customSliceColors: {
                            ...customSliceColors,
                            [sName]: e.target.value
                          }
                        });
                      }}
                      className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={currentVal}
                      onChange={(e) => {
                        updateActiveSlot({
                          customSliceColors: {
                            ...customSliceColors,
                            [sName]: e.target.value
                          }
                        });
                      }}
                      className="w-full bg-secondary border border-border rounded px-1 py-0.5 text-[10px] font-mono font-bold text-foreground"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Reference Benchmark Line */}
      <div className="p-3 bg-secondary/30 border border-border/70 rounded-xl space-y-2.5">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
          <input
            type="checkbox"
            checked={barBenchmarkLine}
            onChange={(e) => setBarBenchmarkLine(e.target.checked)}
            className="rounded border-border text-primary"
          />
          Show Reference Benchmark Line
        </label>

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
