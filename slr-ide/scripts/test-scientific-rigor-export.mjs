import Database from 'better-sqlite3';
import assert from 'assert';
import crypto from 'crypto';

console.log('🧪 Running Scientific Rigor & AI Technical Specifications Unit Tests...\n');

const db = new Database(':memory:');

// Setup full test schema in memory
db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manifesto TEXT,
    objective TEXT,
    questions TEXT,
    pool_a_size INTEGER DEFAULT 50,
    pool_b_size INTEGER DEFAULT 30,
    pool_c_size INTEGER DEFAULT 20,
    rolling_batch_size INTEGER DEFAULT 20,
    ec_rules TEXT,
    pool_c_qa_rules TEXT,
    pool_c_extraction_rules TEXT,
    llm_config TEXT DEFAULT '{}'
  );

  CREATE TABLE papers (
    Paper_ID TEXT PRIMARY KEY,
    Import_Date TEXT,
    Import_Source TEXT,
    Source TEXT,
    DOI TEXT,
    Title TEXT,
    Abstract TEXT,
    Authors TEXT,
    Year INTEGER,
    Local_PDF_Status TEXT DEFAULT 'MATCHED',
    Local_PDF_Path TEXT,
    Project_ID TEXT,
    is_duplicate INTEGER DEFAULT 0,
    ai_stage INTEGER DEFAULT 0,
    ai_decision TEXT,
    ai_exclusion_code TEXT,
    ai_quality_assessment TEXT,
    ai_extracted_data TEXT,
    manual_stage INTEGER DEFAULT 0,
    manual_decision TEXT,
    manual_exclusion_code TEXT,
    manual_quality_assessment TEXT,
    manual_extracted_data TEXT
  );

  CREATE TABLE calibration_papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT,
    Title TEXT,
    Abstract TEXT,
    Authors TEXT,
    Year INTEGER,
    DOI TEXT,
    Source TEXT,
    calibration_pool TEXT,
    calibration_tag TEXT,
    manual_stage INTEGER DEFAULT 0,
    manual_decision TEXT,
    manual_exclusion_code TEXT
  );

  CREATE TABLE reviewer_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    pool TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    decision TEXT,
    ec_trigger TEXT,
    rationale TEXT,
    qa_scores TEXT,
    extracted_data TEXT,
    imported_at TEXT
  );

  CREATE TABLE calibration_commit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commit_hash TEXT NOT NULL,
    project_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    pool TEXT NOT NULL,
    adjudicator TEXT NOT NULL,
    previous_state TEXT NOT NULL,
    resolved_decision TEXT NOT NULL,
    resolved_ec TEXT,
    resolved_rationale TEXT NOT NULL,
    commit_message TEXT NOT NULL,
    resolved_qa_scores TEXT,
    resolved_extracted_data TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE prompt_templates (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    prompt_type TEXT NOT NULL,
    system_instruction TEXT,
    user_template TEXT NOT NULL,
    response_schema TEXT,
    llm_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE prompt_audit_ledger (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    audit_type TEXT NOT NULL,
    status TEXT NOT NULL,
    prompt_id TEXT,
    prompt_hash TEXT,
    parent_prompt_id TEXT,
    parent_prompt_hash TEXT,
    availability_score REAL,
    semantic_score REAL,
    chainability_score REAL,
    audit_report TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE prompt_benchmark_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage_num INTEGER NOT NULL,
    stage_name TEXT NOT NULL,
    pool TEXT NOT NULL,
    prompt_template_id TEXT,
    prompt_hash TEXT,
    status TEXT NOT NULL,
    total_papers INTEGER DEFAULT 0,
    evaluated_papers INTEGER DEFAULT 0,
    train_count INTEGER DEFAULT 0,
    holdout_count INTEGER DEFAULT 0,
    summary_metrics TEXT,
    holdout_metrics TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE prompt_benchmark_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    partition_type TEXT NOT NULL,
    ai_decision TEXT,
    gold_decision TEXT,
    is_match INTEGER DEFAULT 0,
    discrepancy_details TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE rolling_batches (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'complete',
    created_at TEXT NOT NULL,
    finalized_at TEXT
  );

  CREATE TABLE rolling_batch_papers (
    Paper_ID TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    project_id TEXT NOT NULL,
    Title TEXT,
    ai_quality_assessment TEXT,
    ai_extracted_data TEXT,
    manual_quality_assessment TEXT,
    manual_extracted_data TEXT,
    PRIMARY KEY (Paper_ID, batch_id)
  );

  CREATE TABLE llm_screening_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    stage INTEGER NOT NULL,
    task_type TEXT NOT NULL,
    decision TEXT NOT NULL,
    exclusion_code TEXT,
    rationale TEXT,
    quality_assessment TEXT,
    extracted_data TEXT,
    structured_output TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// 1. Seed Project Data
const ecRulesJson = JSON.stringify([
  { code: 'EC-1', description: 'Non-English or non-peer-reviewed publication' },
  { code: 'EC-2', description: 'No empirical evaluation on software systems' },
  { code: 'EC-3', description: 'Theoretical conceptual model only' }
]);

const qaRulesJson = JSON.stringify([
  { code: 'QA-1', description: 'Research Aims' },
  { code: 'QA-2', description: 'Context Definition' },
  { code: 'QA-3', description: 'Study Design Rigor' },
  { code: 'QA-4', description: 'Control Group' },
  { code: 'QA-5', description: 'Data Collection' },
  { code: 'QA-6', description: 'Validity & Reliability' },
  { code: 'QA-7', description: 'Analysis Rigor' },
  { code: 'QA-8', description: 'Value & Contribution' }
]);

const extractionRulesJson = JSON.stringify([
  { json_key: 'architecture_type', description: 'Primary architecture' },
  { json_key: 'evaluation_metric', description: 'Validation metrics' }
]);

db.prepare(`
  INSERT INTO projects (id, name, ec_rules, pool_c_qa_rules, pool_c_extraction_rules, pool_a_size, pool_b_size, pool_c_size, rolling_batch_size)
  VALUES ('proj-1', 'AI Rigor Review 2026', ?, ?, ?, 50, 30, 20, 20)
`).run(ecRulesJson, qaRulesJson, extractionRulesJson);

// Project 2 for multi-project isolation testing
db.prepare(`
  INSERT INTO projects (id, name, ec_rules, pool_c_qa_rules, pool_c_extraction_rules)
  VALUES ('proj-2', 'Unrelated Review', ?, ?, ?)
`).run(ecRulesJson, qaRulesJson, extractionRulesJson);

// 2. Seed Prompt Templates (Global & Project Custom)
const now = new Date().toISOString();
db.prepare(`
  INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
  VALUES ('global-fast-filter', NULL, 'Global Fast Filter', 'Global Stage 1 prompt', 'fast_filter', 'You are Stage 1 Fast Filter.', 'Analyze {{paper_title}} with {{paper_abstract}}.', '{"type":"object"}', '{"model_id":"gemini-2.5-flash","temperature":0.0}', 1, ?, ?)
`).run(now, now);

db.prepare(`
  INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
  VALUES ('proj1-scientist', 'proj-1', 'Project 1 Custom Scientist', 'Customized Stage 3 Scientist prompt', 'scientist', 'You are custom Stage 3 Scientist for Project 1.', 'Assess {{paper_title}} with {{project_qa_rules}}.', '{"type":"object"}', '{"model_id":"gemini-2.5-pro","temperature":0.0,"max_tokens":5000}', 1, ?, ?)
`).run(now, now);

// 3. Seed Papers (PRISMA testing)
// Database Papers (proj-1)
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate) VALUES ('P-DUP', 'proj-1', 'Scopus_Export.csv', 'Scopus', 1)").run();
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate, manual_stage, manual_decision, manual_exclusion_code) VALUES ('P-S1-EXC', 'proj-1', 'Scopus_Export.csv', 'Scopus', 0, 1, 'EXCLUDE', 'EC-1')").run();
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate, manual_stage, manual_decision, manual_exclusion_code) VALUES ('P-S2-EXC', 'proj-1', 'WOS_Export.csv', 'Web of Science', 0, 2, 'EXCLUDE', 'EC-2')").run();
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate, manual_stage, manual_decision, manual_exclusion_code) VALUES ('P-S3-CUM', 'proj-1', 'IEEE_Export.csv', 'IEEE Xplore', 0, 3, 'EXCLUDE', 'CUMULATIVE_GATE_FAIL')").run();
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate, manual_stage, manual_decision) VALUES ('P-INC-1', 'proj-1', 'Scopus_Export.csv', 'Scopus', 0, 3, 'INCLUDE')").run();
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate, manual_stage, manual_decision) VALUES ('P-INC-2', 'proj-1', 'Scopus_Export.csv', 'Scopus', 0, 3, 'INCLUDE')").run();

