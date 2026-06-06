import os
import sys
import time
import glob
import shutil
import sqlite3
import re
import random
import json
import urllib.parse
import platform
import subprocess
from typing import List, Dict, Optional

# Solve distutils issue on Python 3.14 by importing setuptools first
try:
    import setuptools
except ImportError:
    pass

import undetected_chromedriver as uc
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

# Add pypdf fallback
try:
    from pypdf import PdfReader
    has_pypdf = True
except ImportError:
    has_pypdf = False

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_DIR, 'db', 'slr.db')
DOWNLOAD_DIR = os.path.join(PROJECT_DIR, 'downloaded_pdf')
RAW_DIR = os.path.join(PROJECT_DIR, 'raw_pdf')

class ScraperConfig:
    def __init__(self, conn):
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM configs")
        rows = cursor.fetchall()
        configs = {r[0]: r[1] for r in rows}

        self.proxy_base_url = configs.get('SCRAPER_PROXY_BASE_URL', 'https://ezproxy.library.domain.com/login?url=https://doi.org/')
        self.delay_seconds = float(configs.get('SCRAPER_DELAY_SECONDS', 20))
        self.jitter_seconds = float(configs.get('SCRAPER_JITTER_SECONDS', 5))
        self.headed_mode = configs.get('SCRAPER_HEADED_MODE', 'false').lower() == 'true'
        self.chrome_profile_dir = configs.get('SCRAPER_CHROME_PROFILE_DIR', os.path.join(PROJECT_DIR, 'chrome_profile'))
        
        # Absolute path conversions
        if not os.path.isabs(self.chrome_profile_dir):
            self.chrome_profile_dir = os.path.abspath(os.path.join(PROJECT_DIR, self.chrome_profile_dir))

def get_chrome_version() -> Optional[int]:
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
                except:
                    continue
    except:
        pass
    return None

