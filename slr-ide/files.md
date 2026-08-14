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
| `lib/sync-utils.ts` | Synchronization | Implements the Agnostic BroadcastChannel pattern (`broadcastSync`, `subscribeSyncChannel`) for cross-tab synchronization and reactivity. |

### Core Backend Services & Inter-Rater Libraries (`src/lib/services/` & `src/lib/inter-rater/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `lib/services/prompt-validator.ts` | Backend Service | Service encapsulating stage baseline JSON schema validation (`fast_filter`, `gatekeeper`, `scientist`, `miner`, `umbrellanizer`) and default schema template generators. |
| `lib/services/trace-normalizer.ts` | Backend Service | Centralized Trace Normalizer Utility service providing robust logic trace mapping and evidence quote resolution across all RQs. |
| `lib/services/goldmine-state-tracker.ts` | Backend Service | Singleton NDJSON state tracker for Gold Mine exports managing execution phase, progress counters, live logs, state restore on reconnect, and process cancellation. |
| `lib/services/process-manager.ts` | Backend Service | Singleton manager for active child process instances, arguments, PIDs, and clean tree termination (`taskkill` / `SIGKILL`). |
| `lib/services/stream-manager.ts` | Backend Service | Encapsulates Server-Sent Events (SSE) stream lifecycles, HTTP keep-alive headers, and periodic heartbeat pings. |
| `lib/services/batch-state-tracker.ts`| Backend Service | Thread-safe memory state manager for batch progress counters, with SQLite `configs` persistence checkpoints for batch resume. |
| `lib/services/batch-pipeline-executor.ts`| Backend Service | Orchestration service for sequential PDF acquisition batches, Ghostscript compression, and cloud synchronizations. |
| `lib/services/backup-service.ts` | Backend Service | Background auto-backup scheduler copying database folder db/* to Rclone remotes by interval or changes. |
| `lib/services/semantic-search-cache.ts` | Backend Service | Lightweight SQLite caching system for turbovec semantic searches, fetching up-to-date metadata dynamically on hits. |
| `lib/services/vector-daemon-manager.ts` | Backend Service | Singleton service orchestrating the lifecycle, crash recovery, and request routing of the persistent Python vector worker daemon. |
| `lib/services/pipeline/subprocess-runner.ts` | Backend Service | Helper service orchestrating python child process execution, NDJSON buffering, and stdout/stderr event forwarding. |
| `lib/services/pipeline/rclone-sync.ts` | Backend Service | Helper service constructing cloud sync commands, re-connecting OAuth configs, and updating paper local PDF paths to synced repo path upon link generation. |
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

### UI Components & Features (`src/components/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
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
| `components/features/PromptLibraryView.tsx` | View Component | Interface for versioning, organizing, and testing reusable system prompt templates and structured JSON extraction schemas. |
| `components/features/modals/ViewEditPaperModal.tsx` | Modal Component| Standalone modal composing view and edit layouts for paper metadata, decisions, and previews. |
| `components/features/modals/paper-details/PaperMetadataView.tsx` | Presentation Component| Read-only details presentation tab inside the paper modal with status and decision displays. |
| `components/features/modals/paper-details/PaperMetadataEdit.tsx` | Presentation Component| Edit details form layout inside the paper modal with status and stage fields. |
| `components/features/modals/paper-details/ParentPaperSelector.tsx` | UI Component | Autocomplete search selector for tracking chained parent paper references. |
| `components/features/modals/paper-details/PdfPreview.tsx` | UI Component | Inline iframe preview panel for reading cached/downloaded paper PDFs. |
| `components/features/modals/paper-details/ScreeningSummaryPanel.tsx` | Presentation Component | Reusable read-only panel displaying AI/Manual stage, decision, rationale, QA, and extraction variables. |
| `components/features/modals/CreateProjectModal.tsx` | Modal Component| Standalone modal form encapsulating states and inputs for creating new systematic literature review projects. |
| `components/features/modals/ProjectSettingsModal.tsx`| Modal Component| Standalone tabbed modal for editing project metadata settings, cloud credentials, LLM configuration, and prompts. |
| `components/features/modals/settings/ProjectMetadataSettings.tsx` | Presentation Tab | Tabbed settings sub-component rendering metadata fields including Scopus and Manual / Google Scholar search query strings. |
| `components/features/modals/settings/ProjectCalibrationSettings.tsx` | Presentation Tab | Tabbed settings sub-component rendering calibration pools, tags, and rules. |
| `components/features/modals/settings/ProjectSyncSettings.tsx` | Presentation Tab | Tabbed settings sub-component rendering Cloud Sync provider and connection test parameters. |
| `components/features/modals/AdjudicationWorkspaceModal.tsx` | Modal Component| Standalone conflict resolution split-pane workspace with integrated PDF viewer, rich metadata, and fallback downloader. |
| `components/features/modals/DeletePaperConfirmModal.tsx` | Modal Component| Standalone modal dialog for confirming permanent deletion of a single paper record (`DELETE /api/papers/[id]`). |
| `components/features/modals/DeleteProjectConfirmModal.tsx`| Modal Component| Standalone modal dialog for confirming deletion of a literature review project configuration (`DELETE /api/projects/[id]`). |
| `components/features/modals/DeleteAllPapersConfirmModal.tsx`| Modal Component| Standalone security dialog verifying active project name before executing bulk wipe of all project papers. |
| `components/features/modals/CsvReviewModal.tsx` | Modal Component | Standalone modal component for reviewing mapped CSV structures and duplicate exclusions prior to importing. |
| `components/features/modals/PrismaConfigModal.tsx` | Modal Component | Standalone modal component for customizing the PRISMA diagram layout, colors, typography, box styles, and export scale. |
| `src/components/features/modals/VisualizerModal.tsx` | Modal Facade / Orchestrator | Ultra-clean thin orchestrator (<50 lines) wrapping `VisualizerProvider`, `VisualizerHeader`, and modular step components (`Step1ChartSelector`, `Step2DataMapping`, `Step3StyleCustomization`, `Step4PreviewStage`). |
| `src/components/features/modals/visualizer/types.ts` | Type Definitions | Domain interfaces for ChartType, LayoutMode, SlotId, SubfigureLabelStyle, SlotConfig, GlobalStyleConfig, ThemePreset, FontFamily, MetricMode, SunburstLevelConfig, VisualizerPresetPayload, and BreakdownRow. |
| `src/components/features/modals/visualizer/constants/` | Constants | Modular constants for 17 scientific chart definitions (`chartTypes.ts`), multi-block layout definitions (`layoutPresets.ts`), 16 journal palettes (`themePalettes.ts`), typography configs (`fontFamilies.ts`), and defaults (`defaultConfigs.ts`). |
| `src/components/features/modals/visualizer/constants/layoutPresets.ts` | Constants | Publication layout presets metadata (Single, Dual Side-by-Side, Dual Stacked, 3-Block, Quad 2x2), slot definitions, and subfigure label formatters (`(a)`, `(b)`, `(A)`, `(B)`, `Fig. 1a`). |
| `src/components/features/modals/visualizer/utils/` | Pure Utilities | Pure mathematical, formatting, and export utilities: Hare-Hamilton 100.00% quota balancer (`quotaBalancer.ts`), hierarchical color shading (`colorUtils.ts`), multi-value & taxonomy extraction (`dataExtractor.ts`), and high-DPI multi-panel composite canvas & SVG rendering (`exportUtils.ts`). |
| `src/components/features/modals/visualizer/generators/` | Chart Strategy Generators | 7 specialized chart-family strategy modules (categorical bars, hierarchical trees/sunbursts, trend lines, proportions, correlations, matrix heatmaps, KPI & network graphs) and master `buildChartOption()` dispatcher. |
| `src/components/features/modals/visualizer/hooks/` | Custom Hooks | State management sub-hooks: `useVisualizerLayout`, `useVisualizerConfig`, `useVisualizerData`, `useVisualizerStyle`, `useVisualizerCamera`, `useVisualizerWorkspace`, `useVisualizerPresets`, and `useChartCanvas`. |
| `src/components/features/modals/visualizer/hooks/useVisualizerLayout.ts` | Custom Hook | Manages active layout mode, active slot focus, and slot list clamping. |
| `src/components/features/modals/visualizer/hooks/useVisualizerWorkspace.ts` | Custom Hook | Manages fullscreen window sizing, live preview split mode, Zen theater mode, canvas backdrops, subfigure inspection, and keyboard ergonomics. |
| `src/components/features/modals/visualizer/context/` | React Context | `VisualizerContext` and `VisualizerProvider` unifying all state hooks and chart option generation to eliminate prop drilling. |
| `src/components/features/modals/visualizer/components/` | Step & Sub-Components | Focused step components (`Step1ChartSelector`, `Step2DataMapping`, `Step3StyleCustomization`, `Step4PreviewStage`, `VisualizerHeader`) and subcomponents (`LayoutTemplateSelector`, `SlotSwitcherBar`, `LiveSplitPreview`, `CustomGroupingManager`, `BreakdownTablePanel`, `SunburstLevelConfigPanel`, `HorizontalBarConfigPanel`, `CameraControlsOverlay`, `ExportPanel`). |
| `src/components/features/modals/visualizer/components/subcomponents/LayoutTemplateSelector.tsx` | Subcomponent | Visual layout preset selector with interactive wireframe cards for 1x1, 1x2, 2x1, 3-block, and 2x2 grid compositions. |
| `src/components/features/modals/visualizer/components/subcomponents/SlotSwitcherBar.tsx` | Subcomponent | Tabbed slot switcher for multi-panel workflows featuring active slot badges, subfigure labeling badges, and instant config cloning. |
| `src/components/features/modals/visualizer/components/subcomponents/LiveSplitPreview.tsx` | Subcomponent | Real-time synchronized side-by-side ECharts preview card for Steps 2 and 3 with active slot badges and auto-resize. |
| `scripts/test-visualizer-anti-regression.mjs` | Test Automation | Standalone anti-regression test suite validating Hare-Hamilton 100.00% quota balance, color shading, taxonomy extraction, and preset serialization. |
| `components/features/modals/VectorBuildModal.tsx` | Modal Component | Standalone progress and console log dialog for building and updating vector indices. |
| `components/features/modals/FullscreenAssignModal.tsx` | Modal Component| Standalone fullscreen modal composing pool stats header, paper list, and selection assign details view. |
| `components/features/modals/fullscreen-assign/PoolStatsHeader.tsx` | UI Component | Header statistics and tag breakdown popovers for Pools A, B, and C. |
| `components/features/modals/fullscreen-assign/PaperSelectionList.tsx` | UI Component | Left-hand paper search, pool filtering, and page checklist container. |
| `components/features/modals/fullscreen-assign/AssignDetailView.tsx` | UI Component | Right-hand paper details panel featuring a multi-tab view (Metadata & Notes vs PDF Viewer), persistent pool assignment header, embedded iframe viewer, and single-paper acquisition console. |
| `components/features/modals/FullscreenInterRaterModal.tsx` | Modal Component| Standalone fullscreen modal wrapping the Inter-Rater Dashboard for blinded review evaluation. |
| `components/features/modals/ProjectLockScreenModal.tsx` | Modal Component| Full-screen dark glassmorphic Lock Screen modal forcing SLR project creation or import when zero active projects exist. |
| `components/features/dashboard/MetricSummaryCards.tsx` | Widget Component| Displays executive metric calculations, total counts, duplicate statistics, and missing PDF percentages in glassmorphic cards. |
| `components/features/dashboard/LocalPDFStatusChart.tsx`| Widget Component| Renders graphical status distribution bars and legends for `AVAILABLE`, `MISSING`, `FAILED`, and `EXCLUDED` local PDFs. |
| `components/features/dashboard/ProjectActivityLog.tsx` | Widget Component| Renders chronological project activity items, status badges, timestamp formatting, and empty-state placeholders. |
| `components/features/dashboard/DashboardQuickActions.tsx`| Widget Component| Houses quick navigation action buttons (Import CSV, Run Batch Pipeline, Review Duplicates, Export Database). |
| `components/features/dashboard/PipelineProgressPanel.tsx` | Widget Component | Reusable dashboard component to display real-time batch pipeline progress, logs, and speed estimations. |
| `components/features/dashboard/MinimizedPipelineBanner.tsx`| Widget Component| Floating banner component displaying real-time progress and active step statistics for minimized batch pipeline executions. |
| `components/features/dashboard/ToastNotifications.tsx` | Widget Component| Fixed floating container component managing and rendering active toast notifications across the application. |
| `components/features/inter-rater/AgreementMetricsPanel.tsx`| View Component | Renders agreement summary meters, Cohen's Kappa interpretation badges (e.g., Substantial, Almost Perfect), and statistical tables. |
| `components/features/inter-rater/ActionControls.tsx` | View Component | Blinded calibration template import, export buttons, and ingest roster list UI. |
| `components/features/inter-rater/DiscrepancyTable.tsx` | View Component | Side-by-side discrepancy matcher table for blinded raters. |
| `components/features/inter-rater/AuditLedger.tsx` | View Component | Git-like audit ledger of calibration adjudication history. |
| `components/features/pre-calibration/PoolMetricsPanel.tsx` | UI Component | Reusable presentation component displaying pool size completion meters for Pools A, B, and C. |
| `components/features/pre-calibration/StageComparisonPanel.tsx` | UI Component | Displays comparison metrics (Recall, Precision, Weighted Kappa, Schema match & Exact string matches) between Gold Standard and AI results across the 4 stages. |
| `components/features/inter-rater/AdjudicationScorecardView.tsx`| View Component | Displays side-by-side rater decision comparison cards, QA score discrepancies, and final adjudication selectors. |
| `components/features/inter-rater/DataExtractionComparisonView.tsx`| View Component | Displays side-by-side JSON schema tree viewers, discrepancy highlighting, and value merge selector controls. |

### Next.js Application Core (`src/app/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `app/globals.css` | Styling | Defines global CSS rules, Tailwind CSS utility layers, custom font styles, and design system color palette variables. |
| `app/layout.tsx` | Application Layout | Root Next.js layout structure wrapping all pages with standard HTML head elements, font definitions, and global structure. |
| `app/page.tsx` | Application Root | Main Single Page Application (SPA) entrypoint orchestrating active view tabs, sidebar context, and consolidated hook propagation. |

### Next.js Backend API Routes (`src/app/api/`)
| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `api/adjudicate/route.ts` | REST Endpoint | Handles POST requests to commit calibration adjudication decisions, resolving inter-rater conflicts in `slr.db`. |
| `api/adjudicate/ledger/route.ts` | REST Endpoint | Handles GET requests to retrieve the immutable audit log of all calibration adjudication commits for a project. |
| `api/adjudicate/stats/route.ts` | REST Endpoint | Handles GET requests to calculate inter-rater agreement statistics, Cohen's Kappa, and calibration progress metrics. |
| `api/calibration/assign/route.ts` | REST Endpoint | Calibration pool assignment POST endpoint (handles cloning paper row to/from calibration_papers table). |
| `api/config/route.ts` | REST Endpoint | Handles GET and PUT requests to retrieve and update key-value configuration settings in the SQLite `configs` table. |
| `api/config/backup/route.ts` | REST Endpoint | Handles POST requests to trigger manual database auto-backup to cloud storage remotes using Rclone. |
| `api/config/env/route.ts` | REST Endpoint | Handles GET requests to verify system environment variables and confirm the existence of required external executables (`rclone`, `tesseract`). |
| `api/config/test/route.ts` | REST Endpoint | Handles POST requests to test Rclone cloud storage connectivity (Google Drive / OneDrive) by listing remote root directories. |
| `api/duplicates/route.ts` | REST Endpoint | Handles GET requests to retrieve pending candidate duplicate paper pairs for the active project from `duplicate_pairs`. |
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
| `api/vectors/search/route.ts` | REST Endpoint | Handles POST requests to run semantic searches on paper/PDF cache vector indexes. |
| `api/vectors/status/route.ts` | REST Endpoint | Handles GET requests to check vector database index status parameters and count fields. |
| `api/vectors/build/route.ts` | REST Endpoint | Handles POST requests to spawn the incremental vector index build subprocess and stream progress. |
| `api/vectors/traps/route.ts` | REST Endpoint | Handles POST requests to trigger the semantic near-miss traps finder. |
| \slr-ide/src/app/api/remote-worker/claim/route.ts\ | Backend API | Endpoint for remote workers to claim batches of missing papers |
| \slr-ide/src/app/api/remote-worker/result/route.ts\ | Backend API | Endpoint for remote workers to submit downloaded PDFs and status |
| \slr-ide/src/app/api/remote-worker/download-script/route.ts\ | Backend API | Endpoint to serve the standalone Python worker script |
| \slr-ide/src/app/api/remote-worker/settings/route.ts\ | Backend API | Endpoint to manage remote worker configuration settings |
| \slr-ide/src/lib/services/remote-worker-manager.ts\ | Core Services | Singleton service orchestrating worker pools, heartbeats, and reclaims |
| \slr-ide/src/hooks/useRemoteWorkers.ts\ | React Hooks | Custom hook to interface with the remote worker API |
| \slr-ide/src/components/features/remote-workers/WorkerCard.tsx\ | Frontend Component | Displays remote worker node status and telemetry |
| \slr-ide/src/components/features/remote-workers/RemoteWorkersView.tsx\ | Frontend Component | Interactive table/dashboard for managing connected remote workers |
| \slr-ide/src/components/features/remote-workers/RemoteWorkerSettingsPanel.tsx\ | Frontend Component | Panel for tuning global remote worker execution settings |
| \slr-ide/python_engine/worker_server.py\ | Python Engine | Standalone Flask-based worker script that performs distributed scraping |
| `python_engine/llm/umbrellanizer.py` | Python Engine | Custom CLI task executor for running the Umbrellanizer taxonomy LLM call |
| `src/app/api/umbrellanizer/route.ts` | REST Endpoint | Handles GET and POST requests to query results and run the Umbrellanizer process |
| `src/app/api/umbrellanizer/papers/route.ts` | REST Endpoint | Handles GET requests to retrieve Miner-passed papers with stage-aware resolved data |
| `src/components/features/PostValidationView.tsx` | View Component | Switcher panel hosting the Umbrellanizer and Rolling Batch engines |
| `src/components/features/post-validation/UmbrellanizerView.tsx` | View Component | Main taxonomy normalization view, rendering paper tables and triggering wizards |
| `src/components/features/post-validation/QuickOverviewModal.tsx` | UI Component | Modal displaying deduplicated category distributions (Taxonomy Trends Quick Overview) with NOT_STATED support, JSON download, and Print PDF report button |
| `src/components/features/post-validation/TaxonomyTrendsPrintDocument.tsx` | UI Component | Dedicated standalone A4 printable document template component for Taxonomy Trends PDF generation with high-contrast progress bars and page-break protection |
| `src/components/features/post-validation/UmbrellanizerWizard.tsx` | UI Component | Stepper modal orchestrating prompt variables loading, token dedup lists, LLM runs and mapping results |
| `src/components/features/post-validation/TokenOccurrenceTable.tsx` | UI Component | Multi-value list counting unique token occurrences and listing source papers |
| `src/hooks/useUmbrellanizer.ts` | Custom Hook | Custom React hook state manager handling papers, results, polling jobs and taxonomy executions |
| `src/app/api/rolling-batch/initialize/route.ts` | REST Endpoint | Handles POST requests to initialize a new rolling validation batch and snapshot papers |
| `src/app/api/rolling-batch/status/route.ts` | REST Endpoint | Handles GET requests to retrieve active batch state, reviewed count, and timeline history |
| `src/app/api/rolling-batch/export/route.ts` | REST Endpoint | Handles GET requests to export active batch papers as a blinded .slr template |
| `src/app/api/rolling-batch/import/route.ts` | REST Endpoint | Handles POST requests to ingest completed reviewer .slr batch files |
| `src/app/api/rolling-batch/adjudicate/route.ts` | REST Endpoint | Handles POST requests to commit consensus resolutions on batch discrepancies |
| `src/app/api/rolling-batch/decisions/route.ts` | REST Endpoint | Handles GET requests to fetch paper details, reviewer inputs, and audit ledger for a batch |
| `src/app/api/rolling-batch/stats/route.ts` | REST Endpoint | Handles GET requests to compute cumulative quality control metrics (Kappa, CI lower bounds, Critical Miss, Semantic Agreement) |
| `src/hooks/useRollingBatch.ts` | Custom Hook | State manager handling rolling batch operations, status polling, and reviewer imports |
| `src/components/features/post-validation/RollingBatchView.tsx` | View Component | Core post-validation panel rendering initialization controls, reviewer slots, and discrepancy tables |
| `src/components/features/post-validation/BatchStatisticsCards.tsx` | UI Component | Renders Stage 3 and Stage 4 sequential validation metrics and exit statuses |
| `src/components/features/post-validation/RollingBatchAdjudicationModal.tsx` | UI Component | Fullscreen workspace modal for resolving conflicts on rolling batch papers |
| `src/components/features/post-validation/BatchImportSlot.tsx` | UI Component | Upload card for mapping and parsing completed .slr review files per slot |
| `src/components/features/modals/LlmContextBuilderModal.tsx` | UI Component | Interactive modal allowing dynamic selection of extracted data keys, paper metadata fields, cohort scope, baked ground-truth statistics (Hare-Hamilton 100.00% quota balanced), and strict LLM directives to export LLM-friendly JSON payloads for Gemini 3.1 Pro visualization and narration |

