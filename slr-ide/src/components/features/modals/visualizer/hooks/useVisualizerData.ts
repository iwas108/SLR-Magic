import { useMemo, useCallback } from 'react';
import { 
  CUSTOM_GROUPING_KEY, 
  DEFAULT_CUSTOM_GROUPS, 
  DEFAULT_CUSTOM_GROUP_LINKS,
  DEFAULT_LEVEL_TARGET_FIELDS
} from '../constants/defaultConfigs';
import { 
  safeString, 
  getFieldValue, 
  getMappedFieldValue, 
  extractDetectedCategories,
  stripParentPrefix,
  resolveUmbrellanizerValue
} from '../utils/dataExtractor';
import { filterValuesForParent } from '../generators/hierarchicalGenerators';
import { balanceQuotasToHundred } from '../utils/quotaBalancer';
import { discoverCohortVariables, DiscoveredVariable } from '@/lib/services/cohort-data-source';
import type { 
  SlotId,
  SlotConfig, 
  BreakdownRow, 
  RealDataBreakdownResult 
} from '../types';

export function useVisualizerData(params: {
  papers: any[];
  activeSlot: SlotId;
  currentSlotConfig: SlotConfig;
  updateActiveSlot: (partial: Partial<SlotConfig>) => void;
  umbrellanizerMap?: Record<string, Record<string, string>>;
}) {
  const {
    papers,
    currentSlotConfig,
    updateActiveSlot,
    umbrellanizerMap = {}
  } = params;

  const {
    chartType,
    primaryField,
    sankeyFields,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap = {},
    enableManualOverrides = false,
    manualCategoryValues = {},
    customSliceColors = {},
    levelCustomGroups = DEFAULT_CUSTOM_GROUPS,
    levelCustomGroupLinks = DEFAULT_CUSTOM_GROUP_LINKS,
    levelTargetFields = DEFAULT_LEVEL_TARGET_FIELDS
  } = currentSlotConfig;

  // Setters updating active slot with functional update support
  const setCustomCategoryMap = useCallback((v: Record<string, Record<string, string>> | ((prev: Record<string, Record<string, string>>) => Record<string, Record<string, string>>)) => {
    const nextVal = typeof v === 'function' ? v(customCategoryMap) : v;
    updateActiveSlot({ customCategoryMap: nextVal });
  }, [customCategoryMap, updateActiveSlot]);

  const setEnableManualOverrides = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof v === 'function' ? v(enableManualOverrides) : v;
    updateActiveSlot({ enableManualOverrides: nextVal });
  }, [enableManualOverrides, updateActiveSlot]);

  const setManualCategoryValues = useCallback((v: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    const nextVal = typeof v === 'function' ? v(manualCategoryValues) : v;
    updateActiveSlot({ manualCategoryValues: nextVal });
  }, [manualCategoryValues, updateActiveSlot]);

  const setCustomSliceColors = useCallback((v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    const nextVal = typeof v === 'function' ? v(customSliceColors) : v;
    updateActiveSlot({ customSliceColors: nextVal });
  }, [customSliceColors, updateActiveSlot]);

  const setLevelCustomGroups = useCallback((v: Record<number, string[]> | ((prev: Record<number, string[]>) => Record<number, string[]>)) => {
    const nextVal = typeof v === 'function' ? v(levelCustomGroups) : v;
    updateActiveSlot({ levelCustomGroups: nextVal });
  }, [levelCustomGroups, updateActiveSlot]);

  const setLevelCustomGroupLinks = useCallback((v: Record<number, Record<string, string>> | ((prev: Record<number, Record<string, string>>) => Record<number, Record<string, string>>)) => {
    const nextVal = typeof v === 'function' ? v(levelCustomGroupLinks) : v;
    updateActiveSlot({ levelCustomGroupLinks: nextVal });
  }, [levelCustomGroupLinks, updateActiveSlot]);

  const setLevelTargetFields = useCallback((v: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => {
    const nextVal = typeof v === 'function' ? v(levelTargetFields) : v;
    updateActiveSlot({ levelTargetFields: nextVal });
  }, [levelTargetFields, updateActiveSlot]);

  // Discover full variable metadata across active cohort
  const discoveredResult = useMemo(() => {
    return discoverCohortVariables(papers, {
      useUmbrellanizer,
      umbrellanizerMap,
      splitMultiValues,
      excludeEmpty,
      levelCustomGroupLinks,
      levelTargetFields,
      levelCustomGroups,
      sankeyFields,
      primaryField
    });
  }, [
    papers,
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    levelCustomGroupLinks,
    levelTargetFields,
    levelCustomGroups,
    sankeyFields,
    primaryField
  ]);

  const discoveredVariables = discoveredResult.variables;
  const discoveredVariablesByKey = discoveredResult.variablesByKey;

  // Available data fields
  const availableFields = useMemo(() => {
    if (discoveredVariables.length > 0) {
      return discoveredVariables.map((v: DiscoveredVariable) => v.key);
    }

    const fieldsSet = new Set<string>([
      'Paper_ID',
      'Title',
      'Authors',
      'Year',
      'DOI',
      'Import_Source',
      'Local_PDF_Status',
      'Publisher',
      'citation_count',
      'Overall_QA'
    ]);

    return [CUSTOM_GROUPING_KEY, ...Array.from(fieldsSet)];
  }, [discoveredVariables]);

  const numericalFields = useMemo(() => {
    return ['Overall_QA', 'citation_count', 'Year'];
  }, []);

  const getMappedFieldVal = useCallback((paper: any, fieldKey: string, subFieldKey?: string, levelIdx: number = 0): string[] => {
    return getMappedFieldValue(paper, fieldKey, {
      subFieldKey,
      levelIdx,
      useUmbrellanizer,
      umbrellanizerMap,
      splitMultiValues,
      excludeEmpty,
      customCategoryMap,
      levelCustomGroups,
      levelCustomGroupLinks,
      levelTargetFields,
      sankeyFields,
      primaryField
    });
  }, [useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty, customCategoryMap, levelCustomGroups, levelCustomGroupLinks, levelTargetFields, sankeyFields, primaryField]);

  // Detected unique categories for Step 3 color pickers
  const detectedCategories = useMemo(() => {
    return extractDetectedCategories(papers, chartType, sankeyFields, primaryField, getMappedFieldVal);
  }, [papers, chartType, sankeyFields, primaryField, getMappedFieldVal]);

  // Dynamic real data calculation & percentage breakdown table
  const realDataBreakdown = useMemo((): RealDataBreakdownResult => {
    const parentTagCounts = new Map<string, number>();
    const parentPaperIds = new Map<string, Set<string>>();
    const childTagCounts = new Map<string, { count: number; parentName: string; childName: string }>();
    const childPaperIds = new Map<string, Set<string>>();
    let totalItems = 0;
    const totalCohortPapers = papers.length;

    const extractOpts = { useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty };

    if (['sunburst', 'treemap', 'sankey'].includes(chartType)) {
      const f1 = sankeyFields[0] || primaryField;
      const f2 = sankeyFields.length > 1 ? sankeyFields[1] : null;

      papers.forEach(p => {
        const paperId = safeString(p.Paper_ID || p.id || p.Title || p.title || 'unknown');
        if (f1 === CUSTOM_GROUPING_KEY && f2) {
          const rawSubVals = getFieldValue(p, f2, extractOpts).map(safeString).filter(v => Boolean(v) && v !== '[object Object]' && v !== 'Unspecified');
          const linksMap = levelCustomGroupLinks[0] || {};

          rawSubVals.forEach(v2 => {
            const v1 = safeString(linksMap[v2] || 'Unassigned / Other');
            const cleanChild = stripParentPrefix(v2, v1);
            totalItems++;
            parentTagCounts.set(v1, (parentTagCounts.get(v1) || 0) + 1);
            if (!parentPaperIds.has(v1)) parentPaperIds.set(v1, new Set());
            parentPaperIds.get(v1)!.add(paperId);

            const childKey = `${v1}||${cleanChild}`;
            if (!childTagCounts.has(childKey)) {
              childTagCounts.set(childKey, { count: 0, parentName: v1, childName: cleanChild });
            }
            childTagCounts.get(childKey)!.count += 1;

            if (!childPaperIds.has(childKey)) childPaperIds.set(childKey, new Set());
            childPaperIds.get(childKey)!.add(paperId);
          });
        } else {
          const v1List = getMappedFieldValue(p, f1, { ...extractOpts, customCategoryMap, levelCustomGroupLinks, sankeyFields, primaryField, subFieldKey: f2 || undefined, levelIdx: 0 });
          const rawV2List = f2 ? getMappedFieldValue(p, f2, { ...extractOpts, customCategoryMap, levelCustomGroupLinks, sankeyFields, primaryField, levelIdx: 1 }) : [];

          v1List.forEach(rawV1 => {
            const v1 = safeString(rawV1);
            if (!v1 || v1 === '[object Object]') return;
            totalItems++;
            parentTagCounts.set(v1, (parentTagCounts.get(v1) || 0) + 1);
            if (!parentPaperIds.has(v1)) parentPaperIds.set(v1, new Set());
            parentPaperIds.get(v1)!.add(paperId);

            const scopedV2List = f2
              ? filterValuesForParent(rawV2List, f2, {
                  fieldKey: f1,
                  levelIdx: 0,
                  rawName: v1,
                  displayName: v1,
                  path: [v1]
                }, { levelCustomGroupLinks, umbrellanizerMap })
              : rawV2List;

            scopedV2List.forEach(rawV2 => {
              const v2 = safeString(rawV2);
              if (!v2 || v2 === '[object Object]') return;
              const cleanChild = stripParentPrefix(v2, v1);
              const childKey = `${v1}||${cleanChild}`;
              if (!childTagCounts.has(childKey)) {
                childTagCounts.set(childKey, { count: 0, parentName: v1, childName: cleanChild });
              }
              childTagCounts.get(childKey)!.count += 1;

              if (!childPaperIds.has(childKey)) childPaperIds.set(childKey, new Set());
              childPaperIds.get(childKey)!.add(paperId);
            });
          });
        }
      });
    } else {
      papers.forEach(p => {
        const paperId = safeString(p.Paper_ID || p.id || p.Title || p.title || 'unknown');
        const vals = getMappedFieldValue(p, primaryField, { ...extractOpts, customCategoryMap, levelCustomGroupLinks, sankeyFields, primaryField, levelIdx: 0 });
        vals.forEach(rawV => {
          const v = safeString(rawV);
          if (!v || v === '[object Object]') return;
          totalItems++;
          parentTagCounts.set(v, (parentTagCounts.get(v) || 0) + 1);
          if (!parentPaperIds.has(v)) parentPaperIds.set(v, new Set());
          parentPaperIds.get(v)!.add(paperId);
        });
      });
    }

    const rows: BreakdownRow[] = [];
    const parentEntries = Array.from(parentTagCounts.entries());
    const quotaInputs = parentEntries.map(([parentName, count]) => ({ name: parentName, count }));
    const balancedParentPctMap = balanceQuotasToHundred(quotaInputs, totalItems);

    parentTagCounts.forEach((tagCount, parentName) => {
      const paperCount = parentPaperIds.get(parentName)?.size || 0;
      const paperPrevalencePct = totalCohortPapers > 0 ? parseFloat(((paperCount / totalCohortPapers) * 100).toFixed(2)) : 0;
      const tagSharePct = balancedParentPctMap.get(parentName) ?? (totalItems > 0 ? parseFloat(((tagCount / totalItems) * 100).toFixed(2)) : 0);
      
      const realPct = currentSlotConfig.metricMode === 'tag_share' ? tagSharePct : paperPrevalencePct;
      const activeCount = currentSlotConfig.metricMode === 'tag_share' ? tagCount : paperCount;
      const manualVal = manualCategoryValues[parentName];
      const activeVal = (enableManualOverrides && manualVal !== undefined) ? manualVal : realPct;

      rows.push({
        name: parentName,
        count: activeCount,
        paperCount,
        tagCount,
        paperPrevalencePct,
        tagSharePct,
        realPct,
        activeVal
      });

      childTagCounts.forEach((childItem, childKey) => {
        if (childItem.parentName === parentName) {
          const childPaperCount = childPaperIds.get(childKey)?.size || 0;
          const childPaperPrevalencePct = totalCohortPapers > 0 ? parseFloat(((childPaperCount / totalCohortPapers) * 100).toFixed(2)) : 0;
          const childTagSharePct = totalItems > 0 ? parseFloat(((childItem.count / totalItems) * 100).toFixed(2)) : 0;
          const childRealPct = currentSlotConfig.metricMode === 'tag_share' ? childTagSharePct : childPaperPrevalencePct;
          const childActiveCount = currentSlotConfig.metricMode === 'tag_share' ? childItem.count : childPaperCount;

          const childRowKey = `${parentName} → ${childItem.childName}`;
          const childManualVal = manualCategoryValues[childRowKey] ?? manualCategoryValues[childItem.childName];
          const childActiveVal = (enableManualOverrides && childManualVal !== undefined) ? childManualVal : childRealPct;

          rows.push({
            name: childItem.childName,
            parentName,
            count: childActiveCount,
            paperCount: childPaperCount,
            tagCount: childItem.count,
            paperPrevalencePct: childPaperPrevalencePct,
            tagSharePct: childTagSharePct,
            realPct: childRealPct,
            activeVal: childActiveVal
          });
        }
      });
    });

    const topRows = rows.filter(r => !r.parentName);
    const activeSum = parseFloat(topRows.reduce((sum, r) => sum + r.activeVal, 0).toFixed(2));
    const isMultiLabel = totalItems > totalCohortPapers;

    return { rows, totalItems, totalCohortPapers, activeSum, isMultiLabel };
  }, [papers, chartType, sankeyFields, primaryField, useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty, customCategoryMap, levelCustomGroupLinks, manualCategoryValues, enableManualOverrides, currentSlotConfig.metricMode]);

  // Autofill / Normalize percentages to 100%
  const normalizePercentages = useCallback(() => {
    const topRows = realDataBreakdown.rows.filter(r => !r.parentName);
    const currentSum = topRows.reduce((acc, r) => acc + (manualCategoryValues[r.name] ?? r.realPct), 0);
    if (currentSum <= 0) return;

    const nextValues: Record<string, number> = { ...manualCategoryValues };
    topRows.forEach(r => {
      const cur = manualCategoryValues[r.name] ?? r.realPct;
      nextValues[r.name] = parseFloat(((cur / currentSum) * 100).toFixed(2));
    });
    setManualCategoryValues(nextValues);
  }, [realDataBreakdown, manualCategoryValues, setManualCategoryValues]);

  // Revert to Real Data
  const revertToRealData = useCallback(() => {
    setManualCategoryValues({});
    setEnableManualOverrides(false);
  }, [setManualCategoryValues, setEnableManualOverrides]);

  return {
    customCategoryMap,
    setCustomCategoryMap,
    enableManualOverrides,
    setEnableManualOverrides,
    manualCategoryValues,
    setManualCategoryValues,
    customSliceColors,
    setCustomSliceColors,
    levelCustomGroups,
    setLevelCustomGroups,
    levelCustomGroupLinks,
    setLevelCustomGroupLinks,
    levelTargetFields,
    setLevelTargetFields,
    availableFields,
    discoveredVariables,
    discoveredVariablesByKey,
    numericalFields,
    detectedCategories,
    realDataBreakdown,
    normalizePercentages,
    revertToRealData
  };
}
