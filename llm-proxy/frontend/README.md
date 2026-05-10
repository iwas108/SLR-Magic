# SLR Magic: LLM Proxy Dashboard ✨

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Frontend: React](https://img.shields.io/badge/Frontend-React-61DAFB.svg)
![Build: Vite](https://img.shields.io/badge/Build-Vite-646CFF.svg)

## Overview

This subdirectory contains the frontend web interface for the `llm-proxy`. Built with React, Vite, and Tailwind CSS, it acts as a modern, real-time dashboard for your proxy server.

**Key Features:**
- **Real-time Streaming:** Monitors live incoming tokens natively via WebSockets, allowing you to watch the LLM's thought processes in real-time.
- **Request History:** Review historical request/response payloads, execution durations, and model usage.
- **Configuration Management:** Manage your local (Ollama/vLLM) and cloud (Gemini) endpoint configurations directly through the UI.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Service](#running-the-service)

## Prerequisites

- **Node.js & npm:** Install from [nodejs.org](https://nodejs.org/).
- **Running Backend:** The frontend requires the [LLM Proxy Backend](../README.md) to be running to fetch data and receive WebSocket streams.

## Installation

1. Navigate to the `llm-proxy/frontend` directory:
   ```bash
   cd llm-proxy/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Service

**Development Mode:**
To run the frontend locally with Hot Module Replacement (HMR) for development:
```bash
npm run dev
```
*(Ensure the backend is running on `localhost:8899` as the frontend defaults to proxying API requests to that port).*

**Production Build:**
To build the application for production deployment:
```bash
npm run build
```
The compiled files will be output directly to the `backend/public` directory, allowing the Express backend server to serve the static SPA automatically when you run `npm run start` from the backend folder.
