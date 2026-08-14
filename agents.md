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

### 3.5 Isolation of Double-Blind Calibration Adjudication
*   **Calibration Data Sandbox**: The double-blind calibration adjudication tables (`reviewer_decisions`, `calibration_commit_ledger`, and `calibration_papers`) and columns (`manual_decision`, `manual_rationale`, `manual_quality_assessment`, `manual_extracted_data`, `manual_stage` on `calibration_papers`) are standalone modules strictly reserved for prompt and agreement calibration.
*   **Zero Integration Policy**: Do NOT connect, source, or reference these tables or columns inside the general screening pipeline (such as fast filter, gatekeeper, scientist, or miner), general database view/filtering, or main paper details editing/sourcing flows.
*   **Manual Screening Precedence**: General human overrides during manual review MUST exclusively use the manual screening columns (`manual_decision`, `manual_rationale`, `manual_quality_assessment`, `manual_extracted_data` on `papers`) and the corresponding `manual_audit_log` table.


### 3.6 Stage-Aware Decision Resolution Policy (Source of Truth)
*   **Stage Dominance Rule**: When determining the active/effective screening decision for a paper, the decision from the **highest stage** (`MAX(manual_stage, ai_stage)`) is the absolute source of truth.
*   **Tie-Breaking Rule**: If the highest manual stage and highest AI stage are equal, the **manual decision overrides the AI decision**.
*   **No Naive COALESCE**: You **MUST NOT** use naive `COALESCE(manual_decision, ai_decision)` or `COALESCE(ai_decision, manual_decision)` to determine active decisions, as this ignores stage precedence. Use the following stage-aware `CASE` expression in SQL:
    ```sql
    CASE 
      WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
      WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
      ELSE COALESCE(manual_decision, ai_decision)
    END
    ```
*   **Stage Value Convention**: The `ai_stage` and `manual_stage` columns always store the **literal completed stage number N**, regardless of whether the decision is `INCLUDE` or `EXCLUDE`. The stage is **never advanced to N+1** after an `INCLUDE` — both pipelines (LLM queue handler and manual screening) write the stage they operated on directly. A value of `0` (or `NULL`) means the paper is Initial / Unscreened.

    | Completed Stage | Decision | Stage Column Value |
    |---|---|---|
    | Stage 1: Fast Filter | EXCLUDE (EC-1) | `1` |
    | Stage 1: Fast Filter | INCLUDE | `1` |
    | Stage 2: Gatekeeper | EXCLUDE (EC-4) | `2` |
    | Stage 2: Gatekeeper | INCLUDE | `2` |
    | Not yet screened | — | `0` / `NULL` |

*   **Inclusion Search Broadness**: When checking for `"INCLUDE"` status in the database, always use pattern matching (e.g. `LIKE 'INCLUDE%'`) rather than an exact match (e.g. `= 'INCLUDE'`) to avoid missing decision variants such as `'INCLUDE (S1)'`.

### 3.7 Screening Calibration Validation Rules (Methodology Targets)
*   **Stage 1 (Fast Filter)**: Passes if `Recall >= 100%` and `F1 Score >= 85%`.
*   **Stage 2 (Gatekeeper)**: Passes if `Precision >= 85%` and `Recall >= 90%` to prevent false negatives.
*   **Stage 3 (Scientist)**: Passes if `Critical Miss Rate === 0%` (allowing minor ordinal deviations of `0.5` points).
*   **Stage 4 (Miner)**: Passes if `Schema Integrity Rate === 100%` (0 missing keys, 100% correct type match). Exact matches are treated as pre-normalization text yield metrics and do not trigger pipeline fail states.

