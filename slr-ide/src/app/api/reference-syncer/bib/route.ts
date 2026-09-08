import { NextRequest, NextResponse } from 'next/server';
import { 
  getBibDatabaseStatus, 
  loadBibDatabase, 
  replaceBibDatabase 
} from '@/lib/services/reference-syncer-service';

export const dynamic = 'force-dynamic';

/**
 * GET: Retrieves references.bib status or forces a reload from disk
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shouldReload = searchParams.get('reload') === 'true';

    if (shouldReload) {
      loadBibDatabase(true);
    }

    const status = getBibDatabaseStatus();

    return NextResponse.json({
      success: true,
      reloaded: shouldReload,
      status
    });
  } catch (err: any) {
    console.error('[ReferenceSyncer API] Error getting bib status:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to check references.bib status' },
      { status: 500 }
    );
  }
}

/**
 * POST: Uploads and replaces db/references.bib with automatic backup
 */
export async function POST(req: NextRequest) {
  try {
    let bibContent = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No .bib file provided in form data' },
          { status: 400 }
        );
      }
      bibContent = await file.text();
    } else {
      const body = await req.json();
      bibContent = body.content || '';
    }

    if (!bibContent.trim()) {
      return NextResponse.json(
        { success: false, error: 'Empty BibTeX content provided' },
        { status: 400 }
      );
    }

    const result = replaceBibDatabase(bibContent);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update references.bib' },
        { status: 400 }
      );
    }

    const status = getBibDatabaseStatus();

    return NextResponse.json({
      success: true,
      message: `Successfully updated db/references.bib with ${result.totalEntries} entries`,
      totalEntries: result.totalEntries,
      backupPath: result.backupPath,
      status
    });
  } catch (err: any) {
    console.error('[ReferenceSyncer API] Error replacing references.bib:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to replace references.bib' },
      { status: 500 }
    );
  }
}
