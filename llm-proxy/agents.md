# Instructions for Porting `llm-proxy` to Node.js & React

This document outlines the super-specific, detailed steps required to port the `llm-proxy` (currently written in Python/FastAPI) to a modern Node.js and React stack.

The primary goal is to prevent hallucinations and oversized tasks by strictly following these incremental steps.

## Target Architecture & Tech Stack

*   **Backend:** Node.js, Express.js
*   **Database:** `better-sqlite3`
*   **Real-time Communication:** WebSockets (using `ws` library)
*   **Frontend:** React (SPA), Vite, Tailwind CSS
*   **Design Principles:** Clean Code Architecture, FAIR Principles.

Strict separation of concerns is required:
1.  **Routers:** Handle HTTP/WebSocket endpoints and pass data to controllers.
2.  **Controllers:** Handle input validation and HTTP response formatting.
3.  **Services:** Contain the core business logic (e.g., caching logic, Ollama API routing, Gemini logic).
4.  **Repositories:** Handle all database interactions via `better-sqlite3`.

---

## Directory Structure

The repository MUST be restructured as follows:

```
llm-proxy/
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── config/
│   │   │   └── index.js          # Port of config.py
│   │   ├── controllers/          # HTTP request handlers
│   │   ├── repositories/
│   │   │   └── CacheRepository.js # Port of repository.py using better-sqlite3
│   │   ├── routes/
│   │   │   ├── api.js            # Port of api.py
│   │   │   └── ws.js             # WebSocket routes for real-time streaming
│   │   ├── services/
│   │   │   └── OllamaService.js  # Port of service.py
│   │   ├── utils/
│   │   ├── app.js                # Express app setup and middleware
│   │   └── server.js             # Entry point, HTTP server & WebSocket attach
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── components/           # React components (Tailwind classes)
│   │   ├── hooks/                # Custom hooks (e.g., useWebSocket)
│   │   ├── pages/                # Page views
│   │   ├── services/             # API clients
│   │   ├── App.jsx
│   │   └── main.jsx
└── agents.md
```

---

## Step-by-Step Execution Plan

Do not attempt to execute all steps at once. Complete each step fully, verify it, and then proceed to the next.

### Phase 1: Backend Initialization and Configuration
1.  **Initialize Backend Project:** Create the `backend/` directory, run `npm init -y`, and install dependencies: `express`, `better-sqlite3`, `ws`, `cors`, `dotenv`, `node-fetch` (or use native `fetch`), and `nodemon` (for dev).
2.  **Setup Configuration:** Create `backend/src/config/index.js`. Port the logic from `config.py` to read environment variables and provide default settings (e.g., `PORT=8899`, database file paths).
3.  **Basic Express App:** Create `backend/src/app.js` and `backend/src/server.js`. Setup basic middleware (CORS, JSON parsing) and ensure the server can start and listen on port 8899.

### Phase 2: Database and Repository Layer
1.  **Initialize Database Connection:** In `backend/src/repositories/CacheRepository.js`, initialize `better-sqlite3`.
2.  **Define Schema:** Port the exact schema creation queries from `repository.py` (e.g., `history`, `endpoints_config`, `general_config` tables). Add a method to initialize these tables on startup.
3.  **Implement CRUD Methods:** Port all database methods from `repository.py` to `CacheRepository.js`. Ensure you use prepared statements provided by `better-sqlite3` for security and performance.
    *   `get_all_history`, `insert_history`
    *   `get_all_endpoint_configs`, `upsert_endpoint_config`, `delete_endpoint_config`
    *   `get_config_value`, `set_config_value`

### Phase 3: Core Services
1.  **Implement OllamaService:** Create `backend/src/services/OllamaService.js`. Port the logic from `service.py`.
    *   Implement the load balancing logic (round-robin across active endpoints).
    *   Implement caching checks (SHA-256 hashing of payloads).
    *   Handle both standard Ollama requests and Gemini API requests.
2.  **Streaming Support:** Adapt the generator/streaming logic from Python to use async generators or Node.js streams.

### Phase 4: Controllers and Routes
1.  **Proxy API Controller:** Create controllers to handle the `/v1/chat/completions` endpoint.
    *   It must interface with `OllamaService` and format the exact same OpenAI-compatible response as the Python version.
2.  **Web API Controllers:** Create controllers for the UI endpoints (e.g., fetching history, managing endpoint configurations, managing general config).
3.  **Define Routes:** Create `backend/src/routes/api.js` and wire up the Express routes to the controllers.

### Phase 5: WebSockets Implementation
1.  **WebSocket Server Setup:** In `backend/src/server.js` and `backend/src/routes/ws.js`, attach a `ws` WebSocket server to the Express HTTP server.
2.  **Streaming Broadcasts:** Modify `OllamaService` so that when a stream chunk is received from the LLM, it is broadcasted over the WebSocket connections (mirroring the Server-Sent Events behavior of the Python version, but using WebSockets).

### Phase 6: Frontend Initialization
1.  **Initialize Vite Project:** Create the `frontend/` directory using `npm create vite@latest . -- --template react`.
2.  **Install Tailwind CSS:** Follow the official Tailwind CSS Vite installation guide. Configure `tailwind.config.js` and add the directives to `index.css`.
3.  **Install Dependencies:** Install UI dependencies (e.g., `lucide-react` for icons, `axios` or use native `fetch` for API calls).

### Phase 7: Frontend Components and Pages
1.  **Layout Component:** Build a main layout component using Tailwind for the navbar and general app shell (matching the Bootstrap layout but modernized).
2.  **History Review Page:** Recreate the history table and request details modal. Fetch data from the Express backend via REST API.
3.  **Endpoints Configuration Manager:** Create a React component to manage the Smart Endpoint Manager. It must list, add, and toggle endpoints via API calls.
4.  **Real-time Streaming Page:** Implement a WebSocket client hook (`useWebSocket`). Create a UI that listens to WebSocket messages and dynamically renders streaming token chunks into isolated cards.

### Phase 8: Final Integration and Clean Up
1.  **Build Frontend:** Configure Vite to build the frontend into `backend/public/` or set up Express to serve static files from the Vite build output.
2.  **End-to-End Testing:** Ensure the entire stack can start with a single entry point or script.
3.  **Reflect and Refactor:** Review code against FAIR principles. Ensure no logic leaks between architectural layers.
