# SLR Magic: Developer & Coding Agent Directives

Welcome, coding agent! This document contains the master developer instructions, system architecture routing, and strict security and coding standards for the **SLR Magic** workspace.

> [!IMPORTANT]
> **MANDATORY INSTRUCTION STARTUP RULE**:
> Every time you receive a user instruction, you **MUST** read this `agents.md` file in the root directory first before taking any other action.

---

## 1. Active Modules & Workspace Structure

The repository is structured around two active modules. All other folders (like `pdfhelper` and `llm-proxy`) are deprecated legacy code and must not be modified or used:

1.  **`app-script/`**: The Google Apps Script codebase running within the Google Sheets environment. It manages the master spreadsheet sheets: `00_Raw_Harvest`, `05_Synthesis`, and the calibration pools (`CAL_Pool_A`, `CAL_Pool_B`, `CAL_Pool_C`).
2.  **`slr-ide/`**: The local Next.js + SQLite desktop application. It acts as the local workspace hub to import references, run smart local/online PDF matching, sync with Google Drive, and manage review cohorts.

### Workspace Router Guidelines
When the user's instruction targets a specific module (e.g., "new feats in slr-ide" or "update app-script"), you must:
*   Only make modifications within the targeted directory.
*   You are permitted to read and crosscheck files in the other active module for integration compatibility, but you **MUST NOT** write code or make changes in the other module unless explicitly authorized.

---

## 2. Documentation Architecture

To maintain the system state and trace all changes cleanly, we adopt a hierarchical documentation standard:

### 2.1 Module-Scoped Blueprints (`architecture.md`)
*   Every active module (`app-script/`, `slr-ide/`) **MUST** have its own `architecture.md` file (e.g., [app-script/architecture.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/app-script/architecture.md), [slr-ide/architecture.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/architecture.md)) acting as a comprehensive blueprint of that module.
*   These module-scoped blueprints are compiled to construct the system-level `architecture.md` in the root directory.

### 2.2 Module-Scoped Logs (`improvements-log.md`)
*   Every active module **MUST** maintain an `improvements-log.md` tracking all its iterations, features, and fixes.
*   Every log entry in this file must feature an **iterative sequential ID number** (e.g., `#001`, `#002`, `#003`).
*   These local log files are used to compile the system-level `improvements.md` in the root directory.

---

## 3. Strict Coding & Security Standards

### 3.1 Clean Code Architecture & FAIR Principles
*   Write modular, reusable components and functions.
*   Maintain clean interfaces between Next.js APIs, the local SQLite database, and the Python CGI-like scrapers.
*   Follow FAIR data principles (Findable, Accessible, Interoperable, and Reusable) for all paper datasets.

### 3.2 Strong Security Measures (Leak Prevention)
*   **Zero Leakage Policy**: You must never expose or commit SQLite databases (`slr.db`, `*.db`, `*.sqlite`), temporary PDF folders (`cached_pdf/`, `downloaded_pdf/`, `pdf_repo/`), environmental configurations (`.env*`), or credentials (`.rclone.conf`).
*   Always check the local and root `.gitignore` files to ensure exclusions are correctly configured and followed.

---

## 4. SLR IDE Core Blueprint Reference

*   **Database**: SQLite (`db/slr.db`) with schema documentation in [db/schema.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/db/schema.md).
*   **Smart Cache Matcher**: [scrapers/cache_matcher.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scrapers/cache_matcher.py) (matches local PDFs using ID, DOI, Title Similarity, and Page 1 text).
*   **Web Scraper**: [scrapers/pdf_scraper.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scrapers/pdf_scraper.py) (downloads missing PDFs using undetected-chromedriver).
*   **Sync**: Subprocess execution of `rclone` with shareable Google Drive links generation.