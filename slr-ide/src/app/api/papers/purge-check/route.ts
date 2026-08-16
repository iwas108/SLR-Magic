import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csvPapers } = body;

    if (!Array.isArray(csvPapers)) {
      return NextResponse.json({ error: 'Payload must contain a "csvPapers" array' }, { status: 400 });
    }

    const activeProjectId = body.projectId || getConfig('ACTIVE_PROJECT_ID', '');

    // Fetch all existing papers in the active project
    const dbPapers = db.prepare(`
      SELECT Paper_ID, Title, DOI, manual_decision, manual_exclusion_code, manual_stage, ai_stage, ai_decision, ai_exclusion_code,
             (SELECT calibration_pool FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND (cp.Project_ID = papers.Project_ID OR CAST(cp.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as calibration_pool,
             is_duplicate, merged_into_id,
             (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT))) as reviewer_decisions_count
      FROM papers
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
    `).all(activeProjectId, activeProjectId) as any[];

    // Normalize CSV papers for quick O(1) matching
    const csvDois = new Set<string>();
    const csvTitles = new Set<string>();

    for (const paper of csvPapers) {
      if (paper.DOI) {
        csvDois.add(paper.DOI.trim().toLowerCase());
      }
      if (paper.Title) {
        csvTitles.add(paper.Title.toLowerCase().replace(/\s+/g, ''));
      }
    }

    const safeToPurge: any[] = [];
    const processedWarning: any[] = [];
    const blockedInterRater: any[] = [];

    for (const dbPaper of dbPapers) {
      const doi = dbPaper.DOI?.trim().toLowerCase() || '';
      const cleanTitle = dbPaper.Title?.toLowerCase().replace(/\s+/g, '') || '';

      let matched = false;
      if (doi && csvDois.has(doi)) {
        matched = true;
      } else if (cleanTitle && csvTitles.has(cleanTitle)) {
        matched = true;
      }

      // If matched, it exists in the CSV, so do not purge it
      if (matched) {
        continue;
      }

      // Determine classification categories
      const isInterRater = !!dbPaper.calibration_pool || dbPaper.reviewer_decisions_count > 0;
      const isProcessed = (dbPaper.manual_stage !== undefined && dbPaper.manual_stage > 0) ||
                          (dbPaper.ai_stage !== undefined && dbPaper.ai_stage > 0) ||
                          (dbPaper.manual_decision && dbPaper.manual_decision.trim() !== '') ||
                          (dbPaper.manual_exclusion_code && dbPaper.manual_exclusion_code.trim() !== '') ||
                          (dbPaper.ai_decision && dbPaper.ai_decision.trim() !== '') ||
                          (dbPaper.ai_exclusion_code && dbPaper.ai_exclusion_code.trim() !== '');

      const paperData = {
        Paper_ID: dbPaper.Paper_ID,
        Title: dbPaper.Title,
        DOI: dbPaper.DOI,
        Authors: dbPaper.Authors || '',
        Year: dbPaper.Year,
        manual_decision: dbPaper.manual_decision,
        manual_exclusion_code: dbPaper.manual_exclusion_code,
        manual_stage: dbPaper.manual_stage,
        ai_decision: dbPaper.ai_decision,
        ai_exclusion_code: dbPaper.ai_exclusion_code,
        ai_stage: dbPaper.ai_stage,
        calibration_pool: dbPaper.calibration_pool,
        is_duplicate: dbPaper.is_duplicate,
        merged_into_id: dbPaper.merged_into_id
      };

      if (isInterRater) {
        blockedInterRater.push(paperData);
      } else if (isProcessed) {
        processedWarning.push(paperData);
      } else {
        safeToPurge.push(paperData);
      }
    }

    return NextResponse.json({
      success: true,
      safe: safeToPurge,
      processed: processedWarning,
      blocked: blockedInterRater
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to check purge candidates' }, { status: 500 });
  }
}
