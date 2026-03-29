import sqlite3
import hashlib
import json
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# Configuration
OLLAMA_URL = "http://localhost:11434/v1/chat/completions"
DB_FILE = "slr_cache.db"

def init_db():
    """Creates the database table if it doesn't already exist."""
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS cache (
                payload_hash TEXT PRIMARY KEY,
                response_json TEXT
            )
        ''')
        conn.commit()

def get_payload_hash(messages: list) -> str:
    """Generates a unique SHA-256 fingerprint from the prompt payload for precision caching."""
    # Convert the list of dicts to a neatly sorted JSON string to ensure consistent hashing
    message_str = json.dumps(messages, sort_keys=True)
    return hashlib.sha256(message_str.encode('utf-8')).hexdigest()

# Modern FastAPI startup/shutdown handling
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run on startup
    init_db()
    yield
    # Run on shutdown (if any cleanup is needed later)

app = FastAPI(lifespan=lifespan)

@app.post("/v1/chat/completions")
async def proxy_to_ollama(request: Request):
    # 1. Retrieve the payload from the client (e.g., Apps Script)
    try:
        body = await request.body()
        payload = json.loads(body)
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON payload"})
    
    # Extract the "messages" array which contains the core prompt
    messages = payload.get("messages", [])
    if not messages:
         return JSONResponse(status_code=400, content={"error": "No messages found in payload"})

    # 2. Generate a hash from the messages
    req_hash = get_payload_hash(messages)

    # 3. Check if the answer already exists in SQLite (Cache Hit)
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("SELECT response_json FROM cache WHERE payload_hash = ?", (req_hash,))
        row = c.fetchone()
    
    if row:
        print(f"✅ CACHE HIT! Returning instant response for hash: {req_hash[:8]}...")
        return json.loads(row[0])

    print(f"⏳ CACHE MISS. Forwarding to Ollama for hash: {req_hash[:8]}...")

    # 4. If not in cache, forward the request to Ollama
    # Timeout is set very high (15 minutes) to allow Ollama time to generate long responses
    async with httpx.AsyncClient(timeout=900.0) as client:
        try:
            # Inject keep_alive=0 to unload the model immediately after responding
            # This prevents RAM/VRAM memory leaks as previously intended
            payload["keep_alive"] = 0 
            
            response = await client.post(OLLAMA_URL, json=payload)
            response.raise_for_status()
            response_data = response.json()
            
            # 5. Save the successful result to SQLite
            with sqlite3.connect(DB_FILE) as conn:
                c = conn.cursor()
                c.execute("INSERT OR REPLACE INTO cache (payload_hash, response_json) VALUES (?, ?)", 
                          (req_hash, json.dumps(response_data)))
                conn.commit()
                
            print(f"💾 Saved to database: {req_hash[:8]}...")
            return response_data
            
        except httpx.HTTPError as e:
            print(f"❌ Error contacting Ollama: {str(e)}")
            return JSONResponse(status_code=502, content={"error": f"Ollama connection error: {str(e)}"})
        except Exception as e:
            print(f"❌ Internal Server Error: {str(e)}")
            return JSONResponse(status_code=500, content={"error": str(e)})

# How to run: 
# uvicorn middleman:app --host 0.0.0.0 --port 8000