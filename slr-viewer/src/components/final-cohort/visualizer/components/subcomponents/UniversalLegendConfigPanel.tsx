import React, { useState } from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { 
  Sliders, 
  Layout, 
  Type, 
  Palette, 
  Sparkles, 
  RefreshCw, 
  ArrowLeftRight, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight,
  Layers,
  Box,
  AlignLeft,
  Maximize2
} from 'lucide-react';
import type { DisplayFormatTemplate, FontFamily } from '../../types';
import { FONT_FAMILIES } from '../../constants/fontFamilies';

type LegendSubTab = 'placement' | 'typography' | 'frame' | 'hierarchy';

export function UniversalLegendConfigPanel() {
  const { config, style } = useVisualizerContext();
  const {
    chartType,
    showLegend,
    setShowLegend,
    legendPosition,
    setLegendPosition,
    legendDistance = 20,
    setLegendDistance,
    legendItemGap = 12,
    setLegendItemGap,
    legendFontSize = 10,
    setLegendFontSize,
    legendFontFamily = 'inherit',
    setLegendFontFamily,
    legendFontWeight = 'normal',
    setLegendFontWeight,
    legendFontStyle = 'normal',
    setLegendFontStyle,
    legendTextColor = '',
    setLegendTextColor,
    legendLineHeight = 15,
    setLegendLineHeight,
    legendWrapWidth = 120,
    setLegendWrapWidth,
    legendOverflow = 'break',
    setLegendOverflow,
    legendIcon = 'inherit',
    setLegendIcon,
    legendItemWidth = 25,
    setLegendItemWidth,
    legendItemHeight = 14,
    setLegendItemHeight,
    legendFormat = 'name',
    setLegendFormat,
    legendContextScope,
    setLegendContextScope,
    legendShowParentPrefix,
    setLegendShowParentPrefix,
    legendBackgroundColor = 'transparent',
    setLegendBackgroundColor,
    legendBorderColor = 'transparent',
    setLegendBorderColor,
    legendBorderWidth = 0,
    setLegendBorderWidth,
    legendBorderRadius = 4,
    setLegendBorderRadius,
    legendPadding = 5,
    setLegendPadding
  } = config;

  const [isExpanded, setIsExpanded] = useState(true);
  const [subTab, setSubTab] = useState<LegendSubTab>('placement');

  const isHierarchicalChart = chartType === 'stacked_bar' || Boolean(config.secondaryField);

  return (
    <div className="space-y-4 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
      {/* Header Bar with Accordion & Master Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
          <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Layout className="w-3.5 h-3.5" />
            Universal Legend & Keys Configurator
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-secondary border border-border/60 text-muted-foreground">
            {legendPosition.toUpperCase()}
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showLegend}
            onChange={(e) => setShowLegend(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-primary accent-primary"
          />
          <span className="text-xs font-bold text-foreground">Show Legend</span>
        </label>
      </div>

      {isExpanded && showLegend && (
        <div className="space-y-3.5">
          {/* Sub-Tab Navigation Bar */}
          <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => setSubTab('placement')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                subTab === 'placement'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Placement</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('typography')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                subTab === 'typography'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Legend Typography</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('frame')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                subTab === 'frame'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Frame & Spacing</span>
            </button>

            {isHierarchicalChart && (
              <button
                type="button"
                onClick={() => setSubTab('hierarchy')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  subTab === 'hierarchy'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>CDS Hierarchy & Sync</span>
              </button>
            )}
          </div>

          {/* ======================================================== */}
          {/* SUB-TAB 1: PLACEMENT, FORMAT & ICON SHAPES              */}
          {/* ======================================================== */}
          {subTab === 'placement' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Placement Position</label>
                  <select
                    value={legendPosition}
                    onChange={(e) => setLegendPosition(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="top">Top Header (Horizontal)</option>
                    <option value="bottom">Bottom Footer (Horizontal)</option>
                    <option value="right">Right Side (Vertical)</option>
                    <option value="left">Left Side (Vertical)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Key Label Format</label>
                  <select
                    value={legendFormat}
                    onChange={(e) => setLegendFormat?.(e.target.value as DisplayFormatTemplate)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="name">Category Name Only</option>
                    <option value="name_ratio_percent">Name + Ratio + Coarse % (n=x/N, ~P%)</option>
                    <option value="ratio_percent">Ratio + % (n=x/N, ~P%)</option>
                    <option value="name_count">Name + Paper Count (n=x)</option>
                    <option value="name_percent">Name + Percent (Name, ~P%)</option>
                    <option value="percent_only">Percentage Only (~P%)</option>
                    <option value="count_only">Count Only (n=x)</option>
                    <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + %</option>
                    <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + %</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Key Icon Shape</label>
                  <select
                    value={legendIcon}
                    onChange={(e) => setLegendIcon?.(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="inherit">Inherit / Default</option>
                    <option value="roundRect">Rounded Box (roundRect)</option>
                    <option value="rect">Sharp Rectangle (rect)</option>
                    <option value="circle">Circular Dot (circle)</option>
                    <option value="diamond">Diamond (diamond)</option>
                    <option value="line">Line Indicator (line)</option>
                    <option value="none">None (Text Only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">
                    Key Icon Width ({legendItemWidth}px)
                  </label>
                  <input
                    type="range"
                    min={6}
                    max={60}
                    value={legendItemWidth}
                    onChange={(e) => setLegendItemWidth?.(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">
                    Key Icon Height ({legendItemHeight}px)
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={40}
                    value={legendItemHeight}
                    onChange={(e) => setLegendItemHeight?.(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-TAB 2: EXTENSIVE TYPOGRAPHY                          */}
          {/* ======================================================== */}
          {subTab === 'typography' && (
            <div className="space-y-3.5">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                Legend Typography
              </span>

              {/* Font Family & Weight */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">Font Family</label>
                  <select
                    value={legendFontFamily}
                    onChange={(e) => setLegendFontFamily?.(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                  >
                    <option value="inherit">Inherit Canvas Theme Font</option>
                    {Object.entries(FONT_FAMILIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">Font Weight</label>
                  <select
                    value={legendFontWeight as string}
                    onChange={(e) => setLegendFontWeight?.(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                  >
                    <option value="normal">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">SemiBold (600)</option>
                    <option value="bold">Bold (700)</option>
                    <option value="800">ExtraBold (800)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">Font Style</label>
                  <select
                    value={legendFontStyle}
                    onChange={(e) => setLegendFontStyle?.(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                  >
                    <option value="normal">Plain / Upright</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
              </div>

              {/* Sliders: Font Size, Line Height, Max Width */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 rounded-xl border border-border/50">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-muted-foreground">Font Size</label>
                    <span className="text-[10px] font-mono font-bold text-primary">{legendFontSize || 10}px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={32}
                    value={legendFontSize || 10}
                    onChange={(e) => setLegendFontSize?.(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-muted-foreground">Line Height</label>
                    <span className="text-[10px] font-mono font-bold text-primary">{legendLineHeight}px</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    value={legendLineHeight}
                    onChange={(e) => setLegendLineHeight?.(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-muted-foreground">Max Label Width</label>
                    <span className="text-[10px] font-mono font-bold text-primary">{legendWrapWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={400}
                    value={legendWrapWidth}
                    onChange={(e) => setLegendWrapWidth?.(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Text Overflow & Color Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">Text Overflow Mode</label>
                  <select
                    value={legendOverflow}
                    onChange={(e) => setLegendOverflow?.(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                  >
                    <option value="break">Word Wrap (break)</option>
                    <option value="truncate">Truncate with Ellipsis (...)</option>
                    <option value="none">Full Length / No Wrap</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={legendTextColor || '#334155'}
                      onChange={(e) => setLegendTextColor?.(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={legendTextColor}
                      onChange={(e) => setLegendTextColor?.(e.target.value)}
                      placeholder="Auto (Theme Default)"
                      className="flex-1 bg-secondary border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground"
                    />
                    {legendTextColor && (
                      <button
                        type="button"
                        onClick={() => setLegendTextColor?.('')}
                        className="text-[10px] px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground"
                        title="Reset to Theme Auto"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Academic Color Swatches */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-muted-foreground mr-1">Quick Swatches:</span>
                {[
                  { label: 'Slate', color: '#0f172a' },
                  { label: 'Charcoal', color: '#334155' },
                  { label: 'Muted', color: '#64748b' },
                  { label: 'White', color: '#ffffff' }
                ].map((swatch) => (
                  <button
                    key={swatch.color}
                    type="button"
                    onClick={() => setLegendTextColor?.(swatch.color)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold border border-border/80 flex items-center gap-1 hover:border-primary transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: swatch.color }} />
                    <span>{swatch.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-TAB 3: FRAME, BORDER & SPACING                       */}
          {/* ======================================================== */}
          {subTab === 'frame' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-foreground">Item Spacing Gap</label>
                    <span className="text-[10px] font-mono font-bold text-primary">{legendItemGap}px</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={120}
                    value={legendItemGap}
                    onChange={(e) => setLegendItemGap?.(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-foreground">Grid Clearance Distance</label>
                    <span className="text-[10px] font-mono font-bold text-primary">{legendDistance}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    value={legendDistance}
                    onChange={(e) => setLegendDistance?.(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Frame Background & Border Styling */}
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-3">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  Legend Box Frame & Background Styling
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-muted-foreground block">Frame Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={legendBackgroundColor === 'transparent' ? '#ffffff' : legendBackgroundColor}
                        onChange={(e) => setLegendBackgroundColor?.(e.target.value)}
                        className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={legendBackgroundColor}
                        onChange={(e) => setLegendBackgroundColor?.(e.target.value)}
                        placeholder="transparent"
                        className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setLegendBackgroundColor?.('transparent')}
                        className="text-[10px] px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-muted-foreground block">Frame Border Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={legendBorderColor === 'transparent' ? '#cbd5e1' : legendBorderColor}
                        onChange={(e) => setLegendBorderColor?.(e.target.value)}
                        className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={legendBorderColor}
                        onChange={(e) => setLegendBorderColor?.(e.target.value)}
                        placeholder="transparent"
                        className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setLegendBorderColor?.('transparent')}
                        className="text-[10px] px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-muted-foreground">Border Width</label>
                      <span className="text-[9.5px] font-mono font-bold">{legendBorderWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      value={legendBorderWidth}
                      onChange={(e) => setLegendBorderWidth?.(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-muted-foreground">Corner Radius</label>
                      <span className="text-[9.5px] font-mono font-bold">{legendBorderRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      value={legendBorderRadius}
                      onChange={(e) => setLegendBorderRadius?.(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-muted-foreground">Box Padding</label>
                      <span className="text-[9.5px] font-mono font-bold">{legendPadding}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      value={legendPadding}
                      onChange={(e) => setLegendPadding?.(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-TAB 4: CDS STUDIO HIERARCHY & SYNCHRONIZER           */}
          {/* ======================================================== */}
          {subTab === 'hierarchy' && isHierarchicalChart && (
            <div className="space-y-3.5">
              {/* CDS Studio Hierarchy & Scope Intelligence */}
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-2.5">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  CDS Studio Hierarchy & Scope Intelligence
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">
                      Legend Data Context Scope
                    </label>
                    <select
                      value={legendContextScope || 'global_cohort'}
                      onChange={(e) => {
                        const newScope = e.target.value as any;
                        setLegendContextScope?.(newScope);
                        if (config.syncLegendAndBarMetrics) {
                          if (newScope === 'in_chart_flow' || newScope === 'parent_layer') {
                            config.setBarLabelContextScope?.('layer_share');
                            config.setBarLabelFormat?.('layer_share');
                          } else {
                            config.setBarLabelContextScope?.('cohort_prevalence');
                            config.setBarLabelFormat?.('count_prevalence_percent');
                          }
                        }
                      }}
                      className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                    >
                      <option value="in_chart_flow">Active In-Chart Flow (Normalized Layer Share: e.g. ~6%)</option>
                      <option value="surviving_flow">Active Filtered Cohort (n = x / Surviving Scoped Papers: e.g. ~10%)</option>
                      <option value="parent_layer">Parent Taxonomy Layer (n = x / Layer Category Papers)</option>
                      <option value="global_cohort">Global Project Cohort (n = x / Total Cohort Papers: e.g. ~7%)</option>
                    </select>
                  </div>

                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg bg-card border border-border/60 cursor-pointer text-xs font-bold text-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(legendShowParentPrefix)}
                        onChange={(e) => setLegendShowParentPrefix?.(e.target.checked)}
                        className="rounded border-border text-primary w-4 h-4"
                      />
                      <span>Show Parent Layer Prefix (e.g. [Physical/Link] CAN)</span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">
                      Layer Prefix Badge Style
                    </label>
                    <select
                      value={config.legendParentPrefixStyle || 'abbreviated'}
                      onChange={(e) => config.setLegendParentPrefixStyle?.(e.target.value as any)}
                      className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                    >
                      <option value="abbreviated">Smart Abbreviation (e.g. [App], [Net], [Link])</option>
                      <option value="full">Full Layer Name (e.g. [Application/Middleware])</option>
                      <option value="colliding_only">Colliding Categories Only (e.g. [App] Security / [Net] Security)</option>
                      <option value="none">None (Clean Protocol / Subcategory Name Only)</option>
                    </select>
                  </div>

                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg bg-card border border-border/60 cursor-pointer text-xs font-bold text-foreground">
                      <input
                        type="checkbox"
                        checked={config.legendGroupByParent ?? true}
                        onChange={(e) => config.setLegendGroupByParent?.(e.target.checked)}
                        className="rounded border-border text-primary w-4 h-4"
                      />
                      <span>Group Legend by Parent Layer (Matching Bar Order)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Universal Data Source & Format Synchronizer */}
              <div className="p-3 bg-secondary/20 rounded-xl border border-primary/30 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <div className="flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      Data Source & Format Synchronizer
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(config.syncLegendAndBarMetrics)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        config.setSyncLegendAndBarMetrics?.(isChecked);
                        if (isChecked) {
                          if (legendContextScope === 'in_chart_flow' || legendContextScope === 'parent_layer') {
                            config.setBarLabelContextScope?.('layer_share');
                            config.setBarLabelFormat?.('layer_share');
                          } else {
                            config.setBarLabelContextScope?.('cohort_prevalence');
                            config.setBarLabelFormat?.('count_prevalence_percent');
                          }
                        }
                      }}
                      className="rounded border-border text-primary w-3.5 h-3.5"
                    />
                    <span className="text-[11px]">Lock In-Sync</span>
                  </label>
                </div>

                <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                  Synchronize the mathematical data source (In-Chart Flow vs. Cohort Prevalence) and display format between Chart Data Labels and Legend to prevent publication discrepancies.
                </p>

                {/* Real-Time Metric Discrepancy Detector & Advisory Badge */}
                {(() => {
                  const isStackedBar = config.chartType === 'stacked_bar';
                  if (!isStackedBar) return null;
                  const isLegendPrevalence = legendContextScope === 'surviving_flow' || legendContextScope === 'global_cohort';
                  const isBarLayerShare = !config.syncLegendAndBarMetrics && 
                    config.barLabelContextScope !== 'cohort_prevalence' &&
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
                            Bar data labels are displaying within-layer share (~6%), while the legend is displaying cohort prevalence (~10%). Use the quick-actions below to harmonize or enable Lock In-Sync.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (config.syncLegendAndBarMetrics) {
                    return (
                      <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        <span>Harmonized & Locked: Bar labels dynamically mirror active legend context.</span>
                      </div>
                    );
                  }

                  return null;
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLegendContextScope?.('in_chart_flow');
                      config.setBarLabelFormat?.('layer_share');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      legendContextScope === 'in_chart_flow'
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-card hover:bg-secondary text-foreground'
                    }`}
                    title="Sets both chart bar labels and legend to In-Chart Layer Share (~6%)"
                  >
                    <Sparkles className="w-3 h-3 text-primary" />
                    Align to In-Chart Flow (~6%)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLegendContextScope?.('surviving_flow');
                      config.setBarLabelFormat?.('count_prevalence_percent');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      legendContextScope === 'surviving_flow'
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-card hover:bg-secondary text-foreground'
                    }`}
                    title="Sets both chart bar labels and legend to Cohort Prevalence (~10%)"
                  >
                    <RefreshCw className="w-3 h-3 text-primary" />
                    Align to Cohort Prevalence (~10%)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

