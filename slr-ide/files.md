# SLR IDE File & Function Directory (`files.md`)

This document serves as a comprehensive index of every file within the `slr-ide` module, detailing each file's specific function, architectural layer, and core purpose. This directory is specifically designed to assist coding agents in rapid codebase navigation, function searching, and architectural understanding.

---

## 1. Root Configuration & Documentation (`slr-ide/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `AGENTS.md` | Governance / Directives | Contains workspace-scoped rules, developer instructions, and behavioral guardrails specifically for coding agents operating in `slr-ide`. |
| `architecture.md` | Documentation | Module-scoped blueprint detailing the local Next.js + SQLite desktop application design, data flows, and IPC patterns. |
| `improvements-log.md` | Documentation | Chronological log of incremental features, bug fixes, refactoring iterations (including decision-exclusion code split), and optimizations with sequential IDs (e.g., `#001`). |
| `package.json` | Dependency / Scripts | Defines NPM package dependencies, project metadata, and execution scripts (e.g., `dev`, `prebuild`, `build`, `lint`). |
| `package-lock.json` | Dependency | Lockfile ensuring reproducible dependency tree installation across environments. |
| `next.config.mjs` | Build Configuration | Next.js configuration injecting `NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_BUILD_TIME` environment variables. |
| `scripts/bump-version.js` | Build Automation | Node.js script executing prior to build (`prebuild`) to auto-increment the patch version in `package.json`. |
| `tsconfig.json` | Build Configuration | TypeScript compiler configuration defining strict type-checking rules, module resolution, and path aliases (`@/*`). |
| `tsconfig.tsbuildinfo` | Build Configuration | Incremental TypeScript compiler cache file to speed up subsequent type-checking builds. |
| `next-env.d.ts` | Type Declarations | Automatically generated TypeScript definitions for Next.js environment compatibility. |
| `eslint.config.mjs` | Linting Configuration | ESLint configuration file defining strict code quality rules and linting standards. |
| `postcss.config.mjs` | Build Configuration | PostCSS configuration for processing Tailwind CSS utilities and global stylesheets. |
| `README.md` | Documentation | General developer onboarding guide and quickstart documentation for the Next.js workspace. |
| `.gitignore` | Security / Git | Git exclusion rules preventing the leakage of SQLite databases, PDF repositories, environment variables, and build caches. |
| `CLAUDE.md` | Governance / Directives | Quick reference configuration file for AI agent interactions. |

---

## 2. Database & Schema (`slr-ide/db/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `slr.db` | Persistence | Primary SQLite database storing all active project metadata, paper records, reviewer decisions, and configuration states. |
| `slr.db-shm` / `slr.db-wal` | Persistence | SQLite Write-Ahead Logging (WAL) shared-memory and log files enabling high-concurrency atomic transactions. |
| `cache_index.db` | Persistence / Caching | High-speed SQLite caching database storing MD5 hashes, file sizes, mtimes, extracted titles/DOIs, and page 1 OCR text for rapid local PDF matching. |
| `compression_manifest.json` | Persistence | Manifest file tracking PDF compression statistics, original/compressed file sizes, and cumulative storage savings. |
| `schema.md` | Documentation | Absolute source of truth for the SQLite database schema, documenting table structures (`papers`, `projects`, `configs`, `reviewer_decisions`, `calibration_commit_ledger`, `duplicate_pairs`), foreign keys, indexes, and historical migration changes. |

---

## 3. Public Static Assets (`slr-ide/public/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Frontend / UI | Static vector illustration assets and branding icons utilized across the Next.js user interface. |

---

## 4. Scripts & Migration Utilities (`scripts/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `scripts/migrate_rq3a_edge_hardware.py` | Database Migration | Migrates `extracted_data.rq3a_edge_hardware.value` inside `ai_extracted_data` from comma-separated strings or `'NOT_STATED'` to clean string arrays (`['NOT_STATED']` for `'NOT_STATED'`). |
| `scripts/test-llm-screening-records.mjs` | Test Automation | Standalone test suite verifying `llm_screening_records` table, multi-stage transitions, SQLite trigger synchronization, downstream invalidation on re-run exclusions, and paper deletion cascades. |
| `scripts/test-archive-service.mjs` | Test Automation | Standalone test suite verifying relational project archive export and restore integrity with 0 foreign key violations. |
| `scripts/test-prompt-library.mjs` | Test Automation | Standalone test suite verifying Prompt Library project isolation, global template forking, 1-click stage default mappings, and draft non-overwriting safety. |
| `scripts/test-visualizer-anti-regression.mjs` | Test Automation | Standalone anti-regression test suite validating Hare-Hamilton 100.00% quota balance, color shading, taxonomy extraction, and preset serialization. |
| `scripts/test-mockup-review.mjs` | Test Automation | Standalone test suite verifying multi-pool mockup review generation, GZIP .slr compression/decompression, PRISMA isolation, and cache lifecycle. |

---

## 5. Python Scraping & Processing Engine (`slr-ide/python_engine/`)

### Core & Infrastructure
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `requirements.txt` | Dependency | Lists required Python packages (`pypdf`, `cryptography`, `selenium`, `undetected-chromedriver`, `pymupdf`, `pytesseract`, etc.). |
| `core/config.py` | Configuration | Parses environment variables and queries the SQLite `configs` table to establish operational settings for Python subprocesses. |
| `core/db.py` | Database Interop | Provides lightweight SQLite connection management, pragmas enforcement, and query execution helpers for Python scripts. |
| `core/events.py` | Real-time IPC | Formats and emits real-time NDJSON event objects to `stdout`, allowing Next.js API routes to stream progress updates to the frontend. |
| `core/security.py` | Security | Implements cryptographic routines (e.g., AES decryption for locked PDFs) and secure credential/proxy handling. |
| `vector/__init__.py` | Vector Processing | Package initialization file exposing the vector modules to python engine entrypoints. |
| `vector/embedder.py` | Vector Processing | Core embedding wrapper for sentence-transformers and local nomic-embed-text-v1.5 model. |
| `vector/index_manager.py` | Vector Indexing | Manages IdMapIndex creations, additions, updates, removals, and similarity searches. |
| `vector/id_map.py` | Database Interop | Bidirectional SQLite-backed mapper resolving string IDs to deterministic 63-bit integer keys. |

