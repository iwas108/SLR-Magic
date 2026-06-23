import time
import json
import sys
import re
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

from python_engine.crawler.dom_parser import (
    accept_cookies,
    check_and_click_checkboxes,
    find_candidate_elements
)

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
                print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Found direct meta PDF: {pdf_url}"}))
                sys.stdout.flush()
                orig_url = self.driver.current_url
                self.driver.get(pdf_url)
                if self.browser.wait_for_immediate_download(4.0):
                    return True
                self.driver.get(orig_url)
                time.sleep(2)
        except:
            pass

        candidates = find_candidate_elements(self.driver, curr_url)
        if not candidates:
            return False

        print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Found {len(candidates)} candidates."}))
        sys.stdout.flush()

        for idx, (element, label, score, abs_href) in enumerate(candidates):
            try:
                if not element.is_displayed():
                    continue
            except:
                continue

            print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] Clicking candidate #{idx+1}: '{label}' (Score: {score})"}))
            sys.stdout.flush()
            orig_url = self.driver.current_url

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
                    time.sleep(0.5)
            except:
                pass

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

            if self.browser.wait_for_immediate_download(4.0):
                return True

            if abs_href and any(pi in abs_href.lower() for pi in [".pdf", "pdfdirect", "pdfft", "/pdf/"]):
                print(json.dumps({"event": "log", "message": f"[DFS Depth {depth}] PDF URL detected: {abs_href}. Following directly..."}))
                sys.stdout.flush()
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

        return False

    def _handle_ieee(self):
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

    def _handle_acm(self):
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

    def _handle_acta_hort(self):
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
