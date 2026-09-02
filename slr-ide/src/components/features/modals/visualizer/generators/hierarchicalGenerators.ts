import type * as echarts from 'echarts';
import { CUSTOM_GROUPING_KEY } from '../constants/defaultConfigs';
import { getNodeColor } from '../utils/colorUtils';
import { getFieldValue, getMappedFieldValue, stripParentPrefix, resolveUmbrellanizerValue, safeString, extractPaperFieldValues } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';
import { formatMetricDisplay } from '../utils/formatterUtils';
import { balanceQuotasToHundred } from '../utils/quotaBalancer';

export interface ParentContext {
  fieldKey: string;
  levelIdx: number;
  rawName: string;
  displayName: string;
  path: string[];
}

export function filterValuesForParent(
  vals: string[],
  currentFieldKey: string,
  parentContext?: ParentContext,
  options: {
    levelCustomGroupLinks?: Record<number, Record<string, string>>;
    umbrellanizerMap?: Record<string, any>;
  } = {}
): string[] {
  if (!parentContext || !vals || vals.length === 0) return vals;

  const { levelCustomGroupLinks = {}, umbrellanizerMap = {} } = options;
  const parentRaw = parentContext.rawName.trim();
  const parentDisplay = parentContext.displayName.trim();
  const parentField = parentContext.fieldKey;

  const extractBaseKey = (k: string) => {
    if (k.startsWith('ext:macro:') || k.startsWith('macro:ext:')) return k.substring(10);
    if (k.startsWith('ext:sub:') || k.startsWith('sub:ext:')) return k.substring(8);
    if (k.startsWith('ext:leaf:') || k.startsWith('leaf:ext:')) return k.substring(9);
    if (k.startsWith('ext:tail:') || k.startsWith('tail:ext:')) return k.substring(9);
    if (k.startsWith('raw:leaf:ext:') || k.startsWith('raw:tail:ext:')) return k.substring(13);
    if (k.startsWith('raw:ext:') || k.startsWith('raw:')) return k.startsWith('raw:ext:') ? k.substring(8) : k.substring(4);
    if (k.startsWith('ext:')) return k.substring(4);
    return k;
  };

  const currentBaseKey = extractBaseKey(currentFieldKey);
  const parentBaseKey = extractBaseKey(parentField);
  const isSameBaseVariable = Boolean(currentBaseKey && parentBaseKey && currentBaseKey === parentBaseKey);
  const isRawChild = currentFieldKey.startsWith('raw:leaf:ext:') || currentFieldKey.startsWith('raw:tail:ext:') || currentFieldKey.startsWith('raw:ext:') || currentFieldKey.startsWith('raw:');

  // Case 1: Parent level was Custom Grouping Layer (e.g. "Application/Middleware")
  if (parentField === CUSTOM_GROUPING_KEY) {
    const linksMap = levelCustomGroupLinks[parentContext.levelIdx] || levelCustomGroupLinks[0] || {};
    return vals.filter(v => {
      const mappedGroup = linksMap[v];
      if (mappedGroup) {
        return mappedGroup.trim().toLowerCase() === parentRaw.toLowerCase();
      }
      if (v.includes(':')) {
        const prefix = v.split(':')[0].trim();
        return prefix.toLowerCase() === parentRaw.toLowerCase();
      }
      return false;
    });
  }

  // Case 2: Parent was Macro Domain (ext:macro:*)
  if (parentField.startsWith('ext:macro:') || parentField.startsWith('macro:ext:')) {
    return vals.filter(v => {
      // If current is raw token
      if (isRawChild) {
        const resolved = resolveUmbrellanizerValue(v, currentBaseKey, true, umbrellanizerMap);
        if (!resolved) return false;
        const prefix = resolved.includes(':') ? resolved.substring(0, resolved.indexOf(':')).trim() : resolved;
        return prefix.toLowerCase() === parentRaw.toLowerCase();
      }
      // If current is sub-category or full category
      if (v.includes(':')) {
        const prefix = v.substring(0, v.indexOf(':')).trim();
        return prefix.toLowerCase() === parentRaw.toLowerCase();
      }
      // If current is already stripped sub-category, verify against taxonomy map
      if (isSameBaseVariable) {
        const dict = umbrellanizerMap[currentBaseKey] || umbrellanizerMap[`ext:${currentBaseKey}`] || {};
        if (typeof dict === 'object' && dict !== null && Object.keys(dict).length > 0) {
          const dictValues = Array.isArray(dict) ? dict : Object.values(dict);
          const matchingEntry = dictValues.some((entry: any) => {
            const catStr = safeString(typeof entry === 'object' && entry !== null ? (entry.umbrella_category || entry.raw_token) : entry);
            if (!catStr || !catStr.includes(':')) return false;
            const prefix = catStr.substring(0, catStr.indexOf(':')).trim();
            const suffix = catStr.substring(catStr.indexOf(':') + 1).trim();
            return prefix.toLowerCase() === parentRaw.toLowerCase() && suffix.toLowerCase() === v.toLowerCase();
          });
          if (matchingEntry) return true;

          const belongsToAnotherPrefix = dictValues.some((entry: any) => {
            const catStr = safeString(typeof entry === 'object' && entry !== null ? (entry.umbrella_category || entry.raw_token) : entry);
            if (!catStr || !catStr.includes(':')) return false;
            const suffix = catStr.substring(catStr.indexOf(':') + 1).trim();
            return suffix.toLowerCase() === v.toLowerCase();
          });
          if (belongsToAnotherPrefix) return false;
        }
      }
      return true;
    });
  }

  // Case 3: Parent was Sub-Category (ext:sub:*) or Full Category (ext:*) and child is Raw Tokens (raw:ext:* or raw:leaf:ext:*)
  if (isRawChild) {
    return vals.filter(rawToken => {
      // 1. Direct taxonomy resolution
      const resolvedCat = resolveUmbrellanizerValue(rawToken, currentBaseKey, true, umbrellanizerMap);
      if (resolvedCat && resolvedCat !== rawToken) {
        const strippedCat = stripParentPrefix(resolvedCat, parentContext.path?.[0]);
        const suffix = resolvedCat.includes(':') ? resolvedCat.substring(resolvedCat.indexOf(':') + 1).trim() : resolvedCat;
        return (
          resolvedCat.trim().toLowerCase() === parentRaw.toLowerCase() ||
          strippedCat.trim().toLowerCase() === parentDisplay.toLowerCase() ||
          resolvedCat.trim().toLowerCase() === parentDisplay.toLowerCase() ||
          suffix.trim().toLowerCase() === parentDisplay.toLowerCase() ||
          suffix.trim().toLowerCase() === parentRaw.toLowerCase()
        );
      }

      // 2. Lookup in taxonomy dictionary keys/values
      const dict = umbrellanizerMap[currentBaseKey] || umbrellanizerMap[`ext:${currentBaseKey}`] || {};
      if (typeof dict === 'object' && dict !== null && Object.keys(dict).length > 0) {
        const entries = Object.entries(dict);
        const matchFound = entries.some(([k, v]: [string, any]) => {
          const kLeaf = k.lastIndexOf(':') !== -1 ? k.substring(k.lastIndexOf(':') + 1).trim() : k;
          if (k.toLowerCase() === rawToken.toLowerCase() || kLeaf.toLowerCase() === rawToken.toLowerCase()) {
            const catStr = safeString(typeof v === 'object' && v !== null ? (v.umbrella_category || v.raw_token) : v);
            const stripped = stripParentPrefix(catStr, parentContext.path?.[0]);
            const suffix = catStr.includes(':') ? catStr.substring(catStr.indexOf(':') + 1).trim() : catStr;
            return (
              catStr.toLowerCase() === parentRaw.toLowerCase() ||
              stripped.toLowerCase() === parentDisplay.toLowerCase() ||
              catStr.toLowerCase() === parentDisplay.toLowerCase() ||
              suffix.toLowerCase() === parentDisplay.toLowerCase()
            );
          }
          return false;
        });
        if (matchFound) return true;

        const hasOtherExplicitTarget = entries.some(([k]: [string, any]) => {
          const kLeaf = k.lastIndexOf(':') !== -1 ? k.substring(k.lastIndexOf(':') + 1).trim() : k;
          return k.toLowerCase() === rawToken.toLowerCase() || kLeaf.toLowerCase() === rawToken.toLowerCase();
        });
        if (hasOtherExplicitTarget) return false;
      }

      // 3. If rawToken contains colons (e.g. "Web Services: REST"), check if prefix matches parent
      if (rawToken.includes(':')) {
        const pNorm = parentDisplay.toLowerCase();
        const rNorm = parentRaw.toLowerCase();
        const parts = rawToken.split(':').map(s => s.trim().toLowerCase());
        if (parts.some(part => part === pNorm || part === rNorm)) {
          return true;
        }
      }

      // 4. Default: allow token under its paper's branch
      return true;
    });
  }

  return vals;
}

