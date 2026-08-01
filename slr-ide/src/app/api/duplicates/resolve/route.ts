import db from '@/lib/db';
import { NextResponse } from 'next/server';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pair_id, action, keep_paper_id, exclude_paper_id } = body;

    if (!pair_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: pair_id and action are required.' },
        { status: 400 }
      );
    }

    // Retrieve the project_id associated with this duplicate pair
    const pair = db.prepare('SELECT project_id FROM duplicate_pairs WHERE id = ?').get(pair_id) as { project_id: string } | undefined;
    if (!pair) {
      return NextResponse.json({ error: 'Duplicate pair not found.' }, { status: 404 });
    }

    if (action === 'KEEP_BOTH') {
      db.prepare(`
        UPDATE duplicate_pairs
        SET status = 'FALSE_FLAG'
        WHERE id = ?
      `).run(pair_id);

      if (pair?.project_id) {
        clearSemanticSearchCache(pair.project_id);
      }

      return NextResponse.json({ success: true, message: 'Resolved as false flag (kept both papers).' });
    }

    if (action === 'CONFIRMED_DUPLICATE') {
      if (!keep_paper_id || !exclude_paper_id) {
        return NextResponse.json(
          { error: 'keep_paper_id and exclude_paper_id are required for CONFIRMED_DUPLICATE action.' },
          { status: 400 }
        );
      }

      // Execute updates inside an atomic transaction
      const resolveTx = db.transaction(() => {
        // 1. Update the excluded paper in papers table
        db.prepare(`
          UPDATE papers
          SET is_duplicate = 1, merged_into_id = ?
          WHERE Paper_ID = ? AND Project_ID = ?
        `).run(keep_paper_id, exclude_paper_id, pair?.project_id);

        // 2. Update status of the duplicate pair
        db.prepare(`
          UPDATE duplicate_pairs
          SET status = 'CONFIRMED_DUPLICATE', keep_paper_id = ?, exclude_paper_id = ?
          WHERE id = ?
        `).run(keep_paper_id, exclude_paper_id, pair_id);
      });

      resolveTx();

      if (pair?.project_id) {
        clearSemanticSearchCache(pair.project_id);
      }

      return NextResponse.json({
        success: true,
        message: `Resolved duplicate pair. Excluded duplicate paper: ${exclude_paper_id}, kept primary paper: ${keep_paper_id}.`
      });
    }

    return NextResponse.json(
      { error: `Invalid action: ${action}. Expected KEEP_BOTH or CONFIRMED_DUPLICATE.` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to resolve duplicate pair' },
      { status: 500 }
    );
  }
}
