"""
Ollama Middleman Proxy
A caching layer for Ollama following FAIR principles and Clean Architecture.
TRANSLATION MODE: Converts OpenAI requests to Native Ollama requests for max stability.
"""

import re
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
    OLLAMA_URL = "http://172.23.160.1:11434/v1/chat/completions"
    DB_FILE = "slr_cache.db"
    STREAM_OLLAMA = False

# =====================================================================
# Repository Layer
# =====================================================================

class CacheRepository:
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
# Service Layer (The OpenAI -> Native Translator)
# =====================================================================

class OllamaService:
    def __init__(self, url: str, stream_mode: bool):
        # Dynamically intercept and route to the NATIVE Ollama endpoint
        self.url = url.replace("/v1/chat/completions", "/api/chat")
        self.stream_mode = stream_mode

    async def fetch_completion(self, openai_payload: dict) -> dict:
        model_name = openai_payload.get("model", "qwen3.5-slr")
        messages = openai_payload.get("messages", [])
        
        # 1. TRANSLATE TO NATIVE PAYLOAD
        # This safely applies our VRAM limits without crashing the server!
        native_payload = {
            "model": model_name,
            "messages": messages,
            "keep_alive": 0, 
            "options": {
                "temperature": openai_payload.get("temperature", 0.6),
                "num_predict": openai_payload.get("max_tokens", 8192),
                "num_ctx": 16384  # <--- Safely restricts context to 16K tokens for AMD GPU!
            }
        }

        if self.stream_mode:
            native_payload["stream"] = True
            return await self._fetch_via_stream(native_payload, model_name, messages)
        
        native_payload["stream"] = False
        return await self._fetch_standard(native_payload, model_name)

    async def _fetch_standard(self, native_payload: dict, model_name: str) -> dict:
        async with httpx.AsyncClient(timeout=900.0) as client:
            response = await client.post(self.url, json=native_payload)
            response.raise_for_status()
            chunk = response.json()
            
            usage = {
                "prompt_tokens": chunk.get("prompt_eval_count", 0),
                "completion_tokens": chunk.get("eval_count", 0),
                "total_tokens": chunk.get("prompt_eval_count", 0) + chunk.get("eval_count", 0)
            }
            
            return {
                "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                "object": "chat.completion",
                "created": int(datetime.now().timestamp()),
                "model": model_name,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": chunk.get("message", {}).get("content", "")}, "finish_reason": "stop"}],
                "usage": usage
            }
            
    async def _fetch_via_stream(self, native_payload: dict, model_name: str, messages: list) -> dict:
        logger.info("📡 Receiving native stream from Ollama...")
        
        # Prefill detection
        is_prefilled = False
        if messages and messages[-1].get("role") == "assistant" and "<think>" in messages[-1].get("content", ""):
            is_prefilled = True

        full_content = "<think>\n" if is_prefilled else ""
        usage = {}
        
        in_thinking = is_prefilled
        buffer = ""

        if is_prefilled:
            print("\n\033[90m[🤔 Thinking... (Prefilled)]\033[0m\n\033[90m", end="", flush=True)

        async with httpx.AsyncClient(timeout=900.0) as client:
            async with client.stream("POST", self.url, json=native_payload) as response:
                response.raise_for_status()
                
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                        
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # Native API puts tokens directly in chunk["message"]["content"]
                    content_piece = chunk.get("message", {}).get("content", "")
                    
                    if content_piece:
                        full_content += content_piece
                        buffer += content_piece

                        if "<think>" in buffer and not in_thinking:
                            print("\n\033[90m[🤔 Thinking...]\033[0m\n\033[90m", end="")
                            in_thinking = True
                            buffer = buffer.replace("<think>", "") 
                        
                        if "</think>" in buffer and in_thinking:
                            print("\033[0m\n\n\033[92m[💡 Final Output]\033[0m\n", end="")
                            in_thinking = False
                            buffer = buffer.replace("</think>", "")
                        
                        print(content_piece, end="", flush=True)

                    # Native API sends telemetry when done=True
                    if chunk.get("done") is True:
                        usage = {
                            "prompt_tokens": chunk.get("prompt_eval_count", 0),
                            "completion_tokens": chunk.get("eval_count", 0),
                            "total_tokens": chunk.get("prompt_eval_count", 0) + chunk.get("eval_count", 0)
                        }

        if in_thinking:
            print("\033[0m", end="")
            
        print("\n") 
        logger.info("✅ Stream complete.")

        # 2. TRANSLATE BACK TO OPENAI FORMAT
        return {
            "id": f"chatcmpl-{int(datetime.now().timestamp())}",
            "object": "chat.completion",
            "created": int(datetime.now().timestamp()),
            "model": model_name,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": full_content}, "finish_reason": "stop"}],
            "usage": usage
        }

# =====================================================================
# Presentation Layer
# =====================================================================

def print_input_context(messages: list):
    for msg in reversed(messages):
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, str):
                match = re.search(r"Title:\s*(.*?)\nAbstract:\s*(.*)", content, re.DOTALL | re.IGNORECASE)
                if match:
                    title = match.group(1).strip()
                    abstract = match.group(2).strip()
                    
                    print("\n\033[96m" + "="*80 + "\033[0m")
                    print("\033[96m[📄 INPUT CONTEXT]\033[0m")
                    print(f"\033[94mTitle:\033[0m {title}")
                    print(f"\033[94mAbstract:\033[0m {abstract}")
                    print("\033[96m" + "="*80 + "\033[0m\n")
                    return

# =====================================================================
# API Routing & App Initialization
# =====================================================================

cache_repo: CacheRepository
ollama_service: OllamaService

@asynccontextmanager
async def lifespan(app: FastAPI):
    global cache_repo, ollama_service
    cache_repo = CacheRepository(Config.DB_FILE)
    ollama_service = OllamaService(Config.OLLAMA_URL, Config.STREAM_OLLAMA)
    logger.info(f"🚀 Middleman started. (Streaming: {Config.STREAM_OLLAMA} | Translation Mode: Active)")
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

    cached_response = cache_repo.get(req_hash)
    if cached_response:
        total_tokens = cached_response.get("usage", {}).get("total_tokens", "N/A")
        logger.info(f"⚡ CACHE HIT  | Hash: {hash_short} | Tokens: {total_tokens} | Returning instant response.")
        print_input_context(messages)
        return cached_response

    logger.info(f"⏳ CACHE MISS | Hash: {hash_short} | Forwarding to Ollama Native API...")
    try:
        response_data = await ollama_service.fetch_completion(payload)
        
        cache_repo.set(req_hash, response_data)
        
        total_tokens = response_data.get("usage", {}).get("total_tokens", "N/A")
        logger.info(f"💾 CACHED     | Hash: {hash_short} | Tokens: {total_tokens} | Saved successfully.")
        
        print_input_context(messages)
        
        return response_data
        
    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP Error connecting to Ollama: {str(e)}")
        return JSONResponse(status_code=502, content={"error": f"Ollama connection error: {str(e)}"})
    except Exception as e:
        logger.error(f"❌ Internal Server Error: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ollama Caching Proxy")
    parser.add_argument("--stream", action="store_true", help="Enable internal streaming")
    args = parser.parse_args()
    Config.STREAM_OLLAMA = args.stream
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")