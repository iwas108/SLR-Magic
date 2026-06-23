import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');
    const includeGlobal = searchParams.get('include_global') === 'true';

    let query = `
      SELECT 
        id, 
        project_id, 
        name, 
        description, 
        system_instruction AS system_prompt, 
        user_template AS user_prompt_template, 
        is_active, 
        created_at, 
        updated_at 
      FROM prompt_templates
    `;
    const params: any[] = [];

    if (projectId) {
      if (includeGlobal) {
        query += ' WHERE (project_id = ? OR project_id IS NULL)';
      } else {
        query += ' WHERE project_id = ?';
      }
      params.push(projectId);
    } else {
      query += ' WHERE project_id IS NULL';
    }

    query += ' ORDER BY created_at DESC';

    const prompts = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, prompts });
  } catch (error: any) {
    console.error('Failed to fetch prompts:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, project_id, name, description, system_prompt, user_prompt_template, is_active } = body;

    if (!name || !system_prompt) {
      return NextResponse.json({ error: 'Name and System Prompt are required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (id) {
      // Update
      const stmt = db.prepare(`
        UPDATE prompt_templates 
        SET name = ?, description = ?, system_instruction = ?, user_template = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(name, description, system_prompt, user_prompt_template, is_active ? 1 : 0, now, id);
    } else {
      // Insert
      const newId = crypto.randomUUID();
      const stmt = db.prepare(`
        INSERT INTO prompt_templates (id, project_id, name, description, system_instruction, user_template, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(newId, project_id || null, name, description, system_prompt, user_prompt_template, is_active ? 1 : 0, now, now);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to save prompt:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    const stmt = db.prepare('DELETE FROM prompt_templates WHERE id = ?');
    stmt.run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete prompt:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
