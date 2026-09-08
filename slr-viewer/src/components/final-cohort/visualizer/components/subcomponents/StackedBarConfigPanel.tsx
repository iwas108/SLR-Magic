import React, { useMemo } from 'react';
import { 
  AlignHorizontalJustifyStart, 
  AlignVerticalJustifyStart, 
  Sparkles, 
  SlidersHorizontal, 
  Palette, 
  BarChart3, 
  Eye, 
  Percent, 
  ArrowDownUp, 
  FileText,
  RotateCcw,
  Tag
} from 'lucide-react';
import { THEME_PALETTES } from '../../constants/themePalettes';
import { generateDistinctPalette } from '../../utils/colorUtils';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { getMappedFieldValue, formatVariableDisplayName, extractCleanTaxonomyKey, extractTokenPaths } from '../../utils/dataExtractor';
import { getLayerAbbreviation } from '../../generators/categoricalBarGenerators';
export function StackedBarConfigPanel() {
  const { props, config, style, data } = useVisualizerContext();
  const { papers, umbrellanizerMap } = props;
  const {
    primaryField,
    secondaryField,
    metricMode,
    barSorting = 'none',
    setBarSorting,
    barOrientation = 'vertical',
    setBarOrientation,
    barThickness = 28,
    setBarThickness,
    barBorderRadius = 2,
    setBarBorderRadius,
    barGap = 30,
    setBarGap,
    stackedNormalized = false,
    setStackedNormalized,
    stackedReverseOrder = false,
    setStackedReverseOrder,
    stackedPerBarSorting = 'none',
    setStackedPerBarSorting,
    stackedShowTotalLabel = false,
    setStackedShowTotalLabel,
    stackedTotalLabelPosition = 'top',
    setStackedTotalLabelPosition,
    stackedTotalLabelFormat = '{total}',
    setStackedTotalLabelFormat,
    stackedTotalFontSize = 11,
    setStackedTotalFontSize,
    stackedTotalFontWeight = 'bold',
    setStackedTotalFontWeight,
    stackedTotalColor = '',
    setStackedTotalColor,
    stackedTotalLabelDistance = 4,
    setStackedTotalLabelDistance,
    showDataLabels = false,
    setShowDataLabels,
    barLabelPosition = 'inside',
    setBarLabelPosition,
    barLabelFormat = 'count_only',
    setBarLabelFormat,
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
    barLabelDistance = 4,
    setBarLabelDistance,
    barLabelShowZero = true,
    setBarLabelShowZero,
    barLabelMinThreshold = 0,
    setBarLabelMinThreshold,
    barLabelDecimals,
    setBarLabelDecimals,
    barValueCeiling = 'auto',
    setBarValueCeiling,
    barValueInterval = 'auto',
    setBarValueInterval,
    barYAxisWidth = 120,
    setBarYAxisWidth,
    barYAxisOverflow = 'break',
    setBarYAxisOverflow,
    barYAxisFontSize = 11,
    setBarYAxisFontSize,
    barBenchmarkLine = false,
    setBarBenchmarkLine,
    barBenchmarkValue = 0,
    setBarBenchmarkValue,
    barBenchmarkLabel = '',
    setBarBenchmarkLabel,
    barBenchmarkStyle = 'dashed',
    setBarBenchmarkStyle,
    barBenchmarkColor = '#ef4444',
    setBarBenchmarkColor,
    enableHatchPatterns = false,
    setEnableHatchPatterns,
    customSliceColors = {},
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    secondaryScopeFilter,
    levelScopeFilters,
    levelSegmentIndices,
    legendContextScope,
    setLegendContextScope,
    syncLegendAndBarMetrics,
    setSyncLegendAndBarMetrics,
    barLabelContextScope,
    setBarLabelContextScope,
    legendShowParentPrefix,
    setLegendShowParentPrefix,
    barLegendFormat,
    setBarLegendFormat,
    updateActiveSlot
  } = config;

  const isHorizontal = barOrientation === 'horizontal';
  const isPctMetric = metricMode === 'paper_prevalence' || metricMode === 'tag_share' || stackedNormalized;

  // Support inline bracket scope syntax (e.g. "ext:lv1:rq_algo[Biological Asset]")
  const secBracket = secondaryField ? secondaryField.match(/^(.*?)\[(?:scope=)?(.*?)\]$/) : null;
  const cleanSecField = secBracket ? secBracket[1].trim() : secondaryField;
  const effectiveSecScope = secondaryScopeFilter || levelScopeFilters?.[1] || (secBracket ? secBracket[2].trim() : undefined);

  // Discover all unique series values for the series color overrides
  const primBracket = primaryField ? primaryField.match(/^(.*?)\[(?:scope=)?(.*?)\]$/) : null;
  const cleanPrimField = primBracket ? primBracket[1].trim() : primaryField;
  const effectivePrimScope = config.primaryScopeFilter || levelScopeFilters?.[0] || (primBracket ? primBracket[2].trim() : undefined);

  const primBaseKey = extractCleanTaxonomyKey(cleanPrimField || '');
  const secBaseKey = extractCleanTaxonomyKey(cleanSecField || '');
  const isSharedTaxonomy = Boolean(primBaseKey && secBaseKey && primBaseKey === secBaseKey);

  const mappedOpts = useMemo(() => ({
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    primaryField: cleanSecField,
    levelIdx: 1,
    subFieldKey: data.levelTargetFields?.[1],
    segmentIdx: levelSegmentIndices?.[1],
    scopeFilter: effectiveSecScope
  }), [useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty, customCategoryMap, levelCustomGroupLinks, sankeyFields, cleanSecField, data.levelTargetFields, levelSegmentIndices, effectiveSecScope]);

  const detectedSeries = useMemo(() => {
    const set = new Set<string>();
    if (isSharedTaxonomy && cleanPrimField) {
      papers.forEach(p => {
        const paths = extractTokenPaths(p, cleanPrimField, mappedOpts);
        paths.forEach(path => {
          if (path.length >= 2) {
            const pv = path[0];
            const sv = path[1];
            if (pv && sv) {
              set.add(`${pv}:::${sv}`);
            }
          }
        });
      });
    } else {
      papers.forEach(p => {
        const vals = getMappedFieldValue(p, cleanSecField, mappedOpts);
        vals.forEach(v => {
          if (v && v !== '[object Object]') set.add(v);
        });
      });
    }
    return Array.from(set).sort();
  }, [papers, cleanPrimField, cleanSecField, isSharedTaxonomy, mappedOpts]);

  const handleSetSeriesColor = (seriesName: string, color: string) => {
    const cleanSub = seriesName.includes(':::') ? seriesName.split(':::')[1] : seriesName;
    updateActiveSlot({
      customSliceColors: {
        ...(customSliceColors || {}),
        [seriesName]: color,
        [cleanSub]: color
      }
    });
  };

  const handleResetAllSeriesColors = () => {
    updateActiveSlot({
      customSliceColors: {}
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Orientation & 100% Normalized Proportions */}
      <div className="p-3 bg-secondary/30 border border-border/70 rounded-xl space-y-3">
        <label className="text-xs font-bold text-foreground block">
          Layout Orientation & Stacking Dimension
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBarOrientation?.('horizontal')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              isHorizontal
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card border-border hover:bg-secondary/60 text-muted-foreground'
            }`}
          >
            <AlignHorizontalJustifyStart className="w-4 h-4" />
            Horizontal Stacked Bars (Recommended for Long Labels)
          </button>

          <button
            type="button"
            onClick={() => setBarOrientation?.('vertical')}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
              !isHorizontal
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card border-border hover:bg-secondary/60 text-muted-foreground'
            }`}
          >
            <AlignVerticalJustifyStart className="w-4 h-4" />
            Vertical Stacked Columns (Chronological & Trends)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* 100% Normalized Toggle */}
          <div className="p-2.5 bg-card rounded-lg border border-border/70 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-primary" />
                100% Normalized Stacks
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Scale each bar to 100% height to compare relative proportions
              </span>
            </div>
            <input
              type="checkbox"
              checked={stackedNormalized}
              onChange={(e) => setStackedNormalized?.(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary accent-primary cursor-pointer"
            />
          </div>

          {/* Reverse Stacking Order Toggle */}
          <div className="p-2.5 bg-card rounded-lg border border-border/70 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ArrowDownUp className="w-3.5 h-3.5 text-primary" />
                Reverse Stacking Order
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Invert the bottom-to-top visual order of stacked series
              </span>
            </div>
            <input
              type="checkbox"
              checked={stackedReverseOrder}
              onChange={(e) => setStackedReverseOrder?.(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary accent-primary cursor-pointer"
            />
          </div>
        </div>

        {/* Smart Legend Grouping & Badges */}
        <div className="p-3 bg-secondary/30 rounded-xl border border-border/60 space-y-2.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary block">
            Smart Legend Grouping & Disambiguation
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Layer Prefix Badge Style</label>
              <select
                value={config.legendParentPrefixStyle || 'abbreviated'}
                onChange={(e) => config.setLegendParentPrefixStyle?.(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="abbreviated">Smart Abbreviation (e.g. [App], [Net], [Link])</option>
                <option value="full">Full Layer Name (e.g. [Application/Middleware])</option>
                <option value="colliding_only">Colliding Only (e.g. [App] Security / [Net] Security)</option>
                <option value="none">None (Clean Protocol / Subcategory Name Only)</option>
              </select>
            </div>
            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 p-1.5 rounded-lg bg-card border border-border/60 cursor-pointer text-xs font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={config.legendGroupByParent ?? true}
                  onChange={(e) => config.setLegendGroupByParent?.(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary accent-primary cursor-pointer"
                />
                <span>Group Legend by Parent Layer</span>
              </label>
            </div>
          </div>
        </div>

        {metricMode === 'paper_prevalence' && !stackedNormalized && (
          <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Scientific Advisory: Non-Mutually Exclusive Stacks</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              In multi-label systematic reviews, papers can adopt multiple categories simultaneously (e.g. Wi-Fi and Cellular). Stacking raw adoption prevalences causes bars to exceed 100%, conflating adoption rate with compositional share.
            </p>
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              <button
                type="button"
                onClick={() => setStackedNormalized?.(true)}
                className="px-2.5 py-1 rounded-md text-[10.5px] font-extrabold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-xs"
              >
                Enable 100% Normalized Stacks (Recommended for Composition)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Sorting & Geometry Spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Category Sorting</label>
          <select
            value={barSorting}
            onChange={(e) => setBarSorting?.(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="none">Chronological / Natural (Preserve Years)</option>
            <option value="desc">Descending (Largest Total Volume First)</option>
            <option value="asc">Ascending (Smallest Total Volume First)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Per-Bar Segment Sorting</label>
          <select
            value={stackedPerBarSorting}
            onChange={(e) => setStackedPerBarSorting?.(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
          >
            <option value="none">Global Order (Aligned Across Stacks)</option>
            <option value="desc">Smart Per-Bar: Largest First (Solves Left Overflow)</option>
            <option value="asc">Smart Per-Bar: Smallest First</option>
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-bold text-foreground">
            <span>Bar Width ({barThickness}px)</span>
          </div>
          <input
            type="range"
            min={8}
            max={72}
            value={barThickness}
            onChange={(e) => setBarThickness?.(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-bold text-foreground">
            <span>Corner Radius ({barBorderRadius}px)</span>
          </div>
          <input
            type="range"
            min={0}
            max={16}
            value={barBorderRadius}
            onChange={(e) => setBarBorderRadius?.(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs font-bold text-foreground">
            <span>Category Gap ({barGap}%)</span>
          </div>
          <input
            type="range"
            min={0}
            max={120}
            value={barGap}
            onChange={(e) => setBarGap?.(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* 3. Stack Segment Data Labels */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">Segment Data Labels Typography & Layout</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={showDataLabels}
              onChange={(e) => setShowDataLabels?.(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary accent-primary"
            />
            <span>Show Segment Labels</span>
          </label>
        </div>

        {showDataLabels && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Label Position</label>
                <select
                  value={barLabelPosition}
                  onChange={(e) => setBarLabelPosition?.(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="inside">Inside Center (Recommended)</option>
                  <option value="insideLeft">{isHorizontal ? 'Inside Base (Left)' : 'Inside Base (Bottom)'}</option>
                  <option value="insideRight">{isHorizontal ? 'Inside Edge (Right)' : 'Inside Edge (Top)'}</option>
                  <option value="top">{isHorizontal ? 'Outside Bar (Right)' : 'Outside Column (Top)'}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Label Format</label>
                <select
                  value={barLabelFormat}
                  onChange={(e) => setBarLabelFormat?.(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
                >
                  <optgroup label="Standard Formats">
                    <option value="percent_only">Harmonized % (~P%) [Matches Metric & Legend]</option>
                    <option value="layer_share">Relative Layer Share (~P% of Layer, Sums to 100%)</option>
                    <option value="prevalence_percent_only">Cohort Adoption Prevalence (Raw %)</option>
                    <option value="count_only">Count Only (n = x)</option>
                    <option value="count_percent">Count + Relative % (n = x, ~P%)</option>
                    <option value="count_prevalence_percent">Count + Prevalence (n = x, ~P%) [Matches Legend]</option>
                    <option value="ratio_percent">Ratio (n = x/Total)</option>
                  </optgroup>
                  <optgroup label="Multi-Line Compact">
                    <option value="two_line_count_percent">Two-Line: Count & Relative % (n \n ~P%)</option>
                    <option value="two_line_count_prevalence_percent">Two-Line: Count & Prevalence (n \n ~P%)</option>
                  </optgroup>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Decimal Places</label>
                <select
                  value={barLabelDecimals ?? ''}
                  onChange={(e) => setBarLabelDecimals?.(e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="">{`Auto (Follow Reviewer/Legend: ${style.decimalPrecision ?? 0} Decimals)`}</option>
                  <option value="0">0 Decimals (e.g. 6% or ~7%)</option>
                  <option value="1">1 Decimal (e.g. 5.9% or 6.5%)</option>
                  <option value="2">2 Decimals (e.g. 5.88% or 6.52%)</option>
                  <option value="3">3 Decimals (e.g. 5.882%)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Text Color Mode</label>
                <select
                  value={
                    barLabelColor === '' || barLabelColor === 'auto_contrast'
                      ? 'auto_contrast'
                      : barLabelColor === 'match_series'
                      ? 'match_series'
                      : barLabelColor === 'foreground'
                      ? 'foreground'
                      : barLabelColor === '#ffffff'
                      ? '#ffffff'
                      : barLabelColor === '#111827'
                      ? '#111827'
                      : 'custom'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'auto_contrast') setBarLabelColor?.('');
                    else if (val === 'custom') setBarLabelColor?.(barLabelColor && barLabelColor.startsWith('#') ? barLabelColor : '#0f172a');
                    else setBarLabelColor?.(val);
                  }}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="auto_contrast">Dynamic Auto-Contrast (White/Dark by Background)</option>
                  <option value="match_series">Match Series Bar Color</option>
                  <option value="foreground">Theme High-Contrast Text</option>
                  <option value="#ffffff">Solid Pure White (#FFFFFF)</option>
                  <option value="#111827">Solid Dark Slate (#111827)</option>
                  <option value="custom">Custom Color (Hex/Picker)</option>
                </select>
              </div>
            </div>

            {/* Custom Text Color Picker if Custom */}
            {barLabelColor !== '' && barLabelColor !== 'auto_contrast' && barLabelColor !== 'match_series' && barLabelColor !== 'foreground' && (
              <div className="p-2 bg-secondary/40 rounded-lg border border-border flex items-center gap-2">
                <input
                  type="color"
                  value={barLabelColor.startsWith('#') && barLabelColor.length === 7 ? barLabelColor : '#0f172a'}
                  onChange={(e) => setBarLabelColor?.(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border border-border"
                />
                <input
                  type="text"
                  value={barLabelColor}
                  onChange={(e) => setBarLabelColor?.(e.target.value)}
                  placeholder="#0f172a"
                  className="w-24 bg-card border border-border rounded px-2 py-0.5 text-xs font-mono font-bold text-foreground"
                />
                <span className="text-[10px] text-muted-foreground">Custom Hex Color</span>
              </div>
            )}

            {/* Font Typography Sliders */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
                  <span>Font Size</span>
                  <span className="text-primary font-mono">{barLabelFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={28}
                  value={barLabelFontSize}
                  onChange={(e) => setBarLabelFontSize?.(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-foreground block">Font Weight</label>
                <select
                  value={barLabelFontWeight}
                  onChange={(e) => setBarLabelFontWeight?.(e.target.value as any)}
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
                <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
                  <span>Rotation</span>
                  <span className="text-primary font-mono">{barLabelRotate}°</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={15}
                    value={barLabelRotate}
                    onChange={(e) => setBarLabelRotate?.(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setBarLabelRotate?.(0)}
                    className="text-[10px] px-1 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground font-mono"
                  >
                    0°
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
                  <span>Min Threshold Cutoff</span>
                  <span className="text-primary font-mono">{barLabelMinThreshold > 0 ? `${barLabelMinThreshold}%` : 'Off'}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={1}
                  value={barLabelMinThreshold}
                  onChange={(e) => setBarLabelMinThreshold?.(Number(e.target.value))}
                  className="w-full accent-primary"
                  title="Hide labels on tiny slices to prevent overlapping clutter"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={!barLabelShowZero}
                  onChange={(e) => setBarLabelShowZero?.(!e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-primary accent-primary"
                />
                <span>Hide Zero/Empty Slices</span>
              </label>
              <span className="text-[10.5px] text-muted-foreground font-medium">
                Clutter prevention active: slices &lt; {barLabelMinThreshold}% omitted
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Stack Summit / Total Summary Labels (Academic Publishing Feature) */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">Stack Summit / Total Summary Labels</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={stackedShowTotalLabel}
              onChange={(e) => setStackedShowTotalLabel?.(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary accent-primary"
            />
            <span>Show Stack Totals</span>
          </label>
        </div>

        {stackedShowTotalLabel && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-foreground block">Total Label Format</label>
              <select
                value={stackedTotalLabelFormat}
                onChange={(e) => setStackedTotalLabelFormat?.(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="{total}">Count Only ({'{total}'})</option>
                <option value="Total: {total}">Prefix: Total: {'{total}'}</option>
                <option value="N = {total}">Academic: N = {'{total}'}</option>
                <option value="{total} studies">Studies: {'{total}'} studies</option>
                <option value="n={total}">Sample: n={'{total}'}</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
                <span>Total Font Size</span>
                <span className="text-primary font-mono">{stackedTotalFontSize}px</span>
              </div>
              <input
                type="range"
                min={9}
                max={22}
                value={stackedTotalFontSize}
                onChange={(e) => setStackedTotalFontSize?.(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-foreground block">Total Font Weight</label>
              <select
                value={stackedTotalFontWeight}
                onChange={(e) => setStackedTotalFontWeight?.(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
              >
                <option value="bold">Bold (700 - Recommended)</option>
                <option value="800">Black (800)</option>
                <option value="600">Semi-Bold (600)</option>
                <option value="normal">Normal (400)</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
                <span>Offset Distance</span>
                <span className="text-primary font-mono">{stackedTotalLabelDistance}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={stackedTotalLabelDistance}
                onChange={(e) => setStackedTotalLabelDistance?.(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. Scientific Axis, Overflow & Gridlines */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5 pb-1 border-b border-border/50">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
          Axis Layout, Overflow & Gridlines
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-foreground block">Category Label Overflow</label>
            <select
              value={barYAxisOverflow}
              onChange={(e) => setBarYAxisOverflow?.(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="break">Wrap / Multi-Line (Academic)</option>
              <option value="truncate">Truncate with Ellipsis (…)</option>
              <option value="none">None (Full Text)</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10.5px] font-bold text-foreground">
              <span>Category Max Width</span>
              <span className="text-primary font-mono">{barYAxisWidth}px</span>
            </div>
            <input
              type="range"
              min={60}
              max={280}
              step={10}
              value={barYAxisWidth}
              onChange={(e) => setBarYAxisWidth?.(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-foreground block">Value Axis Ceiling</label>
            <select
              value={barValueCeiling}
              onChange={(e) => setBarValueCeiling?.(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="auto">Auto (Tight Fit)</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="150">150</option>
              <option value="200">200</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-foreground block">Monochrome Hatch Patterns</label>
            <label className="flex items-center gap-2 p-1.5 bg-card border border-border rounded-lg cursor-pointer text-xs font-bold text-foreground mt-0.5">
              <input
                type="checkbox"
                checked={enableHatchPatterns}
                onChange={(e) => setEnableHatchPatterns?.(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary accent-primary"
              />
              <span>B&amp;W Print Hatch</span>
            </label>
          </div>
        </div>
      </div>

      {/* 6. Per-Series Color Customization & Overrides */}
      {detectedSeries.length > 0 && (
        <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Per-Series Stack Color Overrides ({detectedSeries.length} Series)
              </span>
            </div>
            {Object.keys(customSliceColors || {}).length > 0 && (
              <button
                type="button"
                onClick={handleResetAllSeriesColors}
                className="text-[10px] font-bold text-destructive hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Reset Overrides
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {detectedSeries.map((stkName, sIdx) => {
              const activePalette = THEME_PALETTES[style.themePreset] || THEME_PALETTES.ieee_blue;
              const distinctPalette = generateDistinctPalette(activePalette.colors, detectedSeries.length);
              const assignedColor = customSliceColors?.[stkName] || distinctPalette[sIdx] || '#3b82f6';
              const cleanSub = stkName.includes(':::') ? stkName.split(':::')[1] : stkName;
              const parentLayer = stkName.includes(':::') ? stkName.split(':::')[0] : '';
              const badge = parentLayer ? `[${getLayerAbbreviation(parentLayer)}] ` : '';
              const displayTitle = `${badge}${cleanSub}`;
              return (
                <div
                  key={stkName}
                  className="flex items-center justify-between p-1.5 px-2 bg-card rounded-lg border border-border/70 gap-2"
                >
                  <span className="text-[11px] font-bold text-foreground truncate" title={`${parentLayer ? `${parentLayer}: ` : ''}${cleanSub}`}>
                    {displayTitle}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="color"
                      value={assignedColor.startsWith('#') && assignedColor.length === 7 ? assignedColor : '#3b82f6'}
                      onChange={(e) => handleSetSeriesColor(stkName, e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border border-border/80 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={assignedColor}
                      onChange={(e) => handleSetSeriesColor(stkName, e.target.value)}
                      className="w-16 bg-transparent border-0 text-[10px] font-mono font-bold text-muted-foreground focus:text-foreground"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Target Benchmark Reference Line */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" />
            Target Benchmark Reference Line
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={barBenchmarkLine}
              onChange={(e) => setBarBenchmarkLine?.(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary accent-primary"
            />
            <span>Enable Line</span>
          </label>
        </div>

        {barBenchmarkLine && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-foreground block">Benchmark Value</label>
              <input
                type="number"
                value={barBenchmarkValue}
                onChange={(e) => setBarBenchmarkValue?.(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-foreground block">Line Label</label>
              <input
                type="text"
                value={barBenchmarkLabel}
                onChange={(e) => setBarBenchmarkLabel?.(e.target.value)}
                placeholder="Target Benchmark"
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-foreground block">Line Style</label>
              <select
                value={barBenchmarkStyle}
                onChange={(e) => setBarBenchmarkStyle?.(e.target.value as any)}
                className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
              >
                <option value="dashed">Dashed</option>
                <option value="solid">Solid</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-foreground block">Line Color</label>
              <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1">
                <input
                  type="color"
                  value={barBenchmarkColor.startsWith('#') && barBenchmarkColor.length === 7 ? barBenchmarkColor : '#ef4444'}
                  onChange={(e) => setBarBenchmarkColor?.(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={barBenchmarkColor}
                  onChange={(e) => setBarBenchmarkColor?.(e.target.value)}
                  className="w-20 bg-transparent text-[10.5px] font-mono font-bold text-foreground border-0"
                />
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}