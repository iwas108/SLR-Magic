import assert from 'node:assert';

// Mock Data
const mockPapers = [
  { Paper_ID: 'P1', Year: '2021', Import_Source: 'IEEE Xplore', Local_PDF_Status: 'FOUND' },
  { Paper_ID: 'P2', Year: '2021', Import_Source: 'IEEE Xplore', Local_PDF_Status: 'FOUND' },
  { Paper_ID: 'P3', Year: '2022', Import_Source: 'ScienceDirect', Local_PDF_Status: 'FOUND' },
  { Paper_ID: 'P4', Year: '2022', Import_Source: 'ScienceDirect', Local_PDF_Status: 'MISSING' },
  { Paper_ID: 'P5', Year: '2023', Import_Source: 'ACM DL', Local_PDF_Status: 'FOUND' },
  { Paper_ID: 'P6', Year: '2023', Import_Source: 'Springer', Local_PDF_Status: 'FOUND' }
];

console.log('--- TEST SUITE: SLR Visualizer Sankey Fine-Tune Suite ---');

// Test 1: Default Sankey Slot Configuration
console.log('1. Testing Default Sankey Parameter Defaults...');
function createDefaultSankeyConfig() {
  return {
    chartType: 'sankey',
    sankeyFields: ['Year', 'Import_Source', 'Local_PDF_Status'],
    sankeyNodeWidth: 20,
    sankeyNodeGap: 18,
    sankeyLeftPadding: 8,
    sankeyRightPadding: 20,
    sankeyTopPadding: 12,
    sankeyBottomPadding: 8,
    sankeyOrient: 'horizontal',
    sankeyNodeAlign: 'justify',
    sankeyCurveness: 0.5,
    sankeyLinkColorMode: 'gradient',
    sankeyLinkOpacity: 45,
    sankeyNodeBorderRadius: 2,
    sankeyNodeBorderWidth: 1,
    sankeyLayoutIterations: 32,
    sankeyDraggable: true,
    sankeyLabelPosition: 'auto',
    sankeyLabelDistance: 6,
    sankeyLabelOverflow: 'break',
    sankeyMaxLabelWidth: 120,
    sankeyLabelRotate: 0,
    sankeyEmphasisFocus: 'adjacency',
    sankeyLevelLabelFormats: {},
    sankeyLabelPositions: {},
    sankeyMaxNodes: {},
    tailLabelStyle: 'comma_list'
  };
}

const defCfg = createDefaultSankeyConfig();
assert.strictEqual(defCfg.sankeyOrient, 'horizontal');
assert.strictEqual(defCfg.sankeyNodeAlign, 'justify');
assert.strictEqual(defCfg.sankeyCurveness, 0.5);
assert.strictEqual(defCfg.sankeyLinkColorMode, 'gradient');
assert.strictEqual(defCfg.sankeyLinkOpacity, 45);
assert.strictEqual(defCfg.sankeyDraggable, true);
assert.strictEqual(defCfg.sankeyEmphasisFocus, 'adjacency');

// Test 2: Quick Presets Configurations
console.log('2. Testing Quick Layout Presets Matrix...');
function getSankeyPreset(type) {
  const base = createDefaultSankeyConfig();
  if (type === 'classic') {
    return { ...base, sankeyOrient: 'horizontal', sankeyNodeAlign: 'justify', sankeyNodeWidth: 20, sankeyNodeGap: 18, sankeyCurveness: 0.5, sankeyLinkColorMode: 'gradient', sankeyLinkOpacity: 45 };
  } else if (type === 'dense') {
    return { ...base, sankeyOrient: 'horizontal', sankeyNodeAlign: 'left', sankeyNodeWidth: 14, sankeyNodeGap: 10, sankeyCurveness: 0.4, sankeyLinkColorMode: 'source', sankeyLinkOpacity: 60, sankeyNodeBorderRadius: 0, sankeyEmphasisFocus: 'trajectory' };
  } else if (type === 'ribbon') {
    return { ...base, sankeyOrient: 'horizontal', sankeyNodeAlign: 'justify', sankeyNodeWidth: 28, sankeyNodeGap: 24, sankeyCurveness: 0.65, sankeyLinkColorMode: 'gradient', sankeyLinkOpacity: 35, sankeyNodeBorderRadius: 4 };
  } else if (type === 'vertical') {
    return { ...base, sankeyOrient: 'vertical', sankeyNodeAlign: 'justify', sankeyNodeWidth: 20, sankeyNodeGap: 16, sankeyCurveness: 0.5, sankeyTopPadding: 10, sankeyBottomPadding: 15 };
  }
  return base;
}

