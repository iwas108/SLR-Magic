import { CUSTOM_GROUPING_KEY, CUSTOM_GROUPING_LABEL } from '../constants/defaultConfigs';
import type { ChartType, MetricMode, DetectedCategory } from '../types';
import {
  safeString,
  resolveUmbrellanizerValue,
  extractPaperFieldValues,
  stripParentPrefix,
  TaxonomyOptions
} from '@/lib/services/taxonomy-resolver';

export { safeString, resolveUmbrellanizerValue, stripParentPrefix };

export function getFieldValue(
  paper: any, 
  fieldKey: string, 
  options: TaxonomyOptions = {}
): string[] {
  return extractPaperFieldValues(paper, fieldKey, options);
}

export function getMappedFieldValue(
  paper: any, 
  fieldKey: string, 
  options: {
    subFieldKey?: string;
    levelIdx?: number;
    parentName?: string;
    useUmbrellanizer?: boolean;
    umbrellanizerMap?: Record<string, Record<string, string>>;
    splitMultiValues?: boolean;
    excludeEmpty?: boolean;
    customCategoryMap?: Record<string, Record<string, string>>;
    levelCustomGroupLinks?: Record<number, Record<string, string>>;
    sankeyFields?: string[];
    primaryField?: string;
  } = {}
): string[] {
  const {
    subFieldKey,
    levelIdx = 0,
    parentName,
    useUmbrellanizer = true,
    umbrellanizerMap = {},
    splitMultiValues = true,
    excludeEmpty = true,
    customCategoryMap = {},
    levelCustomGroupLinks = {},
    sankeyFields = ['Year', 'Import_Source', 'Local_PDF_Status'],
    primaryField = 'Year'
  } = options;

  const extractOpts = { useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty };

  if (fieldKey === CUSTOM_GROUPING_KEY) {
    const targetSubKey = subFieldKey || (sankeyFields.find((f, idx) => f !== CUSTOM_GROUPING_KEY && idx >= levelIdx) || sankeyFields.find(f => f !== CUSTOM_GROUPING_KEY) || primaryField);
    const subVals = getFieldValue(paper, targetSubKey, extractOpts).map(safeString).filter(v => Boolean(v) && v !== '[object Object]' && v !== 'Unspecified');
    if (subVals.length === 0) return excludeEmpty ? [] : ['Unassigned / Other'];
    const linksMap = levelCustomGroupLinks[levelIdx] || levelCustomGroupLinks[0] || {};
    const mapped = subVals.map(v => safeString(linksMap[v] || 'Unassigned / Other'));
    return Array.from(new Set(mapped));
  }

  const rawVals = getFieldValue(paper, fieldKey, extractOpts).map(safeString).filter(v => Boolean(v) && v !== '[object Object]');
  const mapObj = customCategoryMap[fieldKey];
  const mappedList = (!mapObj || Object.keys(mapObj).length === 0) ? rawVals : rawVals.map(v => safeString(mapObj[v] || v));
  if (parentName) {
    return mappedList.map(v => stripParentPrefix(v, parentName));
  }
  return mappedList;
}

export function extractNumericalValue(paper: any, numKey: string): number {
  if (!paper) return 0;
  if (numKey === 'citation_count') {
    return parseFloat(String(paper.citation_count ?? 0)) || 0;
  }
  if (numKey === 'Year') {
    return parseFloat(String(paper.Year ?? 0)) || 0;
  }
  if (numKey === 'Overall_QA') {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const qaStr = isManualDominant 
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');
    if (!qaStr) return 0;
    try {
      const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
      const qaObj = parsed.qa_scores || parsed;
      let score = 0;
      Object.values(qaObj).forEach((v: any) => {
        const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
        const num = parseFloat(String(val));
        if (!isNaN(num)) score += num;
        else if (['YES', 'PASS', 'TRUE'].includes(String(val).toUpperCase())) score += 1;
      });
      return score;
    } catch (e) {}
  }
  return 0;
}

