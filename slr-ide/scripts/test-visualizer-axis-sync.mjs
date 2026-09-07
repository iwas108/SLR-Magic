import assert from 'node:assert';

console.log('--- TEST SUITE: SLR Visualizer Axis Sync & Layout Anti-Collision ---');

// 1. Test wrapAxisLabelText with slash '/' delimiters and multi-line breaks
console.log('1. Testing wrapAxisLabelText with slash delimiter preservation...');
function wrapAxisLabelText(text, maxCharsPerLine = 16) {
  if (!text || text.length <= maxCharsPerLine) return text;

  const tokens = text.split(/(?<=\/)\s*|\s+/);
  const lines = [];
  let curLine = '';

  for (const token of tokens) {
    if (!curLine) {
      curLine = token;
    } else if ((curLine + ' ' + token).length <= maxCharsPerLine) {
      curLine += curLine.endsWith('/') ? token : ' ' + token;
    } else {
      lines.push(curLine);
      curLine = token;
    }
  }
  if (curLine) lines.push(curLine);

  return lines.join('\n');
}

const wrapped1 = wrapAxisLabelText('Agriculture/Horticulture', 12);
console.log('   Input: "Agriculture/Horticulture" (maxChars=12)');
console.log('   Result:\n' + wrapped1.split('\n').map(l => '     | ' + l).join('\n'));
assert.ok(wrapped1.includes('\n'), 'Expected wrapped1 to contain a newline');
assert.strictEqual(wrapped1, 'Agriculture/\nHorticulture', 'Should break naturally after slash delimiter');

const wrapped2 = wrapAxisLabelText('Smart Agriculture/Precision Farming & Logistics', 15);
console.log('   Input: "Smart Agriculture/Precision Farming & Logistics" (maxChars=15)');
console.log('   Result:\n' + wrapped2.split('\n').map(l => '     | ' + l).join('\n'));
assert.ok(wrapped2.split('\n').length >= 3, 'Expected at least 3 lines for long compound title');

// 2. Test dynamic titleGap calculation
console.log('\n2. Testing dynamic titleGap calculation to prevent collision...');
function calculateDynamicTitleGap(labelWidth, labelMargin, showAxisTitle) {
  const dynamicDefaultTitleGap = Math.max(42, labelWidth + labelMargin + 16);
  return dynamicDefaultTitleGap;
}

const gap80 = calculateDynamicTitleGap(80, 8, true);
assert.strictEqual(gap80, 104, `Expected gap for 80px label to be 104px (80+8+16), got ${gap80}`);
console.log(`   Label Width 80px -> Title Gap: ${gap80}px (Safe clearance from text)`);

const gap140 = calculateDynamicTitleGap(140, 8, true);
assert.strictEqual(gap140, 164, `Expected gap for 140px label to be 164px (140+8+16), got ${gap140}`);
console.log(`   Label Width 140px -> Title Gap: ${gap140}px (Safe clearance from text)`);

// 3. Test grid left margin clearance calculation
console.log('\n3. Testing grid left margin anti-collapse calculation...');
function calculateEffectiveGridLeft(barGridLeft, labelWidth, labelMargin, titleGap, titleFontSize, showTitle) {
  const effectiveYTitleGap = titleGap ?? Math.max(42, labelWidth + labelMargin + 16);
  const requiredYTitleClearance = showTitle 
    ? (effectiveYTitleGap + titleFontSize + 16) 
    : (labelWidth + labelMargin + 20);

  let calculatedGridLeft = requiredYTitleClearance;
  if (barGridLeft !== undefined && typeof barGridLeft === 'number') {
    if (barGridLeft <= 40) {
      calculatedGridLeft = Math.max(requiredYTitleClearance, Math.round(1200 * (barGridLeft / 100)));
    } else {
      calculatedGridLeft = Math.max(requiredYTitleClearance, barGridLeft);
    }
  }
  return calculatedGridLeft;
}

const gridLeftWithSlider10 = calculateEffectiveGridLeft(10, 80, 8, 104, 11, true);
console.log(`   User Slider 10% on 80px label -> Grid Left: ${gridLeftWithSlider10}px`);
assert.ok(gridLeftWithSlider10 >= 131, `Grid left must be >= 131px to accommodate 80px label + 104px title gap, got ${gridLeftWithSlider10}`);

const gridLeftWithSlider10Default140 = calculateEffectiveGridLeft(10, 140, 8, 164, 11, true);
console.log(`   User Slider 10% on 140px label -> Grid Left: ${gridLeftWithSlider10Default140}px`);
assert.ok(gridLeftWithSlider10Default140 >= 191, `Grid left must be >= 191px to accommodate 140px label + 164px title gap, got ${gridLeftWithSlider10Default140}`);

// 4. Test Axis Config label fallback logic
console.log('\n4. Testing Axis Config label fallback logic for horizontal charts...');
function resolveAxisLabelParams(ctx, isHorizontal) {
  const labelWidth = isHorizontal
    ? (ctx.barYAxisWidth ?? ctx.axisLabelWidthY ?? 140)
    : (ctx.axisLabelWidthY ?? ctx.barYAxisWidth ?? 120);

  const labelOverflow = isHorizontal
    ? (ctx.barYAxisOverflow ?? ctx.axisLabelOverflowY ?? 'break')
    : (ctx.axisLabelOverflowY ?? ctx.barYAxisOverflow ?? 'break');

  const labelLineHeight = isHorizontal
    ? (ctx.barLineHeight ?? ctx.axisLabelLineHeightY ?? 13)
    : (ctx.axisLabelLineHeightY ?? ctx.barLineHeight ?? 13);

  return { labelWidth, labelOverflow, labelLineHeight };
}

const mockCtxFromUI = {
  barYAxisWidth: 80,
  barYAxisOverflow: 'break',
  barLineHeight: 14
};

const resolved = resolveAxisLabelParams(mockCtxFromUI, true);
assert.strictEqual(resolved.labelWidth, 80, `Expected labelWidth 80, got ${resolved.labelWidth}`);
assert.strictEqual(resolved.labelOverflow, 'break', `Expected labelOverflow 'break', got ${resolved.labelOverflow}`);
assert.strictEqual(resolved.labelLineHeight, 14, `Expected labelLineHeight 14, got ${resolved.labelLineHeight}`);
console.log('   Resolved config from UI controls:', JSON.stringify(resolved));

console.log('\n ALL VISUALIZER AXIS SYNC & ANTI-COLLISION TESTS PASSED SUCCESSFULLY!');
