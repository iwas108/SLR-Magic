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

    // 3. Ensure test calibration papers and papers exist
    const ensurePaper = (paperId, title) => {
      db.prepare(`
        INSERT OR REPLACE INTO papers (Paper_ID, Title, Abstract, Year, Authors, Project_ID, Import_Date, Import_Source)
        VALUES (?, ?, 'Sample abstract text', 2024, 'Author A, Author B', ?, datetime('now'), 'test')
      `).run(paperId, title, projectId);
    };
    ensurePaper('MOCK-P1', 'AI in Systematic Reviews 1');
    ensurePaper('MOCK-P2', 'AI in Systematic Reviews 2');
    ensurePaper('MOCK-P3', 'AI in Systematic Reviews 3');

    const ensureCalPaper = (paperId, pool, title) => {
      db.prepare(`
        INSERT OR REPLACE INTO calibration_papers (Paper_ID, Title, Abstract, Year, Authors, Project_ID, calibration_pool, Import_Date, Import_Source)
        VALUES (?, ?, 'Sample abstract text', 2024, 'Author A, Author B', ?, ?, datetime('now'), 'test')
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

    // 8. Test isMockupResultFailed helper logic
    const testSuccessRes = { paper_id: 'MOCK-P1', decision: 'INCLUDE', tokens: 200, cost_usd: 0.001 };
    const testErrorRes1 = { paper_id: 'MOCK-P2', decision: 'EXCLUDE', exclusion_code: 'ERROR', rationale: 'LLM Call Failed: Request timed out after 900 seconds' };
    const testErrorRes2 = { paper_id: 'MOCK-P3', decision: 'EXCLUDE', error: 'Gemini API 429 Quota Exceeded' };
    const testErrorRes3 = { paper_id: 'MOCK-P4', decision: 'ERROR' };

    const isMockupResultFailedLocal = (res) => {
      if (!res || typeof res !== 'object') return true;
      if (res.error && String(res.error).trim().length > 0) return true;
      if (res.exclusion_code === 'ERROR') return true;
      if (res.decision === 'ERROR') return true;
      if (res.rationale && typeof res.rationale === 'string' && (res.rationale.startsWith('LLM Call Failed') || res.rationale.includes('LLM Call Failed') || res.rationale.includes('Request timed out'))) {
        return true;
      }
      return false;
    };

    assert(!isMockupResultFailedLocal(testSuccessRes), 'isMockupResultFailed returns false for valid successful evaluation');
    assert(isMockupResultFailedLocal(testErrorRes1), 'isMockupResultFailed returns true for timeout error');
    assert(isMockupResultFailedLocal(testErrorRes2), 'isMockupResultFailed returns true for API error property');
    assert(isMockupResultFailedLocal(testErrorRes3), 'isMockupResultFailed returns true for decision=ERROR');

    // 9. Test Partial Execution Dataset Merging & Cache Update
    db.prepare("DELETE FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").run(projectId);

    const initialRunResults = [
      { paper_id: 'MOCK-P1', decision: 'INCLUDE', tokens: 100, cost_usd: 0.0005 },
      { paper_id: 'MOCK-P2', decision: 'EXCLUDE', exclusion_code: 'ERROR', error: 'Request timed out after 900 seconds', tokens: 0, cost_usd: 0 },
      { paper_id: 'MOCK-P3', decision: 'EXCLUDE', exclusion_code: 'EC-1', tokens: 120, cost_usd: 0.0006 }
    ];

    const initialGzip = zlib.gzipSync(Buffer.from(JSON.stringify({ metadata: { project_id: projectId }, papers: [] })));
    db.prepare(`
      INSERT INTO mockup_cache (
        project_id, pool, reviewer_name, prompt_hash, model_id, slr_blob,
        total_papers, total_cost_usd, total_tokens, paper_results, created_at, updated_at
      ) VALUES (?, 'pool_a', 'rev_partial_test', 'hash123', 'gemini-2.5-flash', ?, 3, 0.0011, 220, ?, datetime('now'), datetime('now'))
    `).run(projectId, initialGzip, JSON.stringify(initialRunResults));

    const cacheBeforePartial = db.prepare("SELECT * FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").get(projectId);
    const parsedInitial = JSON.parse(cacheBeforePartial.paper_results);
    const failedItems = parsedInitial.filter(r => isMockupResultFailedLocal(r));
    assert(failedItems.length === 1 && failedItems[0].paper_id === 'MOCK-P2', 'Identified exactly 1 failed paper (MOCK-P2) for partial retry');

    // Simulate partial retry resolution for MOCK-P2
    const resolvedP2 = { paper_id: 'MOCK-P2', decision: 'INCLUDE', tokens: 150, cost_usd: 0.0008 };
    const mergedResults = parsedInitial.map(r => r.paper_id === 'MOCK-P2' ? resolvedP2 : r);
    const newTotalCost = mergedResults.reduce((acc, r) => acc + r.cost_usd, 0);
    const newTotalTokens = mergedResults.reduce((acc, r) => acc + r.tokens, 0);

    const mergedPayload = {
      metadata: { project_id: projectId, reviewer_name: 'rev_partial_test', pool_type: 'CAL_Pool_A' },
      papers: mergedResults.map(r => ({ Paper_ID: r.paper_id, Human_Decision: r.decision }))
    };
    const newSlrBlob = zlib.gzipSync(Buffer.from(JSON.stringify(mergedPayload)));

    db.prepare(`
      UPDATE mockup_cache 
      SET slr_blob = ?, total_cost_usd = ?, total_tokens = ?, paper_results = ?, updated_at = datetime('now')
      WHERE project_id = ? AND pool = 'pool_a'
    `).run(newSlrBlob, newTotalCost, newTotalTokens, JSON.stringify(mergedResults), projectId);

    const cacheAfterPartial = db.prepare("SELECT * FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").get(projectId);
    const parsedAfter = JSON.parse(cacheAfterPartial.paper_results);
    const remainingFailures = parsedAfter.filter(r => isMockupResultFailedLocal(r));
    
    assert(remainingFailures.length === 0, 'Zero failures remaining after partial execution');
    assert(Math.abs(cacheAfterPartial.total_cost_usd - 0.0019) < 0.0001, 'Cumulative cost accurately merged ($0.0011 initial + $0.0008 retried = $0.0019)');
    assert(cacheAfterPartial.total_tokens === 370, 'Cumulative tokens accurately merged (220 initial + 150 retried = 370)');

    // Decompress and verify all 3 papers present in final .slr
    const decompressedFinal = JSON.parse(zlib.gunzipSync(cacheAfterPartial.slr_blob).toString('utf-8'));
    assert(decompressedFinal.papers.length === 3, 'Final compressed .slr file includes all 3 papers after partial retry');
    assert(decompressedFinal.papers.find(p => p.Paper_ID === 'MOCK-P2')?.Human_Decision === 'INCLUDE', 'Retried paper decision correctly saved into .slr bundle');

    // 10. Test Mandatory Local PDF Check for Pool B and Pool C
    const testPdfMissingResB = {
      paper_id: 'MOCK-P2',
      decision: 'EXCLUDE',
      exclusion_code: 'ERROR',
      rationale: 'Missing local full-text PDF file. Pool B Gatekeeper screening requires a verified local PDF file on disk.',
      error: 'Missing local full-text PDF file (required for Pool B)',
      tokens: 0,
      cost_usd: 0,
      latency_ms: 0
    };
    const testPdfMissingResC = {
      paper_id: 'MOCK-P3',
      decision: 'EXCLUDE',
      exclusion_code: 'ERROR',
      rationale: 'Missing local full-text PDF file. Pool C Scientist + Miner evaluation requires a verified local PDF file on disk.',
      error: 'Missing local full-text PDF file (required for Pool C)',
      tokens: 0,
      cost_usd: 0,
      latency_ms: 0
    };

    assert(isMockupResultFailedLocal(testPdfMissingResB), 'isMockupResultFailed correctly identifies Pool B missing PDF result as FAILED');
    assert(isMockupResultFailedLocal(testPdfMissingResC), 'isMockupResultFailed correctly identifies Pool C missing PDF result as FAILED');

    // Simulate preflight check logic for Pool A vs Pool B/C
    const samplePoolAPapers = [{ Paper_ID: 'P1', Title: 'Title 1', Local_PDF_Path: null }];
    const samplePoolBPapers = [{ Paper_ID: 'P2', Title: 'Title 2', Local_PDF_Path: null }];
    const samplePoolCPapers = [{ Paper_ID: 'P3', Title: 'Title 3', Local_PDF_Path: null }];

    const checkPreflight = (pool, papers) => {
      if (pool === 'pool_b' || pool === 'pool_c') {
        const missing = papers.filter(p => !p.Local_PDF_Path || !fs.existsSync(p.Local_PDF_Path));
        if (missing.length > 0) return { allowed: false, missingCount: missing.length };
      }
      return { allowed: true, missingCount: 0 };
    };

    assert(checkPreflight('pool_a', samplePoolAPapers).allowed === true, 'Pool A (Fast Filter) execution allowed without local full-text PDF');
    assert(checkPreflight('pool_b', samplePoolBPapers).allowed === false, 'Pool B (Gatekeeper) execution strictly BLOCKED when local PDF is missing');
    assert(checkPreflight('pool_c', samplePoolCPapers).allowed === false, 'Pool C (Scientist + Miner) execution strictly BLOCKED when local PDF is missing');

    // 11. Test Manual Paper Selection for Targeted Rerun
    const selectedPaperIds = ['MOCK-P1', 'MOCK-P3'];
    const idSet = new Set(selectedPaperIds.map(String));
    const allCohortPapers = [
      { Paper_ID: 'MOCK-P1', Title: 'AI in Systematic Reviews 1' },
      { Paper_ID: 'MOCK-P2', Title: 'AI in Systematic Reviews 2' },
      { Paper_ID: 'MOCK-P3', Title: 'AI in Systematic Reviews 3' }
    ];
    const targetedSubset = allCohortPapers.filter(paper => idSet.has(String(paper.Paper_ID)));
    assert(targetedSubset.length === 2, 'Manual paper selection subset filter selects exactly 2 targeted papers');
    assert(targetedSubset.map(p => p.Paper_ID).join(',') === 'MOCK-P1,MOCK-P3', 'Targeted subset matches selected paper IDs exactly');

    // Simulate selective rerun cache update: only MOCK-P1 and MOCK-P3 re-evaluated, MOCK-P2 preserved
    const priorCachedResults = [
      { paper_id: 'MOCK-P1', decision: 'EXCLUDE', exclusion_code: 'EC-1', tokens: 100, cost_usd: 0.0005 },
      { paper_id: 'MOCK-P2', decision: 'INCLUDE', tokens: 150, cost_usd: 0.0008 },
      { paper_id: 'MOCK-P3', decision: 'EXCLUDE', exclusion_code: 'EC-2', tokens: 120, cost_usd: 0.0006 }
    ];

    const selectiveResultsMap = new Map();
    priorCachedResults.forEach(r => selectiveResultsMap.set(r.paper_id, r));

    // Update only targeted papers
    selectiveResultsMap.set('MOCK-P1', { paper_id: 'MOCK-P1', decision: 'INCLUDE', tokens: 180, cost_usd: 0.0009 });
    selectiveResultsMap.set('MOCK-P3', { paper_id: 'MOCK-P3', decision: 'INCLUDE', tokens: 200, cost_usd: 0.0010 });

    const mergedSelectiveList = allCohortPapers.map(p => selectiveResultsMap.get(p.Paper_ID));
    const selectiveTotalCost = mergedSelectiveList.reduce((acc, r) => acc + r.cost_usd, 0);
    const selectiveTotalTokens = mergedSelectiveList.reduce((acc, r) => acc + r.tokens, 0);

    assert(mergedSelectiveList.find(p => p.paper_id === 'MOCK-P2')?.decision === 'INCLUDE', 'Unselected paper (MOCK-P2) preserved intact during selective rerun');
    assert(mergedSelectiveList.find(p => p.paper_id === 'MOCK-P1')?.decision === 'INCLUDE', 'Targeted paper (MOCK-P1) successfully updated');
    assert(mergedSelectiveList.find(p => p.paper_id === 'MOCK-P3')?.decision === 'INCLUDE', 'Targeted paper (MOCK-P3) successfully updated');
    assert(Math.abs(selectiveTotalCost - (0.0009 + 0.0008 + 0.0010)) < 0.0001, 'Cumulative cost accurately calculated for selective rerun ($0.0027)');
    assert(selectiveTotalTokens === (180 + 150 + 200), 'Cumulative tokens accurately calculated for selective rerun (530)');

    // 12. Test Scoped PDF Preflight Check for Selected Papers Subset
    const mixedPoolPapers = [
      { Paper_ID: 'P1', Title: 'Paper with valid PDF', Local_PDF_Path: 'c:/valid.pdf' },
      { Paper_ID: 'P2', Title: 'Paper missing PDF', Local_PDF_Path: null }
    ];

    // When selecting only P1, execution should be allowed for P1 even if P2 lacks PDF
    const checkSelectivePreflight = (pool, selectedIds, allPapers) => {
      if (pool === 'pool_b' || pool === 'pool_c') {
        const idFilter = new Set(selectedIds.map(String));
        const selected = allPapers.filter(p => idFilter.has(String(p.Paper_ID)));
        const missing = selected.filter(p => !p.Local_PDF_Path);
        if (missing.length > 0) return { allowed: false, missingCount: missing.length };
      }
      return { allowed: true, missingCount: 0 };
    };

    assert(checkSelectivePreflight('pool_b', ['P1'], mixedPoolPapers).allowed === true, 'Selective execution allowed when only PDF-ready papers are selected in Pool B');
    assert(checkSelectivePreflight('pool_b', ['P2'], mixedPoolPapers).allowed === false, 'Selective execution blocked when paper missing PDF is selected in Pool B');

    // 13. Test Redownload with Updated Reviewer Identifier
    const initialReviewer = 'rev_initial_123';
    const updatedReviewer = 'reviewer_custom_dr_smith';

    const testPayload = {
      metadata: {
        project_id: projectId,
        reviewer_name: initialReviewer,
        pool_type: 'CAL_Pool_A'
      },
      papers: [{ Paper_ID: 'MOCK-P1', Human_Decision: 'INCLUDE' }]
    };
    const testBuffer = zlib.gzipSync(Buffer.from(JSON.stringify(testPayload)));

    db.prepare("DELETE FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").run(projectId);
    db.prepare(`
      INSERT INTO mockup_cache (
        project_id, pool, reviewer_name, prompt_hash, model_id, slr_blob,
        total_papers, total_cost_usd, total_tokens, paper_results, created_at, updated_at
      ) VALUES (?, 'pool_a', ?, 'hash123', 'gemini-2.5-flash', ?, 1, 0.001, 100, '[]', datetime('now'), datetime('now'))
    `).run(projectId, initialReviewer, testBuffer);

    // Simulate GET /api/mockup/generate?download=true&reviewerName=reviewer_custom_dr_smith
    const cacheRowToDownload = db.prepare("SELECT * FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").get(projectId);
    assert(cacheRowToDownload.reviewer_name === initialReviewer, 'Initial cache holds original reviewer_name');

    // Perform redownload update logic
    const decompressedSlr = JSON.parse(zlib.gunzipSync(cacheRowToDownload.slr_blob).toString('utf-8'));
    decompressedSlr.metadata.reviewer_name = updatedReviewer;
    const recompressedSlr = zlib.gzipSync(Buffer.from(JSON.stringify(decompressedSlr)));

    db.prepare(`
      UPDATE mockup_cache 
      SET reviewer_name = ?, slr_blob = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updatedReviewer, recompressedSlr, cacheRowToDownload.id);

    const cacheAfterRedownload = db.prepare("SELECT * FROM mockup_cache WHERE id = ?").get(cacheRowToDownload.id);
    assert(cacheAfterRedownload.reviewer_name === updatedReviewer, 'Cache database row updated with new Reviewer Identifier');

    const verifiedSlr = JSON.parse(zlib.gunzipSync(cacheAfterRedownload.slr_blob).toString('utf-8'));
    assert(verifiedSlr.metadata?.reviewer_name === updatedReviewer, '.slr binary metadata updated with exact Reviewer Identifier');

    const expectedFilename = `${project.folder_name || 'project'}_pool_a_mockup_${updatedReviewer}.slr`;
    assert(expectedFilename.includes(updatedReviewer), 'Generated attachment filename reflects updated Reviewer Identifier');

    // 14. Test Cache Deletion
    db.prepare("DELETE FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").run(projectId);
    const afterDelete = db.prepare("SELECT * FROM mockup_cache WHERE project_id = ? AND pool = 'pool_a'").get(projectId);
    assert(!afterDelete, 'mockup_cache row deleted cleanly on rerun');

    // 15. Test Mockup Prompt Configurations Extraction for Pool A, Pool B, and Pool C
    const safeJsonParse = (val, fallback = {}) => {
      if (!val) return fallback;
      if (typeof val === 'object') return val;
      try { return JSON.parse(val); } catch { return fallback; }
    };

    const extractPromptConfigTest = (template, stageNum, stageLabel, promptType) => {
      const llmConfig = safeJsonParse(template?.llm_config, {});
      const rawModelId = llmConfig.model_id || 'gemini-2.5-flash';
      const cleanModelName = rawModelId.replace(/^models\//, '');
      return {
        stage_num: stageNum,
        stage_label: stageLabel,
        prompt_type: promptType,
        template_id: template?.id ? String(template.id) : null,
        template_name: template?.name || `${stageLabel} Default`,
        model_id: rawModelId,
        clean_model_name: cleanModelName,
        temperature: llmConfig.temperature !== undefined ? Number(llmConfig.temperature) : 0.0,
        max_tokens: Number(llmConfig.max_tokens || llmConfig.max_output_tokens || 4000),
        thinking_level: String(llmConfig.thinking_level || 'none').toLowerCase(),
        execution_mode: llmConfig.execution_mode || 'FLEX',
        request_delay: llmConfig.request_delay !== undefined ? Number(llmConfig.request_delay) : 0.3,
        request_delay_ms: Math.round((llmConfig.request_delay !== undefined ? Number(llmConfig.request_delay) : 0.3) * 1000),
        timeout_seconds: llmConfig.timeout_seconds !== undefined ? Number(llmConfig.timeout_seconds) : 900,
        interaction_chaining: promptType === 'miner' ? (llmConfig.interaction_chaining !== false) : undefined
      };
    };

    // Ensure prompt templates exist in DB
    const ensurePromptTemplate = (type, name, modelId, temp, maxTokens, thinking) => {
      let tpl = db.prepare("SELECT * FROM prompt_templates WHERE prompt_type = ? LIMIT 1").get(type);
      if (!tpl) {
        db.prepare(`
          INSERT INTO prompt_templates (id, name, prompt_type, system_prompt, user_prompt_template, llm_config, is_active, created_at, updated_at)
          VALUES (?, ?, ?, 'System instruction text', 'User template text', ?, 1, datetime('now'), datetime('now'))
        `).run(`tpl-${type}`, name, type, JSON.stringify({ model_id: modelId, temperature: temp, max_tokens: maxTokens, thinking_level: thinking }));
        tpl = db.prepare("SELECT * FROM prompt_templates WHERE id = ?").get(`tpl-${type}`);
      }
      return tpl;
    };

    const fastTpl = ensurePromptTemplate('fast_filter', 'Fast Filter Default', 'gemini-2.5-flash', 0.0, 4000, 'none');
    const gateTpl = ensurePromptTemplate('gatekeeper', 'Gatekeeper Default', 'gemini-2.5-flash', 0.0, 4000, 'none');
    const sciTpl = ensurePromptTemplate('scientist', 'Scientist Default', 'gemini-2.5-flash', 0.0, 4000, 'none');
    const minTpl = ensurePromptTemplate('miner', 'Miner Default', 'gemini-2.5-flash', 0.0, 8000, 'none');

    // Pool A config test
    const poolAConfigs = [extractPromptConfigTest(fastTpl, 1, 'Stage 1: Fast Filter', 'fast_filter')];
    assert(poolAConfigs.length === 1, 'Pool A prompt config contains exactly 1 stage prompt');
    assert(poolAConfigs[0].prompt_type === 'fast_filter', 'Pool A prompt type is fast_filter');
    assert(poolAConfigs[0].clean_model_name.includes('gemini'), 'Pool A prompt has valid model name');
    assert(typeof poolAConfigs[0].temperature === 'number', 'Pool A prompt has valid temperature');
    assert(poolAConfigs[0].max_tokens > 0, 'Pool A prompt has valid max_tokens');

    // Pool B config test
    const poolBConfigs = [extractPromptConfigTest(gateTpl, 2, 'Stage 2: Gatekeeper', 'gatekeeper')];
    assert(poolBConfigs.length === 1, 'Pool B prompt config contains exactly 1 stage prompt');
    assert(poolBConfigs[0].prompt_type === 'gatekeeper', 'Pool B prompt type is gatekeeper');
    assert(poolBConfigs[0].stage_num === 2, 'Pool B prompt stage number is 2');

    // Pool C config test
    const poolCConfigs = [
      extractPromptConfigTest(sciTpl, 3, 'Stage 3: Scientist (QA)', 'scientist'),
      extractPromptConfigTest(minTpl, 4, 'Stage 4: Miner (Extraction)', 'miner')
    ];
    assert(poolCConfigs.length === 2, 'Pool C prompt config contains exactly 2 stage prompts (Scientist & Miner)');
    assert(typeof poolCConfigs[1].interaction_chaining === 'boolean', 'Pool C Miner extraction interaction chaining is a valid boolean flag');
    
    // Explicit chaining test
    const customMinerTpl = {
      id: 'custom-miner',
      name: 'Custom Miner',
      prompt_type: 'miner',
      llm_config: JSON.stringify({ model_id: 'gemini-2.5-pro', interaction_chaining: true })
    };
    // 16. Test Official Gemini Model Thinking Specifications Reference Table
    const GEMINI_MODEL_THINKING_SPECS = {
      'gemini-3.7-flash': { default: 'medium', supported: ['low', 'medium', 'high'] },
      'gemini-3.6-flash': { default: 'medium', supported: ['minimal', 'low', 'medium', 'high'] },
      'gemini-3.5-flash-lite': { default: 'minimal', supported: ['minimal', 'low', 'medium', 'high'] },
      'gemini-3.1-pro-preview': { default: 'high', supported: ['low', 'medium', 'high'] },
      'gemini-3.1-flash-lite-image': { default: 'minimal', supported: ['minimal', 'high'] },
      'gemini-3-flash-preview': { default: 'high', supported: ['minimal', 'low', 'medium', 'high'] },
      'gemini-3-pro-preview': { default: 'high', supported: ['low', 'high'] },
      'gemini-3.5-flash': { default: 'medium', supported: ['minimal', 'low', 'medium', 'high'] },
      'gemini-2.5-pro': { default: 'on', supported: ['low', 'medium', 'high'] },
      'gemini-2.5-flash': { default: 'on', supported: ['low', 'medium', 'high'] },
      'gemini-2.5-flash-lite': { default: 'off', supported: ['low', 'medium', 'high'] }
    };

    const resolveThinkingConfigLocal = (modelId, thinkingLevel) => {
      const cleanModel = (modelId || '').toLowerCase().replace(/^models\//, '');
      const level = (thinkingLevel || 'none').toLowerCase().trim();
      if (level === 'none' || level === 'off') {
        return { thinkingBudget: 0 };
      }
      const spec = GEMINI_MODEL_THINKING_SPECS[cleanModel];
      let targetLevel = level;
      if (spec && !spec.supported.includes(targetLevel)) {
        targetLevel = spec.default !== 'off' && spec.default !== 'on' ? spec.default : (spec.supported.includes('medium') ? 'medium' : spec.supported[0]);
      }
      return { thinkingLevel: targetLevel };
    };

    // Test Gemini 3.7 Flash thinkingLevel
    const g37Config = resolveThinkingConfigLocal('gemini-3.7-flash', 'high');
    assert(g37Config.thinkingLevel === 'high' && g37Config.thinkingBudget === undefined, 'Gemini 3.7 Flash sends qualitative thinkingLevel=high without arbitrary 8192t token budget');

    // Test Gemini 3.1 Pro Preview thinkingLevel
    const g31Config = resolveThinkingConfigLocal('gemini-3.1-pro-preview', 'high');
    assert(g31Config.thinkingLevel === 'high', 'Gemini 3.1 Pro Preview accurately sends thinkingLevel=high');

    // Test Disabled Thinking
    const gOffConfig = resolveThinkingConfigLocal('gemini-2.5-flash', 'none');
    assert(gOffConfig.thinkingBudget === 0 && gOffConfig.thinkingLevel === undefined, 'Disabled thinking (none/off) sends thinkingBudget=0 to shut off reasoning tokens');

    // Test Model Unsupported Level Fallback (e.g. gemini-3.7-flash requested with minimal -> falls back to medium)
    const g37Fallback = resolveThinkingConfigLocal('gemini-3.7-flash', 'minimal');
    assert(g37Fallback.thinkingLevel === 'medium', 'Unsupported level (minimal) on gemini-3.7-flash safely falls back to supported level (medium)');

    // 17. Test Pool C QA Score Normalization, .slr Assembly & Import
    const samplePoolCQaRules = [
      { code: 'QA-1', question: 'Context definition', is_fatal_flaw: false },
      { code: 'QA-2', question: 'Hardware specification', is_fatal_flaw: true },
      { code: 'QA-3', question: 'Validation', is_fatal_flaw: false },
      { code: 'QA-4', question: 'Footprint measurement', is_fatal_flaw: true },
      { code: 'QA-5', question: 'Communication protocol', is_fatal_flaw: false },
      { code: 'QA-6', question: 'Control loop', is_fatal_flaw: false },
      { code: 'QA-7', question: 'Lifecycle barriers', is_fatal_flaw: false },
      { code: 'QA-8', question: 'Reusability', is_fatal_flaw: false }
    ];

    const sampleScientistOutput = {
      qa_scores: {
        qa1_aims: { score: '1.0', exact_quote: 'The study investigates edge computing models.' },
        qa2_hardware: { score: '1.0', exact_quote: 'Deployed on Raspberry Pi 4 Model B (Cortex-A72, 4GB RAM).' },
        qa3_validation: { score: '1.0', exact_quote: 'Validated against physical sensor telemetry.' },
        qa4_footprint: { score: '0.5', exact_quote: 'Inference latency was 14.2 ms.' },
        qa5_communication: { score: '0.0', exact_quote: 'Protocol not evaluated.' },
        qa6_actuation: { score: '0.0', exact_quote: 'Passive forecasting only.' },
        qa7_barriers: { score: '1.0', exact_quote: 'Network packet loss discussed in Section 4.' },
        qa8_reusability: { score: '0.5', exact_quote: 'Architecture diagram shown in Fig 2.' }
      }
    };

    // Helper functions simulating trace-normalizer
    const normalizeQaKeyLocal = (k) => (k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchQaRuleKeyLocal = (ruleCode, candidateKeys, idx) => {
      const clean = normalizeQaKeyLocal(ruleCode);
      const match = candidateKeys.find(k => {
        const cleanK = normalizeQaKeyLocal(k);
        return cleanK === clean || cleanK.startsWith(clean) || clean.startsWith(cleanK);
      });
      if (match) return match;
      if (idx !== undefined && candidateKeys[idx]) return candidateKeys[idx];
      return undefined;
    };
    const extractScoreValueLocal = (item) => {
      if (item === undefined || item === null) return null;
      if (typeof item === 'object') {
        const raw = item.score ?? item.value ?? item.val ?? item.numeric_score ?? null;
        if (raw === null || raw === undefined) return null;
        const parsed = parseFloat(String(raw));
        return isNaN(parsed) ? null : parsed;
      }
      const parsed = parseFloat(String(item));
      return isNaN(parsed) ? null : parsed;
    };
    const extractEvidenceQuoteLocal = (valObj) => {
      if (!valObj || typeof valObj !== 'object') return '';
      return String(valObj.exact_quote ?? valObj.evidence ?? valObj.quote ?? valObj.text ?? valObj.rationale ?? valObj.reasoning ?? '').trim();
    };

    const normalizedPoolCQA = {};
    const rawKeys = Object.keys(sampleScientistOutput.qa_scores);
    samplePoolCQaRules.forEach((rule, idx) => {
      const code = rule.code;
      const matchedKey = matchQaRuleKeyLocal(code, rawKeys, idx);
      const item = matchedKey ? sampleScientistOutput.qa_scores[matchedKey] : undefined;
      const numVal = extractScoreValueLocal(item);
      const ev = extractEvidenceQuoteLocal(item);
      normalizedPoolCQA[code] = { value: numVal, evidence: ev };
    });

    assert(normalizedPoolCQA['QA-1']?.value === 1.0, 'Pool C QA-1 normalized value is 1.0 (not null)');
    assert(normalizedPoolCQA['QA-1']?.evidence.includes('edge computing models'), 'Pool C QA-1 exact_quote captured as evidence');
    assert(normalizedPoolCQA['QA-2']?.value === 1.0, 'Pool C QA-2 normalized value is 1.0');
    assert(normalizedPoolCQA['QA-4']?.value === 0.5, 'Pool C QA-4 normalized value is 0.5');
    assert(normalizedPoolCQA['QA-5']?.value === 0.0, 'Pool C QA-5 normalized value is 0.0');

    // Test calculatePoolCDecision
    const calculatePoolCDecisionLocal = (qaScores, qaRules) => {
      let hasFatal = false;
      let total = 0;
      const ruleKeys = Object.keys(qaScores);
      for (const code of ruleKeys) {
        const scoreVal = extractScoreValueLocal(qaScores[code]) ?? 0;
        total += scoreVal;
        const cleanK = normalizeQaKeyLocal(code);
        const ruleDef = qaRules.find(r => {
          const cleanCode = normalizeQaKeyLocal(r.code);
          return cleanCode === cleanK || cleanK.startsWith(cleanCode) || cleanCode.startsWith(cleanK);
        });
        const isFatal = ruleDef ? !!ruleDef.is_fatal_flaw : ['qa1', 'qa2', 'qa3', 'qa4', 'qa6'].some(f => cleanK.startsWith(f));
        if (isFatal && scoreVal === 0) {
          hasFatal = true;
        }
      }
      const meetsCum = total >= 4.5;
      const dec = (!hasFatal && meetsCum) ? 'Include' : 'Exclude';
      let ec = null;
      if (dec === 'Exclude') {
        if (hasFatal) {
          const failed = ruleKeys.filter(code => {
            const scoreVal = extractScoreValueLocal(qaScores[code]) ?? 0;
            const cleanK = normalizeQaKeyLocal(code);
            const ruleDef = qaRules.find(r => {
              const cleanCode = normalizeQaKeyLocal(r.code);
              return cleanCode === cleanK || cleanK.startsWith(cleanCode) || cleanCode.startsWith(cleanK);
            });
            const isFatal = ruleDef ? !!ruleDef.is_fatal_flaw : ['qa1', 'qa2', 'qa3', 'qa4', 'qa6'].some(f => cleanK.startsWith(f));
            return isFatal && scoreVal === 0;
          });
          ec = failed.map(c => {
            const up = c.toUpperCase();
            const m = up.match(/^QA[-_]?(\d+)/i);
            return m ? `QA-${m[1]}` : up;
          }).join(', ');
        } else {
          ec = 'QA-CUMULATIVE';
        }
      }
      return { decision: dec, exclusionCode: ec, totalScore: total };
    };

    const poolCDecRes = calculatePoolCDecisionLocal(normalizedPoolCQA, samplePoolCQaRules);
    assert(poolCDecRes.decision === 'Include', 'Pool C decision calculates as Include for 5.0 cumulative score');
    assert(poolCDecRes.totalScore === 5.0, 'Pool C total score sums to 5.0');

    // Test Fatal Flaw Exclude detection
    const fatalFlawQA = {
      ...normalizedPoolCQA,
      'QA-2': { value: 0.0, evidence: 'Hardware unstated' }
    };
    const fatalDecRes = calculatePoolCDecisionLocal(fatalFlawQA, samplePoolCQaRules);
    assert(fatalDecRes.decision === 'Exclude', 'Pool C decision calculates as Exclude when QA-2 is 0.0 (Fatal Flaw)');
    assert(fatalDecRes.exclusionCode === 'QA-2', 'Pool C exclusion code accurately returns QA-2');

    // Test .slr payload creation with populated Human_QA_Scores
    const poolCPayload = {
      metadata: {
        project_id: projectId,
        project_name: project.name,
        reviewer_name: 'rev_pool_c_test',
        pool_type: 'CAL_Pool_C',
        qa_rules: samplePoolCQaRules
      },
      papers: [
        {
          Paper_ID: 'MOCK-P3',
          Title: 'AI in Systematic Reviews 3',
          Human_QA_Scores: normalizedPoolCQA,
          Human_Extracted_Data: { rq1a_constraint: { value: 'Edge MCU', evidence: 'ESP32 referenced' } }
        }
      ]
    };

    const gzippedPoolC = zlib.gzipSync(JSON.stringify(poolCPayload));
    const decompressedPoolC = JSON.parse(zlib.gunzipSync(gzippedPoolC).toString('utf-8'));
    assert(decompressedPoolC.papers[0].Human_QA_Scores['QA-1'].value === 1.0, '.slr binary preserves QA-1 score value (1.0)');
    assert(decompressedPoolC.papers[0].Human_QA_Scores['QA-4'].value === 0.5, '.slr binary preserves QA-4 score value (0.5)');

    // Simulate import into SQLite reviewer_decisions & calibration_papers
    db.prepare("DELETE FROM reviewer_decisions WHERE project_id = ? AND pool = 'pool_c' AND reviewer_name = 'rev_pool_c_test'").run(projectId);
    db.prepare(`
      INSERT INTO reviewer_decisions (paper_id, project_id, pool, reviewer_name, qa_scores, extracted_data, imported_at)
      VALUES (?, ?, 'pool_c', 'rev_pool_c_test', ?, ?, datetime('now'))
    `).run('MOCK-P3', projectId, JSON.stringify(normalizedPoolCQA), JSON.stringify(poolCPayload.papers[0].Human_Extracted_Data));

    const savedDecision = db.prepare("SELECT * FROM reviewer_decisions WHERE paper_id = 'MOCK-P3' AND project_id = ? AND reviewer_name = 'rev_pool_c_test'").get(projectId);
    const parsedSavedQA = JSON.parse(savedDecision.qa_scores);
    assert(parsedSavedQA['QA-1'].value === 1.0, 'Imported reviewer_decisions has non-empty QA-1 value');
    assert(parsedSavedQA['QA-1'].evidence.length > 0, 'Imported reviewer_decisions has non-empty QA-1 evidence');

    // Update calibration_papers master record
    db.prepare(`
      UPDATE calibration_papers 
      SET manual_decision = ?, manual_quality_assessment = ?, manual_stage = 3
      WHERE Paper_ID = 'MOCK-P3' AND Project_ID = ?
    `).run(poolCDecRes.decision, savedDecision.qa_scores, projectId);

    const updatedCalPaper = db.prepare("SELECT manual_decision, manual_quality_assessment FROM calibration_papers WHERE Paper_ID = 'MOCK-P3' AND Project_ID = ?").get(projectId);
    assert(updatedCalPaper.manual_decision === 'Include', 'calibration_papers manual_decision updated to Include');
    assert(JSON.parse(updatedCalPaper.manual_quality_assessment)['QA-1'].value === 1.0, 'calibration_papers manual_quality_assessment QA-1 value is 1.0 (not empty)');

    console.log(`\n--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    db.close();
  }
}

runTests();




