import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const activeJobs = db.prepare(`
      SELECT * FROM llm_jobs 
      WHERE project_id = ? AND status IN ('RUNNING', 'PAUSED_BUDGET', 'PROCESSING_BATCH', 'STARTING')
      ORDER BY created_at DESC
    `).all(projectId);

    return NextResponse.json({ success: true, jobs: activeJobs });
  } catch (error: any) {
    console.error('Failed to fetch active jobs:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
