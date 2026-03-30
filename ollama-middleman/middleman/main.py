import argparse
import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

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
    ollama_service = OllamaService(Config.OLLAMA_URL, Config.STREAM_OLLAMA)

    # Inject dependencies into routers
    api.cache_repo = cache_repo
    api.ollama_service = ollama_service

    logger.info(f"🚀 Middleman started. (Streaming: {Config.STREAM_OLLAMA} | Translation Mode: Active)")
    yield

# Create Port 8000 Proxy Application
app = FastAPI(lifespan=lifespan)
app.include_router(api_router)

# Create Port 8899 Web Review Application
web_app = FastAPI()
# Serve static files for Bootstrap and local CSS/JS
static_dir = os.path.join(os.path.dirname(__file__), "static")
web_app.mount("/static", StaticFiles(directory=static_dir), name="static")
web_app.include_router(web_api_router)
web_app.include_router(ui_router)

async def serve():
    config_main = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="warning")
    server_main = uvicorn.Server(config_main)

    config_web = uvicorn.Config(web_app, host="0.0.0.0", port=8899, log_level="warning")
    server_web = uvicorn.Server(config_web)

    await asyncio.gather(
        server_main.serve(),
        server_web.serve()
    )

def main():
    parser = argparse.ArgumentParser(description="Ollama Caching Proxy")
    parser.add_argument("--stream", action="store_true", help="Enable internal streaming")
    parser.add_argument("--server", type=str, default="http://127.0.0.1:11434", help="Ollama Server URL (e.g., http://127.0.0.1:11434)")
    args = parser.parse_args()

    # Construct OLLAMA_URL from the server parameter
    server_url = args.server.rstrip('/')
    Config.OLLAMA_URL = f"{server_url}/api/chat"
    Config.STREAM_OLLAMA = args.stream

    asyncio.run(serve())

if __name__ == "__main__":
    main()
