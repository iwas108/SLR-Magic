import type * as echarts from 'echarts';
import { getNodeColor } from '../utils/colorUtils';
import { 
  getFieldValue, 
  getMappedFieldValue, 
  computeMetricValue, 
  limitCategoryMap 
} from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';
import { buildScientificAxisConfig, calculateNiceScientificCeiling } from './axisConfigHelper';

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
    manualCategoryValues,
    customSliceColors,
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

  let categories = Array.from(activeCountsMap.keys()).sort((a, b) => {
    if (isOther(a)) return 1;
    if (isOther(b)) return -1;
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  if (excludeEmpty || (ctx as any).excludeUnassigned) {
    categories = categories.filter(c => c !== 'Unassigned / Other' && c !== 'Unassigned');
  }

  const effectiveLabelFormat = ctx.labelFormat || ctx.barLabelFormat || 'ratio_percent';

  const valuesData = categories.map((cat, idx) => {
    const pList = activeCountsMap.get(cat)!;
    const tagCount = pList.length;
    const uniquePaperIds = new Set(pList.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    const paperCount = uniquePaperIds.size;
    const realVal = computeMetricValue(pList, metricMode, papers.length, totalExtractedTags);
    const manualVal = manualCategoryValues[cat];
    const val = (enableManualOverrides && manualVal !== undefined) ? manualVal : realVal;
    const color = customSliceColors[cat] || getNodeColor(cat, undefined, idx, palette.colors, customSliceColors);
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

    return {
      name: cat,
      value: val,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct,
      formattedLabel,
      itemStyle: { color, borderRadius: [4, 4, 0, 0] }
    };
  });

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return renderCategoryTooltip(p?.data, p?.name);
      }
    },
    grid: { left: '8%', right: '8%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
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
    series: [{
      name: metricMode.replace(/_/g, ' ').toUpperCase(),
      type: 'bar',
      data: valuesData,
      label: {
        show: showDataLabels,
        position: 'top',
        distance: ctx.barLabelDistance ?? 5,
        rotate: ctx.barLabelRotate ?? 0,
        fontFamily: font,
        fontSize: ctx.barLabelFontSize || Math.max(9, fontSize - 2),
        fontWeight: (ctx.barLabelFontWeight as any) || 'bold',
        fontStyle: ctx.barLabelFontStyle || 'normal',
        lineHeight: ctx.barLabelLineHeight ?? (ctx.barLabelFontSize ? ctx.barLabelFontSize + 3 : 13),
        color: ctx.barLabelColor 
          ? (ctx.barLabelColor === 'foreground' ? palette.text : ctx.barLabelColor)
          : palette.text,
        formatter: (params: any) => {
          if (ctx.barLabelShowZero === false && (params.data?.paperCount === 0 || params.value === 0)) {
            return '';
          }
          if (ctx.barLabelMinThreshold !== undefined && ctx.barLabelMinThreshold > 0) {
            const rawPct = parseFloat(params.data?.prevalencePct ?? '0');
            if (!isNaN(rawPct) && rawPct < ctx.barLabelMinThreshold) return '';
          }
          return params.data?.formattedLabel ?? params.value;
        }
      }
    }]
  };
}