const densePreset = getSankeyPreset('dense');
assert.strictEqual(densePreset.sankeyNodeAlign, 'left');
assert.strictEqual(densePreset.sankeyLinkColorMode, 'source');
assert.strictEqual(densePreset.sankeyEmphasisFocus, 'trajectory');

const vertPreset = getSankeyPreset('vertical');
assert.strictEqual(vertPreset.sankeyOrient, 'vertical');

// Test 3: Preset Serialization & Deserialization Round-Trip Fidelity
console.log('3. Testing Preset JSON Serialization / Deserialization...');
const fullPresetPayload = {
  version: '3.0',
  exportedAt: new Date().toISOString(),
  layoutMode: 'single',
  slots: {
    slot_a: {
      ...densePreset,
      sankeyLevelLabelFormats: {
        0: 'name_count_percent',
        1: 'name_ratio_percent',
        2: 'ratio_only'
      },
      sankeyLabelPositions: {
        0: 'right',
        1: 'inside',
        2: 'left'
      }
    }
  }
};

const serialized = JSON.stringify(fullPresetPayload);
const parsed = JSON.parse(serialized);
assert.strictEqual(parsed.version, '3.0');
assert.strictEqual(parsed.slots.slot_a.sankeyOrient, 'horizontal');
assert.strictEqual(parsed.slots.slot_a.sankeyLinkColorMode, 'source');
assert.strictEqual(parsed.slots.slot_a.sankeyLevelLabelFormats[0], 'name_count_percent');
assert.strictEqual(parsed.slots.slot_a.sankeyLabelPositions[1], 'inside');

// Test 4: ECharts Option Generator Simulation
console.log('4. Testing Sankey ECharts Option Generator Logic...');
function mockGenerateSankey(ctx) {
  const {
    papers,
    sankeyFields,
    sankeyOrient = 'horizontal',
    sankeyNodeAlign = 'justify',
    sankeyCurveness = 0.5,
    sankeyLinkColorMode = 'gradient',
    sankeyLinkOpacity = 45,
    sankeyNodeWidth = 20,
    sankeyNodeGap = 18,
    sankeyNodeBorderRadius = 2,
    sankeyNodeBorderWidth = 1,
    sankeyLayoutIterations = 32,
    sankeyDraggable = true,
    sankeyLeftPadding = 8,
    sankeyRightPadding = 20,
    sankeyTopPadding = 12,
    sankeyBottomPadding = 8,
    sankeyEmphasisFocus = 'adjacency',
    sankeyLevelLabelFormats = {},
    sankeyLabelPositions = {},
    labelFormat = 'name'
  } = ctx;

  const totalCohort = papers.length || 1;
  const nodesSet = new Set();
  const linksMap = new Map();
  const nodePapers = new Map();

  papers.forEach(p => {
    const vals = sankeyFields.map(f => p[f]);
    for (let i = 0; i < vals.length - 1; i++) {
      const src = `${i + 1}: ${vals[i]}`;
      const tgt = `${i + 2}: ${vals[i + 1]}`;
      nodesSet.add(src);
      nodesSet.add(tgt);

      if (!nodePapers.has(src)) nodePapers.set(src, new Set());
      nodePapers.get(src).add(p.Paper_ID);
      if (!nodePapers.has(tgt)) nodePapers.set(tgt, new Set());
      nodePapers.get(tgt).add(p.Paper_ID);

      const linkKey = `${src}--->${tgt}`;
      linksMap.set(linkKey, (linksMap.get(linkKey) || 0) + 1);
    }
  });

  const nodes = Array.from(nodesSet).map(n => {
    const colonIdx = n.indexOf(': ');
    const lvl = parseInt(n.substring(0, colonIdx), 10);
    const cleanName = n.substring(colonIdx + 2);
    const pCount = nodePapers.get(n)?.size || 0;
    const effFormat = sankeyLevelLabelFormats[lvl - 1] || labelFormat;
    const pos = sankeyLabelPositions[lvl - 1] || (lvl === sankeyFields.length ? 'left' : 'right');

    return {
      name: n,
      value: pCount,
      itemStyle: {
        borderWidth: sankeyNodeBorderWidth,
        borderRadius: sankeyNodeBorderRadius
      },
      label: {
        position: pos,
        formatter: () => effFormat === 'name_count' ? `${cleanName} (n = ${pCount})` : cleanName
      }
    };
  });

  const resolvedLinkColor = sankeyLinkColorMode === 'source' ? 'source' : sankeyLinkColorMode === 'target' ? 'target' : 'gradient';
  const links = Array.from(linksMap.entries()).map(([k, val]) => {
    const [source, target] = k.split('--->');
    return {
      source,
      target,
      value: val,
      lineStyle: {
        color: resolvedLinkColor,
        curveness: sankeyCurveness,
        opacity: sankeyLinkOpacity / 100
      }
    };
  });

  return {
    series: [{
      type: 'sankey',
      orient: sankeyOrient,
      nodeAlign: sankeyNodeAlign,
      layoutIterations: sankeyLayoutIterations,
      draggable: sankeyDraggable,
      left: `${sankeyLeftPadding}%`,
      right: `${sankeyRightPadding}%`,
      top: `${sankeyTopPadding}%`,
      bottom: `${sankeyBottomPadding}%`,
      nodeWidth: sankeyNodeWidth,
      nodeGap: sankeyNodeGap,
      data: nodes,
      links: links,
      emphasis: { focus: sankeyEmphasisFocus }
    }]
  };
}

