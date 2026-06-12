import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { rescuePdfAssets } from '@/lib/pdf-utils';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // 1. Fetch papers for the project to rescue their PDFs
    const papers = db.prepare('SELECT Paper_ID FROM papers WHERE Project_ID = ?').all(projectId) as { Paper_ID: string }[];
    const paperIds = papers.map(p => p.Paper_ID);
    
    // 2. Perform PDF rescue
    const rescuedCount = rescuePdfAssets(paperIds);

    // 3. Run deletion inside a transaction
    const deleteTransaction = db.transaction(() => {
      // Clear all related tables to be absolutely sure the database is fully clear of this project data
      db.prepare('DELETE FROM reviewer_decisions WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM calibration_commit_ledger WHERE project_id = ?').run(projectId);
      
      // Delete papers
      db.prepare('DELETE FROM papers WHERE Project_ID = ?').run(projectId);

      // Finally delete the project itself
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

      // If active project is the deleted one, reset or set config to empty/default-project
      const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
      if (activeProjectId === projectId) {
        // Find another project to set active if possible, otherwise default-project
        const nextProject = db.prepare('SELECT id FROM projects WHERE id != ? LIMIT 1').get(projectId) as { id: string } | undefined;
        const newActiveId = nextProject ? nextProject.id : 'default-project';
        db.prepare("INSERT OR REPLACE INTO configs (key, value) VALUES ('ACTIVE_PROJECT_ID', ?)").run(newActiveId);
      }
    });

    deleteTransaction();

    return NextResponse.json({ 
      success: true, 
      message: `Project and associated data deleted successfully. Rescued ${rescuedCount} PDF assets.` 
    });
  } catch (error: any) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
  }
}
