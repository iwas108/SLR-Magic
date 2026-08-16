import os
import sys
import time
import json
import sqlite3
import re
import argparse

from python_engine.core.config import DB_PATH
from python_engine.pdf.validator import extract_doi_value
from rapidfuzz import fuzz

def clean_doi(doi_str):
    if not doi_str:
        return None
    doi_val = extract_doi_value(doi_str)
    if not doi_val:
        return None
    return doi_val.strip().lower()

def extract_scopus_ids(authors_str):
    if not authors_str:
        return set()
    return set(re.findall(r'\((\d+)\)', authors_str))

def extract_author_last_names(authors_str):
    if not authors_str:
        return set()
    authors = re.split(r'[,;]|\band\b', authors_str)
    last_names = set()
    for auth in authors:
        auth = auth.strip()
        if not auth:
            continue
        words = re.findall(r'[a-zA-Z\u00C0-\u017F]+', auth.lower())
        words = [w for w in words if len(w) > 1]
        if words:
            last_names.add(words[0])
            last_names.add(words[-1])
    return last_names

def get_first_author_last_name(authors_str):
    if not authors_str:
        return []
    first_author = re.split(r'[,;]|\band\b', authors_str)[0].strip()
    words = re.findall(r'[a-zA-Z\u00C0-\u017F]+', first_author.lower())
    if not words:
        return []
    return list(set([words[0], words[-1]]))

