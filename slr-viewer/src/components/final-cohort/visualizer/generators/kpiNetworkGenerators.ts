import type * as echarts from 'echarts';
import { getNodeColor, hexToRgba } from '../utils/colorUtils';
import { 
  getFieldValue, 
  getMappedFieldValue, 
  computeMetricValue, 
  limitCategoryMap,
  extractNumericalValue,
  formatVariableDisplayName
} from '../utils/dataExtractor';
import { calculateCohortVariableMetrics, calculateHareHamiltonPercentages } from '@/lib/services/cohort-metrics';
import { formatLegendLabel, type ChartGeneratorContext } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';

function buildRadarCoordinateConfig(params: {
  indicators: any[];
  centerX: number;
  centerY: number;
  calculatedRadius: number;
  radarStartAngle: number;
  radarShape: 'polygon' | 'circle';
  radarSplitNumber: number;
  palette: any;
  font: string;
  splitAreaColors?: string[];
  ctx: ChartGeneratorContext;
  axisNameFormatter: (value?: string, indicator?: any) => string;
}) {
  const {
    indicators,
    centerX,
    centerY,
    calculatedRadius,
    radarStartAngle,
    radarShape,
    radarSplitNumber,
    palette,
    font,
    splitAreaColors,
    ctx,
    axisNameFormatter
  } = params;

  const effectiveAxisNameFontSize = ctx.radarAxisNameFontSize !== undefined
    ? ctx.radarAxisNameFontSize
    : (ctx.radarLabelFontSize !== undefined ? ctx.radarLabelFontSize : Math.max(9, (ctx.fontSize || 12) - 1));
  const effectiveAxisNameFontWeight = (ctx.radarAxisNameFontWeight || ctx.radarLabelFontWeight || 'bold') as any;
  const effectiveAxisNameFontStyle = (ctx.radarAxisNameFontStyle || ctx.radarLabelFontStyle || 'normal') as any;
  const effectiveAxisNameColor = (ctx.radarAxisNameColor && ctx.radarAxisNameColor.trim() !== '')
    ? ctx.radarAxisNameColor
    : (ctx.radarLabelColor && ctx.radarLabelColor.trim() !== '')
      ? ctx.radarLabelColor
      : palette.text;
  const effectiveAxisNameLineHeight = ctx.radarAxisNameLineHeight ?? (effectiveAxisNameFontSize ? effectiveAxisNameFontSize + 4 : 15);
  const effectiveAxisNameWidth = (ctx.radarAxisNameWidth !== undefined && ctx.radarAxisNameWidth > 0) ? ctx.radarAxisNameWidth : undefined;
  const effectiveAxisNameOverflow = ctx.radarAxisNameOverflow || 'break';
  const effectiveAxisNameGap = ctx.radarAxisNameMargin ?? 15;

  return {
    indicator: indicators,
    center: [`${centerX}%`, `${centerY}%`],
    radius: `${calculatedRadius}%`,
    startAngle: radarStartAngle ?? 90,
    shape: radarShape || 'polygon',
    splitNumber: radarSplitNumber ?? 5,
    axisLine: {
      show: ctx.radarAxisLine !== false,
      lineStyle: {
        width: ctx.radarAxisLineWidth ?? 1,
        type: ctx.radarAxisLineType || 'solid',
        color: (ctx.radarAxisLineColor && ctx.radarAxisLineColor.trim() !== '') ? ctx.radarAxisLineColor : (palette.border || '#b0bec5'),
        opacity: (ctx.radarAxisLineOpacity !== undefined ? ctx.radarAxisLineOpacity : 100) / 100
      }
    },
    splitLine: {
      show: ctx.radarSplitLine !== false,
      lineStyle: {
        width: ctx.radarSplitLineWidth ?? 1,
        type: ctx.radarSplitLineType || 'solid',
        color: (ctx.radarSplitLineColor && ctx.radarSplitLineColor.trim() !== '') ? ctx.radarSplitLineColor : (palette.border || '#cfd8dc'),
        opacity: (ctx.radarSplitLineOpacity !== undefined ? ctx.radarSplitLineOpacity : 100) / 100
      }
    },
    splitArea: {
      show: Boolean(splitAreaColors),
      areaStyle: {
        color: splitAreaColors || [palette.bg, hexToRgba(palette.text, 0.03)],
        opacity: (ctx.radarSplitAreaOpacity !== undefined ? ctx.radarSplitAreaOpacity : 100) / 100,
        shadowColor: 'rgba(0, 0, 0, 0.05)',
        shadowBlur: 10
      }
    },
    axisTick: {
      show: ctx.radarShowAxisTicks ?? true,
      lineStyle: {
        color: palette.border || '#b0bec5'
      }
    },
    axisLabel: {
      show: ctx.radarShowAxisScaleLabels === true,
      fontSize: ctx.radarAxisScaleFontSize ?? 9,
      fontWeight: ctx.radarAxisScaleFontWeight || '500',
      color: (ctx.radarAxisScaleColor && ctx.radarAxisScaleColor.trim() !== '') ? ctx.radarAxisScaleColor : palette.subtext,
      formatter: (val: number) => {
        const fmt = ctx.radarAxisScaleFormat || 'percent';
        if (fmt === 'integer') return `${Math.round(val)}`;
        if (fmt === 'decimal_1') return `${val.toFixed(1)}%`;
        if (fmt === 'raw') return `${val}`;
        return `${Math.round(val)}%`;
      }
    },
    axisName: {
      formatter: axisNameFormatter,
      fontFamily: font,
      fontSize: effectiveAxisNameFontSize,
      fontWeight: effectiveAxisNameFontWeight,
      fontStyle: effectiveAxisNameFontStyle,
      color: effectiveAxisNameColor,
      width: effectiveAxisNameWidth,
      overflow: effectiveAxisNameOverflow,
      lineHeight: effectiveAxisNameLineHeight,
      backgroundColor: (ctx.radarAxisNameBgColor && ctx.radarAxisNameBgColor.trim() !== '') ? ctx.radarAxisNameBgColor : undefined,
      padding: (ctx.radarAxisNamePadding !== undefined && ctx.radarAxisNamePadding > 0) ? ctx.radarAxisNamePadding : undefined,
      borderRadius: (ctx.radarAxisNameBorderRadius !== undefined && ctx.radarAxisNameBorderRadius > 0) ? ctx.radarAxisNameBorderRadius : undefined,
      borderColor: (ctx.radarAxisNameBorderColor && ctx.radarAxisNameBorderColor.trim() !== '') ? ctx.radarAxisNameBorderColor : undefined,
      borderWidth: (ctx.radarAxisNameBorderWidth !== undefined && ctx.radarAxisNameBorderWidth > 0) ? ctx.radarAxisNameBorderWidth : undefined
    },
    axisNameGap: effectiveAxisNameGap
  };
}

