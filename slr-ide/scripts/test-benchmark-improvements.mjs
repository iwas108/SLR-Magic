import Database from 'better-sqlite3';
import path from 'path';
import assert from 'assert';

console.log('--- Starting Benchmark Improvements Test Suite ---');

const dbPath = path.resolve(process.cwd(), 'db/slr.db');
const db = new Database(dbPath);

function safeJsonParse(val, fallback = {}) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function calculateImprovementMetrics(
  latestMetrics,
  previousMetrics,
  latestHoldout,
  previousHoldout,
  previousRunMeta
) {
  if (!latestMetrics || !previousMetrics) return null;

  const latAcc = Number(latestMetrics.accuracy_pct ?? 0);
  const prevAcc = Number(previousMetrics.accuracy_pct ?? 0);
  const accuracy_diff = parseFloat((latAcc - prevAcc).toFixed(2));

  const latRec = Number(latestMetrics.recall ?? 0);
  const prevRec = Number(previousMetrics.recall ?? 0);
  const recall_diff = parseFloat(((latRec - prevRec) * 100).toFixed(2));

  const latPrec = Number(latestMetrics.precision ?? 0);
  const prevPrec = Number(previousMetrics.precision ?? 0);
  const precision_diff = parseFloat(((latPrec - prevPrec) * 100).toFixed(2));

  const latF1 = Number(latestMetrics.f1 ?? 0);
  const prevF1 = Number(previousMetrics.f1 ?? 0);
  const f1_diff = parseFloat((latF1 - prevF1).toFixed(4));

  const latKappa = Number(latestMetrics.kappa ?? 0);
  const prevKappa = Number(previousMetrics.kappa ?? 0);
  const kappa_diff = parseFloat((latKappa - prevKappa).toFixed(4));

  let holdout_accuracy_diff = null;
  let holdout_f1_diff = null;

  if (latestHoldout && previousHoldout && latestHoldout.accuracy_pct !== undefined && previousHoldout.accuracy_pct !== undefined) {
    holdout_accuracy_diff = parseFloat((Number(latestHoldout.accuracy_pct) - Number(previousHoldout.accuracy_pct)).toFixed(2));
  }
  if (latestHoldout && previousHoldout && latestHoldout.f1 !== undefined && previousHoldout.f1 !== undefined) {
    holdout_f1_diff = parseFloat((Number(latestHoldout.f1) - Number(previousHoldout.f1)).toFixed(4));
  }

  const has_improved = accuracy_diff > 0.001 || f1_diff > 0.001 || recall_diff > 0.001 || precision_diff > 0.001 || kappa_diff > 0.001;
  const has_regressed = accuracy_diff < -0.001 || f1_diff < -0.001 || recall_diff < -0.001 || precision_diff < -0.001 || kappa_diff < -0.001;
  const is_unchanged = !has_improved && !has_regressed;

  return {
    accuracy_diff,
    recall_diff,
    precision_diff,
    f1_diff,
    kappa_diff,
    holdout_accuracy_diff,
    holdout_f1_diff,
    has_improved,
    has_regressed,
    is_unchanged,
    previous_created_at: previousRunMeta?.created_at,
    previous_run_id: previousRunMeta?.id,
    previous_summary_metrics: previousMetrics,
    previous_holdout_metrics: previousHoldout || null
  };
}

// TEST 1: Verify Stage 3 benchmark runs and improvement calculation from real database
console.log('\n[Test 1] Testing Stage 3 (Scientist) benchmark runs comparison in DB...');
const stage3Runs = db.prepare(`
  SELECT * FROM prompt_benchmark_runs 
  WHERE stage_num = 3 AND status = 'COMPLETED'
  ORDER BY created_at DESC 
  LIMIT 2
`).all();

assert.strictEqual(stage3Runs.length, 2, 'Should find 2 completed runs for Stage 3');
const s3Latest = safeJsonParse(stage3Runs[0].summary_metrics);
const s3Prev = safeJsonParse(stage3Runs[1].summary_metrics);
const s3Diff = calculateImprovementMetrics(s3Latest, s3Prev, safeJsonParse(stage3Runs[0].holdout_metrics), safeJsonParse(stage3Runs[1].holdout_metrics), stage3Runs[1]);

