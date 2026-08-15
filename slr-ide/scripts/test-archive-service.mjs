import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('🧪 Running Comprehensive Relational Restore & Foreign Key Tests...\n');

// Initialize in-memory test database
const db = new Database(':memory:');

// Setup schema with full foreign keys
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT NOT NULL,
    Title TEXT,
    Year INTEGER,
    FOREIGN KEY (Project_ID) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE calibration_papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT NOT NULL,
    Title TEXT,
    FOREIGN KEY (Project_ID) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE reviewer_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    decision TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE rolling_batches (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review',
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE rolling_batch_papers (
    Paper_ID TEXT NOT NULL,
    Project_ID TEXT,
    batch_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    PRIMARY KEY(Paper_ID, batch_id),
    FOREIGN KEY(batch_id) REFERENCES rolling_batches(id) ON DELETE CASCADE
  );

  CREATE TABLE rolling_batch_reviewer_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    paper_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    FOREIGN KEY(batch_id) REFERENCES rolling_batches(id) ON DELETE CASCADE
  );

  CREATE TABLE prompt_audit_ledger (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    audit_type TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE prompt_benchmark_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage_num INTEGER NOT NULL,
    stage_name TEXT NOT NULL,
    pool TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE prompt_benchmark_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    partition_type TEXT NOT NULL DEFAULT 'train',
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES prompt_benchmark_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

console.log('✅ 1. Schema with active foreign keys initialized.');

// Seed complex relational archive with rolling batches and papers
const complexArchive = {
  format: 'SLR_PROJECT_ARCHIVE',
  manifest: {
    format: 'SLR_PROJECT_ARCHIVE',
    schema_version: '1.0.0',
    app_version: '0.1.2',
    exported_at: new Date().toISOString(),
    project_id: 'proj-relational-100',
    project_name: 'Relational SLR Project',
    folder_name: 'relational_slr',
    checksum: 'hash123',
    record_counts: { papers: 2, rolling_batches: 1, rolling_batch_papers: 2 }
  },
  tables: {
    projects: [{
      id: 'proj-relational-100',
      name: 'Relational SLR Project',
      folder_name: 'relational_slr'
    }],
    papers: [
      { Paper_ID: 'Paper_Alpha_1', Project_ID: 'proj-relational-100', Title: 'Alpha Paper', Year: 2024 },
      { Paper_ID: 'Paper_Beta_2', Project_ID: 'proj-relational-100', Title: 'Beta Paper', Year: 2024 }
    ],
    calibration_papers: [],
    reviewer_decisions: [
      { id: 1, paper_id: 'Paper_Alpha_1', project_id: 'proj-relational-100', reviewer_name: 'Aditya', decision: 'INCLUDE' }
    ],
    rolling_batches: [
      { id: 'batch-2026-001', project_id: 'proj-relational-100', batch_number: 1, status: 'pending_review', created_at: '2026-08-15T12:00:00Z' }
    ],
    rolling_batch_papers: [
      { Paper_ID: 'Paper_Alpha_1', Project_ID: 'proj-relational-100', batch_id: 'batch-2026-001', batch_number: 1 },
      { Paper_ID: 'Paper_Beta_2', Project_ID: 'proj-relational-100', batch_id: 'batch-2026-001', batch_number: 1 }
    ],
    rolling_batch_reviewer_decisions: [
      { id: 10, batch_id: 'batch-2026-001', batch_number: 1, paper_id: 'Paper_Alpha_1', project_id: 'proj-relational-100', reviewer_name: 'Aditya', imported_at: '2026-08-15T12:00:00Z' }
    ]
  }
};

// Simulate import with FK disabled during bulk load and ID preservation
db.pragma('foreign_keys = OFF');
const targetProjectId = 'proj-relational-100';

const importTx = db.transaction(() => {
  // Insert Project
  const proj = complexArchive.tables.projects[0];
  db.prepare('INSERT INTO projects (id, name, folder_name) VALUES (?, ?, ?)').run(proj.id, proj.name, proj.folder_name);

  // Insert Papers
  for (const p of complexArchive.tables.papers) {
    db.prepare('INSERT INTO papers (Paper_ID, Project_ID, Title, Year) VALUES (?, ?, ?, ?)').run(p.Paper_ID, targetProjectId, p.Title, p.Year);
  }

  // Insert Reviewer Decisions (omit auto-increment ID)
  for (const rd of complexArchive.tables.reviewer_decisions) {
    db.prepare('INSERT INTO reviewer_decisions (paper_id, project_id, reviewer_name, decision) VALUES (?, ?, ?, ?)').run(rd.paper_id, targetProjectId, rd.reviewer_name, rd.decision);
  }

  // Insert Rolling Batches (preserve id TEXT PRIMARY KEY)
  for (const rb of complexArchive.tables.rolling_batches) {
    db.prepare('INSERT INTO rolling_batches (id, project_id, batch_number, status, created_at) VALUES (?, ?, ?, ?, ?)').run(rb.id, targetProjectId, rb.batch_number, rb.status, rb.created_at);
  }

  // Insert Rolling Batch Papers
  for (const rbp of complexArchive.tables.rolling_batch_papers) {
    db.prepare('INSERT INTO rolling_batch_papers (Paper_ID, Project_ID, batch_id, batch_number) VALUES (?, ?, ?, ?)').run(rbp.Paper_ID, targetProjectId, rbp.batch_id, rbp.batch_number);
  }

  // Insert Rolling Batch Decisions (omit auto-increment ID)
  for (const rbd of complexArchive.tables.rolling_batch_reviewer_decisions) {
    db.prepare('INSERT INTO rolling_batch_reviewer_decisions (batch_id, batch_number, paper_id, project_id, reviewer_name, imported_at) VALUES (?, ?, ?, ?, ?, ?)').run(rbd.batch_id, rbd.batch_number, rbd.paper_id, targetProjectId, rbd.reviewer_name, rbd.imported_at);
  }
});

importTx();
db.pragma('foreign_keys = ON');

// Verify foreign keys validity
const checkFk = db.pragma('foreign_key_check');
assert.strictEqual(checkFk.length, 0, 'Database must have 0 foreign key violations');

const restoredBatchPapers = db.prepare('SELECT COUNT(*) as c FROM rolling_batch_papers').get().c;
assert.strictEqual(restoredBatchPapers, 2, 'All 2 rolling batch papers must be restored without FK violation');

console.log('✅ 2. Complex relational restore executed with 0 foreign key violations.');
console.log('\n🎉 ALL RELATIONAL RESTORE TESTS PASSED!\n');
