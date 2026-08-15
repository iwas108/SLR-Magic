import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { migrateProjectIds } from './migrate-project-ids';
import { DEFAULT_STAGE_SCHEMAS } from '../services/prompt-validator';

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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      audit_type TEXT NOT NULL DEFAULT 'consolidation_audit',
      availability_score REAL DEFAULT 0.0,
      semantic_alignment_score REAL DEFAULT 0.0,
      chainability_score REAL DEFAULT 0.0,
      raw_response TEXT,
      structured_output TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pal_project ON prompt_audit_ledger(project_id);

    CREATE TABLE IF NOT EXISTS prompt_benchmark_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      stage_num INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      total_papers INTEGER DEFAULT 0,
      train_accuracy REAL DEFAULT 0.0,
      val_accuracy REAL DEFAULT 0.0,
      train_recall REAL DEFAULT 0.0,
      val_recall REAL DEFAULT 0.0,
      train_precision REAL DEFAULT 0.0,
      val_precision REAL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      completed_at TEXT,
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
    }
  } catch (e) {
    console.error("Failed to seed default prompt_optimizer template:", e);
  }

  // Ensure ACTIVE_PROJECT_ID config key exists
  const activeProjConfig = db.prepare("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'").get() as { value: string } | undefined;
  if (!activeProjConfig) {
    db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', '')").run();
  }

  // Run self-healing Project ID normalization migration
  migrateProjectIds(db);
}
