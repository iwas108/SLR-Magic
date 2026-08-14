import type * as echarts from 'echarts';
import { getNodeColor } from '../utils/colorUtils';
import { getFieldValue, getMappedFieldValue } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';

export function generateTreemapOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseTooltip,
    sankeyFields,
    sankeyMaxNodes,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    enableManualOverrides,
    manualCategoryValues,
    showLegend,
    umbrellanizerMap
  } = ctx;

  const mappedOpts = {
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields
  };

  const allowedLevelSets = sankeyFields.map((fieldKey) => {
    const limitCount = sankeyMaxNodes[0] || 0; // fallback / limit
    if (limitCount < 2) return null;

    const counts = new Map<string, number>();
    papers.forEach(p => {
      const vals = getMappedFieldValue(p, fieldKey, mappedOpts);
      vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    });

    if (counts.size <= limitCount) return null;

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return new Set<string>(sorted.slice(0, limitCount - 1).map(e => e[0]));
  });

  const buildTree = (papersList: any[], levelIdx: number, parentName?: string): any[] => {
    if (levelIdx >= sankeyFields.length) return [];

    const fieldKey = sankeyFields[levelIdx];
    const prevKey = levelIdx > 0 ? sankeyFields[levelIdx - 1] : null;
    const topSet = allowedLevelSets[levelIdx];
    const groupMap = new Map<string, any[]>();

    papersList.forEach(p => {
      const rawVals = (levelIdx > 0 && fieldKey === prevKey)
        ? getFieldValue(p, fieldKey, mappedOpts)
        : getMappedFieldValue(p, fieldKey, { ...mappedOpts, levelIdx });
      const mappedVals = topSet ? Array.from(new Set(rawVals.map(v => topSet.has(v) ? v : 'Other'))) : rawVals;

      mappedVals.forEach(v => {
        if (!groupMap.has(v)) groupMap.set(v, []);
        groupMap.get(v)!.push(p);
      });
    });

    const entries = Array.from(groupMap.entries());
    return entries.map(([valName, childPapers], idx) => {
      const color = getNodeColor(valName, parentName, idx, palette.colors, ctx.customSliceColors);
      const children = buildTree(childPapers, levelIdx + 1, valName);

      const manualVal = manualCategoryValues[valName];
      const nodeValue = (enableManualOverrides && manualVal !== undefined) ? manualVal : childPapers.length;

      if (children.length > 0) {
        return { name: valName, itemStyle: { color }, children };
      }
      return { name: valName, value: nodeValue, itemStyle: { color } };
    });
  };

  const treeData = buildTree(papers, 0);

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    tooltip: baseTooltip,
    series: [{
      type: 'treemap',
      top: showLegend ? 90 : 70,
      bottom: '5%',
      data: treeData,
      label: { show: true, fontFamily: font, fontSize: fontSize - 1, formatter: '{b}\n{c}' },
      levels: [{ itemStyle: { borderColor: palette.bg, borderWidth: 2, gapWidth: 2 } }]
    }]
  };
}

