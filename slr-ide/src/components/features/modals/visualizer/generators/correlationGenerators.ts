import type * as echarts from 'echarts';
import { 
  getFieldValue, 
  extractNumericalValue, 
  limitCategoryMap 
} from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';

export function generateScatterOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    numFieldX,
    numFieldY,
    bubbleScale,
    showLegend
  } = ctx;

  const scatterData: [number, number, string][] = papers.map(p => [
    extractNumericalValue(p, numFieldX),
    extractNumericalValue(p, numFieldY),
    p.Title || p.Paper_ID
  ]);

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { ...baseTooltip, formatter: (p: any) => `<strong>${p.data[2]}</strong><br/>${numFieldX}: ${p.data[0]}<br/>${numFieldY}: ${p.data[1]}` },
    grid: { left: '10%', right: '10%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
    xAxis: { type: 'value', name: numFieldX, nameLocation: 'middle', nameGap: 30, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    series: [{ type: 'scatter', symbolSize: Math.round(10 * bubbleScale), data: scatterData, itemStyle: { opacity: 0.8 } }]
  };
}

export function generateBubbleOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    numFieldX,
    numFieldY,
    numFieldSize,
    bubbleScale,
    showLegend
  } = ctx;

  const bubbleData: [number, number, number, string][] = papers.map(p => [
    extractNumericalValue(p, numFieldX),
    extractNumericalValue(p, numFieldY),
    extractNumericalValue(p, numFieldSize),
    p.Title || p.Paper_ID
  ]);

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { ...baseTooltip, formatter: (p: any) => `<strong>${p.data[3]}</strong><br/>${numFieldX}: ${p.data[0]}<br/>${numFieldY}: ${p.data[1]}<br/>${numFieldSize}: ${p.data[2]}` },
    grid: { left: '10%', right: '10%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
    xAxis: { type: 'value', name: numFieldX, nameLocation: 'middle', nameGap: 30, scale: true, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    series: [{ type: 'scatter', symbolSize: (d: any) => Math.max(6, Math.round(d[2] * 2 * bubbleScale)), data: bubbleData, itemStyle: { opacity: 0.75 } }]
  };
}

export function generateBoxplotOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    primaryField,
    numFieldY,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    labelRotation,
    showLegend,
    umbrellanizerMap
  } = ctx;

  const countsMap = new Map<string, any[]>();
  const fieldOpts = { useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty };

  papers.forEach(p => {
    const vals = getFieldValue(p, primaryField, fieldOpts);
    vals.forEach(v => {
      if (!countsMap.has(v)) countsMap.set(v, []);
      countsMap.get(v)!.push(p);
    });
  });

  const activeCountsMap = limitCategoryMap(
    countsMap,
    limitCategories,
    maxCategoriesCount,
    (list) => list.length
  );
  const categories = Array.from(activeCountsMap.keys()).sort();

  const boxData = categories.map(cat => {
    const pList = activeCountsMap.get(cat)!;
    const nums = pList.map(p => extractNumericalValue(p, numFieldY)).sort((a, b) => a - b);
    if (nums.length === 0) return [0, 0, 0, 0, 0];

    const min = nums[0];
    const max = nums[nums.length - 1];

    const getPercentile = (p: number) => {
      const index = (nums.length - 1) * p;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return nums[lower] * (1 - weight) + nums[upper] * weight;
    };

    const q1 = getPercentile(0.25);
    const median = getPercentile(0.5);
    const q3 = getPercentile(0.75);

    return [min, q1, median, q3, max];
  });

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { ...baseTooltip, trigger: 'item', formatter: (params: any) => `<strong>${params.name}</strong><br/>Min: ${params.data[1]}<br/>Q1: ${params.data[2]}<br/>Median: ${params.data[3]}<br/>Q3: ${params.data[4]}<br/>Max: ${params.data[5]}` },
    grid: { left: '10%', right: '10%', top: showLegend ? 110 : 80, bottom: '15%', containLabel: true },
    xAxis: { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
    yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    series: [{
      name: numFieldY,
      type: 'boxplot',
      data: boxData,
      itemStyle: { borderColor: palette.colors[0], borderWidth: 2 }
    }]
  };
}