### 3.8 Strict Multi-Project Separation & Isolation Policy
*   **Absolute Multi-Project Isolation**: Every SQL query (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `JOIN`, or subquery) operating on project-tied database tables (`papers`, `reviewer_decisions`, `calibration_commit_ledger`, `calibration_papers`, `manual_audit_log`, `llm_audit_log`, `duplicate_pairs`, `rolling_batches`, `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`, `umbrellanizer_results`) **MUST** explicitly include and enforce `Project_ID = ?` (or `project_id = ?` / `CAST(project_id AS TEXT) = CAST(? AS TEXT)`).
*   **Zero Un-scoped Queries**: Coding agents **MUST NEVER** execute database reads, updates, deletes, or subqueries on paper records, audit logs, calibration tables, or rolling batch tables without filtering by `Project_ID` / `project_id`.
*   **Subquery & JOIN Alignment**: When writing correlated subqueries or `JOIN` conditions involving `llm_audit_log`, `manual_audit_log`, `calibration_commit_ledger`, or `rolling_batch_papers`, coding agents **MUST** explicitly link project IDs in the `JOIN ON` clause (e.g., `AND l.project_id = p.Project_ID` or `AND CAST(latest.project_id AS TEXT) = CAST(l.project_id AS TEXT)`).
*   **Zero Default-Project & Mandatory Project Lock Screen**: `'default-project'` is deprecated and MUST NOT be used as a synthetic fallback. All project-tied operations require a valid user-created or migrated project ID (`proj-*`). If zero projects exist or no active project is selected, the application MUST present a Project Lock Screen forcing project creation/selection before any workspace features are accessible.
*   **Cascading Project Deletion**: When deleting a project, all associated records in all 11 project-tied tables **MUST** be deleted inside an atomic SQLite transaction filtered strictly by `Project_ID` / `project_id`.
*   **Vector Search & Scraper Allowlisting**: FAISS vector search engines (`vector_worker.py`, `semantic_search.py`), PDF integrity verification tools (`verify_pdfs.py`), and scraper scripts (`scrape_pdfs.py`, `match_cache.py`) **MUST** restrict candidate allowlists and file updates strictly to the active `project_id`.
*   **Remote Worker Result Scoping**: Callbacks handling PDF download or scrape results (`remote-worker/result/route.ts`) **MUST** resolve the target paper's `Project_ID` and include `AND Project_ID = targetProjectId` on all database updates to prevent cross-project state corruption.

### 3.9 Mandatory Centralized Trace Normalizer Protocol
*   **Single Source of Truth**: All UI components (`FinalCohortPanel`, `UmbrellanizerView`), modals (`LlmContextBuilderModal`), and API export endpoints (`csv-tabular`, `final-cohort`, `slr-viewer`) **MUST** resolve logic trace mappings and reasoning quotes using `extractMappingReasoning` and `extractEvidenceQuote` from `@/lib/services/trace-normalizer`.
*   **Zero Islanded Lookups Policy**: Coding agents **MUST NEVER** write ad-hoc or inline key resolution logic (such as `locateMapping['locate_' + key]`) when extracting logic trace mappings. You must import and utilize the centralized `trace-normalizer` utility to ensure key normalization, prefix cleaning, candidate lookups, and nested property fallbacks remain synchronized.

---


## 4. SLR IDE Core Blueprint Reference

*   **Database**: SQLite (`db/slr.db`) with schema documentation in [slr-ide/db/schema.md](slr-ide/db/schema.md).
*   **Manual Audit Trail**: The application logs all manual review overrides and decisions into the `manual_audit_log` table to capture reviewer history.
*   **Smart Cache Matcher**: [slr-ide/scrapers/cache_matcher.py](slr-ide/scrapers/cache_matcher.py) (matches local PDFs using ID, DOI, Title Similarity, and Page 1 text).
*   **Web Scraper**: [slr-ide/scrapers/pdf_scraper.py](slr-ide/scrapers/pdf_scraper.py) (downloads missing PDFs using undetected-chromedriver).
*   **Sync**: Subprocess execution of `rclone` with shareable Google Drive links generation.
*   **Core Execution & Calibration**: [methodology.md](methodology.md) (defines thresholds, pre-calibration loops, and target JSON payloads).
*   **Comprehensive File Index**: [slr-ide/files.md](slr-ide/files.md) (contains every file inside slr-ide and its function/purpose to speed up agent navigation).