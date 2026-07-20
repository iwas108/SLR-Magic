import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // 1. Get aggregate stats from llm_audit_log
    const auditStats = db.prepare(`
      SELECT 
        task_type,
        SUM(cost_usd) as total_cost,
        SUM(total_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens
      FROM llm_audit_log
      WHERE project_id = ?
      GROUP BY task_type
    `).all(projectId) as any[];

    // 2. Get aggregate stats from umbrellanizer_results
    const umbrellanizerStats = db.prepare(`
      SELECT 
        'umbrellanizer' as task_type,
        SUM(cost_usd) as total_cost,
        SUM(input_tokens + output_tokens + thinking_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens
      FROM umbrellanizer_results
      WHERE project_id = ?
    `).get(projectId) as any;

    // Merge breakdown by task_type to avoid duplicate cards (e.g. umbrellanizer in both tables)
    const breakdownMap: Record<string, any> = {};
    for (const stat of auditStats) {
      breakdownMap[stat.task_type] = { ...stat };
    }

    if (umbrellanizerStats && umbrellanizerStats.total_cost > 0) {
      const type = umbrellanizerStats.task_type;
      if (breakdownMap[type]) {
        breakdownMap[type].total_cost += umbrellanizerStats.total_cost;
        breakdownMap[type].total_tokens += umbrellanizerStats.total_tokens;
        breakdownMap[type].input_tokens += umbrellanizerStats.input_tokens;
        breakdownMap[type].output_tokens += umbrellanizerStats.output_tokens;
      } else {
        breakdownMap[type] = umbrellanizerStats;
      }
    }

    const pipelineBreakdown = Object.values(breakdownMap);

    // 3. Get top expensive API calls (unifying both tables)
    const expensiveCalls = db.prepare(`
      SELECT * FROM (
        SELECT 
          id,
          'llm_audit_log' as source,
          task_type,
          model_id,
          cost_usd,
          total_tokens,
          created_at
        FROM llm_audit_log
        WHERE project_id = ?

        UNION ALL

        SELECT 
          id,
          'umbrellanizer_results' as source,
          'umbrellanizer' as task_type,
          model_id,
          cost_usd,
          (input_tokens + output_tokens + thinking_tokens) as total_tokens,
          created_at
        FROM umbrellanizer_results
        WHERE project_id = ?
      )
      ORDER BY cost_usd DESC
      LIMIT 50
    `).all(projectId, projectId);

    return NextResponse.json({
      pipelineBreakdown,
      expensiveCalls
    });
  } catch (error) {
    console.error('Failed to fetch accounting insights:', error);
    return NextResponse.json({ error: 'Failed to fetch accounting insights' }, { status: 500 });
  }
}
