import fs from 'fs';
import path from 'path';
import db, { PROJECT_ROOT } from './db';

export function rescuePdfAssets(paperIds: string[]): number {
  const rawPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'raw');
  const cachedPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'cached');
  
  if (!fs.existsSync(cachedPdfDir)) {
    fs.mkdirSync(cachedPdfDir, { recursive: true });
  }

  let rescuedCount = 0;
  for (const paperId of paperIds) {
    if (!paperId) continue;

    // Check if the paper ID is still referenced by other projects
    const refCountRow = db.prepare('SELECT COUNT(*) as count FROM papers WHERE Paper_ID = ?').get(paperId) as { count: number } | undefined;
    if (refCountRow && refCountRow.count > 1) {
      // Still referenced elsewhere, preserve raw file in eternal library
      continue;
    }

    const rawPath = path.join(rawPdfDir, `${paperId}.pdf`);
    const cachedPath = path.join(cachedPdfDir, `${paperId}.pdf`);
    if (fs.existsSync(rawPath)) {
      try {
        fs.renameSync(rawPath, cachedPath);
        rescuedCount++;
      } catch (err) {
        console.error(`Failed to rename PDF for paper ${paperId}, trying copy/unlink:`, err);
        try {
          fs.copyFileSync(rawPath, cachedPath);
          fs.unlinkSync(rawPath);
          rescuedCount++;
        } catch (err2) {
          console.error(`Fallback copy/unlink failed for paper ${paperId}:`, err2);
        }
      }
    }
  }
  return rescuedCount;
}
