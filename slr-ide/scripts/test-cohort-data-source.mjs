import assert from 'node:assert/strict';
import { 
  discoverCohortVariables, 
  resolveCohortFieldValue, 
  validateCohortDataIntegrity,
  formatVariableDisplayName,
  CUSTOM_GROUPING_KEY,
  CUSTOM_GROUPING_LABEL
} from '../src/lib/services/cohort-data-source.js';

console.log('--- TEST SUITE: Centralized Cohort Data Source & Validation Engine ---');

const mockCohort = [
  {
    Paper_ID: 'P01',
    Title: 'Ultra-low latency inference on edge MCU',
    Year: 2023,
    Publisher: 'IEEE Transactions',
    Authors: 'Zhang, L., Smith, K.',
    Import_Source: 'IEEE Xplore',
    Local_PDF_Status: 'DOWNLOADED',
    citation_count: 14,
    manual_stage: 4,
    ai_stage: 4,
    manual_extracted_data: JSON.stringify({
      rq_latency: '12ms, 15ms peak',
      rq_memory: '256 KB SRAM',
      rq_power: '45mW',
      explicit_envelope: 'Strict Real-time',
      taxonomy_tree: 'Edge AI : Microcontrollers : Cortex-M4'
    }),
    manual_quality_assessment: JSON.stringify({
      qa_scores: {
        QA1: 1,
        QA2: 1,
        QA3: 0.5,
        QA4: 1
      }
    })
  },
  {
    Paper_ID: 'P02',
    Title: 'Battery-less sensor node for greenhouse monitoring',
    Year: 2024,
    Publisher: 'Elsevier Computers & Electronics in Agriculture',
    Authors: 'Patel, R., Tanaka, H.',
    Import_Source: 'Scopus',
    Local_PDF_Status: 'DOWNLOADED',
    citation_count: 8,
    manual_stage: 4,
    ai_stage: 3,
    manual_extracted_data: JSON.stringify({
      rq_latency: '450ms',
      rq_memory: '512 KB Flash',
      rq_power: '12uW Solar Harvester',
      narrowband_lpwan: 'LoRaWAN EU868',
      agricultural_focus: 'Greenhouse Tomato',
      taxonomy_tree: 'Agriculture : Precision Farming : Soil Moisture'
    }),
    manual_quality_assessment: JSON.stringify({
      qa_scores: {
        QA1: 1,
        QA2: 1,
        QA3: 1,
        QA4: 1
      }
    })
  },
  {
    Paper_ID: 'P03',
    Title: 'Harsh environment thermal dissipation in edge nodes',
    Year: 2022,
    Publisher: 'ACM Transactions on Embedded Systems',
    Authors: 'Müller, F.',
    Import_Source: 'ACM Digital Library',
    Local_PDF_Status: 'DOWNLOADED',
    citation_count: 22,
    manual_stage: 0,
    ai_stage: 4,
    ai_extracted_data: JSON.stringify({
      rq_memory: '1 MB DRAM',
      rq_power: '2.1W Active',
      harsh_environment: 'IP67 Waterproof, Dust',
      thermal_dissipation: 'Passive Heatsink',
      taxonomy_tree: 'Industrial IoT : Rugged Hardware : Enclosures'
    }),
    ai_quality_assessment: JSON.stringify({
      qa_scores: {
        QA1: 1,
        QA2: 0,
        QA3: 0.5,
        QA4: 0.5
      }
    })
  }
];

// 1. Test discoverCohortVariables
console.log('1. Testing discoverCohortVariables...');
const discovered = discoverCohortVariables(mockCohort);
assert.equal(discovered.totalCohortCount, 3, 'Total cohort count must equal 3');
assert.ok(discovered.variables.length > 10, 'Should discover metadata, QA, and extracted keys');
assert.ok(discovered.extractedKeys.includes('rq_latency'), 'Discovered extracted keys should include rq_latency');
assert.ok(discovered.extractedKeys.includes('rq_memory'), 'Discovered extracted keys should include rq_memory');

// Check calculated stats on discovered variables
const latencyVar = discovered.variablesByKey.get('ext:macro:rq_latency') || discovered.variablesByKey.get('rq_latency');
assert.ok(latencyVar, 'Latency variable must be indexed');
assert.equal(latencyVar.positivePaperCount, 2, 'rq_latency is in P01 and P02 (2 papers)');
assert.equal(latencyVar.prevalencePct, 67, '2/3 papers is 67% prevalence');

