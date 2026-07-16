import os
import sys
import time
import json
import threading
import random
import shutil
import glob
import platform
import subprocess
import urllib.parse
import re

import sys
import subprocess

# ==============================================================================
# DEPENDENCY CHECKS & AUTO-INSTALLER
# ==============================================================================
REQUIRED_PACKAGES = {
    'requests': 'requests',
    'flask': 'Flask',
    'flask_cors': 'flask-cors',
    'undetected_chromedriver': 'undetected-chromedriver',
    'selenium': 'selenium',
    'bs4': 'beautifulsoup4',
    'pypdf': 'pypdf'
}

missing_packages = []
for module_name, pip_name in REQUIRED_PACKAGES.items():
    try:
        __import__(module_name)
    except ImportError:
        missing_packages.append(pip_name)

if missing_packages:
    print(f"Missing required dependencies: {', '.join(missing_packages)}")
    ans = input("Would you like to automatically install them now using pip? (y/n): ").strip().lower()
    if ans == 'y':
        print("\nInstalling dependencies...\n")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_packages)
            print("\n[OK] All dependencies installed successfully.\n")
        except subprocess.CalledProcessError as e:
            print(f"\n[ERROR] Failed to install dependencies automatically. Please run:\npip install {' '.join(missing_packages)}")
            sys.exit(1)
    else:
        print(f"\nPlease install them manually: pip install {' '.join(missing_packages)}")
        sys.exit(1)

import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup
from pypdf import PdfReader
has_pypdf = True

# ==============================================================================
# CONFIG & STATE
# ==============================================================================
CONFIG_FILE = "worker_config.json"

# Global variables for worker state
IDE_HOST = ""
PAIRING_CODE = str(random.randint(100000, 999999))
SESSION_TOKEN = None
STATUS = "WAITING_LOGIN"
IS_RUNNING = True
ACTIVE_PROJECT_ID = None
WORKER_ID = "REMOTE"

def load_config():
    global IDE_HOST, PAIRING_CODE, SESSION_TOKEN, WORKER_ID
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                data = json.load(f)
                IDE_HOST = data.get('IDE_HOST', IDE_HOST)
                PAIRING_CODE = data.get('PAIRING_CODE', PAIRING_CODE)
                SESSION_TOKEN = data.get('SESSION_TOKEN', SESSION_TOKEN)
                WORKER_ID = data.get('WORKER_ID', WORKER_ID)
        except Exception as e:
            print(f"[WARN] Failed to load config: {e}")

def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump({
                'IDE_HOST': IDE_HOST,
                'PAIRING_CODE': PAIRING_CODE,
                'SESSION_TOKEN': SESSION_TOKEN,
                'WORKER_ID': WORKER_ID
            }, f, indent=4)
    except Exception as e:
        print(f"[WARN] Failed to save config: {e}")

load_config()

# Worker Telemetry
telemetry = {
    "done": 0,
    "failed": 0,
    "current_paper": None,
    "speed_pph": 0, # papers per hour
    "start_time": None
}

class ScraperConfig:
    def __init__(self, proxy_base_url="https://doi.org/"):
        self.proxy_base_url = proxy_base_url
        self.delay_seconds = 5.0
        self.jitter_seconds = 2.0
        self.chrome_profile_dir = os.path.join(os.getcwd(), 'chrome_profile')
        self.user_agent = None
        self.proxy_host = None
        self.proxy_port = None
        self.headless = False
        self.load_timeout = 30

# ==============================================================================
# VALIDATION LOGIC
# ==============================================================================
def extract_doi_value(doi_str):
    if not doi_str:
        return ""
    try:
        parsed = urllib.parse.urlparse(doi_str)
        params = urllib.parse.parse_qs(parsed.query)
        if 'doi' in params:
            return params['doi'][0]
        if 'doi.org/' in doi_str:
            return doi_str.split('doi.org/')[-1]
    except:
        pass
    return doi_str

def validate_scraped_pdf(file_path):
    try:
        size = os.path.getsize(file_path)
        if size < 5 * 1024:
            return False, f"File size too small ({size} bytes)."
    except Exception as e:
        return False, f"Error checking file size: {str(e)}"

    try:
        with open(file_path, 'rb') as f:
            header = f.read(1024)
            if b'%PDF-' not in header:
                return False, "Invalid PDF header."
    except Exception as e:
        return False, f"Error reading file header: {str(e)}"

    text = ""
    if has_pypdf:
        try:
            reader = PdfReader(file_path)
            if len(reader.pages) > 0:
                text = reader.pages[0].extract_text() or ""
        except Exception as e:
            return True, f"Passed (PDF header valid, text extract failed: {str(e)})"
    else:
        return True, "Passed (pypdf not installed)."

    text_lower = text.lower()
    reject_keywords = ["conference schedule", "program of events", "table of contents", "program schedule"]
    found_reject_kw = [kw for kw in reject_keywords if kw in text_lower]
    accept_markers = ["abstract", "introduction", "references", "doi:"]
    found_accept_marker = [marker for marker in accept_markers if marker in text_lower]

    if found_reject_kw and not found_accept_marker:
        return False, f"Rejected as invalid paper. Contains conference keywords: {found_reject_kw}"

    return True, "Valid scientific paper."

