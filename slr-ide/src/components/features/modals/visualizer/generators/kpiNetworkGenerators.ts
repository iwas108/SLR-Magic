import type * as echarts from 'echarts';
import { getNodeColor } from '../utils/colorUtils';
import { 
  getFieldValue, 
  getMappedFieldValue, 
  computeMetricValue, 
  limitCategoryMap,
  extractNumericalValue
} from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';

export function generateRadarOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseLegend,
    baseTooltip,
    primaryField,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    umbrellanizerMap
  } = ctx;

  const qaKeysSet = new Set<string>();
  papers.forEach(p => {
    const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
    const qaStr = isManualDominant
      ? (p.manual_quality_assessment || p.ai_quality_assessment || '')
      : (p.ai_quality_assessment || p.manual_quality_assessment || '');
    if (qaStr) {
      try {
        const parsed = JSON.parse(qaStr);
        const qaObj = parsed.qa_scores || parsed;
        if (typeof qaObj === 'object' && qaObj !== null) {
          Object.keys(qaObj).forEach(k => qaKeysSet.add(k));
        }
      } catch (e) {}
    }
  });

  const keysList = qaKeysSet.size > 0 ? Array.from(qaKeysSet).sort() : ['QA1', 'QA2', 'QA3', 'QA4', 'QA5', 'QA6', 'QA7', 'QA8'];

  const getQaValue = (p: any, key: string): number => {
    const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
    const qaStr = isManualDominant
      ? (p.manual_quality_assessment || p.ai_quality_assessment || '')
      : (p.ai_quality_assessment || p.manual_quality_assessment || '');
    if (!qaStr) return 0;
    try {
      const parsed = JSON.parse(qaStr);
      const qaObj = parsed.qa_scores || parsed;
      const v = qaObj[key];
      const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
      const num = parseFloat(String(val));
      if (!isNaN(num)) return num;
      if (['YES', 'PASS', 'TRUE'].includes(String(val).toUpperCase())) return 1;
    } catch (e) {}
    return 0;
  };

  const indicators = keysList.map(k => ({ name: k, max: 1.0 }));

  const countsMap = new Map<string, any[]>();
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
      if (!countsMap.has(v)) countsMap.set(v, []);
      countsMap.get(v)!.push(p);
    });
  });

  const activeCountsMap = limitCategoryMap(countsMap, limitCategories, maxCategoriesCount, list => list.length);

  const seriesData = Array.from(activeCountsMap.entries()).map(([catName, pList]) => {
    const avgScores = keysList.map(k => {
      if (pList.length === 0) return 0;
      let sum = 0;
      pList.forEach(p => sum += getQaValue(p, k));
      return parseFloat((sum / pList.length).toFixed(2));
    });
    return { name: catName, value: avgScores };
  });

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: baseTooltip,
    radar: {
      indicator: indicators,
      center: [`${50 + (ctx.fitOffsetX ?? 0)}%`, `${55 + (ctx.fitOffsetY ?? 0)}%`],
      radius: `${Math.max(25, 65 - Math.round(((ctx.containerPadding ?? 12) - 12) * 0.4))}%`,
      shape: ctx.radarShape || 'polygon',
      splitNumber: ctx.radarSplitNumber ?? 5,
      axisName: { fontFamily: font, fontSize: fontSize - 1, color: palette.text },
      splitArea: { areaStyle: { color: [palette.bg, palette.border] } }
    },
    series: [{
      type: 'radar',
      data: seriesData,
      symbolSize: 6,
      lineStyle: { width: ctx.radarLineWidth ?? 2 },
      areaStyle: { opacity: (ctx.radarAreaOpacity ?? 25) / 100 }
    }]
  };
}

export function generateFunnelOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
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
    showDataLabels,
    showLegend,
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

  const funnelData = Array.from(activeCountsMap.entries()).map(([cat, pList], idx) => {
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
      itemStyle: { color }
    };
  }).sort((a, b) => b.value - a.value);

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: baseLegend,
    tooltip: {
      ...baseTooltip,
      formatter: (params: any) => {
        return renderCategoryTooltip(params?.data, params?.name);
      }
    },
    series: [{
      name: primaryField,
      type: 'funnel',
      left: '15%',
      right: '15%',
      top: showLegend ? 90 : 70,
      bottom: '10%',
      sort: 'descending',
      funnelAlign: ctx.funnelAlign || 'center',
      gap: ctx.funnelGap ?? 2,
      width: `${100 - (ctx.funnelNeckWidth ? 100 - ctx.funnelNeckWidth : 30)}%`,
      minSize: `${ctx.funnelNeckWidth ?? 30}%`,
      maxSize: '100%',
      label: { show: showDataLabels, position: 'inside', fontFamily: font, fontSize: fontSize - 1, color: '#ffffff' },
      data: funnelData
    }]
  };
}

