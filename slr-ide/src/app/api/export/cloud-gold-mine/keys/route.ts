import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const keySet = new Set<string>();

    // 1. Fetch keys from umbrellanizer_results
    const umbKeys = db.prepare(`
      SELECT DISTINCT extracted_data_key 
      FROM umbrellanizer_results 
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) 
        AND extracted_data_key IS NOT NULL 
        AND extracted_data_key != ''
    `).all(projectId) as any[];

    umbKeys.forEach((k) => {
      if (k.extracted_data_key) {
        keySet.add(String(k.extracted_data_key).trim());
      }
    });

    // 2. Fetch extracted_data payloads from papers
    const papers = db.prepare(`
      SELECT manual_extracted_data, ai_extracted_data
      FROM papers
      WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT)
        AND (manual_extracted_data IS NOT NULL OR ai_extracted_data IS NOT NULL)
    `).all(projectId) as any[];

    const ignoredKeys = new Set(['logic_trace', '_logic_trace', '_scientist_logic_trace', 'qa_scores', 'critical_misses']);

    for (const paper of papers) {
      const extStr = paper.manual_extracted_data || paper.ai_extracted_data;
      if (!extStr) continue;

      try {
        const parsed = JSON.parse(extStr);
        if (parsed && typeof parsed === 'object') {
          const extObj = (parsed.extracted_data && typeof parsed.extracted_data === 'object')
            ? parsed.extracted_data
            : (parsed.miner_data && typeof parsed.miner_data === 'object')
            ? parsed.miner_data
            : parsed;

          Object.keys(extObj).forEach((k) => {
            const cleanKey = k.trim();
            if (
              cleanKey &&
              !cleanKey.startsWith('_') &&
              !ignoredKeys.has(cleanKey) &&
              typeof extObj[cleanKey] !== 'function'
            ) {
              keySet.add(cleanKey);
            }
          });
        }
      } catch (e) {
        // ignore JSON parse errors
      }
    }

    const sortedKeys = Array.from(keySet).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ keys: sortedKeys });
  } catch (error) {
    console.error('Failed to fetch export grouping keys:', error);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
}
