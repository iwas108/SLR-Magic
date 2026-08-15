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

  // 1. Resolve active numerator (n) and denominator (N)
  const isTagShare = metricMode === 'tag_share';

  let nVal: number;
  let nTotal: number;

  if (isTagShare && !forceCohortDenominator) {
    nVal = tagCount ?? (typeof count === 'number' ? count : (typeof val === 'number' ? val : 0));
    nTotal = totalExtractedTags;
  } else {
    nVal = paperCount ?? (typeof count === 'number' ? count : (typeof val === 'number' ? val : 0));
    nTotal = totalCohortPapers;
  }

  // 2. Resolve raw numeric percentage
  let rawPercentageNum: number;
  if (activePct !== undefined) {
    rawPercentageNum = typeof activePct === 'number' ? activePct : parseFloat(activePct);
  } else if (isTagShare) {
    if (tagSharePct !== undefined) {
      rawPercentageNum = typeof tagSharePct === 'number' ? tagSharePct : parseFloat(tagSharePct);
    } else {
      rawPercentageNum = totalExtractedTags > 0 ? (nVal / totalExtractedTags) * 100 : 0;
    }
  } else {
    if (prevalencePct !== undefined) {
      rawPercentageNum = typeof prevalencePct === 'number' ? prevalencePct : parseFloat(prevalencePct);
    } else {
      rawPercentageNum = totalCohortPapers > 0 ? (nVal / totalCohortPapers) * 100 : 0;
    }
  }

  if (isNaN(rawPercentageNum)) rawPercentageNum = 0;

  // 3. Format components
  const pctStr = formatPercentage(rawPercentageNum, decimalPrecision, useTildeForCoarse);
  const ratioStr = formatRatio(nVal, nTotal, ratioStyle);
  const countOnlyStr = ratioStyle === 'n_over_N' ? `n = ${nVal}` : `${nVal}`;

  // Check if this is an average / scalar metric (e.g. avg_citation or avg_qa)
  const isScalarMetric = metricMode === 'avg_citation' || metricMode === 'avg_qa';
  const scalarValNum = typeof val === 'number' ? val : (typeof count === 'number' ? count : 0);
  const scalarStr = decimalPrecision === 0 ? Math.round(scalarValNum).toString() : scalarValNum.toFixed(decimalPrecision);

  // 4. Resolve Template
  switch (template) {
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
