import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { pipelineLock } from '@/lib/services/pipeline-lock';
import { goldMineStateTracker } from '@/lib/services/goldmine-state-tracker';

/**
 * Helper to parse composite QA score from JSON or numeric value
 */
function parseQaScore(paper: any): number {
  const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
  const qaStr = isManualDominant
    ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '')
    : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

  if (!qaStr) return 0;

  try {
    const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
    if (typeof parsed === 'object' && parsed !== null) {
      const qaObj = parsed.qa_scores || parsed;
      let score = 0;

      Object.entries(qaObj).forEach(([k, v]) => {
        if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace' || k === 'qa_scores') return;
        
        let rawVal: any = v;
        if (v !== null && v !== undefined && typeof v === 'object') {
          const vObj = v as any;
          if ('score' in vObj && vObj.score !== undefined && vObj.score !== null) {
            rawVal = vObj.score;
          } else if ('value' in vObj && vObj.value !== undefined && vObj.value !== null) {
            rawVal = vObj.value;
          } else {
            const entries = Object.entries(vObj);
            const nonTextMatch = entries.find(([key, val]) => {
              const kLower = key.toLowerCase();
              const isMeta = ['exact_quote', 'quote', 'evidence', 'text', 'snippet', 'reasoning', 'justification', 'analysis', 'rationale', 'explanation', 'logic_trace'].includes(kLower);
              return !isMeta && (typeof val === 'number' || typeof val === 'boolean' || (typeof val === 'string' && val.length < 50));
            });
            rawVal = nonTextMatch ? nonTextMatch[1] : '';
          }
        }

        const valStr = (rawVal !== undefined && rawVal !== null) ? String(rawVal) : '';
        const numVal = parseFloat(valStr);
        if (!isNaN(numVal)) {
          score += numVal;
        } else if (rawVal === true || ['YES', 'PASS', 'TRUE'].includes(valStr.toUpperCase().trim())) {
          score += 1;
        }
      });
      return score;
    }
  } catch (e) {
    const num = parseFloat(qaStr);
    if (!isNaN(num)) return num;
  }
  return 0;
}

/**
 * Helper to resolve raw token against Umbrellanizer mapping dictionary
 */
function resolveCategoryFromMapping(val: string, umbrellaMapping: Record<string, any>): string {
  if (!val || typeof val !== 'string') return String(val || '').trim();
  const raw = val.trim();
  if (!raw || raw === '[object Object]') return '';

  const rawNorm = raw.toLowerCase().replace(/\s+/g, ' ');

  // Look for exact or normalized case match in mapping dictionary
  const matchedKey = Object.keys(umbrellaMapping).find(
    (k) => k.trim().toLowerCase().replace(/\s+/g, ' ') === rawNorm
  );

  const target = matchedKey ? umbrellaMapping[matchedKey] : umbrellaMapping[raw];
  if (!target) return raw;

  // Handle Object format { umbrella_category: '...', category: '...' }
  if (typeof target === 'object' && target !== null && !Array.isArray(target)) {
    const categoryName = target.umbrella_category || target.category || target.label || target.value || target.raw_token || matchedKey || raw;
    return String(categoryName).trim();
  }

  // Handle Array format ['Category']
  if (Array.isArray(target) && target.length > 0) {
    const firstItem = target[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      return String(firstItem.umbrella_category || firstItem.category || firstItem.label || firstItem.raw_token || raw).trim();
    }
    return String(firstItem).trim();
  }

  return String(target).trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  if (searchParams.get('stream') === 'true') {
    return goldMineStateTracker.createEventStream(request);
  }

  if (searchParams.get('status') === 'true') {
    return NextResponse.json(goldMineStateTracker.getState());
  }

  return NextResponse.json({ error: 'Invalid GET query parameters' }, { status: 400 });
}

export async function DELETE() {
  goldMineStateTracker.requestCancel();
  return NextResponse.json({ message: 'Cancel requested' });
}