export function generateHorizontalBarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
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
      if (isOther(a)) return -1;
      if (isOther(b)) return 1;
      const valA = computeMetricValue(activeCountsMap.get(a)!, metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(activeCountsMap.get(b)!, metricMode, papers.length, totalExtractedTags);
      return valA - valB;
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

  const valuesData = categories.map((cat, idx) => {
    const groupPapers = activeCountsMap.get(cat) || [];
    const tagCount = groupPapers.length;
    const uniquePaperIds = new Set(groupPapers.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    const paperCount = uniquePaperIds.size;
    const realVal = computeMetricValue(groupPapers, metricMode, papers.length, totalExtractedTags);
    const manualVal = manualCategoryValues[cat];
    const val = (enableManualOverrides && manualVal !== undefined) ? manualVal : realVal;
    const color = customSliceColors[cat] || getNodeColor(cat, undefined, idx, palette.colors, customSliceColors);
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

    return {
      name: cat,
      value: val,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct,
      activePctStr,
      formattedLabel,
      itemStyle: {
        color,
        borderRadius: [0, barBorderRadius, barBorderRadius, 0]
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
      icon: 'roundRect',
      itemStyle: {
        color: itemData.itemStyle.color
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

  const markLine = barBenchmarkLine ? {
    symbol: 'none',
    lineStyle: {
      type: barBenchmarkStyle,
      color: barBenchmarkColor || '#ef4444',
      width: 2
    },
    label: {
      show: true,
      position: 'end' as const,
      formatter: `${barBenchmarkLabel || 'Target Benchmark'} (${barBenchmarkValue}${(metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? '%' : ''})`,
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 2),
      color: barBenchmarkColor || '#ef4444',
      fontWeight: 'bold' as const
    },
    data: [{ xAxis: barBenchmarkValue }]
  } : undefined;

  const isLabelOutside = showDataLabels && (!barLabelPosition || (barLabelPosition as string) === 'right' || (barLabelPosition as string) === 'outside' || !barLabelPosition.startsWith('inside'));
  const maxLabelLength = valuesData.reduce((max, d) => Math.max(max, String(d.formattedLabel || '').length), 0);
  const headroomFactor = maxLabelLength >= 40 ? 1.60 : maxLabelLength >= 25 ? 1.42 : maxLabelLength >= 14 ? 1.25 : 1.15;

  const yWidth = barYAxisWidth || 140;
  let gridTop = 40;
  let gridBottom = 35;
  let gridLeft = Math.max(90, Math.min(220, yWidth + 16));
  let gridRight = isLabelOutside ? Math.max(80, Math.min(160, Math.round(maxLabelLength * 2.6))) : 65;

  if (showLegend) {
    if (isTop) gridTop = 85 + legDist;
    else if (isBottom) gridBottom = Math.max(55, 45 + legDist);
    else if (isRight) gridRight = Math.max(gridRight, 140 + legDist);
    else if (isLeft) gridLeft += 120 + legDist;
  }

  const cPad = ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0;
  const offX = ctx.fitOffsetX ?? 0;
  const offY = ctx.fitOffsetY ?? 0;

  gridTop = Math.max(15, gridTop + cPad - offY);
  gridBottom = Math.max(15, gridBottom + cPad + offY);
  gridLeft = Math.max(20, gridLeft + cPad - offX);
  gridRight = Math.max(20, gridRight + cPad + offX);

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
      show: true,
      type: ctx.legendType || 'scroll',
      data: legendData,
      ...legendPos,
      orient: legendOrient,
      align: ctx.legendAlign || 'auto',
      z: 20,
      textStyle: { 
        color: ctx.legendTextColor || palette.text, 
        fontFamily: font, 
        fontSize: ctx.legendFontSize ?? Math.max(9, (fontSize - 3)), 
        fontWeight: (ctx.legendFontWeight as any) || 'bold' 
      },
      itemWidth: ctx.legendItemWidth ?? 14,
      itemHeight: ctx.legendItemHeight ?? 10,
      itemGap: ctx.legendItemGap ?? 10,
      backgroundColor: ctx.legendBackgroundColor || 'transparent',
      borderColor: ctx.legendBorderColor || 'transparent',
      borderWidth: ctx.legendBorderWidth ?? 0,
      borderRadius: ctx.legendBorderRadius ?? 4,
      padding: ctx.legendPadding !== undefined ? ctx.legendPadding : 5,
      pageIconColor: palette.text,
      pageTextStyle: { color: palette.text }
    } : { show: false },
    grid: {
      left: gridLeft,
      right: gridRight,
      top: gridTop,
      bottom: gridBottom,
      containLabel: false
    },
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
    series: [
      {
        name: metricMode.replace(/_/g, ' ').toUpperCase(),
        type: 'bar',
        barWidth: barThickness,
        barCategoryGap: `${barGap}%`,
        data: valuesData,
        label: {
          show: showDataLabels,
          position: barLabelPosition,
          distance: ctx.barLabelDistance ?? 5,
          rotate: ctx.barLabelRotate ?? 0,
          fontFamily: font,
          fontSize: ctx.barLabelFontSize || Math.max(9, fontSize - 2),
          fontWeight: (ctx.barLabelFontWeight as any) || 'bold',
          fontStyle: ctx.barLabelFontStyle || 'normal',
          lineHeight: ctx.barLabelLineHeight ?? (ctx.barLabelFontSize ? ctx.barLabelFontSize + 3 : 13),
          color: ctx.barLabelColor 
            ? (ctx.barLabelColor === 'foreground' ? palette.text : ctx.barLabelColor)
            : (barLabelPosition.startsWith('inside') ? '#ffffff' : palette.text),
          formatter: (params: any) => {
            if (ctx.barLabelShowZero === false && (params.data?.paperCount === 0 || params.value === 0)) {
              return '';
            }
            if (ctx.barLabelMinThreshold !== undefined && ctx.barLabelMinThreshold > 0) {
              const rawPct = parseFloat(params.data?.prevalencePct ?? '0');
              if (!isNaN(rawPct) && rawPct < ctx.barLabelMinThreshold) return '';
            }
            return params.data?.formattedLabel ?? params.value;
          }
        },
        markLine
      },
      ...(showLegend ? [{
        type: 'pie' as const,
        radius: [0, 0],
        silent: true,
        label: { show: false },
        labelLine: { show: false },
        data: legendData
      }] : [])
    ]
  };
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
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    showLegend,
    labelRotation,
    showDataLabels,
    umbrellanizerMap
  } = ctx;

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
        stackSet.add(sv);
        if (!rawMatrixMap.has(pv)) rawMatrixMap.set(pv, new Map());
        if (!rawMatrixMap.get(pv)!.has(sv)) rawMatrixMap.get(pv)!.set(sv, []);
        rawMatrixMap.get(pv)!.get(sv)!.push(p);
      });
    });
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

  const categories = Array.from(limitedPrimMap.keys()).sort((a, b) => (isOther(a) ? 1 : isOther(b) ? -1 : a.localeCompare(b)));
  const stacks = Array.from(stackSet).sort();

  // Compute category totals for normalized mode
  const catTotals = new Map<string, number>();
  if (ctx.stackedNormalized) {
    categories.forEach(cat => {
      let sum = 0;
      stacks.forEach(stk => {
        if (isOther(cat)) {
          const otherPapers: any[] = [];
          limitedPrimMap.get(cat)?.forEach(p => {
            const secVals = getMappedFieldValue(p, secondaryField, secMappedOpts);
            if (secVals.includes(stk)) otherPapers.push(p);
          });
          sum += computeMetricValue(otherPapers, metricMode, papers.length, totalExtractedTags);
        } else {
          sum += computeMetricValue(rawMatrixMap.get(cat)?.get(stk) || [], metricMode, papers.length, totalExtractedTags);
        }
      });
      catTotals.set(cat, sum);
    });
  }

  const seriesList = stacks.map((stk) => ({
    name: stk,
    type: 'bar' as const,
    stack: 'total',
    data: categories.map(cat => {
      let rawVal = 0;
      if (isOther(cat)) {
        const otherPapers: any[] = [];
        limitedPrimMap.get(cat)?.forEach(p => {
          const secVals = getMappedFieldValue(p, secondaryField, secMappedOpts);
          if (secVals.includes(stk)) {
            otherPapers.push(p);
          }
        });
        rawVal = computeMetricValue(otherPapers, metricMode, papers.length, totalExtractedTags);
      } else {
        rawVal = computeMetricValue(rawMatrixMap.get(cat)?.get(stk) || [], metricMode, papers.length, totalExtractedTags);
      }

      if (ctx.stackedNormalized) {
        const tot = catTotals.get(cat) || 0;
        return tot > 0 ? parseFloat(((rawVal / tot) * 100).toFixed(2)) : 0;
      }
      return rawVal;
    }),
    label: { 
      show: showDataLabels, 
      fontFamily: font, 
      fontSize: fontSize - 3, 
      color: '#ffffff',
      formatter: ctx.stackedNormalized ? '{c}%' : '{c}'
    }
  }));

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { 
      ...baseTooltip, 
      trigger: 'axis', 
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const cat = params[0].name;
        let rows = params.map((p: any) => {
          return `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:4px;"></span>${p.seriesName}:</span>
            <strong>${p.value}${ctx.stackedNormalized ? '%' : ''}</strong>
          </div>`;
        }).join('');
        return `<div style="font-family:${font};font-size:12px;padding:2px;">
          <strong>${cat}</strong>
          ${rows}
        </div>`;
      }
    },
    grid: { left: '8%', right: '8%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
    xAxis: buildScientificAxisConfig('x', ctx, {
      axisKind: 'category',
      defaultTitle: primaryField,
      categories: categories
    }),
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'value',
      defaultTitle: ctx.stackedNormalized ? 'Relative Proportion (%)' : 'Study Count (N)',
      max: ctx.stackedNormalized ? 100 : undefined,
      defaultUnitFormatter: (v: any) => ctx.stackedNormalized ? `${v}%` : `${v}`
    }),
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
  const effectiveScatterColor = isDefaultScatter ? (palette.colors[1] || '#d9534f') : scatterColor;
  const isDefaultBorder = !scatterBorderColor || scatterBorderColor === '#900';
  const effectiveScatterBorder = isDefaultBorder ? (palette.colors[1] || '#900') : scatterBorderColor;

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

  const autoGridTop = hasEChartsTitle ? (showLegend && isTop ? 105 + legDist : 95) : (showLegend && isTop ? 65 + legDist : 48);
  const autoGridBottom = showLegend && isBottom ? Math.max(68, 48 + (axisTitleGapX ?? 26) + legDist) : 40;
  const autoGridLeft = showLegend && isLeft ? Math.max(80, 50 + legDist) : undefined;
  const autoGridRight = showLegend && isRight ? Math.max(80, 50 + legDist) : undefined;

  const effectiveGridTop = barGridTop !== undefined ? barGridTop : autoGridTop;
  const effectiveGridBottom = barGridBottom !== undefined ? barGridBottom : autoGridBottom;
  const effectiveGridLeft = barGridLeft !== undefined ? (typeof barGridLeft === 'number' ? `${barGridLeft}%` : barGridLeft) : (autoGridLeft !== undefined ? autoGridLeft : '4%');
  const effectiveGridRight = barGridRight !== undefined ? (typeof barGridRight === 'number' ? `${barGridRight}%` : barGridRight) : (autoGridRight !== undefined ? autoGridRight : '4%');

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: effectiveTitle,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: palette.bg,
      borderColor: palette.border,
      textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const domain = params[0].name;
        const prevalence = params[0].value;
        const boundary = params[1]?.value !== undefined ? params[1].value : params[0]?.value;
        const barLabel = params[0]?.seriesName || barSeriesName;
        const scatterLabel = params[1]?.seriesName || scatterSeriesName;

        return `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">
          <strong style="color:${palette.text};font-size:13px;">${domain}</strong><br/>
          <span style="color:${palette.subtext};">${barLabel}:</span> <strong>${prevalence}%</strong><br/>
          <span style="color:${palette.subtext};">${scatterLabel}:</span> <strong>${boundary}%</strong>
        </div>`;
      }
    },
    legend: showLegend ? {
      show: true,
      type: ctx.legendType || 'plain',
      data: [
        {
          name: barSeriesName,
          icon: 'roundRect',
          itemStyle: { color: primaryBarColor }
        },
        {
          name: scatterSeriesName,
          icon: scatterSymbol || 'diamond',
          itemStyle: {
            color: effectiveScatterColor,
            borderColor: effectiveScatterBorder,
            borderWidth: scatterBorderWidth
          }
        }
      ],
      orient: legendOrient,
      top: legendTop,
      bottom: legendBottom,
      left: legendLeft,
      right: legendRight,
      align: ctx.legendAlign || 'auto',
      itemWidth: ctx.legendItemWidth ?? 20,
      itemHeight: ctx.legendItemHeight ?? 12,
      itemGap: ctx.legendItemGap ?? 14,
      backgroundColor: ctx.legendBackgroundColor || 'transparent',
      borderColor: ctx.legendBorderColor || 'transparent',
      borderWidth: ctx.legendBorderWidth ?? 0,
      borderRadius: ctx.legendBorderRadius ?? 4,
      padding: ctx.legendPadding !== undefined ? ctx.legendPadding : 5,
      textStyle: {
        fontFamily: font,
        fontSize: ctx.legendFontSize ?? Math.max(9, fontSize - 2),
        fontWeight: (ctx.legendFontWeight as any) || 'bold',
        color: ctx.legendTextColor || palette.text
      }
    } : { show: false },
    grid: {
      left: effectiveGridLeft,
      right: effectiveGridRight,
      bottom: effectiveGridBottom,
      top: effectiveGridTop,
      containLabel: true
    },
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
        splitLine: { show: false }
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
          color: primaryBarColor,
          borderRadius: [0, barBorderRadius, barBorderRadius, 0]
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
