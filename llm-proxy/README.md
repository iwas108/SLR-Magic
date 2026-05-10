# SLR Magic: LLM Proxy Backend ✨

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Backend: Node.js](https://img.shields.io/badge/Backend-Node.js-339933.svg)
![Database: SQLite](https://img.shields.io/badge/Database-SQLite-003B57.svg)

## Overview

The `llm-proxy` module serves as the critical "Middleman" between the Google Apps Script frontend and your chosen Large Language Models. It is a lightweight, high-performance Node.js/Express middleware designed to sit locally on your machine or on a cloud server.

**Primary Functions:**
- **Caching:** Instantly returns cached responses for identical prompts, saving compute time and API costs.
- **Load Balancing:** Multiplexes concurrent requests across multiple Ollama/vLLM endpoints.
- **Provider Routing:** Abstracts away the differences between calling local models versus calling cloud APIs (like Google Gemini).

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration / Environment Variables](#configuration--environment-variables)
- [Running the Service](#running-the-service)
- [Frontend UI](#frontend-ui)

## Prerequisites

- **Node.js:** v18+ recommended. Install from [nodejs.org](https://nodejs.org/).
- **LLM Instance:** Ensure you have either an active [Ollama](https://ollama.com/) instance running locally, or a valid Google Gemini API key.

## Installation

1. Navigate to the `llm-proxy` backend directory:
   ```bash
   cd llm-proxy/backend
   ```

2. Install backend dependencies:
   ```bash
   npm install
   ```

*(Note: If you wish to build both the backend and frontend simultaneously, you can run `npm run install:all` from the `llm-proxy` root directory).*

## Configuration / Environment Variables

1. While in the `llm-proxy/backend` directory, copy the default environment template:
   ```bash
   cp .env-default .env
   ```
2. Edit the `.env` file to set your configurations.
   - `PORT=8899` - Port for the proxy server.
   - `OLLAMA_URLS=http://127.0.0.1:11434/api/chat` - Comma-separated list of Ollama URLs.
   - `DB_FILE=slr_cache.db` - Local SQLite database filename.

## Running the Service

Start the production server:
```bash
npm run start
```
*This starts the Express server which hosts both the API and the pre-built React frontend.*

For development (with `nodemon` auto-reloading):
```bash
npm run dev
```

By default, the proxy API listens on `http://localhost:8899/v1/chat/completions` and intercepts requests from the Apps Script hub.

## Frontend UI

This proxy includes a modern React web interface for real-time monitoring and configuration!

**For instructions on how to set up, build, and develop the dashboard, please see the [LLM Proxy Frontend README](./frontend/README.md).**