export function generateRadarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    primaryField,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    umbrellanizerMap,
    radarMode = 'multi_variable',
    radarVariables = [],
    radarVariableAliases = {},
    radarVariableTargets = {},
    radarIndicatorFormat = 'two_line',
    radarShowTarget = true,
    radarTargetName = 'Horticultural Requirement Target',
    radarTargetValue = 100,
    radarTargetLineStyle = 'dashed',
    radarTargetLineWidth = 2,
    radarTargetColor = '#d9534f',
    radarTargetAreaOpacity = 8,
    radarBaselineName = 'Empirical Cohort Baseline (n={n})',
    radarBaselineColor,
    radarTagShareName = 'Tag Share (% of Disclosed Tags, N={N})',
    radarTagShareColor = '#c62828',
    radarTagShareLineStyle = 'dashed',
    radarTagShareLineWidth = 2,
    radarTagShareAreaOpacity = 12,
    radarTagShareSymbol = 'rect',
    radarTagShareSymbolSize = 5,
    radarStartAngle = 90,
    radarSplitAreaTheme = 'stepped',
    enableManualOverrides,
    manualCategoryValues = {}
  } = ctx;

  const totalCohort = papers.length;
  const mappedOpts = { 
    useUmbrellanizer, 
    umbrellanizerMap, 
    splitMultiValues, 
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    primaryField
  };

  // Helper for splitArea progressive depth styling
  const getSplitAreaColors = () => {
    if (radarSplitAreaTheme === 'none' || ctx.radarSplitArea === false) {
      return undefined;
    }
    if (radarSplitAreaTheme === 'custom') {
      const c1 = (ctx.radarSplitAreaColor1 && ctx.radarSplitAreaColor1.trim() !== '') ? ctx.radarSplitAreaColor1 : palette.bg;
      const c2 = (ctx.radarSplitAreaColor2 && ctx.radarSplitAreaColor2.trim() !== '') ? ctx.radarSplitAreaColor2 : hexToRgba(palette.text, 0.05);
      return [c1, c2];
    }
    if (radarSplitAreaTheme === 'solid') {
      return [hexToRgba(palette.text, 0.04)];
    }
    if (radarSplitAreaTheme === 'subtle') {
      return [palette.bg, hexToRgba(palette.text, 0.03)];
    }
    // 'stepped' - 5-step progressive gradient
    const isDarkBg = palette.bg && (palette.bg.startsWith('#0') || palette.bg.startsWith('#1') || palette.bg.startsWith('#2') || palette.bg === 'black');
    if (isDarkBg) {
      return [
        'rgba(255, 255, 255, 0.015)',
        'rgba(255, 255, 255, 0.035)',
        'rgba(255, 255, 255, 0.055)',
        'rgba(255, 255, 255, 0.075)',
        'rgba(255, 255, 255, 0.095)'
      ];
    }
    return ['#fbfbfb', '#f4f6f8', '#edf1f5', '#e4e9ef', '#dbe2ea'];
  };

  const effectiveAxisNameFontSize = ctx.radarAxisNameFontSize !== undefined
    ? ctx.radarAxisNameFontSize
    : (ctx.radarLabelFontSize !== undefined ? ctx.radarLabelFontSize : Math.max(9, fontSize - 1));
  const effectiveAxisNameFontWeight = (ctx.radarAxisNameFontWeight || ctx.radarLabelFontWeight || 'bold') as any;
  const effectiveAxisNameFontStyle = (ctx.radarAxisNameFontStyle || ctx.radarLabelFontStyle || 'normal') as any;
  const effectiveAxisNameColor = (ctx.radarAxisNameColor && ctx.radarAxisNameColor.trim() !== '')
    ? ctx.radarAxisNameColor
    : (ctx.radarLabelColor && ctx.radarLabelColor.trim() !== '')
      ? ctx.radarLabelColor
      : palette.text;
  const effectiveAxisNameLineHeight = ctx.radarAxisNameLineHeight ?? (effectiveAxisNameFontSize ? effectiveAxisNameFontSize + 4 : 15);
  const effectiveAxisNameWidth = (ctx.radarAxisNameWidth !== undefined && ctx.radarAxisNameWidth > 0) ? ctx.radarAxisNameWidth : undefined;
  const effectiveAxisNameOverflow = ctx.radarAxisNameOverflow || 'break';
  const effectiveAxisNameGap = ctx.radarAxisNameMargin ?? 15;

  const splitAreaColors = getSplitAreaColors();

  const formatRadarDataLabel = (val: any) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    const fmt = ctx.radarDataLabelFormat || 'percent';
    if (fmt === 'integer') return `${Math.round(num)}`;
    if (fmt === 'decimal_1') return `${Number(num).toFixed(1)}%`;
    if (fmt === 'raw') return `${val}`;
    return `${Math.round(num)}%`;
  };

  const buildRadarCoordinateConfig = (
    indicators: Array<{ name: string; max?: number; min?: number; value?: number }>,
    defaultRadiusPct: number,
    defaultCenterYPct: number,
    axisNameFormatter?: (value?: string, indicator?: any) => string
  ) => {
    const calculatedRadius = Math.max(20, Math.min(90, (ctx.radarRadius ?? defaultRadiusPct) - Math.round(((ctx.containerPadding ?? 12) - 12) * 0.3)));
    const isLegendAtBottom = (ctx.showLegend !== false && (ctx.legendPosition === 'bottom' || !ctx.legendPosition));
    const baseCenterY = isLegendAtBottom ? defaultCenterYPct : (ctx.legendPosition === 'top' ? defaultCenterYPct + 3 : 50);
    const centerY = ctx.radarCenterY !== undefined ? ctx.radarCenterY : Math.max(20, Math.min(85, baseCenterY + (ctx.fitOffsetY ?? 0)));
    const centerX = ctx.radarCenterX !== undefined ? ctx.radarCenterX : Math.max(20, Math.min(85, 50 + (ctx.fitOffsetX ?? 0)));

    return {
      indicator: indicators,
      center: [`${centerX}%`, `${centerY}%`],
      radius: `${calculatedRadius}%`,
      startAngle: radarStartAngle ?? 90,
      shape: ctx.radarShape || 'polygon',
      splitNumber: ctx.radarSplitNumber ?? 5,
      axisLine: {
        show: ctx.radarAxisLine !== false,
        lineStyle: {
          color: (ctx.radarAxisLineColor && ctx.radarAxisLineColor.trim() !== '') ? ctx.radarAxisLineColor : (palette.border || '#b0bec5'),
          width: ctx.radarAxisLineWidth ?? 1,
          type: (ctx.radarAxisLineType || 'solid') as any,
          opacity: (ctx.radarAxisLineOpacity ?? 100) / 100
        }
      },
      splitLine: {
        show: ctx.radarSplitLine !== false,
        lineStyle: {
          color: (ctx.radarSplitLineColor && ctx.radarSplitLineColor.trim() !== '') ? ctx.radarSplitLineColor : (palette.border || '#cfd8dc'),
          width: ctx.radarSplitLineWidth ?? 1,
          type: (ctx.radarSplitLineType || 'solid') as any,
          opacity: (ctx.radarSplitLineOpacity ?? 100) / 100
        }
      },
      splitArea: {
        show: Boolean(splitAreaColors),
        areaStyle: {
          color: splitAreaColors || [palette.bg, hexToRgba(palette.text, 0.03)],
          opacity: (ctx.radarSplitAreaOpacity ?? 100) / 100,
          shadowColor: 'rgba(0, 0, 0, 0.05)',
          shadowBlur: 10
        }
      },
      axisTick: {
        show: ctx.radarShowAxisTicks === true
      },
      axisLabel: {
        show: ctx.radarShowAxisScaleLabels === true,
        fontSize: ctx.radarAxisScaleFontSize ?? 10,
        fontWeight: (ctx.radarAxisScaleFontWeight || 'normal') as any,
        color: (ctx.radarAxisScaleColor && ctx.radarAxisScaleColor.trim() !== '') ? ctx.radarAxisScaleColor : palette.subtext,
        formatter: (value: number) => {
          const fmt = ctx.radarAxisScaleFormat || 'percent';
          if (fmt === 'percent') return `${Math.round(value)}%`;
          if (fmt === 'integer') return `${Math.round(value)}`;
          if (fmt === 'decimal_1') return `${Number(value).toFixed(1)}%`;
          return `${value}`;
        }
      },
      axisName: {
        formatter: axisNameFormatter,
        fontFamily: font,
        fontSize: effectiveAxisNameFontSize,
        fontWeight: effectiveAxisNameFontWeight,
        fontStyle: effectiveAxisNameFontStyle,
        color: effectiveAxisNameColor,
        width: effectiveAxisNameWidth,
        overflow: effectiveAxisNameOverflow,
        lineHeight: effectiveAxisNameLineHeight,
        backgroundColor: (ctx.radarAxisNameBgColor && ctx.radarAxisNameBgColor.trim() !== '') ? ctx.radarAxisNameBgColor : undefined,
        padding: ctx.radarAxisNamePadding ?? (ctx.radarAxisNameBgColor ? [3, 6] : undefined),
        borderRadius: ctx.radarAxisNameBorderRadius ?? (ctx.radarAxisNameBgColor ? 4 : undefined),
        borderColor: ctx.radarAxisNameBorderColor || undefined,
        borderWidth: ctx.radarAxisNameBorderWidth ?? (ctx.radarAxisNameBorderColor ? 1 : 0)
      },
      axisNameGap: effectiveAxisNameGap
    };
  };

  // --- MODE 3: PREVALENCE VS TAG SHARE ASYMMETRY (MULTI-LABEL METRIC DISCLOSURE) ---
  if (radarMode === 'prevalence_vs_tag_share') {
    const effectiveField = primaryField || 'ext:macro:Execution Metrics';
    const cohortStats = calculateCohortVariableMetrics(papers, effectiveField, mappedOpts);
    const totalTags = cohortStats.totalExtractedTags || 0;

    const interpolateTokens = (str: string) => {
      return (str || '')
        .replace(/\{n\}/gi, String(totalCohort))
        .replace(/\{N\}/gi, String(totalTags))
        .replace(/\{tags\}/gi, String(totalTags));
    };

    // Determine category items
    let categoryItems: Array<{
      key: string;
      alias: string;
      paperCount: number;
      paperPrevalencePct: number;
      tagCount: number;
      tagSharePct: number;
    }> = [];

    if (radarVariables && radarVariables.length > 0) {
      // User has explicitly configured/ordered specific variables or category keys
      const statsMap = new Map(cohortStats.categories.map(c => [c.category, c]));
      categoryItems = radarVariables.map(vKey => {
        let cleanKey = vKey;
        if (vKey.startsWith('cat:')) {
          const rawContent = vKey.substring(4);
          const lastColon = rawContent.lastIndexOf(':');
          cleanKey = lastColon !== -1 ? rawContent.substring(lastColon + 1).trim() : rawContent;
        } else {
          cleanKey = vKey
            .replace(/^ext:(macro:|sub:|leaf:|tail:)?/, '')
            .replace(/^raw:(leaf:|tail:)?ext:/, '')
            .replace(/^rq\d*[_:]?/i, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
        }
        const alias = radarVariableAliases[vKey] || cleanKey || vKey;
        const matchedStat = statsMap.get(vKey) || statsMap.get(cleanKey) || statsMap.get(alias);

        let paperCount = matchedStat ? matchedStat.paperCount : 0;
        let paperPrevalencePct = matchedStat ? matchedStat.paperPrevalencePct : 0;
        let tagCount = matchedStat ? matchedStat.tagCount : 0;
        let tagSharePct = matchedStat ? matchedStat.tagSharePct : 0;

        if (!matchedStat) {
          // Derive on the fly if variable key is an isolated field
          papers.forEach(p => {
            const vals = getFieldValue(p, vKey, mappedOpts);
            const valid = vals.some(v => Boolean(v) && v !== 'NOT_STATED' && v !== 'FALSE' && v !== '0' && v !== 'NONE' && v !== 'UNSPECIFIED');
            if (valid) {
              paperCount++;
              tagCount += vals.length;
            }
          });
          paperPrevalencePct = totalCohort > 0 ? Math.round((paperCount / totalCohort) * 100) : 0;
          tagSharePct = totalTags > 0 ? Math.round((tagCount / totalTags) * 100) : 0;
        }

        if (enableManualOverrides && manualCategoryValues[vKey] !== undefined) {
          paperPrevalencePct = Math.round(manualCategoryValues[vKey]);
        } else if (enableManualOverrides && manualCategoryValues[alias] !== undefined) {
          paperPrevalencePct = Math.round(manualCategoryValues[alias]);
        }

        return {
          key: vKey,
          alias,
          paperCount,
          paperPrevalencePct,
          tagCount,
          tagSharePct
        };
      });
    } else {
      // Auto-populate from cohort categories
      let cats = [...cohortStats.categories];
      if (cats.length === 0) {
        cats = [
          { category: 'Time & Latency', paperCount: Math.round(totalCohort * 0.87), paperPrevalencePct: 87, tagCount: 54, tagSharePct: 39, paperIds: [] },
          { category: 'Memory & Storage', paperCount: Math.round(totalCohort * 0.43), paperPrevalencePct: 43, tagCount: 22, tagSharePct: 16, paperIds: [] },
          { category: 'Energy & Power', paperCount: Math.round(totalCohort * 0.39), paperPrevalencePct: 39, tagCount: 22, tagSharePct: 16, paperIds: [] },
          { category: 'Compute Utilization', paperCount: Math.round(totalCohort * 0.35), paperPrevalencePct: 35, tagCount: 28, tagSharePct: 20, paperIds: [] },
          { category: 'Network Overhead', paperCount: Math.round(totalCohort * 0.17), paperPrevalencePct: 17, tagCount: 11, tagSharePct: 8, paperIds: [] },
          { category: 'Thermal & Environmental', paperCount: Math.round(totalCohort * 0.04), paperPrevalencePct: 4, tagCount: 1, tagSharePct: 1, paperIds: [] }
        ];
      }

      if (limitCategories && maxCategoriesCount && cats.length > maxCategoriesCount) {
        const topCats = cats.slice(0, maxCategoriesCount - 1);
        const otherCats = cats.slice(maxCategoriesCount - 1);
        const otherTagCount = otherCats.reduce((a, b) => a + b.tagCount, 0);
        const otherPaperIds = new Set<string>();
        otherCats.forEach(c => (c.paperIds || []).forEach(id => otherPaperIds.add(id)));
        const otherPaperCount = otherPaperIds.size;
        const otherPrevPct = totalCohort > 0 ? parseFloat(((otherPaperCount / totalCohort) * 100).toFixed(1)) : 0;
        const otherTagShare = otherCats.reduce((a, b) => a + b.tagSharePct, 0);

        cats = [
          ...topCats,
          {
            category: ctx.otherCategoryLabel || 'Other',
            paperCount: otherPaperCount,
            paperPrevalencePct: otherPrevPct,
            tagCount: otherTagCount,
            tagSharePct: parseFloat(otherTagShare.toFixed(1)),
            paperIds: Array.from(otherPaperIds)
          }
        ];
      }

      categoryItems = cats.map(c => {
        const alias = radarVariableAliases[c.category] || c.category;
        let prevPct = c.paperPrevalencePct;
        if (enableManualOverrides && manualCategoryValues[c.category] !== undefined) {
          prevPct = Math.round(manualCategoryValues[c.category]);
        } else if (enableManualOverrides && manualCategoryValues[alias] !== undefined) {
          prevPct = Math.round(manualCategoryValues[alias]);
        }
        return {
          key: c.category,
          alias,
          paperCount: c.paperCount,
          paperPrevalencePct: prevPct,
          tagCount: c.tagCount,
          tagSharePct: c.tagSharePct
        };
      });
    }

    const catLookup = new Map(categoryItems.map(c => [c.alias, c]));

    const indicators = categoryItems.map(item => ({
      name: item.alias,
      max: (ctx.radarScaleMax !== undefined && ctx.radarScaleMax > 0) ? ctx.radarScaleMax : 100,
      min: ctx.radarScaleMin !== undefined ? ctx.radarScaleMin : 0,
      value: Math.round(item.paperPrevalencePct)
    }));

    const prevalenceSeriesName = interpolateTokens(radarBaselineName || 'Paper Prevalence (% of Studies, n={n})');
    const tagShareSeriesName = interpolateTokens(radarTagShareName || 'Tag Share (% of Disclosed Tags, N={N})');
    const prevalenceColor = radarBaselineColor || palette.colors[0] || '#1b5e20';
    const tagShareColor = radarTagShareColor || '#c62828';

    const seriesData: any[] = [
      {
        value: categoryItems.map(item => Math.round(item.paperPrevalencePct)),
        name: prevalenceSeriesName,
        symbol: ctx.radarBaselineSymbol || 'circle',
        symbolSize: ctx.radarBaselineSymbol === 'none' ? 0 : (ctx.radarBaselineSymbolSize ?? 6),
        smooth: ctx.radarSmooth === true ? 0.35 : false,
        label: {
          show: ctx.radarShowDataLabels === true,
          formatter: (params: any) => formatRadarDataLabel(params.value),
          position: ctx.radarDataLabelPosition || 'top',
          color: (ctx.radarDataLabelColor && ctx.radarDataLabelColor.trim() !== '') ? ctx.radarDataLabelColor : palette.text,
          fontSize: ctx.radarDataLabelFontSize ?? Math.max(9, fontSize - 3),
          fontWeight: (ctx.radarDataLabelFontWeight || 'bold') as any
        },
        lineStyle: {
          type: ctx.radarBaselineLineStyle || 'solid',
          width: ctx.radarLineWidth ?? 2.5,
          color: prevalenceColor
        },
        areaStyle: {
          color: (ctx.radarBaselineAreaColor && ctx.radarBaselineAreaColor.trim() !== '')
            ? hexToRgba(ctx.radarBaselineAreaColor, (ctx.radarAreaOpacity ?? 28) / 100)
            : hexToRgba(prevalenceColor, (ctx.radarAreaOpacity ?? 28) / 100)
        },
        itemStyle: {
          color: prevalenceColor,
          borderColor: ctx.radarBaselineSymbolBorderColor || undefined,
          borderWidth: ctx.radarBaselineSymbolBorderWidth ?? 0
        }
      },
      {
        value: categoryItems.map(item => Math.round(item.tagSharePct)),
        name: tagShareSeriesName,
        symbol: radarTagShareSymbol || 'rect',
        symbolSize: radarTagShareSymbol === 'none' ? 0 : (radarTagShareSymbolSize ?? 5),
        smooth: ctx.radarTagShareSmooth === true ? 0.35 : false,
        label: {
          show: ctx.radarShowDataLabels === true,
          formatter: (params: any) => formatRadarDataLabel(params.value),
          position: ctx.radarDataLabelPosition || 'bottom',
          color: (ctx.radarDataLabelColor && ctx.radarDataLabelColor.trim() !== '') ? ctx.radarDataLabelColor : palette.text,
          fontSize: ctx.radarDataLabelFontSize ?? Math.max(9, fontSize - 3),
          fontWeight: (ctx.radarDataLabelFontWeight || 'bold') as any
        },
        lineStyle: {
          type: radarTagShareLineStyle || 'dashed',
          width: radarTagShareLineWidth ?? 2,
          color: tagShareColor
        },
        areaStyle: {
          color: hexToRgba(tagShareColor, (radarTagShareAreaOpacity ?? 12) / 100)
        },
        itemStyle: {
          color: tagShareColor
        }
      }
    ];

    const radarTooltip = {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params: any) => {
        const isPrevalence = params.name === prevalenceSeriesName;
        const activeColor = isPrevalence ? prevalenceColor : tagShareColor;
        const colorSquare = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background-color:${activeColor};margin-right:6px;"></span>`;
        
        let content = `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">
          <div style="font-weight:bold;color:${palette.text};border-bottom:1px solid ${palette.border};padding-bottom:4px;margin-bottom:6px;">
            ${colorSquare}${params.name}
          </div>`;

        categoryItems.forEach(item => {
          const val = isPrevalence ? item.paperPrevalencePct : item.tagSharePct;
          const detail = isPrevalence 
            ? `${val}% Prevalence (n=${item.paperCount}/${totalCohort})`
            : `${val}% Tag Share (N=${item.tagCount}/${totalTags || 1})`;
          content += `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
            <span style="color:${palette.subtext};">${item.alias}:</span>
            <strong style="color:${palette.text};">${detail}</strong>
          </div>`;
        });

        content += `</div>`;
        return content;
      }
    };

    const effectiveTitle = {
      ...baseTitle,
      subtext: baseTitle?.subtext ? interpolateTokens(baseTitle.subtext) : undefined
    };

    const effectiveLegendFormat = ctx.legendFormat || ctx.barLegendFormat || 'name';
    const cleanSeriesDisplayName = (rawName: string) => {
      return rawName
        .replace(/,\s*[nN]\s*=\s*(\{[nN]\}|\d+|[nN])/gi, '')
        .replace(/\s*\([nN]\s*=\s*(\{[nN]\}|\d+|[nN])\s*\)/gi, '')
        .replace(/\s*\([nN]\s*=\s*\d+\s*\)/gi, '')
        .replace(/\s*\{[nN]\}\s*/gi, '')
        .trim();
    };

    const cleanPrevName = cleanSeriesDisplayName(radarBaselineName || 'Paper Prevalence (% of Studies)');
    const cleanTagShareName = cleanSeriesDisplayName(radarTagShareName || 'Tag Share (% of Disclosed Tags)');

    const formattedPrevLegend = effectiveLegendFormat === 'name'
      ? prevalenceSeriesName
      : formatLegendLabel(cleanPrevName, {
          paperCount: totalCohort,
          count: totalCohort,
          percent: 100,
          prevalencePct: 100,
          tagSharePct: 100,
          totalCohortPapers: totalCohort,
          totalExtractedTags: totalTags,
          metricMode: 'paper_prevalence',
          decimalPrecision: ctx.decimalPrecision,
          useTildeForCoarse: ctx.useTildeForCoarse,
          ratioStyle: ctx.ratioStyle,
          forceCohortDenominator: ctx.forceCohortDenominator
        }, effectiveLegendFormat);

    const formattedTagShareLegend = effectiveLegendFormat === 'name'
      ? tagShareSeriesName
      : formatLegendLabel(cleanTagShareName, {
          tagCount: totalTags,
          count: totalTags,
          percent: 100,
          prevalencePct: 100,
          tagSharePct: 100,
          totalCohortPapers: totalCohort,
          totalExtractedTags: totalTags,
          metricMode: 'tag_share',
          decimalPrecision: ctx.decimalPrecision,
          useTildeForCoarse: ctx.useTildeForCoarse,
          ratioStyle: ctx.ratioStyle,
          forceCohortDenominator: ctx.forceCohortDenominator
        }, effectiveLegendFormat);

    return {
      backgroundColor: palette.bg,
      color: [prevalenceColor, tagShareColor, ...palette.colors],
      title: effectiveTitle,
      legend: {
        ...baseLegend,
        selectedMode: true,
        top: ctx.legendPosition === 'top' ? Math.max(10, ctx.legendDistance ?? 20) : (ctx.legendPosition === 'bottom' ? undefined : (ctx.legendPosition === 'left' || ctx.legendPosition === 'right' ? 'center' : undefined)),
        bottom: (!ctx.legendPosition || ctx.legendPosition === 'bottom') ? Math.max(5, ctx.legendDistance ?? 20) : undefined,
        data: [
          {
            name: prevalenceSeriesName,
            icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : undefined
          },
          {
            name: tagShareSeriesName,
            icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : undefined
          }
        ],
        formatter: (name: string) => {
          if (name === prevalenceSeriesName) return formattedPrevLegend;
          if (name === tagShareSeriesName) return formattedTagShareLegend;
          return name;
        },
        textStyle: {
          ...baseLegend.textStyle
        }
      },
      tooltip: radarTooltip,
      radar: buildRadarCoordinateConfig(indicators, 62, 53, (value?: string, indicator?: any): string => {
        const effectiveName = indicator?.name ?? value ?? '';
        if (radarIndicatorFormat === 'two_line') {
          return `${effectiveName}\n(${indicator?.value ?? 0}%)`;
        }
        if (radarIndicatorFormat === 'single_line') {
          return `${effectiveName} (${indicator?.value ?? 0}%)`;
        }
        if (radarIndicatorFormat === 'asymmetry_two_line') {
          const cat = catLookup.get(effectiveName);
          return `${effectiveName}\n(Prev: ${indicator?.value ?? 0}% | Tag: ${cat?.tagSharePct ?? 0}%)`;
        }
        if (radarIndicatorFormat === 'ratio_percent') {
          const cat = catLookup.get(effectiveName);
          return `${effectiveName} (n=${cat?.paperCount ?? 0}/${totalCohort}, ${indicator?.value ?? 0}%)`;
        }
        return effectiveName;
      }),
      series: [{
        name: 'Metric Disclosure Profiling',
        type: 'radar',
        data: seriesData
      }]
    };
  }

  // --- MODE 1: MULTI-VARIABLE REQUIREMENT GAP & BOUNDARY PARADOX ---
  if (radarMode === 'multi_variable') {
    let targetVars = Array.isArray(radarVariables) ? [...radarVariables] : [];

    // Auto-discover top extracted variables if none explicitly configured
    if (targetVars.length === 0) {
      const extKeysSet = new Set<string>();
      papers.forEach(p => {
        const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
        const extStr = isManualDominant
          ? (p.manual_extracted_data || p.ai_extracted_data || '')
          : (p.ai_extracted_data || p.manual_extracted_data || '');
        if (extStr) {
          try {
            const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
            const extObj = parsed.extracted_data || parsed;
            if (typeof extObj === 'object' && extObj !== null) {
              Object.keys(extObj).forEach(k => {
                if (!k.startsWith('_') && k !== 'logic_trace' && k !== '_scientist_logic_trace') {
                  extKeysSet.add(k);
                }
              });
            }
          } catch (e) {}
        }
      });

      if (extKeysSet.size > 0) {
        targetVars = Array.from(extKeysSet).slice(0, 8);
      } else {
        targetVars = [
          'Execution Latency',
          'Static Memory',
          'Power Profiling',
          'Explicit Envelopes',
          'Narrowband / LPWAN',
          'Harsh Environment',
          'Agricultural Focus',
          'Thermal Dissipation'
        ];
      }
    }

    const varItems = targetVars.map((vKey) => {
      let cleanKey = vKey;
      if (vKey.startsWith('cat:')) {
        const rawContent = vKey.substring(4);
        const lastColon = rawContent.lastIndexOf(':');
        cleanKey = lastColon !== -1 ? rawContent.substring(lastColon + 1).trim() : rawContent;
      } else {
        cleanKey = vKey
          .replace(/^ext:(macro:|sub:|leaf:|tail:)?/, '')
          .replace(/^raw:(leaf:|tail:)?ext:/, '')
          .replace(/^rq\d*[_:]?/i, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();
      }

      const alias = radarVariableAliases[vKey] || cleanKey || vKey;

      let positiveCount = 0;
      papers.forEach(p => {
        const rawVals = getFieldValue(p, vKey, mappedOpts);
        const hasValidValue = rawVals.some(v => {
          const s = String(v || '').trim().toUpperCase();
          return Boolean(s) && s !== 'NOT_STATED' && s !== 'FALSE' && s !== '0' && s !== 'NONE' && s !== 'UNSPECIFIED' && s !== '[OBJECT OBJECT]';
        });
        if (hasValidValue) {
          positiveCount++;
        }
      });

      let prevalencePct = totalCohort > 0 ? Math.round((positiveCount / totalCohort) * 100) : 0;
      if (enableManualOverrides && manualCategoryValues[vKey] !== undefined) {
        prevalencePct = Math.round(manualCategoryValues[vKey]);
      } else if (enableManualOverrides && manualCategoryValues[alias] !== undefined) {
        prevalencePct = Math.round(manualCategoryValues[alias]);
      }

      const targetVal = radarVariableTargets[vKey] ?? radarVariableTargets[alias] ?? radarTargetValue ?? 100;

      let indicatorName = alias;
      if (radarIndicatorFormat === 'two_line') {
        indicatorName = `${alias}\n(${prevalencePct}%)`;
      } else if (radarIndicatorFormat === 'single_line') {
        indicatorName = `${alias} (${prevalencePct}%)`;
      } else if (radarIndicatorFormat === 'ratio_percent') {
        indicatorName = `${alias} (n=${positiveCount}/${totalCohort}, ${prevalencePct}%)`;
      } else {
        indicatorName = alias;
      }

      return {
        vKey,
        alias,
        positiveCount,
        prevalencePct,
        targetVal,
        indicatorName
      };
    });

    const indicators = varItems.map(item => ({
      name: item.indicatorName,
      max: (ctx.radarScaleMax !== undefined && ctx.radarScaleMax > 0) ? ctx.radarScaleMax : 100,
      min: ctx.radarScaleMin !== undefined ? ctx.radarScaleMin : 0
    }));

    const targetSeriesName = radarTargetName || 'Horticultural Requirement Target';
    const baselineSeriesName = (radarBaselineName || 'Empirical Cohort Baseline (n={n})').replace('{n}', String(totalCohort));
    const baselineColor = radarBaselineColor || palette.colors[0] || '#0275d8';
    const effectiveTargetColor = radarTargetColor || '#d9534f';

    const seriesData: any[] = [];

    if (radarShowTarget !== false) {
      seriesData.push({
        value: varItems.map(item => item.targetVal),
        name: targetSeriesName,
        symbol: ctx.radarTargetSymbol || 'circle',
        symbolSize: ctx.radarTargetSymbol === 'none' ? 0 : (ctx.radarTargetSymbolSize ?? 4),
        smooth: ctx.radarTargetSmooth === true ? 0.35 : false,
        label: {
          show: ctx.radarShowDataLabels === true,
          formatter: (params: any) => formatRadarDataLabel(params.value),
          position: ctx.radarDataLabelPosition || 'top',
          color: (ctx.radarDataLabelColor && ctx.radarDataLabelColor.trim() !== '') ? ctx.radarDataLabelColor : palette.text,
          fontSize: ctx.radarDataLabelFontSize ?? Math.max(9, fontSize - 3),
          fontWeight: (ctx.radarDataLabelFontWeight || 'bold') as any
        },
        lineStyle: {
          type: radarTargetLineStyle || 'dashed',
          width: radarTargetLineWidth ?? 2,
          color: effectiveTargetColor
        },
        areaStyle: {
          color: hexToRgba(effectiveTargetColor, (radarTargetAreaOpacity ?? 8) / 100)
        },
        itemStyle: {
          color: effectiveTargetColor
        }
      });
    }

    seriesData.push({
      value: varItems.map(item => item.prevalencePct),
      name: baselineSeriesName,
      symbol: ctx.radarBaselineSymbol || 'circle',
      symbolSize: ctx.radarBaselineSymbol === 'none' ? 0 : (ctx.radarBaselineSymbolSize ?? 6),
      smooth: ctx.radarSmooth === true ? 0.35 : false,
      label: {
        show: ctx.radarShowDataLabels === true,
        formatter: (params: any) => formatRadarDataLabel(params.value),
        position: ctx.radarDataLabelPosition || 'top',
        color: (ctx.radarDataLabelColor && ctx.radarDataLabelColor.trim() !== '') ? ctx.radarDataLabelColor : palette.text,
        fontSize: ctx.radarDataLabelFontSize ?? Math.max(9, fontSize - 3),
        fontWeight: (ctx.radarDataLabelFontWeight || 'bold') as any
      },
      lineStyle: {
        type: ctx.radarBaselineLineStyle || 'solid',
        width: ctx.radarLineWidth ?? 2.5,
        color: baselineColor
      },
      areaStyle: {
        color: (ctx.radarBaselineAreaColor && ctx.radarBaselineAreaColor.trim() !== '')
          ? hexToRgba(ctx.radarBaselineAreaColor, (ctx.radarAreaOpacity ?? 28) / 100)
          : hexToRgba(baselineColor, (ctx.radarAreaOpacity ?? 28) / 100)
      },
      itemStyle: {
        color: baselineColor,
        borderColor: ctx.radarBaselineSymbolBorderColor || undefined,
        borderWidth: ctx.radarBaselineSymbolBorderWidth ?? 0
      }
    });

    const radarTooltip = {
      ...baseTooltip,
      formatter: (params: any) => {
        const isTarget = params.name === targetSeriesName;
        const colorSquare = `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background-color:${isTarget ? effectiveTargetColor : baselineColor};margin-right:6px;"></span>`;
        
        let content = `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">
          <div style="font-weight:bold;color:${palette.text};border-bottom:1px solid ${palette.border};padding-bottom:4px;margin-bottom:6px;">
            ${colorSquare}${params.name}
          </div>`;

        varItems.forEach(item => {
          const val = isTarget ? item.targetVal : item.prevalencePct;
          const detail = isTarget 
            ? `${val}% Target Requirement`
            : `${val}% Empirical Prevalence (n=${item.positiveCount}/${totalCohort})`;
          content += `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
            <span style="color:${palette.subtext};">${item.alias}:</span>
            <strong style="color:${palette.text};">${detail}</strong>
          </div>`;
        });

        content += `</div>`;
        return content;
      }
    };

    const effectiveLegendFormat = ctx.legendFormat || ctx.barLegendFormat || 'name';
    const cleanSeriesDisplayName = (rawName: string) => {
      return rawName
        .replace(/,\s*[nN]\s*=\s*(\{[nN]\}|\d+|[nN])/gi, '')
        .replace(/\s*\([nN]\s*=\s*(\{[nN]\}|\d+|[nN])\s*\)/gi, '')
        .replace(/\s*\([nN]\s*=\s*\d+\s*\)/gi, '')
        .replace(/\s*\{[nN]\}\s*/gi, '')
        .trim();
    };

    const cleanBaselineName = cleanSeriesDisplayName(baselineSeriesName || 'Empirical Cohort Baseline');
    const cleanTargetName = cleanSeriesDisplayName(targetSeriesName || 'Requirement Target');

    const formattedBaselineLegend = effectiveLegendFormat === 'name'
      ? baselineSeriesName
      : formatLegendLabel(cleanBaselineName, {
          paperCount: totalCohort,
          count: totalCohort,
          percent: 100,
          prevalencePct: 100,
          totalCohortPapers: totalCohort,
          metricMode: 'paper_prevalence',
          decimalPrecision: ctx.decimalPrecision,
          useTildeForCoarse: ctx.useTildeForCoarse,
          ratioStyle: ctx.ratioStyle,
          forceCohortDenominator: ctx.forceCohortDenominator
        }, effectiveLegendFormat);

    const formattedTargetLegend = effectiveLegendFormat === 'name'
      ? targetSeriesName
      : formatLegendLabel(cleanTargetName, {
          percent: ctx.radarTargetValue ?? 100,
          count: ctx.radarTargetValue ?? 100,
          totalCohortPapers: 100,
          decimalPrecision: ctx.decimalPrecision,
          useTildeForCoarse: false,
          ratioStyle: ctx.ratioStyle,
          forceCohortDenominator: ctx.forceCohortDenominator
        }, effectiveLegendFormat);

    return {
      backgroundColor: palette.bg,
      color: radarShowTarget !== false ? [effectiveTargetColor, baselineColor, ...palette.colors] : [baselineColor, effectiveTargetColor, ...palette.colors],
      title: baseTitle,
      legend: {
        ...baseLegend,
        // For radar charts, default position to bottom if not set, preventing top vertex label collision
        top: ctx.legendPosition === 'top' ? Math.max(10, ctx.legendDistance ?? 20) : (ctx.legendPosition === 'bottom' ? undefined : (ctx.legendPosition === 'left' || ctx.legendPosition === 'right' ? 'center' : undefined)),
        bottom: (!ctx.legendPosition || ctx.legendPosition === 'bottom') ? Math.max(5, ctx.legendDistance ?? 10) : undefined,
        data: radarShowTarget !== false
          ? [
              { name: targetSeriesName, icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : undefined },
              { name: baselineSeriesName, icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : undefined }
            ]
          : [
              { name: baselineSeriesName, icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : undefined }
            ],
        formatter: (name: string) => {
          if (name === targetSeriesName) return formattedTargetLegend;
          if (name === baselineSeriesName) return formattedBaselineLegend;
          return name;
        },
        textStyle: {
          ...baseLegend.textStyle
        }
      },
      tooltip: radarTooltip,
      radar: buildRadarCoordinateConfig(indicators, 65, 48),
      series: [{
        name: 'Boundary Reporting Comparison',
        type: 'radar',
        data: seriesData
      }]
    };
  }

  // --- MODE 2: QUALITY ASSESSMENT (QA) BREAKDOWN (LEGACY) ---
  const qaKeysSet = new Set<string>();
  papers.forEach(p => {
    const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
    const qaStr = isManualDominant
      ? (p.manual_quality_assessment || p.ai_quality_assessment || '')
      : (p.ai_quality_assessment || p.manual_quality_assessment || '');
    if (qaStr) {
      try {
        const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
        const qaObj = parsed.qa_scores || parsed;
        if (typeof qaObj === 'object' && qaObj !== null) {
          Object.keys(qaObj).forEach(k => qaKeysSet.add(k));
        }
      } catch (e) {}
    }
  });

  const keysList = qaKeysSet.size > 0 ? Array.from(qaKeysSet).sort() : ['QA1', 'QA2', 'QA3', 'QA4', 'QA5', 'QA6', 'QA7', 'QA8'];

  const getQaValue = (p: any, key: string): number => {
    const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
    const qaStr = isManualDominant
      ? (p.manual_quality_assessment || p.ai_quality_assessment || '')
      : (p.ai_quality_assessment || p.manual_quality_assessment || '');
    if (!qaStr) return 0;
    try {
      const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
      const qaObj = parsed.qa_scores || parsed;
      const v = qaObj[key];
      const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
      const num = parseFloat(String(val));
      if (!isNaN(num)) return num;
      if (['YES', 'PASS', 'TRUE'].includes(String(val).toUpperCase())) return 1;
    } catch (e) {}
    return 0;
  };

  const indicators = keysList.map(k => ({
    name: k,
    max: (ctx.radarScaleMax !== undefined && ctx.radarScaleMax > 0) ? ctx.radarScaleMax : 1.0,
    min: ctx.radarScaleMin !== undefined ? ctx.radarScaleMin : 0
  }));

  const countsMap = new Map<string, any[]>();
  papers.forEach(p => {
    const vals = getMappedFieldValue(p, primaryField, mappedOpts);
    vals.forEach(v => {
      if (!countsMap.has(v)) countsMap.set(v, []);
      countsMap.get(v)!.push(p);
    });
  });

  const activeCountsMap = limitCategoryMap(countsMap, limitCategories, maxCategoriesCount, list => list.length, ctx.otherCategoryLabel || 'Other');

  const seriesData = Array.from(activeCountsMap.entries()).map(([catName, pList]) => {
    const avgScores = keysList.map(k => {
      if (pList.length === 0) return 0;
      let sum = 0;
      pList.forEach(p => sum += getQaValue(p, k));
      return parseFloat((sum / pList.length).toFixed(2));
    });
    return {
      name: catName,
      value: avgScores,
      smooth: ctx.radarSmooth === true ? 0.35 : false
    };
  });

  const effectiveLegendFormat = ctx.legendFormat || ctx.barLegendFormat || 'name';

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      ...baseLegend,
      data: seriesData.map(s => ({
        name: s.name,
        icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : undefined
      })),
      formatter: (name: string) => {
        const pList = activeCountsMap.get(name) || [];
        return formatLegendLabel(name, {
          paperCount: pList.length,
          count: pList.length,
          percent: totalCohort > 0 ? Math.round((pList.length / totalCohort) * 100) : 0,
          totalCohortPapers: totalCohort,
          decimalPrecision: ctx.decimalPrecision,
          useTildeForCoarse: ctx.useTildeForCoarse,
          ratioStyle: ctx.ratioStyle,
          forceCohortDenominator: ctx.forceCohortDenominator
        }, effectiveLegendFormat);
      },
      textStyle: {
        ...baseLegend.textStyle
      }
    },
    tooltip: baseTooltip,
    radar: buildRadarCoordinateConfig(indicators, 65, 55),
    series: [{
      type: 'radar',
      data: seriesData,
      symbolSize: ctx.radarBaselineSymbol === 'none' ? 0 : (ctx.radarBaselineSymbolSize ?? 6),
      symbol: ctx.radarBaselineSymbol || 'circle',
      label: {
        show: ctx.radarShowDataLabels === true,
        formatter: (params: any) => formatRadarDataLabel(params.value),
        position: ctx.radarDataLabelPosition || 'top',
        color: (ctx.radarDataLabelColor && ctx.radarDataLabelColor.trim() !== '') ? ctx.radarDataLabelColor : palette.text,
        fontSize: ctx.radarDataLabelFontSize ?? Math.max(9, fontSize - 3),
        fontWeight: (ctx.radarDataLabelFontWeight || 'bold') as any
      },
      lineStyle: {
        type: ctx.radarBaselineLineStyle || 'solid',
        width: ctx.radarLineWidth ?? 2.5
      },
      areaStyle: { opacity: (ctx.radarAreaOpacity ?? 28) / 100 }
    } as any]
  };
}

