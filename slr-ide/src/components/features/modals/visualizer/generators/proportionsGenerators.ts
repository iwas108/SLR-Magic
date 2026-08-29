import type * as echarts from 'echarts';
import { getNodeColor } from '../utils/colorUtils';
import { getMappedFieldValue, computeMetricValue, limitCategoryMap } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';

export function generatePieDonutOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
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
    donutRatio,
    showDataLabels,
    legendFormat = 'name',
    legendPosition = 'top',
    showLegend = true,
    pieLabelPlacement = 'outside',
    pieRadiusRatio = 64,
    pieLabelWidth = 140,
    pieLeaderLineLength,
    pieLeaderLineLength2,
    pieLabelDistance,
    pieLineHeight,
    legendDistance = 20,
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

  const pieData = Array.from(activeCountsMap.entries()).map(([cat, pList], idx) => {
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
      itemStyle: { 
        color, 
        borderRadius: ctx.pieCornerRadius ?? 4, 
        borderColor: palette.bg, 
        borderWidth: 2 
      }
    };
  }).filter(d => d.value > 0);

  const pieDataMap = new Map(pieData.map(d => [d.name, d]));

  // Dynamic collision-free geometry & centering calculation
  let defaultCenterX = 50;
  let defaultCenterY = 50;
  const configuredRadius = pieRadiusRatio || 64;
  const padDeduction = Math.round(((ctx.containerPadding ?? 12) - 12) * 0.4);
  let maxOuterRadius = Math.max(15, Math.min(88, configuredRadius - padDeduction));

  const isInside = pieLabelPlacement === 'inside';
  const isLegendOnly = pieLabelPlacement === 'legend_only';
  const isEdgeAligned = pieLabelPlacement === 'edge_aligned';

  if (showLegend) {
    if (legendPosition === 'top') {
      defaultCenterY = 56;
      maxOuterRadius = Math.min(80, maxOuterRadius);
    } else if (legendPosition === 'bottom') {
      defaultCenterY = 44;
      maxOuterRadius = Math.min(80, maxOuterRadius);
    } else if (legendPosition === 'left') {
      const isWideLegend = (ctx.legendWidth && ctx.legendWidth > 180);
      defaultCenterX = (isInside || isLegendOnly) ? (isWideLegend ? 58 : 54) : (isWideLegend ? 60 : 56);
      defaultCenterY = 50;
      maxOuterRadius = Math.min(isWideLegend ? 78 : 85, maxOuterRadius);
    } else if (legendPosition === 'right') {
      const isWideLegend = (ctx.legendWidth && ctx.legendWidth > 180);
      defaultCenterX = (isInside || isLegendOnly) ? (isWideLegend ? 42 : 46) : (isWideLegend ? 40 : 44);
      defaultCenterY = 50;
      maxOuterRadius = Math.min(isWideLegend ? 78 : 85, maxOuterRadius);
    }
  } else {
    defaultCenterY = 50;
    maxOuterRadius = Math.min(88, maxOuterRadius);
  }

  const effectiveFitOffsetX = ctx.fitOffsetX ?? 0;
  const effectiveFitOffsetY = ctx.fitOffsetY ?? 0;
  const centerX = `${defaultCenterX + effectiveFitOffsetX}%`;
  const centerY = `${defaultCenterY + effectiveFitOffsetY}%`;

  const innerRadiusPct = donutRatio > 0 ? Math.round(maxOuterRadius * (donutRatio / 100)) : 0;
  const radiusRange: [string, string] = [`${innerRadiusPct}%`, `${maxOuterRadius}%`];

  const lineLength = pieLeaderLineLength !== undefined ? pieLeaderLineLength : 12;
  const lineLength2 = pieLeaderLineLength2 !== undefined ? pieLeaderLineLength2 : 14;
  const labelDist = pieLabelDistance !== undefined ? pieLabelDistance : 6;

  const labelConfig: any = {
    show: showDataLabels && !isLegendOnly,
    position: isInside ? 'inside' : 'outside',
    fontFamily: font,
    fontSize: isInside ? Math.max(10, fontSize - 2) : Math.max(10, fontSize - 1),
    color: isInside ? '#ffffff' : palette.text,
    width: isInside ? undefined : pieLabelWidth,
    overflow: 'break',
    lineHeight: pieLineHeight ?? 15,
    distance: isInside ? 0 : labelDist,
    minMargin: 4,
    alignTo: isEdgeAligned ? 'edge' : 'labelLine',
    edgeDistance: '5%',
    formatter: (params: any) => {
      const item = pieDataMap.get(params?.name) || params?.data;
      if (!item) return params?.name || '';
      
      const effectiveLabelFormat = ctx.labelFormat || (isInside ? 'percent_only' : 'name_ratio_percent');
      return formatMetricDisplay({
        name: params.name,
        val: item.value,
        count: item.value,
        paperCount: item.paperCount,
        tagCount: item.tagCount,
        totalCohortPapers: papers.length,
        totalExtractedTags,
        metricMode,
        prevalencePct: item.prevalencePct,
        tagSharePct: item.tagPct,
        template: effectiveLabelFormat,
        decimalPrecision: ctx.decimalPrecision,
        useTildeForCoarse: ctx.useTildeForCoarse,
        ratioStyle: ctx.ratioStyle,
        forceCohortDenominator: ctx.forceCohortDenominator
      });
    }
  };

  const legendCustomPos: any = {};
  if (showLegend) {
    if (legendPosition === 'right') {
      legendCustomPos.right = legendDistance;
      legendCustomPos.left = undefined;
      legendCustomPos.top = 'middle';
    } else if (legendPosition === 'left') {
      legendCustomPos.left = legendDistance;
      legendCustomPos.right = undefined;
      legendCustomPos.top = 'middle';
    } else if (legendPosition === 'top') {
      legendCustomPos.top = legendDistance;
      legendCustomPos.left = 'center';
    } else if (legendPosition === 'bottom') {
      legendCustomPos.bottom = legendDistance;
      legendCustomPos.left = 'center';
    }
  }

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      ...baseLegend,
      ...legendCustomPos,
      formatter: (name: string) => {
        const item = pieDataMap.get(name);
        if (!item) return name;
        return formatLegendLabel(name, {
          paperCount: item.paperCount,
          tagCount: item.tagCount,
          count: item.value,
          prevalencePct: item.prevalencePct,
          tagSharePct: item.tagPct,
          totalCohortPapers: papers.length,
          totalExtractedTags,
          metricMode,
          decimalPrecision: ctx.decimalPrecision,
          useTildeForCoarse: ctx.useTildeForCoarse,
          ratioStyle: ctx.ratioStyle,
          forceCohortDenominator: ctx.forceCohortDenominator
        }, legendFormat);
      }
    },
    tooltip: {
      ...baseTooltip,
      formatter: (params: any) => {
        return renderCategoryTooltip(params?.data, params?.name);
      }
    },
    series: [{
      name: primaryField,
      type: 'pie',
      roseType: (ctx.roseType && ctx.roseType !== 'none') ? ctx.roseType : undefined,
      padAngle: ctx.piePadAngle ?? 2,
      radius: radiusRange,
      center: [centerX, centerY],
      data: pieData,
      avoidLabelOverlap: true,
      labelLayout: {
        hideOverlap: true,
        moveOverlap: 'shiftY'
      },
      label: labelConfig,
      labelLine: {
        show: showDataLabels && !isInside && !isLegendOnly,
        length: lineLength,
        length2: lineLength2,
        maxSurfaceAngle: 80,
        smooth: 0.25,
        lineStyle: {
          color: palette.subtext || palette.border,
          width: 1.2
        }
      }
    }]
  };
}
