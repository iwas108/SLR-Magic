import { NextResponse } from 'next/server';
import db, { getConfig } from '@/lib/db';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    const paper = db.prepare(`
      SELECT *, 
             (SELECT calibration_pool FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND (cp.Project_ID = papers.Project_ID OR CAST(cp.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as calibration_pool,
             (SELECT calibration_tag FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND (cp.Project_ID = papers.Project_ID OR CAST(cp.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as calibration_tag,
             (SELECT Title FROM papers parent WHERE parent.Paper_ID = papers.Parent_Paper_ID AND (parent.Project_ID = papers.Project_ID OR CAST(parent.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as Parent_Paper_Title,
             (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = papers.Paper_ID AND (project_id = papers.Project_ID OR CAST(project_id AS TEXT) = CAST(papers.Project_ID AS TEXT))) > 0 as reviewer_decisions_exist
      FROM papers 
      WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
    `).get(id, activeProjectId, activeProjectId);
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
    const { 
      Title, Authors, Year, DOI, Abstract, PDF_Link, Local_PDF_Status, Parent_Paper_ID, Original_Publisher, Publisher, citation_count, notes,
      manual_decision, manual_exclusion_code, manual_rationale, manual_stage, manual_quality_assessment, manual_extracted_data
    } = body;

    if (!Title || !Title.trim()) {
      return NextResponse.json({ error: 'Title is mandatory' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    
    // Fetch current paper record to preserve fields not supplied in body
    const currentPaper = db.prepare('SELECT * FROM papers WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))').get(id, activeProjectId, activeProjectId) as any;
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
    const parentPaperIdVal = Parent_Paper_ID !== undefined ? Parent_Paper_ID : currentPaper.Parent_Paper_ID;
    const originalPublisherVal = Original_Publisher !== undefined ? Original_Publisher : currentPaper.Original_Publisher;
    const publisherVal = Publisher !== undefined ? Publisher : currentPaper.Publisher;
    const notesVal = notes !== undefined ? notes : currentPaper.notes;

    // Handle manual stage string to integer translation
    let manualStageVal = currentPaper.manual_stage;
    if (manual_stage !== undefined) {
      if (manual_stage === null || manual_stage === '') {
        manualStageVal = 0;
      } else {
        const stageStringToInt: Record<string, number> = {
          'unscreened': 0, 'fast_filter': 1, 'gatekeeper': 2, 'scientist': 3, 'miner': 4
        };
        manualStageVal = stageStringToInt[manual_stage] !== undefined ? stageStringToInt[manual_stage] : 0;
      }
    }

    let manualDecisionVal = manual_decision !== undefined ? manual_decision : currentPaper.manual_decision;
    let manualExcodeVal = manual_exclusion_code !== undefined ? manual_exclusion_code : currentPaper.manual_exclusion_code;

    if (manualStageVal === 4 && (!manualDecisionVal || manualDecisionVal === 'EXCLUDE' || manualDecisionVal === '')) {
      manualDecisionVal = 'INCLUDE';
      manualExcodeVal = null;
    }

    const manualRationaleVal = manual_rationale !== undefined ? manual_rationale : currentPaper.manual_rationale;
    const manualQaVal = manual_quality_assessment !== undefined ? manual_quality_assessment : currentPaper.manual_quality_assessment;
    const manualExtVal = manual_extracted_data !== undefined ? manual_extracted_data : currentPaper.manual_extracted_data;

    db.prepare(`
      UPDATE papers
      SET Title = ?,
          Authors = ?,
          Year = ?,
          DOI = ?,
          Abstract = ?,
          PDF_Link = ?,
          Local_PDF_Status = ?,
          Parent_Paper_ID = ?,
          Original_Publisher = ?,
          Publisher = ?,
          citation_count = ?,
          notes = ?,
          manual_decision = ?,
          manual_exclusion_code = ?,
          manual_rationale = ?,
          manual_stage = ?,
          manual_quality_assessment = ?,
          manual_extracted_data = ?
      WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))
    `).run(
      Title.trim(),
      Authors !== undefined ? String(Authors).trim() : currentPaper.Authors,
      yearVal,
      DOI !== undefined ? String(DOI).trim() : currentPaper.DOI,
      Abstract !== undefined ? String(Abstract).trim() : currentPaper.Abstract,
      PDF_Link !== undefined ? String(PDF_Link).trim() : currentPaper.PDF_Link,
      localPdfStatusVal || 'MISSING',
      parentPaperIdVal,
      originalPublisherVal,
      publisherVal,
      citationCountVal,
      notesVal,
      manualDecisionVal,
      manualExcodeVal,
      manualRationaleVal,
      manualStageVal,
      manualQaVal,
      manualExtVal,
      id,
      activeProjectId,
      activeProjectId
    );

    // If manual screening fields were explicitly provided, write an audit log entry
    if (
      manual_decision !== undefined || 
      manual_exclusion_code !== undefined ||
      manual_stage !== undefined || 
      manual_rationale !== undefined || 
      manual_quality_assessment !== undefined || 
      manual_extracted_data !== undefined
    ) {
      const activeDecision = manualDecisionVal || 'CLEARED';
      const ecTriggerVal = activeDecision === 'EXCLUDE' ? manualExcodeVal : null;

      // Convert stage integer back to string representation for audit log representation consistency
      const stageIntToString: Record<number, string> = {
        0: 'unscreened', 1: 'fast_filter', 2: 'gatekeeper', 3: 'scientist', 4: 'miner'
      };
      const auditStageStr = stageIntToString[manualStageVal || 0] || 'fast_filter';

      db.prepare(`
        INSERT INTO manual_audit_log (
          paper_id, project_id, manual_stage, decision, ec_trigger, rationale, qa_scores, extracted_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        activeProjectId,
        auditStageStr,
        activeDecision,
        ecTriggerVal,
        manualRationaleVal || '',
        manualQaVal || '{}',
        manualExtVal || '{}',
        new Date().toISOString()
      );
    }

    clearSemanticSearchCache(activeProjectId);

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
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', '');
    
    db.prepare('DELETE FROM llm_screening_records WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))').run(id, activeProjectId, activeProjectId);
    db.prepare('DELETE FROM manual_audit_log WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))').run(id, activeProjectId, activeProjectId);
    db.prepare('DELETE FROM llm_audit_log WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))').run(id, activeProjectId, activeProjectId);
    db.prepare('DELETE FROM papers WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))').run(id, activeProjectId, activeProjectId);

    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete paper' }, { status: 500 });
  }
}