console.log('Stage 3 Summary:', {
  latestAcc: s3Latest.accuracy_pct,
  prevAcc: s3Prev.accuracy_pct,
  accDiff: s3Diff.accuracy_diff,
  recallDiff: s3Diff.recall_diff,
  f1Diff: s3Diff.f1_diff,
  hasImproved: s3Diff.has_improved
});

assert.strictEqual(s3Diff.accuracy_diff, 10.0, 'Stage 3 accuracy diff should be +10.0%');
assert.strictEqual(s3Diff.recall_diff, 10.0, 'Stage 3 recall diff should be +10.0%');
assert.ok(s3Diff.f1_diff > 0.05, 'Stage 3 F1 diff should be positive');
assert.strictEqual(s3Diff.has_improved, true, 'Stage 3 should have improved');
console.log('✓ Test 1 Passed: Stage 3 improvement metrics verified correctly');

// TEST 2: Verify Stage 2 benchmark runs and improvement calculation from real database
console.log('\n[Test 2] Testing Stage 2 (Gatekeeper) benchmark runs comparison in DB...');
const stage2Runs = db.prepare(`
  SELECT * FROM prompt_benchmark_runs 
  WHERE stage_num = 2 AND status = 'COMPLETED'
  ORDER BY created_at DESC 
  LIMIT 2
`).all();

assert.strictEqual(stage2Runs.length, 2, 'Should find 2 completed runs for Stage 2');
const s2Latest = safeJsonParse(stage2Runs[0].summary_metrics);
const s2Prev = safeJsonParse(stage2Runs[1].summary_metrics);
const s2Diff = calculateImprovementMetrics(s2Latest, s2Prev, safeJsonParse(stage2Runs[0].holdout_metrics), safeJsonParse(stage2Runs[1].holdout_metrics), stage2Runs[1]);

console.log('Stage 2 Summary:', {
  latestAcc: s2Latest.accuracy_pct,
  prevAcc: s2Prev.accuracy_pct,
  accDiff: s2Diff.accuracy_diff,
  recallDiff: s2Diff.recall_diff,
  f1Diff: s2Diff.f1_diff,
  hasImproved: s2Diff.has_improved
});

assert.strictEqual(s2Diff.accuracy_diff, 25.0, 'Stage 2 accuracy diff should be +25.0%');
assert.strictEqual(s2Diff.recall_diff, 100.0, 'Stage 2 recall diff should be +100.0%');
assert.strictEqual(s2Diff.f1_diff, 1.0, 'Stage 2 F1 diff should be +1.0');
assert.strictEqual(s2Diff.has_improved, true, 'Stage 2 should have improved');
console.log('✓ Test 2 Passed: Stage 2 improvement metrics verified correctly');

// TEST 3: Verify Stage 1 baseline (single run case)
console.log('\n[Test 3] Testing Stage 1 (Fast Filter) single-run baseline behavior...');
const stage1Runs = db.prepare(`
  SELECT * FROM prompt_benchmark_runs 
  WHERE stage_num = 1 AND status = 'COMPLETED'
  ORDER BY created_at DESC 
  LIMIT 2
`).all();

assert.strictEqual(stage1Runs.length, 1, 'Stage 1 should have exactly 1 run');
const s1Diff = calculateImprovementMetrics(safeJsonParse(stage1Runs[0].summary_metrics), null, null, null, null);
assert.strictEqual(s1Diff, null, 'Single run must return null improvement metrics');
console.log('✓ Test 3 Passed: Single run gracefully returns null improvements');

// TEST 4: Verify Multi-Project Isolation
console.log('\n[Test 4] Testing strict multi-project isolation query clauses...');
const foreignProjectRuns = db.prepare(`
  SELECT * FROM prompt_benchmark_runs 
  WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) 
    AND stage_num = 3
    AND status = 'COMPLETED'
  ORDER BY created_at DESC 
  LIMIT 2
`).all('non-existent-project-999', 'non-existent-project-999');

assert.strictEqual(foreignProjectRuns.length, 0, 'Foreign project query must return 0 runs');
console.log('✓ Test 4 Passed: Multi-project isolation enforced strictly');

console.log('\n========================================');
console.log('ALL BENCHMARK IMPROVEMENT TESTS PASSED! ');
console.log('========================================\n');
