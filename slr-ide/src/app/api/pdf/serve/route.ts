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
