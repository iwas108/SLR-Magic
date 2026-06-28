# SLR Magic: System Architecture Blueprint

This document defines the global architectural design, data models, and module interactions across the **SLR Magic** workspace.

---

## 1. System Ecosystem Overview

The SLR Magic workspace coordinates systematic literature reviews (SLRs) through a local, laptop-first architecture. It prioritizes offline-capable local processes and file-based exchanges over complex network configurations (dropping any requirements for custom VPN configurations, HAProxy reverse proxies, or centralized databases).

The workspace comprises three active, complementary modules:
1. **Local Desktop Workspace Hub (`slr-ide/`)**: A local Next.js + SQLite application acting as the **one-stop solution** for the entire workflow. It handles project setup, reference ingestion, Python-based PDF matching/crawling, cloud syncing, calibration pool assignment, and consensus Kappa metric calculation.
2. **Blinded Review Client (`inter-rater/`)**: An offline-capable React SPA that **facilitates blinded inter-rater review** sessions. Reviewers import rating packages, score papers independently using keyboard shortcuts, and export results back without seeing AI ratings or co-reviewer selections.
3. **FAIR Compliance Spreadsheet database (`app-script/`)**: A Google Apps Script application operating within Google Sheets. It is restricted to serving strictly as a **FAIR-compliant cloud storage database** to ingest finalized project results, minimizing Google permissions and security trust boundaries.

```mermaid
graph TD
    subgraph "Local Desktop Environment (Laptop-First)"
        A[slr-ide: One-Stop Hub] <-->|SQLite Client| B[(Local SQLite DB)]
        A -->|1. Export Blinded .slr| C[inter-rater: Blinded SPA]
        C -->|2. Export Rated .slr| A
        A -->|Spawn Subprocesses| D[Python Engine]
        D -->|Execute Entrypoints| E[match_cache.py / scrape_pdfs.py]
    E -->|JSON Output to Stdout| B
    B -->|SSE / ReadableStream Stream| A
    E -->|Write Local PDFs| F[pdf_library/repo/ & pdf_library/downloads/]
    B -->|Rclone CLI Sync| G[Cloud Storage Google Drive / OneDrive]
    end
    
    A -->|3. Export FAIR CSV / Data Ingestion| H[app-script: Google Sheets FAIR Database Sink]
    E -->|Upload matched PDFs| G
    A -->|Fetch shareable file links| G
```

---

## 2. Active Module Blueprints

### I. Local Desktop Workspace (`slr-ide/`)
*For details, refer to the module blueprint: [slr-ide/architecture.md](slr-ide/architecture.md)*

*   **Role**: The one-stop control hub for the systematic review lifecycle.
*   **Frontend Core**: Next.js App Router, React, and Tailwind CSS v4. Operates through a clean modular architecture separating functional Views (`DashboardView`, `PipelineExecutionView`, etc.) and Custom Hooks (`useProjects`, `usePapers`, etc.) from the main `page.tsx` entry point.
*   **Persistence**: SQLite database (`db/slr.db`) for multi-project segmentation and paper metadata. Integrates with `prompt_templates` to store global and project prompts, and `llm_pricing` to compute token costs.
*   **Pipeline & Execution Engine**: Deterministic ID generators spawning Python Engine subprocesses. Hosts a Centralized Pipeline Dashboard orchestrating Web Scraping (`scrape_pdfs.py`), cloud-based publisher normalization (`map_publisher.py`), Cloud Syncing (`rclone`), and Semantic LLM Screening via live SSE terminal streams and process recovery endpoints.
*   **Prompt & LLM Configuration**: Facilitates CRUD management of prompts in the Prompt Library (global and project scoped) and dynamically retrieves prompt templates for LLM configs. Configures execution options (`temperature`, `max_tokens`, `top_p`, `top_k`) alongside local environment configurations (`.env.local`).
*   **Cloud Gateway**: Subprocess execution of `rclone` to compress and upload local PDFs to project-scoped Drive/OneDrive folders and retrieve shareable file links.

### II. Inter-Rater Blinded Review SPA (`inter-rater/`)
*For details, refer to the module blueprint: [inter-rater/architecture.md](inter-rater/architecture.md)*

*   **Role**: Facilitates double-blind human rating reviews of calibration pools.
*   **Principles**: Offline-First & Serverless React Core using Dexie.js (IndexedDB) for browser-level persistence. Reviewer name variables and AI ratings are completely stripped from workflows to guarantee blinding.
*   **Interface**: Page-level scrolling layouts locking keyboard shortcuts (`I` / `E` / rules `1`-`9` / page navigation) alongside dynamic QA scoring fields and description templates.
*   **Standardized Schema**: Enforces 7 whitelisted paper keys (including Abstract) and snake_case project metadata naming rules specifically for `CAL_Pool_A` sessions.

### III. Google Sheets FAIR Database (`app-script/`)
*For details, refer to the module blueprint: [app-script/architecture.md](app-script/architecture.md)*

*   **Role**: Minimizes Google App security permission boundaries by acting strictly as a FAIR-compliant database sink.
*   **Ingestion**: Receives final reference CSV outputs exported from `slr-ide` to archive the systematically compiled literature dataset.
*   **Cohort Archiving**: Stores references under `00_Raw_Harvest` and copies selected papers to `05_Synthesis` for cloud indexing.

---

## 3. Data Ingestion & Sync Protocol

Literature reference data exchanges are synchronized using localized file-based exports and imports:

1. **Ingestion into slr-ide**: Project databases are initialized by importing research reference files (CSV/BibTeX) from external scholarly databases (Scopus, IEEE Xplore, Web of Science, etc.).
2. **Blinded Review Exchange**:
   - `slr-ide` exports a blinded `.slr` JSON package containing snake_case metadata configuration details and whitelisted paper data (excluding AI decisions).
   - The reviewer imports this `.slr` file into `inter-rater`, ratings are entered locally, and the completed `.slr` file is exported back to `slr-ide` to auto-ingest reviewer decisions.
3. **FAIR Database Ingestion**:
   - The completed database cohort is exported from `slr-ide` as a standard `.csv` file.
   - The user uploads this `.csv` file into the `app-script` Google Sheet workspace to populate the master `00_Raw_Harvest` and `05_Synthesis` sheets for FAIR storage compliance.
