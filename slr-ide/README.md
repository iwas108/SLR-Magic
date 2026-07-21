# SLR IDE Sub-module (`slr-ide/`) ✨

![Module: SLR IDE](https://img.shields.io/badge/Module-SLR%20IDE-blue.svg)
![Framework: Next.js](https://img.shields.io/badge/Framework-Next.js%2015-black.svg)
![Database: SQLite](https://img.shields.io/badge/Database-SQLite-003B57.svg)
![API: Google Gemini](https://img.shields.io/badge/API-Google%20Gemini%20Interactions-8E75B2.svg)

## Overview

**SLR IDE** is the core desktop application and execution engine of the SLR Magic workspace. Built as an offline-first Next.js (App Router) + SQLite desktop environment, it serves as a one-stop solution for managing the complete Systematic Literature Review (SLR) workflow: metadata ingestion, automated PDF retrieval, semantic vector indexing, 4-stage LLM screening, prompt calibration, rolling batch quality control, and data export.

---

## Key Architecture & Features

### 1. 📥 Ingestion Hub & Deduplication
- Bulk imports CSV paper collections from Scopus, Web of Science, PubMed, and IEEE Xplore.
- Features interactive column mapping with fuzzy header auto-detection and data preview.
- Enforces multi-level deduplication guardrails (exact DOI, normalized Title similarity, and numeric `Paper_ID` conflict resolution).

### 2. 📄 PDF Retrieval Engine & Scraper
- **Smart Cache Matcher (`cache_matcher.py`):** Automatically matches local PDF files against database paper records using MD5 hash, DOI, title similarity, and Page 1 text (with Tesseract OCR fallback for scanned PDFs).
- **Automated Web Scraper (`pdf_scraper.py`):** Uses stealthy `undetected-chromedriver` instances to download missing paper PDFs via institutional proxies or direct links.
- **Rclone Sync (`rclone-sync.ts`):** Subprocess wrapper running `rclone` to synchronize compressed PDF repositories with Google Drive.

### 3. 🤖 4-Stage LLM Screening Pipeline
- Powered by the **Google Gemini Interactions API** (`google-genai>=2.3.0`) with stateful multi-turn interaction chaining.
- **Pipeline Stages:**
  - **Stage 1 (Fast Filter):** Broad title/abstract inclusion/exclusion screening targeting 100% recall.
  - **Stage 2 (Gatekeeper):** Methodological abstract & full-text screening targeting >=85% precision and >=90% recall.
  - **Stage 3 (Scientist):** Quality Assessment (QA) scoring across custom evaluation criteria.
  - **Stage 4 (Miner):** Schema-validated structured taxonomy and data extraction.
- **Encrypted Vault (`src/lib/vault.ts`):** Securely encrypts LLM API credentials in local SQLite using AES-256-GCM + PBKDF2.
- **LLM Operations Center:** Includes live streaming log output, multi-tab synchronization via `BroadcastChannel`, prompt library editor with Jinja2 syntax assistance, and pre-execution launch verification modal.

### 4. ⚡ Turbovec Semantic Vector Search Daemon
- Integrates a persistent Python background daemon (`vector_worker.py`) that loads sentence-transformer embedding models into memory once.
- Exposes a JSON RPC interface over `stdin`/`stdout`, enabling sub-100ms vector similarity searches without model reload overhead.

### 5. 🔬 Pre-Calibration, Post-Validation & Umbrellanizer
- **Calibration Sandbox:** Dedicated double-blind calibration adjudication tables (`reviewer_decisions`, `calibration_papers`) for prompt tuning without corrupting general review pipelines.
- **Rolling Batches:** Sequential quality control (QC) audit monitoring statistical stopping criteria.
- **Umbrellanizer:** Normalizes raw LLM-extracted terms into standardized umbrella taxonomy categories.

### 6. 📈 Final Cohort View & Exporters
- **Wide Tabular View:** Resizable table columns with project-scoped `localStorage` persistence.
- **100% CSV Tabular Export:** Exports all paper metadata, manual/AI decisions, QA scores, extracted research variables, and tooltip logic traces (`tt_*`).
- **`.slr-viewer` Snapshot Exporter:** Packages project datasets into `.slr-viewer` JSON files for offline analysis in the `slr-viewer` SPA.

---

## Directory Structure

```
slr-ide/
├── db/                     # SQLite database files and schema.md documentation
├── public/                 # Static branding assets and icons
├── python_engine/          # Python engine (scrapers, vector daemon, LLM queue)
│   ├── core/               # DB, security, and NDJSON IPC modules
│   ├── crawler/            # Selenium browser scrapers
│   ├── llm/                # Gemini API interaction queue handlers
│   └── vector/             # Turbovec index manager & vector_worker.py RPC daemon
├── src/
│   ├── app/                # Next.js App Router (page.tsx, API routes)
│   ├── components/         # Modular functional React components
│   │   ├── features/       # Feature panels (Ingestion, Pipeline, Cohort, LLM)
│   │   └── ui/             # Reusable UI primitives and JSONViewer
│   ├── hooks/              # Custom React state hooks (usePapers, usePipeline, etc.)
│   ├── lib/                # Backend services, SQLite client, and vault
│   └── types/              # TypeScript interface definitions
├── architecture.md         # Detailed module blueprint
├── files.md                # Complete file and function index
└── improvements-log.md     # Sequential iteration log
```

---

## Prerequisites & Installation

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **Python:** v3.10 or higher
- **SQLite3**

### Local Setup
1. Install Node.js dependencies:
   ```bash
   npm install
   ```

2. Create and activate Python virtual environment:
   ```bash
   python -m venv python_engine/venv
   # Windows:
   python_engine\venv\Scripts\activate
   # Linux/macOS:
   source python_engine/venv/bin/activate
   ```

3. Install Python requirements:
   ```bash
   pip install -r python_engine/requirements.txt
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to access the SLR IDE.

---

## Documentation & Standards

- 📐 **[Module Architecture (`architecture.md`)](./architecture.md)**
- 📁 **[File Directory Index (`files.md`)](./files.md)**
- 📜 **[Iteration Log (`improvements-log.md`)](./improvements-log.md)**
