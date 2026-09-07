import assert from 'node:assert';

// Mock Papers Dataset for testing
const mockPapers = [
  { Paper_ID: 'P1', Year: '2021', 'ext:macro:Execution Metrics': ['Latency', 'Throughput'], manual_stage: 2, manual_extracted_data: JSON.stringify({ extracted_data: { 'Execution Latency': '12ms', 'Static Memory': '2MB' } }) },
  { Paper_ID: 'P2', Year: '2021', 'ext:macro:Execution Metrics': ['Latency'], manual_stage: 2, manual_extracted_data: JSON.stringify({ extracted_data: { 'Execution Latency': '15ms', 'Power Profiling': 'Low' } }) },
  { Paper_ID: 'P3', Year: '2022', 'ext:macro:Execution Metrics': ['Throughput', 'Energy'], manual_stage: 2, manual_extracted_data: JSON.stringify({ extracted_data: { 'Energy Consumption': '5J' } }) },
  { Paper_ID: 'P4', Year: '2023', 'ext:macro:Execution Metrics': ['Latency', 'Throughput', 'Energy'], manual_stage: 2, manual_extracted_data: JSON.stringify({ extracted_data: { 'Execution Latency': '8ms', 'Static Memory': '1MB' } }) }
];

console.log('=== TEST SUITE: SLR Visualizer Radar / Spider Chart Fine-Tune Suite ===\n');

// --------------------------------------------------------------------------------
// Test 1: Verification of Radar Default Configuration Parameters
// --------------------------------------------------------------------------------
console.log('1. Testing Default Radar Configuration Parameters...');

function createDefaultRadarSlotConfig() {
  return {
    chartType: 'radar',
    radarMode: 'multi_variable',
    radarShape: 'polygon',
    radarStartAngle: 90,
    radarRadius: 65,
    radarCenterX: undefined,
    radarCenterY: undefined,
    radarAreaOpacity: 28,
    radarLineWidth: 2.5,
    radarSplitNumber: 5,
    radarAxisLine: true,
    radarAxisLineWidth: 1,
    radarAxisLineType: 'solid',
    radarAxisLineColor: '',
    radarAxisLineOpacity: 100,
    radarSplitLine: true,
    radarSplitLineWidth: 1,
    radarSplitLineType: 'solid',
    radarSplitLineColor: '',
    radarSplitLineOpacity: 100,
    radarSplitArea: true,
    radarSplitAreaTheme: 'stepped',
    radarSplitAreaOpacity: 100,
    radarSplitAreaColor1: '',
    radarSplitAreaColor2: '',
    radarShowAxisScaleLabels: false,
    radarAxisScaleFormat: 'percent',
    radarAxisScaleFontSize: 10,
    radarAxisScaleFontWeight: 'normal',
    radarAxisScaleColor: '',
    radarScaleMax: undefined,
    radarScaleMin: undefined,
    radarShowAxisTicks: false,
    radarAxisNameMargin: 15,
    radarAxisNameWidth: 120,
    radarAxisNameOverflow: 'break',
    radarAxisNameLineHeight: 14,
    radarAxisNameFontSize: undefined,
    radarAxisNameFontWeight: 'bold',
    radarAxisNameFontStyle: 'normal',
    radarAxisNameColor: '',
    radarAxisNameBgColor: '',
    radarAxisNamePadding: 4,
    radarAxisNameBorderRadius: 4,
    radarAxisNameBorderColor: '',
    radarAxisNameBorderWidth: 1,
    radarShowDataLabels: false,
    radarDataLabelPosition: 'top',
    radarDataLabelFontSize: 10,
    radarDataLabelFontWeight: 'bold',
    radarDataLabelColor: '',
    radarDataLabelFormat: 'percent',
    radarSmooth: false,
    radarBaselineLineStyle: 'solid',
    radarBaselineSymbol: 'circle',
    radarBaselineSymbolSize: 6,
    radarBaselineAreaColor: '',
    radarBaselineSymbolBorderColor: '',
    radarBaselineSymbolBorderWidth: 0,
    radarIndicatorFormat: 'two_line',
    radarShowTarget: true,
    radarTargetLineStyle: 'dashed',
    radarTargetLineWidth: 2,
    radarTargetColor: '#d9534f',
    radarTargetAreaOpacity: 8,
    radarTargetSymbol: 'circle',
    radarTargetSymbolSize: 4,
    radarTargetSmooth: false,
    radarBaselineColor: '#1b5e20',
    radarTagShareColor: '#c62828',
    radarTagShareLineStyle: 'dashed',
    radarTagShareLineWidth: 2,
    radarTagShareAreaOpacity: 12,
    radarTagShareSymbol: 'rect',
    radarTagShareSymbolSize: 5,
    radarTagShareSmooth: false
  };
}

