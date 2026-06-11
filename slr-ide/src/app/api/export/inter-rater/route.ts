import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';
    
    // We only support pool_a / CAL_Pool_A inter-rater export currently
    if (pool !== 'pool_a' && pool !== 'CAL_Pool_A') {
      return NextResponse.json({ error: 'Inter-rater export is only implemented for Pool A' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    // Fetch papers in this project and in pool_a
    const papers = db.prepare(`
      SELECT * FROM papers 
      WHERE Project_ID = ? AND calibration_pool = 'pool_a'
    `).all(activeProjectId) as any[];

    // Blind the papers (force empty human fields, remove AI status) and shuffle
    const shuffledPapers = [...papers];
    for (let i = shuffledPapers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPapers[i], shuffledPapers[j]] = [shuffledPapers[j], shuffledPapers[i]];
    }

    const blindedPapers = shuffledPapers.map(paper => ({
      Paper_ID: paper.Paper_ID || '',
      Title: paper.Title || '',
      Year: paper.Year !== null ? String(paper.Year) : '',
      Abstract: paper.Abstract || '',
      Human_Decision: '',
      Human_EC_Trigger: '',
      Human_Rationale: ''
    }));

    let ecRules = [];
    if (project.ec_rules) {
      try {
        ecRules = typeof project.ec_rules === 'string' ? JSON.parse(project.ec_rules) : project.ec_rules;
      } catch (e) {
        console.error("Error parsing project.ec_rules in export", e);
      }
    }

    let reasoningTemplate = [];
    if (project.reasoning_template) {
      try {
        reasoningTemplate = typeof project.reasoning_template === 'string' ? JSON.parse(project.reasoning_template) : project.reasoning_template;
      } catch (e) {
        console.error("Error parsing project.reasoning_template in export", e);
      }
    }

    const payload = {
      metadata: {
        project_name: project.name || 'Unnamed Project',
        research_manifesto: project.manifesto || '',
        research_objective: project.objective || '',
        research_questions: project.questions || '',
        quality_assurance_definition: project.qa_definition || '',
        exclusion_criteria: project.exclusion_criteria || '',
        pool_type: 'CAL_Pool_A',
        export_date: new Date().toISOString(),
        ec_rules: ecRules,
        reasoning_template: reasoningTemplate
      },
      papers: blindedPapers
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${project.folder_name}_pool_a_blinded_review.slr"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to export blinded review' }, { status: 500 });
  }
}
