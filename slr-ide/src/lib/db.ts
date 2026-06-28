import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const projectRoot = process.cwd().endsWith('slr-ide') 
  ? process.cwd() 
  : (fs.existsSync(path.join(process.cwd(), 'slr-ide')) ? path.join(process.cwd(), 'slr-ide') : process.cwd());

export const PROJECT_ROOT = projectRoot;

const dbDir = path.resolve(PROJECT_ROOT, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'slr.db');

// Enable better-sqlite3 instance
const db = new Database(dbPath, { 
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  timeout: 5000
});
db.pragma('foreign_keys = ON');

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
    Status TEXT NOT NULL DEFAULT 'PENDING',
    Local_PDF_Status TEXT NOT NULL DEFAULT 'IGNORED',
    Local_PDF_Path TEXT,
    Project_ID TEXT,
    calibration_pool TEXT,
    Human_Decision TEXT,
    Human_EC_Trigger TEXT,
    Human_Rationale TEXT,
    Original_Publisher TEXT,
    Publisher TEXT,
    Human_QA_Scores TEXT,
    Human_Extracted_Data TEXT,
    is_duplicate INTEGER DEFAULT 0,
    merged_into_id TEXT DEFAULT NULL
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

// Create index idx_papers_is_duplicate if it doesn't exist
try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_is_duplicate ON papers (is_duplicate)");
} catch (e) {}

// Create index idx_papers_merged_into if it doesn't exist
try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_papers_merged_into ON papers (merged_into_id)");
} catch (e) {}

