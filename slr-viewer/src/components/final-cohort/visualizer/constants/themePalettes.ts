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
  }
};