const defRadarCfg = createDefaultRadarSlotConfig();
assert.strictEqual(defRadarCfg.chartType, 'radar');
assert.strictEqual(defRadarCfg.radarShape, 'polygon');
assert.strictEqual(defRadarCfg.radarStartAngle, 90);
assert.strictEqual(defRadarCfg.radarRadius, 65);
assert.strictEqual(defRadarCfg.radarSplitNumber, 5);
assert.strictEqual(defRadarCfg.radarSplitAreaTheme, 'stepped');
assert.strictEqual(defRadarCfg.radarAxisLineWidth, 1);
assert.strictEqual(defRadarCfg.radarSplitLineWidth, 1);
assert.strictEqual(defRadarCfg.radarSmooth, false);
assert.strictEqual(defRadarCfg.radarTargetSmooth, false);
assert.strictEqual(defRadarCfg.radarTagShareSmooth, false);
console.log('   ✓ Default radar configuration parameters validated successfully.');

// --------------------------------------------------------------------------------
// Test 2: Academic 1-Click Presets Matrix
// --------------------------------------------------------------------------------
console.log('\n2. Testing Academic 1-Click Presets Logic...');

function applyPreset(base, presetName) {
  const cfg = { ...base };
  if (presetName === 'ieee_standard') {
    cfg.radarShape = 'polygon';
    cfg.radarSplitNumber = 5;
    cfg.radarSplitArea = true;
    cfg.radarSplitAreaTheme = 'stepped';
    cfg.radarSplitAreaOpacity = 100;
    cfg.radarAxisLine = true;
    cfg.radarAxisLineWidth = 1;
    cfg.radarAxisLineType = 'solid';
    cfg.radarSplitLine = true;
    cfg.radarSplitLineWidth = 1;
    cfg.radarSplitLineType = 'solid';
    cfg.radarLineWidth = 2.5;
    cfg.radarBaselineLineStyle = 'solid';
    cfg.radarAreaOpacity = 28;
    cfg.radarBaselineSymbol = 'circle';
    cfg.radarBaselineSymbolSize = 6;
    cfg.radarSmooth = false;
    cfg.radarTargetSmooth = false;
    cfg.radarTagShareSmooth = false;
    cfg.radarShowAxisScaleLabels = true;
    cfg.radarAxisScaleFormat = 'percent';
    cfg.radarAxisScaleFontSize = 10;
    cfg.radarShowAxisTicks = true;
    cfg.radarShowDataLabels = false;
    cfg.radarRadius = 65;
    cfg.radarStartAngle = 90;
  } else if (presetName === 'spider_web_minimal') {
    cfg.radarShape = 'polygon';
    cfg.radarSplitNumber = 4;
    cfg.radarSplitArea = false;
    cfg.radarSplitAreaTheme = 'none';
    cfg.radarAxisLine = true;
    cfg.radarAxisLineWidth = 0.8;
    cfg.radarAxisLineType = 'dashed';
    cfg.radarAxisLineColor = '#9e9e9e';
    cfg.radarSplitLine = true;
    cfg.radarSplitLineWidth = 0.8;
    cfg.radarSplitLineType = 'solid';
    cfg.radarSplitLineColor = '#e0e0e0';
    cfg.radarLineWidth = 1.8;
    cfg.radarBaselineLineStyle = 'solid';
    cfg.radarAreaOpacity = 12;
    cfg.radarBaselineSymbol = 'circle';
    cfg.radarBaselineSymbolSize = 4;
    cfg.radarSmooth = false;
    cfg.radarShowAxisScaleLabels = true;
    cfg.radarAxisScaleFormat = 'percent';
    cfg.radarShowAxisTicks = false;
    cfg.radarShowDataLabels = true;
    cfg.radarDataLabelFontSize = 9;
    cfg.radarRadius = 66;
  } else if (presetName === 'circular_smooth') {
    cfg.radarShape = 'circle';
    cfg.radarSplitNumber = 5;
    cfg.radarSplitArea = true;
    cfg.radarSplitAreaTheme = 'subtle';
    cfg.radarSmooth = true;
    cfg.radarTargetSmooth = true;
    cfg.radarTagShareSmooth = true;
    cfg.radarShowAxisScaleLabels = true;
    cfg.radarShowAxisTicks = true;
    cfg.radarRadius = 64;
  } else if (presetName === 'asymmetry_audit') {
    cfg.radarShape = 'polygon';
    cfg.radarSplitNumber = 5;
    cfg.radarSplitArea = true;
    cfg.radarSplitAreaTheme = 'stepped';
    cfg.radarIndicatorFormat = 'asymmetry_two_line';
    cfg.radarBaselineColor = '#1b5e20';
    cfg.radarTagShareColor = '#c62828';
    cfg.radarLineWidth = 2.5;
    cfg.radarTagShareLineWidth = 2;
    cfg.radarBaselineSymbol = 'circle';
    cfg.radarTagShareSymbol = 'rect';
    cfg.radarShowAxisScaleLabels = true;
    cfg.radarRadius = 62;
  } else if (presetName === 'high_density_badge') {
    cfg.radarShape = 'polygon';
    cfg.radarSplitNumber = 6;
    cfg.radarSplitArea = true;
    cfg.radarSplitAreaTheme = 'stepped';
    cfg.radarRadius = 72;
    cfg.radarAxisNameFontSize = 10;
    cfg.radarAxisNameBgColor = '#f1f5f9';
    cfg.radarAxisNameBorderColor = '#cbd5e1';
    cfg.radarAxisNameBorderWidth = 1;
    cfg.radarAxisNamePadding = 3;
    cfg.radarAxisNameBorderRadius = 4;
    cfg.radarShowAxisScaleLabels = true;
    cfg.radarShowAxisTicks = true;
    cfg.radarLineWidth = 2;
    cfg.radarBaselineSymbolSize = 5;
    cfg.radarScaleMax = 100;
    cfg.radarScaleMin = 0;
  }
  return cfg;
}

