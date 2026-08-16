import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const configProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    let activeProjectId = searchParams.get('projectId') || configProjectId;

    if (!id) {
      return NextResponse.json({ error: 'Paper ID is required' }, { status: 400 });
    }

    if (!activeProjectId) {
      const paperRow = db.prepare('SELECT Project_ID FROM papers WHERE Paper_ID = ?').get(id) as any;
      activeProjectId = paperRow?.Project_ID || '';
    }

    const records = db.prepare(`
      SELECT *
      FROM llm_screening_records
      WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
      ORDER BY stage ASC
    `).all(id, activeProjectId, activeProjectId);

    return NextResponse.json({
      success: true,
      records: records || []
    });
  } catch (error: any) {
    console.error('Failed to fetch paper screening records:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch paper screening records' }, { status: 500 });
  }
}
