import os
import time
import glob
import shutil
import re
import json
import csv
import urllib.parse
import random
from typing import List, Dict, Optional
import logging

import undetected_chromedriver as uc
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.common.exceptions import WebDriverException

# --- LOGGING SETUP ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("pdf_downloader.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- CONFIGURATION ---
class Config:
    # File Paths
    CSV_FILE = 'database.csv'
    CACHE_FILE = 'download_cache.json'
    DOWNLOAD_DIR = os.path.join(os.getcwd(), "temp_pdfs")
    FINAL_DIR = os.path.join(os.getcwd(), "Downloaded_PDFs")
    CHROME_PROFILE_DIR = os.path.join(os.getcwd(), "chrome_profile")
    
    # Browser & Network
    CHROME_VERSION = 144  # Sesuaikan dengan versi Chrome yang terinstall
    PROXY_BASE_URL = "https://ezproxy.library.domain.com/login?url=https://doi.org/"
    TIMEOUT = 45
    DELAY_SECONDS = 20  # Base delay between downloads
    JITTER_SECONDS = 5  # Random jitter

    # CSV Column Mapping & Filters
    TARGET_DECISIONS = ['Include', 'Maybe']
    DECISION_COLUMN = 'decision'
    PAPER_ID_COLUMN = 'Paper_ID'
    DOI_COLUMN = 'DOI_Link'

class DataManager:
    """Handles data loading, filtering, and caching."""
    
    def __init__(self, csv_file: str, cache_file: str):
        self.csv_file = csv_file
        self.cache_file = cache_file
        self.cache = self._load_cache()

    def _load_cache(self) -> List[str]:
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return []
        return []

    def save_cache(self):
        with open(self.cache_file, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, indent=4)

    def add_to_cache(self, paper_id: str):
        if paper_id not in self.cache:
            self.cache.append(paper_id)
            self.save_cache()

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
        try:
            with open(self.csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Menggunakan Config untuk nama kolom
                    if row.get(Config.DECISION_COLUMN) in Config.TARGET_DECISIONS:
                        paper_id = row.get(Config.PAPER_ID_COLUMN)

                        if not paper_id:
                            continue

                        # Sanitize filename
                        paper_id = "".join([c for c in paper_id if c.isalpha() or c.isdigit() or c in (' ', '-', '_')]).strip()

                        # Skip if already cached or file exists
                        if paper_id in self.cache:
                            continue

                        final_path = os.path.join(Config.FINAL_DIR, f"{paper_id}.pdf")
                        if os.path.exists(final_path):
                            self.add_to_cache(paper_id)
                            continue

                        # Menggunakan Config untuk kolom DOI, dengan fallback
                        doi_link = row.get(Config.DOI_COLUMN) or row.get('DOI') or row.get('doi') or ''
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

    def start_browser(self):
        logger.info("Starting Browser...")
        options = uc.ChromeOptions()
        options.add_argument(f"--user-data-dir={self.profile_dir}")

        prefs = {
            "download.default_directory": self.download_dir,
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True
        }
        options.add_experimental_option("prefs", prefs)

        try:
            # Menggunakan Config version_main
            self.driver = uc.Chrome(options=options, version_main=Config.CHROME_VERSION)
        except OSError:
            logger.warning("Could not start Chrome. Make sure it's installed and not running.")
            pass

    def stop_browser(self):
        if self.driver:
            self.driver.quit()

    def clear_download_folder(self):
        if os.path.exists(self.download_dir):
            files = glob.glob(os.path.join(self.download_dir, "*"))
            for f in files:
                try: os.remove(f)
                except: pass

    def wait_for_download(self, timeout: int = Config.TIMEOUT) -> Optional[str]:
        """Waits for a file to appear in the folder."""
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

        target_url = f"{Config.PROXY_BASE_URL}{doi}"
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
            logger.error(f"Error downloading {doi}: {e}")
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
            # TAHAP 1: Cari dan klik tombol "PDF/eReader" (Sesuai snippet 1)
            # Selector mencari <a> dengan class 'btn--eReader'
            try:
                ereader_btn = self.driver.find_element(By.CSS_SELECTOR, "a.btn--eReader")
                logger.info("Found 'PDF/eReader' button. Clicking...")
                ereader_btn.click()
                time.sleep(5) # Tunggu halaman viewer/eReader dimuat sepenuhnya
            except:
                logger.debug("Tombol eReader awal tidak ditemukan, lanjut mencari tombol download...")

            # TAHAP 2: Cari tombol Download dengan ikon "get_app" (Sesuai snippet 2)
            # Tombol ini biasanya ada di navbar atas setelah masuk mode eReader
            try:
                # Prioritas 1: Cari berdasarkan class 'navbar-download'
                download_btn = self.driver.find_element(By.CSS_SELECTOR, "a.navbar-download")
                
                logger.info(f"Found ACM Download button: {download_btn.get_attribute('href')}")
                download_btn.click()
                time.sleep(5) # Tunggu download dimulai
                return True
            except:
                # Prioritas 2: Cari berdasarkan text ikon "get_app" jika selector class gagal
                try:
                    download_btn = self.driver.find_element(By.XPATH, "//span[contains(@class, 'material-icons') and contains(text(), 'get_app')]/..")
                    logger.info("Found ACM Download button via Icon 'get_app'. Clicking...")
                    download_btn.click()
                    time.sleep(5)
                    return True
                except:
                    pass

            # TAHAP 3: Fallback (Jaga-jaga jika tombol UI gagal diklik)
            # Jika URL browser sudah masuk ke mode '/epdf/', kita bisa ubah manual ke '/pdf/'
            current_url = self.driver.current_url
            if "/doi/epdf/" in current_url:
                # Ubah https://.../doi/epdf/10.1145/... menjadi https://.../doi/pdf/10.1145/...?download=true
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
            # --- TAHAP 1: Cari dan klik link awal "Article - full text" ---
            clicked_initial_link = False
            try:
                # Prioritas: Text "Article - full text" dengan href mengandung "showpdf"
                link = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Article - full text') and contains(@href, 'showpdf')]")
                link.click()
                clicked_initial_link = True
            except:
                try:
                    # Fallback: Text "Article - full text" saja
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, "Article - full text")
                    link.click()
                    clicked_initial_link = True
                except:
                    pass
            
            # Tunggu loading halaman (bisa ke T&C atau langsung ke Frameset)
            time.sleep(3) 

            # --- TAHAP 2: Handle Halaman Konfirmasi T&C (Jika ada) ---
            try:
                checkbox = self.driver.find_element(By.NAME, "ipbasedconfirmatie")
                if checkbox:
                    logger.info("Found ActaHort confirmation page. Accepting terms...")
                    if not checkbox.is_selected():
                        checkbox.click()
                        time.sleep(0.5)
                    
                    # Klik Continue
                    continue_btn = self.driver.find_element(By.XPATH, "//input[@value='Continue']")
                    continue_btn.click()
                    time.sleep(3) # Tunggu halaman selanjutnya (Frameset) dimuat
            except:
                pass # Lanjut jika tidak ada form konfirmasi

            # --- TAHAP 3: Handle Frameset (Masalah iframe/frame yang Anda sebutkan) ---
            # HTML: <frame src="..." name="actabottom" ...>
            try:
                # Cari frame bernama 'actabottom'
                frames = self.driver.find_elements(By.NAME, "actabottom")
                if frames:
                    logger.info("Found ActaHort Frameset. Extracting content URL...")
                    # Ambil link asli dari frame (biasanya Selenium otomatis memberikan absolute URL)
                    frame_src = frames[0].get_attribute("src")
                    
                    # Paksa browser navigasi ke URL tersebut di window utama (memecah frame)
                    if frame_src:
                        self.driver.get(frame_src)
                        time.sleep(3)
            except Exception as e:
                logger.debug(f"Frame extraction warning: {e}")

            # --- TAHAP 4: Handle Tombol 'Open' (Jika ada setelah frame dibuka) ---
            # Kadang URL frame membawa ke halaman preview dengan tombol Open/Download
            try:
                # Cari tombol atau link yang bertuliskan 'Open' atau memiliki class tombol
                open_btn = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Open')] | //input[@value='Open'] | //button[contains(text(), 'Open')]")
                if open_btn:
                    logger.info("Found 'Open' button inside content. Clicking...")
                    open_btn.click()
                    time.sleep(5) # Tunggu download dimulai
                    return True
            except:
                # Jika tidak ada tombol Open, kemungkinan langkah TAHAP 3 sudah memicu download otomatis
                pass

            # Jika salah satu tahap di atas berhasil memicu sesuatu, kita asumsikan sukses
            if clicked_initial_link:
                return True

        except Exception as e:
            logger.debug(f"Acta Horticulturae handler failed/skipped: {e}")
        return False

