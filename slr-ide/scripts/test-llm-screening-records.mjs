import Database from 'better-sqlite3';
import assert from 'assert';

console.log('🧪 Running Comprehensive LLM Screening Records & SQLite Trigger Tests...\n');

const db = new Database(':memory:');

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
    ai_stage INTEGER DEFAULT 0,
    ai_decision TEXT,
    ai_exclusion_code TEXT,
    ai_rationale TEXT,
    ai_quality_assessment TEXT,
    ai_extracted_data TEXT,
    FOREIGN KEY (Project_ID) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE rolling_batch_papers (
    Paper_ID TEXT NOT NULL,
    Project_ID TEXT,
    ai_stage INTEGER DEFAULT 0,
    ai_decision TEXT,
    ai_exclusion_code TEXT,
    ai_rationale TEXT,
    ai_quality_assessment TEXT,
    ai_extracted_data TEXT,
    PRIMARY KEY(Paper_ID, Project_ID)
  );

  CREATE TABLE calibration_papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT,
    ai_stage INTEGER DEFAULT 0,
    ai_decision TEXT,
    ai_exclusion_code TEXT,
    ai_rationale TEXT,
    ai_quality_assessment TEXT,
    ai_extracted_data TEXT
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
    logic_trace TEXT,
    structured_output TEXT,
    model_id TEXT,
    job_id TEXT,
    cost_usd REAL DEFAULT 0.0,
    total_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE,
    UNIQUE(project_id, paper_id, stage)
  );

  CREATE TRIGGER trg_lsr_insert AFTER INSERT ON llm_screening_records
  BEGIN
    UPDATE papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 4
      )
    WHERE Paper_ID = NEW.paper_id AND (Project_ID = NEW.project_id OR CAST(Project_ID AS TEXT) = CAST(NEW.project_id AS TEXT));

    UPDATE rolling_batch_papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 4
      )
    WHERE Paper_ID = NEW.paper_id AND (Project_ID = NEW.project_id OR CAST(Project_ID AS TEXT) = CAST(NEW.project_id AS TEXT));

    UPDATE calibration_papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 4
      )
    WHERE Paper_ID = NEW.paper_id AND (Project_ID = NEW.project_id OR CAST(Project_ID AS TEXT) = CAST(NEW.project_id AS TEXT));
  END;

  CREATE TRIGGER trg_lsr_update AFTER UPDATE ON llm_screening_records
  BEGIN
    UPDATE papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 4
      )
    WHERE Paper_ID = NEW.paper_id AND (Project_ID = NEW.project_id OR CAST(Project_ID AS TEXT) = CAST(NEW.project_id AS TEXT));

    UPDATE rolling_batch_papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 4
      )
    WHERE Paper_ID = NEW.paper_id AND (Project_ID = NEW.project_id OR CAST(Project_ID AS TEXT) = CAST(NEW.project_id AS TEXT));

    UPDATE calibration_papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = NEW.project_id AND paper_id = NEW.paper_id AND stage = 4
      )
    WHERE Paper_ID = NEW.paper_id AND (Project_ID = NEW.project_id OR CAST(Project_ID AS TEXT) = CAST(NEW.project_id AS TEXT));
  END;

  CREATE TRIGGER trg_lsr_delete AFTER DELETE ON llm_screening_records
  BEGIN
    UPDATE papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id AND stage = 4
      )
    WHERE Paper_ID = OLD.paper_id AND (Project_ID = OLD.project_id OR CAST(Project_ID AS TEXT) = CAST(OLD.project_id AS TEXT));

    UPDATE rolling_batch_papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id AND stage = 4
      )
    WHERE Paper_ID = OLD.paper_id AND (Project_ID = OLD.project_id OR CAST(Project_ID AS TEXT) = CAST(OLD.project_id AS TEXT));

    UPDATE calibration_papers
    SET 
      ai_stage = COALESCE((
        SELECT stage FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ), 0),
      ai_decision = (
        SELECT decision FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_exclusion_code = (
        SELECT exclusion_code FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_rationale = (
        SELECT rationale FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id
        ORDER BY 
          CASE WHEN decision LIKE 'EXCLUDE%' THEN 0 ELSE 1 END ASC,
          CASE WHEN decision LIKE 'EXCLUDE%' THEN stage ELSE -stage END ASC
        LIMIT 1
      ),
      ai_quality_assessment = (
        SELECT quality_assessment FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id AND stage = 3
      ),
      ai_extracted_data = (
        SELECT extracted_data FROM llm_screening_records
        WHERE project_id = OLD.project_id AND paper_id = OLD.paper_id AND stage = 4
      )
    WHERE Paper_ID = OLD.paper_id AND (Project_ID = OLD.project_id OR CAST(Project_ID AS TEXT) = CAST(OLD.project_id AS TEXT));
  END;
`);

console.log('✅ 1. Schema and Triggers initialized.');

// Seed Project & Papers
db.prepare("INSERT INTO projects (id, name, folder_name) VALUES ('proj-test-1', 'Test Project', 'test_proj')").run();
db.prepare("INSERT INTO papers (Paper_ID, Project_ID, Title, Year) VALUES ('P101', 'proj-test-1', 'Test Paper 101', 2024)").run();
db.prepare("INSERT INTO rolling_batch_papers (Paper_ID, Project_ID) VALUES ('P101', 'proj-test-1')").run();
db.prepare("INSERT INTO calibration_papers (Paper_ID, Project_ID) VALUES ('P101', 'proj-test-1')").run();

// Step A: Stage 1 Fast Filter (INCLUDE)
const now = new Date().toISOString();
db.prepare(`
  INSERT INTO llm_screening_records (
    project_id, paper_id, stage, task_type, decision, rationale, model_id, created_at, updated_at
  ) VALUES ('proj-test-1', 'P101', 1, 'fast_filter', 'INCLUDE', 'Relevant topic', 'gemini-2.5-flash', ?, ?)
`).run(now, now);

let p = db.prepare("SELECT * FROM papers WHERE Paper_ID = 'P101'").get();
assert.strictEqual(p.ai_stage, 1, 'Stage should be 1');
assert.strictEqual(p.ai_decision, 'INCLUDE', 'Decision should be INCLUDE');
console.log('✅ 2. Stage 1 Fast Filter INCLUDE correctly triggered papers.ai_* sync.');

// Step B: Stage 2 Gatekeeper (INCLUDE)
db.prepare(`
  INSERT INTO llm_screening_records (
    project_id, paper_id, stage, task_type, decision, rationale, model_id, created_at, updated_at
  ) VALUES ('proj-test-1', 'P101', 2, 'gatekeeper', 'INCLUDE', 'Full text verified', 'gemini-2.5-pro', ?, ?)
`).run(now, now);

p = db.prepare("SELECT * FROM papers WHERE Paper_ID = 'P101'").get();
assert.strictEqual(p.ai_stage, 2, 'Stage should be 2');
assert.strictEqual(p.ai_decision, 'INCLUDE', 'Decision should be INCLUDE');
console.log('✅ 3. Stage 2 Gatekeeper INCLUDE correctly triggered papers.ai_* sync.');

// Step C: Stage 3 Scientist (INCLUDE with QA scores)
const qaJson = JSON.stringify({ overall_score: 8.5 });
db.prepare(`
  INSERT INTO llm_screening_records (
    project_id, paper_id, stage, task_type, decision, rationale, quality_assessment, model_id, created_at, updated_at
  ) VALUES ('proj-test-1', 'P101', 3, 'scientist', 'INCLUDE', 'High quality study', ?, 'gemini-2.5-pro', ?, ?)
`).run(qaJson, now, now);

p = db.prepare("SELECT * FROM papers WHERE Paper_ID = 'P101'").get();
assert.strictEqual(p.ai_stage, 3, 'Stage should be 3');
assert.strictEqual(p.ai_quality_assessment, qaJson, 'Quality assessment must be synced');
console.log('✅ 4. Stage 3 Scientist INCLUDE correctly synced quality assessment.');

// Step D: Stage 4 Miner (INCLUDE with extracted data)
const extJson = JSON.stringify({ sample_size: { value: 150 } });
db.prepare(`
  INSERT INTO llm_screening_records (
    project_id, paper_id, stage, task_type, decision, rationale, extracted_data, model_id, created_at, updated_at
  ) VALUES ('proj-test-1', 'P101', 4, 'miner', 'INCLUDE', 'Extraction complete', ?, 'gemini-2.5-pro', ?, ?)
`).run(extJson, now, now);

p = db.prepare("SELECT * FROM papers WHERE Paper_ID = 'P101'").get();
assert.strictEqual(p.ai_stage, 4, 'Stage should be 4');
assert.strictEqual(p.ai_extracted_data, extJson, 'Extracted data must be synced');
console.log('✅ 5. Stage 4 Miner INCLUDE correctly synced extracted data.');

// Step E: Re-run Stage 2 and result is EXCLUDE (simulating Python queue_handler purging downstream > 2 and UPSERT)
db.prepare("DELETE FROM llm_screening_records WHERE project_id = 'proj-test-1' AND paper_id = 'P101' AND stage > 2").run();
db.prepare(`
  INSERT INTO llm_screening_records (
    project_id, paper_id, stage, task_type, decision, exclusion_code, rationale, model_id, created_at, updated_at
  ) VALUES ('proj-test-1', 'P101', 2, 'gatekeeper', 'EXCLUDE', 'EC2', 'Out of scope population', 'gemini-2.5-pro', ?, ?)
  ON CONFLICT(project_id, paper_id, stage) DO UPDATE SET
    decision = excluded.decision,
    exclusion_code = excluded.exclusion_code,
    rationale = excluded.rationale,
    updated_at = excluded.updated_at
`).run(now, now);

p = db.prepare("SELECT * FROM papers WHERE Paper_ID = 'P101'").get();
assert.strictEqual(p.ai_stage, 2, 'Stage should fall back to 2');
assert.strictEqual(p.ai_decision, 'EXCLUDE', 'Decision must be EXCLUDE');
assert.strictEqual(p.ai_exclusion_code, 'EC2', 'Exclusion code must be EC2');
assert.strictEqual(p.ai_quality_assessment, null, 'Stage 3 QA assessment must be reset');
assert.strictEqual(p.ai_extracted_data, null, 'Stage 4 extracted data must be reset');

const records = db.prepare("SELECT stage, decision FROM llm_screening_records WHERE paper_id = 'P101' ORDER BY stage ASC").all();
assert.strictEqual(records.length, 2, 'Should only have 2 records (Stage 1 and Stage 2)');
assert.strictEqual(records[0].stage, 1, 'Stage 1 record must be preserved');
assert.strictEqual(records[1].stage, 2, 'Stage 2 record must be updated');
console.log('✅ 6. Re-running earlier stage with EXCLUDE correctly pruned downstream records and synced papers.ai_*.');

// Step F: Delete all records for paper (Purge test)
db.prepare("DELETE FROM llm_screening_records WHERE paper_id = 'P101'").run();
p = db.prepare("SELECT * FROM papers WHERE Paper_ID = 'P101'").get();
assert.strictEqual(p.ai_stage, 0, 'Stage should be 0 when all records deleted');
assert.strictEqual(p.ai_decision, null, 'Decision should be null when all records deleted');
console.log('✅ 7. Purge / delete trigger correctly resets papers to unscreened state.');

console.log('\n🎉 ALL LLM SCREENING RECORDS & TRIGGER TESTS PASSED!\n');
