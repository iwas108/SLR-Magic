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
        SUM(output_tokens) as output_tokens,
        MIN(CASE WHEN cost_usd > 0 THEN cost_usd ELSE NULL END) as min_cost,
        MAX(cost_usd) as max_cost,
        AVG(cost_usd) as avg_cost,
        MIN(CASE WHEN total_tokens > 0 THEN total_tokens ELSE NULL END) as min_tokens,
        MAX(total_tokens) as max_tokens,
        AVG(total_tokens) as avg_tokens
      FROM llm_audit_log
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
      GROUP BY task_type
    `).all(projectId) as any[];

    // 2. Get aggregate stats from umbrellanizer_results
    const umbrellanizerStats = db.prepare(`
      SELECT 
        'umbrellanizer' as task_type,
        SUM(cost_usd) as total_cost,
        SUM(input_tokens + output_tokens + thinking_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        MIN(CASE WHEN cost_usd > 0 THEN cost_usd ELSE NULL END) as min_cost,
        MAX(cost_usd) as max_cost,
        AVG(cost_usd) as avg_cost,
        MIN(CASE WHEN (input_tokens + output_tokens + thinking_tokens) > 0 THEN (input_tokens + output_tokens + thinking_tokens) ELSE NULL END) as min_tokens,
        MAX(input_tokens + output_tokens + thinking_tokens) as max_tokens,
        AVG(input_tokens + output_tokens + thinking_tokens) as avg_tokens
      FROM umbrellanizer_results
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
    `).get(projectId) as any;

    // 3. Overall stats across all combined calls
    const overallStats = db.prepare(`
      SELECT 
        SUM(cost_usd) as total_cost,
        SUM(total_tokens) as total_tokens,
        MIN(CASE WHEN cost_usd > 0 THEN cost_usd ELSE NULL END) as min_cost,
        MAX(cost_usd) as max_cost,
        AVG(cost_usd) as avg_cost,
        MIN(CASE WHEN total_tokens > 0 THEN total_tokens ELSE NULL END) as min_tokens,
        MAX(total_tokens) as max_tokens,
        AVG(total_tokens) as avg_tokens,
        COUNT(*) as total_calls
      FROM (
        SELECT cost_usd, total_tokens FROM llm_audit_log WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
        UNION ALL
        SELECT cost_usd, (input_tokens + output_tokens + thinking_tokens) as total_tokens FROM umbrellanizer_results WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
      )
    `).get(projectId, projectId) as any;

    // Merge breakdown by task_type
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
        const validCosts = [breakdownMap[type].min_cost, umbrellanizerStats.min_cost].filter(v => v !== undefined && v !== null && v > 0);
        breakdownMap[type].min_cost = validCosts.length > 0 ? Math.min(...validCosts) : null;
        breakdownMap[type].max_cost = Math.max(breakdownMap[type].max_cost ?? 0, umbrellanizerStats.max_cost ?? 0);
        const validTokens = [breakdownMap[type].min_tokens, umbrellanizerStats.min_tokens].filter(v => v !== undefined && v !== null && v > 0);
        breakdownMap[type].min_tokens = validTokens.length > 0 ? Math.min(...validTokens) : null;
        breakdownMap[type].max_tokens = Math.max(breakdownMap[type].max_tokens ?? 0, umbrellanizerStats.max_tokens ?? 0);
      } else {
        breakdownMap[type] = umbrellanizerStats;
      }
    }

    const pipelineBreakdown = Object.values(breakdownMap);

    // 4. Get top expensive API calls (unifying both tables up to 5000)
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
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)

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
        WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)
      )
      ORDER BY cost_usd DESC
      LIMIT 5000
    `).all(projectId, projectId);

    return NextResponse.json({
      overallStats,
      pipelineBreakdown,
      expensiveCalls
    });
  } catch (error) {
    console.error('Failed to fetch accounting insights:', error);
    return NextResponse.json({ error: 'Failed to fetch accounting insights' }, { status: 500 });
  }
}

