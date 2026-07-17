import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    // Support getStats parameter for project-wide statistics
    const getStats = searchParams.get('getStats') === 'true';
    if (getStats) {
      // 1. Total papers in project (excluding duplicates)
      const totalRow = db.prepare(`
        SELECT COUNT(*) as count 
        FROM papers 
        WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
      `).get(activeProjectId) as { count: number };
      const total = totalRow ? totalRow.count : 0;

      // 2. Screened papers (decision is set)
      const screenedRow = db.prepare(`
        SELECT COUNT(*) as count 
        FROM papers 
        WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
          AND manual_decision IS NOT NULL AND manual_decision != ''
      `).get(activeProjectId) as { count: number };
      const screened = screenedRow ? screenedRow.count : 0;

      // 3. Stage counts grouping
      const stages = db.prepare(`
        SELECT manual_stage, COUNT(*) as count 
        FROM papers 
        WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
        GROUP BY manual_stage
      `).all(activeProjectId) as { manual_stage: string; count: number }[];
      
      const stageCounts: Record<string, number> = {};
      stages.forEach(s => {
        const key = s.manual_stage || 'none';
        stageCounts[key] = s.count;
      });

      // 4. Decision counts grouping
      const decisions = db.prepare(`
        SELECT manual_decision, COUNT(*) as count 
        FROM papers 
        WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
        GROUP BY manual_decision
      `).all(activeProjectId) as { manual_decision: string; count: number }[];

      const decisionCounts: Record<string, number> = {};
      decisions.forEach(d => {
        const key = d.manual_decision || 'none';
        decisionCounts[key] = d.count;
      });

      return NextResponse.json({
        total,
        screened,
        pending: total - screened,
        stageCounts,
        decisionCounts
      });
    }

    const search = searchParams.get('search')?.trim() || '';
    const manualStage = searchParams.get('manualStage')?.trim() || '';
    const manualDecision = searchParams.get('manualDecision')?.trim() || '';
    
    // Sort parameters
    const sortBy = searchParams.get('sortBy')?.trim() || 'Paper_ID';
    const sortOrder = searchParams.get('sortOrder')?.trim() || 'ASC';
    
    // Pagination parameters
    const pageVal = parseInt(searchParams.get('page') || '1', 10);
    const page = !isNaN(pageVal) && pageVal > 0 ? pageVal : 1;
    
    const limitVal = parseInt(searchParams.get('limit') || '50', 10);
    const limit = !isNaN(limitVal) && limitVal > 0 ? limitVal : 50;

    let filterQuery = ' FROM papers WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)';
    const params: any[] = [activeProjectId];

    if (search) {
      filterQuery += ' AND (Paper_ID LIKE ? OR Title LIKE ? OR Abstract LIKE ? OR Authors LIKE ? OR DOI LIKE ? OR Publisher LIKE ?)';
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    if (manualStage) {
      if (manualStage === 'none') {
        filterQuery += ' AND (manual_stage IS NULL OR manual_stage = \'\')';
      } else {
        filterQuery += ' AND manual_stage = ?';
        params.push(manualStage);
      }
    }

    if (manualDecision) {
      if (manualDecision === 'none') {
        filterQuery += ' AND (manual_decision IS NULL OR manual_decision = \'\')';
      } else {
        filterQuery += ' AND manual_decision = ?';
        params.push(manualDecision);
      }
    }

    // 1. Get total matching count
    const countRow = db.prepare(`SELECT COUNT(*) as count ${filterQuery}`).get(...params) as { count: number } | undefined;
    const total = countRow ? countRow.count : 0;

    const allowedSortColumns = [
      'Paper_ID', 'Title', 'Authors', 'Year', 'DOI', 'Local_PDF_Status', 
      'calibration_pool', 'calibration_tag', 'Publisher', 'citation_count', 
      'manual_decision', 'manual_stage', 'manual_rationale', 'ai_decision', 'ai_stage'
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'Paper_ID';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // 3. Paginated and sorted query execution
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT *, 
             MAX(papers.manual_stage, papers.ai_stage) as Status,
             (SELECT calibration_pool FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND cp.Project_ID = papers.Project_ID) as calibration_pool,
             (SELECT calibration_tag FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND cp.Project_ID = papers.Project_ID) as calibration_tag,
             (SELECT Title FROM papers parent WHERE parent.Paper_ID = papers.Parent_Paper_ID) as Parent_Paper_Title,
             (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID) > 0 as reviewer_decisions_exist
      ${filterQuery} 
      ORDER BY ${safeSortBy} ${safeSortOrder} 
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];

    const papers = db.prepare(dataQuery).all(...dataParams);
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      papers,
      total,
      page,
      limit,
      totalPages
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch manual screening papers' }, { status: 500 });
  }
}
