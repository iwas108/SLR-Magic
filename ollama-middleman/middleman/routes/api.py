import re
import json
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from middleman.config import Config, logger
from middleman.service import stream_broadcaster

api_router = APIRouter()
web_api_router = APIRouter()

# Global dependency injection references (to be set in main.py)
cache_repo = None
ollama_service = None

# =====================================================================
# Presentation Layer Helper
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
# Proxy API Endpoints (Port 8000)
# =====================================================================

@api_router.post("/v1/chat/completions")
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

    start_time = datetime.now()

    cached_response = cache_repo.get(req_hash)
    if cached_response:
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        total_tokens = cached_response.get("usage", {}).get("total_tokens", "N/A")
        model_name = cached_response.get("model", "unknown")
        logger.info(f"⚡ CACHE HIT  | Hash: {hash_short} | Model: {model_name} | Tokens: {total_tokens} | Time: {duration_ms}ms | Returning instant response.")

        cache_repo.log_history(model_name, payload, cached_response, duration_ms)
        print_input_context(messages)
        return cached_response

    logger.info(f"⏳ CACHE MISS | Hash: {hash_short} | Forwarding to Ollama Native API...")
    try:
        import httpx
        response_data = await ollama_service.fetch_completion(payload)

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        total_tokens = response_data.get("usage", {}).get("total_tokens", "N/A")
        model_name = response_data.get("model", "unknown")

        cache_repo.set(req_hash, response_data)
        cache_repo.log_history(model_name, payload, response_data, duration_ms)

        logger.info(f"💾 CACHED     | Hash: {hash_short} | Model: {model_name} | Tokens: {total_tokens} | Time: {duration_ms}ms | Saved successfully.")

        print_input_context(messages)

        return response_data

    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP Error connecting to Ollama: {str(e)}")
        return JSONResponse(status_code=502, content={"error": f"Ollama connection error: {str(e)}"})
    except Exception as e:
        logger.error(f"❌ Internal Server Error: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

# =====================================================================
# Web Review API Endpoints (Port 8899)
# =====================================================================

@web_api_router.get("/api/history")
async def get_history(search: str = None):
    try:
        return cache_repo.get_history(search=search)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.delete("/api/history/{item_id}")
async def delete_history_item(item_id: int):
    try:
        cache_repo.delete_history_item(item_id)
        return {"status": "success", "message": f"Deleted item {item_id}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.delete("/api/history")
async def clear_history():
    try:
        cache_repo.clear_history()
        return {"status": "success", "message": "All history cleared"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.get("/api/stream")
async def sse_stream(request: Request):
    async def event_generator():
        q = stream_broadcaster.add_listener()
        try:
            while True:
                if await request.is_disconnected():
                    break
                message = await q.get()
                yield f"data: {message}\n\n"
        finally:
            stream_broadcaster.remove_listener(q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
