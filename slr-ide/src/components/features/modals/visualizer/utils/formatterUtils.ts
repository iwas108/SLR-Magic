import type { 
  DecimalPrecision, 
  RatioStyle, 
  DisplayFormatTemplate, 
  MetricMode 
} from '../types';

export interface FormatMetricParams {
  name?: string;
  count?: number;
  val?: number | string;
  paperCount?: number;
  tagCount?: number;
  totalCohortPapers?: number;
  totalExtractedTags?: number;
  metricMode?: MetricMode;
  prevalencePct?: number | string;
  tagSharePct?: number | string;
  activePct?: number | string;
  template?: DisplayFormatTemplate;
  decimalPrecision?: DecimalPrecision;
  useTildeForCoarse?: boolean;
  ratioStyle?: RatioStyle;
  forceCohortDenominator?: boolean;
}

/**
 * Format a numeric percentage value with controlled precision and optional tilde prefix for coarse rounding.
 */
export function formatPercentage(
  rawPct: number | string | undefined,
  precision: DecimalPrecision = 0,
  useTilde: boolean = true
): string {
  if (rawPct === undefined || rawPct === null || rawPct === '') return '0%';
  const num = typeof rawPct === 'number' ? rawPct : parseFloat(rawPct);
  if (isNaN(num)) return `${rawPct}%`;

  let formattedNum: string;
  if (precision === 0) {
    formattedNum = Math.round(num).toString();
  } else {
    formattedNum = num.toFixed(precision);
  }

  const prefix = (useTilde && precision === 0) ? '~' : '';
  return `${prefix}${formattedNum}%`;
}

/**
 * Format an n/N ratio string according to the requested RatioStyle.
 */
export function formatRatio(
  n: number | undefined,
  N: number | undefined,
  style: RatioStyle = 'n_over_N'
): string {
  const safeN = n ?? 0;
  const safeTotal = N ?? 0;

  if (safeTotal <= 0) {
    if (style === 'n_over_N') return `n = ${safeN}`;
    if (style === 'bracketed') return `(${safeN})`;
    return `${safeN}`;
  }

  if (style === 'fraction') {
    return `${safeN}/${safeTotal}`;
  }
  if (style === 'bracketed') {
    return `(${safeN}/${safeTotal})`;
  }
  // Default 'n_over_N'
  return `n = ${safeN}/${safeTotal}`;
}

/**
 * Primary format dispatcher resolving rich combination templates for Chart Labels, Legends, Tooltips, and Tables.
 */
