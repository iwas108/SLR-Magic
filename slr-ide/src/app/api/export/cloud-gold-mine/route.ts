import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
  try {
    const { projectId, groupByKey } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    
    // Get Project Info
    const project = db.prepare('SELECT rclone_remote_name, gdrive_dest_path FROM projects WHERE id = ?').get(projectId) as any;
    if (!project || !project.rclone_remote_name) {
      return NextResponse.json({ error: 'Project or rclone configuration not found' }, { status: 404 });
    }

    // Get Umbrellanizer mappings if a key is provided
    let umbrellaMapping: Record<string, string> = {};
    if (groupByKey) {
      const umbRes = db.prepare('SELECT umbrella_mapping FROM umbrellanizer_results WHERE project_id = ? AND extracted_data_key = ?')
        .get(projectId, groupByKey) as any;
      if (umbRes && umbRes.umbrella_mapping) {
        try {
          umbrellaMapping = JSON.parse(umbRes.umbrella_mapping);
        } catch(e) {}
      }
    }

    // Get Final Dataset Cohort (Stage 4 AND INCLUDE)
    const papers = db.prepare(`
      SELECT 
        Paper_ID, Title, Local_PDF_Path, 
        ai_quality_assessment, manual_quality_assessment,
        ai_extracted_data, manual_extracted_data
      FROM papers 
      WHERE Project_ID = ?
        AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) = 4
        AND CASE 
            WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
            WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
            ELSE COALESCE(manual_decision, ai_decision)
        END LIKE 'INCLUDE%'
        AND Local_PDF_Status = 'DOWNLOADED'
        AND Local_PDF_Path IS NOT NULL
    `).all(projectId) as any[];

    if (papers.length === 0) {
      return NextResponse.json({ message: 'No downloaded PDFs in the final cohort to export' }, { status: 200 });
    }

    // Prepare copy commands or operations
    // We'll write an rclone batch file or just spawn rclone commands. 
    // To avoid spawning hundreds of rclone processes, we can create a temporary filter list or run them sequentially in background.
    // Let's spawn them in background sequentially or write a script.
    
    // For now, we will create a structured directory locally, copy the PDFs there, and run one rclone copy command
    const exportSessionId = `gold_mine_${Date.now()}`;
    const exportTempDir = path.join(process.cwd(), 'slr-ide', 'tmp', exportSessionId);
    
    if (!fs.existsSync(exportTempDir)) {
      fs.mkdirSync(exportTempDir, { recursive: true });
    }

    let copiedCount = 0;
    for (const p of papers) {
      // Determine QA Score
      const qaScore = p.manual_quality_assessment || p.ai_quality_assessment || 'Unscored';
      
      // Determine Group Value
      let groupVal = 'Ungrouped';
      if (groupByKey) {
        const extDataStr = p.manual_extracted_data || p.ai_extracted_data || '{}';
        try {
          const parsed = JSON.parse(extDataStr);
          const rawVal = parsed[groupByKey];
          if (rawVal) {
             // Map it via umbrellanizer if possible
             groupVal = umbrellaMapping[rawVal] || rawVal;
          }
        } catch(e) {}
      }

      // Safe folder names
      const safeQa = qaScore.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      const safeGroup = groupVal.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      const safeTitle = (p.Title || p.Paper_ID).replace(/[^a-z0-9]/gi, '_').substring(0, 50);

      const targetSubDir = path.join(exportTempDir, `QA_${safeQa}`, safeGroup);
      if (!fs.existsSync(targetSubDir)) {
        fs.mkdirSync(targetSubDir, { recursive: true });
      }

      const sourcePdf = p.Local_PDF_Path;
      if (fs.existsSync(sourcePdf)) {
        const targetPdf = path.join(targetSubDir, `${safeTitle}.pdf`);
        fs.copyFileSync(sourcePdf, targetPdf);
        copiedCount++;
      }
    }

    // Now spawn rclone to copy exportTempDir to cloud
    const remoteDest = `${project.rclone_remote_name}:${project.gdrive_dest_path}/Gold_Mine_Exports/${exportSessionId}`;
    
    const rcloneProc = spawn('rclone', ['copy', exportTempDir, remoteDest, '-v'], {
      detached: true,
      stdio: 'ignore'
    });
    
    rcloneProc.unref();

    return NextResponse.json({ 
      message: 'Cloud export started successfully',
      papersCount: copiedCount,
      exportId: exportSessionId
    });

  } catch (error) {
    console.error('Failed to start cloud gold mine export:', error);
    return NextResponse.json({ error: 'Failed to start export' }, { status: 500 });
  }
}