# ==============================================================================
# DOM PARSER LOGIC
# ==============================================================================
def dismiss_overlays(driver):
    try:
        overlay_selectors = [
            "#onetrust-consent-sdk", ".onetrust-pc-dark-filter", "#consent_blackbar",
            ".cookie-banner", "#cookie-consent", ".cookie-consent-modal",
            "#cookie-law-info-bar", "#cookie-law-info-again", ".cookie-popup",
            "#gdpr-consent-tool-wrapper", ".cc-banner", ".cc-window",
            "#sp-cookie-consent-notice", ".js-cookie-consent"
        ]
        for selector in overlay_selectors:
            driver.execute_script(f"""
                var el = document.querySelector("{selector}");
                if (el) {{ el.style.display = "none"; }}
            """)
    except:
        pass

def accept_cookies(driver):
    try:
        accept_keywords = ["accept all", "allow all", "accept cookies", "allow cookies", "i accept", "accept", "allow", "agree", "consent"]
        for kw in accept_keywords:
            try:
                xpath_expr = f"//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')] | //a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')] | //span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')]/.."
                elms = driver.find_elements(By.XPATH, xpath_expr)
                for e in elms:
                    if e.is_displayed():
                        try:
                            e.click()
                        except:
                            driver.execute_script("arguments[0].click();", e)
                        time.sleep(1)
                        return
            except:
                pass
        dismiss_overlays(driver)
    except:
        pass

def check_and_click_checkboxes(driver):
    try:
        selectors = [
            "input[type='checkbox']",
            "input[id*='terms']", "input[id*='agree']", "input[id*='accept']", "input[id*='consent']",
            "[role='checkbox']"
        ]
        for selector in selectors:
            elms = driver.find_elements(By.CSS_SELECTOR, selector)
            for e in elms:
                try:
                    if e.is_displayed():
                        is_checked = e.get_attribute("checked") or e.is_selected()
                        if not is_checked:
                            e.click()
                            time.sleep(0.5)
                except:
                    pass
    except:
        pass

def find_candidate_elements(driver, current_url):
    candidates = []
    try:
        elements = driver.find_elements(By.XPATH, "//a | //button | //*[@role='button'] | //*[contains(@class, 'btn') or contains(@class, 'button')]")
    except:
        return []

    seen_ids = set()
    high_keywords = ["view pdf", "download pdf", "download full text", "download full-text", "download direct", "pdf direct", "open pdf", "read pdf", "pdf download"]
    med_keywords = ["pdf", "download", "full text", "full-text", "view article", "read article", "get document"]
    low_keywords = ["view", "open", "read", "get", "go to"]

    for e in elements:
        try:
            element_id = e.id
            if element_id in seen_ids: continue
            seen_ids.add(element_id)

            if not e.is_displayed(): continue

            try:
                is_ref = driver.execute_script("""
                    var el = arguments[0];
                    while (el) {
                        if (el.id && (el.id.toLowerCase().includes('reference') || el.id.toLowerCase().includes('bib'))) return true;
                        if (el.className && (el.className.toLowerCase().includes('reference') || el.className.toLowerCase().includes('bib'))) return true;
                        el = el.parentElement;
                    }
                    return false;
                """, e)
            except:
                is_ref = False

            text = (e.text or "").strip().lower()
            href = (e.get_attribute("href") or "").strip().lower()
            el_class = (e.get_attribute("class") or "").strip().lower()
            el_id = (e.get_attribute("id") or "").strip().lower()
            el_title = (e.get_attribute("title") or "").strip().lower()

            score = 0
            if is_ref: score -= 1000

            label = text or el_title or el_id or el_class or "unlabeled"
            combined_str = f"{text} {href} {el_class} {el_id} {el_title}"

            non_relevant = ["image", "full issue", "supplementary", "supplemental", "supporting", "slide", "video", "media", "audio", "dataset"]
            if any(nr in combined_str for nr in non_relevant): score -= 1000

            if any(kw in combined_str for kw in high_keywords): score += 100
            elif any(kw in combined_str for kw in med_keywords): score += 50
            elif any(kw in combined_str for kw in low_keywords): score += 20

            abs_href = ""
            if href:
                try: abs_href = urllib.parse.urljoin(current_url, href)
                except: abs_href = href
            
            if abs_href and (".pdf" in abs_href.lower() or "/pdf/" in abs_href.lower()): score += 1000
            if ".pdf" in href or "/pdf/" in href: score += 150

            if "sciencedirect.com" in current_url:
                if "/reader/sd/pii/" in href or "/science/article/pii/" in href or "view pdf" in combined_str: score += 250

            if score > 0:
                candidates.append((e, label[:50], score, abs_href))
        except:
            continue

    candidates.sort(key=lambda x: x[2], reverse=True)
    return candidates