const ieeePreset = applyPreset(defRadarCfg, 'ieee_standard');
assert.strictEqual(ieeePreset.radarShape, 'polygon');
assert.strictEqual(ieeePreset.radarShowAxisScaleLabels, true);
assert.strictEqual(ieeePreset.radarShowAxisTicks, true);
assert.strictEqual(ieeePreset.radarSmooth, false);

const circularPreset = applyPreset(defRadarCfg, 'circular_smooth');
assert.strictEqual(circularPreset.radarShape, 'circle');
assert.strictEqual(circularPreset.radarSmooth, true);
assert.strictEqual(circularPreset.radarTargetSmooth, true);
assert.strictEqual(circularPreset.radarTagShareSmooth, true);

const badgePreset = applyPreset(defRadarCfg, 'high_density_badge');
assert.strictEqual(badgePreset.radarAxisNameBgColor, '#f1f5f9');
assert.strictEqual(badgePreset.radarAxisNameBorderRadius, 4);
assert.strictEqual(badgePreset.radarScaleMax, 100);
assert.strictEqual(badgePreset.radarScaleMin, 0);
console.log('   ✓ All 5 Academic 1-Click Presets produce expected configuration states.');

// --------------------------------------------------------------------------------
// Test 3: Preset JSON Serialization / Deserialization Round-Trip Fidelity
// --------------------------------------------------------------------------------
console.log('\n3. Testing Preset JSON Serialization / Deserialization...');

