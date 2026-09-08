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
 * Breaks long text strings across multiple lines based on maximum character limit.
 * Priority order: (1) explicit \n, (2) "/" semantic delimiters, (3) space-based word wrap.
 */
export function wrapAxisLabelText(text: string, maxCharsPerLine: number = 16): string {
  if (!text) return '';
  const unescaped = text.replace(/\\n/g, '\n');
  if (unescaped.includes('\n')) {
    return unescaped.split('\n').map(segment => wrapAxisLabelText(segment, maxCharsPerLine)).join('\n');
  }
  // Priority 2: Pre-split on "/" semantic separators (e.g. "Agriculture/Horticulture", "Traffic / Smart City")
  if (unescaped.includes('/')) {
    const slashSegments = unescaped.split('/').map(s => s.trim()).filter(Boolean);
    if (slashSegments.length > 1) {
      return slashSegments.map((segment, sIdx) => {
        const textWithSlash = sIdx < slashSegments.length - 1 ? `${segment}/` : segment;
        return wrapAxisLabelText(textWithSlash, maxCharsPerLine);
      }).join('\n');
    }
  }
  if (unescaped.length <= maxCharsPerLine) return unescaped;
  const words = unescaped.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let rem = word;
      while (rem.length > maxCharsPerLine) {
        lines.push(rem.slice(0, maxCharsPerLine));
        rem = rem.slice(maxCharsPerLine);
      }
      current = rem;
    } else if ((current + ' ' + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
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
  const resolvedTitle = (customTitle && customTitle.trim() !== '') 
    ? customTitle.trim() 
    : (options.defaultTitle ? formatVariableDisplayName(options.defaultTitle) : '');

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

  const dynamicDefaultTitleGap = isX
    ? 28
    : (isHorizontalChart ? Math.max(42, labelWidth + labelMargin + 16) : 38);

  const titleGap = isX
    ? (ctx.axisTitleGapX ?? 28)
    : (ctx.axisTitleGapY ?? dynamicDefaultTitleGap);

  // 3. Resolve Gridlines
  const defaultShowGrid = isX
    ? (isHorizontalChart ? true : false)
    : (isHorizontalChart ? false : (ctx.lineShowGridLines !== false));

  const showGrid = isX
    ? (ctx.showGridLinesX !== undefined ? ctx.showGridLinesX : defaultShowGrid)
    : (ctx.showGridLinesY !== undefined ? ctx.showGridLinesY : defaultShowGrid);

  const gridLineStyle: AxisGridLineStyle = ctx.gridLineStyle || 'dashed';
  const gridLineColor = ctx.gridLineColor || palette.border;
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
    nameTextStyle: {
      fontFamily: font,
      fontSize: titleFontSize,
      fontWeight: titleFontWeight as any,
      fontStyle: titleFontStyle as any,
      color: titleColor
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

  const effectiveLabelWidth = ctx.axisLabelWidthY ?? ctx.barYAxisWidth ?? 140;
  const effectiveLabelMargin = ctx.axisLabelMarginY ?? 8;
  const showYTitle = (ctx.showAxisTitleY ?? true) && Boolean(ctx.customAxisTitleY || (ctx as any).primaryField || (ctx as any).categoryField);
  const effectiveYTitleGap = ctx.axisTitleGapY ?? Math.max(42, effectiveLabelWidth + effectiveLabelMargin + 16);
  const titleFontSize = ctx.axisTitleFontSizeY ?? Math.max(9, (ctx.fontSize || 12) - 1);
  const requiredYTitleClearance = isHorizontalChart
    ? (showYTitle ? (effectiveYTitleGap + titleFontSize + 16) : (effectiveLabelWidth + effectiveLabelMargin + 20))
    : 40;

  if (!isAuto) {
    const top = ctx.gridMarginTop ?? defaultGrid.top ?? 45;
    const bottom = ctx.gridMarginBottom ?? defaultGrid.bottom ?? 45;
    let rawLeft = ctx.gridMarginLeft ?? defaultGrid.left ?? (isHorizontalChart ? requiredYTitleClearance : 60);
    if (isHorizontalChart && rawLeft <= 40) {
      rawLeft = Math.round(1200 * (rawLeft / 100));
    }
    const left = isHorizontalChart ? Math.max(requiredYTitleClearance, rawLeft) : rawLeft;
    const right = ctx.gridMarginRight ?? defaultGrid.right ?? 45;
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
  let rawLeft = defaultGrid.left ?? (isHorizontalChart ? requiredYTitleClearance : 60);
  if (isHorizontalChart && rawLeft <= 40) {
    rawLeft = Math.round(1200 * (rawLeft / 100));
  }
  let left = isHorizontalChart ? Math.max(requiredYTitleClearance, rawLeft) : rawLeft;
  let right = defaultGrid.right ?? 45;

  if (showLegend) {
    if (isTop) top = (ctx.baseTitle?.show ? 85 : 55) + Math.round(legDist * 0.5);
    else if (isBottom) bottom = 55 + Math.round(legDist * 0.5);
    else if (isRight) right = Math.max(right, 130 + legDist);
    else if (isLeft) left = Math.max(left, 120 + legDist);
  }

  const cPad = ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0;

  return {
    top: Math.max(10, top + cPad - offY),
    bottom: Math.max(10, bottom + cPad + offY),
    left: Math.max(15, left + cPad - offX),
    right: Math.max(15, right + cPad + offX),
    containLabel: true
  };
}

