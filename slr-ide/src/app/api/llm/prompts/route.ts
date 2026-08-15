import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { validatePromptSchema } from '@/lib/services/prompt-validator';

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
        prompt_type,
        system_instruction AS system_prompt, 
        user_template AS user_prompt_template, 
        response_schema,
        llm_config,
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
    const { id, project_id, name, description, prompt_type, system_prompt, user_prompt_template, response_schema, llm_config, is_active } = body;

    if (!name || !system_prompt) {
      return NextResponse.json({ error: 'Name and System Prompt are required' }, { status: 400 });
    }

    if (!prompt_type) {
      return NextResponse.json({ error: 'Prompt Type / Pipeline Stage classification is required' }, { status: 400 });
    }

    const valResult = validatePromptSchema(prompt_type, response_schema);
    if (!valResult.isValid) {
      return NextResponse.json({ error: valResult.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    let effectiveId = id;
    let createdNewProjectFork = false;

    if (id) {
      // Check existing prompt row to see if it's a global template
      const existing = db.prepare('SELECT id, project_id FROM prompt_templates WHERE id = ?').get(id) as { id: string; project_id: string | null } | undefined;

      // If the template being edited is Global (project_id IS NULL) but we are saving under a specific project:
      // DO NOT overwrite the global template! Create a project-specific fork instead.
      if (existing && existing.project_id === null && project_id) {
        effectiveId = crypto.randomUUID();
        createdNewProjectFork = true;

        const stmt = db.prepare(`
          INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          effectiveId,
          project_id,
          name,
          description,
          prompt_type || null,
          system_prompt,
          user_prompt_template,
          response_schema || null,
          llm_config || '{}',
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          now,
          now
        );
      } else {
        // Direct update of the existing template (either project-specific or global if no project_id provided)
        const stmt = db.prepare(`
          UPDATE prompt_templates 
          SET name = ?, description = ?, prompt_type = ?, system_instruction = ?, user_template = ?, response_schema = ?, llm_config = ?, is_active = ?, updated_at = ?
          WHERE id = ?
        `);
        stmt.run(
          name,
          description,
          prompt_type || null,
          system_prompt,
          user_prompt_template,
          response_schema || null,
          llm_config || '{}',
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          now,
          id
        );
      }
    } else {
      // Insert new prompt template
      effectiveId = crypto.randomUUID();
      const stmt = db.prepare(`
        INSERT INTO prompt_templates (id, project_id, name, description, prompt_type, system_instruction, user_template, response_schema, llm_config, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        effectiveId,
        project_id || null,
        name,
        description,
        prompt_type || null,
        system_prompt,
        user_prompt_template,
        response_schema || null,
        llm_config || '{}',
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        now,
        now
      );
    }

    // If saving in project context and prompt_type is set, automatically update project's default_prompts
    if (project_id && prompt_type) {
      try {
        const project = db.prepare('SELECT id, llm_config FROM projects WHERE id = ?').get(project_id) as any;
        if (project) {
          let pLlmConfig: any = {};
          try {
            pLlmConfig = project.llm_config ? JSON.parse(project.llm_config) : {};
          } catch (e) {}
          if (!pLlmConfig.default_prompts) pLlmConfig.default_prompts = {};

          pLlmConfig.default_prompts[prompt_type] = effectiveId;

          db.prepare('UPDATE projects SET llm_config = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(pLlmConfig), now, project_id);
        }
      } catch (err) {
        console.error('Failed to update project default prompt reference:', err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      id: effectiveId, 
      is_forked: createdNewProjectFork,
      message: createdNewProjectFork 
        ? 'Created project-specific template copy without modifying the global default.' 
        : 'Prompt template saved successfully.' 
    });
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
