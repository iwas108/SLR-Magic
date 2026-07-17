import os
import sys
import json
import sqlite3
import difflib
import re

from python_engine.core.config import DB_PATH, PROJECT_DIR
from python_engine.core.security import sanitize_string, calculate_md5
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

def verify_paper_pdf(file_path, paper_id, expected_title, fuzzy_threshold, min_size_kb, ocr_enabled=False, tesseract_path='tesseract'):
    # Check physical file existence
    if not os.path.exists(file_path):
        return 'NEEDS_REVIEW', f"File does not exist at path: {file_path}"

    # 1. Size check
    try:
        size = os.path.getsize(file_path)
        min_size_bytes = min_size_kb * 1024
        if size < min_size_bytes:
            return 'NEEDS_REVIEW', f"File size too small ({size / 1024:.1f} KB below limit {min_size_kb} KB). Likely a redirect/stub page."
    except Exception as e:
        return 'NEEDS_REVIEW', f"Error checking file size: {str(e)}"

    # 2. PDF Header check
    try:
        with open(file_path, 'rb') as f:
            header = f.read(1024)
            if b'%PDF-' not in header:
                return 'NEEDS_REVIEW', "Invalid PDF header. File is not a PDF (likely HTML/text paywall or gatekeeper page)."
    except Exception as e:
        return 'NEEDS_REVIEW', f"Error reading file header: {str(e)}"

    # 3. PDF Structural check & Single-Page check
    page_count = 0
    text = ""
    if has_pypdf:
        try:
            reader = PdfReader(file_path)
            page_count = len(reader.pages)
            if page_count == 0:
                return 'NEEDS_REVIEW', "PDF has 0 pages. File is corrupted."
            if page_count == 1:
                return 'NEEDS_REVIEW', "PDF has exactly 1 page. Scholarly manuscripts always have multiple pages (presumed redirect/stub)."
            
            try:
                text = reader.pages[0].extract_text() or ""
            except Exception as extract_err:
                # Do not reject a valid multi-page PDF due to font extraction/encoding issues
                text = ""
        except Exception as e:
            return 'NEEDS_REVIEW', f"Failed to parse PDF structural pages: {str(e)}"
    else:
        # Fallback if pypdf is not installed (should not happen in typical runs)
        return 'NEEDS_REVIEW', "pypdf not installed. Cannot run page-count and structure checks."

    # OCR Fallback if text is empty and OCR is enabled
    if not text.strip() and ocr_enabled:
        try:
            text = extract_pdf_text_first_page(file_path, ocr_enabled=True, tesseract_path=tesseract_path)
        except Exception as e:
            pass

    text_lower = text.lower()

    # 4. Content Poison check (known redirect/DOI stub phrases)
    poison_phrases = [
        "use of trademarks owned by the international doi foundation",
        "this page cannot be found",
        "trademarks owned by the international doi foundation",
        "doi foundation",
        "error 404",
        "page not found",
        "checking your browser",
        "please enable cookies",
        "access denied",
        "permission required"
    ]
    
    found_poison = [phrase for phrase in poison_phrases if phrase in text_lower]
    if found_poison:
        return 'NEEDS_REVIEW', f"Poison content detected (redirect/stub phrase matched: {found_poison})"

    # 5. Fuzzy Title Match Check
    if expected_title and text:
        # Clean title: keep lowercase alphanumeric and spaces
        cleaned_expected = re.sub(r'[^a-zA-Z0-9\s]', ' ', expected_title.lower())
        expected_words = cleaned_expected.split()
        len_ew = len(expected_words)
        
        # Clean first 4000 characters of page text
        cleaned_text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text[:4000].lower())
        words = cleaned_text.split()
        
        best_ratio = 0
        if len_ew > 0 and len(words) > 0:
            reconstructed_expected = " ".join(expected_words)
            for i in range(max(1, len(words) - len_ew + 1)):
                chunk = " ".join(words[i:i+len_ew])
                ratio = difflib.SequenceMatcher(None, reconstructed_expected, chunk).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    
            if best_ratio < fuzzy_threshold:
                return 'NEEDS_REVIEW', f"Title fuzzy match ({best_ratio:.2f}) is below threshold ({fuzzy_threshold}). Expected: '{expected_title}'"

    return 'VALID', "Valid PDF manuscript"

