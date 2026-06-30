import os
import sys
import shutil
import sqlite3
import re
import json
import difflib
import hashlib
import time

from python_engine.core.config import PROJECT_DIR, DB_PATH, CACHE_DIR, RAW_DIR, CACHE_INDEX_DB_PATH
from python_engine.core.events import throttle_print
from python_engine.core.security import sanitize_string, sanitize_doi, calculate_md5
from python_engine.pdf.analyzer import extract_pdf_text_first_page

# Add pypdf fallback
try:
    from pypdf import PdfReader
    has_pypdf = True
except ImportError:
    has_pypdf = False

# Add PyMuPDF (fitz) and pytesseract fallback support
try:
    import fitz
    import pytesseract
    import io
    from PIL import Image
    has_ocr_libs = True
except ImportError:
    has_ocr_libs = False

last_print_time = 0.0

def run_matcher():
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CACHE_INDEX_DB_PATH), exist_ok=True)

    if not os.path.exists(DB_PATH):
        print(json.dumps({"error": f"Database not found at {DB_PATH}"}))
        sys.exit(1)

    # 1. Deduplicate pdf_library/cached/
    print(json.dumps({"event": "log", "message": "Checking for duplicate files in pdf_library/cached/..."}))
    sys.stdout.flush()
    
    seen_hashes = {}
    duplicates_deleted = 0
    
    all_files = sorted(os.listdir(CACHE_DIR))
    for f in all_files:
        if not f.lower().endswith('.pdf'):
            continue
        file_path = os.path.join(CACHE_DIR, f)
        h = calculate_md5(file_path)
        if h:
            if h in seen_hashes:
                try:
                    os.remove(file_path)
                    duplicates_deleted += 1
                    print(json.dumps({
                        "event": "log",
                        "message": f"Deleted duplicate file: {f} (duplicate of {seen_hashes[h]})"
                    }))
                    sys.stdout.flush()
                except Exception as e:
                    print(json.dumps({
                        "event": "log",
                        "message": f"Failed to delete duplicate file {f}: {e}"
                    }))
                    sys.stdout.flush()
            else:
                seen_hashes[h] = f

    if duplicates_deleted > 0:
        print(json.dumps({"event": "log", "message": f"Deduplication complete. Deleted {duplicates_deleted} duplicate files."}))
    else:
        print(json.dumps({"event": "log", "message": "Deduplication complete. No duplicate files found."}))
    sys.stdout.flush()

    # Open main DB connection
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Load configurations
    cursor.execute("SELECT value FROM configs WHERE key = 'FUZZY_MATCH_THRESHOLD'")
    row = cursor.fetchone()
    fuzzy_threshold = float(row[0]) / 100.0 if row else 0.90

    cursor.execute("SELECT value FROM configs WHERE key = 'SEMANTIC_MATCH_THRESHOLD'")
    row_semantic = cursor.fetchone()
    semantic_threshold = float(row_semantic[0]) if row_semantic else 0.65

    cursor.execute("SELECT value FROM configs WHERE key = 'OCR_ENABLED'")
    row_ocr = cursor.fetchone()
    ocr_enabled = row_ocr[0].lower() == 'true' if row_ocr else False

    cursor.execute("SELECT value FROM configs WHERE key = 'TESSERACT_PATH'")
    row_tess = cursor.fetchone()
    tesseract_path = row_tess[0] if row_tess else 'tesseract'

    if ocr_enabled and not has_ocr_libs:
        print(json.dumps({
            "info": "[WARNING]: OCR is enabled in settings, but pytesseract, pymupdf, or pillow is not installed in the python environment. Gracefully falling back to standard text extraction."
        }))
        sys.stdout.flush()

    # Initialize Cache Index DB
    conn_idx = sqlite3.connect(CACHE_INDEX_DB_PATH)
    cursor_idx = conn_idx.cursor()
    cursor_idx.execute("""
        CREATE TABLE IF NOT EXISTS pdf_cache (
            filename TEXT PRIMARY KEY,
            file_hash TEXT,
            file_size INTEGER,
            mtime REAL,
            extracted_doi TEXT,
            extracted_title TEXT,
            page1_text TEXT,
            indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn_idx.commit()

    # Fetch active PDF files in pdf_library/cached/
    active_pdf_files = [f for f in os.listdir(CACHE_DIR) if f.lower().endswith('.pdf')]
    print(json.dumps({"event": "log", "message": f"Scanning pdf_library/cached: found {len(active_pdf_files)} PDF files. Building cache index..."}))
    sys.stdout.flush()

    # Incremental Cache Indexing
    for idx_f, f in enumerate(active_pdf_files):
        file_path = os.path.join(CACHE_DIR, f)
        try:
            stat = os.stat(file_path)
            file_size = stat.st_size
            mtime = stat.st_mtime
        except Exception as e:
            continue

        # Check if already indexed and unchanged
        cursor_idx.execute("SELECT file_size, mtime FROM pdf_cache WHERE filename = ?", (f,))
        row_idx = cursor_idx.fetchone()
        if row_idx and row_idx[0] == file_size and row_idx[1] == mtime:
            # File unchanged, skip indexing
            throttle_print({
                "event": "indexing",
                "current": idx_f + 1,
                "total": len(active_pdf_files),
                "filename": f,
                "tool": "Cache DB"
            })
            continue

        # Extract MD5
        file_hash = calculate_md5(file_path) or ""

        # Extract title
        extracted_title = ""
        if has_pypdf:
            try:
                reader = PdfReader(file_path)
                meta = reader.metadata
                if meta and meta.title:
                    extracted_title = meta.title
            except:
                pass
        if not extracted_title.strip():
            extracted_title = os.path.splitext(f)[0]

        # Extract text using first page
        text = ""
        if has_pypdf:
            try:
                reader = PdfReader(file_path)
                if len(reader.pages) > 0:
                    text = reader.pages[0].extract_text() or ""
            except:
                pass

        # Verbose OCR log if standard text is empty and OCR is enabled
        if not text.strip() and ocr_enabled and has_ocr_libs:
            print(json.dumps({
                "event": "log",
                "message": f"  - Running Tesseract OCR on page 1 of: {f}..."
            }))
            sys.stdout.flush()
            
            # Emit indexing event with Tesseract OCR tool
            throttle_print({
                "event": "indexing",
                "current": idx_f + 1,
                "total": len(active_pdf_files),
                "filename": f,
                "tool": "Tesseract OCR"
            })
            text = extract_pdf_text_first_page(file_path, ocr_enabled=True, tesseract_path=tesseract_path)
        else:
            # Emit indexing event with pypdf tool
            throttle_print({
                "event": "indexing",
                "current": idx_f + 1,
                "total": len(active_pdf_files),
                "filename": f,
                "tool": "pypdf"
            })
        
        # Regex DOI extraction
        extracted_doi = ""
        if text:
            # Match standard DOI pattern
            doi_match = re.search(r'\b(10\.\d{4,9}/[-._;()/:a-zA-Z0-9]+)', text)
            if doi_match:
                extracted_doi = doi_match.group(1)

        # Update cache DB
        cursor_idx.execute("""
            INSERT OR REPLACE INTO pdf_cache (filename, file_hash, file_size, mtime, extracted_doi, extracted_title, page1_text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (f, file_hash, file_size, mtime, extracted_doi, extracted_title, text))
        conn_idx.commit()

    # Delete obsolete index records
    cursor_idx.execute("SELECT filename FROM pdf_cache")
    all_cached_filenames = [r[0] for r in cursor_idx.fetchall()]
    active_pdf_set = set(active_pdf_files)
    obsolete_count = 0
    for db_f in all_cached_filenames:
        if db_f not in active_pdf_set:
            cursor_idx.execute("DELETE FROM pdf_cache WHERE filename = ?", (db_f,))
            obsolete_count += 1
    if obsolete_count > 0:
        conn_idx.commit()

    # Load all cached PDF metadata into memory
    cursor_idx.execute("SELECT filename, file_hash, extracted_doi, extracted_title, page1_text FROM pdf_cache")
    cached_records = []
    for row in cursor_idx.fetchall():
        cached_records.append({
            'filename': row[0],
            'file_hash': row[1],
            'extracted_doi': row[2],
            'extracted_title': row[3],
            'page1_text': row[4]
        })
    conn_idx.close()

    # Auto-build PDF Cache Vector Index incrementally
    try:
        from python_engine.vector.index_manager import VectorIndexManager
        from python_engine.vector.id_map import IDMap
        
        # Check already indexed
        conn_id = IDMap.get_connection()
        cursor_id = conn_id.cursor()
        cursor_id.execute("SELECT string_id FROM id_map WHERE source = 'pdf_cache'")
        already_indexed = {r[0] for r in cursor_id.fetchall()}
        
        new_pdfs = [rec for rec in cached_records if rec['filename'] not in already_indexed]
        if new_pdfs:
            print(json.dumps({"event": "log", "message": f"Auto-indexing {len(new_pdfs)} new PDFs into vector database..."}))
            sys.stdout.flush()
            for rec in new_pdfs:
                VectorIndexManager.add_pdf(rec['filename'], rec['page1_text'])
    except Exception as e:
        print(json.dumps({"event": "log", "message": f"Warning: Vector auto-indexing failed: {e}"}))
        sys.stdout.flush()

    # Fetch active project ID and folder name
    cursor.execute("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'")
    active_proj_row = cursor.fetchone()
    active_proj_id = active_proj_row[0] if active_proj_row else 'default-project'

    cursor.execute("SELECT folder_name FROM projects WHERE id = ?", (active_proj_id,))
    proj_row = cursor.fetchone()
    folder_name = proj_row[0] if proj_row else 'default_project'

    # Fetch papers from main DB for the active project (optionally filtering by specific Paper_ID)
    paper_id_arg = None
    if len(sys.argv) > 1:
        for i in range(1, len(sys.argv)):
            if sys.argv[i] == '--paper' and i + 1 < len(sys.argv):
                paper_id_arg = sys.argv[i+1]

    if paper_id_arg:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title, Status, Local_PDF_Status, Local_PDF_Path, Abstract FROM papers
            WHERE Project_ID = ? AND Paper_ID = ?
        """, (active_proj_id, paper_id_arg))
    else:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title, Status, Local_PDF_Status, Local_PDF_Path, Abstract FROM papers
            WHERE Project_ID = ? AND (Local_PDF_Status IS NULL OR Local_PDF_Status = 'MISSING')
        """, (active_proj_id,))
    papers = cursor.fetchall()

    print(json.dumps({"info": f"Index loaded. Starting matching lookup for {len(papers)} papers in database."}))
    sys.stdout.flush()

    matched_count = 0

    for idx, paper in enumerate(papers):
        paper_id, doi, title, status, local_pdf_status, local_pdf_path, abstract = paper
        
        throttle_print({
            "event": "progress",
            "current": idx + 1,
            "total": len(papers),
            "paper_id": paper_id,
            "title": title
        })

        # Safetynet: check if already matched/downloaded/synced and file exists on disk
        if local_pdf_status in ('MATCHED', 'DOWNLOADED', 'SYNCED'):
            has_file = False
            if local_pdf_path:
                full_path = os.path.join(PROJECT_DIR, local_pdf_path.replace('/', os.sep))
                if os.path.exists(full_path):
                    has_file = True
            
            if not has_file:
                raw_path = os.path.join(PROJECT_DIR, 'pdf_library', 'raw', f"{paper_id}.pdf")
                repo_path = os.path.join(PROJECT_DIR, 'pdf_library', 'repo', folder_name, f"{paper_id}.pdf")
                if os.path.exists(raw_path) or os.path.exists(repo_path):
                    has_file = True
            
            if has_file:
                continue

        matched_record = None
        match_method = None

        # 1. Exact Paper ID Match
        id_pattern = sanitize_string(paper_id)
        for rec in cached_records:
            name_only = os.path.splitext(rec['filename'])[0]
            if sanitize_string(name_only) == id_pattern:
                matched_record = rec
                match_method = "exact_paper_id"
                break

        # 2. Exact DOI Match
        if not matched_record and doi:
            sanitized_doi = doi.strip().lower()
            for rec in cached_records:
                if rec['extracted_doi'] and rec['extracted_doi'].strip().lower() == sanitized_doi:
                    matched_record = rec
                    match_method = "exact_doi"
                    break

        # 3. Fuzzy Title Match
        if not matched_record and title:
            sanitized_title = sanitize_string(title)
            lenA = len(sanitized_title)
            best_ratio = 0
            best_rec = None
            for rec in cached_records:
                sanitized_name = sanitize_string(os.path.splitext(rec['filename'])[0])
                lenB = len(sanitized_name)
                
                # O(1) length pre-check optimization
                limit = max(fuzzy_threshold, best_ratio)
                max_possible_ratio = (2.0 * min(lenA, lenB)) / (lenA + lenB) if (lenA + lenB) > 0 else 0
                if max_possible_ratio < limit:
                    continue
                
                ratio = difflib.SequenceMatcher(None, sanitized_title, sanitized_name).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_rec = rec
                
                if rec['extracted_title']:
                    sanitized_ext_title = sanitize_string(rec['extracted_title'])
                    lenC = len(sanitized_ext_title)
                    limit = max(fuzzy_threshold, best_ratio)
                    max_possible_ratio2 = (2.0 * min(lenA, lenC)) / (lenA + lenC) if (lenA + lenC) > 0 else 0
                    if max_possible_ratio2 >= limit:
                        ratio2 = difflib.SequenceMatcher(None, sanitized_title, sanitized_ext_title).ratio()
                        if ratio2 > best_ratio:
                            best_ratio = ratio2
                            best_rec = rec
            
            if best_ratio >= fuzzy_threshold:
                matched_record = best_rec
                match_method = f"fuzzy_title (similarity: {best_ratio:.2f})"

        # 4. Metadata Content Text Match
        if not matched_record and title:
            sanitized_title = title.lower().strip()
            for rec in cached_records:
                first_page_text = rec['page1_text']
                if first_page_text:
                    first_page_text_lower = first_page_text.lower()
                    # Print comparing event for UI feedback
                    throttle_print({
                        "event": "comparing",
                        "filename": rec['filename']
                    })

                    if sanitized_title in first_page_text_lower:
                        matched_record = rec
                        match_method = "pdf_metadata_text"
                        break

        # 5. Semantic Vector Match (turbovec)
        if not matched_record and title:
            try:
                from python_engine.vector.index_manager import VectorIndexManager
                vec_mgr = VectorIndexManager()
                query_text = f"{title} {abstract}" if abstract else title
                results = vec_mgr.search_pdf_by_text(query_text, k=3)
                if results and results[0]['score'] >= semantic_threshold:
                    matched_filename = results[0]['filename']
                    for rec in cached_records:
                        if rec['filename'] == matched_filename:
                            matched_record = rec
                            match_method = f"semantic_vector (score: {results[0]['score']:.4f})"
                            break
            except Exception as e:
                throttle_print({
                    "event": "log",
                    "message": f"Warning: Stage 5 Semantic Vector match failed: {e}"
                })

        # If matched, point Local_PDF_Path directly to cached_pdf/ matched file
        if matched_record:
            # Emit progress event immediately for matches to sync UI status
            print(json.dumps({
                "event": "progress",
                "current": idx + 1,
                "total": len(papers),
                "paper_id": paper_id,
                "title": title
            }))
            sys.stdout.flush()
            matched_file = matched_record['filename']
            src_path = os.path.join(CACHE_DIR, matched_file)

            try:
                # Update main SQLite DB - do NOT move file, do NOT delete from cache index
                cursor.execute("""
                    UPDATE papers
                    SET Local_PDF_Status = 'MATCHED', Local_PDF_Path = ?
                    WHERE Paper_ID = ?
                """, (f"pdf_library/cached/{matched_file}", paper_id))
                conn.commit()

                matched_count += 1
                print(json.dumps({
                    "event": "match",
                    "paper_id": paper_id,
                    "title": title,
                    "filename": matched_file,
                    "method": match_method
                }))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({
                    "event": "error",
                    "paper_id": paper_id,
                    "message": f"Failed to match file: {str(e)}"
                }))
                sys.stdout.flush()

    conn.close()
    print(json.dumps({
        "event": "complete",
        "total_matched": matched_count
    }))
    sys.stdout.flush()

if __name__ == '__main__':
    run_matcher()