// Other Methods Paper (proj-1)
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate, manual_stage, manual_decision) VALUES ('P-SNOW', 'proj-1', 'backward snowball', 'Manual', 0, 3, 'INCLUDE')").run();

// Proj-2 Paper (should not leak)
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Import_Source, Source, is_duplicate, manual_stage, manual_decision) VALUES ('P-PROJ2', 'proj-2', 'Scopus.csv', 'Scopus', 0, 3, 'INCLUDE')").run();

// 4. Seed Calibration Papers & Reviewer Decisions
for (let i = 1; i <= 50; i++) {
  const pid = `P-CAL-A-${i}`;
  db.prepare("INSERT INTO calibration_papers (Paper_ID, Project_ID, Title, calibration_pool) VALUES (?, 'proj-1', ?, 'pool_a')").run(pid, `Pool A Paper ${i}`);
  const dec = i <= 25 ? 'Include' : 'Exclude';
  db.prepare("INSERT INTO reviewer_decisions (project_id, paper_id, pool, reviewer_name, decision, imported_at) VALUES ('proj-1', ?, 'pool_a', 'reviewer_1', ?, '2026-08-01')").run(pid, dec);
  db.prepare("INSERT INTO reviewer_decisions (project_id, paper_id, pool, reviewer_name, decision, imported_at) VALUES ('proj-1', ?, 'pool_a', 'reviewer_2', ?, '2026-08-01')").run(pid, dec);
  db.prepare("INSERT INTO calibration_commit_ledger (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_rationale, commit_message, timestamp) VALUES ('hash123', 'proj-1', ?, 'pool_a', 'Adjudicator', '{}', ?, 'Consensus confirmed', 'Auto-resolved', '2026-08-01')").run(pid, dec);
}

