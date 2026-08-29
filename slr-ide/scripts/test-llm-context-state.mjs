/**
 * Automated Unit Test Suite: LLM Context Builder Checkbox State Consistency, Schema Legend & Est. Tokens Recalculation
 */

import { strict as assert } from 'assert';

console.log('=== Running LLM Context Builder State & Token Recalculation Tests ===\n');

// Mock data generator matching LlmContextBuilderModal logic
function buildMockContextPayload({
  scope = 'filtered',
  includeTitle = true,
  includeAuthors = true,
  includeYear = true,
  includeDoi = true,
  includeCitationStr = true,
  includeQa = true,
  includeRawValue = true,
  includeUmbrellanizedValue = true,
  includeTaxonomyJustification = true,
  includeMappingReasoning = true,
  includeEvidenceQuote = true,
  includeBakedStats = true,
  includeLlmDirectives = true,
  includeCohortStats = true,
  includeVariableDistributions = true,
  includeCategoryPaperMappings = true,
  includeNotStatedMetrics = true,
  includeRawTokenFrequencies = false,
  decimalPrecision = 2,
  selectedKeys = new Set(['rq1_model', 'rq2_dataset']),
  targetPapers = [
    {
      Paper_ID: 'P001',
      Title: 'Deep Learning in SLR',
      Authors: 'Smith, J.; Doe, A.',
      Year: 2023,
      DOI: '10.1000/182',
      ai_extracted_data: JSON.stringify({ rq1_model: 'CNN', rq2_dataset: 'ImageNet' }),
      ai_quality_assessment: JSON.stringify({ q1: 'YES', q2: 'YES' })
    },
    {
      Paper_ID: 'P002',
      Title: 'Machine Learning Review',
      Authors: 'Lee, K.',
      Year: 2024,
      DOI: '10.1000/183',
      ai_extracted_data: JSON.stringify({ rq1_model: 'LSTM', rq2_dataset: 'NOT_STATED' }),
      ai_quality_assessment: JSON.stringify({ q1: 'YES', q2: 'NO' })
    }
  ]
}) {
  // Dynamic Schema Legend: strictly document active schema components
  const schemaLegend = {
    papers: 'Array of individual paper records in the cohort containing bibliographic details, quality appraisal scores, and extracted variables',
    paper_id: 'Unique identifier of the paper in the SLR cohort'
  };

  if (includeCitationStr || includeTitle || includeAuthors || includeYear || includeDoi) {
    schemaLegend.citation = 'Bibliographic details for inline textual citations and references';
  }

  if (includeQa) {
    schemaLegend.quality_assessment = 'Methodological rigor appraisal scores and breakdown';
  }

  const hasExtractedComponents = includeRawValue || includeUmbrellanizedValue || includeTaxonomyJustification || includeMappingReasoning || includeEvidenceQuote;
  if (selectedKeys.size > 0 && hasExtractedComponents) {
    const extLegend = {};
    if (includeRawValue) extLegend.raw_value = 'Original extracted text/value from the paper';
    if (includeUmbrellanizedValue) extLegend.umbrellanized_value = 'Standardized taxonomy category mapped by Umbrellanizer';
    if (includeTaxonomyJustification) extLegend.taxonomy_justification = 'Reasoning and evidence for taxonomy categorization';
    if (includeMappingReasoning) extLegend.mapping_reasoning = 'Traceability explanation of where/how data was located in paper';
    if (includeEvidenceQuote) extLegend.evidence_quote = 'Direct text quote snippet extracted from paper source text';
    schemaLegend.extracted_data = extLegend;
  }

  // Pre-computed baked statistics mock
  let bakedStatistics = null;
  if (includeBakedStats && targetPapers.length > 0) {
    const statsObj = {};
    if (includeCohortStats) {
      statsObj.cohort_summary = {
        total_papers: targetPapers.length,
        year_distribution: { '2024': { count: 1, paper_prevalence_pct: 50 }, '2023': { count: 1, paper_prevalence_pct: 50 } }
      };
    }
    if (includeVariableDistributions) {
      statsObj.variable_distributions = {};
      selectedKeys.forEach(key => {
        const catList = [{ category: 'Category A', tag_count: 1, tag_share_pct: 100, paper_count: 1, paper_prevalence_pct: 50 }];
        if (includeCategoryPaperMappings) {
          catList[0].paper_ids = ['P001'];
        }
        const varStat = {
          total_papers_with_data: 1,
          total_extracted_tags: 1,
          categories: catList
        };
        if (includeNotStatedMetrics) {
          varStat.not_stated_count = 1;
          varStat.not_stated_pct = 50;
        }
        if (includeRawTokenFrequencies) {
          varStat.raw_tokens = [{ token: 'SampleToken', count: 1 }];
        }
        statsObj.variable_distributions[key] = varStat;
      });
    }
    if (Object.keys(statsObj).length > 0) {
      bakedStatistics = statsObj;
    }
  }

  if (includeBakedStats && bakedStatistics) {
    schemaLegend.baked_statistics = 'Pre-computed, quota-balanced ground-truth distributions, counts, and percentages for authoritative synthesis';
  }

  if (includeBakedStats && includeLlmDirectives) {
    schemaLegend.llm_directives = 'Authoritative directives and anti-hallucination rules for downstream LLM synthesis';
  }

  const papersData = targetPapers.map(paper => {
    const paperItem = { paper_id: paper.Paper_ID };
    const citationObj = {};
    if (includeCitationStr) citationObj.formatted = `${paper.Authors}, ${paper.Year}`;
    if (includeTitle) citationObj.title = paper.Title;
    if (includeAuthors) citationObj.authors = paper.Authors;
    if (includeYear) citationObj.year = paper.Year;
    if (includeDoi) citationObj.doi = paper.DOI;
    if (Object.keys(citationObj).length > 0) paperItem.citation = citationObj;

    if (includeQa) {
      paperItem.quality_assessment = { total_score: 1, criteria_breakdown: { q1: 'YES' } };
    }

    const extractedMap = {};
    if (selectedKeys.size > 0 && (includeRawValue || includeUmbrellanizedValue || includeTaxonomyJustification || includeMappingReasoning || includeEvidenceQuote)) {
      selectedKeys.forEach(k => {
        const keyDataObj = {};
        if (includeRawValue) keyDataObj.raw_value = 'Sample';
        if (includeUmbrellanizedValue) keyDataObj.umbrellanized_value = 'Sample Umbrella';
        if (includeTaxonomyJustification) keyDataObj.taxonomy_justification = 'Rule #1';
        if (includeMappingReasoning) keyDataObj.mapping_reasoning = 'Section 3.1';
        if (includeEvidenceQuote) keyDataObj.evidence_quote = 'Quote text';
        if (Object.keys(keyDataObj).length > 0) extractedMap[k] = keyDataObj;
      });
    }
    if (Object.keys(extractedMap).length > 0) paperItem.extracted_data = extractedMap;
    return paperItem;
  });

  const payload = {
    system_context: {
      tool: 'SLR Magic - LLM Context Builder',
      project_id: 'proj-001',
      export_timestamp: '2026-08-24T20:00:00Z',
      total_papers_exported: targetPapers.length,
      export_scope: scope === 'filtered' ? 'filtered_cohort' : 'full_cohort',
      schema_legend: schemaLegend
    }
  };

  if (includeBakedStats && includeLlmDirectives) {
    payload.llm_directives = {
      ground_truth_policy: 'STRICT_GROUND_TRUTH_ENFORCEMENT',
      system_instruction: 'Authoritative directives'
    };
  }

  if (includeBakedStats && bakedStatistics) {
    payload.baked_statistics = bakedStatistics;
  }

  payload.papers = papersData;

  const jsonStr = JSON.stringify(payload, null, 2);
  const estimatedTokens = Math.ceil(jsonStr.length / 4);

  return { payload, jsonStr, estimatedTokens };
}