// Check stage dominance on P03 (ai_stage 4 > manual_stage 0)
const thermalVar = discovered.variablesByKey.get('thermal_dissipation') || discovered.variablesByKey.get('ext:thermal_dissipation');
assert.ok(thermalVar, 'AI-extracted thermal_dissipation should be discovered when ai_stage > manual_stage');
assert.equal(thermalVar.positivePaperCount, 1, 'Thermal dissipation is in P03');

// 2. Test resolveCohortFieldValue (Universal Resolver)
console.log('2. Testing resolveCohortFieldValue prefix-agnostic resolution...');

// Standard metadata
const p1Years = resolveCohortFieldValue(mockCohort[0], 'Year');
assert.deepEqual(p1Years, ['2023'], 'Resolves Year directly');

const p1Pub = resolveCohortFieldValue(mockCohort[0], 'Publisher');
assert.deepEqual(p1Pub, ['IEEE Transactions'], 'Resolves Publisher directly');

// Extracted data with explicit prefix
const p1LatExt = resolveCohortFieldValue(mockCohort[0], 'ext:rq_latency');
assert.ok(p1LatExt.length > 0, 'Resolves with ext: prefix');
assert.ok(p1LatExt[0].includes('12ms'), 'Extracted token resolved');

// Extracted data WITHOUT prefix (un-prefixed fallback)
const p1LatNoPrefix = resolveCohortFieldValue(mockCohort[0], 'rq_latency');
assert.deepEqual(p1LatNoPrefix, p1LatExt, 'Un-prefixed lookup resolves identically to ext: lookup');

// Underscore / space tolerance
const p1LatSpaced = resolveCohortFieldValue(mockCohort[0], 'rq latency');
assert.deepEqual(p1LatSpaced, p1LatExt, 'Spaced lookup resolves identically to underscore key');

// QA Scores resolution
const p1OverallQA = resolveCohortFieldValue(mockCohort[0], 'Overall_QA');
assert.equal(p1OverallQA[0], '3.5', 'P01 Overall QA score 1+1+0.5+1 = 3.5');

const p1QA3 = resolveCohortFieldValue(mockCohort[0], 'QA3');
assert.deepEqual(p1QA3, ['0.5'], 'P01 QA3 criterion = 0.5');

// 3. Test validateCohortDataIntegrity
console.log('3. Testing validateCohortDataIntegrity & Near-Miss Suggestions...');

const testKeys = [
  'rq_latency',                 // Valid key
  'Overall_QA',                 // Valid QA key
  'latency',                    // Typo near-miss
  'completely_nonexistent_xyz'  // Zero-hit key
];

const integrityReports = validateCohortDataIntegrity(mockCohort, testKeys);

// Valid key check
const latReport = integrityReports.get('rq_latency');
assert.ok(latReport.isValid, 'rq_latency is valid');
assert.equal(latReport.hasZeroHits, false, 'rq_latency has positive hits');
assert.equal(latReport.positivePaperCount, 2, 'rq_latency count is 2');

// Typo near-miss suggestion check
const typoReport = integrityReports.get('latency');
assert.ok(typoReport.hasZeroHits, 'Typo key "latency" has 0 hits directly');
assert.ok(typoReport.suggestedKeys.length > 0, 'Typo key should produce near-miss candidates');
assert.ok(typoReport.suggestedKeys.some(s => s.key.includes('rq_latency')), 'Suggestion includes rq_latency');

// Format Display Name
console.log('4. Testing formatVariableDisplayName...');
assert.equal(formatVariableDisplayName('ext:macro:execution_latency'), 'Execution Latency [Level 1: Macro Domain]');
assert.equal(formatVariableDisplayName('ext:sub:static_memory'), 'Static Memory [Level 2: Sub-Category]');
assert.equal(formatVariableDisplayName('ext:leaf:power_profiling'), 'Power Profiling [Level 3: Taxonomy Leaf / Tail]');
assert.equal(formatVariableDisplayName('qa:QA1'), 'QA1 [QA Appraisal Criterion]');
assert.equal(formatVariableDisplayName(CUSTOM_GROUPING_KEY), CUSTOM_GROUPING_LABEL);

console.log('✓ All Cohort Data Source & Validation tests PASSED successfully!');
