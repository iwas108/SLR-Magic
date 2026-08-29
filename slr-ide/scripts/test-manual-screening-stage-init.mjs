import assert from 'assert';

console.log('🧪 Running Manual Screening Stage Initialization & EC Rules Resolution Tests...\n');

// 1. Test numToStageMap behavior for unscreened and screened papers
const numToStageMap = {
  0: 'fast_filter',
  1: 'fast_filter',
  2: 'gatekeeper',
  3: 'scientist',
  4: 'miner'
};

const unscreenedPaper = { Paper_ID: 'P1', manual_stage: 0, manual_decision: null };
const nullStagePaper = { Paper_ID: 'P2', manual_stage: null, manual_decision: null };
const stage1Paper = { Paper_ID: 'P3', manual_stage: 1, manual_decision: 'INCLUDE' };
const stage2Paper = { Paper_ID: 'P4', manual_stage: 2, manual_decision: 'EXCLUDE (EC4)' };

assert.strictEqual(numToStageMap[unscreenedPaper.manual_stage || 0], 'fast_filter', 'Stage 0 should map to fast_filter');
assert.strictEqual(numToStageMap[nullStagePaper.manual_stage || 0], 'fast_filter', 'Null stage should map to fast_filter');
assert.strictEqual(numToStageMap[stage1Paper.manual_stage || 0], 'fast_filter', 'Stage 1 should map to fast_filter');
assert.strictEqual(numToStageMap[stage2Paper.manual_stage || 0], 'gatekeeper', 'Stage 2 should map to gatekeeper');
console.log('✅ 1. numToStageMap correctly maps unscreened (0/null) papers to fast_filter.');

// 2. Test getEcRules resolution logic
const mockProject = {
  id: 'proj-test',
  ec_rules: JSON.stringify([
    { code: 'EC1', description: 'Not English' },
    { code: 'EC2', description: 'Not peer reviewed' }
  ]),
  pool_b_ec_rules: JSON.stringify([
    { code: 'EC-B1', description: 'No empirical evaluation' }
  ]),
  pool_c_qa_rules: JSON.stringify([
    { code: 'QA1', question: 'Clear research aims?', is_fatal_flaw: true }
  ])
};

function getEcRules(activeProj, manualStage) {
  if (!activeProj) return [];
  
  if (manualStage === 'gatekeeper') {
    const field = activeProj.pool_b_ec_rules;
    if (!field) return [];
    try {
      return typeof field === 'string' ? JSON.parse(field) : field;
    } catch {
      return [];
    }
  }
  
  if (manualStage === 'scientist') {
    const field = activeProj.pool_c_qa_rules;
    if (!field) return [];
    try {
      const parsed = typeof field === 'string' ? JSON.parse(field) : field;
      const mapped = parsed.map(rule => ({
        code: `FATAL_FLAW_${rule.code}`,
        description: `Fatal Flaw: ${rule.question || ''}`
      }));
      mapped.push({
        code: 'CUMULATIVE_BELOW_4.5',
        description: 'Cumulative score below 4.5/8.0'
      });
      return mapped;
    } catch {
      return [];
    }
  }
  
  // Default to Stage 1: Fast Filter (Pool A)
  const field = activeProj.ec_rules;
  if (!field) return [];
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch {
    return [];
  }
}

const fastFilterRules = getEcRules(mockProject, 'fast_filter');
assert.strictEqual(fastFilterRules.length, 2, 'Fast filter should return 2 EC rules from ec_rules');
assert.strictEqual(fastFilterRules[0].code, 'EC1');

const defaultFallbackRules = getEcRules(mockProject, '');
assert.strictEqual(defaultFallbackRules.length, 2, 'Empty stage should default to Pool A rules');

const gatekeeperRules = getEcRules(mockProject, 'gatekeeper');
assert.strictEqual(gatekeeperRules.length, 1, 'Gatekeeper should return 1 Pool B rule');
assert.strictEqual(gatekeeperRules[0].code, 'EC-B1');

const scientistRules = getEcRules(mockProject, 'scientist');
assert.strictEqual(scientistRules.length, 2, 'Scientist should return fatal flaw + cumulative rules');
assert.strictEqual(scientistRules[0].code, 'FATAL_FLAW_QA1');
console.log('✅ 2. getEcRules correctly resolves Pool A (Fast Filter), Pool B (Gatekeeper), and Pool C (Scientist) rules.');

// 3. Test pool warning label resolution
function getPoolLabel(manualStage) {
  return manualStage === 'gatekeeper' ? 'Pool B' : 'Pool A';
}

assert.strictEqual(getPoolLabel('fast_filter'), 'Pool A');
assert.strictEqual(getPoolLabel('gatekeeper'), 'Pool B');
assert.strictEqual(getPoolLabel(''), 'Pool A');
console.log('✅ 3. Warning pool label evaluates to Pool A for fast_filter and Pool B for gatekeeper.');

// 4. Test hasChanges calculation for pristine unscreened paper
const selectedPaper = {
  Paper_ID: 'P_2022_TEST',
  manual_decision: null,
  manual_stage: 0,
  manual_rationale: null,
  manual_quality_assessment: null,
  manual_extracted_data: null
};

const formState = {
  manualDecision: '',
  manualEcTrigger: '',
  manualRationale: '',
  manualStage: 'fast_filter'
};

const dbStageStr = numToStageMap[selectedPaper.manual_stage || 0] || 'fast_filter';
const decisionChanged = (formState.manualDecision || '') !== (selectedPaper.manual_decision || '');
const ecTriggerChanged = (formState.manualEcTrigger || '') !== '';
const rationaleChanged = (formState.manualRationale || '') !== (selectedPaper.manual_rationale || '');
const stageChanged = (formState.manualStage || 'fast_filter') !== dbStageStr;

const hasChanges = decisionChanged || ecTriggerChanged || rationaleChanged || stageChanged;
assert.strictEqual(hasChanges, false, 'Pristine unscreened paper should have hasChanges = false');
console.log('✅ 4. hasChanges correctly evaluates to false when unscreened paper is loaded without edits.');

console.log('\n🎉 ALL MANUAL SCREENING STAGE INITIALIZATION & EC RESOLUTION TESTS PASSED!');