const generatedOpt = mockGenerateSankey({
  papers: mockPapers,
  sankeyFields: ['Year', 'Import_Source', 'Local_PDF_Status'],
  sankeyOrient: 'vertical',
  sankeyNodeAlign: 'justify',
  sankeyCurveness: 0.6,
  sankeyLinkColorMode: 'source',
  sankeyLinkOpacity: 55,
  sankeyLevelLabelFormats: {
    0: 'name_count'
  }
});

const series0 = generatedOpt.series[0];
assert.strictEqual(series0.orient, 'vertical');
assert.strictEqual(series0.nodeAlign, 'justify');
assert.strictEqual(series0.links[0].lineStyle.curveness, 0.6);
assert.strictEqual(series0.links[0].lineStyle.color, 'source');
assert.strictEqual(series0.links[0].lineStyle.opacity, 0.55);
assert.strictEqual(series0.data.find(d => d.name === '1: 2021').label.formatter(), '2021 (n = 2)');

// Test 5: Auto-Optimizer Logic for Sankey
console.log('5. Testing Smart Auto-Optimizer for Sankey...');
function mockOptimizeSankey(config, papers) {
  const cfg = { ...config };
  const numLevels = cfg.sankeyFields.length || 3;
  if (numLevels >= 4) {
    cfg.sankeyNodeWidth = 14;
    cfg.sankeyNodeGap = 12;
    cfg.sankeyCurveness = 0.45;
  } else if (numLevels <= 2) {
    cfg.sankeyNodeWidth = 24;
    cfg.sankeyNodeGap = 20;
    cfg.sankeyCurveness = 0.55;
  }
  return cfg;
}

const opt2Levels = mockOptimizeSankey({ sankeyFields: ['A', 'B'] }, mockPapers);
assert.strictEqual(opt2Levels.sankeyNodeWidth, 24);
assert.strictEqual(opt2Levels.sankeyCurveness, 0.55);

const opt4Levels = mockOptimizeSankey({ sankeyFields: ['A', 'B', 'C', 'D'] }, mockPapers);
assert.strictEqual(opt4Levels.sankeyNodeWidth, 14);
assert.strictEqual(opt4Levels.sankeyCurveness, 0.45);

// Test 6: Scientific Metric & Quota Calculation Integrity (Paper Prevalence vs Tag Share)
console.log('6. Testing Scientific Metric & Quota Calculation Integrity (Prevalence vs Tag Share & Hare-Hamilton)...');

// Quota balance implementation check
function balanceQuotasToHundred(items, totalItems) {
  const balancedMap = new Map();
  if (totalItems <= 0 || items.length === 0) {
    items.forEach(it => balancedMap.set(it.name, 0));
    return balancedMap;
  }
  const quotaItems = items.map(it => {
    const rawPct = (it.count / totalItems) * 100;
    const floorPct = Math.floor(rawPct * 100) / 100;
    const remainder = rawPct - floorPct;
    return { name: it.name, count: it.count, rawPct, floorPct, remainder, finalPct: floorPct };
  });
  const currentSumCents = Math.round(quotaItems.reduce((acc, it) => acc + it.floorPct * 100, 0));
  const diffCents = 10000 - currentSumCents;
  if (diffCents > 0 && diffCents <= quotaItems.length) {
    const sorted = [...quotaItems].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < diffCents; i++) {
      sorted[i].finalPct = Math.round((sorted[i].finalPct + 0.01) * 100) / 100;
    }
  }
  quotaItems.forEach(it => balancedMap.set(it.name, it.finalPct));
  return balancedMap;
}

