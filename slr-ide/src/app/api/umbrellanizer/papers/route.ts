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
    // Applying the Stage-Aware Decision Resolution Policy and Joining llm_screening_records for stage 4 logic trace
    const papers = db.prepare(`
      SELECT 
        p.Paper_ID, p.Title, p.Abstract, p.Authors, p.Year, p.Local_PDF_Status, p.Local_PDF_Path,
        p.ai_stage, p.ai_decision,
        COALESCE(lsr_min.extracted_data, p.ai_extracted_data) as ai_extracted_data,
        p.manual_stage, p.manual_decision, p.manual_extracted_data,
        lsr_min.logic_trace as miner_logic_trace
      FROM papers p
      LEFT JOIN llm_screening_records lsr_min 
        ON lsr_min.paper_id = p.Paper_ID 
       AND (lsr_min.project_id = p.Project_ID OR CAST(lsr_min.project_id AS TEXT) = CAST(p.Project_ID AS TEXT))
       AND lsr_min.stage = 4
      WHERE (p.Project_ID = ? OR CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT)) AND (p.is_duplicate IS NULL OR p.is_duplicate = 0)
        AND (
          CASE 
            WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_stage
            ELSE IFNULL(p.ai_stage, 0)
          END
        ) = 4
        AND (
          CASE 
            WHEN IFNULL(p.manual_stage, 0) > IFNULL(p.ai_stage, 0) THEN p.manual_decision
            WHEN IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0) THEN p.ai_decision
            ELSE COALESCE(p.manual_decision, p.ai_decision)
          END
        ) LIKE 'INCLUDE%'
    `).all(projectId, projectId) as any[];

    // Resolve stage-aware extracted_data and logic_trace for each paper
    const processedPapers = papers.map((paper: any) => {
      const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
      const rawExtracted = isManualDominant ? (paper.manual_extracted_data || paper.ai_extracted_data) : (paper.ai_extracted_data || paper.manual_extracted_data);
      
      let extractedData: Record<string, any> = {};
      let logicTrace: Record<string, any> = {};

      try {
        if (rawExtracted) {
          const parsed = typeof rawExtracted === 'string' ? JSON.parse(rawExtracted) : rawExtracted;
          if (parsed && typeof parsed === 'object') {
            extractedData = parsed.extracted_data || parsed;
            logicTrace = parsed.logic_trace || parsed.logicTrace || {};
          }
        }
      } catch (err) {
        console.error(`Failed to parse extracted data for paper ${paper.Paper_ID}:`, err);
      }

      // Merge miner_logic_trace from llm_screening_records if available
      if (paper.miner_logic_trace) {
        try {
          const parsedLt = typeof paper.miner_logic_trace === 'string' ? JSON.parse(paper.miner_logic_trace) : paper.miner_logic_trace;
          if (parsedLt && typeof parsedLt === 'object' && Object.keys(parsedLt).length > 0) {
            logicTrace = {
              ...logicTrace,
              ...parsedLt,
              extraction_mapping: {
                ...(logicTrace.extraction_mapping || {}),
                ...(parsedLt.extraction_mapping || parsedLt)
              }
            };
          }
        } catch (err) {
          console.error(`Failed to merge miner logic trace for paper ${paper.Paper_ID}:`, err);
        }
      }

      // Ensure internal metadata keys are stripped from extractedData root
      delete extractedData.logic_trace;
      delete extractedData.logicTrace;
      delete extractedData._scientist_logic_trace;
      delete extractedData.qa_scores;

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
