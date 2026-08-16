import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const search = searchParams.get('search') || '';

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    
    // Stage dominance rule for final cohort (Stage 4, INCLUDE)
    const baseWhere = `
      (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
      AND (is_duplicate IS NULL OR is_duplicate = 0)
      AND (MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) >= 4 OR ai_extracted_data IS NOT NULL OR manual_extracted_data IS NOT NULL)
      AND (
        CASE 
            WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
            WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
            ELSE COALESCE(manual_decision, ai_decision)
        END
      ) LIKE 'INCLUDE%'
    `;

    let queryParams: any[] = [projectId, projectId];
    let whereClause = baseWhere;

    if (search) {
      whereClause += ` AND (
        Paper_ID LIKE ? OR 
        Title LIKE ? OR 
        Authors LIKE ? OR 
        Abstract LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM papers WHERE ${whereClause}`).get(...queryParams) as any;
    const total = countResult.total;

    const offset = (page - 1) * limit;
    
    const papers = db.prepare(`
      SELECT 
        p.Paper_ID, p.Title, p.Authors, p.Year, p.Abstract, 
        COALESCE(lsr_sci.quality_assessment, p.ai_quality_assessment) as ai_quality_assessment,
        p.manual_quality_assessment,
        COALESCE(lsr_min.extracted_data, p.ai_extracted_data) as ai_extracted_data,
        p.manual_extracted_data,
        p.Local_PDF_Status, p.Import_Source, p.DOI, p.PDF_Link,
        p.Publisher, p.Original_Publisher, p.citation_count,
        p.ai_stage, p.manual_stage,
        lsr_sci.logic_trace as scientist_logic_trace,
        lsr_min.logic_trace as miner_logic_trace
      FROM papers p
      LEFT JOIN llm_screening_records lsr_sci 
        ON lsr_sci.paper_id = p.Paper_ID 
       AND (lsr_sci.project_id = p.Project_ID OR CAST(lsr_sci.project_id AS TEXT) = CAST(p.Project_ID AS TEXT))
       AND lsr_sci.stage = 3
      LEFT JOIN llm_screening_records lsr_min 
        ON lsr_min.paper_id = p.Paper_ID 
       AND (lsr_min.project_id = p.Project_ID OR CAST(lsr_min.project_id AS TEXT) = CAST(p.Project_ID AS TEXT))
       AND lsr_min.stage = 4
      WHERE ${whereClause.replace(/Project_ID/g, 'p.Project_ID').replace(/is_duplicate/g, 'p.is_duplicate').replace(/manual_stage/g, 'p.manual_stage').replace(/ai_stage/g, 'p.ai_stage').replace(/manual_decision/g, 'p.manual_decision').replace(/ai_decision/g, 'p.ai_decision').replace(/ai_extracted_data/g, 'p.ai_extracted_data').replace(/manual_extracted_data/g, 'p.manual_extracted_data')}
      ORDER BY p.Paper_ID ASC
      LIMIT ? OFFSET ?
    `).all(...queryParams, limit, offset) as any[];

    const processedPapers = papers.map((paper: any) => {
      let aiQA = paper.ai_quality_assessment;
      if (paper.scientist_logic_trace) {
        try {
          const parsedQA = aiQA ? (typeof aiQA === 'string' ? JSON.parse(aiQA) : aiQA) : {};
          const parsedLt = typeof paper.scientist_logic_trace === 'string' ? JSON.parse(paper.scientist_logic_trace) : paper.scientist_logic_trace;
          if (parsedLt && Object.keys(parsedLt).length > 0) {
            const mergedQA = {
              qa_scores: parsedQA.qa_scores || parsedQA,
              logic_trace: parsedLt
            };
            aiQA = JSON.stringify(mergedQA);
          }
        } catch (e) {
          console.error('Error merging QA logic trace:', e);
        }
      }

      let aiExt = paper.ai_extracted_data;
      if (paper.miner_logic_trace) {
        try {
          const parsedExt = aiExt ? (typeof aiExt === 'string' ? JSON.parse(aiExt) : aiExt) : {};
          const parsedLt = typeof paper.miner_logic_trace === 'string' ? JSON.parse(paper.miner_logic_trace) : paper.miner_logic_trace;
          if (parsedLt && Object.keys(parsedLt).length > 0) {
            const extLt = parsedExt.logic_trace || parsedExt.logicTrace || {};
            const mergedExt = {
              extracted_data: parsedExt.extracted_data || parsedExt,
              logic_trace: {
                ...extLt,
                ...parsedLt,
                extraction_mapping: {
                  ...(extLt.extraction_mapping || {}),
                  ...(parsedLt.extraction_mapping || parsedLt)
                }
              }
            };
            aiExt = JSON.stringify(mergedExt);
          }
        } catch (e) {
          console.error('Error merging Miner logic trace:', e);
        }
      }
      
      const { scientist_logic_trace, miner_logic_trace, ...rest } = paper;
      return {
        ...rest,
        ai_quality_assessment: aiQA,
        ai_extracted_data: aiExt
      };
    });

    return NextResponse.json({
      papers: processedPapers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Failed to fetch final cohort:', error);
    return NextResponse.json({ error: 'Failed to fetch final cohort' }, { status: 500 });
  }
}
