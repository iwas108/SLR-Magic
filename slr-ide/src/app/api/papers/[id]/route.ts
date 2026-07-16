import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const paper = db.prepare(`
      SELECT *, 
             (SELECT Title FROM papers parent WHERE parent.Paper_ID = papers.Parent_Paper_ID) as Parent_Paper_Title,
             (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID) > 0 as reviewer_decisions_exist
      FROM papers 
      WHERE Paper_ID = ?
    `).get(id);
    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }
    return NextResponse.json(paper);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch paper' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { Title, Authors, Year, DOI, Abstract, PDF_Link, Status, Local_PDF_Status, calibration_pool, calibration_tag, Human_Decision, Human_EC_Trigger, Human_Rationale, Parent_Paper_ID, Original_Publisher, Publisher, citation_count, notes, manual_decision, manual_ec_trigger, manual_rationale, manual_stage, manual_qa_scores, manual_extracted_data } = body;

    if (!Title || !Title.trim()) {
      return NextResponse.json({ error: 'Title is mandatory' }, { status: 400 });
    }

    // Fetch current paper record to preserve fields not supplied in body
    const currentPaper = db.prepare('SELECT * FROM papers WHERE Paper_ID = ?').get(id) as any;
    if (!currentPaper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    // Safe integer parsing for year to prevent NaN bindings in SQLite
    let yearVal: number | null = null;
    if (Year !== undefined && Year !== null && Year !== '') {
      const parsedYear = parseInt(Year, 10);
      if (!isNaN(parsedYear)) {
        yearVal = parsedYear;
      }
    } else if (Year === undefined) {
      yearVal = currentPaper.Year;
    }

    // Safe integer parsing for citation_count to prevent NaN bindings
    let citationCountVal: number | null = null;
    if (citation_count !== undefined && citation_count !== null && citation_count !== '') {
      const parsedCitations = parseInt(citation_count, 10);
      if (!isNaN(parsedCitations)) {
        citationCountVal = parsedCitations;
      }
    } else if (citation_count === undefined) {
      citationCountVal = currentPaper.citation_count;
    }

    const localPdfStatusVal = Local_PDF_Status !== undefined ? Local_PDF_Status : currentPaper.Local_PDF_Status;
    const calibrationPoolVal = calibration_pool !== undefined ? calibration_pool : currentPaper.calibration_pool;
    const calibrationTagVal = calibration_tag !== undefined ? calibration_tag : currentPaper.calibration_tag;
    const humanDecisionVal = Human_Decision !== undefined ? Human_Decision : currentPaper.Human_Decision;
    const humanEcVal = Human_EC_Trigger !== undefined ? Human_EC_Trigger : currentPaper.Human_EC_Trigger;
    const humanRatVal = Human_Rationale !== undefined ? Human_Rationale : currentPaper.Human_Rationale;
    const parentPaperIdVal = Parent_Paper_ID !== undefined ? Parent_Paper_ID : currentPaper.Parent_Paper_ID;
    const originalPublisherVal = Original_Publisher !== undefined ? Original_Publisher : currentPaper.Original_Publisher;
    const publisherVal = Publisher !== undefined ? Publisher : currentPaper.Publisher;
    const notesVal = notes !== undefined ? notes : currentPaper.notes;
    const manualDecisionVal = manual_decision !== undefined ? manual_decision : currentPaper.manual_decision;
    const manualEcVal = manual_ec_trigger !== undefined ? manual_ec_trigger : currentPaper.manual_ec_trigger;
    const manualRatVal = manual_rationale !== undefined ? manual_rationale : currentPaper.manual_rationale;
    const manualStageVal = manual_stage !== undefined ? manual_stage : currentPaper.manual_stage;
    const manualQaVal = manual_qa_scores !== undefined ? manual_qa_scores : currentPaper.manual_qa_scores;
    const manualExtVal = manual_extracted_data !== undefined ? manual_extracted_data : currentPaper.manual_extracted_data;

    // Strict constraint: Status cannot be directly edited; it must source from manual_stage or LLM execution.
    let statusVal = currentPaper.Status;
    if (manual_stage !== undefined) {
      if (manual_stage === 'fast_filter') {
        statusVal = '1';
      } else if (manual_stage === 'gatekeeper') {
        statusVal = '2';
      } else if (manual_stage === 'scientist') {
        statusVal = '3';
      } else if (manual_stage === 'miner') {
        statusVal = '4';
      } else if (!manual_stage) {
        statusVal = 'PENDING';
      }
    }

    db.prepare(`
      UPDATE papers
      SET Title = ?,
          Authors = ?,
          Year = ?,
          DOI = ?,
          Abstract = ?,
          PDF_Link = ?,
          Status = ?,
          Local_PDF_Status = ?,
          calibration_pool = ?,
          calibration_tag = ?,
          Human_Decision = ?,
          Human_EC_Trigger = ?,
          Human_Rationale = ?,
          Parent_Paper_ID = ?,
          Original_Publisher = ?,
          Publisher = ?,
          citation_count = ?,
          notes = ?,
          manual_decision = ?,
          manual_ec_trigger = ?,
          manual_rationale = ?,
          manual_stage = ?,
          manual_qa_scores = ?,
          manual_extracted_data = ?
      WHERE Paper_ID = ?
    `).run(
      Title.trim(),
      Authors !== undefined ? String(Authors).trim() : currentPaper.Authors,
      yearVal,
      DOI !== undefined ? String(DOI).trim() : currentPaper.DOI,
      Abstract !== undefined ? String(Abstract).trim() : currentPaper.Abstract,
      PDF_Link !== undefined ? String(PDF_Link).trim() : currentPaper.PDF_Link,
      statusVal || 'PENDING',
      localPdfStatusVal || 'MISSING',
      null, // calibration_pool is kept NULL on the main papers table
      null, // calibration_tag is kept NULL on the main papers table
      humanDecisionVal,
      humanEcVal,
      humanRatVal,
      parentPaperIdVal,
      originalPublisherVal,
      publisherVal,
      citationCountVal,
      notesVal,
      manualDecisionVal,
      manualEcVal,
      manualRatVal,
      manualStageVal,
      manualQaVal,
      manualExtVal,
      id
    );

    // Process manual audit logging
    if (manual_decision !== undefined && manual_stage !== undefined && currentPaper?.Project_ID) {
      if (manual_stage) {
        db.prepare(`
          INSERT INTO manual_audit_log (
            paper_id, project_id, manual_stage, decision, ec_trigger, rationale, qa_scores, extracted_data, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          currentPaper.Project_ID,
          manualStageVal,
          manualDecisionVal,
          manualEcVal,
          manualRatVal,
          manualQaVal,
          manualExtVal,
          new Date().toISOString()
        );
      }
    }

    // Process dedicated calibration_papers table cloning
    if (calibrationPoolVal && ['pool_a', 'pool_b', 'pool_c'].includes(calibrationPoolVal)) {
      const existing = db.prepare("SELECT 1 FROM calibration_papers WHERE Paper_ID = ?").get(id);
      if (!existing) {
        // Clone the newly updated papers row to calibration_papers
        db.prepare("INSERT INTO calibration_papers SELECT * FROM papers WHERE Paper_ID = ?").run(id);
      }
      // Set the calibration fields on the clone
      db.prepare("UPDATE calibration_papers SET calibration_pool = ?, calibration_tag = ? WHERE Paper_ID = ?").run(calibrationPoolVal, calibrationTagVal, id);
    } else {
      // Clear the clone if no longer assigned to a calibration pool
      db.prepare("DELETE FROM calibration_papers WHERE Paper_ID = ?").run(id);
    }

    if (currentPaper?.Project_ID) {
      clearSemanticSearchCache(currentPaper.Project_ID);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update paper' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const paper = db.prepare('SELECT Project_ID FROM papers WHERE Paper_ID = ?').get(id) as { Project_ID: string } | undefined;
    
    db.prepare('DELETE FROM papers WHERE Paper_ID = ?').run(id);

    if (paper?.Project_ID) {
      clearSemanticSearchCache(paper.Project_ID);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete paper' }, { status: 500 });
  }
}
