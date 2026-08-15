import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import db, { PROJECT_ROOT, getConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');

    const idMapDbPath = path.join(PROJECT_ROOT, 'db', 'vector_id_map.db');
    const pdfIndexPath = path.join(PROJECT_ROOT, 'db', 'pdf_cache_vectors.tvim');
    const paperIndexPath = path.join(PROJECT_ROOT, 'db', 'paper_corpus_vectors.tvim');

    const pdfIndexExists = fs.existsSync(pdfIndexPath);
    const paperIndexExists = fs.existsSync(paperIndexPath);

    let pdfCount = 0;
    let paperCount = 0;
    const indexedPaperIdSet = new Set<string>();

    if (fs.existsSync(idMapDbPath)) {
      const idMapDb = new Database(idMapDbPath, { readonly: true });
      try {
        const rowPdf = idMapDb.prepare("SELECT COUNT(*) as count FROM id_map WHERE source = 'pdf_cache'").get() as { count: number } | undefined;
        pdfCount = rowPdf ? rowPdf.count : 0;

        const rowPaper = idMapDb.prepare("SELECT COUNT(*) as count FROM id_map WHERE source = 'paper'").get() as { count: number } | undefined;
        paperCount = rowPaper ? rowPaper.count : 0;

        if (paperIndexExists) {
          const indexedPaperRows = idMapDb.prepare("SELECT string_id FROM id_map WHERE source = 'paper'").all() as { string_id: string }[];
          for (const row of indexedPaperRows) {
            if (row.string_id) indexedPaperIdSet.add(row.string_id);
          }
        }
      } catch (e) {
        console.error('[Vector Status API Error]:', e);
      } finally {
        idMapDb.close();
      }
    }

    // Compute active project metrics
    let totalProjectPapers = 0;
    let indexedProjectPapers = 0;

    if (projectId) {
      const projectPapers = db.prepare(
        "SELECT Paper_ID FROM papers WHERE CAST(Project_ID AS TEXT) = CAST(? AS TEXT) AND (is_duplicate IS NULL OR is_duplicate = 0)"
      ).all(projectId) as { Paper_ID: string }[];

      totalProjectPapers = projectPapers.length;
      if (paperIndexExists && indexedPaperIdSet.size > 0) {
        for (const p of projectPapers) {
          if (indexedPaperIdSet.has(p.Paper_ID)) {
            indexedProjectPapers++;
          }
        }
      }
    }

    const missingProjectPapers = Math.max(0, totalProjectPapers - indexedProjectPapers);
    const coveragePct = totalProjectPapers > 0 
      ? parseFloat(((indexedProjectPapers / totalProjectPapers) * 100).toFixed(1)) 
      : (paperIndexExists ? 100 : 0);

    const indexed = pdfIndexExists && paperIndexExists && totalProjectPapers > 0 && indexedProjectPapers >= totalProjectPapers;
    const modelName = getConfig('EMBEDDING_MODEL', 'nomic-ai/nomic-embed-text-v1.5');

    return NextResponse.json({
      indexed,
      pdf_count: pdfCount,
      paper_count: paperCount,
      project_id: projectId,
      total_project_papers: totalProjectPapers,
      indexed_project_papers: indexedProjectPapers,
      missing_project_papers: missingProjectPapers,
      coverage_pct: coveragePct,
      model: modelName,
      pdf_index_exists: pdfIndexExists,
      paper_index_exists: paperIndexExists
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch vector status' }, { status: 500 });
  }
}