# ==============================================================================
# NAVIGATOR LOGIC
# ==============================================================================
class Navigator:
    def __init__(self, browser_handler):
        self.browser = browser_handler
        self.driver = browser_handler.driver

    def cascade_find_pdf(self, current_url):
        if "ieee" in current_url:
            print(json.dumps({"event": "log", "message": "Triggering IEEE Xplore specialized handler..."}))
            sys.stdout.flush()
            if self._handle_ieee():
                return "ALREADY_DOWNLOADED"
        elif "acm.org" in current_url:
            print(json.dumps({"event": "log", "message": "Triggering ACM specialized handler..."}))
            sys.stdout.flush()
            if self._handle_acm():
                return "ALREADY_DOWNLOADED"
        elif "actahort" in current_url:
            print(json.dumps({"event": "log", "message": "Triggering Acta Horticulturae specialized handler..."}))
            sys.stdout.flush()
            if self._handle_acta_hort():
                return "ALREADY_DOWNLOADED"

        visited_urls = {current_url}
        print(json.dumps({"event": "log", "message": "Initiating stateful backtracking download crawler..."}))
        sys.stdout.flush()
        if self._backtrack_search(depth=0, max_depth=3, visited=visited_urls):
            return "ALREADY_DOWNLOADED"
            
        return None

    def _backtrack_search(self, depth, max_depth, visited):
        if self.browser.check_download_occurred():
            print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] PDF successfully downloaded!"}))
            sys.stdout.flush()
            return True

        if depth >= max_depth:
            return False

        curr_url = self.driver.current_url.lower()
        wrong_keywords = ["login", "sign-in", "signin", "purchase", "subscribe", "paywall", "register", "checkout", "cart", "cookie-consent"]
        if depth > 0 and any(kw in curr_url for kw in wrong_keywords):
            print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Wrong direction detected: {curr_url}. Backtracking..."}))
            sys.stdout.flush()
            return False

        accept_cookies(self.driver)
        check_and_click_checkboxes(self.driver)

        try:
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            meta_pdf = soup.find('meta', attrs={'name': 'citation_pdf_url'})
            if meta_pdf and meta_pdf.get('content'):
                pdf_url = meta_pdf['content']
                orig_url = self.driver.current_url
                print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Found citation_pdf_url meta tag: {pdf_url}"}))
                sys.stdout.flush()
                self.driver.get(pdf_url)
                if self.browser.wait_for_immediate_download(4.0):
                    return True
                self.driver.get(orig_url)
                time.sleep(2)
        except Exception as e:
            pass

        candidates = find_candidate_elements(self.driver, curr_url)
        if not candidates:
            return False

        for idx, (element, label, score, abs_href) in enumerate(candidates):
            try:
                if not element.is_displayed():
                    continue
            except:
                continue

            orig_url = self.driver.current_url
            print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Click candidate {idx+1}/{len(candidates)}: '{label}' (Score: {score})"}))
            sys.stdout.flush()

            clicked_ok = False
            try:
                element.click()
                clicked_ok = True
            except Exception as click_err:
                try:
                    self.driver.execute_script("arguments[0].click();", element)
                    clicked_ok = True
                except:
                    pass

            if self.browser.wait_for_immediate_download(4.0):
                return True

            if abs_href and any(pi in abs_href.lower() for pi in [".pdf", "/pdf/"]):
                try:
                    self.driver.get(abs_href)
                    if self.browser.wait_for_immediate_download(4.0):
                        return True
                except:
                    pass
                try:
                    self.driver.get(orig_url)
                    time.sleep(2)
                except:
                    pass
            elif not clicked_ok:
                continue

            new_url = self.driver.current_url
            if new_url != orig_url:
                if new_url not in visited:
                    visited.add(new_url)
                    if self._backtrack_search(depth + 1, max_depth, visited):
                        return True
                    self.driver.back()
                    time.sleep(3)
                else:
                    self.driver.back()
                    time.sleep(2)
            else:
                handles = self.driver.window_handles
                if len(handles) > 1:
                    orig_handle = self.driver.current_window_handle
                    new_handle = [h for h in handles if h != orig_handle][0]
                    self.driver.switch_to.window(new_handle)
                    time.sleep(3)
                    if self.browser.check_download_occurred():
                        return True
                    if self._backtrack_search(depth + 1, max_depth, visited):
                        return True
                    self.driver.close()
                    self.driver.switch_to.window(orig_handle)
                    time.sleep(2)

    def _robust_click(self, element, wait_after=3):
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.5)
        except:
            pass

        clicked = False
        try:
            element.click()
            clicked = True
        except:
            try:
                self.driver.execute_script("arguments[0].click();", element)
                clicked = True
            except:
                pass

        if wait_after > 0:
            time.sleep(wait_after)
        return clicked

    def _handle_ieee(self):
        try:
            page_text = ""
            try:
                page_text = self.driver.page_source
            except:
                pass
                
            is_blocked = "challenge" in self.driver.current_url.lower() or \
                         "challenge" in page_text.lower() or \
                         "attempts exceeded" in page_text.lower() or \
                         "max challenge attempts" in page_text.lower()
                         
            if is_blocked:
                print(json.dumps({"event": "log", "message": "[IEEE] Detected challenge or white page. Attempting refresh..."}))
                sys.stdout.flush()
                try:
                    self.driver.refresh()
                    time.sleep(5)
                    page_text = self.driver.page_source
                except Exception as e:
                    print(json.dumps({"event": "log", "message": f"[IEEE] Refresh failed: {str(e)}"}))
                    sys.stdout.flush()

            curr_url_lower = self.driver.current_url.lower()
            
            if "stamp.jsp" not in curr_url_lower and "getpdf.jsp" not in curr_url_lower:
                match = re.search(r'document/(\d+)', self.driver.current_url)
                if match:
                    doc_id = match.group(1)
                    base = self.driver.current_url.split('/document')[0]
                    stamp = f"{base}/stamp/stamp.jsp?tp=&arnumber={doc_id}"
                    print(json.dumps({"event": "log", "message": f"[IEEE] Redirecting directly to stamp URL: {stamp}"}))
                    sys.stdout.flush()
                    self.driver.get(stamp)
                    time.sleep(4)
                else:
                    meta_match = re.search(r'ieeexplore\.ieee\.org/document/(\d+)', page_text)
                    if meta_match:
                        doc_id = meta_match.group(1)
                        base = "https://ieeexplore.ieee.org"
                        if "ezproxy" in self.driver.current_url:
                            base = self.driver.current_url.split('/document')[0] if '/document' in self.driver.current_url else self.driver.current_url
                        stamp = f"{base}/stamp/stamp.jsp?tp=&arnumber={doc_id}"
                        print(json.dumps({"event": "log", "message": f"[IEEE] Found doc_id in page source. Redirecting to stamp URL: {stamp}"}))
                        sys.stdout.flush()
                        self.driver.get(stamp)
                        time.sleep(4)

            iframes = self.driver.find_elements(By.TAG_NAME, "iframe")
            for frame in iframes:
                try:
                    self.driver.switch_to.frame(frame)
                    if len(self.driver.find_elements(By.ID, "open-button")) > 0:
                        btn = self.driver.find_element(By.ID, "open-button")
                        self._robust_click(btn, wait_after=5)
                        self.driver.switch_to.default_content()
                        return True
                    self.driver.switch_to.default_content()
                except:
                    self.driver.switch_to.default_content()
        except Exception as e:
            print(json.dumps({"event": "log", "message": f"[IEEE] Error in _handle_ieee: {str(e)}"}))
            sys.stdout.flush()
            self.driver.switch_to.default_content()
        return False

    def _handle_acm(self):
        try:
            try:
                ereader_btn = self.driver.find_element(By.CSS_SELECTOR, "a.btn--eReader, a.btn--ereader")
                self._robust_click(ereader_btn, wait_after=5)
            except:
                pass
            try:
                download_btn = self.driver.find_element(By.CSS_SELECTOR, "a.navbar-download")
                if self._robust_click(download_btn, wait_after=5):
                    return True
            except:
                try:
                    download_btn = self.driver.find_element(By.XPATH, "//span[contains(@class, 'material-icons') and contains(text(), 'get_app')]/..")
                    if self._robust_click(download_btn, wait_after=5):
                        return True
                except:
                    pass
            current_url = self.driver.current_url
            if "/doi/epdf/" in current_url:
                pdf_url = current_url.replace("/doi/epdf/", "/doi/pdf/")
                if "?download=true" not in pdf_url:
                    pdf_url += "?download=true"
                self.driver.get(pdf_url)
                return True
        except:
            pass
        return False

    def _handle_acta_hort(self):
        try:
            clicked = False
            try:
                link = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Article - full text') and contains(@href, 'showpdf')]")
                clicked = self._robust_click(link, wait_after=3)
            except:
                try:
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, "Article - full text")
                    clicked = self._robust_click(link, wait_after=3)
                except:
                    pass
            try:
                checkbox = self.driver.find_element(By.NAME, "ipbasedconfirmatie")
                if checkbox:
                    if not checkbox.is_selected():
                        self._robust_click(checkbox, wait_after=0.5)
                    btn = self.driver.find_element(By.XPATH, "//input[@value='Continue']")
                    self._robust_click(btn, wait_after=3)
            except:
                pass
            try:
                frames = self.driver.find_elements(By.NAME, "actabottom")
                if frames:
                    src = frames[0].get_attribute("src")
                    if src:
                        self.driver.get(src)
                        time.sleep(3)
            except:
                pass
            try:
                open_btn = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Open')] | //input[@value='Open'] | //button[contains(text(), 'Open')]")
                if open_btn:
                    if self._robust_click(open_btn, wait_after=5):
                        return True
            except:
                pass
            return clicked
        except:
            pass
        return False

