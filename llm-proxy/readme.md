# Ollama Caching Proxy (Middleman)

A lightweight, high-performance Node.js/Express middleware designed to sit between your client applications and local Ollama instance(s). Built with **Clean Code Architecture**, it caches LLM responses in a local SQLite database to drastically reduce response times, supports multi-endpoint load balancing for parallel batching, and provides an integrated modern React Web Interface for inspecting history and streaming tokens live via WebSockets.

## ✨ Features

* **Instant Responses (Cache Hit):** Caches successful responses using SQLite (`better-sqlite3`). If the exact same prompt is sent again, the proxy returns the cached answer instantly without waking up the LLM.
* **Multi-Endpoint Load Balancing:** Dynamically load-balance requests across multiple Ollama URLs in a round-robin fashion, supercharging parallel analysis.
* **Gemini API Integration:** Seamlessly supports Google Gemini API integration, bypassing standard Ollama handling and mapping requests properly.
* **Modern React Web Interface (Port 8899):** Provides a fast, responsive Single Page Application (SPA) built with React, Vite, and Tailwind CSS. Review historical request/response payloads, manage configurations, and monitor live streams.
* **Real-time Streaming via WebSockets:** The backend broadcasts streaming token chunks over WebSockets to the Web UI, natively supporting simultaneous incoming parallel token streams dynamically grouped into isolated interface cards.
* **Robust Parameter Support:** Cleanly maps standard properties while fully passing through nested `options` (like `think: true`) into Ollama's native API.
* **Comprehensive History Tracking:** Records every request in a dedicated `history` table, capturing model names, endpoints utilized, exact JSON payloads, reasoning tokens (thoughts tokens), and precise execution times.
* **Precision Hashing:** Uses SHA-256 with `json-stable-stringify` to create a deterministic fingerprint of the exact `messages` payload, ensuring accurate cache matching.
* **VRAM/RAM Management:** Automatically injects `"keep_alive": 0` into the payload on cache misses, forcing Ollama to unload the model from memory immediately after generating a response.
* **Clean Architecture:** Code is heavily modularized (Controllers, Services, Repositories) following FAIR principles.

## 📋 Prerequisites

* Node.js (v18+ recommended)
* npm
* [Ollama](https://ollama.com/) installed and running (or a valid Gemini API key).

## 🚀 Installation & Setup

1. **Clone or download** this repository and navigate to the `llm-proxy` directory:
   ```bash
   cd llm-proxy
   ```

2. **Install all dependencies:**
   The repository includes a unified `package.json` to handle both the backend and frontend.
   ```bash
   npm run install:all
   ```

3. **Environment Configuration:**
   Navigate to the `backend` directory, copy the `.env-default` file to `.env`, and customize it as needed:
   ```bash
   cp backend/.env-default backend/.env
   ```
   **Default Configuration Options:**
   - `PORT=8899` - Port for the proxy server.
   - `OLLAMA_URLS=http://127.0.0.1:11434/api/chat` - Comma-separated list of Ollama URLs.
   - `DB_FILE=slr_cache.db` - Local SQLite database filename.

4. **Build the Frontend:**
   The frontend is built using Vite and the output is placed directly into the `backend/public` directory to be served by Express.
   ```bash
   npm run build:frontend
   ```

## 💻 Usage

Once installed and built, you can run the application directly from the root `llm-proxy` directory.

**Start the Production Server:**
```bash
npm run start
```
*This starts the Express server which hosts both the API and the React frontend.*

**Start the Development Server:**
```bash
npm run dev
```
*This starts the Express backend with `nodemon` for auto-reloading during development.*

**Review Interface & API:**
Once running, the Middleman automatically serves the dashboard. Open your browser and navigate to:
```
http://localhost:8899
```

By default, the proxy API listens on `http://localhost:8899/v1/chat/completions` and forwards requests to your configured `OLLAMA_URLS`.

## 🏗️ Architecture Note
This project has been ported from a legacy Python/FastAPI implementation to a robust, scalable Node.js/React full-stack application. It maintains strict architectural separation between routers, controllers, services, and repositories, utilizing native tools like `fetch` and modern async operations throughout.
