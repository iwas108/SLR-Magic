/**
 * Academic Monochrome Texture Pattern Utility for Scientific Publishing & Accessibility.
 * Generates high-contrast, publication-grade SVG data URLs for distinct series fills.
 */

export interface HatchPatternStyle {
  id: string;
  name: string;
  svgDataUri: (strokeColor: string, bgColor?: string) => string;
}

export const HATCH_PATTERNS: HatchPatternStyle[] = [
  {
    id: 'solid',
    name: 'Solid Fill',
    svgDataUri: (_stroke, bg = '#ffffff') => bg
  },
  {
    id: 'diagonal_right',
    name: 'Diagonal Stripes (45°)',
    svgDataUri: (stroke = '#1e293b', bg = '#ffffff') => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="${bg}"/><line x1="0" y1="12" x2="12" y2="0" stroke="${stroke}" stroke-width="2.5"/><line x1="-3" y1="3" x2="3" y2="-3" stroke="${stroke}" stroke-width="2.5"/><line x1="9" y1="15" x2="15" y2="9" stroke="${stroke}" stroke-width="2.5"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'diagonal_left',
    name: 'Diagonal Stripes (-45°)',
    svgDataUri: (stroke = '#1e293b', bg = '#ffffff') => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="${bg}"/><line x1="0" y1="0" x2="12" y2="12" stroke="${stroke}" stroke-width="2.5"/><line x1="-3" y1="9" x2="3" y2="15" stroke="${stroke}" stroke-width="2.5"/><line x1="9" y1="-3" x2="15" y2="3" stroke="${stroke}" stroke-width="2.5"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'cross_hatch',
    name: 'Cross-Hatch Grid',
    svgDataUri: (stroke = '#1e293b', bg = '#ffffff') => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="${bg}"/><line x1="0" y1="12" x2="12" y2="0" stroke="${stroke}" stroke-width="2"/><line x1="0" y1="0" x2="12" y2="12" stroke="${stroke}" stroke-width="2"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'dots_dense',
    name: 'Stippled Dots',
    svgDataUri: (stroke = '#1e293b', bg = '#ffffff') => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${bg}"/><circle cx="2" cy="2" r="1.5" fill="${stroke}"/><circle cx="7" cy="7" r="1.5" fill="${stroke}"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'horizontal_stripes',
    name: 'Horizontal Lines',
    svgDataUri: (stroke = '#1e293b', bg = '#ffffff') => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="8"><rect width="10" height="8" fill="${bg}"/><line x1="0" y1="4" x2="10" y2="4" stroke="${stroke}" stroke-width="2.5"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'vertical_stripes',
    name: 'Vertical Lines',
    svgDataUri: (stroke = '#1e293b', bg = '#ffffff') => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="10"><rect width="8" height="10" fill="${bg}"/><line x1="4" y1="0" x2="4" y2="10" stroke="${stroke}" stroke-width="2.5"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'diamond_mesh',
    name: 'Diamond Mesh',
    svgDataUri: (stroke = '#1e293b', bg = '#ffffff') => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="${bg}"/><polygon points="6,0 12,6 6,12 0,6" fill="none" stroke="${stroke}" stroke-width="1.8"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  }
];

/**
 * Returns a pattern fill object or hex color for a given series index.
 */
export function getSeriesPatternStyle(
  seriesIdx: number,
  baseColor: string,
  enableHatchPatterns: boolean
): any {
  if (!enableHatchPatterns) {
    return {
      color: baseColor
    };
  }

  const patternDef = HATCH_PATTERNS[seriesIdx % HATCH_PATTERNS.length];
  if (patternDef.id === 'solid') {
    return {
      color: baseColor
    };
  }

  // In ECharts, pattern image is loaded via Image object in browser or SVG data URI pattern
  // For clean ECharts canvas compatibility, we return color fill with pattern itemStyle
  const dataUri = patternDef.svgDataUri(baseColor, '#ffffff');

  if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
    const img = new Image();
    img.src = dataUri;
    return {
      color: {
        image: img,
        repeat: 'repeat'
      },
      borderColor: baseColor,
      borderWidth: 1.5
    };
  }

  return {
    color: baseColor
  };
}
