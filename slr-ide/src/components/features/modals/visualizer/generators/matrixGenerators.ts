import type * as echarts from 'echarts';
import { getFieldValue, getMappedFieldValue, limitCategoryMap } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { buildScientificAxisConfig } from './axisConfigHelper';

export function generateHeatmapOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseTooltip,
    primaryField,
    secondaryField,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    labelRotation,
    showLegend,
    showDataLabels,
    customCategoryMap,
    levelCustomGroupLinks,
    umbrellanizerMap
  } = ctx;

  const fieldOpts = { 
    useUmbrellanizer, 
    umbrellanizerMap, 
    splitMultiValues, 
    excludeEmpty,
    customCategoryMap,
    levelCustomGroups: ctx.levelCustomGroups,
    levelCustomGroupLinks,
    levelTargetFields: ctx.levelTargetFields,
    scopeFilter: ctx.primaryScopeFilter
  };

  const secFieldOpts = {
    ...fieldOpts,
    primaryField: secondaryField,
    subFieldKey: ctx.levelTargetFields?.[1],
    levelIdx: 1,
    scopeFilter: ctx.secondaryScopeFilter
  };

  const countsP = new Map<string, any[]>();
  const countsS = new Map<string, any[]>();

  papers.forEach(p => {
    getMappedFieldValue(p, primaryField, { ...fieldOpts, primaryField, subFieldKey: ctx.levelTargetFields?.[0] }).forEach(v => {
      if (!countsP.has(v)) countsP.set(v, []);
      countsP.get(v)!.push(p);
    });
    getMappedFieldValue(p, secondaryField, secFieldOpts).forEach(v => {
      if (!countsS.has(v)) countsS.set(v, []);
      countsS.get(v)!.push(p);
    });
  });

  const activeCountsP = limitCategoryMap(countsP, limitCategories, maxCategoriesCount, list => list.length);
  const activeCountsS = limitCategoryMap(countsS, limitCategories, maxCategoriesCount, list => list.length);

  const catXSet = new Set<string>();
  const catYSet = new Set<string>();
  const matrixMap = new Map<string, Map<string, number>>();

  papers.forEach(p => {
    const rawP = getMappedFieldValue(p, primaryField, { ...fieldOpts, primaryField, subFieldKey: ctx.levelTargetFields?.[0] });
    const rawS = getMappedFieldValue(p, secondaryField, secFieldOpts);

    const primVals = Array.from(new Set(rawP.map(v => activeCountsP.has(v) ? v : 'Other')));
    const secVals = Array.from(new Set(rawS.map(v => activeCountsS.has(v) ? v : 'Other')));

    primVals.forEach(pv => {
      catXSet.add(pv);
      secVals.forEach(sv => {
        catYSet.add(sv);
        if (!matrixMap.has(pv)) matrixMap.set(pv, new Map());
        matrixMap.get(pv)!.set(sv, (matrixMap.get(pv)!.get(sv) || 0) + 1);
      });
    });
  });

  const xData = Array.from(catXSet).sort();
  const yData = Array.from(catYSet).sort();
  const heatData: [number, number, number][] = [];
  let maxVal = 1;

  xData.forEach((xVal, i) => {
    yData.forEach((yVal, j) => {
      const count = matrixMap.get(xVal)?.get(yVal) || 0;
      heatData.push([i, j, count]);
      if (count > maxVal) maxVal = count;
    });
  });

  const colorMapPresets: Record<string, string[]> = {
    academic: [palette.bg, palette.colors[2] || '#3b82f6', palette.colors[0] || '#0f172a'],
    viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
    plasma: ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'],
    thermal: ['#0508b8', '#1e90ff', '#00ff7f', '#ffff00', '#ff4500', '#b22222'],
    coolwarm: ['#3b4cc0', '#8cb2e9', '#f2f2f2', '#f49a7b', '#b40426']
  };
  const activeColorMap = colorMapPresets[ctx.heatmapColorPreset || 'academic'] || colorMapPresets.academic;

  return {
    backgroundColor: palette.bg,
    title: baseTitle,
    tooltip: { ...baseTooltip, formatter: (p: any) => `${xData[p.data[0]]} × ${yData[p.data[1]]}: ${p.data[2]} papers` },
    grid: { 
      left: Math.max(20, 60 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0)), 
      right: Math.max(20, 60 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0)), 
      top: Math.max(20, (showLegend ? 100 : 70) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0)), 
      bottom: Math.max(20, 50 + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0)), 
      containLabel: true 
    },
    xAxis: buildScientificAxisConfig('x', ctx, {
      axisKind: 'category',
      defaultTitle: primaryField,
      categories: xData
    }),
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'category',
      defaultTitle: secondaryField,
      categories: yData
    }),
    visualMap: { 
      min: 0, 
      max: maxVal, 
      calculable: true, 
      orient: 'horizontal', 
      left: 'center', 
      bottom: '2%', 
      inRange: { color: activeColorMap }, 
      textStyle: { fontFamily: font, color: palette.text } 
    },
    series: [{ 
      type: 'heatmap', 
      data: heatData, 
      itemStyle: {
        borderRadius: ctx.heatmapCellRadius ?? 0
      },
      label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 2, color: palette.text } 
    }]
  };
}

export function generateCalendarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    baseTitle,
    baseTooltip,
    showLegend
  } = ctx;

  const dateMap = new Map<string, number>();
  papers.forEach(p => {
    const dt = p.created_at || p.imported_at;
    if (dt) {
      const dateStr = String(dt).substring(0, 10);
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
      }
    }
  });

  const calendarData = Array.from(dateMap.entries()).map(([d, val]) => [d, val]);

  let minYear = '2026';
  let maxYear = '2026';
  if (calendarData.length > 0) {
    const years = calendarData.map(d => String(d[0]).substring(0, 4)).sort();
    minYear = years[0];
    maxYear = years[years.length - 1];
  }

  const effectiveRange = (ctx.calendarYear && ctx.calendarYear !== 'auto') 
    ? ctx.calendarYear 
    : (minYear === maxYear ? minYear : [minYear, maxYear]);

  const maxVal = Math.max(...calendarData.map(d => Number(d[1])), 5);

  return {
    backgroundColor: palette.bg,
    title: baseTitle,
    tooltip: { ...baseTooltip, formatter: (p: any) => `${p.data[0]}: ${p.data[1]} papers ingested` },
    visualMap: {
      min: 0,
      max: maxVal,
      type: 'continuous',
      orient: 'horizontal',
      left: 'center',
      bottom: '2%',
      inRange: { color: [palette.bg, palette.colors[2] || '#3b82f6', palette.colors[0] || '#0f172a'] },
      textStyle: { fontFamily: font, color: palette.text }
    },
    calendar: {
      top: showLegend ? 110 : 80,
      left: 60,
      right: 40,
      cellSize: ['auto', ctx.calendarCellSize ?? 14],
      range: effectiveRange,
      itemStyle: { borderWidth: 1, borderColor: palette.border },
      yearLabel: { show: true, color: palette.text, fontFamily: font },
      dayLabel: { color: palette.text, fontFamily: font },
      monthLabel: { color: palette.text, fontFamily: font }
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: calendarData
    }]
  };
}
