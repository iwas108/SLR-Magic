import os
import sys
import time
import json
import sqlite3
import random
import shutil

from python_engine.core.config import DB_PATH, PROJECT_DIR
from python_engine.crawler.config import ScraperConfig
from python_engine.crawler.browser import BrowserHandler
from python_engine.pdf.validator import validate_scraped_pdf, extract_doi_value

DOWNLOAD_DIR = os.path.join(PROJECT_DIR, 'pdf_library', 'downloads')
RAW_DIR = os.path.join(PROJECT_DIR, 'pdf_library', 'raw')

def main():
    if not os.path.exists(DB_PATH):
        print(json.dumps({"event": "error", "message": "Database slr.db not found."}))
        sys.exit(1)

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    config = ScraperConfig(conn)

    cursor = conn.cursor()
    # Fetch active project ID
    cursor.execute("SELECT value FROM configs WHERE key = 'ACTIVE_PROJECT_ID'")
    active_proj_row = cursor.fetchone()
    active_proj_id = active_proj_row[0] if active_proj_row else 'default-project'

    # Fetch papers with DOI for the active project (optionally filtering by specific Paper_ID)
    paper_id_arg = None
    if len(sys.argv) > 1:
        for i in range(1, len(sys.argv)):
            if sys.argv[i] == '--paper' and i + 1 < len(sys.argv):
                paper_id_arg = sys.argv[i+1]

    if paper_id_arg:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title
            FROM papers
            WHERE DOI IS NOT NULL AND DOI != '' 
              AND Paper_ID = ?
              AND Project_ID = ?
        """, (paper_id_arg, active_proj_id))
    else:
        cursor.execute("""
            SELECT Paper_ID, DOI, Title
            FROM papers
            WHERE DOI IS NOT NULL AND DOI != '' 
              AND (Local_PDF_Status IS NULL OR Local_PDF_Status = 'MISSING')
              AND Project_ID = ?
        """, (active_proj_id,))
    papers = cursor.fetchall()
    total = len(papers)

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
        paper_id, doi_raw, title = paper
        doi = extract_doi_value(doi_raw)

        print(json.dumps({
            "event": "progress",
            "current": i + 1,
            "total": total,
            "paper_id": paper_id,
            "title": title
        }))

        browser.clear_download_folder()
        downloaded = browser.attempt_download(doi)

        if downloaded and os.path.exists(downloaded):
            # Validate the PDF
            is_valid, validation_msg = validate_scraped_pdf(downloaded)
            if not is_valid:
                fail_count += 1
                cursor.execute("""
                    UPDATE papers
                    SET Local_PDF_Status = 'FAILED'
                    WHERE Paper_ID = ?
                """, (paper_id,))
                conn.commit()
                # Delete the invalid file
                try:
                    os.remove(downloaded)
                except:
                    pass
                print(json.dumps({
                    "event": "paper_fail",
                    "paper_id": paper_id,
                    "title": title,
                    "error": f"PDF validation failed: {validation_msg}"
                }))
                sys.stdout.flush()
            else:
                dest_filename = f"{paper_id}.pdf"
                dest_path = os.path.join(RAW_DIR, dest_filename)
                try:
                    shutil.move(downloaded, dest_path)
                    cursor.execute("""
                        UPDATE papers
                        SET Local_PDF_Status = 'DOWNLOADED', Local_PDF_Path = ?
                        WHERE Paper_ID = ?
                    """, (f"pdf_library/raw/{dest_filename}", paper_id))
                    conn.commit()
                    success_count += 1
                    print(json.dumps({"event": "paper_success", "paper_id": paper_id, "title": title}))
                    sys.stdout.flush()
                except Exception as e:
                    fail_count += 1
                    cursor.execute("""
                        UPDATE papers
                        SET Local_PDF_Status = 'FAILED'
                        WHERE Paper_ID = ?
                    """, (paper_id,))
                    conn.commit()
                    print(json.dumps({"event": "paper_fail", "paper_id": paper_id, "title": title, "error": f"Failed to save file: {str(e)}"}))
                    sys.stdout.flush()
        else:
            fail_count += 1
            cursor.execute("""
                UPDATE papers
                SET Local_PDF_Status = 'FAILED'
                WHERE Paper_ID = ?
            """, (paper_id,))
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
