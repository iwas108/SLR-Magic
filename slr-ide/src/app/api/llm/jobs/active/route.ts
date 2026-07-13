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
      WHERE project_id = ? AND status IN ('RUNNING', 'PAUSED_BUDGET', 'PAUSED_USER', 'PROCESSING_BATCH', 'STARTING')
      ORDER BY created_at DESC
    `).all(projectId);

    // Attach inclusion/exclusion metrics from audit log
    for (const job of activeJobs as any[]) {
      try {
        const stats = db.prepare(`
          SELECT json_extract(structured_output, '$.decision') as decision,
                 json_extract(structured_output, '$.exclusion_trigger') as ec_trigger,
                 COUNT(*) as count
          FROM llm_audit_log
          WHERE job_id = ? AND status = 'SUCCESS'
          GROUP BY decision, ec_trigger
        `).all(job.id);
        
        let included = 0;
        let excluded = 0;
        let exclusion_reasons: Record<string, number> = {};
        
        for (const row of stats as any[]) {
          const decision = (row.decision || '').toUpperCase();
          const count = row.count;
          if (decision === 'INCLUDE') {
            included += count;
          } else {
            excluded += count;
            if (row.ec_trigger) {
              exclusion_reasons[row.ec_trigger] = (exclusion_reasons[row.ec_trigger] || 0) + count;
            }
          }
        }
        
        job.included_papers = included;
        job.excluded_papers = excluded;
        job.exclusion_reasons = exclusion_reasons;
      } catch (err) {
        console.error(`Failed to fetch stats for job ${job.id}:`, err);
        job.included_papers = 0;
        job.excluded_papers = 0;
        job.exclusion_reasons = {};
      }
    }

    return NextResponse.json({ success: true, jobs: activeJobs });
  } catch (error: any) {
    console.error('Failed to fetch active jobs:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