class BrowserHandler:
    def __init__(self, download_dir: str, config: ScraperConfig):
        self.download_dir = download_dir
        self.config = config
        self.driver = None

    def start_browser(self):
        options = uc.ChromeOptions()
        options.add_argument(f"--user-data-dir={self.config.chrome_profile_dir}")
        
        # Force headed browser mode so that the user can interact/login
        # if not self.config.headed_mode:
        #     options.add_argument("--headless=new")
        
        prefs = {
            "download.default_directory": self.download_dir,
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True
        }
        options.add_experimental_option("prefs", prefs)

        version = get_chrome_version()
        try:
            if version:
                self.driver = uc.Chrome(options=options, version_main=version)
            else:
                self.driver = uc.Chrome(options=options)
        except Exception as e:
            print(json.dumps({"event": "error", "message": f"Failed to start Chrome browser: {str(e)}"}))
            sys.exit(1)

    def stop_browser(self):
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass

    def clear_download_folder(self):
        if os.path.exists(self.download_dir):
            for f in glob.glob(os.path.join(self.download_dir, "*")):
                try:
                    os.remove(f)
                except:
                    pass

    def wait_for_download(self, timeout: int = 45) -> Optional[str]:
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                files = glob.glob(os.path.join(self.download_dir, "*"))
                valid_files = [f for f in files if not f.endswith('.crdownload') and not f.endswith('.tmp')]
                if valid_files:
                    return max(valid_files, key=os.path.getctime)
            except:
                pass
            time.sleep(1)
        return None

    def attempt_download(self, doi: str) -> Optional[str]:
        if not self.driver:
            return None

        # Record main handle
        main_handle = None
        try:
            main_handle = self.driver.current_window_handle
        except:
            pass

        # Handle direct DOI links if it's already a URL
        if doi.startswith('http://') or doi.startswith('https://'):
            target_url = doi
        else:
            target_url = f"{self.config.proxy_base_url}{doi}"

        try:
            self.driver.get(target_url)
            time.sleep(5)  # Wait for initial page redirects

            current_url = self.driver.current_url.lower()

            # Trigger stateful cascading PDF finder
            pdf_url = self._cascade_find_pdf(current_url)

            result_file = None
            if pdf_url == "ALREADY_DOWNLOADED":
                result_file = self.wait_for_download()
            elif pdf_url:
                # If pdf_url is found, navigate directly to trigger download
                self.driver.get(pdf_url)
                result_file = self.wait_for_download()

            # TAB CLEANUP: Close all extra tabs and restore focus to main_handle
            self._cleanup_tabs(main_handle)

            return result_file

        except Exception as e:
            print(json.dumps({"event": "error", "message": f"Browser navigation error for {doi}: {str(e)}"}))
            # Fallback cleanup
            self._cleanup_tabs(main_handle)
            return None

    def _cleanup_tabs(self, main_handle):
        try:
            if not self.driver or not main_handle:
                return
            handles = self.driver.window_handles
            if len(handles) > 1:
                print(json.dumps({"event": "log", "message": f"Cleaning up {len(handles) - 1} extra tabs..."}))
                sys.stdout.flush()
                for h in handles:
                    if h != main_handle:
                        try:
                            self.driver.switch_to.window(h)
                            self.driver.close()
                        except:
                            pass
                self.driver.switch_to.window(main_handle)
        except Exception as e:
            print(json.dumps({"event": "log", "message": f"Warning during tab cleanup: {str(e)}"}))
            sys.stdout.flush()

    def _cascade_find_pdf(self, current_url: str) -> Optional[str]:

        # First, run domain-specific fast-paths
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

        # Initialize visited set for URLs to prevent recursion cycles
        visited_urls = {current_url}
        
        # Start stateful depth-first search with backtracking
        print(json.dumps({"event": "log", "message": "Initiating stateful backtracking download crawler..."}))
        sys.stdout.flush()
        if self._backtrack_search(depth=0, max_depth=3, visited=visited_urls):
            return "ALREADY_DOWNLOADED"
            
        return None

    def _backtrack_search(self, depth: int, max_depth: int, visited: set) -> bool:
        # Check if download occurred
        if self._check_download_occurred():
            print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] PDF successfully downloaded!"}))
            sys.stdout.flush()
            return True

        if depth >= max_depth:
            return False

        # Paywall/login check
        curr_url = self.driver.current_url.lower()
        wrong_keywords = ["login", "sign-in", "signin", "purchase", "subscribe", "paywall", "register", "checkout", "cart", "cookie-consent"]
        # Skip checking for wrong direction at depth 0, because target_url might contain ezproxy login url where the user already logged in.
        if depth > 0 and any(kw in curr_url for kw in wrong_keywords):
            print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Wrong direction detected (login/paywall page): {curr_url}. Backtracking..."}))
            sys.stdout.flush()
            return False

        # Auto-accept cookies (Allow All) and approve Terms
        self._accept_cookies()
        self._check_and_click_checkboxes()

        # Check for citation_pdf_url / eprints meta tags
        try:
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            meta_pdf = soup.find('meta', attrs={'name': 'citation_pdf_url'})
            if meta_pdf and meta_pdf.get('content'):
                pdf_url = meta_pdf['content']
                print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Found direct meta PDF: {pdf_url}"}))
                sys.stdout.flush()
                # Try to navigate or download it
                orig_url = self.driver.current_url
                self.driver.get(pdf_url)
                if self._wait_for_immediate_download(4.0):
                    return True
                self.driver.get(orig_url)
                time.sleep(2)
        except:
            pass

        # Identify candidate elements
        candidates = self._find_candidate_elements(curr_url)
        if not candidates:
            return False

        print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Found {len(candidates)} potential download candidates on the page."}))
        sys.stdout.flush()

        for idx, (element, label, score, abs_href) in enumerate(candidates):
            try:
                if not element.is_displayed():
                    continue
            except:
                continue

            print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Clicking candidate #{idx+1}: '{label}' (Score: {score})"}))
            sys.stdout.flush()

            # Record state
            orig_url = self.driver.current_url

            # Check if there is a checkbox near the download button (e.g., sharing an ancestor up to 4 levels)
            try:
                clicked_cb = self.driver.execute_script("""
                    var btn = arguments[0];
                    var curr = btn;
                    var maxDepth = 4;
                    for (var i = 0; i < maxDepth; i++) {
                        if (!curr) break;
                        var checkboxes = curr.querySelectorAll("input[type='checkbox'], [role='checkbox']");
                        for (var j = 0; j < checkboxes.length; j++) {
                            var cb = checkboxes[j];
                            if (cb && cb.offsetWidth > 0 && cb.offsetHeight > 0) {
                                var isChecked = cb.checked || cb.getAttribute('aria-checked') === 'true';
                                if (!isChecked) {
                                    cb.click();
                                    if (!cb.checked) cb.checked = true;
                                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                                    cb.dispatchEvent(new Event('click', { bubbles: true }));
                                    return true;
                                }
                            }
                        }
                        curr = curr.parentElement;
                    }
                    return false;
                """, element)
                if clicked_cb:
                    print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Auto-checked checkbox near candidate download button."}))
                    sys.stdout.flush()
                    time.sleep(0.5)
            except Exception as e:
                print(json.dumps({"event": "log", "message": f"Error checking near checkbox: {str(e)}"}))
                sys.stdout.flush()

            clicked_ok = False
            try:
                element.click()
                clicked_ok = True
            except:
                try:
                    self.driver.execute_script("arguments[0].click();", element)
                    clicked_ok = True
                except:
                    pass

            # Wait to register download (polling speedup)
            if self._wait_for_immediate_download(4.0):
                return True

            # If download did not happen, and target URL has direct PDF markers, follow it directly
            if abs_href and any(pi in abs_href.lower() for pi in [".pdf", "pdfdirect", "pdfft", "/pdf/"]):
                print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] PDF URL detected: {abs_href}. Following link directly..."}))
                sys.stdout.flush()
                try:
                    self.driver.get(abs_href)
                    if self._wait_for_immediate_download(4.0):
                        return True
                except Exception as get_err:
                    print(json.dumps({"event": "log", "message": f"Error following PDF URL: {str(get_err)}"}))
                    sys.stdout.flush()
                
                # Restore the original URL if direct navigation didn't trigger a download
                try:
                    self.driver.get(orig_url)
                    time.sleep(2)
                except:
                    pass
            elif not clicked_ok:
                # If click failed and there is no direct PDF link to follow, continue to next candidate
                continue

            new_url = self.driver.current_url
            if new_url != orig_url:
                if new_url not in visited:
                    visited.add(new_url)
                    # Recursively search the new page
                    if self._backtrack_search(depth + 1, max_depth, visited):
                        return True
                    # Backtrack if search failed
                    print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Path for '{label}' failed. Backtracking to previous page..."}))
                    sys.stdout.flush()
                    self.driver.back()
                    time.sleep(3)
                else:
                    self.driver.back()
                    time.sleep(2)
            else:
                # Handle tab/window popup
                handles = self.driver.window_handles
                if len(handles) > 1:
                    orig_handle = self.driver.current_window_handle
                    new_handle = [h for h in handles if h != orig_handle][0]
                    self.driver.switch_to.window(new_handle)
                    time.sleep(3)
                    if self._check_download_occurred():
                        return True
                    if self._backtrack_search(depth + 1, max_depth, visited):
                        return True
                    self.driver.close()
                    self.driver.switch_to.window(orig_handle)
                    time.sleep(2)

        return False

    def _check_download_occurred(self) -> bool:
        try:
            files = glob.glob(os.path.join(self.download_dir, "*"))
            valid_files = [f for f in files if not f.endswith('.crdownload') and not f.endswith('.tmp')]
            return len(valid_files) > 0
        except:
            return False

    def _wait_for_immediate_download(self, max_wait: float = 4.0) -> bool:
        start = time.time()
        while time.time() - start < max_wait:
            if self._check_download_occurred():
                return True
            time.sleep(0.5)
        return False

    def _accept_cookies(self):
        try:
            # Common keywords for accepting cookies
            accept_keywords = [
                "accept all", "allow all", "accept cookies", "allow cookies", 
                "i accept", "accept", "allow", "agree", "consent"
            ]
            for kw in accept_keywords:
                try:
                    xpath_expr = f"//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')] | //a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')] | //span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')]/.."
                    elms = self.driver.find_elements(By.XPATH, xpath_expr)
                    for e in elms:
                        if e.is_displayed():
                            print(json.dumps({"event": "log", "message": f"Auto-clicking cookie acceptance element: '{e.text or kw}'"}))
                            sys.stdout.flush()
                            try:
                                e.click()
                            except:
                                self.driver.execute_script("arguments[0].click();", e)
                            time.sleep(1)
                            return
                except:
                    pass
            # Dismiss overlays if buttons not found/obscuring
            self._dismiss_overlays()
        except:
            pass

    def _dismiss_overlays(self):
        try:
            overlay_selectors = [
                "#onetrust-consent-sdk", ".onetrust-pc-dark-filter", "#consent_blackbar",
                ".cookie-banner", "#cookie-consent", ".cookie-consent-modal",
                "#cookie-law-info-bar", "#cookie-law-info-again", ".cookie-popup",
                "#gdpr-consent-tool-wrapper", ".cc-banner", ".cc-window",
                "#sp-cookie-consent-notice", ".js-cookie-consent"
            ]
            for selector in overlay_selectors:
                self.driver.execute_script(f"""
                    var el = document.querySelector("{selector}");
                    if (el) {{ el.style.display = "none"; }}
                """)
        except:
            pass

    def _check_and_click_checkboxes(self):
        try:
            # Only target actual checkbox inputs, elements with role='checkbox', or labels for checkboxes
            selectors = [
                "input[type='checkbox']",
                "input[id*='terms']", "input[id*='agree']", "input[id*='accept']", "input[id*='consent']",
                "input[class*='terms']", "input[class*='agree']", "input[class*='accept']", "input[class*='consent']",
                "input[name*='ipbasedconfirmatie']",
                "[role='checkbox']"
            ]
            for selector in selectors:
                elms = self.driver.find_elements(By.CSS_SELECTOR, selector)
                for e in elms:
                    try:
                        if e.is_displayed():
                            tag_name = e.tag_name.lower()
                            is_cb = (tag_name == 'input' and e.get_attribute('type') == 'checkbox') or (e.get_attribute('role') == 'checkbox')
                            
                            # If it's a label, check if it's associated with a checkbox
                            if tag_name == 'label':
                                for_id = e.get_attribute('for')
                                if for_id:
                                    associated = self.driver.find_elements(By.ID, for_id)
                                    if associated:
                                        assoc_tag = associated[0].tag_name.lower()
                                        is_cb = (assoc_tag == 'input' and associated[0].get_attribute('type') == 'checkbox')
                            
                            if not is_cb:
                                continue

                            is_checked = e.get_attribute("checked") or e.is_selected()
                            if not is_checked:
                                print(json.dumps({"event": "log", "message": f"Checking T&C / consent checkbox: {selector}"}))
                                sys.stdout.flush()
                                e.click()
                                time.sleep(0.5)
                    except:
                        pass
        except:
            pass

    def _find_candidate_elements(self, current_url: str) -> List[tuple]:
        candidates = []
        try:
            elements = self.driver.find_elements(By.XPATH, "//a | //button | //*[@role='button'] | //*[contains(@class, 'btn') or contains(@class, 'button')]")
        except:
            return []

        seen_ids = set()
        
        # Scoring keywords
        high_keywords = ["download pdf", "download full text", "download full-text", "download direct", "pdf direct", "open pdf", "read pdf", "pdf download", "view pdf"]
        med_keywords = ["pdf", "download", "full text", "full-text", "view article", "read article", "get document"]
        low_keywords = ["view", "open", "read", "get", "go to"]

        for e in elements:
            try:
                # Deduplicate elements by Selenium's unique element ID
                element_id = e.id
                if element_id in seen_ids:
                    continue
                seen_ids.add(element_id)

                if not e.is_displayed():
                    continue

                # Check if element is inside references/bibliography section to avoid clicking footer reference links
                try:
                    is_ref = self.driver.execute_script("""
                        var el = arguments[0];
                        while (el) {
                            if (el.id && (el.id.toLowerCase().includes('reference') || el.id.toLowerCase().includes('bib') || el.id.toLowerCase().includes('footnote'))) return true;
                            if (el.className && (el.className.toLowerCase().includes('reference') || el.className.toLowerCase().includes('bib') || el.className.toLowerCase().includes('citation') || el.className.toLowerCase().includes('footnote') || el.className.toLowerCase().includes('reflink'))) return true;
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
                if is_ref:
                    score -= 1000

                label = text or el_title or el_id or el_class or "unlabeled"
                combined_str = f"{text} {href} {el_class} {el_id} {el_title}"

                # Non-relevant exclusions (images, full issues, legal, supplementary files, slavery)
                non_relevant = [
                    "image", "full issue", "full-size", "high-res", "slavery", "supplementary", 
                    "supplemental", "supporting", "slide", "video", "media", "audio", 
                    "powerpoint", "zip", "epub", "dataset"
                ]
                if any(nr in combined_str for nr in non_relevant):
                    score -= 1000

                if any(kw in combined_str for kw in high_keywords):
                    score += 100
                elif any(kw in combined_str for kw in med_keywords):
                    score += 50
                elif any(kw in combined_str for kw in low_keywords):
                    score += 20

                # Resolve relative URL to absolute
                abs_href = ""
                if href:
                    try:
                        abs_href = urllib.parse.urljoin(current_url, href)
                    except:
                        abs_href = href
                
                # Boost candidate score significantly if absolute target URL indicates a direct PDF download
                if abs_href:
                    abs_href_lower = abs_href.lower()
                    if ".pdf" in abs_href_lower or "pdfdirect" in abs_href_lower or "pdfft" in abs_href_lower or "/pdf/" in abs_href_lower:
                        score += 1000

                if ".pdf" in href or "/pdf/" in href or "pdfdirect" in href or "pdfft" in href:
                    score += 150

                # ScienceDirect specific high priority elements
                if "sciencedirect.com" in current_url:
                    if "/reader/sd/pii/" in href or "/science/article/pii/" in href or "view pdf" in combined_str:
                        score += 250

                # Check for nested download icon indicators
                try:
                    inner_html = e.get_attribute("innerHTML").lower()
                    icon_keywords = ["download", "get_app", "file_download", "arrow-down", "arrowdown", "save-alt"]
                    if any(ikw in inner_html for ikw in icon_keywords) or "<svg" in inner_html:
                        score += 30
                except:
                    pass

                # Penalty for sharing or citations links to avoid clicking wrong paths
                ignore_keywords = ["share", "citation", "cite", "twitter", "facebook", "linkedin", "email", "print", "permission", "reprint"]
                if any(ikw in combined_str for ikw in ignore_keywords):
                    score -= 80

                # Avoid standard navigation links
                nav_keywords = ["home", "contact", "about", "editorial", "help", "support", "privacy", "terms", "subscribe", "login", "register", "cookie"]
                if any(nkw in combined_str for nkw in nav_keywords):
                    score -= 1000

                if score > 0:
                    candidates.append((e, label[:50], score, abs_href))
            except:
                continue

        candidates.sort(key=lambda x: x[2], reverse=True)
        return candidates

    def _handle_ieee(self) -> bool:
        try:
            curr_url_lower = self.driver.current_url.lower()
            if "stamp.jsp" not in curr_url_lower and "getpdf.jsp" not in curr_url_lower:
                match = re.search(r'document/(\d+)', self.driver.current_url)
                if match:
                    doc_id = match.group(1)
                    base = self.driver.current_url.split('/document')[0]
                    stamp = f"{base}/stamp/stamp.jsp?tp=&arnumber={doc_id}"
                    self.driver.get(stamp)
                    time.sleep(4)

            iframes = self.driver.find_elements(By.TAG_NAME, "iframe")
            for frame in iframes:
                try:
                    self.driver.switch_to.frame(frame)
                    if len(self.driver.find_elements(By.ID, "open-button")) > 0:
                        btn = self.driver.find_element(By.ID, "open-button")
                        btn.click()
                        time.sleep(5)
                        self.driver.switch_to.default_content()
                        return True
                    self.driver.switch_to.default_content()
                except:
                    self.driver.switch_to.default_content()
        except:
            self.driver.switch_to.default_content()
        return False

    def _handle_acm(self) -> bool:
        try:
            try:
                ereader_btn = self.driver.find_element(By.CSS_SELECTOR, "a.btn--eReader, a.btn--ereader")
                ereader_btn.click()
                time.sleep(5)
            except:
                pass

            try:
                download_btn = self.driver.find_element(By.CSS_SELECTOR, "a.navbar-download")
                download_btn.click()
                time.sleep(5)
                return True
            except:
                try:
                    download_btn = self.driver.find_element(By.XPATH, "//span[contains(@class, 'material-icons') and contains(text(), 'get_app')]/..")
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
                self.driver.get(pdf_url)
                return True
        except:
            pass
        return False

    def _handle_acta_hort(self) -> bool:
        try:
            clicked = False
            try:
                link = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Article - full text') and contains(@href, 'showpdf')]")
                link.click()
                clicked = True
            except:
                try:
                    link = self.driver.find_element(By.PARTIAL_LINK_TEXT, "Article - full text")
                    link.click()
                    clicked = True
                except:
                    pass

            time.sleep(3)

            try:
                checkbox = self.driver.find_element(By.NAME, "ipbasedconfirmatie")
                if checkbox:
                    if not checkbox.is_selected():
                        checkbox.click()
                        time.sleep(0.5)
                    btn = self.driver.find_element(By.XPATH, "//input[@value='Continue']")
                    btn.click()
                    time.sleep(3)
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
                    open_btn.click()
                    time.sleep(5)
                    return True
            except:
                pass

            return clicked
        except:
            pass
        return False

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

def validate_scraped_pdf(file_path: str) -> tuple[bool, str]:
    # 1. Size check
    try:
        size = os.path.getsize(file_path)
        if size < 5 * 1024:  # under 5KB
            return False, f"File size too small ({size} bytes). Likely a paywall redirect HTML or empty file."
    except Exception as e:
        return False, f"Error checking file size: {str(e)}"

    # 2. Text check
    text = ""
    if has_pypdf:
        try:
            reader = PdfReader(file_path)
            if len(reader.pages) > 0:
                text = reader.pages[0].extract_text() or ""
        except Exception as e:
            return False, f"Error reading PDF via pypdf: {str(e)}"
    else:
        # If no pypdf, we cannot inspect the text, let's treat it as valid
        return True, "Passed (pypdf not installed, skipped text validation)."

    text_lower = text.lower()

    # Reject if it contains conference schedule / table of contents indicator keywords
    reject_keywords = [
        "conference schedule", "program of events", "table of contents", 
        "program schedule", "conference program", "session schedule", 
        "workshop program", "conference guide"
    ]
    
    found_reject_kw = [kw for kw in reject_keywords if kw in text_lower]
    
    # Accept if it contains standard paper markers
    accept_markers = ["abstract", "introduction", "references", "doi:"]
    found_accept_marker = [marker for marker in accept_markers if marker in text_lower]

    if found_reject_kw and not found_accept_marker:
        return False, f"Rejected as invalid paper. Contains conference/TOC keywords: {found_reject_kw} and lacks standard paper markers: {accept_markers}"

    return True, "Valid scientific paper."

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
                    """, (f"raw_pdf/{dest_filename}", paper_id))
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
