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

        if (job.task_type === 'miner') {
          const logs = db.prepare(`
            SELECT structured_output 
            FROM llm_audit_log 
            WHERE job_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          `).all(job.id) as { structured_output: string }[];

          const notStatedCounts: Record<string, number> = {};
          const isNotStated = (val: any): boolean => {
            if (typeof val === 'string') {
              return val.trim().toUpperCase() === 'NOT_STATED';
            }
            if (Array.isArray(val)) {
              return val.some(item => typeof item === 'string' && item.trim().toUpperCase() === 'NOT_STATED');
            }
            return false;
          };

          for (const row of logs) {
            try {
              const parsed = JSON.parse(row.structured_output);
              const extDataObj = parsed.extracted_data || parsed;
              if (extDataObj && typeof extDataObj === 'object') {
                for (const [key, fieldObj] of Object.entries(extDataObj)) {
                  if (fieldObj && typeof fieldObj === 'object') {
                    const val = (fieldObj as any).value;
                    if (isNotStated(val)) {
                      notStatedCounts[key] = (notStatedCounts[key] || 0) + 1;
                    }
                  } else {
                    if (isNotStated(fieldObj)) {
                      notStatedCounts[key] = (notStatedCounts[key] || 0) + 1;
                    }
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          }
          job.included_papers = 0;
          job.excluded_papers = 0;
          job.exclusion_reasons = {};
          job.not_stated_metrics = notStatedCounts;
        } else {
          const logs = db.prepare(`
            SELECT structured_output
            FROM llm_audit_log
            WHERE job_id = ? AND status = 'SUCCESS' AND json_valid(structured_output) = 1
          `).all(job.id) as { structured_output: string }[];
          
          let included = 0;
          let excluded = 0;
          let exclusion_reasons: Record<string, number> = {};

          const _EC_ALIASES = [
            'exclusion_trigger', 'exclusion_code', 'primary_exclusion_criterion',
            'ec_trigger', 'ec_code', 'exclusion_criterion'
          ];
          const _SUBOBJ_KEYS = ['final_evaluation', 'evaluation', 'result', 'output', 'verdict'];
          
          for (const row of logs) {
            try {
              const parsed = JSON.parse(row.structured_output);
              let decision: string | undefined = undefined;
              let ec_trigger: string | undefined = undefined;
              const finalEval = parsed?.final_evaluation;
              if (finalEval && typeof finalEval === 'object') {
                if (finalEval.decision && typeof finalEval.decision === 'string' && (finalEval.decision.toUpperCase().startsWith('INCLUDE') || finalEval.decision.toUpperCase().startsWith('EXCLUDE'))) {
                  decision = finalEval.decision;
                }
                ec_trigger = finalEval.exclusion_code || finalEval.exclusion_trigger;
              }

              if (decision && typeof decision !== 'string') {
                decision = String(decision);
              }
              if (decision && !(decision.toUpperCase().startsWith('INCLUDE') || decision.toUpperCase().startsWith('EXCLUDE'))) {
                decision = undefined;
              }

              if (!decision) {
                const decCandidate = parsed.decision;
                if (decCandidate && typeof decCandidate === 'string' && (decCandidate.toUpperCase().startsWith('INCLUDE') || decCandidate.toUpperCase().startsWith('EXCLUDE'))) {
                  decision = decCandidate;
                }
              }
              if (!ec_trigger) {
                for (const alias of _EC_ALIASES) {
                  if (parsed[alias]) {
                    ec_trigger = parsed[alias];
                    break;
                  }
                }
              }

              if (!decision || !ec_trigger) {
                const candidates = [
                  ..._SUBOBJ_KEYS.map(k => parsed[k]).filter(v => v && typeof v === 'object'),
                  ...Object.entries(parsed).filter(([k, v]) => v && typeof v === 'object' && !_SUBOBJ_KEYS.includes(k)).map(([, v]) => v)
                ];
                for (const sub of candidates) {
                  if (!decision) {
                    const subDec = sub.decision;
                    if (subDec && typeof subDec === 'string' && (subDec.toUpperCase().startsWith('INCLUDE') || subDec.toUpperCase().startsWith('EXCLUDE'))) {
                      decision = subDec;
                    }
                  }
                  if (!ec_trigger) {
                    for (const alias of _EC_ALIASES) {
                      if (sub[alias]) {
                        ec_trigger = sub[alias];
                        break;
                      }
                    }
                  }
                  if (decision && ec_trigger) break;
                }
              }

              const decisionStr = String(decision || 'EXCLUDE').toUpperCase();
              if (decisionStr.startsWith('INCLUDE')) {
                included += 1;
              } else {
                excluded += 1;
                if (ec_trigger) {
                  exclusion_reasons[ec_trigger] = (exclusion_reasons[ec_trigger] || 0) + 1;
                }
              }
            } catch (e) {
              excluded += 1;
            }
          }
          
          job.included_papers = included;
          job.excluded_papers = excluded;
          job.exclusion_reasons = exclusion_reasons;
          job.not_stated_metrics = {};
        }
      } catch (err) {
        console.error(`Failed to fetch stats for job ${job.id}:`, err);
        job.included_papers = 0;
        job.excluded_papers = 0;
        job.exclusion_reasons = {};
        job.not_stated_metrics = {};
      }
    }

    return NextResponse.json({ success: true, jobs: activeJobs });
  } catch (error: any) {
    console.error('Failed to fetch active jobs:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
