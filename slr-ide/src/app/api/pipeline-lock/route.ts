import { NextResponse } from 'next/server';
import { pipelineLock } from '@/lib/services/pipeline-lock';

export async function GET() {
  const isLocked = pipelineLock.isLocked();
  return NextResponse.json({ locked: isLocked });
}
