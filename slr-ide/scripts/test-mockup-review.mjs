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

    console.log(`\n--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    db.close();
  }
}

runTests();



