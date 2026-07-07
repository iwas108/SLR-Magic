import { NextResponse } from 'next/server';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = searchParams.get('pool') || 'pool_a';
    
    if (
      pool !== 'pool_a' && pool !== 'CAL_Pool_A' && 
      pool !== 'pool_b' && pool !== 'CAL_Pool_B' &&
      pool !== 'pool_c' && pool !== 'CAL_Pool_C'
    ) {
      return NextResponse.json({ error: 'Inter-rater export is only implemented for Pool A, Pool B, and Pool C' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    const dbPool = (pool === 'pool_b' || pool === 'CAL_Pool_B') 
      ? 'pool_b' 
      : (pool === 'pool_c' || pool === 'CAL_Pool_C') 
      ? 'pool_c' 
      : 'pool_a';

    // Fetch papers in this project and in the selected pool
    const papers = db.prepare(`
      SELECT * FROM papers 
      WHERE Project_ID = ? AND calibration_pool = ?
    `).all(activeProjectId, dbPool) as any[];

    // Blind the papers (force empty human fields, remove AI status) and shuffle
    const shuffledPapers = [...papers];
    for (let i = shuffledPapers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPapers[i], shuffledPapers[j]] = [shuffledPapers[j], shuffledPapers[i]];
    }

    // Fetch rules for Pool C
    let qaRules = [];
    let extractionRules = [];
    if (dbPool === 'pool_c') {
      if (project.pool_c_qa_rules) {
        try {
          qaRules = typeof project.pool_c_qa_rules === 'string' 
            ? JSON.parse(project.pool_c_qa_rules) 
            : project.pool_c_qa_rules;
        } catch (e) {
          console.error("Error parsing pool_c_qa_rules", e);
        }
      }
      if (project.pool_c_extraction_rules) {
        try {
          extractionRules = typeof project.pool_c_extraction_rules === 'string' 
            ? JSON.parse(project.pool_c_extraction_rules) 
            : project.pool_c_extraction_rules;
        } catch (e) {
          console.error("Error parsing pool_c_extraction_rules", e);
        }
      }
    }

    const blindedPapers = shuffledPapers.map(paper => {
      let pdfBase64 = null;
      if (paper.Local_PDF_Path) {
        const fullPath = path.join(PROJECT_ROOT, paper.Local_PDF_Path);
        if (fs.existsSync(fullPath)) {
          try {
            pdfBase64 = fs.readFileSync(fullPath).toString('base64');
          } catch (err) {
            console.error(`Failed to read PDF for paper ${paper.Paper_ID}:`, err);
          }
        }
      }

      const base = {
        Paper_ID: paper.Paper_ID || '',
        Title: paper.Title || '',
        Year: paper.Year !== null ? String(paper.Year) : '',
        Authors: paper.Authors || '',
        Abstract: paper.Abstract || '',
        DOI: paper.DOI || '',
        Publisher: paper.Publisher || '',
        PDF_Link: paper.PDF_Link || '',
        Local_PDF_Status: paper.Local_PDF_Status || 'IGNORED',
        PDF_Base64: pdfBase64
      };

      if (dbPool === 'pool_c') {
        const qaScores: Record<string, { value: number | null, evidence: string }> = {};
        if (Array.isArray(qaRules)) {
          qaRules.forEach(rule => {
            qaScores[rule.code] = { value: null, evidence: '' };
          });
        }

        const extractedData: Record<string, { value: string, evidence: string }> = {};
        if (Array.isArray(extractionRules)) {
          extractionRules.forEach(rule => {
            extractedData[rule.json_key] = { value: '', evidence: '' };
          });
        }

        return {
          ...base,
          Human_QA_Scores: qaScores,
          Human_Extracted_Data: extractedData
        };
      } else {
        return {
          ...base,
          Human_Decision: '',
          Human_EC_Trigger: '',
          Human_Rationale: ''
        };
      }
    });

    const metadata: any = {
      project_name: project.name || 'Unnamed Project',
      research_manifesto: project.manifesto || '',
      research_objective: project.objective || '',
      research_questions: project.questions || '',
      quality_assurance_definition: project.qa_definition || '',
      exclusion_criteria: project.exclusion_criteria || '',
      pool_type: dbPool === 'pool_b' ? 'CAL_Pool_B' : dbPool === 'pool_c' ? 'CAL_Pool_C' : 'CAL_Pool_A',
      export_date: new Date().toISOString()
    };

    if (dbPool === 'pool_c') {
      metadata.qa_rules = qaRules;
      metadata.extraction_rules = extractionRules;
      let reasoningTemplate = [];
      const reasoningField = project.pool_c_reasoning_template || project.reasoning_template;
      if (reasoningField) {
        try {
          reasoningTemplate = typeof reasoningField === 'string' ? JSON.parse(reasoningField) : reasoningField;
        } catch (e) {
          console.error("Error parsing reasoning_template in export", e);
        }
      }
      metadata.reasoning_template = reasoningTemplate;
    } else {
      let ecRules = [];
      const ecRulesField = dbPool === 'pool_b' ? project.pool_b_ec_rules : project.ec_rules;
      if (ecRulesField) {
        try {
          ecRules = typeof ecRulesField === 'string' ? JSON.parse(ecRulesField) : ecRulesField;
        } catch (e) {
          console.error("Error parsing ec_rules in export", e);
        }
      }
      metadata.ec_rules = ecRules;

      let reasoningTemplate = [];
      const reasoningField = dbPool === 'pool_b' ? project.pool_b_reasoning_template : project.reasoning_template;
      if (reasoningField) {
        try {
          reasoningTemplate = typeof reasoningField === 'string' ? JSON.parse(reasoningField) : reasoningField;
        } catch (e) {
          console.error("Error parsing reasoning_template in export", e);
        }
      }
      metadata.reasoning_template = reasoningTemplate;
    }

    const payload = {
      metadata,
      papers: blindedPapers
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${project.folder_name}_${dbPool}_blinded_review.slr"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to export blinded review' }, { status: 500 });
  }
}
