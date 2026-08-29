import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { THEME_PALETTES } from '../../constants/themePalettes';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';

export function SunburstLevelConfigPanel() {
  const { config, style } = useVisualizerContext();
  const {
    sankeyFields,
    sunburstSort,
    setSunburstSort,
    sunburstNodeClick,
    setSunburstNodeClick,
    sunburstEmphasisFocus,
    setSunburstEmphasisFocus,
    sunburstLevelConfigs,
    setSunburstLevelConfigs
  } = config;

  const { themePreset } = style;
  const [activeSunburstLevelTab, setActiveSunburstLevelTab] = useState<number>(0);

  return (
    <div className="space-y-4">
      {/* Quick Preset Layout Shortcuts */}
      <div className="p-3 bg-card border border-border rounded-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Layout Presets:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSunburstLevelConfigs({
                0: { r0: 15, r: 35, position: 'inside', rotate: 'tangential', align: 'center', minAngle: 0, borderWidth: 2, fontSize: 13, overflow: 'none' },
                1: { r0: 35, r: 70, position: 'inside', rotate: 'radial', align: 'right', minAngle: 0, borderWidth: 1, fontSize: 11, overflow: 'none' },
                2: { r0: 70, r: 72, position: 'outside', rotate: 'radial', align: 'right', minAngle: 0, borderWidth: 3, fontSize: 10, overflow: 'none' }
              });
            }}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all"
          >
            Coffee Lexicon Style
          </button>
          <button
            type="button"
            onClick={() => {
              setSunburstLevelConfigs({
                0: { r0: 15, r: 45, position: 'inside', rotate: 'tangential', align: 'center', minAngle: 0, borderWidth: 1, fontSize: 12, overflow: 'none' },
                1: { r0: 45, r: 75, position: 'inside', rotate: 'tangential', align: 'center', minAngle: 0, borderWidth: 1, fontSize: 11, overflow: 'none' },
                2: { r0: 75, r: 90, position: 'inside', rotate: 'tangential', align: 'center', minAngle: 0, borderWidth: 1, fontSize: 10, overflow: 'none' }
              });
            }}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Standard Concentric Rings
          </button>
          <button
            type="button"
            onClick={() => {
              setSunburstLevelConfigs({
                0: { r0: 10, r: 35, position: 'inside', rotate: 'radial', align: 'center', minAngle: 0, borderWidth: 2, fontSize: 12, overflow: 'none' },
                1: { r0: 35, r: 65, position: 'outside', rotate: 'radial', align: 'right', minAngle: 0, borderWidth: 2, fontSize: 11, overflow: 'none' },
                2: { r0: 65, r: 85, position: 'outside', rotate: 'radial', align: 'right', minAngle: 0, borderWidth: 2, fontSize: 10, overflow: 'none' }
              });
            }}
            className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
          >
            Full Radial Burst
          </button>
        </div>
      </div>

      {/* Global Sunburst Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-secondary/30 border border-border/60 rounded-xl">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Slice Sorting Order</label>
          <select
            value={sunburstSort}
            onChange={(e) => setSunburstSort(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="desc">Descending (Largest First)</option>
            <option value="asc">Ascending (Smallest First)</option>
            <option value="none">Unsorted (Dataset Order)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Interactive Node Click</label>
          <select
            value={sunburstNodeClick}
            onChange={(e) => setSunburstNodeClick(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="rootToNode">Zoom Level (rootToNode)</option>
            <option value="none">Disabled (Static Figure)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground block">Hover Focus Shading</label>
          <select
            value={sunburstEmphasisFocus}
            onChange={(e) => setSunburstEmphasisFocus(e.target.value as any)}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground font-bold"
          >
            <option value="ancestor">Highlight Parent Ancestors</option>
            <option value="descendant">Highlight Child Subtree</option>
            <option value="none">No Hover Dimming</option>
          </select>
        </div>
      </div>

      {/* Per-Level Ring Config Tabs */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
          <span className="text-xs font-extrabold text-foreground mr-2">Level Settings:</span>
          {sankeyFields.map((fKey, lIdx) => {
            const labelText = `Level ${lIdx + 1} (${fKey === CUSTOM_GROUPING_KEY ? 'Custom Grouping' : fKey.startsWith('raw:ext:') ? `${fKey.substring(8)} (Raw)` : fKey.startsWith('ext:') ? fKey.substring(4) : fKey})`;
            const isActive = activeSunburstLevelTab === lIdx;
            return (
              <button
                key={lIdx}
                type="button"
                onClick={() => setActiveSunburstLevelTab(lIdx)}
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
          const lIdx = activeSunburstLevelTab;
          const curConf = sunburstLevelConfigs[lIdx] || {
            r0: 15 + lIdx * 30,
            r: 40 + lIdx * 30,
            position: lIdx === 0 ? 'inside' : 'outside',
            rotate: lIdx === 0 ? 'tangential' : 'radial',
            align: 'right',
            minAngle: 0,
            borderWidth: 2,
            fontSize: 11
          };

          const updateCurConf = (partial: Partial<typeof curConf>) => {
            setSunburstLevelConfigs({
              ...sunburstLevelConfigs,
              [lIdx]: { ...curConf, ...partial }
            });
          };

          return (
            <div className="p-4 bg-card border border-border rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-xs font-extrabold text-primary">
                  Level {lIdx + 1} Properties & Ring Radius
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Ring Bounds: r0 = {curConf.r0}%, r = {curConf.r}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Label Position</label>
                  <select
                    value={curConf.position}
                    onChange={(e) => updateCurConf({ position: e.target.value as any })}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  >
                    <option value="inside">Inside Ring Slice</option>
                    <option value="outside">Outside Ring (Radial Projection)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Label Orientation</label>
                  <select
                    value={curConf.rotate}
                    onChange={(e) => updateCurConf({ rotate: e.target.value as any })}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  >
                    <option value="tangential">Tangential (Curved arc)</option>
                    <option value="radial">Radial (Pointing outwards)</option>
                    <option value="flat">Flat (Horizontal)</option>
                  </select>
                </div>

                {curConf.position === 'outside' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground block">Label Alignment</label>
                    <select
                      value={curConf.align}
                      onChange={(e) => updateCurConf({ align: e.target.value as any })}
                      className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                    >
                      <option value="right">Right (Outward Radial)</option>
                      <option value="center">Center</option>
                      <option value="left">Left (Inward Radial)</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Level Font Size ({curConf.fontSize}px)</label>
                  <input
                    type="number"
                    min={8}
                    max={20}
                    value={curConf.fontSize}
                    onChange={(e) => updateCurConf({ fontSize: Number(e.target.value) })}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  />
                </div>
              </div>

              {/* Slice Label Format Selection */}
              <div className="p-3 bg-secondary/20 border border-border/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 flex-1 max-w-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground block">Slice Label Format (Level {lIdx + 1})</label>
                  </div>
                  <select
                    value={curConf.labelFormat || 'name'}
                    onChange={(e) => updateCurConf({ labelFormat: e.target.value as any })}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  >
                    <option value="name_only">Category Name Only (e.g. "Manufacturing")</option>
                    <option value="name_ratio_percent">Name + Ratio + Coarse % (e.g. "Manufacturing (n=6/18, ~33%)")</option>
                    <option value="ratio_percent">Ratio + Coarse % (e.g. "n = 6/18, ~33%")</option>
                    <option value="name_ratio">Name + Ratio (e.g. "Manufacturing (n=6/18)")</option>
                    <option value="name_count">Name + Count (e.g. "Manufacturing (n=6)")</option>
                    <option value="name_percent">Name + Percent (e.g. "Manufacturing (~33%)")</option>
                    <option value="name_count_percent">Name + Count + Percent (e.g. "Manufacturing (n=6, ~33%)")</option>
                    <option value="percent_ratio">Coarse % + Ratio (e.g. "~33% (n=6/18)")</option>
                    <option value="count_only">Count / Value Only (e.g. "n = 6")</option>
                    <option value="percent_only">Percent Only (e.g. "~33%")</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const chosenFmt = curConf.labelFormat || 'name';
                      const newConfigs = { ...sunburstLevelConfigs };
                      sankeyFields.forEach((_, idx) => {
                        newConfigs[idx] = {
                          ...(newConfigs[idx] || {}),
                          labelFormat: chosenFmt
                        } as any;
                      });
                      setSunburstLevelConfigs(newConfigs);
                    }}
                    className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                  >
                    Apply to All Levels
                  </button>
                </div>
              </div>

              {/* Text Color, Line Wrap & Edge Padding Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Level Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={curConf.color || THEME_PALETTES[themePreset]?.text || '#000000'}
                      onChange={(e) => updateCurConf({ color: e.target.value })}
                      className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <span className="text-xs font-mono font-bold text-foreground">
                      {curConf.color || 'Theme Default'}
                    </span>
                    {curConf.color && (
                      <button
                        type="button"
                        onClick={() => updateCurConf({ color: undefined })}
                        className="text-[10px] font-bold text-muted-foreground hover:text-foreground underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Text Wrap & Edge Overflow</label>
                  <select
                    value={curConf.overflow || 'break'}
                    onChange={(e) => updateCurConf({ overflow: e.target.value as any })}
                    className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-xs font-bold text-foreground"
                  >
                    <option value="break">Wrap Words (Multi-line)</option>
                    <option value="truncate">Truncate with Ellipsis (...)</option>
                    <option value="none">Overflow (Unclipped)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Max Label Width ({curConf.maxLabelWidth || 80}px)</label>
                  <input
                    type="range"
                    min={20}
                    max={200}
                    step={5}
                    value={curConf.maxLabelWidth || 80}
                    onChange={(e) => updateCurConf({ maxLabelWidth: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Inner Ring Radius r0 ({curConf.r0}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={curConf.r0}
                    onChange={(e) => updateCurConf({ r0: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Outer Ring Radius r ({curConf.r}%)</label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={curConf.r}
                    onChange={(e) => updateCurConf({ r: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground block">Border Width ({curConf.borderWidth}px)</label>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={curConf.borderWidth}
                    onChange={(e) => updateCurConf({ borderWidth: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
