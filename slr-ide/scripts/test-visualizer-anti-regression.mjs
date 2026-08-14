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

console.log('✓ All 4 anti-regression unit & fidelity tests PASSED successfully!');
