import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const statusFilter = url.searchParams.get('statusFilter');
    const decisionFilter = url.searchParams.get('decisionFilter');

    const excludeManual = url.searchParams.get('excludeManual') === 'true';
    const taskTypeInput = url.searchParams.get('taskType');
    const stageMap: Record<string, string> = {
      'fast_filter': 'fast_filter',
      'screening': 'fast_filter',
      'gatekeeper': 'gatekeeper',
      'fulltext': 'gatekeeper',
      'scientist': 'scientist',
      'miner': 'miner',
      'extraction': 'miner'
    };
    const taskType = stageMap[taskTypeInput || ''] || taskTypeInput;
    const paperIds = url.searchParams.get('paperIds');

    if (!projectId || !statusFilter) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let query = "SELECT count(*) as count FROM papers WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)";
    let params: any[] = [projectId];

    if (statusFilter !== 'ALL') {
      query += " AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) = ?";
      params.push(Number(statusFilter));
    }

    if (decisionFilter && decisionFilter !== 'ALL') {
      query += " AND (CASE WHEN (CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision ELSE COALESCE(manual_decision, ai_decision) END) LIKE 'EXCLUDE%' THEN 'EXCLUDE' ELSE IFNULL((CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision ELSE COALESCE(manual_decision, ai_decision) END), 'PENDING') END) = ?";
      params.push(decisionFilter);
    }

    if (excludeManual && taskType) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM manual_audit_log 
        WHERE manual_audit_log.paper_id = papers.Paper_ID 
          AND manual_audit_log.manual_stage = ?
      )`;
      params.push(taskType);
    }

    const requiresPdf = ['gatekeeper', 'scientist', 'miner'].includes(taskType || '');
    if (requiresPdf) {
      query += " AND Local_PDF_Path IS NOT NULL AND Local_PDF_Path != '' AND Local_PDF_Status = 'SYNCED'";
    }

    if (paperIds) {
      const ids = paperIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        query += ` AND Paper_ID IN (${placeholders})`;
        params.push(...ids);
      } else {
        return NextResponse.json({ count: 0 });
      }
    }

    const result = db.prepare(query).get(...params) as { count: number };
    return NextResponse.json({ count: result.count });
  } catch (error: any) {
    console.error('Failed to count papers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
