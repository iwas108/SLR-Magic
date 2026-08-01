import os
import sys
import shutil
import sqlite3
import re
import json
import difflib
import hashlib
import time

from python_engine.core.config import PROJECT_DIR, DB_PATH, CACHE_DIR, RAW_DIR, REPO_DIR, CACHE_INDEX_DB_PATH
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
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
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

    # Fetch active PDF files in pdf_library/cached/ and pdf_library/raw/
    active_pdf_files = []
    for f in os.listdir(CACHE_DIR):
        if f.lower().endswith('.pdf'):
            active_pdf_files.append((f, CACHE_DIR))
    for f in os.listdir(RAW_DIR):
        if f.lower().endswith('.pdf'):
            active_pdf_files.append((f, RAW_DIR))

    print(json.dumps({"event": "log", "message": f"Scanning cached & raw folders: found {len(active_pdf_files)} PDF files. Building cache index..."}))
    sys.stdout.flush()

    active_rel_paths = set()

    # Incremental Cache Indexing
    for idx_f, (f, folder) in enumerate(active_pdf_files):
        file_path = os.path.join(folder, f)
        rel_path = os.path.relpath(file_path, PROJECT_DIR).replace('\\', '/')
        active_rel_paths.add(rel_path)
        try:
            stat = os.stat(file_path)
            file_size = stat.st_size
            mtime = stat.st_mtime
        except Exception as e:
            continue

        # Check if already indexed and unchanged
        cursor_idx.execute("SELECT file_size, mtime FROM pdf_cache WHERE filename = ?", (rel_path,))
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
        """, (rel_path, file_hash, file_size, mtime, extracted_doi, extracted_title, text))
        conn_idx.commit()

    # Delete obsolete index records
    cursor_idx.execute("SELECT filename FROM pdf_cache")
    all_cached_filenames = [r[0] for r in cursor_idx.fetchall()]
    obsolete_count = 0
    for db_f in all_cached_filenames:
        if db_f not in active_rel_paths:
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

    # Fetch active project ID and paper_id argument from CLI flags
    active_proj_id = None
    paper_id_arg = None
    if len(sys.argv) > 1:
        for i in range(1, len(sys.argv)):
            if sys.argv[i] == '--project' and i + 1 < len(sys.argv):
                active_proj_id = sys.argv[i+1]
            elif sys.argv[i] == '--paper' and i + 1 < len(sys.argv):
                paper_id_arg = sys.argv[i+1]

    if not active_proj_id:
        cursor.execute("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'")
        active_proj_row = cursor.fetchone()
        active_proj_id = active_proj_row[0] if active_proj_row else None

    if not active_proj_id:
        print_event({"event": "error", "message": "Missing required --project parameter."})
        sys.exit(1)

    cursor.execute("SELECT folder_name FROM projects WHERE id = ?", (active_proj_id,))
    proj_row = cursor.fetchone()
    folder_name = proj_row[0] if proj_row else active_proj_id

    if paper_id_arg:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title, Local_PDF_Status, Local_PDF_Path, Abstract FROM papers
            WHERE Project_ID = ? AND Paper_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)
        """, (active_proj_id, paper_id_arg))
    else:
        force_update = '--force-update' in sys.argv
        if force_update:
            cursor.execute("""
                SELECT Paper_ID, DOI, Title, Local_PDF_Status, Local_PDF_Path, Abstract FROM papers
                WHERE Project_ID = ? AND (Local_PDF_Status IS NULL OR Local_PDF_Status != 'IGNORED') AND (is_duplicate IS NULL OR is_duplicate = 0)
            """, (active_proj_id,))
        else:
            cursor.execute("""
                SELECT Paper_ID, DOI, Title, Local_PDF_Status, Local_PDF_Path, Abstract FROM papers
                WHERE Project_ID = ? AND (Local_PDF_Status IS NULL OR Local_PDF_Status IN ('MISSING', 'FAILED')) AND (is_duplicate IS NULL OR is_duplicate = 0)
            """, (active_proj_id,))
    papers = cursor.fetchall()

    # Pre-build sets of existing file IDs for O(1) existence checks
    existing_raw_ids = set()
    if os.path.exists(RAW_DIR):
        for f in os.listdir(RAW_DIR):
            if f.lower().endswith('.pdf'):
                existing_raw_ids.add(os.path.splitext(f)[0])

    project_repo_dir = os.path.join(REPO_DIR, folder_name)
    existing_repo_ids = set()
    if os.path.exists(project_repo_dir):
        for f in os.listdir(project_repo_dir):
            if f.lower().endswith('.pdf'):
                existing_repo_ids.add(os.path.splitext(f)[0])

    print(json.dumps({"info": f"Index loaded. Starting matching lookup for {len(papers)} papers in database."}))
    sys.stdout.flush()

    matched_count = 0

    for idx, paper in enumerate(papers):
        paper_id, doi, title, local_pdf_status, local_pdf_path, abstract = paper
        
        throttle_print({
            "event": "progress",
            "current": idx + 1,
            "total": len(papers),
            "paper_id": paper_id,
            "title": title
        })

        # Check physical existence of the file on disk
        has_file = False
        file_found_path = None
        file_found_status = None

        if local_pdf_path:
            norm_path = local_pdf_path.replace('\\', '/')
            if norm_path.startswith('pdf_library/raw/'):
                pid = os.path.splitext(os.path.basename(norm_path))[0]
                if pid in existing_raw_ids:
                    has_file = True
                    file_found_path = local_pdf_path
                    file_found_status = local_pdf_status if local_pdf_status in ('MATCHED', 'DOWNLOADED', 'SYNCED') else 'MATCHED'
            elif norm_path.startswith(f'pdf_library/repo/{folder_name}/'):
                pid = os.path.splitext(os.path.basename(norm_path))[0]
                if pid in existing_repo_ids:
                    has_file = True
                    file_found_path = local_pdf_path
                    file_found_status = local_pdf_status if local_pdf_status in ('MATCHED', 'DOWNLOADED', 'SYNCED') else 'SYNCED'

        # If not found where DB points, check standard locations
        if not has_file and paper_id in existing_raw_ids:
            has_file = True
            file_found_path = f"pdf_library/raw/{paper_id}.pdf"
            file_found_status = 'MATCHED'

        if not has_file and paper_id in existing_repo_ids:
            has_file = True
            file_found_path = f"pdf_library/repo/{folder_name}/{paper_id}.pdf"
            file_found_status = 'SYNCED'

        if has_file:
            # Self-healing: if file exists on disk but path/status is incorrect or missing in DB, update DB
            if local_pdf_status != file_found_status or local_pdf_path != file_found_path:
                try:
                    cursor.execute("""
                        UPDATE papers
                        SET Local_PDF_Status = ?, Local_PDF_Path = ?
                        WHERE Paper_ID = ? AND Project_ID = ?
                    """, (file_found_status, file_found_path, paper_id, active_proj_id))
                    conn.commit()
                    print(json.dumps({
                        "event": "log",
                        "message": f"Self-healed: updated DB path/status for {paper_id} to {file_found_status} ({file_found_path})"
                    }))
                    sys.stdout.flush()
                except Exception as e:
                    print(json.dumps({
                        "event": "log",
                        "message": f"Failed to self-heal DB entry for {paper_id}: {e}"
                    }))
                    sys.stdout.flush()
            
            print(json.dumps({
                "event": "match",
                "paper_id": paper_id,
                "title": title,
                "filename": os.path.basename(file_found_path or f"{paper_id}.pdf"),
                "method": "existing_file_check"
            }))
            sys.stdout.flush()
            matched_count += 1
            continue

        # If file does not exist on disk, reset active status to MISSING
        if local_pdf_status in ('MATCHED', 'DOWNLOADED', 'SYNCED'):
            try:
                cursor.execute("""
                    UPDATE papers
                    SET Local_PDF_Status = 'MISSING', Local_PDF_Path = NULL
                    WHERE Paper_ID = ? AND Project_ID = ?
                """, (paper_id, active_proj_id))
                conn.commit()
                local_pdf_status = 'MISSING'
                local_pdf_path = None
                print(json.dumps({
                    "event": "log",
                    "message": f"Stale file reset: marked {paper_id} as MISSING because it does not exist on disk."
                }))
                sys.stdout.flush()
            except Exception as e:
                pass

        # Deterministic ID check in the eternal library

        raw_path = os.path.join(PROJECT_DIR, 'pdf_library', 'raw', f"{paper_id}.pdf")
        if os.path.exists(raw_path):
            try:
                cursor.execute("""
                    UPDATE papers
                    SET Local_PDF_Status = 'MATCHED', Local_PDF_Path = ?
                    WHERE Paper_ID = ? AND Project_ID = ?
                """, (f"pdf_library/raw/{paper_id}.pdf", paper_id, active_proj_id))
                conn.commit()
                matched_count += 1
                print(json.dumps({
                    "event": "match",
                    "paper_id": paper_id,
                    "title": title,
                    "filename": f"{paper_id}.pdf",
                    "method": "eternal_library_deterministic_match"
                }))
                sys.stdout.flush()
                continue
            except Exception as e:
                print(json.dumps({
                    "event": "error",
                    "paper_id": paper_id,
                    "message": f"Failed to match via deterministic ID check: {str(e)}"
                }))
                sys.stdout.flush()

        matched_record = None
        match_method = None

        # 1. Exact Paper ID Match
        id_pattern = sanitize_string(paper_id)
        for rec in cached_records:
            name_only = os.path.splitext(os.path.basename(rec['filename']))[0]
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
                # Check filename similarity
                sanitized_name = sanitize_string(os.path.splitext(os.path.basename(rec['filename']))[0])
                lenB = len(sanitized_name)
                
                limit = max(fuzzy_threshold, best_ratio)
                max_possible_ratio = (2.0 * min(lenA, lenB)) / (lenA + lenB) if (lenA + lenB) > 0 else 0
                if max_possible_ratio >= limit:
                    ratio = difflib.SequenceMatcher(None, sanitized_title, sanitized_name).ratio()
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_rec = rec
                
                # Check extracted title similarity
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
                        "filename": os.path.basename(rec['filename'])
                    })

                    # Compare spaces-stripped versions to handle sub-word space insertion from PDF text extraction
                    stripped_title = re.sub(r'\s+', '', sanitized_title)
                    stripped_text = re.sub(r'\s+', '', first_page_text_lower)

                    if (sanitized_title in first_page_text_lower) or (stripped_title in stripped_text):
                        matched_record = rec
                        match_method = "pdf_metadata_text"
                        break

        # If matched, point Local_PDF_Path directly to raw/ matched file in the eternal library
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
            src_path = os.path.join(PROJECT_DIR, matched_file.replace('/', os.sep))
            dest_path = os.path.join(RAW_DIR, f"{paper_id}.pdf")

            try:
                if os.path.exists(dest_path):
                    # Already exists in eternal library, clean up staging duplicate
                    try:
                        if os.path.exists(src_path) and src_path != dest_path:
                            os.remove(src_path)
                    except:
                        pass
                else:
                    # Move the file from cached/ staging to raw/ eternal library
                    if os.path.exists(src_path) and src_path != dest_path:
                        shutil.move(src_path, dest_path)

                # Update main SQLite DB to point to raw/ path
                cursor.execute("""
                    UPDATE papers
                    SET Local_PDF_Status = 'MATCHED', Local_PDF_Path = ?
                    WHERE Paper_ID = ?
                """, (f"pdf_library/raw/{paper_id}.pdf", paper_id))
                conn.commit()

                matched_count += 1
                print(json.dumps({
                    "event": "match",
                    "paper_id": paper_id,
                    "title": title,
                    "filename": os.path.basename(matched_file),
                    "method": match_method
                }))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({
                    "event": "error",
                    "paper_id": paper_id,
                    "message": f"Failed to move and match file: {str(e)}"
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
