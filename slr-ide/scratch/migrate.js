const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../db/slr.db');
console.log("Opening database at:", dbPath);
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log("Creating table duplicate_pairs...");
db.exec(`
  CREATE TABLE IF NOT EXISTS duplicate_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    paper1_id TEXT NOT NULL,
    paper2_id TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    shared_authors_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    keep_paper_id TEXT,
    exclude_paper_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(paper1_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE,
    FOREIGN KEY(paper2_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_dp_project_status ON duplicate_pairs(project_id, status);
`);

console.log("Adding columns is_duplicate and merged_into_id to papers table...");
try {
  db.exec("ALTER TABLE papers ADD COLUMN is_duplicate INTEGER DEFAULT 0");
  console.log("Added is_duplicate successfully.");
} catch (e) {
  console.log("is_duplicate migration skipped (likely already exists):", e.message);
}

try {
  db.exec("ALTER TABLE papers ADD COLUMN merged_into_id TEXT DEFAULT NULL");
  console.log("Added merged_into_id successfully.");
} catch (e) {
  console.log("merged_into_id migration skipped (likely already exists):", e.message);
}

try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_is_duplicate ON papers (is_duplicate)");
  console.log("Created index idx_papers_is_duplicate.");
} catch (e) {
  console.log("Index creation skipped:", e.message);
}

try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers (merged_into_id)");
  console.log("Created index idx_papers_merged_into.");
} catch (e) {
  console.log("Index creation skipped:", e.message);
}

console.log("Database migration complete!");
db.close();
