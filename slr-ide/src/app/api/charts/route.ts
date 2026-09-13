import { NextRequest, NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/charts?projectId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paramProjectId = searchParams.get('projectId') || searchParams.get('project_id');
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const projectId = paramProjectId || activeProjectId;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const charts = db.prepare(`
      SELECT id, project_id, title, description, chart_type, layout_mode, config_payload, created_at, updated_at
      FROM saved_charts
      WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
      ORDER BY updated_at DESC
    `).all(projectId, projectId);

    return NextResponse.json({ success: true, charts });
  } catch (error: any) {
    console.error('Failed to fetch saved charts:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/charts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, projectId, title, description = '', chartType, layoutMode = 'single', configPayload } = body;

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const targetProjectId = projectId || activeProjectId;

    if (!targetProjectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Chart title is required' }, { status: 400 });
    }

    if (!chartType) {
      return NextResponse.json({ error: 'Chart type is required' }, { status: 400 });
    }

    if (!configPayload) {
      return NextResponse.json({ error: 'Configuration payload is required' }, { status: 400 });
    }

    const chartId = id || `chart-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const payloadStr = typeof configPayload === 'string' ? configPayload : JSON.stringify(configPayload);

    // Verify valid JSON
    try {
      JSON.parse(payloadStr);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON configuration payload' }, { status: 400 });
    }

    // Rule 3.8: Multi-Project Isolation Guardrail
    if (id) {
      const existing = db.prepare(`
        SELECT id, project_id FROM saved_charts WHERE id = ?
      `).get(id) as { id: string; project_id: string } | undefined;

      if (existing && String(existing.project_id) !== String(targetProjectId)) {
        return NextResponse.json({ error: 'Forbidden: Chart belongs to a different project' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO saved_charts (id, project_id, title, description, chart_type, layout_mode, config_payload, created_at, updated_at)
      VALUES (@id, @project_id, @title, @description, @chart_type, @layout_mode, @config_payload, @now, @now)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        chart_type = excluded.chart_type,
        layout_mode = excluded.layout_mode,
        config_payload = excluded.config_payload,
        updated_at = excluded.updated_at
    `).run({
      id: chartId,
      project_id: targetProjectId,
      title: title.trim(),
      description: description ? description.trim() : '',
      chart_type: chartType,
      layout_mode: layoutMode,
      config_payload: payloadStr,
      now
    });

    const savedChart = db.prepare(`
      SELECT id, project_id, title, description, chart_type, layout_mode, config_payload, created_at, updated_at
      FROM saved_charts
      WHERE id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
    `).get(chartId, targetProjectId, targetProjectId);

    return NextResponse.json({ success: true, chart: savedChart });
  } catch (error: any) {
    console.error('Failed to save chart:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/charts?id=...&projectId=...
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const paramProjectId = searchParams.get('projectId') || searchParams.get('project_id');
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const projectId = paramProjectId || activeProjectId;

    if (!id) {
      return NextResponse.json({ error: 'Chart ID is required' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const result = db.prepare(`
      DELETE FROM saved_charts
      WHERE id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
    `).run(id, projectId, projectId);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Chart not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete saved chart:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
