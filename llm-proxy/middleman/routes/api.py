import re
import json
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse

import asyncio

from middleman.config import Config, logger
from middleman.service import stream_broadcaster, extract_json_from_mixed_text

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

    if not Config.UPDATE_CACHE:
        cached_response = cache_repo.get(req_hash)
        if cached_response:
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            model_name = cached_response.get("model", "unknown")

            endpoint_url = cached_response.pop("endpoint_url", "cache")
            logger.info(f"⚡ Cache Hit [{short_hash}] - Fulfilled instantly")

            # Intercept cached response to repair previously saved bad JSON
            expects_json = payload.get("response_format", {}).get("type") == "json_object" or any("json" in str(msg.get("content", "")).lower() for msg in messages)
            if expects_json:
                content = cached_response.get("choices", [{}])[0].get("message", {}).get("content", "")
                extracted = extract_json_from_mixed_text(content)
                if extracted and extracted != content:
                    try:
                        parsed = json.loads(extracted)
                        if isinstance(parsed, (dict, list)):
                            cached_response["choices"][0]["message"]["content"] = extracted
                            # Optionally update the cache to fix it permanently
                            cached_response_copy = cached_response.copy()
                            cached_response_copy["endpoint_url"] = endpoint_url
                            cache_repo.set(req_hash, cached_response_copy)
                            logger.info(f"🔧 Repaired previously malformed JSON from cache for [{short_hash}]")
                    except json.JSONDecodeError:
                        pass

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
            logger.info(f"⚡ Cache Hit [{short_hash}] - Fulfilled after waiting {duration_ms}ms")

            # Intercept cached response to repair previously saved bad JSON
            expects_json = payload.get("response_format", {}).get("type") == "json_object" or any("json" in str(msg.get("content", "")).lower() for msg in messages)
            if expects_json:
                content = cached_response.get("choices", [{}])[0].get("message", {}).get("content", "")
                extracted = extract_json_from_mixed_text(content)
                if extracted and extracted != content:
                    try:
                        parsed = json.loads(extracted)
                        if isinstance(parsed, (dict, list)):
                            cached_response["choices"][0]["message"]["content"] = extracted
                            cached_response_copy = cached_response.copy()
                            cached_response_copy["endpoint_url"] = endpoint_url
                            cache_repo.set(req_hash, cached_response_copy)
                            logger.info(f"🔧 Repaired previously malformed JSON from coalesced cache for [{short_hash}]")
                    except json.JSONDecodeError:
                        pass

            return cached_response
        else:
             logger.warning(f"⚠️ Coalescing [{short_hash}] - Woke up but cache was empty. This shouldn't happen.")

    event = asyncio.Event()
    in_flight_requests[req_hash] = event

    try:
        import httpx

        expects_json = False
        if payload.get("response_format", {}).get("type") == "json_object":
            expects_json = True
        else:
            for msg in messages:
                if "json" in str(msg.get("content", "")).lower():
                    expects_json = True
                    break

        max_retries = 3 if expects_json else 1
        response_data = None
        duration_ms = 0
        endpoint_url = "unknown"
        model_name = "unknown"

        for attempt in range(max_retries):
            response_data = await ollama_service.fetch_completion(payload, req_hash)

            model_name = response_data.get("model", "unknown")
            endpoint_url = response_data.pop("endpoint_url", "unknown")
            duration_ms = response_data.pop("endpoint_duration_ms", int((datetime.now() - start_time).total_seconds() * 1000))

            if expects_json:
                content = response_data.get("choices", [{}])[0].get("message", {}).get("content", "")

                extracted = extract_json_from_mixed_text(content)

                is_valid_json = False
                if extracted:
                    try:
                        parsed = json.loads(extracted)
                        if isinstance(parsed, (dict, list)):
                            is_valid_json = True
                    except json.JSONDecodeError:
                        pass

                if is_valid_json:
                    break
                else:
                    logger.warning(f"⚠️ Invalid JSON detected for [{short_hash}] on attempt {attempt + 1}/{max_retries}. Retrying...")
                    if attempt == max_retries - 1:
                        logger.error(f"❌ Failed to get valid JSON after {max_retries} attempts for [{short_hash}]. Returning error.")
                        return JSONResponse(status_code=502, content={"error": "LLM failed to produce valid JSON after retries."})
            else:
                break

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

