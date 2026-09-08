import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { 
  loadBibDatabase, 
  scanLatexFile, 
  GlobalScanSummary, 
  ScannedFileResult 
} from '@/lib/services/reference-syncer-service';
import { PROJECT_ROOT } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const files: { name: string; content: string }[] = body.files || [];
    const projectId: string | undefined = body.projectId;

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided for citation scanning' }, { status: 400 });
    }

    const bibData = loadBibDatabase();
    const scannedFiles: ScannedFileResult[] = [];

    let totalCitations = 0;
    let exactMatches = 0;
    let resolvedReplacements = 0;
    let ambiguousCitations = 0;
    let missingFromBib = 0;
    let suspiciousFindingsCount = 0;

    for (const f of files) {
      const result = scanLatexFile(f.name, f.content || '', bibData, projectId);
      scannedFiles.push(result);

      totalCitations += result.stats.total;
      exactMatches += result.stats.exact;
      resolvedReplacements += result.stats.replaced;
      ambiguousCitations += result.stats.ambiguous;
      missingFromBib += result.stats.missing;
      suspiciousFindingsCount += result.suspiciousFindings.length + result.stats.suspicious;
    }

    const summary: GlobalScanSummary = {
      totalFiles: scannedFiles.length,
      totalCitations,
      exactMatches,
      resolvedReplacements,
      ambiguousCitations,
      missingFromBib,
      suspiciousFindingsCount,
      files: scannedFiles
    };

    return NextResponse.json({
      success: true,
      bibCount: bibData.entries.size,
      summary
    });
  } catch (err: any) {
    console.error('Reference Syncer scan error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to scan LaTeX files' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const isSample = searchParams.get('sample') === 'true' || searchParams.get('loadSample') === 'true';
    const projectId = searchParams.get('projectId') || undefined;

    if (isSample) {
      // Find tmp directory in workspace root or PROJECT_ROOT/../tmp
      const candidates = [
        path.resolve(PROJECT_ROOT, '..', 'tmp'),
        path.resolve(PROJECT_ROOT, 'tmp'),
        path.resolve(process.cwd(), 'tmp'),
        path.resolve(process.cwd(), '..', 'tmp')
      ];

      let tmpDir = candidates.find(p => fs.existsSync(p));
      if (!tmpDir) {
        return NextResponse.json({ error: 'Sample directory (tmp/) not found' }, { status: 404 });
      }

      const files = fs.readdirSync(tmpDir)
        .filter(f => f.endsWith('.tex'))
        .map(f => {
          const fullPath = path.join(tmpDir!, f);
          return {
            name: f,
            content: fs.readFileSync(fullPath, 'utf-8')
          };
        });

      if (files.length === 0) {
        return NextResponse.json({ error: 'No .tex files found in sample directory' }, { status: 404 });
      }

      const bibData = loadBibDatabase();
      const scannedFiles: ScannedFileResult[] = [];

      let totalCitations = 0;
      let exactMatches = 0;
      let resolvedReplacements = 0;
      let ambiguousCitations = 0;
      let missingFromBib = 0;
      let suspiciousFindingsCount = 0;

      for (const f of files) {
        const result = scanLatexFile(f.name, f.content, bibData, projectId);
        scannedFiles.push(result);

        totalCitations += result.stats.total;
        exactMatches += result.stats.exact;
        resolvedReplacements += result.stats.replaced;
        ambiguousCitations += result.stats.ambiguous;
        missingFromBib += result.stats.missing;
        suspiciousFindingsCount += result.suspiciousFindings.length + result.stats.suspicious;
      }

      const summary: GlobalScanSummary = {
        totalFiles: scannedFiles.length,
        totalCitations,
        exactMatches,
        resolvedReplacements,
        ambiguousCitations,
        missingFromBib,
        suspiciousFindingsCount,
        files: scannedFiles
      };

      return NextResponse.json({
        success: true,
        isSample: true,
        bibCount: bibData.entries.size,
        summary
      });
    }

    const bibData = loadBibDatabase();
    return NextResponse.json({
      success: true,
      bibCount: bibData.entries.size
    });
  } catch (err: any) {
    console.error('Reference Syncer sample scan error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to process sample scan' }, { status: 500 });
  }
}
