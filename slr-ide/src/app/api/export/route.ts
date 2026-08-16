import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig } from '@/lib/db';

const DEFAULT_INGESTION_HEADERS = [
  'Paper_ID',
  'Import_Date',
  'Import_Source',
  'Source',
  'DOI',
  'Title',
  'Abstract',
  'Authors',
  'Year',
  'PDF_Link',
  'Status',
  'Original_Publisher',
  'Publisher',
  'citation_count',
  'Parent_Paper_ID'
];

function resolveFieldValue(paper: any, fieldKey: string): string {
  switch (fieldKey) {
    case 'Paper_ID':
      return paper.Paper_ID || '';
    case 'Import_Date':
      return paper.Import_Date || '';
    case 'Import_Source':
      return paper.Import_Source || '';
    case 'Source':
      return paper.Source || '';
    case 'DOI':
      return paper.DOI || '';
    case 'Title':
      return paper.Title || '';
    case 'Abstract':
      return paper.Abstract || '';
    case 'Authors':
      return paper.Authors || '';
    case 'Year':
      return paper.Year !== null && paper.Year !== undefined ? String(paper.Year) : '';
    case 'PDF_Link':
      return paper.PDF_Link || '';
    case 'Status':
    case 'Local_PDF_Status':
      return paper.Local_PDF_Status || 'IGNORED';
    case 'Original_Publisher':
      return paper.Original_Publisher || '';
    case 'Publisher':
      return paper.Publisher || '';
    case 'citation_count':
      return paper.citation_count !== undefined && paper.citation_count !== null ? String(paper.citation_count) : '0';
    case 'Parent_Paper_ID':
      return paper.Parent_Paper_ID || '';
    case 'Local_PDF_Path':
      return paper.Local_PDF_Path || '';
    case 'notes':
      return paper.notes || '';
    case 'Stage': {
      const activeStage = Math.max(Number(paper.manual_stage || 0), Number(paper.ai_stage || 0));
      return String(activeStage);
    }
    case 'Decision': {
      const mStage = Number(paper.manual_stage || 0);
      const aStage = Number(paper.ai_stage || 0);
      if (mStage > aStage) return paper.manual_decision || '';
      if (aStage > mStage) return paper.ai_decision || '';
      return paper.manual_decision || paper.ai_decision || '';
    }
    case 'manual_stage':
      return paper.manual_stage !== null && paper.manual_stage !== undefined ? String(paper.manual_stage) : '';
    case 'manual_decision':
      return paper.manual_decision || '';
    case 'manual_exclusion_code':
      return paper.manual_exclusion_code || '';
    case 'manual_rationale':
      return paper.manual_rationale || '';
    case 'ai_stage':
      return paper.ai_stage !== null && paper.ai_stage !== undefined ? String(paper.ai_stage) : '';
    case 'ai_decision':
      return paper.ai_decision || '';
    case 'ai_exclusion_code':
      return paper.ai_exclusion_code || '';
    case 'ai_rationale':
      return paper.ai_rationale || '';
    case 'manual_quality_assessment':
      return typeof paper.manual_quality_assessment === 'object' && paper.manual_quality_assessment !== null
        ? JSON.stringify(paper.manual_quality_assessment)
        : (paper.manual_quality_assessment || '');
    case 'manual_extracted_data':
      return typeof paper.manual_extracted_data === 'object' && paper.manual_extracted_data !== null
        ? JSON.stringify(paper.manual_extracted_data)
        : (paper.manual_extracted_data || '');
    case 'ai_quality_assessment':
      return typeof paper.ai_quality_assessment === 'object' && paper.ai_quality_assessment !== null
        ? JSON.stringify(paper.ai_quality_assessment)
        : (paper.ai_quality_assessment || '');
    case 'ai_extracted_data':
      return typeof paper.ai_extracted_data === 'object' && paper.ai_extracted_data !== null
        ? JSON.stringify(paper.ai_extracted_data)
        : (paper.ai_extracted_data || '');
    case 'calibration_pool':
      return paper.calibration_pool || '';
    case 'calibration_tag':
      return paper.calibration_tag || '';
    default:
      return paper[fieldKey] !== null && paper[fieldKey] !== undefined ? String(paper[fieldKey]) : '';
  }
}

function escapeCsvCell(val: string): string {
  let str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return str;
}

