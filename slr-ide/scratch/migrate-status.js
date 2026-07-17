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

console.log("Starting Status column deletion migration...");

db.transaction(() => {
  // 1. Migrate papers table
  db.exec("DROP TABLE IF EXISTS papers_new");
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

  console.log("Copying papers data...");
  db.exec(`
    INSERT INTO papers_new (
      Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
      PDF_Link, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
      Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
      remote_worker_id, scrape_claimed_at, notes,
      ai_stage, ai_decision, ai_rationale, ai_quality_assessment, ai_extracted_data,
      manual_stage, manual_decision, manual_rationale, manual_quality_assessment, manual_extracted_data
    )
    SELECT 
      Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
      PDF_Link, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
      Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
      remote_worker_id, scrape_claimed_at, notes,
      ai_stage, ai_decision, ai_rationale, ai_quality_assessment, ai_extracted_data,
      manual_stage, manual_decision, manual_rationale, manual_quality_assessment, manual_extracted_data
    FROM papers
  `);

  db.exec("DROP TABLE papers");
  db.exec("ALTER TABLE papers_new RENAME TO papers");

  // Re-create papers indices
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers (DOI)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_title ON papers (Title)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_is_duplicate ON papers (is_duplicate)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers (merged_into_id)");

  // 2. Migrate calibration_papers table
  db.exec("DROP TABLE IF EXISTS calibration_papers_new");
  db.exec(`
    CREATE TABLE calibration_papers_new (
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
      manual_extracted_data TEXT DEFAULT NULL,
      calibration_pool TEXT,
      calibration_tag TEXT
    )
  `);

  console.log("Copying calibration_papers data...");
  db.exec(`
    INSERT INTO calibration_papers_new (
      Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
      PDF_Link, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
      Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
      remote_worker_id, scrape_claimed_at, notes,
      ai_stage, ai_decision, ai_rationale, ai_quality_assessment, ai_extracted_data,
      manual_stage, manual_decision, manual_rationale, manual_quality_assessment, manual_extracted_data,
      calibration_pool, calibration_tag
    )
    SELECT 
      Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
      PDF_Link, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
      Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
      remote_worker_id, scrape_claimed_at, notes,
      ai_stage, ai_decision, ai_rationale, ai_quality_assessment, ai_extracted_data,
      manual_stage, manual_decision, manual_rationale, manual_quality_assessment, manual_extracted_data,
      calibration_pool, calibration_tag
    FROM calibration_papers
  `);

  db.exec("DROP TABLE calibration_papers");
  db.exec("ALTER TABLE calibration_papers_new RENAME TO calibration_papers");
  
  // Re-create calibration_papers indices
  db.exec("CREATE INDEX IF NOT EXISTS idx_cal_papers_doi ON calibration_papers (DOI)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cal_papers_title ON calibration_papers (Title)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cal_papers_is_duplicate ON calibration_papers (is_duplicate)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cal_papers_merged_into ON calibration_papers (merged_into_id)");
})();

console.log("Migration successful!");
db.close();
