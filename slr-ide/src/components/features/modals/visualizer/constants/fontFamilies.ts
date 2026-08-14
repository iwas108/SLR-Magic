import type { FontFamily } from '../types';

export interface FontFamilyInfo {
  name: string;
  family: string;
  useCase?: string;
}

export const FONT_FAMILIES: Record<FontFamily, FontFamilyInfo> = {
  serif: {
    name: 'Times New Roman / Serif',
    family: 'Times New Roman, Georgia, Cambria, serif',
    useCase: 'IEEE / ACM / Springer'
  },
  computer_modern: {
    name: 'Latin Modern / STIX Math',
    family: '"Latin Modern Math", "Computer Modern", "STIX Two Math", serif',
    useCase: 'LaTeX Math Publications'
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
  arial: {
    name: 'Arial / Helvetica',
    family: 'Arial, Helvetica, sans-serif',
    useCase: 'Elsevier / Standard Technical'
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
  if (fontFamily === 'serif') return 'Times New Roman, Georgia, Cambria, serif';
  if (fontFamily === 'computer_modern') return '"Latin Modern Math", "Computer Modern", "STIX Two Math", serif';
  if (fontFamily === 'arial') return 'Arial, Helvetica, sans-serif';
  if (fontFamily === 'roboto') return '"Roboto", "Noto Sans", sans-serif';
  if (fontFamily === 'mono') return '"Fira Code", "JetBrains Mono", Consolas, monospace';
  return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
}
