import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const paperId = searchParams.get('paperId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    if (paperId) {
      // Query the complete multi-turn interaction chain for a single paper (chronological order)
      const rows = db.prepare(`
        SELECT l.*, p.Title as paper_title
        FROM llm_audit_log l
        LEFT JOIN papers p ON l.paper_id = p.Paper_ID
        WHERE l.project_id = ? AND l.paper_id = ?
        ORDER BY l.created_at ASC
      `).all(projectId, paperId);

      return NextResponse.json({
        success: true,
        logs: rows
      });
    }

    // Query audit logs with pagination and paper details joined
    const rows = db.prepare(`
      SELECT l.*, p.Title as paper_title
      FROM llm_audit_log l
      LEFT JOIN papers p ON l.paper_id = p.Paper_ID
      WHERE l.project_id = ?
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).all(projectId, limit, offset);

    const totalCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM llm_audit_log WHERE project_id = ?
    `).get(projectId) as { count: number } | undefined;

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
