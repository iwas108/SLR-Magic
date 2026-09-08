import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { Tag, Sliders, Type, RotateCw, AlignLeft, ShieldAlert, Sparkles, Hash, ArrowLeftRight, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DisplayFormatTemplate } from '../../types';

export function UniversalDataLabelPanel() {
  const { config, style } = useVisualizerContext();
  const {
    showDataLabels,
    setShowDataLabels,
    labelFormat = 'ratio_percent',
    setLabelFormat,
    universalLabelPosition = 'auto',
    setUniversalLabelPosition,
    universalLabelDistance = 6,
    setUniversalLabelDistance,
    universalLabelOverflow = 'break',
    setUniversalLabelOverflow,
    universalMaxLabelWidth = 140,
    setUniversalMaxLabelWidth,
    universalLabelLineHeight = 14,
    setUniversalLabelLineHeight,
    universalLabelFontSize,
    setUniversalLabelFontSize,
    universalLabelFontWeight = '600',
    setUniversalLabelFontWeight,
    universalLabelFontStyle = 'normal',
    setUniversalLabelFontStyle,
    universalLabelColor = '',
    setUniversalLabelColor,
    universalLabelColorMode = 'auto_contrast',
    setUniversalLabelColorMode,
    universalLabelRotate = 0,
    setUniversalLabelRotate,
    universalLabelMinThreshold = 0,
    setUniversalLabelMinThreshold,
    universalLabelShowZero = true,
    setUniversalLabelShowZero,
    chartType,
    barLabelContextScope = 'auto',
    setBarLabelContextScope,
    syncLegendAndBarMetrics,
    setSyncLegendAndBarMetrics,
    legendContextScope,
    setLegendContextScope,
    setBarLabelFormat
  } = config;

  return (
    <div className="space-y-4 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
      {/* 1. Header with Master Switch */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          Universal Data Labels & Metrics
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDataLabels}
            onChange={(e) => setShowDataLabels(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-primary"
          />
          <span className="text-xs font-bold text-foreground">Show Labels</span>
        </label>
      </div>

      {showDataLabels && (
        <div className="space-y-4">
          {/* 2. Format Template, Position & Decimal Precision */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Display Metric Template</label>
              <select
                value={labelFormat}
                onChange={(e) => setLabelFormat(e.target.value as DisplayFormatTemplate)}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
              >
                <optgroup label="Standard Prevalence / Proportion">
                  <option value="name_ratio_percent">Name + Ratio + Coarse % (e.g. CNN, n=12/46, ~26%)</option>
                  <option value="ratio_percent">Ratio + Coarse % (n=12/46, ~26%)</option>
                  <option value="name_count_percent">Name + Count + % (e.g. CNN, n=12, ~26%)</option>
                  <option value="count_percent">Count + % (n=12, ~26%)</option>
                  <option value="name_ratio">Name + Ratio (e.g. CNN, n=12/46)</option>
                  <option value="name_count">Name + Count (e.g. CNN, n=12)</option>
                  <option value="name_percent">Name + Percent (e.g. CNN, ~26%)</option>
                  <option value="percent_ratio">Percent + Ratio (~26%, n=12/46)</option>
                  <option value="ratio_only">Ratio Only (n=12/46)</option>
                  <option value="percent_only">Percent Only (~26%) [Matches Metric & Legend]</option>
                  <option value="layer_share">Relative Layer Share (~P% of Layer, Sums to 100%)</option>
                  <option value="name_only">Category Name Only</option>
                </optgroup>
                <optgroup label="Explicit Tag Share Formats">
                  <option value="tag_share_ratio_percent">Tag Share Ratio + % (n=12/54, ~22%)</option>
                  <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + %</option>
                  <option value="tag_share_count_percent">Tag Share Count + % (n=12, ~22%)</option>
                  <option value="name_tag_share_percent">Name + Tag Share % (Name, ~22%)</option>
                </optgroup>
                <optgroup label="Explicit Unique Prevalence Formats">
                  <option value="prevalence_ratio_percent">Prevalence Ratio + % (n=12/46, ~26%)</option>
                  <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + %</option>
                  <option value="count_prevalence_percent">Prevalence Count + % (n=12, ~26%)</option>
                  <option value="dual_prevalence_tag_share">Dual: Prevalence & Tag Share</option>
                </optgroup>
                <optgroup label="Multi-Line Compact Formats">
                  <option value="two_line_count_percent">Multi-line: Count \n Relative %</option>
                  <option value="two_line_count_prevalence_percent">Multi-line: Count \n Prevalence %</option>
                  <option value="two_line_percent_count">Multi-line: (%) \n Count</option>
                  <option value="two_line_ratio_percent">Multi-line: Ratio \n (%)</option>
                  <option value="two_line_name_count_percent">Multi-line: Name \n n=x (%)</option>
                </optgroup>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Label Placement</label>
              <select
                value={universalLabelPosition}
                onChange={(e) => setUniversalLabelPosition(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
              >
                <option value="auto">Auto Adaptive</option>
                <option value="outside">Outside Mark (Clearance)</option>
                <option value="inside">Inside Center</option>
                <option value="top">Top Header</option>
                <option value="right">Right of Mark</option>
                <option value="bottom">Bottom Footer</option>
                <option value="left">Left of Mark</option>
                <option value="insideLeft">Inside Left-Aligned</option>
                <option value="insideRight">Inside Right-Aligned</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Decimal Precision</label>
              <select
                value={config.barLabelDecimals ?? ''}
                onChange={(e) => config.setBarLabelDecimals?.(e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
              >
                <option value="">{`Auto (Follow Reviewer/Legend: ${style.decimalPrecision ?? 0} Decimals)`}</option>
                <option value="0">0 Decimals (e.g. 6% or ~7%)</option>
                <option value="1">1 Decimal (e.g. 5.9% or 6.5%)</option>
                <option value="2">2 Decimals (e.g. 5.88% or 6.52%)</option>
                <option value="3">3 Decimals (e.g. 5.882%)</option>
              </select>
            </div>
          </div>

          {/* Stacked Bar Data Source & Synchronization Intelligence */}
          {chartType === 'stacked_bar' && (
            <div className="p-3 bg-secondary/20 rounded-xl border border-primary/30 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                    Data Label & Legend Synchronizer
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(syncLegendAndBarMetrics)}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSyncLegendAndBarMetrics?.(isChecked);
                      if (isChecked) {
                        if (legendContextScope === 'in_chart_flow' || legendContextScope === 'parent_layer') {
                          setBarLabelContextScope?.('layer_share');
                          setLabelFormat('layer_share');
                          setBarLabelFormat?.('layer_share');
                        } else {
                          setBarLabelContextScope?.('cohort_prevalence');
                          setLabelFormat('count_prevalence_percent');
                          setBarLabelFormat?.('count_prevalence_percent');
                        }
                      }
                    }}
                    className="rounded border-border text-primary w-3.5 h-3.5"
                  />
                  <span className="text-[11px]">Lock In-Sync</span>
                </label>
              </div>

              {/* Real-Time Metric Discrepancy Detector & Advisory Badge */}
              {(() => {
                const isLegendPrevalence = legendContextScope === 'surviving_flow' || legendContextScope === 'global_cohort';
                const isBarLayerShare = !syncLegendAndBarMetrics && 
                  barLabelContextScope !== 'cohort_prevalence' &&
                  (config.barLabelFormat === 'layer_share' || config.barLabelFormat === 'percent_only' || config.barLabelFormat === 'pct_only' || config.stackedNormalized);
                const isMismatch = isLegendPrevalence && isBarLayerShare;

                if (isMismatch) {
                  return (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10.5px]">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div className="flex-1 space-y-1">
                        <div className="font-bold flex items-center justify-between">
                          <span>Metric Discrepancy Detected</span>
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/20 font-mono font-bold">Bar ~6% vs Legend ~10%</span>
                        </div>
                        <p className="opacity-90 leading-tight">
                          Bar data labels are displaying within-layer share (~6%), while the legend is displaying cohort prevalence (~10%). Click below to harmonize.
                        </p>
                      </div>
                    </div>
                  );
                }

                if (syncLegendAndBarMetrics) {
                  return (
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      <span>Harmonized & Locked: Bar labels dynamically mirror active legend context.</span>
                    </div>
                  );
                }

                return null;
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Data Label Context Scope
                  </label>
                  <select
                    value={barLabelContextScope}
                    onChange={(e) => {
                      const newScope = e.target.value as any;
                      setBarLabelContextScope?.(newScope);
                      if (syncLegendAndBarMetrics) {
                        if (newScope === 'layer_share') {
                          setLegendContextScope?.('in_chart_flow');
                          setLabelFormat('layer_share');
                          setBarLabelFormat?.('layer_share');
                        } else if (newScope === 'cohort_prevalence') {
                          setLegendContextScope?.('surviving_flow');
                          setLabelFormat('count_prevalence_percent');
                          setBarLabelFormat?.('count_prevalence_percent');
                        } else if (newScope === 'global_cohort') {
                          setLegendContextScope?.('global_cohort');
                          setLabelFormat('count_prevalence_percent');
                          setBarLabelFormat?.('count_prevalence_percent');
                        }
                      }
                    }}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="auto">Auto (Harmonized with Legend / Metric)</option>
                    <option value="layer_share">Normalized In-Chart Layer Share (~6%)</option>
                    <option value="cohort_prevalence">Active Cohort Prevalence (~10%)</option>
                    <option value="global_cohort">Global Project Cohort (~7%)</option>
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLegendContextScope?.('in_chart_flow');
                      setLabelFormat('layer_share');
                      setBarLabelFormat?.('layer_share');
                    }}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors ${
                      legendContextScope === 'in_chart_flow'
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-card hover:bg-secondary text-foreground'
                    }`}
                    title="Aligns labels and legend to In-Chart Layer Share (~6%)"
                  >
                    <Sparkles className="w-3 h-3 text-primary" />
                    Align In-Chart (~6%)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLegendContextScope?.('surviving_flow');
                      setLabelFormat('count_prevalence_percent');
                      setBarLabelFormat?.('count_prevalence_percent');
                    }}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors ${
                      legendContextScope === 'surviving_flow'
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-card hover:bg-secondary text-foreground'
                    }`}
                    title="Aligns labels and legend to Cohort Prevalence (~10%)"
                  >
                    <RefreshCw className="w-3 h-3 text-primary" />
                    Align Cohort (~10%)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Text Wrapping, Width & Collision Geometry */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-3">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              Text Wrapping & Bounds Clearance
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground block">Word Wrap & Overflow</label>
                <select
                  value={universalLabelOverflow}
                  onChange={(e) => setUniversalLabelOverflow(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <option value="break">Wrap Words (Multi-line)</option>
                  <option value="truncate">Truncate with Ellipsis (...)</option>
                  <option value="none">No Truncation</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-foreground">Max Label Width</label>
                  <span className="text-[10px] font-mono text-primary font-bold">{universalMaxLabelWidth}px</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={450}
                  step={5}
                  value={universalMaxLabelWidth}
                  onChange={(e) => setUniversalMaxLabelWidth(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-foreground">Label Distance Offset</label>
                  <span className="text-[10px] font-mono text-primary font-bold">{universalLabelDistance}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={35}
                  value={universalLabelDistance}
                  onChange={(e) => setUniversalLabelDistance(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-foreground">Line Height</label>
                  <span className="text-[10px] font-mono text-primary font-bold">{universalLabelLineHeight}px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={36}
                  value={universalLabelLineHeight}
                  onChange={(e) => setUniversalLabelLineHeight(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground block">Label Rotation Angle</label>
                <select
                  value={universalLabelRotate}
                  onChange={(e) => setUniversalLabelRotate(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <option value={0}>0° (Horizontal)</option>
                  <option value={15}>15° Slight Tilt</option>
                  <option value={30}>30° Inclined</option>
                  <option value={45}>45° Diagonal</option>
                  <option value={90}>90° Vertical</option>
                  <option value={-45}>-45° Counter-Diagonal</option>
                  <option value={-90}>-90° Downward</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Typography & High-Contrast Colors */}
          <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-3">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              Label Typography & Color Shading
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground">Size ({universalLabelFontSize ? `${universalLabelFontSize}px` : 'Auto'})</label>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="range"
                    min={8}
                    max={28}
                    value={universalLabelFontSize ?? 11}
                    onChange={(e) => setUniversalLabelFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  {universalLabelFontSize !== undefined && (
                    <button
                      type="button"
                      onClick={() => setUniversalLabelFontSize(undefined)}
                      className="text-[9px] px-1 py-0.5 bg-card hover:bg-secondary text-muted-foreground rounded border border-border"
                      title="Reset to theme auto"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Font Weight</label>
                <select
                  value={universalLabelFontWeight}
                  onChange={(e) => setUniversalLabelFontWeight(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <option value="normal">Normal (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">SemiBold (600)</option>
                  <option value="bold">Bold (700)</option>
                  <option value="800">ExtraBold (800)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Font Style</label>
                <select
                  value={universalLabelFontStyle}
                  onChange={(e) => setUniversalLabelFontStyle(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Color Mode</label>
                <select
                  value={universalLabelColorMode}
                  onChange={(e) => setUniversalLabelColorMode(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <option value="auto_contrast">Auto-Contrast (Luminance)</option>
                  <option value="theme">Theme Default</option>
                  <option value="custom">Custom Color</option>
                </select>
              </div>
            </div>

            {universalLabelColorMode === 'custom' && (
              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-bold text-muted-foreground">Custom Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={universalLabelColor || '#1e293b'}
                    onChange={(e) => setUniversalLabelColor(e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={universalLabelColor}
                    onChange={(e) => setUniversalLabelColor(e.target.value)}
                    placeholder="Enter custom hex code..."
                    className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Filtering & Threshold Edge Cases */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">Min Label Threshold ({universalLabelMinThreshold})</label>
                <span className="text-[10px] text-muted-foreground font-mono">Hide small slivers</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={universalLabelMinThreshold}
                onChange={(e) => setUniversalLabelMinThreshold(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-xl border border-border/50">
              <div>
                <span className="text-xs font-bold text-foreground block">Render Zero Values</span>
                <span className="text-[10px] text-muted-foreground block">Show labels for 0-count entries</span>
              </div>
              <input
                type="checkbox"
                checked={universalLabelShowZero}
                onChange={(e) => setUniversalLabelShowZero(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
