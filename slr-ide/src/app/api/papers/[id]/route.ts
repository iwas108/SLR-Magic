import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const paper = db.prepare('SELECT *, (SELECT Title FROM papers parent WHERE parent.Paper_ID = papers.Parent_Paper_ID) as Parent_Paper_Title FROM papers WHERE Paper_ID = ?').get(id);
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
    const { Title, Authors, Year, DOI, Abstract, PDF_Link, Status, Local_PDF_Status, calibration_pool, calibration_tag, Human_Decision, Human_EC_Trigger, Human_Rationale, Parent_Paper_ID } = body;

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

    const calibrationPoolVal = calibration_pool !== undefined ? calibration_pool : currentPaper.calibration_pool;
    const calibrationTagVal = calibration_tag !== undefined ? calibration_tag : currentPaper.calibration_tag;
    const humanDecisionVal = Human_Decision !== undefined ? Human_Decision : currentPaper.Human_Decision;
    const humanEcVal = Human_EC_Trigger !== undefined ? Human_EC_Trigger : currentPaper.Human_EC_Trigger;
    const humanRatVal = Human_Rationale !== undefined ? Human_Rationale : currentPaper.Human_Rationale;
    const parentPaperIdVal = Parent_Paper_ID !== undefined ? Parent_Paper_ID : currentPaper.Parent_Paper_ID;

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
          Parent_Paper_ID = ?
      WHERE Paper_ID = ?
    `).run(
      Title.trim(),
      Authors !== undefined ? String(Authors).trim() : currentPaper.Authors,
      yearVal,
      DOI !== undefined ? String(DOI).trim() : currentPaper.DOI,
      Abstract !== undefined ? String(Abstract).trim() : currentPaper.Abstract,
      PDF_Link !== undefined ? String(PDF_Link).trim() : currentPaper.PDF_Link,
      Status || 'PENDING',
      Local_PDF_Status || 'MISSING',
      calibrationPoolVal,
      calibrationTagVal,
      humanDecisionVal,
      humanEcVal,
      humanRatVal,
      parentPaperIdVal,
      id
    );

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
    
    db.prepare('DELETE FROM papers WHERE Paper_ID = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete paper' }, { status: 500 });
  }
}