def main():
    if not os.path.exists(DB_PATH):
        print(json.dumps({"event": "error", "message": "Database not found."}))
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()

    # Get active project
    cursor.execute("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'")
    active_proj_row = cursor.fetchone()
    active_proj_id = active_proj_row[0] if active_proj_row else 'default-project'

    # Get active project folder_name
    cursor.execute("SELECT folder_name FROM projects WHERE id = ?", (active_proj_id,))
    proj_row = cursor.fetchone()
    folder_name = proj_row[0] if proj_row else 'default_project'

    # Get thresholds and settings
    cursor.execute("SELECT value FROM configs WHERE key = 'FUZZY_MATCH_THRESHOLD'")
    row = cursor.fetchone()
    fuzzy_threshold = float(row[0]) / 100.0 if row else 0.70

    cursor.execute("SELECT value FROM configs WHERE key = 'PDF_VERIFY_MIN_SIZE_KB'")
    row_size = cursor.fetchone()
    min_size_kb = float(row_size[0]) if row_size else 55.0

    cursor.execute("SELECT value FROM configs WHERE key = 'OCR_ENABLED'")
    row_ocr = cursor.fetchone()
    ocr_enabled = row_ocr[0].lower() == 'true' if row_ocr else False

    cursor.execute("SELECT value FROM configs WHERE key = 'TESSERACT_PATH'")
    row_tess = cursor.fetchone()
    tesseract_path = row_tess[0] if row_tess else 'tesseract'

    # Check for specific paper ID argument
    paper_id_arg = None
    if len(sys.argv) > 1:
        for i in range(1, len(sys.argv)):
            if sys.argv[i] == '--paper' and i + 1 < len(sys.argv):
                paper_id_arg = sys.argv[i+1]

    # Query papers that have MATCHED, DOWNLOADED, SYNCED, or NEEDS_REVIEW PDF status
    if paper_id_arg:
        cursor.execute("""
            SELECT Paper_ID, Title, Local_PDF_Status, Local_PDF_Path FROM papers
            WHERE Project_ID = ? AND Paper_ID = ?
              AND Local_PDF_Path IS NOT NULL AND Local_PDF_Path != ''
              AND (is_duplicate IS NULL OR is_duplicate = 0)
        """, (active_proj_id, paper_id_arg))
    else:
        cursor.execute("""
            SELECT Paper_ID, Title, Local_PDF_Status, Local_PDF_Path FROM papers
            WHERE Project_ID = ? AND Local_PDF_Status IN ('MATCHED', 'DOWNLOADED', 'SYNCED', 'NEEDS_REVIEW')
              AND Local_PDF_Path IS NOT NULL AND Local_PDF_Path != ''
              AND (is_duplicate IS NULL OR is_duplicate = 0)
        """, (active_proj_id,))
    
    papers = cursor.fetchall()
    total = len(papers)

    print(json.dumps({"event": "start", "total": total}))
    sys.stdout.flush()

    if total == 0:
        if paper_id_arg:
            print(json.dumps({"event": "complete", "message": f"Paper {paper_id_arg} not found or has no PDF path."}))
        else:
            print(json.dumps({"event": "complete", "message": "No PDFs to verify."}))
        conn.close()
        return

    failed_count = 0
    verified_count = 0

    for idx, paper in enumerate(papers):
        paper_id, title, status, local_path = paper
        
        print(json.dumps({
            "event": "progress",
            "current": idx + 1,
            "total": total,
            "paper_id": paper_id,
            "title": title
        }))
        sys.stdout.flush()

        abs_path = os.path.join(PROJECT_DIR, local_path.replace('\\', '/'))
        
        verify_status, verify_msg = verify_paper_pdf(
            abs_path, 
            paper_id, 
            title, 
            fuzzy_threshold, 
            min_size_kb, 
            ocr_enabled=ocr_enabled, 
            tesseract_path=tesseract_path
        )

        if verify_status == 'NEEDS_REVIEW':
            failed_count += 1
            # Downgrade status in database, keep the file on disk
            cursor.execute("""
                UPDATE papers
                SET Local_PDF_Status = 'NEEDS_REVIEW'
                WHERE Paper_ID = ?
            """, (paper_id,))
            conn.commit()
            print(json.dumps({
                "event": "paper_fail",
                "paper_id": paper_id,
                "title": title,
                "error": verify_msg
            }))
            sys.stdout.flush()
        else:
            verified_count += 1
            
            # Determine correct status and path based on file existence on disk
            repo_pdf_path = os.path.join(PROJECT_DIR, 'pdf_library', 'repo', folder_name, f"{paper_id}.pdf")
            raw_pdf_path = os.path.join(PROJECT_DIR, 'pdf_library', 'raw', f"{paper_id}.pdf")
            
            target_status = 'DOWNLOADED'
            target_path = f"pdf_library/raw/{paper_id}.pdf"
            
            if os.path.exists(repo_pdf_path):
                target_status = 'SYNCED'
                target_path = f"pdf_library/repo/{folder_name}/{paper_id}.pdf"
            elif os.path.exists(raw_pdf_path):
                target_status = 'DOWNLOADED'
                target_path = f"pdf_library/raw/{paper_id}.pdf"
            else:
                # Fallback to database parameters if not in standard locations
                if 'repo/' in abs_path:
                    target_status = 'SYNCED'
                    target_path = local_path
                else:
                    target_status = 'DOWNLOADED'
                    target_path = local_path

            cursor.execute("""
                UPDATE papers
                SET Local_PDF_Status = ?, Local_PDF_Path = ?
                WHERE Paper_ID = ?
            """, (target_status, target_path.replace('\\', '/'), paper_id))
            conn.commit()

            print(json.dumps({
                "event": "paper_success",
                "paper_id": paper_id,
                "title": title
            }))
            sys.stdout.flush()

    print(json.dumps({
        "event": "complete",
        "message": f"PDF verification completed. Passed: {verified_count}, Needs Review: {failed_count}"
    }))
    sys.stdout.flush()
    conn.close()

if __name__ == '__main__':
    main()
