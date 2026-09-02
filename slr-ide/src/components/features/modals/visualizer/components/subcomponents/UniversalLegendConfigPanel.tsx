import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { Sliders, Layout, Type, Palette, ArrowRight } from 'lucide-react';
import type { DisplayFormatTemplate } from '../../types';

export function UniversalLegendConfigPanel() {
  const { config, style } = useVisualizerContext();
  const {
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
    legendIcon = 'inherit',
    setLegendIcon,
    legendItemWidth = 25,
    setLegendItemWidth,
    legendItemHeight = 14,
    setLegendItemHeight,
    legendFormat = 'name',
    setLegendFormat,
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

  return (
    <div className="space-y-4 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Layout className="w-3.5 h-3.5" />
          Universal Legend & Keys Configurator
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showLegend}
            onChange={(e) => setShowLegend(e.target.checked)}
            className="w-3.5 h-3.5 rounded text-primary"
          />
          <span className="text-xs font-bold text-foreground">Show Legend</span>
        </label>
      </div>

      {showLegend && (
        <div className="space-y-4">
          {/* Position, Format & Shape */}
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
                onChange={(e) => setLegendFormat(e.target.value as DisplayFormatTemplate)}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
              >
                <option value="name">Category Name Only</option>
                <option value="name_ratio_percent">Name + Ratio + Coarse %</option>
                <option value="ratio_percent">Ratio + % (n = x/N, ~P%)</option>
                <option value="percent_only">Percentage Only (~P%)</option>
                <option value="count_only">Count Only (n = x)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground block">Key Icon Shape</label>
              <select
                value={legendIcon}
                onChange={(e) => setLegendIcon(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
              >
                <option value="inherit">Inherit / Default</option>
                <option value="roundRect">Rounded Box</option>
                <option value="rect">Rectangle</option>
                <option value="circle">Circle</option>
                <option value="diamond">Diamond</option>
                <option value="line">Line Indicator</option>
                <option value="none">None (Text Only)</option>
              </select>
            </div>
          </div>

          {/* Typography Customization */}
          <div className="space-y-2.5 p-3 bg-secondary/30 rounded-xl border border-border/50">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
              Legend Typography
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Key Font Size ({legendFontSize || 10}px)</label>
                <input
                  type="range"
                  min={8}
                  max={32}
                  value={legendFontSize || 10}
                  onChange={(e) => setLegendFontSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Font Weight</label>
                <select
                  value={legendFontWeight as string}
                  onChange={(e) => setLegendFontWeight(e.target.value as any)}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <option value="normal">Normal (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">SemiBold (600)</option>
                  <option value="bold">Bold (700)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Font Style</label>
                <select
                  value={legendFontStyle}
                  onChange={(e) => setLegendFontStyle(e.target.value as any)}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">Line Height ({legendLineHeight}px)</label>
                <input
                  type="range"
                  min={10}
                  max={36}
                  value={legendLineHeight}
                  onChange={(e) => setLegendLineHeight(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-[10px] font-bold text-muted-foreground">Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={legendTextColor || '#334155'}
                  onChange={(e) => setLegendTextColor(e.target.value)}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={legendTextColor}
                  onChange={(e) => setLegendTextColor(e.target.value)}
                  placeholder="Auto / Theme Palette Color"
                  className="flex-1 bg-secondary border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Spacing & Geometry Offsets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-foreground block">
                Item Spacing Gap ({legendItemGap}px)
              </label>
              <input
                type="range"
                min={4}
                max={120}
                value={legendItemGap}
                onChange={(e) => setLegendItemGap(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-foreground block">
                Grid Offset ({legendDistance}px)
              </label>
              <input
                type="range"
                min={0}
                max={180}
                value={legendDistance}
                onChange={(e) => setLegendDistance(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-foreground block">
                Icon Size ({legendItemWidth}×{legendItemHeight}px)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  min={8}
                  max={60}
                  value={legendItemWidth}
                  onChange={(e) => setLegendItemWidth(Number(e.target.value))}
                  className="bg-secondary border border-border rounded px-1.5 py-1 text-xs font-mono"
                  title="Width"
                />
                <input
                  type="number"
                  min={4}
                  max={40}
                  value={legendItemHeight}
                  onChange={(e) => setLegendItemHeight(Number(e.target.value))}
                  className="bg-secondary border border-border rounded px-1.5 py-1 text-xs font-mono"
                  title="Height"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
