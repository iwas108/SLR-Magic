import type * as echarts from 'echarts';
import { 
  getFieldValue, 
  getMappedFieldValue,
  extractNumericalValue, 
  limitCategoryMap 
} from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { buildScientificAxisConfig } from './axisConfigHelper';

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
    xAxis: buildScientificAxisConfig('x', ctx, {
      axisKind: 'value',
      defaultTitle: numFieldX
    }),
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'value',
      defaultTitle: numFieldY
    }),
    series: [
      { type: 'scatter' as const, symbolSize: pSize, data: scatterData, itemStyle: { opacity: pOpacity } },
      ...(regressionSeries ? [regressionSeries] : [])
    ]
  };
}

function cleanKey(rawKey: string): string {
  if (!rawKey) return '';
  let k = rawKey;
  if (k.startsWith('cat:')) {
    const parts = k.split(':');
    return parts[parts.length - 1] || k;
  }
  if (k.startsWith('raw:ext:')) k = k.substring(8);
  else if (k.startsWith('ext:')) k = k.substring(4);
  else if (k.startsWith('meta:')) k = k.substring(5);
  
  if (k.startsWith('macro:')) k = k.substring(6);
  if (k.startsWith('rq')) {
    const underscoreIdx = k.indexOf('_');
    if (underscoreIdx !== -1) {
      const rqPrefix = k.substring(0, underscoreIdx).toUpperCase();
      const rest = k.substring(underscoreIdx + 1).replace(/_/g, ' ');
      return `[${rqPrefix}] ${rest.charAt(0).toUpperCase() + rest.slice(1)}`;
    }
  }
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(59, 130, 246, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    primaryField,
    secondaryField,
    numFieldX,
    numFieldY,
    numFieldSize,
    bubbleScale = 1.2,
    showLegend,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    limitCategories,
    maxCategoriesCount,
    customCategoryMap,
    levelCustomGroupLinks,
    umbrellanizerMap
  } = ctx;

  const bubbleMode = ctx.bubbleMode || 'categorical_matrix';

  // --- MODE B: CONTINUOUS NUMERICAL 3D BUBBLE ---
  if (bubbleMode === 'numerical_3d') {
    const bubbleData: [number, number, number, string][] = papers.map(p => [
      extractNumericalValue(p, numFieldX),
      extractNumericalValue(p, numFieldY),
      extractNumericalValue(p, numFieldSize),
      p.Title || p.Paper_ID
    ]);

    const pOpacity = (ctx.bubbleOpacity ?? ctx.scatterPointOpacity ?? 75) / 100;

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
      xAxis: buildScientificAxisConfig('x', ctx, {
        axisKind: 'value',
        defaultTitle: numFieldX,
        scale: true
      }),
      yAxis: buildScientificAxisConfig('y', ctx, {
        axisKind: 'value',
        defaultTitle: numFieldY
      }),
      series: [{ 
        name: 'Deployments',
        type: 'scatter', 
        symbolSize: (d: any) => Math.max(6, Math.round(d[2] * 2 * (bubbleScale || 1.0))), 
        data: bubbleData, 
        itemStyle: { opacity: pOpacity } 
      }]
    };
  }

  // --- MODE A: CATEGORICAL 2D CROSS-TABULATION MATRIX (PRIMARY) ---
  const fieldOpts = { 
    useUmbrellanizer, 
    umbrellanizerMap, 
    splitMultiValues, 
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks
  };

  const effectivePrimaryField = primaryField || 'ext:macro:rq3a_hardware_tier';
  const effectiveSecondaryField = secondaryField || 'ext:macro:rq8a_control_autonomy';

  const countsP = new Map<string, any[]>();
  const countsS = new Map<string, any[]>();

  papers.forEach(p => {
    getMappedFieldValue(p, effectivePrimaryField, { ...fieldOpts, primaryField: effectivePrimaryField, subFieldKey: effectiveSecondaryField }).forEach((v: string) => {
      if (!countsP.has(v)) countsP.set(v, []);
      countsP.get(v)!.push(p);
    });
    getMappedFieldValue(p, effectiveSecondaryField, { ...fieldOpts, primaryField: effectiveSecondaryField }).forEach((v: string) => {
      if (!countsS.has(v)) countsS.set(v, []);
      countsS.get(v)!.push(p);
    });
  });

  const activeCountsP = limitCategoryMap(countsP, limitCategories, maxCategoriesCount, list => list.length);
  const activeCountsS = limitCategoryMap(countsS, limitCategories, maxCategoriesCount, list => list.length);

  const catXSet = new Set<string>();
  const catYSet = new Set<string>();
  const matrixMap = new Map<string, Map<string, any[]>>();

  papers.forEach(p => {
    const rawP = getMappedFieldValue(p, effectivePrimaryField, { ...fieldOpts, primaryField: effectivePrimaryField, subFieldKey: effectiveSecondaryField });
    const rawS = getMappedFieldValue(p, effectiveSecondaryField, { ...fieldOpts, primaryField: effectiveSecondaryField });

    const primVals: string[] = Array.from(new Set(rawP.map((v: string) => activeCountsP.has(v) ? v : 'Other')));
    const secVals: string[] = Array.from(new Set(rawS.map((v: string) => activeCountsS.has(v) ? v : 'Other')));

    primVals.forEach((pv: string) => {
      catXSet.add(pv);
      secVals.forEach((sv: string) => {
        catYSet.add(sv);
        if (!matrixMap.has(pv)) matrixMap.set(pv, new Map());
        if (!matrixMap.get(pv)!.has(sv)) matrixMap.get(pv)!.set(sv, []);
        matrixMap.get(pv)!.get(sv)!.push(p);
      });
    });
  });

  const xCategories = Array.from(catXSet).sort();
  const yCategories = Array.from(catYSet).sort();
  const totalCohort = papers.length;

  let maxCount = 1;
  xCategories.forEach(xVal => {
    yCategories.forEach(yVal => {
      const pList = matrixMap.get(xVal)?.get(yVal) || [];
      const uniqueIds = new Set(pList.map((p: any) => p.Paper_ID || p.Title));
      if (uniqueIds.size > maxCount) maxCount = uniqueIds.size;
    });
  });

  const bubbleData: any[] = [];
  const rules = ctx.bubbleComplianceRules || {};

  xCategories.forEach((xVal, xIdx) => {
    yCategories.forEach((yVal, yIdx) => {
      const pList = matrixMap.get(xVal)?.get(yVal) || [];
      if (pList.length === 0) return;

      const uniquePaperMap = new Map<string, any>();
      pList.forEach((p: any) => {
        const id = p.Paper_ID || p.Title;
        if (!uniquePaperMap.has(id)) uniquePaperMap.set(id, p);
      });
      const uniquePapers = Array.from(uniquePaperMap.values());
      const paperCount = uniquePapers.length;
      const prevalencePct = totalCohort > 0 ? (paperCount / totalCohort) * 100 : 0;
      const tagCount = pList.length;

      let metricValue = paperCount;
      if (ctx.metricMode === 'paper_prevalence') {
        metricValue = Number(prevalencePct.toFixed(1));
      } else if (ctx.metricMode === 'tag_share') {
        metricValue = tagCount;
      } else if (ctx.metricMode === 'avg_qa') {
        const qaSum = uniquePapers.reduce((acc, p) => acc + (parseFloat(String(p.Overall_QA ?? 0)) || 0), 0);
        metricValue = uniquePapers.length > 0 ? Number((qaSum / uniquePapers.length).toFixed(2)) : 0;
      } else if (ctx.metricMode === 'avg_citation') {
        const citSum = uniquePapers.reduce((acc, p) => acc + (parseFloat(String(p.citation_count ?? 0)) || 0), 0);
        metricValue = uniquePapers.length > 0 ? Number((citSum / uniquePapers.length).toFixed(1)) : 0;
      }

      const ruleKeyTriple = `${xVal}:::${yVal}`;
      const ruleKeyColon = `${xVal}:${yVal}`;
      const matchedRule = rules[ruleKeyTriple] || rules[ruleKeyColon];

      const itemLabel = matchedRule?.label || `${xVal} × ${yVal}`;
      const complianceText = matchedRule?.compliance || '';

      let bubbleColor = palette.colors[xIdx % palette.colors.length];
      if (matchedRule?.color) {
        bubbleColor = matchedRule.color;
      } else if (ctx.bubbleColorMode === 'color_by_y') {
        bubbleColor = palette.colors[yIdx % palette.colors.length];
      } else if (ctx.bubbleColorMode === 'color_by_metric') {
        const ratio = Math.min(1.0, paperCount / Math.max(1, maxCount));
        bubbleColor = hexToRgba(palette.colors[0], 0.35 + ratio * 0.65);
      }

      const sampleTitles = uniquePapers.map(p => p.Title || p.Paper_ID).slice(0, 5);

      bubbleData.push([
        xVal,
        yVal,
        metricValue,
        itemLabel,
        complianceText,
        bubbleColor,
        paperCount,
        Number(prevalencePct.toFixed(1)),
        sampleTitles,
        tagCount
      ]);
    });
  });

  let maxMetricValue = 1;
  bubbleData.forEach(d => {
    if (typeof d[2] === 'number' && d[2] > maxMetricValue) {
      maxMetricValue = d[2];
    }
  });

  const legendMode = ctx.bubbleLegendMode || 'category_series';
  const customSeriesName = ctx.bubbleSeriesName || 'Deployments';

  const symbolSizeFn = (val: any) => {
    const mVal = typeof val[2] === 'number' ? val[2] : 0;
    const scale = ctx.bubbleScale || 1.0;
    const minRad = ctx.bubbleMinRadius ?? 12;
    const maxRad = ctx.bubbleMaxRadius ?? 65;
    const ratio = maxMetricValue > 0 ? Math.min(1.0, Math.max(0, mVal / maxMetricValue)) : 0;
    const dynamicDiameter = Math.round(minRad + ratio * (maxRad - minRad) * scale);
    return Math.max(minRad, Math.min(maxRad, dynamicDiameter));
  };

  const labelConfig = {
    show: ctx.bubbleShowLabels !== false,
    formatter: (param: any) => {
      if (!param.data) return '';
      const format = ctx.bubbleLabelFormat || 'count_n';
      const pCount = param.data[6] !== undefined ? param.data[6] : param.data[2];
      const pct = param.data[7] !== undefined ? param.data[7] : 0;
      if (format === 'count_n') return `n=${pCount}`;
      if (format === 'count_only') return `${pCount}`;
      if (format === 'percent') return `${pct}%`;
      if (format === 'label') return `${param.data[3] || `n=${pCount}`}`;
      return `n=${pCount}`;
    },
    color: ctx.bubbleLabelColor || '#ffffff',
    fontWeight: 'bold' as const,
    fontSize: ctx.bubbleLabelFontSize ?? 11,
    fontFamily: font
  };

  const seriesList: any[] = [];
  const legendData: string[] = [];

  if (legendMode === 'category_series') {
    if (ctx.bubbleColorMode === 'color_by_y') {
      yCategories.forEach((yCat, yIdx) => {
        const catPoints = bubbleData.filter(d => d[1] === yCat);
        if (catPoints.length === 0) return;
        legendData.push(yCat);
        const color = palette.colors[yIdx % palette.colors.length];
        seriesList.push({
          name: yCat,
          type: 'scatter',
          data: catPoints,
          symbolSize: symbolSizeFn,
          itemStyle: {
            color: (param: any) => param.data[5] || color,
            opacity: (ctx.bubbleOpacity ?? 85) / 100,
            borderColor: ctx.bubbleBorderColor || '#333333',
            borderWidth: ctx.bubbleBorderWidth ?? 1.5
          },
          label: labelConfig
        });
      });
    } else if (ctx.bubbleColorMode === 'custom_compliance') {
      const complianceGroups = new Map<string, any[]>();
      bubbleData.forEach(d => {
        const comp = d[4] || 'Unclassified';
        if (!complianceGroups.has(comp)) complianceGroups.set(comp, []);
        complianceGroups.get(comp)!.push(d);
      });
      let cIdx = 0;
      complianceGroups.forEach((points, compName) => {
        legendData.push(compName);
        const fallbackColor = palette.colors[cIdx % palette.colors.length];
        cIdx++;
        seriesList.push({
          name: compName,
          type: 'scatter',
          data: points,
          symbolSize: symbolSizeFn,
          itemStyle: {
            color: (param: any) => param.data[5] || fallbackColor,
            opacity: (ctx.bubbleOpacity ?? 85) / 100,
            borderColor: ctx.bubbleBorderColor || '#333333',
            borderWidth: ctx.bubbleBorderWidth ?? 1.5
          },
          label: labelConfig
        });
      });
    } else {
      xCategories.forEach((xCat, xIdx) => {
        const catPoints = bubbleData.filter(d => d[0] === xCat);
        if (catPoints.length === 0) return;
        legendData.push(xCat);
        const color = palette.colors[xIdx % palette.colors.length];
        seriesList.push({
          name: xCat,
          type: 'scatter',
          data: catPoints,
          symbolSize: symbolSizeFn,
          itemStyle: {
            color: (param: any) => param.data[5] || color,
            opacity: (ctx.bubbleOpacity ?? 85) / 100,
            borderColor: ctx.bubbleBorderColor || '#333333',
            borderWidth: ctx.bubbleBorderWidth ?? 1.5
          },
          label: labelConfig
        });
      });
    }
  } else {
    legendData.push(customSeriesName);
    seriesList.push({
      name: customSeriesName,
      type: 'scatter',
      data: bubbleData,
      symbolSize: symbolSizeFn,
      itemStyle: {
        color: (param: any) => param.data[5] || palette.colors[0],
        opacity: (ctx.bubbleOpacity ?? 85) / 100,
        borderColor: ctx.bubbleBorderColor || '#333333',
        borderWidth: ctx.bubbleBorderWidth ?? 1.5
      },
      label: labelConfig
    });
  }

  const xAxisTitle = ctx.bubbleXAxisName || cleanKey(effectivePrimaryField) || 'Primary Dimension';
  const yAxisTitle = ctx.bubbleYAxisName || cleanKey(effectiveSecondaryField) || 'Secondary Dimension';

  // Compute dynamic safety clearance for X rotated labels and Y labels
  const maxXChar = Math.max(...xCategories.map(c => c.length), 8);
  const rotRad = ((ctx.labelRotation || 0) * Math.PI) / 180;
  const rotLabelHeight = Math.round(Math.sin(rotRad) * maxXChar * 6.5 + Math.cos(rotRad) * 16);
  const autoXNameGap = Math.max(35, rotLabelHeight + 25);
  const effectiveXNameGap = ctx.bubbleXAxisNameGap ?? autoXNameGap;

  const maxYChar = Math.max(...yCategories.map(c => c.length), 10);
  const yLabelWidth = Math.round(maxYChar * 7.5 + 15);
  const autoYNameGap = Math.max(50, yLabelWidth + 30);
  const effectiveYNameGap = ctx.bubbleYAxisNameGap ?? autoYNameGap;

  // Grid margins - reclaim canvas room when legend is disabled
  const isLegendActive = showLegend && ctx.bubbleLegendMode !== 'none';
  const hasBottomLegend = isLegendActive && (ctx.legendPosition === 'bottom' || !ctx.legendPosition);
  const hasTopLegend = isLegendActive && ctx.legendPosition === 'top';
  const hasLeftLegend = isLegendActive && ctx.legendPosition === 'left';
  const hasRightLegend = isLegendActive && ctx.legendPosition === 'right';

  const defaultBottomMargin = hasBottomLegend ? 65 : 25;
  const effectiveGridBottom = ctx.bubbleGridBottom !== undefined ? ctx.bubbleGridBottom : defaultBottomMargin;

  const defaultLeftMargin = hasLeftLegend ? 80 : 35;
  const effectiveGridLeft = ctx.bubbleGridLeft !== undefined ? ctx.bubbleGridLeft : defaultLeftMargin;

  const defaultTopMargin = hasTopLegend ? 85 : (baseTitle.show ? 45 : 20);
  const effectiveGridTop = ctx.bubbleGridTop !== undefined ? ctx.bubbleGridTop : defaultTopMargin;

  const defaultRightMargin = hasRightLegend ? 90 : 25;
  const effectiveGridRight = ctx.bubbleGridRight !== undefined ? ctx.bubbleGridRight : defaultRightMargin;

  const titleFontSize = ctx.bubbleAxisTitleFontSize ?? (fontSize + 1);
  const titleFontWeight = ctx.bubbleAxisTitleFontWeight || 'bold';
  const titleColor = ctx.bubbleAxisTitleColor || palette.text;

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    legend: {
      ...baseLegend,
      data: legendData,
      show: showLegend && ctx.bubbleLegendMode !== 'none'
    },
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (param: any) => {
        if (!param.data) return '';
        const [xVal, yVal, metricVal, label, compliance, color, paperCount, prevPct, sampleTitles] = param.data;
        let content = `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">`;
        if (label) {
          content += `<strong style="font-size:13px;color:${palette.text};">${label}</strong><br/>`;
        }
        content += `<span style="color:${palette.subtext};">${xAxisTitle}:</span> <strong>${xVal}</strong><br/>`;
        content += `<span style="color:${palette.subtext};">${yAxisTitle}:</span> <strong>${yVal}</strong><br/>`;
        content += `<span style="color:${palette.subtext};">Paper Count:</span> <strong>${paperCount} papers</strong> <span style="color:${palette.subtext};font-size:11px;">(${prevPct}% of cohort)</span><br/>`;
        if (compliance) {
          content += `<span style="color:${palette.subtext};">Compliance / Status:</span> <i>${compliance}</i><br/>`;
        }
        if (sampleTitles && sampleTitles.length > 0) {
          content += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid ${palette.border};font-size:11px;color:${palette.subtext};">
            <strong>Sample Studies (first ${sampleTitles.length}):</strong><br/>
            ${sampleTitles.map((t: string) => `• ${t.length > 55 ? t.substring(0, 53) + '...' : t}`).join('<br/>')}
          </div>`;
        }
        content += `</div>`;
        return content;
      }
    },
    grid: {
      left: Math.max(30, effectiveGridLeft + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0)),
      right: Math.max(30, effectiveGridRight + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0)),
      top: Math.max(30, effectiveGridTop + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0)),
      bottom: Math.max(30, effectiveGridBottom + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0)),
      containLabel: true
    },
    xAxis: buildScientificAxisConfig('x', ctx, {
      axisKind: 'category',
      defaultTitle: xAxisTitle,
      categories: xCategories
    }),
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'category',
      defaultTitle: yAxisTitle,
      categories: yCategories
    }),
    series: seriesList
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
    xAxis: buildScientificAxisConfig(isHorizontal ? 'y' : 'x', ctx, {
      axisKind: isHorizontal ? 'value' : 'category',
      defaultTitle: isHorizontal ? numFieldY : primaryField,
      categories: isHorizontal ? undefined : categories
    }),
    yAxis: buildScientificAxisConfig(isHorizontal ? 'x' : 'y', ctx, {
      axisKind: isHorizontal ? 'category' : 'value',
      defaultTitle: isHorizontal ? primaryField : numFieldY,
      categories: isHorizontal ? categories : undefined
    }),
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
