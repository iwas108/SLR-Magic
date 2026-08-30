import type { ThemePreset, ThemePalette } from '../types';

export const THEME_PALETTES: Record<ThemePreset, ThemePalette> = {
  academic_grayscale: {
    name: 'Academic Grayscale (Print Ready)',
    colors: ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#27272a'],
    bg: '#ffffff',
    text: '#09090b',
    subtext: '#52525b',
    border: '#e4e4e7'
  },
  ieee_blue: {
    name: 'IEEE / ACM Slate Blue',
    colors: ['#0f172a', '#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
    bg: '#ffffff',
    text: '#0f172a',
    subtext: '#475569',
    border: '#cbd5e1'
  },
  nature_emerald: {
    name: 'Nature / BioMed Emerald',
    colors: ['#064e3b', '#047857', '#10b981', '#34d399', '#0284c7', '#0369a1'],
    bg: '#ffffff',
    text: '#022c22',
    subtext: '#047857',
    border: '#a7f3d0'
  },
  science_contrast: {
    name: 'Science High-Contrast',
    colors: ['#b91c1c', '#1d4ed8', '#047857', '#d97706', '#6b21a8', '#0891b2'],
    bg: '#ffffff',
    text: '#111827',
    subtext: '#4b5563',
    border: '#e5e7eb'
  },
  acs_crimson: {
    name: 'ACS Chemical Society Crimson',
    colors: ['#990000', '#d97706', '#0284c7', '#059669', '#7c3aed', '#db2777'],
    bg: '#ffffff',
    text: '#18181b',
    subtext: '#52525b',
    border: '#e4e4e7'
  },
  pnas_gold: {
    name: 'PNAS Amber & Deep Teal',
    colors: ['#0f766e', '#b45309', '#1e40af', '#047857', '#9333ea', '#c2410c'],
    bg: '#ffffff',
    text: '#0f172a',
    subtext: '#475569',
    border: '#cbd5e1'
  },
  oxford_burgundy: {
    name: 'Oxford Academic Burgundy',
    colors: ['#701a75', '#0369a1', '#15803d', '#b45309', '#4338ca', '#be123c'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#4338ca',
    border: '#e0e7ff'
  },
  wiley_indigo: {
    name: 'Wiley Scientific Indigo',
    colors: ['#312e81', '#0284c7', '#0d9488', '#d97706', '#be185d', '#4d7c0f'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#3730a3',
    border: '#c7d2fe'
  },
  taylor_sapphire: {
    name: 'Taylor & Francis Sapphire',
    colors: ['#1e3a8a', '#c2410c', '#047857', '#6b21a8', '#0284c7', '#b91c1c'],
    bg: '#ffffff',
    text: '#0f172a',
    subtext: '#334155',
    border: '#cbd5e1'
  },
  plos_coral: {
    name: 'PLOS ONE Coral & Slate',
    colors: ['#f97316', '#334155', '#0284c7', '#10b981', '#8b5cf6', '#e11d48'],
    bg: '#ffffff',
    text: '#0f172a',
    subtext: '#475569',
    border: '#e2e8f0'
  },
  frontiers_violet: {
    name: 'Frontiers Scientific Violet',
    colors: ['#6d28d9', '#0284c7', '#059669', '#f59e0b', '#ec4899', '#3b82f6'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#4c1d95',
    border: '#ddd6fe'
  },
  bmc_teal: {
    name: 'BioMed Central (BMC) Teal',
    colors: ['#0f766e', '#1d4ed8', '#c2410c', '#7e22ce', '#047857', '#0284c7'],
    bg: '#ffffff',
    text: '#042f2e',
    subtext: '#0f766e',
    border: '#99f6e4'
  },
  mdpi_vermilion: {
    name: 'MDPI Open Access Vermilion',
    colors: ['#dc2626', '#0284c7', '#15803d', '#ca8a04', '#6b21a8', '#0891b2'],
    bg: '#ffffff',
    text: '#111827',
    subtext: '#374151',
    border: '#e5e7eb'
  },
  rsc_ultramarine: {
    name: 'RSC Chemistry Ultramarine',
    colors: ['#1d4ed8', '#b91c1c', '#047857', '#d97706', '#7c3aed', '#0284c7'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#3730a3',
    border: '#c7d2fe'
  },
  dark_modern: {
    name: 'SLR IDE Dark Mode',
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    bg: '#090d16',
    text: '#f8fafc',
    subtext: '#94a3b8',
    border: '#1e293b'
  },
  slr_light: {
    name: 'SLR IDE Light Mode',
    colors: ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    bg: '#f8fafc',
    text: '#0f172a',
    subtext: '#64748b',
    border: '#e2e8f0'
  },
  cell_amethyst: {
    name: 'Cell Press Amethyst & Teal',
    colors: ['#581c87', '#0284c7', '#0d9488', '#e11d48', '#d97706', '#4338ca'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#581c87',
    border: '#e9d5ff'
  },
  lancet_crimson: {
    name: 'The Lancet Clinical Ruby',
    colors: ['#9f1239', '#1e40af', '#047857', '#b45309', '#6b21a8', '#0e7490'],
    bg: '#ffffff',
    text: '#1c1917',
    subtext: '#9f1239',
    border: '#ffe4e6'
  },
  nejm_navy: {
    name: 'NEJM Deep Navy & Copper',
    colors: ['#172554', '#b45309', '#0369a1', '#15803d', '#86198f', '#c2410c'],
    bg: '#ffffff',
    text: '#0f172a',
    subtext: '#1e3a8a',
    border: '#dbeafe'
  },
  springer_forest: {
    name: 'Springer Nature Deep Forest',
    colors: ['#14532d', '#1d4ed8', '#c2410c', '#7c2d12', '#047857', '#0369a1'],
    bg: '#ffffff',
    text: '#052e16',
    subtext: '#166534',
    border: '#bbf7d0'
  },
  jama_cardinal: {
    name: 'JAMA Medical Cardinal',
    colors: ['#881337', '#0369a1', '#047857', '#d97706', '#4f46e5', '#be123c'],
    bg: '#ffffff',
    text: '#1c1917',
    subtext: '#881337',
    border: '#fecdd3'
  },
  iop_cyan: {
    name: 'IOP Publishing Quantum Cyan',
    colors: ['#0891b2', '#4f46e5', '#dc2626', '#059669', '#d97706', '#9333ea'],
    bg: '#ffffff',
    text: '#083344',
    subtext: '#0e7490',
    border: '#cffafe'
  },
  aps_amber: {
    name: 'APS Physical Review Amber',
    colors: ['#b45309', '#1d4ed8', '#047857', '#7e22ce', '#be123c', '#0284c7'],
    bg: '#ffffff',
    text: '#1c1917',
    subtext: '#b45309',
    border: '#fef3c7'
  },
  aaas_scarlet: {
    name: 'AAAS Science Advances Scarlet',
    colors: ['#991b1b', '#0284c7', '#15803d', '#eab308', '#7c3aed', '#ea580c'],
    bg: '#ffffff',
    text: '#18181b',
    subtext: '#991b1b',
    border: '#fee2e2'
  },
  cambridge_cobalt: {
    name: 'Cambridge University Cobalt',
    colors: ['#1e3a8a', '#0d9488', '#b91c1c', '#d97706', '#6b21a8', '#047857'],
    bg: '#ffffff',
    text: '#0f172a',
    subtext: '#1e3a8a',
    border: '#bfdbfe'
  },
  elife_sage: {
    name: 'eLife Open Science Sage & Tangerine',
    colors: ['#047857', '#ea580c', '#2563eb', '#7c3aed', '#059669', '#db2777'],
    bg: '#ffffff',
    text: '#064e3b',
    subtext: '#047857',
    border: '#a7f3d0'
  },
  bmj_azure: {
    name: 'BMJ British Medical Azure',
    colors: ['#0284c7', '#be123c', '#047857', '#d97706', '#6366f1', '#0f766e'],
    bg: '#ffffff',
    text: '#0c4a6e',
    subtext: '#0284c7',
    border: '#bae6fd'
  },
  mit_monochrome: {
    name: 'MIT Technology Charcoal & Accent',
    colors: ['#18181b', '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed'],
    bg: '#ffffff',
    text: '#09090b',
    subtext: '#52525b',
    border: '#e4e4e7'
  },
  harvard_crimson: {
    name: 'Harvard Academic Crimson',
    colors: ['#a51c30', '#1e3a8a', '#2e7d32', '#d97706', '#6a1b9a', '#00838f'],
    bg: '#ffffff',
    text: '#1c1917',
    subtext: '#a51c30',
    border: '#fed7aa'
  },
  frontiers_oceanic: {
    name: 'Frontiers Marine & Earth Oceanic',
    colors: ['#0f766e', '#0284c7', '#047857', '#f59e0b', '#6366f1', '#e11d48'],
    bg: '#ffffff',
    text: '#042f2e',
    subtext: '#0f766e',
    border: '#99f6e4'
  },
  cell_genomics_magenta: {
    name: 'Cell Genomics Royal Magenta',
    colors: ['#a21caf', '#0284c7', '#15803d', '#ea580c', '#4338ca', '#059669'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#a21caf',
    border: '#f5d0fe'
  },
  dark_neon_science: {
    name: 'Dark Cybernetic Scientific Glow',
    colors: ['#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#4ade80'],
    bg: '#0b0f19',
    text: '#f8fafc',
    subtext: '#94a3b8',
    border: '#1e293b'
  },
  degrade_emerald: {
    name: 'Sequential Degradation: Emerald',
    colors: ['#064e3b', '#047857', '#059669', '#10b981', '#34d399', '#a7f3d0'],
    bg: '#ffffff',
    text: '#022c22',
    subtext: '#047857',
    border: '#a7f3d0'
  },
  degrade_crimson: {
    name: 'Sequential Degradation: Crimson Ruby',
    colors: ['#881337', '#9f1239', '#e11d48', '#f43f5e', '#fb7185', '#fecdd3'],
    bg: '#ffffff',
    text: '#1c1917',
    subtext: '#9f1239',
    border: '#ffe4e6'
  },
  degrade_amber: {
    name: 'Sequential Degradation: Amber Gold',
    colors: ['#78350f', '#b45309', '#d97706', '#f59e0b', '#fbbf24', '#fde68a'],
    bg: '#ffffff',
    text: '#1c1917',
    subtext: '#b45309',
    border: '#fef3c7'
  },
  degrade_violet: {
    name: 'Sequential Degradation: Royal Violet',
    colors: ['#3b0764', '#581c87', '#7c3aed', '#8b5cf6', '#a78bfa', '#ddd6fe'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#581c87',
    border: '#ede9fe'
  },
  degrade_teal: {
    name: 'Sequential Degradation: Oceanic Teal',
    colors: ['#134e4a', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4'],
    bg: '#ffffff',
    text: '#042f2e',
    subtext: '#0f766e',
    border: '#ccfbf1'
  },
  degrade_indigo: {
    name: 'Sequential Degradation: Midnight Indigo',
    colors: ['#1e1b4b', '#312e81', '#3730a3', '#4f46e5', '#6366f1', '#c7d2fe'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#3730a3',
    border: '#e0e7ff'
  },
  degrade_rose: {
    name: 'Sequential Degradation: Vivid Rose',
    colors: ['#701a75', '#86198f', '#a21caf', '#c026d3', '#d946ef', '#f5d0fe'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#86198f',
    border: '#fae8ff'
  },
  degrade_orange: {
    name: 'Sequential Degradation: Copper Flame',
    colors: ['#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fed7aa'],
    bg: '#ffffff',
    text: '#1c1917',
    subtext: '#9a3412',
    border: '#ffedd5'
  },
  degrade_cyan: {
    name: 'Sequential Degradation: Glacier Cyan',
    colors: ['#164e63', '#0e7490', '#0891b2', '#06b6d4', '#22d3ee', '#cffafe'],
    bg: '#ffffff',
    text: '#083344',
    subtext: '#0e7490',
    border: '#e0f2fe'
  },
  degrade_lime: {
    name: 'Sequential Degradation: Botanical Lime',
    colors: ['#14532d', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#bbf7d0'],
    bg: '#ffffff',
    text: '#052e16',
    subtext: '#166534',
    border: '#dcfce7'
  },
  degrade_plum: {
    name: 'Sequential Degradation: Imperial Plum',
    colors: ['#4a044e', '#701a75', '#86198f', '#9333ea', '#a855f7', '#f3e8ff'],
    bg: '#ffffff',
    text: '#1e1b4b',
    subtext: '#701a75',
    border: '#f5d0fe'
  },
  degrade_slate: {
    name: 'Sequential Degradation: Titanium Slate',
    colors: ['#020617', '#0f172a', '#1e293b', '#334155', '#475569', '#94a3b8'],
    bg: '#ffffff',
    text: '#020617',
    subtext: '#334155',
    border: '#cbd5e1'
  }
};
