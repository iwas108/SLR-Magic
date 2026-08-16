import os
import sys
import json
import sqlite3
import argparse
import numpy as np

# Adjust path to import python_engine modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from python_engine.core.config import PROJECT_DIR, DB_PATH, CACHE_INDEX_DB_PATH
from python_engine.core.db import get_connection, get_cache_index_connection
from python_engine.vector.embedder import TextEmbedder
from python_engine.vector.id_map import IDMap, ID_MAP_DB_PATH
from python_engine.vector.index_manager import VectorIndexManager, PDF_INDEX_PATH, PAPER_INDEX_PATH

def print_event(event):
    print(json.dumps(event))
    sys.stdout.flush()

def main():
    parser = argparse.ArgumentParser(description="Build or rebuild turbovec semantic indices.")
    parser.add_argument("--rebuild", action="store_true", help="Delete existing indices and rebuild from scratch.")
    parser.add_argument("--project", required=True, help="Active Project ID (mandatory)")
    args = parser.parse_args()

    active_project_id = args.project

    if args.rebuild:
        print_event({"event": "log", "message": "Rebuild flag detected. Clearing existing indices and ID maps..."})
        # Delete index files
        for path in [PDF_INDEX_PATH, PAPER_INDEX_PATH]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as e:
                    print_event({"event": "log", "message": f"Warning: Failed to delete index file {path}: {e}"})
        
        # Clear ID map DB table
        if os.path.exists(ID_MAP_DB_PATH):
            try:
                conn_id = IDMap.get_connection()
                conn_id.execute("DELETE FROM id_map")
                conn_id.commit()
            except Exception as e:
                print_event({"event": "log", "message": f"Warning: Failed to clear id_map table: {e}"})

    # Get IDMap connection
    conn_id = IDMap.get_connection()
    cursor_id = conn_id.cursor()

    # 1. Build Paper Corpus Vectors
    print_event({"event": "log", "message": f"Phase 1: Indexing Paper Corpus for project {active_project_id}..."})
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT Paper_ID, Title, Abstract FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)", 
            (active_project_id, active_project_id)
        )
        paper_records = cursor.fetchall()
        conn.close()
    except Exception as e:
        print_event({"error": f"Failed to fetch papers: {e}"})
        sys.exit(1)

    # Get already embedded Paper IDs
    cursor_id.execute("SELECT string_id FROM id_map WHERE source = 'paper'")
    already_indexed_papers = {r[0] for r in cursor_id.fetchall()}

    papers_to_embed = []
    for paper_id, title, abstract in paper_records:
        if paper_id not in already_indexed_papers:
            papers_to_embed.append((paper_id, title, abstract))

    total_papers = len(papers_to_embed)
    paper_vectors_indexed = 0
    if total_papers > 0:
        print_event({"event": "log", "message": f"Embedding {total_papers} new papers in batches..."})
        batch_size = 64
        paper_index = VectorIndexManager.get_paper_index()
        for idx in range(0, total_papers, batch_size):
            batch = papers_to_embed[idx : idx + batch_size]
            paper_ids = [item[0] for item in batch]
            combined_texts = [f"{item[1]} {item[2]}" if item[2] else item[1] for item in batch]
            
            # Embed batch
            embeddings = TextEmbedder.embed_batch(combined_texts, is_query=False)
            
            # Add to index
            ids = []
            for paper_id in paper_ids:
                uint64_id = IDMap.get_or_create_uint64(paper_id, 'paper')
                ids.append(uint64_id)
            
            paper_index.add_with_ids(embeddings, np.array(ids, dtype=np.uint64))
            
            paper_vectors_indexed += len(batch)
            paper_index.write(PAPER_INDEX_PATH)
            print_event({
                "event": "embedding",
                "current": paper_vectors_indexed,
                "total": total_papers,
                "source": "paper_corpus"
            })
        paper_index.write(PAPER_INDEX_PATH)
    else:
        print_event({"event": "log", "message": "Paper Corpus is already up to date."})

    # 2. Build PDF Cache Vectors
    print_event({"event": "log", "message": "Phase 2: Indexing PDF Cache..."})
    try:
        conn_idx = get_cache_index_connection()
        cursor_idx = conn_idx.cursor()
        cursor_idx.execute("SELECT filename, page1_text FROM pdf_cache WHERE page1_text IS NOT NULL AND page1_text != ''")
        pdf_records = cursor_idx.fetchall()
        conn_idx.close()
    except Exception as e:
        print_event({"event": "log", "message": f"Warning: Failed to fetch from pdf_cache index: {e}"})
        pdf_records = []

    # Get already embedded PDF filenames
    cursor_id.execute("SELECT string_id FROM id_map WHERE source = 'pdf_cache'")
    already_indexed_pdfs = {r[0] for r in cursor_id.fetchall()}

    pdfs_to_embed = []
    for filename, text in pdf_records:
        if filename not in already_indexed_pdfs:
            pdfs_to_embed.append((filename, text))

    total_pdfs = len(pdfs_to_embed)
    pdf_vectors_indexed = 0
    if total_pdfs > 0:
        print_event({"event": "log", "message": f"Embedding {total_pdfs} new cached PDFs in batches..."})
        batch_size = 32
        pdf_index = VectorIndexManager.get_pdf_index()
        for idx in range(0, total_pdfs, batch_size):
            batch = pdfs_to_embed[idx : idx + batch_size]
            filenames = [item[0] for item in batch]
            texts = [item[1] for item in batch]
            
            # Embed batch
            embeddings = TextEmbedder.embed_batch(texts, is_query=False)
            
            # Add to index
            ids = []
            for filename in filenames:
                uint64_id = IDMap.get_or_create_uint64(filename, 'pdf_cache')
                ids.append(uint64_id)
            
            pdf_index.add_with_ids(embeddings, np.array(ids, dtype=np.uint64))
            
            pdf_vectors_indexed += len(batch)
            print_event({
                "event": "embedding",
                "current": pdf_vectors_indexed,
                "total": total_pdfs,
                "source": "pdf_cache"
            })
        pdf_index.write(PDF_INDEX_PATH)
    else:
        print_event({"event": "log", "message": "PDF Cache is already up to date."})

    # Output stats
    cursor_id.execute("SELECT COUNT(*) FROM id_map WHERE source = 'pdf_cache'")
    total_cached_pdfs = cursor_id.fetchone()[0]
    cursor_id.execute("SELECT COUNT(*) FROM id_map WHERE source = 'paper'")
    total_cached_papers = cursor_id.fetchone()[0]

    print_event({
        "event": "complete",
        "pdf_vectors": total_cached_pdfs,
        "paper_vectors": total_cached_papers
    })

if __name__ == "__main__":
    main()
