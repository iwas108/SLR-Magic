import { NextResponse } from 'next/server';
import db, { PROJECT_ROOT, getConfig } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get('paperId');
    
    let paperIds: string[] = [];
    let keepRaw = false;

    if (paperId) {
      paperIds = [paperId];
    } else {
      try {
        const body = await request.json();
        if (body && Array.isArray(body.paperIds)) {
          paperIds = body.paperIds;
          keepRaw = !!body.keepRaw;
        }
      } catch (e) {
        // ignore parse error
      }
    }

    if (paperIds.length === 0) {
      return NextResponse.json({ error: 'paperId (query) or paperIds (body) is required' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const selectPaperStmt = db.prepare('SELECT Local_PDF_Path, Project_ID FROM papers WHERE Paper_ID = ? AND Project_ID = ?');
    const selectProjectFolderStmt = db.prepare('SELECT folder_name FROM projects WHERE id = ?');
    const updatePaperStmt = db.prepare(`
      UPDATE papers 
      SET Local_PDF_Status = 'MISSING', Local_PDF_Path = NULL, PDF_Link = NULL 
      WHERE Paper_ID = ? AND Project_ID = ?
    `);

    // Run database updates and file deletes in a transaction
    const transaction = db.transaction(() => {
      for (const id of paperIds) {
        const paper = selectPaperStmt.get(id, activeProjectId) as { Local_PDF_Path: string | null; Project_ID: string } | undefined;
        if (!paper) continue;

        const project = selectProjectFolderStmt.get(paper.Project_ID) as { folder_name: string } | undefined;

        // Delete the file at the database registered path
        if (paper.Local_PDF_Path) {
          const fullPath = path.join(PROJECT_ROOT, paper.Local_PDF_Path);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }

        // Delete from raw (eternal) library only if keepRaw is false
        if (!keepRaw) {
          const rawPath = path.join(PROJECT_ROOT, 'pdf_library', 'raw', `${id}.pdf`);
          if (fs.existsSync(rawPath)) {
            fs.unlinkSync(rawPath);
          }

          // Delete from downloads folder
          const downloadPath = path.join(PROJECT_ROOT, 'pdf_library', 'downloads', `${id}.pdf`);
          if (fs.existsSync(downloadPath)) {
            fs.unlinkSync(downloadPath);
          }
        }

        // Delete from project repo folder
        if (project?.folder_name) {
          const repoPath = path.join(PROJECT_ROOT, 'pdf_library', 'repo', project.folder_name, `${id}.pdf`);
          if (fs.existsSync(repoPath)) {
            fs.unlinkSync(repoPath);
          }
        }

        updatePaperStmt.run(id, activeProjectId);
      }
    });

    transaction();

    return NextResponse.json({ success: true, message: `PDFs deleted and status/links reset for ${paperIds.length} paper(s).` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete PDF files' }, { status: 500 });
  }
}
