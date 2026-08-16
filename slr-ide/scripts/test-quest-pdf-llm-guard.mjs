import Database from 'better-sqlite3';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('🧪 Running Quest 03-05 PDF Requirement & Prompt Library LLM Parameter Enforcement Tests...\n');

const db = new Database(':memory:');

// Setup tables
db.exec(`
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    objective TEXT,
    manifesto TEXT,
    questions TEXT,
    pool_b_ec_rules TEXT,
    pool_c_qa_rules TEXT,
    pool_c_extraction_rules TEXT,
    project_tax REAL DEFAULT 0.0,
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

  CREATE TABLE papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT NOT NULL,
    Title TEXT,
    Abstract TEXT,
    Authors TEXT,
    Year TEXT,
    DOI TEXT,
    Local_PDF_Path TEXT,
    Local_PDF_Status TEXT,
    Source TEXT,
    calibration_pool TEXT,
    calibration_tag TEXT
  );

  CREATE TABLE calibration_papers (
    Paper_ID TEXT PRIMARY KEY,
    Project_ID TEXT NOT NULL,
    Title TEXT,
    Abstract TEXT,
    Authors TEXT,
    Year TEXT,
    DOI TEXT,
    Local_PDF_Path TEXT,
    Local_PDF_Status TEXT,
    Source TEXT,
    calibration_pool TEXT,
    calibration_tag TEXT
  );

  CREATE TABLE calibration_commit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    pool TEXT NOT NULL,
    resolved_decision TEXT NOT NULL,
    resolved_ec TEXT,
    resolved_qa_scores TEXT,
    resolved_extracted_data TEXT,
    commit_message TEXT,
    timestamp TEXT NOT NULL
  );
`);

console.log('✅ 1. SQLite schema initialized.');

const now = new Date().toISOString();
const projectId = 'test-proj-1';

db.prepare(`
  INSERT INTO projects (id, name, objective, created_at, updated_at)
  VALUES (?, 'SLR AI Synthesis', 'Systematic mapping', ?, ?)
`).run(projectId, now, now);

// Create a real temporary test PDF file
const tmpPdfPath = path.resolve(process.cwd(), 'temp_test_paper.pdf');
fs.writeFileSync(tmpPdfPath, '%PDF-1.4 dummy test content for unit testing');

// Insert papers for Pool A, Pool B, Pool C
db.prepare(`
  INSERT INTO papers (Paper_ID, Project_ID, Title, Abstract, Local_PDF_Path, Local_PDF_Status)
  VALUES 
    ('P-A1', ?, 'Paper A1 (Metadata only)', 'Abstract of A1', NULL, 'MISSING'),
    ('P-B1', ?, 'Paper B1 (With valid PDF)', 'Abstract of B1', ?, 'SYNCED'),
    ('P-B2_NOPDF', ?, 'Paper B2 (Missing PDF)', 'Abstract of B2', NULL, 'MISSING'),
    ('P-C1', ?, 'Paper C1 (With valid PDF)', 'Abstract of C1', ?, 'SYNCED'),
    ('P-C2_NOPDF', ?, 'Paper C2 (Missing PDF)', 'Abstract of C2', 'non_existent_file.pdf', 'MISSING')
`).run(projectId, projectId, tmpPdfPath, projectId, projectId, tmpPdfPath, projectId);

// Commit them into calibration commit ledger
db.prepare(`
  INSERT INTO calibration_commit_ledger (project_id, paper_id, pool, resolved_decision, timestamp)
  VALUES 
    (?, 'P-A1', 'POOL_A', 'Include', ?),
    (?, 'P-B1', 'POOL_B', 'Include', ?),
    (?, 'P-B2_NOPDF', 'POOL_B', 'Exclude', ?),
    (?, 'P-C1', 'POOL_C', 'Include', ?),
    (?, 'P-C2_NOPDF', 'POOL_C', 'Include', ?)
`).run(projectId, now, projectId, now, projectId, now, projectId, now, projectId, now);

console.log('✅ 2. Test papers and committed calibration records initialized.');

