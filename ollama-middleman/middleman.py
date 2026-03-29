"""
Ollama Middleman Proxy
A caching layer for Ollama following FAIR principles and Clean Architecture.
"""

import sys
import json
import sqlite3
import hashlib
import logging
import argparse
from datetime import datetime
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# =====================================================================
# Configuration & Logging setup
# =====================================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("middleman")

class Config:
    OLLAMA_URL = "http://localhost:11434/v1/chat/completions"
    DB_FILE = "slr_cache.db"
    STREAM_OLLAMA = False  # Overridden by CLI args

# =====================================================================
# Repository Layer (Data Persistence)
# =====================================================================

class CacheRepository:
    """Handles all SQLite database operations for payload caching."""
    
    def __init__(self, db_file: str):
        self.db_file = db_file
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS cache (
                    payload_hash TEXT PRIMARY KEY,
                    response_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

    @staticmethod
    def generate_hash(messages: list) -> str:
        """Generates a SHA-256 fingerprint for precision caching."""
        message_str = json.dumps(messages, sort_keys=True)
        return hashlib.sha256(message_str.encode('utf-8')).hexdigest()

    def get(self, payload_hash: str) -> dict | None:
        with sqlite3.connect(self.db_file) as conn:
            c = conn.cursor()
            c.execute("SELECT response_json FROM cache WHERE payload_hash = ?", (payload_hash,))
            row = c.fetchone()
            return json.loads(row[0]) if row else None

    def set(self, payload_hash: str, response_data: dict):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (payload_hash, response_json) VALUES (?, ?)",
                (payload_hash, json.dumps(response_data))
            )

# =====================================================================
# Service Layer (LLM Interaction)
# =====================================================================

class OllamaService:
    """Handles communication with the Ollama backend."""
    
    def __init__(self, url: str, stream_mode: bool):
        self.url = url
        self.stream_mode = stream_mode

    async def fetch_completion(self, payload: dict) -> dict:
        """Determines the fetching strategy based on proxy config."""
        # Unload model after generation to prevent VRAM/RAM leaks
        payload["keep_alive"] = 0 

        if self.stream_mode:
            payload["stream"] = True
            return await self._fetch_via_stream(payload)
        
        payload["stream"] = False
        return await self._fetch_standard(payload)

    async def _fetch_standard(self, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=900.0) as client:
            response = await client.post(self.url, json=payload)
            response.raise_for_status()
            return response.json()
            
    async def _fetch_via_stream(self, payload: dict) -> dict:
        """
        Streams from Ollama to the proxy, prints to terminal for visual feedback,
        and dynamically colors <think> tags if Ollama sends them in the standard stream.
        """
        logger.info("📡 Receiving stream from Ollama...")
        full_content = ""
        base_response = {}
        
        # State trackers for terminal colors
        in_thinking = False
        buffer = ""

        async with httpx.AsyncClient(timeout=900.0) as client:
            async with client.stream("POST", self.url, json=payload) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                        
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                        
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    if not base_response:
                        base_response = {
                            "id": chunk.get("id", "chatcmpl-streamed"),
                            "object": "chat.completion",
                            "created": chunk.get("created", int(datetime.now().timestamp())),
                            "model": chunk.get("model", payload.get("model", "unknown")),
                            "choices": [{"index": 0, "message": {"role": "assistant", "content": ""}, "finish_reason": "stop"}]
                        }

                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    
                    # Grab content from either reasoning_content or standard content
                    content_piece = delta.get("reasoning_content", "") or delta.get("content", "")
                    
                    if content_piece:
                        full_content += content_piece
                        buffer += content_piece

                        # Check for opening tag
                        if "<think>" in buffer and not in_thinking:
                            print("\n\033[90m[🤔 Thinking...]\033[0m\n\033[90m", end="")
                            in_thinking = True
                            buffer = buffer.replace("<think>", "") # Clear tag from buffer trigger
                        
                        # Check for closing tag
                        if "</think>" in buffer and in_thinking:
                            print("\033[0m\n\n\033[92m[💡 Final Output]\033[0m\n", end="")
                            in_thinking = False
                            buffer = buffer.replace("</think>", "")
                        
                        # Print the token (Terminal will color it based on the state)
                        print(content_piece, end="", flush=True)

        if in_thinking:
            print("\033[0m", end="")
            
        print("\n") 
        logger.info("✅ Stream complete.")

        if base_response:
            base_response["choices"][0]["message"]["content"] = full_content
            
        return base_response

# =====================================================================
# API Routing & App Initialization
# =====================================================================

# Global instances initialized during app startup
cache_repo: CacheRepository
ollama_service: OllamaService

@asynccontextmanager
async def lifespan(app: FastAPI):
    global cache_repo, ollama_service
    cache_repo = CacheRepository(Config.DB_FILE)
    ollama_service = OllamaService(Config.OLLAMA_URL, Config.STREAM_OLLAMA)
    logger.info(f"🚀 Middleman started. (Ollama Streaming: {Config.STREAM_OLLAMA})")
    yield

app = FastAPI(lifespan=lifespan)

@app.post("/v1/chat/completions")
async def proxy_to_ollama(request: Request):
    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON payload"})
    
    messages = payload.get("messages", [])
    if not messages:
         return JSONResponse(status_code=400, content={"error": "No messages found in payload"})

    req_hash = cache_repo.generate_hash(messages)
    hash_short = req_hash[:8]

    # 1. Check Cache
    cached_response = cache_repo.get(req_hash)
    if cached_response:
        logger.info(f"⚡ CACHE HIT  | Hash: {hash_short} | Returning instant response.")
        return cached_response

    # 2. Fetch from Ollama (Cache Miss)
    logger.info(f"⏳ CACHE MISS | Hash: {hash_short} | Forwarding to Ollama...")
    try:
        response_data = await ollama_service.fetch_completion(payload)
        
        # 3. Save to Cache
        cache_repo.set(req_hash, response_data)
        logger.info(f"💾 CACHED     | Hash: {hash_short} | Saved successfully.")
        
        return response_data
        
    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP Error connecting to Ollama: {str(e)}")
        return JSONResponse(status_code=502, content={"error": f"Ollama connection error: {str(e)}"})
    except Exception as e:
        logger.error(f"❌ Internal Server Error: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# =====================================================================
# Execution Entry Point
# =====================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ollama Caching Proxy")
    parser.add_argument(
        "--stream", 
        action="store_true", 
        help="Enable internal streaming from Ollama to Middleman (prints generation live to terminal)"
    )
    args = parser.parse_args()
    
    # Set the config based on CLI argument
    Config.STREAM_OLLAMA = args.stream

    # Run the Uvicorn server programmatically
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning") 
    # Note: Uvicorn log level set to warning so it doesn't clutter our custom logger