import logging

# =====================================================================
# Configuration & Logging setup
# =====================================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("middleman")

# Disable httpx INFO logging to prevent leaking API keys in URLs
logging.getLogger("httpx").setLevel(logging.WARNING)

class Config:
    OLLAMA_URLS = ["http://127.0.0.1:11434/api/chat"]
    DB_FILE = "slr_cache.db"
    STREAM_OLLAMA = False
    UPDATE_CACHE = False
