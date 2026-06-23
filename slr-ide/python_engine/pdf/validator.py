import os
import urllib.parse

try:
    from pypdf import PdfReader
    has_pypdf = True
except ImportError:
    has_pypdf = False

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
