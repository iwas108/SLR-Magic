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
    parser = argparse.ArgumentParser(description="Perform semantic search on vector indices.")
    parser.add_argument("--query", type=str, required=True, help="Query search text.")
    parser.add_argument("--k", type=int, default=20, help="Number of results to return.")
    parser.add_argument("--pool", type=str, default=None, help="Calibration pool filter ('none', 'pool_a', 'pool_b', 'pool_c').")
    parser.add_argument("--mode", type=str, default="papers", choices=["papers", "pdfs"], help="Search index mode.")
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

    allowlist_ids = None

    if args.mode == "papers":
        # Resolve allowlist based on pool configuration
        if args.pool:
            try:
                if args.pool.lower() == 'none':
                    cursor.execute(
                        "SELECT Paper_ID FROM papers WHERE Project_ID = ? AND (calibration_pool IS NULL OR calibration_pool = '') AND (is_duplicate IS NULL OR is_duplicate = 0)",
                        (active_project_id,)
                    )
                else:
                    cursor.execute(
                        "SELECT Paper_ID FROM papers WHERE Project_ID = ? AND calibration_pool = ? AND (is_duplicate IS NULL OR is_duplicate = 0)",
                        (active_project_id, args.pool.lower())
                    )
                allowlist_ids = [r[0] for r in cursor.fetchall()]
            except Exception as e:
                print(json.dumps({"error": f"Failed to fetch allowlist: {e}"}))
                sys.exit(1)

        # Run paper vector search (automatically handles nomic search_query: prefix)
        try:
            search_results = VectorIndexManager.search_papers_by_text(
                args.query, k=args.k, allowlist_paper_ids=allowlist_ids
            )
        except Exception as e:
            print(json.dumps({"error": f"Semantic paper search failed: {e}"}))
            sys.exit(1)

        # Enrich results with paper metadata from slr.db
        if not search_results:
            print(json.dumps({"results": []}))
            sys.exit(0)

        # Get list of returned paper IDs
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
            print(json.dumps({"error": f"Failed to fetch paper metadata: {e}"}))
            sys.exit(1)

        # Reconstruct output preserving search rank order
        output_results = []
        for res in search_results:
            paper_id = res['paper_id']
            meta = metadata_map.get(paper_id)
            if meta:
                meta['semantic_score'] = res['score']
                output_results.append(meta)

        print(json.dumps({"results": output_results}))

    elif args.mode == "pdfs":
        # Run PDF cache search (prefixed with search_query:)
        try:
            search_results = VectorIndexManager.search_pdf_by_text(args.query, k=args.k)
            print(json.dumps({"results": search_results}))
        except Exception as e:
            print(json.dumps({"error": f"Semantic PDF search failed: {e}"}))
            sys.exit(1)

    conn.close()

if __name__ == "__main__":
    main()
