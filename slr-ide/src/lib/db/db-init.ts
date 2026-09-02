import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { migrateProjectIds } from './migrate-project-ids';
import { DEFAULT_STAGE_SCHEMAS } from '../services/prompt-validator';
import { CANONICAL_STAGE_PROMPTS } from '../services/prompt-defaults';

const PROJECT_ROOT = process.cwd().endsWith('slr-ide') 
  ? process.cwd() 
  : (fs.existsSync(path.join(process.cwd(), 'slr-ide')) ? path.join(process.cwd(), 'slr-ide') : process.cwd());

export function initializeDatabase(db: Database.Database): void {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. CANONICAL DDL INITIALIZATION
  // Ordered topologically so parent tables are created before foreign key references
  // ─────────────────────────────────────────────────────────────────────────
  db.exec(`
    -- Core System & Config Tables
    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS remote_workers (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      host TEXT NOT NULL,
      session_token TEXT,
      status TEXT NOT NULL DEFAULT 'OFFLINE',
      last_seen_at TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_pricing (
      model_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      input_token_price REAL NOT NULL,
      output_token_price REAL NOT NULL,
      thinking_token_price REAL,
      batch_discount REAL DEFAULT 0.5,
      updated_at TEXT NOT NULL
    );

    -- Primary Projects Table
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
      search_queries TEXT,
      llm_config TEXT DEFAULT '{}',
      rolling_batch_size INTEGER DEFAULT 20,
      created_at TEXT NOT NULL
    );

    -- Papers & Calibration Papers
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
      manual_extracted_data TEXT DEFAULT NULL,
      calibration_pool TEXT,
      calibration_tag TEXT
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
    CREATE INDEX IF NOT EXISTS idx_papers_project ON papers (Project_ID);
    CREATE INDEX IF NOT EXISTS idx_papers_is_duplicate ON papers (is_duplicate);
    CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers (merged_into_id);

    CREATE INDEX IF NOT EXISTS idx_cal_papers_doi ON calibration_papers (DOI);
    CREATE INDEX IF NOT EXISTS idx_cal_papers_title ON calibration_papers (Title);
    CREATE INDEX IF NOT EXISTS idx_cal_papers_project ON calibration_papers (Project_ID);
    CREATE INDEX IF NOT EXISTS idx_cal_papers_is_duplicate ON calibration_papers (is_duplicate);
    CREATE INDEX IF NOT EXISTS idx_cal_papers_merged_into ON calibration_papers (merged_into_id);

    -- Prompt Templates
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      prompt_type TEXT,
      system_instruction TEXT,
      user_template TEXT NOT NULL,
      response_schema TEXT,
      llm_config TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      parent_prompt_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_templates_project ON prompt_templates(project_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_type ON prompt_templates(prompt_type);

    -- LLM Jobs & Cloud Batches
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

    CREATE INDEX IF NOT EXISTS idx_llm_jobs_project ON llm_jobs(project_id);

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

    CREATE INDEX IF NOT EXISTS idx_llm_batch_jobs_job ON llm_batch_jobs(job_id);

    -- Reviewer Decisions & Ledgers
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
    CREATE INDEX IF NOT EXISTS idx_ledger_paper ON calibration_commit_ledger(paper_id, project_id);

    -- Audit Logs
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

    CREATE INDEX IF NOT EXISTS idx_audit_project ON llm_audit_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_paper ON llm_audit_log(paper_id);
    CREATE INDEX IF NOT EXISTS idx_audit_job ON llm_audit_log(job_id);

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

    -- Deduplication & Analytics
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
    CREATE INDEX IF NOT EXISTS idx_dp_papers ON duplicate_pairs(paper1_id, paper2_id);

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

    CREATE INDEX IF NOT EXISTS idx_umbrellanizer_project ON umbrellanizer_results(project_id);

    -- Rolling Review Batches
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

    -- Prompt Auditing & Benchmarking
    CREATE TABLE IF NOT EXISTS prompt_audit_ledger (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      audit_type TEXT NOT NULL DEFAULT 'consolidation_audit',
      status TEXT NOT NULL DEFAULT 'PASSED',
      prompt_id TEXT,
      prompt_hash TEXT,
      parent_prompt_id TEXT,
      parent_prompt_hash TEXT,
      availability_score REAL DEFAULT 0.0,
      semantic_score REAL DEFAULT 0.0,
      chainability_score REAL DEFAULT 0.0,
      train_paper_ids TEXT,
      holdout_paper_ids TEXT,
      before_metrics TEXT,
      after_metrics TEXT,
      audit_report TEXT,
      raw_prompt TEXT,
      raw_response TEXT,
      model_id TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pal_project ON prompt_audit_ledger(project_id);

    CREATE TABLE IF NOT EXISTS prompt_benchmark_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      stage_num INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      pool TEXT NOT NULL DEFAULT 'POOL_A',
      prompt_template_id TEXT,
      prompt_hash TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      total_papers INTEGER DEFAULT 0,
      evaluated_papers INTEGER DEFAULT 0,
      train_count INTEGER DEFAULT 0,
      holdout_count INTEGER DEFAULT 0,
      summary_metrics TEXT,
      holdout_metrics TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
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

    -- Mockup Review Cache Table
    CREATE TABLE IF NOT EXISTS mockup_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      pool TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      prompt_hash TEXT,
      model_id TEXT NOT NULL,
      slr_blob BLOB NOT NULL,
      total_papers INTEGER DEFAULT 0,
      total_cost_usd REAL DEFAULT 0.0,
      total_tokens INTEGER DEFAULT 0,
      paper_results TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_mockup_cache_project_pool ON mockup_cache(project_id, pool);

    -- Dedicated PRISMA Screening State Table
    CREATE TABLE IF NOT EXISTS llm_screening_records (
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

    CREATE INDEX IF NOT EXISTS idx_lsr_proj_paper ON llm_screening_records(project_id, paper_id);
    CREATE INDEX IF NOT EXISTS idx_lsr_stage ON llm_screening_records(project_id, stage);

    -- Triggers to atomically sync papers, rolling_batch_papers, and calibration_papers ai_* state
    CREATE TRIGGER IF NOT EXISTS trg_lsr_insert AFTER INSERT ON llm_screening_records
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

    CREATE TRIGGER IF NOT EXISTS trg_lsr_update AFTER UPDATE ON llm_screening_records
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

    CREATE TRIGGER IF NOT EXISTS trg_lsr_delete AFTER DELETE ON llm_screening_records
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

    -- Synchronize PDF status and path from papers to calibration_papers
    CREATE TRIGGER IF NOT EXISTS trg_papers_pdf_sync_cal AFTER UPDATE OF Local_PDF_Status, Local_PDF_Path ON papers
    BEGIN
      UPDATE calibration_papers
      SET Local_PDF_Status = NEW.Local_PDF_Status,
          Local_PDF_Path = NEW.Local_PDF_Path
      WHERE Paper_ID = NEW.Paper_ID AND (Project_ID = NEW.Project_ID OR CAST(Project_ID AS TEXT) = CAST(NEW.Project_ID AS TEXT));
    END;

    -- Synchronize PDF status and path from calibration_papers to papers
    CREATE TRIGGER IF NOT EXISTS trg_cal_papers_pdf_sync AFTER UPDATE OF Local_PDF_Status, Local_PDF_Path ON calibration_papers
    BEGIN
      UPDATE papers
      SET Local_PDF_Status = NEW.Local_PDF_Status,
          Local_PDF_Path = NEW.Local_PDF_Path
      WHERE Paper_ID = NEW.Paper_ID AND (Project_ID = NEW.Project_ID OR CAST(Project_ID AS TEXT) = CAST(NEW.Project_ID AS TEXT));
    END;

    -- Synchronize general metadata updates from papers to calibration_papers
    CREATE TRIGGER IF NOT EXISTS trg_papers_metadata_sync_cal AFTER UPDATE OF Title, Authors, Year, DOI, Abstract, PDF_Link, Publisher, Original_Publisher, citation_count, notes ON papers
    BEGIN
      UPDATE calibration_papers
      SET Title = NEW.Title,
          Authors = NEW.Authors,
          Year = NEW.Year,
          DOI = NEW.DOI,
          Abstract = NEW.Abstract,
          PDF_Link = NEW.PDF_Link,
          Publisher = NEW.Publisher,
          Original_Publisher = NEW.Original_Publisher,
          citation_count = NEW.citation_count,
          notes = NEW.notes
      WHERE Paper_ID = NEW.Paper_ID AND (Project_ID = NEW.Project_ID OR CAST(Project_ID AS TEXT) = CAST(NEW.Project_ID AS TEXT));
    END;
  `);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. BACKWARD COMPATIBILITY FAST-PATH CHECKPOINT (SCHEMA_VERSION = 3)
  // For fresh installs, SCHEMA_VERSION = '3' is set immediately.
  // For legacy pre-v3 databases, run safe idempotent column checks once.
  // ─────────────────────────────────────────────────────────────────────────
  const schemaVersionRow = db.prepare("SELECT value FROM configs WHERE key = 'SCHEMA_VERSION'").get() as { value: string } | undefined;
  const currentSchemaVersion = schemaVersionRow?.value || '0';

  if (currentSchemaVersion !== '3') {
    // Run one-time alignment checks for older SQLite databases
    const safeAddColumn = (table: string, column: string, type: string) => {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      } catch (_) {
        // Column already exists
      }
    };

    safeAddColumn('prompt_templates', 'prompt_type', 'TEXT');
    safeAddColumn('prompt_templates', 'parent_prompt_id', 'TEXT');
    safeAddColumn('prompt_templates', 'response_schema', 'TEXT');
    safeAddColumn('prompt_templates', 'llm_config', "TEXT DEFAULT '{}'");
    safeAddColumn('prompt_templates', 'is_active', 'INTEGER DEFAULT 1');

    safeAddColumn('projects', 'scopus_search_string', 'TEXT');
    safeAddColumn('projects', 'manual_search_string', 'TEXT');
    safeAddColumn('projects', 'search_queries', 'TEXT');
    safeAddColumn('projects', 'goldmine_dest_path', 'TEXT');
    safeAddColumn('projects', 'llm_config', "TEXT DEFAULT '{}'");
    safeAddColumn('projects', 'rolling_batch_size', 'INTEGER DEFAULT 20');
    safeAddColumn('projects', 'project_budget_limit', 'REAL DEFAULT 0.0');
    safeAddColumn('projects', 'project_current_spend', 'REAL DEFAULT 0.0');
    safeAddColumn('projects', 'project_tax', 'REAL DEFAULT 0.0');
    safeAddColumn('projects', 'pool_tags', 'TEXT');
    safeAddColumn('projects', 'ec_rules', 'TEXT');
    safeAddColumn('projects', 'reasoning_template', 'TEXT');
    safeAddColumn('projects', 'pool_b_ec_rules', 'TEXT');
    safeAddColumn('projects', 'pool_b_reasoning_template', 'TEXT');
    safeAddColumn('projects', 'pool_c_qa_rules', 'TEXT');
    safeAddColumn('projects', 'pool_c_extraction_rules', 'TEXT');
    safeAddColumn('projects', 'gdrive_dest_path', "TEXT DEFAULT 'SLR_Magic/PDFs'");
    safeAddColumn('projects', 'cloud_provider', "TEXT DEFAULT 'gdrive'");
    safeAddColumn('projects', 'rclone_remote_name', 'TEXT');

    safeAddColumn('papers', 'Project_ID', 'TEXT');
    safeAddColumn('papers', 'Parent_Paper_ID', 'TEXT');
    safeAddColumn('papers', 'Original_Publisher', 'TEXT');
    safeAddColumn('papers', 'Publisher', 'TEXT');
    safeAddColumn('papers', 'citation_count', 'INTEGER DEFAULT 0');
    safeAddColumn('papers', 'is_duplicate', 'INTEGER DEFAULT 0');
    safeAddColumn('papers', 'merged_into_id', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'remote_worker_id', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'scrape_claimed_at', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'notes', 'TEXT');
    safeAddColumn('papers', 'ai_stage', 'INTEGER DEFAULT 0');
    safeAddColumn('papers', 'ai_decision', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'ai_exclusion_code', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'ai_rationale', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'ai_quality_assessment', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'ai_extracted_data', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'manual_stage', 'INTEGER DEFAULT 0');
    safeAddColumn('papers', 'manual_decision', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'manual_exclusion_code', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'manual_rationale', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'manual_quality_assessment', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'manual_extracted_data', 'TEXT DEFAULT NULL');
    safeAddColumn('papers', 'calibration_pool', 'TEXT');
    safeAddColumn('papers', 'calibration_tag', 'TEXT');

    safeAddColumn('calibration_papers', 'Parent_Paper_ID', 'TEXT');
    safeAddColumn('calibration_papers', 'remote_worker_id', 'TEXT');
    safeAddColumn('calibration_papers', 'scrape_claimed_at', 'TEXT');
    safeAddColumn('calibration_papers', 'ai_exclusion_code', 'TEXT DEFAULT NULL');
    safeAddColumn('calibration_papers', 'manual_exclusion_code', 'TEXT DEFAULT NULL');
    safeAddColumn('calibration_papers', 'calibration_pool', 'TEXT');
    safeAddColumn('calibration_papers', 'calibration_tag', 'TEXT');

    safeAddColumn('duplicate_pairs', 'ai_verdict', 'TEXT DEFAULT NULL');
    safeAddColumn('duplicate_pairs', 'ai_analysis', 'TEXT DEFAULT NULL');
    safeAddColumn('duplicate_pairs', 'ai_suggested_primary_id', 'TEXT DEFAULT NULL');

    safeAddColumn('reviewer_decisions', 'qa_scores', 'TEXT');
    safeAddColumn('reviewer_decisions', 'extracted_data', 'TEXT');

    safeAddColumn('calibration_commit_ledger', 'resolved_qa_scores', 'TEXT');
    safeAddColumn('calibration_commit_ledger', 'resolved_extracted_data', 'TEXT');

    safeAddColumn('llm_jobs', 'task_type', 'TEXT');

    safeAddColumn('prompt_audit_ledger', 'status', "TEXT DEFAULT 'PASSED'");
    safeAddColumn('prompt_audit_ledger', 'prompt_id', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'prompt_hash', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'parent_prompt_id', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'parent_prompt_hash', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'semantic_score', 'REAL DEFAULT 0.0');
    safeAddColumn('prompt_audit_ledger', 'train_paper_ids', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'holdout_paper_ids', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'before_metrics', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'after_metrics', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'audit_report', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'raw_prompt', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'model_id', 'TEXT');
    safeAddColumn('prompt_audit_ledger', 'input_tokens', 'INTEGER DEFAULT 0');
    safeAddColumn('prompt_audit_ledger', 'output_tokens', 'INTEGER DEFAULT 0');
    safeAddColumn('prompt_audit_ledger', 'cost_usd', 'REAL DEFAULT 0.0');

    safeAddColumn('prompt_benchmark_runs', 'pool', "TEXT DEFAULT 'POOL_A'");
    safeAddColumn('prompt_benchmark_runs', 'prompt_template_id', 'TEXT');
    safeAddColumn('prompt_benchmark_runs', 'prompt_hash', 'TEXT');
    safeAddColumn('prompt_benchmark_runs', 'evaluated_papers', 'INTEGER DEFAULT 0');
    safeAddColumn('prompt_benchmark_runs', 'train_count', 'INTEGER DEFAULT 0');
    safeAddColumn('prompt_benchmark_runs', 'holdout_count', 'INTEGER DEFAULT 0');
    safeAddColumn('prompt_benchmark_runs', 'summary_metrics', 'TEXT');
    safeAddColumn('prompt_benchmark_runs', 'holdout_metrics', 'TEXT');
    safeAddColumn('prompt_benchmark_runs', 'error_message', 'TEXT');
    safeAddColumn('prompt_benchmark_runs', 'updated_at', 'TEXT');

    // Auto-infer prompt_type for legacy untyped prompt records
    try {
      const untypedPrompts = db.prepare("SELECT id, name, response_schema FROM prompt_templates WHERE prompt_type IS NULL OR prompt_type = ''").all() as { id: string; name: string; response_schema: string | null }[];
      if (untypedPrompts.length > 0) {
        const updateStmt = db.prepare("UPDATE prompt_templates SET prompt_type = ? WHERE id = ?");
        for (const p of untypedPrompts) {
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
      }
    } catch (_) {}

    // Mark current schema version as 3
    db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('SCHEMA_VERSION', '3')").run();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. IDEMPOTENT DEFAULT SEEDINGS & CLEANUP
  // ─────────────────────────────────────────────────────────────────────────

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

  // Seed and synchronize all 8 canonical global baseline prompt templates in prompt_templates
  try {
    const now = new Date().toISOString();
    const existingTemplates = db.prepare("SELECT id, prompt_type, system_instruction, user_template, response_schema, llm_config FROM prompt_templates WHERE project_id IS NULL").all() as any[];
    const existingById = new Map<string, any>(existingTemplates.map(t => [t.id, t]));
    const existingByType = new Map<string, any>(existingTemplates.map(t => [t.prompt_type, t]));

    const insertStmt = db.prepare(`
      INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const updateGlobalStmt = db.prepare(`
      UPDATE prompt_templates
      SET name = ?,
          description = ?,
          system_instruction = ?,
          user_template = ?,
          response_schema = ?,
          llm_config = ?,
          updated_at = ?
      WHERE id = ? AND (project_id IS NULL OR id LIKE 'default-%')
    `);

    const updateCustomStmt = db.prepare(`
      UPDATE prompt_templates
      SET name = COALESCE(NULLIF(name, ''), ?),
          description = COALESCE(NULLIF(description, ''), ?),
          system_instruction = CASE WHEN system_instruction IS NULL OR system_instruction = '' THEN ? ELSE system_instruction END,
          user_template = CASE WHEN user_template IS NULL OR user_template = '' THEN ? ELSE user_template END,
          response_schema = CASE WHEN response_schema IS NULL OR response_schema = '' THEN ? ELSE response_schema END,
          llm_config = CASE WHEN llm_config IS NULL OR llm_config = '' OR llm_config = '{}' THEN ? ELSE llm_config END,
          updated_at = ?
      WHERE id = ?
    `);

    for (const [promptType, canonical] of Object.entries(CANONICAL_STAGE_PROMPTS)) {
      const existing = existingById.get(canonical.id) || existingByType.get(promptType);
      const schemaStr = JSON.stringify(canonical.response_schema, null, 2);
      const configStr = JSON.stringify(canonical.llm_config);

      if (!existing) {
        insertStmt.run(
          canonical.id,
          canonical.name,
          canonical.description,
          canonical.prompt_type,
          canonical.system_instruction,
          canonical.user_template,
          schemaStr,
          configStr,
          now,
          now
        );
      } else if (existing.project_id === null || existing.project_id === undefined || existing.id.startsWith('default-')) {
        // Keep global canonical default template in lockstep with latest codebase improvements
        updateGlobalStmt.run(
          canonical.name,
          canonical.description,
          canonical.system_instruction,
          canonical.user_template,
          schemaStr,
          configStr,
          now,
          existing.id
        );
      } else {
        // Self-heal missing/empty fields on existing custom template without overriding user edits
        updateCustomStmt.run(
          canonical.name,
          canonical.description,
          canonical.system_instruction,
          canonical.user_template,
          schemaStr,
          configStr,
          now,
          existing.id
        );
      }
    }
  } catch (e) {
    console.error("Failed to seed canonical baseline prompt templates:", e);
  }

  // Auto-heal missing default_prompts mappings in existing projects
  try {
    const projects = db.prepare("SELECT id, llm_config FROM projects").all() as { id: string; llm_config: string | null }[];
    const updateProjectConfig = db.prepare("UPDATE projects SET llm_config = ? WHERE id = ?");

    for (const p of projects) {
      let cfg: Record<string, any> = {};
      try {
        cfg = JSON.parse(p.llm_config || '{}');
      } catch (_) {
        cfg = {};
      }

      if (!cfg.default_prompts || typeof cfg.default_prompts !== 'object') {
        cfg.default_prompts = {};
      }

      let modified = false;
      for (const [pType, canonical] of Object.entries(CANONICAL_STAGE_PROMPTS)) {
        if (!cfg.default_prompts[pType]) {
          cfg.default_prompts[pType] = canonical.id;
          modified = true;
        }
      }

      if (modified) {
        updateProjectConfig.run(JSON.stringify(cfg), p.id);
      }
    }
  } catch (e) {
    console.error("Failed to auto-heal project default_prompts:", e);
  }

  // Ensure ACTIVE_PROJECT_ID config key exists
  const activeProjConfig = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
  if (!activeProjConfig) {
    db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', '')").run();
  }

  // Run self-healing Project ID normalization migration
  migrateProjectIds(db);

  // Run backfill for llm_screening_records from existing papers and audit logs
  backfillLlmScreeningRecords(db);

  // Run synchronization for PDF statuses between papers, calibration_papers, and on-disk files in deferred non-blocking background
  setTimeout(() => {
    syncExistingPdfStatusesAndDisks(db);
  }, 1000);
}

function syncExistingPdfStatusesAndDisks(db: Database.Database) {
  try {
    // 1. Sync any divergent PDF statuses and paths from papers to calibration_papers
    db.prepare(`
      UPDATE calibration_papers
      SET Local_PDF_Status = (
        SELECT p.Local_PDF_Status FROM papers p 
        WHERE p.Paper_ID = calibration_papers.Paper_ID 
          AND (p.Project_ID = calibration_papers.Project_ID OR CAST(p.Project_ID AS TEXT) = CAST(calibration_papers.Project_ID AS TEXT))
      ),
      Local_PDF_Path = (
        SELECT p.Local_PDF_Path FROM papers p 
        WHERE p.Paper_ID = calibration_papers.Paper_ID 
          AND (p.Project_ID = calibration_papers.Project_ID OR CAST(p.Project_ID AS TEXT) = CAST(calibration_papers.Project_ID AS TEXT))
      )
      WHERE EXISTS (
        SELECT 1 FROM papers p 
        WHERE p.Paper_ID = calibration_papers.Paper_ID 
          AND (p.Project_ID = calibration_papers.Project_ID OR CAST(p.Project_ID AS TEXT) = CAST(calibration_papers.Project_ID AS TEXT))
          AND (p.Local_PDF_Status != calibration_papers.Local_PDF_Status OR IFNULL(p.Local_PDF_Path, '') != IFNULL(calibration_papers.Local_PDF_Path, ''))
      )
    `).run();

    // 2. Scan physical pdf_library/raw directory and auto-heal missing PDF statuses across both tables
    const rawDir = path.join(PROJECT_ROOT, 'pdf_library', 'raw');
    if (fs.existsSync(rawDir)) {
      const files = fs.readdirSync(rawDir);
      const updatePapersStmt = db.prepare("UPDATE papers SET Local_PDF_Status = 'MATCHED', Local_PDF_Path = ? WHERE Paper_ID = ? AND (Local_PDF_Path IS NULL OR Local_PDF_Status = 'MISSING' OR Local_PDF_Status = 'FAILED' OR Local_PDF_Status = 'IGNORED')");
      const updateCalStmt = db.prepare("UPDATE calibration_papers SET Local_PDF_Status = 'MATCHED', Local_PDF_Path = ? WHERE Paper_ID = ? AND (Local_PDF_Path IS NULL OR Local_PDF_Status = 'MISSING' OR Local_PDF_Status = 'FAILED' OR Local_PDF_Status = 'IGNORED')");

      const tx = db.transaction(() => {
        for (const f of files) {
          if (f.endsWith('.pdf')) {
            const pId = f.slice(0, -4);
            const relPath = `pdf_library/raw/${f}`;
            updatePapersStmt.run(relPath, pId);
            updateCalStmt.run(relPath, pId);
          }
        }
      });
      tx();
    }
  } catch (err) {
    console.error("Failed to run syncExistingPdfStatusesAndDisks:", err);
  }
}

function backfillLlmScreeningRecords(db: any) {
  try {
    const flag = db.prepare("SELECT value FROM configs WHERE key = 'MIGRATION_LLM_SCREENING_RECORDS_BACKFILL_DONE'").get() as { value: string } | undefined;
    if (flag?.value === 'true') return;

    const countExisting = db.prepare("SELECT COUNT(*) as c FROM llm_screening_records").get() as { c: number };
    if (countExisting && countExisting.c > 0) {
      db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('MIGRATION_LLM_SCREENING_RECORDS_BACKFILL_DONE', 'true')").run();
      return;
    }

    const papersWithAi = db.prepare(`
      SELECT Paper_ID, Project_ID, ai_stage, ai_decision, ai_exclusion_code, ai_rationale, ai_quality_assessment, ai_extracted_data
      FROM papers
      WHERE (ai_stage > 0 OR ai_decision IS NOT NULL) AND Project_ID IS NOT NULL
    `).all() as any[];

    if (!papersWithAi || papersWithAi.length === 0) {
      db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('MIGRATION_LLM_SCREENING_RECORDS_BACKFILL_DONE', 'true')").run();
      return;
    }

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO llm_screening_records (
        project_id, paper_id, stage, task_type, decision, exclusion_code,
        rationale, quality_assessment, extracted_data, logic_trace, structured_output,
        model_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const taskTypeMap: Record<number, string> = {
      1: 'fast_filter',
      2: 'gatekeeper',
      3: 'scientist',
      4: 'miner'
    };

    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      for (const p of papersWithAi) {
        const stage = p.ai_stage || 1;
        const taskType = taskTypeMap[stage] || 'fast_filter';
        
        let logicTrace: string | null = null;
        let structOut: string | null = null;
        let modelId = 'migrated';

        try {
          const auditLog = db.prepare(`
            SELECT model_id, structured_output 
            FROM llm_audit_log 
            WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND status = 'SUCCESS'
              AND (task_type = ? OR task_type LIKE ?)
            ORDER BY id DESC LIMIT 1
          `).get(p.Paper_ID, p.Project_ID, p.Project_ID, taskType, `%${taskType}%`) as any;

          if (auditLog) {
            modelId = auditLog.model_id || 'migrated';
            structOut = auditLog.structured_output;
            if (structOut) {
              try {
                const parsed = JSON.parse(structOut);
                const lt = parsed.logic_trace || parsed.logicTrace;
                if (lt) {
                  logicTrace = JSON.stringify(lt);
                }
              } catch (_) {}
            }
          }
        } catch (_) {}

        insertStmt.run(
          p.Project_ID,
          p.Paper_ID,
          stage,
          taskType,
          p.ai_decision || 'INCLUDE',
          p.ai_exclusion_code || null,
          p.ai_rationale || null,
          p.ai_quality_assessment || null,
          p.ai_extracted_data || null,
          logicTrace,
          structOut,
          modelId,
          now,
          now
        );
      }

      db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('MIGRATION_LLM_SCREENING_RECORDS_BACKFILL_DONE', 'true')").run();
    });

    tx();
  } catch (err) {
    console.error("Failed to run backfillLlmScreeningRecords migration:", err);
  }
}
