import os
import time
import glob
import shutil
import re
import json
import csv
import urllib.parse
import random
import subprocess
import platform
from typing import List, Dict, Optional
import logging

import undetected_chromedriver as uc
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.common.exceptions import WebDriverException

from app.repository import db

logger = logging.getLogger(__name__)

class DataManager:
    """Handles data loading, filtering, and caching."""

    def __init__(self, csv_file: str):
        self.csv_file = csv_file
        self.cache = db.get_download_cache()

    def add_to_cache(self, paper_id: str):
        if paper_id not in self.cache:
            self.cache.append(paper_id)
            db.add_to_download_cache(paper_id)

    def extract_doi(self, url: str) -> Optional[str]:
        try:
            parsed = urllib.parse.urlparse(url)
            params = urllib.parse.parse_qs(parsed.query)
            # Handle Scopus link format
            if 'doi' in params:
                return params['doi'][0]
            # Handle direct DOI links if present (fallback)
            if 'doi.org' in url:
                return url.split('doi.org/')[-1]
            return None
        except Exception as e:
            logger.warning(f"Failed to extract DOI from {url}: {e}")
            return None

    def get_papers_to_download(self) -> List[Dict]:
        papers = []
        decision_column = db.get_config("DOWNLOADER_DECISION_COLUMN")
        target_decisions = db.get_config("DOWNLOADER_TARGET_DECISIONS")
        paper_id_column = db.get_config("DOWNLOADER_PAPER_ID_COLUMN")
        final_dir = db.get_config("DOWNLOADER_FINAL_DIR")
        doi_column = db.get_config("DOWNLOADER_DOI_COLUMN")

        try:
            with open(self.csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Using config for column names
                    if row.get(decision_column) in target_decisions:
                        paper_id = row.get(paper_id_column)

                        if not paper_id:
                            continue

                        # Sanitize filename
                        paper_id = "".join([c for c in paper_id if c.isalpha() or c.isdigit() or c in (' ', '-', '_')]).strip()

                        # Skip if already cached or file exists
                        if paper_id in self.cache:
                            continue

                        final_path = os.path.join(final_dir, f"{paper_id}.pdf")
                        if os.path.exists(final_path):
                            self.add_to_cache(paper_id)
                            continue

                        # Using config for DOI column, with fallback
                        doi_link = row.get(doi_column) or row.get('DOI') or row.get('doi') or ''
                        doi = self.extract_doi(doi_link)
                        if doi:
                            papers.append({
                                'id': paper_id,
                                'title': row.get('Title'),
                                'doi': doi
                            })
        except FileNotFoundError:
            logger.error(f"Database file {self.csv_file} not found.")

        return papers

class BrowserHandler:
    """Handles Selenium browser interactions and downloads."""

    def __init__(self, download_dir: str, profile_dir: str):
        self.download_dir = download_dir
        self.profile_dir = profile_dir
        self.driver = None

    def get_chrome_version(self) -> Optional[int]:
        """Detects the installed Chrome version."""
        system = platform.system()
        try:
            if system == 'Windows':
                import winreg
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Google\Chrome\BLBeacon')
                version, _ = winreg.QueryValueEx(key, 'version')
                return int(version.split('.')[0])
            elif system == 'Darwin':
                process = subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--version'], capture_output=True, text=True, check=True)
                version_str = process.stdout.strip().split()[-1]
                return int(version_str.split('.')[0])
            elif system == 'Linux':
                # Try common commands for Linux
                commands = ['google-chrome --version', 'google-chrome-stable --version', 'chromium-browser --version', 'chromium --version']
                for cmd in commands:
                    try:
                        process = subprocess.run(cmd.split(), capture_output=True, text=True, check=True)
                        version_str = process.stdout.strip().split()[-1]
                        return int(version_str.split('.')[0])
                    except (subprocess.CalledProcessError, FileNotFoundError):
                        continue
        except Exception as e:
            logger.debug(f"Failed to detect Chrome version: {e}")
        return None

    def start_browser(self):
        logger.info("Starting Browser...")
        options = uc.ChromeOptions()
        options.add_argument(f"--user-data-dir={self.profile_dir}")
        # Running in headed mode so the user can manually log in to EzProxy if needed
        # when the browser window pops up.

        prefs = {
            "download.default_directory": self.download_dir,
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True
        }
        options.add_experimental_option("prefs", prefs)

        version = self.get_chrome_version()
        if version:
            logger.info(f"Detected Chrome major version: {version}")
        else:
            logger.info("Could not detect Chrome version. Letting undetected_chromedriver auto-detect.")

        try:
            if version:
                self.driver = uc.Chrome(options=options, version_main=version)
            else:
                self.driver = uc.Chrome(options=options)
        except Exception as e:
            logger.error(f"Failed to start Chrome: {e}")
            logger.error("Please ensure you have Google Chrome installed.")
            logger.error(f"If this is a version mismatch error (e.g. Chrome {version}), you may need to manually download ChromeDriver.")
            logger.error("Download it from: https://googlechromelabs.github.io/chrome-for-testing/")
            logger.error("Extract the binary and place it in your system PATH or next to this script.")
            self.driver = None

    def stop_browser(self):
        if self.driver:
            self.driver.quit()

    def clear_download_folder(self):
        if os.path.exists(self.download_dir):
            files = glob.glob(os.path.join(self.download_dir, "*"))
            for f in files:
                try: os.remove(f)
                except: pass

    def wait_for_download(self, timeout: int = None) -> Optional[str]:
        """Waits for a file to appear in the folder."""
        if timeout is None:
            timeout = db.get_config("DOWNLOADER_TIMEOUT")
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                files = glob.glob(os.path.join(self.download_dir, "*"))
                # Ignore temp files
                valid_files = [f for f in files if not f.endswith('.crdownload') and not f.endswith('.tmp')]
                if valid_files:
                    # Return the most recent file
                    return max(valid_files, key=os.path.getctime)
            except: pass
            time.sleep(1)
        return None

    def attempt_download(self, doi: str) -> Optional[str]:
        """Attempts to download PDF for a given DOI."""
        if not self.driver:
            return None

        proxy_base_url = db.get_config("DOWNLOADER_PROXY_BASE_URL")
        target_url = f"{proxy_base_url}{doi}"
        try:
            logger.info(f"Navigating to {target_url}")
            self.driver.get(target_url)
            time.sleep(5) # Wait for redirects

            pdf_url = None

            # --- SPECIAL HANDLERS ---
            current_url = self.driver.current_url.lower()

            # IEEE Xplore
            if "ieee" in current_url:
                if self._handle_ieee():
                    pdf_url = "ALREADY_DOWNLOADED"

            # ACM Digital Library
            elif "acm.org" in current_url:
                if self._handle_acm():
                    pdf_url = "ALREADY_DOWNLOADED"

            # Acta Horticulturae (Handle Normal & Proxied Links)
            elif "actahort" in current_url:
                if self._handle_acta_hort():
                    pdf_url = "ALREADY_DOWNLOADED"

            # --- GENERIC HANDLER ---
            # Try to find PDF link in meta tags
            if not pdf_url:
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                pdf_meta = soup.find('meta', attrs={'name': 'citation_pdf_url'})
                if pdf_meta:
                    pdf_url = pdf_meta['content']
                else:
                    # Try to find a link with .pdf extension or class
                    try:
                        elm = self.driver.find_element(By.XPATH, "//a[contains(@href, '.pdf') or contains(@class, 'pdf')]")
                        pdf_url = elm.get_attribute('href')
                    except: pass

            # --- EXECUTE DOWNLOAD ---
            if pdf_url == "ALREADY_DOWNLOADED":
                return self.wait_for_download()
            elif pdf_url:
                logger.info(f"Found PDF URL: {pdf_url}")
                self.driver.get(pdf_url)
                return self.wait_for_download()
            else:
                logger.warning("Could not find a direct PDF link.")
                return None

        except Exception as e:
            error_msg = str(e)
            if "ERR_NAME_NOT_RESOLVED" in error_msg:
                logger.error(f"Network error (ERR_NAME_NOT_RESOLVED) while downloading {doi}.")
                logger.error(f"Please configure your actual proxy URL. Current PROXY_BASE_URL is '{proxy_base_url}'. You can set it via the configuration.")
            else:
                logger.error(f"Error downloading {doi}: {error_msg}")
            return None

    def _handle_ieee(self) -> bool:
        """Special handling for IEEE Xplore."""
        try:
            # 1. Force Stamp URL if needed
            if "stamp.jsp" not in self.driver.current_url and "getPDF.jsp" not in self.driver.current_url:
                match = re.search(r'document/(\d+)', self.driver.current_url)
                if match:
                    doc_id = match.group(1)
                    base = self.driver.current_url.split('/document')[0]
                    stamp = f"{base}/stamp/stamp.jsp?tp=&arnumber={doc_id}"
                    self.driver.get(stamp)
                    time.sleep(4)

            # 2. Check for button in iframes
            iframes = self.driver.find_elements(By.TAG_NAME, "iframe")
            for frame in iframes:
                try:
                    self.driver.switch_to.frame(frame)
                    if len(self.driver.find_elements(By.ID, "open-button")) > 0:
                        logger.info("Found IEEE 'Open' button.")
                        btn = self.driver.find_element(By.ID, "open-button")
                        btn.click()
                        time.sleep(5)
                        self.driver.switch_to.default_content()
                        return True
                    self.driver.switch_to.default_content()
                except:
                    self.driver.switch_to.default_content()
        except Exception as e:
            logger.warning(f"IEEE Handler failed: {e}")
            self.driver.switch_to.default_content()
        return False

    def _handle_acm(self) -> bool:
        """Special handling for ACM Digital Library."""
        try:
            try:
                ereader_btn = self.driver.find_element(By.CSS_SELECTOR, "a.btn--eReader")
                logger.info("Found 'PDF/eReader' button. Clicking...")
                ereader_btn.click()
                time.sleep(5) # Wait for viewer/eReader page to load fully
            except:
                logger.debug("Initial eReader button not found, continuing to search for download button...")

            try:
                download_btn = self.driver.find_element(By.CSS_SELECTOR, "a.navbar-download")

                logger.info(f"Found ACM Download button: {download_btn.get_attribute('href')}")
                download_btn.click()
                time.sleep(5) # Wait for download to start
                return True
            except:
                try:
                    download_btn = self.driver.find_element(By.XPATH, "//span[contains(@class, 'material-icons') and contains(text(), 'get_app')]/..")
                    logger.info("Found ACM Download button via Icon 'get_app'. Clicking...")
                    download_btn.click()
                    time.sleep(5)
                    return True
                except:
                    pass

            current_url = self.driver.current_url
            if "/doi/epdf/" in current_url:
                pdf_url = current_url.replace("/doi/epdf/", "/doi/pdf/")
                if "?download=true" not in pdf_url:
                    pdf_url += "?download=true"

                logger.info(f"Navigating directly to constructed PDF URL: {pdf_url}")
                self.driver.get(pdf_url)
                return True

        except Exception as e:
            logger.warning(f"ACM Handler failed: {e}")

        return False

    def _handle_acta_hort(self) -> bool:
        """Special handling for Acta Horticulturae: Link -> T&C -> Frameset -> Open Button."""
        try:
            clicked_initial_link = False
            try:
                link = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Article - full text') and contains(@href, 'showpdf')]")
                link.click()
                clicked_initial_link = True
            except:
                try:
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, "Article - full text")
                    link.click()
                    clicked_initial_link = True
                except:
                    pass

            time.sleep(3) # Wait for loading

            try:
                checkbox = self.driver.find_element(By.NAME, "ipbasedconfirmatie")
                if checkbox:
                    logger.info("Found ActaHort confirmation page. Accepting terms...")
                    if not checkbox.is_selected():
                        checkbox.click()
                        time.sleep(0.5)

                    continue_btn = self.driver.find_element(By.XPATH, "//input[@value='Continue']")
                    continue_btn.click()
                    time.sleep(3)
            except:
                pass

            try:
                frames = self.driver.find_elements(By.NAME, "actabottom")
                if frames:
                    logger.info("Found ActaHort Frameset. Extracting content URL...")
                    frame_src = frames[0].get_attribute("src")

                    if frame_src:
                        self.driver.get(frame_src)
                        time.sleep(3)
            except Exception as e:
                logger.debug(f"Frame extraction warning: {e}")

            try:
                open_btn = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Open')] | //input[@value='Open'] | //button[contains(text(), 'Open')]")
                if open_btn:
                    logger.info("Found 'Open' button inside content. Clicking...")
                    open_btn.click()
                    time.sleep(5)
                    return True
            except:
                pass

            if clicked_initial_link:
                return True

        except Exception as e:
            logger.debug(f"Acta Horticulturae handler failed/skipped: {e}")
        return False

