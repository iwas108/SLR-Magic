import os
import sys
import json
import warnings
import traceback

# Prevent any library warnings from contaminating stdout
warnings.simplefilter("ignore")

# Adjust path to import python_engine modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Set environment variable to suppress symlinks warnings
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# We must import libraries after setting up sys.path
import numpy as np
import sqlite3

from python_engine.core.config import PROJECT_DIR
from python_engine.core.db import get_connection
from python_engine.vector.index_manager import VectorIndexManager
from python_engine.vector.id_map import IDMap

def run_search(params):
    # Replicate semantic_search.py logic
    query = params.get("query")
    k = params.get("k", 1000)
    pool = params.get("pool")
    mode = params.get("mode", "papers")
    exclude_reviews = params.get("exclude_reviews", False)
    publisher = params.get("publisher")
    active_project_id = params.get("project_id", "")
    
    if not query or not query.strip():
        return {"error": "Query text cannot be empty"}
        
    try:
        conn = get_connection()
        cursor = conn.cursor()
    except Exception as e:
        return {"error": f"Failed to connect to database: {e}"}
        
    allowlist_ids = None
    
    if mode == "papers":
        # Always construct allowlist scoped by active_project_id
        try:
            query_parts = ["SELECT Paper_ID FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)"]
            sql_params = [active_project_id, active_project_id]
            
            if pool:
                pool_lower = pool.lower()
                if pool_lower == 'none':
                    query_parts.append("AND Paper_ID NOT IN (SELECT Paper_ID FROM calibration_papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)))")
                    sql_params.extend([active_project_id, active_project_id])
                elif pool_lower != 'all':
                    query_parts.append("AND Paper_ID IN (SELECT Paper_ID FROM calibration_papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND calibration_pool = ?)")
                    sql_params.extend([active_project_id, active_project_id, pool_lower])
                    
            if exclude_reviews:
                query_parts.append("AND Title NOT LIKE '%review%' AND (Abstract IS NULL OR Abstract NOT LIKE '%survey%')")
                
            if publisher and publisher.lower() != 'all':
                query_parts.append("AND Publisher = ?")
                sql_params.append(publisher)
                
            sql_query = " ".join(query_parts)
            cursor.execute(sql_query, tuple(sql_params))
            allowlist_ids = [r[0] for r in cursor.fetchall()]
        except Exception as e:
            conn.close()
            return {"error": f"Failed to fetch allowlist: {e}"}
            
        # Run paper vector search
        try:
            search_results = VectorIndexManager.search_papers_by_text(
                query, k=k, allowlist_paper_ids=allowlist_ids
            )
        except Exception as e:
            conn.close()
            return {"error": f"Semantic paper search failed: {e}"}
            
        if not search_results:
            conn.close()
            return {"results": []}
            
        # Enrich results with paper metadata and calibration pool/tag from slr.db
        paper_ids = [res['paper_id'] for res in search_results]
        placeholders = ",".join(["?"] * len(paper_ids))
        
        try:
            cursor.execute(
                f"""SELECT *,
                           (SELECT calibration_pool FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND (cp.Project_ID = papers.Project_ID OR CAST(cp.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as calibration_pool,
                           (SELECT calibration_tag FROM calibration_papers cp WHERE cp.Paper_ID = papers.Paper_ID AND (cp.Project_ID = papers.Project_ID OR CAST(cp.Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))) as calibration_tag
                    FROM papers WHERE Paper_ID IN ({placeholders}) AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))""",
                tuple(paper_ids) + (active_project_id, active_project_id)
            )
            columns = [col[0] for col in cursor.description]
            metadata_map = {}
            for row in cursor.fetchall():
                row_dict = dict(zip(columns, row))
                metadata_map[row_dict['Paper_ID']] = row_dict
        except Exception as e:
            conn.close()
            return {"error": f"Failed to fetch paper metadata: {e}"}
            
        # Reconstruct output preserving search rank order
        output_results = []
        for res in search_results:
            paper_id = res['paper_id']
            meta = metadata_map.get(paper_id)
            if meta:
                meta['semantic_score'] = res['score']
                output_results.append(meta)
                
        conn.close()
        return {"results": output_results}
        
    elif mode == "pdfs":
        try:
            # Query filenames of PDFs belonging to papers in active_project_id
            cursor.execute(
                "SELECT Paper_ID FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND Local_PDF_Path IS NOT NULL AND Local_PDF_Path != '' AND (is_duplicate IS NULL OR is_duplicate = 0)",
                (active_project_id, active_project_id)
            )
            proj_paper_ids = [r[0] for r in cursor.fetchall()]
            pdf_filenames = [f"{pid}.pdf" for pid in proj_paper_ids]
            
            search_results = VectorIndexManager.search_pdf_by_text(query, k=k, allowlist_filenames=pdf_filenames)
            conn.close()
            return {"results": search_results}
        except Exception as e:
            conn.close()
            return {"error": f"Semantic PDF search failed: {e}"}
            
    else:
        conn.close()
        return {"error": f"Unknown mode: {mode}"}

