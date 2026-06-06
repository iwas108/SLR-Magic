import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { Title, Authors, Year, DOI, Abstract, PDF_Link, Status, Local_PDF_Status } = body;

    if (!Title || !Title.trim()) {
      return NextResponse.json({ error: 'Title is mandatory' }, { status: 400 });
    }

    // Safe integer parsing for year to prevent NaN bindings in SQLite
    let yearVal: number | null = null;
    if (Year !== undefined && Year !== null && Year !== '') {
      const parsedYear = parseInt(Year, 10);
      if (!isNaN(parsedYear)) {
        yearVal = parsedYear;
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
          Local_PDF_Status = ?
      WHERE Paper_ID = ?
    `).run(
      Title.trim(),
      Authors ? String(Authors).trim() : '',
      yearVal,
      DOI ? String(DOI).trim() : '',
      Abstract ? String(Abstract).trim() : '',
      PDF_Link ? String(PDF_Link).trim() : '',
      Status || 'PENDING',
      Local_PDF_Status || 'MISSING',
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