export function generateFunnelOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    renderCategoryTooltip,
    primaryField,
    metricMode,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    enableManualOverrides,
    manualCategoryValues,
    customSliceColors,
    showDataLabels,
    showLegend,
    umbrellanizerMap
  } = ctx;

  const countsMap = new Map<string, any[]>();
  let totalExtractedTags = 0;

  const mappedOpts = {
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    primaryField
  };

  papers.forEach(p => {
    const vals = getMappedFieldValue(p, primaryField, mappedOpts);
    vals.forEach(v => {
      totalExtractedTags++;
      if (!countsMap.has(v)) countsMap.set(v, []);
      countsMap.get(v)!.push(p);
    });
  });

  const activeCountsMap = limitCategoryMap(
    countsMap,
    limitCategories,
    maxCategoriesCount,
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags),
    ctx.otherCategoryLabel || 'Other'
  );

  const funnelData = Array.from(activeCountsMap.entries()).map(([cat, pList], idx) => {
    const tagCount = pList.length;
    const uniquePaperIds = new Set(pList.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    const paperCount = uniquePaperIds.size;
    const realVal = computeMetricValue(pList, metricMode, papers.length, totalExtractedTags);
    const manualVal = manualCategoryValues[cat];
    const val = (enableManualOverrides && manualVal !== undefined) ? manualVal : realVal;
    const color = customSliceColors[cat] || getNodeColor(cat, undefined, idx, palette.colors, customSliceColors);
    const prevalencePct = papers.length > 0 ? ((paperCount / papers.length) * 100).toFixed(2) : '0.00';
    const tagPct = totalExtractedTags > 0 ? ((tagCount / totalExtractedTags) * 100).toFixed(2) : '0.00';

    return {
      name: cat,
      value: val,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct,
      itemStyle: { color }
    };
  }).sort((a, b) => b.value - a.value);

  const funnelDataMap = new Map(funnelData.map(d => [d.name, d]));
  const effectiveLabelPosition = (ctx as any).funnelLabelPosition || (ctx.universalLabelPosition === 'outside' || ctx.universalLabelPosition === 'right' || ctx.universalLabelPosition === 'left' ? ctx.universalLabelPosition : 'inside');
  const labelFSize = ctx.universalLabelFontSize ?? (ctx.funnelLabelFontSize ?? Math.max(10, fontSize - 1));
  const labelFWeight = (ctx.universalLabelFontWeight || ctx.funnelLabelFontWeight || 'bold') as any;
  const labelFStyle = (ctx.universalLabelFontStyle || ctx.funnelLabelFontStyle || 'normal') as any;
  const labelColor = ctx.universalLabelColor || ctx.funnelLabelColor || (effectiveLabelPosition === 'inside' ? '#ffffff' : palette.text);
  const minThresh = ctx.universalLabelMinThreshold ?? 0;
  const showZero = ctx.universalLabelShowZero ?? true;

  const funnelLabelConfig: any = {
    show: showDataLabels,
    position: effectiveLabelPosition,
    fontFamily: font,
    fontSize: labelFSize,
    fontWeight: labelFWeight,
    fontStyle: labelFStyle,
    color: labelColor,
    distance: ctx.universalLabelDistance ?? 6,
    width: ctx.universalMaxLabelWidth,
    overflow: ctx.universalLabelOverflow || 'break',
    lineHeight: ctx.universalLabelLineHeight,
    formatter: (params: any) => {
      const item = funnelDataMap.get(params?.name) || params?.data;
      if (!item) return params?.name || '';
      if (!showZero && (item.paperCount === 0 || item.value === 0)) return '';
      if (minThresh > 0) {
        const rawPct = parseFloat(item.prevalencePct ?? '0');
        if (!isNaN(rawPct) && rawPct < minThresh) return '';
      }

      const effectiveLabelFormat = ctx.labelFormat || 'name_ratio_percent';
      return formatMetricDisplay({
        name: params.name,
        val: item.value,
        count: item.value,
        paperCount: item.paperCount,
        tagCount: item.tagCount,
        totalCohortPapers: papers.length,
        totalExtractedTags,
        metricMode,
        prevalencePct: item.prevalencePct,
        tagSharePct: item.tagPct,
        template: effectiveLabelFormat,
        decimalPrecision: ctx.decimalPrecision,
        useTildeForCoarse: ctx.useTildeForCoarse,
        ratioStyle: ctx.ratioStyle,
        forceCohortDenominator: ctx.forceCohortDenominator
      });
    }
  };

  const hasVisibleTitle = Boolean(baseTitle && (baseTitle as any).show !== false);
  const effectiveFunnelLegendPos = String(ctx.legendPosition || 'top');
  const defaultTopOffset = showLegend && effectiveFunnelLegendPos === 'top'
    ? (hasVisibleTitle ? 95 : 65)
    : (hasVisibleTitle ? 60 : 30);
  const defaultBottomOffset = showLegend && effectiveFunnelLegendPos === 'bottom'
    ? Math.max(50, (ctx.legendDistance ?? 10) + 45)
    : '10%';
  const defaultLeftOffset = showLegend && effectiveFunnelLegendPos === 'left' ? '25%' : '15%';
  const defaultRightOffset = showLegend && effectiveFunnelLegendPos === 'right' ? '25%' : '15%';

  const rawTopOffset = ctx.gridMarginTop !== undefined ? ctx.gridMarginTop : defaultTopOffset;
  const rawBottomOffset = ctx.gridMarginBottom !== undefined ? ctx.gridMarginBottom : defaultBottomOffset;
  const rawLeftOffset = ctx.gridMarginLeft !== undefined ? ctx.gridMarginLeft : defaultLeftOffset;
  const rawRightOffset = ctx.gridMarginRight !== undefined ? ctx.gridMarginRight : defaultRightOffset;

  const offX = ctx.fitOffsetX ?? 0;
  const offY = ctx.fitOffsetY ?? 0;

  const applyOffsetWithPan = (rawOffset: number | string, panPx: number, isAddition: boolean) => {
    if (typeof rawOffset === 'number') {
      return Math.max(0, isAddition ? rawOffset + panPx : rawOffset - panPx);
    }
    const str = String(rawOffset);
    if (str.endsWith('%')) {
      const val = parseFloat(str);
      const shiftPct = Math.round(panPx * 0.1);
      return `${Math.max(0, isAddition ? val + shiftPct : val - shiftPct)}%`;
    }
    return rawOffset;
  };

  const topOffset = applyOffsetWithPan(rawTopOffset, offY, false);
  const bottomOffset = applyOffsetWithPan(rawBottomOffset, offY, true);
  const leftOffset = applyOffsetWithPan(rawLeftOffset, offX, false);
  const rightOffset = applyOffsetWithPan(rawRightOffset, offX, true);

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      ...baseLegend,
      data: funnelData.map(d => d.name),
      formatter: (name: string) => {
        const item = funnelDataMap.get(name);
        if (!item) return name;
        return formatLegendLabel(name, {
          paperCount: item.paperCount,
          tagCount: item.tagCount,
          count: item.value,
          prevalencePct: item.prevalencePct,
          tagSharePct: item.tagPct,
          totalCohortPapers: papers.length,
          totalExtractedTags,
          metricMode,
          decimalPrecision: ctx.decimalPrecision,
          useTildeForCoarse: ctx.useTildeForCoarse,
          ratioStyle: ctx.ratioStyle,
          forceCohortDenominator: ctx.forceCohortDenominator
        }, ctx.legendFormat);
      }
    },
    tooltip: {
      ...baseTooltip,
      formatter: (params: any) => {
        return renderCategoryTooltip(params?.data, params?.name);
      }
    },
    series: [{
      name: primaryField,
      type: 'funnel',
      left: leftOffset,
      right: rightOffset,
      top: topOffset,
      bottom: bottomOffset,
      sort: 'descending',
      funnelAlign: ctx.funnelAlign || 'center',
      gap: ctx.funnelGap ?? 2,
      width: `${100 - (ctx.funnelNeckWidth ? 100 - ctx.funnelNeckWidth : 30)}%`,
      minSize: `${ctx.funnelNeckWidth ?? 30}%`,
      maxSize: '100%',
      label: funnelLabelConfig,
      data: funnelData
    }]
  };
}

