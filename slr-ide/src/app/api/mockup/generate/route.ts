import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import db, { getConfig, getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import {
  resolveMockupStagePrompt,
  getMockupPromptConfigs,
  evaluateMockupPaperScreening,
  evaluateMockupPaperPoolC,
  buildMockupSlrFile,
  isMockupResultFailed,
  MockupPaperResult,
  MockupPromptConfig
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
    const pool = searchParams.get('pool') || 'pool_a';
    const projectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    const isDownload = searchParams.get('download') === 'true';
    const reviewerNameParam = searchParams.get('reviewerName') || searchParams.get('reviewer_name');

    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const project = db.prepare('SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(projectId, projectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check existing cache
    const cacheRow = db.prepare(`
      SELECT * FROM mockup_cache 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(projectId, projectId, dbPool) as any;

    if (isDownload && cacheRow && cacheRow.slr_blob) {
      const requestedReviewer = (reviewerNameParam || '').trim();
      const targetReviewer = requestedReviewer || cacheRow.reviewer_name || 'review';

      let outputBuffer: Buffer;

      // If a specific reviewer identifier is requested and differs from cache, update .slr metadata and cache row
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

      const filename = `${project.folder_name || 'project'}_${dbPool}_mockup_${targetReviewer}.slr`;
      return new Response(new Uint8Array(outputBuffer), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // Check reviewer slot occupancy for this pool
    const reviewerCountRow = db.prepare(`
      SELECT COUNT(DISTINCT reviewer_name) as count 
      FROM reviewer_decisions 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool = ?
    `).get(projectId, projectId, dbPool) as { count: number };

    const occupiedSlots = reviewerCountRow?.count || 0;

    // Fetch calibration papers preview for target pool
    const calPapers = db.prepare(`
      SELECT Paper_ID, Title, Year, Authors, DOI, Local_PDF_Status, Local_PDF_Path, Abstract
      FROM calibration_papers 
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND calibration_pool = ?
      ORDER BY Paper_ID ASC
    `).all(projectId, projectId, dbPool) as any[];

    // Calculate missing PDF count for Pool B and Pool C
    let missingPdfCount = 0;
    if (dbPool === 'pool_b' || dbPool === 'pool_c') {
      missingPdfCount = calPapers.filter(p => !p.Local_PDF_Path || !fs.existsSync(p.Local_PDF_Path)).length;
    }

    // Check prompt hash diff for UI badge
    let currentPromptHash: string | null = null;
    if (dbPool === 'pool_c') {
      const sciPrompt = resolveMockupStagePrompt(projectId, 'scientist');
      const minPrompt = resolveMockupStagePrompt(projectId, 'miner');
      if (sciPrompt || minPrompt) {
        currentPromptHash = crypto.createHash('sha256')
          .update((sciPrompt?.system_instruction || sciPrompt?.system_prompt || '') + (sciPrompt?.user_template || sciPrompt?.user_prompt_template || '') + (minPrompt?.system_instruction || minPrompt?.system_prompt || '') + (minPrompt?.user_template || minPrompt?.user_prompt_template || ''))
          .digest('hex');
      }
    } else {
      const promptType = dbPool === 'pool_b' ? 'gatekeeper' : 'fast_filter';
      const promptTpl = resolveMockupStagePrompt(projectId, promptType);
      if (promptTpl) {
        currentPromptHash = crypto.createHash('sha256')
          .update((promptTpl.system_instruction || promptTpl.system_prompt || '') + (promptTpl.user_template || promptTpl.user_prompt_template || ''))
          .digest('hex');
      }
    }

    const promptChanged = Boolean(cacheRow?.prompt_hash && currentPromptHash && cacheRow.prompt_hash !== currentPromptHash);
    const parsedResults = cacheRow?.paper_results ? safeJsonParse(cacheRow.paper_results, []) : [];
    
    let failedCount = 0;
    let succeededCount = 0;
    if (Array.isArray(parsedResults)) {
      parsedResults.forEach((r: any) => {
        if (isMockupResultFailed(r, dbPool)) {
          failedCount++;
        } else {
          succeededCount++;
        }
      });
    }

    const promptConfigs = getMockupPromptConfigs(projectId, dbPool);

    return NextResponse.json({
      cached: Boolean(cacheRow),
      cache_id: cacheRow?.id || null,
      reviewer_name: cacheRow?.reviewer_name || null,
      total_papers: cacheRow?.total_papers || calPapers.length,
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
      papers_count: calPapers.length,
      papers_preview: calPapers,
      prompt_configs: promptConfigs
    });
  } catch (error: any) {
    console.error('Failed to get mockup cache status:', error);
    return NextResponse.json({ error: error.message || 'Failed to check mockup cache' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, pool, reviewerName, failedOnly, paperIds } = body;

    const dbPool: 'pool_a' | 'pool_b' | 'pool_c' = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

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

    // Fetch Calibration Papers for target pool
    const allPoolPapers = db.prepare(`
      SELECT * FROM calibration_papers 
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND calibration_pool = ?
      ORDER BY Paper_ID ASC
    `).all(projectId, projectId, dbPool) as any[];

    if (!allPoolPapers || allPoolPapers.length === 0) {
      return NextResponse.json({
        error: `No papers found in ${dbPool.toUpperCase()} for this project. Please assign calibration papers first.`
      }, { status: 400 });
    }

    // Check existing cache for partial execution
    const existingCache = db.prepare(`
      SELECT * FROM mockup_cache 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(projectId, projectId, dbPool) as any;

    const isPartialRun = Boolean(failedOnly || (Array.isArray(paperIds) && paperIds.length > 0));

    if (isPartialRun && !existingCache) {
      return NextResponse.json({
        error: 'No finished execution cache found to run partial retry on. Please run a full mockup generation first.'
      }, { status: 400 });
    }

    const cleanReviewerName = (reviewerName || existingCache?.reviewer_name || `rev_${Math.floor(0x1000 + Math.random() * 0xF000).toString(16)}`).trim();

    // Determine target subset of papers to evaluate
    let targetPapers = allPoolPapers;
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
        targetPapers = allPoolPapers.filter(paper => {
          const prevRes = existingResultsMap.get(paper.Paper_ID);
          return !prevRes || isMockupResultFailed(prevRes, dbPool);
        });
      } else if (Array.isArray(paperIds) && paperIds.length > 0) {
        const idSet = new Set(paperIds.map(id => String(id)));
        targetPapers = allPoolPapers.filter(paper => idSet.has(String(paper.Paper_ID)));
      }

      if (targetPapers.length === 0) {
        return NextResponse.json({
          success: true,
          message: failedOnly
            ? 'All papers in this pool have already succeeded. Zero failed papers to retry.'
            : 'No matching papers found for selective rerun.'
        });
      }
    }

    // Enforce mandatory local PDF validation for Pool B and Pool C
    if (dbPool === 'pool_b' || dbPool === 'pool_c') {
      const missingPdfPapers = targetPapers.filter(p => !p.Local_PDF_Path || !fs.existsSync(p.Local_PDF_Path));
      if (missingPdfPapers.length > 0) {
        const missingIds = missingPdfPapers.slice(0, 5).map(p => p.Paper_ID).join(', ') + (missingPdfPapers.length > 5 ? ` (+${missingPdfPapers.length - 5} more)` : '');
        return NextResponse.json({
          error: `Execution rejected: ${missingPdfPapers.length} paper(s) in ${dbPool.toUpperCase()} do not have a verified local full-text PDF file on disk (${missingIds}). Pool B and Pool C require local PDFs. Please acquire or match PDFs before running.`
        }, { status: 400 });
      }
    }

    // Resolve Prompt Templates
    let promptTemplateAorB: any = null;
    let scientistPrompt: any = null;
    let minerPrompt: any = null;
    let primaryModelId = 'gemini-2.5-flash';
    let combinedPromptHash = '';

    if (dbPool === 'pool_c') {
      scientistPrompt = resolveMockupStagePrompt(projectId, 'scientist');
      minerPrompt = resolveMockupStagePrompt(projectId, 'miner');

      if (!scientistPrompt || !minerPrompt) {
        return NextResponse.json({
          error: 'Pool C requires both Scientist (QA) and Miner (Extraction) prompt templates configured in the Prompt Library.'
        }, { status: 400 });
      }

      const sciCfg = safeJsonParse(scientistPrompt.llm_config, {});
      primaryModelId = sciCfg.model_id || 'gemini-2.5-flash';
      combinedPromptHash = crypto.createHash('sha256')
        .update((scientistPrompt.system_instruction || scientistPrompt.system_prompt || '') + (scientistPrompt.user_template || scientistPrompt.user_prompt_template || '') + (minerPrompt.system_instruction || minerPrompt.system_prompt || '') + (minerPrompt.user_template || minerPrompt.user_prompt_template || ''))
        .digest('hex');
    } else {
      const promptType = dbPool === 'pool_b' ? 'gatekeeper' : 'fast_filter';
      promptTemplateAorB = resolveMockupStagePrompt(projectId, promptType);

      if (!promptTemplateAorB) {
        return NextResponse.json({
          error: `No default prompt template configured for ${promptType.replace('_', ' ')} in the Prompt Library.`
        }, { status: 400 });
      }

      const tplCfg = safeJsonParse(promptTemplateAorB.llm_config, {});
      primaryModelId = tplCfg.model_id || 'gemini-2.5-flash';
      combinedPromptHash = crypto.createHash('sha256')
        .update((promptTemplateAorB.system_instruction || promptTemplateAorB.system_prompt || '') + (promptTemplateAorB.user_template || promptTemplateAorB.user_prompt_template || ''))
        .digest('hex');
    }

    // Parse QA & Extraction rules for Pool C
    let qaRules: any[] = [];
    let extractionRules: any[] = [];
    if (dbPool === 'pool_c') {
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
    }

    // Resolve dynamic request delay from template config
    const activeTplConfig = dbPool === 'pool_c' 
      ? safeJsonParse(scientistPrompt?.llm_config, {}) 
      : safeJsonParse(promptTemplateAorB?.llm_config, {});
    const rawDelay = activeTplConfig.request_delay;
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

        // Initialize resultsMap: if partial run, seed with existing results
        const resultsMap = new Map<string, MockupPaperResult>(existingResultsMap);
        
        // Calculate starting baseline costs and tokens from existing successful non-retried items
        let totalCostSoFar = 0;
        let totalTokensSoFar = 0;
        
        if (isPartialRun) {
          const targetIdsSet = new Set(targetPapers.map(p => String(p.Paper_ID)));
          for (const [pId, r] of resultsMap.entries()) {
            if (!targetIdsSet.has(String(pId)) && !isMockupResultFailed(r, dbPool)) {
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
            let result: MockupPaperResult;

            if (dbPool === 'pool_c') {
              result = await evaluateMockupPaperPoolC(
                project,
                paper,
                scientistPrompt,
                minerPrompt,
                geminiApiKey,
                qaRules,
                extractionRules
              );
            } else {
              const stageNum = dbPool === 'pool_b' ? 2 : 1;
              const taskType = dbPool === 'pool_b' ? 'mockup_pool_b' : 'mockup_pool_a';
              result = await evaluateMockupPaperScreening(
                project,
                paper,
                stageNum,
                promptTemplateAorB,
                geminiApiKey,
                taskType
              );
            }

            resultsMap.set(paper.Paper_ID, result);
            totalCostSoFar += Number(result.cost_usd || 0);
            totalTokensSoFar += Number(result.tokens || 0);

            // Stream progress
            sendEvent({
              type: 'progress',
              current: i + 1,
              total: totalTargetPapers,
              totalCohortPapers: allPoolPapers.length,
              paperId: paper.Paper_ID,
              paperTitle: paper.Title,
              decision: result.decision || (result.qa_scores ? 'QA/EXTRACTED' : 'EVALUATED'),
              exclusionCode: result.exclusion_code,
              error: result.error,
              isFailed: isMockupResultFailed(result, dbPool),
              costSoFar: totalCostSoFar,
              tokensSoFar: totalTokensSoFar,
              isPartialRetry: isPartialRun
            });
          }

          // Build final .slr compressed binary with ALL pool papers merged
          const slrBuffer = buildMockupSlrFile(
            project,
            dbPool,
            cleanReviewerName,
            allPoolPapers,
            resultsMap
          );

          // Build final combined results array in original paper order
          const fullResultsList: MockupPaperResult[] = allPoolPapers.map(paper => {
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

          // Recalculate true cumulative cost & tokens
          const finalTotalCost = fullResultsList.reduce((acc, r) => acc + Number(r.cost_usd || 0), 0);
          const finalTotalTokens = fullResultsList.reduce((acc, r) => acc + Number(r.tokens || 0), 0);
          const nowIso = new Date().toISOString();
          let cacheId = 0;

          db.transaction(() => {
            db.prepare(`
              DELETE FROM mockup_cache 
              WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool = ?
            `).run(projectId, projectId, dbPool);

            const ins = db.prepare(`
              INSERT INTO mockup_cache (
                project_id, pool, reviewer_name, prompt_hash, model_id,
                slr_blob, total_papers, total_cost_usd, total_tokens,
                paper_results, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              String(project.id),
              dbPool,
              cleanReviewerName,
              combinedPromptHash,
              primaryModelId,
              slrBuffer,
              allPoolPapers.length,
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
            totalPapers: allPoolPapers.length,
            targetPapersEvaluated: totalTargetPapers,
            totalCost: finalTotalCost,
            totalTokens: finalTotalTokens,
            isPartialRetry: isPartialRun,
            downloadUrl: `/api/mockup/generate?projectId=${encodeURIComponent(projectId)}&pool=${dbPool}&reviewerName=${encodeURIComponent(cleanReviewerName)}&download=true`
          });

          controller.close();
        } catch (genErr: any) {
          console.error('Error during mockup generation stream:', genErr);
          sendEvent({
            type: 'error',
            error: genErr.message || 'Error occurred during mockup review generation'
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
    console.error('Failed to initiate mockup generation:', error);
    return NextResponse.json({ error: error.message || 'Failed to start mockup generation' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pool = searchParams.get('pool') || 'pool_a';
    const projectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');

    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    db.prepare(`
      DELETE FROM mockup_cache 
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND pool = ?
    `).run(projectId, projectId, dbPool);

    return NextResponse.json({
      success: true,
      message: `Mockup cache cleared for ${dbPool.toUpperCase()}`
    });
  } catch (error: any) {
    console.error('Failed to clear mockup cache:', error);
    return NextResponse.json({ error: error.message || 'Failed to clear mockup cache' }, { status: 500 });
  }
}
