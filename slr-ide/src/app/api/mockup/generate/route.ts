import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import db, { getConfig, getVaultKey } from '@/lib/db';
import { getSessionMasterPassword, hasSessionMasterPassword, clearSessionMasterPassword } from '@/lib/session';
import { decryptKey } from '@/lib/vault';
import {
  resolveMockupStagePrompt,
  evaluateMockupPaperScreening,
  evaluateMockupPaperPoolC,
  buildMockupSlrFile,
  MockupPaperResult
} from '@/lib/services/mockup-generator';

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
      const buffer = Buffer.from(cacheRow.slr_blob);
      const filename = `${project.folder_name || 'project'}_${dbPool}_mockup_${cacheRow.reviewer_name || 'review'}.slr`;
      return new Response(new Uint8Array(buffer), {
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

    // Check prompt hash diff for UI badge
    let currentPromptHash: string | null = null;
    if (dbPool === 'pool_c') {
      const sciPrompt = resolveMockupStagePrompt(projectId, 'scientist');
      const minPrompt = resolveMockupStagePrompt(projectId, 'miner');
      if (sciPrompt || minPrompt) {
        currentPromptHash = crypto.createHash('sha256')
          .update((sciPrompt?.system_instruction || '') + (sciPrompt?.user_template || '') + (minPrompt?.system_instruction || '') + (minPrompt?.user_template || ''))
          .digest('hex');
      }
    } else {
      const promptType = dbPool === 'pool_b' ? 'gatekeeper' : 'fast_filter';
      const promptTpl = resolveMockupStagePrompt(projectId, promptType);
      if (promptTpl) {
        currentPromptHash = crypto.createHash('sha256')
          .update((promptTpl.system_instruction || '') + (promptTpl.user_template || ''))
          .digest('hex');
      }
    }

    const promptChanged = Boolean(cacheRow?.prompt_hash && currentPromptHash && cacheRow.prompt_hash !== currentPromptHash);

    return NextResponse.json({
      cached: Boolean(cacheRow),
      cache_id: cacheRow?.id || null,
      reviewer_name: cacheRow?.reviewer_name || null,
      total_papers: cacheRow?.total_papers || calPapers.length,
      total_cost_usd: cacheRow?.total_cost_usd || 0.0,
      total_tokens: cacheRow?.total_tokens || 0,
      model_id: cacheRow?.model_id || null,
      paper_results: cacheRow?.paper_results ? JSON.parse(cacheRow.paper_results) : null,
      prompt_hash: cacheRow?.prompt_hash || currentPromptHash,
      prompt_changed: promptChanged,
      created_at: cacheRow?.created_at || null,
      occupied_slots: occupiedSlots,
      papers_count: calPapers.length,
      papers_preview: calPapers
    });
  } catch (error: any) {
    console.error('Failed to get mockup cache status:', error);
    return NextResponse.json({ error: error.message || 'Failed to check mockup cache' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, pool, reviewerName } = body;

    const dbPool: 'pool_a' | 'pool_b' | 'pool_c' = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const cleanReviewerName = (reviewerName || `rev_${Math.floor(0x1000 + Math.random() * 0xF000).toString(16)}`).trim();

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
    const papers = db.prepare(`
      SELECT * FROM calibration_papers 
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND calibration_pool = ?
      ORDER BY Paper_ID ASC
    `).all(projectId, projectId, dbPool) as any[];

    if (!papers || papers.length === 0) {
      return NextResponse.json({
        error: `No papers found in ${dbPool.toUpperCase()} for this project. Please assign calibration papers first.`
      }, { status: 400 });
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
        .update((scientistPrompt.system_instruction || '') + (scientistPrompt.user_template || '') + (minerPrompt.system_instruction || '') + (minerPrompt.user_template || ''))
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
        .update((promptTemplateAorB.system_instruction || '') + (promptTemplateAorB.user_template || ''))
        .digest('hex');
    }

    // Parse QA & Extraction rules for Pool C
    let qaRules: any[] = [];
    let extractionRules: any[] = [];
    if (dbPool === 'pool_c') {
      if (project.pool_c_qa_rules) {
        try {
          qaRules = typeof project.pool_c_qa_rules === 'string' ? JSON.parse(project.pool_c_qa_rules) : project.pool_c_qa_rules;
        } catch {}
      }
      if (project.pool_c_extraction_rules) {
        try {
          extractionRules = typeof project.pool_c_extraction_rules === 'string' ? JSON.parse(project.pool_c_extraction_rules) : project.pool_c_extraction_rules;
        } catch {}
      }
    }

    // Resolve dynamic request delay from template config
    const activeTplConfig = dbPool === 'pool_c' 
      ? safeJsonParse(scientistPrompt?.llm_config, {}) 
      : safeJsonParse(promptTemplateAorB?.llm_config, {});
    const rawDelay = activeTplConfig.request_delay;
    const delayMs = rawDelay !== undefined && rawDelay !== null 
      ? (Number(rawDelay) > 10 ? Number(rawDelay) : Math.max(0, Number(rawDelay) * 1000))
      : 300;

    // Create a streaming SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const resultsMap = new Map<string, MockupPaperResult>();
        const resultsList: MockupPaperResult[] = [];
        let totalCostSoFar = 0;
        let totalTokensSoFar = 0;
        const totalPapers = papers.length;

        try {
          for (let i = 0; i < totalPapers; i++) {
            if (i > 0 && delayMs > 0) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            const paper = papers[i];
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
            resultsList.push(result);
            totalCostSoFar += result.cost_usd;
            totalTokensSoFar += result.tokens;

            // Stream progress
            sendEvent({
              type: 'progress',
              current: i + 1,
              total: totalPapers,
              paperId: paper.Paper_ID,
              paperTitle: paper.Title,
              decision: result.decision || (result.qa_scores ? 'QA/EXTRACTED' : 'EVALUATED'),
              exclusionCode: result.exclusion_code,
              costSoFar: totalCostSoFar,
              tokensSoFar: totalTokensSoFar
            });
          }

          // Build final .slr compressed binary
          const slrBuffer = buildMockupSlrFile(
            project,
            dbPool,
            cleanReviewerName,
            papers,
            resultsMap
          );

          // Atomic SQLite Cache Write (delete previous project+pool cache, insert fresh)
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
              totalPapers,
              totalCostSoFar,
              totalTokensSoFar,
              JSON.stringify(resultsList),
              nowIso,
              nowIso
            );

            cacheId = Number(ins.lastInsertRowid);
          })();

          sendEvent({
            type: 'complete',
            cacheId,
            reviewerName: cleanReviewerName,
            totalPapers,
            totalCost: totalCostSoFar,
            totalTokens: totalTokensSoFar,
            downloadUrl: `/api/mockup/generate?projectId=${encodeURIComponent(projectId)}&pool=${dbPool}&download=true`
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
