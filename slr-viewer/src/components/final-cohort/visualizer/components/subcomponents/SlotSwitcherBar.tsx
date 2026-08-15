import React from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { formatSubfigureLabel, SLOT_METADATA } from '../../constants/layoutPresets';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';
import { useVisualizerContext } from '../../context/VisualizerContext';
import type { SlotId } from '../../types';

interface SlotSwitcherBarProps {
  showSubtitleEdit?: boolean;
}

export function SlotSwitcherBar({ showSubtitleEdit = false }: SlotSwitcherBarProps) {
  const { layout, config, style } = useVisualizerContext();
  const { layoutMode, activeSlot, setActiveSlot, activeSlotsList } = layout;
  const { slotsConfig, cloneSlotConfig, subTitle, setSubTitle } = config;
  const { subfigureLabelStyle } = style;

  if (layoutMode === 'single') {
    return null;
  }

  const otherSlots = activeSlotsList.filter(s => s !== activeSlot);

  return (
    <div className="w-full bg-secondary/30 border border-border/80 rounded-2xl p-3.5 space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Configuring Panel:
          </span>
        </div>

        {/* Clone Config Shortcut */}
        {otherSlots.length > 0 && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="text-[10px] text-muted-foreground font-semibold">Clone from:</span>
            <div className="flex items-center gap-1">
              {otherSlots.map((srcSlot) => {
                const srcMeta = SLOT_METADATA[srcSlot];
                const srcType = slotsConfig[srcSlot]?.chartType;
                const srcTypeName = srcType ? CHART_TYPES_INFO[srcType]?.name : srcMeta.name;

                return (
                  <button
                    key={srcSlot}
                    type="button"
                    onClick={() => cloneSlotConfig(srcSlot, activeSlot)}
                    className="px-2 py-1 bg-card hover:bg-secondary border border-border rounded-lg text-[10px] font-bold text-foreground flex items-center gap-1 transition-colors shadow-xs"
                    title={`Duplicate ${srcMeta.name} (${srcTypeName}) settings into current slot`}
                  >
                    <Copy className="w-3 h-3 text-primary" />
                    {srcMeta.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Slot Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {activeSlotsList.map((slotId, index) => {
          const isSelected = activeSlot === slotId;
          const meta = SLOT_METADATA[slotId];
          const slotCfg = slotsConfig[slotId];
          const chartType = slotCfg?.chartType || 'bar_vertical';
          const chartInfo = CHART_TYPES_INFO[chartType];
          const subLabel = formatSubfigureLabel(index, subfigureLabelStyle);

          return (
            <button
              key={slotId}
              type="button"
              onClick={() => setActiveSlot(slotId)}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/30 scale-[1.02]'
                  : 'bg-card border-border hover:bg-secondary/60 text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                  isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  {subLabel || meta.letter}
                </span>

                <div className="truncate">
                  <span className="text-xs font-bold block truncate">
                    {meta.name}
                  </span>
                  <span className={`text-[10px] block truncate font-medium ${
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  }`}>
                    {chartInfo.name}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Subtitle Input for Active Slot */}
      {showSubtitleEdit && (
        <div className="pt-2 border-t border-border/40 flex items-center gap-3">
          <label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
            Panel Sub-Caption:
          </label>
          <input
            type="text"
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            placeholder="e.g. Operational Domain Hierarchy"
            className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
}
