import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const statusFilter = url.searchParams.get('statusFilter');
    const decisionFilter = url.searchParams.get('decisionFilter');

    const paperSelectionMode = url.searchParams.get('paperSelectionMode');
    const excludeManual = url.searchParams.get('excludeManual') === 'true';
    const taskTypeInput = url.searchParams.get('taskType');
    const stageMap: Record<string, string> = {
      'fast_filter': 'fast_filter',
      'screening': 'fast_filter',
      'gatekeeper': 'gatekeeper',
      'fulltext': 'gatekeeper',
      'scientist': 'scientist',
      'miner': 'miner',
      'extraction': 'miner',
      'umbrellanizer': 'umbrellanizer'
    };
    const taskType = stageMap[taskTypeInput || ''] || taskTypeInput;
    const paperIds = url.searchParams.get('paperIds');
    const extractedKey = url.searchParams.get('extractedKey') || url.searchParams.get('key');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (taskType === 'umbrellanizer') {
      // Calculate count of unique raw tokens for the specified extractedKey
      const rows = db.prepare(`
        SELECT ai_extracted_data, manual_extracted_data 
        FROM papers 
        WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT) AND (MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) >= 4 OR ai_extracted_data IS NOT NULL OR manual_extracted_data IS NOT NULL)
      `).all(projectId) as any[];

      const tokensSet = new Set<string>();
      if (extractedKey) {
        rows.forEach(r => {
          const raw = r.manual_extracted_data || r.ai_extracted_data;
          if (!raw) return;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed === 'object' && parsed[extractedKey]) {
              const valObj = parsed[extractedKey];
              const val = typeof valObj === 'object' && valObj !== null && 'value' in valObj ? valObj.value : valObj;
              if (Array.isArray(val)) {
                val.forEach(item => {
                  const t = String(item).trim();
                  if (t && t.toUpperCase() !== 'NOT_STATED') tokensSet.add(t);
                });
              } else if (typeof val === 'string') {
                const t = val.trim();
                if (t && t.toUpperCase() !== 'NOT_STATED') tokensSet.add(t);
              }
            }
          } catch (e) {}
        });
      }
      return NextResponse.json({ count: tokensSet.size });
    }

    if (!statusFilter) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let query = "SELECT count(*) as count FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)";
    let params: any[] = [projectId, projectId];

    const isManualSelection = paperSelectionMode === 'selected' && Boolean(paperIds);

    if (!isManualSelection) {
      if (statusFilter !== 'ALL') {
        query += " AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) = ?";
        params.push(Number(statusFilter));
      }

      if (decisionFilter && decisionFilter !== 'ALL') {
        query += " AND (CASE WHEN (CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision ELSE COALESCE(manual_decision, ai_decision) END) LIKE 'EXCLUDE%' THEN 'EXCLUDE' WHEN (CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision ELSE COALESCE(manual_decision, ai_decision) END) LIKE 'INCLUDE%' THEN 'INCLUDE' ELSE 'PENDING' END) = ?";
        params.push(decisionFilter);
      }

      if (excludeManual && taskType) {
        query += ` AND NOT EXISTS (
          SELECT 1 FROM manual_audit_log 
          WHERE manual_audit_log.paper_id = papers.Paper_ID 
            AND (manual_audit_log.project_id = papers.Project_ID OR CAST(manual_audit_log.project_id AS TEXT) = CAST(papers.Project_ID AS TEXT))
            AND manual_audit_log.manual_stage = ?
        )`;
        params.push(taskType);
      }
    }

    const requiresPdf = ['gatekeeper', 'scientist', 'miner'].includes(taskType || '');
    if (requiresPdf) {
      query += " AND Local_PDF_Path IS NOT NULL AND Local_PDF_Path != '' AND Local_PDF_Status = 'SYNCED'";
    }

    if (paperSelectionMode === 'snowballing') {
      query += " AND (Source IN ('Manual Search', 'Backward Snowball', 'Forward Snowball', 'Manual Ingestion') OR Import_Source IN ('Manual Search', 'Backward Snowball', 'Forward Snowball', 'Manual Ingestion') OR (Parent_Paper_ID IS NOT NULL AND Parent_Paper_ID != ''))";
    }

    let recommendedTaskType: string | null = null;
    let maxStage: number | null = null;

    if (paperIds) {
      const ids = paperIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        query += ` AND Paper_ID IN (${placeholders})`;
        params.push(...ids);

        try {
          const stageRow = db.prepare(`
            SELECT MAX(MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0))) as maxStage 
            FROM papers 
            WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND Paper_ID IN (${placeholders})
          `).get(projectId, projectId, ...ids) as { maxStage: number } | undefined;

          if (stageRow !== undefined && stageRow.maxStage !== null) {
            maxStage = Number(stageRow.maxStage);
            const stageMap: Record<number, string> = {
              0: 'fast_filter',
              1: 'gatekeeper',
              2: 'scientist',
              3: 'miner',
              4: 'umbrellanizer'
            };
            recommendedTaskType = stageMap[maxStage] || 'fast_filter';
          }
        } catch (e) {
          console.error('Failed to compute recommended task type for paperIds:', e);
        }
      } else {
        return NextResponse.json({ count: 0 });
      }
    }

    const result = db.prepare(query).get(...params) as { count: number };
    return NextResponse.json({ 
      count: result.count,
      ...(recommendedTaskType ? { recommendedTaskType, maxStage } : {})
    });
  } catch (error: any) {
    console.error('Failed to count papers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