// Setup prompt template with customized LLM config
const s2LlmConfig = {
  model_id: 'gemini-2.5-pro',
  temperature: 0.15,
  max_output_tokens: 3500,
  top_p: 0.92,
  top_k: 45,
  thinking_level: 'low',
  thinking_budget: 2048,
  timeout_seconds: 450,
  request_delay: 0.5,
  concurrency: 4,
  execution_mode: 'FLEX',
  discount: 0.5
};

db.prepare(`
  INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
  VALUES ('prompt-s2', ?, 'Gatekeeper Custom Prompt', 'Domain screening', 'gatekeeper', 'You are a gatekeeper bot.', 'Evaluate paper: {{ paper.title }}', '{"type":"object"}', ?, 1, ?, ?)
`).run(projectId, JSON.stringify(s2LlmConfig), now, now);

// TEST 3: Pool Papers Query & PDF Verification Logic
function getPoolPapersWithPdfStatus(targetPool) {
  const poolPapers = db.prepare(`
    SELECT 
      COALESCE(cp.Paper_ID, p.Paper_ID) as Paper_ID,
      COALESCE(cp.Title, p.Title) as Title,
      COALESCE(cp.Local_PDF_Path, p.Local_PDF_Path) as Local_PDF_Path,
      COALESCE(cp.Local_PDF_Status, p.Local_PDF_Status) as Local_PDF_Status
    FROM calibration_commit_ledger latest_ccl
    JOIN (
      SELECT paper_id, project_id, MAX(timestamp) as max_ts
      FROM calibration_commit_ledger
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
      GROUP BY paper_id, project_id
    ) latest ON latest_ccl.paper_id = latest.paper_id 
            AND CAST(latest.project_id AS TEXT) = CAST(latest_ccl.project_id AS TEXT) 
            AND latest_ccl.timestamp = latest.max_ts
    LEFT JOIN calibration_papers cp ON latest_ccl.paper_id = cp.Paper_ID AND CAST(cp.Project_ID AS TEXT) = CAST(latest_ccl.project_id AS TEXT)
    LEFT JOIN papers p ON latest_ccl.paper_id = p.Paper_ID AND CAST(p.Project_ID AS TEXT) = CAST(latest_ccl.project_id AS TEXT)
    WHERE CAST(latest_ccl.project_id AS TEXT) = CAST(? AS TEXT)
      AND UPPER(latest_ccl.pool) = UPPER(?)
    ORDER BY latest_ccl.paper_id ASC
  `).all(projectId, projectId, targetPool);

  const missingPdfPapers = poolPapers.filter(paper => {
    const resolvedPdfPath = paper.Local_PDF_Path 
      ? (path.isAbsolute(paper.Local_PDF_Path) ? paper.Local_PDF_Path : path.resolve(process.cwd(), paper.Local_PDF_Path))
      : null;
    return !resolvedPdfPath || !fs.existsSync(resolvedPdfPath) || paper.Local_PDF_Status === 'MISSING' || paper.Local_PDF_Status === 'FAILED';
  });

  return {
    total: poolPapers.length,
    missing_count: missingPdfPapers.length,
    missing_papers: missingPdfPapers
  };
}

const poolAStatus = getPoolPapersWithPdfStatus('POOL_A');
assert.strictEqual(poolAStatus.total, 1);
assert.strictEqual(poolAStatus.missing_count, 1); // P-A1 has no PDF

const poolBStatus = getPoolPapersWithPdfStatus('POOL_B');
assert.strictEqual(poolBStatus.total, 2);
assert.strictEqual(poolBStatus.missing_count, 1); // P-B2_NOPDF is missing
assert.strictEqual(poolBStatus.missing_papers[0].Paper_ID, 'P-B2_NOPDF');

const poolCStatus = getPoolPapersWithPdfStatus('POOL_C');
assert.strictEqual(poolCStatus.total, 2);
assert.strictEqual(poolCStatus.missing_count, 1); // P-C2_NOPDF is missing

console.log('✅ 3. Pool paper counts and disk PDF existence validation successfully verified.');