def run_downloader(progress_callback=None, is_cancelled=None):
    download_dir = db.get_config("DOWNLOADER_DOWNLOAD_DIR")
    final_dir = db.get_config("DOWNLOADER_FINAL_DIR")
    csv_file = db.get_config("DOWNLOADER_CSV_FILE")
    chrome_profile_dir = db.get_config("DOWNLOADER_CHROME_PROFILE_DIR")
    delay_seconds = db.get_config("DOWNLOADER_DELAY_SECONDS")
    jitter_seconds = db.get_config("DOWNLOADER_JITTER_SECONDS")

    # 1. Setup Directories
    if os.path.exists(download_dir): shutil.rmtree(download_dir)
    os.makedirs(download_dir)
    if not os.path.exists(final_dir): os.makedirs(final_dir)

    # 2. Data Management
    data_manager = DataManager(csv_file)
    papers = data_manager.get_papers_to_download()

    total_papers = len(papers)
    logger.info(f"Found {total_papers} papers to process.")

    if total_papers == 0:
        logger.info("No papers to download. Exiting.")
        return {"status": "success", "message": "No papers to download", "total_processed": 0}

    # 3. Browser Setup
    browser = BrowserHandler(download_dir, chrome_profile_dir)
    browser.start_browser()

    success_count = 0
    # 5. Download Loop
    for i, paper in enumerate(papers):
        if is_cancelled and is_cancelled():
            logger.info("Download cancelled by user.")
            break

        paper_id = paper['id']
        title = paper['title']
        doi = paper['doi']

        logger.info(f"[{i+1}/{total_papers}] Processing: {title}")
        if progress_callback:
            progress_callback(i + 1, total_papers, title)

        browser.clear_download_folder()
        downloaded_file = browser.attempt_download(doi)

        if downloaded_file:
            # Rename and move
            target_path = os.path.join(final_dir, f"{paper_id}.pdf")
            try:
                shutil.move(downloaded_file, target_path)
                logger.info(f"Saved: {target_path}")
                data_manager.add_to_cache(paper_id)
                success_count += 1

                # Apply Rate Limiting Delay
                delay = delay_seconds + random.uniform(0, jitter_seconds)
                logger.info(f"Sleeping for {delay:.2f} seconds to respect rate limits...")
                time.sleep(delay)

            except Exception as e:
                logger.error(f"Failed to move file: {e}")
        else:
            logger.warning(f"Failed to download: {title}")

    # 6. Cleanup
    browser.stop_browser()
    shutil.rmtree(download_dir)
    logger.info("Batch download complete!")
    return {"status": "success", "message": f"Processed {success_count}/{total_papers} papers", "total_processed": success_count}
