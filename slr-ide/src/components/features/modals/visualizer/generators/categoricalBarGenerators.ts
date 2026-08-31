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
import { buildScientificAxisConfig } from './axisConfigHelper';

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
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags)
  );

  const categories = Array.from(activeCountsMap.keys()).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

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
      max: showDataLabels ? (val: any) => (!val || val.max === 0 ? 10 : Math.ceil(val.max * 1.18)) : undefined,
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
        fontFamily: font,
        fontSize: fontSize - 2,
        color: palette.text,
        formatter: (params: any) => {
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
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags)
  );

  let categories = Array.from(activeCountsMap.keys());
  if (barSorting === 'desc') {
    categories.sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      const valA = computeMetricValue(activeCountsMap.get(a)!, metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(activeCountsMap.get(b)!, metricMode, papers.length, totalExtractedTags);
      return valB - valA;
    });
  } else if (barSorting === 'asc') {
    categories.sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      const valA = computeMetricValue(activeCountsMap.get(a)!, metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(activeCountsMap.get(b)!, metricMode, papers.length, totalExtractedTags);
      return valA - valB;
    });
  } else {
    categories.sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
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
  const legendPosMap: Record<string, any> = {
    'top-left': { top: 15, left: legDist },
    'top-center': { top: legDist, left: 'center' },
    'top-right': { top: 15, right: legDist },
    'left': { left: legDist, top: 'center' },
    'right': { right: legDist, top: 'center' },
    'bottom-left': { bottom: 15, left: legDist },
    'bottom-center': { bottom: legDist, left: 'center' },
    'bottom-right': { bottom: 15, right: legDist }
  };

  const legendPos = legendPosMap[barLegendPosition] || { bottom: legDist, left: 'center' };
  const legendOrient = (barLegendPosition === 'left' || barLegendPosition === 'right') ? 'vertical' : 'horizontal';

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
    if (barLegendPosition.startsWith('top')) gridTop = 85;
    else if (barLegendPosition.startsWith('bottom')) gridBottom = 55;
    else if (barLegendPosition.includes('right')) gridRight = Math.max(gridRight, 140);
    else if (barLegendPosition.includes('left')) gridLeft += 120;
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
      type: 'scroll',
      data: legendData,
      ...legendPos,
      orient: legendOrient,
      z: 20,
      textStyle: { color: palette.text, fontFamily: font, fontSize: Math.max(9, (fontSize - 3)), fontWeight: 'bold' },
      itemWidth: 14,
      itemHeight: 10,
      itemGap: 10,
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
      max: isLabelOutside
        ? (val: any) => {
            if (!val || val.max === 0) return 10;
            const ceiling = Math.ceil(val.max * headroomFactor);
            return barBenchmarkLine ? Math.max(ceiling, Math.ceil(barBenchmarkValue * 1.15)) : ceiling;
          }
        : (barBenchmarkLine ? (val: any) => Math.max(val.max, Math.ceil(barBenchmarkValue * 1.15)) : undefined),
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
          fontFamily: font,
          fontSize: Math.max(9, fontSize - 2),
          color: barLabelPosition.startsWith('inside') ? '#ffffff' : palette.text,
          formatter: (params: any) => {
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
    levelCustomGroupLinks,
    sankeyFields,
    primaryField
  };

  papers.forEach(p => {
    const primVals = getMappedFieldValue(p, primaryField, mappedOpts);
    const secVals = getMappedFieldValue(p, secondaryField, { ...mappedOpts, primaryField: secondaryField });

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

  const limitedPrimMap = limitCategoryMap(
    primPapersMap,
    limitCategories,
    maxCategoriesCount,
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags)
  );

  const categories = Array.from(limitedPrimMap.keys()).sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
  const stacks = Array.from(stackSet).sort();

  // Compute category totals for normalized mode
  const catTotals = new Map<string, number>();
  if (ctx.stackedNormalized) {
    categories.forEach(cat => {
      let sum = 0;
      stacks.forEach(stk => {
        if (cat === 'Other') {
          const otherPapers: any[] = [];
          limitedPrimMap.get('Other')?.forEach(p => {
            const secVals = getMappedFieldValue(p, secondaryField, { ...mappedOpts, primaryField: secondaryField });
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
      if (cat === 'Other') {
        const otherPapers: any[] = [];
        limitedPrimMap.get('Other')?.forEach(p => {
          const secVals = getMappedFieldValue(p, secondaryField, { ...mappedOpts, primaryField: secondaryField });
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
