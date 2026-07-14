import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paperIds } = body;

    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return NextResponse.json({ error: 'Payload must contain a non-empty "paperIds" array' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    // Retrieve active project details
    const project = db.prepare('SELECT folder_name FROM projects WHERE id = ?').get(activeProjectId) as { folder_name: string } | undefined;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    // Verify backend-side that none of the paperIds to purge are part of the inter-rater pool
    const placeHolders = paperIds.map(() => '?').join(',');
    const blockedCountRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM papers 
      WHERE Project_ID = ? 
        AND Paper_ID IN (${placeHolders})
        AND (
          Paper_ID IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = papers.Project_ID)
          OR (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID) > 0
        )
    `).get(activeProjectId, ...paperIds) as { count: number } | undefined;

    if (blockedCountRow && blockedCountRow.count > 0) {
      return NextResponse.json({ error: 'Deletion blocked: Some selected papers are part of the inter-rater pool' }, { status: 400 });
    }

    // Find duplicate papers that are merged into the target papers
    const duplicatePapers = db.prepare(`
      SELECT Paper_ID FROM papers
      WHERE Project_ID = ? AND merged_into_id IN (${placeHolders})
    `).all(activeProjectId, ...paperIds) as { Paper_ID: string }[];

    const duplicatePaperIds = duplicatePapers.map(p => p.Paper_ID);
    const allPaperIdsToDelete = [...new Set([...paperIds, ...duplicatePaperIds])];

    let deletedCount = 0;
    let deletedPdfsCount = 0;

    const projectPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', project.folder_name);

    // Execute atomic transaction for deletions
    const deleteTx = db.transaction(() => {
      const deleteStmt = db.prepare('DELETE FROM papers WHERE Paper_ID = ? AND Project_ID = ?');
      for (const id of allPaperIdsToDelete) {
        // Deleting the database record
        const res = deleteStmt.run(id, activeProjectId);
        if (res.changes > 0) {
          deletedCount++;

          // Delete the PDF in project-scoped repo folder only, leave eternal library raw folder alone
          const pdfPath = path.join(projectPdfDir, `${id}.pdf`);
          if (fs.existsSync(pdfPath)) {
            try {
              fs.unlinkSync(pdfPath);
              deletedPdfsCount++;
            } catch (err) {
              console.error(`Failed to delete project PDF for ${id}:`, err);
            }
          }
        }
      }
    });

    deleteTx();

    // Clear semantic search cache
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({
      success: true,
      deletedPapers: deletedCount,
      deletedPdfs: deletedPdfsCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to execute purge' }, { status: 500 });
  }
}
