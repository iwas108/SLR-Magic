import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';

export async function GET() {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const papers = db.prepare('SELECT * FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))').all(activeProjectId, activeProjectId) as any[];

    const headers = [
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
      'Stage',
      'citation_count'
    ];

    // Build CSV safely escaping characters
    const csvRows = [headers.join(',')];

    for (const paper of papers) {
      const activeStage = Math.max(Number(paper.manual_stage || 0), Number(paper.ai_stage || 0));
      const row = [
        paper.Paper_ID || '',
        paper.Import_Date || '',
        paper.Import_Source || '',
        paper.Source || '',
        paper.DOI || '',
        paper.Title || '',
        paper.Abstract || '',
        paper.Authors || '',
        paper.Year ? String(paper.Year) : '',
        paper.PDF_Link || '',
        String(activeStage),
        paper.citation_count !== undefined && paper.citation_count !== null ? String(paper.citation_count) : '0'
      ];

      // Escape quotes and wrap cell contents containing quotes, commas, or newlines in double quotes
      const escapedRow = row.map(val => {
        let str = String(val);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          str = str.replace(/"/g, '""');
          return `"${str}"`;
        }
        return str;
      });

      csvRows.push(escapedRow.join(','));
    }

    const csvContent = csvRows.join('\r\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="raw_harvest_export.csv"'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to export CSV' }, { status: 500 });
  }
}
