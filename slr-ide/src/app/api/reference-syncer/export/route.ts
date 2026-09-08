import { NextRequest, NextResponse } from 'next/server';
import { generateSynchronizedLatex } from '@/lib/services/reference-syncer-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const files: Array<{
      name: string;
      content: string;
      replacements: Record<string, string>;
    }> = body.files || [];

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided for export' }, { status: 400 });
    }

    const exportedFiles = files.map(file => {
      const updatedContent = generateSynchronizedLatex(file.content, file.replacements || {});
      const syncFileName = file.name.endsWith('.tex')
        ? file.name.replace(/\.tex$/, '.synced.tex')
        : `${file.name}.synced.tex`;

      return {
        originalName: file.name,
        syncedName: syncFileName,
        content: updatedContent,
        replacementsCount: Object.keys(file.replacements || {}).length,
        sizeBytes: Buffer.byteLength(updatedContent, 'utf-8')
      };
    });

    // Build Execution Summary Report in Markdown
    let mdReport = `# Reference Syncer Execution Summary Report\n\n`;
    mdReport += `Generated: ${new Date().toISOString()}\n`;
    mdReport += `Total Processed Files: ${exportedFiles.length}\n`;
    mdReport += `Total Replacements Applied: ${exportedFiles.reduce((acc, f) => acc + f.replacementsCount, 0)}\n\n`;
    mdReport += `| Original File | Synced File | Replacements | File Size |\n`;
    mdReport += `| :--- | :--- | :--- | :--- |\n`;
    for (const f of exportedFiles) {
      mdReport += `| \`${f.originalName}\` | \`${f.syncedName}\` | ${f.replacementsCount} | ${(f.sizeBytes / 1024).toFixed(1)} KB |\n`;
    }

    return NextResponse.json({
      success: true,
      exportedFiles,
      executionSummaryMd: mdReport
    });
  } catch (err: any) {
    console.error('Reference Syncer export error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to export synchronized files' }, { status: 500 });
  }
}
