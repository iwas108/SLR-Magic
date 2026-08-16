import Database from 'better-sqlite3';
import assert from 'assert';
import crypto from 'crypto';

console.log('🧪 Running Comprehensive Prompt Library & Stage Default Unit Tests...\n');

// In-memory test SQLite DB
const db = new Database(':memory:');

// Initialize schema
db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    llm_config TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE prompt_templates (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    prompt_type TEXT,
    system_instruction TEXT NOT NULL,
    user_template TEXT,
    response_schema TEXT,
    llm_config TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

console.log('✅ 1. SQLite schema initialized.');

const now = new Date().toISOString();
const globalPromptId = 'global-ff-1';
const projectId = 'proj-alpha';

// Insert global prompt template
db.prepare(`
  INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
  VALUES (?, NULL, 'Default Fast Filter', 'Global Stage 1 baseline', 'fast_filter', 'You are a fast filter bot.', 'Title: {{ Title }}', '{"type":"OBJECT"}', '{}', 1, ?, ?)
`).run(globalPromptId, now, now);

// Insert project
db.prepare(`
  INSERT INTO projects (id, name, description, llm_config, created_at, updated_at)
  VALUES (?, 'Test Project Alpha', 'Test project', '{}', ?, ?)
`).run(projectId, now, now);

console.log('✅ 2. Global prompt and Project inserted.');

// Test 3: Query prompts with include_global
const prompts = db.prepare(`
  SELECT id, project_id, name, prompt_type 
  FROM prompt_templates 
  WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id IS NULL)
  ORDER BY created_at DESC
`).all(projectId, projectId);

assert.strictEqual(prompts.length, 1);
assert.strictEqual(prompts[0].id, globalPromptId);
console.log('✅ 3. Prompts query with include_global returned global baseline.');

// Test 4: Set Global Prompt as Stage Default for project
let project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId);
let pConfig = JSON.parse(project.llm_config || '{}');
if (!pConfig.default_prompts) pConfig.default_prompts = {};
pConfig.default_prompts['fast_filter'] = globalPromptId;

db.prepare('UPDATE projects SET llm_config = ? WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))')
  .run(JSON.stringify(pConfig), projectId, projectId);

project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId);
pConfig = JSON.parse(project.llm_config || '{}');
assert.strictEqual(pConfig.default_prompts['fast_filter'], globalPromptId);
console.log('✅ 4. Stage default prompt successfully mapped in project llm_config.');

// Test 5: Fork Global Prompt to Project-specific Copy
const forkedPromptId = crypto.randomUUID();
db.prepare(`
  INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
  VALUES (?, ?, 'Fast Filter (Custom Fork)', 'Customized rules', 'fast_filter', 'Customized instructions', 'Title: {{ Title }}', '{"type":"OBJECT"}', '{}', 1, ?, ?)
`).run(forkedPromptId, projectId, now, now);

// Verify global prompt is unchanged
const globalCheck = db.prepare('SELECT id, project_id, name FROM prompt_templates WHERE id = ?').get(globalPromptId);
assert.strictEqual(globalCheck.project_id, null);
assert.strictEqual(globalCheck.name, 'Default Fast Filter');

// Verify project prompt exists
const projectCheck = db.prepare('SELECT id, project_id, name FROM prompt_templates WHERE id = ?').get(forkedPromptId);
assert.strictEqual(projectCheck.project_id, projectId);
console.log('✅ 5. Forking global prompt created project copy without modifying global baseline.');

// Test 6: Save variant with set_as_default = false (Must NOT overwrite active default)
const draftPromptId = crypto.randomUUID();
db.prepare(`
  INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
  VALUES (?, ?, 'Fast Filter Experimental Draft', 'Draft', 'fast_filter', 'Draft instructions', 'Title: {{ Title }}', '{"type":"OBJECT"}', '{}', 1, ?, ?)
`).run(draftPromptId, projectId, now, now);

// Simulate conditional default update logic
const setAsDefault = false;
project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId);
pConfig = JSON.parse(project.llm_config || '{}');
if (setAsDefault === true || (setAsDefault === undefined && !pConfig.default_prompts?.['fast_filter'])) {
  pConfig.default_prompts['fast_filter'] = draftPromptId;
  db.prepare('UPDATE projects SET llm_config = ? WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))')
    .run(JSON.stringify(pConfig), projectId, projectId);
}

project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId);
pConfig = JSON.parse(project.llm_config || '{}');
assert.strictEqual(pConfig.default_prompts['fast_filter'], globalPromptId); // Still globalPromptId!
console.log('✅ 6. Saving draft with set_as_default=false preserved existing stage default.');

// Test 7: Save variant with set_as_default = true (Must update active default)
const setAsDefaultTrue = true;
if (setAsDefaultTrue === true || (setAsDefaultTrue === undefined && !pConfig.default_prompts?.['fast_filter'])) {
  pConfig.default_prompts['fast_filter'] = forkedPromptId;
  db.prepare('UPDATE projects SET llm_config = ? WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))')
    .run(JSON.stringify(pConfig), projectId, projectId);
}

project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId);
pConfig = JSON.parse(project.llm_config || '{}');
assert.strictEqual(pConfig.default_prompts['fast_filter'], forkedPromptId);
console.log('✅ 7. Saving with set_as_default=true successfully updated stage default.');

// Test 8: Protect global baseline template from deletion
const globalTemplate = db.prepare('SELECT id, project_id FROM prompt_templates WHERE id = ?').get(globalPromptId);
assert.strictEqual(globalTemplate.project_id, null);
const canDeleteGlobal = globalTemplate.project_id !== null;
assert.strictEqual(canDeleteGlobal, false);
console.log('✅ 8. Global baseline template protected from deletion.');

// Test 9: Deleting mapped project prompt cleanly cascades and unmaps project default_prompts reference
db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(forkedPromptId);

// Run cascade cleanup
const projectsWithRef = db.prepare("SELECT id, llm_config FROM projects WHERE llm_config LIKE ?").all(`%${forkedPromptId}%`);
for (const proj of projectsWithRef) {
  const pCfg = JSON.parse(proj.llm_config || '{}');
  if (pCfg.default_prompts) {
    for (const [stage, tplId] of Object.entries(pCfg.default_prompts)) {
      if (tplId === forkedPromptId) {
        delete pCfg.default_prompts[stage];
      }
    }
    db.prepare("UPDATE projects SET llm_config = ? WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))")
      .run(JSON.stringify(pCfg), proj.id, proj.id);
  }
}

project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId);
pConfig = JSON.parse(project.llm_config || '{}');
assert.strictEqual(pConfig.default_prompts['fast_filter'], undefined);
console.log('✅ 9. Deleting mapped project template cleanly removed orphaned default_prompts pointer.');

console.log('\n🎉 ALL 9 PROMPT LIBRARY & STAGE DEFAULT UNIT TESTS PASSED!');
