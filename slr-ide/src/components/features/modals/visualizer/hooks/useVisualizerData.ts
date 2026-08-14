import { useMemo, useCallback } from 'react';
import { 
  CUSTOM_GROUPING_KEY, 
  DEFAULT_CUSTOM_GROUPS, 
  DEFAULT_CUSTOM_GROUP_LINKS 
} from '../constants/defaultConfigs';
import { 
  safeString, 
  getFieldValue, 
  getMappedFieldValue, 
  extractDetectedCategories 
} from '../utils/dataExtractor';
import { balanceQuotasToHundred } from '../utils/quotaBalancer';
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
    levelCustomGroupLinks = DEFAULT_CUSTOM_GROUP_LINKS
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

  // Available data fields
  const availableFields = useMemo(() => {
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

    papers.forEach(p => {
      if (p.manual_extracted_data || p.ai_extracted_data) {
        try {
          const str = (p.manual_stage || 0) >= (p.ai_stage || 0)
            ? (p.manual_extracted_data || p.ai_extracted_data)
            : (p.ai_extracted_data || p.manual_extracted_data);
          const parsed = typeof str === 'string' ? JSON.parse(str) : str;
          const extObj = parsed.extracted_data || parsed;
          Object.keys(extObj).forEach(k => {
            if (!k.startsWith('_') && k !== 'logic_trace' && k !== '_scientist_logic_trace') {
              fieldsSet.add(`ext:${k}`);
            }
          });
        } catch (e) {}
      }
    });

    return [CUSTOM_GROUPING_KEY, ...Array.from(fieldsSet).sort()];
  }, [papers]);

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
      levelCustomGroupLinks,
      sankeyFields,
      primaryField
    });
  }, [useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty, customCategoryMap, levelCustomGroupLinks, sankeyFields, primaryField]);

  // Detected unique categories for Step 3 color pickers
  const detectedCategories = useMemo(() => {
    return extractDetectedCategories(papers, chartType, sankeyFields, primaryField, getMappedFieldVal);
  }, [papers, chartType, sankeyFields, primaryField, getMappedFieldVal]);

  // Dynamic real data calculation & percentage breakdown table
  const realDataBreakdown = useMemo((): RealDataBreakdownResult => {
    const parentCounts = new Map<string, number>();
    const childCounts = new Map<string, { count: number; parentName: string; childName: string }>();
    let totalItems = 0;

    const extractOpts = { useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty };

    if (['sunburst', 'treemap', 'sankey'].includes(chartType)) {
      const f1 = sankeyFields[0] || primaryField;
      const f2 = sankeyFields.length > 1 ? sankeyFields[1] : null;

      papers.forEach(p => {
        if (f1 === CUSTOM_GROUPING_KEY && f2) {
          const rawSubVals = getFieldValue(p, f2, extractOpts).map(safeString).filter(v => Boolean(v) && v !== '[object Object]' && v !== 'Unspecified');
          const linksMap = levelCustomGroupLinks[0] || {};

          rawSubVals.forEach(v2 => {
            const v1 = safeString(linksMap[v2] || 'Unassigned / Other');
            totalItems++;
            parentCounts.set(v1, (parentCounts.get(v1) || 0) + 1);

            const childKey = `${v1}||${v2}`;
            if (!childCounts.has(childKey)) {
              childCounts.set(childKey, { count: 0, parentName: v1, childName: v2 });
            }
            childCounts.get(childKey)!.count += 1;
          });
        } else {
          const v1List = getMappedFieldValue(p, f1, { ...extractOpts, customCategoryMap, levelCustomGroupLinks, sankeyFields, primaryField, subFieldKey: f2 || undefined, levelIdx: 0 });
          const v2List = f2 ? getMappedFieldValue(p, f2, { ...extractOpts, customCategoryMap, levelCustomGroupLinks, sankeyFields, primaryField, levelIdx: 1 }) : [];

          v1List.forEach(rawV1 => {
            const v1 = safeString(rawV1);
            if (!v1 || v1 === '[object Object]') return;
            totalItems++;
            parentCounts.set(v1, (parentCounts.get(v1) || 0) + 1);

            v2List.forEach(rawV2 => {
              const v2 = safeString(rawV2);
              if (!v2 || v2 === '[object Object]') return;
              const childKey = `${v1}||${v2}`;
              if (!childCounts.has(childKey)) {
                childCounts.set(childKey, { count: 0, parentName: v1, childName: v2 });
              }
              childCounts.get(childKey)!.count += 1;
            });
          });
        }
      });
    } else {
      papers.forEach(p => {
        const vals = getMappedFieldValue(p, primaryField, { ...extractOpts, customCategoryMap, levelCustomGroupLinks, sankeyFields, primaryField, levelIdx: 0 });
        vals.forEach(rawV => {
          const v = safeString(rawV);
          if (!v || v === '[object Object]') return;
          totalItems++;
          parentCounts.set(v, (parentCounts.get(v) || 0) + 1);
        });
      });
    }

    const rows: BreakdownRow[] = [];
    const parentEntries = Array.from(parentCounts.entries());
    const quotaInputs = parentEntries.map(([parentName, count]) => ({ name: parentName, count }));
    const balancedParentPctMap = balanceQuotasToHundred(quotaInputs, totalItems);

    parentCounts.forEach((count, parentName) => {
      const realPct = balancedParentPctMap.get(parentName) ?? (totalItems > 0 ? parseFloat(((count / totalItems) * 100).toFixed(2)) : 0);
      const manualVal = manualCategoryValues[parentName];
      const activeVal = (enableManualOverrides && manualVal !== undefined) ? manualVal : realPct;
      rows.push({ name: parentName, count, realPct, activeVal });

      childCounts.forEach((childItem) => {
        if (childItem.parentName === parentName) {
          const childRealPct = totalItems > 0 ? parseFloat(((childItem.count / totalItems) * 100).toFixed(2)) : 0;
          const childKey = `${parentName} → ${childItem.childName}`;
          const childManualVal = manualCategoryValues[childKey] ?? manualCategoryValues[childItem.childName];
          const childActiveVal = (enableManualOverrides && childManualVal !== undefined) ? childManualVal : childRealPct;
          rows.push({ name: childItem.childName, parentName, count: childItem.count, realPct: childRealPct, activeVal: childActiveVal });
        }
      });
    });

    const topRows = rows.filter(r => !r.parentName);
    const activeSum = parseFloat(topRows.reduce((sum, r) => sum + r.activeVal, 0).toFixed(2));

    return { rows, totalItems, activeSum };
  }, [papers, chartType, sankeyFields, primaryField, useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty, customCategoryMap, levelCustomGroupLinks, manualCategoryValues, enableManualOverrides]);

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
    availableFields,
    numericalFields,
    detectedCategories,
    realDataBreakdown,
    normalizePercentages,
    revertToRealData
  };
}
