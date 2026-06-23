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

export async function POST(req: Request) {
  try {
    const { models } = await req.json();
    if (!Array.isArray(models)) {
      return NextResponse.json({ success: false, error: 'Models must be an array' }, { status: 400 });
    }

    const clearStmt = db.prepare('DELETE FROM llm_pricing');
    const insertStmt = db.prepare(`
      INSERT INTO llm_pricing (model_id, provider, input_token_price, output_token_price, thinking_token_price, batch_discount, updated_at) 
      VALUES (@model_id, @provider, @input_token_price, @output_token_price, @thinking_token_price, @batch_discount, @updated_at)
    `);

    const transaction = db.transaction((modelsList: any[]) => {
      clearStmt.run();
      const now = new Date().toISOString();
      for (const model of modelsList) {
        insertStmt.run({
          model_id: model.model_id,
          provider: model.provider,
          input_token_price: model.input_token_price !== undefined ? model.input_token_price : 0,
          output_token_price: model.output_token_price !== undefined ? model.output_token_price : 0,
          thinking_token_price: model.thinking_token_price !== undefined ? model.thinking_token_price : null,
          batch_discount: model.batch_discount !== undefined ? model.batch_discount : 0.5,
          updated_at: now
        });
      }
    });

    transaction(models);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update pricing:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
