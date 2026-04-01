from middleman.config import Config
Config.DB_FILE = "slr_cache.db"
from middleman.repository import CacheRepository
repo = CacheRepository(Config.DB_FILE)
repo.set_endpoint_label("http://localhost:11434", "Local Ollama")
print(repo.get_stats())
