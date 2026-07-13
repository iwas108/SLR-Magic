import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const statusFilter = url.searchParams.get('statusFilter');
    const decisionFilter = url.searchParams.get('decisionFilter');

    if (!projectId || !statusFilter) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let query = "SELECT count(*) as count FROM papers WHERE Project_ID = ?";
    let params: any[] = [projectId];

    if (statusFilter !== 'ALL') {
      query += " AND Status = ?";
      params.push(statusFilter);
    }

    if (decisionFilter && decisionFilter !== 'ALL') {
      query += " AND IFNULL(AI_Decision, 'PENDING') = ?";
      params.push(decisionFilter);
    }

    const result = db.prepare(query).get(...params) as { count: number };
    return NextResponse.json({ count: result.count });
  } catch (error: any) {
    console.error('Failed to count papers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
