import re
import json
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse

import asyncio

from middleman.config import Config, logger
from middleman.service import stream_broadcaster

api_router = APIRouter()
web_api_router = APIRouter()

# Global dependency injection references (to be set in main.py)
cache_repo = None
ollama_service = None

in_flight_requests = {}

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
    short_hash = req_hash[:8]

    logger.info(f"📥 Received request [{short_hash}] for model: {payload.get('model', 'unknown')}")

    start_time = datetime.now()

    cached_response = cache_repo.get(req_hash)
    if cached_response:
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        model_name = cached_response.get("model", "unknown")

        endpoint_url = cached_response.pop("endpoint_url", "cache")
        cache_repo.log_history(model_name, payload, cached_response, duration_ms, endpoint_url)
        logger.info(f"⚡ Cache Hit [{short_hash}] - Fulfilled instantly")
        return cached_response

    if req_hash in in_flight_requests:
        logger.info(f"⏳ Coalescing [{short_hash}] - Waiting for an identical in-flight request...")
        event = in_flight_requests[req_hash]
        await event.wait()

        cached_response = cache_repo.get(req_hash)
        if cached_response:
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            model_name = cached_response.get("model", "unknown")

            endpoint_url = cached_response.pop("endpoint_url", "cache")
            cache_repo.log_history(model_name, payload, cached_response, duration_ms, endpoint_url)
            logger.info(f"⚡ Cache Hit [{short_hash}] - Fulfilled after waiting {duration_ms}ms")
            return cached_response
        else:
             logger.warning(f"⚠️ Coalescing [{short_hash}] - Woke up but cache was empty. This shouldn't happen.")

    event = asyncio.Event()
    in_flight_requests[req_hash] = event

    try:
        import httpx
        response_data = await ollama_service.fetch_completion(payload, req_hash)

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        model_name = response_data.get("model", "unknown")

        endpoint_url = response_data.pop("endpoint_url", "unknown")

        cache_repo.set(req_hash, response_data)
        cache_repo.log_history(model_name, payload, response_data, duration_ms, endpoint_url)

        logger.info(f"✅ Completed [{short_hash}] - Duration: {duration_ms}ms, Endpoint: {endpoint_url}")
        return response_data

    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP Error [{short_hash}] connecting to Ollama: {str(e)}")
        return JSONResponse(status_code=502, content={"error": f"Ollama connection error: {str(e)}"})
    except Exception as e:
        logger.error(f"❌ Internal Server Error [{short_hash}]: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        event.set()
        in_flight_requests.pop(req_hash, None)

# =====================================================================
# Web Review API Endpoints (Port 8899)
# =====================================================================

@web_api_router.get("/api/history")
async def get_history(search: str = None, page: int = 1, limit: int = 50):
    try:
        return cache_repo.get_history(search=search, page=page, limit=limit)
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

@web_api_router.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    q = stream_broadcaster.add_listener()
    try:
        while True:
            message = await q.get()
            await websocket.send_text(message)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        stream_broadcaster.remove_listener(q)
