import os
import sys
import json
import sqlite3
import argparse

# Adjust path to import python_engine modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from python_engine.core.config import PROJECT_DIR
from python_engine.core.db import get_connection
from python_engine.vector.index_manager import VectorIndexManager

def main():
    parser = argparse.ArgumentParser(description="Find semantic near-miss traps for calibration pools.")
    parser.add_argument("--seed", type=str, required=True, help="Seed Paper_ID (known include).")
    parser.add_argument("--k", type=int, default=25, help="Number of traps to find.")
    args = parser.parse_args()

    # Fetch active project ID from configs
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'")
        row = cursor.fetchone()
        active_project_id = row[0] if row else 'default-project'
    except Exception as e:
        print(json.dumps({"error": f"Failed to connect to database: {e}"}))
        sys.exit(1)

    # 1. Fetch seed paper Title + Abstract
    try:
        cursor.execute(
            "SELECT Title, Abstract FROM papers WHERE Project_ID = ? AND Paper_ID = ?",
            (active_project_id, args.seed)
        )
        seed_row = cursor.fetchone()
        if not seed_row:
            print(json.dumps({"error": f"Seed paper {args.seed} not found in database."}))
            sys.exit(1)
        seed_title, seed_abstract = seed_row
    except Exception as e:
        print(json.dumps({"error": f"Failed to fetch seed paper info: {e}"}))
        sys.exit(1)

    # 2. Get allowlist of UNASSIGNED papers
    try:
        cursor.execute(
            "SELECT Paper_ID FROM papers WHERE Project_ID = ? AND (calibration_pool IS NULL OR calibration_pool = '') AND (is_duplicate IS NULL OR is_duplicate = 0) AND Paper_ID != ?",
            (active_project_id, args.seed)
        )
        allowlist_ids = [r[0] for r in cursor.fetchall()]
    except Exception as e:
        print(json.dumps({"error": f"Failed to query unassigned papers: {e}"}))
        sys.exit(1)

    if not allowlist_ids:
        print(json.dumps({"results": []}))
        sys.exit(0)

    # 3. Perform vector search using seed paper text
    query_text = f"{seed_title} {seed_abstract}" if seed_abstract else seed_title
    try:
        search_results = VectorIndexManager.search_papers_by_text(
            query_text, k=args.k, allowlist_paper_ids=allowlist_ids
        )
    except Exception as e:
        print(json.dumps({"error": f"Semantic trap search failed: {e}"}))
        sys.exit(1)

    if not search_results:
        print(json.dumps({"results": []}))
        sys.exit(0)

    # 4. Enrich results with paper metadata
    paper_ids = [res['paper_id'] for res in search_results]
    placeholders = ",".join(["?"] * len(paper_ids))
    try:
        cursor.execute(
            f"SELECT * FROM papers WHERE Paper_ID IN ({placeholders})",
            tuple(paper_ids)
        )
        columns = [col[0] for col in cursor.description]
        metadata_map = {}
        for row in cursor.fetchall():
            row_dict = dict(zip(columns, row))
            metadata_map[row_dict['Paper_ID']] = row_dict
    except Exception as e:
        print(json.dumps({"error": f"Failed to query metadata: {e}"}))
        sys.exit(1)

    output_results = []
    for res in search_results:
        paper_id = res['paper_id']
        meta = metadata_map.get(paper_id)
        if meta:
            meta['semantic_score'] = res['score']
            output_results.append(meta)

    print(json.dumps({"results": output_results}))
    conn.close()

if __name__ == "__main__":
    main()