export function generateGaugeOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    metricMode,
    gaugeMaxScale
  } = ctx;

  let metricValue = 0;
  const maxTarget = gaugeMaxScale || 100;
  let gaugeTitle = 'Cohort Metric';

  if (metricMode === 'avg_qa') {
    const sum = papers.reduce((acc, p) => acc + extractNumericalValue(p, 'Overall_QA'), 0);
    const avg = papers.length > 0 ? sum / papers.length : 0;
    metricValue = parseFloat(((avg / 8) * maxTarget).toFixed(2));
    gaugeTitle = `Avg QA Score (${avg.toFixed(2)} / 8.00)`;
  } else if (metricMode === 'avg_citation') {
    const sum = papers.reduce((acc, p) => acc + (parseFloat(String(p.citation_count ?? 0)) || 0), 0);
    const avg = papers.length > 0 ? sum / papers.length : 0;
    metricValue = parseFloat(avg.toFixed(2));
    gaugeTitle = `Avg Citation Count (${avg.toFixed(2)})`;
  } else {
    const downloaded = papers.filter(p => String(p.Local_PDF_Status || '').toLowerCase().includes('download')).length;
    metricValue = papers.length > 0 ? parseFloat(((downloaded / papers.length) * maxTarget).toFixed(2)) : 0;
    gaugeTitle = `PDF Download Ratio (${downloaded}/${papers.length})`;
  }

  const dialW = ctx.gaugeDialWidth ?? 14;

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    series: [{
      type: 'gauge',
      center: [`${50 + (ctx.fitOffsetX ?? 0)}%`, `${60 + (ctx.fitOffsetY ?? 0)}%`],
      radius: `${Math.max(30, 75 - Math.round(((ctx.containerPadding ?? 12) - 12) * 0.4))}%`,
      startAngle: ctx.gaugeStartAngle ?? 225,
      endAngle: ctx.gaugeEndAngle ?? -45,
      min: 0,
      max: maxTarget,
      progress: { show: true, width: dialW },
      axisLine: { lineStyle: { width: dialW, color: [[1, palette.border]] } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { width: 2, color: palette.text } },
      axisLabel: { fontFamily: font, fontSize: fontSize - 2, color: palette.text, distance: 15 },
      pointer: { width: ctx.gaugePointerWidth ?? 6 },
      title: { show: true, offsetCenter: [0, '70%'], fontFamily: font, fontSize: fontSize, color: palette.text },
      detail: { valueAnimation: true, formatter: '{value}%', offsetCenter: [0, '40%'], fontFamily: font, fontSize: fontSize + 6, fontWeight: 'bold', color: palette.text },
      data: [{ value: metricValue, name: gaugeTitle }]
    }]
  };
}

