import type * as echarts from 'echarts';
import { getFieldValue, getMappedFieldValue, computeMetricValue, limitCategoryMap } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';

export function generateLineOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
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
    showLegend,
    labelRotation,
    showDataLabels,
    smoothLine,
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

  const categories = Array.from(activeCountsMap.keys()).sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
  const lineData = categories.map((cat) => {
    const pList = activeCountsMap.get(cat)!;
    const tagCount = pList.length;
    const uniquePaperIds = new Set(pList.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    const paperCount = uniquePaperIds.size;
    const val = computeMetricValue(pList, metricMode, papers.length, totalExtractedTags);
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
      template: ctx.labelFormat || 'ratio_percent',
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
      formattedLabel
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
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return renderCategoryTooltip(p?.data, p?.name);
      }
    },
    grid: { 
      left: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0)), 
      right: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0)), 
      top: Math.max(20, (showLegend ? 100 : 70) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0)), 
      bottom: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0)), 
      containLabel: true 
    },
    xAxis: { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
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
      type: 'line',
      smooth: smoothLine,
      step: (ctx.lineStepMode && ctx.lineStepMode !== 'none') ? ctx.lineStepMode : undefined,
      data: lineData,
      showSymbol: ctx.showLineMarkers ?? true,
      symbolSize: ctx.lineMarkerSize ?? 8,
      lineStyle: {
        width: ctx.lineWidth ?? 2.5
      },
      label: {
        show: showDataLabels,
        position: 'top',
        fontFamily: font,
        fontSize: fontSize - 2,
        color: palette.text,
        formatter: (params: any) => params.data?.formattedLabel ?? params.value
      },
      areaStyle: (ctx.lineAreaOpacity && ctx.lineAreaOpacity > 0) ? { opacity: ctx.lineAreaOpacity / 100 } : undefined
    }]
  };
}