// TEST 4: Benchmark Execution Guard
function validateBenchmarkCanRun(stageNum, poolName) {
  if (stageNum === 1) {
    // Stage 1 Fast Filter is metadata-only, does not require PDF
    return { canRun: true };
  }

  // Quests 03, 04, 05 (Stages 2, 3, 4) require PDF for 100% of papers
  const poolStatus = getPoolPapersWithPdfStatus(poolName);
  if (poolStatus.missing_count > 0) {
    const sample = poolStatus.missing_papers.slice(0, 3).map(p => `"${p.Paper_ID}: ${p.Title}"`).join(', ');
    return {
      canRun: false,
      error: `Quest 0${stageNum + 1} requires a local PDF file for every paper in ${poolName}. Found ${poolStatus.missing_count} paper(s) with missing or unset PDFs (${sample}).`
    };
  }
  return { canRun: true };
}

const s1RunCheck = validateBenchmarkCanRun(1, 'POOL_A');
assert.strictEqual(s1RunCheck.canRun, true, 'Stage 1 should run even with missing PDF');

const s2RunCheck = validateBenchmarkCanRun(2, 'POOL_B');
assert.strictEqual(s2RunCheck.canRun, false, 'Quest 03 (Stage 2) must be blocked if PDF is missing');
assert.ok(s2RunCheck.error.includes('Quest 03 requires a local PDF file'), 'Error message matches Quest 03 requirement');

const s3RunCheck = validateBenchmarkCanRun(3, 'POOL_C');
assert.strictEqual(s3RunCheck.canRun, false, 'Quest 04 (Stage 3) must be blocked if PDF is missing');
assert.ok(s3RunCheck.error.includes('Quest 04 requires a local PDF file'), 'Error message matches Quest 04 requirement');

const s4RunCheck = validateBenchmarkCanRun(4, 'POOL_C');
assert.strictEqual(s4RunCheck.canRun, false, 'Quest 05 (Stage 4) must be blocked if PDF is missing');
assert.ok(s4RunCheck.error.includes('Quest 05 requires a local PDF file'), 'Error message matches Quest 05 requirement');

console.log('✅ 4. Stage-specific PDF execution guards (Quests 03, 04, 05) verified.');

// TEST 5: Prompt Library LLM Parameter Synchronization
const templateRow = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get('prompt-s2');
const promptConfig = JSON.parse(templateRow.llm_config);

const cleanModelName = (promptConfig.model_id || 'gemini-2.5-flash').replace(/^models\//, '');
const temperature = typeof promptConfig.temperature === 'number' ? promptConfig.temperature : 0.0;
const maxTokens = promptConfig.max_tokens ?? promptConfig.max_output_tokens ?? 4000;
const topP = typeof promptConfig.top_p === 'number' ? promptConfig.top_p : (promptConfig.top_p !== undefined ? Number(promptConfig.top_p) : undefined);
const topK = typeof promptConfig.top_k === 'number' ? promptConfig.top_k : (promptConfig.top_k !== undefined ? Number(promptConfig.top_k) : undefined);
const timeoutSeconds = promptConfig.timeout_seconds ? Number(promptConfig.timeout_seconds) : 900;
const speedMode = (promptConfig.execution_mode || 'STANDARD').toUpperCase();
const concurrency = Math.max(1, Number(promptConfig.concurrency ?? 2));
const rawDelay = promptConfig.request_delay;
const delayMs = rawDelay !== undefined && rawDelay !== null 
  ? (Number(rawDelay) > 10 ? Number(rawDelay) : Math.max(0, Number(rawDelay) * 1000))
  : 400;

assert.strictEqual(cleanModelName, 'gemini-2.5-pro');
assert.strictEqual(temperature, 0.15);
assert.strictEqual(maxTokens, 3500);
assert.strictEqual(topP, 0.92);
assert.strictEqual(topK, 45);
assert.strictEqual(timeoutSeconds, 450);
assert.strictEqual(speedMode, 'FLEX');
assert.strictEqual(concurrency, 4);
assert.strictEqual(delayMs, 500);

console.log('✅ 5. 100% Prompt library LLM parameters parsing and synchronization verified.');

// Clean up temporary test PDF
try {
  if (fs.existsSync(tmpPdfPath)) {
    fs.unlinkSync(tmpPdfPath);
  }
} catch (e) {}

console.log('\n🎉 ALL QUEST PDF AND LLM CONFIG TESTS PASSED SUCCESFULLY!\n');
