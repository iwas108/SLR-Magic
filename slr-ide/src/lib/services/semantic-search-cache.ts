import db from '@/lib/db';

export interface CachedResult {
  Paper_ID: string;
  semantic_score: number;
}

/**
 * Gets cached semantic search results for a project, query, and pool filter,
 * and fetches the latest metadata for each paper to ensure fresh data.
 */
export function getCachedSemanticSearch(
  projectId: string,
  query: string,
  pool: string
): any[] | null {
  try {
    const trimmedQuery = query.trim();
    const poolFilter = pool || 'all';

    const row = db.prepare(`
      SELECT results FROM semantic_search_cache
      WHERE project_id = ? AND query_text = ? AND pool_filter = ?
    `).get(projectId, trimmedQuery, poolFilter) as { results: string } | undefined;

    if (!row) return null;

    const cachedList = JSON.parse(row.results) as CachedResult[];
    if (cachedList.length === 0) return [];
    // If cached set has fewer than 100 items, treat as legacy capped cache and force fresh vector search
    if (cachedList.length < 100) return null;

    // Extract paper IDs
    const paperIds = cachedList.map(item => item.Paper_ID);
    const placeholders = paperIds.map(() => '?').join(',');

    // Fetch current metadata from papers table, including parent paper details and calibration pool/tag
    const papers = db.prepare(`
      SELECT *, 
             (SELECT calibration_pool FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND cp.Project_ID = papers.Project_ID) as calibration_pool,
             (SELECT calibration_tag FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND cp.Project_ID = papers.Project_ID) as calibration_tag,
             (SELECT Title FROM papers parent WHERE parent.Paper_ID = papers.Parent_Paper_ID AND parent.Project_ID = papers.Project_ID) as Parent_Paper_Title
      FROM papers
      WHERE Paper_ID IN (${placeholders}) AND Project_ID = ?
    `).all(...paperIds, projectId) as any[];

    const paperMap = new Map<string, any>(papers.map(p => [p.Paper_ID, p]));

    // Reconstruct list in the original order, preserving semantic scores
    const orderedResults: any[] = [];
    for (const cachedItem of cachedList) {
      const paper = paperMap.get(cachedItem.Paper_ID);
      // Ensure the paper still exists and belongs to this project
      if (paper && paper.Project_ID === projectId) {
        paper.semantic_score = cachedItem.semantic_score;
        orderedResults.push(paper);
      }
    }

    return orderedResults;
  } catch (error) {
    console.error('Error fetching from semantic search cache:', error);
    return null;
  }
}

/**
 * Saves a list of semantic search results to the SQLite cache table.
 */
export function saveCachedSemanticSearch(
  projectId: string,
  query: string,
  pool: string,
  results: any[]
): void {
  try {
    const trimmedQuery = query.trim();
    const poolFilter = pool || 'all';

    // Extract only Paper_ID and semantic_score to prevent data redundancy and stale metadata issues
    const cacheData: CachedResult[] = results.map((r: any) => ({
      Paper_ID: r.Paper_ID,
      semantic_score: r.semantic_score
    }));

    db.prepare(`
      INSERT INTO semantic_search_cache (project_id, query_text, pool_filter, results, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id, query_text, pool_filter)
      DO UPDATE SET results = excluded.results, created_at = excluded.created_at
    `).run(projectId, trimmedQuery, poolFilter, JSON.stringify(cacheData), new Date().toISOString());
  } catch (error) {
    console.error('Error saving to semantic search cache:', error);
  }
}

/**
 * Clears the semantic search cache.
 * If projectId is provided, only cache entries for that project are removed.
 */
export function clearSemanticSearchCache(projectId?: string): void {
  try {
    if (projectId) {
      db.prepare('DELETE FROM semantic_search_cache WHERE project_id = ?').run(projectId);
    } else {
      db.prepare('DELETE FROM semantic_search_cache').run();
    }
  } catch (error) {
    console.error('Error clearing semantic search cache:', error);
  }
}
