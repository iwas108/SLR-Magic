import type * as echarts from 'echarts';
import { getNodeColor, getContrastingTextColor, generateDistinctPalette, hexToRgba, createVerticalGradient, createHorizontalGradient, resolvePaletteAccent } from '../utils/colorUtils';
import { 
  getFieldValue, 
  getMappedFieldValue, 
  computeMetricValue, 
  limitCategoryMap,
  extractCleanTaxonomyKey,
  formatVariableDisplayName
} from '../utils/dataExtractor';
import { extractTokenPaths } from '@/lib/services/cohort-data-source';
import { filterValuesForParent } from './hierarchicalGenerators';
import { getSeriesPatternStyle } from '../utils/hatchPatternUtils';
import { computeGroupStatistics, getErrorBounds } from '../utils/statisticalUtils';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';
import { formatMetricDisplay, formatPercentage } from '../utils/formatterUtils';
import { calculateHareHamiltonPercentages } from '@/lib/services/cohort-metrics';
import { buildScientificAxisConfig, calculateNiceScientificCeiling, resolveUniversalGrid } from './axisConfigHelper';

export function generateVerticalBarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
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
    manualCategoryValues = {},
    customSliceColors = {},
    showLegend,
    labelRotation,
    showDataLabels,
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
    levelCustomGroups: ctx.levelCustomGroups,
    levelCustomGroupLinks,
    levelTargetFields: ctx.levelTargetFields,
    scopeFilter: ctx.primaryScopeFilter,
    unpackMacroToChildren: true,
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

  const isOther = (cat: string) => cat === (ctx.otherCategoryLabel || 'Other') || cat === 'Other';

  let categories = Array.from(activeCountsMap.keys());
  if (excludeEmpty || (ctx as any).excludeUnassigned) {
    categories = categories.filter(c => c !== 'Unassigned / Other' && c !== 'Unassigned');
  }
  if (ctx.barSorting === 'desc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const valA = computeMetricValue(activeCountsMap.get(a)!, metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(activeCountsMap.get(b)!, metricMode, papers.length, totalExtractedTags);
      return valB - valA;
    });
  } else if (ctx.barSorting === 'asc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const valA = computeMetricValue(activeCountsMap.get(a)!, metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(activeCountsMap.get(b)!, metricMode, papers.length, totalExtractedTags);
      return valA - valB;
    });
  } else {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }

  const effectiveLabelFormat = ctx.labelFormat || ctx.barLabelFormat || 'ratio_percent';

  const distinctPalette = generateDistinctPalette(palette.colors, categories.length);
  const valuesData = categories.map((cat, idx) => {
    const pList = activeCountsMap.get(cat)!;
    const tagCount = pList.length;
    const uniquePaperIds = new Set(pList.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    const paperCount = uniquePaperIds.size;
    const realVal = computeMetricValue(pList, metricMode, papers.length, totalExtractedTags);
    const manualVal = (manualCategoryValues || {})[cat];
    const val = (enableManualOverrides && manualVal !== undefined) ? manualVal : realVal;
    const color = (customSliceColors || {})[cat] || distinctPalette[idx] || getNodeColor(cat, undefined, idx, palette.colors, customSliceColors);
    const prevalencePct = papers.length > 0 ? ((paperCount / papers.length) * 100).toFixed(2) : '0.00';
    const tagPct = totalExtractedTags > 0 ? ((tagCount / totalExtractedTags) * 100).toFixed(2) : '0.00';

    const formattedLabel = formatMetricDisplay({
      name: cat,
      val,
      count: val,
      paperCount,
      tagCount,
      totalCohortPapers: papers.length,
      totalExtractedTags,
      metricMode,
      prevalencePct,
      tagSharePct: tagPct,
      template: effectiveLabelFormat,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    });

    const patternStyle = getSeriesPatternStyle(idx, color, ctx.enableHatchPatterns ?? false);
    const rad = ctx.barBorderRadius ?? 4;
    const isHatching = Boolean(ctx.enableHatchPatterns);
    const fillStyle = isHatching
      ? patternStyle
      : {
          color: createVerticalGradient(color, 1, 0.84),
          borderColor: hexToRgba(color, 0.9),
          borderWidth: 0.5
        };

    return {
      name: cat,
      value: val,
      color,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct,
      formattedLabel,
      itemStyle: {
        ...fillStyle,
        borderRadius: [rad, rad, 0, 0]
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: hexToRgba(color, 0.35)
        }
      }
    };
  });

  const effectiveLegendFormat = ctx.legendFormat || ctx.barLegendFormat || 'name';
  const legendData = categories.map((cat, idx) => {
    const itemData = valuesData[idx];
    const label = formatLegendLabel(cat, {
      paperCount: itemData.paperCount,
      tagCount: itemData.tagCount,
      count: itemData.value,
      percent: itemData.prevalencePct,
      prevalencePct: itemData.prevalencePct,
      tagSharePct: itemData.tagPct,
      totalCohortPapers: papers.length,
      totalExtractedTags,
      metricMode,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    }, effectiveLegendFormat);
    return {
      name: label,
      icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : 'roundRect',
      itemStyle: {
        color: itemData.color
      }
    };
  });

  const grid = resolveUniversalGrid(ctx, { top: 45, bottom: 45, left: 55, right: 45 });

  const labelPos = ctx.universalLabelPosition && ctx.universalLabelPosition !== 'auto' 
    ? (ctx.universalLabelPosition === 'outside' ? 'top' : ctx.universalLabelPosition)
    : (ctx.barLabelPosition || 'top');
  const labelDist = ctx.universalLabelDistance ?? ctx.barLabelDistance ?? 5;
  const labelRot = ctx.universalLabelRotate ?? ctx.barLabelRotate ?? 0;
  const labelFSize = ctx.universalLabelFontSize ?? ctx.barLabelFontSize ?? Math.max(9, fontSize - 2);
  const labelFWeight = (ctx.universalLabelFontWeight || ctx.barLabelFontWeight || 'bold') as any;
  const labelFStyle = (ctx.universalLabelFontStyle || ctx.barLabelFontStyle || 'normal') as any;
  const labelLHeight = ctx.universalLabelLineHeight ?? ctx.barLabelLineHeight ?? (labelFSize + 3);
  const minThresh = ctx.universalLabelMinThreshold ?? ctx.barLabelMinThreshold ?? 0;
  const showZero = ctx.universalLabelShowZero ?? ctx.barLabelShowZero ?? true;

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: showLegend ? {
      ...baseLegend,
      data: legendData
    } : { show: false },
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return renderCategoryTooltip(p?.data, p?.name);
      }
    },
    grid,
    xAxis: buildScientificAxisConfig('x', ctx, {
      axisKind: 'category',
      defaultTitle: primaryField,
      categories: categories
    }),
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'value',
      defaultTitle: metricMode === 'paper_prevalence'
        ? 'Prevalence (% of Cohort)'
        : metricMode === 'tag_share'
        ? 'Tag Share (%)'
        : metricMode === 'avg_qa'
        ? 'Average QA Score'
        : metricMode === 'avg_citation'
        ? 'Average Citation Count'
        : 'Study Count (N)',
      max: (typeof ctx.barValueCeiling === 'number' && ctx.barValueCeiling > 0)
        ? ctx.barValueCeiling
        : (val: any) => {
            if (!val || val.max === 0) return (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? 10 : 5;
            const neededMax = showDataLabels ? val.max * 1.18 : val.max;
            return calculateNiceScientificCeiling(neededMax, metricMode === 'paper_prevalence' || metricMode === 'tag_share');
          },
      interval: (typeof ctx.barValueInterval === 'number' && ctx.barValueInterval > 0) ? ctx.barValueInterval : undefined,
      defaultUnitFormatter: (v: any) => (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? `${v}%` : `${v}`
    }),
    series: (() => {
      const benchmarkColor = ctx.barBenchmarkColor || palette.accent || palette.colors[1] || '#ef4444';
      const markLine = ctx.barBenchmarkLine ? {
        symbol: 'none',
        lineStyle: {
          type: ctx.barBenchmarkStyle || 'dashed',
          color: benchmarkColor,
          width: 2
        },
        label: {
          show: true,
          position: 'end' as const,
          formatter: `${ctx.barBenchmarkLabel || 'Target Benchmark'} (${ctx.barBenchmarkValue}${(metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? '%' : ''})`,
          fontFamily: font,
          fontSize: Math.max(9, fontSize - 2),
          color: benchmarkColor,
          fontWeight: 'bold' as const
        },
        data: [{ yAxis: ctx.barBenchmarkValue }]
      } : undefined;

      let errorBarSeries: any = null;
      if (ctx.enableErrorBars && (metricMode === 'avg_qa' || metricMode === 'avg_citation')) {
        const numTargetKey = metricMode === 'avg_qa' ? 'Overall_QA' : 'citation_count';
        const errData: any[] = [];
        categories.forEach((cat, cIdx) => {
          const pList = activeCountsMap.get(cat) || [];
          const statsObj = computeGroupStatistics(pList, numTargetKey);
          const bounds = getErrorBounds(statsObj, ctx.errorBarType || 'std_error');
          errData.push([cIdx, bounds.lower, bounds.upper]);
        });

        errorBarSeries = {
          name: 'Error Bounds',
          type: 'custom',
          renderItem: (params: any, api: any) => {
            const xValue = api.value(0);
            const lowPoint = api.coord([xValue, api.value(1)]);
            const highPoint = api.coord([xValue, api.value(2)]);
            const halfWidth = 5;
            const strokeColor = palette.text;
            return {
              type: 'group',
              children: [
                {
                  type: 'line',
                  shape: { x1: lowPoint[0], y1: lowPoint[1], x2: highPoint[0], y2: highPoint[1] },
                  style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
                },
                {
                  type: 'line',
                  shape: { x1: lowPoint[0] - halfWidth, y1: lowPoint[1], x2: lowPoint[0] + halfWidth, y2: lowPoint[1] },
                  style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
                },
                {
                  type: 'line',
                  shape: { x1: highPoint[0] - halfWidth, y1: highPoint[1], x2: highPoint[0] + halfWidth, y2: highPoint[1] },
                  style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
                }
              ]
            };
          },
          data: errData,
          z: 10
        };
      }

      return [
        {
          name: metricMode.replace(/_/g, ' ').toUpperCase(),
          type: 'bar',
          barWidth: ctx.barThickness,
          barCategoryGap: `${ctx.barGap}%`,
          data: valuesData,
          markLine,
          label: {
            show: showDataLabels,
            position: labelPos as any,
            distance: labelDist,
            rotate: labelRot,
            fontFamily: font,
            fontSize: labelFSize,
            fontWeight: labelFWeight,
            fontStyle: labelFStyle,
            lineHeight: labelLHeight,
            color: ctx.universalLabelColor || ctx.barLabelColor 
              ? (ctx.universalLabelColor === 'foreground' ? palette.text : (ctx.universalLabelColor || ctx.barLabelColor))
              : palette.text,
            formatter: (params: any) => {
              if (!showZero && (params.data?.paperCount === 0 || params.value === 0)) {
                return '';
              }
              if (minThresh > 0) {
                const rawPct = parseFloat(params.data?.prevalencePct ?? '0');
                if (!isNaN(rawPct) && rawPct < minThresh) return '';
              }
              return params.data?.formattedLabel ?? params.value;
            }
          }
        },
        ...(errorBarSeries ? [errorBarSeries] : []),
        ...(showLegend ? [{
          type: 'pie' as const,
          radius: [0, 0],
          silent: true,
          label: { show: false },
          labelLine: { show: false },
          data: legendData
        }] : [])
      ];
    })()
  };
}