def main():
    # 1. Setup Directories
    if os.path.exists(Config.DOWNLOAD_DIR): shutil.rmtree(Config.DOWNLOAD_DIR)
    os.makedirs(Config.DOWNLOAD_DIR)
    if not os.path.exists(Config.FINAL_DIR): os.makedirs(Config.FINAL_DIR)

    # 2. Data Management
    data_manager = DataManager(Config.CSV_FILE, Config.CACHE_FILE)
    papers = data_manager.get_papers_to_download()
    
    total_papers = len(papers)
    logger.info(f"Found {total_papers} papers to process.")

    if total_papers == 0:
        logger.info("No papers to download. Exiting.")
        return

    # 3. Browser Setup
    browser = BrowserHandler(Config.DOWNLOAD_DIR, Config.CHROME_PROFILE_DIR)
    browser.start_browser()

    # 4. User Login Prompt
    print("\n" + "="*50)
    print("CHECK LOGIN STATUS:")
    print("1. The browser window should open.")
    print("2. Navigate to: https://ezproxy.library.domain.com/login")
    print("3. Log in with your ezproxy credentials.")
    print("4. Once logged in, return here and Press ENTER to start downloading.")
    print("="*50 + "\n")
    input()

    # 5. Download Loop
    for i, paper in enumerate(papers):
        paper_id = paper['id']
        title = paper['title']
        doi = paper['doi']

        logger.info(f"[{i+1}/{total_papers}] Processing: {title}")

        browser.clear_download_folder()
        downloaded_file = browser.attempt_download(doi)

        if downloaded_file:
            # Rename and move
            target_path = os.path.join(Config.FINAL_DIR, f"{paper_id}.pdf")
            try:
                shutil.move(downloaded_file, target_path)
                logger.info(f"Saved: {target_path}")
                data_manager.add_to_cache(paper_id)

                # Apply Rate Limiting Delay
                delay = Config.DELAY_SECONDS + random.uniform(0, Config.JITTER_SECONDS)
                logger.info(f"Sleeping for {delay:.2f} seconds to respect rate limits...")
                time.sleep(delay)

            except Exception as e:
                logger.error(f"Failed to move file: {e}")
        else:
            logger.warning(f"Failed to download: {title}")

    # 6. Cleanup
    browser.stop_browser()
    shutil.rmtree(Config.DOWNLOAD_DIR)
    logger.info("Batch download complete!")

if __name__ == "__main__":
    main()