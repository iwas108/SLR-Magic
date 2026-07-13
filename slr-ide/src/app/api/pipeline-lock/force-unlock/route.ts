import { NextResponse } from 'next/server';
import { pipelineLock } from '@/lib/services/pipeline-lock';

export async function POST() {
  const success = pipelineLock.release();
  return NextResponse.json({ success });
}
