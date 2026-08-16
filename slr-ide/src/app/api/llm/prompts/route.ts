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
        query += ' WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT) OR project_id IS NULL)';
        params.push(projectId, projectId);
      } else {
        query += ' WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))';
        params.push(projectId, projectId);
      }
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

    // If saving in project context and prompt_type is set:
    // Update default_prompts if explicitly requested (set_as_default: true) or if no default prompt was assigned yet
    const setAsDefault = body.set_as_default;
    if (project_id && prompt_type) {
      try {
        const project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(project_id, project_id) as any;
        if (project) {
          let pLlmConfig: any = {};
          try {
            pLlmConfig = project.llm_config ? JSON.parse(project.llm_config) : {};
          } catch (e) {}
          if (!pLlmConfig.default_prompts) pLlmConfig.default_prompts = {};

          const shouldSetDefault = setAsDefault === true || (setAsDefault === undefined && !pLlmConfig.default_prompts[prompt_type]);
          if (shouldSetDefault) {
            pLlmConfig.default_prompts[prompt_type] = effectiveId;

            db.prepare('UPDATE projects SET llm_config = ? WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))')
              .run(JSON.stringify(pLlmConfig), project_id, project_id);
          }
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

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { action, project_id, prompt_type, prompt_id } = body;

    if (action === 'set_default') {
      if (!project_id || !prompt_type || !prompt_id) {
        return NextResponse.json({ error: 'project_id, prompt_type, and prompt_id are required' }, { status: 400 });
      }

      const project = db.prepare('SELECT id, llm_config FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))').get(project_id, project_id) as any;
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      let pLlmConfig: any = {};
      try {
        pLlmConfig = project.llm_config ? JSON.parse(project.llm_config) : {};
      } catch (e) {}
      if (!pLlmConfig.default_prompts) pLlmConfig.default_prompts = {};

      pLlmConfig.default_prompts[prompt_type] = prompt_id;

      db.prepare('UPDATE projects SET llm_config = ? WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))')
        .run(JSON.stringify(pLlmConfig), project_id, project_id);

      return NextResponse.json({
        success: true,
        default_prompts: pLlmConfig.default_prompts,
        message: 'Default prompt updated successfully'
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    console.error('Failed to patch prompt settings:', error);
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

    const existing = db.prepare('SELECT id, project_id FROM prompt_templates WHERE id = ?').get(id) as { id: string; project_id: string | null } | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Prompt template not found' }, { status: 404 });
    }

    // Protect global templates from deletion
    if (existing.project_id === null) {
      return NextResponse.json({ error: 'Global baseline templates cannot be deleted.' }, { status: 403 });
    }

    const stmt = db.prepare('DELETE FROM prompt_templates WHERE id = ?');
    stmt.run(id);

    // Clean up any project default_prompts pointing to this deleted template ID
    const projectsWithRef = db.prepare("SELECT id, llm_config FROM projects WHERE llm_config LIKE ?").all(`%${id}%`) as any[];
    for (const proj of projectsWithRef) {
      try {
        const pCfg = proj.llm_config ? JSON.parse(proj.llm_config) : {};
        if (pCfg.default_prompts) {
          let modified = false;
          for (const [stage, tplId] of Object.entries(pCfg.default_prompts)) {
            if (tplId === id) {
              delete pCfg.default_prompts[stage];
              modified = true;
            }
          }
          if (modified) {
            db.prepare("UPDATE projects SET llm_config = ? WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))")
              .run(JSON.stringify(pCfg), proj.id, proj.id);
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true, message: 'Template deleted and project references cleaned up' });
  } catch (error: any) {
    console.error('Failed to delete prompt:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

