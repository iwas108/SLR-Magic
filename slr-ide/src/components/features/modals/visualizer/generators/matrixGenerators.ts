import type * as echarts from 'echarts';
import { getFieldValue, getMappedFieldValue, limitCategoryMap } from '../utils/dataExtractor';
import { resolvePaletteHeatScale } from '../utils/colorUtils';
import type { ChartGeneratorContext } from './types';
import { buildScientificAxisConfig, resolveUniversalGrid } from './axisConfigHelper';

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

  const activeCountsP = limitCategoryMap(countsP, limitCategories, maxCategoriesCount, list => list.length, ctx.otherCategoryLabel || 'Other');
  const activeCountsS = limitCategoryMap(countsS, limitCategories, maxCategoriesCount, list => list.length, ctx.otherCategoryLabel || 'Other');

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
    academic: resolvePaletteHeatScale(palette),
    viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
    plasma: ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'],
    thermal: ['#0508b8', '#1e90ff', '#00ff7f', '#ffff00', '#ff4500', '#b22222'],
    coolwarm: ['#3b4cc0', '#8cb2e9', '#f2f2f2', '#f49a7b', '#b40426']
  };
  const activeColorMap = colorMapPresets[ctx.heatmapColorPreset || 'academic'] || colorMapPresets.academic;

  const labelFSize = ctx.universalLabelFontSize ?? (fontSize - 2);
  const labelFWeight = (ctx.universalLabelFontWeight || 'normal') as any;
  const labelFStyle = (ctx.universalLabelFontStyle || 'normal') as any;
  const minThresh = ctx.universalLabelMinThreshold ?? 0;
  const showZero = ctx.universalLabelShowZero ?? true;

  return {
    backgroundColor: palette.bg,
    title: baseTitle,
    tooltip: { ...baseTooltip, formatter: (p: any) => `${xData[p.data[0]]} × ${yData[p.data[1]]}: ${p.data[2]} papers` },
    grid: resolveUniversalGrid(ctx, { left: 60, right: 60, top: showLegend !== false ? 100 : 70, bottom: 50 }),
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
      show: showLegend !== false,
      min: 0, 
      max: maxVal, 
      calculable: true, 
      orient: (ctx.legendPosition === 'left' || ctx.legendPosition === 'right') ? 'vertical' : 'horizontal', 
      left: ctx.legendPosition === 'left' ? (ctx.legendDistance ?? 15) : ctx.legendPosition === 'right' ? undefined : (ctx.legendAlign === 'left' ? 20 : ctx.legendAlign === 'right' ? undefined : 'center'), 
      right: ctx.legendPosition === 'right' ? (ctx.legendDistance ?? 15) : (ctx.legendAlign === 'right' ? 20 : undefined),
      top: ctx.legendPosition === 'top' ? (baseTitle?.show ? 55 : 15) + (ctx.legendDistance ?? 0) : undefined,
      bottom: (!ctx.legendPosition || ctx.legendPosition === 'bottom') ? (ctx.legendDistance ?? 10) : undefined, 
      inRange: { color: activeColorMap }, 
      textStyle: { 
        fontFamily: font, 
        fontSize: ctx.legendFontSize ?? Math.max(9, fontSize - 2),
        fontWeight: (ctx.legendFontWeight as any) || 'normal',
        fontStyle: (ctx.legendFontStyle as any) || 'normal',
        color: ctx.legendTextColor || palette.text 
      } 
    },
    series: [{ 
      type: 'heatmap', 
      data: heatData, 
      itemStyle: {
        borderWidth: 1,
        borderColor: palette.bg,
        borderRadius: ctx.heatmapCellRadius ?? 0
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.25)',
          borderColor: palette.accent || palette.colors[0] || palette.text
        }
      },
      label: { 
        show: showDataLabels, 
        fontFamily: font, 
        fontSize: labelFSize, 
        fontWeight: labelFWeight,
        fontStyle: labelFStyle,
        color: ctx.universalLabelColor || palette.text,
        formatter: (params: any) => {
          const val = params.data?.[2] ?? params.value;
          if (!showZero && val === 0) return '';
          if (minThresh > 0 && typeof val === 'number' && val < minThresh) return '';
          return `${val}`;
        }
      } 
    }]
  };
}

