import test from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import { generateStackedBarOption } from '../src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts';

test('Stacked Bar Data Source & Format Synchronization Test Suite', async (t) => {
  const db = new Database('db/slr.db');
  const projId = 'proj-1786812367683';
  const papers = db.prepare('SELECT * FROM papers WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND (manual_stage = 4 OR ai_stage = 4)').all(projId, projId);
  const row = db.prepare("SELECT umbrella_mapping FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND extracted_data_key = 'rq5_network_protocols' ORDER BY id DESC LIMIT 1").get(projId, projId);
  const umbrellanizerMap = { rq5_network_protocols: JSON.parse(row.umbrella_mapping) };

  const baseCtx = {
    papers,
    palette: { colors: ['#5b21b6', '#7c3aed', '#a78bfa'], background: '#ffffff', text: '#1f2937' },
    umbrellanizerMap,
    chartType: 'stacked_bar',
    primaryField: 'ext:lv0:rq5_network_protocols',
    secondaryField: 'ext:lv1:rq5_network_protocols',
    barOrientation: 'horizontal',
    metricMode: 'count', // testing with standard count metric
    stackedNormalized: true,
    decimalPrecision: 0,
    barLegendFormat: 'name_ratio_percent',
    barLabelFormat: 'percent_only',
    legendShowParentPrefix: false,
    stackedPerBarSorting: 'desc'
  };

  await t.test('1. in_chart_flow Legend Scope aligns denominator to In-Chart Bar Flow (n = 3/51, ~6%)', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendContextScope: 'in_chart_flow'
    });
    const canItem = opt.legend.data.find(d => d.name.includes('CAN & Vehicular Buses'));
    assert.ok(canItem, 'CAN & Vehicular Buses must exist in legend');
    assert.ok(canItem.name.includes('n = 3/51') || canItem.name.includes('n = 3/50'), `Legend should show layer total denominator (51 or 50), got: ${canItem.name}`);
    assert.ok(canItem.name.includes('~6%'), `Legend should show ~6% matching the bar, got: ${canItem.name}`);
  });

  await t.test('2. surviving_flow Legend Scope displays active surviving cohort prevalence (n = 3/31, ~10%)', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendContextScope: 'surviving_flow'
    });
    const canItem = opt.legend.data.find(d => d.name.includes('CAN & Vehicular Buses'));
    assert.ok(canItem, 'CAN & Vehicular Buses must exist in legend');
    assert.ok(canItem.name.includes('n = 3/31'), `Legend should show 3/31, got: ${canItem.name}`);
    assert.ok(canItem.name.includes('~10%'), `Legend should show ~10%, got: ${canItem.name}`);
  });

  await t.test('3. global_cohort Legend Scope displays full project cohort ratio (n = 3/46, ~7%)', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendContextScope: 'global_cohort'
    });
    const canItem = opt.legend.data.find(d => d.name.includes('CAN & Vehicular Buses'));
    assert.ok(canItem, 'CAN & Vehicular Buses must exist in legend');
    assert.ok(canItem.name.includes('n = 3/46'), `Legend should show 3/46, got: ${canItem.name}`);
    assert.ok(canItem.name.includes('~7%'), `Legend should show ~7%, got: ${canItem.name}`);
  });

  await t.test('4. syncLegendAndBarMetrics = true synchronizes Bar to In-Chart Flow (~6%) when in_chart_flow is selected', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendContextScope: 'in_chart_flow',
      syncLegendAndBarMetrics: true
    });

    const rankSeries = opt.series.filter(s => s.name.startsWith('__stacked_rank_'));
    const canCell = rankSeries
      .map(s => s.data.find(d => d && d.stkName === 'CAN & Vehicular Buses'))
      .find(Boolean);

    assert.ok(canCell, 'CAN cell must exist in per-bar sorted data');
    const labelResult = rankSeries[0].label.formatter({
      value: canCell.displayValue,
      data: canCell
    });
    assert.strictEqual(labelResult, '~6%', 'Bar segment label must be ~6% synchronized to in_chart_flow');
  });

  await t.test('5. syncLegendAndBarMetrics = true synchronizes Bar to Surviving Cohort Prevalence (~10%) when surviving_flow is selected', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendContextScope: 'surviving_flow',
      syncLegendAndBarMetrics: true
    });

    const rankSeries = opt.series.filter(s => s.name.startsWith('__stacked_rank_'));
    const canCell = rankSeries
      .map(s => s.data.find(d => d && d.stkName === 'CAN & Vehicular Buses'))
      .find(Boolean);

    assert.ok(canCell, 'CAN cell must exist');
    const labelResult = rankSeries[0].label.formatter({
      value: canCell.displayValue,
      data: canCell
    });
    assert.strictEqual(labelResult, '~10%', 'Bar segment label must be ~10% synchronized to surviving_flow cohort prevalence');
  });

  await t.test('6. barLabelContextScope = cohort_prevalence independently sets bar to prevalence regardless of legend', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      legendContextScope: 'in_chart_flow',
      barLabelContextScope: 'cohort_prevalence'
    });

    const rankSeries = opt.series.filter(s => s.name.startsWith('__stacked_rank_'));
    const canCell = rankSeries
      .map(s => s.data.find(d => d && d.stkName === 'CAN & Vehicular Buses'))
      .find(Boolean);

    const labelResult = rankSeries[0].label.formatter({
      value: canCell.displayValue,
      data: canCell
    });
    assert.strictEqual(labelResult, '~7%', 'Bar segment label should show cohort adoption ~7%');
  });

  await t.test('7. ratio_percent format displays both ratio and percentage (e.g. 3/51 (~6%))', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      barLabelFormat: 'ratio_percent',
      legendContextScope: 'in_chart_flow'
    });

    const rankSeries = opt.series.filter(s => s.name.startsWith('__stacked_rank_'));
    const canCell = rankSeries
      .map(s => s.data.find(d => d && d.stkName === 'CAN & Vehicular Buses'))
      .find(Boolean);

    const labelResult = rankSeries[0].label.formatter({
      value: canCell.displayValue,
      data: canCell
    });
    assert.ok(labelResult.includes('3/51') || labelResult.includes('3/50'), `Should include ratio 3/51 or 3/50, got: ${labelResult}`);
    assert.ok(labelResult.includes('~6%'), `Should include coarse percent ~6%, got: ${labelResult}`);
  });

  await t.test('8. name_percent format outputs subcategory name + percent', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      barLabelFormat: 'name_percent',
      legendContextScope: 'in_chart_flow'
    });

    const rankSeries = opt.series.filter(s => s.name.startsWith('__stacked_rank_'));
    const canCell = rankSeries
      .map(s => s.data.find(d => d && d.stkName === 'CAN & Vehicular Buses'))
      .find(Boolean);

    const labelResult = rankSeries[0].label.formatter({
      value: canCell.displayValue,
      data: canCell
    });
    assert.strictEqual(labelResult, 'CAN & Vehicular Buses (~6%)');
  });

  await t.test('9. Standard series without per-bar sorting generates identical synchronized labels', () => {
    const opt = generateStackedBarOption({
      ...baseCtx,
      stackedPerBarSorting: 'none',
      barLabelFormat: 'percent_only',
      legendContextScope: 'in_chart_flow',
      syncLegendAndBarMetrics: true
    });

    const canSeries = opt.series.find(s => s.name.includes('CAN & Vehicular Buses'));
    assert.ok(canSeries, 'CAN series must exist in standard series');
    const phyLinkData = canSeries.data.find(d => d && d.catName && d.catName.includes('Link'));
    assert.ok(phyLinkData, 'Physical / Link data cell must exist');

    const labelResult = canSeries.label.formatter({
      value: phyLinkData.value,
      data: phyLinkData
    });
    assert.strictEqual(labelResult, '~6%', 'Standard series must evaluate to ~6%');
  });
});
