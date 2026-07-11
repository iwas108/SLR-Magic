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

// Vault helpers
export function isVaultInitialized(): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM vault_config').get() as { count: number } | undefined;
  return row ? row.count > 0 : false;
}

export function getVaultPasswordHash(): string | null {
  const row = db.prepare('SELECT password_hash FROM vault_config LIMIT 1').get() as { password_hash: string } | undefined;
  return row ? row.password_hash : null;
}

export function setVaultPassword(hash: string): void {
  db.prepare("INSERT OR REPLACE INTO vault_config (id, password_hash, created_at) VALUES (1, ?, datetime('now'))").run(hash);
}

export interface VaultKeyRow {
  key_name: string;
  encrypted_value: string;
  salt: string;
  iv: string;
  tag: string;
}

export function getVaultKey(name: string): VaultKeyRow | null {
  return db.prepare('SELECT key_name, encrypted_value, salt, iv, tag FROM api_key_vault WHERE key_name = ?').get(name) as VaultKeyRow | null;
}

export function saveVaultKey(key: VaultKeyRow): void {
  db.prepare(`
    INSERT INTO api_key_vault (key_name, encrypted_value, salt, iv, tag, created_at, updated_at)
    VALUES (@key_name, @encrypted_value, @salt, @iv, @tag, datetime('now'), datetime('now'))
    ON CONFLICT(key_name) DO UPDATE SET
      encrypted_value = excluded.encrypted_value,
      salt = excluded.salt,
      iv = excluded.iv,
      tag = excluded.tag,
      updated_at = datetime('now')
  `).run(key);
}

export function deleteVaultKey(name: string): void {
  db.prepare('DELETE FROM api_key_vault WHERE key_name = ?').run(name);
}

export function listVaultKeyNames(): string[] {
  const rows = db.prepare('SELECT key_name FROM api_key_vault ORDER BY key_name ASC').all() as { key_name: string }[];
  return rows.map(r => r.key_name);
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