export function generateCalendarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseTooltip,
    showLegend
  } = ctx;

  const dateMap = new Map<string, number>();
  papers.forEach(p => {
    const rawDate = p.Publication_Date || p.publication_date || p.Date || p.created_at || p.imported_at;
    if (rawDate) {
      const dateStr = String(rawDate).trim().substring(0, 10).replace(/\//g, '-');
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
      } else if (dateStr.match(/^\d{4}$/)) {
        const synthDate = `${dateStr}-01-01`;
        dateMap.set(synthDate, (dateMap.get(synthDate) || 0) + 1);
      }
    } else if (p.Year && String(p.Year).trim().match(/^\d{4}$/)) {
      const synthDate = `${String(p.Year).trim()}-01-01`;
      dateMap.set(synthDate, (dateMap.get(synthDate) || 0) + 1);
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

  const colorMapPresets: Record<string, string[]> = {
    academic: resolvePaletteHeatScale(palette),
    viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
    plasma: ['#0d0887', '#6a00a8', '#b12a90', '#e16462', '#fca636', '#f0f921'],
    thermal: ['#0508b8', '#1e90ff', '#00ff7f', '#ffff00', '#ff4500', '#b22222'],
    coolwarm: ['#3b4cc0', '#8cb2e9', '#f2f2f2', '#f49a7b', '#b40426']
  };
  const activeCalendarMap = colorMapPresets[ctx.calendarColorPreset || 'academic'] || colorMapPresets.academic;

  return {
    backgroundColor: palette.bg,
    title: baseTitle,
    tooltip: { ...baseTooltip, formatter: (p: any) => `${p.data[0]}: ${p.data[1]} papers recorded` },
    visualMap: {
      show: showLegend !== false,
      min: 0,
      max: maxVal,
      type: 'continuous',
      orient: (ctx.legendPosition === 'left' || ctx.legendPosition === 'right') ? 'vertical' : 'horizontal',
      left: ctx.legendPosition === 'left' ? (ctx.legendDistance ?? 15) : ctx.legendPosition === 'right' ? undefined : (ctx.legendAlign === 'left' ? 20 : ctx.legendAlign === 'right' ? undefined : 'center'),
      right: ctx.legendPosition === 'right' ? (ctx.legendDistance ?? 15) : (ctx.legendAlign === 'right' ? 20 : undefined),
      top: ctx.legendPosition === 'top' ? (baseTitle?.show ? 55 : 15) + (ctx.legendDistance ?? 0) : undefined,
      bottom: (!ctx.legendPosition || ctx.legendPosition === 'bottom') ? (ctx.legendDistance ?? 10) : undefined,
      inRange: { color: activeCalendarMap },
      textStyle: { 
        fontFamily: font, 
        fontSize: ctx.legendFontSize ?? Math.max(9, fontSize - 2),
        fontWeight: (ctx.legendFontWeight as any) || 'normal',
        fontStyle: (ctx.legendFontStyle as any) || 'normal',
        color: ctx.legendTextColor || palette.text 
      }
    },
    calendar: {
      top: Math.max(10, (ctx.gridMarginTop !== undefined ? ctx.gridMarginTop : (showLegend ? 110 : 80)) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0)),
      bottom: ctx.gridMarginBottom !== undefined ? Math.max(10, ctx.gridMarginBottom + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0)) : undefined,
      left: Math.max(10, (ctx.gridMarginLeft !== undefined ? ctx.gridMarginLeft : 60) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0)),
      right: Math.max(10, (ctx.gridMarginRight !== undefined ? ctx.gridMarginRight : 40) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0)),
      cellSize: ['auto', ctx.calendarCellSize ?? 14],
      range: effectiveRange,
      itemStyle: { borderWidth: 1, borderColor: palette.bg },
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
