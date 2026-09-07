import test from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { generateStackedBarOption, getLayerAbbreviation } from '../src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts';
import * as echarts from 'echarts';

test('Stacked Bar CDS Studio Context Intelligence & Scientific Visualizer Suite', async (t) => {
  const db = new Database('db/slr.db');
  const projId = 'proj-1786812367683';
  const papers = db.prepare('SELECT * FROM papers WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND (manual_stage = 4 OR ai_stage = 4)').all(projId, projId);
  const row = db.prepare("SELECT umbrella_mapping FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND extracted_data_key = 'rq5_network_protocols' ORDER BY id DESC LIMIT 1").get(projId, projId);
  const umbrellanizerMap = { rq5_network_protocols: JSON.parse(row.umbrella_mapping) };
  
  const slot = {
    chartType: 'stacked_bar',
    primaryField: 'ext:lv0:rq5_network_protocols',
    secondaryField: 'ext:lv1:rq5_network_protocols',
    barOrientation: 'horizontal',
    metricMode: 'paper_prevalence',
    stackedNormalized: true,
    themePreset: 'frontiers_violet',
    decimalPrecision: 0,
    barLegendFormat: 'name_ratio_percent',
    barLabelFormat: 'percent_only',
    legendContextScope: 'global_cohort',
    legendShowParentPrefix: false,
    stackedPerBarSorting: 'none'
  };

  const baseCtx = {
    papers,
    palette: { colors: ['#5b21b6', '#7c3aed', '#a78bfa'], background: '#ffffff', text: '#1f2937' },
    umbrellanizerMap,
    ...slot
  };

  await t.test('1. Default Preset shows exact global cohort ratio (n = 3/46, ~7%) for CAN', () => {
    const opt = generateStackedBarOption({ ...baseCtx, legendContextScope: 'global_cohort' });
    const canItem = opt.legend.data.find(d => d.name.includes('CAN & Vehicular Buses'));
    assert.ok(canItem, 'CAN & Vehicular Buses must exist in legend');
    assert.ok(canItem.name.includes('n = 3/46'), `Legend should show 3/46, got: ${canItem.name}`);
    assert.ok(canItem.name.includes('~7%'), `Legend should show ~7%, got: ${canItem.name}`);
  });

  await t.test('2. Stack Segment Label Formatting Synchronization & Precision Inheritance', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      barLabelFormat: 'percent_only',
      decimalPrecision: 0
    });
    const canSeries = opt.series.find(s => s.name.includes('CAN & Vehicular Buses'));
    assert.ok(canSeries, 'CAN series must exist');
    const labelFmt = canSeries.label.formatter({
      value: 6.52,
      data: { rawVal: 6.52, pct: 6, prevalencePct: 6.52, paperCount: 3, catTotal: 51 }
    });
    assert.strictEqual(labelFmt, '~7%', 'Harmonized bar label must display ~7% matching the legend');
  });

  await t.test('3. Explicit layer_share shows within-bar normalized quota (6%)', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      barLabelFormat: 'layer_share',
      decimalPrecision: 0
    });
    const canSeries = opt.series.find(s => s.name.includes('CAN & Vehicular Buses'));
    const labelFmt = canSeries.label.formatter({
      value: 6,
      data: { rawVal: 6.52, pct: 6, prevalencePct: 6.52, paperCount: 3, catTotal: 51 }
    });
    assert.strictEqual(labelFmt, '~6%', 'Explicit layer_share must display ~6%');
  });

  await t.test('4. Smart Per-Bar Sorting (stackedPerBarSorting = desc) orders largest slice first', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      stackedPerBarSorting: 'desc',
      barOrientation: 'horizontal'
    });

    const rank0 = opt.series.find(s => s.name === '__stacked_rank_0__');
    assert.ok(rank0, 'Rank 0 series must exist for per-bar sorting');
    const physRank0 = rank0.data.find(d => d.catName === 'Physical/Link');
    assert.strictEqual(physRank0.stkName, 'Wi-Fi & WLAN', 'Rank 0 (far left base) must be the largest slice (Wi-Fi)');
    assert.strictEqual(physRank0.paperCount, 14, 'Wi-Fi must have 14 papers');

    const rankSeries = opt.series.filter(s => s.name.startsWith('__stacked_rank_'));
    const activePhysRanks = rankSeries
      .map(s => s.data.find(d => d.catName === 'Physical/Link'))
      .filter(d => d && d.rawVal > 0);
    
    const lastPhysRank = activePhysRanks[activePhysRanks.length - 1];
    assert.strictEqual(lastPhysRank.stkName, 'CAN & Vehicular Buses', 'Smallest slice (CAN) must be placed at the far right');
    assert.strictEqual(lastPhysRank.paperCount, 3, 'CAN has 3 papers');
  });

  await t.test('5. Bar Centering on Y-Axis Marker (Zero Elevation Discrepancy)', () => {
    const chartGlobal = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 600 });
    const optGlobal = generateStackedBarOption({ ...baseCtx, stackedPerBarSorting: 'none', barOrientation: 'horizontal' });
    chartGlobal.setOption(optGlobal);
    const svgGlobal = chartGlobal.renderToSVGString();

    const chartPerBar = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 600 });
    const optPerBar = generateStackedBarOption({ ...baseCtx, stackedPerBarSorting: 'desc', barOrientation: 'horizontal' });
    chartPerBar.setOption(optPerBar);
    const svgPerBar = chartPerBar.renderToSVGString();

    const getY = (svg) => {
      const matches = [...svg.matchAll(/d="M\s*[\d.]+\s+([\d.]+)[^"]*Z"/g)].map(m => parseFloat(m[1]));
      return matches;
    };
    const yGlobal = getY(svgGlobal);
    const yPerBar = getY(svgPerBar);
    assert.ok(yGlobal.length > 0 && yPerBar.length > 0, 'Bars must be rendered in both SVGs');
    assert.strictEqual(yPerBar[0], yGlobal[0], `Per-bar sorting bar Y position (${yPerBar[0]}) must exactly match global order Y position (${yGlobal[0]})!`);
  });

  await t.test('6. Layer-Qualified Stacks Disambiguation (Security exists in App and Net with distinct n)', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendParentPrefixStyle: 'abbreviated',
      legendGroupByParent: true
    });

    // Legend data should contain distinct layer-qualified items
    const appSec = opt.legend.data.find(d => d.name.includes('[App]') && d.name.includes('Security, Tunnels & Serialization'));
    const netSec = opt.legend.data.find(d => d.name.includes('[Net]') && d.name.includes('Security, Tunnels & Serialization'));

    assert.ok(appSec, '[App] Security, Tunnels & Serialization must exist in legend');
    assert.ok(netSec, '[Net] Security, Tunnels & Serialization must exist in legend');

    // Verify exact layer paper counts
    assert.ok(appSec.name.includes('n = 3/46'), `App Security must have n = 3/46, got: ${appSec.name}`);
    assert.ok(appSec.name.includes('~7%'), `App Security must have ~7%, got: ${appSec.name}`);

    assert.ok(netSec.name.includes('n = 4/46'), `Net Security must have n = 4/46, got: ${netSec.name}`);
    assert.ok(netSec.name.includes('~9%'), `Net Security must have ~9%, got: ${netSec.name}`);
  });

  await t.test('7. Hover Tooltip Dual Metric (No contradictory global ratio, clean subcategory name)', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendParentPrefixStyle: 'abbreviated'
    });

    const tooltipHtml = opt.tooltip.formatter([
      {
        seriesName: '[App] Security, Tunnels & Serialization (n = 3/46, ~7%)',
        value: 3,
        color: '#7c3aed',
        data: {
          rawVal: 3,
          pct: 8.1,
          paperCount: 3,
          prevalencePct: 6.52,
          stkName: 'Security, Tunnels & Serialization',
          cleanSubName: 'Security, Tunnels & Serialization',
          catName: 'Application/Middleware',
          catTotal: 37
        }
      }
    ]);

    assert.ok(tooltipHtml.includes('Security, Tunnels & Serialization'), 'Tooltip must show clean subcategory name');
    assert.ok(!tooltipHtml.includes('[App]'), 'Tooltip subcategory name must NOT have [App] prefix');
    assert.ok(tooltipHtml.includes('3 papers'), 'Tooltip must show 3 papers');
    assert.ok(tooltipHtml.includes('~7% of cohort'), 'Tooltip must show cohort prevalence ~7%');
    assert.ok(tooltipHtml.includes('Application/Middleware'), 'Tooltip must reference the layer name');
  });

  await t.test('8. Grouped Legend Ordering matches bar display order', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendParentPrefixStyle: 'abbreviated',
      legendGroupByParent: true
    });

    const legendNames = opt.legend.data.map(d => d.name);
    const categories = opt.yAxis?.data || opt.xAxis?.data || [];
    
    // Each parent layer's items should appear in contiguous blocks matching category order
    let lastFoundCategoryIdx = -1;
    categories.forEach(cat => {
      const abbr = getLayerAbbreviation(cat);
      const firstIdx = legendNames.findIndex(n => n.includes(`[${abbr}]`) || n.includes(`[${cat}]`));
      if (firstIdx !== -1) {
        assert.ok(firstIdx > lastFoundCategoryIdx, `Legend items for category ${cat} (index ${firstIdx}) must appear after prior category (index ${lastFoundCategoryIdx})`);
        lastFoundCategoryIdx = firstIdx;
      }
    });
  });
});

