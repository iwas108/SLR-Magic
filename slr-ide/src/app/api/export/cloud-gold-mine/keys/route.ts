import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    
    const keys = db.prepare('SELECT extracted_data_key FROM umbrellanizer_results WHERE project_id = ?').all(projectId) as any[];

    return NextResponse.json({ keys: keys.map(k => k.extracted_data_key) });
  } catch (error) {
    console.error('Failed to fetch umbrellanizer keys:', error);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
}