// Pre-populate LLM pricing default entries if empty
try {
  const pricingCount = db.prepare("SELECT COUNT(*) as count FROM llm_pricing").get() as { count: number };
  if (pricingCount.count === 0) {
    const insertPricing = db.prepare(`
      INSERT INTO llm_pricing (model_id, provider, input_token_price, output_token_price, thinking_token_price, batch_discount, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    // prices are USD per 1M tokens
    insertPricing.run('gemini-1.5-flash', 'gemini', 0.075, 0.30, 0.30, 0.5, now);
    insertPricing.run('gemini-1.5-pro', 'gemini', 1.25, 5.00, 5.00, 0.5, now);
    insertPricing.run('gpt-4o', 'openai', 2.50, 10.00, 10.00, 0.5, now);
    insertPricing.run('gpt-4o-mini', 'openai', 0.15, 0.60, 0.60, 0.5, now);
    insertPricing.run('claude-3-5-sonnet-latest', 'claude', 3.00, 15.00, 15.00, 0.5, now);
  }
} catch (e) {
  console.error("Failed to populate default llm_pricing:", e);
}

// Pre-populate default prompt templates if they don't exist
try {
  const checkStmt = db.prepare("SELECT COUNT(*) as count FROM prompt_templates WHERE id = ?");
  const insertStmt = db.prepare(`
    INSERT INTO prompt_templates (id, project_id, name, description, system_instruction, user_template, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  
  const now = new Date().toISOString();

  // 1. Seed default-screen
  const hasDefault = checkStmt.get('default-screen') as { count: number };
  if (hasDefault.count === 0) {
    insertStmt.run(
      'default-screen',
      null, // global
      'Default Screening Prompt',
      'Standard screening prompt using project context variables.',
      'You are an expert scientific screener conducting a systematic literature review (SLR).\nYour task is to review the provided research paper title and abstract (and local text context if available) and decide if it should be INCLUDED or EXCLUDED based on the project exclusion criteria.\n\nCRITICAL: Respond strictly in JSON format as defined below:\n{\n  "decision": "INCLUDE" | "EXCLUDE",\n  "exclusion_trigger": "string or null (specify the rule number/text triggered if EXCLUDE)",\n  "rationale": "detailed academic reasoning for the decision"\n}',
      'Research Project Context:\n- Objective: {{ objective }}\n- Research Questions: {{ questions }}\n- Exclusion Criteria:\n{{ exclusion_criteria }}\n\nPaper to Evaluate:\n- Title: {{ title }}\n- Abstract: {{ abstract }}\n- DOI: {{ doi }}\n\nPerform a rigorous screening. Output the JSON decision.',
      now,
      now
    );
  }

  // 2. Seed cot-screen (Chain of Thought)
  const hasCot = checkStmt.get('cot-screen') as { count: number };
  if (hasCot.count === 0) {
    insertStmt.run(
      'cot-screen',
      null, // global
      'Chain of Thought Screen',
      'Advanced screening using chain-of-thought step-by-step reasoning.',
      'You are an expert scientific screener conducting a systematic literature review (SLR).\nYour task is to review the provided research paper title and abstract (and local text context if available) and decide if it should be INCLUDED or EXCLUDED based on the project exclusion criteria.\n\nFirst, think step-by-step to analyze the paper against each exclusion criterion.\nThen, output your final decision in the JSON format as defined below:\n{\n  "logic_trace": {\n    "criterion_analysis": "your step-by-step analysis"\n  },\n  "final_evaluation": {\n    "decision": "INCLUDE" | "EXCLUDE",\n    "exclusion_code": "string or null (specify the rule number/text triggered if EXCLUDE)",\n    "reasoning": "detailed academic reasoning for the decision"\n  }\n}',
      'Research Project Context:\n- Objective: {{ objective }}\n- Research Questions: {{ questions }}\n- Exclusion Criteria:\n{{ exclusion_criteria }}\n\nPaper to Evaluate:\n- Title: {{ title }}\n- Abstract: {{ abstract }}\n- DOI: {{ doi }}\n\nPerform a step-by-step evaluation and output the JSON response.',
      now,
      now
    );
  }
} catch (e) {
  console.error("Failed to populate default prompt_templates:", e);
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

// Insert default configurations
const DEFAULT_CONFIGS: Record<string, string> = {
  ACTIVE_PROJECT_ID: 'default-project',
  SCRAPER_PROXY_BASE_URL: 'https://ezproxy.library.domain.com/login?url=https://doi.org/',
  SCRAPER_DELAY_SECONDS: '20',
  SCRAPER_JITTER_SECONDS: '5',
  SCRAPER_HEADED_MODE: 'false',
  SCRAPER_CHROME_PROFILE_DIR: './chrome_profile',
  RCLONE_EXECUTABLE_PATH: 'rclone',
  RCLONE_REMOTE_NAME: 'gdrive',
  RCLONE_CONFIG_PATH: '',
  RCLONE_SYNC_MODE: 'incremental',
  FUZZY_MATCH_THRESHOLD: '90',
  OCR_ENABLED: 'false',
  TESSERACT_PATH: 'tesseract',
  PDF_COMPRESSION_ENABLED: 'false',
  PDF_COMPRESSION_LEVEL: '/ebook',
  GHOSTSCRIPT_PATH: ''
};

const insertConfigStmt = db.prepare(`
  INSERT INTO configs (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO NOTHING
`);

const transaction = db.transaction(() => {
  for (const [key, value] of Object.entries(DEFAULT_CONFIGS)) {
    insertConfigStmt.run(key, value);
  }
});

transaction();

// Migrate legacy PDF paths to the unified pdf_library layout
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
} catch (e) {
  console.error("Failed to migrate legacy PDF paths:", e);
}

// Config helpers
export function getConfig(key: string, defaultValue?: string): string {
  const row = db.prepare('SELECT value FROM configs WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : (defaultValue || '');
}

export function setConfig(key: string, value: string): void {
  db.prepare(`
    INSERT INTO configs (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function getAllConfigs(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM configs').all() as { key: string; value: string }[];
  const configs: Record<string, string> = {};
  for (const row of rows) {
    configs[row.key] = row.value;
  }
  return configs;
}

export default db;
