import React, { useState } from 'react';
import { 
  Sparkles, 
  Layers, 
  Sliders, 
  Type, 
  Palette, 
  FolderTree,
  Navigation,
  RotateCcw,
  Users
} from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';
import type { DisplayFormatTemplate, TreemapLevelConfig } from '../../types';

export function TreemapConfigPanel() {
  const { config, canvas } = useVisualizerContext();
  const {
    sankeyFields,
    treemapAlgorithm,
    setTreemapAlgorithm,
    treemapSquareRatio,
    setTreemapSquareRatio,
    treemapVisibleDepth,
    setTreemapVisibleDepth,
    treemapGapWidth,
    setTreemapGapWidth,
    treemapBorderWidth,
    setTreemapBorderWidth,
    treemapBorderRadius,
    setTreemapBorderRadius,
    treemapBorderColorMode,
    setTreemapBorderColorMode,
    treemapBorderColor,
    setTreemapBorderColor,
    treemapNodeClick,
    setTreemapNodeClick,
    treemapRoam,
    setTreemapRoam,
    treemapDrillDownIcon,
    setTreemapDrillDownIcon,
    treemapShowBreadcrumb,
    setTreemapShowBreadcrumb,
    treemapBreadcrumbPosition,
    setTreemapBreadcrumbPosition,
    treemapBreadcrumbHeight,
    setTreemapBreadcrumbHeight,
    treemapColorMode,
    setTreemapColorMode,
    treemapCohortMode,
    setTreemapCohortMode,
    treemapColorMappingBy,
    setTreemapColorMappingBy,
    treemapColorAlphaMin,
    setTreemapColorAlphaMin,
    treemapColorSaturationMin,
    setTreemapColorSaturationMin,
    treemapColorSaturationMax,
    setTreemapColorSaturationMax,
    treemapShowLabels,
    setTreemapShowLabels,
    treemapLabelPosition,
    setTreemapLabelPosition,
    treemapLabelFormat,
    setTreemapLabelFormat,
    treemapLabelFontSize,
    setTreemapLabelFontSize,
    treemapLabelFontWeight,
    setTreemapLabelFontWeight,
    treemapLabelFontStyle,
    setTreemapLabelFontStyle,
    treemapLabelColorMode,
    setTreemapLabelColorMode,
    treemapLabelColor,
    setTreemapLabelColor,
    treemapLabelOverflow,
    setTreemapLabelOverflow,
    treemapLabelWidth,
    setTreemapLabelWidth,
    treemapLabelLineHeight,
    setTreemapLabelLineHeight,
    treemapShowUpperLabel,
    setTreemapShowUpperLabel,
    treemapUpperLabelHeight,
    setTreemapUpperLabelHeight,
    treemapUpperLabelPosition,
    setTreemapUpperLabelPosition,
    treemapUpperLabelFormat,
    setTreemapUpperLabelFormat,
    treemapUpperLabelFontSize,
    setTreemapUpperLabelFontSize,
    treemapUpperLabelFontWeight,
    setTreemapUpperLabelFontWeight,
    treemapUpperLabelColorMode,
    setTreemapUpperLabelColorMode,
    treemapUpperLabelColor,
    setTreemapUpperLabelColor,
    treemapUpperLabelBgColor,
    setTreemapUpperLabelBgColor,
    treemapVisibleMin,
    setTreemapVisibleMin,
    treemapChildrenVisibleMin,
    setTreemapChildrenVisibleMin,
    treemapLevelConfigs,
    setTreemapLevelConfigs
  } = config;

  const [activeTreemapLevelTab, setActiveTreemapLevelTab] = useState<number>(0);

  // 1-Click Academic Layout Presets
  const applyPreset = (presetType: 'clean' | 'banners' | 'dense' | 'drilldown' | 'striped') => {
    if (presetType === 'clean') {
      setTreemapAlgorithm('squarified');
      setTreemapSquareRatio(0.5 * (1 + Math.sqrt(5)));
      setTreemapVisibleDepth(2);
      setTreemapGapWidth(2);
      setTreemapBorderWidth(2);
      setTreemapBorderRadius(0);
      setTreemapBorderColorMode('auto_bg');
      setTreemapNodeClick('zoomToNode');
      setTreemapRoam(false);
      setTreemapDrillDownIcon('▶');
      setTreemapShowBreadcrumb(true);
      setTreemapBreadcrumbPosition('bottom');
      setTreemapColorMode('branch_gradient');
      setTreemapCohortMode('grouped');
      setTreemapShowLabels(true);
      setTreemapLabelPosition('inside');
      setTreemapLabelFormat('name_count');
      setTreemapLabelFontWeight('600');
      setTreemapLabelColorMode('auto_contrast');
      setTreemapLabelOverflow('break');
      setTreemapShowUpperLabel(false);
      setTreemapVisibleMin(10);
      setTreemapLevelConfigs({});
    } else if (presetType === 'banners') {
      setTreemapAlgorithm('squarified');
      setTreemapSquareRatio(0.5 * (1 + Math.sqrt(5)));
      setTreemapVisibleDepth(2);
      setTreemapGapWidth(4);
      setTreemapBorderWidth(2);
      setTreemapBorderRadius(4);
      setTreemapBorderColorMode('auto_bg');
      setTreemapNodeClick('zoomToNode');
      setTreemapRoam(false);
      setTreemapShowBreadcrumb(true);
      setTreemapBreadcrumbPosition('bottom');
      setTreemapColorMode('branch_gradient');
      setTreemapCohortMode('grouped');
      setTreemapShowLabels(true);
      setTreemapLabelPosition('inside');
      setTreemapLabelFormat('name_count');
      setTreemapLabelFontWeight('600');
      setTreemapLabelColorMode('auto_contrast');
      setTreemapShowUpperLabel(true);
      setTreemapUpperLabelHeight(26);
      setTreemapUpperLabelFontSize(12);
      setTreemapUpperLabelFontWeight('bold');
      setTreemapUpperLabelColorMode('auto_contrast');
      setTreemapUpperLabelBgColor('rgba(0,0,0,0.22)');
      setTreemapUpperLabelFormat('name');
      setTreemapVisibleMin(12);
      setTreemapLevelConfigs({
        0: { showUpperLabel: true, upperLabelHeight: 26, upperLabelFontSize: 12, upperLabelFormat: 'name' }
      });
    } else if (presetType === 'dense') {
      setTreemapAlgorithm('squarified');
      setTreemapSquareRatio(1.0);
      setTreemapVisibleDepth(2);
      setTreemapGapWidth(0);
      setTreemapBorderWidth(1);
      setTreemapBorderRadius(0);
      setTreemapBorderColorMode('contrast');
      setTreemapNodeClick('none');
      setTreemapRoam(false);
      setTreemapShowBreadcrumb(false);
      setTreemapColorMode('level_discrete');
      setTreemapCohortMode('grouped');
      setTreemapShowLabels(true);
      setTreemapLabelPosition('inside');
      setTreemapLabelFormat('name_count');
      setTreemapLabelFontSize(10);
      setTreemapLabelFontWeight('normal');
      setTreemapLabelColorMode('auto_contrast');
      setTreemapLabelOverflow('truncate');
      setTreemapShowUpperLabel(false);
      setTreemapVisibleMin(5);
      setTreemapLevelConfigs({});
    } else if (presetType === 'drilldown') {
      setTreemapAlgorithm('squarified');
      setTreemapVisibleDepth(1);
      setTreemapGapWidth(3);
      setTreemapBorderWidth(2);
      setTreemapBorderRadius(2);
      setTreemapBorderColorMode('auto_bg');
      setTreemapNodeClick('zoomToNode');
      setTreemapRoam(true);
      setTreemapDrillDownIcon('▶');
      setTreemapShowBreadcrumb(true);
      setTreemapBreadcrumbPosition('top');
      setTreemapColorMode('branch_gradient');
      setTreemapCohortMode('grouped');
      setTreemapShowLabels(true);
      setTreemapLabelPosition('inside');
      setTreemapLabelFormat('name_ratio');
      setTreemapLabelFontWeight('bold');
      setTreemapLabelColorMode('auto_contrast');
      setTreemapShowUpperLabel(false);
      setTreemapVisibleMin(8);
      setTreemapLevelConfigs({});
    } else if (presetType === 'striped') {
      setTreemapAlgorithm('sliceAndDice');
      setTreemapSquareRatio(0.1);
      setTreemapVisibleDepth(2);
      setTreemapGapWidth(2);
      setTreemapBorderWidth(2);
      setTreemapBorderRadius(0);
      setTreemapBorderColorMode('auto_bg');
      setTreemapNodeClick('zoomToNode');
      setTreemapRoam(false);
      setTreemapShowBreadcrumb(true);
      setTreemapBreadcrumbPosition('bottom');
      setTreemapColorMode('branch_gradient');
      setTreemapCohortMode('grouped');
      setTreemapShowLabels(true);
      setTreemapLabelPosition('inside');
      setTreemapLabelFormat('name_count');
      setTreemapLabelFontWeight('600');
      setTreemapLabelColorMode('auto_contrast');
      setTreemapLabelOverflow('break');
      setTreemapShowUpperLabel(false);
      setTreemapLevelConfigs({});
    }
  };

  const clearLevelOverrides = (prop: keyof TreemapLevelConfig) => {
    if (treemapLevelConfigs && Object.keys(treemapLevelConfigs).length > 0) {
      const updated = { ...treemapLevelConfigs };
      let changed = false;
      for (const k of Object.keys(updated)) {
        const numK = Number(k);
        if (updated[numK]?.[prop] !== undefined) {
          delete updated[numK][prop];
          changed = true;
        }
      }
      if (changed) setTreemapLevelConfigs(updated);
    }
  };

  const handleAlgorithmChange = (algo: 'squarified' | 'sliceAndDice' | 'binary') => {
    setTreemapAlgorithm(algo);
    if (algo === 'sliceAndDice') {
      setTreemapSquareRatio(0.1);
    } else if (algo === 'binary') {
      setTreemapSquareRatio(1.0);
    } else {
      setTreemapSquareRatio(0.5 * (1 + Math.sqrt(5)));
    }
  };

  const handleGlobalGapWidthChange = (val: number) => {
    setTreemapGapWidth(val);
    clearLevelOverrides('gapWidth');
  };

  const handleGlobalBorderWidthChange = (val: number) => {
    setTreemapBorderWidth(val);
    clearLevelOverrides('borderWidth');
  };

  const handleGlobalBorderRadiusChange = (val: number) => {
    setTreemapBorderRadius(val);
    clearLevelOverrides('borderRadius');
  };

  const handleGlobalBorderColorModeChange = (val: any) => {
    setTreemapBorderColorMode(val);
    clearLevelOverrides('borderColor');
  };

  const handleGlobalVisibleMinChange = (val: number) => {
    setTreemapVisibleMin(val);
    clearLevelOverrides('visibleMin');
  };

  const handleGlobalChildrenVisibleMinChange = (val: number) => {
    setTreemapChildrenVisibleMin(val);
    clearLevelOverrides('childrenVisibleMin');
  };

  const handleGlobalFontSizeChange = (val: number) => {
    setTreemapLabelFontSize(val);
    clearLevelOverrides('fontSize');
  };

  const handleGlobalWidthChange = (val: number) => {
    setTreemapLabelWidth(val);
    clearLevelOverrides('labelWidth');
  };

  const handleGlobalLineHeightChange = (val: number) => {
    setTreemapLabelLineHeight(val);
    if (treemapLevelConfigs && Object.keys(treemapLevelConfigs).length > 0) {
      const updated = { ...treemapLevelConfigs };
      let changed = false;
      for (const k of Object.keys(updated)) {
        const numK = Number(k);
        if (updated[numK]?.lineHeight !== undefined || updated[numK]?.labelLineHeight !== undefined) {
          delete updated[numK].lineHeight;
          delete updated[numK].labelLineHeight;
          changed = true;
        }
      }
      if (changed) setTreemapLevelConfigs(updated);
    }
  };

  const handleGlobalFontWeightChange = (val: any) => {
    setTreemapLabelFontWeight(val);
    clearLevelOverrides('fontWeight');
  };

  const handleGlobalFontStyleChange = (val: any) => {
    setTreemapLabelFontStyle(val);
    clearLevelOverrides('fontStyle');
  };

  const handleGlobalOverflowChange = (val: any) => {
    setTreemapLabelOverflow(val);
    clearLevelOverrides('overflow');
  };

  const handleGlobalFormatChange = (val: any) => {
    setTreemapLabelFormat(val);
    clearLevelOverrides('labelFormat');
  };

  const handleGlobalPositionChange = (val: any) => {
    setTreemapLabelPosition(val);
    clearLevelOverrides('labelPosition');
  };

  const handleGlobalColorModeChange = (val: any) => {
    setTreemapLabelColorMode(val);
    clearLevelOverrides('colorMode');
  };

  const handleGlobalColorChange = (val: string) => {
    setTreemapLabelColor(val);
    clearLevelOverrides('color');
  };

  const handleGlobalBorderColorChange = (val: string) => {
    setTreemapBorderColor(val);
    clearLevelOverrides('borderColor');
  };

  const handleGlobalShowUpperLabelChange = (val: boolean) => {
    setTreemapShowUpperLabel(val);
    clearLevelOverrides('showUpperLabel');
  };

  const handleGlobalUpperHeightChange = (val: number) => {
    setTreemapUpperLabelHeight(val);
    clearLevelOverrides('upperLabelHeight');
  };

  const handleGlobalUpperFontSizeChange = (val: number) => {
    setTreemapUpperLabelFontSize(val);
    clearLevelOverrides('upperLabelFontSize');
  };

  const handleGlobalUpperFontWeightChange = (val: any) => {
    setTreemapUpperLabelFontWeight(val);
    clearLevelOverrides('upperLabelFontWeight');
  };

  const handleGlobalUpperColorModeChange = (val: any) => {
    setTreemapUpperLabelColorMode(val);
    clearLevelOverrides('upperLabelColorMode');
  };

  const handleGlobalUpperColorChange = (val: string) => {
    setTreemapUpperLabelColor(val);
    clearLevelOverrides('upperLabelColor');
  };

  const handleGlobalUpperFormatChange = (val: any) => {
    setTreemapUpperLabelFormat(val);
    clearLevelOverrides('upperLabelFormat');
  };

  const handleGlobalUpperBgColorChange = (val: string) => {
    setTreemapUpperLabelBgColor(val);
    clearLevelOverrides('upperLabelBgColor');
  };

  const handleGlobalShowLabelsChange = (val: boolean) => {
    setTreemapShowLabels(val);
    clearLevelOverrides('showLabel');
  };

  return (
    <div className="space-y-4">
      {/* 1. Quick Preset Layout Shortcuts */}
      <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Academic Layout Presets:</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">One-Click Optimization</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset('clean')}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all"
          >
            Publication Clean (Squarified Standard)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('banners')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Nested Container Banners (Upper Headers)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('dense')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Minimalist Tile Matrix (0px Gap)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('drilldown')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Interactive Drill-down Explorer (Zoom & Roam)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('striped')}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Slice & Dice Columnar Flow
          </button>
        </div>
      </div>

      {/* 2. Global Architecture & Partitioning */}
      <div className="p-3.5 bg-card border border-border rounded-xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Architecture, Partitioning & Interactive Navigation
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Layout Engine</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Partitioning Algorithm</label>
            <select
              value={treemapAlgorithm}
              onChange={(e) => handleAlgorithmChange(e.target.value as any)}
              className="w-full bg-secondary/40 border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground font-bold"
            >
              <option value="squarified">Squarified (Golden Ratio Standard)</option>
              <option value="sliceAndDice">Slice & Dice (Alternating Stripes)</option>
              <option value="binary">Binary Partition Tree</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Aspect Ratio Target</label>
              <span className="text-[10px] font-mono text-muted-foreground">{Number(treemapSquareRatio).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={2.5}
              step={0.05}
              value={treemapSquareRatio}
              onChange={(e) => setTreemapSquareRatio(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Visible Hierarchy Depth</label>
              <span className="text-[10px] font-mono text-muted-foreground">{treemapVisibleDepth} Levels</span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.max(4, sankeyFields.length)}
              value={treemapVisibleDepth}
              onChange={(e) => setTreemapVisibleDepth(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-border/40">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Tile Click Interaction</label>
            <select
              value={treemapNodeClick}
              onChange={(e) => setTreemapNodeClick(e.target.value as any)}
              className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="zoomToNode">Zoom Into Node (Drill-down)</option>
              <option value="none">Disabled (Static Publication)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Pan & Zoom (Roam)</label>
            <select
              value={typeof treemapRoam === 'string' ? treemapRoam : treemapRoam ? 'true' : 'false'}
              onChange={(e) => {
                const val = e.target.value;
                setTreemapRoam(val === 'true' ? true : val === 'false' ? false : val as any);
              }}
              className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="false">Disabled (Fixed Canvas)</option>
              <option value="true">Full Pan & Zoom (Drag & Scroll)</option>
              <option value="scale">Zoom Only (Scroll)</option>
              <option value="move">Pan Only (Drag)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Drill-Down Indicator</label>
            <select
              value={treemapDrillDownIcon}
              onChange={(e) => setTreemapDrillDownIcon(e.target.value)}
              className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="▶">Caret Triangle (▶)</option>
              <option value="▼">Arrow Down (▼)</option>
              <option value="🔍">Magnifier (🔍)</option>
              <option value="⚡">Bolt Indicator (⚡)</option>
              <option value="">None (Clean)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Native Breadcrumb Bar</label>
            <select
              value={treemapShowBreadcrumb ? treemapBreadcrumbPosition : 'none'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'none') {
                  setTreemapShowBreadcrumb(false);
                } else {
                  setTreemapShowBreadcrumb(true);
                  setTreemapBreadcrumbPosition(val as 'bottom' | 'top');
                }
              }}
              className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="bottom">Bottom Docked</option>
              <option value="top">Top Docked</option>
              <option value="none">Hidden</option>
            </select>
          </div>
        </div>

        {/* Reset Drill-Down Action Card */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/20 mt-1">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-primary" />
              Reset Drill-Down View
            </span>
            <p className="text-[10px] text-muted-foreground">
              Zoomed into a tile? Click here or &quot;Reset Root&quot; in the top canvas toolbar to return to the full overview.
            </p>
          </div>
          <button
            type="button"
            onClick={() => canvas?.resetSlotDrillDown()}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-xs shrink-0"
            title="Reset Drill-Down to root level"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Root
          </button>
        </div>
      </div>

      {/* 3. Geometry, Gaps & Outlines */}
      <div className="p-3.5 bg-card border border-border rounded-xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            Tile Spacing, Outlines & Geometry
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Borders & Margins</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Inter-Tile Gap</label>
              <span className="text-[10px] font-mono text-muted-foreground">{treemapGapWidth}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              value={treemapGapWidth}
              onChange={(e) => handleGlobalGapWidthChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Tile Border Width</label>
              <span className="text-[10px] font-mono text-muted-foreground">{treemapBorderWidth}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={treemapBorderWidth}
              onChange={(e) => handleGlobalBorderWidthChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Rounded Corners</label>
              <span className="text-[10px] font-mono text-muted-foreground">{treemapBorderRadius ?? 0}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={16}
              value={treemapBorderRadius ?? 0}
              onChange={(e) => handleGlobalBorderRadiusChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Border Color Mode</label>
            <div className="flex items-center gap-1.5">
              <select
                value={treemapBorderColorMode}
                onChange={(e) => handleGlobalBorderColorModeChange(e.target.value as any)}
                className="flex-1 bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
              >
                <option value="auto_bg">Canvas Background (Clean)</option>
                <option value="contrast">Subtle Contrast Outline</option>
                <option value="transparent">Transparent (No Lines)</option>
                <option value="custom">Custom Color Picker</option>
              </select>
              {treemapBorderColorMode === 'custom' && (
                <input
                  type="color"
                  value={treemapBorderColor || '#ffffff'}
                  onChange={(e) => handleGlobalBorderColorChange(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer p-0.5"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Color Dynamics & Depth Shading */}
      <div className="p-3.5 bg-card border border-border rounded-xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-primary" />
            Color Dynamics & Hierarchical Depth Shading
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Tints & Saturation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Smart Coloring Mode</label>
            <select
              value={treemapColorMode}
              onChange={(e) => setTreemapColorMode(e.target.value as any)}
              className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="branch_gradient">Harmonious Branch Gradient (Parent Weighted)</option>
              <option value="depth_fade">Progressive Depth Fade (Alpha Fading by Level)</option>
              <option value="value_weighted">Value-Weighted Tints (Dark High / Light Low)</option>
              <option value="level_discrete">Level-by-Level Discrete Palette Bands</option>
              <option value="rainbow_discrete">Direct Sequential Palette</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground block">Color Mapping Attribute</label>
            <select
              value={treemapColorMappingBy}
              onChange={(e) => setTreemapColorMappingBy(e.target.value as any)}
              className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
            >
              <option value="index">By Hierarchy Index (Balanced Spread)</option>
              <option value="value">By Numeric Paper Frequency (Heat Map)</option>
              <option value="id">By Canonical Node ID</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Depth Alpha Fade (Min)</label>
              <span className="text-[10px] font-mono text-muted-foreground">{Math.round((treemapColorAlphaMin ?? 0.7) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={1.0}
              step={0.05}
              value={treemapColorAlphaMin ?? 0.7}
              onChange={(e) => setTreemapColorAlphaMin(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Color Saturation (Min)</label>
              <span className="text-[10px] font-mono text-muted-foreground">{Math.round((treemapColorSaturationMin ?? 0.6) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={treemapColorSaturationMin ?? 0.6}
              onChange={(e) => setTreemapColorSaturationMin(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground">Color Saturation (Max)</label>
              <span className="text-[10px] font-mono text-muted-foreground">{Math.round((treemapColorSaturationMax ?? 1.0) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={treemapColorSaturationMax ?? 1.0}
              onChange={(e) => setTreemapColorSaturationMax(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      {/* 5. Parent Container Header Banners (upperLabel) */}
      <div className="p-3.5 bg-card border border-border rounded-xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-primary" />
            Parent Container Header Banners (Upper Headers)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Show Headers</span>
            <input
              type="checkbox"
              checked={treemapShowUpperLabel}
              onChange={(e) => handleGlobalShowUpperLabelChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary cursor-pointer"
            />
          </div>
        </div>

        {treemapShowUpperLabel && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Header Height</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{treemapUpperLabelHeight}px</span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={38}
                  value={treemapUpperLabelHeight}
                  onChange={(e) => handleGlobalUpperHeightChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Header Font Size</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{treemapUpperLabelFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={9}
                  max={20}
                  value={treemapUpperLabelFontSize}
                  onChange={(e) => handleGlobalUpperFontSizeChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Header Weight</label>
                <select
                  value={treemapUpperLabelFontWeight}
                  onChange={(e) => handleGlobalUpperFontWeightChange(e.target.value as any)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="bold">Bold (700)</option>
                  <option value="600">Semi-Bold (600)</option>
                  <option value="500">Medium (500)</option>
                  <option value="normal">Normal (400)</option>
                  <option value="800">Extra Bold (800)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Header Text Color</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={treemapUpperLabelColorMode}
                    onChange={(e) => handleGlobalUpperColorModeChange(e.target.value as any)}
                    className="flex-1 bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                  >
                    <option value="auto_contrast">Auto-Contrast (Legible)</option>
                    <option value="inherit_theme">Theme Default Text</option>
                    <option value="custom">Custom Color Picker</option>
                  </select>
                  {treemapUpperLabelColorMode === 'custom' && (
                    <input
                      type="color"
                      value={treemapUpperLabelColor || '#ffffff'}
                      onChange={(e) => handleGlobalUpperColorChange(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer p-0.5"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Header Format Template</label>
                <select
                  value={treemapUpperLabelFormat}
                  onChange={(e) => handleGlobalUpperFormatChange(e.target.value as any)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <optgroup label="Name, Count & Percentage Combinations">
                    <option value="name">Category Name Only (e.g. Physical Constraints)</option>
                    <option value="name_count">Name + Paper Count (e.g. Physical Constraints (15))</option>
                    <option value="name_count_percent">Name + Count + % (e.g. Physical Constraints (15, ~32%))</option>
                    <option value="name_percent">Name + Percentage (e.g. Physical Constraints ~32%)</option>
                    <option value="count_percent">Count + % (e.g. 15 (~32%))</option>
                  </optgroup>
                  <optgroup label="Ratio & Detailed Proportion Combinations">
                    <option value="name_ratio">Name + Ratio (e.g. Physical Constraints (15/46))</option>
                    <option value="name_ratio_percent">Complete (Name + Ratio + Coarse %)</option>
                    <option value="ratio_percent">Ratio + % (e.g. 15/46, ~32%)</option>
                    <option value="percent_ratio">% + Ratio (e.g. ~32% (15/46))</option>
                  </optgroup>
                  <optgroup label="Multi-Line Formats">
                    <option value="two_line_name_count_percent">Multi-Line: Name \n Count & %</option>
                    <option value="two_line_count_percent">Multi-Line: Count \n %</option>
                  </optgroup>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Header Background Tint</label>
                <select
                  value={treemapUpperLabelBgColor}
                  onChange={(e) => handleGlobalUpperBgColorChange(e.target.value)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="rgba(0,0,0,0.22)">Subtle Dark Shade (22% Black)</option>
                  <option value="rgba(0,0,0,0.35)">Medium Dark Shade (35% Black)</option>
                  <option value="rgba(255,255,255,0.25)">Soft Light Tint (25% White)</option>
                  <option value="transparent">Transparent (No Background)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Global Typography & In-Tile Data Labels */}
      <div className="p-3.5 bg-card border border-border rounded-xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-primary" />
            Tile Typography & Data Labels
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Show Labels</span>
            <input
              type="checkbox"
              checked={treemapShowLabels}
              onChange={(e) => handleGlobalShowLabelsChange(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary cursor-pointer"
            />
          </div>
        </div>

        {treemapShowLabels && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Cohort Denominator & Baseline Capture Selector */}
            <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">Cohort Denominator & Baseline Mode</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold">
                  {treemapCohortMode === 'global' ? 'Global Cohort (Study Total)' : 'Grouped Cohort (Treemap Sum)'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTreemapCohortMode('grouped')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    treemapCohortMode !== 'global'
                      ? 'bg-primary/10 border-primary text-foreground shadow-xs ring-1 ring-primary/30'
                      : 'bg-card border-border/60 hover:bg-secondary/60 text-muted-foreground'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span className="text-foreground">Grouped Cohort (Treemap Sum)</span>
                    {treemapCohortMode !== 'global' && <span className="text-[10px] text-primary font-extrabold">● Active</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    Percentages & ratios relative to total visible elements in the Treemap view (root tiles sum to 100%).
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setTreemapCohortMode('global')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    treemapCohortMode === 'global'
                      ? 'bg-primary/10 border-primary text-foreground shadow-xs ring-1 ring-primary/30'
                      : 'bg-card border-border/60 hover:bg-secondary/60 text-muted-foreground'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span className="text-foreground">Global Cohort (Study Total Population)</span>
                    {treemapCohortMode === 'global' && <span className="text-[10px] text-primary font-extrabold">● Active</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    Percentages & ratios calculated against total systematic review cohort (N = total papers in corpus).
                  </p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Format Template</label>
                <select
                  value={treemapLabelFormat}
                  onChange={(e) => handleGlobalFormatChange(e.target.value as any)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <optgroup label="Count & Percentage Combinations">
                    <option value="name_count_percent">Name + Count + % (e.g. Latency (15, ~32%))</option>
                    <option value="count_percent">Count + % (e.g. 15 (~32%))</option>
                    <option value="name_count">Name + Count (e.g. Latency 15)</option>
                    <option value="name_percent">Name + Percentage (e.g. Latency ~32%)</option>
                    <option value="count_only">Count Only (e.g. 15)</option>
                    <option value="percent_only">Percentage Only (e.g. ~32%)</option>
                    <option value="name">Category Name Only</option>
                  </optgroup>
                  <optgroup label="Ratio & Detailed Proportion Combinations">
                    <option value="name_ratio_percent">Name + Ratio + % (e.g. Latency (15/46, ~32%))</option>
                    <option value="ratio_percent">Ratio + % (e.g. 15/46, ~32%)</option>
                    <option value="percent_ratio">% + Ratio (e.g. ~32% (15/46))</option>
                    <option value="name_ratio">Name + Ratio (e.g. Latency (15/46))</option>
                    <option value="ratio_only">Ratio Only (e.g. 15/46)</option>
                  </optgroup>
                  <optgroup label="Multi-Line Compact Formats">
                    <option value="two_line_name_count_percent">Multi-Line: Name \n Count & %</option>
                    <option value="two_line_count_percent">Multi-Line: Count \n %</option>
                    <option value="two_line_percent_count">Multi-Line: % \n Count</option>
                    <option value="two_line_ratio_percent">Multi-Line: Ratio \n %</option>
                    <option value="two_line_percent_ratio">Multi-Line: % \n Ratio</option>
                  </optgroup>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Alignment / Position</label>
                <select
                  value={treemapLabelPosition}
                  onChange={(e) => handleGlobalPositionChange(e.target.value as any)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="inside">Inside Center</option>
                  <option value="topLeft">Top Left</option>
                  <option value="topRight">Top Right</option>
                  <option value="bottomLeft">Bottom Left</option>
                  <option value="bottomRight">Bottom Right</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Label Text Color Contrast</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={treemapLabelColorMode}
                    onChange={(e) => handleGlobalColorModeChange(e.target.value as any)}
                    className="flex-1 bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                  >
                    <option value="auto_contrast">Auto-Contrast (Black/White Adaptive)</option>
                    <option value="inherit_theme">Theme Default Text</option>
                    <option value="custom">Custom Color Picker</option>
                  </select>
                  {treemapLabelColorMode === 'custom' && (
                    <input
                      type="color"
                      value={treemapLabelColor || '#ffffff'}
                      onChange={(e) => handleGlobalColorChange(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer p-0.5"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Font Size</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{treemapLabelFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={treemapLabelFontSize}
                  onChange={(e) => handleGlobalFontSizeChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Font Weight</label>
                <select
                  value={treemapLabelFontWeight}
                  onChange={(e) => handleGlobalFontWeightChange(e.target.value as any)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="600">Semi-Bold (600)</option>
                  <option value="bold">Bold (700)</option>
                  <option value="500">Medium (500)</option>
                  <option value="normal">Normal (400)</option>
                  <option value="800">Extra Bold (800)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Font Style</label>
                <select
                  value={treemapLabelFontStyle}
                  onChange={(e) => handleGlobalFontStyleChange(e.target.value as any)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="normal">Normal (Upright)</option>
                  <option value="italic">Italic (Academic)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground block">Overflow Handling</label>
                <select
                  value={treemapLabelOverflow}
                  onChange={(e) => handleGlobalOverflowChange(e.target.value as any)}
                  className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                >
                  <option value="break">Word Wrap (Break Line)</option>
                  <option value="truncate">Truncate with Ellipsis (...)</option>
                  <option value="none">Clip Without Ellipsis</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Tile Label Width (Wrap Boundary)</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{treemapLabelWidth}px</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={350}
                  step={5}
                  value={treemapLabelWidth}
                  onChange={(e) => handleGlobalWidthChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Defines the pixel boundary where words wrap or truncate. Critical for multi-line tile text.
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Line Height / Spacing</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{treemapLabelLineHeight}px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={32}
                  value={treemapLabelLineHeight}
                  onChange={(e) => handleGlobalLineHeightChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Vertical line spacing between wrapped lines in a tile.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Visible Min Area (Micro-Tile Guard)</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{treemapVisibleMin} px²</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={250}
                  step={5}
                  value={treemapVisibleMin}
                  onChange={(e) => handleGlobalVisibleMinChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-[10px] text-muted-foreground block">Tiles smaller than this threshold suppress labels to avoid visual overlap</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Children Collapse Area Threshold</label>
                  <span className="text-[10px] font-mono text-muted-foreground">{treemapChildrenVisibleMin ?? 0} px²</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={10}
                  value={treemapChildrenVisibleMin ?? 0}
                  onChange={(e) => handleGlobalChildrenVisibleMinChange(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="text-[10px] text-muted-foreground block">If parent area is below this value, children are collapsed into parent tile</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. Per-Level Hierarchy Depth Tabs */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
          <span className="text-xs font-extrabold text-foreground mr-2">Level Settings:</span>
          {sankeyFields.map((fKey, lIdx) => {
            const labelText = `Level ${lIdx + 1} (${fKey === CUSTOM_GROUPING_KEY ? 'Custom Grouping' : fKey.startsWith('raw:ext:') ? `${fKey.substring(8)} (Raw)` : fKey.startsWith('ext:') ? fKey.substring(4) : fKey})`;
            const isActive = activeTreemapLevelTab === lIdx;
            return (
              <button
                key={lIdx}
                type="button"
                onClick={() => setActiveTreemapLevelTab(lIdx)}
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

        {/* Active Level Configuration Panel */}
        {(() => {
          const lIdx = Math.max(0, Math.min(activeTreemapLevelTab, Math.max(0, sankeyFields.length - 1)));
          const isLeafLevel = lIdx === sankeyFields.length - 1;
          const curConf: TreemapLevelConfig = treemapLevelConfigs[lIdx] || {};

          const updateCurConf = (partial: Partial<TreemapLevelConfig>) => {
            setTreemapLevelConfigs({
              ...treemapLevelConfigs,
              [lIdx]: { ...curConf, ...partial }
            });
          };

          return (
            <div className="p-4 bg-card border border-border rounded-xl space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-xs font-extrabold text-primary flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" />
                  Level {lIdx + 1} Depth Parameters ({sankeyFields[lIdx] || 'Node'})
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {isLeafLevel ? 'Leaf Level' : 'Parent Container Level'}
                </span>
              </div>

              {/* Per-level Spacing & Borders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">Level Gap Width</label>
                    <span className="text-[10px] font-mono text-muted-foreground">{curConf.gapWidth ?? treemapGapWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={curConf.gapWidth ?? treemapGapWidth}
                    onChange={(e) => updateCurConf({ gapWidth: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">Level Border Width</label>
                    <span className="text-[10px] font-mono text-muted-foreground">{curConf.borderWidth ?? treemapBorderWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={curConf.borderWidth ?? treemapBorderWidth}
                    onChange={(e) => updateCurConf({ borderWidth: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">Level Corner Radius</label>
                    <span className="text-[10px] font-mono text-muted-foreground">{curConf.borderRadius ?? treemapBorderRadius ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={curConf.borderRadius ?? treemapBorderRadius ?? 0}
                    onChange={(e) => updateCurConf({ borderRadius: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Parent Upper Label for non-leaf levels */}
              {!isLeafLevel && (
                <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FolderTree className="w-3 h-3 text-primary" />
                      Container Header Banner on Level {lIdx + 1}
                    </span>
                    <input
                      type="checkbox"
                      checked={curConf.showUpperLabel !== undefined ? curConf.showUpperLabel : (!isLeafLevel && treemapShowUpperLabel)}
                      onChange={(e) => updateCurConf({ showUpperLabel: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary cursor-pointer"
                    />
                  </div>

                  {(curConf.showUpperLabel !== undefined ? curConf.showUpperLabel : (!isLeafLevel && treemapShowUpperLabel)) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground block">
                          Banner Height ({curConf.upperLabelHeight ?? treemapUpperLabelHeight ?? 24}px)
                        </label>
                        <input
                          type="range"
                          min={18}
                          max={36}
                          value={curConf.upperLabelHeight ?? treemapUpperLabelHeight ?? 24}
                          onChange={(e) => updateCurConf({ upperLabelHeight: Number(e.target.value) })}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground block">
                          Font Size ({curConf.upperLabelFontSize ?? treemapUpperLabelFontSize ?? 11}px)
                        </label>
                        <input
                          type="range"
                          min={9}
                          max={18}
                          value={curConf.upperLabelFontSize ?? treemapUpperLabelFontSize ?? 11}
                          onChange={(e) => updateCurConf({ upperLabelFontSize: Number(e.target.value) })}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground block">Header Template</label>
                        <select
                          value={curConf.upperLabelFormat || treemapUpperLabelFormat || 'name'}
                          onChange={(e) => updateCurConf({ upperLabelFormat: e.target.value as any })}
                          className="w-full bg-card border border-border rounded px-2 py-1 text-xs font-bold"
                        >
                          <optgroup label="Name, Count & %">
                            <option value="name">Name Only</option>
                            <option value="name_count">Name + Count</option>
                            <option value="name_count_percent">Name + Count + %</option>
                            <option value="name_percent">Name + %</option>
                            <option value="count_percent">Count + %</option>
                          </optgroup>
                          <optgroup label="Ratio Combinations">
                            <option value="name_ratio">Name + Ratio</option>
                            <option value="name_ratio_percent">Complete (Name + Ratio + %)</option>
                            <option value="ratio_percent">Ratio + %</option>
                            <option value="percent_ratio">% + Ratio</option>
                          </optgroup>
                          <optgroup label="Multi-Line">
                            <option value="two_line_name_count_percent">Multi-Line: Name \n Count & %</option>
                            <option value="two_line_count_percent">Multi-Line: Count \n %</option>
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Per-level In-Tile Data Labels */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">Level Label Size</label>
                    <span className="text-[10px] font-mono text-muted-foreground">{curConf.fontSize ?? treemapLabelFontSize ?? 11}px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={24}
                    value={curConf.fontSize ?? treemapLabelFontSize ?? 11}
                    onChange={(e) => updateCurConf({ fontSize: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">Level Label Width</label>
                    <span className="text-[10px] font-mono text-muted-foreground">{curConf.labelWidth ?? treemapLabelWidth ?? 120}px</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={350}
                    step={5}
                    value={curConf.labelWidth ?? treemapLabelWidth ?? 120}
                    onChange={(e) => updateCurConf({ labelWidth: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Level Label Weight</label>
                  <select
                    value={curConf.fontWeight || treemapLabelFontWeight || '600'}
                    onChange={(e) => updateCurConf({ fontWeight: e.target.value as any })}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                  >
                    <option value="normal">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semi-Bold (600)</option>
                    <option value="bold">Bold (700)</option>
                    <option value="800">Extra Bold (800)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Level Label Format</label>
                  <select
                    value={curConf.labelFormat || treemapLabelFormat || 'name_count'}
                    onChange={(e) => updateCurConf({ labelFormat: e.target.value as any })}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
                  >
                    <optgroup label="Count & % Combinations">
                      <option value="name_count_percent">Name + Count + %</option>
                      <option value="count_percent">Count + %</option>
                      <option value="name_count">Name + Count</option>
                      <option value="name_percent">Name + %</option>
                      <option value="count_only">Count Only</option>
                      <option value="percent_only">Percent Only</option>
                      <option value="name">Name Only</option>
                    </optgroup>
                    <optgroup label="Ratio Combinations">
                      <option value="name_ratio_percent">Name + Ratio + %</option>
                      <option value="ratio_percent">Ratio + %</option>
                      <option value="percent_ratio">% + Ratio</option>
                      <option value="name_ratio">Name + Ratio</option>
                      <option value="ratio_only">Ratio Only</option>
                    </optgroup>
                    <optgroup label="Multi-Line Formats">
                      <option value="two_line_name_count_percent">Multi-Line: Name \n Count & %</option>
                      <option value="two_line_count_percent">Multi-Line: Count \n %</option>
                      <option value="two_line_percent_count">Multi-Line: % \n Count</option>
                      <option value="two_line_ratio_percent">Multi-Line: Ratio \n %</option>
                      <option value="two_line_percent_ratio">Multi-Line: % \n Ratio</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