# ==============================================================================
# BROWSER LOGIC
# ==============================================================================
def get_chrome_version():
    system = platform.system()
    try:
        if system == 'Windows':
            import winreg
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Google\Chrome\BLBeacon')
            version, _ = winreg.QueryValueEx(key, 'version')
            return int(version.split('.')[0])
        elif system == 'Darwin':
            process = subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--version'], capture_output=True, text=True, check=True)
            return int(process.stdout.strip().split()[-1].split('.')[0])
        elif system == 'Linux':
            commands = ['google-chrome --version', 'google-chrome-stable --version', 'chromium-browser --version', 'chromium --version']
            for cmd in commands:
                try:
                    process = subprocess.run(cmd.split(), capture_output=True, text=True, check=True)
                    return int(process.stdout.strip().split()[-1].split('.')[0])
                except: continue
    except: pass
    return None

class ProxyRateLimitException(Exception):
    pass

class BrowserHandler:
    def __init__(self, download_dir, config):
        self.download_dir = download_dir
        self.config = config
        self.driver = None
        self.navigator = None

    def start_browser(self):
        options = uc.ChromeOptions()
        prefs = {
            "download.default_directory": self.download_dir,
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True
        }
        options.add_experimental_option("prefs", prefs)

        if self.config.headless:
            options.headless = True
            
        if self.config.user_agent:
            options.add_argument(f'--user-agent={self.config.user_agent}')
            
        if self.config.proxy_host and self.config.proxy_port:
            options.add_argument(f'--proxy-server={self.config.proxy_host}:{self.config.proxy_port}')

        version = get_chrome_version()
        try:
            if version:
                self.driver = uc.Chrome(options=options, version_main=version, user_data_dir=self.config.chrome_profile_dir)
            else:
                self.driver = uc.Chrome(options=options, user_data_dir=self.config.chrome_profile_dir)
        except Exception as e:
            print(f"Failed to start Chrome browser: {str(e)}")
            sys.exit(1)
            
        self.navigator = Navigator(self)

    def stop_browser(self):
        if self.driver:
            try: self.driver.quit()
            except: pass

    def is_alive(self):
        if not self.driver: return False
        try:
            _ = self.driver.current_url
            return True
        except:
            return False

    def ensure_healthy_session(self):
        """
        Ensures the browser session is active and healthy.
        Attempts to open a new tab and close older handles first (preserving session/login).
        If that fails, it stops and restarts the browser.
        Returns: True if session recovered via tab recovery, False if it was completely restarted.
        """
        if not self.driver:
            self.start_browser()
            return False

        try:
            old_handles = self.driver.window_handles
            self.driver.switch_to.new_window('tab')
            time.sleep(1)
            
            new_handle = self.driver.current_window_handle
            for handle in old_handles:
                try:
                    self.driver.switch_to.window(handle)
                    self.driver.close()
                except:
                    pass
            self.driver.switch_to.window(new_handle)
            return True
        except Exception as e:
            print(f"[Browser] Tab recovery failed: {str(e)}. Restarting Chrome browser...")
            try: self.stop_browser()
            except: pass
            self.start_browser()
            return False

    def cleanup_tabs(self, main_handle):
        try:
            if not self.driver or not main_handle:
                return
            handles = self.driver.window_handles
            if len(handles) > 1:
                for h in handles:
                    if h != main_handle:
                        try:
                            self.driver.switch_to.window(h)
                            self.driver.close()
                        except:
                            pass
                self.driver.switch_to.window(main_handle)
        except Exception as e:
            print(f"Warning during tab cleanup: {str(e)}")

    def clear_download_folder(self):
        if os.path.exists(self.download_dir):
            for f in glob.glob(os.path.join(self.download_dir, "*")):
                try: os.remove(f)
                except: pass

    def check_download_occurred(self):
        try:
            files = glob.glob(os.path.join(self.download_dir, "*"))
            valid_files = [f for f in files if not f.endswith('.crdownload') and not f.endswith('.tmp')]
            return len(valid_files) > 0
        except: return False

    def wait_for_immediate_download(self, max_wait=4.0):
        start = time.time()
        while time.time() - start < max_wait:
            if self.check_download_occurred(): return True
            time.sleep(0.5)
        return False

    def wait_for_download(self, timeout=45):
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                files = glob.glob(os.path.join(self.download_dir, "*"))
                valid_files = [f for f in files if not f.endswith('.crdownload') and not f.endswith('.tmp')]
                if valid_files: return max(valid_files, key=os.path.getctime)
            except: pass
            time.sleep(1)
        return None

    def attempt_download(self, doi):
        if not self.driver: return None
        main_handle = None
        try: main_handle = self.driver.current_window_handle
        except: pass

        if doi.startswith('http://') or doi.startswith('https://'): target_url = doi
        else: target_url = f"{self.config.proxy_base_url}{doi}"

        try:
            self.driver.get(target_url)
            time.sleep(5)

            try:
                if "too many downloads" in self.driver.page_source.lower():
                    raise ProxyRateLimitException("Too many downloads")
            except ProxyRateLimitException:
                raise
            except:
                pass

            current_url = self.driver.current_url.lower()
            pdf_url = self.navigator.cascade_find_pdf(current_url)

            result_file = None
            if pdf_url == "ALREADY_DOWNLOADED":
                result_file = self.wait_for_download()
            elif pdf_url:
                self.driver.get(pdf_url)
                time.sleep(5)
                try:
                    if "too many downloads" in self.driver.page_source.lower():
                        raise ProxyRateLimitException("Too many downloads")
                except ProxyRateLimitException:
                    raise
                except:
                    pass
                result_file = self.wait_for_download()
            return result_file
        except ProxyRateLimitException:
            self.cleanup_tabs(main_handle)
            raise
        except Exception as e:
            print(f"Browser navigation error for {doi}: {str(e)}")
            self.cleanup_tabs(main_handle)
            return None

