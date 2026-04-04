import sqlite3
import json
import os
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.getcwd(), "app.db")

DEFAULT_CONFIG = {
    "DOWNLOADER_CSV_FILE": "database.csv",
    "DOWNLOADER_DOWNLOAD_DIR": os.path.join(os.getcwd(), "temp_pdfs"),
    "DOWNLOADER_FINAL_DIR": os.path.join(os.getcwd(), "Downloaded_PDFs"),
    "DOWNLOADER_CHROME_PROFILE_DIR": os.path.join(os.getcwd(), "chrome_profile"),
    "DOWNLOADER_PROXY_BASE_URL": os.environ.get("PROXY_BASE_URL", "https://ezproxy.library.domain.com/login?url=https://doi.org/"),
    "DOWNLOADER_TIMEOUT": 45,
    "DOWNLOADER_DELAY_SECONDS": 20,
    "DOWNLOADER_JITTER_SECONDS": 5,
    "DOWNLOADER_TARGET_DECISIONS": ["Include", "Maybe"],
    "DOWNLOADER_DECISION_COLUMN": "decision",
    "DOWNLOADER_PAPER_ID_COLUMN": "Paper_ID",
    "DOWNLOADER_DOI_COLUMN": "DOI_Link",

    "VERIFIER_INPUT_CSV": "database.csv",
    "VERIFIER_PDF_FOLDER": "Downloaded_PDFs",
    "VERIFIER_OUTPUT_CSV": "verified_results.csv",
    "VERIFIER_MATCH_THRESHOLD": 85,

    "COMPRESSOR_INPUT_FOLDER_NAME": "Downloaded_PDFs",
    "COMPRESSOR_OUTPUT_FOLDER_NAME": "compressed",
    "COMPRESSOR_COMPRESSION_LEVEL": "/ebook",

    "SYNCER_SOURCE_FOLDERS": ["compressed"],
    "SYNCER_REMOTE_GDRIVE": "gdrive",
    "SYNCER_DEST_BACKUP": "00 PHD Research/My First SLR/PDFs",
}

def get_connection():
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Configurations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS configs (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # Download cache table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS download_cache (
            paper_id TEXT PRIMARY KEY
        )
    """)

    # Compression manifest table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS compression_manifest (
            filename TEXT PRIMARY KEY,
            mtime REAL,
            original_size INTEGER,
            compressed_size INTEGER
        )
    """)
    conn.commit()

    # Migrate old download cache if exists
    cache_file = "download_cache.json"
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_papers = json.load(f)
                for paper_id in cached_papers:
                    add_to_download_cache(paper_id, _conn=conn)
            logger.info("Migrated old download_cache.json to SQLite")
            os.remove(cache_file)
        except Exception as e:
            logger.error(f"Failed to migrate old download cache: {e}")

    # Migrate old compression manifest if exists
    manifest_file = "compression_manifest.json"
    if os.path.exists(manifest_file):
        try:
            with open(manifest_file, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
                for filename, data in manifest.items():
                    update_compression_manifest(
                        filename, data.get("mtime"), data.get("original_size"), data.get("compressed_size"), _conn=conn
                    )
            logger.info("Migrated old compression_manifest.json to SQLite")
            os.remove(manifest_file)
        except Exception as e:
            logger.error(f"Failed to migrate old compression manifest: {e}")

    # Initialize default configurations if missing
    for key, val in DEFAULT_CONFIG.items():
        existing = cursor.execute("SELECT value FROM configs WHERE key = ?", (key,)).fetchone()
        if existing is None:
            set_config(key, val)

    conn.close()

def get_config(key):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM configs WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()

    if row is None:
        return DEFAULT_CONFIG.get(key)

    val_str = row[0]
    try:
        return json.loads(val_str)
    except json.JSONDecodeError:
        return val_str

def set_config(key, value):
    conn = get_connection()
    cursor = conn.cursor()
    val_str = json.dumps(value) if isinstance(value, (list, dict, int, float, bool)) else value
    cursor.execute("""
        INSERT INTO configs (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    """, (key, val_str))
    conn.commit()
    conn.close()

def get_all_configs():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM configs")
    rows = cursor.fetchall()
    conn.close()

    configs = {}
    for k, v in rows:
        try:
            configs[k] = json.loads(v)
        except json.JSONDecodeError:
            configs[k] = v
    return configs

# Download Cache Operations
def get_download_cache():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT paper_id FROM download_cache")
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]

def add_to_download_cache(paper_id, _conn=None):
    conn = _conn or get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR IGNORE INTO download_cache (paper_id)
        VALUES (?)
    """, (paper_id,))
    conn.commit()
    if not _conn:
        conn.close()

# Compression Manifest Operations
def get_compression_manifest():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT filename, mtime, original_size, compressed_size FROM compression_manifest")
    rows = cursor.fetchall()
    conn.close()

    manifest = {}
    for row in rows:
        manifest[row[0]] = {
            "mtime": row[1],
            "original_size": row[2],
            "compressed_size": row[3]
        }
    return manifest

def update_compression_manifest(filename, mtime, original_size, compressed_size, _conn=None):
    conn = _conn or get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO compression_manifest (filename, mtime, original_size, compressed_size)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET
            mtime = excluded.mtime,
            original_size = excluded.original_size,
            compressed_size = excluded.compressed_size
    """, (filename, mtime, original_size, compressed_size))
    conn.commit()
    if not _conn:
        conn.close()

def remove_from_compression_manifest(filename):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM compression_manifest WHERE filename = ?", (filename,))
    conn.commit()
    conn.close()
