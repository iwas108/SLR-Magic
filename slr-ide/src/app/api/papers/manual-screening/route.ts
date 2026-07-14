import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const pdfStatus = searchParams.get('pdfStatus')?.trim() || '';
    const calibrationPool = searchParams.get('calibrationPool')?.trim() || '';
    const publisher = searchParams.get('publisher')?.trim() || '';
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

    if (status) {
      filterQuery += ' AND Status = ?';
      params.push(status);
    }

    if (pdfStatus) {
      filterQuery += ' AND Local_PDF_Status = ?';
      params.push(pdfStatus);
    }

    if (publisher) {
      filterQuery += ' AND Publisher = ?';
      params.push(publisher);
    }

    if (calibrationPool) {
      if (calibrationPool === 'none') {
        filterQuery += ' AND Paper_ID NOT IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ?)';
        params.push(activeProjectId);
      } else {
        filterQuery += ' AND Paper_ID IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ? AND calibration_pool = ?)';
        params.push(activeProjectId, calibrationPool);
      }
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

    // 2. Sorting whitelist validation to prevent SQL Injection
    const allowedSortColumns = [
      'Paper_ID', 'Title', 'Authors', 'Year', 'DOI', 'Local_PDF_Status', 
      'Status', 'calibration_pool', 'calibration_tag', 'Human_Decision', 
      'Publisher', 'citation_count', 'manual_decision', 'manual_stage'
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'Paper_ID';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // 3. Paginated and sorted query execution
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT *, 
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
