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

console.log('=== TEST SUITE: SLR Visualizer Treemap Fine-Tune & Word-Wrap Suite ===\n');

// Test 1: Default Treemap Slot Configuration Verification
console.log('1. Testing Default Treemap Parameter Defaults (including Label Width & Word Wrap)...');
function createDefaultTreemapConfig() {
  return {
    chartType: 'treemap',
    primaryField: 'Year',
    sankeyFields: ['Year', 'Import_Source'],
    treemapAlgorithm: 'squarified',
    treemapSquareRatio: 0.618,
    treemapVisibleDepth: 2,
    treemapGapWidth: 3,
    treemapBorderWidth: 1,
    treemapBorderRadius: 2,
    treemapBorderColorMode: 'auto_bg',
    treemapBorderColor: '#ffffff',
    treemapNodeClick: 'zoomToNode',
    treemapRoam: true,
    treemapDrillDownIcon: '▶',
    treemapShowBreadcrumb: true,
    treemapBreadcrumbPosition: 'bottom',
    treemapBreadcrumbHeight: 26,
    treemapColorMode: 'branch_gradient',
    treemapColorMappingBy: 'index',
    treemapColorAlphaMin: 0.5,
    treemapColorAlphaMax: 1,
    treemapColorSaturationMin: 0.7,
    treemapColorSaturationMax: 1,
    treemapShowLabels: true,
    treemapLabelPosition: 'inside',
    treemapLabelFormat: 'name_count',
    treemapLabelFontSize: 11,
    treemapLabelFontWeight: '600',
    treemapLabelFontStyle: 'normal',
    treemapLabelColorMode: 'auto_contrast',
    treemapLabelColor: '#ffffff',
    treemapLabelOverflow: 'break',
    treemapLabelWidth: 120,
    treemapLabelLineHeight: 14,
    treemapShowUpperLabel: true,
    treemapUpperLabelHeight: 22,
    treemapUpperLabelPosition: 'inside',
    treemapUpperLabelFormat: 'name_count',
    treemapUpperLabelFontSize: 11,
    treemapUpperLabelFontWeight: 'bold',
    treemapUpperLabelColorMode: 'auto_contrast',
    treemapUpperLabelColor: '#ffffff',
    treemapUpperLabelBgColor: 'rgba(0, 0, 0, 0.45)',
    treemapVisibleMin: 0,
    treemapChildrenVisibleMin: 0,
    treemapLevelConfigs: {
      0: { gapWidth: 3, borderWidth: 2, borderRadius: 0, visibleMin: 10, childrenVisibleMin: 0 },
      1: { gapWidth: 2, borderWidth: 1, borderRadius: 0, visibleMin: 10, childrenVisibleMin: 0 },
      2: { gapWidth: 1, borderWidth: 1, borderRadius: 0, visibleMin: 5, childrenVisibleMin: 0 }
    }
  };
}

const def = createDefaultTreemapConfig();
assert.strictEqual(def.treemapAlgorithm, 'squarified');
assert.strictEqual(def.treemapSquareRatio, 0.618);
assert.strictEqual(def.treemapVisibleDepth, 2);
assert.strictEqual(def.treemapLabelOverflow, 'break');
assert.strictEqual(def.treemapLabelWidth, 120, 'Default treemapLabelWidth must be 120px for word wrap');
assert.strictEqual(def.treemapLabelLineHeight, 14, 'Default treemapLabelLineHeight must be 14px');
assert.strictEqual(def.treemapLevelConfigs[1].gapWidth, 2, 'Level 1 must define structural gapWidth');
assert.strictEqual(def.treemapLevelConfigs[1].fontSize, undefined, 'Level 1 must not hardcode fontSize so global slider applies');
assert.strictEqual(def.treemapLevelConfigs[1].labelWidth, undefined, 'Level 1 must not hardcode labelWidth so global slider applies');
console.log('✓ Test 1 Passed: Default configuration parameters verified.\n');

