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
    parser.add_argument("--project", type=str, required=True, help="Active Project ID (mandatory)")
    parser.add_argument("--k", type=int, default=1000, help="Number of results to return.")
    parser.add_argument("--pool", type=str, default=None, help="Calibration pool filter ('none', 'pool_a', 'pool_b', 'pool_c').")
    parser.add_argument("--mode", type=str, default="papers", choices=["papers", "pdfs"], help="Search index mode.")
    parser.add_argument("--exclude-reviews", action="store_true", help="Exclude review and survey papers.")
    parser.add_argument("--publisher", type=str, default=None, help="Publisher filter.")
    args = parser.parse_args()

    active_project_id = args.project
    conn = get_connection()
    cursor = conn.cursor()

    allowlist_ids = None

    if args.mode == "papers":
        # Always construct allowlist scoped by active_project_id
        try:
            query_parts = ["SELECT Paper_ID FROM papers WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)"]
            params = [active_project_id]
            
            if args.pool:
                pool_lower = args.pool.lower()
                if pool_lower == 'none':
                    query_parts.append("AND Paper_ID NOT IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ?)")
                    params.append(active_project_id)
                elif pool_lower != 'all':
                    query_parts.append("AND Paper_ID IN (SELECT Paper_ID FROM calibration_papers WHERE Project_ID = ? AND calibration_pool = ?)")
                    params.extend([active_project_id, pool_lower])
                    
            if args.exclude_reviews:
                query_parts.append("AND Title NOT LIKE '%review%' AND (Abstract IS NULL OR Abstract NOT LIKE '%survey%')")

            if args.publisher and args.publisher.lower() != 'all':
                query_parts.append("AND Publisher = ?")
                params.append(args.publisher)
                
            sql_query = " ".join(query_parts)
            cursor.execute(sql_query, tuple(params))
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
                f"SELECT * FROM papers WHERE Paper_ID IN ({placeholders}) AND Project_ID = ?",
                tuple(paper_ids) + (active_project_id,)
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