export function generateGraphOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    primaryField,
    secondaryField,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    showLegend,
    showDataLabels,
    baseTooltip,
    customCategoryMap,
    levelCustomGroupLinks,
    umbrellanizerMap
  } = ctx;

  const mappedOpts = { 
    useUmbrellanizer, 
    umbrellanizerMap, 
    splitMultiValues, 
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks
  };

  const countsP = new Map<string, any[]>();
  const countsS = new Map<string, any[]>();

  papers.forEach(p => {
    getMappedFieldValue(p, primaryField, { ...mappedOpts, primaryField, subFieldKey: secondaryField }).forEach(v => {
      if (!countsP.has(v)) countsP.set(v, []);
      countsP.get(v)!.push(p);
    });
    getMappedFieldValue(p, secondaryField, { ...mappedOpts, primaryField: secondaryField }).forEach(v => {
      if (!countsS.has(v)) countsS.set(v, []);
      countsS.get(v)!.push(p);
    });
  });

  const effectiveOtherLabel = ctx.otherCategoryLabel || 'Other';
  const activeCountsP = limitCategoryMap(countsP, limitCategories, maxCategoriesCount, list => list.length, effectiveOtherLabel);
  const activeCountsS = limitCategoryMap(countsS, limitCategories, maxCategoriesCount, list => list.length, effectiveOtherLabel);

  const nodesMap = new Map<string, { name: string; category: number }>();
  const linksMap = new Map<string, number>();

  papers.forEach(p => {
    const rawP = getMappedFieldValue(p, primaryField, { ...mappedOpts, primaryField, subFieldKey: secondaryField });
    const rawS = getMappedFieldValue(p, secondaryField, { ...mappedOpts, primaryField: secondaryField });

    const mappedP = Array.from(new Set(rawP.map(v => activeCountsP.has(v) ? v : effectiveOtherLabel)));
    const mappedS = Array.from(new Set(rawS.map(v => activeCountsS.has(v) ? v : effectiveOtherLabel)));

    const primLabel = formatVariableDisplayName(primaryField);
    const secLabel = formatVariableDisplayName(secondaryField);

    mappedP.forEach(pv => {
      const n1 = `[${primLabel}] ${pv}`;
      if (!nodesMap.has(n1)) nodesMap.set(n1, { name: n1, category: 0 });

      mappedS.forEach(sv => {
        const n2 = `[${secLabel}] ${sv}`;
        if (!nodesMap.has(n2)) nodesMap.set(n2, { name: n2, category: 1 });

        const edgeKey = `${n1}--->${n2}`;
        linksMap.set(edgeKey, (linksMap.get(edgeKey) || 0) + 1);
      });
    });
  });

  const primLabel = formatVariableDisplayName(primaryField);
  const secLabel = formatVariableDisplayName(secondaryField);

  const graphNodes = Array.from(nodesMap.values()).map(n => ({
    name: n.name,
    category: n.category,
    symbolSize: 20
  }));

  const graphLinks = Array.from(linksMap.entries()).map(([k, val]) => {
    const [source, target] = k.split('--->');
    return { source, target, value: val, lineStyle: { width: Math.min(10, Math.max(1, val)) } };
  });

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      ...baseLegend,
      data: [primLabel, secLabel]
    },
    tooltip: { ...baseTooltip, formatter: (p: any) => p.dataType === 'edge' ? `${p.data.source} → ${p.data.target}: ${p.data.value} papers` : p.name },
    series: [{
      type: 'graph',
      layout: 'force',
      force: { 
        repulsion: ctx.graphRepulsion ?? 120, 
        edgeLength: ctx.graphEdgeLength ?? 90,
        gravity: ctx.graphGravity ?? 0.1
      },
      roam: true,
      label: {
        show: showDataLabels,
        fontFamily: font,
        fontSize: ctx.universalLabelFontSize ?? Math.max(9, fontSize - 2),
        fontWeight: (ctx.universalLabelFontWeight || 'normal') as any,
        fontStyle: (ctx.universalLabelFontStyle || 'normal') as any,
        color: ctx.universalLabelColor || palette.text,
        position: (ctx.universalLabelPosition === 'inside' ? 'inside' : (ctx.universalLabelPosition && ctx.universalLabelPosition !== 'auto' ? ctx.universalLabelPosition : 'right')) as any,
        distance: ctx.universalLabelDistance ?? 5
      },
      edgeLabel: {
        show: ctx.graphShowLinkWeights ?? false,
        fontFamily: font,
        fontSize: Math.max(8, fontSize - 3),
        color: palette.subtext || palette.text,
        formatter: (p: any) => `${p.data?.value ?? ''}`
      },
      categories: [{ name: primLabel }, { name: secLabel }],
      data: graphNodes,
      links: graphLinks,
      lineStyle: { color: 'source', curveness: ctx.graphCurveness ?? 0.2 }
    }]
  };
}
