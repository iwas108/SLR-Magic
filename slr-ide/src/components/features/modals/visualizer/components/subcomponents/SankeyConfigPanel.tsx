import React, { useState } from 'react';
import { Sparkles, Layers, Sliders, MoveHorizontal, MoveVertical } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';
import type { DisplayFormatTemplate } from '../../types';

export function SankeyConfigPanel() {
  const { config } = useVisualizerContext();
  const {
    sankeyFields,
    sankeyNodeWidth,
    setSankeyNodeWidth,
    sankeyNodeGap,
    setSankeyNodeGap,
    sankeyLeftPadding,
    setSankeyLeftPadding,
    sankeyRightPadding,
    setSankeyRightPadding,
    sankeyTopPadding = 12,
    setSankeyTopPadding,
    sankeyBottomPadding = 8,
    setSankeyBottomPadding,
    sankeyOrient = 'horizontal',
    setSankeyOrient,
    sankeyNodeAlign = 'justify',
    setSankeyNodeAlign,
    sankeyCurveness = 0.5,
    setSankeyCurveness,
    sankeyLinkColorMode = 'gradient',
    setSankeyLinkColorMode,
    sankeyLinkOpacity = 45,
    setSankeyLinkOpacity,
    sankeyNodeBorderRadius = 2,
    setSankeyNodeBorderRadius,
    sankeyNodeBorderWidth = 1,
    setSankeyNodeBorderWidth,
    sankeyLayoutIterations = 32,
    setSankeyLayoutIterations,
    sankeyDraggable = true,
    setSankeyDraggable,
    sankeyLabelPosition = 'auto',
    setSankeyLabelPosition,
    sankeyLabelDistance = 6,
    setSankeyLabelDistance,
    sankeyLabelOverflow = 'break',
    setSankeyLabelOverflow,
    sankeyMaxLabelWidth = 120,
    setSankeyMaxLabelWidth,
    sankeyLabelFontSize,
    setSankeyLabelFontSize,
    sankeyLabelRotate = 0,
    setSankeyLabelRotate,
    sankeyEmphasisFocus = 'adjacency',
    setSankeyEmphasisFocus,
    sankeyLabelPositions,
    setSankeyLabelPositions,
    sankeyMaxNodes,
    setSankeyMaxNodes,
    sankeyLevelLabelFormats,
    setSankeyLevelLabelFormats,
    sankeyLevelNodeGaps,
    setSankeyLevelNodeGaps,
    sankeyLevelLabelDistances,
    setSankeyLevelLabelDistances,
    sankeyLevelNodeWidths,
    setSankeyLevelNodeWidths,
    sankeySort = 'desc',
    setSankeySort,
    sankeyLabelLineHeight = 14,
    setSankeyLabelLineHeight,
    sankeyLabelFontWeight = '600',
    setSankeyLabelFontWeight,
    sankeyLabelColor = '',
    setSankeyLabelColor,
    tailLabelStyle = 'comma_list',
    setTailLabelStyle,
    showDataLabels,
    setShowDataLabels,
    labelFormat,
    setLabelFormat
  } = config;

  const [activeLevelTab, setActiveLevelTab] = useState<number>(0);

  // Quick preset shortcuts
  const applyPreset = (type: 'classic' | 'dense' | 'ribbon' | 'vertical') => {
    if (type === 'classic') {
      setSankeyOrient('horizontal');
      setSankeyNodeAlign('justify');
      setSankeyNodeWidth(20);
      setSankeyNodeGap(18);
      setSankeyCurveness(0.5);
      setSankeyLinkColorMode('gradient');
      setSankeyLinkOpacity(45);
      setSankeyNodeBorderRadius(2);
      setSankeyNodeBorderWidth(1);
      setSankeyLeftPadding(8);
      setSankeyRightPadding(20);
      setSankeyEmphasisFocus('adjacency');
    } else if (type === 'dense') {
      setSankeyOrient('horizontal');
      setSankeyNodeAlign('left');
      setSankeyNodeWidth(14);
      setSankeyNodeGap(10);
      setSankeyCurveness(0.4);
      setSankeyLinkColorMode('source');
      setSankeyLinkOpacity(60);
      setSankeyNodeBorderRadius(0);
      setSankeyNodeBorderWidth(1);
      setSankeyLeftPadding(5);
      setSankeyRightPadding(14);
      setSankeyEmphasisFocus('trajectory');
    } else if (type === 'ribbon') {
      setSankeyOrient('horizontal');
      setSankeyNodeAlign('justify');
      setSankeyNodeWidth(28);
      setSankeyNodeGap(24);
      setSankeyCurveness(0.65);
      setSankeyLinkColorMode('gradient');
      setSankeyLinkOpacity(35);
      setSankeyNodeBorderRadius(4);
      setSankeyNodeBorderWidth(1);
      setSankeyLeftPadding(10);
      setSankeyRightPadding(24);
      setSankeyEmphasisFocus('adjacency');
    } else if (type === 'vertical') {
      setSankeyOrient('vertical');
      setSankeyNodeAlign('justify');
      setSankeyNodeWidth(20);
      setSankeyNodeGap(16);
      setSankeyCurveness(0.5);
      setSankeyLinkColorMode('gradient');
      setSankeyLinkOpacity(50);
      setSankeyNodeBorderRadius(2);
      setSankeyNodeBorderWidth(1);
      setSankeyTopPadding(10);
      setSankeyBottomPadding(15);
      setSankeyLeftPadding(8);
      setSankeyRightPadding(8);
      setSankeyEmphasisFocus('adjacency');
    }
  };

  const clampedLevelIdx = Math.max(0, Math.min(activeLevelTab, Math.max(0, sankeyFields.length - 1)));

  return (
    <div className="space-y-4">
      {/* 1. Quick Presets Bar */}
      <div className="p-3 bg-card border border-border rounded-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Flow Layout Presets:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset('classic')}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all"
          >
            Publication Classic (IEEE/ACM)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('ribbon')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Deep Flow Ribbon (Nature)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('dense')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            High-Density Compact
          </button>
          <button
            type="button"
            onClick={() => applyPreset('vertical')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Vertical Cascade
          </button>
        </div>
      </div>

      {/* 2. Flow Geometry & Layout Controls */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            Node Geometry & Flow Direction
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Flow Orientation</label>
            <div className="grid grid-cols-2 gap-1 bg-card p-0.5 border border-border rounded-lg">
              <button
                type="button"
                onClick={() => setSankeyOrient('horizontal')}
                className={`flex items-center justify-center gap-1 py-1 text-xs font-bold rounded ${
                  sankeyOrient === 'horizontal' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MoveHorizontal className="w-3 h-3" />
                <span>Horizontal</span>
              </button>
              <button
                type="button"
                onClick={() => setSankeyOrient('vertical')}
                className={`flex items-center justify-center gap-1 py-1 text-xs font-bold rounded ${
                  sankeyOrient === 'vertical' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MoveVertical className="w-3 h-3" />
                <span>Vertical</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Node Alignment</label>
            <select
              value={sankeyNodeAlign}
              onChange={(e) => setSankeyNodeAlign(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="justify">Justify (Span Full Width)</option>
              <option value="left">Align Left / Top</option>
              <option value="right">Align Right / Bottom</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Category Sorting</label>
            <select
              value={sankeySort}
              onChange={(e) => setSankeySort(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="desc">Descending (Largest on Top)</option>
              <option value="asc">Ascending (Smallest on Top)</option>
              <option value="alpha">Alphabetical (A → Z)</option>
              <option value="none">Natural Data Order</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Hover Focus Path</label>
            <select
              value={sankeyEmphasisFocus}
              onChange={(e) => setSankeyEmphasisFocus(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="adjacency">Adjacency (Direct In/Out Links)</option>
              <option value="trajectory">Trajectory (Full Path Root-to-Leaf)</option>
              <option value="series">All Series Elements</option>
              <option value="none">No Dimming</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Node Thickness ({sankeyNodeWidth}px)</label>
            <input
              type="range"
              min={6}
              max={60}
              value={sankeyNodeWidth}
              onChange={(e) => setSankeyNodeWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Inter-Node Gap ({sankeyNodeGap}px)</label>
            <input
              type="range"
              min={4}
              max={50}
              value={sankeyNodeGap}
              onChange={(e) => setSankeyNodeGap(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Corner Radius ({sankeyNodeBorderRadius}px)</label>
            <input
              type="range"
              min={0}
              max={16}
              value={sankeyNodeBorderRadius}
              onChange={(e) => setSankeyNodeBorderRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Border Stroke ({sankeyNodeBorderWidth}px)</label>
            <input
              type="range"
              min={0}
              max={6}
              value={sankeyNodeBorderWidth}
              onChange={(e) => setSankeyNodeBorderWidth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Relaxation Iterations ({sankeyLayoutIterations})</label>
              <span className="text-[10px] text-muted-foreground">{sankeyLayoutIterations === 0 ? 'Exact Data Order' : 'Optimized Flow Crossings'}</span>
            </div>
            <input
              type="range"
              min={0}
              max={120}
              step={4}
              value={sankeyLayoutIterations}
              onChange={(e) => setSankeyLayoutIterations(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="flex items-center justify-between p-2.5 bg-card/60 rounded-lg border border-border/60">
            <div>
              <span className="text-xs font-bold text-foreground block">Interactive Node Dragging</span>
              <span className="text-[10px] text-muted-foreground block">Allow manual dragging of nodes on preview canvas</span>
            </div>
            <input
              type="checkbox"
              checked={sankeyDraggable}
              onChange={(e) => setSankeyDraggable(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary"
            />
          </div>
        </div>
      </div>

      {/* 3. Flow Ribbons & Curvature Styling */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-foreground">
            Flow Links & Curvature
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Link Curvature ({sankeyCurveness})</label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={sankeyCurveness}
              onChange={(e) => setSankeyCurveness(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Link Color Mode</label>
            <select
              value={sankeyLinkColorMode}
              onChange={(e) => setSankeyLinkColorMode(e.target.value as any)}
              className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="gradient">Gradient (Source → Target)</option>
              <option value="source">Source Category Color</option>
              <option value="target">Target Category Color</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Link Ribbon Opacity ({sankeyLinkOpacity}%)</label>
            <input
              type="range"
              min={10}
              max={90}
              value={sankeyLinkOpacity}
              onChange={(e) => setSankeyLinkOpacity(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      {/* 4. Canvas Margins & Safe Area Padding */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-foreground">
            Canvas Margins & Label Clearance
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            L: {sankeyLeftPadding}% | R: {sankeyRightPadding}% | T: {sankeyTopPadding}% | B: {sankeyBottomPadding}%
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Left Margin ({sankeyLeftPadding}%)</label>
            <input
              type="range"
              min={2}
              max={35}
              value={sankeyLeftPadding}
              onChange={(e) => setSankeyLeftPadding(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Right Margin ({sankeyRightPadding}%)</label>
            <input
              type="range"
              min={2}
              max={40}
              value={sankeyRightPadding}
              onChange={(e) => setSankeyRightPadding(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Top Margin ({sankeyTopPadding}%)</label>
            <input
              type="range"
              min={2}
              max={25}
              value={sankeyTopPadding}
              onChange={(e) => setSankeyTopPadding(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Bottom Margin ({sankeyBottomPadding}%)</label>
            <input
              type="range"
              min={2}
              max={25}
              value={sankeyBottomPadding}
              onChange={(e) => setSankeyBottomPadding(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      {/* 5. Typography, Data Labels & Formatting */}
      <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-foreground">
            Typography, Text Wrapping & Metrics
          </span>
          <label className="flex items-center gap-1.5 text-xs font-bold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showDataLabels}
              onChange={(e) => setShowDataLabels(e.target.checked)}
              className="rounded border-border text-primary"
            />
            <span>Show Labels</span>
          </label>
        </div>

        {showDataLabels && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Default Label Format</label>
                <select
                  value={labelFormat || 'ratio_percent'}
                  onChange={(e) => setLabelFormat(e.target.value as DisplayFormatTemplate)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <optgroup label="Standard Metrics">
                    <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
                    <option value="ratio_percent">Ratio + Coarse % (n = x/N, ~P%)</option>
                    <option value="name_ratio">Name + Ratio (Name, n = x/N)</option>
                    <option value="name_count">Name + Count (Name, n = x)</option>
                    <option value="name_percent">Name + Percent (Name, ~P%)</option>
                    <option value="name_count_percent">Name + Count + %</option>
                    <option value="percent_ratio">Coarse % + Ratio (~P%, n = x/N)</option>
                    <option value="ratio_only">Ratio Only (n = x/N)</option>
                    <option value="count_only">Count Only (n = x)</option>
                    <option value="percent_only">Percent Only (~P%)</option>
                    <option value="name_only">Category Name Only</option>
                  </optgroup>
                  <optgroup label="Explicit Tag Share">
                    <option value="tag_share_ratio_percent">Tag Share Ratio + %</option>
                    <option value="name_tag_share_ratio_percent">Name + Tag Share Ratio + %</option>
                    <option value="tag_share_count_percent">Tag Count + %</option>
                  </optgroup>
                  <optgroup label="Explicit Paper Prevalence">
                    <option value="prevalence_ratio_percent">Prevalence Ratio + %</option>
                    <option value="name_prevalence_ratio_percent">Name + Prevalence Ratio + %</option>
                  </optgroup>
                  <optgroup label="Dual Multi-Metric">
                    <option value="dual_prevalence_tag_share">Dual: Prevalence & Tag Share</option>
                  </optgroup>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Global Label Placement</label>
                <select
                  value={sankeyLabelPosition}
                  onChange={(e) => setSankeyLabelPosition(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="auto">Auto (Left for Final, Right for Others)</option>
                  <option value="right">Right of Node</option>
                  <option value="left">Left of Node</option>
                  <option value="inside">Inside Node Rectangle</option>
                  <option value="top">Top of Node</option>
                  <option value="bottom">Bottom of Node</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Distance ({sankeyLabelDistance}px)</label>
                <input
                  type="range"
                  min={2}
                  max={25}
                  value={sankeyLabelDistance}
                  onChange={(e) => setSankeyLabelDistance(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Text Wrap & Overflow</label>
                <select
                  value={sankeyLabelOverflow}
                  onChange={(e) => setSankeyLabelOverflow(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="break">Wrap Words (Multi-line)</option>
                  <option value="truncate">Truncate with Ellipsis (...)</option>
                  <option value="none">No Overflow Truncation</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Max Label Width ({sankeyMaxLabelWidth}px)</label>
                <input
                  type="range"
                  min={40}
                  max={500}
                  step={5}
                  value={sankeyMaxLabelWidth}
                  onChange={(e) => setSankeyMaxLabelWidth(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Rotation ({sankeyLabelRotate}°)</label>
                <select
                  value={sankeyLabelRotate}
                  onChange={(e) => setSankeyLabelRotate(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value={0}>0° (Horizontal)</option>
                  <option value={30}>30° Inclined</option>
                  <option value={45}>45° Diagonal</option>
                  <option value={90}>90° Vertical</option>
                </select>
              </div>
            </div>

            {/* Typography & Color Customization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Line Height ({sankeyLabelLineHeight}px)</label>
                <input
                  type="range"
                  min={10}
                  max={32}
                  value={sankeyLabelLineHeight}
                  onChange={(e) => setSankeyLabelLineHeight(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Font Weight</label>
                <select
                  value={sankeyLabelFontWeight}
                  onChange={(e) => setSankeyLabelFontWeight(e.target.value as any)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
                >
                  <option value="normal">Normal (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semibold (600)</option>
                  <option value="bold">Bold (700)</option>
                  <option value="800">Extrabold (800)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Font Size ({sankeyLabelFontSize ? `${sankeyLabelFontSize}px` : 'Auto'})</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min={8}
                    max={24}
                    value={sankeyLabelFontSize ?? 11}
                    onChange={(e) => setSankeyLabelFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  {sankeyLabelFontSize !== undefined && (
                    <button
                      type="button"
                      onClick={() => setSankeyLabelFontSize(undefined)}
                      className="text-[10px] px-1.5 py-0.5 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded border border-border"
                      title="Reset to default theme font size"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={sankeyLabelColor || '#333333'}
                    onChange={(e) => setSankeyLabelColor(e.target.value)}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={sankeyLabelColor}
                    onChange={(e) => setSankeyLabelColor(e.target.value)}
                    placeholder="Auto (Theme)"
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-mono text-foreground"
                  />
                  {sankeyLabelColor !== '' && (
                    <button
                      type="button"
                      onClick={() => setSankeyLabelColor('')}
                      className="text-[10px] px-1.5 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground rounded border border-border whitespace-nowrap"
                    >
                      Auto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Per-Level Depth Tabs & Tuning */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Hierarchy Levels:
          </span>
          {sankeyFields.map((fKey, lIdx) => {
            const labelText = `Level ${lIdx + 1}: ${
              fKey === CUSTOM_GROUPING_KEY 
                ? 'Custom Grouping' 
                : fKey.startsWith('raw:ext:') 
                  ? `${fKey.substring(8)} (Raw)` 
                  : fKey.startsWith('ext:') 
                    ? fKey.substring(4) 
                    : fKey
            }`;
            const isActive = clampedLevelIdx === lIdx;
            return (
              <button
                key={lIdx}
                type="button"
                onClick={() => setActiveLevelTab(lIdx)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                }`}
              >
                {labelText}
              </button>
            );
          })}
        </div>

        {/* Level Specific Configuration Card */}
        {(() => {
          const curPos = sankeyLabelPositions[clampedLevelIdx] || (clampedLevelIdx === sankeyFields.length - 1 ? 'left' : 'right');
          const curMaxNodes = sankeyMaxNodes[clampedLevelIdx] || 0;
          const curLevelFormat = sankeyLevelLabelFormats[clampedLevelIdx] || labelFormat || 'ratio_percent';
          const curLevelLabelDistance = sankeyLevelLabelDistances[clampedLevelIdx] ?? sankeyLabelDistance;
          const isCustomLevelLabelDistance = sankeyLevelLabelDistances[clampedLevelIdx] !== undefined;

          return (
            <div className="p-4 bg-card border border-border rounded-xl space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-xs font-extrabold text-primary">
                  Level {clampedLevelIdx + 1} Fine-Tuning & Category Truncation
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Variable: {sankeyFields[clampedLevelIdx]}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Level Label Alignment</label>
                  <select
                    value={curPos}
                    onChange={(e) => {
                      setSankeyLabelPositions({
                        ...sankeyLabelPositions,
                        [clampedLevelIdx]: e.target.value as any
                      });
                    }}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="right">Right of Node</option>
                    <option value="left">Left of Node</option>
                    <option value="inside">Inside Node</option>
                    <option value="top">Top of Node</option>
                    <option value="bottom">Bottom of Node</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">
                    Max Categories Limit {curMaxNodes > 0 ? `(${curMaxNodes} items)` : '(No Limit)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={curMaxNodes || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSankeyMaxNodes({
                        ...sankeyMaxNodes,
                        [clampedLevelIdx]: val > 0 ? val : 0
                      });
                    }}
                    placeholder="0 (Unlimited)"
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Tail Grouping Label Style</label>
                  <select
                    value={tailLabelStyle}
                    onChange={(e) => setTailLabelStyle(e.target.value as any)}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1.5 text-xs font-bold text-foreground"
                  >
                    <option value="comma_list">Comma List (e.g. "A, B (+2)")</option>
                    <option value="other_items">Other + Items (e.g. "Other: A, B")</option>
                    <option value="other_count">Other Count (e.g. "Other (4 items)")</option>
                    <option value="plain_other">Plain "Other"</option>
                  </select>
                </div>
              </div>

              {/* Level-Specific Label Distance Margin */}
              <div className="pt-2 border-t border-border/40">
                <div className="space-y-1 max-w-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      Level {clampedLevelIdx + 1} Label Margin ({curLevelLabelDistance}px)
                      {isCustomLevelLabelDistance && (
                        <span className="text-[9px] font-extrabold text-primary bg-primary/10 px-1 py-0.2 rounded border border-primary/20">
                          Custom
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-muted-foreground">Distance from node to label</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={curLevelLabelDistance}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSankeyLevelLabelDistances({
                        ...sankeyLevelLabelDistances,
                        [clampedLevelIdx]: val
                      });
                    }}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center justify-between gap-1 pt-0.5 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { label: 'Flush', val: 2 },
                        { label: 'Normal', val: 6 },
                        { label: 'Offset', val: 12 },
                        { label: 'Distant', val: 20 }
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setSankeyLevelLabelDistances({
                              ...sankeyLevelLabelDistances,
                              [clampedLevelIdx]: p.val
                            });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition-colors ${
                            curLevelLabelDistance === p.val
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-muted-foreground border-border hover:text-foreground'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {isCustomLevelLabelDistance && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextDist = { ...sankeyLevelLabelDistances };
                          delete nextDist[clampedLevelIdx];
                          setSankeyLevelLabelDistances(nextDist);
                        }}
                        className="px-1.5 py-0.5 rounded text-[9.5px] font-bold border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                        title="Reset to global label margin"
                      >
                        Reset (Global: {sankeyLabelDistance}px)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Per-Level Label Format Override */}
              <div className="p-3 bg-secondary/20 border border-border/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 flex-1 max-w-sm">
                  <label className="text-xs font-bold text-foreground block">
                    Label Display Format for Level {clampedLevelIdx + 1}
                  </label>
                  <select
                    value={curLevelFormat}
                    onChange={(e) => {
                      setSankeyLevelLabelFormats({
                        ...sankeyLevelLabelFormats,
                        [clampedLevelIdx]: e.target.value as DisplayFormatTemplate
                      });
                    }}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  >
                    <option value="name_ratio_percent">Name + Ratio + Coarse % (e.g. "Manufacturing (n=6/18, ~33%)")</option>
                    <option value="ratio_percent">Ratio + Coarse % (e.g. "n = 6/18, ~33%")</option>
                    <option value="name_ratio">Name + Ratio (e.g. "Manufacturing (n=6/18)")</option>
                    <option value="name_count">Name + Count (e.g. "Manufacturing (n=6)")</option>
                    <option value="name_percent">Name + Percent (e.g. "Manufacturing (~33%)")</option>
                    <option value="name_count_percent">Name + Count + % (e.g. "Manufacturing (n=6, ~33%)")</option>
                    <option value="percent_ratio">Coarse % + Ratio (e.g. "~33% (n=6/18)")</option>
                    <option value="count_only">Count Only (e.g. "n = 6")</option>
                    <option value="percent_only">Percent Only (e.g. "~33%")</option>
                    <option value="name_only">Category Name Only (e.g. "Manufacturing")</option>
                    <option value="tag_share_ratio_percent">Tag Share Ratio + %</option>
                    <option value="prevalence_ratio_percent">Prevalence Ratio + %</option>
                    <option value="dual_prevalence_tag_share">Dual Prevalence & Tag Share</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const newFormats: Record<number, DisplayFormatTemplate> = {};
                      sankeyFields.forEach((_, idx) => {
                        newFormats[idx] = curLevelFormat;
                      });
                      setSankeyLevelLabelFormats(newFormats);
                    }}
                    className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                  >
                    Apply Format to All Levels
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
