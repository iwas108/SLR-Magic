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

    // Sanitize path to prevent directory traversal
    const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\))+/, '');
    const fullPath = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, safePath);

    // Ensure the path is within PROJECT_ROOT and is inside raw_pdf, cached_pdf, or pdf_repo
    const relativeToCwd = path.relative(/*turbopackIgnore: true*/ PROJECT_ROOT, fullPath);
    const isSafe = !relativeToCwd.startsWith('..') && !path.isAbsolute(relativeToCwd) &&
      (relativeToCwd.startsWith('raw_pdf') || relativeToCwd.startsWith('cached_pdf') || relativeToCwd.startsWith('pdf_repo'));

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
