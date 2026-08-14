import { useState, useMemo, useCallback } from 'react';
import { LAYOUT_PRESETS_INFO } from '../constants/layoutPresets';
import type { LayoutMode, SlotId, SlotConfig } from '../types';

export function useVisualizerLayout(params?: {
  onCloneSlotConfig?: (fromSlot: SlotId, toSlot: SlotId) => void;
}) {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>('single');
  const [activeSlot, setActiveSlotState] = useState<SlotId>('slot_a');

  const activeSlotsList = useMemo((): SlotId[] => {
    const preset = LAYOUT_PRESETS_INFO[layoutMode];
    return preset ? preset.slots : ['slot_a'];
  }, [layoutMode]);

  const setLayoutMode = useCallback((newMode: LayoutMode) => {
    setLayoutModeState(newMode);
    const validSlots = LAYOUT_PRESETS_INFO[newMode]?.slots || ['slot_a'];
    if (!validSlots.includes(activeSlot)) {
      setActiveSlotState(validSlots[0] || 'slot_a');
    }
  }, [activeSlot]);

  const setActiveSlot = useCallback((slot: SlotId) => {
    if (activeSlotsList.includes(slot)) {
      setActiveSlotState(slot);
    }
  }, [activeSlotsList]);

  return {
    layoutMode,
    setLayoutMode,
    activeSlot,
    setActiveSlot,
    activeSlotsList
  };
}