export function computeMetricValue(
  groupPapers: any[], 
  metricMode: MetricMode, 
  totalCohortPapersCount: number, 
  totalTagsCount?: number
): number {
  if (metricMode === 'count') {
    const uniquePaperIds = new Set(groupPapers.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    return uniquePaperIds.size;
  }

  if (metricMode === 'paper_prevalence') {
    const totalCohort = totalCohortPapersCount || 1;
    const uniquePaperIds = new Set(groupPapers.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
    return parseFloat(((uniquePaperIds.size / totalCohort) * 100).toFixed(2));
  }

  if (metricMode === 'tag_share') {
    const denom = (totalTagsCount && totalTagsCount > 0) ? totalTagsCount : (totalCohortPapersCount || 1);
    return parseFloat(((groupPapers.length / denom) * 100).toFixed(2));
  }

  if (metricMode === 'avg_citation') {
    const uniquePapersMap = new Map<string, any>();
    groupPapers.forEach(p => {
      const id = p.Paper_ID || p.id || p.title || p.Title || JSON.stringify(p);
      if (!uniquePapersMap.has(id)) uniquePapersMap.set(id, p);
    });
    let sum = 0;
    let count = 0;
    uniquePapersMap.forEach(p => {
      const c = parseFloat(String(p.citation_count ?? 0));
      if (!isNaN(c)) {
        sum += c;
        count++;
      }
    });
    return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
  }

  if (metricMode === 'avg_qa') {
    const uniquePapersMap = new Map<string, any>();
    groupPapers.forEach(p => {
      const id = p.Paper_ID || p.id || p.title || p.Title || JSON.stringify(p);
      if (!uniquePapersMap.has(id)) uniquePapersMap.set(id, p);
    });
    let sum = 0;
    let count = 0;
    uniquePapersMap.forEach(p => {
      const score = extractNumericalValue(p, 'Overall_QA');
      sum += score;
      count++;
    });
    return count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
  }

  return 0;
}

export function limitCategoryMap(
  countsMap: Map<string, any[]>, 
  limitCategories: boolean, 
  maxCategoriesCount: number, 
  computeMetricVal: (list: any[]) => number
): Map<string, any[]> {
  if (!limitCategories || countsMap.size <= maxCategoriesCount || maxCategoriesCount < 2) {
    return countsMap;
  }

  const sortedEntries = Array.from(countsMap.entries())
    .map(([cat, list]) => ({
      cat,
      list,
      val: computeMetricVal(list)
    }))
    .sort((a, b) => b.val - a.val);

  const topEntries = sortedEntries.slice(0, maxCategoriesCount - 1);
  const tailEntries = sortedEntries.slice(maxCategoriesCount - 1);

  const result = new Map<string, any[]>();
  topEntries.forEach(e => result.set(e.cat, e.list));

  const otherList: any[] = [];
  tailEntries.forEach(e => otherList.push(...e.list));
  if (otherList.length > 0) {
    result.set('Other', otherList);
  }

  return result;
}

export function extractDetectedCategories(
  papers: any[], 
  chartType: ChartType, 
  sankeyFields: string[], 
  primaryField: string, 
  getMappedFieldVal: (paper: any, fieldKey: string, subFieldKey?: string, levelIdx?: number) => string[]
): DetectedCategory[] {
  const list: DetectedCategory[] = [];
  const seen = new Set<string>();

  if (['sunburst', 'treemap', 'sankey'].includes(chartType)) {
    sankeyFields.forEach((fieldKey, idx) => {
      const levelLabel = `Level ${idx + 1} (${fieldKey === CUSTOM_GROUPING_KEY ? CUSTOM_GROUPING_LABEL : fieldKey.startsWith('ext:') ? fieldKey.substring(4) : fieldKey})`;
      const parentKey = idx > 0 ? sankeyFields[idx - 1] : null;

      papers.forEach(p => {
        const vals = getMappedFieldVal(p, fieldKey, undefined, idx);
        const parentVals = parentKey ? getMappedFieldVal(p, parentKey, undefined, idx - 1) : [];
        vals.forEach(rawV => {
          const v = safeString(rawV);
          const parentName = parentVals[0] ? safeString(parentVals[0]) : undefined;
          if (!v || v === '[object Object]') return;

          const uniqueKey = `${v}||${parentName || ''}`;
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            list.push({ name: v, levelLabel, parentName });
          }
        });
      });
    });
  } else {
    papers.forEach(p => {
      const vals = getMappedFieldVal(p, primaryField, undefined, 0);
      vals.forEach(rawV => {
        const v = safeString(rawV);
        if (!v || v === '[object Object]') return;
        if (!seen.has(v)) {
          seen.add(v);
          list.push({ name: v, levelLabel: primaryField === CUSTOM_GROUPING_KEY ? CUSTOM_GROUPING_LABEL : primaryField.startsWith('ext:') ? primaryField.substring(4) : primaryField });
        }
      });
    });
  }

  return list;
}