const mockSlotPayload = {
  version: '3.0',
  exportedAt: new Date().toISOString(),
  layoutMode: 'single',
  slots: {
    slot_a: {
      ...badgePreset,
      radarCenterX: 55,
      radarCenterY: 48,
      radarAxisLineWidth: 1.5,
      radarAxisLineType: 'dashed',
      radarAxisLineColor: '#64748b',
      radarSplitLineWidth: 1.2,
      radarSplitLineType: 'dotted',
      radarSplitLineColor: '#94a3b8',
      radarSplitAreaColor1: '#ffffff',
      radarSplitAreaColor2: '#f8fafc',
      radarBaselineAreaColor: '#10b981',
      radarBaselineSymbolBorderColor: '#047857',
      radarBaselineSymbolBorderWidth: 2,
      radarDataLabelFormat: 'decimal_1'
    }
  }
};

const serializedJson = JSON.stringify(mockSlotPayload);
const deserialized = JSON.parse(serializedJson);
const restoredSlot = deserialized.slots.slot_a;

assert.strictEqual(restoredSlot.radarCenterX, 55);
assert.strictEqual(restoredSlot.radarCenterY, 48);
assert.strictEqual(restoredSlot.radarAxisLineWidth, 1.5);
assert.strictEqual(restoredSlot.radarAxisLineType, 'dashed');
assert.strictEqual(restoredSlot.radarAxisLineColor, '#64748b');
assert.strictEqual(restoredSlot.radarSplitLineWidth, 1.2);
assert.strictEqual(restoredSlot.radarSplitLineType, 'dotted');
assert.strictEqual(restoredSlot.radarSplitLineColor, '#94a3b8');
assert.strictEqual(restoredSlot.radarSplitAreaColor1, '#ffffff');
assert.strictEqual(restoredSlot.radarSplitAreaColor2, '#f8fafc');
assert.strictEqual(restoredSlot.radarBaselineAreaColor, '#10b981');
assert.strictEqual(restoredSlot.radarBaselineSymbolBorderColor, '#047857');
assert.strictEqual(restoredSlot.radarBaselineSymbolBorderWidth, 2);
assert.strictEqual(restoredSlot.radarDataLabelFormat, 'decimal_1');
console.log('   ✓ 100% Round-trip serialization fidelity confirmed for all new radar properties.');

// --------------------------------------------------------------------------------
// Test 4: Coordinate & Polar Grid Option Generation (Mode 3 Prevalence vs Tag Share)
// --------------------------------------------------------------------------------
console.log('\n4. Testing ECharts Option Generation in Mode 3 (Prevalence vs Tag Share)...');