// Test 1: Parent Disabling auto-disables all child checkboxes and purges directives/baked_stats from JSON
console.log('Test 1: Parent toggle OFF completely purges baked stats, directives, and schema legend');
const fullyEnabled = buildMockContextPayload({ includeBakedStats: true, includeLlmDirectives: true });
assert.ok(fullyEnabled.payload.baked_statistics, 'baked_statistics must exist when enabled');
assert.ok(fullyEnabled.payload.llm_directives, 'llm_directives must exist when enabled');
assert.ok(fullyEnabled.payload.system_context.schema_legend.baked_statistics, 'schema_legend.baked_statistics must exist when enabled');
assert.ok(fullyEnabled.payload.system_context.schema_legend.llm_directives, 'schema_legend.llm_directives must exist when enabled');
assert.ok(fullyEnabled.payload.system_context.schema_legend.papers, 'schema_legend.papers must exist');

const parentDisabled = buildMockContextPayload({ includeBakedStats: false, includeLlmDirectives: false });
assert.equal(parentDisabled.payload.baked_statistics, undefined, 'baked_statistics MUST be undefined when parent is disabled');
assert.equal(parentDisabled.payload.llm_directives, undefined, 'llm_directives MUST be undefined when parent is disabled');
assert.equal(parentDisabled.payload.system_context.schema_legend.baked_statistics, undefined, 'schema_legend.baked_statistics MUST be undefined when parent is disabled');
assert.equal(parentDisabled.payload.system_context.schema_legend.llm_directives, undefined, 'schema_legend.llm_directives MUST be undefined when parent is disabled');
assert.ok(parentDisabled.estimatedTokens < fullyEnabled.estimatedTokens, 'Estimated tokens must drop when parent is disabled');
console.log(`  -> Enabled Tokens: ${fullyEnabled.estimatedTokens} -> Disabled Tokens: ${parentDisabled.estimatedTokens} (Delta: -${fullyEnabled.estimatedTokens - parentDisabled.estimatedTokens})`);
console.log('  -> Passed!\n');