export function generateSankeyOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseTooltip,
    sankeyFields,
    sankeyLabelPositions,
    sankeyMaxNodes,
    sankeyNodeWidth,
    sankeyNodeGap,
    sankeyLeftPadding,
    sankeyRightPadding,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    customSliceColors,
    showLegend,
    umbrellanizerMap
  } = ctx;

  const nodesSet = new Set<string>();
  const linksMap = new Map<string, number>();

  const mappedOpts = {
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields
  };

  const allowedLevelSets = sankeyFields.map((fieldKey, idx) => {
    const limitCount = sankeyMaxNodes[idx] || 0;
    if (limitCount < 2) return null;

    const counts = new Map<string, number>();
    papers.forEach(p => {
      const vals = getMappedFieldValue(p, fieldKey, mappedOpts);
      vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    });

    if (counts.size <= limitCount) return null;

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return new Set<string>(sorted.slice(0, limitCount - 1).map(e => e[0]));
  });

  papers.forEach(p => {
    const levelValues = sankeyFields.map((f, idx) => {
      const prevF = idx > 0 ? sankeyFields[idx - 1] : null;
      const rawVals = (idx > 0 && f === prevF)
        ? getFieldValue(p, f, mappedOpts)
        : getMappedFieldValue(p, f, { ...mappedOpts, levelIdx: idx });
      const topSet = allowedLevelSets[idx];
      if (!topSet) return rawVals;

      const mapped = rawVals.map(v => (topSet.has(v) ? v : 'Other'));
      return Array.from(new Set(mapped));
    });

    for (let i = 0; i < levelValues.length - 1; i++) {
      const currentVals = levelValues[i];
      const nextVals = levelValues[i + 1];

      currentVals.forEach(cv => {
        const sourceNode = `${i + 1}: ${cv}`;
        nodesSet.add(sourceNode);

        nextVals.forEach(nv => {
          const targetNode = `${i + 2}: ${nv}`;
          nodesSet.add(targetNode);

          const linkKey = `${sourceNode}--->${targetNode}`;
          linksMap.set(linkKey, (linksMap.get(linkKey) || 0) + 1);
        });
      });
    }
  });

  const nodes = Array.from(nodesSet).map((n, idx) => {
    const colonIdx = n.indexOf(': ');
    const levelNum = colonIdx > -1 ? parseInt(n.substring(0, colonIdx), 10) : 1;
    const cleanName = colonIdx > -1 ? n.substring(colonIdx + 2) : n;
    const levelIdx = levelNum - 1;

    const customPos = sankeyLabelPositions[levelIdx];
    const defaultPos = levelNum === sankeyFields.length ? ('left' as const) : ('right' as const);
    const position = customPos || defaultPos;
    const color = getNodeColor(cleanName, undefined, idx, palette.colors, customSliceColors);

    return {
      name: n,
      itemStyle: { color },
      label: { position }
    };
  });

  const links = Array.from(linksMap.entries()).map(([k, val]) => {
    const [source, target] = k.split('--->');
    return { source, target, value: val };
  });

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    tooltip: {
      ...baseTooltip,
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const name = params.name;
          const idx = name.indexOf(': ');
          return idx > -1 ? name.substring(idx + 2) : name;
        }
        if (params.dataType === 'edge') {
          const src = params.data.source;
          const tgt = params.data.target;
          const srcClean = src.indexOf(': ') > -1 ? src.substring(src.indexOf(': ') + 2) : src;
          const tgtClean = tgt.indexOf(': ') > -1 ? tgt.substring(tgt.indexOf(': ') + 2) : tgt;
          return `${srcClean} → ${tgtClean}: ${params.data.value} papers`;
        }
        return '';
      }
    },
    series: [{
      type: 'sankey',
      left: `${sankeyLeftPadding}%`,
      right: `${sankeyRightPadding}%`,
      top: showLegend ? 90 : 75,
      bottom: '8%',
      nodeWidth: sankeyNodeWidth,
      nodeGap: sankeyNodeGap,
      data: nodes,
      links: links,
      emphasis: { focus: 'adjacency' },
      label: {
        fontFamily: font,
        fontSize: fontSize - 1,
        color: palette.text,
        formatter: (params: any) => {
          const name = params.name;
          const idx = name.indexOf(': ');
          return idx > -1 ? name.substring(idx + 2) : name;
        }
      },
      lineStyle: { color: 'gradient', curveness: 0.5 }
    }]
  };
}