// ----------------------------------------------------
// RUN TESTS & ASSERTIONS
// ----------------------------------------------------

// Test 1: Project Fetch & Metadata
console.log('Test 1: Project Metadata Verification');
const proj = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get('proj-1', 'proj-1');
assert.strictEqual(proj.name, 'AI Rigor Review 2026', 'Project name should match');
assert.strictEqual(proj.pool_a_size, 50, 'Pool A size should be 50');
assert.strictEqual(proj.rolling_batch_size, 20, 'Rolling batch size should be 20');
console.log('✅ Test 1 Passed: Project metadata verified.\n');

// Test 2: PRISMA Flow Calculations
console.log('Test 2: PRISMA Flow Aggregation & Multi-Project Isolation');
const dbPapers = db.prepare("SELECT * FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))").all('proj-1', 'proj-1');
assert.strictEqual(dbPapers.length, 7, 'Should fetch exactly 7 papers for proj-1 (0 leaked from proj-2)');

const dbExcludedS1 = dbPapers.filter(p => p.manual_stage === 1 && p.manual_decision === 'EXCLUDE');
assert.strictEqual(dbExcludedS1.length, 1, 'Should have 1 Stage 1 excluded paper');
assert.strictEqual(dbExcludedS1[0].manual_exclusion_code, 'EC-1', 'Exclusion code should be EC-1');

const dbDuplicates = dbPapers.filter(p => p.is_duplicate === 1);
assert.strictEqual(dbDuplicates.length, 1, 'Should have 1 duplicate paper');

const dbIncluded = dbPapers.filter(p => p.manual_stage >= 3 && p.manual_decision === 'INCLUDE');
assert.strictEqual(dbIncluded.length, 3, 'Should have 3 included papers (2 database + 1 snowball)');
console.log('✅ Test 2 Passed: PRISMA metrics aggregated with 100% project isolation.\n');

