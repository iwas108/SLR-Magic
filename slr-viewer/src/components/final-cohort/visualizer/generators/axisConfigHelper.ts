import type { ChartGeneratorContext } from './types';
import type { AxisLocation, AxisLabelFormat, AxisGridLineStyle } from '../types';
import { formatVariableDisplayName } from '@/lib/services/cohort-data-source';

export interface ScientificAxisOptions {
  axisKind: 'category' | 'value' | 'time';
  defaultTitle?: string;
  categories?: (string | number)[];
  inverse?: boolean;
  min?: number | ((val: any) => number);
  max?: number | ((val: any) => number);
  interval?: number | 'auto';
  splitNumber?: number;
  scale?: boolean;
  isSecondary?: boolean;
  defaultUnitFormatter?: (val: any) => string;
}

/**
 * Calculates a standardized, publication-grade axis ceiling with clean, uniform grid steps.
 * Prevents arbitrary numbers like 36%, 17%, 23% by rounding up to standard scientific steps
 * (e.g. 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100).
 */
export function calculateNiceScientificCeiling(neededMax: number, isPct: boolean = true): number {
  if (neededMax <= 0) return isPct ? 10 : 5;

  if (isPct) {
    if (neededMax <= 5) return 5;
    if (neededMax <= 10) return 10;
    if (neededMax <= 15) return 15;
    if (neededMax <= 20) return 20;
    if (neededMax <= 25) return 25;
    if (neededMax <= 30) return 30;
    if (neededMax <= 35) return 35;
    if (neededMax <= 40) return 40;
    if (neededMax <= 50) return 50;
    if (neededMax <= 60) return 60;
    if (neededMax <= 70) return 70;
    if (neededMax <= 80) return 80;
    if (neededMax <= 90) return 90;
    if (neededMax <= 100) return 100;
    return Math.ceil(neededMax / 10) * 10;
  }

  if (neededMax <= 5) return Math.ceil(neededMax);
  if (neededMax <= 10) return 10;
  if (neededMax <= 20) return Math.ceil(neededMax / 2) * 2;
  if (neededMax <= 50) return Math.ceil(neededMax / 5) * 5;
  if (neededMax <= 100) return Math.ceil(neededMax / 10) * 10;
  if (neededMax <= 500) return Math.ceil(neededMax / 50) * 50;
  return Math.ceil(neededMax / 100) * 100;
}

/**
 * Formats a value according to the configured axis label format presets and prefixes/suffixes.
 */
export function formatScientificAxisValue(
  val: any,
  format: AxisLabelFormat = 'auto',
  prefix: string = '',
  suffix: string = '',
  defaultUnitFormatter?: (val: any) => string
): string {
  if (val === undefined || val === null) return '';

  let coreStr: string;

  if (typeof val === 'number') {
    switch (format) {
      case 'percent':
        coreStr = `${val}%`;
        break;
      case 'integer':
        coreStr = `${Math.round(val)}`;
        break;
      case 'decimal_1':
        coreStr = val.toFixed(1);
        break;
      case 'decimal_2':
        coreStr = val.toFixed(2);
        break;
      case 'scientific':
        coreStr = val.toExponential(2);
        break;
      case 'currency':
        coreStr = `$${val.toLocaleString()}`;
        break;
      case 'raw':
        coreStr = `${val}`;
        break;
      case 'auto':
      case 'custom_prefix_suffix':
      default:
        if (defaultUnitFormatter) {
          coreStr = defaultUnitFormatter(val);
        } else {
          coreStr = `${val}`;
        }
        break;
    }
  } else {
    coreStr = `${val}`;
  }

  return `${prefix}${coreStr}${suffix}`.replace(/\\n/g, '\n');
}

/**
 * Checks whether a token or sub-token with slashes represents an unbreakable
 * atomic unit such as:
 * - Wireless/Network protocols: b/g/n, a/b/g/n/ac/ax, 802.11b/g/n, TCP/IP, IPv4/IPv6, 2G/3G/4G/5G, CAN/LIN
 * - Units of measurement: km/h, m/s, bits/s, samples/s, V/m, mW/cm2, kg/m3, mg/L
 * - Common abbreviations: w/, w/o, c/o, b/c, a/k/a, and/or, either/or, yes/no, on/off, N/A, I/O, A/D, TX/RX
 * - Ratios & fractions: 1/2, 3/4, 24/7, 10/100
 * - Any slash-separated sequence where any segment is <= 3 characters long (e.g. b/g, x/y, dev/prod)
 */
