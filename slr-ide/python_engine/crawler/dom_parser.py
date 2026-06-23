import time
import json
import sys
import urllib.parse
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By

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
        accept_keywords = [
            "accept all", "allow all", "accept cookies", "allow cookies", 
            "i accept", "accept", "allow", "agree", "consent"
        ]
        for kw in accept_keywords:
            try:
                xpath_expr = f"//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')] | //a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')] | //span[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{kw}')]/.."
                elms = driver.find_elements(By.XPATH, xpath_expr)
                for e in elms:
                    if e.is_displayed():
                        print(json.dumps({"event": "log", "message": f"Auto-clicking cookie acceptance element: '{e.text or kw}'"}))
                        sys.stdout.flush()
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
            "input[class*='terms']", "input[class*='agree']", "input[class*='accept']", "input[class*='consent']",
            "input[name*='ipbasedconfirmatie']",
            "[role='checkbox']"
        ]
        for selector in selectors:
            elms = driver.find_elements(By.CSS_SELECTOR, selector)
            for e in elms:
                try:
                    if e.is_displayed():
                        tag_name = e.tag_name.lower()
                        is_cb = (tag_name == 'input' and e.get_attribute('type') == 'checkbox') or (e.get_attribute('role') == 'checkbox')
                        
                        if tag_name == 'label':
                            for_id = e.get_attribute('for')
                            if for_id:
                                associated = driver.find_elements(By.ID, for_id)
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

def find_candidate_elements(driver, current_url):
    candidates = []
    try:
        elements = driver.find_elements(By.XPATH, "//a | //button | //*[@role='button'] | //*[contains(@class, 'btn') or contains(@class, 'button')]")
    except:
        return []

    seen_ids = set()
    high_keywords = ["download pdf", "download full text", "download full-text", "download direct", "pdf direct", "open pdf", "read pdf", "pdf download", "view pdf"]
    med_keywords = ["pdf", "download", "full text", "full-text", "view article", "read article", "get document"]
    low_keywords = ["view", "open", "read", "get", "go to"]

    for e in elements:
        try:
            element_id = e.id
            if element_id in seen_ids:
                continue
            seen_ids.add(element_id)

            if not e.is_displayed():
                continue

            try:
                is_ref = driver.execute_script("""
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

            abs_href = ""
            if href:
                try:
                    abs_href = urllib.parse.urljoin(current_url, href)
                except:
                    abs_href = href
            
            if abs_href:
                abs_href_lower = abs_href.lower()
                if ".pdf" in abs_href_lower or "pdfdirect" in abs_href_lower or "pdfft" in abs_href_lower or "/pdf/" in abs_href_lower:
                    score += 1000

            if ".pdf" in href or "/pdf/" in href or "pdfdirect" in href or "pdfft" in href:
                score += 150

            if "sciencedirect.com" in current_url:
                if "/reader/sd/pii/" in href or "/science/article/pii/" in href or "view pdf" in combined_str:
                    score += 250

            try:
                inner_html = e.get_attribute("innerHTML").lower()
                icon_keywords = ["download", "get_app", "file_download", "arrow-down", "arrowdown", "save-alt"]
                if any(ikw in inner_html for ikw in icon_keywords) or "<svg" in inner_html:
                    score += 30
            except:
                pass

            ignore_keywords = ["share", "citation", "cite", "twitter", "facebook", "linkedin", "email", "print", "permission", "reprint"]
            if any(ikw in combined_str for ikw in ignore_keywords):
                score -= 80

            nav_keywords = ["home", "contact", "about", "editorial", "help", "support", "privacy", "terms", "subscribe", "login", "register", "cookie"]
            if any(nkw in combined_str for nkw in nav_keywords):
                score -= 1000

            if score > 0:
                candidates.append((e, label[:50], score, abs_href))
        except:
            continue

    candidates.sort(key=lambda x: x[2], reverse=True)
    return candidates