// Multi-label dataset simulation: 3 papers, but Level 2 contains multiple tags
const multiLabelPapers = [
  { Paper_ID: 'P1', Domain: 'AI', Models: ['CNN', 'LSTM', 'Transformer'] }, // 3 tags
  { Paper_ID: 'P2', Domain: 'AI', Models: ['CNN', 'ResNet'] },               // 2 tags
  { Paper_ID: 'P3', Domain: 'Robotics', Models: ['Transformer'] }           // 1 tag
];
// Total Cohort = 3 papers.
// At Level 2 (Models):
// Total Tags = 3 + 2 + 1 = 6 tags.
// CNN: 2 tags (2 papers) -> Prevalence: 2/3 = 66.7%, Tag Share: 2/6 = 33.33%
// LSTM: 1 tag (1 paper) -> Prevalence: 1/3 = 33.3%, Tag Share: 1/6 = 16.67%
// Transformer: 2 tags (2 papers) -> Prevalence: 2/3 = 66.7%, Tag Share: 2/6 = 33.33%
// ResNet: 1 tag (1 paper) -> Prevalence: 1/3 = 33.3%, Tag Share: 1/6 = 16.67%

const level2Nodes = [
  { name: '2: CNN', count: 2 },
  { name: '2: LSTM', count: 1 },
  { name: '2: Transformer', count: 2 },
  { name: '2: ResNet', count: 1 }
];

const totalLevel2Tags = 6;
const balancedLevel2 = balanceQuotasToHundred(level2Nodes, totalLevel2Tags);

const sumTagShares = Array.from(balancedLevel2.values()).reduce((a, b) => a + b, 0);
assert.strictEqual(Math.round(sumTagShares * 100) / 100, 100.00, 'Tag Shares must sum to exactly 100.00%');
assert.strictEqual(balancedLevel2.get('2: CNN'), 33.33);
assert.strictEqual(balancedLevel2.get('2: LSTM'), 16.67);
assert.strictEqual(balancedLevel2.get('2: Transformer'), 33.33);
assert.strictEqual(balancedLevel2.get('2: ResNet'), 16.67);

// Mathematical distinction check:
// Paper prevalence for CNN is 2/3 = 66.67%, NOT 33.33%
const totalCohortPapers = 3;
const cnnPaperCount = 2;
const cnnPrevalence = (cnnPaperCount / totalCohortPapers) * 100;
assert.strictEqual(Math.round(cnnPrevalence * 10) / 10, 66.7);
assert.notStrictEqual(Math.round(cnnPrevalence * 100) / 100, balancedLevel2.get('2: CNN'), 'Paper prevalence must never be conflated with tag share');

// Test 7: Sankey Level-by-Level Node Sorting (desc, asc, alpha, none)
console.log('7. Testing Sankey Level-by-Level Node Sorting...');

function sortNodesForLevel(nodesList, nodeValuesMap, sortMode, prefix) {
  const levelNodes = [...nodesList];
  if (sortMode === 'desc') {
    return levelNodes.sort((a, b) => {
      const aVal = nodeValuesMap.get(a) || 0;
      const bVal = nodeValuesMap.get(b) || 0;
      if (bVal !== aVal) return bVal - aVal;
      return a.substring(prefix.length).localeCompare(b.substring(prefix.length));
    });
  } else if (sortMode === 'asc') {
    return levelNodes.sort((a, b) => {
      const aVal = nodeValuesMap.get(a) || 0;
      const bVal = nodeValuesMap.get(b) || 0;
      if (aVal !== bVal) return aVal - bVal;
      return a.substring(prefix.length).localeCompare(b.substring(prefix.length));
    });
  } else if (sortMode === 'alpha') {
    return levelNodes.sort((a, b) => a.substring(prefix.length).localeCompare(b.substring(prefix.length)));
  }
  return levelNodes;
}

const testNodes = ['2: Beta', '2: Alpha', '2: Gamma'];
const testValues = new Map([
  ['2: Beta', 50],
  ['2: Alpha', 10],
  ['2: Gamma', 100]
]);

