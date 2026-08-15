import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { exportProjectArchive, createProjectPdfZipBuffer, purgeProjectZeroTrace } from '@/lib/services/archive-service';
import db, { PROJECT_ROOT, getConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || getConfig('ACTIVE_PROJECT_ID', '');
    const type = searchParams.get('type') || 'slr'; // 'slr' or 'pdf_zip'

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (type === 'pdf_zip') {
      const zipData = createProjectPdfZipBuffer(projectId);
      if (!zipData) {
        return NextResponse.json({ error: 'No repository PDFs found to export as ZIP' }, { status: 404 });
      }

      const response = new NextResponse(zipData.buffer as any);
      response.headers.set('Content-Type', 'application/zip');
      response.headers.set('Content-Disposition', `attachment; filename="${zipData.filename}"`);
      return response;
    }

    // Default: SLR Project Archive JSON file
    const { jsonString, filename } = exportProjectArchive(projectId);
    const response = new NextResponse(jsonString);
    response.headers.set('Content-Type', 'application/json');
    response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    return response;
  } catch (error: any) {
    console.error('Failed to generate archive download:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate archive download' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      projectId, 
      destination = 'local', // 'local' or 'cloud'
      keepPdfZip = false, 
      executePurge = true 
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // 1. Generate the master archive payload
    const { payload, jsonString, filename, checksum } = exportProjectArchive(projectId);

    let cloudSyncResult = null;

    // 2. If Cloud Destination requested, sync archive file to Rclone remote
    if (destination === 'cloud') {
      const project = payload.tables.projects[0];
      const remoteName = project.rclone_remote_name || getConfig('RCLONE_REMOTE_NAME', 'gdrive');
      const baseDestPath = project.gdrive_dest_path || 'SLR_Magic/PDFs';
      const archiveDestPath = `${baseDestPath}/Archives`;
      
      const tempArchiveFile = path.join(PROJECT_ROOT, 'pdf_library', filename);
      fs.writeFileSync(tempArchiveFile, jsonString, 'utf-8');

      const rcloneExe = getConfig('RCLONE_EXECUTABLE_PATH', 'rclone');
      const rcloneConfig = getConfig('RCLONE_CONFIG_PATH', '');
      const args = ['copyto', tempArchiveFile, `${remoteName}:${archiveDestPath}/${filename}`];
      if (rcloneConfig) {
        args.push('--config', rcloneConfig);
      }

      const syncProc = spawnSync(rcloneExe, args, { encoding: 'utf-8' });
      try {
        fs.unlinkSync(tempArchiveFile);
      } catch (_) {}

      if (syncProc.error || syncProc.status !== 0) {
        const errorMsg = syncProc.stderr || syncProc.error?.message || 'Rclone cloud sync failed';
        console.error('Cloud archive upload failed:', errorMsg);
        return NextResponse.json({ 
          error: `Cloud sync failed: ${errorMsg}. Purge aborted to prevent data loss.` 
        }, { status: 500 });
      }

      cloudSyncResult = {
        remote: remoteName,
        path: `${archiveDestPath}/${filename}`
      };
    }

    // 3. Execute Zero-Trace Purge & SQLite VACUUM if requested
    let purgeResult = null;
    if (executePurge) {
      purgeResult = purgeProjectZeroTrace(projectId, keepPdfZip);
    }

    return NextResponse.json({
      success: true,
      filename,
      checksum,
      manifest: payload.manifest,
      cloudSyncResult,
      purgeResult
    });
  } catch (error: any) {
    console.error('Failed to process project archive:', error);
    return NextResponse.json({ error: error.message || 'Failed to process project archive' }, { status: 500 });
  }
}