/**
 * Normalizes a taxonomy token or segment for exact, collision-proof canonical equality.
 * Trims whitespace, lowercases, replaces unicode dashes with standard '-', and collapses spaces.
 */
export function normalizeTaxonomySegment(s: string): string {
  if (!s) return '';
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if a specific node value or paper taxonomy token matches a selected colon path filter.
 * Supports both full prefix branches ("Branch: Physical Asset : Edge-Hosted")
 * and cross-parent wildcard segments ("* : Edge-Hosted" or "Segment: Edge-Hosted") which include all parents.
 * Guarantees zero loose substring collisions (e.g. "CNN" will not collide with "1D-CNN" or "CNN-LSTM").
 */
export function matchColonPathFilter(
  val: string,
  filterStr: string,
  fieldKey: string,
  paper: any,
  options: { umbrellanizerMap?: Record<string, any> } = {}
): boolean {
  if (!filterStr || !filterStr.trim()) return true;

  const fTrimmed = filterStr.trim();
  const isWildcardSegment = fTrimmed.startsWith('* :') || fTrimmed.startsWith('*:');
  const targetRaw = isWildcardSegment
    ? fTrimmed.replace(/^\*\s*:\s*/, '').trim()
    : fTrimmed;

  const targetSegmentNorm = normalizeTaxonomySegment(targetRaw);
  const vNorm = normalizeTaxonomySegment(val);

  // Split filterStr into exact branch segments if not wildcard
  const filterBranchSegments = isWildcardSegment
    ? []
    : fTrimmed.split(':').map(normalizeTaxonomySegment).filter(Boolean);

  // Helper to test a sequence of segments from a token against the filter
  const testTokenSegments = (tokenSegments: string[]): boolean => {
    if (tokenSegments.length === 0) return false;

    if (isWildcardSegment) {
      // Must match one of the colon-separated segments exactly
      return tokenSegments.some(seg => seg === targetSegmentNorm);
    } else {
      // Must match the exact branch prefix sequence from the root
      if (tokenSegments.length < filterBranchSegments.length) return false;
      return filterBranchSegments.every((fSeg, idx) => fSeg === tokenSegments[idx]);
    }
  };

  // 1. Direct match on current node value
  if (isWildcardSegment) {
    if (vNorm === targetSegmentNorm) return true;
    const valSegments = val.split(':').map(normalizeTaxonomySegment).filter(Boolean);
    if (valSegments.some(s => s === targetSegmentNorm)) return true;
  } else {
    const valSegments = val.split(':').map(normalizeTaxonomySegment).filter(Boolean);
    if (testTokenSegments(valSegments)) return true;
  }

  // 2. Check against full taxonomy string on paper object
  const isExt = fieldKey.startsWith('ext:') || fieldKey.startsWith('raw:');
  const baseKey = fieldKey.startsWith('ext:macro:') || fieldKey.startsWith('macro:ext:') 
    ? fieldKey.substring(10)
    : fieldKey.startsWith('ext:sub:') || fieldKey.startsWith('sub:ext:')
    ? fieldKey.substring(8)
    : fieldKey.startsWith('ext:leaf:') || fieldKey.startsWith('leaf:ext:') || fieldKey.startsWith('ext:tail:') || fieldKey.startsWith('tail:ext:')
    ? fieldKey.substring(9)
    : fieldKey.startsWith('raw:leaf:ext:') || fieldKey.startsWith('raw:tail:ext:')
    ? fieldKey.substring(13)
    : fieldKey.startsWith('raw:ext:')
    ? fieldKey.substring(8)
    : fieldKey.startsWith('ext:')
    ? fieldKey.substring(4)
    : fieldKey;

  const rawFullTokens = extractPaperFieldValues(paper, isExt ? `ext:${baseKey}` : fieldKey, {
    useUmbrellanizer: false,
    splitMultiValues: true,
    excludeEmpty: true
  });

  for (const rawT of rawFullTokens) {
    const rawSegments = rawT.split(':').map(normalizeTaxonomySegment).filter(Boolean);
    if (testTokenSegments(rawSegments)) return true;

    const resolved = resolveUmbrellanizerValue(rawT, baseKey, true, options.umbrellanizerMap || {});
    if (resolved) {
      const resSegments = resolved.split(':').map(normalizeTaxonomySegment).filter(Boolean);
      if (testTokenSegments(resSegments)) return true;
    }
  }

  return false;
}

export function formatTailLabel(
  tailItems: { name: string; count: number }[],
  style: string = 'comma_list',
  maxChars: number = 36
): string {
  if (!tailItems || tailItems.length === 0) return 'Other';

  const count = tailItems.length;
  const names = tailItems.map(item => item.name);

  if (style === 'plain_other') {
    return 'Other';
  }

  if (style === 'other_count') {
    return `Other (${count} items)`;
  }

  if (style === 'other_items') {
    const listStr = names.join(', ');
    if (listStr.length <= maxChars) {
      return `Other: ${listStr}`;
    }
    let acc = '';
    let used = 0;
    for (let i = 0; i < names.length; i++) {
      const next = (acc ? acc + ', ' : '') + names[i];
      if (next.length > maxChars - 7 && i > 0) {
        return `Other: ${acc} (+${count - used})`;
      }
      acc = next;
      used++;
    }
    return `Other: ${acc}`;
  }

  // Default: 'comma_list'
  const listStr = names.join(', ');
  if (listStr.length <= maxChars) {
    return listStr;
  }
  let acc = '';
  let used = 0;
  for (let i = 0; i < names.length; i++) {
    const next = (acc ? acc + ', ' : '') + names[i];
    if (next.length > maxChars - 7 && i > 0) {
      return `${acc} (+${count - used})`;
    }
    acc = next;
    used++;
  }
  return acc || names[0];
}

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
    sankeyLevelPathFilters = {},
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    enableManualOverrides,
    manualCategoryValues,
    showLegend,
    umbrellanizerMap,
    tailLabelStyle = 'comma_list'
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

  const buildTree = (papersList: any[], levelIdx: number, parentContext?: ParentContext): any[] => {
    if (levelIdx >= sankeyFields.length) return [];

    const fieldKey = sankeyFields[levelIdx];
    const prevKey = levelIdx > 0 ? sankeyFields[levelIdx - 1] : null;
    const limitCount = sankeyMaxNodes[levelIdx] || 0;
    const pathFilter = sankeyLevelPathFilters[levelIdx];
    const groupMap = new Map<string, any[]>();

    papersList.forEach(p => {
      const baseVals = (levelIdx > 0 && fieldKey === prevKey)
        ? getFieldValue(p, fieldKey, mappedOpts)
        : getMappedFieldValue(p, fieldKey, { ...mappedOpts, levelIdx });
      
      const rawVals = pathFilter
        ? baseVals.filter(v => matchColonPathFilter(v, pathFilter, fieldKey, p, { umbrellanizerMap }))
        : baseVals;
      
      const scopedVals = filterValuesForParent(rawVals, fieldKey, parentContext, {
        levelCustomGroupLinks,
        umbrellanizerMap
      });

      scopedVals.forEach(v => {
        if (!groupMap.has(v)) groupMap.set(v, []);
        groupMap.get(v)!.push(p);
      });
    });

    const entries = Array.from(groupMap.entries());
    let processedEntries: [string, any[], { name: string; count: number }[] | undefined][] = [];

    if (limitCount >= 2 && entries.length > limitCount) {
      const sorted = [...entries].sort((a, b) => b[1].length - a[1].length);
      const topEntries = sorted.slice(0, limitCount - 1).map(e => [e[0], e[1], undefined] as [string, any[], undefined]);
      const tailEntries = sorted.slice(limitCount - 1);

      const parentName = parentContext?.rawName || parentContext?.displayName;
      const tailItemsSummary = tailEntries.map(([vName, pList]) => {
        const dName = stripParentPrefix(vName, parentName);
        return { name: dName, count: pList.length };
      });

      const tailDisplayName = formatTailLabel(tailItemsSummary, tailLabelStyle);
      const tailPapers = Array.from(new Set(tailEntries.flatMap(e => e[1])));

      processedEntries = [...topEntries, [tailDisplayName, tailPapers, tailItemsSummary]];
    } else {
      processedEntries = entries.map(e => [e[0], e[1], undefined]);
    }

    return processedEntries.map(([valName, childPapers, tailItems], idx) => {
      const parentName = parentContext?.rawName || parentContext?.displayName;
      const displayName = tailItems ? valName : stripParentPrefix(valName, parentName);
      const color = getNodeColor(displayName, parentName, idx, palette.colors, ctx.customSliceColors) || getNodeColor(valName, parentName, idx, palette.colors, ctx.customSliceColors);

      const nextParentContext: ParentContext = {
        fieldKey,
        levelIdx,
        rawName: valName,
        displayName,
        path: [...(parentContext?.path || []), displayName]
      };

      const children = buildTree(childPapers, levelIdx + 1, nextParentContext);

      const manualVal = manualCategoryValues[displayName] ?? manualCategoryValues[valName];
      const nodeValue = (enableManualOverrides && manualVal !== undefined) ? manualVal : childPapers.length;

      if (children.length > 0) {
        return { name: displayName, itemStyle: { color }, tailItems, children };
      }
      return { name: displayName, value: nodeValue, tailItems, itemStyle: { color } };
    });
  };

  const activeLevelFilters = Object.entries(sankeyLevelPathFilters).filter(([_, filter]) => Boolean(filter && filter.trim()));
  const validTreemapPapers = activeLevelFilters.length === 0
    ? papers
    : papers.filter(p => {
        return activeLevelFilters.every(([lIdxStr, filter]) => {
          const lIdx = Number(lIdxStr);
          const f = sankeyFields[lIdx];
          if (!f) return true;
          const prevF = lIdx > 0 ? sankeyFields[lIdx - 1] : null;
          const baseVals = (lIdx > 0 && f === prevF)
            ? getFieldValue(p, f, mappedOpts)
            : getMappedFieldValue(p, f, { ...mappedOpts, levelIdx: lIdx });
          return baseVals.some(v => matchColonPathFilter(v, filter, f, p, { umbrellanizerMap }));
        });
      });

  const treeData = buildTree(validTreemapPapers, 0);

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    tooltip: {
      ...baseTooltip,
      formatter: (params: any) => {
        const val = params.value ?? (params.data?.children ? params.data.children.reduce((a: number, c: any) => a + (c.value || 0), 0) : 0);
        const pathNames = (params.treePathInfo || []).map((p: any) => p.name).filter(Boolean);
        const pathString = pathNames.length > 1 ? pathNames.join(' &gt; ') : params.name;
        let output = `<strong>${pathString}</strong><br/>Cohort Count / Proportion: ${val}`;
        if (params.data?.tailItems && params.data.tailItems.length > 0) {
          output += `<div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4px; font-size: 11px;">`;
          output += `<strong>Grouped Tail Items (${params.data.tailItems.length}):</strong><br/>`;
          params.data.tailItems.forEach((t: any) => {
            output += `• ${t.name}: ${t.count}<br/>`;
          });
          output += `</div>`;
        }
        return output;
      }
    },
    series: [{
      type: 'treemap',
      top: Math.max(10, (showLegend ? 90 : 60) + (ctx.containerPadding ?? 12) - (ctx.fitOffsetY ?? 0)),
      bottom: Math.max(10, (ctx.containerPadding ?? 12) + (ctx.fitOffsetY ?? 0)),
      left: Math.max(10, (ctx.containerPadding ?? 12) - (ctx.fitOffsetX ?? 0)),
      right: Math.max(10, (ctx.containerPadding ?? 12) + (ctx.fitOffsetX ?? 0)),
      data: treeData,
      squareRatio: ctx.treemapAlgorithm === 'sliceAndDice' ? 0.1 : ctx.treemapAlgorithm === 'binary' ? 1.0 : 0.5 * (1 + Math.sqrt(5)),
      leafDepth: ctx.treemapVisibleDepth ?? 2,
      label: { show: true, fontFamily: font, fontSize: fontSize - 1, formatter: '{b}\n{c}' },
      levels: [{ 
        itemStyle: { 
          borderColor: palette.bg, 
          borderWidth: ctx.treemapBorderWidth ?? 2, 
          gapWidth: ctx.treemapGapWidth ?? 2 
        } 
      }]
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
    sankeyLabelPositions = {},
    sankeyMaxNodes = {},
    tailLabelStyle = 'comma_list',
    sankeyNodeWidth = 20,
    sankeyNodeGap = 18,
    sankeyLeftPadding = 8,
    sankeyRightPadding = 20,
    sankeyTopPadding,
    sankeyBottomPadding,
    sankeyOrient = 'horizontal',
    sankeyNodeAlign = 'justify',
    sankeyCurveness = 0.5,
    sankeyLinkColorMode = 'gradient',
    sankeyLinkOpacity = 45,
    sankeyNodeBorderRadius = 2,
    sankeyNodeBorderWidth = 1,
    sankeyLayoutIterations = 32,
    sankeyDraggable = true,
    sankeyLabelPosition = 'auto',
    sankeyLabelDistance = 6,
    sankeyLabelOverflow = 'break',
    sankeyMaxLabelWidth = 120,
    sankeyLabelFontSize,
    sankeyLabelRotate = 0,
    sankeyEmphasisFocus = 'adjacency',
    sankeyLevelLabelFormats = {},
    sankeyLevelNodeGaps = {},
    sankeyLevelLabelDistances = {},
    sankeyLevelNodeWidths = {},
    sankeyLevelPathFilters = {},
    sankeySort = 'desc',
    sankeyLabelLineHeight,
    sankeyLabelFontWeight = '600',
    sankeyLabelColor,
    showDataLabels = true,
    labelFormat,
    limitCategories = false,
    maxCategoriesCount = 10,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    customSliceColors,
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

  // Pre-filter papers so only papers whose entire path satisfies active level filters participate in the Sankey flow
  const activeLevelFilters = Object.entries(sankeyLevelPathFilters).filter(([_, filter]) => Boolean(filter && filter.trim()));
  const validSankeyPapers = activeLevelFilters.length === 0
    ? papers
    : papers.filter(p => {
        return activeLevelFilters.every(([lIdxStr, filter]) => {
          const lIdx = Number(lIdxStr);
          const f = sankeyFields[lIdx];
          if (!f) return true;
          const prevF = lIdx > 0 ? sankeyFields[lIdx - 1] : null;
          const baseVals = (lIdx > 0 && f === prevF)
            ? getFieldValue(p, f, mappedOpts)
            : getMappedFieldValue(p, f, { ...mappedOpts, levelIdx: lIdx });
          return baseVals.some(v => matchColonPathFilter(v, filter, f, p, { umbrellanizerMap }));
        });
      });

  const totalCohort = validSankeyPapers.length || 1;
  const nodesSet = new Set<string>();
  const nodePapersMap = new Map<string, Set<string>>();
  const nodeTagCountsMap = new Map<string, number>();
  const levelTotalTags = new Map<number, number>();
  const nodeTailItemsMap = new Map<string, { name: string; count: number }[]>();
  const linksMap = new Map<string, number>();

  const allowedLevelSets = sankeyFields.map((fieldKey, idx) => {
    const limitCount = (sankeyMaxNodes && sankeyMaxNodes[idx] !== undefined && sankeyMaxNodes[idx] > 0)
      ? sankeyMaxNodes[idx]
      : (limitCategories && maxCategoriesCount > 0 ? maxCategoriesCount : 0);

    if (limitCount < 1) return null;

    const prevF = idx > 0 ? sankeyFields[idx - 1] : null;
    const pathFilter = sankeyLevelPathFilters[idx];
    const counts = new Map<string, number>();
    validSankeyPapers.forEach(p => {
      const baseVals = (idx > 0 && fieldKey === prevF)
        ? getFieldValue(p, fieldKey, mappedOpts)
        : getMappedFieldValue(p, fieldKey, { ...mappedOpts, levelIdx: idx });
      const vals = pathFilter
        ? baseVals.filter(v => matchColonPathFilter(v, pathFilter, fieldKey, p, { umbrellanizerMap }))
        : baseVals;
      vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    });

    if (counts.size <= limitCount) return null;

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const topCount = Math.max(1, limitCount - 1);
    const topEntries = sorted.slice(0, topCount);
    const tailEntries = sorted.slice(topCount);
    const tailItems = tailEntries.map(e => ({ name: e[0], count: e[1] }));
    const tailName = formatTailLabel(tailItems, tailLabelStyle);

    return {
      topSet: new Set<string>(topEntries.map(e => e[0])),
      tailName,
      tailItems
    };
  });

  validSankeyPapers.forEach(p => {
    const pId = p.Paper_ID || String(Math.random());
    const levelValues = sankeyFields.map((f, idx) => {
      const prevF = idx > 0 ? sankeyFields[idx - 1] : null;
      const pathFilter = sankeyLevelPathFilters[idx];
      const baseVals = (idx > 0 && f === prevF)
        ? getFieldValue(p, f, mappedOpts)
        : getMappedFieldValue(p, f, { ...mappedOpts, levelIdx: idx });
      const rawVals = pathFilter
        ? baseVals.filter(v => matchColonPathFilter(v, pathFilter, f, p, { umbrellanizerMap }))
        : baseVals;
      
      const levelFilter = allowedLevelSets[idx];
      if (!levelFilter) return rawVals;

      const mapped = rawVals.map(v => {
        if (levelFilter.topSet.has(v)) return v;
        return levelFilter.tailName;
      });
      return Array.from(new Set(mapped));
    });

    // Register node occurrences, tags, and papers for every level
    levelValues.forEach((vals, lIdx) => {
      levelTotalTags.set(lIdx, (levelTotalTags.get(lIdx) || 0) + vals.length);
      vals.forEach(v => {
        const nodeKey = `${lIdx + 1}: ${v}`;
        nodesSet.add(nodeKey);
        nodeTagCountsMap.set(nodeKey, (nodeTagCountsMap.get(nodeKey) || 0) + 1);
        if (!nodePapersMap.has(nodeKey)) nodePapersMap.set(nodeKey, new Set());
        nodePapersMap.get(nodeKey)!.add(pId);

        const curFilter = allowedLevelSets[lIdx];
        if (curFilter && v === curFilter.tailName) {
          nodeTailItemsMap.set(nodeKey, curFilter.tailItems);
        }
      });
    });

    // Register transitions/links between adjacent levels
    for (let i = 0; i < levelValues.length - 1; i++) {
      const currentField = sankeyFields[i];
      const nextField = sankeyFields[i + 1];
      const currentVals = levelValues[i];
      const rawNextVals = levelValues[i + 1];

      currentVals.forEach(cv => {
        const sourceNode = `${i + 1}: ${cv}`;

        // Strict parent scoping for next level nodes
        const scopedNextVals = filterValuesForParent(rawNextVals, nextField, {
          fieldKey: currentField,
          levelIdx: i,
          rawName: cv,
          displayName: cv,
          path: [cv]
        }, { levelCustomGroupLinks, umbrellanizerMap });

        scopedNextVals.forEach(nv => {
          const targetNode = `${i + 2}: ${nv}`;
          const linkKey = `${sourceNode}--->${targetNode}`;
          linksMap.set(linkKey, (linksMap.get(linkKey) || 0) + 1);
        });
      });
    }
  });

  // Calculate Hare-Hamilton 100.00% balanced quota tag shares per level
  const levelBalancedTagSharePcts = new Map<number, Map<string, number>>();
  sankeyFields.forEach((_, lIdx) => {
    const levelTotal = levelTotalTags.get(lIdx) || 0;
    const levelNodes = Array.from(nodesSet).filter(n => n.startsWith(`${lIdx + 1}: `));
    const quotaInputs = levelNodes.map(n => ({
      name: n,
      count: nodeTagCountsMap.get(n) || (nodePapersMap.get(n)?.size || 0)
    }));
    const balancedMap = balanceQuotasToHundred(quotaInputs, levelTotal);
    levelBalancedTagSharePcts.set(lIdx, balancedMap);
  });

  // Level-by-level node sorting
  const sortedNodeKeys = sankeyFields.flatMap((_, lIdx) => {
    const prefix = `${lIdx + 1}: `;
    const levelNodes = Array.from(nodesSet).filter(n => n.startsWith(prefix));

    if (sankeySort === 'desc') {
      return levelNodes.sort((a, b) => {
        const aVal = nodePapersMap.get(a)?.size || 0;
        const bVal = nodePapersMap.get(b)?.size || 0;
        if (bVal !== aVal) return bVal - aVal;
        const aClean = a.substring(prefix.length);
        const bClean = b.substring(prefix.length);
        return aClean.localeCompare(bClean);
      });
    } else if (sankeySort === 'asc') {
      return levelNodes.sort((a, b) => {
        const aVal = nodePapersMap.get(a)?.size || 0;
        const bVal = nodePapersMap.get(b)?.size || 0;
        if (aVal !== bVal) return aVal - bVal;
        const aClean = a.substring(prefix.length);
        const bClean = b.substring(prefix.length);
        return aClean.localeCompare(bClean);
      });
    } else if (sankeySort === 'alpha') {
      return levelNodes.sort((a, b) => {
        const aClean = a.substring(prefix.length);
        const bClean = b.substring(prefix.length);
        return aClean.localeCompare(bClean);
      });
    }
    // 'none': Natural insertion order
    return levelNodes;
  });

  const nodes = sortedNodeKeys.map((n, idx) => {
    const colonIdx = n.indexOf(': ');
    const levelNum = colonIdx > -1 ? parseInt(n.substring(0, colonIdx), 10) : 1;
    const cleanName = colonIdx > -1 ? n.substring(colonIdx + 2) : n;
    const levelIdx = levelNum - 1;

    const customPos = sankeyLabelPositions[levelIdx];
    let resolvedPos: 'left' | 'right' | 'inside' | 'top' | 'bottom';
    if (customPos) {
      resolvedPos = customPos;
    } else if (sankeyLabelPosition && sankeyLabelPosition !== 'auto') {
      resolvedPos = sankeyLabelPosition;
    } else {
      resolvedPos = levelNum === sankeyFields.length ? 'left' : 'right';
    }

    const color = getNodeColor(cleanName, undefined, idx, palette.colors, customSliceColors);
    const paperCount = nodePapersMap.get(n)?.size || 0;
    const tagCount = nodeTagCountsMap.get(n) || paperCount;
    const levelTotalTagsCount = levelTotalTags.get(levelIdx) || totalCohort;
    const prevalencePct = totalCohort > 0 ? (paperCount / totalCohort) * 100 : 0;
    const tagSharePct = levelBalancedTagSharePcts.get(levelIdx)?.get(n) 
      ?? (levelTotalTagsCount > 0 ? (tagCount / levelTotalTagsCount) * 100 : 0);
    const effLevelFormat = sankeyLevelLabelFormats[levelIdx] || labelFormat || 'name';

    const formattedLabelText = formatMetricDisplay({
      name: cleanName,
      count: ctx.metricMode === 'tag_share' ? tagCount : paperCount,
      val: ctx.metricMode === 'tag_share' ? tagCount : paperCount,
      paperCount: paperCount,
      tagCount: tagCount,
      totalCohortPapers: totalCohort,
      totalExtractedTags: levelTotalTagsCount,
      metricMode: ctx.metricMode || 'count',
      prevalencePct: prevalencePct,
      tagSharePct: tagSharePct,
      activePct: ctx.metricMode === 'tag_share' ? tagSharePct : prevalencePct,
      template: effLevelFormat,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    });

    const effFontSize = sankeyLabelFontSize || (fontSize - 1);
    const effLineHeight = sankeyLabelLineHeight ?? (effFontSize + 3);
    const effTextColor = (sankeyLabelColor && sankeyLabelColor.trim() !== '') ? sankeyLabelColor : palette.text;
    const effLabelDistance = (sankeyLevelLabelDistances && sankeyLevelLabelDistances[levelIdx] !== undefined)
      ? sankeyLevelLabelDistances[levelIdx]
      : sankeyLabelDistance;

    const labelObj: any = {
      show: showDataLabels,
      position: resolvedPos,
      distance: effLabelDistance,
      fontFamily: font,
      fontSize: effFontSize,
      fontWeight: sankeyLabelFontWeight,
      color: effTextColor,
      lineHeight: effLineHeight,
      rotate: sankeyLabelRotate,
      formatter: () => formattedLabelText
    };

    if (sankeyLabelOverflow !== 'none') {
      labelObj.overflow = sankeyLabelOverflow;
      labelObj.width = sankeyMaxLabelWidth;
    }

    return {
      name: n,
      value: paperCount,
      itemStyle: {
        color,
        borderColor: palette.bg,
        borderWidth: sankeyNodeBorderWidth,
        borderRadius: sankeyNodeBorderRadius
      },
      label: labelObj
    };
  });

  const resolvedLinkColor = sankeyLinkColorMode === 'source' ? 'source' 
    : sankeyLinkColorMode === 'target' ? 'target' 
    : 'gradient';

  const links = Array.from(linksMap.entries()).map(([k, val]) => {
    const [source, target] = k.split('--->');
    return {
      source,
      target,
      value: val,
      lineStyle: {
        color: resolvedLinkColor,
        curveness: sankeyCurveness,
        opacity: Math.max(0.1, Math.min(1.0, sankeyLinkOpacity / 100))
      }
    };
  });

  const effectiveLeft = Math.max(2, sankeyLeftPadding - Math.round((ctx.fitOffsetX ?? 0) * 0.3));
  const effectiveRight = Math.max(2, sankeyRightPadding + Math.round((ctx.fitOffsetX ?? 0) * 0.3));
  const effectiveTop = Math.max(4, (sankeyTopPadding ?? (showLegend ? 14 : 10)) - Math.round((ctx.fitOffsetY ?? 0) * 0.3));
  const effectiveBottom = Math.max(4, (sankeyBottomPadding ?? 8) + Math.round((ctx.fitOffsetY ?? 0) * 0.3));

  const levels = sankeyFields.map((_, lIdx) => {
    const levelNodeGap = sankeyLevelNodeGaps[lIdx] ?? sankeyNodeGap;
    return {
      depth: lIdx,
      nodeGap: levelNodeGap
    };
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
          const lvl = idx > -1 ? name.substring(0, idx) : '1';
          const lvlNum = parseInt(lvl, 10);
          const lvlIdx = lvlNum - 1;
          const clean = idx > -1 ? name.substring(idx + 2) : name;
          const pCount = nodePapersMap.get(name)?.size || params.value || 0;
          const tCount = nodeTagCountsMap.get(name) || pCount;
          const lTotalTags = levelTotalTags.get(lvlIdx) || totalCohort;
          const prevPct = totalCohort > 0 ? ((pCount / totalCohort) * 100).toFixed(1) : '0.0';
          const tSharePct = levelBalancedTagSharePcts.get(lvlIdx)?.get(name)?.toFixed(2) 
            ?? (lTotalTags > 0 ? ((tCount / lTotalTags) * 100).toFixed(2) : '0.00');
          
          let output = `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">`;
          output += `<strong style="color:${palette.text};font-size:13px;">${clean}</strong> <span style="font-size:10px;color:${palette.subtext};">[Level ${lvl}]</span><br/>`;
          output += `<span style="color:${palette.subtext};">Unique Paper Prevalence:</span> <strong>${pCount} / ${totalCohort} papers</strong> <span style="color:${palette.subtext};font-size:11px;">(~${prevPct}% of cohort)</span>`;
          
          if (tCount !== pCount || lTotalTags !== totalCohort) {
            output += `<br/><span style="color:${palette.subtext};">Tag Share Distribution:</span> <strong>${tCount} / ${lTotalTags} tags</strong> <span style="color:${palette.subtext};font-size:11px;">(${tSharePct}% of Level ${lvl})</span>`;
          }

          const tailItems = nodeTailItemsMap.get(name);
          if (tailItems && tailItems.length > 0) {
            output += `<div style="margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 4px; font-size: 11px;">`;
            output += `<strong>Grouped Tail Categories (${tailItems.length}):</strong><br/>`;
            tailItems.forEach(t => {
              output += `• ${t.name}: <strong>${t.count}</strong><br/>`;
            });
            output += `</div>`;
          }
          output += `</div>`;
          return output;
        }
        if (params.dataType === 'edge') {
          const src = params.data.source;
          const tgt = params.data.target;
          const srcClean = src.indexOf(': ') > -1 ? src.substring(src.indexOf(': ') + 2) : src;
          const tgtClean = tgt.indexOf(': ') > -1 ? tgt.substring(tgt.indexOf(': ') + 2) : tgt;
          const flowVal = params.data.value || 0;
          const srcCount = nodePapersMap.get(src)?.size || flowVal;
          const tgtCount = nodePapersMap.get(tgt)?.size || flowVal;
          const srcSharePct = srcCount > 0 ? ((flowVal / srcCount) * 100).toFixed(1) : '100.0';
          const tgtSharePct = tgtCount > 0 ? ((flowVal / tgtCount) * 100).toFixed(1) : '100.0';
          const cohortFlowPct = totalCohort > 0 ? ((flowVal / totalCohort) * 100).toFixed(1) : '0.0';

          return `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">
            <strong>${srcClean}</strong> <span style="color:${palette.subtext};">→</span> <strong>${tgtClean}</strong><br/>
            <span style="color:${palette.subtext};">Transition Flow Volume:</span> <strong>${flowVal} papers</strong> <span style="color:${palette.subtext};font-size:11px;">(~${cohortFlowPct}% of cohort)</span><br/>
            <span style="color:${palette.subtext};">Share of Source (${srcClean}):</span> <strong>${srcSharePct}%</strong><br/>
            <span style="color:${palette.subtext};">Share of Target (${tgtClean}):</span> <strong>${tgtSharePct}%</strong>
          </div>`;
        }
        return '';
      }
    },
    series: [{
      type: 'sankey',
      orient: sankeyOrient,
      nodeAlign: sankeyNodeAlign,
      layoutIterations: sankeyLayoutIterations,
      draggable: sankeyDraggable,
      left: `${effectiveLeft}%`,
      right: `${effectiveRight}%`,
      top: `${effectiveTop}%`,
      bottom: `${effectiveBottom}%`,
      nodeWidth: sankeyNodeWidth,
      nodeGap: sankeyNodeGap,
      levels: levels,
      data: nodes,
      links: links,
      emphasis: { focus: sankeyEmphasisFocus },
      lineStyle: {
        color: resolvedLinkColor,
        curveness: sankeyCurveness,
        opacity: Math.max(0.1, Math.min(1.0, sankeyLinkOpacity / 100))
      }
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
    sankeyLevelPathFilters = {},
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
    legendDistance = 20,
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

  const buildTree = (papersList: any[], levelIdx: number, parentContext?: ParentContext): any[] => {
    if (levelIdx >= sankeyFields.length) return [];

    const fieldKey = sankeyFields[levelIdx];
    const prevField = levelIdx > 0 ? sankeyFields[levelIdx - 1] : null;
    const limitCount = sankeyMaxNodes[levelIdx] || 0;
    const pathFilter = sankeyLevelPathFilters[levelIdx];
    const groupMap = new Map<string, any[]>();

    papersList.forEach(p => {
      const baseVals = (levelIdx > 0 && fieldKey === prevField)
        ? getFieldValue(p, fieldKey, mappedOpts)
        : getMappedFieldValue(p, fieldKey, { ...mappedOpts, levelIdx });
      
      const rawVals = pathFilter
        ? baseVals.filter(v => matchColonPathFilter(v, pathFilter, fieldKey, p, { umbrellanizerMap }))
        : baseVals;
      
      const scopedVals = filterValuesForParent(rawVals, fieldKey, parentContext, {
        levelCustomGroupLinks,
        umbrellanizerMap
      });

      scopedVals.forEach(v => {
        if (!groupMap.has(v)) groupMap.set(v, []);
        groupMap.get(v)!.push(p);
      });
    });

    const entries = Array.from(groupMap.entries());
    let processedEntries: [string, any[], { name: string; count: number }[] | undefined][] = [];

    if (limitCount >= 2 && entries.length > limitCount) {
      const sorted = [...entries].sort((a, b) => b[1].length - a[1].length);
      const topEntries = sorted.slice(0, limitCount - 1).map(e => [e[0], e[1], undefined] as [string, any[], undefined]);
      const tailEntries = sorted.slice(limitCount - 1);

      const parentName = parentContext?.rawName || parentContext?.displayName;
      const tailItemsSummary = tailEntries.map(([vName, pList]) => {
        const dName = stripParentPrefix(vName, parentName);
        return { name: dName, count: pList.length };
      });

      const tailDisplayName = formatTailLabel(tailItemsSummary, ctx.tailLabelStyle || 'comma_list');
      const tailPapers = Array.from(new Set(tailEntries.flatMap(e => e[1])));

      processedEntries = [...topEntries, [tailDisplayName, tailPapers, tailItemsSummary]];
    } else {
      processedEntries = entries.map(e => [e[0], e[1], undefined]);
    }

    return processedEntries.map(([valName, childPapers, tailItems], idx) => {
      const parentName = parentContext?.rawName || parentContext?.displayName;
      const displayName = tailItems ? valName : stripParentPrefix(valName, parentName);
      const color = getNodeColor(displayName, parentName, idx, palette.colors, customSliceColors) || getNodeColor(valName, parentName, idx, palette.colors, customSliceColors);

      const nextParentContext: ParentContext = {
        fieldKey,
        levelIdx,
        rawName: valName,
        displayName,
        path: [...(parentContext?.path || []), displayName]
      };

      const children = buildTree(childPapers, levelIdx + 1, nextParentContext);

      const manualVal = manualCategoryValues[displayName] ?? manualCategoryValues[valName];
      const nodeValue = (enableManualOverrides && manualVal !== undefined)
        ? manualVal
        : childPapers.length;

      if (children.length > 0) {
        return {
          name: displayName,
          itemStyle: { color },
          tailItems,
          children
        };
      }
      return {
        name: displayName,
        value: nodeValue,
        tailItems,
        itemStyle: { color }
      };
    });
  };

  const activeLevelFilters = Object.entries(sankeyLevelPathFilters).filter(([_, filter]) => Boolean(filter && filter.trim()));
  const validSunburstPapers = activeLevelFilters.length === 0
    ? papers
    : papers.filter(p => {
        return activeLevelFilters.every(([lIdxStr, filter]) => {
          const lIdx = Number(lIdxStr);
          const f = sankeyFields[lIdx];
          if (!f) return true;
          const prevF = lIdx > 0 ? sankeyFields[lIdx - 1] : null;
          const baseVals = (lIdx > 0 && f === prevF)
            ? getFieldValue(p, f, mappedOpts)
            : getMappedFieldValue(p, f, { ...mappedOpts, levelIdx: lIdx });
          return baseVals.some(v => matchColonPathFilter(v, filter, f, p, { umbrellanizerMap }));
        });
      });

  const sunburstData = buildTree(validSunburstPapers, 0);
  const scaleFactor = chartScale > 10 ? chartScale / 100 : (chartScale || 1.0);

  const computeTotal = (data: any[]): number => {
    return data.reduce((sum: number, d: any) => {
      if (d.value !== undefined) return sum + d.value;
      if (d.children) return sum + computeTotal(d.children);
      return sum;
    }, 0);
  };

  const totalValue = computeTotal(sunburstData);

  let defaultCenterX = 50;
  let defaultCenterY = 50;
  let defaultMaxRadius = 88;

  if (showLegend) {
    if (sunburstLegendPosition.includes('right')) {
      defaultCenterX = Math.max(32, 48 - Math.round(legendDistance / 5));
      defaultMaxRadius = 66;
    } else if (sunburstLegendPosition.includes('left')) {
      defaultCenterX = Math.min(68, 52 + Math.round(legendDistance / 5));
      defaultMaxRadius = 66;
    } else if (sunburstLegendPosition.startsWith('top')) {
      defaultCenterY = 56;
      defaultMaxRadius = 70;
    } else if (sunburstLegendPosition.startsWith('bottom')) {
      defaultCenterY = 44;
      defaultMaxRadius = 70;
    }
  }

  const effectiveFitOffsetX = ctx.fitOffsetX ?? panX ?? 0;
  const effectiveFitOffsetY = ctx.fitOffsetY ?? panY ?? 0;
  const padDeduction = Math.round(((ctx.containerPadding ?? 12) - 12) * 0.4);
  const adjustedMaxRadius = Math.max(30, defaultMaxRadius - padDeduction);

  const centerX = `${defaultCenterX + effectiveFitOffsetX}%`;
  const centerY = `${defaultCenterY + effectiveFitOffsetY}%`;

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
      maxLabelWidth: 80,
      labelFormat: 'name'
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
      fontSize: lvlConf.fontSize || (fontSize - (l === 0 ? 1 : 2)),
      color: lvlConf.color || palette.text,
      fontWeight: l === 0 ? 'bold' : 'normal'
    };

    const overflowMode = lvlConf.overflow || 'none';
    if (overflowMode !== 'none') {
      labelObj.overflow = overflowMode;
      labelObj.width = lvlConf.maxLabelWidth || 80;
      labelObj.lineHeight = Math.max(12, (lvlConf.fontSize || 11) + 2);
    }

    const lblFormat = lvlConf.labelFormat || ctx.labelFormat || 'name';
    labelObj.formatter = (params: any) => {
      let name = params.name || '';
      if (overflowMode === 'break') {
        name = name.replace(/\//g, '/\n');
      }
      if (lblFormat === 'name' || lblFormat === 'name_only') return name;

      const nodeVal = params.value !== undefined ? params.value : (params.data?.children ? computeTotal(params.data.children) : 0);
      const rawPct = totalValue > 0 ? (nodeVal / totalValue) * 100 : 0;

      return formatMetricDisplay({
        name,
        val: nodeVal,
        count: nodeVal,
        paperCount: nodeVal,
        totalCohortPapers: totalValue,
        totalExtractedTags: totalValue,
        prevalencePct: rawPct,
        activePct: rawPct,
        template: lblFormat,
        decimalPrecision: ctx.decimalPrecision,
        useTildeForCoarse: ctx.useTildeForCoarse,
        ratioStyle: ctx.ratioStyle,
        forceCohortDenominator: ctx.forceCohortDenominator
      });
    };

    const scaledR0 = lvlConf.r0;
    const scaledR = lvlConf.r;

    levels.push({
      r0: `${scaledR0}%`,
      r: `${scaledR}%`,
      itemStyle: { borderWidth: lvlConf.borderWidth ?? 2, borderColor: palette.bg },
      label: labelObj
    });
  }

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

  const effectiveLegendFormat = sunburstLegendFormat || ctx.legendFormat || 'name';
  const legendData = Array.from(legendMap.entries()).map(([name, meta]) => {
    const pct = totalValue > 0 ? (meta.count / totalValue) * 100 : 0;
    const label = formatLegendLabel(name, {
      paperCount: meta.count,
      tagCount: meta.count,
      count: meta.count,
      percent: pct,
      prevalencePct: pct,
      totalCohortPapers: totalValue,
      totalExtractedTags: totalValue,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: ctx.forceCohortDenominator
    }, effectiveLegendFormat);
    return {
      name: label,
      icon: 'circle',
      itemStyle: {
        color: meta.color
      }
    };
  });

  const resolvedPosKey = ctx.legendPosition || sunburstLegendPosition || 'bottom';
  const legendPosMap: Record<string, any> = {
    'top': { top: (baseTitle?.show ? 55 : 15) + legendDistance, left: 'center' },
    'bottom': { bottom: legendDistance, left: 'center' },
    'left': { left: legendDistance, top: 'middle' },
    'right': { right: legendDistance, top: 'middle' },
    'top-left': { top: 15, left: legendDistance },
    'top-center': { top: legendDistance, left: 'center' },
    'top-right': { top: 15, right: legendDistance },
    'bottom-left': { bottom: 15, left: legendDistance },
    'bottom-center': { bottom: legendDistance, left: 'center' },
    'bottom-right': { bottom: 15, right: legendDistance }
  };

  const legendPos = legendPosMap[resolvedPosKey] || { bottom: legendDistance, left: 'center' };
  const legendOrient = (resolvedPosKey === 'left' || resolvedPosKey === 'right') ? 'vertical' : 'horizontal';

  return {
    backgroundColor: palette.bg,
    color: palette.colors,
    title: baseTitle,
    tooltip: {
      ...baseTooltip,
      formatter: (params: any) => {
        const val = params.value ?? (params.data?.children ? params.data.children.reduce((a: number, c: any) => a + (c.value || 0), 0) : 0);
        const pathNames = (params.treePathInfo || []).map((p: any) => p.name).filter(Boolean);
        const pathString = pathNames.length > 1 ? pathNames.join(' &gt; ') : params.name;
        const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(ctx.decimalPrecision ?? 1) : null;
        const pctStr = pct !== null ? ` (${pct}%)` : '';
        let output = `<strong>${pathString}</strong><br/>Cohort Count / Proportion: ${val}${pctStr}`;
        if (params.data?.tailItems && params.data.tailItems.length > 0) {
          output += `<div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4px; font-size: 11px;">`;
          output += `<strong>Grouped Tail Items (${params.data.tailItems.length}):</strong><br/>`;
          params.data.tailItems.forEach((t: any) => {
            const tPct = totalValue > 0 ? ` (${((t.count / totalValue) * 100).toFixed(1)}%)` : '';
            output += `• ${t.name}: ${t.count}${tPct}<br/>`;
          });
          output += `</div>`;
        }
        return output;
      }
    },
    legend: showLegend ? {
      show: true,
      type: 'scroll',
      data: legendData,
      ...legendPos,
      orient: legendOrient,
      z: 20,
      textStyle: { 
        color: palette.text, 
        fontFamily: font, 
        fontSize: ctx.legendFontSize ?? Math.max(9, (fontSize - 3)), 
        fontWeight: 'bold',
        width: ctx.legendWidth && ctx.legendWidth > 0 ? ctx.legendWidth : undefined,
        lineHeight: ctx.legendLineHeight ?? 14,
        overflow: ctx.legendOverflow || 'break'
      },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: ctx.legendItemGap ?? 10,
      pageIconColor: palette.text,
      pageTextStyle: { color: palette.text }
    } : { show: false },
    series: [
      {
        type: 'sunburst',
        data: sunburstData,
        radius: [0, `${adjustedMaxRadius}%`],
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