function buildCsvResponse(papers: any[], headers: string[], filename: string): Response {
  const csvRows = [headers.join(',')];

  for (const paper of papers) {
    const row = headers.map(header => {
      const val = resolveFieldValue(paper, header);
      return escapeCsvCell(val);
    });
    csvRows.push(row.join(','));
  }

  // Prepend UTF-8 BOM for maximum compatibility across spreadsheet software
  const csvContent = '\uFEFF' + csvRows.join('\r\n');

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

function fetchExportPapers(activeProjectId: string, scope?: string, paperIds?: string[], includeParents: boolean = false): any[] {
  if (scope === 'snowballing') {
    const snowballSql = `
      SELECT * FROM papers 
      WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
        AND (
          Source IN ('Backward Snowball', 'Forward Snowball', 'Manual Search', 'Manual Ingestion')
          OR Import_Source IN ('Backward Snowball', 'Forward Snowball', 'Manual Search', 'Manual Ingestion')
          OR (Parent_Paper_ID IS NOT NULL AND Parent_Paper_ID != '')
        )
      ORDER BY Year DESC, Title ASC
    `;
    const snowballPapers = db.prepare(snowballSql).all(activeProjectId, activeProjectId) as any[];

    if (includeParents && snowballPapers.length > 0) {
      const parentIds = Array.from(new Set(
        snowballPapers
          .map(p => p.Parent_Paper_ID)
          .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      ));

      if (parentIds.length > 0) {
        const placeholders = parentIds.map(() => '?').join(',');
        const parentSql = `
          SELECT * FROM papers 
          WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
            AND Paper_ID IN (${placeholders})
        `;
        const parentPapers = db.prepare(parentSql).all(activeProjectId, activeProjectId, ...parentIds) as any[];

        // Combine parent seed papers + snowballing papers cleanly
        const map = new Map<string, any>();
        for (const p of parentPapers) {
          map.set(p.Paper_ID, p);
        }
        for (const p of snowballPapers) {
          map.set(p.Paper_ID, p);
        }
        return Array.from(map.values());
      }
    }

    return snowballPapers;
  }

  let sql = 'SELECT * FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))';
  const params: any[] = [activeProjectId, activeProjectId];

  if (Array.isArray(paperIds) && paperIds.length > 0) {
    const placeholders = paperIds.map(() => '?').join(',');
    sql += ` AND Paper_ID IN (${placeholders})`;
    params.push(...paperIds);
  }

  sql += ' ORDER BY Year DESC, Title ASC';
  return db.prepare(sql).all(...params) as any[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeProjectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    const scope = searchParams.get('scope') || undefined;
    const includeParents = searchParams.get('includeParents') === 'true';

    const columnsParam = searchParams.get('columns');
    const headers = columnsParam
      ? columnsParam.split(',').map(s => s.trim()).filter(Boolean)
      : DEFAULT_INGESTION_HEADERS;

    const paperIdsParam = searchParams.get('paperIds');
    const paperIds = paperIdsParam
      ? paperIdsParam.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const papers = fetchExportPapers(activeProjectId, scope, paperIds, includeParents);

    const dateStr = new Date().toISOString().split('T')[0];
    let filename = `papers_export_${activeProjectId || 'project'}_${dateStr}.csv`;
    if (scope === 'snowballing') {
      filename = `snowballing_papers_${activeProjectId || 'export'}_${dateStr}.csv`;
    } else if (paperIds && paperIds.length > 0) {
      filename = `papers_export_selected_${dateStr}.csv`;
    }

    return buildCsvResponse(papers, headers, filename);
  } catch (error: any) {
    console.error('Export CSV GET Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to export CSV' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const activeProjectId = body.projectId || getConfig('ACTIVE_PROJECT_ID', '');
    const scope = body.scope || undefined;
    const includeParents = body.includeParents === true;

    const headers = Array.isArray(body.columns) && body.columns.length > 0
      ? body.columns
      : DEFAULT_INGESTION_HEADERS;

    const paperIds = Array.isArray(body.paperIds) && body.paperIds.length > 0
      ? body.paperIds
      : undefined;

    const papers = fetchExportPapers(activeProjectId, scope, paperIds, includeParents);

    const dateStr = new Date().toISOString().split('T')[0];
    let filename = `papers_export_${activeProjectId || 'project'}_${dateStr}.csv`;
    if (scope === 'snowballing') {
      filename = `snowballing_papers_${activeProjectId || 'export'}_${dateStr}.csv`;
    } else if (scope === 'selected' || (paperIds && paperIds.length > 0)) {
      filename = `papers_export_selected_${dateStr}.csv`;
    }

    return buildCsvResponse(papers, headers, filename);
  } catch (error: any) {
    console.error('Export CSV POST Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to export CSV' }, { status: 500 });
  }
}
