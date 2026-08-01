import os
import sys
import time
import json
import sqlite3
import urllib.request
import urllib.parse
import re

from python_engine.core.config import DB_PATH, PROJECT_DIR
from python_engine.pdf.validator import extract_doi_value

def normalize_publisher_heuristics(raw_str):
    if not raw_str:
        return "Other"
    
    raw_str = raw_str.strip()
    # Case insensitive search
    raw_str_lower = raw_str.lower()
    
    # Elsevier
    if re.search(r'\belsevier\b', raw_str_lower):
        return "Elsevier"
    # Springer / Springer Nature
    if re.search(r'\bspringer\b|\bspringer\s*nature\b', raw_str_lower):
        return "Springer"
    # IEEE
    if re.search(r'\bieee\b|institute of electrical and electronics engineers', raw_str_lower):
        return "IEEE"
    # ACM
    if re.search(r'\bacm\b|association for computing machinery', raw_str_lower):
        return "ACM"
    # Wiley
    if re.search(r'\bwiley\b', raw_str_lower):
        return "Wiley"
    # Taylor & Francis
    if re.search(r'\btaylor\s*(?:&|and)\s*francis\b|\binforma\b', raw_str_lower):
        return "Taylor & Francis"
    # MDPI
    if re.search(r'\bmdpi\b', raw_str_lower):
        return "MDPI"
    # Oxford University Press
    if re.search(r'\boxford\s*university\s*press\b|\boup\b', raw_str_lower):
        return "Oxford University Press"
    # Cambridge University Press
    if re.search(r'\bcambridge\s*university\s*press\b|\bcup\b', raw_str_lower):
        return "Cambridge University Press"
    # Sage
    if re.search(r'\bsage\b', raw_str_lower):
        return "Sage"
    # Nature Portfolio / Nature Publishing Group
    if re.search(r'\bnature\s*publishing\b|\bnature\s*portfolio\b', raw_str_lower):
        return "Nature"
    # Science / AAAS
    if re.search(r'\baaas\b|\bscience\b|\bamerican\s*association\s*for\s*the\s*advancement\s*of\s*science\b', raw_str_lower):
        return "Science"
    # PLOS
    if re.search(r'\bplos\b|\bpublic\s*library\s*of\s*science\b', raw_str_lower):
        return "PLOS"
    # IOP Publishing
    if re.search(r'\biop\b|\binstitute\s*of\s*physics\b', raw_str_lower):
        return "IOP"
    # BMJ
    if re.search(r'\bbmj\b|\bbritish\s*medical\s*journal\b', raw_str_lower):
        return "BMJ"
    # Emerald
    if re.search(r'\bemerald\b', raw_str_lower):
        return "Emerald"
    
    return "Other"

def query_crossref_api(doi):
    if not doi:
        return None
    
    doi = doi.strip()
    encoded_doi = urllib.parse.quote(doi)
    url = f"https://api.crossref.org/works/{encoded_doi}"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'SLR-Magic/1.0 (mailto:slrmagic@localhost)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                publisher = data.get('message', {}).get('publisher')
                return publisher
    except Exception as e:
        # Silent exception or warning log can be issued by the caller
        pass
    return None

def main():
    if not os.path.exists(DB_PATH):
        print(json.dumps({"event": "error", "message": "Database slr.db not found."}))
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()

    # Fetch active project ID from CLI flags or configs
    active_proj_id = None
    for i in range(1, len(sys.argv)):
        if sys.argv[i] == '--project' and i + 1 < len(sys.argv):
            active_proj_id = sys.argv[i+1]

    if not active_proj_id:
        cursor.execute("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'")
        active_proj_row = cursor.fetchone()
        active_proj_id = active_proj_row[0] if active_proj_row else 'default-project'

    # Fetch papers for the active project
    force_update = '--force-update' in sys.argv

    if force_update:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title, Original_Publisher, Publisher
            FROM papers
            WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
        """, (active_proj_id,))
    else:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title, Original_Publisher, Publisher
            FROM papers
            WHERE Project_ID = ? AND (Publisher IS NULL OR Publisher = '') AND (is_duplicate IS NULL OR is_duplicate = 0)
        """, (active_proj_id,))
    papers = cursor.fetchall()
    total = len(papers)

    print(json.dumps({"event": "start", "total": total}))
    sys.stdout.flush()

    if total == 0:
        print(json.dumps({"event": "complete", "processed": 0, "failed": 0}))
        conn.close()
        return

    success_count = 0
    fail_count = 0

    for i, paper in enumerate(papers):
        paper_id, doi_raw, title, original_publisher, current_publisher = paper
        
        # Report progress
        print(json.dumps({
            "event": "progress",
            "current": i + 1,
            "total": total,
            "paper_id": paper_id,
            "title": title
        }))
        sys.stdout.flush()

        doi = extract_doi_value(doi_raw) if doi_raw else None
        
        # Run Step 1: The Fast Path (Local Normalization)
        final_publisher = "Other"
        fast_path_publisher = normalize_publisher_heuristics(original_publisher)
        
        if fast_path_publisher != "Other":
            final_publisher = fast_path_publisher
            print(json.dumps({
                "event": "log",
                "message": f"[{paper_id}] Fast Path Match: '{original_publisher}' -> '{final_publisher}'"
            }))
            sys.stdout.flush()
        else:
            # Run Step 2: The Slow Path (API Fallback)
            if doi:
                print(json.dumps({
                    "event": "log",
                    "message": f"[{paper_id}] Slow Path Crossref query for DOI: {doi}"
                }))
                sys.stdout.flush()
                crossref_publisher = query_crossref_api(doi)
                
                if crossref_publisher:
                    # Run Step 3: The Final Filter
                    filtered_publisher = normalize_publisher_heuristics(crossref_publisher)
                    if filtered_publisher != "Other":
                        final_publisher = filtered_publisher
                    else:
                        final_publisher = crossref_publisher
                        
                    print(json.dumps({
                        "event": "log",
                        "message": f"[{paper_id}] Slow Path Success: Crossref '{crossref_publisher}' -> '{final_publisher}'"
                    }))
                    sys.stdout.flush()
                else:
                    final_publisher = fast_path_publisher # Falls back to original heuristic ("Other" or whatever it returned)
                    print(json.dumps({
                        "event": "log",
                        "message": f"[{paper_id}] Crossref query failed. Defaulting to: '{final_publisher}'"
                    }))
                    sys.stdout.flush()
            else:
                final_publisher = fast_path_publisher
                print(json.dumps({
                    "event": "log",
                    "message": f"[{paper_id}] No DOI available. Defaulting to: '{final_publisher}'"
                }))
                sys.stdout.flush()

        # Update paper in database
        try:
            cursor.execute("""
                UPDATE papers
                SET Publisher = ?
                WHERE Paper_ID = ? AND Project_ID = ?
            """, (final_publisher, paper_id, active_proj_id))
            conn.commit()
            success_count += 1
            print(json.dumps({"event": "paper_success", "paper_id": paper_id, "title": title}))
            sys.stdout.flush()
        except Exception as e:
            fail_count += 1
            print(json.dumps({
                "event": "paper_fail",
                "paper_id": paper_id,
                "title": title,
                "error": f"Failed to update database: {str(e)}"
            }))
            sys.stdout.flush()

        # Polite rate limiting delay for Crossref API queries
        if fast_path_publisher == "Other" and doi and i < total - 1:
            time.sleep(1.0)

    print(json.dumps({
        "event": "complete",
        "processed": success_count,
        "failed": fail_count
    }))
    sys.stdout.flush()
    conn.close()

if __name__ == '__main__':
    main()
