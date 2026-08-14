import type * as echarts from 'echarts';
import { getNodeColor } from '../utils/colorUtils';
import { getMappedFieldValue, computeMetricValue, limitCategoryMap } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';

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
    pieRadiusRatio = 52,
    pieLabelWidth = 140,
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
      itemStyle: { color, borderRadius: 4, borderColor: palette.bg, borderWidth: 2 }
    };
  }).filter(d => d.value > 0);

  const pieDataMap = new Map(pieData.map(d => [d.name, d]));

  // Dynamic collision-free geometry & centering calculation
  let centerX = '50%';
  let centerY = '50%';
  let maxOuterRadius = pieRadiusRatio || 52;

  if (showLegend) {
    if (legendPosition === 'top') {
      centerY = '54%';
      maxOuterRadius = Math.min(50, maxOuterRadius);
    } else if (legendPosition === 'bottom') {
      centerY = '46%';
      maxOuterRadius = Math.min(50, maxOuterRadius);
    } else if (legendPosition === 'left') {
      centerX = '60%';
      centerY = '50%';
      maxOuterRadius = Math.min(54, maxOuterRadius);
    } else if (legendPosition === 'right') {
      centerX = '40%';
      centerY = '50%';
      maxOuterRadius = Math.min(54, maxOuterRadius);
    }
  } else {
    centerY = '50%';
    maxOuterRadius = Math.min(56, maxOuterRadius);
  }

  const innerRadiusPct = donutRatio > 0 ? Math.round(maxOuterRadius * (donutRatio / 100)) : 0;
  const radiusRange: [string, string] = [`${innerRadiusPct}%`, `${maxOuterRadius}%`];

  // Dynamic label placement configuration
  const isInside = pieLabelPlacement === 'inside';
  const isLegendOnly = pieLabelPlacement === 'legend_only';
  const isEdgeAligned = pieLabelPlacement === 'edge_aligned';

  const labelConfig: any = {
    show: showDataLabels && !isLegendOnly,
    position: isInside ? 'inside' : 'outside',
    fontFamily: font,
    fontSize: isInside ? Math.max(10, fontSize - 2) : Math.max(10, fontSize - 1),
    color: isInside ? '#ffffff' : palette.text,
    width: isInside ? undefined : pieLabelWidth,
    overflow: 'break',
    lineHeight: 16,
    minMargin: 6,
    alignTo: isEdgeAligned ? 'edge' : 'labelLine',
    edgeDistance: '6%',
    formatter: (params: any) => {
      const item = pieDataMap.get(params?.name) || params?.data;
      if (!item) return params?.name || '';
      
      const pctStr = item.prevalencePct ? `${item.prevalencePct}%` : `${params.percent?.toFixed(2)}%`;
      if (isInside) {
        return `${pctStr}`;
      }
      
      const countPart = item.paperCount !== undefined ? `N=${item.paperCount} ` : '';
      return `${params.name}\n${countPart}(${pctStr})`;
    }
  };

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      ...baseLegend,
      formatter: (name: string) => {
        const item = pieDataMap.get(name);
        if (!item) return name;
        return formatLegendLabel(name, { paperCount: item.paperCount, prevalencePct: item.prevalencePct }, legendFormat);
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
        length: 12,
        length2: 14,
        maxSurfaceAngle: 80,
        smooth: 0.2,
        lineStyle: {
          color: palette.border
        }
      }
    }]
  };
}