@web_api_router.get("/api/queue_stats")
async def get_queue_stats():
    try:
        active_count = sum(1 for status in ollama_service.endpoint_status.values() if status == "active")
        total_count = len(ollama_service.urls)
        labels = cache_repo.get_endpoint_labels()

        endpoints_data = []
        for url in ollama_service.urls:
            status = ollama_service.endpoint_status.get(url, "idle")
            label = labels.get(url, url)
            endpoints_data.append({
                "url": url,
                "label": label,
                "status": status
            })

        return {
            "total_endpoints": total_count,
            "active_requests": active_count,
            "pending_requests": ollama_service.pending_requests,
            "endpoints": endpoints_data
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.get("/api/stats")
async def get_stats():
    try:
        return cache_repo.get_stats()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.post("/api/stats/properties")
async def set_endpoint_properties(request: Request):
    try:
        data = await request.json()
        endpoint_url = data.get("endpoint_url")
        label = data.get("label", "")
        is_gpu = data.get("is_gpu", False)
        gpu_model = data.get("gpu_model", "")
        cpu_model = data.get("cpu_model", "")
        ram_size = data.get("ram_size", "")

        if not endpoint_url:
            return JSONResponse(status_code=400, content={"error": "endpoint_url is required"})
        cache_repo.set_endpoint_properties(endpoint_url, label, is_gpu, gpu_model, cpu_model, ram_size)
        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.get("/api/endpoints")
async def get_endpoints():
    try:
        return cache_repo.get_endpoints()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.get("/api/endpoints/config")
async def get_endpoints_config():
    try:
        configs = cache_repo.get_all_endpoint_configs()
        return configs
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.post("/api/endpoints/config")
async def upsert_endpoint_config(request: Request):
    try:
        data = await request.json()
        endpoint_url = data.get("endpoint_url")
        if not endpoint_url:
            return JSONResponse(status_code=400, content={"error": "endpoint_url is required"})

        enabled = data.get("enabled", True)
        custom_model = data.get("custom_model", "")
        api_key = data.get("api_key", "")
        extra_config = data.get("extra_config", "")

        cache_repo.upsert_endpoint_config(endpoint_url, enabled, custom_model, api_key, extra_config)

        # Sync with service
        configs = cache_repo.get_all_endpoint_configs()
        ollama_service.sync_endpoints(configs)

        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.delete("/api/endpoints/config")
async def delete_endpoint_config(request: Request):
    try:
        data = await request.json()
        endpoint_url = data.get("endpoint_url")
        if not endpoint_url:
            return JSONResponse(status_code=400, content={"error": "endpoint_url is required"})

        cache_repo.delete_endpoint_config(endpoint_url)

        # Sync with service
        configs = cache_repo.get_all_endpoint_configs()
        ollama_service.sync_endpoints(configs)

        return {"status": "success"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.get("/api/history")
async def get_history(search: str = None, endpoint: str = None, page: int = 1, limit: int = 50, sort_by: str = "id", sort_desc: str = "true"):
    try:
        is_desc = sort_desc.lower() == "true"
        return cache_repo.get_history(search=search, endpoint=endpoint, page=page, limit=limit, sort_by=sort_by, sort_desc=is_desc)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@web_api_router.delete("/api/history/bulk_delete")
async def bulk_delete_history(request: Request):
    try:
        data = await request.json()
        item_ids = data.get("ids", [])
        if not item_ids:
            return JSONResponse(status_code=400, content={"error": "No IDs provided"})
        cache_repo.delete_history_items(item_ids)
        return {"status": "success", "message": f"Deleted {len(item_ids)} items"}
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

@web_api_router.get("/api/streams/active")
async def get_active_streams():
    try:
        return stream_broadcaster.active_streams
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

@web_api_router.get("/api/config/{key}")
async def get_config(key: str):
    val = cache_repo.get_config(key)
    return {"value": val if val is not None else ""}

@web_api_router.post("/api/config/{key}")
async def set_config(key: str, request: Request):
    data = await request.json()
    value = data.get("value", "")
    cache_repo.set_config(key, value)
    return {"status": "ok"}
