import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import db, { PROJECT_ROOT } from '@/lib/db';
import { processManager } from '@/lib/services/process-manager';
import { batchStateTracker } from '@/lib/services/batch-state-tracker';
import { streamManager } from '@/lib/services/stream-manager';

const execFileAsync = promisify(execFile);

export async function runCloudSync(
  syncMode: string,
  pdfRepoDir: string,
  remote: string,
  destPath: string,
  configPath: string,
  rclonePath: string,
  cloudName: string,
  activeProjectId: string,
  batchState: any
): Promise<boolean> {
  const subCommand = syncMode === 'mirror' ? 'sync' : 'copy';
  const syncArgs = [
    subCommand, 
    pdfRepoDir, 
    `${remote}:${destPath}`, 
    '-L', 
    '--create-empty-src-dirs', 
    '-v',
    '--stats', '1s',
    '--stats-one-line'
  ];
  if (configPath) {
    syncArgs.push('--config', configPath);
  }

  return new Promise<boolean>((resolve) => {
    if (batchState.cancelRequested) {
      resolve(false);
      return;
    }
    const child = processManager.spawnProcess(rclonePath, syncArgs);

    let stdoutBuffer = '';
    let stderrBuffer = '';

    const processRcloneLine = (line: string) => {
      if (line.trim()) {
        const msg = { event: 'rclone_log', message: line.trim(), step: 'sync' };
        batchStateTracker.updateStateFromMsg(msg);
        streamManager.broadcast(msg);
      }
    };

    child.stdout?.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        processRcloneLine(line);
      }
    });

    child.stderr?.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';
      for (const line of lines) {
        processRcloneLine(line);
      }
    });

    child.on('close', async (code) => {
      if (stdoutBuffer.trim()) {
        processRcloneLine(stdoutBuffer);
        stdoutBuffer = '';
      }
      if (stderrBuffer.trim()) {
        processRcloneLine(stderrBuffer);
        stderrBuffer = '';
      }

      if (code !== 0) {
        let errorMsg = `Rclone sync failed with exit code ${code}`;
        const hasAuthError = batchState.logs.some((log: string) => 
          log.includes('empty token found') || 
          log.includes('oauth client') ||
          log.includes('reconnect') ||
          log.includes('token expired')
        );
        
        if (hasAuthError) {
          errorMsg = `Rclone authentication failed (exit code ${code}). Empty/expired token found. Please run "rclone config reconnect ${remote}:" in your terminal to re-authenticate and connect to ${cloudName}.`;
        }

        const msg = { event: 'error', message: errorMsg, step: 'sync' };
        batchStateTracker.updateStateFromMsg(msg);
        streamManager.broadcast(msg);
        batchState.activeChild = null;
        resolve(false);
        return;
      }

      batchState.activeChild = null;
      resolve(true);
    });

    child.on('error', (err) => {
      const errMsg = { event: 'error', message: `Sync execution fail: ${err.message}`, step: 'sync' };
      batchStateTracker.updateStateFromMsg(errMsg);
      streamManager.broadcast(errMsg);
      batchState.activeChild = null;
      resolve(false);
    });
  });
}

export async function generateCloudLinks(
  activeProjectId: string,
  pdfRepoDir: string,
  remote: string,
  destPath: string,
  configPath: string,
  rclonePath: string,
  cloudName: string,
  batchState: any,
  forceUpdate: boolean = false
): Promise<void> {
  try {
    const statusIn = forceUpdate ? "('MATCHED', 'DOWNLOADED', 'SYNCED')" : "('MATCHED', 'DOWNLOADED')";
    const papers = db.prepare(`
      SELECT Paper_ID FROM papers 
      WHERE Local_PDF_Status IN ${statusIn}
        AND Project_ID = ?
        AND (is_duplicate IS NULL OR is_duplicate = 0)
    `).all(activeProjectId) as { Paper_ID: string }[];

    const startMsg = { event: 'start', total: papers.length, step: 'sync' };
    batchStateTracker.updateStateFromMsg(startMsg);
    streamManager.broadcast(startMsg);

    let linkedCount = 0;

    for (const paper of papers) {
      if (batchState.cancelRequested) break;
      const paperId = paper.Paper_ID;

      const localFile = path.join(pdfRepoDir, `${paperId}.pdf`);
      if (!fs.existsSync(localFile)) {
        db.prepare(`
          UPDATE papers
          SET Local_PDF_Status = 'MISSING', PDF_Link = NULL
          WHERE Paper_ID = ? AND Project_ID = ?
        `).run(paperId, activeProjectId);

        const failMsg = { 
          event: 'link_fail', 
          paper_id: paperId, 
          message: 'Local PDF file missing in pdf_library/repo - skipped linking',
          step: 'sync' 
        };
        batchStateTracker.updateStateFromMsg(failMsg);
        streamManager.broadcast(failMsg);
        continue;
      }

      const linkMsg = { event: 'linking', paper_id: paperId, message: `Linking paper ${paperId}...`, step: 'sync' };
      batchStateTracker.updateStateFromMsg(linkMsg);
      streamManager.broadcast(linkMsg);

      const linkArgs = ['link', `${remote}:${destPath}/${paperId}.pdf`];
      if (configPath) {
        linkArgs.push('--config', configPath);
      }

      try {
        const { stdout } = await execFileAsync(rclonePath, linkArgs);
        const linkResult = stdout.toString().trim();
        if (linkResult && linkResult.startsWith('http')) {
          const relPath = path.relative(PROJECT_ROOT, localFile).replace(/\\/g, '/');
          db.prepare(`
            UPDATE papers
            SET PDF_Link = ?, Local_PDF_Status = 'SYNCED', Local_PDF_Path = ?
            WHERE Paper_ID = ? AND Project_ID = ?
          `).run(linkResult, relPath, paperId, activeProjectId);

          linkedCount++;
          const successMsg = { 
            event: 'link_success', 
            paper_id: paperId, 
            link: linkResult,
            step: 'sync'
          };
          batchStateTracker.updateStateFromMsg(successMsg);
          streamManager.broadcast(successMsg);
        } else {
          const failMsg = { 
            event: 'link_fail', 
            paper_id: paperId, 
            message: 'Invalid link returned: ' + linkResult,
            step: 'sync' 
          };
          batchStateTracker.updateStateFromMsg(failMsg);
          streamManager.broadcast(failMsg);
        }
      } catch (linkErr: any) {
        const failMsg = { 
          event: 'link_fail', 
          paper_id: paperId, 
          message: linkErr.message || 'Error generating link',
          step: 'sync' 
        };
        batchStateTracker.updateStateFromMsg(failMsg);
        streamManager.broadcast(failMsg);
      }
    }

    const completeMsg = { 
      event: 'step_complete', 
      step: 'sync', 
      message: `[Sync Finished] Linked ${linkedCount}/${papers.length} PDFs.` 
    };
    batchStateTracker.updateStateFromMsg(completeMsg);
    streamManager.broadcast(completeMsg);

  } catch (dbErr: any) {
    const errMsg = { event: 'error', message: dbErr.message || 'Database error', step: 'sync' };
    batchStateTracker.updateStateFromMsg(errMsg);
    streamManager.broadcast(errMsg);
  }
}
