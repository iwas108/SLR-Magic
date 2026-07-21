# SLR Magic ✨

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Architecture: Local--First](https://img.shields.io/badge/Architecture-Local--First-blue.svg)
![Domain: Systematic%20Literature%20Review](https://img.shields.io/badge/Domain-Systematic%20Literature%20Review-success.svg)

## Overview

**SLR Magic** is an advanced, local-first, AI-assisted platform designed to accelerate, calibrate, and standardize Systematic Literature Reviews (SLRs). By combining Large Language Model (LLM) automation with strict human-in-the-loop double-blind adjudication, SLR Magic automates labor-intensive review phases—such as abstract screening, full-text validation, quality assessment, and structured taxonomy extraction—while guaranteeing scientific rigor and reproducibility.

The system features a **Local-First & File-Based Architecture** that ensures complete data privacy and security. Paper metadata, local PDF repositories, vectors, and encryption key vaults remain on the reviewer's local workstation, synchronized via standardized `.slr` (JSON), `.slr-viewer` (snapshots), and FAIR-compliant `.csv` datasets.

---

## Workspace & Active Modules

The repository is structured into four core active modules:

```
SLR-Magic/
├── slr-ide/        # Next.js + SQLite local desktop IDE & execution engine
├── inter-rater/    # Standalone offline React SPA for blinded human review & calibration
├── slr-viewer/     # Standalone read-only HTML5/React SPA for snapshot dataset analysis
└── app-script/     # Google Apps Script FAIR-compliant database export endpoint
```

### 1. 🚀 [SLR IDE (`slr-ide/`)](./slr-ide)
- **Role:** The main control center and desktop application for the entire SLR pipeline.
- **Tech Stack:** Next.js (App Router), SQLite (`slr.db`), Python 3.10 Engine, Google Gemini Interactions API (`google-genai`), Sentence-Transformers (Turbovec daemon), Rclone.
- **Core Features:**
  - **Ingestion Hub:** Interactive CSV metadata importer with column mapping, duplicate preview, and title/DOI deduplication guardrails.
  - **PDF Retrieval Engine:** Smart Cache Matcher (MD5, DOI, title similarity, page 1 text/OCR fallback) and automated browser scraper using `undetected-chromedriver`.
  - **4-Stage LLM Screening Pipeline:** Fast Filter (Stage 1), Gatekeeper (Stage 2), Scientist (Stage 3 QA), and Miner (Stage 4 Data Extraction) with multi-turn interaction chaining.
  - **Encrypted Key Vault:** AES-256-GCM + PBKDF2 vault securing LLM credentials in local SQLite.
  - **Turbovec Vector Search Daemon:** Persistent Python background RPC worker process for sub-100ms semantic similarity searches.
  - **Pre-Calibration & Post-Validation:** Double-blind calibration sandbox, sequential rolling batch quality control (QC), and Umbrellanizer category mapping.
  - **Cohort Table & Exporters:** Wide tabular cohort view with dynamic column resizing, 100% CSV Tabular Export (with tooltip logic traces), and `.slr-viewer` snapshot builder.

### 2. 👥 [Inter-Rater SPA (`inter-rater/`)](./inter-rater)
- **Role:** Blinded human review and calibration tool.
- **Tech Stack:** React 19, Vite, Tailwind CSS.
- **Core Features:**
  - Independent, blinded paper evaluation without visibility into other raters' choices or AI decisions.
  - Offline session persistence via `localStorage`.
  - Automatic calculation of inter-rater agreement metrics (Cohen's Kappa, percent agreement, QA score comparisons).
  - Native `.slr` JSON schema file import and export.

### 3. 📊 [SLR Viewer (`slr-viewer/`)](./slr-viewer)
- **Role:** Standalone offline dashboard for reviewing exported SLR snapshot datasets.
- **Tech Stack:** React 19, Vite, Tailwind CSS, Dexie.js (IndexedDB), Apache ECharts.
- **Core Features:**
  - Offline `.slr-viewer` JSON snapshot file import into IndexedDB.
  - **PRISMA 2020 Canvas:** Interactive 2D canvas rendering PRISMA flowcharts with high-resolution PNG export.
  - **Cohort Analytics & Visualizer:** 17 scientific chart types (Sankey diagrams, bar/stack charts, radar, line, pie) with vector SVG export.
  - **Scientific Rigor & Accounting:** Per-stage spend grid, top expensive API call logs, and FAIR dataset re-export.

### 4. 📑 [App Script (`app-script/`)](./app-script)
- **Role:** Lightweight Google Sheets integration serving as a FAIR-compliant spreadsheet database.
- **Tech Stack:** Google Apps Script, Google Sheets, ECharts UI.
- **Core Features:**
  - Spreadsheet dataset ingestion for exported CSV records from `slr-ide`.
  - Interactive visualization dialogs directly inside Google Sheets.
  - Zero Google API app permission footprint for maximum security.

---

## Quick Start Guide

### Running SLR IDE (Main Desktop Application)
```bash
# 1. Navigate to slr-ide
cd slr-ide

# 2. Install Node.js dependencies
npm install

# 3. Set up Python virtual environment (for scrapers and vector daemon)
python -m venv python_engine/venv
source python_engine/venv/bin/activate  # On Windows: python_engine\venv\Scripts\activate
pip install -r python_engine/requirements.txt

# 4. Start local development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Inter-Rater SPA
```bash
cd inter-rater
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running SLR Viewer
```bash
cd slr-viewer
npm install
npm run dev
```
Open [http://localhost:3002](http://localhost:3002) in your browser.

---

## Documentation Map

- 📘 **[SLR IDE Documentation](./slr-ide/README.md)** (Architecture & Features)
- 📘 **[Inter-Rater SPA Documentation](./inter-rater/README.md)** (Blinded Review & Calibration)
- 📘 **[SLR Viewer Documentation](./slr-viewer/README.md)** (Snapshot Analytics & PRISMA)
- 📘 **[App Script Documentation](./app-script/README.md)** (Spreadsheet FAIR Database)
- 📐 **[System Architecture Blueprint](./architecture.md)** (Module-scoped compiled architecture)
- 🎯 **[Methodology & Calibration Standards](./methodology.md)** (Mathematical targets, thresholds & prompt seeds)
- 📜 **[System Improvements Log](./improvements.md)** (Chronological iteration history)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
