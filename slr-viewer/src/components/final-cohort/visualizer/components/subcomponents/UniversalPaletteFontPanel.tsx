import React, { useState } from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { THEME_PALETTES } from '../../constants/themePalettes';
import { FONT_FAMILIES } from '../../constants/fontFamilies';
import type { ThemePreset, FontFamily } from '../../types';
import { Type, Palette, ChevronDown, ChevronRight, Sparkles, Heading } from 'lucide-react';

type PaletteFontSubTab = 'palette_font' | 'title_caption';

export function UniversalPaletteFontPanel() {
  const { style } = useVisualizerContext();
  const {
    showChartTitle,
    setShowChartTitle,
    chartTitle,
    setChartTitle,
    showChartSubtitle,
    setShowChartSubtitle,
    chartSubtitle,
    setChartSubtitle,
    titleFontSize,
    setTitleFontSize,
    titleFontWeight,
    setTitleFontWeight,
    titleFontStyle,
    setTitleFontStyle,
    titleColor,
    setTitleColor,
    titleAlign,
    setTitleAlign,
    subtitleFontSize,
    setSubtitleFontSize,
    subtitleFontWeight,
    setSubtitleFontWeight,
    subtitleFontStyle,
    setSubtitleFontStyle,
    subtitleColor,
    setSubtitleColor,
    subtitleLineHeight,
    setSubtitleLineHeight,
    titleGap,
    setTitleGap,
    themePreset,
    setThemePreset,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize
  } = style;

  const [isExpanded, setIsExpanded] = useState(true);
  const [subTab, setSubTab] = useState<PaletteFontSubTab>('palette_font');

  return (
    <div className="space-y-4 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
      {/* Accordion Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-primary" />}
          <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            Academic Palette & Global Typography
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-secondary border border-border/60 text-muted-foreground">
            {FONT_FAMILIES[fontFamily]?.name || 'Roboto'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-primary/10 border border-primary/30 text-primary font-bold">
            {THEME_PALETTES[themePreset]?.name || 'IEEE Blue'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Sub-Tab Navigation Bar */}
          <div className="flex border-b border-border/40 gap-1 pb-1">
            <button
              type="button"
              onClick={() => setSubTab('palette_font')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'palette_font'
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-2xs'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Palette & Typography</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('title_caption')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'title_caption'
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-2xs'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              <Heading className="w-3.5 h-3.5" />
              <span>Figure Title & Caption</span>
              {(showChartTitle || showChartSubtitle) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          </div>

          {/* Tab 1: Palette & Typography */}
          {subTab === 'palette_font' && (
            <div className="space-y-3.5">
              {/* Global Typography & Base Proportional Sizing */}
              <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-primary" />
                    Global Typography & Base Sizing
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Figure-Wide Scale</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground block">Publication Font Family</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value as FontFamily)}
                      className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                    >
                      {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([id, f]) => (
                        <option key={id} value={id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-foreground">Base Font Size</label>
                      <span className="text-[10px] font-mono font-bold text-primary">{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={32}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Academic Theme Palettes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Academic Color Palette (36 Presets)
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Reusable Palette</span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-1">
                  {(Object.entries(THEME_PALETTES) as [ThemePreset, typeof THEME_PALETTES[ThemePreset]][]).map(([id, p]) => {
                    const isSelected = themePreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setThemePreset(id)}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                            : 'bg-card border-border hover:bg-secondary/60 text-foreground'
                        }`}
                      >
                        <span className="text-xs font-bold block truncate">{p.name}</span>
                        <div className="flex items-center gap-1 mt-1.5">
                          {p.colors.slice(0, 5).map((c, i) => (
                            <span key={i} className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Figure Title & Caption */}
          {subTab === 'title_caption' && (
            <div className="space-y-3.5">
              {/* Main Figure Title Typography */}
              <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Heading className="w-3.5 h-3.5 text-primary" />
                    Main Figure Title
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showChartTitle}
                      onChange={(e) => setShowChartTitle(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-primary"
                    />
                    <span>Display Title</span>
                  </label>
                </div>

                {showChartTitle && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-foreground">Title Text</label>
                      <input
                        type="text"
                        value={chartTitle}
                        onChange={(e) => setChartTitle(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                        placeholder="Enter figure title..."
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Size ({titleFontSize}px)</label>
                        <input
                          type="range"
                          min={10}
                          max={36}
                          value={titleFontSize}
                          onChange={(e) => setTitleFontSize(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Weight</label>
                        <select
                          value={titleFontWeight}
                          onChange={(e) => setTitleFontWeight(e.target.value as any)}
                          className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                        >
                          <option value="normal">Normal (400)</option>
                          <option value="500">Medium (500)</option>
                          <option value="600">SemiBold (600)</option>
                          <option value="bold">Bold (700)</option>
                          <option value="800">ExtraBold (800)</option>
                          <option value="900">Black (900)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Style</label>
                        <select
                          value={titleFontStyle}
                          onChange={(e) => setTitleFontStyle(e.target.value as any)}
                          className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                        >
                          <option value="normal">Normal</option>
                          <option value="italic">Italic</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Align</label>
                        <select
                          value={titleAlign}
                          onChange={(e) => setTitleAlign(e.target.value as any)}
                          className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                        >
                          <option value="center">Center</option>
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground">Custom Title Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={titleColor || '#171717'}
                          onChange={(e) => setTitleColor(e.target.value)}
                          className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={titleColor}
                          onChange={(e) => setTitleColor(e.target.value)}
                          placeholder="Auto / Default (#171717)"
                          className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtitle / Caption Typography */}
              <div className="p-3 bg-secondary/30 border border-border/60 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/40">
                  <span className="text-xs font-bold text-foreground">
                    Figure Subtitle / Caption
                  </span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showChartSubtitle}
                      onChange={(e) => setShowChartSubtitle(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-primary"
                    />
                    <span>Display Subtitle</span>
                  </label>
                </div>

                {showChartSubtitle && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-foreground">Subtitle Text</label>
                      <input
                        type="text"
                        value={chartSubtitle}
                        onChange={(e) => setChartSubtitle(e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground"
                        placeholder="Enter subtitle or methodological caption..."
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Size ({subtitleFontSize}px)</label>
                        <input
                          type="range"
                          min={8}
                          max={24}
                          value={subtitleFontSize}
                          onChange={(e) => setSubtitleFontSize(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Weight</label>
                        <select
                          value={subtitleFontWeight}
                          onChange={(e) => setSubtitleFontWeight(e.target.value as any)}
                          className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                        >
                          <option value="normal">Normal (400)</option>
                          <option value="500">Medium (500)</option>
                          <option value="600">SemiBold (600)</option>
                          <option value="bold">Bold (700)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Style</label>
                        <select
                          value={subtitleFontStyle}
                          onChange={(e) => setSubtitleFontStyle(e.target.value as any)}
                          className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs font-semibold text-foreground"
                        >
                          <option value="normal">Normal</option>
                          <option value="italic">Italic</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Gap to Title ({titleGap}px)</label>
                        <input
                          type="range"
                          min={0}
                          max={30}
                          value={titleGap}
                          onChange={(e) => setTitleGap(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Line Height ({subtitleLineHeight}px)</label>
                        <input
                          type="range"
                          min={10}
                          max={36}
                          value={subtitleLineHeight}
                          onChange={(e) => setSubtitleLineHeight(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground">Custom Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={subtitleColor || '#737373'}
                            onChange={(e) => setSubtitleColor(e.target.value)}
                            className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={subtitleColor}
                            onChange={(e) => setSubtitleColor(e.target.value)}
                            placeholder="Auto / Default (#737373)"
                            className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