export function formatMetricDisplay(params: FormatMetricParams): string {
  const {
    name = '',
    count,
    val,
    paperCount,
    tagCount,
    totalCohortPapers = 0,
    totalExtractedTags = 0,
    metricMode = 'count',
    prevalencePct,
    tagSharePct,
    activePct,
    template = 'ratio_percent',
    decimalPrecision = 0,
    useTildeForCoarse = true,
    ratioStyle = 'n_over_N',
    forceCohortDenominator = false
  } = params;

  // 1. Resolve dedicated Tag Share components
  const effTagCount = tagCount ?? (typeof count === 'number' ? count : (typeof val === 'number' ? val : 0));
  const effTotalTags = totalExtractedTags > 0 ? totalExtractedTags : (totalCohortPapers || 1);
  let rawTagSharePct: number;
  if (tagSharePct !== undefined) {
    rawTagSharePct = typeof tagSharePct === 'number' ? tagSharePct : parseFloat(tagSharePct);
  } else {
    rawTagSharePct = totalExtractedTags > 0 ? (effTagCount / totalExtractedTags) * 100 : 0;
  }
  if (isNaN(rawTagSharePct)) rawTagSharePct = 0;
  const tagSharePctStr = formatPercentage(rawTagSharePct, decimalPrecision, useTildeForCoarse);
  const tagShareRatioStr = formatRatio(effTagCount, effTotalTags, ratioStyle);
  const tagShareCountStr = ratioStyle === 'n_over_N' ? `n = ${effTagCount}` : `${effTagCount}`;

  // 2. Resolve dedicated Paper Prevalence components
  const effPaperCount = paperCount ?? (typeof count === 'number' ? count : (typeof val === 'number' ? val : 0));
  const effTotalCohort = totalCohortPapers > 0 ? totalCohortPapers : 1;
  let rawPrevalencePct: number;
  if (prevalencePct !== undefined) {
    rawPrevalencePct = typeof prevalencePct === 'number' ? prevalencePct : parseFloat(prevalencePct);
  } else {
    rawPrevalencePct = totalCohortPapers > 0 ? (effPaperCount / totalCohortPapers) * 100 : 0;
  }
  if (isNaN(rawPrevalencePct)) rawPrevalencePct = 0;
  const prevalencePctStr = formatPercentage(rawPrevalencePct, decimalPrecision, useTildeForCoarse);
  const prevalenceRatioStr = formatRatio(effPaperCount, effTotalCohort, ratioStyle);
  const prevalenceCountStr = ratioStyle === 'n_over_N' ? `n = ${effPaperCount}` : `${effPaperCount}`;

  // 3. Resolve active metric numerator (n) and denominator (N) for dynamic standard templates
  const isTagShare = metricMode === 'tag_share';
  let nVal: number;
  let nTotal: number;

  if (isTagShare && !forceCohortDenominator) {
    nVal = effTagCount;
    nTotal = effTotalTags;
  } else {
    nVal = effPaperCount;
    nTotal = effTotalCohort;
  }

  // 4. Resolve raw numeric percentage for dynamic standard templates
  let rawPercentageNum: number;
  if (activePct !== undefined) {
    rawPercentageNum = typeof activePct === 'number' ? activePct : parseFloat(activePct);
  } else if (isTagShare) {
    rawPercentageNum = rawTagSharePct;
  } else {
    rawPercentageNum = rawPrevalencePct;
  }
  if (isNaN(rawPercentageNum)) rawPercentageNum = 0;

  const pctStr = formatPercentage(rawPercentageNum, decimalPrecision, useTildeForCoarse);
  const ratioStr = formatRatio(nVal, nTotal, ratioStyle);
  const countOnlyStr = ratioStyle === 'n_over_N' ? `n = ${nVal}` : `${nVal}`;

  // Check if this is an average / scalar metric (e.g. avg_citation or avg_qa)
  const isScalarMetric = metricMode === 'avg_citation' || metricMode === 'avg_qa';
  const scalarValNum = typeof val === 'number' ? val : (typeof count === 'number' ? count : 0);
  const scalarStr = decimalPrecision === 0 ? Math.round(scalarValNum).toString() : scalarValNum.toFixed(decimalPrecision);

  // 5. Resolve Template
  switch (template) {
    // --- Explicit Tag Share Templates (Independent of metricMode) ---
    case 'tag_share_ratio_percent':
      return `${tagShareRatioStr}, ${tagSharePctStr}`;

    case 'name_tag_share_ratio_percent':
      return `${name} (${tagShareRatioStr}, ${tagSharePctStr})`;

    case 'tag_share_percent_ratio':
      return `${tagSharePctStr} (${tagShareRatioStr})`;

    case 'tag_share_percent_only':
      return tagSharePctStr;

    case 'tag_share_ratio_only':
      return tagShareRatioStr;

    case 'tag_share_count_percent':
      return `${tagShareCountStr} (${tagSharePctStr})`;

    case 'name_tag_share_percent':
      return `${name} (${tagSharePctStr})`;

    case 'name_tag_share_count_percent':
      return `${name} (${tagShareCountStr}, ${tagSharePctStr})`;

    // --- Explicit Paper Prevalence Templates (Independent of metricMode) ---
    case 'prevalence_ratio_percent':
      return `${prevalenceRatioStr}, ${prevalencePctStr}`;

    case 'name_prevalence_ratio_percent':
      return `${name} (${prevalenceRatioStr}, ${prevalencePctStr})`;

    case 'prevalence_percent_only':
      return prevalencePctStr;

    case 'prevalence_ratio_only':
      return prevalenceRatioStr;

    // --- Dual Multi-Metric Template ---
    case 'dual_prevalence_tag_share':
      return `${prevalenceRatioStr} (${prevalencePctStr}) | Tags: ${tagShareRatioStr} (${tagSharePctStr})`;

    // --- Standard Dynamic Templates (Matched to active chart metricMode) ---
    case 'name_ratio_percent':
      if (isScalarMetric) return `${name} (Avg = ${scalarStr}, n = ${paperCount ?? nVal})`;
      return `${name} (${ratioStr}, ${pctStr})`;

    case 'ratio_percent':
      if (isScalarMetric) return `Avg = ${scalarStr} (${ratioStr})`;
      return `${ratioStr}, ${pctStr}`;

    case 'percent_ratio':
      if (isScalarMetric) return `${scalarStr} (${ratioStr})`;
      return `${pctStr} (${ratioStr})`;

    case 'ratio_only':
      return ratioStr;

    case 'name_ratio':
      return `${name} (${ratioStr})`;

    case 'count_percent':
    case 'value_pct': // Legacy alias
      if (isScalarMetric) return `${scalarStr} (n = ${paperCount ?? nVal})`;
      if (metricMode === 'count') return `${ratioStr}, ${pctStr}`;
      return `${countOnlyStr} (${pctStr})`;

    case 'percent_only':
    case 'pct_only': // Legacy alias
      if (isScalarMetric) return `${scalarStr}`;
      return pctStr;

    case 'count_only':
    case 'value': // Legacy alias
      if (isScalarMetric) return scalarStr;
      return countOnlyStr;

    case 'name_only':
    case 'name': // Legacy alias
      return name;

    case 'name_count':
      if (isScalarMetric) return `${name} (${scalarStr})`;
      return `${name} (${countOnlyStr})`;

    case 'name_percent':
      if (isScalarMetric) return `${name} (${scalarStr})`;
      return `${name} (${pctStr})`;

    case 'name_count_percent':
      if (isScalarMetric) return `${name} (Avg = ${scalarStr}, n = ${paperCount ?? nVal})`;
      return `${name} (${countOnlyStr}, ${pctStr})`;

    default:
      return `${ratioStr}, ${pctStr}`;
  }
}
