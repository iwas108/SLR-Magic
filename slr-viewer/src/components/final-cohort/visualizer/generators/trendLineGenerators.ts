import type * as echarts from 'echarts';
import { getFieldValue, getMappedFieldValue, computeMetricValue, limitCategoryMap } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';
import { buildScientificAxisConfig, resolveUniversalGrid } from './axisConfigHelper';

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== 'string') return `rgba(46, 125, 50, ${alpha})`;
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length === 6) {
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

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
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields,
    showLegend,
    labelRotation,
    showDataLabels,
    smoothLine,
    umbrellanizerMap,
    lineMode
  } = ctx;

  // =========================================================================
  // PARADIGM 2: EPISTEMIC UNCERTAINTY & THEORETICAL TRAJECTORY SIMULATION
  // =========================================================================
  if (lineMode === 'epistemic_simulation') {
    const timeStepsCount = ctx.lineTimeSteps ?? 96;
    const timeStepCategories = Array.from({ length: timeStepsCount + 1 }, (_, i) => i);
    const xAxisTitle = ctx.lineTimeStepIntervalName || 'Time Steps k (15-min intervals / 24-h Cycle)';
    const yAxisTitle = ctx.lineYAxisTitle || 'State Uncertainty Tr(P)';

    // Dynamic Academic Color Palette Resolution (falls back to palette theme colors!)
    const defaultColor1 = palette.colors[0] || '#2E7D32';
    const defaultColor2 = palette.colors[1] || '#00838F';
    const defaultColor3 = palette.accent || palette.colors[2] || palette.text || '#292b2c';

    const baselineColor = (ctx.lineBaselineColor && ctx.lineBaselineColor.trim() !== '') ? ctx.lineBaselineColor : defaultColor1;
    const estimatorColor = (ctx.lineEstimatorColor && ctx.lineEstimatorColor.trim() !== '') ? ctx.lineEstimatorColor : defaultColor2;
    const thresholdColor = (ctx.lineThresholdColor && ctx.lineThresholdColor.trim() !== '') ? ctx.lineThresholdColor : defaultColor3;

    const A = ctx.lineBaselineA ?? 0.15;
    const B = ctx.lineBaselineB ?? 0.038;
    const baselineName = ctx.lineBaselineName || 'Static Architecture (24% CNN / 15% Filter Cohort)';
    const baselineStyle = ctx.lineBaselineStyle || 'dashed';
    const baselineData = Array.from({ length: timeStepsCount + 1 }, (_, k) => +(A * Math.exp(B * k)).toFixed(3));

    const p0 = ctx.lineEstimatorInitial ?? 0.15;
    const drift = ctx.lineEstimatorDrift ?? 0.11;
    const modulation = ctx.lineEstimatorModulation ?? 0.05;
    const thresholdVal = ctx.lineThresholdValue ?? 1.0;
    const estimatorName = ctx.lineEstimatorName || 'Discrete Recursive Estimator (Proposed Gated Pipeline)';
    const estimatorStyle = ctx.lineEstimatorStyle || 'solid';

    const estimatorData: number[] = [];
    const txEventScatterData: [number, number, string][] = [];
    let currentP = p0;
    let txEventCount = 0;

    for (let k = 0; k <= timeStepsCount; k++) {
      estimatorData.push(+currentP.toFixed(3));
      const driftVal = drift + modulation * Math.sin((k / timeStepsCount) * 2 * Math.PI - Math.PI / 2);
      const nextP = currentP + driftVal;
      if (nextP >= thresholdVal) {
        // Step k is a peak transmission event where the green sawtooth reaches the trigger boundary
        txEventCount++;
        const peakVal = +currentP.toFixed(3);
        const eventLabel = `${ctx.lineTxEventLabel || 'TX'} #${txEventCount}`;
        
        txEventScatterData.push([k, peakVal, eventLabel]);
        currentP = p0;
      } else {
        currentP = nextP;
      }
    }

    const thresholdName = ctx.lineThresholdName || 'Semantic Trigger Threshold (ε)';
    const thresholdLabel = ctx.lineThresholdLabel || 'Threshold ε = 1.00';
    const thresholdStyle = ctx.lineThresholdStyle || 'dotted';
    const thresholdPosition = ctx.lineThresholdPosition || 'insideEndTop';
    const thresholdLineWidth = ctx.lineThresholdLineWidth ?? 1.5;

    // Physical Radio TX Events Configuration
    const showTx = ctx.lineShowTxEvents !== false && txEventScatterData.length > 0;
    const txSeriesName = ctx.lineTxEventSeriesName || 'Physical Radio TX Events';
    const txColor = (ctx.lineTxEventColor && ctx.lineTxEventColor.trim() !== '') 
      ? ctx.lineTxEventColor 
      : (palette.accent || palette.colors[2] || '#d9534f');
    const txSymbol = ctx.lineTxEventSymbol || 'triangle';
    const txSize = ctx.lineTxEventSize ?? 12;
    const showTxLabels = ctx.lineShowTxLabels !== false;

    const legendItems = showTx
      ? [baselineName, estimatorName, thresholdName, txSeriesName]
      : [baselineName, estimatorName, thresholdName];
    const isLegendActive = showLegend !== false;

    // Resolve clean legend positioning without top/bottom collision
    const pos = ctx.legendPosition || 'top';
    const isBottom = pos === 'bottom';
    const isTop = pos === 'top';
    const isLeft = pos === 'left';
    const isRight = pos === 'right';

    const legendTop = isTop ? (baseTitle?.show ? 55 : 15) + (ctx.legendDistance ?? 0) : undefined;
    const legendBottom = isBottom ? (ctx.legendDistance ?? 10) : undefined;
    const legendLeft = isLeft ? (ctx.legendDistance ?? 15) : (isRight ? undefined : (ctx.legendAlign === 'left' ? 20 : ctx.legendAlign === 'right' ? undefined : 'center'));
    const legendRight = isRight ? (ctx.legendDistance ?? 15) : (ctx.legendAlign === 'right' ? 20 : undefined);
    const legendOrient = (isLeft || isRight) ? 'vertical' as const : 'horizontal' as const;

    // Calculate effective grid margins (allocating extra breathing room for multi-line wrapped legends)
    const hasTitle = Boolean(baseTitle?.show);
    const isMultiLineLegend = (ctx.legendType || 'plain') === 'plain' && legendItems.length > 2;
    const autoGridTop = hasTitle ? (isTop && isLegendActive ? (isMultiLineLegend ? 95 : 85) : 55) : (isTop && isLegendActive ? (isMultiLineLegend ? 65 : 55) : 30);
    const autoGridBottom = isBottom && isLegendActive ? (isMultiLineLegend ? 78 : 65) : 45;
    const autoGridLeft = isLeft && isLegendActive ? 120 : 60;
    const autoGridRight = isRight && isLegendActive ? 120 : 40;

    const effectiveGridTop = Math.max(15, (ctx.lineGridTop ?? autoGridTop) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetY ?? 0));
    const effectiveGridBottom = Math.max(15, (ctx.lineGridBottom ?? autoGridBottom) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetY ?? 0));
    const effectiveGridLeft = Math.max(15, (ctx.lineGridLeft ?? autoGridLeft) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) - (ctx.fitOffsetX ?? 0));
    const effectiveGridRight = Math.max(15, (ctx.lineGridRight ?? autoGridRight) + (ctx.containerPadding !== undefined ? ctx.containerPadding - 12 : 0) + (ctx.fitOffsetX ?? 0));

    // Calculate clean X-axis label interval
    let effectiveXInterval: number | 'auto' | undefined;
    if (ctx.lineXAxisInterval !== undefined && ctx.lineXAxisInterval !== 'auto') {
      effectiveXInterval = ctx.lineXAxisInterval;
    } else {
      // Auto: if more than 48 points, step every 8 or 12 points
      effectiveXInterval = timeStepsCount >= 144 ? 23 : timeStepsCount >= 80 ? 11 : timeStepsCount >= 40 ? 5 : 'auto';
    }

    const markerSymbol = ctx.lineMarkerSymbol || 'circle';
    const markerSize = ctx.lineMarkerSize ?? 4;
    const showMarkers = ctx.showLineMarkers ?? false;

    // Baseline Area Shading (default: none / 0% to prevent muddy overlap!)
    const baselineFillMode = ctx.lineBaselineFillMode || 'none';
    const baselineOpacity = (ctx.lineBaselineAreaOpacity !== undefined ? ctx.lineBaselineAreaOpacity : 0) / 100;
    let baselineAreaStyle: any = undefined;
    if (baselineFillMode === 'subtle_gradient' && baselineOpacity > 0) {
      baselineAreaStyle = {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: hexToRgba(baselineColor, baselineOpacity) },
            { offset: 1, color: hexToRgba(baselineColor, 0.0) }
          ]
        }
      };
    } else if (baselineFillMode === 'solid' && baselineOpacity > 0) {
      baselineAreaStyle = {
        color: baselineColor,
        opacity: baselineOpacity
      };
    }

    // Estimator Area Shading (default: subtle gradient <= 0.08 solely beneath green curve!)
    const estimatorFillMode = ctx.lineEstimatorFillMode || 'subtle_gradient';
    const estimatorOpacity = (ctx.lineEstimatorAreaOpacity !== undefined ? ctx.lineEstimatorAreaOpacity : 8) / 100;
    let estimatorAreaStyle: any = undefined;
    if (estimatorFillMode === 'subtle_gradient' && estimatorOpacity > 0) {
      estimatorAreaStyle = {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: hexToRgba(estimatorColor, estimatorOpacity) },
            { offset: 1, color: hexToRgba(estimatorColor, 0.0) }
          ]
        }
      };
    } else if (estimatorFillMode === 'solid' && estimatorOpacity > 0) {
      estimatorAreaStyle = {
        color: estimatorColor,
        opacity: estimatorOpacity
      };
    }

    return {
      backgroundColor: palette.bg,
      color: [baselineColor, estimatorColor, thresholdColor, txColor, ...palette.colors],
      title: baseTitle,
      legend: {
        ...baseLegend,
        show: isLegendActive,
        type: ctx.legendType || 'plain',
        data: legendItems,
        orient: legendOrient,
        top: legendTop,
        bottom: legendBottom,
        left: legendLeft,
        right: legendRight,
        align: ctx.legendAlign || 'auto',
        icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : baseLegend.icon,
        itemWidth: ctx.legendItemWidth ?? 25,
        itemHeight: ctx.legendItemHeight ?? baseLegend.itemHeight,
        itemGap: ctx.legendItemGap ?? baseLegend.itemGap,
        textStyle: {
          ...baseLegend.textStyle
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: ctx.lineAxisPointerType || 'cross' },
        backgroundColor: palette.bg,
        borderColor: palette.border,
        textStyle: { fontFamily: font, fontSize: fontSize - 1, color: palette.text }
      },
      grid: resolveUniversalGrid(ctx, {
        left: ctx.lineGridLeft ?? autoGridLeft,
        right: ctx.lineGridRight ?? autoGridRight,
        top: ctx.lineGridTop ?? autoGridTop,
        bottom: ctx.lineGridBottom ?? autoGridBottom
      }),
      xAxis: buildScientificAxisConfig('x', ctx, {
        axisKind: 'category',
        defaultTitle: xAxisTitle,
        categories: timeStepCategories
      }),
      yAxis: buildScientificAxisConfig('y', ctx, {
        axisKind: 'value',
        defaultTitle: yAxisTitle,
        min: ctx.lineYMin !== undefined ? ctx.lineYMin : 0,
        max: ctx.lineYMax !== undefined ? ctx.lineYMax : 4.5
      }),
      series: [
        {
          name: baselineName,
          type: 'line',
          smooth: smoothLine !== false,
          showSymbol: showMarkers,
          symbol: markerSymbol,
          symbolSize: markerSize,
          lineStyle: {
            width: ctx.lineWidth ?? 2,
            color: baselineColor,
            type: baselineStyle
          },
          areaStyle: baselineAreaStyle,
          data: baselineData
        },
        {
          name: estimatorName,
          type: 'line',
          smooth: false,
          showSymbol: showMarkers,
          symbol: markerSymbol,
          symbolSize: markerSize,
          lineStyle: {
            width: ctx.lineWidth ?? 2,
            color: estimatorColor,
            type: estimatorStyle
          },
          areaStyle: estimatorAreaStyle,
          data: estimatorData
        },
        {
          name: thresholdName,
          type: 'line',
          data: [],
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: thresholdColor,
              width: thresholdLineWidth,
              type: thresholdStyle
            },
            data: [
              {
                yAxis: thresholdVal,
                label: {
                  formatter: thresholdLabel,
                  position: thresholdPosition as any,
                  fontFamily: font,
                  fontSize: fontSize - 2,
                  color: palette.text
                }
              }
            ]
          }
        },
        ...(showTx ? [
          {
            name: txSeriesName,
            type: 'scatter',
            symbol: txSymbol,
            symbolSize: txSize,
            symbolRotate: 0,
            itemStyle: {
              color: txColor,
              borderColor: palette.bg,
              borderWidth: 1.5,
              shadowBlur: 3,
              shadowColor: 'rgba(0,0,0,0.18)'
            },
            label: {
              show: showTxLabels,
              formatter: (p: any) => p.data[2] || ctx.lineTxEventLabel || 'TX',
              position: 'top',
              distance: 6,
              fontFamily: font,
              fontSize: Math.max(9, fontSize - 3),
              fontWeight: 'bold',
              color: txColor
            },
            data: txEventScatterData,
            z: 10
          } as any
        ] : [])
      ]
    };
  }

  // =========================================================================
  // PARADIGM 1: EMPIRICAL LITERATURE SYNTHESIS COHORT TREND
  // =========================================================================
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
    (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags),
    ctx.otherCategoryLabel || 'Other'
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
      template: ctx.labelFormat || 'ratio_percent',
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    });

    return {
      name: cat,
      value: val,
      paperCount,
      tagCount,
      prevalencePct,
      tagPct,
      formattedLabel
    };
  });

  const grid = resolveUniversalGrid(ctx, { left: 50, right: 50, top: (showLegend ? 100 : 70), bottom: 50 });

  const labelPos = ctx.universalLabelPosition && ctx.universalLabelPosition !== 'auto'
    ? (ctx.universalLabelPosition === 'outside' ? 'top' : ctx.universalLabelPosition)
    : 'top';
  const labelDist = ctx.universalLabelDistance ?? 5;
  const labelRot = ctx.universalLabelRotate ?? 0;
  const labelFSize = ctx.universalLabelFontSize ?? (fontSize - 2);
  const labelFWeight = (ctx.universalLabelFontWeight || 'bold') as any;
  const labelFStyle = (ctx.universalLabelFontStyle || 'normal') as any;
  const labelLHeight = ctx.universalLabelLineHeight ?? (labelFSize + 3);
  const minThresh = ctx.universalLabelMinThreshold ?? 0;
  const showZero = ctx.universalLabelShowZero ?? true;

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
    grid,
    xAxis: buildScientificAxisConfig('x', ctx, {
      axisKind: 'category',
      defaultTitle: primaryField,
      categories: categories
    }),
    yAxis: buildScientificAxisConfig('y', ctx, {
      axisKind: 'value',
      defaultTitle: metricMode === 'paper_prevalence'
        ? 'Prevalence (% of Cohort)'
        : metricMode === 'tag_share'
        ? 'Tag Share (%)'
        : metricMode === 'avg_qa'
        ? 'Average QA Score'
        : metricMode === 'avg_citation'
        ? 'Average Citation Count'
        : 'Study Count (N)',
      defaultUnitFormatter: (v: any) => (metricMode === 'paper_prevalence' || metricMode === 'tag_share') ? `${v}%` : `${v}`
    }),
    series: [{
      name: metricMode.replace(/_/g, ' ').toUpperCase(),
      type: 'line',
      smooth: smoothLine,
      step: (ctx.lineStepMode && ctx.lineStepMode !== 'none') ? ctx.lineStepMode : undefined,
      data: lineData,
      showSymbol: ctx.showLineMarkers ?? true,
      symbol: ctx.lineMarkerSymbol || 'circle',
      symbolSize: ctx.lineMarkerSize ?? 8,
      itemStyle: {
        color: palette.colors[0] || '#3b82f6',
        borderColor: palette.bg,
        borderWidth: 2,
        shadowBlur: 4,
        shadowColor: hexToRgba(palette.colors[0] || '#3b82f6', 0.4)
      },
      emphasis: {
        scale: 1.35,
        itemStyle: {
          shadowBlur: 10,
          shadowColor: hexToRgba(palette.colors[0] || '#3b82f6', 0.6)
        }
      },
      lineStyle: {
        width: ctx.lineWidth ?? 2.5
      },
      label: {
        show: showDataLabels,
        position: labelPos as any,
        distance: labelDist,
        rotate: labelRot,
        fontFamily: font,
        fontSize: labelFSize,
        fontWeight: labelFWeight,
        fontStyle: labelFStyle,
        lineHeight: labelLHeight,
        color: ctx.universalLabelColor || palette.text,
        formatter: (params: any) => {
          if (!showZero && (params.data?.paperCount === 0 || params.value === 0)) {
            return '';
          }
          if (minThresh > 0) {
            const rawPct = parseFloat(params.data?.prevalencePct ?? '0');
            if (!isNaN(rawPct) && rawPct < minThresh) return '';
          }
          return params.data?.formattedLabel ?? params.value;
        }
      },
      areaStyle: (ctx.lineAreaOpacity !== undefined && ctx.lineAreaOpacity === 0)
        ? undefined
        : {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(palette.colors[0] || '#3b82f6', (ctx.lineAreaOpacity ?? 20) / 100) },
                { offset: 1, color: hexToRgba(palette.colors[0] || '#3b82f6', 0.01) }
              ]
            }
          }
    }]
  };
}
