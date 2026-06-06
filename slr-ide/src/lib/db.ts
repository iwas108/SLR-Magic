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
const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

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
    Project_ID TEXT
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
    created_at TEXT NOT NULL
  );
`);

// Add Project_ID column to papers if it doesn't exist (migration fallback)
try {
  db.exec("ALTER TABLE papers ADD COLUMN Project_ID TEXT");
} catch (e) {
  // Column already exists
}

// Add gdrive_dest_path column to projects if it doesn't exist (migration fallback)
try {
  db.exec("ALTER TABLE projects ADD COLUMN gdrive_dest_path TEXT DEFAULT 'SLR_Magic/PDFs'");
} catch (e) {
  // Column already exists
}

// Auto-create a default project if none exist
const projectCount = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
if (projectCount.count === 0) {
  const defaultProjectId = 'default-project';
  db.prepare(`
    INSERT INTO projects (id, name, folder_name, manifesto, objective, questions, qa_definition, exclusion_criteria, pool_a_size, pool_b_size, pool_c_size, gdrive_dest_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
