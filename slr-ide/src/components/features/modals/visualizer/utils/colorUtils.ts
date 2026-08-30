/**
 * Pure color utility functions for scientific charts and hierarchical shading.
 */

export function adjustColorShade(hex: string, factor: number): string {
  if (!hex || typeof hex !== 'string') return '#3b82f6';
  let cleanHex = hex.replace(/^#/, '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
  let num = parseInt(cleanHex, 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(factor * 255);
  let g = ((num >> 8) & 0x00FF) + Math.round(factor * 255);
  let b = (num & 0x0000FF) + Math.round(factor * 255);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function getNodeColor(
  nodeName: string, 
  parentName?: string, 
  index: number = 0, 
  defaultPalette: string[] = [], 
  customSliceColors: Record<string, string> = {}
): string {
  if (customSliceColors[nodeName]) {
    return customSliceColors[nodeName];
  }
  if (parentName && customSliceColors[parentName]) {
    const parentColor = customSliceColors[parentName];
    const factor = 0.12 * ((index % 5) + 1);
    return adjustColorShade(parentColor, factor);
  }
  return defaultPalette[index % (defaultPalette.length || 1)] || '#3b82f6';
}

export function hexToRgba(color: string, opacity: number): string {
  if (!color || typeof color !== 'string') return `rgba(59, 130, 246, ${opacity})`;
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
  }
  let cleanHex = color.replace(/^#/, '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return `rgba(59, 130, 246, ${opacity})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
