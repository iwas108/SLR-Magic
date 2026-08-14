import React from 'react';
import { LAYOUT_PRESETS_INFO } from '../../constants/layoutPresets';
import { useVisualizerContext } from '../../context/VisualizerContext';
import type { LayoutMode } from '../../types';

export function LayoutTemplateSelector() {
  const { layout } = useVisualizerContext();
  const { layoutMode, setLayoutMode } = layout;

  return (
    <div className="w-full space-y-2">
      <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block text-center">
        Figure Layout Template (Single or Composite Multi-Block)
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {(Object.entries(LAYOUT_PRESETS_INFO) as [LayoutMode, typeof LAYOUT_PRESETS_INFO[LayoutMode]][]).map(([id, info]) => {
          const isSelected = layoutMode === id;
          const IconComp = info.icon;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setLayoutMode(id)}
              className={`p-3 rounded-xl border text-center flex flex-col items-center justify-between gap-2 transition-all ${
                isSelected
                  ? 'bg-primary/10 border-primary text-primary shadow-sm ring-2 ring-primary/20 scale-[1.02]'
                  : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/80 text-foreground">
                <IconComp className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>

              <div className="space-y-0.5 w-full">
                <span className={`text-xs leading-tight font-bold block truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {info.name.split(' (')[0]}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono block">
                  {info.slotCount === 1 ? '1 Slot (Full)' : `${info.slotCount} Panels`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
