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

const metrics = calculateMetrics(mockCohort18Papers, 'rq7a_predictive_algorithms', predictiveAlgoTaxonomy);

// Assert exact values for Recurrent & Temporal Neural Networks
assert.strictEqual(metrics.recurrentUniquePapers, 9, 'Recurrent Neural Networks must have exactly 9 unique papers (N=9)');
assert.strictEqual(metrics.recurrentTagCount, 10, 'Recurrent Neural Networks must have exactly 10 tag mentions across the 9 papers');
assert.strictEqual(metrics.hybridUniquePapers, 2, 'Hybrid architectures must have exactly 2 papers (Thirupathi and Venkateswarlu)');

console.log('✓ All 9 anti-regression unit & scientific validation tests PASSED successfully!');


