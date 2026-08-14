import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paramProjectId = searchParams.get('projectId');
  const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
  const targetProjectId = paramProjectId || activeProjectId;

  try {
    let project = db.prepare('SELECT * FROM projects WHERE id = ?').get(targetProjectId) as any;
    if (!project) {
      const numericProjectId = parseInt(targetProjectId, 10);
      if (!isNaN(numericProjectId)) {
        project = db.prepare('SELECT * FROM projects WHERE id = ?').get(numericProjectId) as any;
      }
    }
    if (!project) {
      project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const resolvedProjectId = project.id;
    const exportData: any = {
      metadata: {
        project_id: resolvedProjectId,
        project_name: project.name || 'Unnamed Project',
        export_date: new Date().toISOString()
      }
    };

    // 1. Project details
    exportData.project = project;

    // 2. Papers
    exportData.papers = db.prepare('SELECT * FROM papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId);

    // 3. LLM Audit Log
    exportData.llm_audit_log = db.prepare('SELECT * FROM llm_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId);

    // 4. Manual Audit Log
    exportData.manual_audit_log = db.prepare('SELECT * FROM manual_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId);

    // 5. Umbrellanizer Results
    exportData.umbrellanizer_results = db.prepare('SELECT * FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId);

    // 6. Reviewer Decisions
    exportData.reviewer_decisions = db.prepare('SELECT * FROM reviewer_decisions WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId);

    // 7. Calibration Commit Ledger
    exportData.calibration_commit_ledger = db.prepare('SELECT * FROM calibration_commit_ledger WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId);

    // 8. Calibration Papers
    exportData.calibration_papers = db.prepare('SELECT * FROM calibration_papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)').all(resolvedProjectId);

    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create response with headers for file download
    const response = new NextResponse(jsonString);
    response.headers.set('Content-Type', 'application/json');
    response.headers.set('Content-Disposition', `attachment; filename="fair_export_${resolvedProjectId}_${Date.now()}.slr"`);
    
    return response;
  } catch (error) {
    console.error('Failed to export FAIR data:', error);
    return NextResponse.json({ error: 'Failed to export FAIR data' }, { status: 500 });
  }
}