def run_traps(params):
    # Replicate find_traps.py logic
    seed = params.get("seed")
    k = params.get("k", 1000)
    active_project_id = params.get("project_id", "")
    
    if not seed:
        return {"error": "seedPaperId is required"}
        
    try:
        conn = get_connection()
        cursor = conn.cursor()
    except Exception as e:
        return {"error": f"Failed to connect to database: {e}"}
        
    # Fetch seed paper Title + Abstract
    try:
        cursor.execute(
            "SELECT Title, Abstract FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND Paper_ID = ?",
            (active_project_id, active_project_id, seed)
        )
        seed_row = cursor.fetchone()
        if not seed_row:
            conn.close()
            return {"error": f"Seed paper {seed} not found in database."}
        seed_title, seed_abstract = seed_row
    except Exception as e:
        conn.close()
        return {"error": f"Failed to fetch seed paper info: {e}"}
        
    # Get allowlist of UNASSIGNED papers
    try:
        cursor.execute(
            "SELECT Paper_ID FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND Paper_ID NOT IN (SELECT Paper_ID FROM calibration_papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))) AND (is_duplicate IS NULL OR is_duplicate = 0) AND Paper_ID != ?",
            (active_project_id, active_project_id, active_project_id, active_project_id, seed)
        )
        allowlist_ids = [r[0] for r in cursor.fetchall()]
    except Exception as e:
        conn.close()
        return {"error": f"Failed to query unassigned papers: {e}"}
        
    if not allowlist_ids:
        conn.close()
        return {"results": []}
        
    # Perform vector search using seed paper text
    query_text = f"{seed_title} {seed_abstract}" if seed_abstract else seed_title
    try:
        search_results = VectorIndexManager.search_papers_by_text(
            query_text, k=k, allowlist_paper_ids=allowlist_ids
        )
    except Exception as e:
        conn.close()
        return {"error": f"Semantic trap search failed: {e}"}
        
    if not search_results:
        conn.close()
        return {"results": []}
        
    # Enrich results with paper metadata
    paper_ids = [res['paper_id'] for res in search_results]
    placeholders = ",".join(["?"] * len(paper_ids))
    try:
        cursor.execute(
            f"SELECT * FROM papers WHERE Paper_ID IN ({placeholders}) AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))",
            tuple(paper_ids) + (active_project_id, active_project_id)
        )
        columns = [col[0] for col in cursor.description]
        metadata_map = {}
        for row in cursor.fetchall():
            row_dict = dict(zip(columns, row))
            metadata_map[row_dict['Paper_ID']] = row_dict
    except Exception as e:
        conn.close()
        return {"error": f"Failed to query metadata: {e}"}
        
    output_results = []
    for res in search_results:
        paper_id = res['paper_id']
        meta = metadata_map.get(paper_id)
        if meta:
            meta['semantic_score'] = res['score']
            output_results.append(meta)
            
    conn.close()
    return {"results": output_results}

def main():
    # Warm up SentenceTransformer on startup
    try:
        # Load the model and make a dummy embedding to trigger full compilation/load
        VectorIndexManager.get_paper_index()
        # This will lazy-load the model
        from python_engine.vector.embedder import TextEmbedder
        TextEmbedder.embed_text("warmup", is_query=True)
        # Notify Node.js that the server is ready
        print(json.dumps({"status": "ready"}))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"status": "error", "error": f"Failed to initialize: {e}"}))
        sys.stdout.flush()
        sys.exit(1)
        
    # Read loop from stdin
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            action = req.get("action")
            
            if action == "ping":
                res = {"id": req_id, "status": "ok", "message": "pong"}
            elif action == "search":
                res_data = run_search(req)
                if "error" in res_data:
                    res = {"id": req_id, "status": "error", "error": res_data["error"]}
                else:
                    res = {"id": req_id, "status": "ok", "results": res_data["results"]}
            elif action == "traps":
                res_data = run_traps(req)
                if "error" in res_data:
                    res = {"id": req_id, "status": "error", "error": res_data["error"]}
                else:
                    res = {"id": req_id, "status": "ok", "results": res_data["results"]}
            else:
                res = {"id": req_id, "status": "error", "error": f"Unknown action: {action}"}
        except Exception as e:
            res = {
                "id": req.get("id") if isinstance(req, dict) else None,
                "status": "error", 
                "error": f"Internal error: {e}", 
                "traceback": traceback.format_exc()
            }
            
        print(json.dumps(res))
        sys.stdout.flush()

if __name__ == "__main__":
    main()