export function isAtomicSlashToken(token: string): boolean {
  const clean = token.replace(/^[([{<"']+|[)\]}>,"'.:;]+$/g, '').trim();
  if (!clean.includes('/')) return false;

  // 1. Known atomic abbreviations & acronyms
  if (/^(?:w\/|w\/o|c\/o|b\/c|a\/k\/a|and\/or|either\/or|yes\/no|on\/off|true\/false|n\/a|i\/o|a\/d|d\/a|r\/w|rx\/tx|tx\/rx|p\/n|s\/n|b\/w|ac\/dc|dc\/dc|f\/utp|s\/ftp)$/i.test(clean)) {
    return true;
  }

  // 2. Units of measurement
  if (/^(?:km\/h|m\/s|cm\/s|mm\/s|bit\/s|bits\/s|byte\/s|bytes\/s|sample\/s|samples\/s|packet\/s|packets\/s|msg\/s|msgs\/s|req\/s|trans\/s|v\/m|a\/m|w\/m2|mw\/cm2|db\/m|kg\/m3|g\/cm3|mg\/l|g\/mol|rad\/s|hz\/s|k\/s)$/i.test(clean)) {
    return true;
  }

  // Generic unit denominator (e.g. anyWord/s, anyWord/h, anyWord/m)
  if (/^[a-zA-Z0-9^µ]+\/(?:s|sec|h|hr|m|min|kg|g|mg|l|ml|mol|cm|mm|m2|cm2|m3)$/i.test(clean)) {
    return true;
  }

  // 3. Numbers, fractions, dates, numeric standards (e.g. 24/7, 1/2, 2023/24, 10/100/1000)
  if (/^\d+(?:\/\d+)+$/.test(clean)) {
    return true;
  }

  // 4. Protocol / standard patterns like 802.11b/g/n, 802.11a/b/g/n/ac/ax, 2G/3G/4G/5G
  if (/^(?:\d+\.\d+)?[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)+$/i.test(clean)) {
    const parts = clean.split('/');
    if (parts.some(p => p.length <= 3)) {
      return true;
    }
  }

  // 5. Short slash segments in general
  const slashParts = clean.split('/');
  if (slashParts.length > 1 && (slashParts.some(p => p.length <= 3) || clean.length <= 10)) {
    return true;
  }

  return false;
}

/**
 * Breaks long text strings across multiple lines based on maximum character limit.
 * Priority order:
 * 1. Explicit line breaks (\n)
 * 2. Semantic category separators with spaces (" / ", " - ")
 * 3. Trailing parenthetical clauses ("(...)")
 * 4. Space-based greedy line packing with protected atomic tokens (e.g. b/g/n, TCP/IP, km/h, w/o)
 * 5. Natural punctuation boundaries for oversized non-atomic compounds (e.g. Agriculture/Horticulture)
 */
export function wrapAxisLabelText(text: string, maxCharsPerLine: number = 16): string {
  if (!text) return '';
  const unescaped = text.replace(/\\n/g, '\n').trim();

  // 1. Honor explicit line breaks if present
  if (unescaped.includes('\n')) {
    return unescaped
      .split('\n')
      .map(segment => wrapAxisLabelText(segment.trim(), maxCharsPerLine))
      .join('\n');
  }

  // 2. If the entire string already fits, return directly
  if (unescaped.length <= maxCharsPerLine) {
    return unescaped;
  }

  // 3. Smart pre-split for category separator with spaces: " / "
  if (/\s+\/\s+/.test(unescaped)) {
    const parts = unescaped.split(/\s+\/\s+/);
    if (parts.length > 1) {
      return parts
        .map((p, idx) => {
          const suffix = idx < parts.length - 1 ? ' /' : '';
          return wrapAxisLabelText(p.trim() + suffix, maxCharsPerLine);
        })
        .join('\n');
    }
  }

  // 4. Smart parenthetical segmentation
  // If string contains a trailing parenthetical clause like "Wi-Fi WLAN (802.11 b/g/ax)"
  // or "Throughput (Mbps)", separate the main title and parenthetical qualifier so they wrap independently
  const parenMatch = unescaped.match(/^(.+?)\s+([(][^()]+[)])$/);
  if (parenMatch) {
    const lead = parenMatch[1].trim();
    const paren = parenMatch[2].trim();
    return `${wrapAxisLabelText(lead, maxCharsPerLine)}\n${wrapAxisLabelText(paren, maxCharsPerLine)}`;
  }

  // 5. Intelligent tokenization: preserve raw words with their slashes/hyphens intact
  const rawWords = unescaped.split(/\s+/).filter(Boolean);

  // 6. Line packing with lazy splitting of oversized compound words
  const lines: string[] = [];
  let current = '';

  for (const word of rawWords) {
    // If word exceeds maxCharsPerLine on its own, check if it can be split at non-atomic slashes/hyphens
    if (word.length > maxCharsPerLine) {
      if (current) {
        lines.push(current);
        current = '';
      }

      if (word.includes('/') && !isAtomicSlashToken(word)) {
        const slashParts = word.split('/');
        let compoundLine = '';
        for (let sIdx = 0; sIdx < slashParts.length; sIdx++) {
          const part = slashParts[sIdx] + (sIdx < slashParts.length - 1 ? '/' : '');
          if (!compoundLine) {
            compoundLine = part;
          } else if ((compoundLine + part).length <= maxCharsPerLine) {
            compoundLine += part;
          } else {
            lines.push(compoundLine);
            compoundLine = part;
          }
        }
        if (compoundLine) {
          current = compoundLine;
        }
        continue;
      } else if (word.includes('-') && !word.startsWith('-')) {
        const dashParts = word.split('-');
        if (dashParts.every(p => p.length >= 3)) {
          let compoundLine = '';
          for (let dIdx = 0; dIdx < dashParts.length; dIdx++) {
            const part = dashParts[dIdx] + (dIdx < dashParts.length - 1 ? '-' : '');
            if (!compoundLine) {
              compoundLine = part;
            } else if ((compoundLine + part).length <= maxCharsPerLine) {
              compoundLine += part;
            } else {
              lines.push(compoundLine);
              compoundLine = part;
            }
          }
          if (compoundLine) {
            current = compoundLine;
          }
          continue;
        }
      }

      current = word;
      continue;
    }

    // Word fits within maxCharsPerLine
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxCharsPerLine) {
      current = current + ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }

  // 7. Handle any single line that still exceeds maxCharsPerLine
  // Tolerance: If a single line exceeds maxCharsPerLine by <= 2 characters (or <= 20%),
  // keep it intact rather than chopping off 1 or 2 orphan letters!
  const finalLines: string[] = [];
  const maxOverflowTolerance = Math.max(2, Math.floor(maxCharsPerLine * 0.2));

  for (const line of lines) {
    if (line.length <= maxCharsPerLine + maxOverflowTolerance) {
      finalLines.push(line);
    } else {
      // Check if line has a natural sub-split between numeric prefix and suffix (e.g. 802.11b/g/n)
      const numPrefixMatch = line.match(/^(\d+(?:\.\d+)+)([a-zA-Z/].*)$/);
      if (numPrefixMatch && numPrefixMatch[1].length <= maxCharsPerLine && numPrefixMatch[2].length <= maxCharsPerLine) {
        finalLines.push(numPrefixMatch[1]);
        finalLines.push(numPrefixMatch[2]);
        continue;
      }

      // Hard break oversized single tokens
      let rem = line;
      while (rem.length > maxCharsPerLine) {
        finalLines.push(rem.slice(0, maxCharsPerLine));
        rem = rem.slice(maxCharsPerLine);
      }
      if (rem) finalLines.push(rem);
    }
  }

  // 8. Prevent orphan single punctuation lines (e.g. lone ')' or '/')
  for (let i = finalLines.length - 1; i > 0; i--) {
    if (/^[)\]}>/:;,\s]+$/.test(finalLines[i])) {
      finalLines[i - 1] += finalLines[i];
      finalLines.splice(i, 1);
    }
  }

  return finalLines.join('\n');
}

/**
 * Accurately estimates the maximum rendered pixel width of category tick labels.
 * Used to calculate the exact ECharts nameGap so the axis title is placed at
 * an exact user-specified gap from the leftmost category label.
 */
export function estimateCategoryLabelSpan(
  categories: (string | number)[] | undefined,
  fontSize: number,
  labelWidth: number,
  overflow: string,
  labelMargin: number
): number {
  if (!categories || categories.length === 0) {
    return Math.min(labelWidth, 80) + labelMargin;
  }
  const charLimit = Math.max(8, Math.floor((labelWidth - 8) / (fontSize * 0.55)));
  let maxChars = 0;
  for (const item of categories) {
    const str = String(item ?? '');
    const lines = (overflow === 'break') ? wrapAxisLabelText(str, charLimit).split('\n') : [str];
    for (const line of lines) {
      if (line.length > maxChars) maxChars = line.length;
    }
  }
  const estWidth = Math.min(labelWidth, Math.ceil(maxChars * (fontSize * 0.62)));
  return Math.max(25, estWidth) + labelMargin;
}

/**
 * Builds a standardized, publication-grade ECharts axis object (xAxis / yAxis)
 * with full typography, rotation, label formatting, baseline borders, and gridlines.
 */
export function buildScientificAxisConfig(
  axisTarget: 'x' | 'y',
  ctx: ChartGeneratorContext,
  options: ScientificAxisOptions
): any {
  const { palette, font, fontSize } = ctx;
  const isX = axisTarget === 'x';
  const isHorizontalChart = ctx.chartType === 'bar_horizontal' || ctx.chartType === 'horizontal_bar_scatter' || (ctx.chartType === 'clustered_bar' && ctx.barOrientation === 'horizontal') || (ctx.chartType === 'stacked_bar' && ctx.barOrientation === 'horizontal') || (ctx.chartType === 'boxplot' && ctx.boxplotOrientation === 'horizontal');

  // 1. Resolve Tick Labels
  const showLabel = isX ? (ctx.showAxisLabelX ?? true) : (ctx.showAxisLabelY ?? true);

  const labelFontSize = isX
    ? (ctx.axisLabelFontSizeX ?? Math.max(8, fontSize - 2))
    : (ctx.axisLabelFontSizeY ?? ctx.barYAxisFontSize ?? Math.max(8, fontSize - 2));

  const labelFontWeight = isX
    ? (ctx.axisLabelFontWeightX || 'normal')
    : (ctx.axisLabelFontWeightY || ctx.barYAxisFontWeight || 'normal');

  const labelFontStyle = isX
    ? (ctx.axisLabelFontStyleX || 'normal')
    : (ctx.axisLabelFontStyleY || ctx.barYAxisFontStyle || 'normal');

  const labelColor = isX
    ? (ctx.axisLabelColorX || palette.text)
    : (ctx.axisLabelColorY || ctx.barYAxisColor || palette.text);

  const labelRotate = isX
    ? (ctx.axisLabelRotateX ?? (ctx.labelRotation || 0))
    : (ctx.axisLabelRotateY ?? 0);

  const labelMargin = isX
    ? (ctx.axisLabelMarginX ?? 8)
    : (ctx.axisLabelMarginY ?? 8);

  const labelOverflow = isX
    ? (ctx.axisLabelOverflowX || 'none')
    : (ctx.axisLabelOverflowY ?? ctx.barYAxisOverflow ?? (isHorizontalChart ? 'break' : 'none'));

  const labelWidth = isX
    ? (ctx.axisLabelWidthX ?? 120)
    : (ctx.axisLabelWidthY ?? ctx.barYAxisWidth ?? 140);

  const labelLineHeight = isX
    ? (ctx.axisLabelLineHeightX ?? Math.max(12, labelFontSize + 3))
    : (ctx.axisLabelLineHeightY ?? ctx.barLineHeight ?? Math.max(12, labelFontSize + 3));

  const labelFormat = isX
    ? (ctx.axisLabelFormatX || 'auto')
    : (ctx.axisLabelFormatY || 'auto');

  const labelDecimals = isX ? ctx.axisLabelDecimalsX : ctx.axisLabelDecimalsY;

  const labelPrefix = isX ? (ctx.axisLabelPrefixX || '') : (ctx.axisLabelPrefixY || '');
  const labelSuffix = isX ? (ctx.axisLabelSuffixX || '') : (ctx.axisLabelSuffixY || '');

  const labelInterval = isX
    ? (ctx.axisLabelIntervalX ?? 'auto')
    : (ctx.axisLabelIntervalY ?? 'auto');


  // 2. Resolve Titles
  const customTitle = isX ? ctx.customAxisTitleX : ctx.customAxisTitleY;
  const showTitle = isX ? (ctx.showAxisTitleX ?? true) : (ctx.showAxisTitleY ?? true);
  const titlePrefix = isX ? (ctx.axisTitlePrefixX || '') : (ctx.axisTitlePrefixY || '');
  const titleSuffix = isX ? (ctx.axisTitleSuffixX || '') : (ctx.axisTitleSuffixY || '');

  const baseTitleText = (customTitle && customTitle.trim() !== '') 
    ? customTitle.trim() 
    : (options.defaultTitle ? formatVariableDisplayName(options.defaultTitle) : '');
  const resolvedTitle = baseTitleText ? `${titlePrefix}${baseTitleText}${titleSuffix}` : '';

  const titleFontSize = isX
    ? (ctx.axisTitleFontSizeX ?? Math.max(9, fontSize - 1))
    : (ctx.axisTitleFontSizeY ?? Math.max(9, fontSize - 1));

  const titleFontWeight = isX
    ? (ctx.axisTitleFontWeightX || 'bold')
    : (ctx.axisTitleFontWeightY || 'bold');

  const titleFontStyle = isX
    ? (ctx.axisTitleFontStyleX || 'normal')
    : (ctx.axisTitleFontStyleY || (isX ? 'normal' : 'italic'));

  const titleColor = isX
    ? (ctx.axisTitleColorX || palette.text)
    : (ctx.axisTitleColorY || palette.text);

  const titleLocation: AxisLocation = isX
    ? (ctx.axisTitleLocationX || 'middle')
    : (ctx.axisTitleLocationY || 'middle');

  const isMiddleLocation = !titleLocation || titleLocation === 'middle' || titleLocation === 'center';

  const defaultRotate = isX ? 0 : (isMiddleLocation ? 90 : 0);
  const titleRotate = isX
    ? (ctx.axisTitleRotateX !== undefined ? ctx.axisTitleRotateX : defaultRotate)
    : (ctx.axisTitleRotateY !== undefined ? ctx.axisTitleRotateY : defaultRotate);

  const offsetX = isX ? (ctx.axisTitleOffsetX_X ?? 0) : (ctx.axisTitleOffsetX_Y ?? 0);
  const offsetY = isX ? (ctx.axisTitleOffsetY_X ?? 0) : (ctx.axisTitleOffsetY_Y ?? 0);

  const dynamicDefaultTitleGap = isX
    ? 28
    : (isHorizontalChart ? (isMiddleLocation ? 15 : 10) : 38);

  const rawTitleGap = isX
    ? (ctx.axisTitleGapX ?? 28)
    : (ctx.axisTitleGapY ?? dynamicDefaultTitleGap);

  let titleGap = rawTitleGap;
  if (isHorizontalChart && !isX && isMiddleLocation) {
    const labelSpan = estimateCategoryLabelSpan(
      options.categories,
      labelFontSize,
      labelWidth,
      labelOverflow,
      labelMargin
    );
    const halfTitleThickness = titleRotate === 0
      ? Math.round(Math.min(200, (resolvedTitle.length * titleFontSize * 0.6)) / 2)
      : Math.round(titleFontSize / 2);
    titleGap = labelSpan + rawTitleGap + halfTitleThickness - offsetX;
  } else {
    titleGap = rawTitleGap - (isX ? offsetY : offsetX);
  }

  // 3. Resolve Gridlines
  const defaultShowGrid = isX
    ? (isHorizontalChart ? true : false)
    : (isHorizontalChart ? false : (ctx.lineShowGridLines !== false));

  const showGrid = isX
    ? (ctx.showGridLinesX !== undefined ? ctx.showGridLinesX : defaultShowGrid)
    : (ctx.showGridLinesY !== undefined ? ctx.showGridLinesY : defaultShowGrid);

  const gridLineStyle: AxisGridLineStyle = ctx.gridLineStyle || 'dashed';
  const gridLineColor = ctx.gridLineColor || palette.gridLine || palette.border;
  const gridLineOpacity = (ctx.gridLineOpacity ?? 100) / 100;

  // 4. Resolve Baseline & Ticks
  const showBaseline = ctx.showAxisBaseline ?? true;
  const tickDirection = ctx.axisTickDirection || 'outside';

  // 5. Type & Scale Configuration
  let axisType: 'category' | 'value' | 'log' | 'time' = 'category';
  if (options.axisKind === 'value') {
    axisType = ctx.axisScaleType === 'log' ? 'log' : 'value';
  } else if (options.axisKind === 'time') {
    axisType = 'time';
  } else {
    axisType = 'category';
  }

  // Label Formatter Function
  const axisLabelFormatter = (rawVal: any) => {
    if (options.axisKind === 'category') {
      const textVal = String(rawVal ?? '');
      if (labelOverflow === 'break') {
        const charLimit = Math.max(8, Math.floor((labelWidth - 8) / (labelFontSize * 0.55)));
        const wrapped = wrapAxisLabelText(textVal, charLimit);
        return formatScientificAxisValue(wrapped, labelFormat, labelPrefix, labelSuffix);
      }
      if (labelOverflow === 'truncate') {
        const charLimit = Math.max(8, Math.floor((labelWidth - 8) / (labelFontSize * 0.55)));
        const truncated = textVal.length > charLimit ? textVal.substring(0, Math.max(4, charLimit - 1)) + '…' : textVal;
        return formatScientificAxisValue(truncated, labelFormat, labelPrefix, labelSuffix);
      }
      return formatScientificAxisValue(textVal, labelFormat, labelPrefix, labelSuffix);
    }

    // Apply explicit decimal precision override for numeric value axes
    if (labelDecimals !== undefined && typeof rawVal === 'number') {
      const fixed = rawVal.toFixed(labelDecimals);
      if (labelFormat === 'percent') {
        return `${labelPrefix}${fixed}%${labelSuffix}`;
      }
      if (labelFormat === 'auto' || labelFormat === 'raw') {
        if (options.defaultUnitFormatter) {
          // Reformat via default unit formatter but replace numeric core with fixed precision
          const base = options.defaultUnitFormatter(rawVal);
          // Replace leading number with fixed version
          return `${labelPrefix}${base.replace(/^-?\d+(\.\d+)?/, fixed)}${labelSuffix}`;
        }
        return `${labelPrefix}${fixed}${labelSuffix}`;
      }
    }

    return formatScientificAxisValue(rawVal, labelFormat, labelPrefix, labelSuffix, options.defaultUnitFormatter);
  };

  return {
    type: axisType,
    data: options.axisKind === 'category' ? options.categories : undefined,
    inverse: options.inverse ?? false,
    scale: options.scale,
    min: options.min,
    max: options.max,
    interval: typeof options.interval === 'number' && options.interval > 0 ? options.interval : undefined,
    splitNumber: options.splitNumber,
    name: showTitle && resolvedTitle ? resolvedTitle : undefined,
    nameLocation: titleLocation as any,
    nameGap: titleGap,
    nameRotate: titleRotate,
    nameTextStyle: {
      fontFamily: font,
      fontSize: titleFontSize,
      fontWeight: titleFontWeight as any,
      fontStyle: titleFontStyle as any,
      color: titleColor,
      align: isX
        ? (ctx.axisTitleAlignX || (titleLocation === 'start' ? 'left' : titleLocation === 'end' ? 'right' : 'center'))
        : (isHorizontalChart && (titleLocation === 'end' || titleLocation === 'start')
          ? 'right'
          : (ctx.axisTitleAlignY || 'center')),
      verticalAlign: isHorizontalChart && !isX && titleLocation === 'end'
        ? 'bottom'
        : isHorizontalChart && !isX && titleLocation === 'start'
        ? 'top'
        : (isX ? 'top' : 'middle'),
      padding: isX
        ? [0, 0, 0, offsetX]
        : [-offsetY, 0, offsetY, 0]
    },
    axisLabel: {
      show: showLabel,
      fontFamily: font,
      fontSize: labelFontSize,
      fontWeight: labelFontWeight as any,
      fontStyle: labelFontStyle as any,
      color: labelColor,
      rotate: labelRotate,
      margin: labelMargin,
      width: (labelOverflow !== 'none') ? labelWidth : undefined,
      overflow: (labelOverflow !== 'none') ? labelOverflow : undefined,
      lineHeight: labelLineHeight,
      interval: labelInterval as any,
      formatter: axisLabelFormatter
    },
    axisTick: {
      show: tickDirection !== 'none',
      inside: tickDirection === 'inside',
      alignWithLabel: true,
      lineStyle: { color: palette.text }
    },
    axisLine: {
      show: showBaseline,
      lineStyle: { color: palette.text, width: 1.2 }
    },
    splitLine: {
      show: showGrid,
      lineStyle: {
        color: gridLineColor,
        type: gridLineStyle,
        opacity: gridLineOpacity
      }
    }
  };
}

export interface UniversalGridResult {
  top: number;
  bottom: number;
  left: number;
  right: number;
  containLabel?: boolean;
}

/**
 * Universally computes standard publication grid clearances for Cartesian,
 * correlation, and matrix charts, respecting universal margins and camera padding.
 */
export function resolveUniversalGrid(
  ctx: ChartGeneratorContext,
  defaultGrid: { top?: number; bottom?: number; left?: number; right?: number } = {}
): UniversalGridResult {
  const isAuto = ctx.gridMarginAuto ?? true;
  const showLegend = ctx.showLegend;
  const legDist = ctx.legendDistance ?? 20;
  const isTop = ctx.legendPosition === 'top' || !ctx.legendPosition;
  const isBottom = ctx.legendPosition === 'bottom';
  const isLeft = ctx.legendPosition === 'left';
  const isRight = ctx.legendPosition === 'right';

  const offX = ctx.fitOffsetX ?? 0;
  const offY = ctx.fitOffsetY ?? 0;

  const isHorizontalChart = ctx.chartType === 'bar_horizontal' ||
    ctx.chartType === 'horizontal_bar_scatter' ||
    ((ctx.chartType === 'clustered_bar' || ctx.chartType === 'stacked_bar') && ctx.barOrientation === 'horizontal') ||
    (ctx.chartType === 'boxplot' && ctx.boxplotOrientation === 'horizontal');
  // Compute minimum left clearance required to preserve Y-axis title visibility without clipping
  const showYTitle = (ctx.showAxisTitleY ?? true) && Boolean(ctx.customAxisTitleY || ctx.primaryField);
  const titleLocationY = ctx.axisTitleLocationY || 'middle';
  const isMiddleY = titleLocationY === 'middle' || titleLocationY === 'center';
  const titleFontSizeY = ctx.axisTitleFontSizeY ?? 11;
  const titleGapY = ctx.axisTitleGapY ?? (isHorizontalChart ? (isMiddleY ? 15 : 10) : 38);
  const titleRotateY = ctx.axisTitleRotateY !== undefined ? ctx.axisTitleRotateY : (isMiddleY ? 90 : 0);
  const titleThicknessY = titleRotateY === 0
    ? Math.min(220, ((ctx.customAxisTitleY || ctx.primaryField || '').length * titleFontSizeY * 0.6))
    : (titleFontSizeY + 6);

  const minRequiredTitleSpace = (showYTitle && isHorizontalChart && isMiddleY)
    ? Math.round(titleThicknessY + titleGapY + 14)
    : 0;

  if (!isAuto) {
    const top = ctx.gridMarginTop ?? defaultGrid.top ?? 45;
    const bottom = ctx.gridMarginBottom ?? defaultGrid.bottom ?? 45;
    const rawLeft = ctx.gridMarginLeft ?? ctx.barGridLeft ?? defaultGrid.left ?? 25;
    const left = Math.max(minRequiredTitleSpace, rawLeft);
    const right = ctx.gridMarginRight ?? ctx.barGridRight ?? defaultGrid.right ?? 45;
    return {
      top: Math.max(0, top - offY),
      bottom: Math.max(0, bottom + offY),
      left: Math.max(0, left - offX),
      right: Math.max(0, right + offX),
      containLabel: true
    };
  }

  let top = defaultGrid.top ?? 45;
  let bottom = defaultGrid.bottom ?? 45;
  let left = defaultGrid.left ?? 25;
  let right = defaultGrid.right ?? 45;

  if (showLegend) {
    if (isTop) top = (ctx.baseTitle?.show ? 85 : 55) + Math.round(legDist * 0.5);
    else if (isBottom) bottom = 55 + Math.round(legDist * 0.5);
    else if (isRight) right = Math.max(right, 130 + legDist);
    else if (isLeft) left = Math.max(left, 120 + legDist);
  }

  left = Math.max(minRequiredTitleSpace, left);

  const cPad = ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0;

  return {
    top: Math.max(10, top + cPad - offY),
    bottom: Math.max(10, bottom + cPad + offY),
    left: Math.max(0, left + cPad - offX),
    right: Math.max(15, right + cPad + offX),
    containLabel: true
  };
}

