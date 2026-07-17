const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../db/slr.db');
const backupPath = path.join(__dirname, '../db/slr.db.bak');

console.log("Backing up database to:", backupPath);
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log("Backup created successfully.");
} catch (err) {
  console.error("Backup failed:", err.message);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = OFF');

console.log("Starting migration...");

db.transaction(() => {
  // Drop the temporary table if it already exists
  db.exec("DROP TABLE IF EXISTS papers_new");

  // Create new table schema
  db.exec(`
    CREATE TABLE papers_new (
      Paper_ID TEXT PRIMARY KEY,
      Import_Date TEXT NOT NULL,
      Import_Source TEXT NOT NULL,
      Source TEXT,
      DOI TEXT,
      Title TEXT NOT NULL,
      Abstract TEXT,
      Authors TEXT,
      Year INTEGER,
      PDF_Link TEXT,
      Status TEXT NOT NULL DEFAULT 'PENDING',
      Local_PDF_Status TEXT NOT NULL DEFAULT 'IGNORED',
      Local_PDF_Path TEXT,
      Project_ID TEXT,
      Parent_Paper_ID TEXT,
      Original_Publisher TEXT,
      Publisher TEXT,
      citation_count INTEGER DEFAULT 0,
      is_duplicate INTEGER DEFAULT 0,
      merged_into_id TEXT DEFAULT NULL,
      remote_worker_id TEXT DEFAULT NULL,
      scrape_claimed_at TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      ai_stage INTEGER DEFAULT 0,
      ai_decision TEXT DEFAULT NULL,
      ai_rationale TEXT DEFAULT NULL,
      ai_quality_assessment TEXT DEFAULT NULL,
      ai_extracted_data TEXT DEFAULT NULL,
      manual_stage INTEGER DEFAULT 0,
      manual_decision TEXT DEFAULT NULL,
      manual_rationale TEXT DEFAULT NULL,
      manual_quality_assessment TEXT DEFAULT NULL,
      manual_extracted_data TEXT DEFAULT NULL
    )
  `);

  console.log("Copying metadata and migrating data to the new schema...");
  const oldPapers = db.prepare("SELECT * FROM papers").all();

  const insertStmt = db.prepare(`
    INSERT INTO papers_new (
      Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
      PDF_Link, Status, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
      Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
      remote_worker_id, scrape_claimed_at, notes,
      ai_stage, ai_decision, ai_rationale, ai_quality_assessment, ai_extracted_data,
      manual_stage, manual_decision, manual_rationale, manual_quality_assessment, manual_extracted_data
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const stageMap = {
    '0': 0, 'unscreened': 0, 'pending': 0, 'PENDING': 0,
    '1': 1, 'fast_filter': 1,
    '2': 2, 'gatekeeper': 2,
    '3': 3, 'scientist': 3,
    '4': 4, 'miner': 4
  };

  for (const paper of oldPapers) {
    // Map AI Stage
    let aiStage = 0;
    if (paper.Status && stageMap[paper.Status] !== undefined) {
      aiStage = stageMap[paper.Status];
    }
    
    // Format AI Decision
    let aiDecision = paper.AI_Decision || null;
    if (aiDecision && aiDecision.toUpperCase().includes('EXCLUDE') && paper.AI_EC_Trigger && paper.AI_EC_Trigger !== 'NONE') {
      aiDecision = `EXCLUDE (${paper.AI_EC_Trigger})`;
    }

    // Map Manual Stage
    let manualStage = 0;
    if (paper.manual_stage && stageMap[paper.manual_stage] !== undefined) {
      manualStage = stageMap[paper.manual_stage];
    }

    // Format Manual Decision
    let manualDecision = paper.manual_decision || null;
    if (manualDecision && manualDecision.toUpperCase().includes('EXCLUDE') && paper.manual_ec_trigger && paper.manual_ec_trigger !== 'NONE') {
      manualDecision = `EXCLUDE (${paper.manual_ec_trigger})`;
    }

    insertStmt.run(
      paper.Paper_ID, paper.Import_Date, paper.Import_Source, paper.Source, paper.DOI, paper.Title, paper.Abstract, paper.Authors, paper.Year,
      paper.PDF_Link, paper.Status, paper.Local_PDF_Status, paper.Local_PDF_Path, paper.Project_ID, paper.Parent_Paper_ID,
      paper.Original_Publisher, paper.Publisher, paper.citation_count, paper.is_duplicate, paper.merged_into_id,
      paper.remote_worker_id, paper.scrape_claimed_at, paper.notes,
      aiStage, aiDecision, paper.AI_Rationale || null, paper.AI_QA_Scores || null, paper.AI_Extracted_Data || null,
      manualStage, manualDecision, paper.manual_rationale || null, paper.manual_qa_scores || null, paper.manual_extracted_data || null
    );
  }

  // Drop old table and rename the new table
  db.exec("DROP TABLE papers");
  db.exec("ALTER TABLE papers_new RENAME TO papers");

  // Re-create indices
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers (DOI)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_title ON papers (Title)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_is_duplicate ON papers (is_duplicate)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers (merged_into_id)");
})();

console.log("Migration successful!");
db.close();
