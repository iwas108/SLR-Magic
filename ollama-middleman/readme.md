# Ollama Caching Proxy

A lightweight, high-performance FastAPI middleware designed to sit between your client applications and a local Ollama instance. It caches LLM responses in a local SQLite database to drastically reduce response times and save compute resources on repeated queries.

## ✨ Features

* **Instant Responses (Cache Hit):** Caches successful responses using SQLite. If the exact same prompt is sent again, the proxy returns the cached answer instantly without waking up the LLM.
* **Precision Hashing:** Uses SHA-256 to create a unique fingerprint of the exact `messages` payload, ensuring accurate cache matching.
* **VRAM/RAM Management:** Automatically injects `"keep_alive": 0` into the payload on cache misses, forcing Ollama to unload the model from memory immediately after generating a response.
* **Asynchronous & Robust:** Built with modern FastAPI and `httpx`, featuring high timeouts (15 minutes) to gracefully handle long-running generative tasks.
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

Start the proxy server using `uvicorn`. Run this command in the same directory as your `middleman.py` script:

```bash
uvicorn middleman:app --host 0.0.0.0 --port 8000