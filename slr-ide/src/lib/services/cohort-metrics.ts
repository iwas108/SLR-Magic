/**
 * Cohort Metrics & Statistical Synthesis Engine
 * Centralized service for calculating unique paper prevalence, tag share distributions,
 * Hare-Hamilton Largest Remainder quota balancing, and multi-label cohort statistics.
 */

import {
  extractPaperFieldValues,
  safeString,
  TaxonomyOptions
} from './taxonomy-resolver';

export interface CategoryDistributionItem {
  category: string;
  tagCount: number;
  tagSharePct: number;
  paperCount: number;
  paperPrevalencePct: number;
  paperIds: string[];
}

export interface CohortVariableMetrics {
  fieldKey: string;
  totalCohortPapers: number;
  totalPapersWithData: number;
  notStatedCount: number;
  notStatedPct: number;
  totalExtractedTags: number;
  categories: CategoryDistributionItem[];
}

/**
 * Largest Remainder Method (Hare-Hamilton Quota) for exact 100.00% quota balancing.
 */
export function calculateHareHamiltonPercentages(counts: number[], targetSum: number = 100.00): number[] {
  const total = counts.reduce((a, b) => a + (b || 0), 0);
  if (total === 0) return counts.map(() => 0);

  const exactPcts = counts.map(c => ((c || 0) / total) * targetSum);
  const floorPcts = exactPcts.map(p => Math.floor(p * 100) / 100);
  const remainders = exactPcts.map((p, idx) => ({ remainder: p - floorPcts[idx], index: idx }));

  const currentSum = Math.round(floorPcts.reduce((a, b) => a + b, 0) * 100);
  const diffCent = Math.round(targetSum * 100) - currentSum; // remaining 0.01% units

  remainders.sort((a, b) => b.remainder - a.remainder);
  const result = [...floorPcts];
  for (let i = 0; i < diffCent && i < remainders.length; i++) {
    const idx = remainders[i].index;
    result[idx] = Math.round((result[idx] + 0.01) * 100) / 100;
  }
  return result;
}

/**
 * Calculates complete, ground-truth cohort metrics for a target extraction key or metadata variable,
 * properly distinguishing between Unique Paper Prevalence and Quota-Balanced Tag Share.
 */
export function calculateCohortVariableMetrics(
  papers: any[],
  fieldKey: string,
  options: TaxonomyOptions & { customCategoryMap?: Record<string, Record<string, string>> } = {}
): CohortVariableMetrics {
  const {
    useUmbrellanizer = true,
    umbrellanizerMap = {},
    splitMultiValues = true,
    excludeEmpty = true,
    customCategoryMap = {}
  } = options;

  const totalCohortPapers = papers.length;
  const categoryTagCountMap = new Map<string, number>();
  const categoryPaperIdsMap = new Map<string, Set<string>>();
  let totalExtractedTags = 0;
  let notStatedCount = 0;

  const fieldOpts: TaxonomyOptions = {
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty: true // Exclude empty for valid tags accumulation
  };

  papers.forEach(paper => {
    const paperId = safeString(paper.Paper_ID || paper.id || paper.Title || paper.title || 'unknown');
    const rawVals = extractPaperFieldValues(paper, fieldKey, fieldOpts);

    // Apply custom category mapping if present
    const mapObj = customCategoryMap[fieldKey];
    const vals = (mapObj && Object.keys(mapObj).length > 0)
      ? rawVals.map(v => safeString(mapObj[v] || v))
      : rawVals;

    const validVals = vals.filter(v => Boolean(v) && v !== '[object Object]' && v !== 'Unspecified');

    if (validVals.length === 0) {
      notStatedCount++;
    } else {
      const paperCatsSeen = new Set<string>();

      validVals.forEach(v => {
        totalExtractedTags++;
        categoryTagCountMap.set(v, (categoryTagCountMap.get(v) || 0) + 1);

        if (!paperCatsSeen.has(v)) {
          paperCatsSeen.add(v);
          if (!categoryPaperIdsMap.has(v)) {
            categoryPaperIdsMap.set(v, new Set());
          }
          categoryPaperIdsMap.get(v)!.add(paperId);
        }
      });
    }
  });

  const sortedCategories = Array.from(categoryTagCountMap.entries()).sort((a, b) => {
    // Sort by tag count descending, then alphabetical
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const tagCounts = sortedCategories.map(c => c[1]);
  const tagSharePercentages = calculateHareHamiltonPercentages(tagCounts, 100.00);

  const categories: CategoryDistributionItem[] = sortedCategories.map(([category, tagCount], idx) => {
    const paperIds = Array.from(categoryPaperIdsMap.get(category) || []).sort();
    const paperCount = paperIds.length;
    const paperPrevalencePct = totalCohortPapers > 0
      ? parseFloat(((paperCount / totalCohortPapers) * 100).toFixed(2))
      : 0;

    return {
      category,
      tagCount,
      tagSharePct: tagSharePercentages[idx],
      paperCount,
      paperPrevalencePct,
      paperIds
    };
  });

  const totalPapersWithData = Math.max(0, totalCohortPapers - notStatedCount);
  const notStatedPct = totalCohortPapers > 0
    ? parseFloat(((notStatedCount / totalCohortPapers) * 100).toFixed(2))
    : 0;

  return {
    fieldKey,
    totalCohortPapers,
    totalPapersWithData,
    notStatedCount,
    notStatedPct,
    totalExtractedTags,
    categories
  };
}
