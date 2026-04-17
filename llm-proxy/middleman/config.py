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

logging.getLogger("httpx").setLevel(logging.ERROR)

class Config:
    OLLAMA_URLS = ["http://100.68.230.93:11434/api/chat"]
    DB_FILE = "slr_cache.db"
    STREAM_OLLAMA = False
    UPDATE_CACHE = False
