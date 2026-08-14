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
        (SELECT structured_output FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND (task_type = 'scientist' OR task_type LIKE '%scientist%') ORDER BY id DESC LIMIT 1) AS qa_audit_structured_output,
        (SELECT structured_output FROM llm_audit_log WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID AND (task_type = 'miner' OR task_type LIKE '%miner%' OR response_schema_name LIKE '%miner%') ORDER BY id DESC LIMIT 1) AS miner_audit_structured_output
      FROM papers 
      WHERE ${whereClause}
      ORDER BY Paper_ID ASC
      LIMIT ? OFFSET ?
    `).all(...queryParams, limit, offset) as any[];

    const processedPapers = papers.map((paper: any) => {
      let aiQA = paper.ai_quality_assessment;
      if (paper.qa_audit_structured_output) {
        try {
          const parsedQA = aiQA ? JSON.parse(aiQA) : {};
          const parsedAudit = JSON.parse(paper.qa_audit_structured_output);
          const auditLt = parsedAudit.logic_trace || parsedAudit.logicTrace;
          const qaLt = parsedQA.logic_trace || parsedQA.logicTrace;
          if (auditLt && (!qaLt || Object.keys(qaLt).length === 0)) {
            const mergedQA = {
              qa_scores: parsedQA.qa_scores || parsedQA,
              logic_trace: auditLt
            };
            aiQA = JSON.stringify(mergedQA);
          }
        } catch (e) {
          console.error('Error merging QA logic trace:', e);
        }
      }

      let aiExt = paper.ai_extracted_data;
      if (paper.miner_audit_structured_output) {
        try {
          const parsedExt = aiExt ? JSON.parse(aiExt) : {};
          const parsedAudit = JSON.parse(paper.miner_audit_structured_output);
          const auditLt = parsedAudit.logic_trace || parsedAudit.logicTrace;
          const extLt = parsedExt.logic_trace || parsedExt.logicTrace;
          if (auditLt && (!extLt || Object.keys(extLt).length === 0 || !extLt.extraction_mapping)) {
            const mergedExt = {
              extracted_data: parsedExt.extracted_data || parsedExt,
              logic_trace: {
                ...(extLt || {}),
                ...auditLt
              }
            };
            aiExt = JSON.stringify(mergedExt);
          }
        } catch (e) {
          console.error('Error merging Miner logic trace:', e);
        }
      }
      
      const { qa_audit_structured_output, miner_audit_structured_output, ...rest } = paper;
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