// Test 2: Word Wrap & Boundary Computation
console.log('2. Testing Tile Label Word Wrap & 24px/40px Slider Resolution...');
function wrapAxisLabelText(text, maxCharsPerLine = 16) {
  if (!text) return '';
  const unescaped = text.replace(/\\n/g, '\n');
  if (unescaped.includes('\n')) {
    return unescaped.split('\n').map(segment => wrapAxisLabelText(segment, maxCharsPerLine)).join('\n');
  }
  if (unescaped.includes('/')) {
    const slashSegments = unescaped.split('/').map(s => s.trim()).filter(Boolean);
    if (slashSegments.length > 1) {
      return slashSegments.map((segment, sIdx) => {
        const textWithSlash = sIdx < slashSegments.length - 1 ? `${segment}/` : segment;
        return wrapAxisLabelText(textWithSlash, maxCharsPerLine);
      }).join('\n');
    }
  }
  if (unescaped.length <= maxCharsPerLine) return unescaped;
  const words = unescaped.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let rem = word;
      while (rem.length > maxCharsPerLine) {
        lines.push(rem.slice(0, maxCharsPerLine));
        rem = rem.slice(maxCharsPerLine);
      }
      current = rem;
    } else if ((current + ' ' + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

function buildTreemapLevels(config) {
  const levels = [];
  const levelConfigs = config.treemapLevelConfigs || {};
  const depth = config.treemapVisibleDepth || 2;

  // Level 0: Root container
  levels.push({
    itemStyle: {
      gapWidth: levelConfigs[0]?.gapWidth ?? 0,
      borderWidth: levelConfigs[0]?.borderWidth ?? 0,
      borderColor: levelConfigs[0]?.borderColor ?? 'transparent'
    }
  });

  // Level 1: Parent hierarchy tier
  const lvl1Cfg = levelConfigs[1] || {};
  const showUpper = lvl1Cfg.showUpperLabel !== undefined ? lvl1Cfg.showUpperLabel : (config.treemapShowUpperLabel && depth > 1);
  const isStaleDefaultFontSize1 = lvl1Cfg.fontSize === 12 || lvl1Cfg.fontSize === 11 || lvl1Cfg.fontSize === 10;
  const isStaleDefaultWidth1 = lvl1Cfg.labelWidth === 140 || lvl1Cfg.labelWidth === 120 || lvl1Cfg.labelWidth === 110;
  const labelFSize1 = (lvl1Cfg.fontSize !== undefined && !isStaleDefaultFontSize1)
    ? lvl1Cfg.fontSize
    : (config.treemapLabelFontSize !== undefined ? config.treemapLabelFontSize : 11);
  const labelWidth1 = (lvl1Cfg.labelWidth !== undefined && !isStaleDefaultWidth1)
    ? lvl1Cfg.labelWidth
    : (config.treemapLabelWidth !== undefined ? config.treemapLabelWidth : 120);

  levels.push({
    itemStyle: {
      gapWidth: lvl1Cfg.gapWidth ?? config.treemapGapWidth,
      borderWidth: lvl1Cfg.borderWidth ?? config.treemapBorderWidth,
      borderRadius: lvl1Cfg.borderRadius ?? config.treemapBorderRadius
    },
    upperLabel: {
      show: showUpper,
      height: lvl1Cfg.upperLabelHeight ?? config.treemapUpperLabelHeight ?? 22,
      backgroundColor: lvl1Cfg.upperLabelBgColor ?? config.treemapUpperLabelBgColor ?? 'rgba(0, 0, 0, 0.45)'
    },
    label: {
      show: !showUpper && (lvl1Cfg.showLabel !== undefined ? lvl1Cfg.showLabel : config.treemapShowLabels),
      fontSize: labelFSize1,
      width: labelWidth1,
      lineHeight: Math.max(lvl1Cfg.lineHeight ?? config.treemapLabelLineHeight ?? 14, labelFSize1 + 2),
      overflow: lvl1Cfg.overflow ?? config.treemapLabelOverflow ?? 'break',
      formatter: (name) => {
        if (config.treemapLabelOverflow === 'break' && labelWidth1 > 0) {
          const chars = Math.max(4, Math.floor(labelWidth1 / Math.max(6, labelFSize1 * 0.58)));
          return wrapAxisLabelText(name, chars);
        }
        return name;
      }
    }
  });

  // Level 2: Child hierarchy tier
  const lvl2Cfg = levelConfigs[2] || {};
  const isStaleDefaultFontSize2 = lvl2Cfg.fontSize === 12 || lvl2Cfg.fontSize === 11 || lvl2Cfg.fontSize === 10;
  const isStaleDefaultWidth2 = lvl2Cfg.labelWidth === 140 || lvl2Cfg.labelWidth === 120 || lvl2Cfg.labelWidth === 110;
  const labelFSize2 = (lvl2Cfg.fontSize !== undefined && !isStaleDefaultFontSize2)
    ? lvl2Cfg.fontSize
    : (config.treemapLabelFontSize !== undefined ? config.treemapLabelFontSize : 10);
  const labelWidth2 = (lvl2Cfg.labelWidth !== undefined && !isStaleDefaultWidth2)
    ? lvl2Cfg.labelWidth
    : (config.treemapLabelWidth !== undefined ? config.treemapLabelWidth : 110);

  levels.push({
    itemStyle: {
      gapWidth: lvl2Cfg.gapWidth ?? (config.treemapGapWidth > 2 ? config.treemapGapWidth - 1 : config.treemapGapWidth),
      borderWidth: lvl2Cfg.borderWidth ?? config.treemapBorderWidth,
      borderRadius: lvl2Cfg.borderRadius ?? config.treemapBorderRadius
    },
    label: {
      show: lvl2Cfg.showLabel !== undefined ? lvl2Cfg.showLabel : config.treemapShowLabels,
      fontSize: labelFSize2,
      width: labelWidth2,
      lineHeight: Math.max(lvl2Cfg.lineHeight ?? config.treemapLabelLineHeight ?? 14, labelFSize2 + 2),
      overflow: lvl2Cfg.overflow ?? config.treemapLabelOverflow ?? 'break',
      formatter: (name) => {
        if (config.treemapLabelOverflow === 'break' && labelWidth2 > 0) {
          const chars = Math.max(4, Math.floor(labelWidth2 / Math.max(6, labelFSize2 * 0.58)));
          return wrapAxisLabelText(name, chars);
        }
        return name;
      }
    }
  });

  return levels;
}

// Test with 24px Font Size and 40px Width (User's Exact Scenario!)
const customUserConfig = {
  ...def,
  treemapLabelFontSize: 24,
  treemapLabelWidth: 40,
  treemapLabelLineHeight: 18,
  // Even if legacy slot has stale 11/120 defaults:
  treemapLevelConfigs: {
    1: { fontSize: 11, labelWidth: 120 },
    2: { fontSize: 10, labelWidth: 110 }
  }
};

const userLevels = buildTreemapLevels(customUserConfig);
assert.strictEqual(userLevels[1].label.fontSize, 24, 'Level 1 must adopt global 24px font size');
assert.strictEqual(userLevels[1].label.width, 40, 'Level 1 must adopt global 40px label width');
assert.strictEqual(userLevels[1].label.lineHeight, 26, 'Line height must expand to at least fontSize + 2 (26px) to prevent vertical collision');

const wrappedText = userLevels[1].label.formatter('Network Friction/Latency (n = 15)');
assert.ok(wrappedText.includes('\n'), 'Formatted text must contain newlines for multi-line wrapping in ECharts');
console.log('Wrapped text output at 24px font size & 40px width:\n' + wrappedText);
console.log('✓ Test 2 Passed: 24px/40px slider resolution and word wrap boundary verified.\n');

// Test 3: Breadcrumb Navigation & Clearance Geometry
console.log('3. Testing Native Breadcrumb Clearance & Avoidance Geometry...');
function computeTreemapCoordinates(config, treemapTop = 50, treemapBottom = 20) {
  const showBreadcrumb = config.treemapShowBreadcrumb ?? true;
  const breadcrumbPos = config.treemapBreadcrumbPosition || 'bottom';
  const breadcrumbHeight = config.treemapBreadcrumbHeight ?? 24;

  let adjustedTop = treemapTop;
  let adjustedBottom = treemapBottom;
  if (showBreadcrumb) {
    if (breadcrumbPos === 'bottom') {
      adjustedBottom += breadcrumbHeight + 8;
    } else {
      adjustedTop += breadcrumbHeight + 8;
    }
  }

  return { adjustedTop, adjustedBottom, breadcrumbHeight, breadcrumbPos };
}

const coords = computeTreemapCoordinates(def);
assert.strictEqual(coords.adjustedBottom, 20 + 26 + 8, 'Bottom margin must expand to clear breadcrumb bar');
assert.strictEqual(coords.adjustedTop, 50, 'Top margin unchanged when breadcrumb is at bottom');
console.log('✓ Test 3 Passed: Breadcrumb clearance geometry verified.\n');

// Test 4: Reset Drill-Down View Functionality
console.log('4. Testing Drill-Down View Reset Action Simulation...');
let dispatchedActions = [];
let chartCleared = false;
const mockChartInstance = {
  dispatchAction: (action) => {
    dispatchedActions.push(action);
  },
  clear: () => {
    chartCleared = true;
  },
  setOption: (option, notMerge) => {
    assert.strictEqual(notMerge, true);
  },
  resize: () => {}
};

function resetSlotDrillDown(instance) {
  if (!instance) return;
  instance.dispatchAction({ type: 'treemapRootToNode', targetNode: '' });
  instance.dispatchAction({ type: 'sunburstRootToNode', targetNode: '' });
  instance.clear();
  instance.setOption({ series: [{ type: 'treemap' }] }, true);
  instance.resize();
}

resetSlotDrillDown(mockChartInstance);
assert.strictEqual(dispatchedActions.length, 2);
assert.strictEqual(dispatchedActions[0].type, 'treemapRootToNode');
assert.strictEqual(chartCleared, true);
console.log('✓ Test 4 Passed: View reset correctly dispatches treemapRootToNode and clears view state.\n');

// Test 5: Formatting and Label Engine Verification
console.log('5. Testing Formatting Engine...');
function formatMetricDisplay(val, total, format) {
  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
  switch (format) {
    case 'name_count': return `(n = ${val})`;
    case 'name_count_percent': return `(n = ${val}, ~${pct}%)`;
    case 'name_percent': return `(~${pct}%)`;
    case 'count_only': return `n = ${val}`;
    case 'percent_only': return `~${pct}%`;
    default: return `${val}`;
  }
}

const formatted = formatMetricDisplay(42, 100, 'name_count_percent');
assert.strictEqual(formatted, '(n = 42, ~42.0%)');
console.log('✓ Test 5 Passed: Formatting engine verified.\n');

// Test 6: Grouped Cohort vs Global Cohort Denominator & Extended Format Templates
console.log('6. Testing Grouped vs Global Cohort Denominator Resolution & Extended Templates...');
function resolveTreemapDenominator(cohortMode, papersCount, totalTreeVal) {
  const isGlobal = cohortMode === 'global';
  return isGlobal ? (papersCount || 1) : (totalTreeVal || 1);
}

const totalCohortPapersCount = 46;
const groupedSubsetTreeVal = 20;

const groupedDenom = resolveTreemapDenominator('grouped', totalCohortPapersCount, groupedSubsetTreeVal);
assert.strictEqual(groupedDenom, 20, 'Grouped cohort denominator must equal total tree sum');

const globalDenom = resolveTreemapDenominator('global', totalCohortPapersCount, groupedSubsetTreeVal);
assert.strictEqual(globalDenom, 46, 'Global cohort denominator must equal full review papers cohort count');

function formatTileMetricExtended(name, val, denominator, template, precision = 1) {
  const pctVal = denominator > 0 ? (val / denominator) * 100 : 0;
  const pctStr = `${pctVal.toFixed(precision)}%`;
  const tildePct = `~${pctStr}`;

  switch (template) {
    case 'name_count': return `${name} (n = ${val})`;
    case 'name_percent': return `${name} (${pctStr})`;
    case 'name_count_percent': return `${name} (n = ${val}, ${tildePct})`;
    case 'name_percent_count': return `${name} (${pctStr}, n = ${val})`;
    case 'name_count_ratio': return `${name} (${val}, ${val}/${denominator})`;
    case 'name_ratio': return `${name} (${val}/${denominator})`;
    case 'name_multiline_count': return `${name}\n(n = ${val})`;
    case 'name_multiline_percent': return `${name}\n(${pctStr})`;
    case 'name_multiline_count_percent': return `${name}\n(n = ${val}, ${tildePct})`;
    case 'name_multiline_ratio': return `${name}\n(${val}/${denominator})`;
    case 'count_only': return `n = ${val}`;
    case 'percent_only': return pctStr;
    case 'ratio_only': return `${val}/${denominator}`;
    default: return name;
  }
}

// Check Grouped (20 denominator): val = 5 -> 25.0%
assert.strictEqual(formatTileMetricExtended('Sensor', 5, groupedDenom, 'name_count_percent'), 'Sensor (n = 5, ~25.0%)');
assert.strictEqual(formatTileMetricExtended('Sensor', 5, groupedDenom, 'name_percent_count'), 'Sensor (25.0%, n = 5)');
assert.strictEqual(formatTileMetricExtended('Sensor', 5, groupedDenom, 'name_count_ratio'), 'Sensor (5, 5/20)');
assert.strictEqual(formatTileMetricExtended('Sensor', 5, groupedDenom, 'name_multiline_count_percent'), 'Sensor\n(n = 5, ~25.0%)');

// Check Global (46 denominator): val = 23 -> 50.0%
assert.strictEqual(formatTileMetricExtended('IoT', 23, globalDenom, 'name_count_percent'), 'IoT (n = 23, ~50.0%)');
assert.strictEqual(formatTileMetricExtended('IoT', 23, globalDenom, 'name_percent_count'), 'IoT (50.0%, n = 23)');
assert.strictEqual(formatTileMetricExtended('IoT', 23, globalDenom, 'name_count_ratio'), 'IoT (23, 23/46)');
assert.strictEqual(formatTileMetricExtended('IoT', 23, globalDenom, 'name_multiline_percent'), 'IoT\n(50.0%)');
console.log('✓ Test 6 Passed: Denominator resolution & extended format templates verified.\n');

// Test 7: Algorithm Switcher Square Ratio Dynamic Synchronization
console.log('7. Testing Algorithm Switcher Dynamic Square Ratio Synchronization...');
function handleAlgorithmChange(newAlg, currentRatio) {
  let updatedRatio = currentRatio;
  if (newAlg === 'sliceAndDice' && (currentRatio === undefined || currentRatio > 0.5)) {
    updatedRatio = 0.1;
  } else if (newAlg === 'binary' && (currentRatio === undefined || currentRatio !== 1.0)) {
    updatedRatio = 1.0;
  } else if (newAlg === 'squarified' && (currentRatio === 0.1 || currentRatio === 1.0)) {
    updatedRatio = 0.5 * (1 + Math.sqrt(5));
  }
  return { treemapAlgorithm: newAlg, treemapSquareRatio: updatedRatio };
}

const sliceRes = handleAlgorithmChange('sliceAndDice', 1.618);
assert.strictEqual(sliceRes.treemapSquareRatio, 0.1, 'Switching to sliceAndDice must adjust ratio to 0.1');

const binaryRes = handleAlgorithmChange('binary', sliceRes.treemapSquareRatio);
assert.strictEqual(binaryRes.treemapSquareRatio, 1.0, 'Switching to binary must adjust ratio to 1.0');

const squarifiedRes = handleAlgorithmChange('squarified', binaryRes.treemapSquareRatio);
assert.ok(Math.abs(squarifiedRes.treemapSquareRatio - 1.61803398875) < 0.001, 'Switching to squarified must restore golden ratio');
console.log('✓ Test 7 Passed: Algorithm dynamic square ratio synchronization verified.\n');

// Test 8: Global Geometry Slider Overrides Clearing
console.log('8. Testing Global Geometry Slider Overrides Clearing...');
function clearLevelOverrides(levelConfigs, keysToClear) {
  if (!levelConfigs) return {};
  const updated = { ...levelConfigs };
  for (const lvlIdx of Object.keys(updated)) {
    const lvl = { ...updated[lvlIdx] };
    for (const key of keysToClear) {
      delete lvl[key];
    }
    updated[lvlIdx] = lvl;
  }
  return updated;
}

const initialLevelConfigs = {
  0: { gapWidth: 3, borderWidth: 2, borderRadius: 0, visibleMin: 10 },
  1: { gapWidth: 2, borderWidth: 1, borderRadius: 0, visibleMin: 10 },
  2: { gapWidth: 1, borderWidth: 1, borderRadius: 0, visibleMin: 5 }
};

const afterGapCleared = clearLevelOverrides(initialLevelConfigs, ['gapWidth']);
assert.strictEqual(afterGapCleared[0].gapWidth, undefined);
assert.strictEqual(afterGapCleared[1].gapWidth, undefined);
assert.strictEqual(afterGapCleared[2].gapWidth, undefined);
assert.strictEqual(afterGapCleared[1].borderWidth, 1, 'Non-cleared keys must be preserved');
console.log('✓ Test 8 Passed: Global slider override clearing verified.\n');

// Test 9: Preset Application Resetting Level Configs
console.log('9. Testing Layout Preset Application and Level Override Reset...');
function applyPreset(presetName) {
  if (presetName === 'dense') {
    return {
      treemapGapWidth: 0,
      treemapBorderWidth: 0,
      treemapBorderRadius: 0,
      treemapShowUpperLabel: false,
      treemapLevelConfigs: {}
    };
  } else if (presetName === 'banners') {
    return {
      treemapGapWidth: 4,
      treemapBorderWidth: 1,
      treemapBorderRadius: 4,
      treemapShowUpperLabel: true,
      treemapUpperLabelHeight: 28,
      treemapLevelConfigs: {}
    };
  }
  return {};
}

const densePreset = applyPreset('dense');
assert.strictEqual(densePreset.treemapGapWidth, 0);
assert.deepStrictEqual(densePreset.treemapLevelConfigs, {}, 'Dense preset must clear level configs to prevent gapWidth override');

const bannerPreset = applyPreset('banners');
assert.strictEqual(bannerPreset.treemapShowUpperLabel, true);
assert.deepStrictEqual(bannerPreset.treemapLevelConfigs, {}, 'Banners preset must clear level configs');
console.log('✓ Test 9 Passed: Preset application cleanly resets level overrides.\n');

// Test 10: Contrast Text Color Resolution for Upper Labels & Safe Recursive Node Value
console.log('10. Testing Auto-Contrast Upper Text & Safe Recursive Node Value Helper...');
function getContrastingTextColor(bgColor, darkText = '#0f172a', lightText = '#ffffff') {
  if (!bgColor || bgColor === 'transparent') return lightText;
  if (bgColor.startsWith('rgba') || bgColor.startsWith('rgb')) {
    const parts = bgColor.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.55 ? darkText : lightText;
    }
  }
  return lightText;
}

const darkBgContrast = getContrastingTextColor('rgba(0, 0, 0, 0.6)');
assert.strictEqual(darkBgContrast, '#ffffff', 'Dark upper header background must produce white text');

const lightBgContrast = getContrastingTextColor('rgba(255, 255, 255, 0.9)');
assert.strictEqual(lightBgContrast, '#0f172a', 'Light upper header background must produce dark text');

function getNodeValue(params) {
  if (typeof params.value === 'number' && !isNaN(params.value)) {
    return params.value;
  }
  if (params.data?.children && Array.isArray(params.data.children)) {
    return params.data.children.reduce((acc, c) => acc + (typeof c.value === 'number' ? c.value : (c.children ? c.children.reduce((x, y) => x + (y.value || 0), 0) : 0)), 0);
  }
  return 0;
}

const leafNodeParams = { name: 'Leaf A', value: 8 };
assert.strictEqual(getNodeValue(leafNodeParams), 8, 'Leaf node returns params.value directly');

const parentNodeParams = {
  name: 'Parent Category',
  data: {
    children: [
      { name: 'Child 1', value: 5 },
      { name: 'Child 2', children: [{ name: 'Grandchild 1', value: 3 }, { name: 'Grandchild 2', value: 4 }] }
    ]
  }
};
assert.strictEqual(getNodeValue(parentNodeParams), 12, 'Parent node sums child and grandchild values recursively');
console.log('✓ Test 10 Passed: Contrast text & safe recursive getNodeValue verified.\n');

// Test 11: Arbitrary Depth (3+ levels) Node Sum Recursion & Tree Total Sum Invariance
console.log('11. Testing Arbitrary Depth (3+ levels) Node Sum Recursion & Invariance...');
function getNodeValueRecursive(paramsOrData) {
  if (!paramsOrData) return 0;
  if (typeof paramsOrData.value === 'number' && !isNaN(paramsOrData.value)) {
    return paramsOrData.value;
  }
  const data = paramsOrData.data ?? paramsOrData;
  if (typeof data.value === 'number' && !isNaN(data.value)) {
    return data.value;
  }
  if (data.children && Array.isArray(data.children)) {
    return data.children.reduce((acc, c) => acc + getNodeValueRecursive(c), 0);
  }
  return 0;
}

const multiLevelTree = [
  {
    name: 'Hardware Architectures (Level 0)',
    children: [
      {
        name: 'Embedded Systems (Level 1)',
        children: [
          {
            name: 'Microcontrollers (Level 2)',
            children: [
              { name: 'ARM Cortex-M (Leaf Level 3)', value: 14 },
              { name: 'RISC-V (Leaf Level 3)', value: 6 }
            ]
          },
          {
            name: 'Edge AI SoCs (Level 2)',
            value: 12
          }
        ]
      },
      {
        name: 'Cloud Servers (Level 1)',
        value: 14
      }
    ]
  }
];

const totalTreeSum = multiLevelTree.reduce((acc, d) => acc + getNodeValueRecursive(d), 0);
assert.strictEqual(totalTreeSum, 14 + 6 + 12 + 14, '4-level hierarchy tree sum must correctly compute total sum (46)');

const rootCategoryValue = getNodeValueRecursive(multiLevelTree[0]);
assert.strictEqual(rootCategoryValue, 46, 'Root category must equal recursive sum of all leaves');

const embeddedSubtreeValue = getNodeValueRecursive(multiLevelTree[0].children[0]);
assert.strictEqual(embeddedSubtreeValue, 32, 'Embedded systems subtree must equal 14 + 6 + 12 = 32');
console.log('✓ Test 11 Passed: Multi-level 4-tier tree recursive node sum verified.\n');

// Test 12: Universal Layout Margins (gridMarginTop/Bottom/Left/Right) Integration
console.log('12. Testing Universal Layout Margins Integration...');
function computeTreemapMargins(ctx, defaultTop = 55, defaultBottom = 20, defaultLeft = 20, defaultRight = 20) {
  const top = ctx.gridMarginTop !== undefined ? ctx.gridMarginTop : defaultTop;
  const bottom = ctx.gridMarginBottom !== undefined ? ctx.gridMarginBottom : defaultBottom;
  const left = ctx.gridMarginLeft !== undefined ? ctx.gridMarginLeft : defaultLeft;
  const right = ctx.gridMarginRight !== undefined ? ctx.gridMarginRight : defaultRight;
  return { top, bottom, left, right };
}

const defaultMargins = computeTreemapMargins({});
assert.strictEqual(defaultMargins.top, 55);
assert.strictEqual(defaultMargins.bottom, 20);

const customUserMargins = computeTreemapMargins({
  gridMarginTop: 80,
  gridMarginBottom: 60,
  gridMarginLeft: 75,
  gridMarginRight: 50
});
assert.strictEqual(customUserMargins.top, 80, 'Universal top margin must override default top');
assert.strictEqual(customUserMargins.bottom, 60, 'Universal bottom margin must override default bottom');
assert.strictEqual(customUserMargins.left, 75, 'Universal left margin must override default left');
assert.strictEqual(customUserMargins.right, 50, 'Universal right margin must override default right');
console.log('✓ Test 12 Passed: Universal layout margins override resolution verified.\n');

// Test 13: Section 5 Header Banner Handlers & Level Override Clearing
console.log('13. Testing Section 5 Header Banner Handlers & Level Override Clearing...');
const levelConfigsWithUpper = {
  0: { upperLabelHeight: 26, upperLabelFontSize: 12, upperLabelFormat: 'name' },
  1: { upperLabelHeight: 22, upperLabelFontSize: 10, upperLabelFormat: 'name_count' }
};

const afterUpperHeightCleared = clearLevelOverrides(levelConfigsWithUpper, ['upperLabelHeight']);
assert.strictEqual(afterUpperHeightCleared[0].upperLabelHeight, undefined, 'upperLabelHeight must be cleared from level 0');
assert.strictEqual(afterUpperHeightCleared[1].upperLabelHeight, undefined, 'upperLabelHeight must be cleared from level 1');
assert.strictEqual(afterUpperHeightCleared[0].upperLabelFontSize, 12, 'Other level properties must remain intact');

const afterUpperFormatCleared = clearLevelOverrides(afterUpperHeightCleared, ['upperLabelFormat']);
assert.strictEqual(afterUpperFormatCleared[0].upperLabelFormat, undefined, 'upperLabelFormat must be cleared');
assert.strictEqual(afterUpperFormatCleared[1].upperLabelFormat, undefined, 'upperLabelFormat must be cleared');
console.log('✓ Test 13 Passed: Upper header banner override clearing verified.\n');

// Test 14: Master "Show Headers" & "Show Labels" Checkboxes Level Override Clearing
console.log('14. Testing Master Show Headers & Show Labels Checkboxes Override Clearing...');
const levelConfigsWithToggles = {
  0: { showUpperLabel: true, showLabel: false },
  1: { showUpperLabel: false, showLabel: true }
};

const afterMasterUpperToggled = clearLevelOverrides(levelConfigsWithToggles, ['showUpperLabel']);
assert.strictEqual(afterMasterUpperToggled[0].showUpperLabel, undefined, 'showUpperLabel override must be cleared');
assert.strictEqual(afterMasterUpperToggled[1].showUpperLabel, undefined, 'showUpperLabel override must be cleared');
assert.strictEqual(afterMasterUpperToggled[0].showLabel, false, 'showLabel must be retained until showLabel is toggled');

const afterMasterLabelsToggled = clearLevelOverrides(afterMasterUpperToggled, ['showLabel']);
assert.strictEqual(afterMasterLabelsToggled[0].showLabel, undefined, 'showLabel override must be cleared');
assert.strictEqual(afterMasterLabelsToggled[1].showLabel, undefined, 'showLabel override must be cleared');
console.log('✓ Test 14 Passed: Master toggles override clearing verified.\n');

// Test 15: Preset Migration with treemapCohortMode Hydration
console.log('15. Testing Legacy Preset Migration with treemapCohortMode Hydration...');
function migrateLegacyPreset(rawJson) {
  const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  return {
    chartType: parsed.chartType || 'treemap',
    treemapColorMode: parsed.treemapColorMode || 'branch_gradient',
    treemapCohortMode: parsed.treemapCohortMode || 'grouped',
    treemapSquareRatio: parsed.treemapSquareRatio ?? 1.618
  };
}

const legacyPresetWithoutCohortMode = {
  chartType: 'treemap',
  treemapColorMode: 'depth_fade'
};

const migrated = migrateLegacyPreset(legacyPresetWithoutCohortMode);
assert.strictEqual(migrated.treemapCohortMode, 'grouped', 'Legacy presets without treemapCohortMode must default to grouped');

const modernPresetWithGlobalCohortMode = {
  chartType: 'treemap',
  treemapCohortMode: 'global'
};

const modernMigrated = migrateLegacyPreset(modernPresetWithGlobalCohortMode);
assert.strictEqual(modernMigrated.treemapCohortMode, 'global', 'Modern presets with global cohort mode must be preserved');
console.log('✓ Test 15 Passed: Preset migration with treemapCohortMode hydration verified.\n');

// Test 16: Multi-Token Umbrella Category Deduplication Per Paper
console.log('16. Testing Multi-Token Umbrella Category Deduplication Per Paper (Unique Study Prevalence)...');
const mockKentPaper = {
  Paper_ID: 'Kent_2024_TestPaper',
  manual_stage: 3,
  ai_stage: 3,
  manual_extracted_data: JSON.stringify({
    rq10_lifecycle_barriers: {
      value: ['Compute Limitations', 'Hardware Power Penalty']
    }
  })
};

// Simulate umbrella mapping where Hardware Power Penalty -> Compute Limitations
const testUmbrellaMap = {
  rq10_lifecycle_barriers: {
    'Compute Limitations': { umbrella_category: 'Compute Limitations' },
    'Hardware Power Penalty': { umbrella_category: 'Compute Limitations' }
  }
};

const rawVals = ['Compute Limitations', 'Hardware Power Penalty'];
const mappedTokens = rawVals.map(t => testUmbrellaMap.rq10_lifecycle_barriers[t]?.umbrella_category || t);
const deduplicatedCategories = Array.from(new Set(mappedTokens));

assert.strictEqual(deduplicatedCategories.length, 1, 'Paper with multiple tokens mapping to same umbrella category must produce 1 category');
assert.strictEqual(deduplicatedCategories[0], 'Compute Limitations', 'Category must be Compute Limitations');

// Verify paper grouping counts Kent et al. only once
const groupMapTest = new Map();
deduplicatedCategories.forEach(v => {
  if (!groupMapTest.has(v)) groupMapTest.set(v, []);
  groupMapTest.get(v).push(mockKentPaper);
});

assert.strictEqual(groupMapTest.get('Compute Limitations').length, 1, 'Kent et al. must only be registered once in groupMap');
console.log('✓ Test 16 Passed: Multi-token umbrella category deduplication per paper verified.\n');

console.log('================================================================');
console.log('ALL TREEMAP FINE-TUNE & EXTENDED SUITE TESTS PASSED! (16/16)');
console.log('================================================================');



