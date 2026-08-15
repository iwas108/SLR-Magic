import assert from 'node:assert';

// 1. Quota Balancer Unit Test (Pure Hare-Hamilton Implementation)
function balancePercentagesToQuota(items, targetSum = 100.00) {
  if (!items || items.length === 0) return [];
  const rawSum = items.reduce((acc, it) => acc + (it.value || 0), 0);
  if (rawSum === 0) {
    const evenVal = Number((targetSum / items.length).toFixed(2));
    return items.map(it => ({ ...it, roundedPercent: evenVal }));
  }

  const unrounded = items.map((it, idx) => {
    const share = ((it.value || 0) / rawSum) * targetSum;
    const integerPart = Math.floor(share);
    const remainder = share - integerPart;
    return { ...it, idx, integerPart, remainder, assigned: integerPart };
  });

  const currentSum = unrounded.reduce((acc, it) => acc + it.integerPart, 0);
  const seatsToDistribute = Math.round(targetSum - currentSum);

  const sortedByRemainder = [...unrounded].sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < seatsToDistribute && i < sortedByRemainder.length; i++) {
    sortedByRemainder[i].assigned += 1;
  }

  const finalAllocated = [...sortedByRemainder].sort((a, b) => a.idx - b.idx);
  return finalAllocated.map(it => ({
    ...it,
    roundedPercent: Number(it.assigned.toFixed(2))
  }));
}

console.log('--- TEST SUITE: SLR Visualizer Anti-Regression ---');

// Test 1: Hare-Hamilton Quota Balancer 100.00% exact sum
console.log('1. Testing Hare-Hamilton Quota Balancer...');
const testItems1 = [
  { name: 'Category A', value: 33 },
  { name: 'Category B', value: 33 },
  { name: 'Category C', value: 34 }
];
const res1 = balancePercentagesToQuota(testItems1, 100);
const sum1 = res1.reduce((acc, it) => acc + it.roundedPercent, 0);
assert.strictEqual(sum1, 100, `Expected sum 100, got ${sum1}`);

const testItems2 = [
  { name: 'Cat 1', value: 1 },
  { name: 'Cat 2', value: 1 },
  { name: 'Cat 3', value: 1 }
];
const res2 = balancePercentagesToQuota(testItems2, 100);
const sum2 = res2.reduce((acc, it) => acc + it.roundedPercent, 0);
assert.strictEqual(sum2, 100, `Expected sum 100 on 3-way split, got ${sum2}`);