export function generateHorizontalBarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
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
    showLegend,
    showDataLabels,
    barSorting,
    barThickness,
    barBorderRadius,
    barGap,
    barLabelPosition,
    barLabelFormat,
    barYAxisWidth,
    barYAxisOverflow,
    barLineHeight,
    barYAxisFontSize,
    barBenchmarkLine,
    barBenchmarkValue,
    barBenchmarkLabel,
    barBenchmarkStyle,
    barBenchmarkColor,
    barLegendFormat,
    barLegendPosition,
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
    levelCustomGroups: ctx.levelCustomGroups,
    levelCustomGroupLinks,
    levelTargetFields: ctx.levelTargetFields,
    scopeFilter: ctx.primaryScopeFilter,
    unpackMacroToChildren: true,
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

  const isOther = (cat: string) => cat === (ctx.otherCategoryLabel || 'Other') || cat === 'Other';

  let categories = Array.from(activeCountsMap.keys());
  if (excludeEmpty || (ctx as any).excludeUnassigned) {
    categories = categories.filter(c => c !== 'Unassigned / Other' && c !== 'Unassigned');
  }
  if (barSorting === 'desc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const valA = computeMetricValue(activeCountsMap.get(a)!, metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(activeCountsMap.get(b)!, metricMode, papers.length, totalExtractedTags);
      return valB - valA;
    });
  } else if (barSorting === 'asc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const valA = computeMetricValue(activeCountsMap.get(a)!, metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(activeCountsMap.get(b)!, metricMode, papers.length, totalExtractedTags);
      return valA - valB;
    });
  } else {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }

  const distinctPalette = generateDistinctPalette(palette.colors, categories.length);
  const valuesData = categories.map((cat, idx) => {
    const groupPapers = activeCountsMap.get(cat) || [];
    const tagCount = groupPapers.length;
    const uniquePaperIds = new Set(groupPapers.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    const paperCount = uniquePaperIds.size;
    const realVal = computeMetricValue(groupPapers, metricMode, papers.length, totalExtractedTags);
    const manualVal = manualCategoryValues[cat];
    const val = (enableManualOverrides && manualVal !== undefined) ? manualVal : realVal;
    const color = customSliceColors[cat] || distinctPalette[idx] || getNodeColor(cat, undefined, idx, palette.colors, customSliceColors);
    const prevalencePct = papers.length > 0 ? ((paperCount / papers.length) * 100).toFixed(2) : '0.00';
    const tagPct = totalExtractedTags > 0 ? ((tagCount / totalExtractedTags) * 100).toFixed(2) : '0.00';

    const activePctStr = metricMode === 'tag_share'
      ? ((enableManualOverrides && manualVal !== undefined) ? `${typeof manualVal === 'number' ? manualVal.toFixed(2) : manualVal}` : tagPct)
      : ((enableManualOverrides && manualVal !== undefined) ? `${typeof manualVal === 'number' ? manualVal.toFixed(2) : manualVal}` : prevalencePct);

    const isPctMetric = metricMode === 'paper_prevalence' || metricMode === 'tag_share';
    const effectiveLabelFormat = barLabelFormat || ctx.labelFormat || 'ratio_percent';

    const formattedLabel = formatMetricDisplay({
      name: cat,
      val,
      count: val,
      paperCount,
      tagCount,
      totalCohortPapers: papers.length,
      totalExtractedTags,
      metricMode,
      prevalencePct,
      tagSharePct: tagPct,
      activePct: activePctStr,
      template: effectiveLabelFormat,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    });

    const patternStyle = getSeriesPatternStyle(idx, color, ctx.enableHatchPatterns ?? false);
    const isHatching = Boolean(ctx.enableHatchPatterns);
    const fillStyle = isHatching
      ? patternStyle
      : {
          color: createHorizontalGradient(color, 1, 0.84),
          borderColor: hexToRgba(color, 0.9),
          borderWidth: 0.5
        };

    return {
      name: cat,
      value: val,
      color,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct,
      activePctStr,
      formattedLabel,
      itemStyle: {
        ...fillStyle,
        borderRadius: [0, barBorderRadius, barBorderRadius, 0]
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: hexToRgba(color, 0.35)
        }
      }
    };
  });

  const effectiveLegendFormat = barLegendFormat || ctx.legendFormat || 'name';
  const legendData = categories.map((cat, idx) => {
    const itemData = valuesData[idx];
    const label = formatLegendLabel(cat, {
      paperCount: itemData.paperCount,
      tagCount: itemData.tagCount,
      count: itemData.value,
      percent: itemData.activePctStr,
      prevalencePct: itemData.prevalencePct,
      tagSharePct: itemData.tagPct,
      totalCohortPapers: papers.length,
      totalExtractedTags,
      metricMode,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    }, effectiveLegendFormat);
    return {
      name: label,
      icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : 'roundRect',
      itemStyle: {
        color: itemData.color
      }
    };
  });

  const legDist = ctx.legendDistance ?? 20;
  const resolvedPosKey = ctx.legendPosition || barLegendPosition || 'bottom';
  const isTop = resolvedPosKey === 'top' || resolvedPosKey.startsWith('top');
  const isBottom = resolvedPosKey === 'bottom' || resolvedPosKey.startsWith('bottom');
  const isLeft = resolvedPosKey === 'left';
  const isRight = resolvedPosKey === 'right';

  const legendPosMap: Record<string, any> = {
    'top': { top: (baseTitle?.show ? 55 : 15) + legDist, left: 'center' },
    'bottom': { bottom: legDist, left: 'center' },
    'left': { left: legDist, top: 'middle' },
    'right': { right: legDist, top: 'middle' },
    'top-left': { top: 15, left: legDist },
    'top-center': { top: legDist, left: 'center' },
    'top-right': { top: 15, right: legDist },
    'bottom-left': { bottom: 15, left: legDist },
    'bottom-center': { bottom: legDist, left: 'center' },
    'bottom-right': { bottom: 15, right: legDist }
  };

  const legendPos = legendPosMap[resolvedPosKey] || { bottom: legDist, left: 'center' };
  const legendOrient = (isLeft || isRight) ? 'vertical' : 'horizontal';

  const benchmarkColor = barBenchmarkColor || palette.accent || palette.colors[1] || '#ef4444';
  const markLine = barBenchmarkLine ? {
    symbol: 'none',
    lineStyle: {
      type: barBenchmarkStyle,
      color: benchmarkColor,
      width: 2
    },
    label: {
      show: true,
      position: 'end' as const,
      formatter: `${barBenchmarkLabel || 'Target Benchmark'} (${barBenchmarkValue}${(metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? '%' : ''})`,
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 2),
      color: benchmarkColor,
      fontWeight: 'bold' as const
    },
    data: [{ xAxis: barBenchmarkValue }]
  } : undefined;

  const isLabelOutside = showDataLabels && (!barLabelPosition || (barLabelPosition as string) === 'right' || (barLabelPosition as string) === 'outside' || !barLabelPosition.startsWith('inside'));
  const maxLabelLength = valuesData.reduce((max, d) => Math.max(max, String(d.formattedLabel || '').length), 0);
  const headroomFactor = maxLabelLength >= 40 ? 1.60 : maxLabelLength >= 25 ? 1.42 : maxLabelLength >= 14 ? 1.25 : 1.15;

  const yWidth = barYAxisWidth || 140;
  let defGridTop = 40;
  let defGridBottom = 35;
  let defGridLeft = Math.max(90, Math.min(220, yWidth + 16));
  let defGridRight = isLabelOutside ? Math.max(80, Math.min(160, Math.round(maxLabelLength * 2.6))) : 65;

  const grid = resolveUniversalGrid(ctx, {
    top: defGridTop,
    bottom: defGridBottom,
    left: defGridLeft,
    right: defGridRight
  });

  const labelPos = ctx.universalLabelPosition && ctx.universalLabelPosition !== 'auto'
    ? (ctx.universalLabelPosition === 'outside' ? 'right' : ctx.universalLabelPosition)
    : barLabelPosition;
  const labelDist = ctx.universalLabelDistance ?? ctx.barLabelDistance ?? 5;
  const labelRot = ctx.universalLabelRotate ?? ctx.barLabelRotate ?? 0;
  const labelFSize = ctx.universalLabelFontSize ?? ctx.barLabelFontSize ?? (fontSize - 2);
  const labelFWeight = (ctx.universalLabelFontWeight || ctx.barLabelFontWeight || 'bold') as any;
  const labelFStyle = (ctx.universalLabelFontStyle || ctx.barLabelFontStyle || 'normal') as any;
  const labelLHeight = ctx.universalLabelLineHeight ?? ctx.barLabelLineHeight ?? 13;
  const minThresh = ctx.universalLabelMinThreshold ?? ctx.barLabelMinThreshold ?? 0;
  const showZero = ctx.universalLabelShowZero ?? ctx.barLabelShowZero ?? true;

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return renderCategoryTooltip(p?.data, p?.name);
      }
    },
    legend: showLegend ? {
      ...baseLegend,
      data: legendData,
      ...legendPos,
      orient: legendOrient,
      align: ctx.legendAlign || baseLegend.align,
      z: 20,
      itemWidth: ctx.legendItemWidth ?? baseLegend.itemWidth,
      itemHeight: ctx.legendItemHeight ?? baseLegend.itemHeight,
      itemGap: ctx.legendItemGap ?? baseLegend.itemGap,
      textStyle: {
        ...baseLegend.textStyle
      }
    } : { show: false },
    grid,
    xAxis: buildScientificAxisConfig('x', ctx, {
      axisKind: 'value',
      defaultTitle: metricMode === 'paper_prevalence'
        ? 'Prevalence (% of Cohort)'
        : metricMode === 'tag_share'
        ? 'Tag Share (%)'
        : metricMode === 'avg_qa'
        ? 'Average QA Score'
        : metricMode === 'avg_citation'
        ? 'Average Citation Count'
        : 'Study Count (N)',
      max: (typeof ctx.barValueCeiling === 'number' && ctx.barValueCeiling > 0)
        ? ctx.barValueCeiling
        : (val: any) => {
            if (!val || val.max === 0) return (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? 10 : 5;
            const ceiling = isLabelOutside ? val.max * headroomFactor : val.max;
            const neededMax = barBenchmarkLine ? Math.max(ceiling, barBenchmarkValue * 1.15) : ceiling;
            return calculateNiceScientificCeiling(neededMax, metricMode === 'paper_prevalence' || metricMode === 'tag_share');
          },
      interval: (typeof ctx.barValueInterval === 'number' && ctx.barValueInterval > 0) ? ctx.barValueInterval : undefined,
      defaultUnitFormatter: (v: any) => (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? `${v}%` : `${v}`
    }),
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'category',
      defaultTitle: primaryField,
      categories: categories,
      inverse: true
    }),
    series: (() => {
      let errorBarSeries: any = null;
      if (ctx.enableErrorBars && (metricMode === 'avg_qa' || metricMode === 'avg_citation')) {
        const numTargetKey = metricMode === 'avg_qa' ? 'Overall_QA' : 'citation_count';
        const errData: any[] = [];
        categories.forEach((cat, cIdx) => {
          const pList = activeCountsMap.get(cat) || [];
          const statsObj = computeGroupStatistics(pList, numTargetKey);
          const bounds = getErrorBounds(statsObj, ctx.errorBarType || 'std_error');
          errData.push([cIdx, bounds.lower, bounds.upper]);
        });

        errorBarSeries = {
          name: 'Error Bounds',
          type: 'custom',
          renderItem: (params: any, api: any) => {
            const yValue = api.value(0);
            const lowPoint = api.coord([api.value(1), yValue]);
            const highPoint = api.coord([api.value(2), yValue]);
            const halfHeight = 5;
            const strokeColor = palette.text;
            return {
              type: 'group',
              children: [
                {
                  type: 'line',
                  shape: { x1: lowPoint[0], y1: lowPoint[1], x2: highPoint[0], y2: highPoint[1] },
                  style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
                },
                {
                  type: 'line',
                  shape: { x1: lowPoint[0], y1: lowPoint[1] - halfHeight, x2: lowPoint[0], y2: lowPoint[1] + halfHeight },
                  style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
                },
                {
                  type: 'line',
                  shape: { x1: highPoint[0], y1: highPoint[1] - halfHeight, x2: highPoint[0], y2: highPoint[1] + halfHeight },
                  style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
                }
              ]
            };
          },
          data: errData,
          z: 10
        };
      }

      return [
        {
          name: metricMode.replace(/_/g, ' ').toUpperCase(),
          type: 'bar',
          barWidth: barThickness,
          barCategoryGap: `${barGap}%`,
          data: valuesData,
          label: {
            show: showDataLabels,
            position: labelPos as any,
            distance: labelDist,
            rotate: labelRot,
            fontFamily: font,
            fontSize: labelFSize,
            fontWeight: labelFWeight,
            fontStyle: labelFStyle,
            lineHeight: labelLHeight,
            color: ctx.universalLabelColor || ctx.barLabelColor 
              ? (ctx.universalLabelColor === 'foreground' ? palette.text : (ctx.universalLabelColor || ctx.barLabelColor))
              : palette.text,
            formatter: (params: any) => {
              if (!showZero && (params.data?.paperCount === 0 || params.value === 0)) {
                return '';
              }
              if (minThresh > 0) {
                const rawPct = parseFloat(params.data?.activePctStr ?? '0');
                if (!isNaN(rawPct) && rawPct < minThresh) return '';
              }
              return params.data?.formattedLabel ?? params.value;
            }
          },
          markLine: markLine as any
        },
        ...(errorBarSeries ? [errorBarSeries] : []),
        ...(showLegend ? [{
          type: 'pie' as const,
          radius: [0, 0],
          silent: true,
          label: { show: false },
          labelLine: { show: false },
          data: legendData
        }] : [])
      ];
    })()
  };
}

