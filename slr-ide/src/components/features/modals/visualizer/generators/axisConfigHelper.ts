import type { ChartGeneratorContext } from './types';
import type { AxisLocation, AxisLabelFormat, AxisGridLineStyle } from '../types';

export interface ScientificAxisOptions {
  axisKind: 'category' | 'value' | 'time';
  defaultTitle?: string;
  categories?: (string | number)[];
  inverse?: boolean;
  min?: number | ((val: any) => number);
  max?: number | ((val: any) => number);
  splitNumber?: number;
  scale?: boolean;
  isSecondary?: boolean;
  defaultUnitFormatter?: (val: any) => string;
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

  return `${prefix}${coreStr}${suffix}`;
}

/**
 * Breaks long text strings across multiple lines based on maximum character limit.
 */
export function wrapAxisLabelText(text: string, maxCharsPerLine: number = 16): string {
  if (!text || text.length <= maxCharsPerLine) return text;
  const words = text.split(' ');
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

  // 1. Resolve Titles
  const customTitle = isX ? ctx.customAxisTitleX : ctx.customAxisTitleY;
  const showTitle = isX ? (ctx.showAxisTitleX ?? true) : (ctx.showAxisTitleY ?? true);
  const resolvedTitle = (customTitle && customTitle.trim() !== '') ? customTitle.trim() : (options.defaultTitle || '');

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

  const titleGap = isX
    ? (ctx.axisTitleGapX ?? 28)
    : (ctx.axisTitleGapY ?? 38);

  // 2. Resolve Tick Labels
  const showLabel = isX ? (ctx.showAxisLabelX ?? true) : (ctx.showAxisLabelY ?? true);

  const labelFontSize = isX
    ? (ctx.axisLabelFontSizeX ?? Math.max(8, fontSize - 2))
    : (ctx.axisLabelFontSizeY ?? (ctx.barYAxisFontSize ?? Math.max(8, fontSize - 2)));

  const labelFontWeight = isX
    ? (ctx.axisLabelFontWeightX || 'normal')
    : (ctx.axisLabelFontWeightY || 'normal');

  const labelColor = isX
    ? (ctx.axisLabelColorX || palette.text)
    : (ctx.axisLabelColorY || palette.text);

  const labelRotate = isX
    ? (ctx.axisLabelRotateX ?? (ctx.labelRotation || 0))
    : (ctx.axisLabelRotateY ?? 0);

  const labelMargin = isX
    ? (ctx.axisLabelMarginX ?? 8)
    : (ctx.axisLabelMarginY ?? 8);

  const labelOverflow = isX
    ? (ctx.axisLabelOverflowX || 'none')
    : (ctx.axisLabelOverflowY || (ctx.barYAxisOverflow || 'none'));

  const labelWidth = isX
    ? (ctx.axisLabelWidthX ?? 120)
    : (ctx.axisLabelWidthY ?? (ctx.barYAxisWidth ?? 140));

  const labelLineHeight = isX
    ? (ctx.axisLabelLineHeightX ?? Math.max(12, labelFontSize + 3))
    : (ctx.axisLabelLineHeightY ?? (ctx.barLineHeight ?? Math.max(12, labelFontSize + 3)));

  const labelFormat = isX
    ? (ctx.axisLabelFormatX || 'auto')
    : (ctx.axisLabelFormatY || 'auto');

  const labelPrefix = isX ? (ctx.axisLabelPrefixX || '') : (ctx.axisLabelPrefixY || '');
  const labelSuffix = isX ? (ctx.axisLabelSuffixX || '') : (ctx.axisLabelSuffixY || '');

  const labelInterval = isX
    ? (ctx.axisLabelIntervalX ?? 'auto')
    : (ctx.axisLabelIntervalY ?? 'auto');

  // 3. Resolve Gridlines
  const showGrid = isX
    ? (ctx.showGridLinesX ?? false)
    : (ctx.showGridLinesY ?? (ctx.lineShowGridLines !== false));

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

    return formatScientificAxisValue(rawVal, labelFormat, labelPrefix, labelSuffix, options.defaultUnitFormatter);
  };

  return {
    type: axisType,
    data: options.axisKind === 'category' ? options.categories : undefined,
    inverse: options.inverse ?? false,
    scale: options.scale,
    min: options.min,
    max: options.max,
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
