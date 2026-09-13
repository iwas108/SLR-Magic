import type * as echarts from 'echarts';
import { CUSTOM_GROUPING_KEY } from '../constants/defaultConfigs';
import { getNodeColor, getContrastingTextColor } from '../utils/colorUtils';
import { getFieldValue, getMappedFieldValue, stripParentPrefix, resolveUmbrellanizerValue, safeString, extractPaperFieldValues, extractTokenPaths, parseColonTaxonomySegments } from '../utils/dataExtractor';
import type { ChartGeneratorContext } from './types';
import { formatLegendLabel } from './types';
import type { DisplayFormatTemplate } from '../types';
import { formatMetricDisplay } from '../utils/formatterUtils';
import { balanceQuotasToHundred } from '../utils/quotaBalancer';
import { wrapAxisLabelText } from './axisConfigHelper';

export interface ParentContext {
  fieldKey: string;
  levelIdx: number;
  rawName: string;
  displayName: string;
  path: string[];
  color?: string;
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

  // Case 0: Current level is Custom Grouping Layer (values already scoped to childPapers)
  if (currentFieldKey === CUSTOM_GROUPING_KEY) {
    return vals;
  }

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

  // Support comma-separated multiple allowed filters (OR match)
  if (filterStr.includes(',')) {
    const subFilters = filterStr.split(',').map(s => s.trim()).filter(Boolean);
    return subFilters.some(sf => matchColonPathFilter(val, sf, fieldKey, paper, options));
  }

  // Support negation (!Cloud Hosted or NOT Cloud Hosted)
  const trimmedFilter = filterStr.trim();
  if (trimmedFilter.startsWith('!') || trimmedFilter.startsWith('NOT ')) {
    const positiveFilter = trimmedFilter.replace(/^(!|NOT\s+)/i, '').trim();
    return !matchColonPathFilter(val, positiveFilter, fieldKey, paper, options);
  }

