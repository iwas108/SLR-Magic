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

import asyncio
import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse, StreamingResponse

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
    OLLAMA_URL = "http://127.0.0.1:11434/v1/chat/completions"
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
            conn.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    model_name TEXT,
                    request_json TEXT,
                    response_json TEXT,
                    duration_ms INTEGER,
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

    def log_history(self, model_name: str, request_data: dict, response_data: dict, duration_ms: int):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute(
                "INSERT INTO history (model_name, request_json, response_json, duration_ms) VALUES (?, ?, ?, ?)",
                (model_name, json.dumps(request_data), json.dumps(response_data), duration_ms)
            )

# =====================================================================
# Service Layer (The OpenAI -> Native Translator)
# =====================================================================

class StreamBroadcaster:
    def __init__(self):
        self.listeners = []

    async def broadcast(self, message: str):
        for queue in self.listeners:
            await queue.put(message)

    def add_listener(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self.listeners.append(q)
        return q

    def remove_listener(self, q: asyncio.Queue):
        if q in self.listeners:
            self.listeners.remove(q)

stream_broadcaster = StreamBroadcaster()

class OllamaService:
    def __init__(self, url: str, stream_mode: bool):
        # Dynamically intercept and route to the NATIVE Ollama endpoint
        self.url = url.replace("/v1/chat/completions", "/api/chat")
        self.stream_mode = stream_mode

    async def fetch_completion(self, openai_payload: dict) -> dict:
        model_name = openai_payload.get("model", "qwen3.5-slr")
        messages = openai_payload.get("messages", [])
        
        # Extract default/basic options
        temperature = openai_payload.get("temperature", 0.6)
        max_tokens = openai_payload.get("max_tokens", 8192)

        # Allow fully customizable options from the frontend payload "options" dict
        custom_options = openai_payload.get("options", {})

        # 1. TRANSLATE TO NATIVE PAYLOAD
        # This safely applies our VRAM limits without crashing the server!
        native_options = {
            "temperature": temperature,
            "num_predict": max_tokens,
            "num_ctx": 16384  # Safely restricts context to 16K tokens for AMD GPU
        }

        # Merge custom options provided by the caller (overriding defaults if specified)
        native_options.update(custom_options)

        native_payload = {
            "model": model_name,
            "messages": messages,
            "keep_alive": 0, 
            "options": native_options
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

                        # Broadcast chunk to web UI
                        await stream_broadcaster.broadcast(json.dumps({
                            "content": content_piece,
                            "in_thinking": in_thinking
                        }))

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
# Main App Routing (Port 8000)
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
# Web Review App Routing (Port 8899)
# =====================================================================

web_app = FastAPI()

@web_app.get("/")
async def review_ui():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Middleman Review</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { display: flex; gap: 20px; max-width: 1400px; margin: 0 auto; }
            .sidebar { flex: 1; max-width: 300px; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); height: calc(100vh - 40px); overflow-y: auto; }
            .main { flex: 3; display: flex; flex-direction: column; gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h2, h3 { margin-top: 0; }
            .history-item { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s; }
            .history-item:hover { background: #f0f0f0; }
            .history-item.active { background: #e3f2fd; border-left: 4px solid #2196f3; }
            .model-badge { display: inline-block; padding: 3px 8px; background: #e0e0e0; border-radius: 12px; font-size: 0.8em; margin-bottom: 5px; }
            .time-text { font-size: 0.8em; color: #666; }
            pre { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }
            #live-stream-box { background: #2b2b2b; color: #fff; padding: 15px; border-radius: 5px; min-height: 100px; max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; }
            .thinking { color: #888; font-style: italic; }
            .final-output { color: #a6e22e; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="sidebar">
                <h2>History</h2>
                <button onclick="loadHistory()" style="width:100%; padding:8px; margin-bottom:15px; cursor:pointer;">Refresh</button>
                <div id="history-list"></div>
            </div>
            <div class="main">
                <div class="card">
                    <h2>Live Stream</h2>
                    <div id="live-stream-box">Waiting for stream...</div>
                </div>
                <div class="card" id="details-card" style="display:none;">
                    <h2>Request Details</h2>
                    <div><strong>Model:</strong> <span id="detail-model"></span></div>
                    <div><strong>Duration:</strong> <span id="detail-duration"></span> ms</div>
                    <div><strong>Time:</strong> <span id="detail-time"></span></div>
                    <h3>Request Messages</h3>
                    <pre id="detail-request"></pre>
                    <h3>Response Content</h3>
                    <pre id="detail-response"></pre>
                </div>
            </div>
        </div>
        <script>
            let historyData = [];

            async function loadHistory() {
                try {
                    const res = await fetch('/api/history');
                    historyData = await res.json();
                    renderHistory();
                } catch (e) {
                    console.error('Failed to load history', e);
                }
            }

            function renderHistory() {
                const list = document.getElementById('history-list');
                list.innerHTML = '';
                historyData.forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.onclick = () => showDetails(index);

                    const time = new Date(item.created_at).toLocaleTimeString();
                    div.innerHTML = `
                        <div class="model-badge">${item.model_name}</div>
                        <div>Req #${item.id}</div>
                        <div class="time-text">${time} • ${item.duration_ms}ms</div>
                    `;
                    list.appendChild(div);
                });
            }

            function showDetails(index) {
                const item = historyData[index];
                document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.history-item')[index].classList.add('active');

                document.getElementById('details-card').style.display = 'block';
                document.getElementById('detail-model').textContent = item.model_name;
                document.getElementById('detail-duration').textContent = item.duration_ms;
                document.getElementById('detail-time').textContent = new Date(item.created_at).toLocaleString();

                try {
                    const req = JSON.parse(item.request_json);
                    document.getElementById('detail-request').textContent = JSON.stringify(req.messages || req, null, 2);
                } catch (e) {
                    document.getElementById('detail-request').textContent = item.request_json;
                }

                try {
                    const res = JSON.parse(item.response_json);
                    const content = res.choices?.[0]?.message?.content || JSON.stringify(res, null, 2);
                    document.getElementById('detail-response').textContent = content;
                } catch (e) {
                    document.getElementById('detail-response').textContent = item.response_json;
                }
            }

            function setupStream() {
                const box = document.getElementById('live-stream-box');
                const evtSource = new EventSource('/api/stream');

                evtSource.onmessage = function(event) {
                    if (box.textContent === 'Waiting for stream...') {
                        box.textContent = '';
                    }
                    const data = JSON.parse(event.data);
                    const span = document.createElement('span');
                    span.textContent = data.content;
                    span.className = data.in_thinking ? 'thinking' : 'final-output';
                    box.appendChild(span);
                    box.scrollTop = box.scrollHeight;
                };
            }

            window.onload = () => {
                loadHistory();
                setupStream();
            };
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@web_app.get("/api/history")
async def get_history():
    import sqlite3
    with sqlite3.connect(Config.DB_FILE) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM history ORDER BY id DESC LIMIT 50")
        rows = c.fetchall()
        return [dict(row) for row in rows]

@web_app.get("/api/stream")
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


async def serve():
    config_main = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="warning")
    server_main = uvicorn.Server(config_main)

    config_web = uvicorn.Config(web_app, host="0.0.0.0", port=8899, log_level="warning")
    server_web = uvicorn.Server(config_web)

    await asyncio.gather(
        server_main.serve(),
        server_web.serve()
    )

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Ollama Caching Proxy")
    parser.add_argument("--stream", action="store_true", help="Enable internal streaming")
    parser.add_argument("--server", type=str, default="http://127.0.0.1:11434", help="Ollama Server URL (e.g., http://127.0.0.1:11434)")
    args = parser.parse_args()

    # Construct OLLAMA_URL from the server parameter
    server_url = args.server.rstrip('/')
    Config.OLLAMA_URL = f"{server_url}/v1/chat/completions"
    Config.STREAM_OLLAMA = args.stream

    asyncio.run(serve())