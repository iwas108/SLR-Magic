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

  const pSize = ctx.scatterPointSize ?? Math.round(10 * (bubbleScale || 1.0));
  const pOpacity = (ctx.scatterPointOpacity ?? 80) / 100;

  // Optional Regression Line computation
  let regressionSeries: any = null;
  if (ctx.scatterShowRegression && scatterData.length >= 2) {
    const validPts = scatterData.filter(d => !isNaN(d[0]) && !isNaN(d[1]));
    if (validPts.length >= 2) {
      if (ctx.scatterRegressionType === 'mean') {
        const meanY = validPts.reduce((acc, d) => acc + d[1], 0) / validPts.length;
        const minX = Math.min(...validPts.map(d => d[0]));
        const maxX = Math.max(...validPts.map(d => d[0]));
        regressionSeries = {
          name: 'Mean Trend',
          type: 'line' as const,
          showSymbol: false,
          data: [[minX, meanY], [maxX, meanY]],
          lineStyle: { color: palette.colors[1] || '#ef4444', width: 2, type: 'dashed' }
        };
      } else {
        // Linear Ordinary Least Squares (OLS)
        const n = validPts.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        validPts.forEach(d => {
          sumX += d[0];
          sumY += d[1];
          sumXY += d[0] * d[1];
          sumX2 += d[0] * d[0];
        });
        const denom = (n * sumX2 - sumX * sumX);
        const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
        const intercept = (sumY - slope * sumX) / n;
        const minX = Math.min(...validPts.map(d => d[0]));
        const maxX = Math.max(...validPts.map(d => d[0]));
        regressionSeries = {
          name: 'Linear OLS Fit',
          type: 'line' as const,
          showSymbol: false,
          data: [[minX, slope * minX + intercept], [maxX, slope * maxX + intercept]],
          lineStyle: { color: palette.colors[1] || '#ef4444', width: 2.2, type: 'solid' }
        };
      }
    }
  }

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { ...baseTooltip, formatter: (p: any) => `<strong>${p.data[2]}</strong><br/>${numFieldX}: ${p.data[0]}<br/>${numFieldY}: ${p.data[1]}` },
    grid: { 
      left: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0)), 
      right: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0)), 
      top: Math.max(20, (showLegend ? 100 : 70) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0)), 
      bottom: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0)), 
      containLabel: true 
    },
    xAxis: { type: 'value', name: numFieldX, nameLocation: 'middle', nameGap: 30, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    series: [
      { type: 'scatter' as const, symbolSize: pSize, data: scatterData, itemStyle: { opacity: pOpacity } },
      ...(regressionSeries ? [regressionSeries] : [])
    ]
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

  const pOpacity = (ctx.scatterPointOpacity ?? 75) / 100;

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { ...baseTooltip, formatter: (p: any) => `<strong>${p.data[3]}</strong><br/>${numFieldX}: ${p.data[0]}<br/>${numFieldY}: ${p.data[1]}<br/>${numFieldSize}: ${p.data[2]}` },
    grid: { 
      left: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0)), 
      right: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0)), 
      top: Math.max(20, (showLegend ? 100 : 70) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0)), 
      bottom: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0)), 
      containLabel: true 
    },
    xAxis: { type: 'value', name: numFieldX, nameLocation: 'middle', nameGap: 30, scale: true, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    yAxis: { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    series: [{ type: 'scatter', symbolSize: (d: any) => Math.max(6, Math.round(d[2] * 2 * (bubbleScale || 1.0))), data: bubbleData, itemStyle: { opacity: pOpacity } }]
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

  // Optional Jitter Scatter Overlay
  const jitterScatterData: [number, number, string][] = [];
  if (ctx.boxplotShowScatter) {
    categories.forEach((cat, cIdx) => {
      const pList = activeCountsMap.get(cat)!;
      pList.forEach(p => {
        const val = extractNumericalValue(p, numFieldY);
        const jitter = (Math.random() - 0.5) * 0.3;
        jitterScatterData.push([cIdx + jitter, val, p.Title || p.Paper_ID]);
      });
    });
  }

  const isHorizontal = ctx.boxplotOrientation === 'horizontal';

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: { 
      ...baseTooltip, 
      trigger: 'item', 
      formatter: (params: any) => {
        if (params.seriesType === 'scatter') {
          return `<strong>${params.data[2]}</strong><br/>${numFieldY}: ${params.data[1]}`;
        }
        return `<strong>${params.name}</strong><br/>Min: ${params.data[1]}<br/>Q1: ${params.data[2]}<br/>Median: ${params.data[3]}<br/>Q3: ${params.data[4]}<br/>Max: ${params.data[5]}`;
      } 
    },
    grid: { 
      left: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0)), 
      right: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0)), 
      top: Math.max(20, (showLegend ? 100 : 70) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0)), 
      bottom: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0)), 
      containLabel: true 
    },
    xAxis: isHorizontal
      ? { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } }
      : { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text, rotate: labelRotation } },
    yAxis: isHorizontal
      ? { type: 'category', data: categories, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text } }
      : { type: 'value', name: numFieldY, nameLocation: 'middle', nameGap: 35, axisLabel: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }, splitLine: { lineStyle: { color: palette.border, type: 'dashed' } } },
    series: [
      {
        name: numFieldY,
        type: 'boxplot' as const,
        data: boxData,
        boxWidth: [10, ctx.boxplotBoxWidth ?? 30],
        itemStyle: { borderColor: palette.colors[0], borderWidth: 2 }
      },
      ...(ctx.boxplotShowScatter ? [{
        name: 'Individual Studies',
        type: 'scatter' as const,
        data: jitterScatterData,
        symbolSize: 6,
        itemStyle: { color: palette.colors[1] || '#f59e0b', opacity: 0.6 }
      }] : [])
    ]
  };
}
