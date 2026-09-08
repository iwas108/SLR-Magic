/**
 * Pure color utility functions for scientific charts, auto-contrast text, and hierarchical branch shading.
 */

/**
 * Adjust color shade by a linear RGB factor.
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

/**
 * Calculate relative luminance and return contrasting text color (white on dark, slate on light).
 */
export function getContrastingTextColor(
  bgColor: string,
  darkText: string = '#0f172a',
  lightText: string = '#ffffff'
): string {
  if (!bgColor || typeof bgColor !== 'string') return lightText;

  let r = 0, g = 0, b = 0;
  if (bgColor.startsWith('#')) {
    let cleanHex = bgColor.replace(/^#/, '');
    if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
    const num = parseInt(cleanHex, 16);
    if (!isNaN(num)) {
      r = (num >> 16) & 255;
      g = (num >> 8) & 255;
      b = num & 255;
    }
  } else if (bgColor.startsWith('rgb')) {
    const match = bgColor.match(/\d+/g);
    if (match && match.length >= 3) {
      r = Number(match[0]);
      g = Number(match[1]);
      b = Number(match[2]);
    }
  }

  // Normalize sRGB to linear luminance
  const [sR, sG, sB] = [r, g, b].map(v => {
    const norm = v / 255;
    return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  });

  const luminance = 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
  return luminance < 0.42 ? lightText : darkText;
}

/**
 * Convert Hex color to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let cleanHex = hex.replace(/^#/, '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return { h: 215, s: 80, l: 50 };

  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Convert HSL color to Hex string
 */
export function hslToHex(h: number, s: number, l: number): string {
  const normH = (h % 360 + 360) % 360;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normL = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * normL - 1)) * normS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = normL - c / 2;

  let r = 0, g = 0, b = 0;
  if (normH < 60) { r = c; g = x; b = 0; }
  else if (normH < 120) { r = x; g = c; b = 0; }
  else if (normH < 180) { r = 0; g = c; b = x; }
  else if (normH < 240) { r = 0; g = x; b = c; }
  else if (normH < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (val: number) => {
    const hexVal = Math.round((val + m) * 255).toString(16);
    return hexVal.length === 1 ? '0' + hexVal : hexVal;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Intelligently generate a portion-aware transient gradient color for a slice.
 * The larger the portion (paper count / value), the darker, richer, and stronger the color.
 * Smaller portions smoothly transition into luminous, soft harmonic pastel tints.
 */
export function generateArtfulSliceColor(
  baseHex: string,
  sliceValue?: number,
  maxSiblingValue?: number,
  minSiblingValue?: number,
  totalSiblingValue?: number,
  siblingIndex: number = 0,
  totalSiblings: number = 1,
  depthLevel: number = 0
): string {
  if (!baseHex) return '#3b82f6';
  const hsl = hexToHsl(baseHex);

  const safeTotal = Math.max(1, totalSiblings);
  
  // Compute portion weight (0.0 = smallest portion / sliver, 1.0 = dominant largest portion)
  let portionWeight = 0.5;
  if (sliceValue !== undefined && maxSiblingValue !== undefined && maxSiblingValue > 0) {
    const minVal = minSiblingValue !== undefined ? minSiblingValue : 0;
    const range = maxSiblingValue - minVal;
    const relRatio = range > 0 ? Math.max(0, Math.min(1, (sliceValue - minVal) / range)) : 0.5;
    const shareRatio = totalSiblingValue && totalSiblingValue > 0 
      ? Math.max(0, Math.min(1, (sliceValue / totalSiblingValue) * 2.2)) 
      : relRatio;
    portionWeight = Math.max(0, Math.min(1, 0.6 * relRatio + 0.4 * shareRatio));
  } else {
    // If no values provided, fallback to smooth rank-based ratio
    portionWeight = safeTotal > 1 ? 1 - (siblingIndex / (safeTotal - 1)) : 0.5;
  }

  // 1. Lightness (L):
  // Larger portion (portionWeight -> 1) => Darker, richer tone (L is lower)
  // Smaller portion (portionWeight -> 0) => Lighter, softer tone (L is higher)
  // Depth level offset: root level (depth 0) has deeper anchor; deeper levels shift slightly upward
  const depthBaseL = depthLevel === 0 ? 32 : (depthLevel === 1 ? 38 : 46);
  const depthMaxL = depthLevel === 0 ? 64 : (depthLevel === 1 ? 76 : 86);
  
  // Invert portion weight for lightness (higher portion = lower lightness / darker)
  const targetL = Math.round(depthMaxL - portionWeight * (depthMaxL - depthBaseL));

  // 2. Saturation / Chroma (S):
  // Larger portion => Strong, saturated, commanding presence (75% - 96%)
  // Smaller portion => Softer, delicate pastel tone (40% - 65%)
  const minS = Math.max(35, Math.min(70, hsl.s - 25));
  const maxS = Math.min(96, Math.max(75, hsl.s + 10));
  const targetS = Math.round(minS + portionWeight * (maxS - minS));

  // 3. Transient Hue Micro-Shift (H):
  // Sibling slices receive subtle harmonic micro-shifts along the perceptual color spectrum
  // so adjacent slices create a continuous, rich chromatic tapestry
  const hueSpread = Math.min(16, safeTotal * 2.5);
  const hueShift = safeTotal > 1 
    ? Math.round(((siblingIndex / (safeTotal - 1)) - 0.5) * hueSpread)
    : 0;
  const targetH = (hsl.h + hueShift + 360) % 360;

  return hslToHex(targetH, targetS, targetL);
}

/**
 * Intelligently generate a harmonious child slice color derived from its parent branch color and portion.
 */
export function generateHierarchicalShade(
  parentHex: string,
  siblingIndex: number = 0,
  totalSiblings: number = 1,
  depthLevel: number = 1,
  sliceValue?: number,
  maxSiblingValue?: number,
  minSiblingValue?: number,
  totalSiblingValue?: number
): string {
  return generateArtfulSliceColor(
    parentHex,
    sliceValue,
    maxSiblingValue,
    minSiblingValue,
    totalSiblingValue,
    siblingIndex,
    totalSiblings,
    depthLevel
  );
}

/**
 * Linearly interpolate between two Hex colors in RGB space
 */
export function interpolateColors(hex1: string, hex2: string, factor: number): string {
  const f = Math.max(0, Math.min(1, factor));
  const hsl1 = hexToHsl(hex1 || '#3b82f6');
  const hsl2 = hexToHsl(hex2 || '#10b981');

  // Interpolate along shortest hue path
  let hDiff = hsl2.h - hsl1.h;
  if (hDiff > 180) hDiff -= 360;
  if (hDiff < -180) hDiff += 360;

  const h = (hsl1.h + hDiff * f + 360) % 360;
  const s = Math.round(hsl1.s + (hsl2.s - hsl1.s) * f);
  const l = Math.round(hsl1.l + (hsl2.l - hsl1.l) * f);

  return hslToHex(h, s, l);
}

/**
 * Generate a parent-to-child chromatic flow gradient
 */
export function generateParentFlowGradient(
  parentHex: string,
  childBaseHex: string,
  siblingIndex: number = 0,
  totalSiblings: number = 1,
  depthLevel: number = 1,
  sliceValue?: number,
  maxSiblingValue?: number,
  minSiblingValue?: number,
  totalSiblingValue?: number
): string {
  const safeTotal = Math.max(1, totalSiblings);
  const siblingRatio = safeTotal > 1 ? siblingIndex / (safeTotal - 1) : 0.5;
  // Blend 60% parent color with 40% child base tone modulated by slice weight
  const blendFactor = Math.max(0.2, Math.min(0.85, 0.4 + siblingRatio * 0.35));
  const blendedHex = interpolateColors(parentHex, childBaseHex, blendFactor);
  return generateArtfulSliceColor(
    blendedHex,
    sliceValue,
    maxSiblingValue,
    minSiblingValue,
    totalSiblingValue,
    siblingIndex,
    totalSiblings,
    depthLevel
  );
}

/**
 * Procedurally expands a base palette to guarantee distinct, non-duplicating colors
 * for any number of categories, while STRICTLY respecting and adhering to the chosen theme palette.
 * 
 * - Grayscale Palettes (e.g. Academic Grayscale):
 *   Guarantees 100% achromatic shades (S = 0%), bisecting the largest lightness gaps
 *   to provide clean, distinct, print-ready grayscale bars without foreign rainbow colors.
 * 
 * - Monochromatic / Sequential Palettes (e.g. IEEE Slate Blue, Sequential Degradation):
 *   Interpolates between adjacent tones along the palette's existing lightness and hue curve,
 *   preserving the signature color family (e.g. all blues stay blues).
 * 
 * - Multi-Hue Categorical Palettes (e.g. Nature, Science High-Contrast, Frontiers Violet):
 *   Generates publication-grade harmonic tonal variations (tints & shades) derived directly
 *   from the base palette colors with coprime stride to maximize perceptual distance and contrast.
 */
export function generateDistinctPalette(baseColors: string[], targetCount: number): string[] {
  if (!baseColors || baseColors.length === 0) return ['#3b82f6'];
  const result = [...baseColors];
  if (targetCount <= baseColors.length) return result.slice(0, targetCount);

  const k = baseColors.length;
  const hslColors = baseColors.map(c => hexToHsl(c));
  const avgS = hslColors.reduce((sum, c) => sum + c.s, 0) / k;

  // Circular hue variance to detect monochromatic vs multi-hue categorical
  let sumCos = 0;
  let sumSin = 0;
  for (const c of hslColors) {
    const rad = (c.h * Math.PI) / 180;
    sumCos += Math.cos(rad);
    sumSin += Math.sin(rad);
  }
  const R = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / k;

  const isGrayscale = hslColors.every(c => c.s <= 14) || avgS <= 10;
  const isMonochromatic = !isGrayscale && (R >= 0.82);

  if (isGrayscale) {
    // 1. Academic Grayscale: strictly achromatic (S = 0%), bisecting largest lightness gaps
    while (result.length < targetCount) {
      const existingL = result.map(c => hexToHsl(c).l);
      const uniqueL = [...new Set(existingL)].sort((a, b) => a - b);
      
      let maxGap = 0;
      let bestL = 50;

      for (let i = 0; i < uniqueL.length - 1; i++) {
        const gap = uniqueL[i + 1] - uniqueL[i];
        if (gap > maxGap) {
          maxGap = gap;
          bestL = Math.round((uniqueL[i] + uniqueL[i + 1]) / 2);
        }
      }

      // Check boundaries against printable extremes [8%, 88%]
      if (uniqueL[0] - 8 > maxGap) {
        maxGap = uniqueL[0] - 8;
        bestL = Math.round((8 + uniqueL[0]) / 2);
      }
      if (88 - uniqueL[uniqueL.length - 1] > maxGap) {
        maxGap = 88 - uniqueL[uniqueL.length - 1];
        bestL = Math.round((uniqueL[uniqueL.length - 1] + 88) / 2);
      }

      result.push(hslToHex(0, 0, bestL));
    }
    return result;
  }

  if (isMonochromatic) {
    // 2. Monochromatic / Sequential: interpolate between adjacent lightness stops
    while (result.length < targetCount) {
      const sorted = [...result].sort((a, b) => hexToHsl(a).l - hexToHsl(b).l);
      let maxGap = 0;
      let bestPair: [string, string] = [sorted[0], sorted[1] || sorted[0]];

      for (let i = 0; i < sorted.length - 1; i++) {
        const l1 = hexToHsl(sorted[i]).l;
        const l2 = hexToHsl(sorted[i + 1]).l;
        const gap = l2 - l1;
        if (gap > maxGap) {
          maxGap = gap;
          bestPair = [sorted[i], sorted[i + 1]];
        }
      }

      const newColor = interpolateColors(bestPair[0], bestPair[1], 0.5);
      result.push(newColor);
    }
    return result;
  }

  // 3. Multi-Hue Categorical: derived harmonic tonal variations (tints & shades) of palette colors
  function getCoprimeStride(n: number): number {
    if (n <= 2) return 1;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const target = Math.floor(n / 2);
    for (let delta = 0; delta < n; delta++) {
      const up = target + delta;
      if (up < n && gcd(up, n) === 1) return up;
      const down = target - delta;
      if (down > 1 && gcd(down, n) === 1) return down;
    }
    return 1;
  }

  let j = 0;
  const stride = getCoprimeStride(k);
  const initialOffset = Math.floor(k / 2);

  while (result.length < targetCount) {
    const tier = Math.floor(j / k) + 1;
    const parentIdx = (j * stride + initialOffset) % k;
    const parentHex = baseColors[parentIdx];
    const { h, s, l } = hexToHsl(parentHex);

    let targetH = h;
    let targetS = s;
    let targetL = l;

    if (tier === 1) {
      if (l <= 54) {
        // Lighter tint for dark/medium colors
        targetL = Math.min(84, Math.max(62, l + 24 + ((j % 3) * 3)));
        targetS = Math.max(28, Math.min(85, s - 12));
        targetH = (h + (j % 2 === 0 ? 5 : -5) + 360) % 360;
      } else {
        // Deeper shade for bright/light colors
        targetL = Math.max(18, Math.min(38, l - 24 - ((j % 3) * 3)));
        targetS = Math.min(92, s + 6);
        targetH = (h + (j % 2 === 0 ? -5 : 5) + 360) % 360;
      }
    } else {
      // Tier 2+: opposite modulation or soft pastel
      if (l <= 54) {
        targetL = Math.max(16, Math.min(30, l - 16));
        targetS = Math.min(95, s + 8);
      } else {
        targetL = Math.min(88, Math.max(76, l + 16));
        targetS = Math.max(24, s - 18);
      }
      targetH = (h + ((j * 7) % 15) - 7 + 360) % 360;
    }

    result.push(hslToHex(targetH, targetS, targetL));
    j++;
  }

  return result;
}

export function getNodeColor(
  nodeName: string, 
  parentName?: string, 
  index: number = 0, 
  defaultPalette: string[] = [], 
  customSliceColors: Record<string, string> = {},
  parentColor?: string,
  totalSiblings: number = 1,
  depthLevel: number = 0,
  colorMode: 'branch_gradient' | 'parent_flow' | 'value_weighted_tint' | 'level_discrete' | 'rainbow_discrete' = 'branch_gradient',
  sliceValue?: number,
  maxSiblingValue?: number,
  minSiblingValue?: number,
  totalSiblingValue?: number,
  smartColorPropagation: 'auto_children' | 'discrete_only' = 'auto_children'
): string {
  // 1. Direct explicit node override
  if (customSliceColors[nodeName]) {
    return customSliceColors[nodeName];
  }

  // 2. Parent custom override with auto child gradient (if smart propagation enabled)
  if (smartColorPropagation !== 'discrete_only' && parentName && customSliceColors[parentName]) {
    const pColor = customSliceColors[parentName];
    if (colorMode === 'parent_flow') {
      const childBase = defaultPalette[(index + (depthLevel || 1) * 2) % (defaultPalette.length || 1)] || '#3b82f6';
      return generateParentFlowGradient(
        pColor,
        childBase,
        index,
        totalSiblings,
        depthLevel || 1,
        sliceValue,
        maxSiblingValue,
        minSiblingValue,
        totalSiblingValue
      );
    }
    return generateHierarchicalShade(
      pColor, 
      index, 
      totalSiblings, 
      depthLevel || 1, 
      sliceValue, 
      maxSiblingValue, 
      minSiblingValue, 
      totalSiblingValue
    );
  }

  // 3. Parent-flow mode: blend parent branch color with child base tone
  if (smartColorPropagation !== 'discrete_only' && depthLevel > 0 && parentColor && colorMode === 'parent_flow') {
    const childBase = defaultPalette[(index + depthLevel * 2) % (defaultPalette.length || 1)] || '#3b82f6';
    return generateParentFlowGradient(
      parentColor,
      childBase,
      index,
      totalSiblings,
      depthLevel,
      sliceValue,
      maxSiblingValue,
      minSiblingValue,
      totalSiblingValue
    );
  }

  // 4. Branch gradient mode: derive harmonious shades strictly from parent branch
  if (smartColorPropagation !== 'discrete_only' && depthLevel > 0 && parentColor && (colorMode === 'branch_gradient' || colorMode === 'value_weighted_tint')) {
    return generateHierarchicalShade(
      parentColor, 
      index, 
      totalSiblings, 
      depthLevel, 
      sliceValue, 
      maxSiblingValue, 
      minSiblingValue, 
      totalSiblingValue
    );
  }

  // 5. Level discrete mode: offset palette index by level depth
  if (colorMode === 'level_discrete' && depthLevel > 0) {
    const levelOffset = depthLevel * 3;
    const palIdx = (index + levelOffset) % (defaultPalette.length || 1);
    const baseColor = defaultPalette[palIdx] || '#3b82f6';
    return generateArtfulSliceColor(
      baseColor, 
      sliceValue, 
      maxSiblingValue, 
      minSiblingValue, 
      totalSiblingValue, 
      index, 
      totalSiblings, 
      depthLevel
    );
  }

  // 6. Direct / Root level or rainbow discrete with non-duplicating palette expansion
  const effectivePalette = (totalSiblings > defaultPalette.length && defaultPalette.length > 0)
    ? generateDistinctPalette(defaultPalette, Math.max(totalSiblings, index + 1))
    : defaultPalette;
  const baseColor = effectivePalette[index] || defaultPalette[index % (defaultPalette.length || 1)] || '#3b82f6';
  if (colorMode !== 'rainbow_discrete' && sliceValue !== undefined && maxSiblingValue !== undefined) {
    return generateArtfulSliceColor(
      baseColor, 
      sliceValue, 
      maxSiblingValue, 
      minSiblingValue, 
      totalSiblingValue, 
      index, 
      totalSiblings, 
      depthLevel
    );
  }
  return baseColor;
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


