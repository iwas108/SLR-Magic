# Ollama Caching Proxy (Middleman)

A lightweight, high-performance FastAPI middleware designed to sit between your client applications and local Ollama instance(s). Built with **Clean Code Architecture**, it caches LLM responses in a local SQLite database to drastically reduce response times, supports multi-endpoint load balancing for parallel batching, and provides an integrated Web Review Interface for inspecting history and streaming tokens live.

## ✨ Features

* **Instant Responses (Cache Hit):** Caches successful responses using SQLite. If the exact same prompt is sent again, the proxy returns the cached answer instantly without waking up the LLM.
* **Multi-Endpoint Load Balancing:** Start the middleman with a comma-separated list of Ollama URLs to dynamically load-balance requests across multiple nodes in a round-robin fashion, supercharging parallel analysis.
* **Web Review Interface (Port 8899):** Provides a mobile-first, responsive Bootstrap 5 dashboard to review historical request/response payloads. View endpoint routing details, dynamically filter live streams by serving node, toggle Light/Dark themes, and manage cached history.
* **Concurrent Live Streaming:** The Web UI natively supports simultaneous incoming parallel token streams, dynamically grouping them into isolated interface cards via UUID tracking to prevent corrupted race conditions.
* **Robust Parameter Support:** The Native Translator cleanly maps standard OpenAI properties (`temperature`, `max_tokens`) while fully passing through nested `options` (like `think: true`) into Ollama's native API.
* **Comprehensive History Tracking:** Records every request in a dedicated `history` table within SQLite, capturing model names, endpoints utilized, exact JSON payloads, and precise execution times.
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

**Customizing Upstream Servers & Load Balancing:**
If your Ollama instance is not running on localhost, or you want to route traffic across multiple Ollama nodes, you can explicitly define a comma-separated list using the `--server` argument:
```bash
python middleman.py --server http://192.168.1.100:11434,http://192.168.1.101:11434
```

**Streaming Mode:**
Append the `--stream` flag to enable internal event broadcasting to the Web UI dashboard for live token tracking during generation:

```bash
python middleman.py --stream
```

**Review Interface:**
Once running, the Middleman automatically spins up a dashboard on a secondary port. Open your browser and navigate to:
```
http://localhost:8899
```

By default, the proxy API listens on `http://0.0.0.0:8000/v1/chat/completions` and forwards requests to `http://127.0.0.1:11434/v1/chat/completions`.