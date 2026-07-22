import { NextResponse } from 'next/server';
import db, { setConfig } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Verify project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update active project ID
    setConfig('ACTIVE_PROJECT_ID', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to activate project' }, { status: 500 });
  }
}
