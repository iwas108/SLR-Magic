import type * as echarts from 'echarts';
import { getNodeColor, getContrastingTextColor, generateDistinctPalette, hexToRgba, createVerticalGradient, createHorizontalGradient, resolvePaletteAccent } from '../utils/colorUtils';
import { 
  getMappedFieldValue, 
  computeMetricValue, 
  limitCategoryMap,
  formatVariableDisplayName
} from '../utils/dataExtractor';
import { CUSTOM_GROUPING_KEY } from '../constants/defaultConfigs';
import { computeGroupStatistics, getErrorBounds } from '../utils/statisticalUtils';
import { getSeriesPatternStyle } from '../utils/hatchPatternUtils';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';
import { buildScientificAxisConfig, calculateNiceScientificCeiling, resolveUniversalGrid } from './axisConfigHelper';

export function generateClusteredBarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
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
    labelRotation,
    showDataLabels,
    barSorting,
    barOrientation = 'horizontal',
    barThickness,
    barBorderRadius,
    barGap = 15,
    barClusterGap = 20,
    barInnerGap = 15,
    enableErrorBars = false,
    errorBarType = 'std_error',
    enableHatchPatterns = false,
    axisScaleType = 'linear',
    axisTickDirection = 'outside',
    showAxisBaseline = true,
    customAxisTitleX,
    customAxisTitleY,
    barLabelPosition = 'right',
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
    legendFormat,
    umbrellanizerMap
  } = ctx;

  const isHorizontal = barOrientation === 'horizontal';

  // 1. Build 2D Co-occurrence matrix
  const catSet = new Set<string>();
  const seriesSet = new Set<string>();
  const matrixMap = new Map<string, Map<string, any[]>>();
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
    scopeFilter: ctx.primaryScopeFilter,
    unpackMacroToChildren: true,
    sankeyFields,
    primaryField
  };

  const secMappedOpts = {
    ...mappedOpts,
    primaryField: secondaryField,
    subFieldKey: ctx.levelTargetFields?.[1],
    levelIdx: 1,
    scopeFilter: ctx.secondaryScopeFilter,
    unpackMacroToChildren: false
  };

  papers.forEach(p => {
    const primVals = getMappedFieldValue(p, primaryField, mappedOpts);
    const secVals = getMappedFieldValue(p, secondaryField, secMappedOpts);

    primVals.forEach(pv => {
      catSet.add(pv);
      secVals.forEach(sv => {
        totalExtractedTags++;
        seriesSet.add(sv);
        if (!matrixMap.has(pv)) matrixMap.set(pv, new Map());
        if (!matrixMap.get(pv)!.has(sv)) matrixMap.get(pv)!.set(sv, []);
        matrixMap.get(pv)!.get(sv)!.push(p);
      });
    });
  });

  // Aggregate papers per primary category for sorting and limitation
  const primAggregatePapersMap = new Map<string, any[]>();
  catSet.forEach(cat => {
    const pList: any[] = [];
    matrixMap.get(cat)?.forEach(list => pList.push(...list));
    primAggregatePapersMap.set(cat, pList);
  });

  const effectiveOtherLabel = ctx.otherCategoryLabel || 'Other';
  const isOther = (cat: string) => cat === effectiveOtherLabel || cat === 'Other';

  // Limit categories if enabled
  const limitedPrimMap = limitCategoryMap(
    primAggregatePapersMap,
    limitCategories,
    maxCategoriesCount,
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags),
    effectiveOtherLabel
  );

  // Determine sorted category list
  let categories = Array.from(limitedPrimMap.keys());
  if (excludeEmpty || (ctx as any).excludeUnassigned) {
    categories = categories.filter(c => c !== 'Unassigned / Other' && c !== 'Unassigned');
  }
  if (barSorting === 'desc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const valA = computeMetricValue(limitedPrimMap.get(a) || [], metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(limitedPrimMap.get(b) || [], metricMode, papers.length, totalExtractedTags);
      return valB - valA;
    });
  } else if (barSorting === 'asc') {
    categories.sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      const valA = computeMetricValue(limitedPrimMap.get(a) || [], metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(limitedPrimMap.get(b) || [], metricMode, papers.length, totalExtractedTags);
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

  let seriesList = Array.from(seriesSet).sort();
  if (excludeEmpty || (ctx as any).excludeUnassigned) {
    seriesList = seriesList.filter(s => s !== 'Unassigned / Other' && s !== 'Unassigned');
  }

  // 2. Build Series Payload
  const effectiveLegendFormat = legendFormat || barLegendFormat || 'name';
  const isPctMetric = metricMode === 'paper_prevalence' || metricMode === 'tag_share';

  const distinctPalette = generateDistinctPalette(palette.colors, seriesList.length);
  const seriesObjects: any[] = seriesList.map((seriesKey, sIdx) => {
    const baseColor = customSliceColors[seriesKey] || distinctPalette[sIdx] || getNodeColor(seriesKey, undefined, sIdx, palette.colors, customSliceColors);
    const patternStyle = getSeriesPatternStyle(sIdx, baseColor, enableHatchPatterns);

    const seriesData = categories.map(cat => {
      let groupPapers: any[] = [];
      if (isOther(cat)) {
        limitedPrimMap.get(cat)?.forEach(p => {
          const secVals = getMappedFieldValue(p, secondaryField, secMappedOpts);
          if (secVals.includes(seriesKey)) {
            groupPapers.push(p);
          }
        });
      } else {
        groupPapers = matrixMap.get(cat)?.get(seriesKey) || [];
      }

      const tagCount = groupPapers.length;
      const uniquePaperIds = new Set(groupPapers.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
      const paperCount = uniquePaperIds.size;
      const realVal = computeMetricValue(groupPapers, metricMode, papers.length, totalExtractedTags);
      
      const manualKey = `${cat}:::${seriesKey}`;
      const manualVal = manualCategoryValues[manualKey] ?? manualCategoryValues[cat];
      const val = (enableManualOverrides && manualVal !== undefined) ? manualVal : realVal;

      const prevalencePct = papers.length > 0 ? ((paperCount / papers.length) * 100).toFixed(2) : '0.00';
      const tagPct = totalExtractedTags > 0 ? ((tagCount / totalExtractedTags) * 100).toFixed(2) : '0.00';
      const activePctStr = metricMode === 'tag_share' ? tagPct : prevalencePct;
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

      // Statistical Error Bounds
      let statsObj = undefined;
      let errorBounds = undefined;
      if (enableErrorBars && (metricMode === 'avg_qa' || metricMode === 'avg_citation')) {
        const numTargetKey = metricMode === 'avg_qa' ? 'Overall_QA' : 'citation_count';
        statsObj = computeGroupStatistics(groupPapers, numTargetKey);
        errorBounds = getErrorBounds(statsObj, errorBarType);
      }

      return {
        name: cat,
        seriesName: seriesKey,
        value: val,
        paperCount,
        tagCount,
        prevalencePct,
        tagPct,
        activePctStr,
        formattedLabel,
        stats: statsObj,
        errorBounds,
        itemStyle: {
          ...(enableHatchPatterns ? patternStyle : {
            color: isHorizontal ? createHorizontalGradient(baseColor, 1, 0.84) : createVerticalGradient(baseColor, 1, 0.84),
            borderColor: hexToRgba(baseColor, 0.9),
            borderWidth: 0.5
          }),
          borderRadius: isHorizontal 
            ? [0, barBorderRadius, barBorderRadius, 0]
            : [barBorderRadius, barBorderRadius, 0, 0]
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 10,
            shadowColor: hexToRgba(baseColor, 0.35)
          }
        }
      };
    });

    const seriesUniquePapersSet = new Set<string>();
    papers.forEach(p => {
      const secVals = getMappedFieldValue(p, secondaryField, secMappedOpts);
      if (secVals.includes(seriesKey)) {
        seriesUniquePapersSet.add(p.Paper_ID || p.id || p.title || p.Title || JSON.stringify(p));
      }
    });
    const seriesTotalCount = seriesUniquePapersSet.size;
    const seriesTotalTags = seriesData.reduce((acc, d) => acc + d.tagCount, 0);
    const seriesLegendLabel = formatLegendLabel(seriesKey, {
      paperCount: seriesTotalCount,
      tagCount: seriesTotalTags,
      totalCohortPapers: papers.length,
      totalExtractedTags,
      metricMode,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    }, effectiveLegendFormat);

    const labelPos = ctx.universalLabelPosition && ctx.universalLabelPosition !== 'auto'
      ? (isHorizontal ? (ctx.universalLabelPosition === 'outside' ? 'right' : ctx.universalLabelPosition) : (ctx.universalLabelPosition === 'outside' ? 'top' : ctx.universalLabelPosition))
      : (isHorizontal 
          ? (barLabelPosition === 'inside' ? 'inside' : barLabelPosition === 'insideLeft' ? 'insideLeft' : barLabelPosition === 'insideRight' ? 'insideRight' : 'right')
          : (barLabelPosition === 'inside' ? 'inside' : barLabelPosition === 'insideLeft' ? 'insideBottom' : barLabelPosition === 'insideRight' ? 'insideTop' : 'top'));
    const labelDist = ctx.universalLabelDistance ?? ctx.barLabelDistance ?? 5;
    const labelRot = ctx.universalLabelRotate ?? ctx.barLabelRotate ?? 0;
    const labelFSize = ctx.universalLabelFontSize ?? ctx.barLabelFontSize ?? Math.max(9, fontSize - 2);
    const labelFWeight = (ctx.universalLabelFontWeight || ctx.barLabelFontWeight || 'bold') as any;
    const labelFStyle = (ctx.universalLabelFontStyle || ctx.barLabelFontStyle || 'normal') as any;
    const labelLHeight = ctx.universalLabelLineHeight ?? ctx.barLabelLineHeight ?? (labelFSize + 3);
    const minThresh = ctx.universalLabelMinThreshold ?? ctx.barLabelMinThreshold ?? 0;
    const showZero = ctx.universalLabelShowZero ?? ctx.barLabelShowZero ?? true;

    return {
      name: seriesLegendLabel,
      rawSeriesKey: seriesKey,
      type: 'bar',
      barWidth: barThickness,
      barGap: `${barInnerGap}%`,
      barCategoryGap: `${barClusterGap}%`,
      itemStyle: {
        ...patternStyle,
        borderRadius: isHorizontal 
          ? [0, barBorderRadius, barBorderRadius, 0]
          : [barBorderRadius, barBorderRadius, 0, 0]
      },
      data: seriesData,
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
        color: (() => {
          const mode = ctx.barLabelColor ?? '';
          if (mode === '' || mode === 'match_series') {
            return (barLabelPosition || '').startsWith('inside') ? getContrastingTextColor(baseColor) : baseColor;
          }
          if (mode === 'foreground' || mode === 'theme' || mode === 'theme_contrast') {
            return palette.text;
          }
          if (mode === '#111827' || mode === '#ffffff' || mode.startsWith('#') || mode.startsWith('rgb')) {
            return mode;
          }
          if (ctx.universalLabelColor) {
            return ctx.universalLabelColor === 'foreground' ? palette.text : ctx.universalLabelColor;
          }
          return (barLabelPosition || '').startsWith('inside') ? getContrastingTextColor(baseColor) : baseColor;
        })(),
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
    };
  });

  // 3. Reference Benchmark Line
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
      formatter: `${barBenchmarkLabel || 'Target Benchmark'} (${barBenchmarkValue}${isPctMetric ? '%' : ''})`,
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 2),
      color: benchmarkColor,
      fontWeight: 'bold' as const
    },
    data: [
      isHorizontal ? { xAxis: barBenchmarkValue } : { yAxis: barBenchmarkValue }
    ]
  } : undefined;

  if (markLine && seriesObjects.length > 0) {
    seriesObjects[0].markLine = markLine;
  }

  // 4. Legend Setup
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

  const effectiveLegendPos = legendPosMap[resolvedPosKey] || { bottom: legDist, left: 'center' };
  const legendOrient = (isLeft || isRight) ? 'vertical' : 'horizontal';

  // 5. Grid Layout Calculations
  const isLabelOutside = showDataLabels && (!barLabelPosition || (barLabelPosition as string) === 'right' || (barLabelPosition as string) === 'top' || !barLabelPosition.startsWith('inside'));
  let maxLabelLength = 0;
  seriesObjects.forEach(s => {
    (s.data || []).forEach((d: any) => {
      const len = String(d?.formattedLabel || '').length;
      if (len > maxLabelLength) maxLabelLength = len;
    });
  });
  const headroomFactor = isHorizontal 
    ? (maxLabelLength >= 40 ? 1.60 : maxLabelLength >= 25 ? 1.42 : maxLabelLength >= 14 ? 1.25 : 1.15)
    : 1.18;

  const yWidth = barYAxisWidth || 140;
  let defGridTop = 45;
  let defGridBottom = isHorizontal ? 35 : 45;
  let defGridLeft = isHorizontal ? Math.max(90, Math.min(240, yWidth + 16)) : 60;
  let defGridRight = (isHorizontal && isLabelOutside) ? Math.max(80, Math.min(160, Math.round(maxLabelLength * 2.6))) : 65;

  const grid = resolveUniversalGrid(ctx, {
    top: defGridTop,
    bottom: defGridBottom,
    left: defGridLeft,
    right: defGridRight
  });

  // 6. Metric Unit and Axis Titles
  const metricLabel = metricMode === 'paper_prevalence' 
    ? 'Prevalence (% of Cohort)'
    : metricMode === 'tag_share'
    ? 'Tag Share (%)'
    : metricMode === 'avg_qa'
    ? 'Average QA Score (%)'
    : metricMode === 'avg_citation'
    ? 'Average Citation Count'
    : 'Study Count (N)';

  const defaultTitleX = isHorizontal ? metricLabel : (customAxisTitleX?.trim() || '');
  const defaultTitleY = isHorizontal ? (customAxisTitleY?.trim() || '') : metricLabel;

  const finalTitleX = customAxisTitleX?.trim() || defaultTitleX;
  const finalTitleY = customAxisTitleY?.trim() || defaultTitleY;

  // 7. Axis Configurations
  const categoryAxisConfig = buildScientificAxisConfig(isHorizontal ? 'y' : 'x', ctx, {
    axisKind: 'category',
    defaultTitle: isHorizontal ? (customAxisTitleY?.trim() || '') : (customAxisTitleX?.trim() || ''),
    categories: categories,
    inverse: isHorizontal
  });

  const explicitCeiling = typeof ctx.barValueCeiling === 'number' && ctx.barValueCeiling > 0 ? ctx.barValueCeiling : undefined;
  const explicitInterval = typeof ctx.barValueInterval === 'number' && ctx.barValueInterval > 0 ? ctx.barValueInterval : undefined;

  const valueAxisConfig = buildScientificAxisConfig(isHorizontal ? 'x' : 'y', ctx, {
    axisKind: 'value',
    defaultTitle: isHorizontal ? (customAxisTitleX || metricLabel) : metricLabel,
    max: explicitCeiling !== undefined
      ? explicitCeiling
      : (val: any) => {
          if (!val || val.max === 0) return isPctMetric ? 10 : 5;
          const ceiling = isLabelOutside ? val.max * headroomFactor : val.max;
          const neededMax = barBenchmarkLine ? Math.max(ceiling, barBenchmarkValue * 1.15) : ceiling;
          return calculateNiceScientificCeiling(neededMax, isPctMetric);
        },
    interval: explicitInterval,
    defaultUnitFormatter: (v: any) => isPctMetric ? `${v}%` : `${v}`
  });

  const seriesColors = seriesObjects.map((s: any) => s.itemStyle?.color).filter(Boolean);

  let errorBarSeries: any = null;
  if (enableErrorBars && (metricMode === 'avg_qa' || metricMode === 'avg_citation')) {
    const errData: any[] = [];
    const numTargetKey = metricMode === 'avg_qa' ? 'Overall_QA' : 'citation_count';
    const seriesCount = seriesList.length;

    categories.forEach((cat, cIdx) => {
      const secMap = matrixMap.get(cat);
      seriesList.forEach((sKey: string, sIdx: number) => {
        const pList = secMap?.get(sKey) || [];
        const stats = computeGroupStatistics(pList, numTargetKey);
        const bounds = getErrorBounds(stats, errorBarType);
        errData.push([cIdx, sIdx, bounds.lower, bounds.upper]);
      });
    });

    errorBarSeries = {
      name: 'Error Bounds',
      type: 'custom',
      renderItem: (params: any, api: any) => {
        const cIdx = api.value(0);
        const sIdx = api.value(1);
        const low = api.value(2);
        const high = api.value(3);
        const halfCap = 4;
        const strokeColor = palette.text;
        const step = (barThickness ?? 22) * (1 + (barInnerGap ?? 15) / 100);
        const clusterOffset = (sIdx - (seriesCount - 1) / 2) * step;

        if (isHorizontal) {
          const yCenter = api.coord([0, cIdx])[1] + clusterOffset;
          const xLow = api.coord([low, cIdx])[0];
          const xHigh = api.coord([high, cIdx])[0];
          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: { x1: xLow, y1: yCenter, x2: xHigh, y2: yCenter },
                style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
              },
              {
                type: 'line',
                shape: { x1: xLow, y1: yCenter - halfCap, x2: xLow, y2: yCenter + halfCap },
                style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
              },
              {
                type: 'line',
                shape: { x1: xHigh, y1: yCenter - halfCap, x2: xHigh, y2: yCenter + halfCap },
                style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
              }
            ]
          };
        } else {
          const xCenter = api.coord([cIdx, 0])[0] + clusterOffset;
          const yLow = api.coord([cIdx, low])[1];
          const yHigh = api.coord([cIdx, high])[1];
          return {
            type: 'group',
            children: [
              {
                type: 'line',
                shape: { x1: xCenter, y1: yLow, x2: xCenter, y2: yHigh },
                style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
              },
              {
                type: 'line',
                shape: { x1: xCenter - halfCap, y1: yLow, x2: xCenter + halfCap, y2: yLow },
                style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
              },
              {
                type: 'line',
                shape: { x1: xCenter - halfCap, y1: yHigh, x2: xCenter + halfCap, y2: yHigh },
                style: api.style({ stroke: strokeColor, lineWidth: 1.5 })
              }
            ]
          };
        }
      },
      data: errData,
      z: 10,
      silent: true
    };
  }

  return {
    backgroundColor: palette.bg,
    color: seriesColors.length > 0 ? seriesColors : palette.colors,
    title: baseTitle,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: palette.bg,
      borderColor: palette.border,
      textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const catName = params[0].name;
        const rows = params.map(p => {
          const d = p.data;
          const sName = p.seriesName || d?.seriesName || '';
          const valDisplay = d?.formattedLabel ?? p.value;
          const marker = `<span style="display:inline-block;margin-right:4px;border-radius:2px;width:10px;height:10px;background-color:${p.color};"></span>`;
          return `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
            <span>${marker}<strong>${sName}:</strong></span>
            <span><strong>${valDisplay}</strong></span>
          </div>`;
        }).join('');

        return `<div style="font-family:${font};font-size:12px;padding:3px;min-width:160px;">
          <div style="font-weight:bold;color:${palette.text};border-bottom:1px solid ${palette.border};padding-bottom:3px;margin-bottom:4px;">
            ${catName}
          </div>
          ${rows}
        </div>`;
      }
    },
    legend: showLegend ? {
      ...baseLegend,
      data: seriesObjects.map(s => s.name),
      ...effectiveLegendPos,
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
    xAxis: isHorizontal ? valueAxisConfig : categoryAxisConfig,
    yAxis: isHorizontal ? categoryAxisConfig : valueAxisConfig,
    series: [
      ...seriesObjects,
      ...(errorBarSeries ? [errorBarSeries] : [])
    ]
  };
}