export function generateGaugeOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    metricMode,
    gaugeMaxScale
  } = ctx;

  let metricValue = 0;
  const maxTarget = gaugeMaxScale || 100;
  let gaugeTitle = 'Cohort Metric';

  if (metricMode === 'avg_qa') {
    const sum = papers.reduce((acc, p) => acc + extractNumericalValue(p, 'Overall_QA'), 0);
    const avg = papers.length > 0 ? sum / papers.length : 0;
    metricValue = parseFloat(((avg / 8) * maxTarget).toFixed(2));
    gaugeTitle = `Avg QA Score (${avg.toFixed(2)} / 8.00)`;
  } else if (metricMode === 'avg_citation') {
    const sum = papers.reduce((acc, p) => acc + (parseFloat(String(p.citation_count ?? 0)) || 0), 0);
    const avg = papers.length > 0 ? sum / papers.length : 0;
    metricValue = parseFloat(avg.toFixed(2));
    gaugeTitle = `Avg Citation Count (${avg.toFixed(2)})`;
  } else {
    const downloaded = papers.filter(p => String(p.Local_PDF_Status || '').toLowerCase().includes('download')).length;
    metricValue = papers.length > 0 ? parseFloat(((downloaded / papers.length) * maxTarget).toFixed(2)) : 0;
    gaugeTitle = `PDF Download Ratio (${downloaded}/${papers.length})`;
  }

  const dialW = ctx.gaugeDialWidth ?? 14;

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    series: [{
      type: 'gauge',
      center: [`${50 + (ctx.fitOffsetX ?? 0)}%`, `${60 + (ctx.fitOffsetY ?? 0)}%`],
      radius: `${Math.max(30, 75 - Math.round(((ctx.containerPadding ?? 12) - 12) * 0.4))}%`,
      startAngle: ctx.gaugeStartAngle ?? 225,
      endAngle: ctx.gaugeEndAngle ?? -45,
      min: 0,
      max: maxTarget,
      progress: { show: true, width: dialW },
      axisLine: { lineStyle: { width: dialW, color: [[1, palette.border]] } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { width: 2, color: palette.text } },
      axisLabel: { fontFamily: font, fontSize: fontSize - 2, color: palette.text, distance: 15 },
      pointer: { width: ctx.gaugePointerWidth ?? 6 },
      title: { show: true, offsetCenter: [0, '70%'], fontFamily: font, fontSize: fontSize, color: palette.text },
      detail: { valueAnimation: true, formatter: '{value}%', offsetCenter: [0, '40%'], fontFamily: font, fontSize: fontSize + 6, fontWeight: 'bold', color: palette.text },
      data: [{ value: metricValue, name: gaugeTitle }]
    }]
  };
}

export function generateGraphOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    primaryField,
    secondaryField,
    limitCategories,
    maxCategoriesCount,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    showLegend,
    showDataLabels,
    baseTooltip,
    customCategoryMap,
    levelCustomGroupLinks,
    umbrellanizerMap
  } = ctx;

  const mappedOpts = { 
    useUmbrellanizer, 
    umbrellanizerMap, 
    splitMultiValues, 
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks
  };

  const countsP = new Map<string, any[]>();
  const countsS = new Map<string, any[]>();

  papers.forEach(p => {
    getMappedFieldValue(p, primaryField, { ...mappedOpts, primaryField, subFieldKey: secondaryField }).forEach(v => {
      if (!countsP.has(v)) countsP.set(v, []);
      countsP.get(v)!.push(p);
    });
    getMappedFieldValue(p, secondaryField, { ...mappedOpts, primaryField: secondaryField }).forEach(v => {
      if (!countsS.has(v)) countsS.set(v, []);
      countsS.get(v)!.push(p);
    });
  });

  const activeCountsP = limitCategoryMap(countsP, limitCategories, maxCategoriesCount, list => list.length);
  const activeCountsS = limitCategoryMap(countsS, limitCategories, maxCategoriesCount, list => list.length);

  const nodesMap = new Map<string, { name: string; category: number }>();
  const linksMap = new Map<string, number>();

  papers.forEach(p => {
    const rawP = getMappedFieldValue(p, primaryField, { ...mappedOpts, primaryField, subFieldKey: secondaryField });
    const rawS = getMappedFieldValue(p, secondaryField, { ...mappedOpts, primaryField: secondaryField });

    const mappedP = Array.from(new Set(rawP.map(v => activeCountsP.has(v) ? v : 'Other')));
    const mappedS = Array.from(new Set(rawS.map(v => activeCountsS.has(v) ? v : 'Other')));

    mappedP.forEach(pv => {
      const n1 = `[${primaryField}] ${pv}`;
      if (!nodesMap.has(n1)) nodesMap.set(n1, { name: n1, category: 0 });

      mappedS.forEach(sv => {
        const n2 = `[${secondaryField}] ${sv}`;
        if (!nodesMap.has(n2)) nodesMap.set(n2, { name: n2, category: 1 });

        const edgeKey = `${n1}--->${n2}`;
        linksMap.set(edgeKey, (linksMap.get(edgeKey) || 0) + 1);
      });
    });
  });

  const graphNodes = Array.from(nodesMap.values()).map(n => ({
    name: n.name,
    category: n.category,
    symbolSize: 20
  }));

  const graphLinks = Array.from(linksMap.entries()).map(([k, val]) => {
    const [source, target] = k.split('--->');
    return { source, target, value: val, lineStyle: { width: Math.min(10, Math.max(1, val)) } };
  });

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      show: showLegend,
      data: [primaryField, secondaryField],
      textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
    },
    tooltip: { ...baseTooltip, formatter: (p: any) => p.dataType === 'edge' ? `${p.data.source} → ${p.data.target}: ${p.data.value} papers` : p.name },
    series: [{
      type: 'graph',
      layout: 'force',
      force: { 
        repulsion: ctx.graphRepulsion ?? 120, 
        edgeLength: ctx.graphEdgeLength ?? 90,
        gravity: ctx.graphGravity ?? 0.1
      },
      roam: true,
      label: { show: showDataLabels, fontFamily: font, fontSize: fontSize - 2, color: palette.text, position: 'right' },
      categories: [{ name: primaryField }, { name: secondaryField }],
      data: graphNodes,
      links: graphLinks,
      lineStyle: { color: 'source', curveness: ctx.graphCurveness ?? 0.2 }
    }]
  };
}