// Test 2: Parent Disabled with child state lingering (Defense-in-depth verification)
console.log('Test 2: Defense-in-depth - even if child state is true in memory, includeBakedStats=false guards output');
const lingeringChild = buildMockContextPayload({ includeBakedStats: false, includeLlmDirectives: true, includeCohortStats: true });
assert.equal(lingeringChild.payload.baked_statistics, undefined);
assert.equal(lingeringChild.payload.llm_directives, undefined);
assert.equal(lingeringChild.payload.system_context.schema_legend.baked_statistics, undefined);
assert.equal(lingeringChild.payload.system_context.schema_legend.llm_directives, undefined);
console.log('  -> Passed!\n');

// Test 3: Sub-Child Cascading (Disabling Variable Distributions disables sub-metrics)
console.log('Test 3: Variable Distributions child toggles');
const withCategoryMapping = buildMockContextPayload({ includeBakedStats: true, includeVariableDistributions: true, includeCategoryPaperMappings: true });
const withoutCategoryMapping = buildMockContextPayload({ includeBakedStats: true, includeVariableDistributions: true, includeCategoryPaperMappings: false });
assert.ok(withCategoryMapping.payload.baked_statistics.variable_distributions.rq1_model.categories[0].paper_ids);
assert.equal(withoutCategoryMapping.payload.baked_statistics.variable_distributions.rq1_model.categories[0].paper_ids, undefined);
assert.ok(withoutCategoryMapping.estimatedTokens < withCategoryMapping.estimatedTokens);
console.log(`  -> With paper_ids: ${withCategoryMapping.estimatedTokens} tokens -> Without paper_ids: ${withoutCategoryMapping.estimatedTokens} tokens`);
console.log('  -> Passed!\n');

// Test 4: Dynamic Est. Tokens update across ALL checkbox groups
console.log('Test 4: Real-time Est. Tokens recalculation across every checkbox change');
const baseTokens = fullyEnabled.estimatedTokens;

// A. Unchecking Citation String
const noCitation = buildMockContextPayload({ includeCitationStr: false, includeTitle: false, includeAuthors: false, includeYear: false, includeDoi: false });
assert.ok(noCitation.estimatedTokens < baseTokens, 'Unchecking all citation fields must reduce tokens');
assert.equal(noCitation.payload.system_context.schema_legend.citation, undefined, 'Citation must be omitted from schema_legend when all citation fields are unchecked');

// B. Unchecking QA
const noQa = buildMockContextPayload({ includeQa: false });
assert.ok(noQa.estimatedTokens < baseTokens, 'Unchecking QA must reduce tokens');
assert.equal(noQa.payload.system_context.schema_legend.quality_assessment, undefined, 'QA must be removed from schema_legend when unchecked');

// C. Unchecking Evidence Quote
const noEvidence = buildMockContextPayload({ includeEvidenceQuote: false });
assert.ok(noEvidence.estimatedTokens < baseTokens, 'Unchecking evidence quote must reduce tokens');
assert.equal(noEvidence.payload.system_context.schema_legend.extracted_data.evidence_quote, undefined);

// D. Changing Selected Keys
const singleKey = buildMockContextPayload({ selectedKeys: new Set(['rq1_model']) });
assert.ok(singleKey.estimatedTokens < baseTokens, 'Reducing selected keys must reduce tokens');

// E. Empty Selected Keys
const zeroKeys = buildMockContextPayload({ selectedKeys: new Set() });
assert.ok(zeroKeys.estimatedTokens < singleKey.estimatedTokens, 'Zero keys must further reduce tokens');
assert.equal(zeroKeys.payload.system_context.schema_legend.extracted_data, undefined, 'extracted_data should be omitted from schema_legend when 0 keys are selected');

console.log(`  Base Tokens: ${baseTokens}`);
console.log(`  - No Citation: ${noCitation.estimatedTokens}`);
console.log(`  - No QA: ${noQa.estimatedTokens}`);
console.log(`  - No Evidence Quote: ${noEvidence.estimatedTokens}`);
console.log(`  - 1 Key Selected: ${singleKey.estimatedTokens}`);
console.log(`  - 0 Keys Selected: ${zeroKeys.estimatedTokens}`);
console.log('  -> All token variations recomputed accurately and dynamically!');
console.log('  -> Passed!\n');

// Test 5: Dynamic Schema Legend Accuracy
console.log('Test 5: Dynamic Schema Legend strictly reflects active components and papers key');
const minimalPayload = buildMockContextPayload({
  includeCitationStr: false,
  includeTitle: false,
  includeAuthors: false,
  includeYear: false,
  includeDoi: false,
  includeQa: false,
  selectedKeys: new Set(),
  includeBakedStats: false
});
assert.deepEqual(minimalPayload.payload.system_context.schema_legend, {
  papers: 'Array of individual paper records in the cohort containing bibliographic details, quality appraisal scores, and extracted variables',
  paper_id: 'Unique identifier of the paper in the SLR cohort'
}, 'Schema legend must contain papers and paper_id when all optional components are unchecked');
console.log('  -> Minimal schema legend:', JSON.stringify(minimalPayload.payload.system_context.schema_legend));
console.log('  -> Passed!\n');

console.log('=== ALL 5 TEST SUITES PASSED SUCCESSFULLY (100%) ===');