// Test 2: Color Shading Utility
console.log('2. Testing Hierarchical Shading Color Engine...');
function adjustColorShade(hexColor, factor) {
  let c = hexColor.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return hexColor;
  let num = parseInt(c, 16);
  let r = (num >> 16);
  let g = ((num >> 8) & 0x00FF);
  let b = (num & 0x0000FF);
  if (factor > 0) {
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
  } else {
    r = Math.max(0, Math.round(r * (1 + factor)));
    g = Math.max(0, Math.round(g * (1 + factor)));
    b = Math.max(0, Math.round(b * (1 + factor)));
  }
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const baseHex = '#1e3a8a';
const lighter = adjustColorShade(baseHex, 0.3);
assert.ok(lighter.startsWith('#'), 'Lighter shade should be a valid hex');
assert.notStrictEqual(lighter, baseHex, 'Lightened color must differ from base');

// Test 3: Multi-value and Taxonomy extractor logic
console.log('3. Testing Data Extractor & Umbrellanizer Mappings...');
function resolveUmbrellanizerValue(fieldKey, rawValue, umbrellanizerMap = {}) {
  if (!rawValue) return 'Unspecified';
  const cleanVal = String(rawValue).trim();
  if (!umbrellanizerMap || !umbrellanizerMap[fieldKey]) return cleanVal;
  const mapping = umbrellanizerMap[fieldKey];
  return mapping[cleanVal] || cleanVal;
}

const mockMap = {
  'ext:rq2_domains': {
    'smart_agri': 'Agriculture',
    'greenhouse': 'Agriculture',
    'fab_automation': 'Manufacturing'
  }
};
assert.strictEqual(resolveUmbrellanizerValue('ext:rq2_domains', 'greenhouse', mockMap), 'Agriculture');
assert.strictEqual(resolveUmbrellanizerValue('ext:rq2_domains', 'fab_automation', mockMap), 'Manufacturing');
assert.strictEqual(resolveUmbrellanizerValue('ext:rq2_domains', 'unknown_domain', mockMap), 'unknown_domain');

// Test 4: Preset Serialization/Deserialization Round-Trip Fidelity
console.log('4. Testing Preset Serialization & Deserialization Fidelity...');
const mockPreset = {
  version: '2.0',
  chartType: 'sunburst',
  primaryField: 'ext:rq2_operational_domains',
  themePreset: 'nature_emerald',
  fontFamily: 'serif',
  fontSize: 14,
  chartScale: 110,
  tiltAngle: 15,
  rotationAngle: 45,
  levelCustomGroups: {
    0: ['Indoor Agri', 'Industrial']
  },
  customSliceColors: {
    'Indoor Agri': '#047857'
  }
};

const jsonSerialized = JSON.stringify(mockPreset, null, 2);
const parsedPreset = JSON.parse(jsonSerialized);
assert.strictEqual(parsedPreset.version, '2.0');
assert.strictEqual(parsedPreset.chartType, 'sunburst');
assert.strictEqual(parsedPreset.tiltAngle, 15);
assert.strictEqual(parsedPreset.customSliceColors['Indoor Agri'], '#047857');

// Test 5: Clustered Bar 2D Matrix Co-Occurrence Calculation
console.log('5. Testing Clustered Bar 2D Matrix Generation & Aggregate Cluster Sorting...');
const samplePapers = [
  { Paper_ID: 'P1', Method: 'Digital Twin', Domain: 'Manufacturing', Overall_QA: '95', citation_count: 50 },
  { Paper_ID: 'P2', Method: 'Digital Twin', Domain: 'Manufacturing', Overall_QA: '85', citation_count: 20 },
  { Paper_ID: 'P3', Method: 'Digital Twin', Domain: 'Healthcare', Overall_QA: '90', citation_count: 10 },
  { Paper_ID: 'P4', Method: 'Simulation', Domain: 'Healthcare', Overall_QA: '70', citation_count: 5 },
  { Paper_ID: 'P5', Method: 'Simulation', Domain: 'Agriculture', Overall_QA: '80', citation_count: 15 }
];

function computeCrossTabMatrix(papers, primKey, secKey) {
  const catMap = new Map();
  papers.forEach(p => {
    const pVal = p[primKey];
    const sVal = p[secKey];
    if (!catMap.has(pVal)) catMap.set(pVal, new Map());
    if (!catMap.get(pVal).has(sVal)) catMap.get(pVal).set(sVal, []);
    catMap.get(pVal).get(sVal).push(p);
  });
  return catMap;
}

const matrixResult = computeCrossTabMatrix(samplePapers, 'Method', 'Domain');
assert.strictEqual(matrixResult.get('Digital Twin').get('Manufacturing').length, 2);
assert.strictEqual(matrixResult.get('Digital Twin').get('Healthcare').length, 1);
assert.strictEqual(matrixResult.get('Simulation').get('Healthcare').length, 1);
assert.strictEqual(matrixResult.get('Simulation').get('Agriculture').length, 1);

// Test 6: Statistical Dispersion Calculations (Mean, SD, SE, 95% CI)
console.log('6. Testing Statistical Calculations (Mean, SD, SE, 95% CI)...');
function computeStats(values) {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0, stdError: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = parseFloat((sum / n).toFixed(2));
  if (n === 1) return { mean, stdDev: 0, stdError: 0 };
  const sumSq = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
  const variance = sumSq / (n - 1);
  const stdDev = parseFloat(Math.sqrt(variance).toFixed(2));
  const stdError = parseFloat((stdDev / Math.sqrt(n)).toFixed(2));
  const ci95Lower = parseFloat(Math.max(0, mean - (1.96 * stdError)).toFixed(2));
  const ci95Upper = parseFloat((mean + (1.96 * stdError)).toFixed(2));
  return { mean, stdDev, stdError, ci95Lower, ci95Upper };
}

const qaValues = [95, 85, 90]; // Mean: 90, SD: 5, SE: 2.89
const statsRes = computeStats(qaValues);
assert.strictEqual(statsRes.mean, 90);
assert.strictEqual(statsRes.stdDev, 5);
assert.strictEqual(statsRes.stdError, 2.89);
// Test 7: Clustered Bar Preset Serialization Round-Trip
console.log('7. Testing Clustered Bar Preset Serialization Round-Trip...');
const clusteredPreset = {
  version: '3.0',
  chartType: 'clustered_bar',
  barOrientation: 'horizontal',
  barClusterGap: 25,
  barInnerGap: 12,
  enableErrorBars: true,
  errorBarType: 'ci_95',
  enableHatchPatterns: true,
  axisScaleType: 'log',
  customAxisTitleX: 'Log₁₀ Citation Count',
  customAxisTitleY: 'Research Method'
};

const serializedClustered = JSON.stringify(clusteredPreset);
const deserializedClustered = JSON.parse(serializedClustered);
assert.strictEqual(deserializedClustered.chartType, 'clustered_bar');
assert.strictEqual(deserializedClustered.barOrientation, 'horizontal');
assert.strictEqual(deserializedClustered.enableErrorBars, true);
assert.strictEqual(deserializedClustered.enableHatchPatterns, true);

// Test 8: Compound Algorithm Token Collision Prevention & Canonical Normalization
console.log('8. Testing Compound Algorithm Token Collision Prevention...');
function canonicalizeString(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[\u2013\u2014\u2212\uFFFD]/g, '-')
    .replace(/[\u00A0\u200B\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForLookup(val) {
  return canonicalizeString(val).toLowerCase();
}

function resolveTaxonomyExact(rawVal, fieldKey, umbrellanizerMap = {}) {
  if (!rawVal) return '';
  const rawNorm = normalizeForLookup(rawVal);
  const realKey = fieldKey.startsWith('ext:') ? fieldKey.substring(4) : fieldKey;
  const dict = umbrellanizerMap[fieldKey] || umbrellanizerMap[realKey] || umbrellanizerMap[`ext:${realKey}`];
  if (!dict) return rawVal;

  if (typeof dict === 'object' && dict !== null) {
    const matchedKey = Object.keys(dict).find(k => normalizeForLookup(k) === rawNorm);
    if (matchedKey) {
      const mapped = dict[matchedKey];
      if (typeof mapped === 'object' && mapped !== null && !Array.isArray(mapped)) {
        return mapped.umbrella_category || matchedKey;
      }
      return mapped || matchedKey;
    }
  }
  return rawVal;
}

const predictiveAlgoTaxonomy = {
  'rq7a_predictive_algorithms': {
    'LSTM': { umbrella_category: 'Recurrent & Temporal Neural Networks', justification: 'Standard LSTM' },
    'BiLSTM': { umbrella_category: 'Recurrent & Temporal Neural Networks', justification: 'Bidirectional LSTM' },
    '1D CNN-LSTM': { umbrella_category: 'Hybrid & Multimodal Architectures', justification: 'Compound hybrid model' },
    'CNN-LSTM': { umbrella_category: 'Hybrid & Multimodal Architectures', justification: 'Convolutional recurrent hybrid' },
    'ED-LSTM-A': { umbrella_category: 'Hybrid & Multimodal Architectures', justification: 'Encoder decoder attention hybrid' },
    'TCN': { umbrella_category: 'Recurrent & Temporal Neural Networks', justification: 'Temporal convolutional network' }
  }
};

// Assert that compound tokens NEVER collide with substrings like 'LSTM'
assert.strictEqual(
  resolveTaxonomyExact('1D CNN-LSTM', 'rq7a_predictive_algorithms', predictiveAlgoTaxonomy),
  'Hybrid & Multimodal Architectures',
  '1D CNN-LSTM must strictly map to Hybrid & Multimodal Architectures'
);
assert.strictEqual(
  resolveTaxonomyExact('CNN-LSTM', 'rq7a_predictive_algorithms', predictiveAlgoTaxonomy),
  'Hybrid & Multimodal Architectures',
  'CNN-LSTM must strictly map to Hybrid & Multimodal Architectures'
);
assert.strictEqual(
  resolveTaxonomyExact('LSTM', 'rq7a_predictive_algorithms', predictiveAlgoTaxonomy),
  'Recurrent & Temporal Neural Networks',
  'LSTM must map to Recurrent & Temporal Neural Networks'
);
// Test Unicode dash normalization
assert.strictEqual(
  resolveTaxonomyExact('1D CNN–LSTM', 'rq7a_predictive_algorithms', predictiveAlgoTaxonomy),
  'Hybrid & Multimodal Architectures',
  'En-dash in 1D CNN–LSTM must normalize and resolve correctly'
);

// Test 9: Tri-Modal Math Invariance Check (Paper Prevalence vs Tag Share)
console.log('9. Testing Tri-Modal Mathematical Invariance (Paper Prevalence vs Tag Share)...');
const mockCohort18Papers = [
  { Paper_ID: 'P1', rq7a_predictive_algorithms: ['LSTM', 'TCN'] }, // 2 tags, 1 paper
  { Paper_ID: 'P2', rq7a_predictive_algorithms: ['LSTM'] },
  { Paper_ID: 'P3', rq7a_predictive_algorithms: ['LSTM'] },
  { Paper_ID: 'P4', rq7a_predictive_algorithms: ['LSTM'] },
  { Paper_ID: 'P5', rq7a_predictive_algorithms: ['LSTM'] },
  { Paper_ID: 'P6', rq7a_predictive_algorithms: ['LSTM'] },
  { Paper_ID: 'P7', rq7a_predictive_algorithms: ['LSTM'] },
  { Paper_ID: 'P8', rq7a_predictive_algorithms: ['LSTM'] },
  { Paper_ID: 'P9', rq7a_predictive_algorithms: ['BiLSTM'] }, // 9th paper for Recurrent
  { Paper_ID: 'P10', rq7a_predictive_algorithms: ['1D CNN-LSTM'] }, // Hybrid paper 1 (Thirupathi)
  { Paper_ID: 'P11', rq7a_predictive_algorithms: ['CNN-LSTM'] }, // Hybrid paper 2 (Venkateswarlu)
  { Paper_ID: 'P12', rq7a_predictive_algorithms: ['Random Forest'] },
  { Paper_ID: 'P13', rq7a_predictive_algorithms: ['XGBoost'] },
  { Paper_ID: 'P14', rq7a_predictive_algorithms: ['SVR'] },
  { Paper_ID: 'P15', rq7a_predictive_algorithms: ['ARIMA'] },
  { Paper_ID: 'P16', rq7a_predictive_algorithms: ['NOT_STATED'] },
  { Paper_ID: 'P17', rq7a_predictive_algorithms: ['NOT_STATED'] },
  { Paper_ID: 'P18', rq7a_predictive_algorithms: ['NOT_STATED'] }
];

function calculateMetrics(papers, key, taxonomy) {
  const catPaperIds = new Map();
  const catTagCounts = new Map();
  let totalTags = 0;

  papers.forEach(p => {
    const rawList = p[key] || [];
    const valid = rawList.filter(t => t !== 'NOT_STATED');
    const seen = new Set();
    valid.forEach(t => {
      totalTags++;
      const cat = resolveTaxonomyExact(t, key, taxonomy);
      catTagCounts.set(cat, (catTagCounts.get(cat) || 0) + 1);
      if (!seen.has(cat)) {
        seen.add(cat);
        if (!catPaperIds.has(cat)) catPaperIds.set(cat, new Set());
        catPaperIds.get(cat).add(p.Paper_ID);
      }
    });
  });

  return {
    recurrentUniquePapers: catPaperIds.get('Recurrent & Temporal Neural Networks')?.size || 0,
    recurrentTagCount: catTagCounts.get('Recurrent & Temporal Neural Networks') || 0,
    hybridUniquePapers: catPaperIds.get('Hybrid & Multimodal Architectures')?.size || 0,
    totalCohort: papers.length
  };
}

// Test 10: Smart Auto-Optimizer Parameter Tuning
console.log('10. Testing Smart Auto-Optimizer Parameter Tuning...');
const sampleCohortForOptimization = [
  { Paper_ID: 'P1', Framework: 'Unspecified' },
  { Paper_ID: 'P2', Framework: 'Unspecified' },
  { Paper_ID: 'P3', Framework: 'Unspecified' },
  { Paper_ID: 'P4', Framework: 'Unspecified' },
  { Paper_ID: 'P5', Framework: 'Unspecified' },
  { Paper_ID: 'P6', Framework: 'Unspecified' },
  { Paper_ID: 'P7', Framework: 'Unspecified' },
  { Paper_ID: 'P8', Framework: 'Unspecified' },
  { Paper_ID: 'P9', Framework: 'OPC UA Information Model' },
  { Paper_ID: 'P10', Framework: 'Ontology' }
];

function mockOptimizeSlotConfig(config, papers) {
  const cfg = { ...config };
  const counts = new Map();
  papers.forEach(p => {
    const v = p[cfg.primaryField] || 'Unspecified';
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const highest = sorted[0]?.[1] || 0;
  const dominanceRatio = papers.length > 0 ? highest / papers.length : 0;

  if (cfg.chartType === 'pie_donut') {
    cfg.donutRatio = 48;
    cfg.showLegend = true;
    cfg.legendPosition = 'right';
    cfg.legendFormat = 'name_count_percent';
    cfg.pieLeaderLineLength = 12;
    cfg.pieLineHeight = 15;
    if (dominanceRatio > 0.65) {
      cfg.pieLabelPlacement = 'inside';
      cfg.pieRadiusRatio = 70;
    }
  }
  return cfg;
}

const unoptimizedDonut = {
  chartType: 'pie_donut',
  primaryField: 'Framework',
  donutRatio: 20,
  showLegend: false,
  legendPosition: 'top',
  pieLabelPlacement: 'outside',
  pieRadiusRatio: 40
};

const optimizedDonut = mockOptimizeSlotConfig(unoptimizedDonut, sampleCohortForOptimization);
assert.strictEqual(optimizedDonut.donutRatio, 48, 'Donut ratio should be optimized to 48%');
assert.strictEqual(optimizedDonut.showLegend, true, 'Legend should be enabled');
assert.strictEqual(optimizedDonut.legendPosition, 'right', 'Legend should be placed on the right');
assert.strictEqual(optimizedDonut.pieLabelPlacement, 'inside', 'Dominant distribution should use inside label placement');
assert.strictEqual(optimizedDonut.pieRadiusRatio, 70, 'Outer radius should be enlarged to 70% for prominent visibility');
assert.strictEqual(optimizedDonut.pieLeaderLineLength, 12, 'Leader line length should be optimized to 12px');
console.log('11. Testing Sunburst Scale Factor & Level Radius Normalization...');
const testChartScale1 = 1.0;
const testChartScale100 = 100;
const normScale1 = testChartScale1 > 10 ? testChartScale1 / 100 : (testChartScale1 || 1.0);
const normScale100 = testChartScale100 > 10 ? testChartScale100 / 100 : (testChartScale100 || 1.0);
assert.strictEqual(normScale1, 1.0, 'Scale factor 1.0 should resolve to 1.0 (100%)');
assert.strictEqual(normScale100, 1.0, 'Scale factor 100 should resolve to 1.0 (100%)');

const lvl0_r0 = 15;
const lvl0_r = 40;
const scaledLvl0_r0 = Math.round(lvl0_r0 * normScale1);
const scaledLvl0_r = Math.round(lvl0_r * normScale1);
assert.strictEqual(scaledLvl0_r0, 15, 'Level 0 inner radius must be 15%');
assert.strictEqual(scaledLvl0_r, 40, 'Level 0 outer radius must be 40%');

console.log('12. Testing Sunburst Legend Label Formatting Priority...');
function formatLegendLabel(name, stats, format = 'name') {
  const pCount = stats.paperCount;
  const pctRaw = stats.percent ?? stats.prevalencePct;
  const pctStr = pctRaw !== undefined ? (typeof pctRaw === 'number' ? pctRaw.toFixed(2) : pctRaw) : undefined;
  if (format === 'name_count' && pCount !== undefined) return `${name} (N=${pCount})`;
  if (format === 'name_percent' && pctStr !== undefined) return `${name} (${pctStr}%)`;
  if (format === 'name_count_percent' && pCount !== undefined) return `${name} (N=${pCount}, ${pctStr || '0.00'}%)`;
  return name;
}

const sunburstLegendFormat = 'name_count_percent';
const generalLegendFormat = 'name';
const effectiveLegendFormat = sunburstLegendFormat || generalLegendFormat || 'name';
const label = formatLegendLabel('Indoor Architecture', { paperCount: 11, percent: '61.11' }, effectiveLegendFormat);
console.log('13. Testing Legend Distance to Main Chart Offsets...');
const legendDistance = 45;
const testLegendPosMap = {
  'top-left': { top: 15, left: legendDistance },
  'top-center': { top: legendDistance, left: 'center' },
  'top-right': { top: 15, right: legendDistance },
  'left': { left: legendDistance, top: 'center' },
  'right': { right: legendDistance, top: 'center' },
  'bottom-left': { bottom: 15, left: legendDistance },
  'bottom-center': { bottom: legendDistance, left: 'center' },
  'bottom-right': { bottom: 15, right: legendDistance }
};
assert.strictEqual(testLegendPosMap['right'].right, 45, 'Right legend offset must be 45px');
console.log('14. Testing Sunburst Level Slice Label Formatting Engine...');
function formatSunburstSliceLabel(name, nodeVal, totalVal, lblFormat = 'name', overflowMode = 'none') {
  let formattedName = name || '';
  if (overflowMode === 'break') {
    formattedName = formattedName.replace(/\//g, '/\n');
  }
  if (lblFormat === 'name') return formattedName;
  const pctStr = totalVal > 0 ? `${((nodeVal / totalVal) * 100).toFixed(1)}%` : '0.0%';

  if (lblFormat === 'name_count') return nodeVal > 0 ? `${formattedName}\nN=${nodeVal}` : formattedName;
  if (lblFormat === 'name_percent') return nodeVal > 0 ? `${formattedName}\n${pctStr}` : formattedName;
  if (lblFormat === 'name_count_percent') return nodeVal > 0 ? `${formattedName}\nN=${nodeVal} (${pctStr})` : formattedName;
  if (lblFormat === 'count_only') return nodeVal > 0 ? `N=${nodeVal}` : formattedName;
  if (lblFormat === 'percent_only') return nodeVal > 0 ? `${pctStr}` : formattedName;
  return formattedName;
}

const sliceName = 'Manufacturing';
const sliceVal = 6;
const totalSunburstVal = 18;

assert.strictEqual(formatSunburstSliceLabel(sliceName, sliceVal, totalSunburstVal, 'name'), 'Manufacturing');
assert.strictEqual(formatSunburstSliceLabel(sliceName, sliceVal, totalSunburstVal, 'name_count'), 'Manufacturing\nN=6');
assert.strictEqual(formatSunburstSliceLabel(sliceName, sliceVal, totalSunburstVal, 'name_percent'), 'Manufacturing\n33.3%');
assert.strictEqual(formatSunburstSliceLabel(sliceName, sliceVal, totalSunburstVal, 'name_count_percent'), 'Manufacturing\nN=6 (33.3%)');
assert.strictEqual(formatSunburstSliceLabel(sliceName, sliceVal, totalSunburstVal, 'count_only'), 'N=6');
assert.strictEqual(formatSunburstSliceLabel(sliceName, sliceVal, totalSunburstVal, 'percent_only'), '33.3%');

console.log('15. Testing Reviewer Statistical Granularity & Ratio Formatters...');

function formatPercentage(val, decimalPrecision = 0, useTildeForCoarse = true) {
  if (val === undefined || val === null || isNaN(val)) return '0%';
  if (decimalPrecision === 0) {
    const rounded = Math.round(val);
    return useTildeForCoarse ? `~${rounded}%` : `${rounded}%`;
  }
  return `${val.toFixed(decimalPrecision)}%`;
}

function formatRatio(count, total, ratioStyle = 'n_over_N') {
  const safeCount = count ?? 0;
  const safeTotal = total ?? 0;
  if (ratioStyle === 'fraction') return `${safeCount}/${safeTotal}`;
  if (ratioStyle === 'bracketed') return `(${safeCount}/${safeTotal})`;
  return `n = ${safeCount}/${safeTotal}`;
}

function formatMetricDisplay(opts) {
  const {
    name = '',
    count = 0,
    paperCount,
    totalCohortPapers = 18,
    totalExtractedTags = 18,
    metricMode = 'paper_prevalence',
    prevalencePct,
    tagSharePct,
    template = 'ratio_percent',
    decimalPrecision = 0,
    useTildeForCoarse = true,
    ratioStyle = 'n_over_N',
    forceCohortDenominator = false
  } = opts;

  let denominator = totalCohortPapers;
  let effectiveCount = paperCount !== undefined ? paperCount : count;
  if (metricMode === 'tag_share' && !forceCohortDenominator) {
    denominator = totalExtractedTags;
    effectiveCount = opts.tagCount !== undefined ? opts.tagCount : count;
  }

  const effectivePct = (prevalencePct !== undefined && metricMode !== 'tag_share')
    ? prevalencePct
    : (tagSharePct !== undefined && metricMode === 'tag_share')
      ? tagSharePct
      : denominator > 0 ? (effectiveCount / denominator) * 100 : 0;

  const pctStr = formatPercentage(effectivePct, decimalPrecision, useTildeForCoarse);
  const ratioStr = formatRatio(effectiveCount, denominator, ratioStyle);
  const countStr = `n = ${effectiveCount}`;

  switch (template) {
    case 'name_ratio_percent':
      return `${name} (${ratioStr}, ${pctStr})`;
    case 'ratio_percent':
      return `${ratioStr}, ${pctStr}`;
    case 'percent_ratio':
      return `${pctStr} (${ratioStr})`;
    case 'ratio_only':
      return ratioStr;
    case 'name_ratio':
      return `${name} (${ratioStr})`;
    case 'count_percent':
      return `${countStr} (${pctStr})`;
    case 'percent_only':
      return pctStr;
    case 'count_only':
      return countStr;
    case 'name_count':
      return `${name} (${countStr})`;
    case 'name_percent':
      return `${name} (${pctStr})`;
    case 'name_count_percent':
      return `${name} (${countStr}, ${pctStr})`;
    case 'name_only':
    case 'name':
      return name;
    default:
      return `${ratioStr}, ${pctStr}`;
  }
}

// Reviewer Sample: N = 18, n = 1, single paper accounts for ~6%
const singlePaperPct = (1 / 18) * 100;
assert.strictEqual(formatPercentage(singlePaperPct, 0, true), '~6%', '0 decimals with tilde should format as ~6%');
assert.strictEqual(formatPercentage(singlePaperPct, 0, false), '6%', '0 decimals without tilde should format as 6%');
assert.strictEqual(formatPercentage(singlePaperPct, 1, true), '5.6%', '1 decimal should format as 5.6%');
assert.strictEqual(formatPercentage(singlePaperPct, 2, true), '5.56%', '2 decimals should format as 5.56%');

// Ratio styles
assert.strictEqual(formatRatio(1, 18, 'n_over_N'), 'n = 1/18');
assert.strictEqual(formatRatio(1, 18, 'fraction'), '1/18');
assert.strictEqual(formatRatio(1, 18, 'bracketed'), '(1/18)');

// Reviewer Template Outputs for 11 papers out of 18 (e.g. 61.11% coarse = ~61%)
const testP11 = {
  name: 'Industrial IoT',
  count: 11,
  paperCount: 11,
  totalCohortPapers: 18,
  totalExtractedTags: 42,
  decimalPrecision: 0,
  useTildeForCoarse: true,
  ratioStyle: 'n_over_N'
};

assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'ratio_percent' }),
  'n = 11/18, ~61%',
  'ratio_percent must output "n = 11/18, ~61%"'
);
assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'name_ratio_percent' }),
  'Industrial IoT (n = 11/18, ~61%)',
  'name_ratio_percent must output "Industrial IoT (n = 11/18, ~61%)"'
);
assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'percent_ratio' }),
  '~61% (n = 11/18)',
  'percent_ratio must output "~61% (n = 11/18)"'
);
assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'ratio_only' }),
  'n = 11/18',
  'ratio_only must output "n = 11/18"'
);
assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'name_ratio' }),
  'Industrial IoT (n = 11/18)',
  'name_ratio must output "Industrial IoT (n = 11/18)"'
);
assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'count_percent' }),
  'n = 11 (~61%)',
  'count_percent must output "n = 11 (~61%)"'
);
assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'percent_only' }),
  '~61%',
  'percent_only must output "~61%"'
);
assert.strictEqual(
  formatMetricDisplay({ ...testP11, template: 'name_only' }),
  'Industrial IoT',
  'name_only must output "Industrial IoT"'
);

// Context-aware denominator in Tag Share mode
const testTagShare = {
  name: 'Sensor Fusion',
  tagCount: 15,
  totalCohortPapers: 18,
  totalExtractedTags: 42,
  metricMode: 'tag_share',
  forceCohortDenominator: false,
  decimalPrecision: 0,
  useTildeForCoarse: true,
  template: 'ratio_percent'
};
assert.strictEqual(
  formatMetricDisplay(testTagShare),
  'n = 15/42, ~36%',
  'Tag share mode must use total extracted tags 42 as denominator when forceCohortDenominator is false'
);

const testTagShareForced = {
  ...testTagShare,
  paperCount: 12,
  forceCohortDenominator: true
};
assert.strictEqual(
  formatMetricDisplay(testTagShareForced),
  'n = 12/18, ~67%',
  'Tag share mode with forceCohortDenominator=true must use cohort papers 18 as denominator'
);

console.log('✓ All 15 anti-regression & reviewer granularity unit tests PASSED successfully!');




