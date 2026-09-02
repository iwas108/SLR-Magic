import { 
  Square, 
  Columns2, 
  Rows2, 
  Grid2X2, 
  LayoutTemplate 
} from 'lucide-react';
import type { 
  LayoutMode, 
  LayoutPresetMeta, 
  SlotId, 
  SubfigureLabelStyle 
} from '../types';

export const LAYOUT_PRESETS_INFO: Record<LayoutMode, LayoutPresetMeta> = {
  single: {
    id: 'single',
    name: 'Single Chart (1x1)',
    description: 'Classic single visualization occupying full stage.',
    slotCount: 1,
    slots: ['slot_a'],
    icon: Square
  },
  dual_horizontal: {
    id: 'dual_horizontal',
    name: 'Dual Side-by-Side (1x2)',
    description: 'Two charts placed side-by-side horizontally (50% / 50%).',
    slotCount: 2,
    slots: ['slot_a', 'slot_b'],
    icon: Columns2
  },
  dual_vertical: {
    id: 'dual_vertical',
    name: 'Dual Stacked (2x1)',
    description: 'Two charts stacked vertically (Top / Bottom).',
    slotCount: 2,
    slots: ['slot_a', 'slot_b'],
    icon: Rows2
  },
  tri_top_two_bottom: {
    id: 'tri_top_two_bottom',
    name: '3-Block Composite (1 Top + 2 Bottom)',
    description: 'Top hero chart (100% width) with two comparative charts below.',
    slotCount: 3,
    slots: ['slot_a', 'slot_b', 'slot_c'],
    icon: LayoutTemplate
  },
  quad_grid: {
    id: 'quad_grid',
    name: 'Quad Panel Grid (2x2)',
    description: 'Four equal quadrants for comprehensive multidimensional SLR analysis.',
    slotCount: 4,
    slots: ['slot_a', 'slot_b', 'slot_c', 'slot_d'],
    icon: Grid2X2
  }
};

export const ALL_SLOT_IDS: SlotId[] = ['slot_a', 'slot_b', 'slot_c', 'slot_d'];

export const SLOT_METADATA: Record<SlotId, { name: string; letter: string; defaultSubTitle: string }> = {
  slot_a: { name: 'Slot A', letter: 'A', defaultSubTitle: 'Panel A' },
  slot_b: { name: 'Slot B', letter: 'B', defaultSubTitle: 'Panel B' },
  slot_c: { name: 'Slot C', letter: 'C', defaultSubTitle: 'Panel C' },
  slot_d: { name: 'Slot D', letter: 'D', defaultSubTitle: 'Panel D' }
};

export function formatSubfigureLabel(slotIndex: number, style: SubfigureLabelStyle, isSingle?: boolean): string {
  if (isSingle) return '';
  const lettersUpper = ['A', 'B', 'C', 'D'];
  const lettersLower = ['a', 'b', 'c', 'd'];
  const idx = Math.max(0, Math.min(3, slotIndex));

  switch (style) {
    case 'paren_lower':
      return `(${lettersLower[idx]})`;
    case 'paren_upper':
      return `(${lettersUpper[idx]})`;
    case 'bold_upper':
      return `${lettersUpper[idx]}`;
    case 'fig_prefix':
      return `Fig. 1${lettersLower[idx]}`;
    case 'none':
    default:
      return '';
  }
}
