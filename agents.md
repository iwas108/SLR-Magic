# SLR Magic: Developer & Coding Agent Directives

Welcome, coding agent! This document contains the master developer instructions, system architecture routing, and strict security and coding standards for the **SLR Magic** workspace.

> [!IMPORTANT]
> **MANDATORY INSTRUCTION STARTUP RULE**:
> Every time you receive a user instruction, you **MUST** read this `agents.md` file in the root directory first before taking any other action.

---

## 1. Active Modules & Workspace Structure

The repository is structured around three active modules. All other legacy folders (like `pdfhelper` and `llm-proxy`) are deprecated and will be removed after final implementation of the new architecture:

1.  **`slr-ide/`**: The local Next.js + SQLite desktop application. It serves as the **one-stop solution** for the entire systematic literature review (SLR) workflow (managing ingestion, PDF acquisition, sync, pooling, and calibration metrics).
2.  **`inter-rater/`**: The local offline React SPA. It **facilitates blinded inter-rater reviews** by letting independent reviewers evaluate assigned paper pools without visibility into other raters' choices or AI decisions.
3.  **`app-script/`**: The Google Apps Script codebase running within the Google Sheets environment. It **only acts as a FAIR-compliant database** to ingest exported datasets from any step in `slr-ide`. This minimizes the required Google API app permissions and security/trust considerations.

### Local-First & File-Based Architecture
The workflow runs entirely locally on a reviewer's computer. It utilizes file-based synchronization (`.slr` with JSON schema for reviews, and `.csv` for spreadsheet FAIR database updates). This approach drops previous complex infrastructure requirements such as custom VPN tunnels and HAProxy load balancers.

### Workspace Router Guidelines
When the user's instruction targets specific modules (e.g., "new feats in slr-ide" or "update inter-rater"), you must:
*   Only make modifications within the targeted directory.
*   You are permitted to read and crosscheck files in the other active modules for integration compatibility, but you **MUST NOT** write code or make changes in the other modules unless explicitly authorized.

---

## 2. Documentation Architecture

To maintain the system state and trace all changes cleanly, we adopt a hierarchical documentation standard:

### 2.1 Module-Scoped Blueprints (`architecture.md`)
*   Every active module (`app-script/`, `slr-ide/`, `inter-rater/`) **MUST** have its own `architecture.md` file (e.g., [app-script/architecture.md](app-script/architecture.md), [slr-ide/architecture.md](slr-ide/architecture.md), [inter-rater/architecture.md](inter-rater/architecture.md)) acting as a comprehensive blueprint of that module.
*   These module-scoped blueprints are compiled to construct the system-level `architecture.md` in the root directory.

### 2.2 Module-Scoped Logs (`improvements-log.md`)
*   Every active module **MUST** maintain an `improvements-log.md` tracking all its iterations, features, and fixes.
*   Every log entry in this file must feature an **iterative sequential ID number** (e.g., `#001`, `#002`, `#003`).
*   These local log files are used to compile the system-level `improvements.md` in the root directory.

### 2.3 Core Execution & Calibration Blueprint (`methodology.md`)
*   The system-level `methodology.md` ([methodology.md](methodology.md)) serves as the absolute source of truth for the core execution pipeline, calibration workflows, mathematical targets/thresholds, and target JSON schemas (Prompt Seeds).
*   Any prompt modifications, scoring mechanisms, or pipeline adjustments MUST strictly adhere to the guidelines and schemas defined in this document.

### 2.4 Module-Scoped File & Function Directories (`files.md`)
*   Every active module maintains a `files.md` directory index (e.g., [slr-ide/files.md](slr-ide/files.md)) containing every file within that module along with its specific function, architectural layer, and purpose.
*   Coding agents **MUST** utilize this file index to speed up codebase navigation, function searching, and structural lookup during tasks.
*   **MANDATORY FILE LOGGING RULE**: Coding agents **MUST** update `slr-ide/files.md` whenever any file is created, modified in purpose, or deleted.
*   **Table Schema**: When appending new file records to `files.md`, you must strictly adhere to the following Markdown table schema: `| File Path | Architectural Layer | Function & Purpose |`.

---

## 3. Strict Coding & Security Standards

### 3.1 Clean Code Architecture & FAIR Principles
*   **Modular Component Architecture**: You MUST break down large interfaces into single-responsibility React functional components. DO NOT build or maintain massive single-file monoliths (like a 5000+ line `page.tsx`). Utilize the following dedicated architectural directories:
    *   `src/lib/services/`: Core backend services, child process orchestration, and EventSource stream management.
    *   `src/lib/inter-rater/`: Pure TypeScript domain calculation libraries with zero Next.js dependencies (fully portable with standalone SPA).
    *   `src/components/features/modals/`: Standalone, fully encapsulated modal dialog components.
    *   `src/components/features/dashboard/`: Modular single-responsibility widgets for executive overviews.
    *   `src/components/features/inter-rater/`: Presentation components for blinded review adjudication and comparisons.
