import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './db';

export function rescuePdfAssets(paperIds: string[]): number {
  const rawPdfDir = path.join(PROJECT_ROOT, 'raw_pdf');
  const cachedPdfDir = path.join(PROJECT_ROOT, 'cached_pdf');
  
  if (!fs.existsSync(cachedPdfDir)) {
    fs.mkdirSync(cachedPdfDir, { recursive: true });
  }

  let rescuedCount = 0;
  for (const paperId of paperIds) {
    if (!paperId) continue;
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
