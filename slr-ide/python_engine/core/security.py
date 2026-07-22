import re
import hashlib
import sys

def sanitize_string(s):
    if not s:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(s).lower())

def sanitize_doi(doi):
    if not doi:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '_', str(doi).lower())

def calculate_md5(file_path):
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        print(f"Error calculating MD5 for {file_path}: {e}", file=sys.stderr)
        return None