### Crawler & Scraper Modules
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `crawler/browser.py` | Web Scraping | Instantiates stealthy Selenium WebDriver instances using `undetected-chromedriver` with custom proxy and headless/headed mode configurations. |
| `crawler/config.py` | Configuration | Defines crawler-specific settings such as request delays, jitter windows, User-Agent rotation, and institutional proxy structures. |
| `crawler/dom_parser.py` | Web Scraping | Parses HTML DOM trees to locate academic full-text PDF download links, identify paywalls, and extract paper metadata. |
| `crawler/navigator.py` | Web Scraping | Automates complex browser navigation flows, handling cookie consent banners, institutional login redirects, and dynamic page loading. |

### CLI Entrypoints
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `entrypoints/compress_pdfs.py` | CLI Subprocess | Executes bulk batch PDF compression across project directories using Ghostscript or fallback mechanisms to optimize storage. |
| `entrypoints/detect_duplicates.py` | CLI Subprocess | Implements fuzzy heuristic matching (token set ratios, Scopus Author ID overlap) to detect candidate duplicate paper pairs for human review. |
| `entrypoints/map_publisher.py` | CLI Subprocess | Normalizes raw publisher string fields from ingested literature datasets into standardized academic publisher entities. |
| `entrypoints/match_cache.py` | CLI Subprocess | Executes smart cached PDF matching against local libraries using Paper ID, DOI, Title similarity, MD5 hashes, and Tesseract OCR. Matched files are moved to raw/ eternal library. |
| `entrypoints/scrape_pdfs.py` | CLI Subprocess | Initiates automated bulk PDF acquisition from academic publisher websites for papers marked with `MISSING` local PDF status. |
| `entrypoints/verify_pdfs.py` | CLI Subprocess | Audits MATCHED, DOWNLOADED, and SYNCED PDF files on disk using size, header, poison string, page count, and fuzzy title matching. |
| `entrypoints/build_vectors.py` | CLI Subprocess | CLI driver responsible for building and updating vector indices incrementally. |
| `entrypoints/semantic_search.py` | CLI Subprocess | CLI driver performing semantic searches across the paper corpus and PDF cache. |
| `entrypoints/find_traps.py` | CLI Subprocess | CLI driver isolating semantic near-miss traps for pre-calibration. |
| `entrypoints/vector_worker.py` | CLI Subprocess | Persistent daemon process loading embeddings model once and executing queries on stdin. |

### LLM Orchestration & Providers
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `llm/main.py` | LLM Orchestration | Primary CLI entrypoint for executing Gemini Interactions API task executions. |
| `llm/client.py` | LLM Client | Wrapper for google-genai Client, calling interactions.create with flex-pacing. |
| `llm/screening.py` | LLM screening | Handles text-only title-abstract screening queries. |
| `llm/fulltext.py` | LLM screening | Uploads PDF to Gemini Files API and handles full-text screening queries with cleanup. |
| `llm/extraction.py` | LLM extraction | Executes structured data extraction queries matching custom JSON schemas. |
| `llm/queue_handler.py` | LLM Queue | Asynchronous queue management mechanism feeding paper batches to Gemini client. |
| `llm/database.py` | Database Interop | Interacts with `slr.db` to read configs and write decisions. |
| `llm/budget.py` | Cost Management | Fetches dynamic pricing from Gemini API and verifies budget limits. |
| `llm/test_budget.py` | Testing | Unit test suite validating pricing and budget cutout enforcement logic. |
| `llm/templating.py` | Prompt Management | Hydrates prompt templates using Jinja2 context formatting. |
| `llm/audit.py` | Audit Management | Logs all API interactions, costs, and inputs/outputs to llm_audit_log table. |
| `llm/schema_registry.py` | Schema Registry | Normalizes JSON schemas into uppercase formats accepted by Gemini. |
| `llm/vault.py` | Cryptography | Implements AES-256-GCM + PBKDF2 API key vault encryption/decryption. |
| `python_engine/worker_server.py` | Python Engine | Standalone Flask-based worker script that performs distributed scraping. |
| `python_engine/llm/umbrellanizer.py` | Python Engine | Custom CLI task executor for running the Umbrellanizer taxonomy LLM call. |

### PDF Processing & Validation
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `pdf/analyzer.py` | PDF Processing | Parses PDF binary structure, inspects internal metadata, and verifies file integrity before allowing ingestion. |
| `pdf/compressor.py` | PDF Processing | Wraps Ghostscript execution commands to perform safe, high-quality compression on large academic PDF documents. |
| `pdf/validator.py` | PDF Processing | Validates scientific document validity, enforcing minimum file size (>5KB) and rejecting conference schedules, TOCs, or paywall stubs. |

---

## 6. Frontend Source Code (`slr-ide/src/`)

### Types & Client Libraries (`src/types/` & `src/lib/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `types/index.ts` | TypeScript Definitions| Defines strict TypeScript interfaces for core entities: `Paper`, `Project`, `Config`, `ReviewerDecision`, `LedgerCommit`, and `DuplicatePair`. |
| `lib/db.ts` | Database Client | Exports the singleton `better-sqlite3` database instance, transaction wrappers, PRAGMA enforcements, and configuration helpers. |
| `lib/db/db-init.ts` | Database Client/Init | Isolation layer handling schema DDL execution, database migrations, default lookup table seeding (startup self-healing PDF path migrations and database healing are disabled). |
| `lib/db/migrate-project-ids.ts` | Database Migration | Self-healing migration helper permanently migrating legacy `default-project` records and PDF repository directories across all 11 tables to `proj-global-predictive-dt`. |
| `lib/llm-operations.ts` | Frontend Utility | Singleton queue process manager initiating background subprocess execution and SSE log streams. |
| `lib/vault.ts` | Cryptography | Node.js cryptographic utilities for vault key encryption/decryption matching python formats. |
| `lib/session.ts` | Session Management | In-memory server-side cache for storing master password inside active sessions. |
| `lib/pdf-utils.ts` | Frontend Utility | Contains helper functions for validating PDF paths, checking file accessibility, managing local preview URIs, and project-deletion asset rescue. |
| `lib/slr-compression.ts` | Compression / Utility | Universal GZIP compression and decompression utility supporting Node.js native `zlib` for API routes and Web Streams (`CompressionStream`/`DecompressionStream`) for client-side previews with automatic magic byte detection. |
| `lib/sync-utils.ts` | Synchronization | Implements the Agnostic BroadcastChannel pattern (`broadcastSync`, `subscribeSyncChannel`) for cross-tab synchronization and reactivity. |

