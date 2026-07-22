import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const exportData: any = {};

    // 1. Project details (without api keys if any exist in the schema, though typically not stored here)
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    exportData.project = project;

    // 2. Papers
    exportData.papers = db.prepare('SELECT * FROM papers WHERE Project_ID = ?').all(projectId);

    // 3. LLM Audit Log
    exportData.llm_audit_log = db.prepare('SELECT * FROM llm_audit_log WHERE project_id = ?').all(projectId);

    // 4. Manual Audit Log
    exportData.manual_audit_log = db.prepare('SELECT * FROM manual_audit_log WHERE project_id = ?').all(projectId);

    // 5. Umbrellanizer Results
    exportData.umbrellanizer_results = db.prepare('SELECT * FROM umbrellanizer_results WHERE project_id = ?').all(projectId);

    // 6. Reviewer Decisions
    exportData.reviewer_decisions = db.prepare('SELECT * FROM reviewer_decisions WHERE project_id = ?').all(projectId);

    // 7. Calibration Commit Ledger
    exportData.calibration_commit_ledger = db.prepare('SELECT * FROM calibration_commit_ledger WHERE project_id = ?').all(projectId);

    // 8. Calibration Papers
    exportData.calibration_papers = db.prepare('SELECT * FROM calibration_papers WHERE Project_ID = ?').all(projectId);

    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create response with headers for file download
    const response = new NextResponse(jsonString);
    response.headers.set('Content-Type', 'application/json');
    response.headers.set('Content-Disposition', `attachment; filename="fair_export_${projectId}_${Date.now()}.slr"`);
    
    return response;
  } catch (error) {
    console.error('Failed to export FAIR data:', error);
    return NextResponse.json({ error: 'Failed to export FAIR data' }, { status: 500 });
  }
}
