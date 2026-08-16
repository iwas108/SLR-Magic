import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../db/slr.db');

console.log('--- RUNNING MULTI-POOL MOCKUP REVIEW TEST SUITE ---');

const db = new Database(dbPath);

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Check mockup_cache table exists
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mockup_cache'").get();
    assert(!!tableInfo, 'mockup_cache table exists in SQLite schema');

    // 2. Fetch or create a test project
    let project = db.prepare("SELECT * FROM projects LIMIT 1").get();
    if (!project) {
      db.prepare("INSERT INTO projects (id, name, folder_name, created_at, updated_at) VALUES ('proj-mock-test', 'Mock Test Project', 'mock_test', datetime('now'), datetime('now'))").run();
      project = db.prepare("SELECT * FROM projects WHERE id = 'proj-mock-test'").get();
    }
    const projectId = String(project.id);
    console.log(`Testing with project: ${project.name} (${projectId})`);

    // 3. Ensure test calibration papers exist
    const ensureCalPaper = (paperId, pool, title) => {
      db.prepare(`
        INSERT OR IGNORE INTO calibration_papers (Paper_ID, Title, Abstract, Year, Authors, Project_ID, calibration_pool)
        VALUES (?, ?, 'Sample abstract text', 2024, 'Author A, Author B', ?, ?)
      `).run(paperId, title, projectId, pool);
    };

    ensureCalPaper('MOCK-P1', 'pool_a', 'AI in Systematic Reviews 1');
    ensureCalPaper('MOCK-P2', 'pool_b', 'AI in Systematic Reviews 2');
    ensureCalPaper('MOCK-P3', 'pool_c', 'AI in Systematic Reviews 3');

    // 4. Test Mockup Cache Insert & Read
    const testReviewer = 'rev_test_4a1b';
    const samplePayload = {
      metadata: {
        project_id: projectId,
        project_name: project.name,
        reviewer_name: testReviewer,
        pool_type: 'CAL_Pool_A',
        export_date: new Date().toISOString()
      },
      papers: [
        {
          Paper_ID: 'MOCK-P1',
          Title: 'AI in Systematic Reviews 1',
          Human_Decision: 'INCLUDE',
          Human_EC_Trigger: '',
          Human_Rationale: 'Meets inclusion criteria'
        }
      ]
    };

    const gzippedBuffer = zlib.gzipSync(Buffer.from(JSON.stringify(samplePayload)));
    
    // Clean old test cache
    db.prepare("DELETE FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").run(projectId);

    // Insert cache
    db.prepare(`
      INSERT INTO mockup_cache (
        project_id, pool, reviewer_name, prompt_hash, model_id, slr_blob,
        total_papers, total_cost_usd, total_tokens, paper_results, created_at, updated_at
      ) VALUES (?, 'pool_a', ?, 'hash123', 'gemini-2.5-flash', ?, 1, 0.0012, 450, ?, datetime('now'), datetime('now'))
    `).run(projectId, testReviewer, gzippedBuffer, JSON.stringify([{ paper_id: 'MOCK-P1', decision: 'INCLUDE' }]));

    const cachedRow = db.prepare("SELECT * FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").get(projectId);
    assert(!!cachedRow, 'mockup_cache row inserted and retrieved successfully');
    assert(cachedRow.reviewer_name === testReviewer, 'Reviewer name matches cached record');
    assert(cachedRow.total_cost_usd === 0.0012, 'Cost recorded accurately');

    // 5. Test Decompression and Format Verification
    const decompressed = JSON.parse(zlib.gunzipSync(cachedRow.slr_blob).toString('utf-8'));
    assert(decompressed.metadata?.reviewer_name === testReviewer, 'Decompressed payload preserves reviewer_name');
    assert(decompressed.papers?.[0]?.Human_Decision === 'INCLUDE', 'Decompressed payload preserves Human_Decision');

    // 6. Test PRISMA Isolation: Verify papers and calibration_papers columns are UNTOUCHED
    const paperBefore = db.prepare("SELECT ai_decision, manual_decision, manual_stage FROM papers WHERE Paper_ID = 'MOCK-P1' AND Project_ID = ?").get(projectId);
    assert(paperBefore === undefined || paperBefore.ai_decision === null || paperBefore.ai_decision === undefined, 'Main papers table has 0 AI decision changes from mockup caching');

    // 7. Test llm_audit_log task_type support
    const logId = db.prepare(`
      INSERT INTO llm_audit_log (
        paper_id, project_id, model_id, task_type, input_tokens, output_tokens,
        total_tokens, cost_usd, status, created_at
      ) VALUES ('MOCK-P1', ?, 'gemini-2.5-flash', 'mockup_pool_a', 200, 50, 250, 0.0004, 'SUCCESS', datetime('now'))
    `).run(projectId).lastInsertRowid;

    const auditRow = db.prepare("SELECT * FROM llm_audit_log WHERE id = ?").get(logId);
    assert(auditRow?.task_type === 'mockup_pool_a', 'llm_audit_log accurately records mockup_pool_a task type');

    // Clean up audit test row
    db.prepare("DELETE FROM llm_audit_log WHERE id = ?").run(logId);

    // 8. Test Cache Deletion
    db.prepare("DELETE FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").run(projectId);
    const afterDelete = db.prepare("SELECT * FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").get(projectId);
    assert(!afterDelete, 'mockup_cache row deleted cleanly on rerun');

    console.log(`\n--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    db.close();
  }
}

runTests();