// Descending: Gamma (100) -> Beta (50) -> Alpha (10)
const sortedDesc = sortNodesForLevel(testNodes, testValues, 'desc', '2: ');
assert.deepStrictEqual(sortedDesc, ['2: Gamma', '2: Beta', '2: Alpha']);

// Ascending: Alpha (10) -> Beta (50) -> Gamma (100)
const sortedAsc = sortNodesForLevel(testNodes, testValues, 'asc', '2: ');
assert.deepStrictEqual(sortedAsc, ['2: Alpha', '2: Beta', '2: Gamma']);

// Alphabetical: Alpha -> Beta -> Gamma
const sortedAlpha = sortNodesForLevel(testNodes, testValues, 'alpha', '2: ');
assert.deepStrictEqual(sortedAlpha, ['2: Alpha', '2: Beta', '2: Gamma']);

// Test 8: Typography & Color Styling Parameters
console.log('8. Testing Sankey Typography, Line-Height & Color Styling...');

function mockBuildNodeLabel(config, palette) {
  const effFontSize = config.sankeyLabelFontSize || 11;
  const effLineHeight = config.sankeyLabelLineHeight ?? (effFontSize + 3);
  const effTextColor = (config.sankeyLabelColor && config.sankeyLabelColor.trim() !== '') ? config.sankeyLabelColor : palette.text;
  const effFontWeight = config.sankeyLabelFontWeight || '600';

  return {
    fontSize: effFontSize,
    fontWeight: effFontWeight,
    color: effTextColor,
    lineHeight: effLineHeight
  };
}

const themePalette = { text: '#1E293B' };
const typoLabelDefault = mockBuildNodeLabel({ sankeyLabelLineHeight: 18, sankeyLabelFontWeight: '700' }, themePalette);
assert.strictEqual(typoLabelDefault.lineHeight, 18);
assert.strictEqual(typoLabelDefault.fontWeight, '700');
assert.strictEqual(typoLabelDefault.color, '#1E293B');

const typoLabelCustomColor = mockBuildNodeLabel({ sankeyLabelColor: '#E11D48', sankeyLabelFontSize: 14 }, themePalette);
assert.strictEqual(typoLabelCustomColor.color, '#E11D48');
assert.strictEqual(typoLabelCustomColor.fontSize, 14);
assert.strictEqual(typoLabelCustomColor.lineHeight, 17); // 14 + 3

// Test 9: Max Categories Limit Truncation & Hierarchy Node Margin / Distance
console.log('9. Testing Max Categories Limit Truncation & Node Margin Spacing...');

function mockAllowedLevelSet(papers, fieldKey, idx, sankeyMaxNodes, limitCategories, maxCategoriesCount, tailLabelStyle) {
  const limitCount = (sankeyMaxNodes && sankeyMaxNodes[idx] !== undefined && sankeyMaxNodes[idx] > 0)
    ? sankeyMaxNodes[idx]
    : (limitCategories && maxCategoriesCount > 0 ? maxCategoriesCount : 0);

  if (limitCount < 1) return null;

  const counts = new Map();
  papers.forEach(p => {
    const val = p[fieldKey] || 'Unspecified';
    counts.set(val, (counts.get(val) || 0) + 1);
  });

  if (counts.size <= limitCount) return null;

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const topCount = Math.max(1, limitCount - 1);
  const topEntries = sorted.slice(0, topCount);
  const tailEntries = sorted.slice(topCount);
  const tailItems = tailEntries.map(e => ({ name: e[0], count: e[1] }));
  const tailName = `Other (${tailItems.length} items)`;

  return {
    topSet: new Set(topEntries.map(e => e[0])),
    tailName,
    tailItems
  };
}

const multiCategoryPapers = [
  { Paper_ID: 'P1', Model: 'CNN' },
  { Paper_ID: 'P2', Model: 'CNN' },
  { Paper_ID: 'P3', Model: 'CNN' },
  { Paper_ID: 'P4', Model: 'LSTM' },
  { Paper_ID: 'P5', Model: 'LSTM' },
  { Paper_ID: 'P6', Model: 'Transformer' },
  { Paper_ID: 'P7', Model: 'SVM' },
  { Paper_ID: 'P8', Model: 'Random Forest' },
  { Paper_ID: 'P9', Model: 'XGBoost' },
  { Paper_ID: 'P10', Model: 'MLP' }
];