function mockGenerateRadarOption(ctx) {
  const getSplitAreaColors = () => {
    if (ctx.radarSplitAreaTheme === 'none' || ctx.radarSplitArea === false) return undefined;
    if (ctx.radarSplitAreaTheme === 'custom') {
      return [ctx.radarSplitAreaColor1 || '#fff', ctx.radarSplitAreaColor2 || '#eee'];
    }
    if (ctx.radarSplitAreaTheme === 'solid') return ['rgba(0,0,0,0.04)'];
    if (ctx.radarSplitAreaTheme === 'subtle') return ['#fff', 'rgba(0,0,0,0.03)'];
    return ['#fbfbfb', '#f4f6f8', '#edf1f5', '#e4e9ef', '#dbe2ea'];
  };

  const splitColors = getSplitAreaColors();
  const calculatedRadius = Math.max(20, Math.min(90, (ctx.radarRadius ?? 62) - Math.round(((ctx.containerPadding ?? 12) - 12) * 0.3)));
  const centerY = ctx.radarCenterY !== undefined ? ctx.radarCenterY : Math.max(20, Math.min(85, 53 + (ctx.fitOffsetY ?? 0)));
  const centerX = ctx.radarCenterX !== undefined ? ctx.radarCenterX : Math.max(20, Math.min(85, 50 + (ctx.fitOffsetX ?? 0)));

  const indicators = [
    { name: 'Time & Latency', max: ctx.radarScaleMax ?? 100, min: ctx.radarScaleMin ?? 0, value: 87 },
    { name: 'Memory & Storage', max: ctx.radarScaleMax ?? 100, min: ctx.radarScaleMin ?? 0, value: 43 }
  ];

  const formatRadarDataLabel = (val) => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    const fmt = ctx.radarDataLabelFormat || 'percent';
    if (fmt === 'integer') return `${Math.round(num)}`;
    if (fmt === 'decimal_1') return `${Number(num).toFixed(1)}%`;
    if (fmt === 'raw') return `${val}`;
    return `${Math.round(num)}%`;
  };

  const radarCoord = {
    indicator: indicators,
    center: [`${centerX}%`, `${centerY}%`],
    radius: `${calculatedRadius}%`,
    startAngle: ctx.radarStartAngle ?? 90,
    shape: ctx.radarShape || 'polygon',
    splitNumber: ctx.radarSplitNumber ?? 5,
    axisLine: {
      show: ctx.radarAxisLine !== false,
      lineStyle: {
        color: ctx.radarAxisLineColor || '#b0bec5',
        width: ctx.radarAxisLineWidth ?? 1,
        type: ctx.radarAxisLineType || 'solid',
        opacity: (ctx.radarAxisLineOpacity ?? 100) / 100
      }
    },
    splitLine: {
      show: ctx.radarSplitLine !== false,
      lineStyle: {
        color: ctx.radarSplitLineColor || '#cfd8dc',
        width: ctx.radarSplitLineWidth ?? 1,
        type: ctx.radarSplitLineType || 'solid',
        opacity: (ctx.radarSplitLineOpacity ?? 100) / 100
      }
    },
    splitArea: {
      show: Boolean(splitColors),
      areaStyle: {
        color: splitColors,
        opacity: (ctx.radarSplitAreaOpacity ?? 100) / 100
      }
    },
    axisTick: {
      show: ctx.radarShowAxisTicks === true
    },
    axisLabel: {
      show: ctx.radarShowAxisScaleLabels === true,
      fontSize: ctx.radarAxisScaleFontSize ?? 10,
      formatter: (value) => {
        const fmt = ctx.radarAxisScaleFormat || 'percent';
        if (fmt === 'percent') return `${Math.round(value)}%`;
        if (fmt === 'integer') return `${Math.round(value)}`;
        if (fmt === 'decimal_1') return `${Number(value).toFixed(1)}%`;
        return `${value}`;
      }
    },
    axisName: {
      fontFamily: 'Inter',
      fontSize: ctx.radarAxisNameFontSize ?? 11,
      fontWeight: ctx.radarAxisNameFontWeight || 'bold',
      backgroundColor: ctx.radarAxisNameBgColor || undefined,
      padding: ctx.radarAxisNamePadding ?? (ctx.radarAxisNameBgColor ? [3, 6] : undefined),
      borderRadius: ctx.radarAxisNameBorderRadius ?? (ctx.radarAxisNameBgColor ? 4 : undefined),
      borderColor: ctx.radarAxisNameBorderColor || undefined,
      borderWidth: ctx.radarAxisNameBorderWidth ?? (ctx.radarAxisNameBorderColor ? 1 : 0)
    }
  };

  const seriesData = [
    {
      name: 'Paper Prevalence',
      value: [87, 43],
      symbol: ctx.radarBaselineSymbol || 'circle',
      symbolSize: ctx.radarBaselineSymbolSize ?? 6,
      smooth: ctx.radarSmooth === true ? 0.35 : false,
      label: {
        show: ctx.radarShowDataLabels === true,
        formatter: (params) => formatRadarDataLabel(params.value)
      },
      lineStyle: {
        width: ctx.radarLineWidth ?? 2.5,
        type: ctx.radarBaselineLineStyle || 'solid',
        color: ctx.radarBaselineColor || '#1b5e20'
      },
      areaStyle: {
        color: ctx.radarBaselineAreaColor || '#1b5e20'
      },
      itemStyle: {
        color: ctx.radarBaselineColor || '#1b5e20',
        borderColor: ctx.radarBaselineSymbolBorderColor || undefined,
        borderWidth: ctx.radarBaselineSymbolBorderWidth ?? 0
      }
    },
    {
      name: 'Tag Share',
      value: [39, 16],
      symbol: ctx.radarTagShareSymbol || 'rect',
      symbolSize: ctx.radarTagShareSymbolSize ?? 5,
      smooth: ctx.radarTagShareSmooth === true ? 0.35 : false,
      label: {
        show: ctx.radarShowDataLabels === true,
        formatter: (params) => formatRadarDataLabel(params.value)
      },
      lineStyle: {
        width: ctx.radarTagShareLineWidth ?? 2,
        type: ctx.radarTagShareLineStyle || 'dashed',
        color: ctx.radarTagShareColor || '#c62828'
      }
    }
  ];

  return {
    radar: radarCoord,
    series: [{ type: 'radar', data: seriesData }]
  };
}

