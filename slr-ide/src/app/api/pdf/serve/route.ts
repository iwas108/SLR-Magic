import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return new Response('Path query parameter is required', { status: 400 });
    }

    // Map legacy paths to the new unified pdf_library layout
    let resolvedPath = relativePath.replace(/\\/g, '/');
    if (resolvedPath.startsWith('cached_pdf/')) {
      resolvedPath = resolvedPath.replace('cached_pdf/', 'pdf_library/cached/');
    } else if (resolvedPath.startsWith('downloaded_pdf/')) {
      resolvedPath = resolvedPath.replace('downloaded_pdf/', 'pdf_library/downloads/');
    } else if (resolvedPath.startsWith('raw_pdf/')) {
      resolvedPath = resolvedPath.replace('raw_pdf/', 'pdf_library/raw/');
    } else if (resolvedPath.startsWith('pdf_repo/')) {
      resolvedPath = resolvedPath.replace('pdf_repo/', 'pdf_library/repo/');
    }

    // Sanitize path to prevent directory traversal
    const safePath = path.normalize(resolvedPath).replace(/^(\.\.(\/|\\))+/, '');
    const fullPath = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, safePath);

    // Ensure the path is within PROJECT_ROOT and is inside pdf_library
    const relativeToCwd = path.relative(/*turbopackIgnore: true*/ PROJECT_ROOT, fullPath);
    const isSafe = !relativeToCwd.startsWith('..') && !path.isAbsolute(relativeToCwd) &&
      (relativeToCwd.startsWith('pdf_library'));

    if (!isSafe) {
      return new Response('Forbidden: Access is denied', { status: 403 });
    }

    if (!fs.existsSync(fullPath)) {
      // ON-DEMAND SELF-HEALING:
      // If the file is missing from repo folder (e.g. pdf_library/repo/<folderName>/<Paper_ID>.pdf)
      // check if it exists in the eternal library (pdf_library/raw/<Paper_ID>.pdf).
      // If so, copy it to the repo folder on the fly.
      const match = resolvedPath.match(/^pdf_library\/repo\/([^/]+)\/([^/]+\.pdf)$/);
      if (match) {
        const paperId = path.basename(resolvedPath, '.pdf');
        const rawPath = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, 'pdf_library', 'raw', `${paperId}.pdf`);
        if (fs.existsSync(rawPath)) {
          try {
            const repoDir = path.dirname(fullPath);
            if (!fs.existsSync(repoDir)) {
              fs.mkdirSync(repoDir, { recursive: true });
            }
            fs.copyFileSync(rawPath, fullPath);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`Failed to self-heal PDF for serve: ${msg}`);
          }
        }
      }
    }

    if (!fs.existsSync(fullPath)) {
      return new Response('File not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error: any) {
    return new Response(error.message || 'Internal Server Error', { status: 500 });
  }
}
