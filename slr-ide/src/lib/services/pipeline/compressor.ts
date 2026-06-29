import { execSync, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getConfig } from '@/lib/db';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';
import { streamManager } from '@/lib/services/stream-manager';

export function getGhostscriptCommand(): string | null {
  const customPath = getConfig('GHOSTSCRIPT_PATH', '');
  if (customPath && customPath.trim()) {
    if (fs.existsSync(customPath.trim())) {
      return customPath.trim();
    }
    try {
      execSync(process.platform === 'win32' ? `where "${customPath.trim()}"` : `which "${customPath.trim()}"`, { stdio: 'ignore' });
      return customPath.trim();
    } catch (e) {
      // ignore
    }
  }
  for (const cmd of ['gs', 'gswin64c', 'gswin32c']) {
    try {
      execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

export function compressSinglePDF(
  paper: { Paper_ID: string; Local_PDF_Path: string },
  projectRoot: string,
  pdfRepoDir: string,
  gsCommand: string | null,
  gsLevel: string
): { success: boolean; origSize: number; newSize: number; skipped: boolean } {
  if (!paper.Local_PDF_Path) {
    return { success: false, origSize: 0, newSize: 0, skipped: true };
  }
  const inputPath = path.join(projectRoot, paper.Local_PDF_Path);
  const outputPath = path.join(pdfRepoDir, `${paper.Paper_ID}.pdf`);

  let origSize = 0;
  let newSize = 0;
  try {
    if (fs.existsSync(inputPath)) {
      origSize = fs.statSync(inputPath).size;
    }
  } catch (e) {}

  if (!fs.existsSync(inputPath)) {
    batchStateTracker.updateStateFromMsg({ event: 'log', message: `Warning: Source PDF not found on disk for ${paper.Paper_ID}: ${paper.Local_PDF_Path}`, step: 'sync' });
    streamManager.broadcast({ event: 'log', message: `Warning: Source PDF not found on disk for ${paper.Paper_ID}: ${paper.Local_PDF_Path}`, step: 'sync' });
    return { success: false, origSize: 0, newSize: 0, skipped: false };
  }

  let compressionSuccess = false;
  if (gsCommand && origSize > 0) {
    try {
      execFileSync(gsCommand, [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-dPDFSETTINGS=${gsLevel}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        `-sOutputFile=${outputPath}`,
        inputPath
      ]);
      if (fs.existsSync(outputPath)) {
        compressionSuccess = true;
        newSize = fs.statSync(outputPath).size;
      }
    } catch (e: any) {
      batchStateTracker.updateStateFromMsg({ event: 'log', message: `Warning: Ghostscript failed for ${paper.Paper_ID}. Falling back to copy: ${e.message}`, step: 'sync' });
      streamManager.broadcast({ event: 'log', message: `Warning: Ghostscript failed for ${paper.Paper_ID}. Falling back to copy: ${e.message}`, step: 'sync' });
    }
  }

  if (!compressionSuccess) {
    try {
      fs.copyFileSync(inputPath, outputPath);
      if (fs.existsSync(outputPath)) {
        newSize = fs.statSync(outputPath).size;
      }
    } catch (e: any) {
      batchStateTracker.updateStateFromMsg({ event: 'log', message: `Error copying ${paper.Paper_ID}: ${e.message}`, step: 'sync' });
      streamManager.broadcast({ event: 'log', message: `Error copying ${paper.Paper_ID}: ${e.message}`, step: 'sync' });
      return { success: false, origSize: 0, newSize: 0, skipped: false };
    }
  }

  return { success: true, origSize, newSize, skipped: false };
}
