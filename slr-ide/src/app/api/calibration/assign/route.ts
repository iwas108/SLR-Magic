import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { paperId, projectId, calibration_pool, calibration_tag } = await request.json();

    if (!paperId || !projectId) {
      return NextResponse.json({ error: 'paperId and projectId are required' }, { status: 400 });
    }

    if (calibration_pool && ['pool_a', 'pool_b', 'pool_c'].includes(calibration_pool)) {
      const paper = db.prepare("SELECT is_duplicate FROM papers WHERE Paper_ID = ? AND Project_ID = ?").get(paperId, projectId) as { is_duplicate: number } | undefined;
      if (paper?.is_duplicate) {
        return NextResponse.json({ error: 'Cannot assign a duplicate paper to calibration pool' }, { status: 400 });
      }

      const existing = db.prepare("SELECT 1 FROM calibration_papers WHERE Paper_ID = ? AND Project_ID = ?").get(paperId, projectId);
      if (!existing) {
        // Clone the paper row to calibration_papers explicitly listing fields
        db.prepare(`
          INSERT INTO calibration_papers (
            Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
            PDF_Link, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
            Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
            remote_worker_id, scrape_claimed_at, notes,
            ai_stage, ai_decision, ai_exclusion_code, ai_rationale, ai_quality_assessment, ai_extracted_data,
            manual_stage, manual_decision, manual_exclusion_code, manual_rationale, manual_quality_assessment, manual_extracted_data
          )
          SELECT 
            Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year,
            PDF_Link, Local_PDF_Status, Local_PDF_Path, Project_ID, Parent_Paper_ID,
            Original_Publisher, Publisher, citation_count, is_duplicate, merged_into_id,
            remote_worker_id, scrape_claimed_at, notes,
            ai_stage, ai_decision, ai_exclusion_code, ai_rationale, ai_quality_assessment, ai_extracted_data,
            manual_stage, manual_decision, manual_exclusion_code, manual_rationale, manual_quality_assessment, manual_extracted_data
          FROM papers WHERE Paper_ID = ? AND Project_ID = ?
        `).run(paperId, projectId);
      }
      // Update the calibration pool and tag on the clone
      db.prepare("UPDATE calibration_papers SET calibration_pool = ?, calibration_tag = ? WHERE Paper_ID = ? AND Project_ID = ?").run(
        calibration_pool,
        calibration_tag || null,
        paperId,
        projectId
      );
    } else {
      // Clear the clone if no longer assigned to a calibration pool
      db.prepare("DELETE FROM calibration_papers WHERE Paper_ID = ? AND Project_ID = ?").run(paperId, projectId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to assign calibration pool' }, { status: 500 });
  }
}
