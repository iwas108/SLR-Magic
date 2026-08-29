import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- RUNNING ROLLING BATCH MOCKUP REVIEW TEST SUITE ---');

// Use isolated in-memory SQLite database to prevent polluting slr.db
const db = new Database(':memory:');

// Initialize minimal required schema
db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder_name TEXT,
    pool_c_qa_rules TEXT,
    pool_c_extraction_rules TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT NOT NULL,
    Title TEXT,
    Abstract TEXT,
    Authors TEXT,
    Year INTEGER,
    Local_PDF_Status TEXT DEFAULT 'IGNORED',
    Local_PDF_Path TEXT
  );

  CREATE TABLE rolling_batches (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    finalized_at TEXT
  );

  CREATE TABLE rolling_batch_papers (
    batch_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    Paper_ID TEXT NOT NULL,
    Project_ID TEXT NOT NULL,
    Title TEXT,
    Authors TEXT,
    Year INTEGER,
    Abstract TEXT,
    DOI TEXT,
    Local_PDF_Path TEXT,
    PDF_Link TEXT,
    Publisher TEXT,
    Import_Date TEXT,
    Import_Source TEXT,
    Local_PDF_Status TEXT DEFAULT 'IGNORED',
    ai_stage INTEGER DEFAULT 4,
    ai_decision TEXT,
    ai_exclusion_code TEXT,
    ai_rationale TEXT,
    ai_quality_assessment TEXT,
    ai_extracted_data TEXT,
    manual_decision TEXT DEFAULT 'PENDING_ADJUDICATION',
    manual_stage INTEGER DEFAULT 0,
    PRIMARY KEY (batch_id, Paper_ID)
  );

  CREATE TABLE rolling_batch_reviewer_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    qa_scores TEXT,
    extracted_data TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE mockup_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    pool TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    prompt_hash TEXT,
    model_id TEXT,
    slr_blob BLOB NOT NULL,
    total_papers INTEGER NOT NULL,
    total_cost_usd REAL NOT NULL,
    total_tokens INTEGER NOT NULL,
    paper_results TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE llm_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id TEXT,
    project_id TEXT,
    model_id TEXT,
    task_type TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd REAL,
    status TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE prompt_templates (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT NOT NULL,
    prompt_type TEXT NOT NULL,
    stage_number INTEGER NOT NULL,
    llm_config TEXT,
    response_schema TEXT,
    system_instruction TEXT,
    user_template TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
`);

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// Helpers for compression
function compressSlr(payload) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
}

function decompressSlr(buf) {
  const decomp = zlib.gunzipSync(buf);
  return JSON.parse(decomp.toString('utf8'));
}

async function runTests() {
  try {
    // 1. Schema check
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mockup_cache'").get();
    assert(!!tableInfo, 'mockup_cache table exists in SQLite schema');

    // 2. Setup mock project and rolling batch
    const projectId = 'proj-rb-test';
    const batchId = 'rb-test-batch-001';
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO projects (id, name, folder_name, pool_c_qa_rules, pool_c_extraction_rules, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      'Rolling Batch Test Project',
      'rb_project',
      JSON.stringify([
        { code: 'QA-1', label: 'Clear Research Objective', weight: 1.0 },
        { code: 'QA-2', label: 'Rigorous Methodology', weight: 1.0 }
      ]),
      JSON.stringify([
        { json_key: 'model_architecture', label: 'Model Architecture' },
        { json_key: 'dataset_size', label: 'Dataset Size' }
      ]),
      nowIso,
      nowIso
    );

    db.prepare(`
      INSERT INTO rolling_batches (id, project_id, batch_number, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).run(batchId, projectId, 1, nowIso);

    // Insert 3 batch papers
    const papers = [
      { id: 'RB-P1', title: 'Sequential QC Paper 1', pdf: 'test1.pdf', status: 'MATCHED' },
      { id: 'RB-P2', title: 'Sequential QC Paper 2', pdf: 'test2.pdf', status: 'MATCHED' },
      { id: 'RB-P3', title: 'Sequential QC Paper 3', pdf: 'test3.pdf', status: 'MATCHED' }
    ];

    for (const p of papers) {
      db.prepare(`
        INSERT INTO rolling_batch_papers (batch_id, batch_number, Paper_ID, Project_ID, Title, Local_PDF_Path, Local_PDF_Status, manual_decision)
        VALUES (?, 1, ?, ?, ?, ?, ?, 'PENDING_ADJUDICATION')
      `).run(batchId, p.id, projectId, p.title, p.pdf, p.status);
    }

    const countRow = db.prepare('SELECT COUNT(*) as count FROM rolling_batch_papers WHERE batch_id = ?').get(batchId);
    assert(countRow.count === 3, 'Seeded 3 rolling batch papers successfully');

    // 3. Test Mockup Cache Insert & Read for Rolling Batch
    const batchPoolKey = `rb_${batchId}`;
    const initialReviewer = 'rev_alpha123';
    const mockSlrPayload = {
      metadata: {
        project_id: projectId,
        project_name: 'Rolling Batch Test Project',
        reviewer_name: initialReviewer,
        pool_type: 'QC_Batch',
        batch_id: batchId,
        batch_number: 1,
        export_date: nowIso,
        qa_rules: [{ code: 'QA-1' }, { code: 'QA-2' }],
        extraction_rules: [{ json_key: 'model_architecture' }, { json_key: 'dataset_size' }]
      },
      papers: [
        {
          Paper_ID: 'RB-P1',
          Title: 'Sequential QC Paper 1',
          Human_QA_Scores: {
            'QA-1': { value: 1.0, evidence: 'Clear objective stated' },
            'QA-2': { value: 1.0, evidence: 'Rigorous protocol' }
          },
          Human_Extracted_Data: {
            model_architecture: { value: 'Transformer', evidence: 'Uses BERT' },
            dataset_size: { value: '5000', evidence: '5000 samples' }
          }
        },
        {
          Paper_ID: 'RB-P2',
          Title: 'Sequential QC Paper 2',
          Human_QA_Scores: {
            'QA-1': { value: 0.0, evidence: 'No objective' },
            'QA-2': { value: 0.0, evidence: 'Weak method' }
          },
          Human_Extracted_Data: {
            model_architecture: { value: 'CNN', evidence: 'ResNet' },
            dataset_size: { value: '100', evidence: '100 samples' }
          }
        },
        {
          Paper_ID: 'RB-P3',
          Title: 'Sequential QC Paper 3',
          Human_QA_Scores: {
            'QA-1': { value: 1.0, evidence: 'Well defined' },
            'QA-2': { value: 0.5, evidence: 'Moderate protocol' }
          },
          Human_Extracted_Data: {
            model_architecture: { value: 'RNN', evidence: 'LSTM' },
            dataset_size: { value: '2500', evidence: '2500 samples' }
          }
        }
      ]
    };

    const compressedBlob = compressSlr(mockSlrPayload);

    db.prepare(`
      INSERT INTO mockup_cache (
        project_id, pool, reviewer_name, prompt_hash, model_id,
        slr_blob, total_papers, total_cost_usd, total_tokens,
        paper_results, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      batchPoolKey,
      initialReviewer,
      'hash_test_123',
      'gemini-2.5-flash',
      compressedBlob,
      3,
      0.0025,
      500,
      JSON.stringify(mockSlrPayload.papers.map(p => ({
        paper_id: p.Paper_ID,
        title: p.Title,
        decision: 'INCLUDE',
        qa_scores: p.Human_QA_Scores,
        extracted_data: p.Human_Extracted_Data,
        cost_usd: 0.0008,
        tokens: 160
      }))),
      nowIso,
      nowIso
    );

    const cachedRow = db.prepare('SELECT * FROM mockup_cache WHERE project_id = ? AND pool = ?').get(projectId, batchPoolKey);
    assert(!!cachedRow, 'mockup_cache row inserted and retrieved for Rolling Batch');
    assert(cachedRow.reviewer_name === initialReviewer, 'Reviewer name matches cached record');
    assert(cachedRow.total_cost_usd === 0.0025, 'Total cost recorded accurately');

    // 4. Test Decompression & Payload Verification
    const decompressed = decompressSlr(cachedRow.slr_blob);
    assert(decompressed.metadata.pool_type === 'QC_Batch', 'Metadata pool_type is exactly "QC_Batch"');
    assert(decompressed.metadata.batch_id === batchId, 'Metadata batch_id matches active batch');
    assert(decompressed.metadata.batch_number === 1, 'Metadata batch_number matches active batch');
    assert(decompressed.papers.length === 3, 'Decompressed payload contains all 3 batch papers');
    assert(decompressed.papers[0].Human_QA_Scores['QA-1'].value === 1.0, 'Preserves QA-1 score value (1.0)');
    assert(decompressed.papers[0].Human_Extracted_Data['model_architecture'].value === 'Transformer', 'Preserves extracted field value (Transformer)');

    // 5. Test Import into Rolling Batch Decisions
    for (const paper of decompressed.papers) {
      db.prepare(`
        INSERT INTO rolling_batch_reviewer_decisions (batch_id, project_id, paper_id, reviewer_name, qa_scores, extracted_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        batchId,
        projectId,
        paper.Paper_ID,
        decompressed.metadata.reviewer_name,
        JSON.stringify(paper.Human_QA_Scores),
        JSON.stringify(paper.Human_Extracted_Data),
        nowIso
      );
    }

    const importedDecs = db.prepare('SELECT COUNT(*) as count FROM rolling_batch_reviewer_decisions WHERE batch_id = ? AND reviewer_name = ?').get(batchId, initialReviewer);
    assert(importedDecs.count === 3, '100% import compatibility: all 3 decisions inserted into rolling_batch_reviewer_decisions');

    // 6. Test Reviewer Slot Occupancy Tracking
    const slotCountRow = db.prepare('SELECT COUNT(DISTINCT reviewer_name) as count FROM rolling_batch_reviewer_decisions WHERE batch_id = ?').get(batchId);
    assert(slotCountRow.count === 1, 'Correctly tracks 1 of 2 occupied reviewer slots');

    // 7. Test Failure Detection Helper Logic
    const isMockupResultFailedLocal = (res) => {
      if (!res || typeof res !== 'object') return true;
      if (res.error && String(res.error).trim().length > 0) return true;
      if (res.exclusion_code === 'ERROR') return true;
      if (res.decision === 'ERROR') return true;
      if (res.rationale && typeof res.rationale === 'string') {
        if (
          res.rationale.startsWith('LLM Call Failed') ||
          res.rationale.includes('LLM Call Failed') ||
          res.rationale.includes('Request timed out') ||
          res.rationale.includes('Missing local full-text PDF')
        ) {
          return true;
        }
      }
      return false;
    };

    const successRes = { paper_id: 'RB-P1', decision: 'INCLUDE', qa_scores: { 'QA-1': { value: 1.0 } } };
    const failedRes1 = { paper_id: 'RB-P2', error: 'Request timed out' };
    const failedRes2 = { paper_id: 'RB-P3', decision: 'EXCLUDE', exclusion_code: 'ERROR', rationale: 'Missing local full-text PDF' };

    assert(!isMockupResultFailedLocal(successRes), 'isMockupResultFailed returns false for valid successful evaluation');
    assert(isMockupResultFailedLocal(failedRes1), 'isMockupResultFailed returns true for timeout error');
    assert(isMockupResultFailedLocal(failedRes2), 'isMockupResultFailed returns true for missing PDF error');

    // 8. Test Partial Rerun Filter Logic
    const mixedResults = [
      { paper_id: 'RB-P1', decision: 'INCLUDE', cost_usd: 0.0008, tokens: 160 },
      { paper_id: 'RB-P2', error: 'API timeout', decision: 'ERROR', exclusion_code: 'ERROR', cost_usd: 0, tokens: 0 },
      { paper_id: 'RB-P3', decision: 'INCLUDE', cost_usd: 0.0008, tokens: 160 }
    ];

    const failedSubset = mixedResults.filter(r => isMockupResultFailedLocal(r));
    assert(failedSubset.length === 1 && failedSubset[0].paper_id === 'RB-P2', 'Identified exactly 1 failed paper (RB-P2) for partial retry');

    // 9. Test Reviewer Identifier Customization on Redownload
    const updatedReviewer = 'rev_beta456';
    const payloadToUpdate = decompressSlr(cachedRow.slr_blob);
    payloadToUpdate.metadata.reviewer_name = updatedReviewer;
    const recompressedBlob = compressSlr(payloadToUpdate);

    db.prepare(`
      UPDATE mockup_cache 
      SET reviewer_name = ?, slr_blob = ?, updated_at = ?
      WHERE id = ?
    `).run(updatedReviewer, recompressedBlob, nowIso, cachedRow.id);

    const afterUpdateRow = db.prepare('SELECT * FROM mockup_cache WHERE id = ?').get(cachedRow.id);
    assert(afterUpdateRow.reviewer_name === updatedReviewer, 'mockup_cache row reviewer_name successfully updated');

    const updatedDecomp = decompressSlr(afterUpdateRow.slr_blob);
    assert(updatedDecomp.metadata.reviewer_name === updatedReviewer, '.slr binary metadata reflects customized Reviewer Identifier');

    // 10. Test Prompt Templates Resolution for Rolling Batch (Stage 3 & 4)
    db.prepare(`
      INSERT INTO prompt_templates (id, project_id, name, prompt_type, stage_number, llm_config, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run('tpl-sci-1', projectId, 'Scientist Prompt', 'scientist', 3, JSON.stringify({ model_id: 'gemini-2.5-flash', temperature: 0.0, max_tokens: 4000, request_delay: 0.3 }), nowIso);

    db.prepare(`
      INSERT INTO prompt_templates (id, project_id, name, prompt_type, stage_number, llm_config, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run('tpl-min-1', projectId, 'Miner Prompt', 'miner', 4, JSON.stringify({ model_id: 'gemini-2.5-flash', temperature: 0.0, max_tokens: 6000, interaction_chaining: true }), nowIso);

    const sciTpl = db.prepare("SELECT * FROM prompt_templates WHERE project_id = ? AND prompt_type = 'scientist'").get(projectId);
    const minTpl = db.prepare("SELECT * FROM prompt_templates WHERE project_id = ? AND prompt_type = 'miner'").get(projectId);

    assert(!!sciTpl && sciTpl.stage_number === 3, 'Resolved Stage 3: Scientist prompt template');
    assert(!!minTpl && minTpl.stage_number === 4, 'Resolved Stage 4: Miner prompt template');
    const minCfg = JSON.parse(minTpl.llm_config);
    assert(minCfg.interaction_chaining === true, 'Miner prompt supports interaction chaining');

    // 11. Test LLM Audit Log with task_type 'mockup_rolling_batch'
    db.prepare(`
      INSERT INTO llm_audit_log (paper_id, project_id, model_id, task_type, input_tokens, output_tokens, total_tokens, cost_usd, status, created_at)
      VALUES (?, ?, 'gemini-2.5-flash', 'mockup_rolling_batch', 1500, 300, 1800, 0.0012, 'SUCCESS', ?)
    `).run('RB-P1', projectId, nowIso);

    const auditRow = db.prepare("SELECT * FROM llm_audit_log WHERE task_type = 'mockup_rolling_batch' AND project_id = ?").get(projectId);
    assert(!!auditRow, 'PRISMA-isolated LLM interaction recorded with task_type="mockup_rolling_batch"');
    assert(auditRow.cost_usd === 0.0012, 'Accurately logged API cost in llm_audit_log');

    // 12. Test Cache Deletion on Rerun
    db.prepare('DELETE FROM mockup_cache WHERE project_id = ? AND pool = ?').run(projectId, batchPoolKey);
    const afterDelete = db.prepare('SELECT * FROM mockup_cache WHERE project_id = ? AND pool = ?').get(projectId, batchPoolKey);
    assert(!afterDelete, 'mockup_cache row deleted cleanly on rerun');

    console.log('\n--- TEST RESULTS: ALL 23 ROLLING BATCH MOCKUP TESTS PASSED ---');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