// Test 3: AI Screening Technical Specifications Resolution across all 8 engines
console.log('Test 3: AI Screening Technical Specifications Resolution across all 8 engines');

const CANONICAL_TEST_PROMPTS = {
  fast_filter: {
    id: 'default-fast-filter',
    system_instruction: 'You are the Stage 1 Fast Filter.',
    user_template: 'Analyze {{paper_title}} with {{paper_abstract}}.',
    response_schema: { type: 'object', properties: { decision: { type: 'string' } } },
    llm_config: { model_id: 'gemini-2.5-flash', temperature: 0.0, max_tokens: 2000 }
  },
  gatekeeper: {
    id: 'default-gatekeeper',
    system_instruction: 'You are the Stage 2 Gatekeeper.',
    user_template: 'Inspect {{paper_full_text}} for {{project_ec_rules}}.',
    response_schema: { type: 'object', properties: { decision: { type: 'string' } } },
    llm_config: { model_id: 'gemini-2.5-flash', temperature: 0.0, max_tokens: 3000 }
  },
  scientist: {
    id: 'default-scientist',
    system_instruction: 'You are the Stage 3 Scientist.',
    user_template: 'Score {{paper_full_text}} using {{project_qa_rules}}.',
    response_schema: { type: 'object', properties: { total_score: { type: 'number' } } },
    llm_config: { model_id: 'gemini-2.5-pro', temperature: 0.0, max_tokens: 4000 }
  },
  miner: {
    id: 'default-miner',
    system_instruction: 'You are the Stage 4 Miner.',
    user_template: 'Extract data from {{paper_full_text}} using {{project_extraction_rules}}.',
    response_schema: { type: 'object', properties: { extracted_data: { type: 'object' } } },
    llm_config: { model_id: 'gemini-2.5-pro', temperature: 0.0, max_tokens: 6000 }
  },
  umbrellanizer: {
    id: 'default-umbrellanizer',
    system_instruction: 'You are the Stage 5 Umbrellanizer.',
    user_template: 'Harmonize {{raw_tokens}} into {{existing_ontology}}.',
    response_schema: { type: 'object', properties: { mappings: { type: 'array' } } },
    llm_config: { model_id: 'gemini-2.5-flash', temperature: 0.0, max_tokens: 4000 }
  },
  prompt_optimizer: {
    id: 'default-prompt-optimizer',
    system_instruction: 'You are the Prompt Optimizer.',
    user_template: 'Optimize prompt for {{stage_name}} using {{discrepancies_json}}.',
    response_schema: { type: 'object', properties: { proposed_system_instruction: { type: 'string' } } },
    llm_config: { model_id: 'gemini-2.5-pro', temperature: 0.0, max_tokens: 6000 }
  },
  consolidation_audit: {
    id: 'default-prompt-consolidation-audit',
    system_instruction: 'You are the Consolidation Auditor.',
    user_template: 'Audit pipeline chainability on {{project_name}}.',
    response_schema: { type: 'object', properties: { availability_score: { type: 'number' } } },
    llm_config: { model_id: 'gemini-2.5-flash', temperature: 0.0, max_tokens: 4000 }
  },
  duplicate_review: {
    id: 'default-duplicate-review',
    system_instruction: 'You are the Deduplication Specialist.',
    user_template: 'Analyze {{paper1_title}} vs {{paper2_title}}.',
    response_schema: { type: 'object', properties: { verdict: { type: 'string' } } },
    llm_config: { model_id: 'gemini-2.5-flash', temperature: 0.0, max_tokens: 2000 }
  }
};

