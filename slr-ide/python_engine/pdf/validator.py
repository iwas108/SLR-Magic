import os
import urllib.parse
import difflib
from python_engine.core.security import sanitize_string

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

def validate_scraped_pdf(file_path, expected_title=None, fuzzy_threshold=0.70):
    # 1. Size check
    try:
        size = os.path.getsize(file_path)
        if size < 5 * 1024:  # under 5KB
            return 'INVALID', f"File size too small ({size} bytes). Likely a paywall redirect HTML or empty file."
    except Exception as e:
        return 'INVALID', f"Error checking file size: {str(e)}"

    # 2. PDF Header check
    try:
        with open(file_path, 'rb') as f:
            header = f.read(1024)
            if b'%PDF-' not in header:
                return 'INVALID', "Invalid PDF header. File is not a PDF (likely HTML/text paywall or gatekeeper page)."
    except Exception as e:
        return 'INVALID', f"Error reading file header: {str(e)}"

    # 3. Text check (optional heuristic for booklet rejection)
    text = ""
    if has_pypdf:
        try:
            reader = PdfReader(file_path)
            if len(reader.pages) > 0:
                text = reader.pages[0].extract_text() or ""
        except Exception as e:
            # Since the header starts with %PDF-, the file is a PDF. 
            # We do not want to reject a valid PDF just because pypdf fails to parse its fonts/text.
            return 'VALID', f"Passed (PDF header valid, but text extraction failed: {str(e)})"
    else:
        return 'VALID', "Passed (pypdf not installed, skipped text validation)."

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
        return 'INVALID', f"Rejected as invalid paper. Contains conference/TOC keywords: {found_reject_kw} and lacks standard paper markers: {accept_markers}"

    # 4. Fuzzy Title Match Check (NEEDS_REVIEW)
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

    return 'VALID', "Valid scientific paper."

def validate_compressed_pdf(file_path):
    if not has_pypdf:
        return True, "pypdf not installed, skipped integrity validation."
    try:
        reader = PdfReader(file_path)
        if len(reader.pages) == 0:
            return False, "PDF has 0 pages."
        # Attempt to read the first page object to verify basic integrity
        _ = reader.pages[0]
        return True, "Valid"
    except Exception as e:
        return False, f"PDF structural check failed: {str(e)}"

