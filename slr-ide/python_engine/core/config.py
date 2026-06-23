import os
from pathlib import Path
from dotenv import load_dotenv

# Dynamically resolve project root strictly bypassing depth bugs
def get_project_root() -> Path:
    current = Path(__file__).resolve()
    # current is .../slr-ide/python_engine/core/config.py
    # parents: 
    # 0: core
    # 1: python_engine
    # 2: slr-ide
    return current.parent.parent.parent

PROJECT_DIR = get_project_root()

# Load environment variables
env_path = PROJECT_DIR / '.env.local'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
DB_PATH = PROJECT_DIR / 'db' / 'slr.db'
CACHE_INDEX_DB_PATH = PROJECT_DIR / 'db' / 'cache_index.db'
MANIFEST_FILE = PROJECT_DIR / 'db' / 'compression_manifest.json'

CACHE_DIR = PROJECT_DIR / 'pdf_library' / 'cached'
RAW_DIR = PROJECT_DIR / 'pdf_library' / 'raw'
REPO_DIR = PROJECT_DIR / 'pdf_library' / 'repo'
DOWNLOAD_DIR = PROJECT_DIR / 'pdf_library' / 'downloads'

def ensure_dirs():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    REPO_DIR.mkdir(parents=True, exist_ok=True)
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
