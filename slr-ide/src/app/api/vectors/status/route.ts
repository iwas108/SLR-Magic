import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { PROJECT_ROOT, getConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const idMapDbPath = path.join(PROJECT_ROOT, 'db', 'vector_id_map.db');
    const pdfIndexPath = path.join(PROJECT_ROOT, 'db', 'pdf_cache_vectors.tvim');
    const paperIndexPath = path.join(PROJECT_ROOT, 'db', 'paper_corpus_vectors.tvim');

    const pdfIndexExists = fs.existsSync(pdfIndexPath);
    const paperIndexExists = fs.existsSync(paperIndexPath);
    const indexed = pdfIndexExists && paperIndexExists;

    let pdfCount = 0;
    let paperCount = 0;

    if (fs.existsSync(idMapDbPath)) {
      const idMapDb = new Database(idMapDbPath);
      try {
        const rowPdf = idMapDb.prepare("SELECT COUNT(*) as count FROM id_map WHERE source = 'pdf_cache'").get() as { count: number };
        pdfCount = rowPdf ? rowPdf.count : 0;

        const rowPaper = idMapDb.prepare("SELECT COUNT(*) as count FROM id_map WHERE source = 'paper'").get() as { count: number };
        paperCount = rowPaper ? rowPaper.count : 0;
      } catch (e) {
        console.error('[Vector Status API Error]:', e);
      } finally {
        idMapDb.close();
      }
    }

    const modelName = getConfig('EMBEDDING_MODEL', 'nomic-ai/nomic-embed-text-v1.5');

    return NextResponse.json({
      indexed,
      pdf_count: pdfCount,
      paper_count: paperCount,
      model: modelName,
      pdf_index_exists: pdfIndexExists,
      paper_index_exists: paperIndexExists
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch vector status' }, { status: 500 });
  }
}
