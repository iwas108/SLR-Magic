import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const models = db.prepare('SELECT * FROM llm_pricing ORDER BY provider ASC, model_id ASC').all();
    return NextResponse.json({ success: true, models });
  } catch (error: any) {
    console.error('Failed to fetch pricing:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
