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

    return {
      name: cat,
      value: val,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct,
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
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: font,
        fontSize: fontSize - 1,
        color: palette.text,
        formatter: (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? '{value}%' : '{value}'
      },
      splitLine: { lineStyle: { color: palette.border, type: 'dashed' } }
    },
    series: [{
      name: metricMode.replace(/_/g, ' ').toUpperCase(),
      type: 'bar',
      data: valuesData,
      label: {
        show: showDataLabels,
        position: 'top',
        fontFamily: font,
        fontSize: fontSize - 2,
        color: palette.text,
        formatter: (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? '{c}%' : '{c}'
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
    const displayValStr = (typeof val === 'number' && isPctMetric) ? val.toFixed(2) : `${val}`;

    let formattedLabel = `${displayValStr}`;
    if (barLabelFormat === 'pct_only') {
      formattedLabel = `${activePctStr}%`;
    } else if (barLabelFormat === 'value_pct') {
      if (isPctMetric) {
        formattedLabel = `N=${paperCount} (${activePctStr}%)`;
      } else if (metricMode === 'count') {
        formattedLabel = `N=${paperCount} (${prevalencePct}%)`;
      } else {
        formattedLabel = `${displayValStr} (N=${paperCount})`;
      }
    } else {
      if (metricMode === 'count') {
        formattedLabel = `N=${val}`;
      } else {
        formattedLabel = `${displayValStr}${isPctMetric ? '%' : ''}`;
      }
    }

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

  const effectiveLegendFormat = ctx.legendFormat || barLegendFormat || 'name';
  const legendData = categories.map((cat, idx) => {
    const itemData = valuesData[idx];
    const label = formatLegendLabel(cat, { paperCount: itemData.paperCount, percent: itemData.activePctStr }, effectiveLegendFormat);
    return {
      name: label,
      icon: 'roundRect',
      itemStyle: {
        color: itemData.itemStyle.color
      }
    };
  });

  const legendPosMap: Record<string, any> = {
    'top-left': { top: 15, left: 20 },
    'top-center': { top: 15, left: 'center' },
    'top-right': { top: 15, right: 20 },
    'left': { left: 20, top: 'center' },
    'right': { right: 20, top: 'center' },
    'bottom-left': { bottom: 15, left: 20 },
    'bottom-center': { bottom: 15, left: 'center' },
    'bottom-right': { bottom: 15, right: 20 }
  };

  const legendPos = legendPosMap[barLegendPosition] || { bottom: 15, left: 'center' };
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

  const yWidth = barYAxisWidth || 140;
  let gridTop = 40;
  let gridBottom = 35;
  let gridLeft = Math.max(90, Math.min(220, yWidth + 16));
  let gridRight = 65;

  if (showLegend) {
    if (barLegendPosition.startsWith('top')) gridTop = 85;
    else if (barLegendPosition.startsWith('bottom')) gridBottom = 55;
    else if (barLegendPosition.includes('right')) gridRight = 140;
    else if (barLegendPosition.includes('left')) gridLeft += 120;
  }

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
    xAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: font,
        fontSize: Math.max(9, fontSize - 1),
        color: palette.text,
        formatter: (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? '{value}%' : '{value}'
      },
      splitLine: { lineStyle: { color: palette.border, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: categories,
      axisLabel: {
        fontFamily: font,
        fontSize: Math.max(9, fontSize - 1),
        color: palette.text,
        width: barYAxisWidth,
        overflow: barYAxisOverflow !== 'none' ? barYAxisOverflow : undefined,
        lineHeight: Math.max(12, fontSize + 2),
        formatter: (val: string) => {
          if (barYAxisOverflow === 'break') {
            if (val.length > 18) {
              const words = val.split(' ');
              const lines: string[] = [];
              let cur = '';
              words.forEach(w => {
                if ((cur + ' ' + w).trim().length > 20) {
                  if (cur) lines.push(cur);
                  cur = w;
                } else {
                  cur = (cur + ' ' + w).trim();
                }
              });
              if (cur) lines.push(cur);
              return lines.join('\n');
            }
            return val;
          }
          return val;
        }
      },
      axisTick: { alignWithLabel: true }
    },
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
    showLegend,
    labelRotation,
    showDataLabels,
    umbrellanizerMap
  } = ctx;

  const catSet = new Set<string>();
  const stackSet = new Set<string>();
  const rawMatrixMap = new Map<string, Map<string, any[]>>();

  const fieldOpts = { useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty };

  papers.forEach(p => {
    const primVals = getFieldValue(p, primaryField, fieldOpts);
    const secVals = getFieldValue(p, secondaryField, fieldOpts);

    primVals.forEach(pv => {
      catSet.add(pv);
      secVals.forEach(sv => {
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
    (list) => computeMetricValue(list, metricMode, papers.length)
  );

  const categories = Array.from(limitedPrimMap.keys()).sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));
  const stacks = Array.from(stackSet).sort();

  const seriesList = stacks.map((stk) => ({
    name: stk,
    type: 'bar' as const,
    stack: 'total',
    data: categories.map(cat => {
      if (cat === 'Other') {
        let otherSum = 0;
        limitedPrimMap.get('Other')?.forEach(p => {
          const secVals = getFieldValue(p, secondaryField, fieldOpts);
          if (secVals.includes(stk)) otherSum++;
        });
        return otherSum;
      }
      return computeMetricValue(rawMatrixMap.get(cat)?.get(stk) || [], metricMode, papers.length);
    }),
    label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 3, color: '#ffffff' }
  }));

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '8%', right: '8%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
    xAxis: { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
    yAxis: { type: 'value', axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    series: seriesList
  };
}
