# Ollama Caching Proxy (Middleman)

A lightweight, high-performance FastAPI middleware designed to sit between your client applications and a local Ollama instance. Built with **Clean Code Architecture**, it caches LLM responses in a local SQLite database to drastically reduce response times, saves compute resources on repeated queries, and supports real-time terminal streaming. It features an integrated Web Review Interface for inspecting history and streaming tokens live.

## ✨ Features

* **Instant Responses (Cache Hit):** Caches successful responses using SQLite. If the exact same prompt is sent again, the proxy returns the cached answer instantly without waking up the LLM.
* **Real-Time Terminal Streaming:** Use the `--stream` flag to watch the model generate its response live in your terminal while it aggregates the final JSON for the client.
* **Web Review Interface (Port 8899):** Provides a mobile-first, responsive Bootstrap 5 dashboard to review historical request/response payloads. Features include Light/Dark theme toggling, accordion-style payload organization (separating 'Thinking' trace from 'Final Answer'), and the ability to selectively delete or clear history records.
* **Robust Parameter Support:** The Native Translator cleanly maps standard OpenAI properties (`temperature`, `max_tokens`) while fully passing through nested `options` (like `think: true`) into Ollama's native API.
* **Comprehensive History Tracking:** Records every request in a dedicated `history` table within SQLite, capturing model names, exact JSON payloads, and precise execution times.
* **Precision Hashing:** Uses SHA-256 to create a unique fingerprint of the exact `messages` payload, ensuring accurate cache matching.
* **VRAM/RAM Management:** Automatically injects `"keep_alive": 0` into the payload on cache misses, forcing Ollama to unload the model from memory immediately after generating a response.
* **Enhanced Visual Logging:** Clean, timestamped terminal logs let you track cache hits, misses, model execution times, and connection statuses at a glance.
* **Clean Architecture:** Code is heavily modularized across multiple files (Repository, Service, Routers) following FAIR principles.
* **Zero Configuration:** Uses a local `slr_cache.db` file—no external database servers required.

## 📋 Prerequisites

* Python 3.8+
* [Ollama](https://ollama.com/) installed and running.

## 🚀 Installation

1. **Clone or download** this repository.
2. **Install the required Python dependencies** using the provided `requirements.txt` file (now includes FastAPI, Uvicorn, HTTPX, and Jinja2 for frontend templates):

    ```bash
    pip install -r requirements.txt
    ```

## 💻 Usage

The proxy is designed to run directly via Python, which automatically handles the Uvicorn server and command-line arguments.

**Standard Mode (Background Proxy):**
Run this command in the same directory as your `middleman.py` script:
```bash
python middleman.py
```

**Customizing Upstream Server:**
If your Ollama instance is not running on localhost or uses a different port, you can explicitly define it using the `--server` argument:
```bash
python middleman.py --server http://192.168.1.100:11434
```

**Streaming Mode (Live Terminal Output):**
If you want to watch the LLM's response stream live in your terminal as it's being generated (useful for debugging or long generations), append the `--stream` flag:

```bash
python middleman.py --stream
```

**Review Interface:**
Once running, the Middleman automatically spins up a dashboard on a secondary port. Open your browser and navigate to:
```
http://localhost:8899
```

By default, the proxy API listens on `http://0.0.0.0:8000/v1/chat/completions` and forwards requests to `http://127.0.0.1:11434/v1/chat/completions`.