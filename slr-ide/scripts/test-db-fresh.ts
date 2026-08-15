import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/lib/db/db-init';
import assert from 'assert';

console.log('🧪 Starting Fresh Database Initialization Test...\n');

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');

// 1. Initialize DB from clean slate
const t0 = performance.now();
initializeDatabase(db);
const t1 = performance.now();
console.log(`⏱️ Fresh initialization took: ${(t1 - t0).toFixed(2)} ms`);

// 2. Query all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
console.log(`✅ Total tables created: ${tables.length}`);
console.log('📋 Tables list:', tables.map(t => t.name).sort().join(', '));
assert.strictEqual(tables.length, 25, 'Expected exactly 25 tables to be created');

// 3. Verify SCHEMA_VERSION
const versionRow = db.prepare("SELECT value FROM configs WHERE key = 'SCHEMA_VERSION'").get() as { value: string } | undefined;
console.log(`✅ SCHEMA_VERSION in configs: ${versionRow?.value}`);
assert.strictEqual(versionRow?.value, '3', 'Expected SCHEMA_VERSION to be 3');

// 4. Verify Pricing Seed
const pricing = db.prepare('SELECT COUNT(*) as count FROM llm_pricing').get() as { count: number };
console.log(`✅ Pricing rows seeded: ${pricing.count}`);
assert.ok(pricing.count >= 4, 'Expected at least 4 default Gemini pricing models');

// 5. Verify Prompt Templates Seed
const prompts = db.prepare('SELECT id, name, prompt_type FROM prompt_templates').all() as { id: string; name: string; prompt_type: string }[];
console.log(`✅ Prompt templates seeded: ${prompts.length}`);
for (const p of prompts) {
  console.log(`   - [${p.prompt_type}] ${p.id} (${p.name})`);
}
assert.ok(prompts.length >= 3, 'Expected at least 3 default prompts');

// 6. Test second initialization on existing DB (fast-path)
const t2 = performance.now();
initializeDatabase(db);
const t3 = performance.now();
console.log(`⏱️ Second initialization (fast-path with SCHEMA_VERSION=3) took: ${(t3 - t2).toFixed(2)} ms`);

db.close();
console.log('\n🎉 ALL FRESH DATABASE INITIALIZATION TESTS PASSED SUCCESSFULLY!');
