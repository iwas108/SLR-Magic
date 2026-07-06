import { spawn, execSync, execFileSync, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import db, { getConfig, PROJECT_ROOT } from '@/lib/db';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

function getGhostscriptCommand(): string | null {
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

export async function POST(request: Request) {
  try {
    const compress = getConfig('PDF_COMPRESSION_ENABLED', 'false') === 'true';

    const rclonePath = getConfig('RCLONE_EXECUTABLE_PATH', 'rclone');
    const configPath = getConfig('RCLONE_CONFIG_PATH', '');
    const syncMode = getConfig('RCLONE_SYNC_MODE', 'incremental');

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const project = db.prepare('SELECT folder_name, gdrive_dest_path, cloud_provider, rclone_remote_name FROM projects WHERE id = ?').get(activeProjectId) as { folder_name: string; gdrive_dest_path: string; cloud_provider?: string; rclone_remote_name?: string } | undefined;
    const folderName = project ? project.folder_name : 'default_project';
    const gdriveDest = project ? project.gdrive_dest_path : 'SLR_Magic/PDFs';
    const destPath = `${gdriveDest}/${folderName}`;

    const cloudProvider = project?.cloud_provider || 'gdrive';
    const remote = project?.rclone_remote_name || (cloudProvider === 'onedrive' ? 'onedrive' : 'gdrive');
    const cloudName = cloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive';

    const localPdfDir = path.join(PROJECT_ROOT, 'pdf_library', 'repo', folderName);
    if (!fs.existsSync(localPdfDir)) {
      fs.mkdirSync(localPdfDir, { recursive: true });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ event: 'info', message: 'Preparing PDFs and starting sync pipeline...' }) + '\n'));

        // 1. Gather all matched/downloaded papers for this project
        const papersToSync = db.prepare(`
          SELECT Paper_ID, Local_PDF_Path FROM papers
          WHERE Project_ID = ? AND Local_PDF_Status IN ('MATCHED', 'DOWNLOADED')
        `).all(activeProjectId) as { Paper_ID: string; Local_PDF_Path: string }[];

        if (papersToSync.length > 0) {
          const gsCommand = compress ? getGhostscriptCommand() : null;
          const gsLevel = getConfig('PDF_COMPRESSION_LEVEL', '/ebook');

          if (gsCommand) {
            controller.enqueue(encoder.encode(JSON.stringify({ event: 'step_start', step: 'compress', message: 'Compressing PDFs before upload...' }) + '\n'));
            controller.enqueue(encoder.encode(JSON.stringify({ event: 'start', step: 'compress', total: papersToSync.length }) + '\n'));
          } else {
            controller.enqueue(encoder.encode(JSON.stringify({ event: 'info', message: `Copying ${papersToSync.length} PDFs to repository...` }) + '\n'));
          }

          let processedCount = 0;
          for (const paper of papersToSync) {
            if (!paper.Local_PDF_Path) continue;
            const inputPath = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, paper.Local_PDF_Path);
            const outputPath = path.join(localPdfDir, `${paper.Paper_ID}.pdf`);

            let origSize = 0;
            let newSize = 0;
            try {
              if (fs.existsSync(inputPath)) {
                origSize = fs.statSync(inputPath).size;
              }
            } catch (e) {}

            if (!fs.existsSync(inputPath)) {
              controller.enqueue(encoder.encode(JSON.stringify({ event: 'log', message: `Warning: Source PDF not found on disk for ${paper.Paper_ID}: ${paper.Local_PDF_Path}` }) + '\n'));
              continue;
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
                controller.enqueue(encoder.encode(JSON.stringify({ event: 'log', message: `Warning: Ghostscript failed for ${paper.Paper_ID}. Falling back to copy: ${e.message}` }) + '\n'));
              }
            }

            if (!compressionSuccess) {
              try {
                fs.copyFileSync(inputPath, outputPath);
                if (fs.existsSync(outputPath)) {
                  newSize = fs.statSync(outputPath).size;
                }
              } catch (e: any) {
                controller.enqueue(encoder.encode(JSON.stringify({ event: 'log', message: `Error copying ${paper.Paper_ID}: ${e.message}` }) + '\n'));
                continue;
              }
            }
            processedCount++;

            if (gsCommand) {
              const ratio = origSize > 0 ? Math.round(((origSize - newSize) / origSize) * 100) : 0;
              controller.enqueue(encoder.encode(JSON.stringify({
                event: 'progress',
                step: 'compress',
                current: processedCount,
                total: papersToSync.length,
                paper_id: paper.Paper_ID,
                original_size: origSize,
                new_size: newSize,
                ratio: ratio,
                skipped: false
              }) + '\n'));
            }
          }
          if (gsCommand) {
            controller.enqueue(encoder.encode(JSON.stringify({ event: 'step_complete', step: 'compress', message: `Finished processing PDFs. Compressed ${processedCount} files.` }) + '\n'));
          } else {
            controller.enqueue(encoder.encode(JSON.stringify({ event: 'info', message: `Finished processing PDFs. Copied ${processedCount} files.` }) + '\n'));
          }

          // Explicitly transition back to sync step in UI
          controller.enqueue(encoder.encode(JSON.stringify({ event: 'step_start', step: 'sync', message: 'Syncing Files (Rclone)...' }) + '\n'));
        }

        // 2. Launch Rclone sync execution
        controller.enqueue(encoder.encode(JSON.stringify({ event: 'info', message: `Starting Rclone sync to ${cloudName} directory: ${destPath}` }) + '\n'));

        const subCommand = syncMode === 'mirror' ? 'sync' : 'copy';
        const syncArgs = [
          subCommand, 
          localPdfDir, 
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

        const child = spawn(rclonePath, syncArgs);
        const accumulatedLogs: string[] = [];
        let stdoutBuffer = '';
        let stderrBuffer = '';

        const processRcloneLine = (line: string) => {
          if (line.trim()) {
            const logMsg = line.trim();
            accumulatedLogs.push(logMsg);
            controller.enqueue(encoder.encode(JSON.stringify({ event: 'rclone_log', message: logMsg }) + '\n'));
          }
        };

        child.stdout.on('data', (data) => {
          stdoutBuffer += data.toString();
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() || '';
          for (const line of lines) {
            processRcloneLine(line);
          }
        });

        child.stderr.on('data', (data) => {
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
            const hasAuthError = accumulatedLogs.some(log => 
              log.includes('empty token found') || 
              log.includes('oauth client') ||
              log.includes('reconnect') ||
              log.includes('token expired')
            );
            
            if (hasAuthError) {
              errorMsg = `Rclone authentication failed (exit code ${code}). Empty/expired token found. Please run "rclone config reconnect ${remote}:" in your terminal to re-authenticate and connect to ${cloudName}.`;
            }

            controller.enqueue(encoder.encode(JSON.stringify({ event: 'error', message: errorMsg }) + '\n'));
            controller.close();
            return;
          }

          controller.enqueue(encoder.encode(JSON.stringify({ event: 'info', message: `Sync completed. Generating ${cloudName} links...` }) + '\n'));

          try {
            // Find papers that have a local PDF to generate links for (matching active project)
            const papers = db.prepare(`
              SELECT Paper_ID FROM papers 
              WHERE Local_PDF_Status IN ('MATCHED', 'DOWNLOADED')
                AND Project_ID = ?
            `).all(activeProjectId) as { Paper_ID: string }[];

            let linkedCount = 0;

            for (const paper of papers) {
              const paperId = paper.Paper_ID;

              // Verify local file exists
              const localFile = path.join(localPdfDir, `${paperId}.pdf`);
              if (!fs.existsSync(localFile)) {
                db.prepare(`
                  UPDATE papers
                  SET Local_PDF_Status = 'MISSING', PDF_Link = NULL
                  WHERE Paper_ID = ?
                `).run(paperId);
                
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  event: 'link_fail', 
                  paper_id: paperId, 
                  message: 'Local PDF file missing in pdf_library/repo - skipped linking' 
                }) + '\n'));
                continue;
              }

              controller.enqueue(encoder.encode(JSON.stringify({ event: 'linking', paper_id: paperId, message: `Linking paper ${paperId}...` }) + '\n'));

              const linkArgs = ['link', `${remote}:${destPath}/${paperId}.pdf`];
              if (configPath) {
                linkArgs.push('--config', configPath);
              }

              try {
                // Execute rclone link asynchronously to prevent event loop blocking
                const { stdout } = await execFileAsync(rclonePath, linkArgs);
                const linkResult = stdout.toString().trim();
                
                if (linkResult && linkResult.startsWith('http')) {
                  const relPath = path.relative(PROJECT_ROOT, localFile).replace(/\\/g, '/');
                  db.prepare(`
                    UPDATE papers
                    SET PDF_Link = ?, Local_PDF_Status = 'SYNCED', Local_PDF_Path = ?
                    WHERE Paper_ID = ?
                  `).run(linkResult, relPath, paperId);

                  linkedCount++;
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    event: 'link_success', 
                    paper_id: paperId, 
                    link: linkResult 
                  }) + '\n'));
                } else {
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    event: 'link_fail', 
                    paper_id: paperId, 
                    message: 'Rclone returned invalid link: ' + linkResult 
                  }) + '\n'));
                }
              } catch (linkErr: any) {
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  event: 'link_fail', 
                  paper_id: paperId, 
                  message: linkErr.message || 'Error generating link' 
                }) + '\n'));
              }
            }

            controller.enqueue(encoder.encode(JSON.stringify({ 
              event: 'complete', 
              message: `Sync finished. Successfully linked ${linkedCount}/${papers.length} PDFs.` 
            }) + '\n'));
          } catch (dbErr: any) {
            controller.enqueue(encoder.encode(JSON.stringify({ event: 'error', message: dbErr.message || 'Database error' }) + '\n'));
          }

          controller.close();
        });

        child.on('error', (err) => {
          controller.enqueue(encoder.encode(JSON.stringify({ event: 'error', message: `Rclone failed: ${err.message}` }) + '\n'));
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to trigger sync' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
