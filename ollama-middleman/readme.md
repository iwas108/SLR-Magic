# Ollama Caching Proxy (Middleman)

A lightweight, high-performance FastAPI middleware designed to sit between your client applications and a local Ollama instance. Built with **Clean Code Architecture**, it caches LLM responses in a local SQLite database to drastically reduce response times, saves compute resources on repeated queries, and supports real-time terminal streaming.

## ✨ Features

* **Instant Responses (Cache Hit):** Caches successful responses using SQLite. If the exact same prompt is sent again, the proxy returns the cached answer instantly without waking up the LLM.
* **Real-Time Terminal Streaming:** Use the `--stream` flag to watch the model generate its response live in your terminal while it aggregates the final JSON for the client.
* **Precision Hashing:** Uses SHA-256 to create a unique fingerprint of the exact `messages` payload, ensuring accurate cache matching.
* **VRAM/RAM Management:** Automatically injects `"keep_alive": 0` into the payload on cache misses, forcing Ollama to unload the model from memory immediately after generating a response.
* **Enhanced Visual Logging:** Clean, timestamped terminal logs let you track cache hits, misses, and connection statuses at a glance.
* **Clean Architecture:** Code is modularized into Repository, Service, and Routing layers, making it highly extensible and aligned with FAIR principles.
* **Zero Configuration:** Uses a local `slr_cache.db` file—no external database servers required.

## 📋 Prerequisites

* Python 3.8+
* [Ollama](https://ollama.com/) installed and running locally on the default port (`11434`).

## 🚀 Installation

1. **Clone or download** this repository.
2. **Install the required Python dependencies** using the provided `requirements.txt` file:

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

Streaming Mode (Live Terminal Output):
If you want to watch the LLM's response stream live in your terminal as it's being generated (useful for debugging or long generations), append the --stream flag:

```
Bash
python middleman.py --stream
```

By default, the proxy listens on http://0.0.0.0:8000/v1/chat/completions and forwards requests to http://localhost:11434/v1/chat/completions.