import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST() {
  try {
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(activeProjectId) as any;
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 });
    }

    const rollingBatchSize = project.rolling_batch_size || 20;

    // Check if there is an uncompleted batch
    const activeBatch = db.prepare(`
      SELECT * FROM rolling_batches 
      WHERE project_id = ? AND status != 'complete'
      LIMIT 1
    `).get(activeProjectId) as any;

    if (activeBatch) {
      return NextResponse.json({ 
        error: `An active rolling batch (Batch #${activeBatch.batch_number}) already exists for this project. Please complete adjudication before initializing a new one.` 
      }, { status: 400 });
    }

    // Determine next batch number
    const countRow = db.prepare(`
      SELECT COUNT(*) as count FROM rolling_batches WHERE project_id = ?
    `).get(activeProjectId) as { count: number };
    const nextBatchNumber = countRow.count + 1;

    // Select eligible papers
    const eligiblePapers = db.prepare(`
      SELECT p.* FROM papers p
      WHERE p.Project_ID = ?
        AND p.ai_stage = 4
        AND p.ai_decision LIKE 'INCLUDE%'
        AND p.is_duplicate = 0
        AND p.manual_decision IS NULL
        AND p.Paper_ID NOT IN (
          SELECT cp.Paper_ID FROM calibration_papers cp WHERE cp.Project_ID = ?
        )
        AND p.Paper_ID NOT IN (
          SELECT rbp.Paper_ID FROM rolling_batch_papers rbp WHERE rbp.project_id = ?
        )
      ORDER BY RANDOM()
      LIMIT ?
    `).all(activeProjectId, activeProjectId, activeProjectId, rollingBatchSize) as any[];

    if (eligiblePapers.length < rollingBatchSize) {
      return NextResponse.json({ 
        error: `Insufficient eligible papers (found ${eligiblePapers.length}, required ${rollingBatchSize}). Ensure enough papers have completed both Scientist (Stage 3) and Miner (Stage 4) via LLM, are not duplicates, and have not yet been manually screened.` 
      }, { status: 400 });
    }

    const batchId = `rb-${randomUUID()}`;
    const timestamp = new Date().toISOString();

    // Insert batch and snapshot papers in transaction
    const result = db.transaction(() => {
      db.prepare(`
        INSERT INTO rolling_batches (id, project_id, batch_number, status, created_at)
        VALUES (?, ?, ?, 'pending_review', ?)
      `).run(batchId, activeProjectId, nextBatchNumber, timestamp);

      const insertPaper = db.prepare(`
        INSERT INTO rolling_batch_papers (
          Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year, PDF_Link,
          Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID, Original_Publisher, Publisher,
          citation_count, is_duplicate, merged_into_id, remote_worker_id, scrape_claimed_at, notes,
          ai_stage, ai_decision, ai_exclusion_code, ai_rationale, ai_quality_assessment, ai_extracted_data,
          manual_stage, manual_decision, manual_exclusion_code, manual_rationale, manual_quality_assessment, manual_extracted_data,
          batch_id, batch_number
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      for (const p of eligiblePapers) {
        insertPaper.run(
          p.Paper_ID, p.Import_Date, p.Import_Source, p.Source, p.DOI, p.Title, p.Abstract, p.Authors, p.Year, p.PDF_Link,
          p.Local_PDF_Status, p.Local_PDF_Path, p.Project_ID, p.Parent_Paper_ID, p.Original_Publisher, p.Publisher,
          p.citation_count, p.is_duplicate, p.merged_into_id, p.remote_worker_id, p.scrape_claimed_at, p.notes,
          p.ai_stage, p.ai_decision, p.ai_exclusion_code, p.ai_rationale, p.ai_quality_assessment, p.ai_extracted_data,
          0, null, null, null, null, null, // Initial manual status for rolling batch review is clean
          batchId, nextBatchNumber
        );
      }

      return {
        batchId,
        batchNumber: nextBatchNumber,
        papersCount: eligiblePapers.length
      };
    })();

    return NextResponse.json({ success: true, batch: result });
  } catch (error: any) {
    console.error('Failed to initialize rolling batch:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