### Core Backend Services & Inter-Rater Libraries (`src/lib/services/` & `src/lib/inter-rater/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `lib/services/prompt-validator.ts` | Backend Service | Service encapsulating stage baseline JSON schema validation (`fast_filter`, `gatekeeper`, `scientist`, `miner`, `umbrellanizer`, `duplicate_review`, `consolidation_audit`, `prompt_optimizer`) and default schema template generators. |
| `lib/services/prompt-hydrator.ts` | Backend / Domain Utility | Centralized Prompt Template Hydrator matching Python Jinja2 conventions with case-insensitive aliases and fallback protection. |
| `lib/services/trace-normalizer.ts` | Backend Service | Centralized Trace Normalizer Utility service providing robust logic trace mapping and evidence quote resolution across all RQs. |
| `lib/services/taxonomy-resolver.ts` | Backend / Domain Service | Centralized Taxonomy Resolver service enforcing exact case-insensitive key matching, canonical string/dash normalization, array/string token unwrapping, and stage dominance resolution across all modules. |
| `lib/services/cohort-metrics.ts` | Backend / Domain Service | Centralized Cohort Metrics service providing exact Unique Paper Prevalence calculations, Quota-balanced Tag Share distributions (Hare-Hamilton Largest Remainder Method), and multi-label cohort statistics. |
| `lib/services/goldmine-state-tracker.ts` | Backend Service | Singleton NDJSON state tracker for Gold Mine exports managing execution phase, progress counters, live logs, state restore on reconnect, and process cancellation. |
| `lib/services/process-manager.ts` | Backend Service | Singleton manager for active child process instances, arguments, PIDs, and clean tree termination (`taskkill` / `SIGKILL`). |
| `lib/services/stream-manager.ts` | Backend Service | Encapsulates Server-Sent Events (SSE) stream lifecycles, HTTP keep-alive headers, and periodic heartbeat pings. |
| `lib/services/batch-state-tracker.ts`| Backend Service | Thread-safe memory state manager for batch progress counters, with SQLite `configs` persistence checkpoints for batch resume. |
| `lib/services/batch-pipeline-executor.ts`| Backend Service | Orchestration service for sequential PDF acquisition batches, Ghostscript compression, and cloud synchronizations. |
| `lib/services/backup-service.ts` | Backend Service | Background auto-backup scheduler copying database folder db/* to Rclone remotes by interval or changes. |
| `lib/services/semantic-search-cache.ts` | Backend Service | Lightweight SQLite caching system for turbovec semantic searches, fetching up-to-date metadata dynamically on hits. |
| `lib/services/vector-daemon-manager.ts` | Backend Service | Singleton service orchestrating the lifecycle, crash recovery, and request routing of the persistent Python vector worker daemon. |
| `lib/services/pipeline/subprocess-runner.ts` | Backend Service | Helper service orchestrating python child process execution, NDJSON buffering, and stdout/stderr event forwarding. |
| `lib/services/python-path.ts` | Backend Service | Centralized cross-platform Python executable path and virtual environment detector for Windows, Linux, and macOS. |
| `lib/services/pipeline/rclone-sync.ts` | Backend Service | Helper service constructing cloud sync commands, re-connecting OAuth configs, and updating paper local PDF paths to synced repo path upon link generation. |
| `lib/services/archive-service.ts` | Core Services | Core archiving and restore engine providing `exportProjectArchive`, `createProjectPdfZipBuffer`, `purgeProjectZeroTrace`, and `importProjectArchive`. |
| `lib/services/remote-worker-manager.ts` | Core Services | Singleton service orchestrating worker pools, heartbeats, and reclaims. |
| `lib/services/mockup-generator.ts` | Backend Service | Dedicated service for evaluating calibration papers with Gemini REST API, generating 100% import-compatible blinded `.slr` payloads, and tracking PRISMA-isolated LLM audit interactions. |
| `lib/inter-rater/adjudication-calculations.ts` | Domain Library | Pure TypeScript calculation library for Cohen's Kappa, agreement formulas, and data extraction JSON comparisons (zero Next.js dependencies, standalone SPA ready). |

### State Management Hooks (`src/hooks/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `hooks/useAppSync.ts` | Custom Hook | Manages global `BroadcastChannel` synchronization subscriptions using the Mutable Ref Pattern (`useRef`) to prevent stale closures. |
| `hooks/useIngestion.ts` | Custom Hook | Manages the multi-step CSV ingestion workflow, file parsing buffers, CSV source database selection, dynamic column mapping state, and import transactions. |
| `hooks/usePapers.ts` | Custom Hook | Encapsulates paper database queries, calibration pool filtering, server-side pagination (LIMIT/OFFSET), column sorting, search filtering, and CRUD operations. |
| `hooks/useProjectForm.ts` | Custom Hook | Handles form state, input validation, and submission logic for creating and updating literature review projects. |
| `hooks/useProjects.ts` | Custom Hook | Manages project listing retrieval, active project switching, and cloud provider (Google Drive / OneDrive) configuration state. |
| `hooks/usePipeline.ts` | Custom Hook | Manages sequential PDF acquisition/OCR batch pipeline state, Server-Sent Events logging, and cancel controllers. |
| `hooks/useCalibration.ts` | Custom Hook | Manages consensus screening pre-calibration pools, Kappa metrics calculation, and single-paper crawler executions. |
| `hooks/useManualScreening.ts` | Custom Hook | State and business logic manager for the manual screening pipeline workspace, handling keyword/semantic filtering, single paper PDF acquisition stream handling, and CRUD updates. |
| `hooks/usePromptStaging.ts` | Custom Hook | State management hook orchestrating the 5-card prompt quest-line, consolidation audits, sandbox benchmark test runs, payload preview confirmation, and multi-turn Human-in-the-Loop prompt optimizations with mutable ref guards. |
| `hooks/useRollingBatch.ts` | Custom Hook | State manager handling rolling batch operations, status polling, and reviewer imports. |
| `hooks/useUmbrellanizer.ts` | Custom Hook | Custom React hook state manager handling papers, results, polling jobs and taxonomy executions. |
| `hooks/useRemoteWorkers.ts` | React Hooks | Custom hook to interface with the remote worker API. |
| `hooks/useMockupReview.ts` | Custom Hook | State management hook for multi-pool mockup review generation, handling reviewer ID generation, SSE live progress streaming, caching, redownload, and cache invalidation. |

### UI Components & Features (`src/components/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `components/features/pre-calibration/PromptStagingQuestPanel.tsx` | UI Container | Cyberpunk Quest-Line / Neon Glass HUD container orchestrating the 5-quest progression across Card 1 (Consolidation) and Cards 2–5 (Stage Benchmarks). |
| `components/features/pre-calibration/PromptConsolidationCard.tsx` | Presentation Component | Card 1 component visualizing prompt availability ($N/4$), semantic alignment, inter-stage chainability, and actionable recommendations. |
| `components/features/pre-calibration/StageBenchmarkCard.tsx` | Presentation Component | Cards 2–5 component for isolated stage benchmark execution, PRISMA gate evaluations, holdout metrics, and paper discrepancy inspection via `trace-normalizer`. |
| `components/features/modals/PromptOptimizationDiffModal.tsx` | Modal Component | Diagnostic and prompt optimization modal featuring the Human-in-the-Loop PDF request approval drawer, editable side-by-side diff viewer, and Copy-on-Write template updates. |
| `components/features/modals/LlmPayloadConfirmationModal.tsx` | Modal Component | Transparent Human-in-the-Loop LLM payload confirmation modal displaying exact hydrated prompts, system instructions, generation configs, dataset partitions, and token/cost estimations before execution. |
| `components/Sidebar.tsx` | View Component | Renders the collapsible primary navigation sidebar, theme toggle selectors, and global settings trigger. |
| `components/SettingsModal.tsx` | View Component | Modal interface for configuring global application settings, Rclone paths, Tesseract OCR toggles, and scraper proxy URLs. |
| `components/features/settings/RcloneSettingsTab.tsx` | View Component | Cloud destination configuration panel and remote test buttons. |
| `components/features/settings/ScraperSettingsTab.tsx` | View Component | Stealth browser options, delay controls, headed flags, and Tesseract configurations. |
| `components/InterRaterDashboard.tsx` | View Component | Comprehensive dashboard for adjudicating blinded inter-rater reviews, comparing QA scores, and evaluating data extractions. |
| `components/features/DashboardView.tsx` | View Component | Executive project overview view displaying summary statistics, local PDF acquisition charts, and recent project activity logs. |
| `components/features/DuplicateReviewModal.tsx`| View Component | Human-in-the-loop modal interface for side-by-side comparison, scoring analysis, and adjudication of candidate duplicate pairs. |
| `components/features/GlobalLLMSettingsView.tsx` | View Component | Unified 4-tab LLM dashboard aggregating Vault Settings, Prompt templates + schema editors, Operations controls (with dedicated Default Stage Prompts & Schema Mapper control panel featuring dynamic schema key path dropdowns), and Audit trails. |
| `components/features/GlobalModals.tsx` | View Component | Unified container component wrapping all application modals to prevent inline rendering clutter within the main page structure. |
| `components/features/IngestionHubView.tsx` | View Component | Primary view interface for importing new literature databases, configuring CSV source database origins, reviewing CSV structures, and launching column mapping workflows. |
| `components/features/IngestionPanel.tsx` | View Component | Interactive sub-panel handling file drag-and-drop, initial CSV parsing, and preview rendering during ingestion. |
| `components/features/LLMConfigView.tsx` | View Component | View interface for configuring project-scoped LLM budget spend limits. |
| `components/features/PaperDatabaseView.tsx` | View Component | Central database view for exploring, filtering (including calibration pool assignment), searching, and managing imported literature review paper records, featuring pool badges, bulk override, and pipeline stage operations. |
| `components/features/PipelineExecutionView.tsx`| View Component | Interface for launching, monitoring, and controlling automated PDF acquisition, OCR indexing, and cloud sync batch pipelines. |
| `components/features/PreCalibrationView.tsx` | View Component | View interface for managing pre-calibration workflows, tagging specific screening cohorts, cohort tag filtering, and analyzing screening consistency. |
| `components/features/InsightExportView.tsx` | View Component | View interface hosting granular accounting reports, scientific rigor comparisons, final dataset cohort lists, and FAIR-compliant cloud exporting options. |
| `components/features/insight-export/FinalCohortPanel.tsx` | UI Component | Renders the final cohort papers table with deep metadata, QA, and extraction filters. |
| `components/features/insight-export/ScientificRigorPanel.tsx` | UI Component | Renders the scientific rigor panel with pre-calibration metrics, stage comparisons, and rolling batch validation. |
| `components/features/insight-export/PrismaFlowDiagram.tsx` | UI Component | Canvas-rendered interactive PRISMA 2020 Flow Diagram with PNG download support. |
| `components/features/insight-export/CloudGoldMinePanel.tsx` | UI Component | Restructures and uploads SYNCED cohort PDFs to cloud storage with NotebookLM theme organization, QA threshold filtering, dynamic preview, missing remote warning banner, and live progress streaming. |
| `components/features/manual-screening/ManualScreeningStatsHeader.tsx` | UI Component | Top bar summary calculations showing active manual stages and result metrics with fullscreen controls. |
| `components/features/manual-screening/ManualScreeningList.tsx` | UI Component | Left-hand panel matching list with keyword/semantic search, complete Paper Database filter popover, and sorting drop-downs. |
| `components/features/manual-screening/ManualScreeningDetailView.tsx` | Presentation Component | Right-hand dashboard displaying metadata, top-level tabbed full-text PDF viewer, single-paper cache matcher and scraper with streaming console widget, and manual stage decision editors (QA and variables extraction). |
| `components/features/manual-screening/ManualScreeningView.tsx` | View Component | Main manual screening dashboard container providing fullscreen swap modes. |
| `components/features/ProjectManager.tsx` | View Component | Management interface for creating new literature review projects, defining research questions, and updating project metadata. |
| `components/features/PromptLibraryView.tsx` | View Component | Comprehensive data table interface for versioning, organizing, searching, cloning, and inline previewing reusable system prompt templates, structured JSON extraction schemas, and 1-click stage default prompt assignments. |
| `components/features/modals/ViewEditPaperModal.tsx` | Modal Component| Standalone modal composing view and edit layouts for paper metadata, decisions, and previews. |
| `components/features/modals/paper-details/PaperMetadataView.tsx` | Presentation Component| Read-only details presentation tab inside the paper modal with status and decision displays. |
| `components/features/modals/paper-details/PaperMetadataEdit.tsx` | Presentation Component| Edit details form layout inside the paper modal with status and stage fields. |
| `components/features/modals/paper-details/ParentPaperSelector.tsx` | UI Component | Autocomplete search selector for tracking chained parent paper references. |
| `components/features/modals/paper-details/PdfPreview.tsx` | UI Component | Inline iframe preview panel for reading cached/downloaded paper PDFs. |
| `components/features/modals/paper-details/ScreeningSummaryPanel.tsx` | Presentation Component | Reusable read-only panel displaying AI/Manual stage, decision, rationale, QA, and extraction variables. |
| `components/features/modals/CreateProjectModal.tsx` | Modal Component| Standalone dark glassmorphic modal with real-time auto slug generation, structured protocol sections, and smart defaults for new project scopes. |
| `components/features/modals/ProjectSettingsModal.tsx`| Modal Component| Expanded (max-w-4xl) dark glassmorphic tabbed modal for editing project metadata, calibration rules, Rclone cloud sync, and budget safety. |
| `components/features/modals/settings/ProjectMetadataSettings.tsx` | Presentation Tab | Tabbed settings sub-component with copy query buttons, syntax fonts, and dynamic Jinja2 Umbrellanizer RQ description mapper. |
| `components/features/modals/settings/ProjectCalibrationSettings.tsx` | Presentation Tab | Tabbed settings sub-component with pool switcher tabs, chip badges, EC rules, reasoning templates, fatal-flaw QA rules, and schema-driven Miner JSON extraction key dropdowns with batch populate. |
| `components/features/modals/settings/ProjectSyncSettings.tsx` | Presentation Tab | Tabbed settings sub-component with cloud provider cards, diagnostics connection testing badges, and Rclone setup guide. |
| `components/features/modals/AdjudicationWorkspaceModal.tsx` | Modal Component| Standalone conflict resolution split-pane workspace with integrated PDF viewer, rich metadata, and fallback downloader. |
| `components/features/modals/DeletePaperConfirmModal.tsx` | Modal Component| Standalone modal dialog for confirming permanent deletion of a single paper record (`DELETE /api/papers/[id]`). |
| `components/features/modals/DeleteProjectConfirmModal.tsx`| Modal Component| Standalone modal dialog for confirming deletion of a literature review project configuration (`DELETE /api/projects/[id]`). |
| `components/features/modals/DeleteAllPapersConfirmModal.tsx`| Modal Component| Standalone security dialog verifying active project name before executing bulk wipe of all project papers. |
| `components/features/modals/ArchiveProjectModal.tsx` | Modal Component | Standalone modal for offboarding projects with destination selection (.slr file / Rclone cloud), PDF zip retention toggle, confirmation phrase, and zero-trace DB purge. |
| `components/features/modals/ImportProjectModal.tsx` | Modal Component | Standalone modal for restoring `.slr` project archives with drag-and-drop file inspection, schema preflight verification, and automatic collision resolution. |
| `components/features/modals/CsvReviewModal.tsx` | Modal Component | Standalone modal component for reviewing mapped CSV structures and duplicate exclusions prior to importing. |
| `components/features/modals/PrismaConfigModal.tsx` | Modal Component | Standalone modal component for customizing the PRISMA diagram layout, colors, typography, box styles, and export scale. |
| `components/features/modals/MockupReviewModal.tsx` | Modal Component | Standalone modal component for multi-pool mockup review generation (CTRL+M) with reviewer identity configuration, slot occupancy warnings, live progress ticker, and cached download controls. |
| `components/features/modals/LlmContextBuilderModal.tsx` | UI Component | Interactive modal allowing dynamic selection of extracted data keys, paper metadata fields, cohort scope, baked ground-truth statistics (Hare-Hamilton 100.00% quota balanced), and strict LLM directives to export LLM-friendly JSON payloads for Gemini 3.1 Pro visualization and narration. |
| `components/features/modals/VisualizerModal.tsx` | Modal Facade / Orchestrator | Ultra-clean thin orchestrator (<50 lines) wrapping `VisualizerProvider`, `VisualizerHeader`, and modular step components (`Step1ChartSelector`, `Step2DataMapping`, `Step3StyleCustomization`, `Step4PreviewStage`). |
| `components/features/modals/visualizer/types.ts` | Type Definitions | Domain interfaces for ChartType, LayoutMode, SlotId, SubfigureLabelStyle, SlotConfig, GlobalStyleConfig, ThemePreset, FontFamily, MetricMode, SunburstLevelConfig, VisualizerPresetPayload, and BreakdownRow. |
| `components/features/modals/visualizer/constants/` | Constants | Modular constants for 17 scientific chart definitions (`chartTypes.ts`), multi-block layout definitions (`layoutPresets.ts`), 16 journal palettes (`themePalettes.ts`), typography configs (`fontFamilies.ts`), and defaults (`defaultConfigs.ts`). |
| `components/features/modals/visualizer/constants/layoutPresets.ts` | Constants | Publication layout presets metadata (Single, Dual Side-by-Side, Dual Stacked, 3-Block, Quad 2x2), slot definitions, and subfigure label formatters (`(a)`, `(b)`, `(A)`, `(B)`, `Fig. 1a`). |
| `components/features/modals/visualizer/utils/` | Pure Utilities | Pure mathematical, formatting, and export utilities: Hare-Hamilton 100.00% quota balancer (`quotaBalancer.ts`), hierarchical color shading (`colorUtils.ts`), multi-value & taxonomy extraction (`dataExtractor.ts`), and high-DPI multi-panel composite canvas & SVG rendering (`exportUtils.ts`). |
| `components/features/modals/visualizer/generators/` | Chart Strategy Generators | 7 specialized chart-family strategy modules (categorical bars, hierarchical trees/sunbursts, trend lines, proportions, correlations, matrix heatmaps, KPI & network graphs) and master `buildChartOption()` dispatcher. |
| `components/features/modals/visualizer/hooks/` | Custom Hooks | State management sub-hooks: `useVisualizerLayout`, `useVisualizerConfig`, `useVisualizerData`, `useVisualizerStyle`, `useVisualizerCamera`, `useVisualizerWorkspace`, `useVisualizerPresets`, and `useChartCanvas`. |
| `components/features/modals/visualizer/hooks/useVisualizerLayout.ts` | Custom Hook | Manages active layout mode, active slot focus, and slot list clamping. |
| `components/features/modals/visualizer/hooks/useVisualizerWorkspace.ts` | Custom Hook | Manages fullscreen window sizing, live preview split mode, Zen theater mode, canvas backdrops, subfigure inspection, and keyboard ergonomics. |
| `components/features/modals/visualizer/context/` | React Context | `VisualizerContext` and `VisualizerProvider` unifying all state hooks and chart option generation to eliminate prop drilling. |
| `components/features/modals/visualizer/components/` | Step & Sub-Components | Focused step components (`Step1ChartSelector`, `Step2DataMapping`, `Step3StyleCustomization`, `Step4PreviewStage`, `VisualizerHeader`) and subcomponents (`LayoutTemplateSelector`, `SlotSwitcherBar`, `LiveSplitPreview`, `CustomGroupingManager`, `BreakdownTablePanel`, `SunburstLevelConfigPanel`, `HorizontalBarConfigPanel`, `CameraControlsOverlay`, `ExportPanel`). |
| `components/features/modals/visualizer/components/subcomponents/LayoutTemplateSelector.tsx` | Subcomponent | Visual layout preset selector with interactive wireframe cards for 1x1, 1x2, 2x1, 3-block, and 2x2 grid compositions. |
| `components/features/modals/visualizer/components/subcomponents/SlotSwitcherBar.tsx` | Subcomponent | Tabbed slot switcher for multi-panel workflows featuring active slot badges, subfigure labeling badges, and instant config cloning. |
| `components/features/modals/visualizer/components/subcomponents/LiveSplitPreview.tsx` | Subcomponent | Real-time synchronized side-by-side ECharts preview card for Steps 2 and 3 with active slot badges and auto-resize. |
| `components/features/modals/VectorBuildModal.tsx` | Modal Component | Standalone progress and console log dialog for building and updating vector indices. |
| `components/features/modals/FullscreenAssignModal.tsx` | Modal Component| Standalone fullscreen modal composing pool stats header, paper list, and selection assign details view. |
| `components/features/modals/fullscreen-assign/PoolStatsHeader.tsx` | UI Component | Header statistics and tag breakdown popovers for Pools A, B, and C. |
| `components/features/modals/fullscreen-assign/PaperSelectionList.tsx` | UI Component | Left-hand paper search, pool filtering, and page checklist container. |
| `components/features/remote-workers/WorkerCard.tsx` | Frontend Component | Displays remote worker node status and telemetry. |
| `components/features/remote-workers/RemoteWorkersView.tsx` | Frontend Component | Interactive table/dashboard for managing connected remote workers. |
| `components/features/remote-workers/RemoteWorkerSettingsPanel.tsx` | Frontend Component | Panel for tuning global remote worker execution settings. |
| `components/features/post-validation/PostValidationView.tsx` | View Component | Switcher panel hosting the Umbrellanizer and Rolling Batch engines. |
| `components/features/post-validation/UmbrellanizerView.tsx` | View Component | Main taxonomy normalization view, rendering paper tables and triggering wizards. |
| `components/features/post-validation/QuickOverviewModal.tsx` | UI Component | Modal displaying deduplicated category distributions (Taxonomy Trends Quick Overview) with NOT_STATED support, JSON download, and Print PDF report button. |
| `components/features/post-validation/TaxonomyTrendsPrintDocument.tsx` | UI Component | Dedicated standalone A4 printable document template component for Taxonomy Trends PDF generation with high-contrast progress bars and page-break protection. |
| `components/features/post-validation/UmbrellanizerWizard.tsx` | UI Component | Stepper modal orchestrating prompt variables loading, token dedup lists, LLM runs and mapping results. |
| `components/features/post-validation/TokenOccurrenceTable.tsx` | UI Component | Multi-value list counting unique token occurrences and listing source papers. |
| `components/features/post-validation/RollingBatchView.tsx` | View Component | Core post-validation panel rendering initialization controls, reviewer slots, and discrepancy tables. |
| `components/features/post-validation/BatchStatisticsCards.tsx` | UI Component | Renders Stage 3 and Stage 4 sequential validation metrics and exit statuses. |
| `components/features/post-validation/RollingBatchAdjudicationModal.tsx` | UI Component | Fullscreen workspace modal for resolving conflicts on rolling batch papers. |
| `components/features/post-validation/BatchImportSlot.tsx` | UI Component | Upload card for mapping and parsing completed .slr review files per slot. |

---

### Next.js Application Core (`src/app/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `app/globals.css` | Styling | Defines global CSS rules, Tailwind CSS utility layers, custom font styles, and design system color palette variables. |
| `app/layout.tsx` | Application Layout | Root Next.js layout structure wrapping all pages with standard HTML head elements, font definitions, and global structure. |
| `app/page.tsx` | Application Root | Main Single Page Application (SPA) entrypoint orchestrating active view tabs, sidebar context, and consolidated hook propagation. |

---

### Next.js Backend API Routes (`src/app/api/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `api/adjudicate/route.ts` | REST Endpoint | Handles POST requests to commit calibration adjudication decisions, resolving inter-rater conflicts in `slr.db`. |
| `api/adjudicate/ledger/route.ts` | REST Endpoint | Handles GET requests to retrieve the immutable audit log of all calibration adjudication commits for a project. |
| `api/adjudicate/stats/route.ts` | REST Endpoint | Handles GET requests to calculate inter-rater agreement statistics, Cohen's Kappa, and calibration progress metrics. |
| `api/calibration/assign/route.ts` | REST Endpoint | Calibration pool assignment POST endpoint (handles cloning paper row to/from calibration_papers table). |
| `api/calibration/stage-audit/route.ts` | REST Endpoint | Pre-calibration consolidation audit endpoint testing 4-stage prompt suite against project scope and inter-stage continuity. |
| `api/calibration/benchmark/route.ts` | REST Endpoint | Pre-calibration sandbox benchmark execution endpoint evaluating prompts against adjudicated Pool A/B/C datasets. |
| `api/calibration/prompt-optimize/route.ts` | REST Endpoint | Multi-turn prompt optimization engine supporting failure diagnosis, HITL PDF approvals, and Copy-on-Write template updates. |
| `api/calibration/payload-preview/route.ts` | REST Endpoint | Dry-run prompt payload preview endpoint computing exact hydrated prompts, system rules, model configs, and estimated token/cost metrics. |
| `api/config/route.ts` | REST Endpoint | Handles GET and PUT requests to retrieve and update key-value configuration settings in the SQLite `configs` table. |
| `api/config/backup/route.ts` | REST Endpoint | Handles POST requests to trigger manual database auto-backup to cloud storage remotes using Rclone. |
| `api/config/env/route.ts` | REST Endpoint | Handles GET requests to verify system environment variables and confirm the existence of required external executables (`rclone`, `tesseract`). |
| `api/config/test/route.ts` | REST Endpoint | Handles POST requests to test Rclone cloud storage connectivity (Google Drive / OneDrive) by listing remote root directories. |
| `api/duplicates/route.ts` | REST Endpoint | Handles GET requests to retrieve pending candidate duplicate paper pairs for the active project from `duplicate_pairs`. |
| `api/duplicates/ai-screen/route.ts` | REST Endpoint | Handles POST requests to run automated LLM screening on a duplicate pair, providing technical breakdown differences, verdict, and lineage recommendations. |
| `api/duplicates/resolve/route.ts`| REST Endpoint | Handles POST requests to adjudicate duplicate pairs (`KEEP_BOTH`, `CONFIRMED_DUPLICATE`), executing atomic merge transactions. |
| `api/duplicates/scan/route.ts` | REST Endpoint | Handles POST/GET requests to spawn the Python duplicate detection background process and stream live EventSource progress updates. |
| `api/export/route.ts` | REST Endpoint | Handles POST requests to export filtered paper databases and screening results to downloadable CSV files or Google Sheets. |
| `api/export/fair-data/route.ts` | REST Endpoint | Handles GET requests to generate complete database table JSON dumps for FAIR compliance. |
| `api/export/inter-rater/route.ts`| REST Endpoint | Handles POST requests to generate standalone blinded review export packages (`.slr` schema) for use in the offline `inter-rater` SPA. |
| `api/export/slr-viewer/route.ts` | REST Endpoint | Handles GET requests to generate pre-computed SLR Viewer snapshot dataset files (`.slr-viewer` format). |
| `api/export/csv-tabular/route.ts` | REST Endpoint | Handles GET requests to export the Final Cohort table in FAIR-compliant CSV format with all quality scores, evidence, and extracted variables. |
| `api/export/cloud-gold-mine/route.ts` | REST Endpoint | Handles GET (stream/status), POST (export execution with staging, QA score descending sorting, project rclone remote validation, system rclone executable/config settings, and rclone sync), and DELETE (cancel) for Cloud Gold Mine exports. |
| `api/export/cloud-gold-mine/keys/route.ts` | REST Endpoint | Handles GET requests to dynamically fetch available export grouping keys from both umbrellanizer_results and paper extracted data JSON payloads. |
| `api/export/cloud-gold-mine/preview/route.ts` | REST Endpoint | Handles GET requests to generate real-time dynamic directory structure tree previews with QA score descending sorting, missingRemoteConfig check, and category preview. |
| `api/import/route.ts` | REST Endpoint | Handles POST requests for CSV uploads, executing data parsing, duplicate DOI checks, and batch insertion into `papers`. |
| `api/import/inter-rater/route.ts`| REST Endpoint | Handles POST requests to ingest completed `.slr` review packages from external raters, inserting records into `reviewer_decisions`. |
| `api/insight/accounting/route.ts` | REST Endpoint | Calculates API usage and token cost metrics breakdown per task type for the active project. |
| `api/insight/final-cohort/route.ts` | REST Endpoint | Retrieves resolved final cohort papers matching inclusion criteria for the active project. |
| `api/insight/prisma/route.ts` | REST Endpoint | Calculates and aggregates study counts for the 20 boxes of the PRISMA 2020 flowchart. |
| `api/llm/batch/route.ts` | REST Endpoint | Handles POST requests to launch bulk LLM screening and data extraction batches across project paper pools. |
| `api/llm/batch/status/route.ts` | REST Endpoint | Handles GET requests to stream real-time Server-Sent Events (SSE) detailing progress and token usage of active LLM batches. |
| `api/llm/jobs/route.ts` | REST Endpoint | Handles GET requests to retrieve the execution history and detailed status logs of background LLM screening jobs. |
| `api/llm/jobs/active/route.ts` | REST Endpoint | Handles GET requests to check for any currently active or running LLM screening operations to prevent concurrent collisions. |
| `api/llm/pricing/route.ts` | REST Endpoint | Handles GET requests to supply token cost rates and calculate financial budget estimations for LLM screening jobs. |
| `api/llm/prompts/route.ts` | REST Endpoint | Handles GET, POST, PUT, DELETE requests for managing reusable system prompt templates and JSON extraction schemas. |
| `api/llm/screen/route.ts` | REST Endpoint | Handles POST requests to initiate a single-paper LLM screening or data extraction execution. |
| `api/llm/screen/logs/route.ts` | REST Endpoint | Handles GET requests to retrieve raw prompt payloads, LLM completions, and execution logs for a specific screening job. |
| `api/papers/route.ts` | REST Endpoint | Handles GET requests for querying, filtering, sorting, and server-side paginating paper records from `slr.db`. |
| `api/papers/manual-screening/route.ts` | REST Endpoint | Handles GET requests to filter (with full Paper Database filter parity), sort, search, and paginate manual screening papers workspace list. |
| `api/papers/[id]/route.ts` | REST Endpoint | Handles GET, PUT, DELETE requests for retrieving, updating, or permanently deleting a single paper record by its `Paper_ID`. |
| `api/papers/[id]/screening/route.ts` | REST Endpoint | Handles GET requests to retrieve verified, non-duplicate PRISMA LLM screening stage records for a specific paper. |
| `api/papers/purge-check/route.ts` | REST Endpoint | Handles POST requests to match current project database papers against an incoming CSV list and return candidate papers for deletion. |
| `api/papers/purge/route.ts` | REST Endpoint | Handles POST requests to execute bulk deletion of selected papers, their corresponding duplicate papers, and project-scoped PDF files. |
| `api/pdf/batch/route.ts` | REST Endpoint | Handles POST/GET requests to spawn the unified sequential PDF batch pipeline (Scan, Scrape, Compress, Sync) and stream live NDJSON logs. |
| `api/pdf/batch/cancel/route.ts` | REST Endpoint | Handles POST requests to terminate active PDF batch child process trees (`taskkill` / `SIGKILL`) and set cancellation flags. |
| `api/pdf/batch/resume/route.ts` | REST Endpoint | Handles POST requests to resume an interrupted or paused PDF batch execution pipeline from its last recorded checkpoint. |
| `api/pdf/delete/route.ts` | REST Endpoint | Handles DELETE requests to physically delete PDF files from all cache/repo locations and reset paper local PDF status. |
| `api/pdf/download/route.ts` | REST Endpoint | Handles POST requests to trigger a direct background download of a single paper's PDF via `scrape_pdfs.py`. |
| `api/pdf/scan/route.ts` | REST Endpoint | Handles POST requests to execute a smart cache match scan (`match_cache.py`) for a single paper against local repositories. |
| `api/pdf/serve/route.ts` | REST Endpoint | Securely reads and streams local binary PDFs to the iframe previewer with on-demand self-healing PDF recovery. |
| `api/pdf/single/route.ts` | REST Endpoint | Handles POST requests to execute a complete single-paper PDF acquisition workflow (Scan -> Scrape -> Compress -> Sync). |
| `api/projects/route.ts` | REST Endpoint | Handles GET and POST requests to list all active literature review projects or create new project database records. |
| `api/projects/[id]/route.ts` | REST Endpoint | Handles GET, PUT, DELETE requests to retrieve, update, or permanently wipe a specific project configuration and its associated data. |
| `api/projects/activate/route.ts` | REST Endpoint | Handles POST requests to update the `ACTIVE_PROJECT_ID` value in the SQLite `configs` table, switching the active workspace context. |
| `api/projects/archive/route.ts` | REST Endpoint | Handles GET (download `.slr` JSON archive or `.zip` repository PDFs) and POST (cloud sync via Rclone, zero-trace 15-table database purge, and SQLite VACUUM optimization). |
| `api/projects/import/route.ts` | REST Endpoint | Handles POST requests to reimport `.slr` project archives with dynamic schema adaptation, collision resolution, and atomic transaction rollback. |
| `api/vectors/search/route.ts` | REST Endpoint | Handles POST requests to run semantic searches on paper/PDF cache vector indexes. |
| `api/vectors/status/route.ts` | REST Endpoint | Handles GET requests to check vector database index status parameters and count fields. |
| `api/vectors/build/route.ts` | REST Endpoint | Handles POST requests to spawn the incremental vector index build subprocess and stream progress. |
| `api/vectors/traps/route.ts` | REST Endpoint | Handles POST requests to trigger the semantic near-miss traps finder. |
| `api/remote-worker/claim/route.ts` | Backend API | Endpoint for remote workers to claim batches of missing papers. |
| `api/remote-worker/result/route.ts` | Backend API | Endpoint for remote workers to submit downloaded PDFs and status. |
| `api/remote-worker/download-script/route.ts` | Backend API | Endpoint to serve the standalone Python worker script. |
| `api/remote-worker/settings/route.ts` | Backend API | Endpoint to manage remote worker configuration settings. |
| `api/umbrellanizer/route.ts` | REST Endpoint | Handles GET and POST requests to query results and run the Umbrellanizer process. |
| `api/umbrellanizer/papers/route.ts` | REST Endpoint | Handles GET requests to retrieve Miner-passed papers with stage-aware resolved data. |
| `api/rolling-batch/initialize/route.ts` | REST Endpoint | Handles POST requests to initialize a new rolling validation batch and snapshot papers. |
| `api/rolling-batch/status/route.ts` | REST Endpoint | Handles GET requests to retrieve active batch state, reviewed count, and timeline history. |
| `api/rolling-batch/export/route.ts` | REST Endpoint | Handles GET requests to export active batch papers as a blinded .slr template. |
| `api/rolling-batch/import/route.ts` | REST Endpoint | Handles POST requests to ingest completed reviewer .slr batch files. |
| `api/rolling-batch/adjudicate/route.ts` | REST Endpoint | Handles POST requests to commit consensus resolutions on batch discrepancies. |
| `api/rolling-batch/decisions/route.ts` | REST Endpoint | Handles GET requests to fetch paper details, reviewer inputs, and audit ledger for a batch. |
| `api/rolling-batch/stats/route.ts` | REST Endpoint | Handles GET requests to compute cumulative quality control metrics (Kappa, CI lower bounds, Critical Miss, Semantic Agreement). |
| `api/mockup/generate/route.ts` | REST Endpoint | Handles GET (status/cache download), POST (SSE live streaming mockup evaluation execution), and DELETE (cache invalidation) for PRISMA-isolated blinded .slr mockup reviews. |
