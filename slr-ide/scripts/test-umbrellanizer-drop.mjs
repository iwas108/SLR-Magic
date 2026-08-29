import assert from 'assert';
import Database from 'better-sqlite3';

console.log('--- Testing Umbrellanizer Drop on Specific Key & Multi-Project Isolation ---');

// 1. Setup In-Memory Database SQLite
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE umbrellanizer_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    extracted_data_key TEXT NOT NULL,
    prompt_id TEXT,
    model_id TEXT,
    raw_tokens_input TEXT,
    umbrella_mapping TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    thinking_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    status TEXT DEFAULT 'PENDING',
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, extracted_data_key),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

db.prepare(`INSERT INTO projects (id, name) VALUES ('proj-1', 'Project One')`).run();
db.prepare(`INSERT INTO projects (id, name) VALUES ('proj-2', 'Project Two')`).run();

// Seed Umbrellanizer Results
db.prepare(`
  INSERT INTO umbrellanizer_results (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
  VALUES ('proj-1', 'rq1_model', 'default-umbrellanizer', 'gemini-2.5-flash', '["CNN", "LSTM"]', '{"CNN":{"umbrella_category":"Deep Learning","justification":"Neural net architecture."}}', 'SUCCESS', datetime('now'), datetime('now'))
`).run();

db.prepare(`
  INSERT INTO umbrellanizer_results (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
  VALUES ('proj-1', 'rq2_dataset', 'default-umbrellanizer', 'gemini-2.5-flash', '["ImageNet", "CIFAR"]', '{"ImageNet":{"umbrella_category":"Benchmark Vision Dataset","justification":"Standard dataset."}}', 'SUCCESS', datetime('now'), datetime('now'))
`).run();

// Same key in another project
db.prepare(`
  INSERT INTO umbrellanizer_results (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
  VALUES ('proj-2', 'rq1_model', 'default-umbrellanizer', 'gemini-2.5-flash', '["ResNet", "BERT"]', '{"BERT":{"umbrella_category":"Transformer","justification":"NLP model."}}', 'SUCCESS', datetime('now'), datetime('now'))
`).run();

// Initial Assertions
let proj1Results = db.prepare(`
  SELECT * FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
`).all('proj-1', 'proj-1');
assert.strictEqual(proj1Results.length, 2, 'Project 1 should initially have 2 umbrellanizer keys');

let proj2Results = db.prepare(`
  SELECT * FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
`).all('proj-2', 'proj-2');
assert.strictEqual(proj2Results.length, 1, 'Project 2 should initially have 1 umbrellanizer key');

console.log('✓ Initial database state seeded and verified.');

// 2. Perform Drop on specific key ('rq1_model') in proj-1
const targetProjectId = 'proj-1';
const targetKey = 'rq1_model';

const dropStmt = db.prepare(`
  DELETE FROM umbrellanizer_results 
  WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
    AND extracted_data_key = ?
`);
const info = dropStmt.run(targetProjectId, targetProjectId, targetKey);
assert.strictEqual(info.changes, 1, 'Should delete exactly 1 row');

console.log(`✓ Dropped key "${targetKey}" from project "${targetProjectId}".`);

// 3. Verify Isolation & Consistency After Drop
proj1Results = db.prepare(`
  SELECT * FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
`).all('proj-1', 'proj-1');
assert.strictEqual(proj1Results.length, 1, 'Project 1 should now have 1 key remaining');
assert.strictEqual(proj1Results[0].extracted_data_key, 'rq2_dataset', 'Remaining key must be rq2_dataset');

// Verify proj-2's rq1_model was NOT touched
proj2Results = db.prepare(`
  SELECT * FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
`).all('proj-2', 'proj-2');
assert.strictEqual(proj2Results.length, 1, 'Project 2 should still have its key');
assert.strictEqual(proj2Results[0].extracted_data_key, 'rq1_model', 'Project 2 rq1_model must remain untouched');

console.log('✓ Multi-project isolation strictly enforced (Project 2 unaffected).');

// 4. Verify Re-inserting after drop works seamlessly
db.prepare(`
  INSERT OR REPLACE INTO umbrellanizer_results (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, created_at, updated_at)
  VALUES ('proj-1', 'rq1_model', 'default-umbrellanizer', 'gemini-2.5-flash', '["CNN"]', '{"CNN":{"umbrella_category":"Deep Learning","justification":"Re-run."}}', 'SUCCESS', datetime('now'), datetime('now'))
`).run();

proj1Results = db.prepare(`
  SELECT * FROM umbrellanizer_results WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
`).all('proj-1', 'proj-1');
assert.strictEqual(proj1Results.length, 2, 'Project 1 should have 2 keys after re-run');

console.log('✓ Re-running Umbrellanizer on dropped key works cleanly.');

console.log('\n========================================');
console.log('ALL UMBRELLA DROP & ISOLATION TESTS PASSED (100%)');
console.log('========================================');
