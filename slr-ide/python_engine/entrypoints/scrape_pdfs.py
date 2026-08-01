import os
import sys
import time
import json
import sqlite3
import random
import shutil

from python_engine.core.config import DB_PATH, PROJECT_DIR
from python_engine.crawler.config import ScraperConfig
from python_engine.crawler.browser import BrowserHandler, ProxyRateLimitException
from python_engine.pdf.validator import extract_doi_value
from python_engine.entrypoints.verify_pdfs import verify_paper_pdf

DOWNLOAD_DIR = os.path.join(PROJECT_DIR, 'pdf_library', 'downloads')
RAW_DIR = os.path.join(PROJECT_DIR, 'pdf_library', 'raw')

def main():
    if not os.path.exists(DB_PATH):
        print(json.dumps({"event": "error", "message": "Database slr.db not found."}))
        sys.exit(1)

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    config = ScraperConfig(conn)

    cursor = conn.cursor()
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

    if paper_id_arg:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title
            FROM papers
            WHERE DOI IS NOT NULL AND DOI != '' 
              AND Paper_ID = ?
              AND Project_ID = ?
              AND (is_duplicate IS NULL OR is_duplicate = 0)
        """, (paper_id_arg, active_proj_id))
    else:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title
            FROM papers
            WHERE DOI IS NOT NULL AND DOI != '' 
              AND (Local_PDF_Status IS NULL OR Local_PDF_Status = 'MISSING')
              AND Project_ID = ?
              AND (is_duplicate IS NULL OR is_duplicate = 0)
        """, (active_proj_id,))
    papers = cursor.fetchall()
    total = len(papers)

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

    print(json.dumps({"event": "start", "total": total}))

    if total == 0:
        print(json.dumps({"event": "complete", "downloaded": 0, "failed": 0}))
        conn.close()
        return

    browser = BrowserHandler(DOWNLOAD_DIR, config)
    browser.start_browser()

    # Redirect browser to proxy login URL to allow user to log in manually
    if total > 0:
        proxy_base_url = config.proxy_base_url
        print(json.dumps({"event": "log", "message": f"Redirecting browser to proxy login URL: {proxy_base_url}"}))
        sys.stdout.flush()
        try:
            browser.driver.get(proxy_base_url)
        except Exception as e:
            print(json.dumps({"event": "log", "message": f"Warning: Failed to navigate to proxy login URL: {str(e)}"}))
            sys.stdout.flush()

        print(json.dumps({
            "event": "waiting_login",
            "message": "Please log in via the opened browser window. Once complete, click the Resume button in the app."
        }))
        sys.stdout.flush()

        # Wait for user input via stdin (newline written by Next.js server)
        sys.stdin.readline()

        print(json.dumps({"event": "log", "message": "Login wait complete. Resuming scraping pipeline..."}))
        sys.stdout.flush()

    success_count = 0
    fail_count = 0

    for i, paper in enumerate(papers):
        if browser:
            # ensure_healthy_session will try tab recovery first.
            # If it returns False, it restarted the browser completely, which requires proxy login re-trigger.
            recovered_via_tab = browser.ensure_healthy_session()
            if not recovered_via_tab:
                if config.proxy_base_url and config.proxy_base_url.strip() and config.proxy_base_url.strip().lower().rstrip('/') != "https://doi.org":
                    print(json.dumps({"event": "log", "message": f"Re-authenticating via proxy: {config.proxy_base_url}"}))
                    sys.stdout.flush()
                    try:
                        browser.driver.get(config.proxy_base_url)
                        time.sleep(5)
                        current_url = browser.driver.current_url.lower()
                        if "login" in current_url or "auth" in current_url or "signin" in current_url:
                            print(json.dumps({
                                "event": "waiting_login",
                                "message": "Please log in via the opened browser window. Once complete, click the Resume button in the app."
                            }))
                            sys.stdout.flush()
                            sys.stdin.readline()
                            print(json.dumps({"event": "log", "message": "Login wait complete. Resuming scraping pipeline..."}))
                            sys.stdout.flush()
                    except Exception as e:
                        print(json.dumps({"event": "log", "message": f"Warning: Failed to navigate to proxy on restart: {str(e)}"}))
                        sys.stdout.flush()

        paper_id, doi_raw, title = paper
        doi = extract_doi_value(doi_raw)

        if not doi or not doi.strip():
            fail_count += 1
            cursor.execute("""
                UPDATE papers
                SET Local_PDF_Status = 'FAILED'
                WHERE Paper_ID = ? AND Project_ID = ?
            """, (paper_id, active_proj_id))
            conn.commit()
            print(json.dumps({
                "event": "paper_fail",
                "paper_id": paper_id,
                "title": title,
                "error": "Skip scraping: DOI is empty or invalid."
            }))
            sys.stdout.flush()
            continue

        print(json.dumps({
            "event": "progress",
            "current": i + 1,
            "total": total,
            "paper_id": paper_id,
            "title": title
        }))

        browser.clear_download_folder()
        try:
            downloaded = browser.attempt_download(doi)
        except ProxyRateLimitException:
            print(json.dumps({
                "event": "log",
                "message": "[WARNING] Proxy rate limit reached ('Too many downloads'). Pausing loop for 30 minutes..."
            }))
            sys.stdout.flush()
            
            # Tell IDE we are sleeping
            print(json.dumps({
                "event": "sleep",
                "duration": 1800
            }))
            sys.stdout.flush()
            
            time.sleep(1800)
            
            # Retry
            try:
                downloaded = browser.attempt_download(doi)
            except Exception as retry_err:
                downloaded = None

        if downloaded and os.path.exists(downloaded):
            # Validate the PDF using the Integrity Verification gate
            status, validation_msg = verify_paper_pdf(
                downloaded,
                min_size_kb=min_size_kb,
                ocr_enabled=ocr_enabled,
                tesseract_path=tesseract_path,
                expected_title=title,
                fuzzy_threshold=fuzzy_threshold
            )
            
            dest_filename = f"{paper_id}.pdf"
            dest_path = os.path.join(RAW_DIR, dest_filename)
            try:
                shutil.move(downloaded, dest_path)
                new_pdf_status = 'NEEDS_REVIEW' if status == 'NEEDS_REVIEW' else 'DOWNLOADED'
                cursor.execute("""
                    UPDATE papers
                    SET Local_PDF_Status = ?, Local_PDF_Path = ?
                    WHERE Paper_ID = ? AND Project_ID = ?
                """, (new_pdf_status, f"pdf_library/raw/{dest_filename}", paper_id, active_proj_id))
                conn.commit()
                success_count += 1
                
                if status == 'NEEDS_REVIEW':
                    print(json.dumps({
                        "event": "log",
                        "message": f"[{paper_id}] PDF integrity check failed: {validation_msg} -> Marked as NEEDS_REVIEW"
                    }))
                else:
                    print(json.dumps({
                        "event": "log",
                        "message": f"[{paper_id}] PDF integrity check passed -> Marked as DOWNLOADED"
                    }))
                    
                print(json.dumps({"event": "paper_success", "paper_id": paper_id, "title": title}))
                sys.stdout.flush()
                except Exception as e:
                    fail_count += 1
                    cursor.execute("""
                        UPDATE papers
                        SET Local_PDF_Status = 'FAILED'
                        WHERE Paper_ID = ? AND Project_ID = ?
                    """, (paper_id, active_proj_id))
                    conn.commit()
                    print(json.dumps({"event": "paper_fail", "paper_id": paper_id, "title": title, "error": f"Failed to save file: {str(e)}"}))
                    sys.stdout.flush()
        else:
            fail_count += 1
            cursor.execute("""
                UPDATE papers
                SET Local_PDF_Status = 'FAILED'
                WHERE Paper_ID = ? AND Project_ID = ?
            """, (paper_id, active_proj_id))
            conn.commit()
            print(json.dumps({"event": "paper_fail", "paper_id": paper_id, "title": title, "error": "Download timed out or failed to resolve PDF link."}))
            sys.stdout.flush()

        # Apply delay between requests if not the last paper
        if i < total - 1:
            delay = config.delay_seconds + random.uniform(0, config.jitter_seconds)
            print(json.dumps({"event": "sleep", "duration": round(delay, 2)}))
            time.sleep(delay)

    browser.stop_browser()
    # Clean up temp downloads
    try:
        shutil.rmtree(DOWNLOAD_DIR)
    except:
        pass

    print(json.dumps({
        "event": "complete",
        "downloaded": success_count,
        "failed": fail_count
    }))
    sys.stdout.flush()
    conn.close()

if __name__ == '__main__':
    main()
