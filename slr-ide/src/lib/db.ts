import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initializeDatabase } from './db/db-init';

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

// Initialize database schema, migrations, and seeds
initializeDatabase(db);

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

// Start backup scheduler in a deferred task to avoid circular import delays
if (typeof window === 'undefined') {
  setTimeout(() => {
    import('./services/backup-service')
      .then((m) => {
        m.startBackupScheduler();
      })
      .catch((err) => {
        console.error('Failed to import and start backup scheduler:', err);
      });
  }, 3000);
}