# ==============================================================================
# FLASK SERVER endpoints
# ==============================================================================
app = Flask(__name__)
CORS(app)

def require_auth(f):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid token"}), 401
        token = auth_header.split(' ')[1]
        if token != SESSION_TOKEN:
            return jsonify({"error": "Unauthorized"}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

@app.route('/pair', methods=['POST'])
def handle_pair():
    global SESSION_TOKEN, STATUS, WORKER_ID, IDE_HOST
    data = request.json or {}
    code = data.get('pairing_code')
    if code == PAIRING_CODE:
        SESSION_TOKEN = str(random.randint(1000000000, 9999999999))
        STATUS = "IDLE"
        WORKER_ID = data.get('worker_id', 'REMOTE')
        
        # Auto-correct IDE_HOST if the script was downloaded via localhost but paired remotely
        caller_ip = request.remote_addr
        if IDE_HOST.startswith("http://localhost") or IDE_HOST.startswith("http://127.0.0.1"):
            if caller_ip and caller_ip not in ["127.0.0.1", "::1", "localhost"]:
                # Extract the port from the current IDE_HOST (usually 3000)
                try:
                    port = IDE_HOST.split(":")[-1]
                    if not port.isdigit(): port = "3000"
                except:
                    port = "3000"
                IDE_HOST = f"http://{caller_ip}:{port}"
                print(f"\n[INFO] Auto-corrected IDE_HOST to {IDE_HOST} based on incoming pairing request IP.")
        
        save_config()
        print(f"\n[OK] Pairing successful! Session token generated.")
        return jsonify({"success": True, "session_token": SESSION_TOKEN})
    return jsonify({"error": "Invalid pairing code"}), 401

@app.route('/status', methods=['GET'])
@require_auth
def handle_status():
    # calculate speed
    if telemetry["start_time"] and telemetry["done"] > 0:
        elapsed_hours = (time.time() - telemetry["start_time"]) / 3600
        telemetry["speed_pph"] = int(telemetry["done"] / elapsed_hours)
    return jsonify({
        "status": STATUS,
        "telemetry": telemetry
    })

@app.route('/start', methods=['POST'])
@require_auth
def handle_start():
    global STATUS, ACTIVE_PROJECT_ID, telemetry
    data = request.json or {}
    proj_id = data.get('project_id')
    if proj_id:
        ACTIVE_PROJECT_ID = proj_id
        if STATUS != "SCRAPING":
            STATUS = "SCRAPING"
        if not telemetry["start_time"]:
            telemetry["start_time"] = time.time()
        return jsonify({"success": True, "message": "Scraper awakened"})
    return jsonify({"error": "Missing project_id"}), 400

@app.route('/resume', methods=['POST'])
@require_auth
def handle_resume():
    global STATUS
    if STATUS == "WAITING_LOGIN":
        STATUS = "SCRAPING"
    return jsonify({"success": True})

@app.route('/cancel', methods=['POST'])
@require_auth
def handle_cancel():
    global STATUS, ACTIVE_PROJECT_ID
    STATUS = "IDLE"
    ACTIVE_PROJECT_ID = None
    return jsonify({"success": True})

# ==============================================================================
# BACKGROUND WORKER LOOP
# ==============================================================================
def worker_loop():
    global STATUS, telemetry, IDE_HOST
    
    download_dir = os.path.abspath(os.path.join(os.getcwd(), 'pdf_library', 'downloads'))
    os.makedirs(download_dir, exist_ok=True)
    config = ScraperConfig()

    browser = None
    worker_id = None

    while IS_RUNNING:
        time.sleep(3)

        if not SESSION_TOKEN:
            continue
            
        if STATUS == "WAITING_LOGIN":
            continue

        if not ACTIVE_PROJECT_ID or STATUS == "IDLE":
            # If no active project, we wait until /start is called
            continue

        if STATUS == "SCRAPING":
            # Attempt to claim a batch
            try:
                # We need the worker_id from the IDE_HOST somehow. 
                # Actually, the IDE host might not have sent it to us, but the /pair request might have had it?
                # The IDE host URL for claiming needs worker_id. Let's get it from the pair if possible? 
                # Wait, we can just use the pairing endpoint to store worker_id
                pass
            except Exception:
                pass
            
            claim_url = f"{IDE_HOST}/api/remote-worker/claim?worker_id={WORKER_ID}&project_id={ACTIVE_PROJECT_ID}"
            print(f"[DEBUG] Requesting batch from: {claim_url}")
            try:
                # We need to authenticate to the IDE host? The IDE host doesn't require auth for /claim, but expects worker_id
                # Let's just fetch it
                resp = requests.get(claim_url, timeout=10)
                print(f"[DEBUG] IDE responded with status: {resp.status_code}")
                
                if resp.status_code == 200:
                    data = resp.json()
                    batch = data.get('papers', [])
                    print(f"[DEBUG] Received batch of {len(batch)} papers.")
                    proxy_base_url = data.get('proxy_base_url')
                    if proxy_base_url:
                        config.proxy_base_url = proxy_base_url
                    
                    scraper_config = data.get('scraper_config', {})
                    if scraper_config:
                        config.delay_seconds = scraper_config.get('delay_seconds', config.delay_seconds)
                        config.jitter_seconds = scraper_config.get('jitter_seconds', config.jitter_seconds)
                        
                        # In the IDE, 'headed_mode' implies the opposite of 'headless'
                        headed_mode = scraper_config.get('headed_mode')
                        if headed_mode is not None:
                            config.headless = not headed_mode
                    
                    if not batch:
                        STATUS = "IDLE"
                        continue

                    if not browser:
                        browser = BrowserHandler(download_dir, config)
                        browser.start_browser()
                        print("\n[OK] Browser started.")

                        # If proxy config is set and not the default doi.org, attempt login check
                        if config.proxy_base_url and config.proxy_base_url.strip() and config.proxy_base_url.strip().lower().rstrip('/') != "https://doi.org":
                            print(f"\n[INFO] Redirecting browser to proxy login URL: {config.proxy_base_url}")
                            try:
                                browser.driver.get(config.proxy_base_url)
                            except Exception as e:
                                print(f"[WARN] Failed to navigate to proxy URL: {e}")
                            
                            print("\n" + "="*60)
                            print(" [ACTION REQUIRED]")
                            print(" Please log in via the newly opened Chrome window.")
                            print(" Once you have successfully logged in, click the 'Resume'")
                            print(" button in the SLR Magic IDE (or send a /resume request).")
                            print("="*60 + "\n")
                            
                            STATUS = "WAITING_LOGIN"
                            
                            while STATUS == "WAITING_LOGIN" and IS_RUNNING:
                                time.sleep(1)
                                
                            print("[INFO] Login step passed. Resuming scraping pipeline...")

                    for paper in batch:
                        if STATUS != "SCRAPING":
                            break # Cancelled mid-batch

                        if browser:
                            recovered_via_tab = browser.ensure_healthy_session()
                            if not recovered_via_tab:
                                # Only re-authenticate and request login if it was a hard restart
                                if config.proxy_base_url and config.proxy_base_url.strip() and config.proxy_base_url.strip().lower().rstrip('/') != "https://doi.org":
                                    print(f"[INFO] Re-authenticating via proxy: {config.proxy_base_url}")
                                    try:
                                        browser.driver.get(config.proxy_base_url)
                                        time.sleep(5)
                                        current_url = browser.driver.current_url.lower()
                                        if "login" in current_url or "auth" in current_url or "signin" in current_url:
                                            print("\n" + "="*60)
                                            print(" [ACTION REQUIRED] Please log in via the newly opened Chrome window.")
                                            print(" Once you have successfully logged in, click the 'Resume'")
                                            print(" button in the SLR Magic IDE (or send a /resume request).")
                                            print("="*60 + "\n")
                                            
                                            STATUS = "WAITING_LOGIN"
                                            while STATUS == "WAITING_LOGIN" and IS_RUNNING:
                                                time.sleep(1)
                                            print("[INFO] Login step passed. Resuming scraping pipeline...")
                                    except Exception as e:
                                        print(f"[ERROR] Failed to navigate to proxy on restart: {e}")
                            
                        paper_id = paper['paper_id']
                        doi_raw = paper.get('doi', '')
                        title = paper.get('title', 'Unknown')
                        
                        telemetry["current_paper"] = title
                        
                        print(f"Scraping: {title[:50]}...")
                        doi = extract_doi_value(doi_raw)
                        
                        browser.clear_download_folder()
                        try:
                            downloaded = browser.attempt_download(doi)
                        except ProxyRateLimitException:
                            print("[WARNING] Proxy rate limit reached ('Too many downloads'). Pausing loop for 30 minutes...")
                            
                            sleep_needed = 1800
                            slept = 0
                            while slept < sleep_needed and STATUS == "SCRAPING" and IS_RUNNING:
                                time.sleep(5)
                                slept += 5
                                
                            # Retry
                            try:
                                downloaded = browser.attempt_download(doi)
                            except Exception as retry_err:
                                downloaded = None
                        
                        result_payload = {
                            "worker_id": WORKER_ID,
                            "paper_id": paper_id
                        }
                        
                        files = None
                        if downloaded and os.path.exists(downloaded):
                            is_valid, validation_msg = validate_scraped_pdf(downloaded)
                            if not is_valid:
                                result_payload["status"] = "FAILED"
                                result_payload["error_reason"] = f"Validation failed: {validation_msg}"
                                telemetry["failed"] += 1
                                print(f"  -> Failed: {validation_msg}")
                            else:
                                result_payload["status"] = "DOWNLOADED"
                                files = {'file': (f"{paper_id}.pdf", open(downloaded, 'rb'), 'application/pdf')}
                                telemetry["done"] += 1
                                print("  -> Success!")
                        else:
                            result_payload["status"] = "FAILED"
                            result_payload["error_reason"] = "Download failed or timed out"
                            telemetry["failed"] += 1
                            print("  -> Failed: Timeout or no PDF link found")

                        # Post result back to IDE
                        try:
                            result_url = f"{IDE_HOST}/api/remote-worker/result"
                            requests.post(result_url, data=result_payload, files=files, timeout=60)
                        except Exception as e:
                            print(f"Failed to post result back to IDE: {e}")
                            
                        # Cleanup temp files
                        if files:
                            files['file'][1].close()
                        try:
                            if downloaded and os.path.exists(downloaded):
                                os.remove(downloaded)
                        except: pass

                        # Delay between requests
                        time.sleep(config.delay_seconds + random.uniform(0, config.jitter_seconds))
                else:
                    print(f"[ERROR] IDE returned status {resp.status_code}: {resp.text}")
                    if resp.status_code == 404:
                        print("[ERROR] Worker may have been deleted on the IDE side or project not found.")
            except requests.exceptions.RequestException as e:
                print(f"[ERROR] Failed to connect to IDE at {claim_url}: {e}")
                
            if not IS_RUNNING and browser:
                browser.stop_browser()

# ==============================================================================
# MAIN
# ==============================================================================
if __name__ == '__main__':
    print("="*60)
    print("   SLR MAGIC - REMOTE WORKER NODE")
    print("="*60)
    print("This script allows your computer to act as a remote PDF scraper")
    print("for an SLR Magic IDE running elsewhere on your network.\n")
    
    injected_host = "INJECT_IDE_HOST_HERE"
    
    # Load any previously saved config (restores IDE_HOST, PAIRING_CODE, SESSION_TOKEN, etc)
    load_config()
    
    # If the IDE injected a host during download, use it if we don't have one
    if injected_host != "INJECT" + "_" + "IDE_HOST_HERE":
        # If the injected host is better than our current one, use it
        if not IDE_HOST or (IDE_HOST.startswith("http://localhost") and not injected_host.startswith("http://localhost")):
            IDE_HOST = injected_host
            save_config()
    
    # If still no IDE host, ask the user
    if not IDE_HOST:
        IDE_HOST = input("Enter the URL of the SLR Magic IDE (e.g. http://192.168.1.5:3000): ").strip()
        save_config()

    print(f"Waiting for IDE to pair...")
    if SESSION_TOKEN:
        print(f"-> Worker is ALREADY PAIRED from a previous session.")
        print(f"-> You do NOT need to re-pair it in the IDE.")
        print(f"-> If you deleted it in the IDE, use Pairing Code: {PAIRING_CODE}")
    else:
        print(f"-> In SLR Magic IDE, go to 'Distributed Remote Scraping'")
        print(f"-> Click 'Add Remote Worker'")
        print(f"-> Worker Host: http://<THIS_MACHINE_IP>:7291")
        print(f"-> Pairing Code: {PAIRING_CODE}")
    if not IDE_HOST.startswith("http"):
        IDE_HOST = "http://" + IDE_HOST
    while IDE_HOST.endswith('/'):
        IDE_HOST = IDE_HOST[:-1]
        
    print("\nStarting local server...")
    
    # Start background loop
    t = threading.Thread(target=worker_loop, daemon=True)
    t.start()
    
    print("\n" + "="*60)
    print(f" >> PAIRING CODE: {PAIRING_CODE} <<")
    print("="*60)
    print("1. Go to the SLR Magic IDE -> Remote Workers tab.")
    print(f"2. Add a new worker with host: http://<this-computers-ip>:7291")
    print("3. Enter the 6-digit code above to securely pair.")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=7291, threaded=True)
