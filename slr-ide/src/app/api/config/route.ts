import { NextResponse } from 'next/server';
import { getAllConfigs, setConfig } from '@/lib/db';

export async function GET() {
  try {
    const configs = getAllConfigs();
    return NextResponse.json(configs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch configurations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (typeof data !== 'object' || data === null) {
      return NextResponse.json({ error: 'Invalid configuration payload' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(data)) {
      setConfig(key, String(value));
    }

    return NextResponse.json({ success: true, message: 'Configurations updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update configurations' }, { status: 500 });
  }
}
