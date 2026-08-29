import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db, { getConfig, getVaultKey, PROJECT_ROOT } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import {
  resolveMockupStagePrompt,
  getRollingBatchPromptConfigs,
  evaluateMockupPaperPoolC,
  buildRollingBatchMockupSlrFile,
  isMockupResultFailed,
  MockupPaperResult
} from '@/lib/services/mockup-generator';
import { compressSlrServer, decompressSlrServer } from '@/lib/slr-compression';

export const dynamic = 'force-dynamic';

function safeJsonParse(val: any, fallback: any = {}): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    const batchIdParam = searchParams.get('batchId') || searchParams.get('batch_id');
    const isDownload = searchParams.get('download') === 'true';
    const reviewerNameParam = searchParams.get('reviewerName') || searchParams.get('reviewer_name');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Resolve active batch or targeted batch
    let targetBatch: any = null;
    if (batchIdParam) {
      targetBatch = db.prepare(`
        SELECT * FROM rolling_batches 
        WHERE id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
      `).get(batchIdParam, projectId, projectId);
    }

    if (!targetBatch) {
      targetBatch = db.prepare(`
        SELECT * FROM rolling_batches 
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND status != 'complete'
        ORDER BY batch_number DESC LIMIT 1
      `).get(projectId, projectId);
    }

    const promptConfigs = getRollingBatchPromptConfigs(projectId);

    if (!targetBatch) {
      return NextResponse.json({
        cached: false,
        activeBatch: null,
        total_papers: 0,
        papers_count: 0,
        papers_preview: [],
        prompt_configs: promptConfigs,
        message: 'No active rolling batch found'
      });
    }

    const batchPoolKey = `rb_${targetBatch.id}`;

    // Check existing cache for this specific batch
    const cacheRow = db.prepare(`
      SELECT * FROM mockup_cache 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND (pool = ? OR pool = ?)
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(projectId, projectId, batchPoolKey, targetBatch.id) as any;

    if (isDownload && cacheRow && cacheRow.slr_blob) {
      const requestedReviewer = (reviewerNameParam || '').trim();
      const targetReviewer = requestedReviewer || cacheRow.reviewer_name || 'review';

      let outputBuffer: Buffer;

      if (requestedReviewer && requestedReviewer !== cacheRow.reviewer_name) {
        try {
          const payload = decompressSlrServer(cacheRow.slr_blob);
          if (payload && payload.metadata) {
            payload.metadata.reviewer_name = targetReviewer;
          }
          outputBuffer = compressSlrServer(payload);

          db.prepare(`
            UPDATE mockup_cache 
            SET reviewer_name = ?, slr_blob = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(targetReviewer, outputBuffer, cacheRow.id);
        } catch (syncErr) {
          console.warn('Could not update reviewer_name inside .slr binary, falling back to original blob:', syncErr);
          outputBuffer = Buffer.from(cacheRow.slr_blob);
        }
      } else {
        outputBuffer = Buffer.from(cacheRow.slr_blob);
      }

      const filename = `${project.folder_name || 'project'}_batch_${targetBatch.batch_number}_mockup_${targetReviewer}.slr`;
      return new Response(new Uint8Array(outputBuffer), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // Check reviewer slot occupancy for this batch
    const reviewerCountRow = db.prepare(`
      SELECT COUNT(DISTINCT reviewer_name) as count 
      FROM rolling_batch_reviewer_decisions 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND batch_id = ?
    `).get(projectId, projectId, targetBatch.id) as { count: number };

    const occupiedSlots = reviewerCountRow?.count || 0;

    // Fetch batch papers preview
    const batchPapers = db.prepare(`
      SELECT Paper_ID, Title, Year, Authors, DOI, Local_PDF_Status, Local_PDF_Path, Abstract, Publisher, PDF_Link
      FROM rolling_batch_papers 
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND batch_id = ?
      ORDER BY Paper_ID ASC
    `).all(projectId, projectId, targetBatch.id) as any[];

    // Calculate missing PDF count
    const missingPdfCount = batchPapers.filter(p => {
      if (!p.Local_PDF_Path || p.Local_PDF_Status === 'MISSING') return true;
      const fullPath = path.isAbsolute(p.Local_PDF_Path) ? p.Local_PDF_Path : path.join(PROJECT_ROOT, p.Local_PDF_Path);
      return !fs.existsSync(fullPath);
    }).length;

    // Calculate prompt hash diff
    const sciPrompt = resolveMockupStagePrompt(projectId, 'scientist');
    const minPrompt = resolveMockupStagePrompt(projectId, 'miner');
    let currentPromptHash: string | null = null;
    if (sciPrompt || minPrompt) {
      currentPromptHash = crypto.createHash('sha256')
        .update((sciPrompt?.system_instruction || sciPrompt?.system_prompt || '') + (sciPrompt?.user_template || sciPrompt?.user_prompt_template || '') + (minPrompt?.system_instruction || minPrompt?.system_prompt || '') + (minPrompt?.user_template || minPrompt?.user_prompt_template || ''))
        .digest('hex');
    }

    const promptChanged = Boolean(cacheRow?.prompt_hash && currentPromptHash && cacheRow.prompt_hash !== currentPromptHash);
    const parsedResults = cacheRow?.paper_results ? safeJsonParse(cacheRow.paper_results, []) : [];

    let failedCount = 0;
    let succeededCount = 0;
    if (Array.isArray(parsedResults)) {
      parsedResults.forEach((r: any) => {
        if (isMockupResultFailed(r, 'pool_c')) {
          failedCount++;
        } else {
          succeededCount++;
        }
      });
    }

    return NextResponse.json({
      cached: Boolean(cacheRow),
      activeBatch: targetBatch,
      cache_id: cacheRow?.id || null,
      reviewer_name: cacheRow?.reviewer_name || null,
      total_papers: cacheRow?.total_papers || batchPapers.length,
      total_cost_usd: cacheRow?.total_cost_usd || 0.0,
      total_tokens: cacheRow?.total_tokens || 0,
      model_id: cacheRow?.model_id || null,
      paper_results: parsedResults,
      failed_count: failedCount,
      succeeded_count: succeededCount,
      has_failures: failedCount > 0,
      missing_pdf_count: missingPdfCount,
      has_missing_pdfs: missingPdfCount > 0,
      prompt_hash: cacheRow?.prompt_hash || currentPromptHash,
      prompt_changed: promptChanged,
      created_at: cacheRow?.created_at || null,
      updated_at: cacheRow?.updated_at || null,
      occupied_slots: occupiedSlots,
      papers_count: batchPapers.length,
      papers_preview: batchPapers,
      prompt_configs: promptConfigs
    });
  } catch (error: any) {
    console.error('Failed to get rolling batch mockup status:', error);
    return NextResponse.json({ error: error.message || 'Failed to check rolling batch mockup status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, batchId, reviewerName, failedOnly, paperIds } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Check and decrypt Gemini API key
    if (!hasSessionMasterPassword()) {
      return NextResponse.json({ error: 'Vault is locked. Unlock the vault in settings to run LLM tasks.' }, { status: 401 });
    }

    const password = getSessionMasterPassword();
    const keyRow = getVaultKey('GEMINI_API_KEY');
    if (!keyRow || !password) {
      return NextResponse.json({ error: 'Gemini API Key is not configured in the vault.' }, { status: 400 });
    }

    let geminiApiKey: string;
    try {
      geminiApiKey = await decryptKey({
        ciphertext: keyRow.encrypted_value,
        salt: keyRow.salt,
        iv: keyRow.iv,
        tag: keyRow.tag,
      }, password);
    } catch (decryptErr) {
      clearSessionMasterPassword();
      return NextResponse.json({ error: 'Failed to decrypt Gemini API Key.' }, { status: 401 });
    }

    // Fetch Project details
    const project = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Resolve target rolling batch
    let targetBatch: any = null;
    if (batchId) {
      targetBatch = db.prepare(`
        SELECT * FROM rolling_batches 
        WHERE id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
      `).get(batchId, projectId, projectId);
    }

    if (!targetBatch) {
      targetBatch = db.prepare(`
        SELECT * FROM rolling_batches 
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND status != 'complete'
        ORDER BY batch_number DESC LIMIT 1
      `).get(projectId, projectId);
    }

    if (!targetBatch) {
      return NextResponse.json({
        error: 'No active rolling batch found to evaluate. Please initialize a batch in Rolling Batch Validation first.'
      }, { status: 400 });
    }

    // Fetch batch papers
    const allBatchPapers = db.prepare(`
      SELECT * FROM rolling_batch_papers 
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND batch_id = ?
      ORDER BY Paper_ID ASC
    `).all(projectId, projectId, targetBatch.id) as any[];

    if (!allBatchPapers || allBatchPapers.length === 0) {
      return NextResponse.json({
        error: `No papers found in Rolling Batch #${targetBatch.batch_number} (${targetBatch.id}).`
      }, { status: 400 });
    }

    const batchPoolKey = `rb_${targetBatch.id}`;

    // Check existing cache for partial execution
    const existingCache = db.prepare(`
      SELECT * FROM mockup_cache 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND (pool = ? OR pool = ?)
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(projectId, projectId, batchPoolKey, targetBatch.id) as any;

    const isPartialRun = Boolean(failedOnly || (Array.isArray(paperIds) && paperIds.length > 0));

    if (isPartialRun && !existingCache) {
      return NextResponse.json({
        error: 'No finished execution cache found to run partial retry on. Please run a full mockup review first.'
      }, { status: 400 });
    }

    const cleanReviewerName = (reviewerName || existingCache?.reviewer_name || `rev_${Math.floor(0x1000 + Math.random() * 0xF000).toString(16)}`).trim();

    // Determine target subset of papers to evaluate
    let targetPapers = allBatchPapers;
    const existingResultsMap = new Map<string, MockupPaperResult>();

    if (existingCache && existingCache.paper_results) {
      const parsed = safeJsonParse(existingCache.paper_results, []);
      if (Array.isArray(parsed)) {
        parsed.forEach((r: any) => {
          if (r && r.paper_id) {
            existingResultsMap.set(r.paper_id, r);
          }
        });
      }
    }

    if (isPartialRun) {
      if (failedOnly) {
        targetPapers = allBatchPapers.filter(paper => {
          const prevRes = existingResultsMap.get(paper.Paper_ID);
          return !prevRes || isMockupResultFailed(prevRes, 'pool_c');
        });
      } else if (Array.isArray(paperIds) && paperIds.length > 0) {
        const idSet = new Set(paperIds.map(id => String(id)));
        targetPapers = allBatchPapers.filter(paper => idSet.has(String(paper.Paper_ID)));
      }

      if (targetPapers.length === 0) {
        return NextResponse.json({
          success: true,
          message: failedOnly
            ? 'All papers in this rolling batch have already succeeded. Zero failed papers to retry.'
            : 'No matching papers found for selective rerun.'
        });
      }
    }

    // Enforce mandatory local PDF validation for Rolling Batch (Scientist + Miner)
    const missingPdfPapers = targetPapers.filter(p => {
      if (!p.Local_PDF_Path || p.Local_PDF_Status === 'MISSING') return true;
      const fullPath = path.isAbsolute(p.Local_PDF_Path) ? p.Local_PDF_Path : path.join(PROJECT_ROOT, p.Local_PDF_Path);
      return !fs.existsSync(fullPath);
    });

    if (missingPdfPapers.length > 0) {
      const missingIds = missingPdfPapers.slice(0, 5).map(p => p.Paper_ID).join(', ') + (missingPdfPapers.length > 5 ? ` (+${missingPdfPapers.length - 5} more)` : '');
      return NextResponse.json({
        error: `Execution rejected: ${missingPdfPapers.length} paper(s) in Rolling Batch #${targetBatch.batch_number} do not have a verified local full-text PDF file on disk (${missingIds}). Rolling Batch validation requires full-text PDFs for Quality Assessment & Data Extraction. Please acquire PDFs before running.`
      }, { status: 400 });
    }

    // Resolve Scientist and Miner Prompt Templates
    const scientistPrompt = resolveMockupStagePrompt(projectId, 'scientist');
    const minerPrompt = resolveMockupStagePrompt(projectId, 'miner');

    if (!scientistPrompt || !minerPrompt) {
      return NextResponse.json({
        error: 'Rolling Batch Validation requires both Scientist (QA) and Miner (Extraction) prompt templates configured in the Prompt Library.'
      }, { status: 400 });
    }

    const sciCfg = safeJsonParse(scientistPrompt.llm_config, {});
    const primaryModelId = sciCfg.model_id || 'gemini-2.5-flash';
    const combinedPromptHash = crypto.createHash('sha256')
      .update((scientistPrompt.system_instruction || scientistPrompt.system_prompt || '') + (scientistPrompt.user_template || scientistPrompt.user_prompt_template || '') + (minerPrompt.system_instruction || minerPrompt.system_prompt || '') + (minerPrompt.user_template || minerPrompt.user_prompt_template || ''))
      .digest('hex');

    // Parse QA & Extraction rules
    let qaRules: any[] = [];
    let extractionRules: any[] = [];
    const rawQa = project.pool_c_qa_rules || project.qa_rules;
    if (rawQa) {
      try {
        qaRules = typeof rawQa === 'string' ? JSON.parse(rawQa) : rawQa;
      } catch {}
    }
    const rawExt = project.pool_c_extraction_rules || project.extraction_rules;
    if (rawExt) {
      try {
        extractionRules = typeof rawExt === 'string' ? JSON.parse(rawExt) : rawExt;
      } catch {}
    }

    // Resolve dynamic request delay from template config
    const rawDelay = sciCfg.request_delay;
    const delayMs = (rawDelay !== undefined && rawDelay !== null && !isNaN(Number(rawDelay)))
      ? Math.max(0, Math.round(Number(rawDelay) * 1000))
      : 300;

    // Create a streaming SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const resultsMap = new Map<string, MockupPaperResult>(existingResultsMap);
        let totalCostSoFar = 0;
        let totalTokensSoFar = 0;

        if (isPartialRun) {
          const targetIdsSet = new Set(targetPapers.map(p => String(p.Paper_ID)));
          for (const [pId, r] of resultsMap.entries()) {
            if (!targetIdsSet.has(String(pId)) && !isMockupResultFailed(r, 'pool_c')) {
              totalCostSoFar += Number(r.cost_usd || 0);
              totalTokensSoFar += Number(r.tokens || 0);
            }
          }
        }

        const totalTargetPapers = targetPapers.length;

        try {
          for (let i = 0; i < totalTargetPapers; i++) {
            if (i > 0 && delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            const paper = targetPapers[i];
            const result = await evaluateMockupPaperPoolC(
              project,
              paper,
              scientistPrompt,
              minerPrompt,
              geminiApiKey,
              qaRules,
              extractionRules,
              'mockup_rolling_batch'
            );

            resultsMap.set(paper.Paper_ID, result);
            totalCostSoFar += Number(result.cost_usd || 0);
            totalTokensSoFar += Number(result.tokens || 0);

            sendEvent({
              type: 'progress',
              current: i + 1,
              total: totalTargetPapers,
              totalCohortPapers: allBatchPapers.length,
              paperId: paper.Paper_ID,
              paperTitle: paper.Title,
              decision: result.decision || (result.qa_scores ? 'QA/EXTRACTED' : 'EVALUATED'),
              exclusionCode: result.exclusion_code,
              error: result.error,
              isFailed: isMockupResultFailed(result, 'pool_c'),
              costSoFar: totalCostSoFar,
              tokensSoFar: totalTokensSoFar,
              isPartialRetry: isPartialRun
            });
          }

          // Build final .slr compressed binary with ALL batch papers merged
          const slrBuffer = buildRollingBatchMockupSlrFile(
            project,
            targetBatch,
            cleanReviewerName,
            allBatchPapers,
            resultsMap
          );

          // Build final combined results array in original order
          const fullResultsList: MockupPaperResult[] = allBatchPapers.map(paper => {
            const res = resultsMap.get(paper.Paper_ID);
            if (res) return res;
            return {
              paper_id: paper.Paper_ID,
              title: paper.Title,
              decision: 'EXCLUDE',
              exclusion_code: 'ERROR',
              rationale: 'Not evaluated',
              error: 'Not evaluated',
              tokens: 0,
              cost_usd: 0,
              latency_ms: 0
            };
          });

          const finalTotalCost = fullResultsList.reduce((acc, r) => acc + Number(r.cost_usd || 0), 0);
          const finalTotalTokens = fullResultsList.reduce((acc, r) => acc + Number(r.tokens || 0), 0);
          const nowIso = new Date().toISOString();
          let cacheId = 0;

          db.transaction(() => {
            db.prepare(`
              DELETE FROM mockup_cache 
              WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND (pool = ? OR pool = ?)
            `).run(projectId, projectId, batchPoolKey, targetBatch.id);

            const ins = db.prepare(`
              INSERT INTO mockup_cache (
                project_id, pool, reviewer_name, prompt_hash, model_id,
                slr_blob, total_papers, total_cost_usd, total_tokens,
                paper_results, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              String(project.id),
              batchPoolKey,
              cleanReviewerName,
              combinedPromptHash,
              primaryModelId,
              slrBuffer,
              allBatchPapers.length,
              finalTotalCost,
              finalTotalTokens,
              JSON.stringify(fullResultsList),
              existingCache?.created_at || nowIso,
              nowIso
            );

            cacheId = Number(ins.lastInsertRowid);
          })();

          sendEvent({
            type: 'complete',
            cacheId,
            reviewerName: cleanReviewerName,
            totalPapers: allBatchPapers.length,
            targetPapersEvaluated: totalTargetPapers,
            totalCost: finalTotalCost,
            totalTokens: finalTotalTokens,
            isPartialRetry: isPartialRun,
            downloadUrl: `/api/rolling-batch/mockup?projectId=${encodeURIComponent(projectId)}&batchId=${encodeURIComponent(targetBatch.id)}&reviewerName=${encodeURIComponent(cleanReviewerName)}&download=true`
          });

          controller.close();
        } catch (genErr: any) {
          console.error('Error during rolling batch mockup generation stream:', genErr);
          sendEvent({
            type: 'error',
            error: genErr.message || 'Error occurred during rolling batch mockup review generation'
          });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });
  } catch (error: any) {
    console.error('Failed to initiate rolling batch mockup generation:', error);
    return NextResponse.json({ error: error.message || 'Failed to start rolling batch mockup generation' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    const batchId = searchParams.get('batchId') || searchParams.get('batch_id');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    if (batchId) {
      const batchPoolKey = `rb_${batchId}`;
      db.prepare(`
        DELETE FROM mockup_cache 
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND (pool = ? OR pool = ?)
      `).run(projectId, projectId, batchPoolKey, batchId);
    } else {
      db.prepare(`
        DELETE FROM mockup_cache 
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool LIKE 'rb_%'
      `).run(projectId, projectId);
    }

    return NextResponse.json({
      success: true,
      message: 'Rolling batch mockup cache cleared successfully'
    });
  } catch (error: any) {
    console.error('Failed to clear rolling batch mockup cache:', error);
    return NextResponse.json({ error: error.message || 'Failed to clear rolling batch mockup cache' }, { status: 500 });
  }
}