def main():
    parser = argparse.ArgumentParser(description="SLR Magic Duplicate Paper Detector")
    parser.add_argument("--project", type=str, help="Project ID to scan")
    args = parser.parse_args()

    # Reconfigure stdout to use utf-8 to avoid encoding crashes on titles with special characters
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    if not os.path.exists(str(DB_PATH)):
        print(json.dumps({"event": "error", "message": f"Database slr.db not found at {DB_PATH}."}))
        sys.exit(1)

    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()

    # Resolve project ID
    project_id = args.project
    if not project_id:
        cursor.execute("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'")
        active_proj_row = cursor.fetchone()
        project_id = active_proj_row[0] if active_proj_row else ''

    print(json.dumps({"event": "log", "message": f"Starting duplicate scan for project: {project_id}"}))
    sys.stdout.flush()

    # 1. Fetch already scanned or resolved duplicate pairs to avoid duplicate checks or re-inserts
    cursor.execute("""
        SELECT paper1_id, paper2_id 
        FROM duplicate_pairs 
        WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))
    """, (project_id, project_id))
    existing_rows = cursor.fetchall()
    
    # Store existing pairs as set of canonical tuples
    existing_pairs = set()
    for p1, p2 in existing_rows:
        existing_pairs.add((p1, p2))
        existing_pairs.add((p2, p1))

    # 2. Load all active papers (is_duplicate = 0)
    cursor.execute("""
        SELECT Paper_ID, DOI, Title, Authors, Year, Abstract, Local_PDF_Status
        FROM papers
        WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)
    """, (project_id, project_id))
    papers = cursor.fetchall()
    total_papers = len(papers)

    print(json.dumps({"event": "start", "total": total_papers}))
    sys.stdout.flush()

    if total_papers < 2:
        print(json.dumps({"event": "complete", "processed": total_papers, "found_duplicates": 0}))
        conn.close()
        return

    # 3. Apply Blocking Heuristics
    blocks = {}
    for paper in papers:
        paper_id, doi, title, authors, year, abstract, local_pdf_status = paper
        
        # Block by Year: within +/- 1 year
        if year is not None:
            try:
                y_val = int(year)
                for y in [y_val - 1, y_val, y_val + 1]:
                    key = f"yr_{y}"
                    blocks.setdefault(key, []).append(paper)
            except ValueError:
                pass
                
        # Block by first author's last/first name words
        author_keys = get_first_author_last_name(authors)
        for ak in author_keys:
            key = f"auth_{ak}"
            blocks.setdefault(key, []).append(paper)

    # 4. Perform Comparisons paper-by-paper
    compared_pairs = set()
    new_duplicate_pairs = []
    duplicate_count = 0

    last_emit_time = 0.0
    emit_interval = 0.1 # seconds (100 milliseconds throttling)

    for idx, p1 in enumerate(papers):
        id1, doi1_raw, title1, authors1, year1, abstract1, pdf_status1 = p1
        
        # Deduplicate candidate papers using a dict keyed by paper ID
        candidate_papers = {}
        
        # Resolve blocks for p1
        p1_block_keys = []
        if year1 is not None:
            try:
                y_val = int(year1)
                for y in [y_val - 1, y_val, y_val + 1]:
                    p1_block_keys.append(f"yr_{y}")
            except ValueError:
                pass
        author_keys = get_first_author_last_name(authors1)
        for ak in author_keys:
            p1_block_keys.append(f"auth_{ak}")
            
        for key in p1_block_keys:
            if key in blocks:
                for cand in blocks[key]:
                    candidate_papers[cand[0]] = cand
                    
        # Compare with each unique candidate paper
        for p2 in candidate_papers.values():
            id2, doi2_raw, title2, authors2, year2, abstract2, pdf_status2 = p2
            if id1 == id2:
                continue
                
            # Canonical pair key
            pair_key = (min(id1, id2), max(id1, id2))
            
            if pair_key in compared_pairs or pair_key in existing_pairs:
                continue
                
            compared_pairs.add(pair_key)
            
            # Heuristic Matching Logic
            is_dup = False
            reason = ""
            similarity_score = 0.0
            shared_authors_count = 0
            
            # A. Exact DOI Match
            doi1 = clean_doi(doi1_raw)
            doi2 = clean_doi(doi2_raw)
            if doi1 and doi2 and doi1 == doi2:
                is_dup = True
                reason = "EXACT_DOI_MATCH"
                similarity_score = 100.0
                
            # B. Title Similarity & Scopus ID Match
            if not is_dup:
                similarity_score = float(fuzz.token_set_ratio(title1, title2))
                ids1 = extract_scopus_ids(authors1)
                ids2 = extract_scopus_ids(authors2)
                if ids1 and ids2:
                    shared_ids = ids1.intersection(ids2)
                    shared_authors_count = len(shared_ids)
                    if shared_authors_count >= 2 and similarity_score > 70.0:
                        is_dup = True
                        reason = f"SCOPUS_ID_MATCH_{shared_authors_count}_AUTHORS"
                        
            # C. Fallback Name Match or High Title Similarity
            if not is_dup:
                if similarity_score >= 95.0:
                    is_dup = True
                    reason = f"HIGH_TITLE_SIMILARITY_{similarity_score:.1f}"
                elif similarity_score > 80.0:
                    names1 = extract_author_last_names(authors1)
                    names2 = extract_author_last_names(authors2)
                    if names1 and names2:
                        shared_names = names1.intersection(names2)
                        shared_authors_count = len(shared_names)
                        if shared_authors_count >= 2:
                            is_dup = True
                            reason = f"AUTHOR_NAME_MATCH_{shared_authors_count}_AUTHORS"
                            
            if is_dup:
                duplicate_count += 1
                created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                new_duplicate_pairs.append((
                    project_id,
                    pair_key[0],  # paper1_id
                    pair_key[1],  # paper2_id
                    similarity_score,
                    shared_authors_count,
                    "PENDING",
                    created_at
                ))
                
                print(json.dumps({
                    "event": "log",
                    "message": f"[DUPLICATE FOUND] Similarity: {similarity_score:.1f}%, Reason: {reason}\n  Paper 1: {title1} ({id1})\n  Paper 2: {title2} ({id2})"
                }))
                sys.stdout.flush()

        # Report progress dynamically (with rate-limiting/throttling)
        current_time = time.time()
        if (current_time - last_emit_time >= emit_interval) or (idx + 1 == total_papers):
            print(json.dumps({
                "event": "progress",
                "current": idx + 1,
                "total": total_papers,
                "paper_id": id1,
                "title": title1,
                "found_duplicates": duplicate_count
            }))
            sys.stdout.flush()
            last_emit_time = current_time

    # 5. Batch memory insertion
    if new_duplicate_pairs:
        try:
            print(json.dumps({"event": "log", "message": f"Saving {len(new_duplicate_pairs)} new candidate pairs to database..."}))
            sys.stdout.flush()
            
            cursor.executemany("""
                INSERT INTO duplicate_pairs (
                    project_id, paper1_id, paper2_id, similarity_score, shared_authors_count, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, new_duplicate_pairs)
            conn.commit()
        except Exception as e:
            print(json.dumps({"event": "error", "message": f"Failed to insert duplicate pairs: {str(e)}"}))
            sys.stdout.flush()

    print(json.dumps({
        "event": "complete",
        "processed": total_papers,
        "found_duplicates": duplicate_count
    }))
    sys.stdout.flush()
    conn.close()

if __name__ == '__main__':
    main()
