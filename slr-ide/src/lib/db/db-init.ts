import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { migrateProjectIds } from './migrate-project-ids';
import { DEFAULT_STAGE_SCHEMAS } from '../services/prompt-validator';

const PROJECT_ROOT = process.cwd().endsWith('slr-ide') 
  ? process.cwd() 
  : (fs.existsSync(path.join(process.cwd(), 'slr-ide')) ? path.join(process.cwd(), 'slr-ide') : process.cwd());

export function initializeDatabase(db: Database.Database): void {
  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS papers (
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
      ai_exclusion_code TEXT DEFAULT NULL,
      ai_rationale TEXT DEFAULT NULL,
      ai_quality_assessment TEXT DEFAULT NULL,
      ai_extracted_data TEXT DEFAULT NULL,
      manual_stage INTEGER DEFAULT 0,
      manual_decision TEXT DEFAULT NULL,
      manual_exclusion_code TEXT DEFAULT NULL,
      manual_rationale TEXT DEFAULT NULL,
      manual_quality_assessment TEXT DEFAULT NULL,
      manual_extracted_data TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS calibration_papers (
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
      ai_exclusion_code TEXT DEFAULT NULL,
      ai_rationale TEXT DEFAULT NULL,
      ai_quality_assessment TEXT DEFAULT NULL,
      ai_extracted_data TEXT DEFAULT NULL,
      manual_stage INTEGER DEFAULT 0,
      manual_decision TEXT DEFAULT NULL,
      manual_exclusion_code TEXT DEFAULT NULL,
      manual_rationale TEXT DEFAULT NULL,
      manual_quality_assessment TEXT DEFAULT NULL,
      manual_extracted_data TEXT DEFAULT NULL,
      calibration_pool TEXT,
      calibration_tag TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers (DOI);
    CREATE INDEX IF NOT EXISTS idx_papers_title ON papers (Title);
    CREATE INDEX IF NOT EXISTS idx_papers_is_duplicate ON papers (is_duplicate);
    CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers (merged_into_id);

    CREATE INDEX IF NOT EXISTS idx_cal_papers_doi ON calibration_papers (DOI);
    CREATE INDEX IF NOT EXISTS idx_cal_papers_title ON calibration_papers (Title);
    CREATE INDEX IF NOT EXISTS idx_cal_papers_is_duplicate ON calibration_papers (is_duplicate);
    CREATE INDEX IF NOT EXISTS idx_cal_papers_merged_into ON calibration_papers (merged_into_id);

    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS umbrellanizer_results (
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

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder_name TEXT NOT NULL UNIQUE,
      manifesto TEXT,
      objective TEXT,
      questions TEXT,
      qa_definition TEXT,
      exclusion_criteria TEXT,
      pool_a_size INTEGER DEFAULT 50,
      pool_b_size INTEGER DEFAULT 30,
      pool_c_size INTEGER DEFAULT 20,
      gdrive_dest_path TEXT DEFAULT 'SLR_Magic/PDFs',
      cloud_provider TEXT DEFAULT 'gdrive',
      rclone_remote_name TEXT,
      pool_tags TEXT,
      ec_rules TEXT,
      reasoning_template TEXT,
      pool_b_ec_rules TEXT,
      pool_b_reasoning_template TEXT,
      pool_c_qa_rules TEXT,
      pool_c_extraction_rules TEXT,
      project_budget_limit REAL DEFAULT 0.0,
      project_current_spend REAL DEFAULT 0.0,
      project_tax REAL DEFAULT 0.0,
      goldmine_dest_path TEXT,
      scopus_search_string TEXT,
      manual_search_string TEXT,
      llm_config TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviewer_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      pool TEXT NOT NULL DEFAULT 'pool_a',
      reviewer_name TEXT NOT NULL,
      decision TEXT,
      ec_trigger TEXT,
      rationale TEXT,
      imported_at TEXT NOT NULL,
      qa_scores TEXT,
      extracted_data TEXT,
      UNIQUE(paper_id, project_id, pool, reviewer_name),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(paper_id) REFERENCES calibration_papers(Paper_ID) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_rd_paper ON reviewer_decisions(paper_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_rd_reviewer ON reviewer_decisions(reviewer_name, project_id);

    CREATE TABLE IF NOT EXISTS calibration_commit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commit_hash TEXT NOT NULL,
      project_id TEXT NOT NULL,
      paper_id TEXT NOT NULL,
      pool TEXT NOT NULL DEFAULT 'pool_a',
      adjudicator TEXT NOT NULL,
      previous_state TEXT NOT NULL,
      resolved_decision TEXT NOT NULL,
      resolved_ec TEXT,
      resolved_rationale TEXT NOT NULL,
      commit_message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      resolved_qa_scores TEXT,
      resolved_extracted_data TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(paper_id) REFERENCES calibration_papers(Paper_ID) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_project ON calibration_commit_ledger(project_id);

    CREATE TABLE IF NOT EXISTS api_key_vault (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name TEXT NOT NULL UNIQUE,
      encrypted_value TEXT NOT NULL,
      salt TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT,
      project_id TEXT NOT NULL,
      job_id TEXT,
      interaction_id TEXT,
      previous_interaction_id TEXT,
      model_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      thinking_tokens INTEGER DEFAULT 0,
      cached_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0.0,
      flex_discount REAL DEFAULT 0.0,
      speed_mode TEXT DEFAULT 'FLEX',
      prompt_hash TEXT,
      raw_prompt TEXT,
      raw_response TEXT,
      response_schema_name TEXT,
      structured_output TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      error_message TEXT,
      error_code TEXT,
      latency_ms INTEGER,
      retry_count INTEGER DEFAULT 0,
      api_version TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

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

    CREATE INDEX IF NOT EXISTS idx_audit_project ON llm_audit_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_paper ON llm_audit_log(paper_id);
    CREATE INDEX IF NOT EXISTS idx_audit_job ON llm_audit_log(job_id);
    
    CREATE INDEX IF NOT EXISTS idx_manual_audit_project ON manual_audit_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_manual_audit_paper ON manual_audit_log(paper_id);

    CREATE TABLE IF NOT EXISTS llm_pricing (
      model_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      input_token_price REAL NOT NULL,
      output_token_price REAL NOT NULL,
      thinking_token_price REAL,
      batch_discount REAL DEFAULT 0.5,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      system_instruction TEXT,
      user_template TEXT NOT NULL,
      response_schema TEXT,
      llm_config TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS llm_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_type TEXT,
      model_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      total_papers INTEGER NOT NULL,
      processed_papers INTEGER DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_thinking_tokens INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0.0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS llm_batch_jobs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      cloud_batch_id TEXT,
      status TEXT NOT NULL,
      input_file_id TEXT,
      output_file_id TEXT,
      submitted_at TEXT NOT NULL,
      checked_at TEXT,
      completed_at TEXT,
      FOREIGN KEY(job_id) REFERENCES llm_jobs(id) ON DELETE CASCADE
    );

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
      ai_verdict TEXT DEFAULT NULL,
      ai_analysis TEXT DEFAULT NULL,
      ai_suggested_primary_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(paper1_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE,
      FOREIGN KEY(paper2_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dp_project_status ON duplicate_pairs(project_id, status);

    CREATE TABLE IF NOT EXISTS semantic_search_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      pool_filter TEXT NOT NULL,
      results TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, query_text, pool_filter),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ssc_lookup ON semantic_search_cache (project_id, query_text, pool_filter);

    CREATE TABLE IF NOT EXISTS remote_workers (
      id          TEXT PRIMARY KEY,
      label       TEXT NOT NULL,
      host        TEXT NOT NULL,
      session_token TEXT,
      status      TEXT NOT NULL DEFAULT 'OFFLINE',
      last_seen_at TEXT,
      is_enabled  INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rolling_batches (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      batch_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      created_at TEXT NOT NULL,
      finalized_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, batch_number)
    );

    CREATE TABLE IF NOT EXISTS rolling_batch_papers (
      Paper_ID TEXT NOT NULL,
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
      ai_exclusion_code TEXT DEFAULT NULL,
      ai_rationale TEXT DEFAULT NULL,
      ai_quality_assessment TEXT DEFAULT NULL,
      ai_extracted_data TEXT DEFAULT NULL,
      manual_stage INTEGER DEFAULT 0,
      manual_decision TEXT DEFAULT NULL,
      manual_exclusion_code TEXT DEFAULT NULL,
      manual_rationale TEXT DEFAULT NULL,
      manual_quality_assessment TEXT DEFAULT NULL,
      manual_extracted_data TEXT DEFAULT NULL,
      batch_id TEXT NOT NULL,
      batch_number INTEGER NOT NULL,
      PRIMARY KEY(Paper_ID, batch_id),
      FOREIGN KEY(batch_id) REFERENCES rolling_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rolling_batch_reviewer_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      batch_number INTEGER NOT NULL,
      paper_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      qa_scores TEXT,
      extracted_data TEXT,
      imported_at TEXT NOT NULL,
      UNIQUE(paper_id, batch_id, reviewer_name),
      FOREIGN KEY(batch_id) REFERENCES rolling_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rolling_batch_commit_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commit_hash TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      batch_number INTEGER NOT NULL,
      project_id TEXT NOT NULL,
      paper_id TEXT NOT NULL,
      adjudicator TEXT NOT NULL,
      previous_state TEXT NOT NULL,
      resolved_qa_scores TEXT,
      resolved_extracted_data TEXT,
      commit_message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(batch_id) REFERENCES rolling_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_audit_ledger (
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
      train_paper_ids TEXT,
      holdout_paper_ids TEXT,
      before_metrics TEXT,
      after_metrics TEXT,
      audit_report TEXT,
      raw_prompt TEXT,
      raw_response TEXT,
      model_id TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_usd REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_audit_proj ON prompt_audit_ledger(project_id);

    CREATE TABLE IF NOT EXISTS prompt_benchmark_runs (
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
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_benchmark_runs_proj ON prompt_benchmark_runs(project_id, stage_num);

    CREATE TABLE IF NOT EXISTS prompt_benchmark_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      paper_id TEXT NOT NULL,
      partition_type TEXT NOT NULL DEFAULT 'train',
      ai_decision TEXT,
      ai_exclusion_code TEXT,
      ai_rationale TEXT,
      ai_qa_scores TEXT,
      ai_extracted_data TEXT,
      gold_decision TEXT,
      gold_exclusion_code TEXT,
      gold_rationale TEXT,
      gold_qa_scores TEXT,
      gold_extracted_data TEXT,
      is_match INTEGER DEFAULT 0,
      discrepancy_details TEXT,
      raw_response TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES prompt_benchmark_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_benchmark_results_run ON prompt_benchmark_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_benchmark_results_paper ON prompt_benchmark_results(project_id, paper_id);
  `);

  // Add scopus_search_string column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN scopus_search_string TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add manual_search_string column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN manual_search_string TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add Project_ID column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Project_ID TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add calibration_pool column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN calibration_pool TEXT");
  } catch (e) {
    // Column already exists
  }
  // Legacy Human_Decision, Human_EC_Trigger, Human_Rationale blocks were removed here because
  // these columns have been fully deprecated and dropped from the papers table.
  // The correct reviewer consensus data now lives in calibration_papers.manual_* columns.

  // Add Parent_Paper_ID column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Parent_Paper_ID TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add Original_Publisher column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Original_Publisher TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add Publisher column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Publisher TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add gdrive_dest_path column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN gdrive_dest_path TEXT DEFAULT 'SLR_Magic/PDFs'");
  } catch (e) {
    // Column already exists
  }

  // Add cloud_provider column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN cloud_provider TEXT DEFAULT 'gdrive'");
  } catch (e) {
    // Column already exists
  }

  // Add rclone_remote_name column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN rclone_remote_name TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add citation_count column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN citation_count INTEGER DEFAULT 0");
  } catch (e) {
    // Column already exists
  }

  // Add pool_tags column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN pool_tags TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add ec_rules column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN ec_rules TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add reasoning_template column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN reasoning_template TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add calibration_tag column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN calibration_tag TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add missing columns to calibration_papers to maintain exact schema parity with papers
  try {
    db.exec("ALTER TABLE calibration_papers ADD COLUMN Parent_Paper_ID TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE calibration_papers ADD COLUMN remote_worker_id TEXT");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE calibration_papers ADD COLUMN scrape_claimed_at TEXT");
  } catch (e) {}

  // Add project_budget_limit column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN project_budget_limit REAL DEFAULT 0.0");
  } catch (e) {
    // Column already exists
  }

  // Add project_current_spend column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN project_current_spend REAL DEFAULT 0.0");
  } catch (e) {
    // Column already exists
  }

  // Add project_tax column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN project_tax REAL DEFAULT 0.0");
  } catch (e) {
    // Column already exists
  }

  // Add llm_config column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN llm_config TEXT DEFAULT '{}'");
  } catch (e) {
    // Column already exists
  }

  // Add pool_b_ec_rules column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN pool_b_ec_rules TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add pool_b_reasoning_template column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN pool_b_reasoning_template TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add pool_c_qa_rules column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN pool_c_qa_rules TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add pool_c_extraction_rules column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN pool_c_extraction_rules TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add rolling_batch_size column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN rolling_batch_size INTEGER DEFAULT 20");
  } catch (e) {
    // Column already exists
  }

  // Add goldmine_dest_path column to projects if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE projects ADD COLUMN goldmine_dest_path TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add is_active column to prompt_templates if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE prompt_templates ADD COLUMN is_active INTEGER DEFAULT 1");
  } catch (e) {
    // Column already exists
  }

  // Add response_schema column to prompt_templates if it doesn't exist
  try {
    db.exec("ALTER TABLE prompt_templates ADD COLUMN response_schema TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add llm_config column to prompt_templates if it doesn't exist
  try {
    db.exec("ALTER TABLE prompt_templates ADD COLUMN llm_config TEXT DEFAULT '{}'");
  } catch (e) {
    // Column already exists
  }

  // Add prompt_type column to prompt_templates if it doesn't exist
  try {
    db.exec("ALTER TABLE prompt_templates ADD COLUMN prompt_type TEXT");
  } catch (e) {
    // Column already exists
  }

  // Self-healing migration: infer prompt_type for existing prompts if NULL
  try {
    const existingPrompts = db.prepare("SELECT id, name, response_schema FROM prompt_templates WHERE prompt_type IS NULL OR prompt_type = ''").all() as { id: string; name: string; response_schema: string | null }[];
    const updateStmt = db.prepare("UPDATE prompt_templates SET prompt_type = ? WHERE id = ?");
    for (const p of existingPrompts) {
      let inferredType = 'fast_filter';
      const name = (p.name || '').toLowerCase();
      const schema = (p.response_schema || '').toLowerCase();
      if (schema.includes('taxonomy_mapping') || name.includes('umbrellanizer')) {
        inferredType = 'umbrellanizer';
      } else if (schema.includes('verdict') || name.includes('duplicate')) {
        inferredType = 'duplicate_review';
      } else if (schema.includes('qa_scores') || name.includes('scientist')) {
        inferredType = 'scientist';
      } else if (schema.includes('extracted_data') || name.includes('miner') || name.includes('extraction')) {
        inferredType = 'miner';
      } else if (schema.includes('gate_4') || name.includes('gatekeeper')) {
        inferredType = 'gatekeeper';
      }
      updateStmt.run(inferredType, p.id);
    }
  } catch (e) {
    console.error("Failed to run prompt_type auto-inferral migration:", e);
  }

  // Add task_type column to llm_jobs if it doesn't exist
  try {
    db.exec("ALTER TABLE llm_jobs ADD COLUMN task_type TEXT");
  } catch (e) {
    // Column already exists
  }
  // Legacy Human_QA_Scores and Human_Extracted_Data blocks were removed because
  // these columns have been fully deprecated and dropped from the papers table.
  // The correct reviewer consensus data now lives in calibration_papers.manual_* columns.

  // Add qa_scores column to reviewer_decisions if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE reviewer_decisions ADD COLUMN qa_scores TEXT");
  } catch (e) {}

  // Add extracted_data column to reviewer_decisions if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE reviewer_decisions ADD COLUMN extracted_data TEXT");
  } catch (e) {}

  // Add resolved_qa_scores column to calibration_commit_ledger if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE calibration_commit_ledger ADD COLUMN resolved_qa_scores TEXT");
  } catch (e) {}

  // Add resolved_extracted_data column to calibration_commit_ledger if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE calibration_commit_ledger ADD COLUMN resolved_extracted_data TEXT");
  } catch (e) {}

  // Add is_duplicate column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN is_duplicate INTEGER DEFAULT 0");
  } catch (e) {}

  // Add merged_into_id column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN merged_into_id TEXT DEFAULT NULL");
  } catch (e) {}

  // Add AI columns to duplicate_pairs table if they do not exist (migration fallback)
  try {
    db.exec("ALTER TABLE duplicate_pairs ADD COLUMN ai_verdict TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE duplicate_pairs ADD COLUMN ai_analysis TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE duplicate_pairs ADD COLUMN ai_suggested_primary_id TEXT DEFAULT NULL");
  } catch (e) {}

  // Add notes column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN notes TEXT");
  } catch (e) {}

  // Create index idx_papers_is_duplicate if it doesn't exist
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_papers_is_duplicate ON papers (is_duplicate)");
  } catch (e) {}

  // Create index idx_papers_merged_into if it doesn't exist
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers (merged_into_id)");
  } catch (e) {}



  // Add new AI and manual columns to papers table if they do not exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN ai_stage INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN ai_decision TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN ai_exclusion_code TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN ai_rationale TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN ai_quality_assessment TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN ai_extracted_data TEXT DEFAULT NULL");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE papers ADD COLUMN manual_stage INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN manual_decision TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN manual_exclusion_code TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN manual_rationale TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN manual_quality_assessment TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE papers ADD COLUMN manual_extracted_data TEXT DEFAULT NULL");
  } catch (e) {}

  // Add the same columns to calibration_papers
  try {
    db.exec("ALTER TABLE calibration_papers ADD COLUMN ai_exclusion_code TEXT DEFAULT NULL");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE calibration_papers ADD COLUMN manual_exclusion_code TEXT DEFAULT NULL");
  } catch (e) {}

  // DB HEALING MIGRATION: split combined decision + exclusion code values (e.g. "EXCLUDE (EC-1)")
  // DISABLED: to prevent bloated startup and execution
  /*
  try {
    // 1. For papers table: ai_decision
    db.prepare(`
      UPDATE papers
      SET ai_exclusion_code = SUBSTR(ai_decision, INSTR(ai_decision, '(') + 1, INSTR(ai_decision, ')') - INSTR(ai_decision, '(') - 1),
          ai_decision = 'EXCLUDE'
      WHERE ai_decision LIKE 'EXCLUDE (%' AND (ai_exclusion_code IS NULL OR ai_exclusion_code = '')
    `).run();

    // 2. For papers table: manual_decision
    db.prepare(`
      UPDATE papers
      SET manual_exclusion_code = SUBSTR(manual_decision, INSTR(manual_decision, '(') + 1, INSTR(manual_decision, ')') - INSTR(manual_decision, '(') - 1),
          manual_decision = 'EXCLUDE'
      WHERE manual_decision LIKE 'EXCLUDE (%' AND (manual_exclusion_code IS NULL OR manual_exclusion_code = '')
    `).run();

    // 3. For calibration_papers table: ai_decision
    db.prepare(`
      UPDATE calibration_papers
      SET ai_exclusion_code = SUBSTR(ai_decision, INSTR(ai_decision, '(') + 1, INSTR(ai_decision, ')') - INSTR(ai_decision, '(') - 1),
          ai_decision = 'EXCLUDE'
      WHERE ai_decision LIKE 'EXCLUDE (%' AND (ai_exclusion_code IS NULL OR ai_exclusion_code = '')
    `).run();

    // 4. For calibration_papers table: manual_decision
    db.prepare(`
      UPDATE calibration_papers
      SET manual_exclusion_code = SUBSTR(manual_decision, INSTR(manual_decision, '(') + 1, INSTR(manual_decision, ')') - INSTR(manual_decision, '(') - 1),
          manual_decision = 'EXCLUDE'
      WHERE manual_decision LIKE 'EXCLUDE (%' AND (manual_exclusion_code IS NULL OR manual_exclusion_code = '')
    `).run();
  } catch (e) {
    console.error("Failed to run split decision database healing:", e);
  }
  */

  // Add remote worker columns to papers table if they do not exist
  try {
    db.exec("ALTER TABLE papers ADD COLUMN remote_worker_id TEXT DEFAULT NULL");
  } catch (e) {}
  
  try {
    db.exec("ALTER TABLE papers ADD COLUMN scrape_claimed_at TEXT DEFAULT NULL");
  } catch (e) {}

  // Self-healing migration for stuck IN_PROGRESS remote worker claims
  // DISABLED: to prevent bloated startup and execution
  /*
  try {
    const info = db.prepare("UPDATE papers SET Local_PDF_Status = 'MISSING', remote_worker_id = NULL, scrape_claimed_at = NULL WHERE Local_PDF_Status = 'IN_PROGRESS'").run();
    if (info.changes > 0) {
      console.log(`Successfully reset ${info.changes} papers stuck in IN_PROGRESS back to MISSING.`);
    }
  } catch (e) {
    console.error("Failed to reset stuck IN_PROGRESS papers:", e);
  }
  */

  // Seed default remote worker configs if missing
  try {
    db.prepare(`
      INSERT OR IGNORE INTO configs (key, value)
      VALUES 
        ('REMOTE_WORKER_BATCH_SIZE', '10'),
        ('REMOTE_WORKER_LOCAL_SCRAPER_ENABLED', 'true'),
        ('PDF_VERIFY_MIN_SIZE_KB', '55'),
        ('PDF_COMPRESSION_EMBED_ALL_FONTS', 'true'),
        ('PDF_COMPRESSION_SUBSET_FONTS', 'true')
    `).run();
  } catch (e) {
    console.error("Failed to seed default remote worker configs:", e);
  }

  // Seed LLM pricing default entries for active Gemini models if empty
  try {
    const pricingCount = db.prepare("SELECT COUNT(*) as count FROM llm_pricing").get() as { count: number };
    if (pricingCount.count === 0) {
      const insertPricing = db.prepare(`
        INSERT INTO llm_pricing (model_id, provider, input_token_price, output_token_price, thinking_token_price, batch_discount, updated_at)
        VALUES (?, 'gemini', ?, ?, 0.0, 0.5, ?)
      `);
      const now = new Date().toISOString();
      // Rates are USD per 1M tokens (from Gemini Interactions API pricing documentation)
      insertPricing.run('gemini-2.5-flash', 0.075, 0.30, now);
      insertPricing.run('gemini-2.5-pro', 1.25, 5.00, now);
      insertPricing.run('gemini-1.5-pro', 1.25, 5.00, now);
      insertPricing.run('gemma-2-27b-it', 0.00, 0.00, now);
      console.log("Seeded default llm_pricing entries.");
    }
  } catch (e) {
    console.error("Failed to populate default llm_pricing:", e);
  }

  // Remove deprecated default/templated prompts from database
  try {
    db.exec("DELETE FROM prompt_templates WHERE id IN ('default-screen', 'cot-screen')");
  } catch (e) {
    console.error("Failed to clean up deprecated default prompts:", e);
  }

  // Seed default duplicate_review prompt template if none exists
  try {
    const dupPromptCount = db.prepare("SELECT COUNT(*) as count FROM prompt_templates WHERE prompt_type = 'duplicate_review'").get() as { count: number };
    if (dupPromptCount.count === 0) {
      const defaultDupSchema = JSON.stringify({
        type: "object",
        properties: {
          verdict: {
            type: "string",
            enum: [
              "CONFIRMED DUPLICATE",
              "STRUCTURAL OVERLAP",
              "COMPANION PAPERS",
              "FALSE FLAG"
            ]
          },
          primary_action: {
            type: "string"
          },
          technical_breakdown: {
            type: "object",
            properties: {
              mathematical_algorithmic_shift: { type: "string" },
              topology_scope_change: { type: "string" },
              data_implementation_footprint: { type: "string" }
            },
            required: [
              "mathematical_algorithmic_shift",
              "topology_scope_change",
              "data_implementation_footprint"
            ]
          },
          database_execution: {
            type: "object",
            properties: {
              recommended_primary_paper_id: { type: "string" },
              paper1_status: {
                type: "string",
                enum: ["PENDING", "EXCLUDED_DUPLICATE", "EXCLUDED_CONTAINER", "RETAINED_PRIMARY", "RETAINED_COMPANION", "RETAINED_DISTINCT"]
              },
              paper2_status: {
                type: "string",
                enum: ["PENDING", "EXCLUDED_DUPLICATE", "EXCLUDED_CONTAINER", "RETAINED_PRIMARY", "RETAINED_COMPANION", "RETAINED_DISTINCT"]
              },
              lineage_actions: { type: "string" }
            },
            required: [
              "recommended_primary_paper_id",
              "paper1_status",
              "paper2_status",
              "lineage_actions"
            ]
          }
        },
        required: [
          "verdict",
          "primary_action",
          "technical_breakdown",
          "database_execution"
        ]
      }, null, 2);

      const defaultSystemPrompt = `You are an expert Systematic Literature Review (SLR) Data Ingestion & Deduplication Specialist. Your role is to act as a high-precision adjudication engine for an automated screening pipeline. You specialize in analyzing highly similar pairs of academic papers—often emerging from the same research lab—and making a definitive database execution choice.

When the user provides a pair of papers containing Title, DOI, Year, Authors, and Abstract, your job is to output a direct, unambiguous decision adhering to the structured JSON schema.

### 1. The Decision Taxonomy
You must classify the pair into exactly one of these four categories:
1. CONFIRMED DUPLICATE (Conference-to-Journal Progression): Retain Journal as Primary record; mark Conference paper for exclusion.
2. STRUCTURAL OVERLAP (Parent Book Container vs. Child Chapter): Retain Child Chapter; mark Parent Book Volume for exclusion.
3. COMPANION PAPERS (Multipart Study): Retain BOTH papers. Note shared study cluster lineage.
4. FALSE FLAG / DISTINCT PRIMARY STUDIES (Parallel Lab Tracks): Retain BOTH papers as active, independent primary studies.

### 2. Guardrails & Traps to Watch For
* The Reverse Sequence Trap: Do not assume lower publication year means conference stub. Verify computational cores.
* The Vocabulary Echo: Papers sharing vocabulary but fundamentally different architectures/methods (e.g. QMIX vs Offline DRL cGAN) are distinct branches. Do not merge them.`;

      const defaultUserTemplate = `Analyze the following candidate duplicate paper pair:

### Paper 1 (ID: {{paper1_id}})
- Title: {{paper1_title}}
- DOI: {{paper1_doi}}
- Year: {{paper1_year}}
- Authors: {{paper1_authors}}
- Abstract: {{paper1_abstract}}

### Paper 2 (ID: {{paper2_id}})
- Title: {{paper2_title}}
- DOI: {{paper2_doi}}
- Year: {{paper2_year}}
- Authors: {{paper2_authors}}
- Abstract: {{paper2_abstract}}`;

      const defaultLlmConfig = JSON.stringify({
        model_id: 'gemini-2.5-flash',
        temperature: 0.0,
        max_tokens: 2000,
        execution_mode: 'flex'
      });

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
        VALUES ('default-duplicate-review', NULL, 'Default Duplicate Review Prompt', 'Automated Duplicate & Structural Overlap Screening Specialist for Candidate Paper Pairs', 'duplicate_review', ?, ?, ?, ?, 1, ?, ?)
      `).run(defaultSystemPrompt, defaultUserTemplate, defaultDupSchema, defaultLlmConfig, now, now);
      console.log("Seeded default duplicate_review prompt template.");
    }
  } catch (e) {
    console.error("Failed to seed default duplicate_review prompt:", e);
  }

  // Seed default consolidation_audit prompt template if none exists
  try {
    const auditPromptCount = db.prepare("SELECT COUNT(*) as count FROM prompt_templates WHERE prompt_type = 'consolidation_audit'").get() as { count: number };
    if (auditPromptCount.count === 0) {
      const defaultAuditSchema = JSON.stringify(DEFAULT_STAGE_SCHEMAS.consolidation_audit, null, 2);

      const defaultAuditSystem = `You are the Lead Systematic Literature Review (SLR) Methodology & Quality Assurance Auditor. Your mission is to conduct a strict, objective, and adversarial evaluation of the 4-stage LLM pipeline prompts (Stage 1: Fast Filter, Stage 2: Gatekeeper, Stage 3: Scientist, Stage 4: Miner) against the project's research manifesto, objective, research questions (RQs), and exclusion criteria.

Your audit consists of three core evaluation dimensions:
1. AVAILABILITY AUDIT: Check that all 4 stage prompts are configured and contain valid instructions, user templates, and variables.
2. SEMANTIC ALIGNMENT AUDIT: Evaluate whether each stage's prompt accurately reflects the research domain, boundary conditions, and criteria defined in the project research context. Flag any hallucinated rules, missing constraints, or semantic drift.
3. INTER-STAGE CONSISTENCY & CHAINABILITY: Verify that data flowing between stages is logically coherent:
   - S1 (Fast Filter) -> S2 (Gatekeeper): S1 must only filter obvious noise (EC-1..3), handing off potential candidates to S2 for full-text inspection (EC-4..9). Exclusion codes must be strictly orthogonal.
   - S2 (Gatekeeper) -> S3 (Scientist): Papers passing S2 must possess physical hardware testbeds/experimental data for S3 Quality Appraisal.
   - S3 (Scientist) -> S4 (Miner): Only methodologically sound studies meeting QA criteria flow into S4 for detailed data extraction.

You must output your findings strictly adhering to the structured JSON schema with concrete, actionable recommendations.`;

      const defaultAuditUser = `Conduct an inter-stage prompt consolidation and consistency audit on the following project context and 4-stage pipeline prompts:

### PROJECT RESEARCH CONTEXT
- Project Name: {{project_name}}
- Research Objective: {{project_objective}}
- Research Manifesto / Scope: {{project_manifesto}}
- Research Questions (RQs): {{project_questions}}
- Quality Assessment Rules: {{project_qa_rules}}
- Exclusion Criteria: {{project_ec_rules}}

### 4-STAGE PIPELINE CONFIGURATION
---
#### STAGE 1: FAST FILTER (Metadata Screening)
- System Instruction:
{{s1_system_instruction}}
- User Template:
{{s1_user_template}}

---
#### STAGE 2: GATEKEEPER (Domain & Full-Text Screening)
- System Instruction:
{{s2_system_instruction}}
- User Template:
{{s2_user_template}}

---
#### STAGE 3: SCIENTIST (Quality Appraisal)
- System Instruction:
{{s3_system_instruction}}
- User Template:
{{s3_user_template}}

---
#### STAGE 4: MINER (Data Extraction)
- System Instruction:
{{s4_system_instruction}}
- User Template:
{{s4_user_template}}`;

      const defaultAuditLlmConfig = JSON.stringify({
        model_id: 'gemini-2.5-flash',
        temperature: 0.0,
        max_tokens: 4000,
        execution_mode: 'flex'
      });

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
        VALUES ('default-prompt-consolidation-audit', NULL, 'Default Inter-Stage Consolidation Auditor', 'Zero-temperature adversarial prompt auditor for evaluating 4-stage pipeline chainability and semantic integrity', 'consolidation_audit', ?, ?, ?, ?, 1, ?, ?)
      `).run(defaultAuditSystem, defaultAuditUser, defaultAuditSchema, defaultAuditLlmConfig, now, now);
      console.log("Seeded default consolidation_audit prompt template.");
    }
  } catch (e) {
    console.error("Failed to seed default consolidation_audit prompt:", e);
  }

  // Seed default prompt_optimizer template if none exists
  try {
    const optPromptCount = db.prepare("SELECT COUNT(*) as count FROM prompt_templates WHERE prompt_type = 'prompt_optimizer'").get() as { count: number };
    if (optPromptCount.count === 0) {
      const defaultOptSchema = JSON.stringify(DEFAULT_STAGE_SCHEMAS.prompt_optimizer, null, 2);

      const defaultOptSystem = `You are a World-Class Systematic Literature Review (SLR) Prompt Engineering & Optimization Specialist.
Your goal is to analyze discrepancies between automated LLM screening predictions and human double-blind adjudicated consensus (Gold Standard), diagnose root causes (e.g. prompt ambiguity, boundary over-strictness, missed hardware synonyms, missing logic trace gates), and generate surgical, non-regressive prompt revisions.

Key Optimization Directives:
1. SURGICAL PRECISION: Do not rewrite working prompts completely. Make targeted adjustments to system instructions and logic trace guidance to address identified failure modes.
2. PRESERVE RECALL & PREVENT REGRESSION: PRISMA standards require 100% Recall on Stage 1 (0 false negatives). Ensure changes that fix false positives do not cause previously included papers to be falsely excluded.
3. SELECTIVE FULL-TEXT PDF REQUESTS: If a discrepancy hinges on subtle empirical methodology that cannot be resolved from the abstract alone, populate the 'needs_full_text' array with the paper ID and technical rationale so the researcher can approve attaching the full document.
4. PROMPT DIFFS: Provide complete, ready-to-run proposed System Instruction and User Template strings adhering to the target stage's structured schema.`;

      const defaultOptUser = `Optimize the prompt for {{stage_name}} based on the following calibration discrepancy dataset:

### TARGET PIPELINE STAGE
Stage: {{stage_name}} (Stage {{stage_num}})

### PROJECT CONTEXT
- Research Objective: {{project_objective}}
- Scope Manifesto: {{project_manifesto}}
- Relevant Rules: {{project_rules}}

### CURRENT PROMPT UNDER EVALUATION
#### Current System Instruction:
{{current_system_instruction}}

#### Current User Template:
{{current_user_template}}

### CALIBRATION DISCREPANCY ANALYSIS (AI vs Gold Standard Consensus)
{{discrepancies_json}}

### SIBLING PIPELINE PROMPTS (For Inter-Stage Boundary Alignment)
{{sibling_prompts_summary}}

Analyze the error patterns, identify edge cases, determine if any full PDFs are required, and output the optimized prompt revision.`;

      const defaultOptLlmConfig = JSON.stringify({
        model_id: 'gemini-2.5-pro',
        temperature: 0.0,
        max_tokens: 6000,
        execution_mode: 'standard',
        interaction_chaining: true
      });

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
        VALUES ('default-prompt-optimizer', NULL, 'Default Prompt Optimizer Specialist', 'High-reasoning prompt optimizer specializing in calibration error pattern diagnosis, selective PDF retrieval, and non-regressive prompt synthesis', 'prompt_optimizer', ?, ?, ?, ?, 1, ?, ?)
      `).run(defaultOptSystem, defaultOptUser, defaultOptSchema, defaultOptLlmConfig, now, now);
      console.log("Seeded default prompt_optimizer template.");
    }
  } catch (e) {
    console.error("Failed to seed default prompt_optimizer template:", e);
  }

  // Ensure ACTIVE_PROJECT_ID config key exists
  const activeProjConfig = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
  if (!activeProjConfig) {
    db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', '')").run();
  }

  // Migrate legacy PDF paths to the unified pdf_library layout and perform self-healing
  // DISABLED: to prevent bloated startup and execution
  /*
  try {
    const isMigrated = db.prepare("SELECT value FROM configs WHERE key = 'MIGRATION_LEGACY_PDF_PATHS_DONE'").get() as { value: string } | undefined;
    if (!isMigrated || isMigrated.value !== 'true') {
      db.prepare(`
      UPDATE papers 
      SET Local_PDF_Path = REPLACE(REPLACE(Local_PDF_Path, 'cached_pdf/', 'pdf_library/cached/'), 'cached_pdf\\', 'pdf_library/cached/')
      WHERE Local_PDF_Path LIKE 'cached_pdf/%' OR Local_PDF_Path LIKE 'cached_pdf\\%'
    `).run();

    db.prepare(`
      UPDATE papers 
      SET Local_PDF_Path = REPLACE(REPLACE(Local_PDF_Path, 'downloaded_pdf/', 'pdf_library/downloads/'), 'downloaded_pdf\\', 'pdf_library/downloads/')
      WHERE Local_PDF_Path LIKE 'downloaded_pdf/%' OR Local_PDF_Path LIKE 'downloaded_pdf\\%'
    `).run();

    db.prepare(`
      UPDATE papers 
      SET Local_PDF_Path = REPLACE(REPLACE(Local_PDF_Path, 'raw_pdf/', 'pdf_library/raw/'), 'raw_pdf\\', 'pdf_library/raw/')
      WHERE Local_PDF_Path LIKE 'raw_pdf/%' OR Local_PDF_Path LIKE 'raw_pdf\\%'
    `).run();

    db.prepare(`
      UPDATE papers 
      SET Local_PDF_Path = REPLACE(REPLACE(Local_PDF_Path, 'pdf_repo/', 'pdf_library/repo/'), 'pdf_repo\\', 'pdf_library/repo/')
      WHERE Local_PDF_Path LIKE 'pdf_repo/%' OR Local_PDF_Path LIKE 'pdf_repo\\%'
    `).run();

    // Self-healing migration for PDF paths and status consistency
    const papers = db.prepare(`SELECT Paper_ID, Local_PDF_Status, Local_PDF_Path, Project_ID FROM papers WHERE Local_PDF_Path IS NOT NULL`).all() as {
      Paper_ID: string;
      Local_PDF_Status: string;
      Local_PDF_Path: string;
      Project_ID: string;
    }[];

    const rawPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'raw');
    if (!fs.existsSync(rawPdfDir)) {
      fs.mkdirSync(rawPdfDir, { recursive: true });
    }

    for (const paper of papers) {
      const { Paper_ID: paperId, Local_PDF_Status: status, Local_PDF_Path: dbPath, Project_ID: projectId } = paper;
      const normalizedPath = dbPath.replace(/\\/g, '/');
      const absolutePath = path.join(PROJECT_ROOT, normalizedPath);

      if (status === 'SYNCED') {
        const project = db.prepare('SELECT folder_name FROM projects WHERE id = ?').get(projectId) as { folder_name: string } | undefined;
        const folderName = project ? project.folder_name : 'default_project';
        const expectedRepoPath = `pdf_library/repo/${folderName}/${paperId}.pdf`;
        const absoluteRepoPath = path.join(PROJECT_ROOT, expectedRepoPath);

        if (fs.existsSync(absoluteRepoPath)) {
          db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ? AND Project_ID = ?').run(expectedRepoPath, paperId, projectId);
        } else {
          // If repo path is missing but raw file exists, copy raw file to repo path and update path
          const rawFilePath = path.join(rawPdfDir, `${paperId}.pdf`);
          if (fs.existsSync(rawFilePath)) {
            try {
              const repoDir = path.dirname(absoluteRepoPath);
              if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });
              fs.copyFileSync(rawFilePath, absoluteRepoPath);
              db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ? AND Project_ID = ?').run(expectedRepoPath, paperId, projectId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`Failed to self-heal copy raw to repo for ${paperId}: ${msg}`);
            }
          } else {
            // Check if file is still in cached/ or somewhere else and heal
            if (fs.existsSync(absolutePath)) {
              try {
                const repoDir = path.dirname(absoluteRepoPath);
                if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });
                fs.copyFileSync(absolutePath, absoluteRepoPath);
                // Also copy to raw/ for eternal library
                fs.copyFileSync(absolutePath, rawFilePath);
                db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ? AND Project_ID = ?').run(expectedRepoPath, paperId, projectId);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`Failed to self-heal copy legacy to repo for ${paperId}: ${msg}`);
              }
            } else {
              // PDF is completely missing on disk
              db.prepare(`UPDATE papers SET Local_PDF_Status = 'MISSING', Local_PDF_Path = NULL, PDF_Link = NULL WHERE Paper_ID = ? AND Project_ID = ?`).run(paperId, projectId);
            }
          }
        }
      } else if (status === 'MATCHED' || status === 'DOWNLOADED') {
        const expectedRawPath = `pdf_library/raw/${paperId}.pdf`;
        const absoluteRawPath = path.join(PROJECT_ROOT, expectedRawPath);

        if (fs.existsSync(absoluteRawPath)) {
          db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ? AND Project_ID = ?').run(expectedRawPath, paperId, projectId);
        } else {
          if (fs.existsSync(absolutePath)) {
            try {
              fs.copyFileSync(absolutePath, absoluteRawPath);
              db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ? AND Project_ID = ?').run(expectedRawPath, paperId, projectId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`Failed to copy legacy path to raw/ for ${paperId}: ${msg}`);
            }
          } else {
            db.prepare(`UPDATE papers SET Local_PDF_Status = 'MISSING', Local_PDF_Path = NULL, PDF_Link = NULL WHERE Paper_ID = ? AND Project_ID = ?`).run(paperId, projectId);
          }
        }
      }
    }
    db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('MIGRATION_LEGACY_PDF_PATHS_DONE', 'true')").run();
    console.log("Completed legacy PDF paths migration and self-healing.");
  }
} catch (e) {
  console.error("Failed to migrate and self-heal PDF paths:", e);
}
  */

  // Self-healing migration for AI decisions in reviewer_decisions from llm_audit_log
  // DISABLED: to prevent bloated startup and execution
  /*
  try {
    const isAiMigrated = db.prepare("SELECT value FROM configs WHERE key = 'MIGRATION_LEGACY_AI_DECISIONS_DONE'").get() as { value: string } | undefined;
    if (!isAiMigrated || isAiMigrated.value !== 'true') {
      const rdRows = db.prepare(`
      SELECT id, paper_id, project_id, reviewer_name, decision, ec_trigger, rationale 
      FROM reviewer_decisions 
      WHERE reviewer_name LIKE '%gemini%' 
         OR reviewer_name LIKE '%gpt%' 
         OR reviewer_name LIKE '%claude%'
    `).all() as {
      id: number;
      paper_id: string;
      project_id: string;
      reviewer_name: string;
      decision: string | null;
      ec_trigger: string | null;
      rationale: string | null;
    }[];

    let fixedCount = 0;
    const selectAuditStmt = db.prepare(`
      SELECT structured_output 
      FROM llm_audit_log 
      WHERE paper_id = ? AND project_id = ? AND status = 'SUCCESS' 
      ORDER BY created_at DESC LIMIT 1
    `);

    const updateDecisionStmt = db.prepare(`
      UPDATE reviewer_decisions 
      SET decision = ?, ec_trigger = ?, rationale = ? 
      WHERE id = ?
    `);

    for (const row of rdRows) {
      const auditLog = selectAuditStmt.get(row.paper_id, row.project_id) as { structured_output: string } | undefined;
      if (auditLog && auditLog.structured_output) {
        try {
          const parsed = JSON.parse(auditLog.structured_output);
          let decision = parsed.decision;
          let ecTrigger = parsed.exclusion_trigger || parsed.exclusion_code;
          let rationale = parsed.rationale || parsed.reasoning;

          if (!decision || !rationale) {
            for (const key of ["final_evaluation", "evaluation", "result"]) {
              const sub = parsed[key];
              if (sub && typeof sub === 'object') {
                if (!decision) decision = sub.decision;
                if (!ecTrigger) ecTrigger = sub.exclusion_trigger || sub.exclusion_code;
                if (!rationale) rationale = sub.rationale || sub.reasoning;
              }
            }
          }

          const targetDecision = decision || "EXCLUDE";
          const targetEcTrigger = ecTrigger || "NONE";
          const targetRationale = rationale || "";

          if (
            row.decision !== targetDecision ||
            row.ec_trigger !== targetEcTrigger ||
            row.rationale !== targetRationale
          ) {
            updateDecisionStmt.run(targetDecision, targetEcTrigger, targetRationale, row.id);
            fixedCount++;
          }
        } catch (err) {
          // Ignore parse errors on individual rows
        }
      }
    }
    if (fixedCount > 0) {
      console.log(`Self-healing: corrected ${fixedCount} AI screening decision mismatch(es) in reviewer_decisions.`);
    }
    db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('MIGRATION_LEGACY_AI_DECISIONS_DONE', 'true')").run();
    }
  } catch (e) {
    console.error("Failed to execute self-healing migration for AI decisions:", e);
  }
  */

  // ─────────────────────────────────────────────────────────────────────────
  // CORRECTIVE MIGRATION: Revert the incorrect +1 stage bump for INCLUDE
  // decisions that was applied by a prior self-healing migration.
  // Convention (Option 2): ai_stage always stores the literal completed stage N,
  // never N+1, regardless of whether the decision is INCLUDE or EXCLUDE.
  // ─────────────────────────────────────────────────────────────────────────
  // DISABLED: to prevent bloated startup and execution
  /*
  try {
    const isRevertDone = db.prepare("SELECT value FROM configs WHERE key = 'MIGRATION_AI_STAGE_INCLUDE_REVERT_DONE'").get() as { value: string } | undefined;
    if (!isRevertDone || isRevertDone.value !== 'true') {
      const papersWithLogs = db.prepare(`
        SELECT DISTINCT paper_id, project_id 
        FROM llm_audit_log 
        WHERE status = 'SUCCESS'
      `).all() as { paper_id: string; project_id: string }[];

      let revertCount = 0;
      const selectStmt = db.prepare("SELECT ai_stage, ai_decision, ai_exclusion_code FROM papers WHERE Paper_ID = ? AND Project_ID = ?");
      const updateStmt  = db.prepare("UPDATE papers SET ai_stage = ?, ai_decision = ?, ai_exclusion_code = ? WHERE Paper_ID = ? AND Project_ID = ?");
      const logsStmt    = db.prepare(`
        SELECT task_type, structured_output 
        FROM llm_audit_log 
        WHERE paper_id = ? AND project_id = ? AND status = 'SUCCESS'
        ORDER BY created_at ASC
      `);

      for (const row of papersWithLogs) {
        const dbPaper = selectStmt.get(row.paper_id, row.project_id) as { ai_stage: number; ai_decision: string | null; ai_exclusion_code: string | null } | undefined;
        if (!dbPaper) continue;

        const logs = logsStmt.all(row.paper_id, row.project_id) as { task_type: string; structured_output: string }[];
        if (logs.length === 0) continue;

        const taskToStage = (t: string) => {
          if (t === 'fast_filter' || t === 'screening') return 1;
          if (t === 'gatekeeper' || t === 'fulltext') return 2;
          if (t === 'scientist') return 3;
          if (t === 'miner' || t === 'extraction') return 4;
          return 0;
        };

        const highestLogStage = Math.max(...logs.map(l => taskToStage(l.task_type)));
        const latestLog = [...logs].reverse().find(l => taskToStage(l.task_type) === highestLogStage);

        let resolvedDecision = dbPaper.ai_decision;
        let resolvedExcode = dbPaper.ai_exclusion_code;
        if (latestLog?.structured_output) {
          try {
            const parsed = JSON.parse(latestLog.structured_output);
            let decision = parsed.decision;
            let ecTrigger = parsed.exclusion_trigger || parsed.exclusion_code;
            if (!decision) {
              for (const key of ["final_evaluation", "evaluation", "result"]) {
                const sub = parsed[key];
                if (sub && typeof sub === 'object') {
                  if (!decision) decision = sub.decision;
                  if (!ecTrigger) ecTrigger = sub.exclusion_trigger || sub.exclusion_code;
                }
              }
            }
            if (decision) {
              const uDec = decision.toUpperCase();
              if (uDec === 'EXCLUDE') {
                resolvedDecision = 'EXCLUDE';
                resolvedExcode = ecTrigger && ecTrigger !== 'NONE' ? ecTrigger : null;
              } else {
                resolvedDecision = decision;
                resolvedExcode = null;
              }
            }
          } catch (_) {}
        }

        // Simpler convention: stage always = highestLogStage, no +1 for INCLUDE
        const correctStage = highestLogStage;

        if (dbPaper.ai_stage !== correctStage || dbPaper.ai_decision !== resolvedDecision || dbPaper.ai_exclusion_code !== resolvedExcode) {
          updateStmt.run(correctStage, resolvedDecision, resolvedExcode, row.paper_id, row.project_id);
          revertCount++;
        }
      }

      if (revertCount > 0) {
        console.log(`Self-healing revert: corrected ${revertCount} paper(s) with incorrect +1 stage bump.`);
      }
      db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('MIGRATION_AI_STAGE_INCLUDE_REVERT_DONE', 'true')").run();
    }
  } catch (e) {
    console.error("Failed to execute corrective AI stage revert migration:", e);
  }
  */

  // ─────────────────────────────────────────────────────────────────────────
  // ONGOING SELF-HEALING: Sync ai_stage / ai_decision from llm_audit_log
  // Uses the simpler convention: stage = highest completed stage N (no +1).
  // ─────────────────────────────────────────────────────────────────────────
  // DISABLED: to prevent bloated startup and execution
  /*
  try {
    const papersWithLogs = db.prepare(`
      SELECT DISTINCT paper_id, project_id 
      FROM llm_audit_log 
      WHERE status = 'SUCCESS'
    `).all() as { paper_id: string; project_id: string }[];

    let healedStageCount = 0;
    const selectPaperStageStmt = db.prepare("SELECT ai_stage, ai_decision, ai_exclusion_code FROM papers WHERE Paper_ID = ? AND Project_ID = ?");
    const updatePaperStageStmt = db.prepare("UPDATE papers SET ai_stage = ?, ai_decision = ?, ai_exclusion_code = ? WHERE Paper_ID = ? AND Project_ID = ?");
    const selectPaperLogsStmt  = db.prepare(`
      SELECT task_type, structured_output 
      FROM llm_audit_log 
      WHERE paper_id = ? AND project_id = ? AND status = 'SUCCESS'
      ORDER BY created_at ASC
    `);

    const taskToStage = (t: string) => {
      if (t === 'fast_filter' || t === 'screening') return 1;
      if (t === 'gatekeeper' || t === 'fulltext') return 2;
      if (t === 'scientist') return 3;
      if (t === 'miner' || t === 'extraction') return 4;
      return 0;
    };

    for (const row of papersWithLogs) {
      const dbPaper = selectPaperStageStmt.get(row.paper_id, row.project_id) as { ai_stage: number; ai_decision: string | null; ai_exclusion_code: string | null } | undefined;
      if (!dbPaper) continue;

      const logs = selectPaperLogsStmt.all(row.paper_id, row.project_id) as { task_type: string; structured_output: string }[];
      if (logs.length === 0) continue;

      const highestLogStage = Math.max(...logs.map(l => taskToStage(l.task_type)));
      const latestLog = [...logs].reverse().find(l => taskToStage(l.task_type) === highestLogStage);

      let resolvedDecision = dbPaper.ai_decision;
      let resolvedExcode = dbPaper.ai_exclusion_code;
      if (latestLog?.structured_output) {
        try {
          const parsed = JSON.parse(latestLog.structured_output);
          let decision = parsed.decision;
          let ecTrigger = parsed.exclusion_trigger || parsed.exclusion_code;
          if (!decision) {
            for (const key of ["final_evaluation", "evaluation", "result"]) {
              const sub = parsed[key];
              if (sub && typeof sub === 'object') {
                if (!decision) decision = sub.decision;
                if (!ecTrigger) ecTrigger = sub.exclusion_trigger || sub.exclusion_code;
              }
            }
          }
          if (decision) {
            const uDec = decision.toUpperCase();
            if (uDec === 'EXCLUDE') {
              resolvedDecision = 'EXCLUDE';
              resolvedExcode = ecTrigger && ecTrigger !== 'NONE' ? ecTrigger : null;
            } else {
              resolvedDecision = decision;
              resolvedExcode = null;
            }
          }
          // Force Miner stage to default to INCLUDE if decision is missing or resolves to EXCLUDE
          if (highestLogStage === 4 && (!resolvedDecision || resolvedDecision.toUpperCase() === 'EXCLUDE')) {
            resolvedDecision = 'INCLUDE';
            resolvedExcode = null;
          }
        } catch (_) {}
      } else if (highestLogStage === 4) {
        resolvedDecision = 'INCLUDE';
        resolvedExcode = null;
      }

      // Simpler convention: stage = literal completed stage N (no +1)
      const resolvedStage = highestLogStage;

      if (dbPaper.ai_stage !== resolvedStage || dbPaper.ai_decision !== resolvedDecision || dbPaper.ai_exclusion_code !== resolvedExcode) {
        updatePaperStageStmt.run(resolvedStage, resolvedDecision, resolvedExcode, row.paper_id, row.project_id);
        healedStageCount++;
      }
    }

    if (healedStageCount > 0) {
      console.log(`Self-healing: corrected ${healedStageCount} AI stage/decision mismatches in papers.`);
    }

    // Force heal any existing papers in Stage 4 (Miner) to have INCLUDE decisions
    const healedExistingCount = db.prepare(`
      UPDATE papers
      SET ai_decision = CASE WHEN ai_stage = 4 AND (ai_decision IS NULL OR ai_decision = 'EXCLUDE' OR ai_decision = '') THEN 'INCLUDE' ELSE ai_decision END,
          ai_exclusion_code = CASE WHEN ai_stage = 4 THEN NULL ELSE ai_exclusion_code END,
          manual_decision = CASE WHEN manual_stage = 4 AND (manual_decision IS NULL OR manual_decision = 'EXCLUDE' OR manual_decision = '') THEN 'INCLUDE' ELSE manual_decision END,
          manual_exclusion_code = CASE WHEN manual_stage = 4 THEN NULL ELSE manual_exclusion_code END
      WHERE ai_stage = 4 OR manual_stage = 4
    `).run().changes;

    if (healedExistingCount > 0) {
      console.log(`Self-healing: forced ${healedExistingCount} existing Stage 4 Miner paper(s) to INCLUDE decision status.`);
    }
  } catch (e) {
    console.error("Failed to execute self-healing migration for AI stages:", e);
  }
  */

  // ─────────────────────────────────────────────────────────────────────────
  // CORRECTIVE MIGRATION: Remove Human_* columns from papers table
  // ─────────────────────────────────────────────────────────────────────────
  // DISABLED: to prevent bloated startup and execution
  /*
  try {
    const isRemoveDone = db.prepare("SELECT value FROM configs WHERE key = 'MIGRATION_REMOVE_HUMAN_COLS_FROM_PAPERS_DONE'").get() as { value: string } | undefined;
    if (!isRemoveDone || isRemoveDone.value !== 'true') {
      // 1. Copy any historical data from papers.Human_* to calibration_papers.manual_*
      db.prepare(`
        UPDATE calibration_papers
        SET 
          manual_decision = COALESCE(manual_decision, (
            SELECT Human_Decision FROM papers p 
            WHERE p.Paper_ID = calibration_papers.Paper_ID 
              AND p.Project_ID = calibration_papers.Project_ID 
              AND p.Human_Decision IS NOT NULL
          )),
          manual_rationale = COALESCE(manual_rationale, (
            SELECT Human_Rationale FROM papers p 
            WHERE p.Paper_ID = calibration_papers.Paper_ID 
              AND p.Project_ID = calibration_papers.Project_ID 
              AND p.Human_Rationale IS NOT NULL
          )),
          manual_quality_assessment = COALESCE(manual_quality_assessment, (
            SELECT Human_QA_Scores FROM papers p 
            WHERE p.Paper_ID = calibration_papers.Paper_ID 
              AND p.Project_ID = calibration_papers.Project_ID 
              AND p.Human_QA_Scores IS NOT NULL
          )),
          manual_extracted_data = COALESCE(manual_extracted_data, (
            SELECT Human_Extracted_Data FROM papers p 
            WHERE p.Paper_ID = calibration_papers.Paper_ID 
              AND p.Project_ID = calibration_papers.Project_ID 
              AND p.Human_Extracted_Data IS NOT NULL
          ))
        WHERE EXISTS (
          SELECT 1 FROM papers p 
          WHERE p.Paper_ID = calibration_papers.Paper_ID 
            AND p.Project_ID = calibration_papers.Project_ID
        )
      `).run();

      // 2. Drop columns from papers table.
      // better-sqlite3 runs with bundled modern SQLite, so ALTER TABLE ... DROP COLUMN is fully supported.
      const columnsToDrop = [
        'Human_Decision',
        'Human_EC_Trigger',
        'Human_Rationale',
        'Human_QA_Scores',
        'Human_Extracted_Data'
      ];

      for (const col of columnsToDrop) {
        try {
          db.exec(`ALTER TABLE papers DROP COLUMN ${col}`);
        } catch (err) {
          // Column might already be gone
        }
      }

      db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('MIGRATION_REMOVE_HUMAN_COLS_FROM_PAPERS_DONE', 'true')").run();
      console.log("Successfully migrated and dropped legacy Human_* columns from papers table.");
    }
  } catch (e) {
    console.error("Failed to execute corrective migration to remove Human_* columns:", e);
  }
  */

  // Self-healing migration: reset unscreened papers in active project with manual_stage = 1 and manual_decision = 'PENDING' back to manual_stage = 0
  try {
    const activeProjRow = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
    const activeProjId = activeProjRow?.value || '';
    const info = db.prepare(`
      UPDATE papers 
      SET manual_stage = 0, manual_decision = NULL 
      WHERE Project_ID = ? 
        AND manual_stage = 1 
        AND (manual_decision = 'PENDING' OR manual_decision IS NULL OR manual_decision = '') 
        AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID
        )
    `).run(activeProjId);
    if (info.changes > 0) {
      console.log(`[Self-Healing Migration] Cleaned ${info.changes} unscreened papers in active project '${activeProjId}' from manual_stage 1 to 0.`);
    }

    // Self-healing migration: promote papers with extracted data to stage 4 (Miner data extraction) ONLY IF decision is INCLUDE
    const promoteAi = db.prepare("UPDATE papers SET ai_stage = 4 WHERE ai_extracted_data IS NOT NULL AND ai_extracted_data != '' AND ai_decision LIKE 'INCLUDE%' AND (ai_stage IS NULL OR ai_stage < 4)").run();
    const promoteManual = db.prepare("UPDATE papers SET manual_stage = 4 WHERE manual_extracted_data IS NOT NULL AND manual_extracted_data != '' AND manual_decision LIKE 'INCLUDE%' AND (manual_stage IS NULL OR manual_stage < 4)").run();
    if (promoteAi.changes > 0 || promoteManual.changes > 0) {
      console.log(`[Self-Healing Migration] Promoted ${promoteAi.changes} AI and ${promoteManual.changes} manual INCLUDED papers with extracted data to stage 4.`);
    }
  } catch (e) {
    console.error("Failed to run unscreened papers stage cleanup migration:", e);
  }

  // Run self-healing Project ID normalization migration
  migrateProjectIds(db);
}