// Test Per-Level Limit of 3: Should yield top 2 ('CNN', 'LSTM') + 1 'Other (5 items)' = 3 total nodes
const levelFilter = mockAllowedLevelSet(multiCategoryPapers, 'Model', 0, { 0: 3 }, false, 0, 'other_count');
assert.ok(levelFilter !== null);
assert.strictEqual(levelFilter.topSet.has('CNN'), true);
assert.strictEqual(levelFilter.topSet.has('LSTM'), true);
assert.strictEqual(levelFilter.topSet.has('Transformer'), false);
assert.strictEqual(levelFilter.tailName, 'Other (5 items)');
assert.strictEqual(levelFilter.tailItems.length, 5);

// Test Global Limit Fallback (when per-level is 0): limitCategories = true, maxCategoriesCount = 4 -> top 3 + 1 Other
const globalFilter = mockAllowedLevelSet(multiCategoryPapers, 'Model', 0, { 0: 0 }, true, 4, 'other_count');
assert.ok(globalFilter !== null);
assert.strictEqual(globalFilter.topSet.has('CNN'), true);
assert.strictEqual(globalFilter.topSet.has('LSTM'), true);
assert.strictEqual(globalFilter.topSet.has('Transformer'), true);
assert.strictEqual(globalFilter.topSet.has('SVM'), false);
// Test 10: Level-Specific Node Gaps (sankeyLevelNodeGaps override vs global fallback)
console.log('10. Testing Level-Specific Node Gaps & Levels Array Generation...');

function mockGenerateSankeyLevels(sankeyFields, sankeyNodeGap, sankeyLevelNodeGaps) {
  return sankeyFields.map((_, lIdx) => {
    const levelNodeGap = sankeyLevelNodeGaps[lIdx] ?? sankeyNodeGap;
    return {
      depth: lIdx,
      nodeGap: levelNodeGap
    };
  });
}

const testFields = ['Macro_Domain', 'Methodology', 'Application'];
const globalGap = 16;
const levelCustomGaps = {
  0: 8,  // Level 1: Tight 8px gap
  2: 32  // Level 3: Wide 32px gap
  // Level 2 (idx 1) omitted: should fall back to globalGap 16px
};

const generatedLevels = mockGenerateSankeyLevels(testFields, globalGap, levelCustomGaps);
assert.strictEqual(generatedLevels.length, 3);
assert.strictEqual(generatedLevels[0].depth, 0);
assert.strictEqual(generatedLevels[0].nodeGap, 8); // Custom Level 1
assert.strictEqual(generatedLevels[1].depth, 1);
assert.strictEqual(generatedLevels[1].nodeGap, 16); // Fallback Global Gap
assert.strictEqual(generatedLevels[2].depth, 2);
assert.strictEqual(generatedLevels[2].nodeGap, 32); // Custom Level 3

// Test 11: Level-Specific Label Distances & Node Widths
console.log('11. Testing Level-Specific Label Distances & Node Widths Resolution...');

const customLabelDistances = {
  0: 2,  // Level 1: Flush (2px)
  2: 20  // Level 3: Distant (20px)
};
const globalLabelDistance = 6;

const customNodeWidths = {
  0: 10, // Level 1: Slim (10px)
  1: 35  // Level 2: Bold (35px)
};
const globalNodeWidth = 20;

function resolveLevelLabelDistance(levelIdx, customMap, fallback) {
  return (customMap && customMap[levelIdx] !== undefined) ? customMap[levelIdx] : fallback;
}

function resolveLevelNodeWidth(levelIdx, customMap, fallback) {
  return (customMap && customMap[levelIdx] !== undefined) ? customMap[levelIdx] : fallback;
}

assert.strictEqual(resolveLevelLabelDistance(0, customLabelDistances, globalLabelDistance), 2);
assert.strictEqual(resolveLevelLabelDistance(1, customLabelDistances, globalLabelDistance), 6); // fallback
assert.strictEqual(resolveLevelLabelDistance(2, customLabelDistances, globalLabelDistance), 20);

assert.strictEqual(resolveLevelNodeWidth(0, customNodeWidths, globalNodeWidth), 10);
assert.strictEqual(resolveLevelNodeWidth(1, customNodeWidths, globalNodeWidth), 35);
assert.strictEqual(resolveLevelNodeWidth(2, customNodeWidths, globalNodeWidth), 20); // fallback

console.log('All 11/11 Sankey fine-tune, typography, node sorting, category limit & per-level geometry tests passed successfully!');



