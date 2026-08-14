import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const logId = searchParams.get('id');
    const paperId = searchParams.get('paperId');
    const search = searchParams.get('search') || '';
    const stage = searchParams.get('stage') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    if (logId) {
      // Query single interaction log by ID with full payload fields
      const row = db.prepare(`
        SELECT l.*, p.Title as paper_title
        FROM llm_audit_log l
        LEFT JOIN papers p ON l.paper_id = p.Paper_ID AND CAST(l.project_id AS TEXT) = CAST(p.Project_ID AS TEXT)
        WHERE l.project_id = ? AND l.id = ?
      `).get(projectId, logId);

      if (!row) {
        return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        log: row
      });
    }

    if (paperId) {
      // Query the complete multi-turn interaction chain for a single paper (chronological order)
      const rows = db.prepare(`
        SELECT l.*, p.Title as paper_title
        FROM llm_audit_log l
        LEFT JOIN papers p ON l.paper_id = p.Paper_ID AND CAST(l.project_id AS TEXT) = CAST(p.Project_ID AS TEXT)
        WHERE l.project_id = ? AND l.paper_id = ?
        ORDER BY l.created_at ASC
      `).all(projectId, paperId);

      return NextResponse.json({
        success: true,
        logs: rows
      });
    }

    // Query audit logs with pagination and paper details joined (omitting heavy raw_prompt and raw_response text fields)
    let baseQuery = `
      FROM llm_audit_log l
      LEFT JOIN papers p ON l.paper_id = p.Paper_ID AND CAST(l.project_id AS TEXT) = CAST(p.Project_ID AS TEXT)
      WHERE l.project_id = ?
    `;
    const params: any[] = [projectId];

    if (stage && stage !== 'all') {
      baseQuery += ` AND l.task_type = ?`;
      params.push(stage);
    }

    if (search) {
      baseQuery += ` AND (p.Title LIKE ? OR l.paper_id LIKE ? OR l.model_id LIKE ?)`;
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard);
    }

    const query = `
      SELECT 
        l.id, l.paper_id, l.project_id, l.job_id, l.interaction_id, l.previous_interaction_id,
        l.model_id, l.task_type, l.input_tokens, l.output_tokens, l.thinking_tokens,
        l.cached_tokens, l.total_tokens, l.cost_usd, l.flex_discount, l.speed_mode,
        l.prompt_hash, l.response_schema_name, l.structured_output, l.status,
        l.error_message, l.error_code, l.latency_ms, l.retry_count, l.api_version, l.created_at,
        p.Title as paper_title
      ${baseQuery}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(query).all(...params, limit, offset);

    const totalCountRow = db.prepare(`
      SELECT COUNT(*) as count ${baseQuery}
    `).get(...params) as { count: number } | undefined;

    const total = totalCountRow ? totalCountRow.count : 0;

    return NextResponse.json({
      success: true,
      logs: rows,
      pagination: {
        total,
        limit,
        offset,
      }
    });
  } catch (error: any) {
    console.error('Failed to query LLM audit logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to query audit logs' }, { status: 500 });
  }
}
