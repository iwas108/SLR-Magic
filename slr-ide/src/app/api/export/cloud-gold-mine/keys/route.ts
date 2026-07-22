import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    
    const keys = db.prepare(`
      SELECT DISTINCT extracted_data_key 
      FROM umbrellanizer_results 
      WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT) 
        AND extracted_data_key IS NOT NULL 
        AND extracted_data_key != ''
    `).all(projectId) as any[];

    return NextResponse.json({ keys: keys.map(k => k.extracted_data_key) });
  } catch (error) {
    console.error('Failed to fetch umbrellanizer keys:', error);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
}