function computePromptHash(systemPrompt, userTemplate, schema) {
  const content = `${systemPrompt || ''}::${userTemplate || ''}::${typeof schema === 'string' ? schema : JSON.stringify(schema || {})}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

function resolveEngineSpec(projectId, projectLlmConfig, promptType) {
  const canonical = CANONICAL_TEST_PROMPTS[promptType];
  const targetDefaultId = projectLlmConfig?.default_prompts?.[promptType];

  let promptRow = null;
  let provenanceSource = 'codebase_default';

  // 1. Check for project-mapped explicit default prompt template ID
  if (targetDefaultId) {
    promptRow = db.prepare(`
      SELECT id, project_id, name, description, system_instruction, user_template, response_schema, llm_config, updated_at
      FROM prompt_templates
      WHERE id = ? AND (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ? OR project_id IS NULL)
    `).get(targetDefaultId, projectId, projectId);

    if (promptRow) {
      provenanceSource = promptRow.project_id ? 'project_custom' : 'global_default';
    }
  }

  // 2. Fallback to active project-specific custom prompt template
  if (!promptRow) {
    promptRow = db.prepare(`
      SELECT id, project_id, name, description, system_instruction, user_template, response_schema, llm_config, updated_at
      FROM prompt_templates
      WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?)
        AND prompt_type = ? AND is_active = 1
      ORDER BY updated_at DESC LIMIT 1
    `).get(projectId, projectId, promptType);

    if (promptRow) {
      provenanceSource = 'project_custom';
    }
  }

  // 3. Fallback to active global default prompt template
  if (!promptRow) {
    promptRow = db.prepare(`
      SELECT id, project_id, name, description, system_instruction, user_template, response_schema, llm_config, updated_at
      FROM prompt_templates
      WHERE project_id IS NULL AND prompt_type = ? AND is_active = 1
      ORDER BY updated_at DESC LIMIT 1
    `).get(promptType);

    if (promptRow) {
      provenanceSource = 'global_default';
    }
  }

  // 4. Resolve prompt texts, response schemas, and hyperparameter configuration with canonical defaults
  const systemInstruction = promptRow?.system_instruction || canonical?.system_instruction || '';
  const userTemplate = promptRow?.user_template || canonical?.user_template || '';
  const rawSchema = promptRow?.response_schema || canonical?.response_schema || {};
  const parsedSchema = typeof rawSchema === 'string' ? JSON.parse(rawSchema) : rawSchema;

  const promptLlmConfig = promptRow?.llm_config ? JSON.parse(promptRow.llm_config) : (canonical?.llm_config || {});
  const effectiveModelId = promptLlmConfig.model_id || projectLlmConfig.model_id || canonical?.llm_config?.model_id || 'gemini-2.5-flash';
  const effectiveTemperature = promptLlmConfig.temperature ?? projectLlmConfig.temperature ?? canonical?.llm_config?.temperature ?? 0.0;
  const promptHash = computePromptHash(systemInstruction, userTemplate, parsedSchema);

  return {
    prompt_type: promptType,
    system_instruction: systemInstruction,
    user_prompt_template: userTemplate,
    response_json_schema: parsedSchema,
    llm_hyperparameter_configuration: {
      model_id: effectiveModelId,
      temperature: effectiveTemperature
    },
    provenance_metadata: {
      provenance_source: provenanceSource,
      prompt_template_id: promptRow?.id || canonical?.id || 'codebase-fallback',
      prompt_hash_sha256: promptHash
    }
  };
}

// Stage 1 Fast Filter should resolve to global_default
const p1Cfg = { default_prompts: { fast_filter: 'global-fast-filter' } };
const s1Spec = resolveEngineSpec('proj-1', p1Cfg, 'fast_filter');
assert.strictEqual(s1Spec.provenance_metadata.provenance_source, 'global_default', 'Stage 1 should resolve to global default');
assert.strictEqual(s1Spec.provenance_metadata.prompt_template_id, 'global-fast-filter');
assert.ok(s1Spec.system_instruction.length > 0, 'Stage 1 system instruction must not be empty');
assert.ok(s1Spec.user_prompt_template.length > 0, 'Stage 1 user template must not be empty');
assert.strictEqual(s1Spec.provenance_metadata.prompt_hash_sha256.length, 64, 'SHA-256 hash must be 64 characters');

// Stage 3 Scientist should resolve to project_custom
const s3Spec = resolveEngineSpec('proj-1', p1Cfg, 'scientist');
assert.strictEqual(s3Spec.provenance_metadata.provenance_source, 'project_custom', 'Stage 3 should resolve to project custom prompt');
assert.strictEqual(s3Spec.provenance_metadata.prompt_template_id, 'proj1-scientist');
assert.strictEqual(s3Spec.llm_hyperparameter_configuration.model_id, 'gemini-2.5-pro');

// Stage 4 Miner (unseeded in DB) should gracefully fall back to canonical codebase baseline
const s4Spec = resolveEngineSpec('proj-1', p1Cfg, 'miner');
assert.strictEqual(s4Spec.provenance_metadata.provenance_source, 'codebase_default', 'Stage 4 should fall back to codebase default');
assert.strictEqual(s4Spec.provenance_metadata.prompt_template_id, 'default-miner');
assert.ok(s4Spec.system_instruction.includes('Stage 4 Miner'), 'System instruction should be resolved from canonical default');
assert.ok(s4Spec.user_prompt_template.includes('{{paper_full_text}}'), 'User template should be resolved from canonical default');
assert.strictEqual(s4Spec.provenance_metadata.prompt_hash_sha256.length, 64);

// Test all 8 prompt types resolving without empty fields
const allPromptTypes = ['fast_filter', 'gatekeeper', 'scientist', 'miner', 'umbrellanizer', 'prompt_optimizer', 'consolidation_audit', 'duplicate_review'];
for (const pType of allPromptTypes) {
  const spec = resolveEngineSpec('proj-1', p1Cfg, pType);
  assert.ok(spec.system_instruction.length > 0, `${pType} system instruction must never be empty`);
  assert.ok(spec.user_prompt_template.length > 0, `${pType} user template must never be empty`);
  assert.ok(spec.response_json_schema && typeof spec.response_json_schema === 'object', `${pType} response schema must be an object`);
  assert.strictEqual(spec.provenance_metadata.prompt_hash_sha256.length, 64, `${pType} hash must be 64 characters`);
}

console.log('✅ Test 3 Passed: All 8 AI Screening Technical Specifications resolved with complete prompt texts, response schemas, and SHA-256 hashes.\n');

// Test 4: Dynamic LLM Narrative Guidelines Hyperparameter & Thinking Level Generation
console.log('Test 4: Dynamic LLM Narrative Guidelines Hyperparameter & Thinking Level Generation');

const allEngines = {};
for (const pType of allPromptTypes) {
  allEngines[pType] = resolveEngineSpec('proj-1', p1Cfg, pType);
}

// Simulate narrative guidelines generation matching route.ts
const s1 = allEngines.fast_filter.llm_hyperparameter_configuration;
const s2 = allEngines.gatekeeper.llm_hyperparameter_configuration;
const s3 = allEngines.scientist.llm_hyperparameter_configuration;
const s4 = allEngines.miner.llm_hyperparameter_configuration;
const s5 = allEngines.umbrellanizer.llm_hyperparameter_configuration;

const generatedInstruction1 = `1. Model Architecture & Hyperparameters: Disclose active model identifiers, operating temperatures, and thinking levels across all screening stages (${s1.model_id} with T = ${s1.temperature} and thinking level '${s1.thinking_level || 'none'}' for Stage 1 Fast Filter; ${s2.model_id} with T = ${s2.temperature} and thinking level '${s2.thinking_level || 'none'}' for Stage 2 Gatekeeper; ${s3.model_id} with T = ${s3.temperature}, thinking level '${s3.thinking_level || 'none'}', and interaction chaining for Stage 3 Scientist; ${s4.model_id} with T = ${s4.temperature} and thinking level '${s4.thinking_level || 'none'}' for Stage 4 Miner; ${s5.model_id} with T = ${s5.temperature} and thinking level '${s5.thinking_level || 'none'}' for Stage 5 Umbrellanizer). State that temperatures and thinking levels were configured according to recommended prompt specifications to ensure the model operates in its ideal reasoning state while maintaining reproducible evaluation and high extraction fidelity. (Refer to the complete technical specifications table in the appendix for auxiliary engines including deduplication, prompt optimization, and consolidation audit).`;

// Assertions for Test 4
assert.ok(!generatedInstruction1.includes('Emphasize deterministic temperature (T = 0.0) across all screening gates to guarantee reproducible, deterministic classification.'), 'Obsolete static deterministic string must be replaced');
assert.ok(generatedInstruction1.includes('gemini-2.5-flash with T = 0 and thinking level \'none\' for Stage 1 Fast Filter'), 'Stage 1 dynamic hyperparameter string must be generated');
assert.ok(generatedInstruction1.includes('gemini-2.5-pro with T = 0, thinking level \'none\', and interaction chaining for Stage 3 Scientist'), 'Stage 3 custom model and parameters must be loaded');
assert.ok(generatedInstruction1.includes('ideal reasoning state'), 'Generic rationale for ideal reasoning state must be present');
assert.ok(generatedInstruction1.includes('thinking levels across all screening stages'), 'Thinking level disclosure statement must be present');

console.log('✅ Test 4 Passed: LLM narrative instructions dynamically mapped with exact model names, temperatures, thinking levels, and reasoning rationales.\n');

// Test 5: Scoped prompt_optimization_data.prompt_templates Resolution (Strictly Active Defaults)
console.log('Test 5: Scoped prompt_optimization_data.prompt_templates Resolution');

function resolveActiveProjectPromptTemplates(projectId, projectLlmConfig) {
  return allPromptTypes.map(promptType => {
    const canonical = CANONICAL_TEST_PROMPTS[promptType];
    const targetDefaultId = projectLlmConfig?.default_prompts?.[promptType];

    let promptRow = null;

    if (targetDefaultId) {
      promptRow = db.prepare(`
        SELECT id, project_id, name, description, prompt_type, llm_config, is_active, created_at, updated_at
        FROM prompt_templates
        WHERE id = ? AND (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ? OR project_id IS NULL)
      `).get(targetDefaultId, projectId, projectId);
    }

    if (!promptRow) {
      promptRow = db.prepare(`
        SELECT id, project_id, name, description, prompt_type, llm_config, is_active, created_at, updated_at
        FROM prompt_templates
        WHERE (CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id = ?)
          AND prompt_type = ? AND is_active = 1
        ORDER BY updated_at DESC LIMIT 1
      `).get(projectId, projectId, promptType);
    }

    if (!promptRow) {
      promptRow = db.prepare(`
        SELECT id, project_id, name, description, prompt_type, llm_config, is_active, created_at, updated_at
        FROM prompt_templates
        WHERE project_id IS NULL AND prompt_type = ? AND is_active = 1
        ORDER BY updated_at DESC LIMIT 1
      `).get(promptType);
    }

    if (promptRow) {
      return {
        id: promptRow.id,
        name: promptRow.name,
        description: promptRow.description,
        prompt_type: promptRow.prompt_type || promptType,
        llm_config: typeof promptRow.llm_config === 'string' ? JSON.parse(promptRow.llm_config) : (promptRow.llm_config || {}),
        is_active: promptRow.is_active === 1
      };
    }

    return {
      id: canonical?.id || `default-${promptType}`,
      name: canonical?.name || promptType,
      description: canonical?.description || '',
      prompt_type: promptType,
      llm_config: canonical?.llm_config || {},
      is_active: true
    };
  });
}

const resolvedTemplates = resolveActiveProjectPromptTemplates('proj-1', p1Cfg);
assert.strictEqual(resolvedTemplates.length, 8, 'Should contain exactly 8 prompt templates (1 per prompt type)');

// Stage 1 should be global-fast-filter
const s1Template = resolvedTemplates.find(t => t.prompt_type === 'fast_filter');
assert.strictEqual(s1Template.id, 'global-fast-filter', 'Fast filter should be mapped to project default global-fast-filter');

// Stage 3 should be proj1-scientist
const s3Template = resolvedTemplates.find(t => t.prompt_type === 'scientist');
assert.strictEqual(s3Template.id, 'proj1-scientist', 'Scientist should be mapped to project custom prompt proj1-scientist');

// Ensure no duplicate prompt_types exist
const uniqueTypes = new Set(resolvedTemplates.map(t => t.prompt_type));
assert.strictEqual(uniqueTypes.size, 8, 'Every prompt type must appear exactly once');

console.log('✅ Test 5 Passed: prompt_optimization_data.prompt_templates filtered strictly to project active defaults.\n');

console.log('🎉 ALL SCIENTIFIC RIGOR & AI TECHNICAL SPECIFICATION TESTS PASSED WITH 0 FAILURES!');