*   **Custom Hooks for State Management**: Separate complex business logic, side-effects, and React state (`useState`, `useEffect`) into custom hooks (`src/hooks/`) to keep View components clean and declarative.
*   **Explicit Prop Passing**: Avoid the "props-drilling nightmare" pattern of collecting the entire application state into a single massive `allProps` object and passing it down to all children blindly. Explicitly pass only the props required by the child components.
*   Maintain clean interfaces between Next.js APIs, the local SQLite database, and the Python CGI-like scrapers.
*   Follow FAIR data principles (Findable, Accessible, Interoperable, and Reusable) for all paper datasets.

### 3.2 Strong Security Measures (Leak Prevention)
*   **Zero Leakage Policy**: You must never expose or commit SQLite databases (`slr.db`, `*.db`, `*.sqlite`), temporary PDF folders (`cached_pdf/`, `downloaded_pdf/`, `pdf_repo/`), environmental configurations (`.env*`), or credentials (`.rclone.conf`).
*   Always check the local and root `.gitignore` files to ensure exclusions are correctly configured and followed.

### 3.3 Multi-Tab Synchronization Protocol
*   **Agnostic Broadcast Pattern**: When implementing or editing features that mutate key workspace states (e.g. project activations, paper edits, pipeline execution state, and inter-rater decisions), you **MUST** trigger synchronization broadcasts using the `broadcastSync` utility from `@/lib/sync-utils`.
*   **Active State Rehydration (Data Loss Prevention)**: It is **MANDATORY** that forms, modals, and active editing states automatically re-hydrate (refresh) their local data if a `broadcastSync` event updates their parent dataset. You must synchronize the actively-edited object (e.g., `editingProject`, `editingPaper`, `selectedDiscrepancy`) against the refreshed main list to prevent a stale tab from saving old data.
*   **Form Input Preservation (Rehydration Guard)**: When re-hydrating active states, you **MUST** guard editable form inputs from being reset or overwritten. Use a mutable `useRef` (e.g., `lastLoadedPaperRef`, `lastLoadedDiscrepancyRef`) to cache the database state of the currently loaded object. Only reset or overwrite local user-input states if the object ID changes (indicating the user clicked a different paper) or if the form-related input states in the database itself changed from another session (multi-tab sync). This preserves local unsaved typed inputs when background tasks update non-form attributes (like `local_pdf_path`).
*   **Stale-Closure Prevention (Mutable Ref Pattern)**: When subscribing to `BroadcastChannel` messages in React functional components, do not reference state-dependent getters/setters directly in the message listener. You **MUST** use a mutable `useRef` to store the latest versions of callback functions (e.g. `loadPapers`, `loadProjects`, `checkBatchStatus`) to avoid capturing stale closures.


### 3.4 Mandatory Tree Shaking
*   **Post-Refactor Cleanup**: Every time you perform a major component or hook extraction, you MUST perform a 'tree shaking' audit of the parent file (e.g., page.tsx).
*   **Remove Dead Code**: Identify and delete any unused imports, orphaned local states (useState), and abandoned functions left behind by the refactor.
*   **Compiler Verification**: After tree shaking, you MUST run the TypeScript compiler (e.g., 
px tsc --noEmit) to verify that no duplicate variables or syntax errors remain, ensuring a clean and stable build.

---

## 4. SLR IDE Core Blueprint Reference

*   **Database**: SQLite (`db/slr.db`) with schema documentation in [slr-ide/db/schema.md](slr-ide/db/schema.md).
*   **Smart Cache Matcher**: [slr-ide/scrapers/cache_matcher.py](slr-ide/scrapers/cache_matcher.py) (matches local PDFs using ID, DOI, Title Similarity, and Page 1 text).
*   **Web Scraper**: [slr-ide/scrapers/pdf_scraper.py](slr-ide/scrapers/pdf_scraper.py) (downloads missing PDFs using undetected-chromedriver).
*   **Sync**: Subprocess execution of `rclone` with shareable Google Drive links generation.
*   **Core Execution & Calibration**: [methodology.md](methodology.md) (defines thresholds, pre-calibration loops, and target JSON payloads).
*   **Comprehensive File Index**: [slr-ide/files.md](slr-ide/files.md) (contains every file inside slr-ide and its function/purpose to speed up agent navigation).