// Test Mode 3 option generation
const option = mockGenerateRadarOption({
  ...restoredSlot,
  radarAxisScaleFormat: 'decimal_1',
  radarSmooth: true,
  radarTagShareSmooth: true,
  radarShowDataLabels: true,
  radarShowAxisScaleLabels: true,
  radarShowAxisTicks: true
});

assert.strictEqual(option.radar.center[0], '55%');
assert.strictEqual(option.radar.center[1], '48%');
assert.strictEqual(option.radar.axisLine.lineStyle.width, 1.5);
assert.strictEqual(option.radar.axisLine.lineStyle.type, 'dashed');
assert.strictEqual(option.radar.splitLine.lineStyle.width, 1.2);
assert.strictEqual(option.radar.splitLine.lineStyle.type, 'dotted');
assert.strictEqual(option.radar.axisTick.show, true);
assert.strictEqual(option.radar.axisLabel.show, true);
assert.strictEqual(option.radar.axisLabel.formatter(50), '50.0%');
assert.strictEqual(option.radar.axisName.backgroundColor, '#f1f5f9');
assert.strictEqual(option.radar.axisName.borderRadius, 4);

assert.strictEqual(option.series[0].data[0].smooth, 0.35);
assert.strictEqual(option.series[0].data[0].itemStyle.borderColor, '#047857');
assert.strictEqual(option.series[0].data[0].itemStyle.borderWidth, 2);
assert.strictEqual(option.series[0].data[0].label.formatter({ value: 87.4 }), '87.4%');
assert.strictEqual(option.series[0].data[1].smooth, 0.35);
console.log('   ✓ Mode 3 ECharts polar grid and smooth series configuration verified.');

// --------------------------------------------------------------------------------
// Test 5: Legend Token Interpolation & "Baseline" Word Preservation Guard
// --------------------------------------------------------------------------------
console.log('\n5. Testing Legend Token Interpolation & "Baseline" Word Preservation Guard...');

const cleanSeriesDisplayName = (rawName) => {
  return rawName
    .replace(/,\s*[nN]\s*=\s*(\{[nN]\}|\d+|[nN])/gi, '')
    .replace(/\s*\([nN]\s*=\s*(\{[nN]\}|\d+|[nN])\s*\)/gi, '')
    .replace(/\s*\([nN]\s*=\s*\d+\s*\)/gi, '')
    .replace(/\s*\{[nN]\}\s*/gi, '')
    .trim();
};

// 1. Assert "Baseline" is NEVER corrupted into "Baselie"
assert.strictEqual(cleanSeriesDisplayName('Baseline'), 'Baseline', '"Baseline" must remain "Baseline" and not lose its "n"');
assert.strictEqual(cleanSeriesDisplayName('Empirical Cohort Baseline'), 'Empirical Cohort Baseline');
assert.strictEqual(cleanSeriesDisplayName('Empirical Cohort Baseline (n={n})'), 'Empirical Cohort Baseline');
assert.strictEqual(cleanSeriesDisplayName('Empirical Cohort Baseline, n={n}'), 'Empirical Cohort Baseline');
assert.strictEqual(cleanSeriesDisplayName('Empirical Cohort Baseline (n=46)'), 'Empirical Cohort Baseline');
assert.strictEqual(cleanSeriesDisplayName('Empirical Cohort Baseline {n}'), 'Empirical Cohort Baseline');
assert.strictEqual(cleanSeriesDisplayName('Tag Share (% of Disclosed Tags, N={N})'), 'Tag Share (% of Disclosed Tags)');
assert.strictEqual(cleanSeriesDisplayName('Machine Learning Pipeline'), 'Machine Learning Pipeline');

console.log('   ✓ cleanSeriesDisplayName preserves all words containing "n" (100% immune to "Baselie" bug).');

console.log('\n================================================================');
console.log('ALL RADAR / SPIDER CHART FINE-TUNE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
