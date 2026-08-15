import type * as echarts from 'echarts';
import { getNodeColor } from '../utils/colorUtils';
import { 
  getMappedFieldValue, 
  computeMetricValue, 
  limitCategoryMap 
} from '../utils/dataExtractor';
import { computeGroupStatistics, getErrorBounds } from '../utils/statisticalUtils';
import { getSeriesPatternStyle } from '../utils/hatchPatternUtils';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';

export function generateClusteredBarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
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

  // Limit categories if enabled
  const limitedPrimMap = limitCategoryMap(
    primAggregatePapersMap,
    limitCategories,
    maxCategoriesCount,
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags)
  );

  // Determine sorted category list
  let categories = Array.from(limitedPrimMap.keys());
  if (barSorting === 'desc') {
    categories.sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      const valA = computeMetricValue(limitedPrimMap.get(a) || [], metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(limitedPrimMap.get(b) || [], metricMode, papers.length, totalExtractedTags);
      return valB - valA;
    });
  } else if (barSorting === 'asc') {
    categories.sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      const valA = computeMetricValue(limitedPrimMap.get(a) || [], metricMode, papers.length, totalExtractedTags);
      const valB = computeMetricValue(limitedPrimMap.get(b) || [], metricMode, papers.length, totalExtractedTags);
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

  const seriesList = Array.from(seriesSet).sort();

  // 2. Build Series Payload
  const effectiveLegendFormat = legendFormat || barLegendFormat || 'name';
  const isPctMetric = metricMode === 'paper_prevalence' || metricMode === 'tag_share';

  const seriesObjects: any[] = seriesList.map((seriesKey, sIdx) => {
    const baseColor = customSliceColors[seriesKey] || getNodeColor(seriesKey, undefined, sIdx, palette.colors, customSliceColors);
    const patternStyle = getSeriesPatternStyle(sIdx, baseColor, enableHatchPatterns);

    const seriesData = categories.map(cat => {
      let groupPapers: any[] = [];
      if (cat === 'Other') {
        limitedPrimMap.get('Other')?.forEach(p => {
          const secVals = getMappedFieldValue(p, secondaryField, mappedOpts);
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
          ...patternStyle,
          borderRadius: isHorizontal 
            ? [0, barBorderRadius, barBorderRadius, 0]
            : [barBorderRadius, barBorderRadius, 0, 0]
        }
      };
    });

    const seriesTotalCount = seriesData.reduce((acc, d) => acc + d.paperCount, 0);
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

    return {
      name: seriesLegendLabel,
      rawSeriesKey: seriesKey,
      type: 'bar',
      barWidth: barThickness,
      barGap: `${barInnerGap}%`,
      barCategoryGap: `${barClusterGap}%`,
      data: seriesData,
      label: {
        show: showDataLabels,
        position: isHorizontal ? (barLabelPosition === 'inside' ? 'inside' : 'right') : (barLabelPosition === 'inside' ? 'inside' : 'top'),
        fontFamily: font,
        fontSize: Math.max(9, fontSize - 2),
        color: barLabelPosition.startsWith('inside') ? '#ffffff' : palette.text,
        formatter: (params: any) => params.data?.formattedLabel ?? params.value
      }
    };
  });

  // 3. Reference Benchmark Line
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
      formatter: `${barBenchmarkLabel || 'Target Benchmark'} (${barBenchmarkValue}${isPctMetric ? '%' : ''})`,
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 2),
      color: barBenchmarkColor || '#ef4444',
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
  const legendPosMap: Record<string, any> = {
    'top-left': { top: 15, left: legDist },
    'top-center': { top: legDist, left: 'center' },
    'top-right': { top: 15, right: legDist },
    'left': { left: legDist, top: 'center' },
    'right': { right: legDist, top: 'center' },
    'bottom-left': { bottom: 15, left: legDist },
    'bottom-center': { bottom: 15, left: 'center' },
    'bottom-right': { bottom: 15, right: legDist }
  };

  const effectiveLegendPos = legendPosMap[barLegendPosition] || { bottom: legDist, left: 'center' };
  const legendOrient = (barLegendPosition === 'left' || barLegendPosition === 'right') ? 'vertical' : 'horizontal';

  // 5. Grid Layout Calculations
  const yWidth = barYAxisWidth || 140;
  let gridTop = 45;
  let gridBottom = isHorizontal ? 35 : 45;
  let gridLeft = isHorizontal ? Math.max(90, Math.min(240, yWidth + 16)) : 60;
  let gridRight = 65;

  if (showLegend) {
    if (barLegendPosition.startsWith('top')) gridTop = 85;
    else if (barLegendPosition.startsWith('bottom')) gridBottom = 55;
    else if (barLegendPosition.includes('right')) gridRight = 140;
    else if (barLegendPosition.includes('left')) gridLeft += 120;
  }

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

  const defaultTitleX = isHorizontal ? metricLabel : primaryField;
  const defaultTitleY = isHorizontal ? primaryField : metricLabel;

  const finalTitleX = customAxisTitleX?.trim() || defaultTitleX;
  const finalTitleY = customAxisTitleY?.trim() || defaultTitleY;

  // 7. Axis Configurations
  const categoryAxisConfig = {
    type: 'category' as const,
    data: categories,
    inverse: isHorizontal,
    axisLabel: {
      fontFamily: font,
      fontSize: isHorizontal ? (barYAxisFontSize ?? Math.max(9, fontSize - 2)) : Math.max(9, fontSize - 1),
      color: palette.text,
      rotate: isHorizontal ? 0 : labelRotation,
      width: isHorizontal ? barYAxisWidth : undefined,
      overflow: (isHorizontal && barYAxisOverflow !== 'none') ? barYAxisOverflow : undefined,
      lineHeight: isHorizontal ? (barLineHeight ?? Math.max(12, (barYAxisFontSize ?? (fontSize - 2)) + 3)) : Math.max(12, fontSize + 2),
      formatter: (val: string) => {
        if (isHorizontal && barYAxisOverflow === 'break') {
          const effFont = barYAxisFontSize ?? Math.max(9, fontSize - 2);
          const charLimit = Math.max(14, Math.floor((barYAxisWidth - 10) / (effFont * 0.55)));
          if (val.length > charLimit - 2) {
            const words = val.split(' ');
            const lines: string[] = [];
            let cur = '';
            words.forEach(w => {
              if ((cur + ' ' + w).trim().length > charLimit) {
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
    axisTick: {
      show: axisTickDirection !== 'none',
      inside: axisTickDirection === 'inside',
      alignWithLabel: true
    },
    axisLine: {
      show: showAxisBaseline,
      lineStyle: { color: palette.text, width: 1.2 }
    },
    name: isHorizontal ? finalTitleY : finalTitleX,
    nameLocation: 'end' as const,
    nameTextStyle: {
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 2),
      color: palette.subtext,
      fontStyle: 'italic' as const
    }
  };

  const valueAxisConfig = {
    type: axisScaleType === 'log' ? ('log' as const) : ('value' as const),
    axisLabel: {
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 1),
      color: palette.text,
      formatter: isPctMetric ? '{value}%' : '{value}'
    },
    splitLine: {
      lineStyle: { color: palette.border, type: 'dashed' as const }
    },
    axisTick: {
      show: axisTickDirection !== 'none',
      inside: axisTickDirection === 'inside'
    },
    axisLine: {
      show: showAxisBaseline,
      lineStyle: { color: palette.text, width: 1.2 }
    },
    name: isHorizontal ? finalTitleX : finalTitleY,
    nameLocation: 'end' as const,
    nameTextStyle: {
      fontFamily: font,
      fontSize: Math.max(9, fontSize - 2),
      color: palette.subtext,
      fontStyle: 'italic' as const
    }
  };

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
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
      show: true,
      type: 'scroll',
      data: seriesObjects.map(s => s.name),
      ...effectiveLegendPos,
      orient: legendOrient,
      z: 20,
      textStyle: { color: palette.text, fontFamily: font, fontSize: Math.max(9, fontSize - 3), fontWeight: 'bold' },
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
    xAxis: isHorizontal ? valueAxisConfig : categoryAxisConfig,
    yAxis: isHorizontal ? categoryAxisConfig : valueAxisConfig,
    series: seriesObjects
  };
}
