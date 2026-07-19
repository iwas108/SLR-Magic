import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing project_id' }, { status: 400 });
    }

    // Get papers where decision resolves to INCLUDE at stage 4 (miner/extraction)
    // Applying the Stage-Aware Decision Resolution Policy
    // Since miner is stage 4, a paper passes the miner stage if its max(manual_stage, ai_stage) = 4 AND decision resolves to INCLUDE.
    const papers = db.prepare(`
      SELECT 
        Paper_ID, Title, Abstract, Authors, Year, Local_PDF_Status, Local_PDF_Path,
        ai_stage, ai_decision, ai_extracted_data,
        manual_stage, manual_decision, manual_extracted_data
      FROM papers
      WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
        AND (
          CASE 
            WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_stage
            ELSE IFNULL(ai_stage, 0)
          END
        ) = 4
        AND (
          CASE 
            WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
            WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
            ELSE COALESCE(manual_decision, ai_decision)
          END
        ) LIKE 'INCLUDE%'
    `).all(projectId);

    // Resolve stage-aware extracted_data for each paper
    const processedPapers = papers.map((paper: any) => {
      const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
      const rawExtracted = isManualDominant ? paper.manual_extracted_data : paper.ai_extracted_data;
      
      let extractedData = {};
      let logicTrace = {};
      try {
        if (rawExtracted) {
          const parsed = JSON.parse(rawExtracted);
          extractedData = parsed.extracted_data || parsed;
          logicTrace = parsed.logic_trace || {};
        }
      } catch (err) {
        console.error(`Failed to parse extracted data for paper ${paper.Paper_ID}:`, err);
      }

      return {
        Paper_ID: paper.Paper_ID,
        Title: paper.Title,
        Authors: paper.Authors,
        Year: paper.Year,
        extracted_data: extractedData,
        logic_trace: logicTrace
      };
    });

    return NextResponse.json({ success: true, papers: processedPapers });
  } catch (error: any) {
    console.error('Failed to fetch umbrellanizer papers:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