export async function POST(request: Request) {
  try {
    const { projectId, groupByKey, minQaThreshold = 6, qaFilterEnabled = false } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Check concurrency lock
    if (pipelineLock.isLocked() || goldMineStateTracker.getState().isExecuting) {
      return NextResponse.json({ error: 'Another pipeline process or export is already running' }, { status: 409 });
    }

    // Acquire lock and reset tracker
    pipelineLock.acquire();
    goldMineStateTracker.reset();

    // Get Project Info
    const project = db.prepare('SELECT rclone_remote_name, gdrive_dest_path, goldmine_dest_path FROM projects WHERE id = ?').get(projectId) as any;
    if (!project || !project.rclone_remote_name) {
      pipelineLock.release();
      return NextResponse.json({ error: 'Project or rclone configuration not found' }, { status: 404 });
    }

    const resolvedGoldminePath = (project.goldmine_dest_path && project.goldmine_dest_path.trim() !== '')
      ? project.goldmine_dest_path.trim()
      : `${(project.gdrive_dest_path || 'SLR_Magic/PDFs').trim()}/Gold_Mine_Exports`;

    // Get Umbrellanizer mappings if a key is provided
    let umbrellaMapping: Record<string, any> = {};
    if (groupByKey) {
      const umbRes = db.prepare(`
        SELECT umbrella_mapping 
        FROM umbrellanizer_results 
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) AND extracted_data_key = ?
      `).get(projectId, groupByKey) as any;

      if (umbRes && umbRes.umbrella_mapping) {
        const mappingStr = umbRes.umbrella_mapping;
        if (mappingStr) {
          try {
            const parsed = JSON.parse(mappingStr);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                if (item && item.raw_token) {
                  const key = String(item.raw_token).trim();
                  umbrellaMapping[key] = item.umbrella_category || item.category || item;
                }
              });
            } else if (typeof parsed === 'object' && parsed !== null) {
              umbrellaMapping = parsed;
            }
          } catch (e) {}
        }
      }
    }

    // Get Final Dataset Cohort (Stage 4 AND INCLUDE AND SYNCED)
    const papers = db.prepare(`
      SELECT 
        Paper_ID, Title, Local_PDF_Path, 
        ai_quality_assessment, manual_quality_assessment,
        ai_extracted_data, manual_extracted_data,
        ai_stage, manual_stage
      FROM papers 
      WHERE Project_ID = ?
        AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) = 4
        AND CASE 
            WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
            WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
            ELSE COALESCE(manual_decision, ai_decision)
        END LIKE 'INCLUDE%'
        AND Local_PDF_Status = 'SYNCED'
        AND Local_PDF_Path IS NOT NULL
    `).all(projectId) as any[];

    // Filter by QA threshold if enabled
    let skippedQa = 0;
    const filteredPapers: any[] = [];

    for (const paper of papers) {
      if (qaFilterEnabled) {
        const qaScore = parseQaScore(paper);
        if (qaScore < Number(minQaThreshold)) {
          skippedQa++;
          continue;
        }
      }
      filteredPapers.push(paper);
    }

    if (filteredPapers.length === 0) {
      pipelineLock.release();
      goldMineStateTracker.updateState({
        isExecuting: false,
        phase: 'complete',
        statusText: 'No qualifying SYNCED PDFs found matching criteria',
        stats: {
          totalPapers: papers.length,
          stagedFiles: 0,
          uploadedFiles: 0,
          skippedQa,
          transferSpeed: '0 B/s',
          categories: 0
        }
      });
      goldMineStateTracker.broadcast({ event: 'complete', isTerminal: true, message: 'No qualifying PDFs' });
      return goldMineStateTracker.createEventStream(request);
    }

    // Pre-calculate QA score & sort papers in descending order of QA score
    const sortedPapersWithQa = filteredPapers.map((paper: any) => ({
      paper,
      qaScore: parseQaScore(paper)
    })).sort((a: any, b: any) => {
      if (b.qaScore !== a.qaScore) {
        return b.qaScore - a.qaScore;
      }
      return String(a.paper.Paper_ID || '').localeCompare(String(b.paper.Paper_ID || ''));
    });

    // Prepare staging directory with RQ-aware export session ID
    const safeGroupKey = groupByKey ? String(groupByKey).trim().replace(/[^a-z0-9_\-]/gi, '_') : '';
    const exportSessionId = safeGroupKey ? `${safeGroupKey}_${Date.now()}` : `Flat_Exports_${Date.now()}`;
    const exportTempDir = path.join(process.cwd(), 'slr-ide', 'tmp', exportSessionId);

    if (!fs.existsSync(exportTempDir)) {
      fs.mkdirSync(exportTempDir, { recursive: true });
    }

    goldMineStateTracker.updateState({
      isExecuting: true,
      phase: 'staging',
      progress: 0,
      statusText: `Staging 0/${filteredPapers.length} papers...`,
      exportSessionId,
      exportTempDir,
      stats: {
        totalPapers: filteredPapers.length,
        stagedFiles: 0,
        uploadedFiles: 0,
        skippedQa,
        transferSpeed: '0 B/s',
        categories: 0
      }
    });
    goldMineStateTracker.addLog(`[Staging]: Starting staging phase for ${filteredPapers.length} papers...`);
    goldMineStateTracker.broadcast({ event: 'staging_start' });

    // Pre-calculate paper category lists & category total counts for 50-source chunking
    const paperCategoryItems: Array<{ paper: any; categories: string[] }> = [];
    const categoryTotals: Record<string, number> = {};

    for (const { paper: p } of sortedPapersWithQa) {
      let categoryValues: string[] = [];
      if (groupByKey) {
        const isManualDominant = (p.manual_stage || 0) >= (p.ai_stage || 0);
        const extDataStr = isManualDominant
          ? (p.manual_extracted_data || p.ai_extracted_data || '{}')
          : (p.ai_extracted_data || p.manual_extracted_data || '{}');

        try {
          const parsed = JSON.parse(extDataStr);
          const extObj = (parsed && typeof parsed === 'object' && parsed.extracted_data && typeof parsed.extracted_data === 'object')
            ? parsed.extracted_data
            : parsed;

          let rawVal = extObj ? extObj[groupByKey] : undefined;

          if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal) && 'value' in rawVal) {
            rawVal = rawVal.value;
          }

          const extractSingleVal = (item: any): string => {
            if (item && typeof item === 'object' && 'value' in item) {
              return String((item as any).value);
            }
            return String(item);
          };

          if (Array.isArray(rawVal)) {
            categoryValues = rawVal
              .map((v) => {
                const s = extractSingleVal(v).trim();
                return resolveCategoryFromMapping(s, umbrellaMapping);
              })
              .filter((v) => v !== '' && v !== '[object Object]');
          } else if (rawVal !== undefined && rawVal !== null) {
            const s = extractSingleVal(rawVal).trim();
            if (s !== '' && s !== '[object Object]') {
              const res = resolveCategoryFromMapping(s, umbrellaMapping);
              if (res !== '') categoryValues = [res];
            }
          }
        } catch (e) {}

        categoryValues = Array.from(new Set(categoryValues.map((c) => String(c || '').trim()))).filter(Boolean);

        const notStatedCat = safeGroupKey ? `${safeGroupKey}_NOT_STATED` : '_Ungrouped';
        if (categoryValues.length === 0) {
          categoryValues = [notStatedCat];
        } else {
          categoryValues = categoryValues.map((cat) => {
            const norm = String(cat || '').trim();
            if (norm.toUpperCase() === 'NOT_STATED' || norm.toUpperCase() === 'NOT STATED' || norm === '_Ungrouped') {
              return notStatedCat;
            }
            return norm;
          });
        }
      } else {
        categoryValues = [''];
      }

      paperCategoryItems.push({ paper: p, categories: categoryValues });

      for (const catVal of categoryValues) {
        const strCat = String(catVal).trim();
        const safeCat = strCat !== '' ? (strCat.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 80) || '_Category') : '';
        categoryTotals[safeCat] = (categoryTotals[safeCat] || 0) + 1;
      }
    }

    // Execute Staging Phase in background async task to allow immediate stream response
    (async () => {
      try {
        let stagedCount = 0;
        const categoryCurrentCounts: Record<string, number> = {};
        const categoriesSet = new Set<string>();

        for (let i = 0; i < paperCategoryItems.length; i++) {
          const state = goldMineStateTracker.getState();
          if (state.cancelRequested) {
            goldMineStateTracker.addLog(`[Staging]: Staging cancelled by user.`);
            pipelineLock.release();
            if (fs.existsSync(exportTempDir)) {
              try { fs.rmSync(exportTempDir, { recursive: true, force: true }); } catch (e) {}
            }
            return;
          }

          const item = paperCategoryItems[i];
          const p = item.paper;
          const sourcePdf = p.Local_PDF_Path;
          const fileName = path.basename(sourcePdf);

          if (fs.existsSync(sourcePdf)) {
            for (const catVal of item.categories) {
              const strCat = String(catVal).trim();
              const safeCat = strCat !== '' ? (strCat.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 80) || '_Category') : '';
              
              categoryCurrentCounts[safeCat] = (categoryCurrentCounts[safeCat] || 0) + 1;
              const currentCount = categoryCurrentCounts[safeCat];
              const totalCount = categoryTotals[safeCat] || 0;

              let targetDir = exportTempDir;
              let folderName = safeCat;
              if (totalCount > 50) {
                const chunkIndex = Math.ceil(currentCount / 50);
                folderName = safeCat !== '' ? `${safeCat}_Part${chunkIndex}` : `Part${chunkIndex}`;
              }

              if (folderName !== '') {
                targetDir = path.join(exportTempDir, folderName);
                categoriesSet.add(folderName);
              }

              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }

              const targetPdf = path.join(targetDir, fileName);
              fs.copyFileSync(sourcePdf, targetPdf);
              stagedCount++;
            }
          }

          const pct = Math.round(((i + 1) / filteredPapers.length) * 100);
          goldMineStateTracker.updateState({
            progress: pct,
            statusText: `Staging paper ${i + 1}/${filteredPapers.length}: ${fileName}`,
            currentItem: fileName,
            stats: {
              ...goldMineStateTracker.getState().stats,
              stagedFiles: stagedCount,
              categories: categoriesSet.size
            }
          });

          goldMineStateTracker.broadcast({
            event: 'staging_progress',
            current: i + 1,
            total: filteredPapers.length,
            file: fileName,
            stagedCount
          });
        }

        const stateAfterStaging = goldMineStateTracker.getState();
        if (stateAfterStaging.cancelRequested) {
          pipelineLock.release();
          if (fs.existsSync(exportTempDir)) {
            try { fs.rmSync(exportTempDir, { recursive: true, force: true }); } catch (e) {}
          }
          return;
        }

        // Phase 2: Uploading via rclone
        const remoteDest = `${project.rclone_remote_name}:${resolvedGoldminePath}/${exportSessionId}`;
        goldMineStateTracker.updateState({
          phase: 'uploading',
          progress: 0,
          statusText: `Uploading to cloud destination (${remoteDest})...`,
          currentItem: null
        });
        goldMineStateTracker.addLog(`[Upload]: Spawning rclone copy to ${remoteDest}...`);
        goldMineStateTracker.broadcast({ event: 'upload_start' });

        const rcloneArgs = ['copy', exportTempDir, remoteDest, '-v', '--stats', '1s', '--stats-one-line'];
        const rcloneProc = spawn('rclone', rcloneArgs);
        goldMineStateTracker.updateState({ activeChild: rcloneProc });

        const parseLine = (line: string) => {
          if (!line || !line.trim()) return;
          const trimmed = line.trim();
          goldMineStateTracker.addLog(trimmed);

          // Regex for rclone --stats-one-line output:
          // e.g. INFO  : 12.5M / 50M, 25%, 2.5 MiB/s, ETA 15s
          const pctMatch = trimmed.match(/(\d+)%\s*,/);
          const speedMatch = trimmed.match(/([\d\.]+\s*[kMG]?i?B\/s)/);
          const fileMatch = trimmed.match(/INFO\s*:\s*([^:]+\.pdf)/i);

          const updates: any = {};
          if (pctMatch) {
            updates.progress = parseInt(pctMatch[1], 10);
          }
          if (speedMatch) {
            updates.stats = {
              ...goldMineStateTracker.getState().stats,
              transferSpeed: speedMatch[1]
            };
          }
          if (fileMatch) {
            updates.currentItem = path.basename(fileMatch[1]);
            updates.statusText = `Uploading: ${path.basename(fileMatch[1])}`;
          }

          if (Object.keys(updates).length > 0) {
            goldMineStateTracker.updateState(updates);
          }

          goldMineStateTracker.broadcast({ event: 'upload_progress', log: trimmed });
        };

        rcloneProc.stdout.on('data', (data) => {
          data.toString().split('\n').forEach(parseLine);
        });

        rcloneProc.stderr.on('data', (data) => {
          data.toString().split('\n').forEach(parseLine);
        });

        rcloneProc.on('error', (err) => {
          console.error('Failed to spawn rclone process:', err);
          goldMineStateTracker.updateState({
            activeChild: null,
            isExecuting: false,
            phase: 'error',
            statusText: `Failed to spawn rclone: ${err.message}`
          });
          goldMineStateTracker.addLog(`[Error]: Failed to spawn rclone executable: ${err.message}`);
          goldMineStateTracker.broadcast({ event: 'error', isTerminal: true, message: err.message });
          pipelineLock.release();

          if (fs.existsSync(exportTempDir)) {
            try { fs.rmSync(exportTempDir, { recursive: true, force: true }); } catch (e) {}
          }
        });

        rcloneProc.on('close', (code) => {
          goldMineStateTracker.updateState({ activeChild: null });

          // Cleanup staging temp folder
          if (fs.existsSync(exportTempDir)) {
            try {
              fs.rmSync(exportTempDir, { recursive: true, force: true });
              goldMineStateTracker.addLog(`[Cleanup]: Removed local staging folder ${exportTempDir}`);
            } catch (e) {
              console.error('Failed to cleanup export staging dir:', e);
            }
          }

          pipelineLock.release();

          if (code === 0) {
            goldMineStateTracker.updateState({
              isExecuting: false,
              phase: 'complete',
              progress: 100,
              statusText: 'Cloud Gold Mine sync completed successfully!',
              currentItem: null,
              stats: {
                ...goldMineStateTracker.getState().stats,
                uploadedFiles: stagedCount
              }
            });
            goldMineStateTracker.addLog(`[Complete]: Upload finished successfully (exit code 0).`);
            goldMineStateTracker.broadcast({ event: 'complete', isTerminal: true });
          } else {
            const isCancelled = goldMineStateTracker.getState().cancelRequested;
            if (!isCancelled) {
              goldMineStateTracker.updateState({
                isExecuting: false,
                phase: 'error',
                statusText: `Rclone process exited with code ${code}`
              });
              goldMineStateTracker.addLog(`[Error]: Rclone process failed with code ${code}.`);
              goldMineStateTracker.broadcast({ event: 'error', isTerminal: true, message: `Exit code ${code}` });
            }
          }
        });

      } catch (err: any) {
        console.error('Error during Gold Mine export background process:', err);
        pipelineLock.release();
        goldMineStateTracker.updateState({
          isExecuting: false,
          phase: 'error',
          statusText: err.message || 'Failed during export'
        });
        goldMineStateTracker.broadcast({ event: 'error', isTerminal: true, message: err.message });
      }
    })();

    return goldMineStateTracker.createEventStream(request);

  } catch (error: any) {
    pipelineLock.release();
    console.error('Failed to start cloud gold mine export:', error);
    return NextResponse.json({ error: error.message || 'Failed to start export' }, { status: 500 });
  }
}
