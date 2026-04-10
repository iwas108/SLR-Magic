import argparse
import asyncio
import multiprocessing
import signal
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
import time

from middleman.config import Config, logger
from middleman.repository import CacheRepository
from middleman.service import OllamaService

from middleman.routes import api
from middleman.routes.api import api_router, web_api_router
from middleman.routes.ui import ui_router

# =====================================================================
# Main App Lifecycle & Serving
# =====================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Dependencies
    cache_repo = CacheRepository(Config.DB_FILE)
    ollama_service = OllamaService(Config.OLLAMA_URLS, Config.STREAM_OLLAMA)

    # Inject dependencies into routers
    api.cache_repo = cache_repo
    api.ollama_service = ollama_service

    # Load endpoint configs from DB and sync with OllamaService
    # Fallback to CLI URLs if DB is empty
    db_configs = cache_repo.get_all_endpoint_configs()
    if not db_configs:
        for url in Config.OLLAMA_URLS:
            cache_repo.upsert_endpoint_config(url, True, "", "")
        db_configs = cache_repo.get_all_endpoint_configs()

    ollama_service.sync_endpoints(db_configs)

    logger.info(f"🚀 Middleman started. (Streaming: {Config.STREAM_OLLAMA} | Translation Mode: Active)")
    logger.info(f"🔗 Active Endpoints ({len(Config.OLLAMA_URLS)}): {', '.join(Config.OLLAMA_URLS)}")
    logger.info("🌐 Web Review UI available at http://localhost:8899")
    yield

# Create Shared Application
app = FastAPI(lifespan=lifespan)
app.include_router(api_router)
app.include_router(web_api_router)
app.include_router(ui_router)

# Serve static files for Bootstrap and local CSS/JS
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

def run_server(server_urls: list, stream: bool, update_cache: bool):
    Config.OLLAMA_URLS = server_urls
    Config.STREAM_OLLAMA = stream
    Config.UPDATE_CACHE = update_cache
    # Run the unified app on port 8899 (which is what the UI instructions say)
    # The proxy API can easily be accessed at the same port /v1/chat/completions
    uvicorn.run(app, host="0.0.0.0", port=8899, log_level="warning")

def main():
    parser = argparse.ArgumentParser(description="Ollama Caching Proxy")
    parser.add_argument("--stream", action="store_true", help="Enable internal streaming")
    parser.add_argument("--server", type=str, default="http://127.0.0.1:11434", help="Ollama Server URLs separated by comma (e.g., http://127.0.0.1:11434,http://192.168.1.5:11434)")
    parser.add_argument("--update-cache", action="store_true", help="Update existing cache or create if not exists")
    args = parser.parse_args()

    raw_urls = [u.strip().rstrip('/') for u in args.server.split(',')]
    server_urls = [f"{u}/api/chat" for u in raw_urls if u]

    # Also set for the main process just in case
    Config.OLLAMA_URLS = server_urls
    Config.STREAM_OLLAMA = args.stream
    Config.UPDATE_CACHE = args.update_cache

    p1 = multiprocessing.Process(target=run_server, args=(server_urls, args.stream, args.update_cache))
    p1.start()

    def kill_children():
        try:
            os.kill(p1.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    def handle_sigterm(signum, frame):
        kill_children()
        os._exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)

    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                time.sleep(1)
    except KeyboardInterrupt:
        kill_children()
        os._exit(0)

if __name__ == "__main__":
    main()
