import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

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
      Status TEXT NOT NULL DEFAULT '0',
      Local_PDF_Status TEXT NOT NULL DEFAULT 'IGNORED',
      Local_PDF_Path TEXT,
      Project_ID TEXT,
      calibration_pool TEXT,
      Human_Decision TEXT,
      Human_EC_Trigger TEXT,
      Human_Rationale TEXT,
      Original_Publisher TEXT,
      Publisher TEXT,
      citation_count INTEGER DEFAULT 0,
      Human_QA_Scores TEXT,
      Human_Extracted_Data TEXT,
      is_duplicate INTEGER DEFAULT 0,
      merged_into_id TEXT DEFAULT NULL,
      AI_Decision TEXT,
      AI_EC_Trigger TEXT,
      AI_Rationale TEXT,
      AI_QA_Scores TEXT,
      AI_Extracted_Data TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers (DOI);
    CREATE INDEX IF NOT EXISTS idx_papers_title ON papers (Title);

    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
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
      FOREIGN KEY(paper_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE
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
      FOREIGN KEY(paper_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE
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

    CREATE INDEX IF NOT EXISTS idx_audit_project ON llm_audit_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_paper ON llm_audit_log(paper_id);
    CREATE INDEX IF NOT EXISTS idx_audit_job ON llm_audit_log(job_id);

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
  `);

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

  // Add Human_Decision column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Human_Decision TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add Human_EC_Trigger column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Human_EC_Trigger TEXT");
  } catch (e) {
    // Column already exists
  }

  // Add Human_Rationale column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Human_Rationale TEXT");
  } catch (e) {
    // Column already exists
  }

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

  // Add Human_QA_Scores column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Human_QA_Scores TEXT");
  } catch (e) {}

  // Add Human_Extracted_Data column to papers if it doesn't exist (migration fallback)
  try {
    db.exec("ALTER TABLE papers ADD COLUMN Human_Extracted_Data TEXT");
  } catch (e) {}

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

  // Self-healing migration for paper Status column: convert 'PENDING', 'COMPLETED', 'FAILED' to '0'
  try {
    db.exec(`
      UPDATE papers SET Status = '0' WHERE Status = 'PENDING';
      UPDATE papers SET Status = '0' WHERE Status = 'COMPLETED';
      UPDATE papers SET Status = '0' WHERE Status = 'FAILED';
    `);
    console.log("Successfully migrated legacy paper Status values to '0'");
  } catch (e) {
    console.error("Failed to migrate legacy paper Status values:", e);
  }

  // Add AI columns to papers table if they do not exist
  const aiColumns = ['AI_Decision', 'AI_EC_Trigger', 'AI_Rationale', 'AI_QA_Scores', 'AI_Extracted_Data'];
  for (const col of aiColumns) {
    try {
      db.exec(`ALTER TABLE papers ADD COLUMN ${col} TEXT`);
      console.log(`Added column ${col} to papers table successfully.`);
    } catch (e) {
      // Column already exists
    }
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

  // Auto-create a default project if none exist
  const projectCount = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
  if (projectCount.count === 0) {
    const defaultProjectId = 'default-project';
    db.prepare(`
      INSERT INTO projects (id, name, folder_name, manifesto, objective, questions, qa_definition, exclusion_criteria, pool_a_size, pool_b_size, pool_c_size, gdrive_dest_path, cloud_provider, rclone_remote_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultProjectId,
      'Default Project',
      'default_project',
      'This is the default SLR Magic research project.',
      'To evaluate systematic literature reviews using LLMs.',
      'RQ1: How effective are LLMs in screening papers?\nRQ2: What is the accuracy of data extraction?',
      'Double screening by independent agents with manual resolution.',
      'Papers not written in English or not peer-reviewed.',
      50,
      30,
      20,
      'SLR_Magic/PDFs',
      'gdrive',
      'gdrive',
      new Date().toISOString()
    );
    
    // Set as active project
    db.prepare(`
      INSERT OR REPLACE INTO configs (key, value)
      VALUES ('ACTIVE_PROJECT_ID', ?)
    `).run(defaultProjectId);
    
    // Update existing papers to belong to this default project if they don't have one
    db.prepare(`
      UPDATE papers SET Project_ID = ? WHERE Project_ID IS NULL
    `).run(defaultProjectId);
  }

  // Migrate legacy PDF paths to the unified pdf_library layout and perform self-healing
  try {
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
          db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ?').run(expectedRepoPath, paperId);
        } else {
          // If repo path is missing but raw file exists, copy raw file to repo path and update path
          const rawFilePath = path.join(rawPdfDir, `${paperId}.pdf`);
          if (fs.existsSync(rawFilePath)) {
            try {
              const repoDir = path.dirname(absoluteRepoPath);
              if (!fs.existsSync(repoDir)) fs.mkdirSync(repoDir, { recursive: true });
              fs.copyFileSync(rawFilePath, absoluteRepoPath);
              db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ?').run(expectedRepoPath, paperId);
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
                db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ?').run(expectedRepoPath, paperId);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`Failed to self-heal copy legacy to repo for ${paperId}: ${msg}`);
              }
            } else {
              // PDF is completely missing on disk
              db.prepare(`UPDATE papers SET Local_PDF_Status = 'MISSING', Local_PDF_Path = NULL, PDF_Link = NULL WHERE Paper_ID = ?`).run(paperId);
            }
          }
        }
      } else if (status === 'MATCHED' || status === 'DOWNLOADED') {
        const expectedRawPath = `pdf_library/raw/${paperId}.pdf`;
        const absoluteRawPath = path.join(PROJECT_ROOT, expectedRawPath);

        if (fs.existsSync(absoluteRawPath)) {
          db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ?').run(expectedRawPath, paperId);
        } else {
          if (fs.existsSync(absolutePath)) {
            try {
              fs.copyFileSync(absolutePath, absoluteRawPath);
              db.prepare('UPDATE papers SET Local_PDF_Path = ? WHERE Paper_ID = ?').run(expectedRawPath, paperId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`Failed to copy legacy path to raw/ for ${paperId}: ${msg}`);
            }
          } else {
            db.prepare(`UPDATE papers SET Local_PDF_Status = 'MISSING', Local_PDF_Path = NULL, PDF_Link = NULL WHERE Paper_ID = ?`).run(paperId);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to migrate and self-heal PDF paths:", e);
  }

  // Self-healing migration for AI decisions in reviewer_decisions from llm_audit_log
  try {
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
  } catch (e) {
    console.error("Failed to execute self-healing migration for AI decisions:", e);
  }
}
