import { NextResponse } from 'next/server';
import { importProjectArchive } from '@/lib/services/archive-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const archivePayload = body.archiveData || body;

    if (!archivePayload || (typeof archivePayload === 'object' && Object.keys(archivePayload).length === 0)) {
      return NextResponse.json({ error: 'Payload must contain project archive data' }, { status: 400 });
    }

    const result = importProjectArchive(archivePayload);

    return NextResponse.json({
      success: true,
      message: `Project '${result.project.name}' successfully imported!`,
      project: result.project,
      recordCounts: result.recordCounts,
      remappedPapersCount: result.remappedPapersCount,
      projectRenamed: result.projectRenamed
    });
  } catch (error: any) {
    console.error('Failed to import project archive:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to import project archive' 
    }, { status: 500 });
  }
}
