import type { FontFamily } from '../types';

export interface FontFamilyInfo {
  name: string;
  family: string;
  useCase?: string;
}

export const FONT_FAMILIES: Record<FontFamily, FontFamilyInfo> = {
  computer_modern: {
    name: 'Computer Modern / LaTeX',
    family: '"Computer Modern", "Latin Modern Roman", "STIX Two Text", "CMR10", serif',
    useCase: 'Elsevier / LaTeX Publications'
  },
  times: {
    name: 'Times New Roman (Elsevier)',
    family: '"Times New Roman", Times, "Nimbus Roman", Georgia, serif',
    useCase: 'Elsevier / IEEE Standard Serif'
  },
  serif: {
    name: 'Academic Serif',
    family: '"Times New Roman", Georgia, Cambria, serif',
    useCase: 'IEEE / ACM / Springer'
  },
  helvetica: {
    name: 'Helvetica / Helvetica Neue',
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    useCase: 'Elsevier / Cell / Nature'
  },
  arial: {
    name: 'Arial / Standard Sans',
    family: 'Arial, Helvetica, sans-serif',
    useCase: 'Elsevier / Standard Technical'
  },
  calibri: {
    name: 'Calibri / ClearType',
    family: 'Calibri, Carlito, "Segoe UI", sans-serif',
    useCase: 'Elsevier / Microsoft Office'
  },
  georgia: {
    name: 'Georgia / Web Serif',
    family: 'Georgia, Cambria, "Times New Roman", serif',
    useCase: 'High-Legibility Academic Print'
  },
  garamond: {
    name: 'EB Garamond / Classical',
    family: '"EB Garamond", Garamond, "Times New Roman", serif',
    useCase: 'Classical Humanities & Reviews'
  },
  'sans-serif': {
    name: 'Inter / Modern Sans',
    family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    useCase: 'Modern Clean Journals'
  },
  inter: {
    name: 'Inter UI Font',
    family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    useCase: 'Web & Digital Reports'
  },
  roboto: {
    name: 'Roboto / Noto Sans',
    family: '"Roboto", "Noto Sans", sans-serif',
    useCase: 'Google / High-DPI Screens'
  },
  mono: {
    name: 'Monospace / Code',
    family: '"Fira Code", "JetBrains Mono", Consolas, monospace',
    useCase: 'Source Code & Algorithmic'
  }
};

export const FONT_FAMILIES_CONFIG = FONT_FAMILIES;

export function resolveFontFamilyCss(fontFamily: FontFamily): string {
  if (fontFamily === 'computer_modern') return '"Computer Modern", "Latin Modern Roman", "STIX Two Text", "CMR10", serif';
  if (fontFamily === 'times') return '"Times New Roman", Times, "Nimbus Roman", Georgia, serif';
  if (fontFamily === 'serif') return '"Times New Roman", Georgia, Cambria, serif';
  if (fontFamily === 'helvetica') return '"Helvetica Neue", Helvetica, Arial, sans-serif';
  if (fontFamily === 'arial') return 'Arial, Helvetica, sans-serif';
  if (fontFamily === 'calibri') return 'Calibri, Carlito, "Segoe UI", sans-serif';
  if (fontFamily === 'georgia') return 'Georgia, Cambria, "Times New Roman", serif';
  if (fontFamily === 'garamond') return '"EB Garamond", Garamond, "Times New Roman", serif';
  if (fontFamily === 'roboto') return '"Roboto", "Noto Sans", sans-serif';
  if (fontFamily === 'mono') return '"Fira Code", "JetBrains Mono", Consolas, monospace';
  return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
}
