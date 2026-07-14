import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'db', 'slr.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

console.log('Running migration: backfilling manual_audit_log from papers table...');

try {
  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS manual_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      manual_stage TEXT NOT NULL,
      decision TEXT NOT NULL,
      ec_trigger TEXT,
      rationale TEXT,
      qa_scores TEXT,
      extracted_data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (paper_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_manual_audit_project ON manual_audit_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_manual_audit_paper ON manual_audit_log(paper_id);
  `);

  // Fetch papers with manual decisions
  const papers = db.prepare(`
    SELECT Paper_ID, Project_ID, manual_stage, manual_decision, manual_ec_trigger, manual_rationale, manual_qa_scores, manual_extracted_data
    FROM papers
    WHERE manual_decision IS NOT NULL AND manual_decision != '' AND manual_stage IS NOT NULL AND manual_stage != ''
  `).all() as any[];

  console.log(`Found ${papers.length} papers with manual decisions to backfill.`);

  const insertStmt = db.prepare(`
    INSERT INTO manual_audit_log (
      paper_id, project_id, manual_stage, decision, ec_trigger, rationale, qa_scores, extracted_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const now = new Date().toISOString();

  db.transaction(() => {
    for (const p of papers) {
      // Check if already exists to be safe
      const exists = db.prepare('SELECT 1 FROM manual_audit_log WHERE paper_id = ? AND project_id = ? AND manual_stage = ?').get(p.Paper_ID, p.Project_ID, p.manual_stage);
      if (!exists) {
        insertStmt.run(
          p.Paper_ID,
          p.Project_ID,
          p.manual_stage,
          p.manual_decision,
          p.manual_ec_trigger,
          p.manual_rationale,
          p.manual_qa_scores,
          p.manual_extracted_data,
          now
        );
        count++;
      }
    }
  })();

  console.log(`Successfully migrated ${count} records to manual_audit_log.`);
} catch (error) {
  console.error('Migration failed:', error);
} finally {
  db.close();
}
