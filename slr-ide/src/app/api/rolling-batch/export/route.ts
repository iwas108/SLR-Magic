import { NextResponse } from 'next/server';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    // Get active batch
    const activeBatch = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE project_id = ? AND status != 'complete'
      LIMIT 1
    `).get(activeProjectId) as any;

    if (!activeBatch) {
      return NextResponse.json({ error: 'No active rolling batch found to export.' }, { status: 400 });
    }

    // Fetch papers in the active batch
    const papers = db.prepare(`
      SELECT * FROM rolling_batch_papers 
      WHERE batch_id = ?
    `).all(activeBatch.id) as any[];

    // Blind and shuffle the papers
    const shuffledPapers = [...papers];
    for (let i = shuffledPapers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPapers[i], shuffledPapers[j]] = [shuffledPapers[j], shuffledPapers[i]];
    }

    // Parse QA and Extraction rules from Pool C configuration (reused for QC_Batch)
    let qaRules: any[] = [];
    let extractionRules: any[] = [];
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
    });

    const metadata: any = {
      project_name: project.name || 'Unnamed Project',
      research_manifesto: project.manifesto || '',
      research_objective: project.objective || '',
      research_questions: project.questions || '',
      quality_assurance_definition: project.qa_definition || '',
      exclusion_criteria: project.exclusion_criteria || '',
      pool_type: 'QC_Batch',
      batch_id: activeBatch.id,
      batch_number: activeBatch.batch_number,
      export_date: new Date().toISOString(),
      qa_rules: qaRules,
      extraction_rules: extractionRules
    };

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

    const payload = {
      metadata,
      papers: blindedPapers
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${project.folder_name}_batch_${activeBatch.batch_number}_blinded_review.slr"`
      }
    });
  } catch (error: any) {
    console.error('Failed to export rolling batch:', error);
    return NextResponse.json({ error: error.message || 'Failed to export blinded review' }, { status: 500 });
  }
}