export function generateSunburstOption(ctx: ChartGeneratorContext): echarts.EChartsOption {
  const {
    papers,
    palette,
    font,
    fontSize,
    baseTitle,
    baseTooltip,
    sankeyFields,
    sankeyMaxNodes,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    enableManualOverrides,
    manualCategoryValues,
    customSliceColors,
    showDataLabels,
    sunburstLevelConfigs,
    sunburstSort,
    sunburstNodeClick,
    sunburstEmphasisFocus,
    chartScale,
    panX,
    panY,
    showLegend,
    sunburstLegendLevel,
    sunburstLegendFormat,
    sunburstLegendPosition,
    umbrellanizerMap
  } = ctx;

  const mappedOpts = {
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    sankeyFields
  };

  const allowedLevelSets = sankeyFields.map((fieldKey, idx) => {
    const limitCount = sankeyMaxNodes[idx] || 0;
    if (limitCount < 2) return null;

    const counts = new Map<string, number>();
    papers.forEach(p => {
      const vals = getMappedFieldValue(p, fieldKey, mappedOpts);
      vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    });

    if (counts.size <= limitCount) return null;

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return new Set<string>(sorted.slice(0, limitCount - 1).map(e => e[0]));
  });

  const buildTree = (papersList: any[], levelIdx: number, parentName?: string): any[] => {
    if (levelIdx >= sankeyFields.length) return [];

    const field = sankeyFields[levelIdx];
    const prevField = levelIdx > 0 ? sankeyFields[levelIdx - 1] : null;
    const topSet = allowedLevelSets[levelIdx];
    const groupMap = new Map<string, any[]>();

    papersList.forEach(p => {
      const rawVals = (levelIdx > 0 && field === prevField)
        ? getFieldValue(p, field, mappedOpts)
        : getMappedFieldValue(p, field, { ...mappedOpts, levelIdx });
      const mappedVals = topSet ? Array.from(new Set(rawVals.map(v => topSet.has(v) ? v : 'Other'))) : rawVals;

      mappedVals.forEach(v => {
        if (!groupMap.has(v)) groupMap.set(v, []);
        groupMap.get(v)!.push(p);
      });
    });

    const entries = Array.from(groupMap.entries());
    return entries.map(([valName, childPapers], idx) => {
      const color = getNodeColor(valName, parentName, idx, palette.colors, customSliceColors);
      const children = buildTree(childPapers, levelIdx + 1, valName);

      const manualVal = manualCategoryValues[valName];
      const nodeValue = (enableManualOverrides && manualVal !== undefined)
        ? manualVal
        : childPapers.length;

      if (children.length > 0) {
        return {
          name: valName,
          itemStyle: { color },
          children
        };
      }
      return {
        name: valName,
        value: nodeValue,
        itemStyle: { color }
      };
    });
  };

  const sunburstData = buildTree(papers, 0);
  const scaleFactor = chartScale / 100;

  const levels: any[] = [{}];
  const numLevels = sankeyFields.length;

  for (let l = 0; l < numLevels; l++) {
    const lvlConf = sunburstLevelConfigs[l] || {
      r0: l === 0 ? 15 : (l === 1 ? 40 : 75),
      r: l === 0 ? 40 : (l === 1 ? 75 : 77),
      position: l === 0 ? 'inside' : 'outside',
      rotate: l === 0 ? 'tangential' : 'radial',
      align: 'right',
      minAngle: 0,
      borderWidth: 2,
      fontSize: 11,
      overflow: 'none',
      maxLabelWidth: 80
    };

    const resolvedRotate = lvlConf.rotate === 'flat' ? 0 : lvlConf.rotate;

    const labelObj: any = {
      show: showDataLabels,
      position: lvlConf.position,
      rotate: resolvedRotate,
      align: lvlConf.position === 'outside' ? (lvlConf.align || 'right') : undefined,
      minAngle: lvlConf.minAngle ?? 0,
      padding: lvlConf.position === 'outside' ? 3 : 0,
      silent: false,
      fontFamily: font,
      fontSize: Math.max(8, Math.round((lvlConf.fontSize || (fontSize - (l === 0 ? 1 : 2))) * Math.min(1.3, scaleFactor))),
      color: lvlConf.color || palette.text,
      fontWeight: l === 0 ? 'bold' : 'normal'
    };

    const overflowMode = lvlConf.overflow || 'none';
    if (overflowMode !== 'none') {
      labelObj.overflow = overflowMode;
      labelObj.width = lvlConf.maxLabelWidth || 80;
      labelObj.lineHeight = Math.max(12, (lvlConf.fontSize || 11) + 2);
    }

    if (overflowMode === 'break') {
      labelObj.formatter = (params: any) => {
        const name = params.name || '';
        return name.replace(/\//g, '/\n');
      };
    }

    const scaledR0 = Math.round(lvlConf.r0 * scaleFactor);
    const scaledR = Math.round(lvlConf.r * scaleFactor);

    levels.push({
      r0: `${scaledR0}%`,
      r: `${scaledR}%`,
      itemStyle: { borderWidth: lvlConf.borderWidth ?? 2, borderColor: palette.bg },
      label: labelObj
    });
  }

  const computeTotal = (data: any[]): number => {
    return data.reduce((sum: number, d: any) => {
      if (d.value !== undefined) return sum + d.value;
      if (d.children) return sum + computeTotal(d.children);
      return sum;
    }, 0);
  };

  const totalValue = computeTotal(sunburstData);

  interface SunburstLegendMeta {
    name: string;
    count: number;
    color: string;
  }

  const collectNodesAtLevel = (data: any[], targetLevel: number, currentLevel: number = 0): SunburstLegendMeta[] => {
    if (currentLevel === targetLevel) {
      return data.map(d => ({
        name: d.name,
        count: d.value !== undefined ? d.value : computeTotal(d.children || []),
        color: d.itemStyle?.color || palette.colors[0]
      }));
    }
    const items: SunburstLegendMeta[] = [];
    data.forEach(d => {
      if (d.children) {
        items.push(...collectNodesAtLevel(d.children, targetLevel, currentLevel + 1));
      }
    });
    return items;
  };

  const rawLegendItems = collectNodesAtLevel(sunburstData, sunburstLegendLevel);

  const legendMap = new Map<string, { count: number; color: string }>();
  rawLegendItems.forEach(item => {
    if (!legendMap.has(item.name)) {
      legendMap.set(item.name, { count: item.count, color: item.color });
    } else {
      const existing = legendMap.get(item.name)!;
      existing.count += item.count;
    }
  });

  const effectiveLegendFormat = ctx.legendFormat || sunburstLegendFormat || 'name';
  const legendData = Array.from(legendMap.entries()).map(([name, meta]) => {
    const pct = totalValue > 0 ? ((meta.count / totalValue) * 100).toFixed(2) : '0.00';
    const label = formatLegendLabel(name, { paperCount: meta.count, percent: pct }, effectiveLegendFormat);
    return {
      name: label,
      icon: 'circle',
      itemStyle: {
        color: meta.color
      }
    };
  });

  const legendPosMap: Record<string, any> = {
    'top-left': { top: 15, left: 20 },
    'top-center': { top: 15, left: 'center' },
    'top-right': { top: 15, right: 20 },
    'left': { left: 20, top: 'center' },
    'right': { right: 20, top: 'center' },
    'bottom-left': { bottom: 15, left: 20 },
    'bottom-center': { bottom: 15, left: 'center' },
    'bottom-right': { bottom: 15, right: 20 }
  };

  const legendPos = legendPosMap[sunburstLegendPosition] || { bottom: 15, left: 'center' };
  const legendOrient = (sunburstLegendPosition === 'left' || sunburstLegendPosition === 'right') ? 'vertical' : 'horizontal';

  let defaultCenterX = 50;
  let defaultCenterY = 50;
  let defaultMaxRadius = 88;

  if (showLegend) {
    if (sunburstLegendPosition.includes('right')) {
      defaultCenterX = 38;
      defaultMaxRadius = 64;
    } else if (sunburstLegendPosition.includes('left')) {
      defaultCenterX = 62;
      defaultMaxRadius = 64;
    } else if (sunburstLegendPosition.startsWith('top')) {
      defaultCenterY = 56;
      defaultMaxRadius = 70;
    } else if (sunburstLegendPosition.startsWith('bottom')) {
      defaultCenterY = 44;
      defaultMaxRadius = 70;
    }
  }

  const centerX = `${defaultCenterX + panX}%`;
  const centerY = `${defaultCenterY + panY}%`;
  const scaledMaxRadius = Math.round(defaultMaxRadius * scaleFactor);

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    tooltip: {
      ...baseTooltip,
      formatter: (params: any) => {
        const val = params.value ?? (params.data?.children ? params.data.children.reduce((a: number, c: any) => a + (c.value || 0), 0) : '');
        return `<strong>${params.name}</strong><br/>Cohort Count / Proportion: ${val}`;
      }
    },
    legend: showLegend ? {
      show: true,
      type: 'scroll',
      data: legendData,
      ...legendPos,
      orient: legendOrient,
      z: 20,
      textStyle: { color: palette.text, fontFamily: font, fontSize: Math.max(9, (fontSize - 3)), fontWeight: 'bold' },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 10,
      pageIconColor: palette.text,
      pageTextStyle: { color: palette.text }
    } : { show: false },
    series: [
      {
        type: 'sunburst',
        data: sunburstData,
        radius: [0, `${scaledMaxRadius}%`],
        center: [centerX, centerY],
        sort: sunburstSort === 'none' ? undefined : sunburstSort,
        nodeClick: sunburstNodeClick === 'none' ? false : sunburstNodeClick,
        emphasis: {
          focus: sunburstEmphasisFocus === 'none' ? undefined : sunburstEmphasisFocus
        },
        levels,
        itemStyle: { borderRadius: 3, borderWidth: 1, borderColor: palette.bg }
      },
      ...(showLegend ? [{
        type: 'pie' as const,
        radius: [0, 0],
        center: [centerX, centerY],
        silent: true,
        label: { show: false },
        labelLine: { show: false },
        data: legendData
      }] : [])
    ]
  };
}
