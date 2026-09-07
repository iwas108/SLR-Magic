import test from 'node:test';
import assert from 'node:assert';
import { THEME_PALETTES } from '../src/components/features/modals/visualizer/constants/themePalettes.ts';
import { generateDistinctPalette, hexToHsl } from '../src/components/features/modals/visualizer/utils/colorUtils.ts';
import { generateStackedBarOption } from '../src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts';

test('Palette-Aware Distinct Color Expansion Suite', async (t) => {
  await t.test('1. Academic Grayscale preserves 100% achromatic fidelity (0% saturation) for >8 series', () => {
    const pal = THEME_PALETTES.academic_grayscale;
    const expanded = generateDistinctPalette(pal.colors, 16);
    
    assert.strictEqual(expanded.length, 16, 'Expanded palette must contain 16 items');
    const unique = new Set(expanded);
    assert.strictEqual(unique.size, 16, 'All 16 expanded colors must be strictly unique');

    expanded.forEach((hex, idx) => {
      const hsl = hexToHsl(hex);
      // Base colors have minor s <= 10%, generated colors must have s === 0%
      if (idx >= pal.colors.length) {
        assert.strictEqual(hsl.s, 0, `Generated color [${idx}] (${hex}) must have 0% saturation (got ${hsl.s}%)`);
      } else {
        assert.ok(hsl.s <= 12, `Base grayscale color [${idx}] (${hex}) must have <= 12% saturation`);
      }
      assert.ok(hsl.l >= 4 && hsl.l <= 88, `Lightness of [${idx}] (${hex}) must be within printable bounds [4%, 88%] (got ${hsl.l}%)`);
    });
  });

  await t.test('2. IEEE Slate Blue preserves signature blue hue family (200°-235°) for expanded series', () => {
    const pal = THEME_PALETTES.ieee_blue;
    const expanded = generateDistinctPalette(pal.colors, 14);

    assert.strictEqual(expanded.length, 14, 'Expanded palette must contain 14 items');
    const unique = new Set(expanded);
    assert.strictEqual(unique.size, 14, 'All 14 expanded colors must be strictly unique');

    expanded.forEach((hex, idx) => {
      const hsl = hexToHsl(hex);
      assert.ok(hsl.h >= 195 && hsl.h <= 235, `Color [${idx}] (${hex}) hue must stay in blue spectrum [195°-235°] (got ${hsl.h}°)`);
      assert.ok(hsl.s >= 40, `Color [${idx}] (${hex}) must preserve slate blue saturation (got ${hsl.s}%)`);
    });
  });

  await t.test('3. Sequential Degradation: Emerald preserves green family', () => {
    const pal = THEME_PALETTES.degrade_emerald;
    const expanded = generateDistinctPalette(pal.colors, 12);

    assert.strictEqual(expanded.length, 12, 'Expanded palette must contain 12 items');
    const unique = new Set(expanded);
    assert.strictEqual(unique.size, 12, 'All 12 expanded colors must be strictly unique');

    expanded.forEach((hex, idx) => {
      const hsl = hexToHsl(hex);
      assert.ok(hsl.h >= 140 && hsl.h <= 180, `Color [${idx}] (${hex}) hue must stay in emerald spectrum [140°-180°] (got ${hsl.h}°)`);
    });
  });

  await t.test('4. Multi-Hue Categorical Palettes generate unique, non-duplicating harmonic tints/shades', () => {
    const testCategorical = ['nature_emerald', 'frontiers_violet', 'science_contrast', 'pnas_gold'];
    for (const key of testCategorical) {
      const pal = THEME_PALETTES[key];
      const expanded = generateDistinctPalette(pal.colors, 16);
      assert.strictEqual(expanded.length, 16, `Expanded palette for ${key} must contain 16 items`);
      const unique = new Set(expanded);
      assert.strictEqual(unique.size, 16, `All 16 expanded colors for ${key} must be unique`);
    }
  });

  await t.test('5. Stacked Bar Generator with Academic Grayscale renders 100% grayscale blocks for 12 series', async () => {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database('db/slr.db');
    const projId = 'proj-1786812367683';
    const papers = db.prepare('SELECT * FROM papers WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND (manual_stage = 4 OR ai_stage = 4)').all(projId, projId);
    const row = db.prepare("SELECT umbrella_mapping FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND extracted_data_key = 'rq5_network_protocols' ORDER BY id DESC LIMIT 1").get(projId, projId);
    const umbrellanizerMap = { rq5_network_protocols: JSON.parse(row.umbrella_mapping) };

    const grayPal = THEME_PALETTES.academic_grayscale;
    const opt = generateStackedBarOption({
      papers,
      palette: grayPal,
      umbrellanizerMap,
      chartType: 'stacked_bar',
      primaryField: 'ext:lv0:rq5_network_protocols',
      secondaryField: 'ext:lv1:rq5_network_protocols',
      themePreset: 'academic_grayscale',
      stackedPerBarSorting: 'none'
    });

    assert.ok(opt.series && opt.series.length >= 12, `Must generate at least 12 series for 12 stacks (got ${opt.series?.length})`);
    opt.series.forEach((s) => {
      const color = s.itemStyle?.color;
      if (typeof color === 'string' && color.startsWith('#')) {
        const hsl = hexToHsl(color);
        assert.ok(hsl.s <= 12, `Series "${s.name}" color ${color} must be grayscale (got saturation ${hsl.s}%)`);
      }
    });
  });
});
