import type * as echarts from 'echarts';
import { getFieldValue, computeMetricValue, limitCategoryMap } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';

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
    showLegend,
    labelRotation,
    showDataLabels,
    smoothLine,
    umbrellanizerMap
  } = ctx;

  const countsMap = new Map<string, any[]>();
  let totalExtractedTags = 0;

  const fieldOpts = { useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty };

  papers.forEach(p => {
    const vals = getFieldValue(p, primaryField, fieldOpts);
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

    return {
      name: cat,
      value: val,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct
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
    grid: { left: '8%', right: '8%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
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
      data: lineData,
      symbolSize: 8,
      label: { show: showDataLabels, position: 'top', fontFamily: font, fontSize: fontSize - 2, color: palette.text },
      areaStyle: { opacity: 0.15 }
    }]
  };
}
