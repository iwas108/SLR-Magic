# SLR Magic ✨

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Architecture: Microservices](https://img.shields.io/badge/Architecture-Microservices-blue.svg)
![Domain: Academic Research](https://img.shields.io/badge/Domain-Academic%20Research-success.svg)

## Overview

**SLR Magic** is a comprehensive, AI-powered ecosystem designed to accelerate, safeguard, and standardize the Systematic Literature Review (SLR) process. By orchestrating Large Language Models (LLMs) and distributed microservices, it automates tedious phases of academic research—such as abstract screening, full-text reading, and data extraction—while strictly enforcing human-in-the-loop validation to eliminate bias and guarantee scientific rigor.

This repository contains the full suite of tools needed to run an end-to-end SLR pipeline, combining the accessibility of Google Apps Script with the power of modern Node.js and Python backends.

## Table of Contents

- [Overview](#overview)
- [Microservice Architecture](#microservice-architecture)
- [Quick Start Guide](#quick-start-guide)
- [Documentation Map](#documentation-map)
- [Contributing](#contributing)
- [License](#license)

## Microservice Architecture

The SLR Magic ecosystem is composed of several specialized, decoupled modules that interact seamlessly:

1. **[App Script Workspace (`app-script/`)](./app-script/README.md)**
   - **Role:** The central orchestration hub and primary user interface.
   - **Tech:** Google Apps Script, Google Sheets.
   - **Function:** Manages the entire pipeline from configuration to final data collection. It delegates heavy AI processing to the backend proxy and handles prompt generation and logic gating.

2. **[LLM Proxy Backend (`llm-proxy/`)](./llm-proxy/README.md)**
   - **Role:** The high-performance caching and routing middleman.
   - **Tech:** Node.js, Express, SQLite.
   - **Function:** Sits between the App Script frontend and your local LLMs (Ollama/vLLM) or cloud providers (Gemini). It caches responses to save time/compute, load balances parallel requests, and records detailed execution history.

3. **[LLM Proxy Frontend (`llm-proxy/frontend/`)](./llm-proxy/frontend/README.md)**
   - **Role:** Real-time monitoring dashboard for the LLM Proxy.
   - **Tech:** React, Vite, Tailwind CSS.
   - **Function:** Provides a UI to view historical LLM requests, monitor live token streaming via WebSockets, and manage endpoint configurations.

4. **[Inter-Rater SPA (`inter-rater/`)](./inter-rater/README.md)**
   - **Role:** The human-in-the-loop validation tool.
   - **Tech:** React, Vite, Tailwind CSS.
   - **Function:** An offline-capable Single-Page Application that allows researchers to perform blinded reviews (without seeing AI decisions) to ensure data integrity and unbiased validation.

5. **[PDF Helper (`pdfhelper/`)](./pdfhelper/README.md)**
   - **Role:** The document retrieval and processing pipeline.
   - **Tech:** Python, FastAPI, Selenium.
   - **Function:** Automates the downloading of research papers via institutional proxies, verifies their contents, compresses them for storage, and syncs them to Google Drive for the LLMs to read.

## Quick Start Guide

To get the entire SLR Magic ecosystem running, follow this general sequence:

1. **Deploy the Hub:**
   Start by configuring the Google Apps Script project. This acts as your main database and control center.
   *See [App Script Setup](./app-script/README.md#installation)*.

2. **Spin up the Backend Services (Optional but Recommended):**
   If you plan to use local LLMs (Ollama/vLLM) for privacy, or need advanced caching and cost tracking:
   - Start the **LLM Proxy Backend**. *See [LLM Proxy Setup](./llm-proxy/README.md#installation)*.
   - Start the **LLM Proxy Frontend** to monitor traffic. *See [Proxy Frontend Setup](./llm-proxy/frontend/README.md#installation)*.

3. **Prepare Your Documents:**
   Use the **PDF Helper** pipeline to scrape, download, verify, and compress the academic papers you need to review, syncing them to a shared Google Drive.
   *See [PDF Helper Setup](./pdfhelper/README.md#installation)*.

4. **Human Validation:**
   Export your intermediate screening data from the Google Sheet and load it into the **Inter-Rater SPA** to conduct independent, blinded reviews.
   *See [Inter-Rater Setup](./inter-rater/README.md#installation)*.

## Documentation Map

For detailed setup, configuration, and execution instructions, please refer to the specific README files for each microservice:

- 📘 **[Google Apps Script Core](./app-script/README.md)**
- 📘 **[LLM Proxy (Backend)](./llm-proxy/README.md)**
- 📘 **[LLM Proxy Dashboard (Frontend)](./llm-proxy/frontend/README.md)**
- 📘 **[Inter-Rater SPA](./inter-rater/README.md)**
- 📘 **[PDF Helper Service](./pdfhelper/README.md)**

## Contributing

This project is open-source. Contributions are welcome! Please adhere to the existing code style, ensure clean architecture principles, and thoroughly test any new integrations.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
