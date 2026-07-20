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
      Project_ID = ?
      AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) = 4
      AND CASE 
          WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
          WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
          ELSE COALESCE(manual_decision, ai_decision)
      END LIKE 'INCLUDE%'
    `;

    let queryParams: any[] = [projectId];
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
        Paper_ID, Title, Authors, Year, Abstract, 
        ai_quality_assessment, manual_quality_assessment,
        ai_extracted_data, manual_extracted_data,
        Local_PDF_Status, Import_Source, DOI, PDF_Link,
        Publisher, Original_Publisher, citation_count,
        ai_stage, manual_stage,
        (SELECT structured_output FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND task_type = 'scientist' ORDER BY id DESC LIMIT 1) AS qa_audit_structured_output
      FROM papers 
      WHERE ${whereClause}
      ORDER BY Paper_ID ASC
      LIMIT ? OFFSET ?
    `).all(...queryParams, limit, offset) as any[];

    const processedPapers = papers.map((paper: any) => {
      let aiQA = paper.ai_quality_assessment;
      if (aiQA && paper.qa_audit_structured_output) {
        try {
          const parsedQA = JSON.parse(aiQA);
          const parsedAudit = JSON.parse(paper.qa_audit_structured_output);
          if (parsedAudit.logic_trace && !parsedQA.logic_trace) {
            const mergedQA = {
              qa_scores: parsedQA.qa_scores || parsedQA,
              logic_trace: parsedAudit.logic_trace
            };
            aiQA = JSON.stringify(mergedQA);
          }
        } catch (e) {
          console.error('Error merging QA logic trace:', e);
        }
      }
      
      const { qa_audit_structured_output, ...rest } = paper;
      return {
        ...rest,
        ai_quality_assessment: aiQA
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
