import Database from 'better-sqlite3';
import assert from 'assert';

console.log('🧪 Running Adjudication Discrepancy Resolution Unit Tests...');

const db = new Database(':memory:');

// Setup minimal schema
db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE calibration_papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT,
    Title TEXT,
    Abstract TEXT,
    calibration_pool TEXT,
    manual_decision TEXT
  );

  CREATE TABLE reviewer_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    paper_id TEXT,
    pool TEXT,
    reviewer_name TEXT,
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
    resolved_qa_scores TEXT,
    resolved_extracted_data TEXT,
    commit_message TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );
`);

// Insert test projects and papers
db.prepare("INSERT INTO projects (id, name) VALUES ('proj-test-1', 'Test Project 1')").run();
db.prepare("INSERT INTO projects (id, name) VALUES ('proj-test-2', 'Test Project 2')").run();

db.prepare("INSERT INTO calibration_papers (Paper_ID, Project_ID, Title, calibration_pool) VALUES ('P1', 'proj-test-1', 'Paper 1', 'pool_b')").run();
db.prepare("INSERT INTO calibration_papers (Paper_ID, Project_ID, Title, calibration_pool) VALUES ('P2', 'proj-test-1', 'Paper 2', 'pool_b')").run();

// 1. Simulate import of Reviewer Alpha and Reviewer Beta with a discrepancy on P1
db.prepare(`
  INSERT INTO reviewer_decisions (project_id, paper_id, pool, reviewer_name, decision)
  VALUES ('proj-test-1', 'P1', 'pool_b', 'Alpha', 'EXCLUDE'),
         ('proj-test-1', 'P1', 'pool_b', 'Beta', 'INCLUDE'),
         ('proj-test-1', 'P2', 'pool_b', 'Alpha', 'INCLUDE'),
         ('proj-test-1', 'P2', 'pool_b', 'Beta', 'INCLUDE')
`).run();

// Auto-adjudication ledger entries created on import
db.prepare(`
  INSERT INTO calibration_commit_ledger (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_rationale, commit_message, timestamp)
  VALUES ('hash1', 'proj-test-1', 'P1', 'pool_b', 'IMPORT: Alpha', '{}', 'EXCLUDE', 'Rationale', 'Auto-adjudication status on import from Alpha', '2026-08-16T10:00:00Z'),
         ('hash2', 'proj-test-1', 'P1', 'pool_b', 'IMPORT: Beta', '{}', 'EXCLUDE', 'Rationale', 'Auto-adjudication status on import from Beta', '2026-08-16T10:01:00Z'),
         ('hash3', 'proj-test-1', 'P2', 'pool_b', 'IMPORT: Alpha', '{}', 'INCLUDE', 'Rationale', 'Auto-adjudication status on import from Alpha', '2026-08-16T10:00:00Z'),
         ('hash4', 'proj-test-1', 'P2', 'pool_b', 'IMPORT: Beta', '{}', 'INCLUDE', 'Rationale', 'Auto-adjudication status on import from Beta', '2026-08-16T10:01:00Z')
`).run();

function getResolvedPaperIds(projectId, pool) {
  return new Set(
    db.prepare(`
      SELECT l.paper_id 
      FROM calibration_commit_ledger l
      JOIN (
        SELECT paper_id, MAX(id) as max_id
        FROM calibration_commit_ledger
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool = ?
        GROUP BY paper_id
      ) latest ON l.id = latest.max_id
      WHERE (l.project_id = ? OR CAST(l.project_id AS TEXT) = CAST(? AS TEXT)) 
        AND l.pool = ? 
        AND l.adjudicator NOT LIKE 'IMPORT:%'
    `).all(projectId, projectId, pool, projectId, projectId, pool).map(r => r.paper_id)
  );
}

// Test 1: Prior to human adjudication, P1 is NOT resolved
let resolvedIds = getResolvedPaperIds('proj-test-1', 'pool_b');
assert.strictEqual(resolvedIds.has('P1'), false, 'P1 must NOT be resolved before human adjudication');
console.log('✅ 1. Pre-adjudication discrepancy correctly shows is_resolved: false.');

// Test 2: Commit human adjudication for P1
db.prepare(`
  INSERT INTO calibration_commit_ledger (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_rationale, commit_message, timestamp)
  VALUES ('hash5', 'proj-test-1', 'P1', 'pool_b', 'ADJUDICATOR', '{}', 'INCLUDE', 'Strategic consensus', 'Adjudicated conflict on P1', '2026-08-16T10:05:00Z')
`).run();

resolvedIds = getResolvedPaperIds('proj-test-1', 'pool_b');
assert.strictEqual(resolvedIds.has('P1'), true, 'P1 must be marked resolved after human adjudication');
console.log('✅ 2. Post-adjudication discrepancy correctly shows is_resolved: true.');

// Test 3: Subsequent reviewer re-upload marks discrepancy as un-resolved again
db.prepare(`
  INSERT INTO calibration_commit_ledger (commit_hash, project_id, paper_id, pool, adjudicator, previous_state, resolved_decision, resolved_rationale, commit_message, timestamp)
  VALUES ('hash6', 'proj-test-1', 'P1', 'pool_b', 'IMPORT: Alpha', '{}', 'EXCLUDE', 'Rationale', 'Auto-adjudication status on import from Alpha', '2026-08-16T10:10:00Z')
`).run();

resolvedIds = getResolvedPaperIds('proj-test-1', 'pool_b');
assert.strictEqual(resolvedIds.has('P1'), false, 'P1 must revert to un-resolved if a newer import occurs');
console.log('✅ 3. Discrepancy correctly reverts to is_resolved: false after subsequent reviewer re-import.');

// Test 4: Project isolation
resolvedIds = getResolvedPaperIds('proj-test-2', 'pool_b');
assert.strictEqual(resolvedIds.size, 0, 'Project 2 must have 0 resolved papers');
console.log('✅ 4. Multi-project isolation verified.');

console.log('\n🎉 ALL ADJUDICATION DISCREPANCY RESOLUTION TESTS PASSED!');