export function getLayerAbbreviation(layer: string): string {
  if (!layer) return '';
  const clean = layer.replace(/\[.*?\]/g, '').trim();
  const lower = clean.toLowerCase();
  if (lower.includes('application') || lower.includes('middleware')) return 'App';
  if (lower.includes('network') || lower.includes('transport')) return 'Net';
  if (lower.includes('physical') || lower.includes('link')) return 'Link';
  if (clean.includes('/')) {
    return clean.split('/')[0].trim().substring(0, 4);
  }
  const words = clean.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => w[0].toUpperCase()).join('');
  }
  return clean.substring(0, 4);
}

export function generateStackedBarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    primaryField,
    secondaryField,
    metricMode,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap = {},
    levelCustomGroupLinks,
    sankeyFields,
    showLegend,
    labelRotation,
    showDataLabels,
    umbrellanizerMap,
    customSliceColors,
    barSorting,
    barOrientation = 'vertical',
    barThickness = 28,
    barBorderRadius = 2,
    barGap = 30,
    enableHatchPatterns = false,
    barLabelPosition = 'inside',
    barLabelFormat = 'count_only',
    barLabelFontSize = 11,
    barLabelFontWeight = 'bold',
    barLabelFontStyle = 'normal',
    barLabelColor = '',
    barLabelRotate = 0,
    barLabelDistance = 4,
    barLabelShowZero = true,
    barLabelMinThreshold = 0,
    stackedNormalized = false,
    stackedReverseOrder = false,
    stackedPerBarSorting = 'none',
    stackedShowTotalLabel = false,
    stackedTotalLabelPosition = 'top',
    stackedTotalLabelFormat = '{total}',
    stackedTotalFontSize = 11,
    stackedTotalFontWeight = 'bold',
    stackedTotalColor = '',
    stackedTotalLabelDistance = 4,
    barBenchmarkLine = false,
    barBenchmarkValue = 0,
    barBenchmarkLabel = '',
    barBenchmarkStyle = 'dashed',
    barBenchmarkColor = '#ef4444'
  } = ctx;

  const isHorizontal = barOrientation === 'horizontal';

  // Support inline bracket scope syntax (e.g. "ext:lv1:rq_algo[Biological Asset]" or "ext:lv1:rq_algo[scope=Biological Asset]")
  const primBracket = primaryField ? primaryField.match(/^(.*?)\[(?:scope=)?(.*?)\]$/) : null;
  const secBracket = secondaryField ? secondaryField.match(/^(.*?)\[(?:scope=)?(.*?)\]$/) : null;
  const cleanPrimField = primBracket ? primBracket[1].trim() : primaryField;
  const cleanSecField = secBracket ? secBracket[1].trim() : secondaryField;

  const effectivePrimScope = ctx.primaryScopeFilter || ctx.levelScopeFilters?.[0] || (primBracket ? primBracket[2].trim() : undefined);
  const effectiveSecScope = ctx.secondaryScopeFilter || ctx.levelScopeFilters?.[1] || (secBracket ? secBracket[2].trim() : undefined);
  const primSegIdx = ctx.levelSegmentIndices?.[0];
  const secSegIdx = ctx.levelSegmentIndices?.[1];

  const catSet = new Set<string>();
  const stackSet = new Set<string>();
  const rawMatrixMap = new Map<string, Map<string, any[]>>();
  let totalExtractedTags = 0;

  const mappedOpts = { 
    useUmbrellanizer, 
    umbrellanizerMap, 
    splitMultiValues, 
    excludeEmpty,
    customCategoryMap,
    levelCustomGroups: ctx.levelCustomGroups,
    levelCustomGroupLinks,
    levelTargetFields: ctx.levelTargetFields,
    subFieldKey: ctx.levelTargetFields?.[0],
    levelIdx: 0,
    segmentIdx: primSegIdx,
    scopeFilter: effectivePrimScope,
    unpackMacroToChildren: true,
    sankeyFields,
    primaryField: cleanPrimField
  };

  const secMappedOpts = {
    ...mappedOpts,
    primaryField: cleanSecField,
    subFieldKey: ctx.levelTargetFields?.[1],
    levelIdx: 1,
    segmentIdx: secSegIdx,
    scopeFilter: effectiveSecScope,
    unpackMacroToChildren: false
  };

  // Helper to test if a token path satisfies scope filters
  const checkPathMatchesScope = (path: string[], scopeFilter?: string): boolean => {
    if (!scopeFilter) return true;
    const scopeItems = scopeFilter.split(',').map(s => s.trim()).filter(Boolean);
    const posScopes = scopeItems.filter(s => !s.startsWith('!')).map(s => s.toLowerCase());
    const negScopes = scopeItems.filter(s => s.startsWith('!')).map(s => s.substring(1).toLowerCase());
    const pathNorms = path.map(s => s.toLowerCase());
    if (negScopes.length > 0 && negScopes.some(neg => pathNorms.includes(neg))) return false;
    if (posScopes.length > 0) return posScopes.some(pos => pathNorms.includes(pos));
    return true;
  };

  const isZeroBasedLv = cleanPrimField.includes('lv0:') || cleanSecField.includes('lv0:');
  const getSegIdxFromKey = (key: string, fallback?: number): number => {
    if (fallback !== undefined && fallback >= 0) return fallback;
    const matchSeg = key.match(/^ext:segment:(\d+):/i);
    if (matchSeg) return parseInt(matchSeg[1], 10);
    const matchLv = key.match(/^ext:lv(\d+):/i);
    if (matchLv) {
      const p = parseInt(matchLv[1], 10);
      return isZeroBasedLv ? p : Math.max(0, p - 1);
    }
    if (key.includes('macro:') || key.includes('lv1:')) return 0;
    if (key.includes('sub:') || key.includes('lv2:')) return 1;
    if (key.includes('leaf:') || key.includes('lv3:') || key.includes('tail:')) return 2;
    return 0;
  };

  const primBaseKey = extractCleanTaxonomyKey(cleanPrimField);
  const secBaseKey = extractCleanTaxonomyKey(cleanSecField);
  const isSharedTaxonomy = Boolean(primBaseKey && secBaseKey && primBaseKey === secBaseKey);

  // Ingest data with zero cross-talk leakage
  papers.forEach(p => {
    if (isSharedTaxonomy) {
      const paths = extractTokenPaths(p, cleanPrimField, mappedOpts);
      const effectivePrimIdx = getSegIdxFromKey(cleanPrimField, primSegIdx);
      const effectiveSecIdx = getSegIdxFromKey(cleanSecField, secSegIdx);

      paths.forEach(path => {
        if (!checkPathMatchesScope(path, effectivePrimScope)) return;
        if (!checkPathMatchesScope(path, effectiveSecScope)) return;

        const rawPv = path[effectivePrimIdx < path.length ? effectivePrimIdx : path.length - 1];
        const rawSv = path[effectiveSecIdx < path.length ? effectiveSecIdx : path.length - 1];
        if (!rawPv || !rawSv) return;

        const primMapObj = customCategoryMap[cleanPrimField] || (primBaseKey ? customCategoryMap[primBaseKey] : undefined);
        const secMapObj = customCategoryMap[cleanSecField] || (secBaseKey ? customCategoryMap[secBaseKey] : undefined);
        const pv = primMapObj?.[rawPv] || rawPv;
        const sv = secMapObj?.[rawSv] || rawSv;

        totalExtractedTags++;
        catSet.add(pv);
        const stkKey = `${pv}:::${sv}`;
        stackSet.add(stkKey);
        if (!rawMatrixMap.has(pv)) rawMatrixMap.set(pv, new Map());
        if (!rawMatrixMap.get(pv)!.has(stkKey)) rawMatrixMap.get(pv)!.set(stkKey, []);
        rawMatrixMap.get(pv)!.get(stkKey)!.push(p);
      });
    } else {
      const primVals = getMappedFieldValue(p, cleanPrimField, mappedOpts);
      const rawSecVals = getMappedFieldValue(p, cleanSecField, secMappedOpts);

      primVals.forEach(pv => {
        catSet.add(pv);
        const scopedSecVals = filterValuesForParent(rawSecVals, cleanSecField, {
          fieldKey: cleanPrimField,
          levelIdx: 0,
          rawName: pv,
          displayName: pv,
          path: [pv]
        }, { levelCustomGroupLinks, umbrellanizerMap });

        scopedSecVals.forEach((sv: any) => {
          totalExtractedTags++;
          stackSet.add(sv);
          if (!rawMatrixMap.has(pv)) rawMatrixMap.set(pv, new Map());
          if (!rawMatrixMap.get(pv)!.has(sv)) rawMatrixMap.get(pv)!.set(sv, []);
          rawMatrixMap.get(pv)!.get(sv)!.push(p);
        });
      });
    }
  });

  const primPapersMap = new Map<string, any[]>();
  catSet.forEach(pv => {
    const pList: any[] = [];
    rawMatrixMap.get(pv)?.forEach(list => pList.push(...list));
    primPapersMap.set(pv, pList);
  });

  const effectiveOtherLabel = ctx.otherCategoryLabel || 'Other';
  const isOther = (cat: string) => cat === effectiveOtherLabel || cat === 'Other';

  const limitedPrimMap = limitCategoryMap(
    primPapersMap,
    limitCategories,
    maxCategoriesCount,
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags),
    effectiveOtherLabel
  );

  let stacks = Array.from(stackSet).sort();
  if (stackedReverseOrder) {
    stacks = stacks.reverse();
  }

  // User-configurable decimal precision for bar data labels (fallback to global decimalPrecision, then 0)
  const effectiveDecimals = ctx.barLabelDecimals !== undefined 
    ? ctx.barLabelDecimals 
    : (ctx.decimalPrecision !== undefined ? ctx.decimalPrecision : 0);

  const formatBarNum = (val: number | string) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return `${val}`;
    if (effectiveDecimals === 0) return Math.round(num).toString();
    return num.toFixed(effectiveDecimals);
  };

  const formatBarPercentage = (val: number | string) => {
    return formatPercentage(val, effectiveDecimals, ctx.useTildeForCoarse ?? true);
  };

  // Pre-calculate raw matrix values, totals, and Hare-Hamilton balanced percentages per category
  const catTotals = new Map<string, number>();
  const catStackValues = new Map<string, Map<string, number>>();
  const catStackBalancedPcts = new Map<string, Map<string, number>>();

  Array.from(limitedPrimMap.keys()).forEach(cat => {
    let sum = 0;
    const sMap = new Map<string, number>();
    stacks.forEach(stk => {
      let rawVal = 0;
      if (isOther(cat)) {
        const otherPapers: any[] = [];
        const cleanStk = stk.includes(':::') ? stk.split(':::')[1] : stk;
        limitedPrimMap.get(cat)?.forEach(p => {
          const sVals = getMappedFieldValue(p, secondaryField, secMappedOpts);
          if (sVals.includes(cleanStk) || sVals.includes(stk)) otherPapers.push(p);
        });
        rawVal = computeMetricValue(otherPapers, metricMode, papers.length, totalExtractedTags);
      } else {
        rawVal = computeMetricValue(rawMatrixMap.get(cat)?.get(stk) || [], metricMode, papers.length, totalExtractedTags);
      }
      sMap.set(stk, rawVal);
      sum += rawVal;
    });
    catStackValues.set(cat, sMap);
    catTotals.set(cat, sum);

    // Hare-Hamilton 100% quota balancing for exact within-bar percentages
    const rawCounts = stacks.map(stk => sMap.get(stk) || 0);
    const balancedPcts = calculateHareHamiltonPercentages(rawCounts, 100, effectiveDecimals);
    const pctMap = new Map<string, number>();
    stacks.forEach((stk, sIdx) => {
      pctMap.set(stk, balancedPcts[sIdx]);
    });
    catStackBalancedPcts.set(cat, pctMap);
  });

  // Determine category ordering based on barSorting
  let categories = Array.from(limitedPrimMap.keys());
  if (excludeEmpty || (ctx as any).excludeUnassigned) {
    categories = categories.filter(c => c !== 'Unassigned / Other' && c !== 'Unassigned');
  }

  if (barSorting === 'desc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      return (catTotals.get(b) || 0) - (catTotals.get(a) || 0);
    });
  } else if (barSorting === 'asc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      return (catTotals.get(a) || 0) - (catTotals.get(b) || 0);
    });
  } else {
    // Natural / Chronological (Numeric years or alphabetical)
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }

  // 1. Discover active surviving cohort totals and parent taxonomy hierarchy
  const activeSurvivingPaperSet = new Set<string>();
  let activeSurvivingTags = 0;
  const stackParentsMap = new Map<string, Set<string>>();
  const catUniquePapersMap = new Map<string, Set<string>>();
  const catTagCountMap = new Map<string, number>();
  const subCategoryParentsMap = new Map<string, Set<string>>(); // clean subcategory -> set of parent layers

  rawMatrixMap.forEach((sMap, cat) => {
    const pSet = new Set<string>();
    let tCount = 0;
    sMap.forEach((pList, stk) => {
      tCount += pList.length;
      activeSurvivingTags += pList.length;
      pList.forEach(p => {
        const pId = p.Paper_ID ?? p.Title ?? JSON.stringify(p);
        pSet.add(pId);
        activeSurvivingPaperSet.add(pId);
      });
      if (!stackParentsMap.has(stk)) stackParentsMap.set(stk, new Set());
      stackParentsMap.get(stk)!.add(cat);

      const cleanSubName = stk.includes(':::') ? stk.split(':::')[1] : stk;
      if (!subCategoryParentsMap.has(cleanSubName)) subCategoryParentsMap.set(cleanSubName, new Set());
      subCategoryParentsMap.get(cleanSubName)!.add(cat);
    });
    catUniquePapersMap.set(cat, pSet);
    catTagCountMap.set(cat, tCount);
  });
  const activeSurvivingPaperCount = activeSurvivingPaperSet.size;

  // Group stacks by parent layer matching categories display order if enabled
  const legendGroupByParent = ctx.legendGroupByParent ?? true;
  if (legendGroupByParent && categories.length > 0) {
    const groupedStacks: string[] = [];
    const usedStacks = new Set<string>();

    categories.forEach(cat => {
      const catStacks = stacks.filter(stk => {
        const pSet = stackParentsMap.get(stk);
        return pSet && pSet.has(cat);
      });

      // Sort within category by descending paper count / prevalence
      catStacks.sort((a, b) => {
        const pListA = rawMatrixMap.get(cat)?.get(a) || [];
        const pListB = rawMatrixMap.get(cat)?.get(b) || [];
        if (pListB.length !== pListA.length) return pListB.length - pListA.length;
        return a.localeCompare(b);
      });

      catStacks.forEach(stk => {
        if (!usedStacks.has(stk)) {
          groupedStacks.push(stk);
          usedStacks.add(stk);
        }
      });
    });

    stacks.forEach(stk => {
      if (!usedStacks.has(stk)) {
        groupedStacks.push(stk);
        usedStacks.add(stk);
      }
    });

    stacks = groupedStacks;
  }

  // Effective cohort denominator: use active surviving count if forceCohortDenominator is false AND scope is active
  const hasActiveScope = Boolean(effectivePrimScope || effectiveSecScope || ctx.legendContextScope === 'surviving_flow');
  const effectiveTotalCohort = (ctx.forceCohortDenominator || !hasActiveScope) 
    ? papers.length 
    : (activeSurvivingPaperCount > 0 ? activeSurvivingPaperCount : papers.length);
  const effectiveTotalTags = (ctx.forceCohortDenominator || !hasActiveScope)
    ? totalExtractedTags
    : (activeSurvivingTags > 0 ? activeSurvivingTags : totalExtractedTags);

  const formatStackedBarLabel = (params: any): string => {
    const raw = params.data?.rawVal ?? params.value;
    const pct = params.data?.pct ?? 0;
    const prevPct = params.data?.prevalencePct ?? 0;
    const pCount = params.data?.paperCount ?? (typeof raw === 'number' ? Math.round(raw) : 0);
    if (!barLabelShowZero && (raw === 0 || params.value === 0)) return '';
    if (barLabelMinThreshold > 0 && (stackedNormalized ? pct : raw) < barLabelMinThreshold) return '';

    const pctDisplay = formatBarPercentage(pct);
    const prevPctDisplay = formatBarPercentage(prevPct);

    const isExplicitPrevalence = ctx.barLabelContextScope === 'cohort_prevalence' || 
      barLabelFormat === 'prevalence_percent_only' || 
      barLabelFormat === 'count_prevalence_percent' || 
      barLabelFormat === 'two_line_count_prevalence_percent' ||
      (ctx.syncLegendAndBarMetrics && (ctx.legendContextScope === 'surviving_flow' || ctx.legendContextScope === 'global_cohort'));

    const isExplicitLayerShare = ctx.barLabelContextScope === 'layer_share' ||
      barLabelFormat === 'layer_share' ||
      (ctx.syncLegendAndBarMetrics && (ctx.legendContextScope === 'in_chart_flow' || ctx.legendContextScope === 'parent_layer'));

    const activePctDisplay = isExplicitPrevalence ? prevPctDisplay : pctDisplay;
    const activeDenom = isExplicitPrevalence ? effectiveTotalCohort : (params.data?.catTotal ?? 0);
    const subName = params.data?.cleanSubName || params.data?.stkName || (typeof params.seriesName === 'string' ? params.seriesName.replace(/^\[.*?\]\s*/, '') : '');

    switch (barLabelFormat) {
      case 'prevalence_percent_only':
        return prevPctDisplay;
      case 'layer_share':
        return pctDisplay;
      case 'count_only':
      case 'value':
        return `${pCount}`;
      case 'count_prevalence_percent':
        return `${pCount} (${prevPctDisplay})`;
      case 'two_line_count_prevalence_percent':
        return `${pCount}\n${prevPctDisplay}`;
      case 'value_pct':
      case 'count_percent':
        return `${pCount} (${activePctDisplay})`;
      case 'two_line_count_percent':
        return `${pCount}\n${activePctDisplay}`;
      case 'ratio_only':
        return `${pCount}/${activeDenom}`;
      case 'ratio_percent':
        return `${pCount}/${activeDenom} (${activePctDisplay})`;
      case 'name_only':
        return subName;
      case 'name_percent':
        return subName ? `${subName} (${activePctDisplay})` : activePctDisplay;
      case 'name_count':
        return subName ? `${subName} (n=${pCount})` : `${pCount}`;
      case 'name_count_percent':
        return subName ? `${subName} (${pCount}, ${activePctDisplay})` : `${pCount} (${activePctDisplay})`;
      case 'name_ratio':
        return subName ? `${subName} (n=${pCount}/${activeDenom})` : `${pCount}/${activeDenom}`;
      case 'name_ratio_percent':
        return subName ? `${subName} (n=${pCount}/${activeDenom}, ${activePctDisplay})` : `${pCount}/${activeDenom} (${activePctDisplay})`;
      case 'percent_ratio':
        return `${activePctDisplay} (${pCount}/${activeDenom})`;
      case 'two_line_percent_count':
        return `${activePctDisplay}\n${pCount}`;
      case 'two_line_ratio_percent':
        return `${pCount}/${activeDenom}\n${activePctDisplay}`;
      case 'two_line_name_count_percent':
        return subName ? `${subName}\n${pCount} (${activePctDisplay})` : `${pCount}\n${activePctDisplay}`;
      case 'pct_only':
      case 'percent_only':
        if (isExplicitPrevalence) return prevPctDisplay;
        if (isExplicitLayerShare) return pctDisplay;
        return (metricMode === 'paper_prevalence' && ctx.legendContextScope !== 'parent_layer' && ctx.legendContextScope !== 'in_chart_flow')
          ? prevPctDisplay
          : pctDisplay;
      default:
        if (stackedNormalized) {
          if (isExplicitPrevalence) return prevPctDisplay;
          if (isExplicitLayerShare) return pctDisplay;
          return (metricMode === 'paper_prevalence' && ctx.legendContextScope !== 'parent_layer' && ctx.legendContextScope !== 'in_chart_flow')
            ? prevPctDisplay
            : pctDisplay;
        }
        return typeof raw === 'number' ? formatBarNum(raw) : `${raw}`;
    }
  };

  // Build formatted legend name map for stacks (raw name → formatted label)
  // Must be computed BEFORE series construction so series names match legend names for ECharts toggle
  const stackEffectiveLegendFormat = ctx.legendFormat || ctx.barLegendFormat || 'name';
  const prefixStyle = ctx.legendParentPrefixStyle || 'abbreviated';
  const stackLegendNames = new Map<string, string>();
  stacks.forEach(stk => {
    const stackPaperSet = new Set<string>();
    let stackTagCount = 0;
    Array.from(rawMatrixMap.values()).forEach(primMap => {
      const stackPapers = primMap.get(stk) || [];
      stackTagCount += stackPapers.length;
      stackPapers.forEach((p: any) => stackPaperSet.add(p.Paper_ID ?? p.Title ?? JSON.stringify(p)));
    });
    const stackPaperCount = stackPaperSet.size;

    // Resolve parent context
    const parentSet = stackParentsMap.get(stk);
    const parentList = parentSet ? Array.from(parentSet) : [];
    const isSingleParent = parentList.length === 1;
    const parentName = isSingleParent ? parentList[0] : (stk.includes(':::') ? stk.split(':::')[0] : (parentList.length > 1 ? 'Multi-Layer' : undefined));
    const parentPaperCount = parentName && parentName !== 'Multi-Layer'
      ? (catUniquePapersMap.get(parentName)?.size || effectiveTotalCohort)
      : (parentList.length > 1
          ? new Set(parentList.flatMap(c => Array.from(catUniquePapersMap.get(c) || []))).size
          : effectiveTotalCohort);
    const parentTagCount = parentName && parentName !== 'Multi-Layer'
      ? (catTagCountMap.get(parentName) || effectiveTotalTags)
      : (parentList.length > 1
          ? parentList.reduce((acc, c) => acc + (catTagCountMap.get(c) || 0), 0)
          : effectiveTotalTags);
    const parentLayerTotal = parentName && parentName !== 'Multi-Layer'
      ? (catTotals.get(parentName) || parentTagCount)
      : (parentList.length > 1
          ? parentList.reduce((acc, c) => acc + (catTotals.get(c) || 0), 0)
          : effectiveTotalTags);

    // Calculate prevalence and tag share based on legendContextScope
    let denomPapers = effectiveTotalCohort;
    let denomTags = effectiveTotalTags;
    if ((ctx.legendContextScope === 'parent_layer' || ctx.legendContextScope === 'in_chart_flow') && parentName) {
      denomPapers = (stackedNormalized || ctx.legendContextScope === 'in_chart_flow') ? parentLayerTotal : parentPaperCount;
      denomTags = parentTagCount;
    }

    const stackPrevalencePct = denomPapers > 0 ? (stackPaperCount / denomPapers) * 100 : 0;
    const stackTagSharePct = denomTags > 0 ? (stackTagCount / denomTags) * 100 : 0;

    const cleanSubName = stk.includes(':::') ? stk.split(':::')[1] : stk;
    const isColliding = Boolean(subCategoryParentsMap.get(cleanSubName) && subCategoryParentsMap.get(cleanSubName)!.size > 1);

    // Determine badge prefix
    let badge = '';
    if (parentName) {
      if (prefixStyle === 'abbreviated') {
        badge = `[${getLayerAbbreviation(parentName)}] `;
      } else if (prefixStyle === 'full') {
        badge = `[${parentName}] `;
      } else if (prefixStyle === 'colliding_only') {
        badge = isColliding ? `[${getLayerAbbreviation(parentName)}] ` : '';
      }
    }
    const displayNameWithBadge = `${badge}${cleanSubName}`;

    const formattedLabel = formatLegendLabel(displayNameWithBadge, {
      paperCount: stackPaperCount,
      tagCount: stackTagCount,
      count: metricMode === 'tag_share' ? stackTagCount : stackPaperCount,
      prevalencePct: stackPrevalencePct,
      tagSharePct: stackTagSharePct,
      totalCohortPapers: denomPapers,
      totalExtractedTags: denomTags,
      metricMode,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator,
      parentName,
      parentPaperCount,
      parentTagCount,
      showParentPrefix: false
    }, stackEffectiveLegendFormat);
    stackLegendNames.set(stk, formattedLabel);
  });

  // 1. Procedural distinct palette to eliminate duplicate colors for any number of stacks
  const distinctPalette = generateDistinctPalette(palette.colors, stacks.length);

  const isPerBarSorting = stackedPerBarSorting === 'desc' || stackedPerBarSorting === 'asc';

  let seriesList: echarts.BarSeriesOption[] = [];

  if (isPerBarSorting) {
    // Map of category -> sorted active segments
    const catSortedSegments = new Map<string, any[]>();
    categories.forEach(cat => {
      const segs: any[] = [];
      stacks.forEach((stk, sIdx) => {
        const rawVal = catStackValues.get(cat)?.get(stk) || 0;
        if (rawVal <= 0) return;
        const tot = catTotals.get(cat) || 0;
        const pct = catStackBalancedPcts.get(cat)?.get(stk) ?? (tot > 0 ? parseFloat(((rawVal / tot) * 100).toFixed(effectiveDecimals)) : 0);
        const displayValue = stackedNormalized ? pct : rawVal;
        const cellPapers = rawMatrixMap.get(cat)?.get(stk) || [];
        const cellPaperCount = new Set(cellPapers.map((p: any) => p.Paper_ID ?? p.Title ?? JSON.stringify(p))).size;
        const cleanSubName = stk.includes(':::') ? stk.split(':::')[1] : stk;
        const parentLayer = stk.includes(':::') ? stk.split(':::')[0] : cat;
        const baseColor = customSliceColors?.[stk] || customSliceColors?.[cleanSubName] || distinctPalette[sIdx] || palette.colors[sIdx % palette.colors.length];
        const patternStyle = getSeriesPatternStyle(sIdx, baseColor, enableHatchPatterns);
        const cellPrevalencePct = effectiveTotalCohort > 0 ? (cellPaperCount / effectiveTotalCohort) * 100 : 0;

        segs.push({
          stk,
          sIdx,
          rawVal,
          catTotal: tot,
          pct,
          displayValue,
          catName: cat,
          cleanSubName,
          parentLayer,
          paperCount: cellPaperCount,
          prevalencePct: cellPrevalencePct,
          tagCount: cellPapers.length,
          baseColor,
          patternStyle,
          formattedLegendName: stackLegendNames.get(stk) ?? stk
        });
      });

      if (stackedPerBarSorting === 'desc') {
        // Largest first (drawn at base/left of horizontal bar, leaving smaller slices at far right)
        segs.sort((a, b) => (b.rawVal !== a.rawVal ? b.rawVal - a.rawVal : b.pct - a.pct));
      } else {
        // Smallest first
        segs.sort((a, b) => (a.rawVal !== b.rawVal ? a.rawVal - b.rawVal : a.pct - b.pct));
      }
      catSortedSegments.set(cat, segs);
    });

    const maxSegments = Math.max(0, ...categories.map(cat => catSortedSegments.get(cat)?.length || 0));

    // Construct rank series (0 to maxSegments - 1)
    for (let r = 0; r < maxSegments; r++) {
      seriesList.push({
        name: `__stacked_rank_${r}__`,
        type: 'bar',
        stack: 'total',
        barWidth: barThickness,
        barGap: `${barGap}%`,
        data: categories.map(cat => {
          const segs = catSortedSegments.get(cat) || [];
          if (r >= segs.length) {
            return {
              value: 0,
              rawVal: 0,
              catTotal: catTotals.get(cat) || 0,
              pct: 0,
              stkName: '',
              cleanSubName: '',
              parentLayer: cat,
              catName: cat,
              paperCount: 0,
              prevalencePct: 0,
              tagCount: 0,
              itemStyle: { color: 'transparent' },
              label: { show: false }
            };
          }
          const seg = segs[r];
          const isLastSegmentInBar = (r === segs.length - 1);
          return {
            value: seg.displayValue,
            rawVal: seg.rawVal,
            catTotal: seg.catTotal,
            pct: seg.pct,
            stkName: seg.cleanSubName,
            cleanSubName: seg.cleanSubName,
            parentLayer: seg.parentLayer,
            formattedLegendName: seg.formattedLegendName,
            catName: seg.catName,
            paperCount: seg.paperCount,
            prevalencePct: seg.prevalencePct,
            tagCount: seg.tagCount,
            itemStyle: {
              color: seg.patternStyle.color || seg.baseColor,
              borderColor: palette.bg,
              borderWidth: 1,
              borderRadius: barBorderRadius > 0 && isLastSegmentInBar ? (isHorizontal ? [0, barBorderRadius, barBorderRadius, 0] : [barBorderRadius, barBorderRadius, 0, 0]) : 0,
              ...seg.patternStyle
            },
            label: {
              color: (() => {
                if (barLabelColor === 'match_series') return seg.baseColor;
                if (barLabelColor === 'foreground') return palette.text;
                if (barLabelColor && (barLabelColor.startsWith('#') || barLabelColor.startsWith('rgb'))) return barLabelColor;
                return barLabelPosition.startsWith('inside') ? getContrastingTextColor(seg.baseColor) : palette.text;
              })()
            }
          };
        }),
        label: {
          show: showDataLabels,
          position: barLabelPosition as any,
          distance: barLabelDistance,
          rotate: barLabelRotate,
          fontFamily: font,
          fontSize: barLabelFontSize,
          fontWeight: barLabelFontWeight as any,
          fontStyle: barLabelFontStyle as any,
          formatter: (params: any) => formatStackedBarLabel(params)
        }
      });
    }

    // Add dummy legend series so ECharts renders all category keys with correct swatches and names
    stacks.forEach((stk, sIdx) => {
      const cleanSubName = stk.includes(':::') ? stk.split(':::')[1] : stk;
      const baseColor = customSliceColors?.[stk] || customSliceColors?.[cleanSubName] || distinctPalette[sIdx] || palette.colors[sIdx % palette.colors.length];
      const patternStyle = getSeriesPatternStyle(sIdx, baseColor, enableHatchPatterns);
      seriesList.push({
        name: stackLegendNames.get(stk) ?? stk,
        type: 'bar',
        stack: 'total',
        data: [],
        itemStyle: {
          color: patternStyle.color || baseColor,
          ...patternStyle
        }
      });
    });
  } else {
    // Construct series for each stack slice
    seriesList = stacks.map((stk, sIdx) => {
      const cleanSubName = stk.includes(':::') ? stk.split(':::')[1] : stk;
      const parentLayer = stk.includes(':::') ? stk.split(':::')[0] : '';
      const baseColor = customSliceColors?.[stk] || customSliceColors?.[cleanSubName] || distinctPalette[sIdx] || palette.colors[sIdx % palette.colors.length];
      const patternStyle = getSeriesPatternStyle(sIdx, baseColor, enableHatchPatterns);

      return {
        name: stackLegendNames.get(stk) ?? stk,
        type: 'bar',
        stack: 'total',
        barWidth: barThickness,
        barGap: `${barGap}%`,
        itemStyle: {
          color: patternStyle.color || baseColor,
          borderColor: palette.bg,
          borderWidth: 1,
          borderRadius: barBorderRadius > 0 ? (sIdx === stacks.length - 1 ? (isHorizontal ? [0, barBorderRadius, barBorderRadius, 0] : [barBorderRadius, barBorderRadius, 0, 0]) : 0) : 0,
          ...patternStyle
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 8,
            shadowColor: hexToRgba(palette.text, 0.25)
          }
        },
        data: categories.map(cat => {
          const rawVal = catStackValues.get(cat)?.get(stk) || 0;
          const tot = catTotals.get(cat) || 0;
          const pct = catStackBalancedPcts.get(cat)?.get(stk) ?? (tot > 0 ? parseFloat(((rawVal / tot) * 100).toFixed(effectiveDecimals)) : 0);
          const displayValue = stackedNormalized ? pct : rawVal;
          const cellPapers = rawMatrixMap.get(cat)?.get(stk) || [];
          const cellPaperCount = new Set(cellPapers.map((p: any) => p.Paper_ID ?? p.Title ?? JSON.stringify(p))).size;
          const cellPrevalencePct = effectiveTotalCohort > 0 ? (cellPaperCount / effectiveTotalCohort) * 100 : 0;

          return {
            value: displayValue,
            rawVal,
            catTotal: tot,
            pct,
            stkName: cleanSubName,
            cleanSubName,
            parentLayer: parentLayer || cat,
            formattedLegendName: stackLegendNames.get(stk) ?? stk,
            catName: cat,
            paperCount: cellPaperCount,
            prevalencePct: cellPrevalencePct,
            tagCount: cellPapers.length
          };
        }),
        label: {
          show: showDataLabels,
          position: barLabelPosition as any,
          distance: barLabelDistance,
          rotate: barLabelRotate,
          fontFamily: font,
          fontSize: barLabelFontSize,
          fontWeight: barLabelFontWeight as any,
          fontStyle: barLabelFontStyle as any,
          color: (() => {
            if (barLabelColor === 'match_series') return baseColor;
            if (barLabelColor === 'foreground') return palette.text;
            if (barLabelColor && (barLabelColor.startsWith('#') || barLabelColor.startsWith('rgb'))) return barLabelColor;
            return barLabelPosition.startsWith('inside') ? getContrastingTextColor(baseColor) : palette.text;
          })(),
          formatter: (params: any) => formatStackedBarLabel(params)
        }
      };
    });
  }

  // Stack Summit / Total Summary Labels (Academic Publishing Feature)
  if (stackedShowTotalLabel && categories.length > 0) {
    const totalPos = isHorizontal ? 'right' : (stackedTotalLabelPosition === 'right' ? 'right' : 'top');
    seriesList.push({
      name: '__stacked_total_summary__',
      type: 'bar',
      stack: 'total',
      barWidth: barThickness,
      data: categories.map(cat => ({
        value: 0,
        catName: cat,
        totalVal: catTotals.get(cat) || 0
      })),
      tooltip: { show: false },
      itemStyle: { color: 'transparent' },
      label: {
        show: true,
        position: totalPos as any,
        distance: stackedTotalLabelDistance,
        fontFamily: font,
        fontSize: stackedTotalFontSize,
        fontWeight: stackedTotalFontWeight as any,
        color: stackedTotalColor || palette.text,
        formatter: (params: any) => {
          const tot = params.data?.totalVal ?? 0;
          const displayVal = stackedNormalized ? '100%' : `${tot}`;
          return (stackedTotalLabelFormat || '{total}')
            .replace('{total}', displayVal)
            .replace('{count}', `${tot}`);
        }
      }
    });
  }

  // Target Benchmark Reference Line
  const markLine = barBenchmarkLine ? {
    symbol: 'none',
    lineStyle: {
      type: barBenchmarkStyle,
      color: barBenchmarkColor,
      width: 2
    },
    label: {
      show: true,
      position: 'end' as const,
      formatter: `${barBenchmarkLabel || 'Target Benchmark'} (${barBenchmarkValue}${stackedNormalized ? '%' : ''})`,
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 2),
      color: barBenchmarkColor,
      fontWeight: 'bold' as const
    },
    data: [
      isHorizontal ? { xAxis: barBenchmarkValue } : { yAxis: barBenchmarkValue }
    ]
  } : undefined;

  if (markLine && seriesList.length > 0) {
    seriesList[0].markLine = markLine as any;
  }

  const categoryAxis = buildScientificAxisConfig(isHorizontal ? 'y' : 'x', ctx, {
    axisKind: 'category',
    defaultTitle: formatVariableDisplayName(cleanPrimField),
    categories: categories,
    inverse: isHorizontal
  });

  const valueAxis = buildScientificAxisConfig(isHorizontal ? 'x' : 'y', ctx, {
    axisKind: 'value',
    defaultTitle: stackedNormalized ? 'Relative Proportion (%)' : 'Study Count (N)',
    max: stackedNormalized ? 100 : (ctx.barValueCeiling !== 'auto' && ctx.barValueCeiling ? Number(ctx.barValueCeiling) : undefined),
    interval: ctx.barValueInterval !== 'auto' && ctx.barValueInterval ? Number(ctx.barValueInterval) : undefined,
    defaultUnitFormatter: (v: any) => stackedNormalized ? `${v}%` : `${v}`
  });

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      ...baseLegend,
      data: stacks.map((stk, sIdx) => {
        const cleanSubName = stk.includes(':::') ? stk.split(':::')[1] : stk;
        const baseColor = customSliceColors?.[stk] || customSliceColors?.[cleanSubName] || distinctPalette[sIdx] || palette.colors[sIdx % palette.colors.length];
        return {
          name: stackLegendNames.get(stk) ?? stk,
          itemStyle: { color: baseColor }
        };
      })
    },
    tooltip: { 
      ...baseTooltip, 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const validParams = params.filter((p: any) => 
          p.seriesName !== '__stacked_total_summary__' &&
          (p.data?.rawVal !== undefined ? p.data.rawVal > 0 : (typeof p.value === 'number' ? p.value > 0 : true))
        );
        if (validParams.length === 0) return '';
        const cat = validParams[0].data?.catName || validParams[0].name;
        const tot = catTotals.get(cat) || 0;
        let rows = validParams.map((p: any) => {
          const raw = p.data?.rawVal ?? p.value;
          const pct = p.data?.pct ?? (tot > 0 ? ((raw / tot) * 100).toFixed(effectiveDecimals) : 0);
          const rawSeriesName = (p.seriesName && p.seriesName.includes(':::')) ? p.seriesName.split(':::')[1] : (p.seriesName || '');
          const cleanName = p.data?.cleanSubName || p.data?.stkName || rawSeriesName.replace(/^\[.*?\]\s*/, '').replace(/\s*\([^)]*\)$/, '') || 'Protocol';
          const color = p.data?.itemStyle?.color || p.color;
          const pctFormatted = formatBarPercentage(pct);
          const pCount = p.data?.paperCount ?? (typeof raw === 'number' ? Math.round(raw) : 0);
          const prevPct = p.data?.prevalencePct ?? (effectiveTotalCohort > 0 ? ((pCount / effectiveTotalCohort) * 100) : 0);
          const prevPctFormatted = formatBarPercentage(prevPct);

          const valueDisplay = stackedNormalized
            ? `${pctFormatted} (${pCount} papers, ${prevPctFormatted} of cohort)`
            : `${pCount} papers (${prevPctFormatted} of cohort | ${pctFormatted} of ${cat})`;

          return `<div style="display:flex;justify-content:space-between;gap:14px;margin:3px 0;">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:6px;"></span>${cleanName}:</span>
            <strong>${valueDisplay}</strong>
          </div>`;
        }).join('');

        const layerUniquePapers = catUniquePapersMap.get(cat)?.size || 0;
        const totalSuffix = layerUniquePapers > 0 && layerUniquePapers !== tot
          ? `(Total: ${tot} occurrences | ${layerUniquePapers} papers)`
          : `(Total: ${tot} ${metricMode === 'tag_share' ? 'occurrences' : 'papers'})`;

        return `<div style="font-family:${font};font-size:12px;padding:4px 6px;">
          <div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid #e2e8f0;padding-bottom:3px;">
            ${cat} <span style="font-size:10.5px;color:#64748b;">${totalSuffix}</span>
          </div>
          ${rows}
        </div>`;
      }
    },
    grid: resolveUniversalGrid(ctx, { 
      left: isHorizontal ? Math.max(80, (ctx.barYAxisWidth || 120)) : 60, 
      right: 60, 
      top: showLegend ? 100 : 70, 
      bottom: 60 
    }),
    xAxis: isHorizontal ? valueAxis : categoryAxis,
    yAxis: isHorizontal ? categoryAxis : valueAxis,
    series: seriesList
  };
}

export function generateHorizontalBarScatterOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    primaryField,
    secondaryField,
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
    showLegend,
    showDataLabels,
    barSorting,
    scatterSortMode,
    barThickness,
    barBorderRadius = 4,
    barColorCustom,
    barYAxisWidth,
    barYAxisOverflow,
    barLineHeight,
    barYAxisFontSize,
    barValueCeiling,
    barValueInterval,
    barGridTop,
    barGridBottom,
    barGridLeft,
    barGridRight,
    customAxisTitleX,
    axisTitleGapX,
    scatterAxisTitle = 'Boundary Disclosure (%)',
    scatterAxisMin = 0,
    scatterAxisMax = 100,
    scatterAxisInterval = 25,
    scatterAxisNameGap = 28,
    scatterSeriesName = 'Boundary Disclosure Rate (%)',
    barSeriesName = 'Cohort Prevalence (%)',
    scatterSymbol = 'diamond',
    scatterSymbolSize = 14,
    scatterColor = '#d9534f',
    scatterBorderColor = '#900',
    scatterBorderWidth = 1.5,
    scatterShowDataLabels = false,
    scatterLabelPosition = 'top',
    scatterValues = {},
    otherCategoryLabel,
    umbrellanizerMap
  } = ctx;

  const totalCohort = papers.length > 0 ? papers.length : 46;
  const mappedOpts = {
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroups: ctx.levelCustomGroups,
    levelCustomGroupLinks,
    levelTargetFields: ctx.levelTargetFields,
    scopeFilter: ctx.primaryScopeFilter,
    unpackMacroToChildren: true,
    sankeyFields,
    primaryField
  };

  const countsMap = new Map<string, any[]>();
  let totalExtractedTags = 0;

  if (papers.length > 0) {
    papers.forEach(p => {
      const vals = getMappedFieldValue(p, primaryField, mappedOpts);
      vals.forEach(v => {
        totalExtractedTags++;
        if (!countsMap.has(v)) countsMap.set(v, []);
        countsMap.get(v)!.push(p);
      });
    });
  }

  const customOtherName = otherCategoryLabel?.trim() || 'Other Sectors';

  // Fallback categories if empty cohort
  let categories: string[] = [];
  let effectiveCountsMap: Map<string, any[]> = countsMap;

  if (countsMap.size > 0) {
    const activeCountsMap = limitCategoryMap(
      countsMap,
      limitCategories,
      maxCategoriesCount,
      (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags),
      customOtherName
    );
    effectiveCountsMap = activeCountsMap;
    categories = Array.from(activeCountsMap.keys());
    if (excludeEmpty || (ctx as any).excludeUnassigned) {
      categories = categories.filter(c => c !== 'Unassigned / Other' && c !== 'Unassigned');
    }
  } else {
    categories = [
      'Manufacturing',
      'Energy & Power',
      'Traffic / Smart City',
      'Automotive',
      'Agriculture / Horticulture',
      'Aerospace',
      'Smart Building',
      customOtherName
    ];
  }

  const defaultSampleBar: Record<string, number> = {
    'Manufacturing': 15,
    'Energy & Power': 4,
    'Traffic / Smart City': 7,
    'Automotive': 9,
    'Agriculture / Horticulture': 9,
    'Aerospace': 9,
    'Smart Building': 28,
    'Other Sectors': 35,
    [customOtherName]: 35
  };

  const defaultSampleScatter: Record<string, number> = {
    'Manufacturing': 43,
    'Energy & Power': 50,
    'Traffic / Smart City': 100,
    'Automotive': 50,
    'Agriculture / Horticulture': 100,
    'Aerospace': 50,
    'Smart Building': 38,
    'Other Sectors': 44,
    [customOtherName]: 44
  };

  // Build raw metrics per category
  const barDataMap = new Map<string, number>();
  const scatterDataMap = new Map<string, number>();

  categories.forEach(cat => {
    const pList = effectiveCountsMap.get(cat) || [];
    const uniqueIds = new Set(pList.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    const paperCount = uniqueIds.size;

    // 1. Primary Bar Metric
    let barVal = 0;
    if (effectiveCountsMap.size > 0 && papers.length > 0) {
      if (metricMode === 'paper_prevalence') {
        barVal = Math.round((paperCount / totalCohort) * 100);
      } else if (metricMode === 'tag_share') {
        barVal = totalExtractedTags > 0 ? Math.round((pList.length / totalExtractedTags) * 100) : 0;
      } else {
        barVal = computeMetricValue(pList, metricMode, papers.length, totalExtractedTags);
      }
    } else {
      barVal = defaultSampleBar[cat] ?? 10;
    }

    if (enableManualOverrides && manualCategoryValues[cat] !== undefined) {
      barVal = manualCategoryValues[cat];
    } else if (enableManualOverrides && manualCategoryValues[`${cat}:::bar`] !== undefined) {
      barVal = manualCategoryValues[`${cat}:::bar`];
    }

    // 2. Secondary Scatter Rate (Boundary Disclosure / Threshold Reporting)
    let scatterVal = 0;
    if (effectiveCountsMap.size > 0 && papers.length > 0 && secondaryField) {
      let disclosedCount = 0;
      const secMappedOpts = {
        ...mappedOpts,
        levelIdx: 1,
        subFieldKey: ctx.levelTargetFields?.[1],
        primaryField: secondaryField
      };
      pList.forEach(p => {
        const rawVals = getMappedFieldValue(p, secondaryField, secMappedOpts);
        const isDisclosed = rawVals.some(v => {
          const s = String(v || '').trim().toUpperCase();
          return Boolean(s) && 
            s !== 'NOT_STATED' && 
            s !== 'FALSE' && 
            s !== '0' && 
            s !== 'NONE' && 
            s !== 'UNSPECIFIED' && 
            s !== '[OBJECT OBJECT]' && 
            s !== 'UNASSIGNED / OTHER' && 
            s !== 'UNASSIGNED' && 
            s !== 'ABSENT';
        });
        if (isDisclosed) disclosedCount++;
      });
      scatterVal = paperCount > 0 ? Math.round((disclosedCount / paperCount) * 100) : 0;
    } else {
      scatterVal = defaultSampleScatter[cat] ?? 50;
    }

    if (scatterValues && scatterValues[cat] !== undefined) {
      scatterVal = scatterValues[cat];
    } else if (enableManualOverrides && manualCategoryValues[`${cat}:::scatter`] !== undefined) {
      scatterVal = manualCategoryValues[`${cat}:::scatter`];
    }

    barDataMap.set(cat, barVal);
    scatterDataMap.set(cat, scatterVal);
  });

  // Helper to identify tail / other group
  const isOther = (cat: string) => cat === 'Other' || cat === 'Other Sectors' || cat === customOtherName || cat.startsWith('Other (') || cat === 'Unassigned / Other';

  // Sorting categories based on scatterSortMode or barSorting
  const effectiveSortMode = scatterSortMode || barSorting || 'prevalence_desc';
  categories.sort((a, b) => {
    // Other category always placed at the end of categories array so after .reverse() it is at the bottom of ECharts Y-axis
    if (isOther(a)) return 1;
    if (isOther(b)) return -1;

    const barA = barDataMap.get(a) ?? 0;
    const barB = barDataMap.get(b) ?? 0;
    const scatA = scatterDataMap.get(a) ?? 0;
    const scatB = scatterDataMap.get(b) ?? 0;

    if (effectiveSortMode === 'prevalence_desc' || effectiveSortMode === 'desc') {
      return barB - barA;
    }
    if (effectiveSortMode === 'prevalence_asc' || effectiveSortMode === 'asc') {
      return barA - barB;
    }
    if (effectiveSortMode === 'scatter_desc') {
      return scatB - scatA;
    }
    if (effectiveSortMode === 'scatter_asc') {
      return scatA - scatB;
    }
    if (effectiveSortMode === 'alpha') {
      return a.localeCompare(b);
    }
    return 0; // dataset order
  });

  const barDataRaw = categories.map(c => barDataMap.get(c) ?? 0);
  const scatterDataRaw = categories.map(c => scatterDataMap.get(c) ?? 0);

  // Reverse categories and series data to render top-to-bottom in ECharts category Y-axis
  const reversedCategories = [...categories].reverse();
  const reversedBarData = [...barDataRaw].reverse();
  const reversedScatterData = [...scatterDataRaw].reverse();

  // Academic palette harmonization
  const primaryBarColor = barColorCustom || palette.colors[0] || '#2b5c8f';
  const isDefaultScatter = !scatterColor || scatterColor === '#d9534f';
  const effectiveScatterColor = isDefaultScatter ? (palette.accent || palette.colors[1] || '#d9534f') : scatterColor;
  const isDefaultBorder = !scatterBorderColor || scatterBorderColor === '#900';
  const effectiveScatterBorder = isDefaultBorder ? (palette.accent || palette.colors[1] || '#900') : scatterBorderColor;

  const maxBarVal = Math.max(...barDataRaw, 10);
  const calculatedCeiling = (typeof barValueCeiling === 'number' && barValueCeiling > 0)
    ? barValueCeiling
    : calculateNiceScientificCeiling(maxBarVal * 1.15, true);

  const calculatedInterval = (typeof barValueInterval === 'number' && barValueInterval > 0)
    ? barValueInterval
    : Math.max(5, Math.round(calculatedCeiling / 4));

  const hasEChartsTitle = Boolean(baseTitle && baseTitle.show && (baseTitle.text || baseTitle.subtext));
  const effectiveTitle = hasEChartsTitle ? baseTitle : { show: false };

  const legDist = ctx.legendDistance ?? 15;
  const resolvedLegendPos = ctx.legendPosition || 'bottom';
  const isBottom = resolvedLegendPos === 'bottom';
  const isTop = resolvedLegendPos === 'top';
  const isLeft = resolvedLegendPos === 'left';
  const isRight = resolvedLegendPos === 'right';

  const legendOrient = (isLeft || isRight) ? 'vertical' as const : 'horizontal' as const;
  const legendTop = isTop ? (hasEChartsTitle ? 55 : 15) + legDist : isBottom ? undefined : 'middle';
  const legendBottom = isBottom ? legDist : undefined;
  const legendLeft = isLeft ? legDist : isRight ? undefined : (ctx.legendAlign === 'left' ? 20 : ctx.legendAlign === 'right' ? undefined : 'center');
  const legendRight = isRight ? legDist : (ctx.legendAlign === 'right' ? 20 : undefined);

  const effectiveLabelWidth = ctx.barYAxisWidth ?? ctx.axisLabelWidthY ?? 140;
  const effectiveLabelMargin = ctx.axisLabelMarginY ?? 8;
  const showYTitle = (ctx.showAxisTitleY ?? true) && Boolean(ctx.customAxisTitleY || primaryField);
  const titleFontSize = ctx.axisTitleFontSizeY ?? Math.max(9, fontSize - 1);
  const baseCategoryClearance = effectiveLabelWidth + effectiveLabelMargin;
  const requiredYTitleClearance = showYTitle 
    ? (baseCategoryClearance + titleFontSize + 28) 
    : (baseCategoryClearance + 20);

  const autoGridTop = hasEChartsTitle ? (showLegend && isTop ? 105 + legDist : 95) : (showLegend && isTop ? 65 + legDist : 48);
  const autoGridBottom = showLegend && isBottom ? Math.max(68, 48 + (axisTitleGapX ?? 26) + legDist) : 40;
  const autoGridLeft = showLegend && isLeft ? Math.max(30, 50 + legDist) : 25;
  const autoGridRight = showLegend && isRight ? Math.max(80, 50 + legDist) : 55;

  let calculatedGridLeft = autoGridLeft;
  if (ctx.gridMarginLeft !== undefined && typeof ctx.gridMarginLeft === 'number') {
    calculatedGridLeft = ctx.gridMarginLeft;
  } else if (barGridLeft !== undefined && typeof barGridLeft === 'number') {
    calculatedGridLeft = barGridLeft;
  }

  const effectiveGridTop = barGridTop !== undefined ? barGridTop : (ctx.gridMarginTop ?? autoGridTop);
  const effectiveGridBottom = barGridBottom !== undefined ? barGridBottom : (ctx.gridMarginBottom ?? autoGridBottom);
  const effectiveGridLeft = calculatedGridLeft;
  const effectiveGridRight = barGridRight !== undefined ? barGridRight : (ctx.gridMarginRight ?? autoGridRight);

  const grid = resolveUniversalGrid(ctx, {
    top: effectiveGridTop,
    bottom: effectiveGridBottom,
    left: effectiveGridLeft,
    right: effectiveGridRight
  });

  const effectiveLegendFormat = ctx.legendFormat || ctx.barLegendFormat || 'name';
  const cleanSeriesDisplayName = (rawName: string) => {
    return rawName
      .replace(/,\s*[nN]\s*=\s*(\{[nN]\}|\d+|[nN])/gi, '')
      .replace(/\s*\([nN]\s*=\s*(\{[nN]\}|\d+|[nN])\s*\)/gi, '')
      .replace(/\s*\([nN]\s*=\s*\d+\s*\)/gi, '')
      .replace(/\s*\{[nN]\}\s*/gi, '')
      .trim();
  };

  const cleanBarName = cleanSeriesDisplayName(barSeriesName);
  const cleanScatterName = cleanSeriesDisplayName(scatterSeriesName);

  const formattedBarLegend = effectiveLegendFormat === 'name'
    ? barSeriesName
    : formatLegendLabel(cleanBarName, {
        paperCount: papers.length,
        count: papers.length,
        percent: 100,
        prevalencePct: 100,
        totalCohortPapers: papers.length,
        metricMode: 'paper_prevalence',
        decimalPrecision: ctx.decimalPrecision,
        useTildeForCoarse: ctx.useTildeForCoarse,
        ratioStyle: ctx.ratioStyle,
        forceCohortDenominator: ctx.forceCohortDenominator
      }, effectiveLegendFormat);

  const formattedScatterLegend = effectiveLegendFormat === 'name'
    ? scatterSeriesName
    : formatLegendLabel(cleanScatterName, {
        percent: 100,
        count: 100,
        totalCohortPapers: 100,
        decimalPrecision: ctx.decimalPrecision,
        useTildeForCoarse: false,
        ratioStyle: ctx.ratioStyle,
        forceCohortDenominator: false
      }, effectiveLegendFormat);

  return {
    backgroundColor: palette.bg,
    color: [primaryBarColor, effectiveScatterColor, ...palette.colors],
    title: effectiveTitle,
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (params: any) => {
        if (!params) return '';
        const categoryName = params.name || (Array.isArray(params.value) ? reversedCategories[params.dataIndex] : '');
        const rawSeries = params.seriesName || '';
        const val = typeof params.value === 'number' ? params.value : (Array.isArray(params.value) ? params.value[0] : params.value);
        return `<div style="font-family:${font};font-size:12px;padding:2px;">
          <strong>${categoryName}</strong><br/>
          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${params.color};margin-right:4px;"></span>
          ${rawSeries}: <strong>${val}%</strong>
        </div>`;
      }
    },
    legend: showLegend ? {
      ...baseLegend,
      data: [
        {
          name: formattedBarLegend,
          icon: 'roundRect',
          itemStyle: { color: primaryBarColor }
        },
        {
          name: formattedScatterLegend,
          icon: scatterSymbol || 'diamond',
          itemStyle: { color: effectiveScatterColor, borderColor: effectiveScatterBorder, borderWidth: 1 }
        }
      ],
      formatter: (name: string) => {
        if (name === formattedBarLegend) return formattedBarLegend;
        if (name === formattedScatterLegend) return formattedScatterLegend;
        return name;
      },
      orient: legendOrient,
      top: legendTop,
      bottom: legendBottom,
      left: legendLeft,
      right: legendRight,
      align: ctx.legendAlign || baseLegend.align,
      itemWidth: ctx.legendItemWidth ?? baseLegend.itemWidth,
      itemHeight: ctx.legendItemHeight ?? baseLegend.itemHeight,
      itemGap: ctx.legendItemGap ?? baseLegend.itemGap,
      textStyle: {
        ...baseLegend.textStyle,
        fontSize: ctx.legendFontSize ?? baseLegend.textStyle?.fontSize
      }
    } : { show: false },
    grid,
    xAxis: [
      {
        ...buildScientificAxisConfig('x', ctx, {
          axisKind: 'value',
          defaultTitle: customAxisTitleX || 'Cohort Share (%)',
          min: 0,
          max: calculatedCeiling,
          interval: calculatedInterval,
          defaultUnitFormatter: (v: any) => `${v}%`
        }),
        position: 'bottom',
        nameGap: axisTitleGapX ?? (ctx.axisTitleGapX ?? 26)
      },
      {
        type: 'value',
        name: scatterAxisTitle || 'Boundary Disclosure (%)',
        nameLocation: 'middle',
        nameGap: scatterAxisNameGap ?? 24,
        nameTextStyle: {
          fontFamily: font,
          fontSize: (ctx.axisTitleFontSizeX ?? Math.max(9, fontSize - 1)),
          fontWeight: (ctx.axisTitleFontWeightX || 'bold') as any,
          fontStyle: (ctx.axisTitleFontStyleX || 'normal') as any,
          color: ctx.axisTitleColorX || palette.text
        },
        min: scatterAxisMin ?? 0,
        max: scatterAxisMax ?? 100,
        interval: scatterAxisInterval ?? 25,
        position: 'top',
        axisLabel: {
          show: ctx.showAxisLabelX ?? true,
          formatter: '{value}%',
          fontFamily: font,
          fontSize: ctx.axisLabelFontSizeX ?? Math.max(8, fontSize - 2),
          fontWeight: (ctx.axisLabelFontWeightX || 'normal') as any,
          color: ctx.axisLabelColorX || palette.text
        },
        axisLine: {
          show: ctx.showAxisBaseline ?? true,
          lineStyle: { color: palette.text, width: 1.2 }
        },
        axisTick: {
          show: (ctx.axisTickDirection || 'outside') !== 'none',
          inside: (ctx.axisTickDirection || 'outside') === 'inside',
          lineStyle: { color: palette.text }
        },
        splitLine: {
          show: ctx.showGridLinesX ?? false,
          lineStyle: {
            color: ctx.gridLineColor || palette.border,
            type: (ctx.gridLineStyle || 'dashed') as any,
            opacity: (ctx.gridLineOpacity ?? 100) / 100
          }
        }
      }
    ],
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'category',
      defaultTitle: primaryField,
      categories: reversedCategories,
      inverse: false
    }),
    series: [
      {
        name: barSeriesName,
        type: 'bar',
        xAxisIndex: 0,
        barWidth: barThickness ? `${barThickness}px` : '42%',
        itemStyle: {
          color: createHorizontalGradient(primaryBarColor, 1, 0.84),
          borderColor: hexToRgba(primaryBarColor, 0.9),
          borderWidth: 0.5,
          borderRadius: [0, barBorderRadius, barBorderRadius, 0]
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: hexToRgba(primaryBarColor, 0.35)
          }
        },
        data: reversedBarData,
        label: {
          show: showDataLabels,
          position: 'right',
          distance: ctx.barLabelDistance ?? 5,
          fontFamily: font,
          fontSize: ctx.barLabelFontSize || Math.max(9, fontSize - 2),
          fontWeight: (ctx.barLabelFontWeight as any) || 'bold',
          fontStyle: (ctx.barLabelFontStyle as any) || 'normal',
          color: ctx.barLabelColor || palette.text,
          formatter: '{c}%'
        }
      },
      {
        name: scatterSeriesName,
        type: 'scatter',
        xAxisIndex: 1,
        symbol: scatterSymbol,
        symbolSize: scatterSymbolSize,
        itemStyle: {
          color: effectiveScatterColor,
          borderColor: effectiveScatterBorder,
          borderWidth: scatterBorderWidth
        },
        emphasis: {
          scale: 1.3,
          itemStyle: {
            shadowBlur: 10,
            shadowColor: hexToRgba(effectiveScatterColor, 0.5)
          }
        },
        data: reversedScatterData,
        label: {
          show: scatterShowDataLabels,
          position: scatterLabelPosition,
          distance: ctx.scatterLabelDistance ?? 5,
          fontFamily: font,
          fontSize: ctx.scatterLabelFontSize || Math.max(9, fontSize - 2),
          fontWeight: (ctx.scatterLabelFontWeight as any) || 'bold',
          fontStyle: (ctx.scatterLabelFontStyle as any) || 'normal',
          color: ctx.scatterLabelColor || palette.text,
          formatter: '{c}%'
        }
      }
    ]
  };
}