  const fTrimmed = trimmedFilter;
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
    baseLegend,
    baseTooltip,
    sankeyFields,
    sankeyMaxNodes = {},
    sankeyLevelPathFilters = {},
    levelSegmentIndices = {},
    levelScopeFilters = {},
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    enableManualOverrides,
    manualCategoryValues = {},
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
    levelCustomGroups: ctx.levelCustomGroups,
    levelTargetFields: ctx.levelTargetFields,
    sankeyFields
  };

  // Active effective levels: collapse empty unconfigured custom grouping layers
  const effectiveLevels = sankeyFields
    .map((f, idx) => ({ fieldKey: f, originalIdx: idx }))
    .filter(({ fieldKey, originalIdx }) => {
      if (fieldKey !== CUSTOM_GROUPING_KEY) return true;
      const groups = ctx.levelCustomGroups?.[originalIdx] || [];
      const links = ctx.levelCustomGroupLinks?.[originalIdx] || {};
      return groups.length > 0 || Object.keys(links).length > 0;
    });
  const activeLevels = effectiveLevels.length > 0 ? effectiveLevels : [{ fieldKey: sankeyFields[0] || 'Year', originalIdx: 0 }];

  const buildTree = (papersList: any[], levelIdx: number, parentContext?: ParentContext): any[] => {
    if (levelIdx >= activeLevels.length) return [];

    const { fieldKey, originalIdx } = activeLevels[levelIdx];
    const prevKey = levelIdx > 0 ? activeLevels[levelIdx - 1].fieldKey : null;
    const limitCount = sankeyMaxNodes[originalIdx] || 0;
    const pathFilter = sankeyLevelPathFilters[originalIdx];
    const groupMap = new Map<string, any[]>();

    papersList.forEach(p => {
      const baseVals = (levelIdx > 0 && fieldKey === prevKey)
        ? getFieldValue(p, fieldKey, {
            ...mappedOpts,
            segmentIdx: levelSegmentIndices[originalIdx],
            scopeFilter: levelScopeFilters[originalIdx]
          })
        : getMappedFieldValue(p, fieldKey, {
            ...mappedOpts,
            levelIdx: originalIdx,
            segmentIdx: levelSegmentIndices[originalIdx],
            scopeFilter: levelScopeFilters[originalIdx]
          });
      
      const rawVals = pathFilter
        ? baseVals.filter(v => matchColonPathFilter(v, pathFilter, fieldKey, p, { umbrellanizerMap }))
        : baseVals;
      
      const scopedVals = filterValuesForParent(rawVals, fieldKey, parentContext, {
        levelCustomGroupLinks,
        umbrellanizerMap
      });

      const uniqueScopedVals = Array.from(new Set(scopedVals));
      uniqueScopedVals.forEach(v => {
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

    const totalSiblings = processedEntries.length;
    const siblingValues = processedEntries.map(([vName, cPapers, tItems]) => {
      const parentName = parentContext?.rawName || parentContext?.displayName;
      const dName = tItems ? vName : stripParentPrefix(vName, parentName);
      const manualVal = manualCategoryValues?.[dName] ?? manualCategoryValues?.[vName];
      const uniquePaperCount = new Set(cPapers.map(p => p.Paper_ID || p.id || p.Title || p)).size;
      return (enableManualOverrides && manualVal !== undefined) ? manualVal : uniquePaperCount;
    });
    const maxSiblingVal = Math.max(...siblingValues, 1);
    const minSiblingVal = Math.min(...siblingValues, 0);
    const totalSiblingVal = siblingValues.reduce((a, b) => a + b, 0);

    return processedEntries.map(([valName, childPapers, tailItems], idx) => {
      const parentName = parentContext?.rawName || parentContext?.displayName;
      const displayName = tailItems ? valName : stripParentPrefix(valName, parentName);
      const nodeValue = siblingValues[idx];
      const resolvedColorMode: 'branch_gradient' | 'parent_flow' | 'value_weighted_tint' | 'level_discrete' | 'rainbow_discrete' =
        ctx.treemapColorMode === 'value_weighted' ? 'value_weighted_tint' :
        ctx.treemapColorMode === 'depth_fade' ? 'branch_gradient' :
        (ctx.treemapColorMode || (ctx.smartColorMode as any) || 'branch_gradient');

      const color = getNodeColor(
        displayName, 
        parentName, 
        idx, 
        palette.colors, 
        ctx.customSliceColors,
        parentContext?.color,
        totalSiblings,
        levelIdx,
        resolvedColorMode,
        nodeValue,
        maxSiblingVal,
        minSiblingVal,
        totalSiblingVal,
        ctx.smartColorPropagation || 'auto_children'
      ) || getNodeColor(
        valName, 
        parentName, 
        idx, 
        palette.colors, 
        ctx.customSliceColors,
        parentContext?.color,
        totalSiblings,
        levelIdx,
        resolvedColorMode,
        nodeValue,
        maxSiblingVal,
        minSiblingVal,
        totalSiblingVal,
        ctx.smartColorPropagation || 'auto_children'
      );

      const nextParentContext: ParentContext = {
        fieldKey,
        levelIdx,
        rawName: valName,
        displayName,
        color,
        path: [...(parentContext?.path || []), displayName]
      };

      const children = buildTree(childPapers, levelIdx + 1, nextParentContext);

      const tileTextColor = getContrastingTextColor(color, '#0f172a', '#ffffff');
      if (children.length > 0) {
        return { name: displayName, itemStyle: { color }, label: { color: tileTextColor }, tailItems, children };
      }
      return { name: displayName, value: nodeValue, tailItems, itemStyle: { color }, label: { color: tileTextColor } };
    });
  };

  const activeLevelFilters = Object.entries(sankeyLevelPathFilters).filter(([_, filter]) => Boolean(filter && filter.trim()));
  const validTreemapPapers = activeLevelFilters.length === 0
    ? papers
    : papers.filter(p => {
        return activeLevelFilters.every(([lIdxStr, filter]) => {
          const lIdx = Number(lIdxStr);
          const activeLvl = activeLevels[lIdx];
          if (!activeLvl) return true;
          const { fieldKey: f, originalIdx: origIdx } = activeLvl;
          const prevF = lIdx > 0 ? activeLevels[lIdx - 1]?.fieldKey : null;
          const baseVals = (lIdx > 0 && f === prevF)
            ? getFieldValue(p, f, {
                ...mappedOpts,
                segmentIdx: levelSegmentIndices[origIdx],
                scopeFilter: levelScopeFilters[origIdx]
              })
            : getMappedFieldValue(p, f, {
                ...mappedOpts,
                levelIdx: origIdx,
                segmentIdx: levelSegmentIndices[origIdx],
                scopeFilter: levelScopeFilters[origIdx]
              });
          return baseVals.some(v => matchColonPathFilter(v, filter, f, p, { umbrellanizerMap }));
        });
      });

  const getNodeValue = (paramsOrData: any): number => {
    if (!paramsOrData) return 0;
    if (typeof paramsOrData.value === 'number' && !isNaN(paramsOrData.value)) {
      return paramsOrData.value;
    }
    const data = paramsOrData.data ?? paramsOrData;
    if (typeof data.value === 'number' && !isNaN(data.value)) {
      return data.value;
    }
    if (data.children && Array.isArray(data.children)) {
      return data.children.reduce((acc: number, c: any) => acc + getNodeValue(c), 0);
    }
    return 0;
  };

  const treeData = buildTree(validTreemapPapers, 0);
  const totalTreemapVal = treeData.reduce((acc, d) => acc + getNodeValue(d), 0);
  const isGlobalCohort = ctx.treemapCohortMode === 'global';
  const effectiveDenominator = isGlobalCohort ? (papers.length || 1) : (totalTreemapVal || 1);

  const effectiveLegendFormat = ctx.legendFormat || 'name';
  const rootLegendData = treeData.map(d => {
    const val = getNodeValue(d);
    const label = formatLegendLabel(d.name, {
      paperCount: val,
      count: val,
      percent: effectiveDenominator > 0 ? (val / effectiveDenominator) * 100 : 0,
      totalCohortPapers: effectiveDenominator,
      decimalPrecision: ctx.decimalPrecision,
      useTildeForCoarse: ctx.useTildeForCoarse,
      ratioStyle: ctx.ratioStyle,
      forceCohortDenominator: true
    }, effectiveLegendFormat);
    return {
      name: label,
      value: val,
      icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : 'roundRect',
      itemStyle: { color: d.itemStyle?.color }
    };
  });

    const hasVisibleTitle = Boolean(baseTitle && (baseTitle as any).show !== false);
    const effectiveTreemapLegendPos = String(ctx.legendPosition || 'bottom');
    const defaultTreemapTop = showLegend && effectiveTreemapLegendPos === 'top'
      ? (hasVisibleTitle ? 85 : 55)
      : (hasVisibleTitle ? 55 : 20);
    const defaultTreemapBottom = showLegend && effectiveTreemapLegendPos === 'bottom' ? 55 : 20;
    const defaultTreemapLeft = showLegend && effectiveTreemapLegendPos === 'left' ? 140 : 20;
    const defaultTreemapRight = showLegend && effectiveTreemapLegendPos === 'right' ? 140 : 20;

    const treemapTop = ctx.gridMarginTop !== undefined ? ctx.gridMarginTop : defaultTreemapTop;
    const treemapBottom = ctx.gridMarginBottom !== undefined ? ctx.gridMarginBottom : defaultTreemapBottom;
    const treemapLeft = ctx.gridMarginLeft !== undefined ? ctx.gridMarginLeft : defaultTreemapLeft;
    const treemapRight = ctx.gridMarginRight !== undefined ? ctx.gridMarginRight : defaultTreemapRight;

    const isDark = Boolean(palette.isDark || palette.bg === '#0f172a' || palette.bg === '#1e293b' || palette.bg === '#000000' || palette.bg === '#090d16' || palette.bg === '#0b0f19' || palette.bg === '#030712');
    const resolveBorderColor = (colorMode?: string, customColor?: string) => {
      if (colorMode === 'transparent') return 'transparent';
      if (colorMode === 'contrast') return isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';
      if (colorMode === 'custom' && customColor) return customColor;
      return palette.bg;
    };
    const globalBorderColor = resolveBorderColor(ctx.treemapBorderColorMode, ctx.treemapBorderColor);
    const globalGapWidth = ctx.treemapGapWidth ?? 2;
    const globalBorderWidth = ctx.treemapBorderWidth ?? 2;
    const globalBorderRadius = ctx.treemapBorderRadius ?? 0;
    const globalShowLabels = ctx.treemapShowLabels ?? true;
    const globalLabelFormat = ctx.treemapLabelFormat || 'name_count';
    const globalLabelPosition = ctx.treemapLabelPosition || 'inside';
    const globalLabelFontSize = ctx.treemapLabelFontSize ?? (fontSize - 1);
    const globalLabelFontWeight = ctx.treemapLabelFontWeight || '600';
    const globalLabelFontStyle = ctx.treemapLabelFontStyle || 'normal';
    const globalLabelOverflow = ctx.treemapLabelOverflow || 'break';
    const globalShowUpperLabel = ctx.treemapShowUpperLabel ?? false;
    const globalUpperHeight = ctx.treemapUpperLabelHeight ?? 24;
    const globalUpperFontSize = ctx.treemapUpperLabelFontSize ?? (fontSize - 1);
    const globalUpperFontWeight = ctx.treemapUpperLabelFontWeight || 'bold';
    const globalUpperFormat = ctx.treemapUpperLabelFormat || 'name';
    const globalUpperBgColor = ctx.treemapUpperLabelBgColor || 'rgba(0,0,0,0.18)';
    const globalVisibleMin = ctx.treemapVisibleMin ?? 10;
    const globalChildrenVisibleMin = ctx.treemapChildrenVisibleMin ?? 0;
    const globalLabelColor = (ctx.treemapLabelColorMode === 'custom' && ctx.treemapLabelColor)
      ? ctx.treemapLabelColor
      : (ctx.treemapLabelColorMode === 'inherit_theme' ? palette.text : undefined);

    const formatTileLabel = (name: string, val: number, template: DisplayFormatTemplate = 'name_count') => {
      const pct = effectiveDenominator > 0 ? (val / effectiveDenominator) * 100 : 0;
      return formatMetricDisplay({
        name,
        val,
        count: val,
        paperCount: val,
        totalCohortPapers: effectiveDenominator,
        totalExtractedTags: effectiveDenominator,
        activePct: pct,
        prevalencePct: pct,
        template,
        decimalPrecision: ctx.decimalPrecision,
        useTildeForCoarse: ctx.useTildeForCoarse,
        ratioStyle: ctx.ratioStyle,
        forceCohortDenominator: true
      });
    };

    const levels = [
      {
        itemStyle: {
          borderColor: globalBorderColor,
          borderWidth: globalBorderWidth,
          gapWidth: globalGapWidth,
          borderRadius: globalBorderRadius
        },
        upperLabel: { show: false }
      },
      ...activeLevels.map((lvl, lIdx) => {
        const lvlConf = ctx.treemapLevelConfigs?.[lIdx] || {};
        const isLeafLevel = lIdx === activeLevels.length - 1;
        const hasChildren = !isLeafLevel;

        const lvlGapWidth = lvlConf.gapWidth ?? Math.max(0, globalGapWidth - lIdx);
        const lvlBorderWidth = lvlConf.borderWidth ?? Math.max(1, globalBorderWidth - lIdx);
        const lvlBorderRadius = lvlConf.borderRadius ?? globalBorderRadius;
        const lvlBorderColor = lvlConf.borderColor || globalBorderColor;

        const showUpper = lvlConf.showUpperLabel !== undefined ? lvlConf.showUpperLabel : (hasChildren && globalShowUpperLabel);
        const upperHeight = lvlConf.upperLabelHeight ?? globalUpperHeight;
        const upperFontSize = lvlConf.upperLabelFontSize ?? globalUpperFontSize;
        const upperFontWeight = lvlConf.upperLabelFontWeight ?? globalUpperFontWeight;
        const upperFormat = lvlConf.upperLabelFormat ?? globalUpperFormat;
        const upperBgColor = lvlConf.upperLabelBgColor ?? globalUpperBgColor;
        const upperColorMode = lvlConf.upperLabelColorMode ?? ctx.treemapUpperLabelColorMode ?? 'auto_contrast';
        const upperTextColor = (upperColorMode === 'custom' && (lvlConf.upperLabelColor || ctx.treemapUpperLabelColor))
          ? (lvlConf.upperLabelColor || ctx.treemapUpperLabelColor)
          : (upperColorMode === 'inherit_theme' ? palette.text : getContrastingTextColor(upperBgColor, '#0f172a', '#ffffff'));

        const showDataLabel = lvlConf.showLabel !== undefined ? lvlConf.showLabel : (hasChildren && showUpper ? false : globalShowLabels);
        const labelPos = lvlConf.labelPosition ?? globalLabelPosition;
        const labelFormatTpl = lvlConf.labelFormat ?? globalLabelFormat;
        const isStaleDefaultFontSize = lvlConf.fontSize === 12 || lvlConf.fontSize === 11 || lvlConf.fontSize === 10;
        const isStaleDefaultWidth = lvlConf.labelWidth === 140 || lvlConf.labelWidth === 120 || lvlConf.labelWidth === 110;
        const isStaleDefaultLineHeight = lvlConf.lineHeight === 15 || lvlConf.lineHeight === 14;

        const labelFSize = (lvlConf.fontSize !== undefined && !isStaleDefaultFontSize)
          ? lvlConf.fontSize
          : (ctx.treemapLabelFontSize !== undefined ? ctx.treemapLabelFontSize : (lvlConf.fontSize ?? Math.max(8, fontSize - 1 - lIdx)));
        const labelFWeight = lvlConf.fontWeight ?? (lIdx === 0 ? 'bold' : globalLabelFontWeight);
        const labelFStyle = lvlConf.fontStyle ?? globalLabelFontStyle;
        const labelOverflow = lvlConf.overflow ?? globalLabelOverflow;
        const labelColorMode = lvlConf.colorMode ?? ctx.treemapLabelColorMode ?? 'auto_contrast';
        const labelColor = (labelColorMode === 'custom' && (lvlConf.color || ctx.treemapLabelColor))
          ? (lvlConf.color || ctx.treemapLabelColor)
          : (labelColorMode === 'inherit_theme' ? palette.text : undefined);

        const levelColorAlpha = lvlConf.colorAlpha ?? (
          ctx.treemapColorMode === 'depth_fade'
            ? [Math.max(0.2, (ctx.treemapColorAlphaMin ?? 0.7) - lIdx * 0.15), ctx.treemapColorAlphaMax ?? 1.0]
            : undefined
        );
        const levelColorSaturation = lvlConf.colorSaturation ?? (
          ctx.treemapColorSaturationMin !== undefined && ctx.treemapColorSaturationMax !== undefined
            ? [ctx.treemapColorSaturationMin, ctx.treemapColorSaturationMax]
            : undefined
        );

        const labelWidth = (lvlConf.labelWidth !== undefined && !isStaleDefaultWidth)
          ? lvlConf.labelWidth
          : (ctx.treemapLabelWidth !== undefined ? ctx.treemapLabelWidth : (lvlConf.labelWidth ?? 120));
        const labelLineHeight = (lvlConf.lineHeight !== undefined && !isStaleDefaultLineHeight)
          ? lvlConf.lineHeight
          : (ctx.treemapLabelLineHeight !== undefined ? ctx.treemapLabelLineHeight : (lvlConf.lineHeight ?? Math.max(14, labelFSize + 4)));
        const effectiveLineHeight = Math.max(labelLineHeight, labelFSize + 2);
        const upperWidth = lvlConf.upperLabelWidth ?? ctx.treemapUpperLabelWidth;

        return {
          itemStyle: {
            borderColor: lvlBorderColor,
            borderWidth: lvlBorderWidth,
            gapWidth: lvlGapWidth,
            borderRadius: lvlBorderRadius
          },
          upperLabel: {
            show: Boolean(showUpper),
            height: upperHeight,
            position: lvlConf.upperLabelPosition ?? 'inside',
            fontFamily: font,
            fontSize: upperFontSize,
            fontWeight: upperFontWeight,
            color: upperTextColor,
            backgroundColor: upperBgColor,
            borderRadius: [lvlBorderRadius, lvlBorderRadius, 0, 0],
            ...(upperWidth ? { width: upperWidth, overflow: 'truncate' as const } : {}),
            formatter: (params: any) => {
              const val = getNodeValue(params);
              return formatTileLabel(params.name, val, upperFormat);
            }
          },
          label: {
            show: Boolean(showDataLabel),
            position: labelPos,
            fontFamily: font,
            fontSize: labelFSize,
            fontWeight: labelFWeight,
            fontStyle: labelFStyle,
            width: labelWidth,
            lineHeight: effectiveLineHeight,
            overflow: labelOverflow,
            ...(labelColor ? { color: labelColor } : {}),
            formatter: (params: any) => {
              const val = getNodeValue(params);
              const formatted = formatTileLabel(params.name, val, labelFormatTpl);
              if (labelOverflow === 'break' && labelWidth > 0) {
                const charsPerLine = Math.max(4, Math.floor(labelWidth / Math.max(6, labelFSize * 0.58)));
                return wrapAxisLabelText(formatted, charsPerLine);
              }
              return formatted;
            }
          },
          visibleMin: lvlConf.visibleMin ?? globalVisibleMin,
          childrenVisibleMin: lvlConf.childrenVisibleMin ?? globalChildrenVisibleMin,
          colorMappingBy: ctx.treemapColorMappingBy || 'index',
          ...(levelColorAlpha ? { colorAlpha: levelColorAlpha } : {}),
          ...(levelColorSaturation ? { colorSaturation: levelColorSaturation } : {})
        };
      })
    ];

    const showBreadcrumb = ctx.treemapShowBreadcrumb ?? true;
    const breadcrumbPos = ctx.treemapBreadcrumbPosition || 'bottom';
    const breadcrumbHeight = ctx.treemapBreadcrumbHeight ?? 24;

    const breadcrumbConfig = showBreadcrumb ? {
      show: true,
      [breadcrumbPos === 'top' ? 'top' : 'bottom']: 6,
      left: 'center',
      height: breadcrumbHeight,
      emptyItemWidth: 28,
      itemStyle: {
        color: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(241, 245, 249, 0.95)',
        borderColor: palette.border || (isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)'),
        borderWidth: 1,
        borderRadius: 4,
        textStyle: {
          color: palette.text || (isDark ? '#ffffff' : '#0f172a'),
          fontFamily: font,
          fontSize: 11,
          fontWeight: 'bold'
        }
      },
      emphasis: {
        itemStyle: {
          color: palette.accent || palette.colors[0] || '#3b82f6',
          textStyle: {
            color: '#ffffff'
          }
        }
      }
    } : { show: false };

    let adjustedTreemapTop = treemapTop;
    let adjustedTreemapBottom = treemapBottom;
    if (showBreadcrumb) {
      if (breadcrumbPos === 'bottom') {
        adjustedTreemapBottom += breadcrumbHeight + 8;
      } else {
        adjustedTreemapTop += breadcrumbHeight + 8;
      }
    }

    const squareRatio = ctx.treemapSquareRatio ?? (
      ctx.treemapAlgorithm === 'sliceAndDice' ? 0.1 : ctx.treemapAlgorithm === 'binary' ? 1.0 : 0.5 * (1 + Math.sqrt(5))
    );
    const leafDepth = (ctx.treemapVisibleDepth !== undefined && ctx.treemapVisibleDepth > 0)
      ? ctx.treemapVisibleDepth
      : undefined;
    const nodeClick = ctx.treemapNodeClick === 'none' ? false : (ctx.treemapNodeClick || 'zoomToNode');
    const roam = ctx.treemapRoam ?? false;
    const drillDownIcon = ctx.treemapDrillDownIcon || '▶';

    return {
      backgroundColor: palette.bg,
      color: palette.colors,
      title: baseTitle,
      legend: showLegend ? {
        ...baseLegend,
        data: rootLegendData
      } : { show: false },
      tooltip: {
        ...baseTooltip,
        formatter: (params: any) => {
          const val = getNodeValue(params);
          const pctVal = effectiveDenominator > 0 ? ((val / effectiveDenominator) * 100).toFixed(ctx.decimalPrecision ?? 1) : '0';
          const cohortLabel = isGlobalCohort ? 'Global Cohort' : 'Grouped Cohort';
          const pathNames = (params.treePathInfo || []).map((p: any) => p.name).filter(Boolean);
          const pathString = pathNames.length > 1 ? pathNames.join(' &gt; ') : params.name;
          let output = `<strong>${pathString}</strong><br/>Cohort Count: <strong>${val}</strong> (${pctVal}% of ${cohortLabel}, N=${effectiveDenominator})`;
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
      series: [
        {
          type: 'treemap',
          top: Math.max(10, adjustedTreemapTop + (ctx.containerPadding ?? 12) - (ctx.fitOffsetY ?? 0)),
          bottom: Math.max(10, adjustedTreemapBottom + (ctx.containerPadding ?? 12) + (ctx.fitOffsetY ?? 0)),
          left: Math.max(10, treemapLeft + (ctx.containerPadding ?? 12) - (ctx.fitOffsetX ?? 0)),
          right: Math.max(10, treemapRight + (ctx.containerPadding ?? 12) + (ctx.fitOffsetX ?? 0)),
          data: treeData,
          squareRatio,
          leafDepth,
          roam,
          nodeClick,
          drillDownIcon,
          breadcrumb: breadcrumbConfig,
          label: {
            show: globalShowLabels,
            position: globalLabelPosition,
            fontFamily: font,
            fontSize: globalLabelFontSize,
            fontWeight: globalLabelFontWeight as any,
            fontStyle: globalLabelFontStyle,
            width: ctx.treemapLabelWidth ?? 120,
            lineHeight: Math.max(ctx.treemapLabelLineHeight ?? (globalLabelFontSize + 4), globalLabelFontSize + 2),
            overflow: ctx.treemapLabelOverflow ?? 'break',
            ...(globalLabelColor ? { color: globalLabelColor } : {}),
            formatter: (params: any) => {
              const val = getNodeValue(params);
              const formatted = formatTileLabel(params.name, val, globalLabelFormat);
              if ((ctx.treemapLabelOverflow ?? 'break') === 'break' && (ctx.treemapLabelWidth ?? 120) > 0) {
                const charsPerLine = Math.max(4, Math.floor((ctx.treemapLabelWidth ?? 120) / Math.max(6, globalLabelFontSize * 0.58)));
                return wrapAxisLabelText(formatted, charsPerLine);
              }
              return formatted;
            }
          },
          levels: levels as any
        } as any,
        ...(showLegend ? [{
          type: 'pie' as const,
          radius: [0, 0],
          center: ['50%', '50%'],
          silent: true,
          label: { show: false },
          labelLine: { show: false },
          data: rootLegendData
        }] : [])
      ]
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
    sankeyLayoutIterations = 0,
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
    sankeyPinUnstatedToBottom = true,
    sankeyFlowConservation = ctx.sankeyFlowConservation === true,
    sankeyLevelNodeOrders = ctx.sankeyLevelNodeOrders || {},
    levelSegmentIndices = {},
    levelScopeFilters = {},
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
    levelCustomGroups: ctx.levelCustomGroups,
    levelTargetFields: ctx.levelTargetFields,
    sankeyFields
  };

  // Active effective levels: collapse empty unconfigured custom grouping layers
  const effectiveLevels = sankeyFields
    .map((f, idx) => ({ fieldKey: f, originalIdx: idx }))
    .filter(({ fieldKey, originalIdx }) => {
      if (fieldKey !== CUSTOM_GROUPING_KEY) return true;
      const groups = ctx.levelCustomGroups?.[originalIdx] || [];
      const links = ctx.levelCustomGroupLinks?.[originalIdx] || {};
      return groups.length > 0 || Object.keys(links).length > 0;
    });
  const activeLevels = effectiveLevels.length > 0 ? effectiveLevels : [{ fieldKey: sankeyFields[0] || 'Year', originalIdx: 0 }];

  // Pre-filter papers so only papers whose entire path satisfies active level filters participate in the Sankey flow
  const activeLevelFilters = Object.entries(sankeyLevelPathFilters).filter(([_, filter]) => Boolean(filter && filter.trim()));
  const validSankeyPapers = activeLevelFilters.length === 0
    ? papers
    : papers.filter(p => {
        return activeLevelFilters.every(([lIdxStr, filter]) => {
          const lIdx = Number(lIdxStr);
          const activeLvl = activeLevels[lIdx];
          if (!activeLvl) return true;
          const { fieldKey: f, originalIdx: origIdx } = activeLvl;
          const prevF = lIdx > 0 ? activeLevels[lIdx - 1]?.fieldKey : null;
          const baseVals = (lIdx > 0 && f === prevF)
            ? getFieldValue(p, f, {
                ...mappedOpts,
                segmentIdx: levelSegmentIndices[origIdx],
                scopeFilter: levelScopeFilters[origIdx]
              })
            : getMappedFieldValue(p, f, {
                ...mappedOpts,
                levelIdx: origIdx,
                segmentIdx: levelSegmentIndices[origIdx],
                scopeFilter: levelScopeFilters[origIdx]
              });
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
  const nodeSurvivingPapersMap = new Map<string, Set<string>>();
  const nodeSurvivingTagsMap = new Map<string, number>();

  const allowedLevelSets = activeLevels.map(({ fieldKey, originalIdx }, l) => {
    const limitCount = (sankeyMaxNodes && sankeyMaxNodes[originalIdx] !== undefined && sankeyMaxNodes[originalIdx] > 0)
      ? sankeyMaxNodes[originalIdx]
      : (limitCategories && maxCategoriesCount > 0 ? maxCategoriesCount : 0);

    if (limitCount < 1) return null;

    const prevF = l > 0 ? activeLevels[l - 1].fieldKey : null;
    const pathFilter = sankeyLevelPathFilters[originalIdx];
    const counts = new Map<string, number>();
    validSankeyPapers.forEach(p => {
      const baseVals = (l > 0 && fieldKey === prevF)
        ? getFieldValue(p, fieldKey, mappedOpts)
        : getMappedFieldValue(p, fieldKey, { ...mappedOpts, levelIdx: originalIdx });
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
    const levelValues = activeLevels.map(({ fieldKey, originalIdx }, l) => {
      const prevF = l > 0 ? activeLevels[l - 1].fieldKey : null;
      const pathFilter = sankeyLevelPathFilters[originalIdx];
      const baseVals = (l > 0 && fieldKey === prevF)
        ? getFieldValue(p, fieldKey, {
            ...mappedOpts,
            segmentIdx: levelSegmentIndices[originalIdx],
            scopeFilter: levelScopeFilters[originalIdx]
          })
        : getMappedFieldValue(p, fieldKey, {
            ...mappedOpts,
            levelIdx: originalIdx,
            segmentIdx: levelSegmentIndices[originalIdx],
            scopeFilter: levelScopeFilters[originalIdx]
          });
      const rawVals = pathFilter
        ? baseVals.filter(v => matchColonPathFilter(v, pathFilter, fieldKey, p, { umbrellanizerMap }))
        : baseVals;
      
      const levelFilter = allowedLevelSets[l];
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
    });    // Helper to resolve underlying variable key for any level
    const resolveLevelTargetKey = (lvl: { fieldKey: string; originalIdx: number }): string => {
      if (lvl.fieldKey === CUSTOM_GROUPING_KEY) {
        return (
          ctx.levelTargetFields?.[lvl.originalIdx] ||
          ctx.levelTargetFields?.[0] ||
          (sankeyFields.find((f, idx) => f !== CUSTOM_GROUPING_KEY && idx >= lvl.originalIdx) || 'Year')
        );
      }
      return lvl.fieldKey;
    };

    const extractBaseTaxonomyKey = (k: string): string => {
      if (!k) return '';
      return k
        .replace(/^ext:(macro:|sub:|leaf:|tail:|lv\d+:|segment:\d+:)?/, '')
        .replace(/^raw:(leaf:|tail:)?ext:/, '')
        .replace(/^ext:/, '');
    };

    const resolveLevelSegmentIdx = (lvl: { fieldKey: string; originalIdx: number }, targetKey: string): number => {
      if (levelSegmentIndices[lvl.originalIdx] !== undefined) {
        return levelSegmentIndices[lvl.originalIdx];
      }
      const combined = `${lvl.fieldKey} ${targetKey}`;
      const segMatch = combined.match(/ext:segment:(\d+):/i);
      if (segMatch) return parseInt(segMatch[1], 10);
      const lvMatch = combined.match(/ext:lv(\d+):/i);
      if (lvMatch) return parseInt(lvMatch[1], 10) - 1;
      if (combined.includes('ext:macro:') || combined.includes('macro:')) return 0;
      if (combined.includes('ext:sub:') || combined.includes('sub:')) return 1;
      if (combined.includes('ext:leaf:') || combined.includes('leaf:') || combined.includes('ext:tail:')) return 2;
      return lvl.originalIdx;
    };

    // Track active surviving nodes per level for paper p to enforce strict cross-variable ancestry
    const survivingPaperNodesByLevel = new Map<number, Set<string>>();
    const initialL0 = levelValues[0] && levelValues[0].length > 0 ? levelValues[0] : (excludeEmpty ? [] : ['Unspecified']);
    survivingPaperNodesByLevel.set(0, new Set(initialL0));

    // Track proportional paper flow mass across levels (for strict volume conservation)
    const paperLevelInflow = new Map<number, Map<string, number>>();
    const l0Inflows = new Map<string, number>();
    const uniqueL0 = Array.from(survivingPaperNodesByLevel.get(0)!);
    const l0Size = Math.max(1, uniqueL0.length);
    uniqueL0.forEach(v => l0Inflows.set(v, 1.0 / l0Size));
    paperLevelInflow.set(0, l0Inflows);

    // Register transitions/links between adjacent levels
    for (let i = 0; i < activeLevels.length - 1; i++) {
      if (!survivingPaperNodesByLevel.has(i + 1)) {
        survivingPaperNodesByLevel.set(i + 1, new Set());
      }
      const currentLevel = activeLevels[i];
      const nextLevel = activeLevels[i + 1];
      const currentField = currentLevel.fieldKey;
      const nextField = nextLevel.fieldKey;

      const currentTargetKey = resolveLevelTargetKey(currentLevel);
      const nextTargetKey = resolveLevelTargetKey(nextLevel);
      const currentBaseKey = extractBaseTaxonomyKey(currentTargetKey);
      const nextBaseKey = extractBaseTaxonomyKey(nextTargetKey);

      const isSameColonVariable = Boolean(currentBaseKey && nextBaseKey && currentBaseKey === nextBaseKey);

      // Collect target nodes per source node for paper p at this level
      const paperTransitions = new Map<string, Set<string>>();

      if (isSameColonVariable) {
        // TOKEN-LEVEL PARENT PATH LINEAGE TRACING
        // Extract token paths: each token forms a strict path [seg0, seg1, seg2, ...]
        const tokenPaths = extractTokenPaths(p, currentBaseKey, mappedOpts);
        const segIdx_i = resolveLevelSegmentIdx(currentLevel, currentTargetKey);
        const segIdx_next = resolveLevelSegmentIdx(nextLevel, nextTargetKey);

        const currentPathFilter = sankeyLevelPathFilters[currentLevel.originalIdx];
        const nextPathFilter = sankeyLevelPathFilters[nextLevel.originalIdx];

        const linksMap_i = ctx.levelCustomGroupLinks?.[currentLevel.originalIdx] || {};
        const links_next = ctx.levelCustomGroupLinks?.[nextLevel.originalIdx] || {};

        const levelFilter_i = allowedLevelSets[i];
        const levelFilter_next = allowedLevelSets[i + 1];

        if (tokenPaths.length > 0) {
          tokenPaths.forEach(path => {
            // Full Ancestry Lineage & Scope Verification:
            // Ensure every ancestor segment from Level 0 up to current target satisfies its level path filter, scope filter, and custom grouping
            for (let step = 0; step <= i + 1; step++) {
              const stepLevel = activeLevels[step];
              const stepTargetKey = resolveLevelTargetKey(stepLevel);
              const stepSegIdx = resolveLevelSegmentIdx(stepLevel, stepTargetKey);
              const stepVal = path[stepSegIdx] ?? (stepSegIdx < path.length ? path[stepSegIdx] : path[path.length - 1]);
              if (!stepVal) return;

              // Check Parent Scope Filter (e.g. "Edge Hosted, Local Silicon" or "!Cloud Hosted")
              const stepScopeFilter = levelScopeFilters[stepLevel.originalIdx];
              if (stepScopeFilter && stepScopeFilter.trim()) {
                const scopeItems = stepScopeFilter.split(',').map(s => s.trim()).filter(Boolean);
                const posScopes = scopeItems.filter(s => !s.startsWith('!')).map(normalizeTaxonomySegment);
                const negScopes = scopeItems.filter(s => s.startsWith('!')).map(s => normalizeTaxonomySegment(s.substring(1)));

                const pathSegNorms = path.map(normalizeTaxonomySegment).filter(Boolean);

                if (negScopes.length > 0 && negScopes.some(neg => pathSegNorms.includes(neg))) {
                  return;
                }
                if (posScopes.length > 0 && !posScopes.some(pos => pathSegNorms.includes(pos))) {
                  return;
                }
              }

              const stepPathFilter = sankeyLevelPathFilters[stepLevel.originalIdx];
              if (stepPathFilter && !matchColonPathFilter(stepVal, stepPathFilter, stepLevel.fieldKey, p, { umbrellanizerMap })) {
                return;
              }

              if (stepLevel.fieldKey === CUSTOM_GROUPING_KEY) {
                const stepLinks = ctx.levelCustomGroupLinks?.[stepLevel.originalIdx] || {};
                const mappedGroup = stepLinks[stepVal] || stepLinks[stepVal.toLowerCase()];
                if (excludeEmpty && (mappedGroup === 'Unassigned / Other' || mappedGroup === 'Unassigned' || mappedGroup === 'Unspecified')) {
                  return;
                }
              }
            }

            const rawSource = path[segIdx_i] ?? (segIdx_i < path.length ? path[segIdx_i] : path[path.length - 1]);
            const rawTarget = path[segIdx_next] ?? (segIdx_next < path.length ? path[segIdx_next] : path[path.length - 1]);

            if (!rawSource || !rawTarget) return;

            // Apply Path Filters if set
            if (currentPathFilter && !matchColonPathFilter(rawSource, currentPathFilter, currentField, p, { umbrellanizerMap })) return;
            if (nextPathFilter && !matchColonPathFilter(rawTarget, nextPathFilter, nextField, p, { umbrellanizerMap })) return;

            // Map through Custom Grouping if configured
            let sourceVal = rawSource;
            if (currentField === CUSTOM_GROUPING_KEY) {
              sourceVal = linksMap_i[rawSource] || linksMap_i[rawSource.toLowerCase()] || rawSource;
            }
            let targetVal = rawTarget;
            if (nextField === CUSTOM_GROUPING_KEY) {
              targetVal = links_next[rawTarget] || links_next[rawTarget.toLowerCase()] || rawTarget;
            }

            // Map through Tail Aggregator if applicable
            if (levelFilter_i) {
              sourceVal = levelFilter_i.topSet.has(sourceVal) ? sourceVal : levelFilter_i.tailName;
            }
            if (levelFilter_next) {
              targetVal = levelFilter_next.topSet.has(targetVal) ? targetVal : levelFilter_next.tailName;
            }

            // Ensure source node was part of paper p's surviving nodes at level i
            const survivingAt_i = survivingPaperNodesByLevel.get(i);
            if (survivingAt_i && !survivingAt_i.has(sourceVal)) {
              return;
            }

            if (sourceVal && targetVal) {
              if (!paperTransitions.has(sourceVal)) paperTransitions.set(sourceVal, new Set());
              paperTransitions.get(sourceVal)!.add(targetVal);
            }
          });
        }

        if (paperTransitions.size === 0 && !excludeEmpty) {
          const survivingAt_i = survivingPaperNodesByLevel.get(i);
          const srcList = survivingAt_i && survivingAt_i.size > 0 ? Array.from(survivingAt_i) : ['Unspecified'];
          srcList.forEach(s => {
            if (!paperTransitions.has(s)) paperTransitions.set(s, new Set());
            paperTransitions.get(s)!.add('Unspecified');
          });
        }
      } else {
        // Cross-variable transition (e.g. RQ7a -> RQ7b)
        // Strictly only allow links from paper p's SURVIVING nodes at level i
        const activeSourceNodes = survivingPaperNodesByLevel.get(i);
        if (activeSourceNodes && activeSourceNodes.size > 0) {
          const rawNextVals = levelValues[i + 1] && levelValues[i + 1].length > 0
            ? levelValues[i + 1]
            : (excludeEmpty ? [] : ['Unspecified']);

          activeSourceNodes.forEach(cv => {
            const scopedNextVals = filterValuesForParent(rawNextVals, nextField, {
              fieldKey: currentField,
              levelIdx: i,
              rawName: cv,
              displayName: cv,
              path: [cv]
            }, { levelCustomGroupLinks, umbrellanizerMap });

            const effNext = scopedNextVals.length > 0 ? scopedNextVals : (excludeEmpty ? [] : ['Unspecified']);
            effNext.forEach(nv => {
              if (!paperTransitions.has(cv)) paperTransitions.set(cv, new Set());
              paperTransitions.get(cv)!.add(nv);
            });
          });
        }
      }

      // Apply link weights and update surviving maps & next level inflows
      const nextInflows = new Map<string, number>();
      const currentInflowMap = paperLevelInflow.get(i) || new Map<string, number>();

      paperTransitions.forEach((targetsSet, sourceVal) => {
        const sourceNode = `${i + 1}: ${sourceVal}`;
        const sourceInflow = currentInflowMap.get(sourceVal) ?? (1.0 / Math.max(1, paperTransitions.size));
        const numTargets = Math.max(1, targetsSet.size);
        const linkWeight = sankeyFlowConservation ? (sourceInflow / numTargets) : 1;

        targetsSet.forEach(targetVal => {
          const targetNode = `${i + 2}: ${targetVal}`;
          const linkKey = `${sourceNode}--->${targetNode}`;
          linksMap.set(linkKey, (linksMap.get(linkKey) || 0) + linkWeight);

          if (!nodeSurvivingPapersMap.has(sourceNode)) nodeSurvivingPapersMap.set(sourceNode, new Set());
          if (!nodeSurvivingPapersMap.has(targetNode)) nodeSurvivingPapersMap.set(targetNode, new Set());
          nodeSurvivingPapersMap.get(sourceNode)!.add(pId);
          nodeSurvivingPapersMap.get(targetNode)!.add(pId);

          nodeSurvivingTagsMap.set(sourceNode, (nodeSurvivingTagsMap.get(sourceNode) || 0) + 1);
          nodeSurvivingTagsMap.set(targetNode, (nodeSurvivingTagsMap.get(targetNode) || 0) + 1);

          survivingPaperNodesByLevel.get(i + 1)!.add(targetVal);
          nextInflows.set(targetVal, (nextInflows.get(targetVal) || 0) + linkWeight);
        });
      });

      paperLevelInflow.set(i + 1, nextInflows);
    }
  });

  // Ensure all link endpoints are guaranteed to exist in nodesSet
  linksMap.forEach((_, linkKey) => {
    const [source, target] = linkKey.split('--->');
    nodesSet.add(source);
    nodesSet.add(target);
  });

  // Compute node inflow and outflow sums for strict flow conservation
  const nodeInflowMap = new Map<string, number>();
  const nodeOutflowMap = new Map<string, number>();
  linksMap.forEach((weight, linkKey) => {
    const [source, target] = linkKey.split('--->');
    nodeOutflowMap.set(source, (nodeOutflowMap.get(source) || 0) + weight);
    nodeInflowMap.set(target, (nodeInflowMap.get(target) || 0) + weight);
  });

  // Helper for unstated/omitted baseline identification
  const isUnstatedBaseline = (nodeName: string): boolean => {
    const colonIdx = nodeName.indexOf(': ');
    const clean = (colonIdx > -1 ? nodeName.substring(colonIdx + 2) : nodeName).toLowerCase().trim();
    return (
      clean.includes('omitted') ||
      clean.includes('unspecified') ||
      clean.includes('not stated') ||
      clean.includes('not-stated') ||
      clean.includes('unassigned') ||
      clean.includes('none') ||
      clean.includes('n/a') ||
      clean.includes('unknown') ||
      clean.includes('undefined') ||
      clean.includes('not reported') ||
      clean.includes('not available') ||
      clean.includes('other / standalone')
    );
  };

  // Helper to get effective flow or paper count for visual sorting
  const getEffectiveSortVal = (nodeKey: string): number => {
    const inVal = nodeInflowMap.get(nodeKey) || 0;
    const outVal = nodeOutflowMap.get(nodeKey) || 0;
    const flow = Math.max(inVal, outVal);
    if (flow > 0) return flow;
    const surviving = nodeSurvivingPapersMap.get(nodeKey)?.size;
    if (surviving !== undefined && surviving > 0) return surviving;
    return nodePapersMap.get(nodeKey)?.size || 0;
  };

  // Level-by-level node sorting with Barycenter / Destination-Weighted Ordering and Unstated Baseline Bottom-Anchoring
  const numLevels = activeLevels.length;
  const levelNodesList: string[][] = [];

  for (let lIdx = 0; lIdx < numLevels; lIdx++) {
    const prefix = `${lIdx + 1}: `;
    const nodes = Array.from(nodesSet).filter(n => {
      if (!n.startsWith(prefix)) return false;
      if (linksMap.size > 0) {
        if (lIdx === 0) {
          return (nodeOutflowMap.get(n) || 0) > 0;
        } else {
          return (nodeInflowMap.get(n) || 0) > 0;
        }
      }
      return true;
    });
    levelNodesList.push(nodes);
  }

  const finalSortedByLevel: string[][] = new Array(numLevels);

  if (sankeySort === 'barycenter') {
    // 1. Sort the last level (L - 1) first (by explicit order or descending volume)
    const lastIdx = numLevels - 1;
    const lastPrefix = `${lastIdx + 1}: `;
    const lastNodes = [...levelNodesList[lastIdx]];

    if (sankeyLevelNodeOrders && sankeyLevelNodeOrders[lastIdx] && sankeyLevelNodeOrders[lastIdx].length > 0) {
      const orderMap = new Map<string, number>();
      sankeyLevelNodeOrders[lastIdx].forEach((name, oIdx) => {
        orderMap.set(name.toLowerCase(), oIdx);
        orderMap.set(`${lastIdx + 1}: ${name}`.toLowerCase(), oIdx);
      });
      lastNodes.sort((a, b) => {
        if (sankeyPinUnstatedToBottom !== false) {
          const aUn = isUnstatedBaseline(a);
          const bUn = isUnstatedBaseline(b);
          if (aUn !== bUn) return aUn ? 1 : -1;
        }
        const aRank = orderMap.get(a.toLowerCase()) ?? orderMap.get(a.substring(lastPrefix.length).toLowerCase()) ?? 9999;
        const bRank = orderMap.get(b.toLowerCase()) ?? orderMap.get(b.substring(lastPrefix.length).toLowerCase()) ?? 9999;
        if (aRank !== bRank) return aRank - bRank;
        return getEffectiveSortVal(b) - getEffectiveSortVal(a);
      });
    } else {
      lastNodes.sort((a, b) => {
        if (sankeyPinUnstatedToBottom !== false) {
          const aUn = isUnstatedBaseline(a);
          const bUn = isUnstatedBaseline(b);
          if (aUn !== bUn) return aUn ? 1 : -1;
        }
        const aVal = getEffectiveSortVal(a);
        const bVal = getEffectiveSortVal(b);
        if (bVal !== aVal) return bVal - aVal;
        const aClean = a.substring(lastPrefix.length);
        const bClean = b.substring(lastPrefix.length);
        return aClean.localeCompare(bClean);
      });
    }
    finalSortedByLevel[lastIdx] = lastNodes;

    // 2. Iterate backwards from (L - 2) down to 0:
    for (let lIdx = numLevels - 2; lIdx >= 0; lIdx--) {
      const prefix = `${lIdx + 1}: `;
      const curNodes = [...levelNodesList[lIdx]];
      const downstreamSorted = finalSortedByLevel[lIdx + 1] || [];
      const downstreamRankMap = new Map<string, number>();
      downstreamSorted.forEach((nKey, r) => downstreamRankMap.set(nKey, r));

      if (sankeyLevelNodeOrders && sankeyLevelNodeOrders[lIdx] && sankeyLevelNodeOrders[lIdx].length > 0) {
        const orderMap = new Map<string, number>();
        sankeyLevelNodeOrders[lIdx].forEach((name, oIdx) => {
          orderMap.set(name.toLowerCase(), oIdx);
          orderMap.set(`${lIdx + 1}: ${name}`.toLowerCase(), oIdx);
        });
        curNodes.sort((a, b) => {
          if (sankeyPinUnstatedToBottom !== false) {
            const aUn = isUnstatedBaseline(a);
            const bUn = isUnstatedBaseline(b);
            if (aUn !== bUn) return aUn ? 1 : -1;
          }
          const aRank = orderMap.get(a.toLowerCase()) ?? orderMap.get(a.substring(prefix.length).toLowerCase()) ?? 9999;
          const bRank = orderMap.get(b.toLowerCase()) ?? orderMap.get(b.substring(prefix.length).toLowerCase()) ?? 9999;
          if (aRank !== bRank) return aRank - bRank;
          return getEffectiveSortVal(b) - getEffectiveSortVal(a);
        });
      } else {
        const barycenterMap = new Map<string, number>();
        curNodes.forEach(u => {
          const outgoing = Array.from(linksMap.entries()).filter(([k]) => k.startsWith(u + '--->'));
          if (outgoing.length > 0) {
            const totalW = outgoing.reduce((sum, [_, w]) => sum + w, 0);
            const weightedRank = outgoing.reduce((sum, [k, w]) => {
              const tgt = k.split('--->')[1];
              const r = downstreamRankMap.get(tgt) ?? 999;
              return sum + w * r;
            }, 0) / (totalW || 1);
            barycenterMap.set(u, weightedRank);
          } else {
            barycenterMap.set(u, 999);
          }
        });

        curNodes.sort((a, b) => {
          if (sankeyPinUnstatedToBottom !== false) {
            const aUn = isUnstatedBaseline(a);
            const bUn = isUnstatedBaseline(b);
            if (aUn !== bUn) return aUn ? 1 : -1;
          }
          const aBary = barycenterMap.get(a) ?? 999;
          const bBary = barycenterMap.get(b) ?? 999;
          if (Math.abs(aBary - bBary) > 0.0001) return aBary - bBary;
          const aVal = getEffectiveSortVal(a);
          const bVal = getEffectiveSortVal(b);
          if (bVal !== aVal) return bVal - aVal;
          const aClean = a.substring(prefix.length);
          const bClean = b.substring(prefix.length);
          return aClean.localeCompare(bClean);
        });
      }
      finalSortedByLevel[lIdx] = curNodes;
    }
  } else {
    // Non-barycenter standard ordering
    for (let lIdx = 0; lIdx < numLevels; lIdx++) {
      const prefix = `${lIdx + 1}: `;
      const curNodes = [...levelNodesList[lIdx]];

      if (sankeyLevelNodeOrders && sankeyLevelNodeOrders[lIdx] && sankeyLevelNodeOrders[lIdx].length > 0) {
        const orderMap = new Map<string, number>();
        sankeyLevelNodeOrders[lIdx].forEach((name, oIdx) => {
          orderMap.set(name.toLowerCase(), oIdx);
          orderMap.set(`${lIdx + 1}: ${name}`.toLowerCase(), oIdx);
        });
        curNodes.sort((a, b) => {
          if (sankeyPinUnstatedToBottom !== false) {
            const aUn = isUnstatedBaseline(a);
            const bUn = isUnstatedBaseline(b);
            if (aUn !== bUn) return aUn ? 1 : -1;
          }
          const aRank = orderMap.get(a.toLowerCase()) ?? orderMap.get(a.substring(prefix.length).toLowerCase()) ?? 9999;
          const bRank = orderMap.get(b.toLowerCase()) ?? orderMap.get(b.substring(prefix.length).toLowerCase()) ?? 9999;
          if (aRank !== bRank) return aRank - bRank;
          return getEffectiveSortVal(b) - getEffectiveSortVal(a);
        });
      } else if (sankeySort === 'desc') {
        curNodes.sort((a, b) => {
          if (sankeyPinUnstatedToBottom !== false) {
            const aUn = isUnstatedBaseline(a);
            const bUn = isUnstatedBaseline(b);
            if (aUn !== bUn) return aUn ? 1 : -1;
          }
          const aVal = getEffectiveSortVal(a);
          const bVal = getEffectiveSortVal(b);
          if (bVal !== aVal) return bVal - aVal;
          const aClean = a.substring(prefix.length);
          const bClean = b.substring(prefix.length);
          return aClean.localeCompare(bClean);
        });
      } else if (sankeySort === 'asc') {
        curNodes.sort((a, b) => {
          if (sankeyPinUnstatedToBottom !== false) {
            const aUn = isUnstatedBaseline(a);
            const bUn = isUnstatedBaseline(b);
            if (aUn !== bUn) return aUn ? 1 : -1;
          }
          const aVal = getEffectiveSortVal(a);
          const bVal = getEffectiveSortVal(b);
          if (aVal !== bVal) return aVal - bVal;
          const aClean = a.substring(prefix.length);
          const bClean = b.substring(prefix.length);
          return aClean.localeCompare(bClean);
        });
      } else if (sankeySort === 'alpha') {
        curNodes.sort((a, b) => {
          if (sankeyPinUnstatedToBottom !== false) {
            const aUn = isUnstatedBaseline(a);
            const bUn = isUnstatedBaseline(b);
            if (aUn !== bUn) return aUn ? 1 : -1;
          }
          const aClean = a.substring(prefix.length);
          const bClean = b.substring(prefix.length);
          return aClean.localeCompare(bClean);
        });
      } else if (sankeyPinUnstatedToBottom !== false) {
        curNodes.sort((a, b) => {
          const aUn = isUnstatedBaseline(a);
          const bUn = isUnstatedBaseline(b);
          if (aUn !== bUn) return aUn ? 1 : -1;
          return 0;
        });
      }
      finalSortedByLevel[lIdx] = curNodes;
    }
  }

  const sortedNodeKeys = finalSortedByLevel.flat();

  // Calculate Hare-Hamilton 100.00% balanced quota tag shares per active column
  const levelBalancedTagSharePcts = new Map<number, Map<string, number>>();
  activeLevels.forEach((_, lIdx) => {
    const prefix = `${lIdx + 1}: `;
    const levelNodes = sortedNodeKeys.filter(n => n.startsWith(prefix));
    const quotaInputs = levelNodes.map(n => {
      const survivingTags = nodeSurvivingTagsMap.get(n);
      const survivingPapers = nodeSurvivingPapersMap.get(n)?.size;
      const inVal = nodeInflowMap.get(n) || 0;
      const outVal = nodeOutflowMap.get(n) || 0;
      const flow = Math.max(inVal, outVal);
      const count = (linksMap.size > 0 && survivingTags !== undefined)
        ? survivingTags
        : ((linksMap.size > 0 && flow > 0)
          ? flow
          : (nodeTagCountsMap.get(n) || survivingPapers || nodePapersMap.get(n)?.size || 0));
      return { name: n, count };
    });
    const columnTotal = quotaInputs.reduce((sum, it) => sum + it.count, 0);
    const balancedMap = balanceQuotasToHundred(quotaInputs, columnTotal > 0 ? columnTotal : 1);
    levelBalancedTagSharePcts.set(lIdx, balancedMap);
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
      resolvedPos = levelNum === activeLevels.length ? 'left' : 'right';
    }

    const survivingPapers = nodeSurvivingPapersMap.get(n);
    const paperCount = (linksMap.size > 0 && survivingPapers && survivingPapers.size > 0)
      ? survivingPapers.size
      : (nodePapersMap.get(n)?.size || 0);

    const inVal = nodeInflowMap.get(n) || 0;
    const outVal = nodeOutflowMap.get(n) || 0;
    const maxFlow = Math.max(inVal, outVal);
    const nodeDisplayVal = maxFlow > 0 ? maxFlow : paperCount;

    const survivingTags = nodeSurvivingTagsMap.get(n);
    const tagCount = (linksMap.size > 0 && survivingTags !== undefined)
      ? survivingTags
      : (nodeTagCountsMap.get(n) || nodeDisplayVal);

    const levelTotalTagsCount = levelTotalTags.get(levelIdx) || totalCohort;
    const prevalencePct = totalCohort > 0 ? (paperCount / totalCohort) * 100 : 0;
    const tagSharePct = levelBalancedTagSharePcts.get(levelIdx)?.get(n) 
      ?? (levelTotalTagsCount > 0 ? (tagCount / levelTotalTagsCount) * 100 : 0);
    const effLevelFormat = sankeyLevelLabelFormats[levelIdx] || labelFormat || 'name_tag_share_count_percent';

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

    const color = customSliceColors?.[n] || customSliceColors?.[cleanName] || getNodeColor(cleanName, undefined, idx, palette.colors, customSliceColors);

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
      depth: levelIdx,
      value: nodeDisplayVal,
      itemStyle: {
        color,
        borderColor: palette.bg,
        borderWidth: sankeyNodeBorderWidth,
        borderRadius: sankeyNodeBorderRadius,
        shadowBlur: 2,
        shadowColor: 'rgba(0, 0, 0, 0.08)'
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
          const survivingPapers = nodeSurvivingPapersMap.get(name);
          const pCount = (linksMap.size > 0 && survivingPapers && survivingPapers.size > 0)
            ? survivingPapers.size
            : (nodePapersMap.get(name)?.size || params.value || 0);
          const survivingTags = nodeSurvivingTagsMap.get(name);
          const tCount = (linksMap.size > 0 && survivingTags !== undefined)
            ? survivingTags
            : (nodeTagCountsMap.get(name) || pCount);
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
          const formattedFlow = Number.isInteger(flowVal) ? flowVal.toString() : flowVal.toFixed(2);
          const srcSurviving = nodeSurvivingPapersMap.get(src);
          const tgtSurviving = nodeSurvivingPapersMap.get(tgt);
          const srcCount = (srcSurviving && srcSurviving.size > 0) ? srcSurviving.size : (nodePapersMap.get(src)?.size || flowVal);
          const tgtCount = (tgtSurviving && tgtSurviving.size > 0) ? tgtSurviving.size : (nodePapersMap.get(tgt)?.size || flowVal);
          const srcSharePct = srcCount > 0 ? ((flowVal / srcCount) * 100).toFixed(1) : '100.0';
          const tgtSharePct = tgtCount > 0 ? ((flowVal / tgtCount) * 100).toFixed(1) : '100.0';
          const cohortFlowPct = totalCohort > 0 ? ((flowVal / totalCohort) * 100).toFixed(1) : '0.0';

          return `<div style="font-family:${font};font-size:12px;padding:2px;line-height:1.5;">
            <strong>${srcClean}</strong> <span style="color:${palette.subtext};">→</span> <strong>${tgtClean}</strong><br/>
            <span style="color:${palette.subtext};">Transition Flow Volume:</span> <strong>${formattedFlow} papers</strong> <span style="color:${palette.subtext};font-size:11px;">(~${cohortFlowPct}% of cohort)</span><br/>
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
      layoutIterations: (sankeyPinUnstatedToBottom !== false) ? 0 : (sankeyLayoutIterations ?? 32),
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
      emphasis: { 
        focus: sankeyEmphasisFocus,
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.25)',
          borderColor: palette.accent || palette.colors[0] || palette.border
        }
      },
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
    baseLegend,
    baseTooltip,
    sankeyFields,
    sankeyMaxNodes = {},
    sankeyLevelPathFilters = {},
    levelSegmentIndices = {},
    levelScopeFilters = {},
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroupLinks,
    enableManualOverrides,
    manualCategoryValues = {},
    customSliceColors,
    showDataLabels,
    sunburstLevelConfigs = {},
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
    levelCustomGroups: ctx.levelCustomGroups,
    levelTargetFields: ctx.levelTargetFields,
    sankeyFields
  };

  // Active effective levels: collapse empty unconfigured custom grouping layers
  const effectiveLevels = sankeyFields
    .map((f, idx) => ({ fieldKey: f, originalIdx: idx }))
    .filter(({ fieldKey, originalIdx }) => {
      if (fieldKey !== CUSTOM_GROUPING_KEY) return true;
      const groups = ctx.levelCustomGroups?.[originalIdx] || [];
      const links = ctx.levelCustomGroupLinks?.[originalIdx] || {};
      return groups.length > 0 || Object.keys(links).length > 0;
    });
  const activeLevels = effectiveLevels.length > 0 ? effectiveLevels : [{ fieldKey: sankeyFields[0] || 'Year', originalIdx: 0 }];

  const buildTree = (papersList: any[], levelIdx: number, parentContext?: ParentContext): any[] => {
    if (levelIdx >= activeLevels.length) return [];

    const { fieldKey, originalIdx } = activeLevels[levelIdx];
    const prevField = levelIdx > 0 ? activeLevels[levelIdx - 1].fieldKey : null;
    const limitCount = sankeyMaxNodes[originalIdx] || 0;
    const pathFilter = sankeyLevelPathFilters[originalIdx];
    const groupMap = new Map<string, any[]>();

    papersList.forEach(p => {
      const baseVals = (levelIdx > 0 && fieldKey === prevField)
        ? getFieldValue(p, fieldKey, {
            ...mappedOpts,
            segmentIdx: levelSegmentIndices[originalIdx],
            scopeFilter: levelScopeFilters[originalIdx]
          })
        : getMappedFieldValue(p, fieldKey, {
            ...mappedOpts,
            levelIdx: originalIdx,
            segmentIdx: levelSegmentIndices[originalIdx],
            scopeFilter: levelScopeFilters[originalIdx]
          });
      
      const rawVals = pathFilter
        ? baseVals.filter(v => matchColonPathFilter(v, pathFilter, fieldKey, p, { umbrellanizerMap }))
        : baseVals;
      
      const scopedVals = filterValuesForParent(rawVals, fieldKey, parentContext, {
        levelCustomGroupLinks,
        umbrellanizerMap
      });

      const uniqueScopedVals = Array.from(new Set(scopedVals));
      uniqueScopedVals.forEach(v => {
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

    const totalSiblings = processedEntries.length;
    const siblingValues = processedEntries.map(([vName, cPapers, tItems]) => {
      const parentName = parentContext?.rawName || parentContext?.displayName;
      const dName = tItems ? vName : stripParentPrefix(vName, parentName);
      const manualVal = manualCategoryValues?.[dName] ?? manualCategoryValues?.[vName];
      const uniquePaperCount = new Set(cPapers.map(p => p.Paper_ID || p.id || p.Title || p)).size;
      return (enableManualOverrides && manualVal !== undefined) ? manualVal : uniquePaperCount;
    });
    const maxSiblingVal = Math.max(...siblingValues, 1);
    const minSiblingVal = Math.min(...siblingValues, 0);
    const totalSiblingVal = siblingValues.reduce((a, b) => a + b, 0);

    return processedEntries.map(([valName, childPapers, tailItems], idx) => {
      const parentName = parentContext?.rawName || parentContext?.displayName;
      const displayName = tailItems ? valName : stripParentPrefix(valName, parentName);
      const nodeValue = siblingValues[idx];
      const color = getNodeColor(
        displayName, 
        parentName, 
        idx, 
        palette.colors, 
        customSliceColors,
        parentContext?.color,
        totalSiblings,
        levelIdx,
        ctx.smartColorMode || ctx.sunburstColorMode || 'branch_gradient',
        nodeValue,
        maxSiblingVal,
        minSiblingVal,
        totalSiblingVal,
        ctx.smartColorPropagation || 'auto_children'
      ) || getNodeColor(
        valName, 
        parentName, 
        idx, 
        palette.colors, 
        customSliceColors,
        parentContext?.color,
        totalSiblings,
        levelIdx,
        ctx.smartColorMode || ctx.sunburstColorMode || 'branch_gradient',
        nodeValue,
        maxSiblingVal,
        minSiblingVal,
        totalSiblingVal,
        ctx.smartColorPropagation || 'auto_children'
      );

      const nextParentContext: ParentContext = {
        fieldKey,
        levelIdx,
        rawName: valName,
        displayName,
        color,
        path: [...(parentContext?.path || []), displayName]
      };

      const children = buildTree(childPapers, levelIdx + 1, nextParentContext);

      const lvlConf = sunburstLevelConfigs[originalIdx];
      const isOutside = lvlConf?.position === 'outside';
      let nodeTextColor: string | undefined = undefined;

      if (lvlConf?.color && lvlConf.color.trim() !== '') {
        nodeTextColor = lvlConf.color;
      } else if (lvlConf?.colorMode === 'inherit_theme') {
        nodeTextColor = palette.text;
      } else if (isOutside) {
        nodeTextColor = getContrastingTextColor(palette.bg, palette.text, '#ffffff');
      } else {
        nodeTextColor = getContrastingTextColor(color, '#0f172a', '#ffffff');
      }

      if (children.length > 0) {
        return {
          name: displayName,
          itemStyle: { color },
          label: { color: nodeTextColor },
          tailItems,
          children
        };
      }
      return {
        name: displayName,
        value: nodeValue,
        tailItems,
        itemStyle: { color },
        label: { color: nodeTextColor }
      };
    });
  };

  const activeLevelFilters = Object.entries(sankeyLevelPathFilters).filter(([_, filter]) => Boolean(filter && filter.trim()));
  const validSunburstPapers = activeLevelFilters.length === 0
    ? papers
    : papers.filter(p => {
        return activeLevelFilters.every(([lIdxStr, filter]) => {
          const lIdx = Number(lIdxStr);
          const activeLvl = activeLevels[lIdx];
          if (!activeLvl) return true;
          const { fieldKey: f, originalIdx: origIdx } = activeLvl;
          const prevF = lIdx > 0 ? activeLevels[lIdx - 1]?.fieldKey : null;
          const baseVals = (lIdx > 0 && f === prevF)
            ? getFieldValue(p, f, {
                ...mappedOpts,
                segmentIdx: levelSegmentIndices[origIdx],
                scopeFilter: levelScopeFilters[origIdx]
              })
            : getMappedFieldValue(p, f, {
                ...mappedOpts,
                levelIdx: origIdx,
                segmentIdx: levelSegmentIndices[origIdx],
                scopeFilter: levelScopeFilters[origIdx]
              });
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

  const effectiveSunburstLegendPos = String(ctx.legendPosition || sunburstLegendPosition || 'bottom');
  if (showLegend) {
    if (effectiveSunburstLegendPos.includes('right')) {
      defaultCenterX = Math.max(32, 48 - Math.round(legendDistance / 5));
      defaultMaxRadius = 66;
    } else if (effectiveSunburstLegendPos.includes('left')) {
      defaultCenterX = Math.min(68, 52 + Math.round(legendDistance / 5));
      defaultMaxRadius = 66;
    } else if (effectiveSunburstLegendPos.startsWith('top')) {
      defaultCenterY = 56;
      defaultMaxRadius = 70;
    } else if (effectiveSunburstLegendPos.startsWith('bottom')) {
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
  const numLevels = activeLevels.length;

  for (let l = 0; l < numLevels; l++) {
    const originalIdx = activeLevels[l].originalIdx;
    const lvlConf = sunburstLevelConfigs[originalIdx] || {
      r0: l === 0 ? 15 : (l === 1 ? 40 : 75),
      r: l === 0 ? 40 : (l === 1 ? 75 : 77),
      position: l === 0 ? 'inside' : 'outside',
      rotate: l === 0 ? 'tangential' : 'radial',
      align: 'right',
      minAngle: l === 0 ? 0 : (l === 1 ? 3 : 4),
      borderWidth: 2,
      borderRadius: 0,
      fontSize: 11,
      fontWeight: l === 0 ? 'bold' : 'normal',
      fontStyle: 'normal',
      colorMode: 'auto_contrast',
      overflow: 'none',
      maxLabelWidth: 80,
      labelFormat: 'name',
      hideOverlap: true
    };

    const resolvedRotate = lvlConf.rotate === 'flat' ? 0 : (lvlConf.rotate || (l === 0 ? 'tangential' : 'radial'));

    // Determine label color
    let resolvedLabelColor: string | undefined = undefined;
    if (lvlConf.color && lvlConf.color.trim() !== '') {
      resolvedLabelColor = lvlConf.color;
    } else if (lvlConf.colorMode === 'inherit_theme') {
      resolvedLabelColor = palette.text;
    } else if (lvlConf.position === 'outside') {
      resolvedLabelColor = palette.text;
    } else if (lvlConf.colorMode === 'auto_contrast') {
      // In inside mode with auto_contrast, undefined allows default high legibility
      resolvedLabelColor = undefined;
    } else {
      resolvedLabelColor = palette.text;
    }

    const labelObj: any = {
      show: showDataLabels,
      position: lvlConf.position,
      rotate: resolvedRotate,
      align: lvlConf.position === 'outside' ? (lvlConf.align || 'right') : undefined,
      minAngle: lvlConf.minAngle !== undefined ? lvlConf.minAngle : (l === 0 ? 0 : (l === 1 ? 3 : 4)),
      distance: lvlConf.distance !== undefined ? lvlConf.distance : (lvlConf.position === 'outside' ? 5 : 0),
      padding: lvlConf.position === 'outside' ? 3 : 0,
      silent: false,
      hideOverlap: lvlConf.hideOverlap !== false,
      fontFamily: font,
      fontSize: lvlConf.fontSize || (fontSize - (l === 0 ? 1 : 2)),
      fontWeight: lvlConf.fontWeight || (l === 0 ? 'bold' : 'normal'),
      fontStyle: lvlConf.fontStyle || 'normal',
      color: resolvedLabelColor
    };

    const overflowMode = lvlConf.overflow || 'none';
    if (overflowMode !== 'none') {
      labelObj.overflow = overflowMode;
      labelObj.width = lvlConf.maxLabelWidth || 80;
    }
    labelObj.lineHeight = lvlConf.lineHeight || Math.max(12, (lvlConf.fontSize || 11) + 2);

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
      itemStyle: { 
        borderWidth: lvlConf.borderWidth ?? 2, 
        borderRadius: lvlConf.borderRadius ?? 0,
        borderColor: lvlConf.borderColor || palette.bg 
      },
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
      icon: ctx.legendIcon && ctx.legendIcon !== 'inherit' ? ctx.legendIcon : 'circle',
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
      ...baseLegend,
      data: legendData,
      ...legendPos,
      orient: legendOrient,
      align: ctx.legendAlign || baseLegend.align,
      z: 20,
      itemWidth: ctx.legendItemWidth ?? baseLegend.itemWidth,
      itemHeight: ctx.legendItemHeight ?? baseLegend.itemHeight,
      itemGap: ctx.legendItemGap ?? baseLegend.itemGap,
      textStyle: {
        ...baseLegend.textStyle
      }
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
          focus: sunburstEmphasisFocus === 'none' ? undefined : sunburstEmphasisFocus,
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.25)'
          }
        },
        levels,
        itemStyle: { borderRadius: 3, borderWidth: 2, borderColor: palette.bg }
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
