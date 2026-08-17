## #421 - Complete LLM API Cost Recording & Unified Accounting Dashboard (2026-08-17)
- **Goal**: Achieve 100% accounting and audit parity across all LLM API interactions in `slr-ide`, ensuring prompt optimizer calls, inter-stage consolidation audits, and benchmark sandbox runs are immutably logged to `llm_audit_log`, dynamically aggregated in the project dashboard and accounting endpoints, and rendered with dedicated cards and comprehensive filter options in the Accounting Panel.
- **Architectural Implementation**:
  1. **Prompt Optimizer Cost Recording (`src/app/api/calibration/prompt-optimize/route.ts`)**:
     - Added token pricing calculation using `llm_pricing` rates, flex/custom discount, and project tax rate.
     - Persisted immutable record into `llm_audit_log` with `task_type = 'prompt_optimizer'`, `cost_usd`, `input_tokens`, `output_tokens`, `model_id`, `prompt_hash`, `raw_prompt`, `raw_response`, and `structured_output`.
     - Atomically updated `projects.project_current_spend`.
  2. **Inter-Stage Consolidation Audit Parity (`src/app/api/calibration/stage-audit/route.ts`)**:
     - Aligned pre-flight budget limit checks to query `(SELECT cost_usd FROM llm_audit_log UNION ALL SELECT cost_usd FROM umbrellanizer_results)`.
     - Logged audit execution directly to `llm_audit_log` with `task_type = 'consolidation_audit'`, `cost_usd`, `model_id`, `input_tokens`, and `output_tokens`.
  3. **Prompt Benchmark Sandbox Runs Parity (`src/app/api/calibration/benchmark/route.ts`)**:
     - Added pre-flight budget limit enforcement before benchmark batch execution.
     - Logged each evaluated paper to `llm_audit_log` with `task_type = 'prompt_benchmark'`, `cost_usd`, `paper_id`, `input_tokens`, and `output_tokens`.
  4. **Accounting Panel Auxiliary Cards & Dynamic Filters (`src/components/features/insight-export/AccountingPanel.tsx`)**:
     - Expanded `STAGE_CONFIGS` with badges and color tokens for `mockup_pool_a`, `mockup_pool_b`, `mockup_pool_c`, `duplicate_review`, `consolidation_audit`, `prompt_benchmark`, and `prompt_optimizer`.
     - Built dynamic **Auxiliary & Calibration Operations** card grid rendering Min, Avg, Max costs and token metrics for any active auxiliary tasks.
     - Enhanced task filter select with dynamic option resolution and explicit entries for all operation types.
- **Verification**: Verified TypeScript compilation with `npx tsc --noEmit` (Exit Code 0); ran `test-mockup-review.mjs` (66/66 passed) and `test-benchmark-improvements.mjs` (passed).

## #420 - In-Memory Test Isolation & Mock Data Database Purge (2026-08-17)
- **Goal**: Resolve test data pollution in `slr.db` (where `MOCK-P1`, `MOCK-P2`, `MOCK-P3` "AI in Systematic Reviews 1/2/3" were persisted into active user projects) by purging lingering mock records from the SQLite database and refactoring `test-mockup-review.mjs` to run in a 100% isolated in-memory SQLite database (`:memory:`).
- **Architectural Implementation**:
  1. **Production Database Purge**:
     - Scanned and deleted test artifacts from `papers`, `calibration_papers`, `reviewer_decisions`, `mockup_cache`, and `llm_audit_log` in `slr.db` matching `MOCK-P*` and `"AI in Systematic Reviews"`. Verified 0 lingering mock records.
  2. **In-Memory SQLite Isolation (`scripts/test-mockup-review.mjs`)**:
     - Refactored `test-mockup-review.mjs` from connecting to `../db/slr.db` to instantiating `new Database(':memory:')`.
     - Added comprehensive in-memory schema DDL initialization (`projects`, `papers`, `calibration_papers`, `mockup_cache`, `llm_audit_log`, `prompt_templates`, `reviewer_decisions`) to ensure full test coverage with zero disk side-effects.
- **Verification**: Executed `node scripts/test-mockup-review.mjs` (all 66 assertions passed with 0 failures); verified `slr.db` contains 0 mock records; `npx tsc --noEmit` exited with 0 errors.

## #419 - Smart Content-Aware Automatic Versioning System (2026-08-17)
- **Goal**: Implement deterministic, content-hash-based smart versioning across all modules (`slr-ide`, `inter-rater`, `slr-viewer`), ensuring that rebuilding on another machine or running `npm run build` without code changes preserves the existing version number, and only increments the patch version when actual source code changes are detected.
- **Architectural Implementation**:
  1. **Source Hash Calculation Engine (`scripts/bump-version.js`)**:
     - Upgraded `bump-version.js` across `slr-ide`, `inter-rater`, and `slr-viewer` to compute a deterministic SHA-256 hash across all active source directories (`src/`, `public/`, `python_engine/`, configs), with recursive directory traversal and fast O(1) exclusion sets (`node_modules`, `.next`, `dist`, `db`, `venv`, `cached_pdf`, `pdf_repo`, `.git`).
  2. **Smart Delta Detection & Hash Persistence**:
     - Compares the calculated source hash against `.last-build-hash`.
     - If no source files were modified, preserves `package.json` version and updates only the compilation timestamp in `index.html`.
     - If source modifications are detected (or when `--force` is supplied), increments the patch version, updates `package.json`, writes the new hash to `.last-build-hash`, and syncs root `index.html` metadata.
- **Verification**: Verified zero version bumps on rebuilds without source changes; verified automatic version increment upon source modifications; `npm run build:all` passed with Exit Code 0 across all 3 modules.

## #418 - File-Based Configuration for Network Interface & Port Listening (2026-08-17)
- **Goal**: Provide unified file-based configuration (`slr-magic.config.json` and `.env` / `.env.local`) allowing users to bind SLR-IDE, Inter-Rater, SLR-Viewer, and Worker Server to all network interfaces (`0.0.0.0`) or custom host/ports, facilitating LAN collaboration and remote worker connectivity.
- **Architectural Implementation**:
  1. **Universal Network Configuration Loader (`src/lib/network-config.ts`)**:
     - Built cross-module configuration loader discovering and parsing `slr-magic.config.json` / `slr.config.json` with fallback to `.env.local`, `.env`, and environment variables (`HOSTNAME`, `PORT`, `SLR_IDE_HOST`, `SLR_IDE_PORT`, `INTER_RATER_HOST`, `INTER_RATER_PORT`, `SLR_VIEWER_HOST`, `SLR_VIEWER_PORT`, `WORKER_SERVER_HOST`, `WORKER_SERVER_PORT`).
     - Integrated Node.js `os.networkInterfaces()` discovery engine in `getLocalNetworkAddresses()` and `getLanUrls()` to dynamically resolve active LAN IPv4 addresses (Wi-Fi, Ethernet, Tailscale).
  2. **Launcher Scripts & Submodule Integration (`scripts/dev.mjs`, `scripts/start.mjs`, `vite.config.js`, `vite.config.ts`, `worker_server.py`)**:
     - Created `scripts/dev.mjs` and `scripts/start.mjs` in `slr-ide` passing `--hostname` and `--port` to Next.js CLI and outputting formatted LAN URLs on startup.
     - Updated `inter-rater/vite.config.js` and `slr-viewer/vite.config.ts` to dynamically resolve `server.host` and `server.port` from `slr-magic.config.json` / `.env`.
     - Updated `worker_server.py` to parse `slr-magic.config.json` and bind Flask worker server to configured `WORKER_HOST` and `WORKER_PORT`.
  3. **Network Information API (`src/app/api/network-info/route.ts`)**:
     - Implemented `GET /api/network-info` returning active binding host, port, listening status (`0.0.0.0` vs `127.0.0.1`), local network interface list, and accessible LAN URLs.
     - Implemented `POST /api/network-info` enabling users to save customized network configuration directly to `slr-magic.config.json`.
  4. **Global Network Settings UI (`src/components/features/settings/NetworkSettingsTab.tsx` & `SettingsModal.tsx`)**:
     - Added dedicated **Network & Interfaces** tab in Global SettingsModal with:
       - Toggle between **All Network Interfaces (`0.0.0.0`)** and **Localhost Only (`127.0.0.1`)**.
       - Interactive LAN URL cards with one-click clipboard copy.
       - Module port allocations grid for SLR-IDE, Inter-Rater, SLR-Viewer, and Worker Server.
       - Live configuration file source inspection and persistence triggers.
  5. **Automated Verification (`scripts/test-network-config.mjs`)**:
     - Created comprehensive test suite verifying template files, JSON configuration parsing, environment variable fallbacks, IPv4 address resolution, launcher scripts, Vite submodule configurations, and Python worker integration.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); all 24 tests in `test-network-config.mjs` passed with 100% success; all existing test suites passed without regression.

## #417 - Benchmark Historical Comparison & Improvement Metrics HUD in StageBenchmarkCard (2026-08-16)
- **Goal**: Enable comparative analysis between the latest sandbox benchmark run and immediately preceding benchmark runs for each pre-calibration quest stage (Pool A Fast Filter, Pool B Gatekeeper, Pool C Scientist, Pool C Miner), displaying comprehensive delta improvement metrics (Accuracy/Schema Integrity, Recall, Precision, F1-Score, Cohen's/Weighted Kappa, and 30% Holdout validation) across the UI.
- **Architectural Implementation**:
  1. **Historical Run Retrieval & Delta Calculation (`src/app/api/calibration/benchmark/route.ts`)**:
     - Updated `GET /api/calibration/benchmark` to query the top 2 completed benchmark runs filtered strictly by `(project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND stage_num = ? AND status = 'COMPLETED' ORDER BY created_at DESC LIMIT 2`.
     - Implemented `calculateImprovementMetrics()` computing exact arithmetic deltas: `accuracy_diff`, `recall_diff`, `precision_diff`, `f1_diff`, `kappa_diff`, `holdout_accuracy_diff`, `holdout_f1_diff`, `has_improved`, `has_regressed`, and `is_unchanged`, retaining `previous_created_at`, `previous_run_id`, and `previous_summary_metrics`.
     - Updated `POST /api/calibration/benchmark` to discover preceding completed runs and return `previous_run` and `improvement_metrics` immediately upon run completion.
  2. **State Management Integration (`src/hooks/usePromptStaging.ts`)**:
     - Defined `BenchmarkImprovementMetrics` interface and updated `BenchmarkRunState` to include `previous_run` and `improvement_metrics`.
     - Updated `fetchStageBenchmark` to hydrate `previous_run` and `improvement_metrics` into React state with mutable ref protection.
  3. **Presentation & HUD Components (`src/components/features/pre-calibration/StageBenchmarkCard.tsx`)**:
     - Added an improvement status pill (`IMPROVED`, `REGRESSED`, or `BASELINE MATCHED`) with `TrendingUp` / `TrendingDown` / `Minus` icons in the quest header.
     - Enhanced all 6 metric cards (Accuracy/Schema Integrity, Recall, Precision, F1-Score, Cohen's/Weighted Kappa, Holdout 30%) with top-right delta badges (`+10.0%`, `+0.053`, etc.) and previous run baseline values (`Prev: 90%`).
     - Added an elegant comparison summary banner displaying the timestamp of the comparison run alongside key deltas.
  4. **Automated Verification (`scripts/test-benchmark-improvements.mjs`)**:
     - Created standalone unit test suite validating Stage 2 & Stage 3 historical delta calculations from real database records, single-run baseline handling, and strict multi-project isolation.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); all 6 test suites (`test-benchmark-improvements.mjs`, `test-mockup-review.mjs`, `test-adjudication-discrepancies.mjs`, `test-quest-pdf-llm-guard.mjs`, `test-prompt-library.mjs`, `test-archive-service.mjs`) passed with 100% success.

## #416 - Fix Empty QA Values on Pool C Mockup Review .slr Import via Centralized Trace Normalizer (2026-08-16)
- **Goal**: Fix critical bug where importing blinded `.slr` review files for Pool C (Scientist QA & Miner Extraction) generated by the Multi-Pool Mockup Review modal resulted in completely empty/null QA score values in `reviewer_decisions` and `calibration_papers`.
- **Root Causes**:
  1. **Strict Key Lookup Discrepancy**: The Stage 3 Scientist prompt template schema (`DEFAULT_STAGE_SCHEMAS.scientist`) returns QA objects keyed by descriptive snake_case names (`qa1_aims`, `qa2_hardware`, `qa3_validation`, etc.), whereas project QA rules (`project.pool_c_qa_rules`) store rule identifiers as alphanumeric codes (`QA-1`, `QA-2`, etc.). Direct dictionary lookup `rawQAScores[code]` returned `undefined`, causing all rules to default to `{ value: null, evidence: "" }`.
  2. **Evidence Property Name Mismatch**: The LLM schema returns textual quotes under `exact_quote`, whereas the normalizer only checked `evidence` or `rationale`.
  3. **Rule Configuration Fallbacks**: The generator and import endpoints lacked fallbacks to `project.qa_rules` / `project.extraction_rules` and `.slr` metadata when `pool_c_*` fields were unpopulated.
  4. **Adjudication Engine Key & Conflict Checks**: Fatal flaw detection in `calculatePoolCDecision` used strict case equality failing on hyphenated/snake_case keys, and the two-reviewer consensus check compared QA object references with `!==`, causing false conflicts on import.
- **Architectural Implementation**:
  1. **Centralized Trace Normalizer (`src/lib/services/trace-normalizer.ts`)**:
     - In strict compliance with `agents.md` Section 3.9 ("Zero Islanded Lookups Policy"), extended `trace-normalizer.ts` with centralized utilities:
       - `normalizeQaKey(key)`: Strips non-alphanumeric characters for canonical matching (`QA-1`, `qa1_aims` -> `qa1`).
       - `matchQaRuleKey(ruleCode, candidateKeys, ruleIndex)`: Exhaustive matching between rule codes and LLM prompt output keys with index fallback.
       - `matchExtractionKey(jsonKey, candidateKeys, ruleIndex)`: Exhaustive matching for extraction fields.
       - `extractScoreValue(item)`: Robust numerical parser handling object structures (`score`, `value`, `val`, `numeric_score`) and primitive numbers.
       - `extractEvidenceQuote(key, valObj)`: Unified evidence quote extractor supporting `exact_quote`, `evidence`, `quote`, `text`, `rationale`, and `reasoning`.
  2. **Mockup Generator Service (`src/lib/services/mockup-generator.ts`)**:
     - Updated `evaluateMockupPaperPoolC` to utilize `matchQaRuleKey`, `matchExtractionKey`, `extractScoreValue`, and `extractEvidenceQuote`.
     - Integrated `calculatePoolCDecision` so Pool C mockup results accurately calculate `decision` (Include/Exclude), `exclusion_code`, and `rationale` during SSE streaming and caching.
     - Added rule fallbacks to `project.qa_rules` / `project.extraction_rules` in both `evaluateMockupPaperPoolC` and `buildMockupSlrFile`.
  3. **Adjudication Engine (`src/lib/inter-rater/adjudication-calculations.ts`)**:
     - Updated `calculatePoolCDecision` to use normalized alphanumeric key matching when identifying fatal flaw rules and extracting failed codes (`cleanCode === cleanK || cleanK.startsWith(cleanCode) || cleanCode.startsWith(cleanK)`).
  4. **Inter-Rater Import Route (`src/app/api/import/inter-rater/route.ts`)**:
     - Added rule fallbacks to `project.qa_rules` / `project.extraction_rules` and `body.metadata?.qa_rules` / `body.metadata?.extraction_rules`.
     - Added flexible payload reading accepting `paper.Human_QA_Scores || paper.Reviewer_QA_Scores || paper.qa_scores`.
     - Replaced object reference identity check with value-based numeric score and text comparison for two-reviewer consensus.
  5. **Automated Verification (`scripts/test-mockup-review.mjs`)**:
     - Added comprehensive unit tests covering Pool C QA score normalization from Scientist output, `.slr` binary compression/decompression fidelity, database import into `reviewer_decisions` and `calibration_papers`, and fatal flaw calculation.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); all 66 tests in `test-mockup-review.mjs` passed; all existing test suites (`test-adjudication-discrepancies.mjs`, `test-prompt-library.mjs`, `test-visualizer-anti-regression.mjs`, `test-llm-screening-records.mjs`, `test-archive-service.mjs`) passed with 100% success.

## #415 - Multi-Pool Mockup Review Generator Prompt Essential Configuration HUD (2026-08-16)
- **Goal**: Allow users in the Multi-Pool Mockup Review Generator (CTRL+M) to see the real-time prompt essential configuration (model type, temperature, thinking budget, max tokens, execution mode, delay, strict response schema, and prompt preview) applied during mockup generation across Pool A (Fast Filter), Pool B (Gatekeeper), and Pool C (Scientist QA & Miner Extraction).
- **Architectural Implementation**:
  1. **Prompt Configuration Resolution (`src/lib/services/mockup-generator.ts` & `src/app/api/mockup/generate/route.ts`)**:
     - Defined `MockupPromptConfig` interface and implemented `getMockupPromptConfigs(projectId, pool)` resolving active prompt templates (project default or global active fallback) and extracting essential LLM parameters (`model_id`, `clean_model_name`, `temperature`, `max_tokens`, `top_p`, `top_k`, `thinking_level`, `thinking_budget`, `execution_mode`, `request_delay`, `request_delay_ms`, `timeout_seconds`, `response_schema_name`, `interaction_chaining`, `system_instruction`, and `user_template`).
     - Standardized `request_delay` normalization: Prompt Library stores delay in seconds (e.g. `20s`, `1.0s`, `0.3s`); resolved `request_delay` in seconds and `request_delay_ms = Math.round(request_delay * 1000)` (e.g. `20,000ms`, `300ms`) eliminating threshold heuristics that previously misread `20` as 20ms.
     - Updated `GET /api/mockup/generate` to return `prompt_configs: MockupPromptConfig[]` for the active calibration pool.
  2. **Official Google Gemini Thinking Specifications & Resolution (`src/lib/gemini-thinking-specs.ts`)**:
     - Built centralized reference module `GEMINI_MODEL_THINKING_SPECS` encoding official Google Gemini thinking capabilities across all 11 models:
       - `gemini-3.7-flash` (Default: `medium`, Levels: `low`, `medium`, `high`)
       - `gemini-3.6-flash` (Default: `medium`, Levels: `minimal`, `low`, `medium`, `high`)
       - `gemini-3.5-flash-lite` (Default: `minimal`, Levels: `minimal`, `low`, `medium`, `high`)
       - `gemini-3.1-pro-preview` (Default: `high`, Levels: `low`, `medium`, `high`)
       - `gemini-3.1-flash-lite-image` (Default: `minimal`, Levels: `minimal`, `high`)
       - `gemini-3-flash-preview` (Default: `high`, Levels: `minimal`, `low`, `medium`, `high`)
       - `gemini-3-pro-preview` (Default: `high`, Levels: `low`, `high`)
       - `gemini-3.5-flash` (Default: `medium`, Levels: `minimal`, `low`, `medium`, `high`)
       - `gemini-2.5-pro` (Default: `on`, Levels: `low`, `medium`, `high`)
       - `gemini-2.5-flash` (Default: `on`, Levels: `low`, `medium`, `high`)
       - `gemini-2.5-flash-lite` (Default: `off`, Levels: `low`, `medium`, `high`)
     - Implemented `resolveGeminiThinkingConfig(modelId, thinkingLevel)` ensuring requests send qualitative `thinkingLevel: "low" | "medium" | "high" | "minimal"` (or `{ thinkingBudget: 0 }` for disabled/off) and **never** send synthetic numerical budgets like `8192t`.
     - Standardized thinking resolution across `mockup-generator.ts`, `benchmark/route.ts`, `stage-audit/route.ts`, `prompt-optimize/route.ts`, and `duplicates/ai-screen/route.ts`.
  3. **State Management Integration (`src/hooks/useMockupReview.ts`)**:
     - Updated `MockupCacheInfo` to include `prompt_configs?: MockupPromptConfig[]`, re-hydrating prompt configurations dynamically upon pool tab switching or initial load.
  4. **Prompt & Model Configuration HUD (`src/components/features/modals/MockupReviewModal.tsx`)**:
     - Added an active model indicator pill (`⚡ gemini-2.5-flash`) in the modal title bar and on target calibration pool tabs.
     - Built a responsive **Active Prompt & Model Configuration** card featuring:
       - 4-card essential parameter metrics grid: Model Type, Temperature & Thinking (renders clean qualitative level `T: 1 | high` without numerical tokens), Max Output Tokens, and Mode & Delay (`flex | 20s`).
       - Multi-stage sub-tab switcher for Pool C to toggle between Stage 3 (Scientist QA) and Stage 4 (Miner Extraction) configurations.
       - Expandable parameter drawer showing Template scope (Project Custom vs System Default), Timeout, Top-P/Top-K, Strict JSON Schema name, and Miner Interaction Chaining status.
       - Expandable preview drawers for raw System Instructions and User Template seeds with single-click Copy-to-Clipboard buttons.
       - Added Model Used chip to the Cached Review metrics overview grid.
  5. **Automated Verification (`scripts/test-mockup-review.mjs`)**:
     - Expanded test suite with comprehensive tests verifying prompt configuration extraction, model ID resolution, token limit extraction, delay conversion, and official Gemini thinking specification resolution.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); all test suites passed (`test-mockup-review.mjs` [51/51], `test-prompt-library.mjs` [9/9], `test-quest-pdf-llm-guard.mjs` [5/5]).

## #414 - Quest 03, 04, 05 Mandatory PDF File Presence Guard & 100% Prompt Library LLM Parameter Enforcement (2026-08-16)
- **Goal**: Resolve two critical bugs in the Interactive Staging & Benchmark Optimization HUD: (1) Prevent Quest 03 (Gatekeeper - Pool B), Quest 04 (Scientist - Pool C), and Quest 05 (Miner - Pool C) from running if any paper in the target calibration pool has a missing or unset local PDF file on disk, and (2) Ensure every LLM execution across calibration, benchmarking, audit, prompt optimization, and queue screening 100% strictly extracts and applies all parameters configured in the selected Prompt Library template.
- **Architectural Implementation**:
  1. **Stage-Specific PDF Presence Guard (`/api/calibration/benchmark` & `/api/calibration/payload-preview`)**:
     - In `GET /api/calibration/benchmark`: Queries target pool papers (`poolPapers`) against the latest adjudication ledger, checks physical file existence on disk (`fs.existsSync(resolvedPath)`), and computes `pool_papers_count`, `missing_pdf_count`, and `missing_pdf_papers`.
     - In `POST /api/calibration/benchmark`: For `stageNum >= 2` (Quests 03, 04, 05), strictly validates that 100% of the papers in `papersWithGold` possess valid, existing local PDF files on disk (`Local_PDF_Status !== 'MISSING' && Local_PDF_Status !== 'FAILED'`). If any paper is missing a PDF, immediately rejects with HTTP 400 Bad Request detailing missing paper IDs and titles.
     - In `POST /api/calibration/payload-preview`: Enforces identical PDF presence preflight validation for `stage_benchmark` when `stageNum >= 2`, blocking preview and execution if any pool papers lack PDFs.
     - In `benchmark/route.ts` `evaluatePaper`: For full-text stages (`stageNum >= 2`), reads local PDF files on disk (`<= 19.5MB`) and attaches `{ inlineData: { mimeType: 'application/pdf', data: base64Pdf } }` to the Gemini API `contents.parts` payload for genuine full-text screening, appraisal, and extraction.
  2. **100% Prompt Library LLM Parameter Synchronization**:
     - Standardized parameter extraction across `benchmark/route.ts`, `stage-audit/route.ts`, `prompt-optimize/route.ts`, `payload-preview/route.ts`, and `python_engine/llm/main.py`:
       - `model_id`: Strips `'models/'` prefix for clean REST endpoint routing.
       - `temperature`: Passes exact float value (`typeof temperature === 'number' ? temperature : 0.0`).
       - `max_tokens` / `max_output_tokens`: Supports both aliases with graceful fallback (`config.max_tokens ?? config.max_output_tokens ?? default`).
       - `top_p` & `top_k`: Strictly passes numeric values to `generationConfig.topP` / `generationConfig.topK` without dropping defined options.
       - `thinking_level` & `thinking_budget`: Maps levels (`minimal`=1024, `low`=2048, `medium`=4096, `high`=8192) and explicitly sets `{ thinkingBudget: 0 }` for `none` or `off` so thinking tokens are disabled for reasoning models.
       - `timeout_seconds`: Connects `AbortController` signal timeout (`timeoutSeconds * 1000`) and Python `HttpOptions` timeout.
       - `concurrency` & `request_delay`: Dynamically configures batch concurrency and inter-request delay.
       - `execution_mode` / `speed_mode`: Applies `FLEX` vs `STANDARD` discount rates to token cost computations.
  3. **UI HUD Feedback & Interaction Locks (`StageBenchmarkCard.tsx` & `usePromptStaging.ts`)**:
     - Updated `BenchmarkRunState` to track `pool_papers_count`, `missing_pdf_count`, and `missing_pdf_papers`.
     - In `StageBenchmarkCard.tsx`: When `stageNum >= 2` and `missing_pdf_count > 0`, displays an amber warning badge (`PDF Missing (N)`), a detailed alert callout explaining that Quest 03/04/05 requires 100% PDF coverage, and disables the "Run Benchmark" button (`PDF Required (N Missing)`).
     - In `usePromptStaging.ts`: Added proactive PDF preflight guards in `openBenchmarkConfirmation` and `runStageBenchmark` to block opening modals or triggering runs if PDFs are missing for Quests 03, 04, or 05.
  4. **Automated Verification (`scripts/test-quest-pdf-llm-guard.mjs`)**:
     - Built automated unit test suite verifying: (1) Pool paper counts and disk PDF existence validation, (2) Quest 03, 04, 05 execution rejection when PDFs are missing, (3) Quest 02 (Stage 1) execution allowance without PDFs, (4) 100% Prompt Library LLM parameter parsing and synchronization.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); all test suites passed (`test-quest-pdf-llm-guard.mjs` [5/5], `test-prompt-library.mjs` [9/9]).

## #413 - Blinded Review & Adjudication Results Panel with Multi-Pool Statistics & SLR-Viewer Parity (2026-08-16)
- **Goal**: Add a comprehensive 3-card panel section to display the results of double-blind review agreement and discrepancy adjudication across all pre-calibration pools (Pool A: Fast Filter, Pool B: Gatekeeper, Pool C: Scientist & Miner) complete with rich hover tooltips, and copy-paste this section into the Scientific Rigor panel under Pre-Calibration Filling Status in both `slr-ide` and the standalone submodule `slr-viewer`, including `.slr-viewer` snapshot export/import parity.
- **Architectural Implementation**:
  1. **Multi-Pool Statistics Endpoint (`slr-ide/src/app/api/adjudicate/stats/route.ts`)**:
     - Added `mode=all_pools` and `mode=blinded_adjudication` computing agreement metrics and discrepancy resolution progress across Pool A, Pool B, and Pool C in a unified payload `{ pools: { pool_a, pool_b, pool_c }, poolList: [...] }`.
     - Modularized pure calculation routines `computePoolABStats()` and `computePoolCStats()` with strict type-agnostic project matching `(project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))`.
  2. **Blinded Adjudication Panel (`slr-ide/src/components/features/pre-calibration/BlindedAdjudicationPanel.tsx`)**:
     - Built a 3-card grid component rendering Pool A (Cohen's $\kappa$, $P_o$, $P_e$), Pool B (Cohen's $\kappa$, $P_o$, Alpha/Beta Precision), and Pool C (Weighted $\kappa_w$, Dual-Gate Cutoff concordance, Miner Schema Match % & Missing Keys %).
     - Included status badges (`CALIBRATED`, `PENDING ARBITRATION`, `AWAITING 2ND REVIEWER`), paired intersection counts, decision concordance mini-grids (Agreed INC, Agreed EXC, Conflicts), and adjudication progress bars ($N/M$ resolved) with educational hover tooltips for all metrics.
  3. **State Integration & Synchronization (`slr-ide/src/hooks/useCalibration.ts` & `PreCalibrationView.tsx`)**:
     - Added `blindedStats`, `blindedStatsLoading`, and `loadBlindedStats()` to `useCalibration.ts`.
     - Integrated `BlindedAdjudicationPanel` into `PreCalibrationView.tsx` directly above "Gold Standard vs AI Stage Comparisons".
     - Connected cross-tab synchronization listeners (`SYNC_ADJUDICATION`, `SYNC_PAPERS`, `SYNC_PROJECTS`) to keep the panel up to date.
  4. **Scientific Rigor & Submodule Parity (`ScientificRigorPanel.tsx` in `slr-ide` & `slr-viewer`)**:
     - Embedded `BlindedAdjudicationPanel` into `ScientificRigorPanel.tsx` in `slr-ide` right under "Pre-Calibration Filling Status".
     - Updated `export/slr-viewer/route.ts` to compute and embed `blinded_adjudication_stats` inside the `scientific_rigor` object of exported `.slr-viewer` snapshot archives.
     - Updated `slr-viewer/src/utils/schemaValidator.ts` to sanitize and preserve `blinded_adjudication_stats`.
     - Mirrored `BlindedAdjudicationPanel.tsx` to `slr-viewer/src/components/scientific-rigor/` via `scripts/mirror-to-viewer.mjs`.
     - Updated `slr-viewer/src/components/scientific-rigor/ScientificRigorPanel.tsx` to render `BlindedAdjudicationPanel` from imported `.slr-viewer` snapshots.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit` in both `slr-ide` and `slr-viewer`); successful production bundle build in `slr-viewer` (`npm run build`).

## #412 - Fix False 'Resolved' State for Unadjudicated Calibration Discrepancies (2026-08-16)
- **Goal**: Fix the bug in the Inter-Rater Dashboard where unadjudicated calibration discrepancies (e.g., in Pool B, Pool A, or Pool C) incorrectly displayed `Action: Resolved` with a green checkmark before the reviewer conducted manual adjudication.
- **Root Cause Analysis**:
  - In `src/app/api/adjudicate/stats/route.ts`, the SQL query previously identified resolved papers using `WHERE ... AND (adjudicator NOT LIKE 'IMPORT:%' OR commit_message LIKE '%Adjudicat%' OR commit_message LIKE '%Resolve%')`.
  - When blinded review `.slr` files were imported via `/api/import/inter-rater`, audit ledger entries were automatically generated with `commit_message = 'Auto-adjudication status on import from ' + reviewerName`.
  - Because `commit_message` contained the substring `'adjudicat'`, the `OR commit_message LIKE '%Adjudicat%'` condition evaluated to `TRUE` for all imported papers, causing every discrepancy to be falsely categorized as resolved before any human adjudication took place.
- **Architectural Implementation**:
  1. **Authoritative Latest Non-Import Commit Resolution (`src/app/api/adjudicate/stats/route.ts`)**:
     - Refactored `resolvedPaperIds` across Pool A, Pool B, and Pool C to join `calibration_commit_ledger` against each paper's latest commit ID (`MAX(id)` per paper in that project and pool) and enforce `l.adjudicator NOT LIKE 'IMPORT:%'`.
     - Ensures that a discrepancy is marked `is_resolved: true` if and only if the most recent committed state on the ledger is an explicit human adjudication (`ADJUDICATOR`), reverting cleanly to `is_resolved: false` if a subsequent reviewer `.slr` re-upload occurs.
     - Hoisted `resolvedPaperIds` out of the inner loop in Pool C for O(1) set lookup performance.
  2. **Multi-Project Isolation & Explicit Parameter Precedence (`agents.md` §3.8)**:
     - Upgraded `GET /api/adjudicate/stats` to prioritize explicit `projectId` parameter from `searchParams` with fallback to `getConfig('ACTIVE_PROJECT_ID')`.
     - Standardized project ID lookups with type-agnostic `(id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))` and `(project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))`.
  3. **Automated Verification (`scripts/test-adjudication-discrepancies.mjs`)**:
     - Created standalone automated test suite verifying pre-adjudication false states, post-adjudication resolution transitions, re-import reversion guards, and project isolation.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); 100% pass across test suites (`test-adjudication-discrepancies.mjs` [4/4], `test-mockup-review.mjs` [37/37], `test-prompt-library.mjs` [9/9], `test-visualizer-anti-regression.mjs` [15/15], `test-llm-screening-records.mjs` [7/7], `test-archive-service.mjs` [2/2]).

## #411 - Manual Paper Selection for Multi-Pool Mockup Review Targeted Rerun & Reviewer Identifier Redownload (2026-08-16)
- **Goal**: Allow users to manually select one or more papers within the Multi-Pool Mockup Review Generator modal (`MockupReviewModal`, CTRL+M) in `slr-ide` and execute targeted reruns on the selected subset, preserving all previously evaluated results for unselected papers, reducing unnecessary LLM API costs, and automatically merging and rebuilding the downloadable `.slr` file; and ensure that redownloading cached reviews strictly applies the active "Reviewer Identifier" across file metadata, database cache, and downloaded filenames.
- **Architectural Implementation**:
  1. **Reactive State & Selection Hooks (`useMockupReview.ts`)**:
     - Added `selectedPaperIds` state and comprehensive helper methods: `togglePaperSelection(paperId)`, `selectAllPapers()`, `deselectAllPapers()`, `selectFailedPapers()`, `selectSucceededPapers()`, `isPaperSelected(paperId)`, and `handleRerunSelected(targetIds?)`.
     - Automatically resets `selectedPaperIds` upon pool switching (`handlePoolChange`) and accurately computes initial baseline costs/tokens for selective execution.
     - Upgraded `handleRedownload` to pass the active `reviewerName` via query parameters (`&reviewerName=...`) and re-hydrate cache data if the identifier was modified.
  2. **Multi-View Interactive UI & Selection Controls (`MockupReviewModal.tsx`)**:
     - Added row-level checkboxes to each record in both the **Evaluation Stream Log** and the **Target Pool Calibration Papers** preview accordion, synchronizing selections seamlessly across views.
     - Added a top **Quick Selection Toolbar** featuring master select/deselect toggles, 1-click filter chips (*All*, *Select Failed*, *Select Succeeded*, *Clear*), and a live selection counter.
     - Added a dedicated **Targeted Paper Selection Active HUD Banner** displaying estimated paper savings and quick-action rerun buttons.
     - Implemented scoped PDF verification for Pool B and Pool C: execution is validated strictly against the *selected* rerun subset, allowing users to rerun PDF-ready papers even if other unselected papers lack local PDFs.
     - Upgraded the modal footer action bar with a prominent, high-visibility **"Rerun Selected (N)"** button when papers are active, and preserved **"Redownload (.slr)"** availability during selection.
  3. **Type-Safe API Subset Resolution & Reviewer Identifier Redownload Synchronization (`/api/mockup/generate/route.ts`)**:
     - Hardened `paperIds` array resolution using `Set` string lookups (`const idSet = new Set(paperIds.map(String))`) preventing string/number casting discrepancies.
     - In `GET /api/mockup/generate` when `download=true`, dynamically applies the requested `reviewerName` parameter: decompresses the cached `.slr` blob, updates `metadata.reviewer_name`, re-compresses with maximum level 9 compression, updates `mockup_cache` in SQLite, and serves the `.slr` attachment with the customized filename (`${project}_${pool}_mockup_${reviewerName}.slr`).
  4. **Automated Verification (`test-mockup-review.mjs`)**:
     - Added automated unit tests covering manual paper selection subset filtering, selective cache merging, cumulative cost/token recalculation, scoped PDF preflight checks, and Reviewer Identifier redownload payload & filename updates (37/37 tests passing).
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); 100% pass across all test suites (`test-mockup-review.mjs` [37/37], `test-prompt-library.mjs` [9/9], `test-visualizer-anti-regression.mjs` [15/15], `test-llm-screening-records.mjs` [7/7], `test-archive-service.mjs` [2/2]).

## #410 - Fix Paper Details & Pre-Calibration Papers PDF Acquisition Persistence Bug (2026-08-16)
- **Goal**: Fix the bug in SLR-IDE where acquiring a PDF inside the Paper Details modal (`ViewEditPaperModal`) or pre-calibration workspace displayed `Local_PDF_Status: 'MISSING'` in the Pre-Calibration Papers table upon closing/reopening the modal or refreshing datasets.
- **Architectural Implementation**:
  1. **SQLite Triggers & Cross-Table Synchronization (`db-init.ts`)**:
     - Added bidirectional SQLite triggers (`trg_papers_pdf_sync_cal`, `trg_cal_papers_pdf_sync`, and `trg_papers_metadata_sync_cal`) keeping `Local_PDF_Status`, `Local_PDF_Path`, and metadata 100% in lockstep between `papers` and `calibration_papers`.
     - Added on-startup self-healing routine `syncExistingPdfStatusesAndDisks(db)` that repairs divergent PDF statuses between tables and scans `pdf_library/raw` on disk to heal status from `MISSING`/`IGNORED`/`FAILED` to `MATCHED`.
  2. **Papers & Calibration API Query Hardening (`/api/papers/route.ts`, `/api/papers/[id]/route.ts`, `/api/pdf/single/route.ts`)**:
     - Upgraded `GET /api/papers` when querying `calibration_papers` to `COALESCE` `Local_PDF_Status` and `Local_PDF_Path` from the main `papers` table, guaranteeing that calibration views always reflect live PDF availability.
     - Added real-time on-demand disk self-healing in `/api/papers/route.ts`, `/api/papers/[id]/route.ts`, and `/api/pdf/single/route.ts` across both `papers` and `calibration_papers`.
     - Implemented **Safe Project ID Discovery Fallback** in accordance with `agents.md` Section 3.8: if a paper is not found under the active project config, discover the record by `Paper_ID` directly.
  3. **Authoritative On-Open Rehydration in `ViewEditPaperModal.tsx`**:
     - Added an authoritative on-open server re-fetch effect: when `paperModal.isOpen` becomes true or `paperModal.paper.Paper_ID` changes, fetch `/api/papers/${encodeURIComponent(paperId)}?projectId=${projId}` to hydrate the modal with the freshest database state.
     - In `onComplete` and multi-tab `BroadcastChannel` listener, passed explicit `projectId` and updated `paperModal.paper` and `editPdfStatus`.
     - In `handleSavePaper`, passed explicit `projectId` in body and URL query params.
  4. **Calibration Hook Parameter Binding (`useCalibration.ts`, `PreCalibrationView.tsx`)**:
     - Bound `projectId: activeProjectId` into `loadCalPapers` and `loadAssignPapers` query parameters and semantic search payload.
     - In `PreCalibrationView.tsx`, rendered status with fallback `p.Local_PDF_Status || 'MISSING'`.
- **Verification**: TypeScript compilation check passed (`npx tsc --noEmit` exited with code 0).

## #409 - Iterative Fullstack Deep Code Audit & Complete Rule Hardening (2026-08-16)
- **Goal**: Perform an exhaustive, iterative deep code analysis across the entire fullstack codebase (React hooks, Next.js API routes, Python CGI engines, and directory indices) to identify and eradicate all remaining edge-case bugs, missing parameters, and untracked files against all directives in `agents.md`.
- **Architectural Implementation**:
  1. **Calibration & Assignment Pipeline Parameter Hardening (`useCalibration.ts`, `page.tsx`)**:
     - Added `activeProjectId` prop to `UseCalibrationProps` and passed it from `page.tsx`.
     - Explicitly bound `projectId: assignSelectedPaper?.Project_ID || activeProjectId || ''` to single-paper acquisition payload in `runSinglePaperPipeline`.
     - Added Active State Downgrade Prevention Guard in `rehydrateSelectedPaper` to prevent background rehydration from clearing active PDF paths.
  2. **Multi-Tab Sync Normalization (`useRollingBatch.ts`)**:
     - Replaced raw `new BroadcastChannel('slr-magic-sync')` with unified `subscribeSyncChannel` from `@/lib/sync-utils`.
     - Maintained full TypeScript signature compatibility for `importReviewerSlr(file: File)` and `resetBatch(mode: 'active' | 'all')`.
  3. **SQL Subquery & Batch Pipeline Project ID Type-Casting (`api/projects/route.ts`, `api/papers/route.ts`, `python_engine/llm/main.py`, `python_engine/llm/queue_handler.py`)**:
     - Fixed un-cast `Project_ID = ?` in miner aggregation queries (`api/projects/route.ts`), subqueries in `api/papers/route.ts`, and batch query selection filters in `python_engine/llm/main.py`.
     - Enforced `(project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))` in `queue_handler.py` downstream record pruning and chained interaction lookups.
  4. **Directory Index Parity (`slr-ide/files.md`)**:
     - Cataloged all previously missing endpoints (`api/events`, `api/llm/audit`, `api/llm/count`, `api/llm/pricing/refresh`, `api/pipeline-lock`, and all `api/vault/*` endpoints) adhering to the standard Markdown table schema.
- **Verification**: Zero TypeScript compilation errors (`npx tsc --noEmit`); all Python engine scripts compiled (`python -m compileall`); 100% pass across all 5 standalone test suites (`test-mockup-review.mjs` [24/24], `test-prompt-library.mjs` [9/9], `test-visualizer-anti-regression.mjs` [15/15], `test-llm-screening-records.mjs` [7/7], `test-archive-service.mjs` [2/2]).

## #408 - Eradication of Active State Rehydration Race Conditions & Strict Multi-Project Isolation (2026-08-16)
- **Goal**: Completely eradicate "Active State Rehydration Race Condition" bugs (where background list re-renders overwrite higher-fidelity active selections or newly acquired PDF states) and "Explicit Project ID Resolution" bugs (where un-scoped queries or un-cast SQLite project ID matching cause data cross-talk or query failures across projects), and establish permanent future-proofing architectural rules in `agents.md`.
- **Architectural Implementation**:
  1. **Active State Rehydration Guards & Immutable State Preservation (`usePapers.ts`, `useManualScreening.ts`, `page.tsx`)**:
     - Added rehydration downgrade guards preventing active modal selections with newly acquired PDF paths from being clobbered or reset by outdated background list states.
     - Protected form rehydration in `page.tsx` using `lastLoadedProjectRef` so local form states are preserved unless multi-tab modifications actually occur.
     - Added `currentRunningPaperIdRef` mutable refs in `useManualScreening.ts`, `AdjudicationWorkspaceModal.tsx`, and `RollingBatchAdjudicationModal.tsx` to eliminate closure-captured target ID race conditions in NDJSON streaming pipelines.
  2. **Symmetric Multi-Tab Synchronization & Universal Sync Subscriptions (`useManualScreening.ts`, `useIngestion.ts`, `AdjudicationWorkspaceModal.tsx`, `RollingBatchAdjudicationModal.tsx`)**:
     - Added `subscribeSyncChannel` listeners across `useManualScreening.ts` and `useIngestion.ts` to automatically re-fetch datasets upon receiving `SYNC_PAPERS` or `SYNC_PROJECTS`.
     - Integrated `broadcastSync('SYNC_PAPERS')` and `broadcastSync('SYNC_PROJECTS')` upon completion of single PDF acquisition and batch pipeline actions in all workspace modals.
  3. **Explicit Project ID Parameter Precedence & Discovery Fallback (`/api/duplicates`, `/api/duplicates/scan`, `/api/papers/[id]/screening`, `/api/papers/manual-screening`, `/api/papers`, `/api/pdf/scan`, `/api/pdf/download`, `/api/pdf/batch`, `/api/rolling-batch/status`, `/api/rolling-batch/stats`, `/api/llm/audit`)**:
     - Upgraded all API routes to prioritize explicit `projectId` (from `searchParams` or request JSON body) before falling back to `getConfig('ACTIVE_PROJECT_ID')`.
     - Implemented single-item fallback discovery in `/api/papers/[id]/screening` and `/api/pdf/single` that queries `Project_ID` from the database `papers` record when not explicitly passed.
  4. **Mandatory Type-Agnostic Project ID Query Casting across TypeScript & Python**:
     - Applied `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))` across all SQL queries, subqueries, and deletion routines in `src/app/api/papers/route.ts`, `projects/[id]/route.ts`, `purge-check/route.ts`, `purge/route.ts`, `llm/audit/route.ts`, `rolling-batch/status/route.ts`, `rolling-batch/stats/route.ts`.
     - Updated Python entrypoints (`find_traps.py`, `map_publisher.py`, `vector_worker.py`) to support `--project` CLI argument and execute type-agnostic project matching.
  5. **Future-Proofing Architectural Rules in `agents.md`**:
     - Updated Section 3.3 (Multi-Tab Synchronization Protocol) with explicit rules on Active State Downgrade Prevention Guards, Stream Completion Symmetry, and Universal Sync Channel Subscription.
     - Updated Section 3.8 (Strict Multi-Project Separation & Isolation Policy) with mandatory rules for Explicit Project ID Parameter Precedence, Safe Project ID Discovery Fallback, and Mandatory Type-Agnostic Project ID Matching.
- **Verification**: Zero TypeScript compile errors (`npx tsc --noEmit`); Python entrypoints compiled cleanly (`python -m py_compile`).

## #407 - Multi-Pool Mockup Review Generator LLM Parameter Compliance, Partial Execution & Mandatory PDF Enforcement for Pool B/C (2026-08-16)
- **Goal**: Ensure 100% strict adherence to all LLM parameters configured in "Edit Prompt Template" -> LLM Parameters (`timeout_seconds`, `model_id`, `execution_mode`, `thinking_level`, `temperature`, `top_p`, `top_k`, `max_tokens`, `concurrency`, `request_delay`, `interaction_chaining`, `discount`) during Multi-Pool Mockup Review execution to prevent API call errors, timeouts, and behavioral divergences; implement targeted partial execution for finished executions to retry failed papers only; and enforce mandatory local full-text PDF files on disk for Pool B (Gatekeeper) and Pool C (Scientist + Miner), blocking executions without PDFs and flagging non-PDF results as invalid/requiring rerun.
- **Architectural Implementation**:
  1. **Strict LLM Parameter Adherence & API Guardrails (`mockup-generator.ts`)**:
     - Enforced `timeout_seconds` using `AbortController` and `setTimeout`, producing an informative `Request timed out after ${timeoutSeconds} seconds` error upon cancellation.
     - Enforced `thinking_level` on Gemini 2.5 series models (`gemini-2.5-flash`, `gemini-2.5-pro`): mapped `none`/`off` to `thinkingBudget: 0` to shut off dynamic reasoning token consumption, and mapped `minimal`, `low`, `medium`, `high` to their respective token budgets.
     - Added robust validation for `temperature` (clamped 0.0–2.0), `top_p` (clamped 0.0–1.0), `top_k` (clamped 1–100), `max_tokens` (clamped 1–64000), and PDF inline attachment size limits (<19.5MB to stay within Google GenAI limits).
     - Added multi-turn `interaction_chaining` context passing from Scientist QA scoring to Miner data extraction in Pool C.
  2. **Mandatory Full-Text PDF Enforcement for Pool B & Pool C (`mockup-generator.ts`, `/api/mockup/generate/route.ts`)**:
     - In `mockup-generator.ts`, strictly checks local PDF existence on disk for Pool B (`evaluateMockupPaperScreening` Stage 2) and Pool C (`evaluateMockupPaperPoolC`). Papers without valid PDFs immediately return `{ decision: 'EXCLUDE', exclusion_code: 'ERROR', error: 'Missing local full-text PDF file (required for Pool B/C)' }` and are flagged by `isMockupResultFailed(res, pool)` as needing rerun.
     - In `POST /api/mockup/generate`, added a preflight guard strictly rejecting execution requests for Pool B or Pool C (HTTP 400) if any queued paper lacks a verified local PDF file on disk.
     - In `GET /api/mockup/generate`, added `missing_pdf_count` and `has_missing_pdfs` telemetry for calibration papers.
  3. **Targeted Partial Execution for Failed Papers (`/api/mockup/generate/route.ts`)**:
     - Enhanced `GET /api/mockup/generate` to return failure telemetry (`failed_count`, `succeeded_count`, `has_failures`).
     - Enhanced `POST /api/mockup/generate` to accept `failedOnly: true` (or `paperIds: string[]`), which inspects existing cache, filters to only target papers that failed in previous runs (`isMockupResultFailed`), preserves already succeeded evaluations, executes LLM calls only on the failed subset, and re-compresses the merged `.slr` bundle with updated cumulative costs.
  4. **Reactive Frontend State & Partial Execution HUD (`useMockupReview.ts`, `MockupReviewModal.tsx`)**:
     - Upgraded `useMockupReview` hook with failure tracking (`failedCount`, `succeededCount`, `hasFailedPapers`), missing PDF tracking (`missingPdfCount`, `hasMissingPdfs`), and `handleRetryFailed()` SSE execution.
     - Added a prominent **Partial Execution Alert Banner** in `MockupReviewModal` explaining cost savings and providing 1-click **"Retry Failed Papers Only (N)"**.
     - Added a prominent **Missing PDF Alert Banner** when Pool B or C contains papers lacking PDFs, rendered per-paper PDF status badges (`PDF Ready` vs `PDF Missing`), and disabled execution buttons with descriptive blocking tooltips until PDFs are matched or acquired.
     - Enhanced Evaluation Stream Log with filter tabs (`All`, `Succeeded`, `Failed`) and granular error rationale tooltips.
- **Verification**: Verified zero TypeScript errors (`npx tsc --noEmit`); ran automated test suite `scripts/test-mockup-review.mjs` (24/24 tests passed).

## #406 - Light Theme UI Refactoring & Tailwind v4 Dark Variant Alignment (2026-08-16)
- **Goal**: Refactor the `slr-ide` desktop application UI for light theme, eliminating visual clashes caused by Tailwind CSS v4's default media-query dark variant evaluation and overhauling the Pre-Calibration Interactive Staging & Benchmark Optimization HUD for crisp, high-contrast, professional scientific presentation.
- **Architectural Implementation**:
  1. **Tailwind CSS v4 Class-Based Variant Configuration (`src/app/globals.css`)**:
     - Added `@custom-variant dark (&:where(.dark, .dark *));` to ensure Tailwind v4 variant modifiers (`dark:...`) strictly bind to the active `<html class="dark">` class rather than falling back to the host operating system's `prefers-color-scheme: dark` media query when `.light` is active.
     - Refined light mode CSS custom property tokens (`--background`, `--card`, `--border`, `--muted`, `--secondary`) for high contrast, clean surfaces, and crisp borders.
  2. **Interactive Staging & Benchmark Optimization HUD Redesign (`PromptStagingQuestPanel.tsx`)**:
     - Redesigned the HUD header banner to replace heavy dark cyberpunk styling with a clean, modern scientific workflow banner with subtle gradient textures, crisp typography, and refined status icons.
     - Re-engineered the 5-Quest Step Progression Pips with high-contrast, responsive states (completed, active, upcoming, locked) and clean vertical connectors.
  3. **Pre-Calibration Quest Cards & Inspector Panels (`PromptConsolidationCard.tsx`, `StageBenchmarkCard.tsx`)**:
     - Redesigned Quest 01 (Consolidation Audit) and Quests 02–05 (Stage 1–4 Benchmarks) with clean card containers, soft semantic status rings, and elevated metric tiles.
     - Refactored inner metric tiles (Accuracy, Recall, Precision, F1-Score, Cohen's Kappa, Holdout 30%) with bold typography, clear labels, and target subtexts.
     - Redesigned the Paper-by-Paper Discrepancy Inspector and Diagnostic Console with high-contrast cards, readable text, and soft alert badges in light theme.
  4. **Pre-Calibration Statistics & Modals Polish (`PoolMetricsPanel.tsx`, `StageComparisonPanel.tsx`, `PreCalibrationView.tsx`, `PromptOptimizationDiffModal.tsx`, `LlmPayloadConfirmationModal.tsx`)**:
     - Refined Pool A/B/C progress cards, stage comparison badges, confusion matrix tiles (`TP`, `TN`, `FP`, `FN`), and decision pills (`INCLUDE`/`EXCLUDE`) for optimal contrast in light mode.
     - Polished modal dialogs for prompt optimization diffs and LLM payload previews with clean borders, legible editor textareas, and accessible buttons.
- **Verification**: Executed `npx tsc --noEmit` — passed with 0 errors.

## #405 - Complete LLM Parameter Suite & Multi-Turn Interaction Chaining Toggle in Prompt Studio (2026-08-16)
- **Goal**: Expand the **Edit Prompt Template Modal** and **Inline Preview Drawers** in `PromptLibraryView` to include the full spectrum of LLM generation, sampling, runtime, and multi-turn interaction chaining configuration options.
- **Architectural Implementation**:
  1. **Multi-Turn Interaction Chaining Toggle (`interaction_chaining`)**:
     - Added an interactive toggle card in Tab 4 (LLM Parameters) with a status badge (`Chaining Active (Multi-Turn)` vs `Disabled (Stateless)`).
     - Allows researchers to control whether Gemini passes `previous_interaction_id` to maintain continuous conversational session context across sequential pipeline stages, or execute isolated stateless single-turn evaluations.
  2. **Comprehensive Sampling & Runtime Pacing Controls**:
     - Added Top-P nucleus sampling slider (0.0–1.0 with real-time numeric badge), Top-K token limit input (1–100), Max Output Tokens (1–64000), Request Delay rate-limiting input in seconds (0.0–10.0s), and Execution Timeout input in seconds (30–3600s).
  3. **High-Density Inline Preview Drawer & Main Table Enhancements**:
     - Upgraded the Tab 4 preview drawer with a 10-metric grid (Model ID, Speed Mode, Thinking Level, Temperature, Top-P, Top-K, Max Tokens, Concurrency, Request Delay, Timeout) and a full-width Interaction Chaining summary bar.
     - Added `chained` and `stateless` visual badge indicators to the main data table's "Model & Config" column.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit`); ran test suite `scripts/test-prompt-library.mjs` (9/9 tests passed).

## #404 - Multi-Pool Mockup Review Generator Modal with Isolated PRISMA Execution (CTRL+M) (2026-08-16)
- **Goal**: Implement a hidden shortcut `CTRL+M` in the **Inter-Rater Dashboard** that opens a **Multi-Pool Mockup Review Modal**, allowing researchers to generate LLM-driven blinded `.slr` review packages across all calibration pools (Pool A, Pool B, Pool C) using project default prompts from the Prompt Library, with 100% inter-rater import compatibility, PRISMA isolation, and cost-free redownloads via project-scoped SQLite caching.
- **Architectural Implementation**:
  1. **PRISMA & Trigger Cascade Isolation (`mockup-generator.ts`)**:
     - Engineered a dedicated backend service calling the Gemini REST API directly with prompt hydration, bypassing the standard Python pipeline's `llm_screening_records` table and eliminating SQLite trigger cascades (`trg_lsr_insert`/`trg_lsr_update`) that would otherwise contaminate `papers`, `rolling_batch_papers`, and `calibration_papers`.
     - Logged LLM API interactions and financial costs into `llm_audit_log` with dedicated, project-scoped task types (`mockup_pool_a`, `mockup_pool_b`, `mockup_pool_c`), keeping `/api/insight/prisma` calculations completely untouched while maintaining full granularity in `/api/insight/accounting`.
  2. **Sequential Pool C Architecture (Scientist + Miner)**:
     - Implemented dual-stage sequential execution for Pool C papers: Stage 3 `scientist` evaluates Quality Assessment (`Human_QA_Scores`), followed by Stage 4 `miner` extracting FAIR variables (`Human_Extracted_Data`), merging both into a single unified blinded review object.
  3. **SQLite Caching & File Assembly (`mockup_cache`, `mockup-generator.ts`)**:
     - Added `mockup_cache` table to persist GZIP-compressed `.slr` payloads (`compressSlrServer`), execution metadata, total costs, token tallies, and prompt hashes.
     - Added prompt hash difference tracking to alert users when default prompts have changed since the last mockup generation.
  4. **Streaming SSE API Route (`/api/mockup/generate/route.ts`)**:
     - Built `GET` (cache status, paper previews, slot occupancy, on-demand `.slr` download), `POST` (Server-Sent Events streaming real-time paper evaluations), and `DELETE` (cache invalidation for explicit reruns).
  5. **Custom Hook & Rich UI Modal (`useMockupReview.ts`, `MockupReviewModal.tsx`)**:
     - Created `useMockupReview` hook managing active pool synchronization, random reviewer ID generation (`rev_xxxx`), SSE stream reading, and auto-download triggers.
     - Built `MockupReviewModal` featuring pool tabs, editable reviewer ID with randomize button, reviewer slot occupancy warning banner, collapsible paper preview list, live progress bar with running cost counter, evaluation stream log, and contextual action buttons ("Generate Review", "Redownload (.slr)", "Rerun & Regenerate").
  6. **Dashboard Shortcut Integration (`InterRaterDashboard.tsx`)**:
     - Registered hidden `Ctrl+M` / `Cmd+M` global keyboard listener and rendered `<MockupReviewModal />`.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit`); ran automated test suite `scripts/test-mockup-review.mjs` (9/9 tests passed).

## #403 - Fix Column Alias & Relational Join in Benchmark and Payload Preview Routes (2026-08-16)
- **Goal**: Fix the database runtime error `no such column: latest_ccl.resolved_exclusion_code` triggered in `LlmPayloadConfirmationModal` and `StageBenchmarkCard` when generating dry-run previews or executing sandbox benchmarks.
- **Architectural Implementation**:
  1. **Canonical Schema Alignment (`src/app/api/calibration/payload-preview/route.ts` & `src/app/api/calibration/benchmark/route.ts`)**:
     - Corrected column alias from invalid `latest_ccl.resolved_exclusion_code` to the canonical database column `latest_ccl.resolved_ec as gold_exclusion_code` matching `calibration_commit_ledger` schema.
     - Refactored the SQL query to start directly from `calibration_commit_ledger` (as the source of truth for gold standards) and `LEFT JOIN` on both `calibration_papers` and `papers`, ensuring metadata (`Title`, `Abstract`, `Authors`, `Year`, `DOI`, `Local_PDF_Path`) is resolved regardless of whether the paper is currently linked in `calibration_papers` or `papers`.
     - Added an informative zero-adjudicated guard in `payload-preview/route.ts` returning a clean, descriptive message (`No adjudicated papers found in POOL_X for Stage X...`) when a pool has 0 committed papers.
- **Verification**: Verified zero TypeScript errors (`npx tsc --noEmit` code 0).

## #402 - Deeper Code Analysis, DDL Schema Parity & Multi-Tab Synchronization Hardening (2026-08-16)
- **Goal**: Perform iterative deep code analysis across all layers of the Pre-Calibration Staging, Benchmarking, Prompt Optimization, and Database Persistence subsystems, hunting down edge cases, schema divergences, stale closures, and clipboard sandboxing exceptions.
- **Architectural Implementation**:
  1. **Canonical DDL & Migration Alignment (`src/lib/db/db-init.ts`)**:
     - Aligned canonical `CREATE TABLE IF NOT EXISTS prompt_audit_ledger` and `CREATE TABLE IF NOT EXISTS prompt_benchmark_runs` DDL statements with `schema.md` and operational query requirements.
     - Added comprehensive `safeAddColumn` checks in the backward-compatibility migration block for `status`, `prompt_id`, `prompt_hash`, `parent_prompt_id`, `parent_prompt_hash`, `semantic_score`, `train_paper_ids`, `holdout_paper_ids`, `before_metrics`, `after_metrics`, `audit_report`, `raw_prompt`, `model_id`, `input_tokens`, `output_tokens`, `cost_usd` on `prompt_audit_ledger`, and `pool`, `prompt_template_id`, `prompt_hash`, `evaluated_papers`, `train_count`, `holdout_count`, `summary_metrics`, `holdout_metrics`, `error_message`, `updated_at` on `prompt_benchmark_runs`.
  2. **Multi-Tab Sync Stale-Closure Elimination (`src/hooks/usePromptStaging.ts`)**:
     - Hardened `BroadcastChannel` subscription in `usePromptStaging` using the mutable `useRef` pattern (`refreshAllBenchmarksRef`) adhering strictly to `agents.md` §3.3 to eliminate stale closure captures during background multi-tab syncs.
  3. **Modal Lifecycle & Clipboard Hardening (`LlmPayloadConfirmationModal.tsx`, `PromptOptimizationDiffModal.tsx`)**:
     - Added `useEffect` reset and `safePaperIndex` clamping on `LlmPayloadConfirmationModal` to prevent out-of-range selection states across differing pool benchmarks.
     - Wrapped clipboard copy routines in resilient `async`/`try`/`catch` with programmatic textarea fallbacks to eliminate sandboxed iframe rejections.
  4. **Multi-Project Isolation & Trace Normalizer Compliance**:
     - Verified 100% compliance with `agents.md` §3.8 (Multi-Project Isolation) across all SQL queries and §3.9 (Centralized Trace Normalizer) in benchmark result cards.
- **Verification**: Executed `npx tsc --noEmit` — passed with 0 errors.

## #401 - Human-in-the-Loop Transparent LLM Payload Confirmation Modal for Pre-Calibration HUD (2026-08-16)
- **Goal**: Provide complete Human-in-the-Loop transparency across the Interactive Staging & Benchmark Optimization HUD (`PromptStagingQuestPanel`), enabling users to inspect the exact hydrated prompt, system instructions, generation parameters, dataset sample/partition, and projected token/cost estimates before triggering "Run Inter-Stage Audit" (Quest 1) or any Stage Benchmark Sandbox run (Quests 2–5 for Stages 1–4 Pool A/B/C).
- **Architectural Implementation**:
  1. **Server-Side Dry-Run Preview API Route (`src/app/api/calibration/payload-preview/route.ts`)**:
     - Implemented `POST /api/calibration/payload-preview` supporting both `consolidation_audit` and `stage_benchmark` preview types.
     - Performs non-destructive template hydration, prompt resolution, and parameter parsing without executing paid LLM API calls.
     - Calculates precise token estimations and projected costs ($ USD) using the active `llm_pricing` table and discount/tax configurations.
     - Previews paper samples across 70% Calibration Tuning / 30% Holdout Validation datasets for benchmark pools.
  2. **Encapsulated Modal Dialog Component (`src/components/features/modals/LlmPayloadConfirmationModal.tsx`)**:
     - Built a high-aesthetic cyberpunk / glassmorphic HUD modal featuring summary telemetry badges (Model ID, Estimated Tokens, Projected Cost in USD, and Paper/Scope Count).
     - Integrated 3 dedicated inspection tabs:
       - **Hydrated Prompt & Context**: System instruction viewer, interactive paper payload selector dropdown for benchmark runs, and formatted prompt text with one-click copy functionality.
       - **Model & JSON Schema**: Temperature, Max Output Tokens, Thinking Budget, Top-P, Top-K, and formatted `responseSchema` viewer with syntax highlighting and copy button.
       - **Target Scope / Dataset Partition**: List of resolved stage prompt templates (for Audit) and 70% Train vs 30% Holdout tabular breakdown with paper IDs and gold decisions (for Benchmarks).
     - Handled vault lock states with visual warning banners and disabled confirm triggers if master password is locked.
  3. **Hook State Management & HUD Container Wiring (`src/hooks/usePromptStaging.ts`, `PromptStagingQuestPanel.tsx`)**:
     - Added `confirmationState`, `openAuditConfirmation`, `openBenchmarkConfirmation`, `confirmPayloadExecution`, and `closePayloadConfirmation` methods to `usePromptStaging`.
     - Wired "Run Inter-Stage Audit" and all 4 stage benchmark "Run Benchmark" triggers to launch the confirmation preview modal before execution.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit`).

## #400 - Comprehensive Prompt Library Table & Stage Default Management (2026-08-16)
- **Goal**: Transform the Prompt Library from a basic card grid into a high-density, comprehensive data table with stage filtering, scope filtering, instant full-text search, inline expandable preview drawers, template cloning, and 1-click stage default prompt assignment with multi-tab synchronization.
- **Architectural Implementation**:
  1. **Comprehensive Prompt Library Table (`src/components/features/PromptLibraryView.tsx`)**:
     - Engineered a responsive data table presenting Pipeline Stage badges, Template Name & Scope indicators (`Global Shared` vs `Project Copy`), Active Stage Default status with gold star badges, Model & execution parameters (`T={temp}`, `flex`/`standard`, thinking levels), and Structured JSON Schema property counters.
     - Implemented Stage Default Summary cards showing active stage defaults across all 8 pipeline stages with 1-click stage filtering.
     - Added comprehensive filter pill bars for Pipeline Stages (`Stage 1: Fast Filter` through `Stage 5: Umbrellanizer`, `Duplicate Specialist`, `Consolidation Auditor`, `Prompt Optimizer`) and Scopes (`All`, `Project-Specific`, `Global Shared`).
     - Added instant full-text search across template names, descriptions, system rules, and schemas.
  2. **Expandable Inline Preview Drawers (`src/components/features/PromptLibraryView.tsx`)**:
     - Built multi-tabbed inline expandable accordions under each row allowing instant inspection of System Instructions, Jinja2 dynamic variables, Structured JSON Schema, and LLM execution parameters with copy-to-clipboard functionality.
  3. **1-Click Stage Default Assignment & Template Cloning**:
     - Implemented direct 1-click "Set as Default" button on table rows and editor modal checkbox, dispatching `PATCH /api/llm/prompts` with `action: 'set_default'` and broadcasting multi-tab `SYNC_PROJECTS` signals.
     - Implemented 1-click "Clone as New" (`(Fork)`) workflow opening the 4-tab studio prefilled for rapid iteration.
  4. **Deep Bug Hunting, Stale-Closure Prevention, Zero-Latency Reactivity & SQLite Schema Fix (`src/app/api/llm/prompts/route.ts`, `src/components/features/PromptLibraryView.tsx`)**:
     - Fixed SQLite error: Removed non-existent `updated_at` column references from all `UPDATE projects SET llm_config = ?` statements in `POST`, `PATCH`, and `DELETE` handlers in `app/api/llm/prompts/route.ts` and test runner scripts, resolving `"no such column: updated_at"`.
     - Fixed potential state clobbering: wrapped BroadcastChannel listeners in `PromptLibraryView.tsx` with mutable `useRef` handles (`fetchPromptsRef`, `loadProjectsRef`) adhering strictly to `agents.md` §3.3 Stale-Closure Prevention.
     - Implemented zero-latency optimistic state updates with rollback protection (`localDefaultsOverride`) for 1-click stage default prompt assignment, ensuring instant visual feedback (`ACTIVE DEFAULT` gold badge) without waiting for parent project re-hydration.
     - Hardened `POST /api/llm/prompts`: added conditional `set_as_default` check preventing project draft/variant saves from inadvertently clobbering existing active stage default assignments unless explicitly chosen or when configuring the stage's initial baseline.
     - Standardized all `projects` and `prompt_templates` SQL queries across `GET`, `POST`, `PATCH` with string/integer project ID type safety (`(id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))`).
  5. **Pipeline-Wide Stage Prompt Resolution & Modal Default Binding (`src/app/api/llm/screen/route.ts`, `DuplicateReviewModal.tsx`, `UmbrellanizerWizard.tsx`, `ProjectSettingsModal.tsx`)**:
     - Upgraded `POST /api/llm/screen` with resilient prompt template resolution, falling back to active project/global baseline templates with project ID coercion safety.
     - Wired `DuplicateReviewModal.tsx` and `GlobalModals.tsx` with project-aware duplicate review prompt template loading and default binding.
     - Enhanced `UmbrellanizerWizard.tsx` with intelligent default prompt resolution falling back to active Umbrellanizer templates.
     - Upgraded `ProjectSettingsModal.tsx` to load both global and project-specific templates (`include_global=true`) and prioritize stage default Miner templates, populating JSON extraction keys seamlessly.
  6. **Python Engine Project Isolation Standardizations (`python_engine/`)**:
     - Standardized project ID lookups across `compress_pdfs.py`, `verify_pdfs.py`, `llm/main.py`, `llm/queue_handler.py`, and `llm/umbrellanizer.py` to use `(id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))` ensuring complete project boundaries per `agents.md` §3.8.
  7. **Modular Integration & Tree Shaking (`src/components/features/GlobalLLMSettingsView.tsx`)**:
     - Extracted Prompt Library rendering into the dedicated `PromptLibraryView` component, eliminating >500 lines of duplicated monolith code in `GlobalLLMSettingsView.tsx`.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Authored and executed dedicated test suite [`scripts/test-prompt-library.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-prompt-library.mjs) passing 9/9 tests (schema init, global resolution, 1-click default assignment, non-destructive global forking, draft non-overwriting guard, explicit default update, global template deletion protection, and cascade cleanup of orphaned project default pointers).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #399 - Umbrellanizer Service & Endpoints Multi-Project Hardening (2026-08-16)
- **Goal**: Standardize project ID isolation across Umbrellanizer results querying, execution triggering, and stage 4 extracted data resolution endpoints.
- **Architectural Implementation**:
  1. **Umbrellanizer Results & Dispatch (`src/app/api/umbrellanizer/route.ts`)**:
     - Standardized `umbrellanizer_results` retrieval query to use `WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))`.
  2. **Umbrellanizer Miner Extraction Filter (`src/app/api/umbrellanizer/papers/route.ts`)**:
     - Hardened candidate paper retrieval query with string/numeric project ID coercion safety and verified compliance with the Stage-Aware Decision Resolution Policy (§3.6).
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #398 - Papers Metadata, Import & Batch Update Project Isolation Hardening (2026-08-16)
- **Goal**: Harden paper metadata lookups (`onlyHashes`, `getPublishers`, `getManualStages`, `getManualDecisions`), import deduplication lookups, citation update statements, and batch paper update transactions against string/integer project ID type coercion.
- **Architectural Implementation**:
  1. **Papers Metadata & Import Endpoint (`src/app/api/papers/route.ts`)**:
     - Standardized `onlyHashes`, `getPublishers`, `getManualStages`, and `getManualDecisions` queries to enforce `WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))`.
     - Standardized `findByDoiStmt`, `findByTitleStmt`, `updateCitationStmt`, and `updateCitationAndDoiStmt` statements.
     - Hardened batch paper status update transaction and statement (`UPDATE papers SET ... WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))`).
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #397 - AI Duplicate Screening, Inter-Rater Ledger & Export Endpoints Scoping (2026-08-16)
- **Goal**: Standardize project ID isolation across AI duplicate screening, inter-rater commit ledger, Umbrellanizer CSV export, and raw papers export endpoints.
- **Architectural Implementation**:
  1. **AI Duplicate Review Route (`src/app/api/duplicates/ai-screen/route.ts`)**:
     - Standardized paper lookups, project configuration lookups, prompt template resolution queries, and `duplicate_pairs` update statements to enforce string/integer project ID type safety.
  2. **Inter-Rater Ledger Endpoint (`src/app/api/adjudicate/ledger/route.ts`)**:
     - Standardized `calibration_commit_ledger` retrieval query to use `WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))`.
  3. **CSV Tabular & Inter-Rater Export Endpoints (`src/app/api/export/csv-tabular/route.ts`, `src/app/api/export/inter-rater/route.ts`, `src/app/api/export/route.ts`)**:
     - Standardized `umbrellanizer_results` lookup, calibration paper retrieval, and paper export queries to use type-coercion-safe project ID checks and stage dominance `Math.max()`.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #396 - PDF Scraper, Cache Matcher, Deduplication & Vector Pipeline Multi-Project Isolation (2026-08-16)
- **Goal**: Harden PDF scraper routines, cache matcher script, duplicate paper detection, vector workers, and PDF batch/deletion API endpoints against string/integer project ID type coercion and cross-project pollution.
- **Architectural Implementation**:
  1. **Remote Worker Claim & Callback Scoping (`src/app/api/remote-worker/claim/route.ts`, `src/app/api/remote-worker/result/route.ts`)**:
     - Standardized paper selection and status update queries to use `WHERE Paper_ID = ? AND (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))`.
  2. **PDF Integrity Verification & Scraper Engine (`python_engine/entrypoints/scrape_pdfs.py`, `python_engine/entrypoints/verify_pdfs.py`)**:
     - Standardized SQL paper filtering and status upgrade/downgrade queries to enforce type-coercion-safe project ID boundaries.
  3. **Cache Matcher Project Isolation (`python_engine/entrypoints/match_cache.py`)**:
     - Fixed missing `Project_ID` scoping on paper match UPDATE query (line 553), ensuring updates are strictly bounded to the active project.
  4. **Duplicate Paper Detector & Vector Index Search (`python_engine/entrypoints/detect_duplicates.py`, `python_engine/entrypoints/semantic_search.py`, `python_engine/entrypoints/vector_worker.py`, `python_engine/entrypoints/build_vectors.py`)**:
     - Standardized all SQL allowlist generation and paper metadata extraction queries to enforce string/integer project ID type safety.
  5. **PDF Batch Pipeline & Deletion Routes (`src/app/api/pdf/batch/route.ts`, `src/app/api/pdf/delete/route.ts`)**:
     - Fixed scalar function NULL evaluation in `pdf/batch/route.ts` using `(IFNULL(manual_stage, 0) > 0 OR IFNULL(ai_stage, 0) > 0)`.
     - Standardized paper and project folder lookup queries in `pdf/delete/route.ts`.
- **Verification**:
  - Python modules verified with `python -m py_compile` across all modified entrypoints.
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #395 - Inter-Rater Adjudication Stats, Final Cohort & Import Route Parity (2026-08-16)
- **Goal**: Harden inter-rater adjudication stats calculation, final cohort retrieval queries, and inter-rater review import fallback logic against string/integer project ID type coercion discrepancies.
- **Architectural Implementation**:
  1. **Inter-Rater Adjudication Stats Hardening (`src/app/api/adjudicate/stats/route.ts`)**:
     - Standardized project query to use `WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))` to reliably fetch QA and extraction rules.
  2. **Final Cohort Query Isolation (`src/app/api/insight/final-cohort/route.ts`)**:
     - Hardened base query where clause to enforce `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))` across counting and paginated paper joins.
  3. **Inter-Rater Import Project Fallback (`src/app/api/import/inter-rater/route.ts`)**:
     - Updated fallback active project resolution to use type-coercion-safe SQL lookups.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #394 - Project Statistics LLM Screening Records Integration & Scalar NULL Hardening (2026-08-16)
- **Goal**: Integrate `llm_screening_records` as the authoritative source into project listing statistics (`GET /api/projects`), fix scalar function NULL evaluations in stage unprocessed counters, and standardize calibration pool assignment queries.
- **Architectural Implementation**:
  1. **Project Stats Combined Audit Log Integration (`src/app/api/projects/route.ts`)**:
     - Updated all CTEs (`combined_logs`) across `stageStatsRows`, `stageECStatsRows`, `stage2Unprocessed`, `stage3Unprocessed`, and `stage4Unprocessed` to include `llm_screening_records` at Priority 1 (`manual_audit_log` at Priority 2, `llm_audit_log` at Priority 0).
     - Fixed `MAX(p.manual_stage, p.ai_stage)` in `stage1Unprocessed` to `MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0))` to prevent NULL returns when `manual_stage` is NULL.
     - Added `NOT EXISTS (SELECT 1 FROM llm_screening_records WHERE stage = 1)` to `stage1Unprocessed`.
     - Standardized project ID type safety across all project statistics and tag count queries.
  2. **Calibration Pool Assignment Queries (`src/app/api/calibration/assign/route.ts`)**:
     - Hardened paper lookup, duplication validation, cloning, update, and unassignment queries to use string/numeric coercion protection.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #393 - Zero-Trace Project Purge Completeness & Single Paper Query Isolation (2026-08-16)
- **Goal**: Harden project deletion across all 18 project-scoped database tables including `semantic_search_cache`, and standardize project ID type safety in single paper metadata and prompt querying endpoints.
- **Architectural Implementation**:
  1. **Zero-Trace Project Deletion Hardening (`src/app/api/projects/[id]/route.ts`)**:
     - Applied `(project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT))` across all 18 project-scoped tables within an atomic transaction.
     - Added explicit deletion of project vector index entries from `semantic_search_cache`.
     - Standardized next-active-project reassignment logic with string/numeric type safety.
  2. **Single Paper Metadata & Audit Logging (`src/app/api/papers/[id]/route.ts`)**:
     - Updated GET and PUT queries to enforce `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))` on paper lookups and updates.
  3. **Active Jobs and Prompt Query Isolation (`src/app/api/llm/jobs/active/route.ts`, `src/app/api/llm/prompts/route.ts`)**:
     - Standardized project ID filtering to ensure consistent retrieval of project-specific vs global prompt templates and active jobs.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #392 - CSV Tabular Stage Query Correction & FAIR Data Exporter Archive Expansion (2026-08-16)
- **Goal**: Resolve a stage comparison SQL typo in `csv-tabular/route.ts`, expand FAIR data export coverage to include all rolling batch and prompt tables, and harden subquery project ID resolution in `manual-screening/route.ts`.
- **Architectural Implementation**:
  1. **CSV Tabular Stage Dominance Bug Fix (`src/app/api/export/csv-tabular/route.ts`)**:
     - Fixed typo in line 104 where `IFNULL(p.ai_stage, 0) > IFNULL(p.ai_stage, 0)` was comparing `ai_stage` to itself; corrected to `IFNULL(p.ai_stage, 0) > IFNULL(p.manual_stage, 0)`.
     - Standardized project ID type safety in CSV export queries.
  2. **FAIR Data Exporter Completeness (`src/app/api/export/fair-data/route.ts`)**:
     - Expanded the FAIR compliance export payload to include `rolling_batches`, `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`, `duplicate_pairs`, and `prompt_templates`.
  3. **Manual Screening Subquery Isolation (`src/app/api/papers/manual-screening/route.ts`)**:
     - Hardened scalar subqueries (`calibration_pool`, `calibration_tag`, `Parent_Paper_Title`, `reviewer_decisions_exist`) in `dataQuery` to evaluate `(Project_ID = papers.Project_ID OR CAST(Project_ID AS TEXT) = CAST(papers.Project_ID AS TEXT))`.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #391 - Rolling Batch Pipeline, Umbrellanizer Isolation & PRISMA Exporter Deep Hardening (2026-08-16)
- **Goal**: Harden the rolling batch lifecycle (initialization, adjudication, reset, and export), ensure strict PRISMA 2020 flow metrics isolation, and guarantee multi-project SQL isolation parity across all analytical export endpoints.
- **Architectural Implementation**:
  1. **Rolling Batch Pipeline Hardening (`src/app/api/rolling-batch/`)**:
     - Standardized project ID type safety across `initialize/route.ts`, `adjudicate/route.ts`, and `reset/route.ts` using `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))`.
     - Hardened rolling batch reset in `reset/route.ts` to perform a clean sweep of `rolling_batch_papers` by both project ID and batch ID collection, preventing lingering orphaned records.
  2. **Umbrellanizer Multi-Project Isolation (`python_engine/llm/umbrellanizer.py`, `python_engine/llm/main.py`)**:
     - Applied `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))` to dynamic token extraction queries across Miner-passed papers.
  3. **PRISMA Flow & SLR Viewer Exporter Parity (`src/app/api/export/slr-viewer/route.ts`, `src/app/api/insight/prisma/route.ts`)**:
     - Hardened PRISMA paper queries and prompt template queries to use string/numeric coercion protection.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Python compiler verified with 0 syntax errors across all LLM modules (`python -m py_compile`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #390 - Deep Code Analysis: Scalar Function NULL Hardening, Project ID Type Coercion Parity & Multi-Stage Edge Case Hardening (2026-08-16)
- **Goal**: Perform comprehensive iterative deep code analysis across background workers, API routes, database triggers, and UI components to hunt down and resolve scalar function NULL propagation, project ID type coercion anomalies, and multi-stage lifecycle edge cases.
- **Architectural Implementation**:
  1. **SQLite Scalar Function NULL Hardening (`python_engine/llm/main.py`)**:
     - Fixed SQLite `MAX(manual_stage, ai_stage)` query in `main.py` line 257 to use `MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0))`, preventing scalar `MAX()` from returning `NULL` when either stage column is `NULL` (which caused unscreened papers with `manual_stage IS NULL` to be skipped during batch selection).
  2. **Multi-Project ID Coercion Parity (§3.8 Isolation Standard)**:
     - Hardened SQL queries across `src/app/api/llm/count/route.ts`, `src/app/api/papers/purge/route.ts`, `src/app/api/duplicates/route.ts`, `src/app/api/duplicates/resolve/route.ts`, `src/app/api/adjudicate/route.ts`, `src/app/api/pdf/single/route.ts`, and `src/lib/services/batch-pipeline-executor.ts` to utilize `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))` to eliminate string vs integer type coercion discrepancies in SQLite.
  3. **Atomic Purge & Cascading Verification**:
     - Verified atomic single and batch purge cascades across `papers`, `llm_screening_records`, `manual_audit_log`, and `llm_audit_log`.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).
  - Python compiler verified with 0 syntax errors across all LLM modules (`python -m py_compile`).
  - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing 7/7 tests.
  - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
  - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #389 - Dedicated PRISMA Screening State Table (`llm_screening_records`), SQLite Precedence Triggers & Isolated Stage Execution (2026-08-16)
- **Goal**: Establish a dedicated, non-duplicate, single last-updated PRISMA screening table (`llm_screening_records`) per gate per paper per project to eliminate multi-turn/multi-use contamination from `llm_audit_log` (e.g. Prompt Optimizer runs, sandbox benchmark evaluations, or mock review data), and configure automatic SQLite database triggers as the sole authoritative source of truth for synchronizing `papers.ai_*` and `rolling_batch_papers.ai_*`.
- **Architectural Implementation**:
  1. **Canonical Schema & Database Triggers (`src/lib/db/db-init.ts`)**:
     - Created `llm_screening_records` table with composite uniqueness `UNIQUE(project_id, paper_id, stage)` storing `stage`, `task_type`, `decision`, `exclusion_code`, `rationale`, `quality_assessment`, `extracted_data`, `logic_trace`, `structured_output`, `model_id`, `job_id`, `cost_usd`, `total_tokens`, and `latency_ms`.
     - Implemented automatic SQLite triggers (`trg_lsr_insert`, `trg_lsr_update`, `trg_lsr_delete`) enforcing stage-aware precedence funneling (earliest exclusion stage or highest completed stage) to keep `papers.ai_*` and `rolling_batch_papers.ai_*` in continuous, atomic synchronization.
     - Added idempotent startup migration `backfillLlmScreeningRecords(db)` to backfill existing screened papers from `papers` and `llm_audit_log`.
  2. **Python Engine Gate Worker (`python_engine/llm/queue_handler.py`)**:
     - Updated `process_paper_worker` to write directly to `llm_screening_records` via `ON CONFLICT(project_id, paper_id, stage) DO UPDATE`.
     - Integrated downstream record pruning: if an earlier stage $N$ is re-run and yields `EXCLUDE`, all downstream records (`stage > N`) are automatically purged, causing triggers to reflect the active gate exclusion.
  3. **100% Backward-Compatible Archive Export/Import/Purge (`src/lib/services/archive-service.ts`)**:
   4. **Tri-Table Automatic SQLite Triggers (`src/lib/db/db-init.ts`)**:
      - Configured automatic triggers (`trg_lsr_insert`, `trg_lsr_update`, `trg_lsr_delete`) to keep `papers`, `rolling_batch_papers`, and `calibration_papers` in lockstep with the stage-dominant state in `llm_screening_records`.
   5. **Cascading Deletion Endpoints & Paper Cleanup**:
      - Updated `src/app/api/projects/[id]/route.ts`, `src/app/api/papers/purge/route.ts`, and `src/app/api/papers/[id]/route.ts` DELETE handlers to cascade delete from `llm_screening_records`.
   6. **Direct Source Migration for Final Cohort, SLR Viewer, Paper Filtering & UI**:
      - Updated `src/app/api/insight/final-cohort/route.ts`, `src/app/api/papers/route.ts`, `src/app/api/papers/manual-screening/route.ts`, `src/app/api/adjudicate/stats/route.ts`, `src/app/api/adjudicate/route.ts`, `src/app/api/import/inter-rater/route.ts`, `src/app/api/export/fair-data/route.ts`, and `src/app/api/export/slr-viewer/route.ts` to source PRISMA gate state, QA scores, and extracted data from `llm_screening_records` (with indexed lookups and fallback).
      - Included `llm_screening_records` in distinct exclusion codes / EC trigger queries in `src/app/api/papers/route.ts`.
      - Created dedicated endpoint `src/app/api/papers/[id]/screening/route.ts` and updated `src/components/features/modals/paper-details/PaperMetadataView.tsx` to display verified PRISMA gate states with expandable logic traces and tokens.
   7. **Python Engine Indentation & Syntax Rectification (`python_engine/llm/queue_handler.py`)**:
      - Resolved indentation disparity in `process_paper_worker` NOT_STATED extraction metrics block, preventing runtime `IndentationError`.
- **Verification**:
   - TypeScript compiler verified with 0 errors (`npx tsc --noEmit` exited with code 0).
   - Python compilation verified with 0 errors (`python -m py_compile` across all LLM modules).
   - Executed automated test suite [`scripts/test-llm-screening-records.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-llm-screening-records.mjs) passing all 7/7 verification stages across `papers`, `rolling_batch_papers`, and `calibration_papers`.
   - Executed relational archive tests [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing with 0 foreign key violations.
   - Executed visualizer anti-regression tests [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs) passing all 15 tests.

## #388 - Assign Papers to Calibration Pools Toolbar UI Modernization & Collapsible Filters (2026-08-16)
- **Goal**: Modernize and align the "Assign Papers to Calibration Pools" search, filter, and metadata toolbar in `PaperSelectionList.tsx` with updated design specifications, featuring full-width `rounded-2xl` search input with integrated uppercase `SEARCH` trigger, collapsible options container to maximize vertical list viewport, prominent Semantic mode toggle, corpus indexing coverage badge, flexible filter actions, and high-contrast query latency metadata pill.
- **Architectural Implementation**:
  1. **Full-Width Search & Collapsible Options Container (`PaperSelectionList.tsx`)**:
     - Allocated the search input to a dedicated full-width (`w-full`) `rounded-2xl` pill container with the `SEARCH` action button nested on the right.
     - Added an interactive collapse/expand toggle button (`SlidersHorizontal` + `ChevronDown`/`ChevronUp`) with dynamic active filter count badge (`activeFilterCount`), allowing reviewers to collapse the mode toggles, pipeline filters, review exclusions, sort toolbar, and latency pill to maximize the paper list viewport (+240px vertical viewable space).
     - Placed the "Semantic" mode switch, vector indexing status pill (`⚡ 1056/1056 Indexed`), "Screening Pipeline", and "Filters" buttons in a flexible, wrapped secondary action row inside the collapsible container.
  2. **Refined Sorting Toolbar & Latency Metadata Banner**:
     - Modernized the `SORT BY` toolbar with `rounded-xl` pill buttons for Citations, Year, and Match %.
     - Styled the query execution metadata container into a `rounded-2xl` status bar displaying processing latency and the uppercase `TOP 200 NEAREST NEIGHBORS` purple badge.
- **Verification**: Verified TypeScript compilation with 0 errors (`npx tsc --noEmit` exited with code 0).

## #387 - Canonical Schema Initialization, Obsolete Patch Purge & Schema Version Checkpointing (2026-08-16)
- **Goal**: Modernize and streamline SQLite database startup initialization in `slr-ide` (`src/lib/db/db-init.ts`, `migrate-project-ids.ts`), ensuring 100% canonical DDLs across all 25 tables for fresh installs, purging ~40 redundant inline `ALTER TABLE` try-catch blocks and 7 dead commented-out migration blocks, and implementing an idempotent `SCHEMA_VERSION = '3'` fast-path guard (<0.35ms startup latency).
- **Architectural Implementation**:
  1. **Canonical Topological DDL Suite (`src/lib/db/db-init.ts`)**:
     - Standardized all 25 SQLite tables (`configs`, `vault_config`, `api_key_vault`, `remote_workers`, `llm_pricing`, `projects`, `papers`, `calibration_papers`, `prompt_templates`, `llm_jobs`, `llm_batch_jobs`, `reviewer_decisions`, `calibration_commit_ledger`, `llm_audit_log`, `manual_audit_log`, `duplicate_pairs`, `semantic_search_cache`, `umbrellanizer_results`, `rolling_batches`, `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`, `prompt_audit_ledger`, `prompt_benchmark_runs`, `prompt_benchmark_results`).
     - Directly embedded all columns (including `prompt_type`, `parent_prompt_id`, `is_duplicate`, `ai_*`, `manual_*`, and benchmark columns) directly into `CREATE TABLE IF NOT EXISTS` blocks.
     - Ordered table definitions topologically so parent entities are created before child foreign key references.
  2. **Schema Version Checkpoint & Fallback Guard (`SCHEMA_VERSION = '3'`)**:
     - Introduced an idempotent `SCHEMA_VERSION = '3'` fast-path in `configs`. Fresh installations record version 3 immediately upon initial DDL creation, bypassing all fallback `ALTER TABLE` exception catches on subsequent boots.
     - Provided a one-time migration fallback for pre-v3 databases that executes necessary column checks and marks `SCHEMA_VERSION = '3'`.
  3. **Obsolete Patch & Dead Code Purge**:
     - Removed ~40 redundant inline `ALTER TABLE ... ADD COLUMN` try-catch blocks from the active startup loop.
     - Purged 7 large legacy disabled migration code blocks (legacy PDF path migration, legacy AI stage bumps, old `Human_*` column migrations).
  4. **Startup I/O Optimization (`src/lib/db/migrate-project-ids.ts`)**:
     - Gated project normalization with fast $O(1)$ pre-checks (`SELECT 1 FROM projects WHERE id = 'default-project' LIMIT 1` and `SELECT 1 FROM papers WHERE Project_ID IS NULL LIMIT 1`), eliminating redundant full-table write queries on healthy databases.
- **Verification**: Verified TypeScript compilation with 0 errors (`npx tsc --noEmit`) and executed fresh in-memory database initialization benchmarking with all 25 tables passing assertions in 6.11ms and subsequent boots running in 0.31ms.

## #386 - Cross-Platform Automated Dependency Installer & Centralized Python Path Resolver (2026-08-15)
- **Goal**: Implement automated, cross-platform dependency installation scripts (`install.sh`, `install.ps1`, `install.bat`, `npm run setup`) for Windows, Linux, and macOS across all workspace submodules (`root`, `slr-ide`, `inter-rater`, `slr-viewer`), providing prerequisite diagnostics (Node.js, npm, nvm, Python 3, Python `venv`), smart virtual environment detection/reuse, and centralized cross-platform Python executable resolution in `slr-ide`.
- **Architectural Implementation**:
  1. **Cross-Platform Automated Installers (`install.sh`, `install.ps1`, `install.bat`, `scripts/install-launcher.mjs`)**:
     - Built POSIX-compliant `install.sh` for Linux and macOS with color-coded diagnostic checks for Node.js (>=18), npm, nvm, Python 3, and Python `venv` support.
     - Built PowerShell `install.ps1` and Command Prompt `install.bat` wrapper for Windows with automatic ExecutionPolicy handling.
     - Implemented smart venv detection: checks if `slr-ide/python_engine/venv` exists; if present, logs detection and updates packages via `pip install -r requirements.txt`; if absent, creates the virtual environment with `python -m venv` and installs all dependencies.
     - Automatically chains Node dependencies across `root`, `slr-ide`, `inter-rater`, and `slr-viewer`, followed by post-install `npm run mirror:viewer` sync.
     - Added root `package.json` `"setup": "node scripts/install-launcher.mjs"` platform detector.
  2. **Centralized Python Executable Resolver (`slr-ide/src/lib/services/python-path.ts`)**:
     - Created `getPythonExecutablePath()` and `isPythonVenvPresent()` to resolve `python_engine/venv/Scripts/python.exe` on Windows and `python_engine/venv/bin/python` on Linux/macOS with fallback to system Python.
     - Refactored all 13 `slr-ide` API routes and backend services (`screen/route.ts`, `pricing/refresh/route.ts`, `pdf/download/route.ts`, `pdf/scan/route.ts`, `pdf/single/route.ts`, `remote-worker/result/route.ts`, `umbrellanizer/route.ts`, `vectors/build/route.ts`, `vectors/search/route.ts`, `vectors/traps/route.ts`, `archive-service.ts`, `batch-pipeline-executor.ts`, `vector-daemon-manager.ts`) to use the centralized helper.
  3. **Documentation & Governance**:
     - Registered `src/lib/services/python-path.ts` in `slr-ide/files.md`.
     - Updated Quick Start documentation across `README.md`, `slr-ide/README.md`, `inter-rater/README.md`, and `slr-viewer/README.md`.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0).

## #385 - Project-Scoped Vector Search Status, Corpus Index Health Badges & Assign Papers Empty-State Resolution (2026-08-15)
- **Goal**: Fix empty semantic search results in "Assign Papers to Calibration Pools" and "Manual Screening Pipeline" by resolving multi-project corpus vector coverage isolation, providing real-time vector index health badges, two-tier context-aware diagnostics, and instant in-situ index building.
- **Architectural Implementation**:
  1. **Project-Scoped Vector Status API (`/api/vectors/status/route.ts`)**:
     - Upgraded status route to compute project-specific indexing coverage metrics (`total_project_papers`, `indexed_project_papers`, `missing_project_papers`, `coverage_pct`).
     - Utilized in-memory `Set` lookup of active project paper IDs against `vector_id_map.db` to prevent cross-database connection locking in SQLite while achieving $<1\text{ms}$ resolution.
     - Enforced `indexed: true` only when both physical index files exist and active project corpus coverage is 100% (`indexed_project_papers >= total_project_papers`).
  2. **Semantic Search Cache & Filter Alignment (`semantic-search-cache.ts`, `useCalibration.ts`)**:
     - Removed restrictive legacy $<100$ result bypass in `semantic-search-cache.ts` to allow small corpora and selective queries to benefit from instant SQLite cache hits.
     - Added `ready_for_ai` (`SYNCED` PDF) and `pending_pdf` (missing/inaccessible PDF) branch handling in client-side semantic filter pipeline in `useCalibration.ts` to match standard database view filtering.
     - Consolidated duplicate search debouncing effects in `useCalibration.ts`.
  3. **Frontend Index Health Badges & Context-Aware Empty State CTAs (`PaperSelectionList.tsx`, `VectorBuildModal.tsx`, `ManualScreeningList.tsx`, `useManualScreening.ts`)**:
     - Added prominent index health badges (e.g. `⚡ 1,063/1,063 Indexed` or `⚠️ 0/1,063 Indexed`) in the search controls toolbars of both Assign Papers and Manual Screening views.
     - Upgraded empty states from generic messages to two-tier diagnostic callouts: rendering an amber unindexed warning with an instant **"Build Semantic Index Now"** CTA button if the project corpus is unindexed, and query refinement guidance if 100% indexed.
     - Added `onBuildSuccess` post-build callback to `VectorBuildModal` to automatically trigger `loadVectorStatus()` and re-run active semantic searches immediately upon completion without requiring manual retyping.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0).

## #384 - Interactive Prompt Staging Quest-Line, Sandbox Benchmarks & HITL Optimization Engine (2026-08-15)
- **Goal**: Implement an interactive 5-stage progression HUD (Cyberpunk Quest-Line / Neon Glass HUD) in **SLR-IDE -> Pre-Calibration -> Statistics** to systematically evaluate the consistency, chainability, and empirical performance of the 4-stage LLM screening pipeline against double-blind adjudicated gold standard calibration pools, paired with an adversarial Prompt Optimization Magic engine featuring Human-in-the-Loop full-text PDF retrieval and Copy-on-Write template updates.
- **Architectural Implementation**:
  1. **Dynamic LLM Config Adherence & Zero Hardcoding (`prompt-validator.ts`, `prompt-hydrator.ts`, `db-init.ts`)**:
     - Registered `consolidation_audit` and `prompt_optimizer` prompt types, default Jinja2 user templates, and baseline JSON schemas.
     - Seeded `default-prompt-consolidation-audit` and `default-prompt-optimizer` in `prompt_templates`.
     - Built centralized `hydrateTemplate` TypeScript utility matching Python Jinja2 conventions with case-insensitive aliases and fallback protection.
     - Enforced 100% dynamic adherence to `prompt_templates.llm_config` (`concurrency`, `request_delay`, `model_id`, `temperature`, `max_tokens`, `top_p`, `top_k`, `thinking_level`, `execution_mode`, `timeout_seconds`).
  2. **Audit Ledger & Sandbox Benchmark API Routes (`stage-audit/route.ts`, `benchmark/route.ts`)**:
     - Created `POST /api/calibration/stage-audit` executing zero-temperature adversarial consolidation audits across all 4 pipeline stage prompts, evaluating research scope alignment, exclusion code orthogonality, and inter-stage input/output data flow continuity, persisted to `prompt_audit_ledger`.
     - Created `GET/POST /api/calibration/benchmark` executing isolated sandbox benchmark runs against double-blind adjudicated calibration datasets (Pool A for Stage 1, Pool B for Stage 2, Pool C for Stage 3 & 4) partitioned into 70% Calibration Tuning / 30% Holdout Validation subsets, joining `calibration_commit_ledger` with `MAX(timestamp)` per paper to establish ground truth consensus, and evaluating PRISMA Hard Exit Gates (Stage 1 Recall 100%, Stage 2 Precision $\ge 85\%$, Stage 2 Recall $\ge 90\%$, Scientist Weighted Kappa $\ge 0.65$).
  3. **Human-in-the-Loop Prompt Optimization Magic (`prompt-optimize/route.ts`)**:
     - Multi-turn adversarial prompt diagnosis analyzing failure patterns in the 70% training subset.
     - Implemented Turn 1 / Turn 2 Interaction Chaining: when the optimizer identifies subtle claims requiring full-text inspection, it presents an interactive HITL approval drawer displaying paper ID, title, technical reason, token estimate, and on-disk status.
     - Upon user approval, attaches full-text content or structured metadata fallbacks (`PDF_UNAVAILABLE`) to refine prompt revisions.
     - Implemented `PUT /api/calibration/prompt-optimize` supporting Copy-on-Write forked templates (`project_id = activeProjectId`, `parent_prompt_id = originalId`) to keep global defaults immutable.
  4. **18-Table FAIR Data Export & Archival Integration (`archive-service.ts`, `fair-data/route.ts`, `projects/[id]/route.ts`)**:
     - Integrated `prompt_audit_ledger`, `prompt_benchmark_runs`, and `prompt_benchmark_results` into the Project Archive service, FAIR data export payload, and project wipe transactions.
  5. **Frontend Cyberpunk Quest-Line / Neon Glass HUD (`usePromptStaging.ts`, `PromptStagingQuestPanel.tsx`, `PromptConsolidationCard.tsx`, `StageBenchmarkCard.tsx`, `PromptOptimizationDiffModal.tsx`)**:
     - Mounted `PromptStagingQuestPanel` in `PreCalibrationView.tsx` under the `statistics` tab.
     - Created Card 1 with availability ($4/4$), semantic alignment, and chainability checks with expandable diagnostic consoles.
     - Created Cards 2–5 with progressive unlocking prerequisites, real-time benchmark execution, statistical accuracy tables, and paper discrepancy inspection using `extractMappingReasoning` and `extractEvidenceQuote` from `trace-normalizer.ts`.
     - Implemented `PromptOptimizationDiffModal` featuring the HITL PDF approval drawer, side-by-side colorized diff viewer, and direct Copy-on-Write template application.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0) and archive service unit tests (`node scripts/test-archive-service.mjs` passed with 0 FK violations).

## #383 - Project-Specific Prompt Forking & Global Default Immutability (2026-08-15)
- **Goal**: Guarantee that when a user edits any prompt template (including seeded global defaults like `'default-duplicate-review'`) within a project context, the modifications are saved as a project-specific copy (`project_id = activeProject.id`) with an auto-generated UUID, leaving the global default template 100% immutable and untouched.
- **Architectural Implementation**:
  1. **Safe Project Forking in REST API (`/api/llm/prompts/route.ts`)**:
     - Inspected existing prompt record before update: if the template is Global (`project_id === null`) and a `project_id` is supplied in the request, automatically creates a new project-scoped template row (`INSERT INTO prompt_templates ... VALUES (newId, project_id, ...)`).
     - Directly updates existing project-scoped templates if the template already belongs to that project.
     - Automatically updates the active project's default prompt stage binding (`projects.llm_config.default_prompts[prompt_type]`) to reference the new project-specific template ID.
     - Returned `{ success: true, id, is_forked, message }` informing the client whether a project-specific fork occurred.
  2. **UI Scope Indicators & State Synchronization (`GlobalLLMSettingsView.tsx`, `PromptLibraryView.tsx`)**:
     - Added scope badge pills in the prompt editor headers (`Global Default (Saves as Project-Specific Copy)` vs `Project-Specific Template`).
     - Synchronized `defaultPromptsState` immediately when a template is forked to ensure active stage dropdowns reflect the new project-specific template.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0).

## #382 - 100% Strict LLM Config Settings Adherence in AI Deduplication Pipeline (2026-08-15)
- **Goal**: Guarantee that AI duplicate screening in `POST /api/duplicates/ai-screen` strictly honors all prompt settings defined in the **LLM Config** section of the selected prompt template in the Prompt Library (`model_id`, `temperature`, `max_tokens`, `top_p`, `top_k`, `thinking_level`, `execution_mode`, `discount`, `timeout_seconds`).
- **Architectural Implementation**:
  1. **Strict LLM Config Extraction & Generation Payload (`/api/duplicates/ai-screen/route.ts`)**:
     - Parsed `llm_config` from active prompt template with strict fallbacks.
     - Enforced `model_id` (sanitized from `models/` prefix), `temperature`, `max_tokens` (`maxOutputTokens`), `top_p` (`topP`), and `top_k` (`topK`).
     - Implemented `thinkingConfig` mapping: dynamically allocated thinking token budget for `'minimal'` (1024), `'low'` (2048), `'medium'` (4096), and `'high'` (8192), while setting `thinkingBudget: 0` for non-thinking requests on Gemini 2.0 / 2.5 models.
     - Wired up `timeout_seconds` to `AbortSignal.timeout(timeoutSeconds * 1000)` on the fetch request to prevent hanging requests.
     - Applied prompt-configured `discount` or Flex mode default discount to token accounting (`projects.project_current_spend`) and recorded `speed_mode`, `flex_discount`, `thinking_tokens`, and `structured_output` in `llm_audit_log`.
  2. **Template Selection & Config Transparency in UI (`DuplicateReviewModal.tsx`)**:
     - Loaded active `'duplicate_review'` prompt templates from `/api/llm/prompts` on modal open.
     - Rendered dynamic prompt selector dropdown or live model info pill badge in the modal header.
     - Passed `template_id` in API payload to guarantee the chosen prompt template's settings are executed.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0).

## #381 - Schema-Driven JSON Key Autocomplete & Mapping in Project Calibration Settings (2026-08-15)
- **Goal**: Upgrade **Project Settings -> Calibration & Pools -> Data Extraction Rules (JSON Mapping)** from manual free-text input to a strict schema-driven `<select>` dropdown populated dynamically from the project's active Miner prompt schema (`properties.extracted_data.properties`), with missing prompt alert guidance and a one-click "Populate from Schema" batch shortcut.
- **Architectural Implementation**:
  1. **Dynamic Miner Prompt Schema Resolution (`ProjectSettingsModal.tsx`)**:
     - Fetched project-tied prompt templates from `/api/llm/prompts?project_id=${project.id}` when opening project settings.
     - Resolved the active Miner prompt (`prompt_type === 'miner'`, prioritizing `is_active === 1` or most recent update) and strictly extracted all keys from `properties.extracted_data.properties`.
     - Computed schema state (`minerSchemaKeys`, `hasMinerPrompt`, `isLoadingMinerPrompt`) and passed down to calibration settings.
  2. **Form State Batch Populate Helper (`useProjectForm.ts`)**:
     - Implemented `handlePopulateAllPoolCExtractionRules(keys: string[])` to deduplicate and batch-append all Miner schema keys into `projectFormPoolCExtractionRules` in one step.
  3. **Strict Select Dropdown & UI Overhaul (`ProjectCalibrationSettings.tsx`)**:
     - Replaced free-text input with a styled `<select>` dropdown displaying all Miner schema keys, with automatic preservation and tagging of existing `(Custom / Legacy)` keys.
     - Added an inline warning alert banner when no active Miner prompt template exists for the project, guiding the user to configure one in Global LLM Settings / Prompt Library.
     - Added a "Populate from Schema" button with a `Sparkles` icon to batch-populate all schema keys into the mapping table with a single click.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0).

## #380 - Automated AI Duplicate Screening & Adjudication Pipeline in Review Duplicates (2026-08-15)
- **Goal**: Implement high-precision automated AI screening for candidate duplicate paper pairs in `slr-ide` Review Duplicates modal, providing detailed technical breakdowns across mathematical shifts, topology/scope changes, and data footprints, taxonomy classification (`CONFIRMED DUPLICATE`, `STRUCTURAL OVERLAP`, `COMPANION PAPERS`, `FALSE FLAG`), database lineage recommendations, and auto-selection of recommended primary papers.
- **Architectural Implementation**:
  1. **Prompt Library Integration & Schema Validation (`prompt-validator.ts`, `schema_registry.py`)**:
     - Added `'duplicate_review'` to `PromptType` union, `PROMPT_TYPE_OPTIONS`, `DEFAULT_STAGE_SCHEMAS`, and schema validation rules.
     - Registered duplicate review taxonomy and schema keys (`verdict`, `technical_breakdown`, `primary_action`, `suggested_primary_id`, `database_execution`).
  2. **Database Migration & Seeding (`db-init.ts`)**:
     - Expanded `duplicate_pairs` table schema with `ai_verdict`, `ai_analysis`, and `ai_suggested_primary_id` columns with self-healing fallback migrations.
     - Seeded default global prompt template `'default-duplicate-review'` with structured system instructions, Jinja2 template bindings (`{{paper1_id}}`, `{{paper1_title}}`, etc.), and strict JSON schema.
  3. **Backend API Endpoint (`/api/duplicates/ai-screen/route.ts`)**:
     - Enforced preflight guardrails: pipeline lock, vault unlock state, in-memory AES decryption of `GEMINI_API_KEY`, budget limit enforcement, active prompt template resolution from Prompt Library with fallback.
     - Executed structured Gemini API generation (`response_schema` enforcement).
     - Recorded execution in `llm_audit_log` with project isolation and updated `projects.project_current_spend` atomically.
     - Persisted AI analysis and verdict to `duplicate_pairs`.
  4. **Frontend Review Duplicates Modal (`DuplicateReviewModal.tsx`)**:
     - Added "AI Screen Pair" / "Re-Run AI Screen" Magic Button with loader and error banner handling.
     - Rendered AI Deduplication Verdict banner with color-coded taxonomy badges, primary action, database lineage recommendation, and 3-column technical breakdown grid (Mathematical Shift, Topology/Scope Change, Data Footprint).
     - Added "AI Primary Choice" badge and auto-selected recommended primary paper radio button on AI completion.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0).

## #379 - Transparent GZIP Compression Protocol for Review Files Across All Pools & QA Batches (2026-08-15)
- **Goal**: Adopt transparent GZIP compression across all exported `.slr` review packages (Pool A, Pool B, Pool C, and QC/QA Batch) in `slr-ide`, drastically reducing exported file sizes (80-99% reduction when base64 PDFs and rich extraction metadata are embedded) while preserving full backward compatibility with legacy uncompressed JSON files.
- **Changes**:
  - Created [`src/lib/slr-compression.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/slr-compression.ts): Universal compression utility supporting Node.js native `zlib` (`compressSlrServer`, `decompressSlrServer`) and browser Web Streams (`compressSlrBrowser`, `decompressSlrBrowser` using `CompressionStream`/`DecompressionStream`) with automatic GZIP magic byte detection (`0x1F, 0x8B`).
  - Modified [`src/app/api/export/inter-rater/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/inter-rater/route.ts): Compressed exported review packages for Pool A, Pool B, and Pool C with `compressSlrServer`, returning `application/octet-stream` responses.
  - Modified [`src/app/api/rolling-batch/export/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/export/route.ts): Compressed exported review packages for QA batches (`QC_Batch`) with `compressSlrServer`.
  - Modified [`src/app/api/import/inter-rater/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts): Updated import route to read request `arrayBuffer()` and parse using `decompressSlrServer`, accepting both compressed GZIP payloads and uncompressed JSON text.
  - Modified [`src/app/api/rolling-batch/import/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Updated import route to read request `arrayBuffer()` and parse using `decompressSlrServer`.
  - Modified [`src/components/InterRaterDashboard.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/InterRaterDashboard.tsx) & [`src/hooks/useRollingBatch.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useRollingBatch.ts): Sent binary `arrayBuffer()` directly with `application/octet-stream` during import uploads to minimize client upload overhead.
  - Modified [`src/components/features/post-validation/ImportBatchStandbyModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/ImportBatchStandbyModal.tsx): Updated file loader to use `decompressSlrBrowser` for client-side pre-validation and reconciliation of reviewer files.
- **Verification**: Verified TypeScript compilation with 0 errors (`npx tsc --noEmit`); ran cross-platform compression tests (`scripts/test-compression.mjs`) confirming 99.5% compression ratio on base64 PDF payloads.

## #378 - Fix Lock Screen Stuck UI, Global Modal Lifting & Executive Command Center Dashboard Redesign (2026-08-15)
- **Goal**: Fix the UI getting stuck when clicking 'Create Project' from the empty-project Lock Screen (`ProjectLockScreenModal`), lift project modals out of isolated tab views into the global layer (`GlobalModals`), and overhaul the Project Dashboard and Project Settings UI into a modern, high-aesthetic Executive Command Center.
- **Root Cause & Fix for Stuck UI**:
  - `CreateProjectModal` was previously rendered exclusively inside `DashboardView.tsx`. When zero projects existed, `ProjectLockScreenModal` rendered a full-screen blurred backdrop with `z-50` that did not yield or unmount when `showCreateProjectModal` became true, trapping the creation modal behind the lock screen overlay and rendering the UI non-responsive.
  - Lifted `CreateProjectModal`, `ProjectSettingsModal`, `ArchiveProjectModal`, and `ImportProjectModal` into `GlobalModals.tsx` and updated `ProjectLockScreenModal` in `page.tsx` with conditional unmounting (`isOpen={... && !showCreateProjectModal && !showImportModal && !showLockScreenImportModal}`).
- **Key Enhancements**:
  1. **Create Project Modal (`CreateProjectModal.tsx` & `useProjectForm.ts`)**: Added real-time auto-slug generation from project titles with manual slug override, structured card sections with iconography, smart default pool sizes (50/30/20), and cloud sync presets.
  2. **Project Settings Modal (`ProjectSettingsModal.tsx`)**: Expanded modal width to `max-w-4xl` with glassmorphic styling, icon pill tab navigation (`Scope & Search Queries`, `Calibration & Pools`, `Cloud Sync & Rclone`, `Budget & Safety`), and sticky header/footer.
  3. **Project Settings Sub-Components**:
     - `ProjectMetadataSettings.tsx`: Added copy-to-clipboard buttons for Scopus & Google Scholar query strings, monospaced query textareas, and enhanced Jinja2 Umbrellanizer RQ description mapping.
     - `ProjectCalibrationSettings.tsx`: Redesigned pool switcher tabs with chip badges, visual EC rules mapper, reasoning templates, and fatal-flaw QA rules.
     - `ProjectSyncSettings.tsx`: Added cloud provider card buttons (Google Drive / OneDrive), diagnostics connection test widget with animated spinner, and Rclone setup guide.
  4. **Executive Command Center Dashboard (`DashboardView.tsx`)**:
     - Created top Executive Hero Command Banner with live active project badges, creation timestamps, overview metric counters, and direct action shortcuts.
     - Upgraded `MetricSummaryCards.tsx` into an interactive 4-Stage Pipeline Funnel (Fast Filter -> Gatekeeper -> Scientist -> Miner) with stage indicators, drop-offs, and missing variable analytics.
     - Enhanced `LocalPDFStatusChart.tsx` with asset storage and cloud mirror telemetry meters.
     - Refactored Projects Manager table with real-time text search filtering across project names, slugs, and cloud providers.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit` exited with code 0).

## #377 - Synchronize Project Repo Folder Cleanup on Confirm Wipe Project (2026-08-15)
- **Goal**: Align the **Confirm Wipe Project** (`DELETE /api/projects/[id]`) workflow so that deleting a project also removes the project workspace directory (`pdf_library/repo/<folder_name>/`), while keeping the eternal PDF library (`raw` and `cached` directories) 100% untouched.
- **Changes**:
  - Modified [`src/app/api/projects/[id]/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/[id]/route.ts):
    1. Fetched `folder_name` from project record and deleted the project repository directory (`pdf_library/repo/<folder_name>/`) with `fs.rmSync`.
    2. Kept `pdf_library/raw/` and `pdf_library/cached/` 100% untouched as eternal storage.
    3. Purged all 15 project-tied database tables inside an atomic transaction (`reviewer_decisions`, `calibration_commit_ledger`, `calibration_papers`, `manual_audit_log`, `llm_audit_log`, `duplicate_pairs`, `rolling_batches`, `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`, `umbrellanizer_results`, `llm_jobs`, `prompt_templates`, `papers`, `projects`).
    4. Executed `PRAGMA wal_checkpoint(TRUNCATE)`, `VACUUM`, and `PRAGMA optimize` to reclaim disk space.
  - Modified [`src/components/features/modals/DeleteProjectConfirmModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/DeleteProjectConfirmModal.tsx): Updated user-facing confirmation modal explanation to explicitly describe repo folder deletion and eternal PDF preservation.
- **Verification**: Verified TypeScript compiler check with 0 errors (`npx tsc --noEmit`).

## #376 - Fix Foreign Key Constraint and Primary Key ID Preservation in Reimport Pipeline (2026-08-15)
- **Goal**: Resolve `SqliteError: FOREIGN KEY constraint failed at insertAdaptiveRow (archive-service.ts:452:10)` during `.slr` project reimport.
- **Root Cause**: `insertAdaptiveRow` previously filtered out all `id` columns indiscriminately (`k.toLowerCase() !== 'id'`). For tables that use `id TEXT PRIMARY KEY` (such as `rolling_batches(id)`), the batch ID was stripped on insertion, causing child relational tables (`rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`) that reference `batch_id REFERENCES rolling_batches(id)` to fail foreign key validation.
- **Changes**:
  - Modified [`src/lib/services/archive-service.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/archive-service.ts):
    1. Added `omitId: boolean = false` parameter to `insertAdaptiveRow`, only omitting auto-generated integer IDs for logging tables (`reviewer_decisions`, `manual_audit_log`, `llm_audit_log`, `calibration_commit_ledger`, `duplicate_pairs`) while strictly preserving primary text IDs for `rolling_batches`, `projects`, `prompt_templates`, and `llm_jobs`.
    2. Wrapped the entire restore transaction inside `db.pragma('foreign_keys = OFF')` ... `try { importTransaction() } finally { db.pragma('foreign_keys = ON') }` to prevent intermediate constraint errors during relational restore.
  - Updated [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs): Added unit tests verifying complex relational imports across `rolling_batches`, `rolling_batch_papers`, and `rolling_batch_reviewer_decisions` with active foreign key verification (`PRAGMA foreign_key_check` returning 0 violations).
- **Verification**: Ran `node scripts/test-archive-service.mjs` (0 FK violations) and verified TypeScript compilation with 0 errors (`npx tsc --noEmit`).

## #375 - Fix Project Archive Payload Format Normalization in Reimport Pipeline (2026-08-15)
- **Goal**: Resolve `Failed to import project archive: Error: Unrecognized archive format` during `.slr` project reimport.
- **Root Cause**: The archive exporter created payload objects with `{ manifest: { format: 'SLR_PROJECT_ARCHIVE', ... }, tables: { ... } }`, leaving root `payload.format` undefined. The reimport normalizer in `archive-service.ts` strictly required root `archiveData.format === 'SLR_PROJECT_ARCHIVE'`, causing genuine `.slr` archives containing `archiveData.tables` or `archiveData.manifest` to throw an unrecognized format exception.
- **Changes**:
  - Modified [`src/lib/services/archive-service.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/archive-service.ts):
    1. Added `format: 'SLR_PROJECT_ARCHIVE'` directly to the root of `ProjectArchivePayload` and export payload objects.
    2. Rewrote payload normalization in `importProjectArchive` to transparently unwrap nested payload keys (`archiveData`, `data`), parse JSON strings, and recognize standard table maps (`archiveData.tables`), manifests (`archiveData.manifest`), legacy FAIR dumps (`archiveData.project` / `archiveData.papers`), and session snapshots (`archiveData.session`).
    3. Added metadata fallbacks ensuring missing `name` or `id` fields are auto-filled from manifests or table records.
  - Modified [`src/app/api/projects/import/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/import/route.ts): Accepted both direct payload bodies and wrapped `{ archiveData: ... }` request formats.
  - Updated [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs): Added unit tests for standard payloads, wrapped payloads, stringified payloads, and legacy FAIR dumps.
- **Verification**: Ran `node scripts/test-archive-service.mjs` (all tests passed) and verified TypeScript compilation with 0 errors (`npx tsc --noEmit`).

## #374 - Project Archiving, Zero-Trace Database Purge, Eternal PDF Preservation & Adaptive Reimport Pipeline (2026-08-15)
- **Goal**: Enable complete system load and database performance optimization when projects conclude or when new projects are created. Allow users to archive old projects to local `.slr` files or Rclone cloud destinations, execute a 100% zero-trace database purge with SQLite `VACUUM` space reclamation, preserve raw/cached PDFs in eternal storage, optionally retain project repo PDFs as `.zip`, and provide flawless reimport compatibility with dynamic schema adaptation and cascading ID collision remapping.
- **Architectural Implementation**:
  1. **Project-Scoped Paper IDs**: Modified `generatePaperId` in `papers/route.ts` to incorporate `Project_ID` and append a 4-character MD5 project hash (`${author}_${year}_${shortTitle}_${hashStr}_${projSuffix}`) ensuring all newly generated Paper IDs are unique to their respective project from inception.
  2. **Core Archive Service (`archive-service.ts`)**:
     - `exportProjectArchive`: Exports project manifest and all 15 project-scoped tables (`projects`, `papers`, `calibration_papers`, `reviewer_decisions`, `calibration_commit_ledger`, `manual_audit_log`, `llm_audit_log`, `duplicate_pairs`, `rolling_batches`, `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`, `umbrellanizer_results`, `llm_jobs`, `prompt_templates`) with SHA-256 integrity checksum and versioned manifest metadata.
     - `createProjectPdfZipBuffer`: Bundles project repository PDFs (`pdf_library/repo/<folder_name>/`) into an in-memory `.zip` archive buffer via Python `zipfile`.
     - `purgeProjectZeroTrace`: Executes an atomic transaction deleting records across all 15 database tables for the project, safely deletes the project repo folder while keeping `pdf_library/raw/` and `cached/` intact as eternal storage, resets active project configuration, and executes `PRAGMA wal_checkpoint(TRUNCATE)`, `VACUUM`, and `PRAGMA optimize`.
     - `importProjectArchive`: Dynamically inspects live database PRAGMA table info, runs version schema normalizers, resolves project ID/folder collisions with automatic non-colliding slug generation, deconflicts Paper ID collisions with cascading foreign key remapping across all 11+ relational tables, and executes the entire restore in a single atomic transaction with 100% rollback protection.
  3. **REST Endpoints**:
     - [`GET /api/projects/archive`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/archive/route.ts): Handles direct streaming download of `.slr` JSON archives and `.zip` project PDF packages.
     - [`POST /api/projects/archive`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/archive/route.ts): Orchestrates archive creation, optional Rclone cloud upload (`<Dest_Path>/Archives/<Project_Name>_archive.slr`), and zero-trace database purge.
     - [`POST /api/projects/import`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/import/route.ts): Handles uploading and restoring `.slr` project archives.
  4. **Frontend Modals & UI Controls**:
     - Created [`src/components/features/modals/ArchiveProjectModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ArchiveProjectModal.tsx): Glassmorphic modal providing archive destination selection (Local File / Cloud Sync), project PDF zip download toggle, confirmation phrase security lock, and real-time execution feedback.
     - Created [`src/components/features/modals/ImportProjectModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ImportProjectModal.tsx): Drag-and-drop archive inspector with client-side manifest preflight inspection (paper counts, audit log volume, schema version, integrity badge) and one-click restore.
     - Updated [`src/hooks/useProjects.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useProjects.ts), [`DashboardView.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/DashboardView.tsx), [`ProjectManager.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/ProjectManager.tsx), [`ProjectLockScreenModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ProjectLockScreenModal.tsx), and [`app/page.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx) with multi-tab `broadcastSync` integration.
- **Verification**:
  - TypeScript compiler verified with 0 errors (`npx tsc --noEmit` exited with code 0).
  - Executed automated anti-regression test suite [`scripts/test-archive-service.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-archive-service.mjs) passing 6/6 test stages (Schema init, Seed records, SHA-256 export assembling, Zero-trace database purge, Adaptive Reimport & Cascading ID remapping, Project-scoped Paper ID hash uniqueness).

## #373 - Fix Multi-Project Scoping & Target Project Selection in SLR Viewer Snapshot Export (2026-08-15)
- **Goal**: Fix incorrect project being exported and missing data rendering in `slr-viewer`.
- **Root Causes**:
  1. `/api/export/slr-viewer/route.ts` previously had a silent fallback (`SELECT * FROM projects ORDER BY id ASC LIMIT 1`) that defaulted to the first alphabetical project in the database rather than the active project (`getConfig('ACTIVE_PROJECT_ID', '')`) or target project.
  2. SQL queries across `papers`, `calibration_papers`, and `rolling_batch_papers` in `route.ts` used strict equality without `CAST(? AS TEXT)` fallback, leading to potential data exclusion when project IDs alternate between string UUIDs and numeric integers.
  3. `FairDataExportPanel.tsx` in `slr-ide` lacked explicit target project selection and verification metadata, causing users to export whatever project was currently active without visual confirmation.
  4. In `slr-viewer`, `ImportWorkflow.tsx` did not refresh session lists on import, and `ViewerContext.tsx` defaulted to `insight-export-rigor` when empty rather than `dashboard`.
- **Changes**:
  - Modified [`src/app/api/export/slr-viewer/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Resolved project metadata strictly using `targetProjectId` with fallback to `getConfig('ACTIVE_PROJECT_ID', '')` and return descriptive 404 on missing projects. Enforced `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))` across all SQLite queries.
  - Modified [`src/components/features/insight-export/FairDataExportPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FairDataExportPanel.tsx): Added Target Project Selector dropdown and Project Verification Banner showing project ID, pool sizing targets, and description.
  - Modified [`src/types/index.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/types/index.ts): Added `description?: string` to `Project` interface.
  - Modified [`slr-viewer/src/context/ViewerContext.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/context/ViewerContext.tsx): Added `loadSessions` to context value, refreshed session list on `switchSession`, and defaulted to `dashboard` when no sessions are active.
  - Modified [`slr-viewer/src/components/ImportWorkflow.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/ImportWorkflow.tsx): Integrated `loadSessions` and immediate `switchSession` upon successful snapshot import.
  - Modified [`slr-viewer/src/components/scientific-rigor/PoolMetricsPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/PoolMetricsPanel.tsx): Updated property lookups to support `activeProj.pool_a_count` / `activeProj.pool_a_size` directly.
- **Verification**: Verified TypeScript compilation with `npx tsc --noEmit` in `slr-ide` (0 errors), `npm run typecheck` in `slr-viewer` (0 errors), and `npm run build` in `slr-viewer` (built in 1.83s).

## #372 - Resolve Circular JSON Structure Bug in SLR Viewer Export Route (2026-08-15)
- **Goal**: Resolve `TypeError: Converting circular structure to JSON ... property 'extracted_data' closes the circle` during `.slr-viewer` snapshot file export in `slr-ide`.
- **Root Cause**: In-place mutation `aiExtracted.extracted_data = aiExtracted.extracted_data || aiExtracted` caused self-referencing circular references when merging Miner logic traces from `llm_audit_log`.
- **Changes**:
  - Modified [`src/app/api/export/slr-viewer/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Shallow cloned `rawExt` and `rawQa` objects, stripped internal metadata keys, and constructed a clean, non-circular `{ extracted_data, logic_trace }` / `{ qa_scores, logic_trace }` payload with merged `extraction_mapping` and `appraisal_reasoning` traces.
- **Verification**: Verified TypeScript compilation with `npx tsc --noEmit` (0 errors).

## #371 - Reviewer-Grade Statistical Granularity & Ratio Customization Engine (n/N, Coarse Precision, Combination Display) (2026-08-15)
- **Goal**: Tackle strict peer reviewer critiques regarding pseudo-precise decimals on small cohort sizes (e.g. $N = 18$, where 1 paper accounts for $5.56\%$ and 2 papers for $11.11\%$). Enable comprehensive user customization across all chart labels, legends, tooltips, breakdown tables, and cross-tabulation matrices with configurable decimal precision (0, 1, 2), coarse approximation tildes (`~`), ratio formats (`n = x/N`, `x/N`, `(x/N)`), and context-aware denominator resolution.
- **Changes**:
  - Created [`src/components/features/modals/visualizer/utils/formatterUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/formatterUtils.ts): Pure utility providing `formatPercentage`, `formatRatio`, and master `formatMetricDisplay` supporting 12 publication templates (e.g., `ratio_percent`, `name_ratio_percent`, `percent_ratio`, `ratio_only`, `name_ratio`, `count_percent`).
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts): Added `DecimalPrecision`, `RatioStyle`, `DisplayFormatTemplate`, and expanded `GlobalStyleConfig`, `SlotConfig`, `SunburstLevelConfig`, and `VisualizerPresetPayload`.
  - Modified [`src/components/features/modals/visualizer/constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Added default slot formatting attributes (`labelFormat: 'ratio_percent'`).
  - Modified [`src/components/features/modals/visualizer/generators/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/types.ts), [`categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts), [`clusteredBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/clusteredBarGenerators.ts), [`hierarchicalGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts), [`proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts), and [`generators/index.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/index.ts): Wired chart label, slice label, tooltip, and legend formatters to use `formatMetricDisplay` and context-aware denominators ($N = \text{cohortPapers}$ or $N = \text{extractedTags}$).
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerStyle.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerStyle.ts), [`useVisualizerConfig.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts), and [`context/VisualizerProvider.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/context/VisualizerProvider.tsx): Propagated global style precision defaults and slot-level format overrides.
  - Modified [`src/components/features/modals/visualizer/utils/smartOptimizer.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/smartOptimizer.ts): Added smart small-cohort thresholding ($N \le 30$) to automatically suggest coarse rounding (0 decimals, `~` tilde prefix, `n/N` ratio style).
  - Modified [`src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Added dedicated **Peer Reviewer Statistical Granularity** card with decimal selector, ratio style selector, tilde toggle, denominator toggle, global default label/legend format selectors, and real-time live preview banner.
  - Modified [`HorizontalBarConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/HorizontalBarConfigPanel.tsx), [`ClusteredBarConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ClusteredBarConfigPanel.tsx), [`SunburstLevelConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/SunburstLevelConfigPanel.tsx), and [`ChartConfigPanels.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ChartConfigPanels.tsx): Upgraded all panel format selects with new combination templates.
  - Modified [`BreakdownTablePanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/BreakdownTablePanel.tsx) and [`CrossTabMatrixPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/CrossTabMatrixPanel.tsx): Synchronized decimal precision and ratio display.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added unit test #15 validating statistical precision, tildes, ratio formats, and context-aware denominators.
- **Verification**: Anti-regression test suite passed (15/15 tests passed with code 0); TypeScript compiler verified with 0 errors (`npx tsc --noEmit`).

## #370 - Granular Label Format Selection in Sunburst Ring Parameters (2026-08-14)
- **Goal**: Add slice label format customization options within **Sunburst Ring Chart Specific Parameters** (per-ring and batch all rings) allowing users to select how slice labels are displayed (`Category Name Only`, `Name + Count`, `Name + Percent`, `Name + Count + Percent`, `Count / Value Only`, and `Percent Only`).
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts) and [`constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Added `labelFormat` to `SunburstLevelConfig` (default: `'name'`).
  - Modified [`src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts): Computed total sunburst value and dynamic slice label formatting in `labelObj.formatter` supporting all 6 formatting variants across radial, tangential, and flat orientations.
  - Modified [`src/components/features/modals/visualizer/components/subcomponents/SunburstLevelConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/SunburstLevelConfigPanel.tsx): Added interactive **Slice Label Format** dropdown per level tab with one-click **"Apply to All Levels"** action button.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added unit test #14 verifying Sunburst level slice label formatting across all variants.
- **Verification**: Anti-regression test suite passed (14/14 tests passed with code 0).

## #369 - Universal Legend Distance & Chart Offset Customization (2026-08-14)
- **Goal**: Enable fine-grained user control over the distance between the main chart and its legend (`legendDistance`) across all chart families (Sunburst, Pie/Donut, Horizontal/Vertical/Clustered/Stacked Bar, Treemap, etc.) with dynamic UI sliders and quick presets (`Edge 10px`, `Standard 20px`, `Spaced 45px`, `Close to Chart 75px`).
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts), [`constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts), and [`hooks/useVisualizerConfig.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts): Added `legendDistance` to `SlotConfig` (default: 20px, range: 5px–120px) with reactive getters and setters.
  - Modified [`src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts): Applied `legendDistance` to Sunburst legend positions and dynamically adapted the chart horizontal center (`defaultCenterX: 32%-48%`) based on distance offset.
  - Modified [`src/components/features/modals/visualizer/generators/proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Applied `legendDistance` to Pie/Donut custom legend positioning (`left`, `right`, `top`, `bottom`).
  - Modified [`src/components/features/modals/visualizer/generators/index.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/index.ts), [`categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts), and [`clusteredBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/clusteredBarGenerators.ts): Applied `legendDistance` to `baseLegend` and bar legend position maps.
  - Modified [`src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Added dedicated **Legend Distance to Main Chart** slider and quick preset chips.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added unit test #13 verifying legend position distance offsets.
- **Verification**: Anti-regression test suite passed (13/13 tests passed with code 0); TypeScript compilation check passed (`npx tsc --noEmit` exited with code 0).

## #368 - Fix Sunburst Legend Format Override (2026-08-14)
- **Goal**: Fix issue where selecting custom Legend Label Formats for Sunburst charts (such as `Name + Count + Percent`) did not apply due to truthy fallback short-circuiting in `hierarchicalGenerators.ts` (`ctx.legendFormat || sunburstLegendFormat || 'name'`), and synchronize setters in `useVisualizerConfig.ts`.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts): Updated format prioritization to `sunburstLegendFormat || ctx.legendFormat || 'name'`, ensuring user-selected level legend formats are directly applied to ECharts legend series data.
  - Modified [`src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts): Updated format prioritization to `barLegendFormat || ctx.legendFormat || 'name'`.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts): Updated `setSunburstLegendFormat` and `setBarLegendFormat` to synchronize `legendFormat` in active slot state.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added unit test #12 validating Sunburst legend format priority and formatting output.
- **Verification**: Anti-regression test suite passed (12/12 tests passed with code 0); TypeScript compilation check passed (`npx tsc --noEmit` exited with code 0).

## #367 - Fix Sunburst Chart Invisible Rendering (Scale Factor Normalization) (2026-08-14)
- **Goal**: Resolve issue where Sunburst charts rendered as a blank/empty canvas with only legends visible due to scale factor miscalculation (`chartScale / 100` dividing unit scale `1.0` into `0.01`, collapsing all level radii `r0`/`r` and total series radius to 0%).
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts): Corrected `scaleFactor` computation to `const scaleFactor = chartScale > 10 ? chartScale / 100 : (chartScale || 1.0);`, properly preserving full 100% (1.0x) dimensions for Level 0 (`r0: 15%, r: 40%`), Level 1 (`r0: 40%, r: 75%`), and outer bounds.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added unit test #11 to ensure Sunburst scale factor and ring radii always resolve accurately.
- **Verification**: Anti-regression test suite passed (11/11 tests passed with code 0); TypeScript compilation check passed (`npx tsc --noEmit` exited with code 0).

## #366 - Granular Label Line Height Customization (2026-08-14)
- **Goal**: Enable fine-grained user control over the vertical spacing / line height of multi-line data and slice labels (`pieLineHeight`) with dynamic interactive sliders and presets (`Tight 12px`, `Standard 15px`, `Relaxed 20px`, `Spaced 26px`).
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts), [`constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts), and [`hooks/useVisualizerConfig.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts): Added `pieLineHeight` and setter/getter to `SlotConfig` (default: 15px, range: 10px–32px).
  - Modified [`src/components/features/modals/visualizer/generators/proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Connected `lineHeight: pieLineHeight ?? 15` in `labelConfig` for ECharts series.
  - Modified [`src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Added dedicated **Label Line Height** slider with preset quick buttons (`Tight`, `Standard`, `Relaxed`, `Spaced`).
  - Modified [`src/components/features/modals/visualizer/generators/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/types.ts), [`generators/index.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/index.ts), [`context/VisualizerProvider.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/context/VisualizerProvider.tsx), and [`utils/smartOptimizer.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/smartOptimizer.ts): Forwarded and auto-tuned `pieLineHeight`.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added `pieLineHeight` assertion to test 10.
- **Verification**: Anti-regression test suite passed (10/10 tests passed with code 0); TypeScript compiler passed (`npx tsc --noEmit` exited with code 0).

## #365 - Granular Chart-to-Label Distance & Quick Chart Sizing/Zoom Controls (2026-08-14)
- **Goal**: Allow users to directly adjust the distance between chart geometry and data/slice labels via granular leader line length sliders (`pieLeaderLineLength`, `pieLeaderLineLength2`, `pieLabelDistance`, `barLabelDistance`); unclamp outer radius limits so users can freely resize charts from compact (25%) to full canvas fill (85%); add direct Quick Chart Size & Zoom controls (`[-] 100% [+]`) directly in the Preview Stage toolbar and Step 3 style panels.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts), [`constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts), and [`hooks/useVisualizerConfig.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts): Added `pieLeaderLineLength`, `pieLeaderLineLength2`, `pieLabelDistance`, and `barLabelDistance` to `SlotConfig` with full reactive getters and setters.
  - Modified [`src/components/features/modals/visualizer/generators/proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Unclamped artificial 50% radius ceiling, allowing full user radius scaling up to 88% on canvas; integrated `pieLeaderLineLength` (first line segment distance), `pieLeaderLineLength2` (elbow gap), and `pieLabelDistance` (label gap).
  - Modified [`src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts): Supported `barLabelDistance` on both horizontal and vertical bar data labels.
  - Modified [`src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Added dedicated **Chart Size & Radius** panel (Outer Radius scale 25%–85% with quick presets: Compact, Standard, Large, Fill Canvas) and **Distance Between Chart & Label** panel (Leader line length 2–50px with presets: Tight, Normal, Spaced, Extended).
  - Modified [`src/components/features/modals/visualizer/components/Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx): Added prominent **Chart Size / Zoom widget** (`[-] 100% [+] [Reset]`) on the preview stage top toolbar for instant resizing.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerCamera.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerCamera.ts): Added `handleZoomIn` and `handleZoomOut` helpers.
  - Modified [`src/components/features/modals/visualizer/components/subcomponents/HorizontalBarConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/HorizontalBarConfigPanel.tsx) & [`ChartConfigPanels.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ChartConfigPanels.tsx): Added interactive **Distance Between Bar & Label** sliders.
  - Modified [`src/components/features/modals/visualizer/utils/smartOptimizer.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/smartOptimizer.ts): Configured generous defaults (radius: 64%–70%, leader line: 12px) during automatic optimization.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Updated unit test assertions for new radius scale and leader line length.
- **Verification**: Anti-regression test suite passed (10/10 tests passed with code 0); TypeScript compiler passed (`npx tsc --noEmit` exited with code 0).

## #364 - Single Publication Preview Fix, Duplicate Title Removal & Smart Auto-Optimizer (2026-08-14)
- **Goal**: Eliminate title duplication between stage/export canvas headers and ECharts slot canvases, fix single figure preview flex stretching and vertical collapse within locked aspect-ratio frames, enhance Pie/Donut positioning and collision avoidance, introduce intelligent automated parameter heuristic optimization (`smartOptimizer.ts`), and build comprehensive parameter customization UI (`ChartConfigPanels.tsx`) across all 18 chart formats.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/context/VisualizerProvider.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/context/VisualizerProvider.tsx): Eradicated duplicate internal canvas titles in single/multi-panel figures by setting `chartTitle: ''`, `chartSubtitle: ''`, `showChartTitle: false`, and `showChartSubtitle: false` in slot option generators, relying entirely on the master Stage and Export Canvas header.
  - Modified [`src/components/features/modals/visualizer/components/Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx): Updated grid container classes (`w-full h-full flex flex-col flex-1 min-h-0`) and slot wrapper (`flex-1 min-h-0`) so Single Publication Figures stretch to fill 100% of the aspect-ratio frame without squishing or clipping; added top-bar `Smart Auto-Optimize` action button.
  - Created [`src/components/features/modals/visualizer/utils/smartOptimizer.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/smartOptimizer.ts): Implemented dataset-aware heuristic optimizer computing cardinality, skewness, max category dominance, and text lengths to auto-tune bar orientation, sorting, axis widths, donut radius, label placement, legend position, and error bars.
  - Created [`src/components/features/modals/visualizer/components/subcomponents/ChartConfigPanels.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ChartConfigPanels.tsx): Built modular parameter configuration panels for Vertical Bar, Stacked Bar, Line, Treemap, Heatmap, Radar, Funnel, Boxplot, Graph, Gauge, Calendar, and Scatter/Bubble charts.
  - Modified [`src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Integrated modular config panels for all 18 chart types and added prominent `⚡ Smart Auto-Optimize` quick-action button in header and specific parameters section.
  - Modified [`src/components/features/modals/visualizer/components/Step1ChartSelector.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step1ChartSelector.tsx) & [`Step2DataMapping.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step2DataMapping.tsx): Connected intelligent auto-optimization triggers during chart type selection and field mapping.
  - Modified [`src/components/features/modals/visualizer/generators/proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Enhanced donut/pie geometry calculation, horizontal centering (`centerX: 42%-45%` when right-aligned legends are present), outer radius scale, and leader lines collision avoidance.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added anti-regression unit test #10 validating smart auto-optimizer parameter tuning.
  - Modified [`files.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Registered new files and architectural layers.
- **Verification**: Anti-regression test suite passed (10/10 tests passed with code 0); TypeScript compilation check passed (`npx tsc --noEmit` exited with code 0).

## #363 - Centralized Taxonomy Resolver & Cohort Metrics Source of Truth (2026-08-14)
- **Goal**: Establish a unified, centralized taxonomy resolution and cohort metric calculation source of truth (`taxonomy-resolver.ts` and `cohort-metrics.ts`) across all UI modules, modals, and export endpoints in `slr-ide`, eliminating fatal substring collisions on compound technical terms (`1D CNN-LSTM`, `CNN-LSTM`, etc.) and resolving metric conflations between Unique Paper Prevalence and Tag Share distributions.
- **Changes**:
  - Created [`src/lib/services/taxonomy-resolver.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/taxonomy-resolver.ts): Implemented `resolveUmbrellanizerValue`, `getUmbrellanizerJustification`, `normalizeExtractedTokens`, `canonicalizeString`, and `extractPaperFieldValues` with exact canonical case-insensitive and dash-normalized string equality, eliminating loose `.includes()` substring collisions.
  - Created [`src/lib/services/cohort-metrics.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/cohort-metrics.ts): Implemented `calculateCohortVariableMetrics` and `calculateHareHamiltonPercentages` (Largest Remainder Method) for deterministic calculation of unique paper counts, paper prevalence %, tag counts, and quota-balanced tag share %.
  - Modified [`src/components/features/modals/visualizer/utils/dataExtractor.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/dataExtractor.ts): Delegated taxonomy resolution and field value extraction to `taxonomy-resolver.ts`.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerData.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerData.ts): Refactored `realDataBreakdown` to compute both `paperCount` and `tagCount` for every category breakdown row.
  - Modified [`src/components/features/modals/visualizer/components/subcomponents/BreakdownTablePanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/BreakdownTablePanel.tsx): Enhanced table columns to clearly show **Unique Papers ($N$)**, **Paper Prev. %**, **Tag Occurrences**, and **Tag Share %**, adapting validation badges based on active metric mode.
  - Modified [`src/components/features/modals/LlmContextBuilderModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/LlmContextBuilderModal.tsx), [`FinalCohortPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx), [`QuickOverviewModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/QuickOverviewModal.tsx), [`csv-tabular/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/csv-tabular/route.ts), [`slr-viewer/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts), [`cloud-gold-mine/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/route.ts), and [`preview/route.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/preview/route.ts): Replaced islanded lookups with centralized services.
  - Modified [`agents.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/agents.md): Added Section **3.10 Mandatory Centralized Taxonomy & Cohort Metrics Protocol**.
  - Modified [`files.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Registered new service files.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added anti-regression unit tests for compound algorithm token collision prevention and tri-modal mathematical invariance.
- **Verification**: Anti-regression test suite passed (9/9 tests passed with code 0); TypeScript compiler passed (`npx tsc --noEmit` exited with code 0); SQLite database live check verified exact agreement ($N=9$ unique papers, $11$ tags).

## #362 - Granular Y-Axis Label Line Height, Font Size Sliders & Dynamic Wrap Thresholds (2026-08-14)
- **Goal**: Allow users to directly customize Y-Axis category label `Line Height` (8–32px) and `Label Font Size` (8–18px) for Horizontal Bar and Clustered Bar charts; calculate dynamic line wrapping character thresholds derived from `barYAxisWidth` and font size to eliminate text collisions on multi-line category labels.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts) & [`constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Added `barLineHeight: 14` and `barYAxisFontSize: 11` to `SlotConfig` and presets.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts) & [`VisualizerProvider.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/context/VisualizerProvider.tsx): Exposed getters/setters and mapped properties to chart options builder.
  - Modified [`src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts) & [`clusteredBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/clusteredBarGenerators.ts): Applied user-defined `lineHeight` and dynamic `charLimit = Math.max(14, Math.floor((barYAxisWidth - 10) / (effFont * 0.55)))` to prevent text overlaps.
  - Modified [`src/components/features/modals/visualizer/components/subcomponents/HorizontalBarConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/HorizontalBarConfigPanel.tsx) & [`ClusteredBarConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ClusteredBarConfigPanel.tsx): Added interactive sliders for `Line Height` (8–32px) and `Label Font Size` (8–18px).
- **Verification**: Anti-regression unit tests passed (7/7); TypeScript compiler passed (`npx tsc --noEmit` exited with code 0).

## #361 - Publication-Standard Clustered & Comparative Bar Chart with Error Bars & Texture Hatching (2026-08-14)
- **Goal**: Implement publication-standard multi-series Clustered / Comparative Bar Chart (`clustered_bar`) supporting horizontal and vertical orientations, dual-dimension cross-tabulation, statistical dispersion error bars ($\pm\text{SD}$, $\pm\text{SE}$, $95\%\text{ CI}$), monochrome texture pattern fills for print/grayscale accessibility, scientific axis controls, and interactive 2D cross-tabulation matrix inspection.
- **Changes**:
  - Created [`src/components/features/modals/visualizer/generators/clusteredBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/clusteredBarGenerators.ts): Implemented `generateClusteredBarOption` for multi-series grouped horizontal and vertical bars with 2D co-occurrence matrix evaluation, aggregate cluster sorting, reference benchmark line, and journal styling.
  - Created [`src/components/features/modals/visualizer/utils/statisticalUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/statisticalUtils.ts): Implemented descriptive statistical calculation library ($\mu, \sigma^2, \text{SD}, \text{SE}, 95\%\text{ CI}$).
  - Created [`src/components/features/modals/visualizer/utils/hatchPatternUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/hatchPatternUtils.ts): Implemented 8 monochrome texture pattern generators (stripes, cross-hatch, stippling, dots) for print and colorblind accessibility (WCAG 2.1 AAA).
  - Created [`src/components/features/modals/visualizer/components/subcomponents/ClusteredBarConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ClusteredBarConfigPanel.tsx): Added modular UI configuration for bar layout orientation, cluster gaps, inner bar gaps, error bars, texture hatching, and individual series color overrides.
  - Created [`src/components/features/modals/visualizer/components/subcomponents/ScientificAxisConfigPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ScientificAxisConfigPanel.tsx): Added modular controls for custom axis titles with metric units, inward/outward tick marks, log/linear scale, and journal baseline borders.
  - Created [`src/components/features/modals/visualizer/components/subcomponents/CrossTabMatrixPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/CrossTabMatrixPanel.tsx): Added tabbed 2D cross-tabulation matrix and flattened table inspection with TSV and CSV export.
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts) & [`constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Added `clustered_bar` to `ChartType`, extended `SlotConfig` and `VisualizerPresetPayload` with scientific properties.
  - Modified [`src/components/features/modals/visualizer/components/Step2DataMapping.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step2DataMapping.tsx), [`Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx), [`subcomponents/BreakdownTablePanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/BreakdownTablePanel.tsx): Integrated data mapping, clustered styling panels, and cross-tabulation breakdown.
  - Modified [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Added anti-regression unit tests for 2D cross-tabulation matrix calculation, statistical dispersion calculations, and preset serialization.
- **Verification**: Anti-regression test suite passed (7/7 tests passed with code 0); TypeScript compiler passed (`npx tsc --noEmit` exited with code 0).

## #360 - Two-Decimal Precision Across All Chart Formats & Legend Labels (2026-08-14)
- **Goal**: Standardize all percentage and metric label representations across all chart generators to two decimal places (e.g. `50.00%`, `33.33%`, `27.78%`, `16.67%`, `11.11%`).
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts): Formatted `prevalencePct`, `tagPct`, and horizontal bar data labels with `toFixed(2)`.
  - Modified [`src/components/features/modals/visualizer/generators/proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Formatted pie and donut slice badges with `toFixed(2)`.
  - Modified [`src/components/features/modals/visualizer/generators/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/types.ts): Formatted `formatLegendLabel` percentages with `toFixed(2)`.
  - Modified [`src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts), [`kpiNetworkGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/kpiNetworkGenerators.ts), [`trendLineGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/trendLineGenerators.ts), and [`generators/index.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/index.ts): Standardized tooltips and legend percentages to `toFixed(2)`.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #359 - Comprehensive Camera & Viewport Transformation & Export Synchronization (2026-08-14)
- **Goal**: Verify and deep-check the Camera & Viewport subsystem to guarantee full parity across live interactive preview, floating camera pad, export sidebar sliders, and PNG/SVG export pipelines without introducing rendering regressions or layout shifts.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerCamera.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerCamera.ts): Normalized `chartScale` default to `1.0` (range 0.5x to 2.0x) and updated camera reset handler.
  - Modified [`src/components/features/modals/visualizer/components/Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx): Applied synchronized CSS 3D matrix transform combining zoom scale (`scale`), directional pan (`translate(panX%, panY%)`), 3D perspective pitch (`rotateX(tiltAngle)`), and Z-rotation (`rotateZ(rotationAngle)`).
  - Modified [`src/components/features/modals/visualizer/components/subcomponents/CameraControlsOverlay.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/CameraControlsOverlay.tsx): Added direct Zoom In (+) / Zoom Out (-) quick-action buttons alongside the pan d-pad and tilt/rotation buttons.
  - Modified [`src/components/features/modals/visualizer/utils/exportUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/exportUtils.ts): Updated `exportFigure` and `exportMultiPanelFigure` to apply exact pan offsets, zoom scaling, 3D pitch tilt, and Z-axis rotation onto the master high-DPI canvas context and SVG transform tree.
  - Modified [`src/components/features/modals/visualizer/hooks/useChartCanvas.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useChartCanvas.ts) & [`VisualizerProvider.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/context/VisualizerProvider.tsx): Wired camera scale and pan coordinates through export handlers.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #358 - Synchronous Frame 0 Export Engine (Animation-Disabled Instant Render) (2026-08-14)
- **Goal**: Resolve blank/empty series in offscreen exports caused by ECharts asynchronous entry animation delays.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/utils/exportUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/exportUtils.ts): Explicitly set `animation: false`, `animationDuration: 0`, and `animationDurationUpdate: 0` on off-screen ECharts instances before capturing raster data URLs and vector SVG strings. This forces synchronous frame-0 geometry evaluation, ensuring all donut slices, data bars, and labels are 100% visible and rendered without delay.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #357 - Pure-Proportion Headless Native Export Engine (Zero Distortion & Crisp Typography) (2026-08-14)
- **Goal**: Resolve the vertical ellipse / donut stretching issue caused by aspect-ratio mismatch between on-screen client DOM boxes and target export rectangles.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/utils/exportUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/exportUtils.ts): Updated the headless off-screen export engine to instantiate each subfigure at the exact base slot dimensions (`chartW`, `chartH`) and sample at `pixelRatio: exportScale` (300+ DPI). This guarantees that the generated subfigure image aspect ratio matches the destination slot rectangle 1:1, completely eliminating oval stretching while maintaining normal-sized, crisp, readable typography.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #356 - 100% True-WYSIWYG PixelRatio Engine & Synchronized Stage Frame (2026-08-14)
- **Goal**: Eliminate font-shrinkage and microscopic text bugs by synchronizing the on-screen locked aspect-ratio stage frame as the single source of truth; capture live ECharts instances via native high-DPI `pixelRatio` multiplier (`1x–4x`) to ensure 100% font, line, and geometry parity between on-screen preview and 300+ DPI export.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/utils/exportUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/exportUtils.ts): Switched export capture to live instance `pixelRatio` sampling directly matching stage slot rectangles, guaranteeing 1:1 proportional font scaling and uncompressed raster drawing.
  - Modified [`src/components/features/modals/visualizer/components/Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx): Embedded figure header and multi-panel grid directly inside the aspect-ratio-locked container for complete geometric and typographic parity with export proofs.
  - Modified [`src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts): Upgraded default horizontal bar thickness to 26px (gap 24%), refined natural word-boundary breaks on Y-axis labels without forced slash splitting.
  - Modified [`src/components/features/modals/visualizer/constants/defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Set default `barThickness: 26`, `barGap: 24`, `barYAxisWidth: 140`.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #355 - Zero-Distortion Native Off-Screen Export Engine & Granular Width Sliders (2026-08-14)
- **Goal**: Eliminate all bitmap scaling distortion during export by introducing headless off-screen native ECharts re-rendering; fix pie outer label character fragmentation (`Hybri\nd`, `N=1\n0`) via explicit label widths, smart shiftY overlap avoidance, and clean 2-line badge formatting; expose granular `Outer Label Max Width` (80–240px) and `Y-Axis Label Width` sliders in Step 3.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/utils/exportUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/exportUtils.ts): Implemented native headless off-screen ECharts instances for each subfigure at exact target print dimensions (`slotW = rect.width * scale`, `slotH = rect.height * scale`), eliminating bitmap stretching and keeping circular donuts mathematically 100% round in both PNG and SVG outputs.
  - Modified [`src/components/features/modals/visualizer/hooks/useChartCanvas.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useChartCanvas.ts): Passed `generateSlotOption` into `exportMultiPanelFigure` to re-generate options off-screen.
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts) & [`defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Added `pieLabelWidth: 140` to `SlotConfig` and presets.
  - Modified [`src/components/features/modals/visualizer/generators/proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Configured explicit `pieLabelWidth`, `minMargin: 6`, `lineHeight: 16`, `labelLayout: { hideOverlap: true, moveOverlap: 'shiftY' }`, and centered the pie at 50% vertical offset for balanced whitespace.
  - Modified [`src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts): Balanced horizontal bar grid margins (`gridLeft = yWidth + 16`, `gridRight = 65`) to reserve 65%+ horizontal width for data bars.
  - Modified [`src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Added `Outer Label Max Width ({pieLabelWidth}px)` slider (80–240px) under Pie/Donut customization.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #354 - Scopus Q1 Journal Publication Export Engine, Aspect Ratio Presets & Collision-Free Layout (2026-08-14)
- **Goal**: Resolve donut/pie legend-slice collisions, auto-wrap long horizontal bar Y-axis labels, and introduce standard Academic Journal Column Width / Aspect Ratio presets (`16:9 Double Column / 190mm`, `16:10 1.5 Column / 140mm`, `4:3 Single Column / 90mm`, `3:2 Academic`, `1:1 Square`, `21:9 Ultra-Wide`, and `Custom mm/in/px`) with locked aspect-ratio preview framing and 300+ DPI high-resolution export.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts) & [`defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Added `AspectRatioPreset`, `DimensionUnit`, `PieLabelPlacement` types and default global style configurations.
  - Modified [`src/components/features/modals/visualizer/generators/proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Implemented collision-free dynamic donut/pie radius (50-54%) and downward center shifting when top legends are active; added smart multi-line outer label word-wrapping (`overflow: 'break'`, `lineHeight: 14`) and support for 4 placement modes (`outside`, `inside`, `edge_aligned`, `legend_only`).
  - Modified [`src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts): Upgraded Y-axis label formatter with intelligent natural word-boundary auto-wrapping to prevent text truncation or awkward overlaps.
  - Modified [`src/components/features/modals/visualizer/utils/exportUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/exportUtils.ts): Added `resolveTargetDimensions()` for exact journal column millimeter/inch calculations and high-DPI (300+ DPI) canvas stitching and vector SVG export.
  - Modified [`Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx): Added Aspect Ratio Locked Frame container with publication dimension indicator for true WYSIWYG proofing.
  - Modified [`ExportPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ExportPanel.tsx): Added Journal Aspect Ratio selector with live print dimension calculator (`mm / in / px @ 300 DPI`).
  - Modified [`Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Added Pie / Donut outer radius slider and label placement selector.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #353 - Canvas Inspection Lifecycle Bug Fix & Universal 4-Mode Legend Formatter (2026-08-14)
- **Goal**: Resolve blank/white canvas bug during subfigure full-resolution inspection transitions and introduce a Universal 4-Mode Legend Formatter (`Name Only`, `Name + Count (N=X)`, `Name + Percent (XX.X%)`, `Name + Count + Percent (N=X, XX.X%)`) across all chart types.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/hooks/useChartCanvas.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useChartCanvas.ts): Hardened DOM node identity tracking, automatic disposal of detached ECharts instances, and instant recreation on DOM mount/unmount.
  - Modified [`src/components/features/modals/visualizer/components/Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx): Preserved permanent continuous DOM nodes in the stage grid using CSS in-place visibility and dimension expansion with animated bulk `.resize()` dispatching upon inspection toggle and exit.
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts) & [`defaultConfigs.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/defaultConfigs.ts): Added `LegendFormat` type (`'name' | 'name_count' | 'name_percent' | 'name_count_percent'`) to `SlotConfig`.
  - Modified [`src/components/features/modals/visualizer/generators/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/types.ts): Exported `formatLegendLabel` utility function for dynamic legend labeling across charts.
  - Modified [`categoricalBarGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/categoricalBarGenerators.ts), [`hierarchicalGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/hierarchicalGenerators.ts), and [`proportionsGenerators.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/generators/proportionsGenerators.ts): Integrated 4-mode legend formatting into Pie/Donut, Bars, and Sunburst.
  - Modified [`Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Added universal Legend Format dropdown under panel legend settings.
- **Verification**: Passed TypeScript compiler check (`npx tsc --noEmit` exited with code 0).

## #352 - Visualizer Fullscreen Workspace, Live Split-Screen Editor & Zen Ergonomics (2026-08-14)
- **Goal**: Add True Edge-to-Edge Fullscreen Workspace mode, Live Split-Screen Interactive Preview in Steps 2 & 3, Step 4 Zen/Theater Mode, Canvas Backdrop Contrast Switchers, Single-Subfigure Deep Inspector, and Keyboard Ergonomics to `VisualizerModal`.
- **Changes**:
  - Created [`src/components/features/modals/visualizer/hooks/useVisualizerWorkspace.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerWorkspace.ts): Custom hook managing `isFullscreen` with persistent local storage, `showLivePreview`, `isZenMode`, `canvasBackdrop`, `inspectedSlot`, and keyboard event dispatcher (`Shift+F`, `Z`, `P`, `1-4`, `Esc`).
  - Modified [`src/components/features/modals/VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx): Supported full edge-to-edge fullscreen viewport scaling (`100vw`/`100vh`) alongside default comfortable dialog mode (`94vw`/`92vh`).
  - Modified [`src/components/features/modals/visualizer/components/VisualizerHeader.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/VisualizerHeader.tsx): Added Fullscreen toggle button, Live Preview toggle button (Steps 2 & 3), Zen Mode toggle (Step 4), and Keyboard Shortcut Cheatsheet modal.
  - Created [`src/components/features/modals/visualizer/components/subcomponents/LiveSplitPreview.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/LiveSplitPreview.tsx): Real-time side-by-side synchronized ECharts preview card for Data Mapping (Step 2) and Style Customization (Step 3).
  - Modified [`Step2DataMapping.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step2DataMapping.tsx) & [`Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx): Integrated responsive split-screen editor layout.
  - Modified [`Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx): Added single-subfigure full-viewport deep inspection mode (`inspectedSlot`), canvas backdrop styling, and Zen Mode collapse integration.
  - Modified [`ExportPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ExportPanel.tsx): Added 4-mode backdrop switcher (Default Slate, Paper White, Dark Stage, Pattern Checkerboard) and quick Zen Mode trigger.
- **Verification**: Verified zero TypeScript errors (`npx tsc --noEmit` exited with code 0).

## #351 - Dynamic Multi-Block & Dual Side-by-Side Chart Composition, Customization, and High-DPI Unified Export (2026-08-14)
- **Goal**: Implement dynamic Multi-Block & Dual Side-by-Side Chart Composition, Customization, and High-DPI Unified Export into `VisualizerModal`, enabling researchers to compose multi-panel figures (Single, Dual 1x2, Dual 2x1, 3-Block, and Quad 2x2), configure independent per-slot chart mappings/groupings, customize journal subfigure labeling (`(a)/(b)`, `(A)/(B)`, `bold A/B`), and export publication-ready composite figures at 300+ DPI.
- **Changes**:
  - Modified [`src/components/features/modals/visualizer/types.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/types.ts): Defined `LayoutMode`, `SlotId`, `SubfigureLabelStyle`, `SlotConfig`, `GlobalStyleConfig`, and `VisualizerPresetPayload` v3.0.
  - Created [`src/components/features/modals/visualizer/constants/layoutPresets.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/constants/layoutPresets.ts): Layout metadata, slot definitions, and subfigure label formatters.
  - Created [`src/components/features/modals/visualizer/hooks/useVisualizerLayout.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerLayout.ts): Custom hook for managing active layout mode, active slot focus, and slot list clamping.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerConfig.ts): Added per-slot state dictionaries, active slot proxying, and instant slot cloning.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerData.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerData.ts): Bound data extraction, custom categories, and breakdown calculations to active slot.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerStyle.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerStyle.ts): Added global academic formatting, subfigure labeling, and panel gutter controls.
  - Modified [`src/components/features/modals/visualizer/hooks/useVisualizerPresets.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useVisualizerPresets.ts): Implemented v3.0 multi-slot preset export/import with transparent legacy v1/v2 single-chart preset migration.
  - Modified [`src/components/features/modals/visualizer/hooks/useChartCanvas.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/hooks/useChartCanvas.ts): Managed isolated multi-instance ECharts lifecycles, resize listeners, and export dispatchers.
  - Modified [`src/components/features/modals/visualizer/utils/exportUtils.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/utils/exportUtils.ts): Built high-DPI composite multi-panel canvas stitcher (1x–4x / 300+ DPI), SVG combiner, and single subfigure exporter.
  - Created [`src/components/features/modals/visualizer/components/subcomponents/LayoutTemplateSelector.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/LayoutTemplateSelector.tsx): Interactive wireframe layout preset cards.
  - Created [`src/components/features/modals/visualizer/components/subcomponents/SlotSwitcherBar.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/SlotSwitcherBar.tsx): Tabbed slot navigation with subfigure badges and "Clone Config" quick actions.
  - Updated [`Step1ChartSelector.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step1ChartSelector.tsx), [`Step2DataMapping.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step2DataMapping.tsx), [`Step3StyleCustomization.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step3StyleCustomization.tsx), [`Step4PreviewStage.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/Step4PreviewStage.tsx), and [`ExportPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/visualizer/components/subcomponents/ExportPanel.tsx).
- **Verification**: Verified zero TypeScript errors with `npx tsc --noEmit`.

## #350 - Visualizer God-Code Modular Refactoring & Clean Code Architecture (2026-08-13)
- **Goal**: Refactor the monolithic 5,285-line (254 KB) `VisualizerModal.tsx` god-component into a clean, modular architecture decomposed into dedicated submodules (<200-300 lines each) under `src/components/features/modals/visualizer/` adhering to Clean Architecture principles, eliminating prop drilling via `VisualizerContext`, partitioning 17 ECharts chart option builders into 7 domain strategy modules, and establishing a zero-regression test suite.
- **Changes**:
  - Created `src/components/features/modals/visualizer/`:
    - **Types (`types.ts`)**: Centralized type contracts (`ChartType`, `ThemePreset`, `FontFamily`, `MetricMode`, `SunburstLevelConfig`, `VisualizerPresetPayload`, `BreakdownRow`, `VisualizerModalProps`).
    - **Constants (`constants/`)**: Modularized 17 scientific chart definitions (`chartTypes.ts`), 16 academic palettes (`themePalettes.ts`), typography resolvers (`fontFamilies.ts`), and baseline configs (`defaultConfigs.ts`).
    - **Pure Utilities (`utils/`)**: Separated mathematical and rendering algorithms: Hare-Hamilton 100.00% quota balancer (`quotaBalancer.ts`), hierarchical color shading (`colorUtils.ts`), multi-value taxonomy extractor (`dataExtractor.ts`), and 3D SVG & high-DPI PNG export engine (`exportUtils.ts`).
    - **Chart Generators (`generators/`)**: Structured 17 chart generators into 7 chart-family strategy modules (`categoricalBarGenerators.ts`, `hierarchicalGenerators.ts`, `trendLineGenerators.ts`, `proportionsGenerators.ts`, `correlationGenerators.ts`, `matrixGenerators.ts`, `kpiNetworkGenerators.ts`) and unified `buildChartOption()` dispatcher.
    - **Focused Custom Hooks (`hooks/`)**: Modularized React state logic into `useVisualizerConfig`, `useVisualizerData`, `useVisualizerStyle`, `useVisualizerCamera`, `useVisualizerPresets`, and `useChartCanvas`.
    - **React Context (`context/`)**: Constructed `VisualizerContext` and `VisualizerProvider` to manage global modal state cleanly and eliminate prop drilling.
    - **Step & Presentation Components (`components/`)**: Created `VisualizerHeader`, `Step1ChartSelector`, `Step2DataMapping`, `Step3StyleCustomization`, `Step4PreviewStage`, and subcomponents (`CustomGroupingManager`, `BreakdownTablePanel`, `SunburstLevelConfigPanel`, `HorizontalBarConfigPanel`, `CameraControlsOverlay`, `ExportPanel`).
  - Refactored [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx): Reduced file from 5,285 lines to a thin 45-line facade orchestrator component.
  - Created [`scripts/test-visualizer-anti-regression.mjs`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/test-visualizer-anti-regression.mjs): Standalone test runner validating quota balancing, color shading, taxonomy extraction, and preset serialization.
  - Modified [`files.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Documented visualizer subpackage directory structure.
- **Verification**: Verified zero TypeScript errors with `npx tsc --noEmit`, passed all 4 anti-regression tests via `node scripts/test-visualizer-anti-regression.mjs`, and successfully executed Next.js production build (`npm run build`).

## #349 - Standardized N= Sample Notation Across Chart Labels & Tooltips (2026-08-13)
- **Goal**: Standardize scientific sample size notation by adding the `N=` prefix whenever paper counts are displayed across chart on-canvas labels, legends, tooltips, and validation tables in `VisualizerModal.tsx`.
- **Changes**:
  - Modified [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Category Tooltips**: Formatted cohort paper count as `Cohort Paper Count: N = ${paperCount} papers (${prevPct}% of cohort)` in `renderCategoryTooltip`.
    - **Horizontal Bar On-Canvas Labels**: Formatted `value_pct` and `count` data labels to display `N=${paperCount} (${activePctStr}%)` or `N=${val}` for explicit sample size clarity.
    - **Legends**: Prefixed paper count in both Horizontal Bar (`${cat} (N=${itemData.paperCount})`) and Sunburst (`${name} (N=${meta.count})`) legend formats.
    - **Validation Table**: Prefixed row paper counts as `N = {row.count} papers` in the cohort data breakdown table.
- **Verification**: Verified clean TypeScript compilation with `npx tsc --noEmit` (0 errors).

## #348 - Dynamic Non-Redundant Category Tooltip Formatter (2026-08-13)
- **Goal**: Implement a dynamic, unified tooltip formatter `renderCategoryTooltip` across all category-based visualizations (`bar_horizontal`, `bar_vertical`, `pie_donut`, `funnel`, `line`) in `VisualizerModal.tsx` that intelligently eliminates duplicate lines when "Paper Prevalence" is the active metric mode, gracefully compounding count and percentage metrics.
- **Changes**:
  - Modified [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Dynamic Formatter Engine**: Created `renderCategoryTooltip` helper inside `generateChartOption` to format category tooltips dynamically.
    - **Zero-Redundancy Compounding**: Combined cohort paper count and prevalence percentage into `Cohort Paper Count: X papers (Y% of cohort)` and share of tags into `Share of Tags: A% (B tags)`.
    - **Active Metric Discrimination**: Conditionally renders the primary active metric header line only when `metricMode` is non-redundant (`avg_citation`, `avg_qa`, `tag_share`), eliminating duplicate `Paper Prevalence` lines when `metricMode === 'paper_prevalence'`.
    - **Universal Adoption**: Adopted `renderCategoryTooltip` across `bar_horizontal`, `bar_vertical`, `pie_donut`, `funnel`, and `line` charts.
- **Verification**: Verified clean TypeScript compilation with `npx tsc --noEmit` (0 errors).

## #347 - Universal Paper Count & Prevalence Alignment Across All Visualizations (2026-08-13)
- **Goal**: Audit and align all single/multi-category visualization charts (`bar_vertical`, `pie_donut`, `funnel`, `line`) in `VisualizerModal.tsx` to strictly distinguish distinct `paperCount` from total `tagCount`, synchronizing rich ECharts tooltip formatters with ground-truth cohort metrics and preventing tag occurrence inflation.
- **Changes**:
  - Modified [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Bar Vertical**: Added distinct `paperCount`, `tagCount`, `prevalencePct`, and `tagPct` to category data points, and upgraded `tooltip.formatter` to show `Cohort Paper Count (${paperCount} papers)`, `Paper Prevalence (${prevalencePct}%)`, and `Share of Tags (${tagPct}%)`.
    - **Pie & Donut Chart**: Passed `totalExtractedTags` to `computeMetricValue` and enriched slice data with `paperCount`, `tagCount`, `prevalencePct`, and `tagPct` with comprehensive tooltip formatting.
    - **Funnel Chart**: Updated funnel stage items to calculate distinct paper counts and tag occurrences, enriching tooltips with exact cohort prevalence percentages.
    - **Line Chart**: Tracked total extracted tags, computed distinct paper IDs for each X-axis category data point, and synchronized tooltips with cohort paper count and tag shares.
- **Verification**: Verified clean TypeScript compilation with `npx tsc --noEmit` (0 errors).

## #346 - Fix Horizontal Bar Tooltip Paper Count & Prevalence Data Mapping (2026-08-13)
- **Goal**: Fix Horizontal Bar Chart (`bar_horizontal`) tooltip and aggregation logic in `VisualizerModal.tsx` to strictly distinguish unique cohort `paper_count` from total `tag_count` (total tag occurrences), ensuring the tooltip's "Cohort Paper Count" and "Paper Prevalence" (% of cohort) accurately reflect distinct paper counts matching the dataset's ground-truth statistics.
- **Changes**:
  - Modified [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **ComputeMetricValue Distinct Calculation**: Updated `computeMetricValue` for `count` and `paper_prevalence` metric modes to compute distinct paper IDs using `new Set(groupPapers.map(p => p.Paper_ID || p.id || p.title || p.Title || p)).size`.
    - **Horizontal Bar Data Properties**: Added distinct `paperCount` (`uniquePaperIds.size`) and `tagCount` (`groupPapers.length`) to `valuesData`. Computed `prevalencePct` as `(paperCount / papers.length) * 100` and `tagPct` as `(tagCount / totalExtractedTags) * 100`.
    - **Tooltip Formatter Synchronization**: Updated ECharts `tooltip.formatter` for `bar_horizontal` to map "Cohort Paper Count" to `dataObj.paperCount` papers, "Paper Prevalence" to `dataObj.prevalencePct% of cohort`, and "Share of Tags" to `dataObj.tagPct% (${dataObj.tagCount} tags)`.
- **Verification**: Verified clean TypeScript compilation with `npx tsc --noEmit` (0 errors).

## #345 - Baked Statistics & LLM Ground-Truth Directives Enrichment (2026-08-13)
- **Goal**: Enrich the exported JSON payload in the LLM Context Builder (`LlmContextBuilderModal.tsx`) with pre-computed, deterministic **baked statistics** and an explicit **LLM System Directives** section (`llm_directives`) to prevent downstream LLMs (such as Gemini 3.1 Pro) from hallucinating calculations, recalculating totals, or deriving erroneous metrics during data visualization and textual narration.
- **Changes**:
  - Modified [`LlmContextBuilderModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/LlmContextBuilderModal.tsx):
    - **Baked Statistics Engine**: Implemented `calculateHareHamiltonPercentages` (Largest Remainder Method) for exact 100.00% quota balancing across category distributions, year distributions, and paper prevalence metrics.
    - **Cohort Metadata Summaries**: Computes year distribution, ranked top authors (with prevalence %), ranked top publishers, and comprehensive QA score statistics (mean, median, min, max, criteria compliance breakdown).
    - **Variable Taxonomy Distributions**: Pre-calculates total papers with data, total extracted tags, NOT_STATED counts & percentages, category counts, tag share % (Hare-Hamilton 100.00% balanced), paper prevalence %, supporting paper_ids arrays, and raw token frequency distributions.
    - **LLM Directives & Ground-Truth Policy**: Formulates explicit `llm_directives` system instructions forbidding recalculation or estimation from the `papers` array and mandating strict consumption of `baked_statistics`.
    - **Interactive Selection UI**: Added **Baked Statistics & Ground-Truth Directives** configuration panel with master toggle and granular sub-checkboxes for LLM Directives, Cohort Summary Stats, Variable Distributions, Category Paper Mappings, NOT_STATED Frequency Metrics, and Raw Token Frequencies.
  - Modified [`files.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Updated `LlmContextBuilderModal.tsx` record.
- **Verification**: Verified clean TypeScript compilation with `npx tsc --noEmit` (0 errors).

## #344 - Horizontal Bar Chart Sunburst Features Adoption & Scientific Visualization Suite (2026-08-13)
- **Goal**: Adopt advanced visualization features from Sunburst into the Horizontal Bar Chart (`bar_horizontal`), expand metric calculations with dual percentage modes (`paper_prevalence` and `tag_share`), eliminate the 99.98% floating-point rounding drift in the Cohort Breakdown Table using Largest Remainder Method (Hare-Hamilton quota), add a configurable scientific Reference Benchmark Line annotation, and support multi-category color legends and lossless presets.
- **Changes**:
  - Modified [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Dual Percentage Metric Modes**: Added `paper_prevalence` (% of Cohort Papers) and `tag_share` (% of Total Extracted Tags) to `metricMode` choices, calculating proportions accurately with `%` formatted axes and tooltips.
    - **100.00% Breakdown Quota Balancing**: Applied the Largest Remainder Method (Hare-Hamilton quota) to `realDataBreakdown`, eliminating floating-point rounding artifacts (`99.98%` $\to$ exact `100.00%`).
    - **Horizontal Bar Specific Parameters Panel**: Added accordion controls in Step 3/Step 4 for Sorting Order (`desc`, `asc`, `none`), Bar Thickness (`barThickness` 8-50px), Corner Radius (`barBorderRadius` 0-16px), Bar Spacing Gap (`barGap` 0-80%), Value Label Position (`right`, `inside`, `insideLeft`, `insideRight`), Value Label Format (`value`, `value_pct`, `pct_only`), and Y-Axis Max Width (`barYAxisWidth`) & Overflow Wrapping (`barYAxisOverflow` with slash `/` and space line-breaking).
    - **Configurable Benchmark Reference Line**: Added toggleable `markLine` annotation with customizable target value, label (e.g. `Target Benchmark`), line style (`dashed`/`solid`), and color picker.
    - **Sunburst-Style Multi-Category Color Legend**: Built dedicated palette-mapped category legend with custom formatting (`name`, `name_count`, `name_percent`), scrolling pagination (`type: 'scroll'`), and 8-position alignment (`top-left`, `top-center`, `top-right`, `left`, `right`, `bottom-left`, `bottom-center`, `bottom-right`).
    - **X-Axis Length & Data Label Strict Synchronization**: Aligned `valuesData`, `legendData`, and `tooltip` formatters so the numerical value passed into `series.data` (driving X-axis bar length) and the attached text labels (`barLabelFormat`: `'value' | 'value_pct' | 'pct_only'`) strictly synchronize with the active `metricMode` (`paper_prevalence` vs `tag_share`), eliminating data-mapping discrepancies.
    - **Lossless Preset Engine**: Upgraded `handleExportPreset` and `handleImportPreset` to persist all 14 new Horizontal Bar configuration state variables in JSON preset files.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #343 - Centralized Trace Normalizer Utility & Universal Trace Resolution (2026-08-13)
- **Goal**: Create a centralized trace normalizer service to resolve missing "Mapping Rules / Reasoning" traces across all research questions (`rq1a_resource_constraint_def`, `rq1b_boundary_envelope`, etc.) across all SLR IDE UI components, modals, and export APIs, while institutionalizing a mandatory agent directive in `agents.md`.
- **Changes**:
  - Created [`trace-normalizer.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/trace-normalizer.ts): Built `extractMappingReasoning` and `extractEvidenceQuote` featuring candidate key resolution (`locate_<key>`, `<key>`, `<key>_mapping`, `<key>_reasoning`, `<key>_locate`, `<cleanKey>`, `locate_<cleanKey>`), token-intersection fuzzy matching, and nested object property extraction.
  - Modified [`agents.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/agents.md): Added Section **3.9 Mandatory Centralized Trace Normalizer Protocol** mandating that all present and future trace resolution logic MUST import and use `trace-normalizer.ts`.
  - Modified [`FinalCohortPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx), [`LlmContextBuilderModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/LlmContextBuilderModal.tsx), [`UmbrellanizerView.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/UmbrellanizerView.tsx), and [`route.ts (csv-tabular)`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/csv-tabular/route.ts): Replaced all islanded/ad-hoc trace lookups with calls to `extractMappingReasoning` and `extractEvidenceQuote`.
  - Modified [`route.ts (final-cohort)`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/insight/final-cohort/route.ts): Fixed SQLite 500 error (`no such column: stage`) by updating miner audit subquery to `(task_type = 'miner' OR task_type LIKE '%miner%' OR response_schema_name LIKE '%miner%')` and updated logic trace merging to prevent dropping traces when `parsedExt.logic_trace` is empty.
  - Modified [`files.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Registered `trace-normalizer.ts` in file index directory.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #342 - Cohort Visualizer Comprehensive Visualization Presets Import/Export Upgrade (2026-08-13)
- **Goal**: Upgrade "Visualization Presets" in the Cohort Visualizer (`VisualizerModal.tsx`) to exhaustively export and import all 50+ chart configuration, styling, dataset mapping, camera pan/tilt/zoom, custom groupings, overrides, and legend state variables, allowing users to save preset JSON files and reproduce any chart directly with 100% fidelity.
- **Changes**:
  - Modified [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Full Preset Export (`v2.0`)**: Updated `handleExportPreset` to save all 50+ state properties including `chartType`, `primaryField`, `secondaryField`, `metricMode`, `sankeyFields`, `sankeyLabelPositions`, `sankeyMaxNodes`, `limitCategories`, `maxCategoriesCount`, `numFieldX/Y/Size`, `useUmbrellanizer`, `splitMultiValues`, `excludeEmpty`, `chartTitle`, `chartSubtitle`, `showChartTitle/Subtitle`, `themePreset`, `fontFamily`, `fontSize`, `showLegend`, `legendPosition`, `showDataLabels`, `labelRotation`, `donutRatio`, `smoothLine`, `sankeyNodeWidth/Gap/Padding`, `bubbleScale`, `gaugeMaxScale`, `sunburstLevelConfigs`, `sunburstSort/NodeClick/EmphasisFocus`, `chartScale`, `panX`, `panY`, `tiltAngle`, `rotationAngle`, `sunburstLegendLevel/Format/Position`, `levelCustomGroups`, `levelCustomGroupLinks`, `customCategoryMap`, `enableManualOverrides`, `manualCategoryValues`, and `customSliceColors`.
    - **Lossless Preset Import**: Updated `handleImportPreset` with safe type guards for all properties, restoring the complete chart configuration, custom grouping mappings, override values, palette colors, typography, camera pan/tilt, and legend settings.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #341 - Cohort Visualizer Sunburst Legend Fixes, Global Scale & 3D Pan/Tilt Controls (2026-08-13)
- **Goal**: Fix Sunburst chart legend bugs (Legend Level aggregation, Legend Label Format, Legend Position & color alignment), fix Chart Scale slider to dynamically scale ring radii and chart node sizes, and add Google Maps-style interactive Pan & 3D Tilt camera controls for cohort visualizer and scientific figure exports.
- **Changes**:
  - Modified [`VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Sunburst Legend Bug Fixes**: Fixed Legend Level category extraction, aggregated node counts & percentages across multi-branch trees, mapped ring slice colors (`itemStyle.color`) directly to legend items, enforced `type: 'scroll'` pagination to prevent legend text overflow, and added automatic viewport pan offset (`center: [50+panX%, 50+panY%]`).
    - **Global Chart Scale Fix**: Dynamically scaled Sunburst inner & outer level radii (`lvlConf.r0 * scaleFactor`, `lvlConf.r * scaleFactor`) and node/symbol/font dimensions across all chart types smoothly based on `chartScale` (30%-200%).
    - **Google Maps-Style Pan & 3D Tilt Controls**: Added camera state variables (`panX`, `panY`, `tiltAngle`, `rotationAngle`), an interactive floating on-canvas overlay control pad box (Pan D-Pad, Tilt +/- buttons, Rotation wheel, Reset) on Step 4 chart preview, and a dedicated **View & Camera Controls** accordion panel in Step 3 and Step 4 sidebars.
    - **Scientific High-DPI 3D Transformed Export**: Upgraded `handleExportChart` to render 3D matrix perspective transforms (`rotateX`, `rotateZ`, `perspective`) onto offscreen high-DPI canvas/SVG export files (1x-5x DPI).
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #340 - LLM Context Builder Export Modal & Mapping Trace Sourcing Fix (2026-08-13)
- **Goal**: Add a dedicated LLM Context Builder modal to the Final Cohort view in `slr-ide`, allowing users to dynamically select extracted data variables, paper metadata fields, and export scope (Filtered Cohort vs Full Cohort) into an LLM-friendly JSON payload optimized for Gemini 3.1 Pro visualization and narration. Fix `mapping_reasoning` sourcing where Stage 4 (Miner) `logic_trace` was not merged from `llm_audit_log`.
- **Changes**:
  - Created [`LlmContextBuilderModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/LlmContextBuilderModal.tsx): Interactive standalone modal with paper scope toggle (Filtered vs Full Cohort), paper metadata checkboxes, dynamic extracted data variable selector with search filtering, per-variable output schema toggles (`raw_value`, `umbrellanized_value`, `taxonomy_justification`, `mapping_reasoning`, `evidence_quote`), live JSON payload preview with token count estimator, and Copy / Download actions. Added `isInitialized` guard to prevent `useEffect` from automatically re-populating `selectedKeys` when `selectedKeys.size` becomes 0 on clicking "Clear All".
  - Modified [`route.ts (final-cohort)`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/insight/final-cohort/route.ts): Added `miner_audit_structured_output` subquery from `llm_audit_log` (`task_type = 'miner'`) and merged `logic_trace` into `ai_extracted_data`, ensuring Stage 4 trace mapping is fully present in final cohort paper responses.
  - Modified [`LlmContextBuilderModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/LlmContextBuilderModal.tsx) & [`FinalCohortPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Enhanced `parseExtractedTraces` to exhaustively extract trace reasoning from `locate_<key>`, `<key>`, `<key>_mapping`, `<key>_reasoning`, `<key>_locate`, as well as `reasoning`, `justification`, `mapping`, `rationale`, `explanation`, or `locate` inside extracted variable objects.
  - Modified [`page.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx): Added "LLM Context Builder" trigger button beside "Visualize Cohort" in the top navigation header bar when `activeTab === 'insight-export-cohort'`, added `isCohortLlmContextBuilderOpen` state, and passed modal props.
  - Modified [`InsightExportView.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/InsightExportView.tsx): Extended props interface and passed `isLlmContextBuilderOpen` down to `FinalCohortPanel`.
  - Modified [`files.md`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Registered new `LlmContextBuilderModal.tsx` component entry in file index directory.
- **Verification**: Verified TypeScript compilation with `npx tsc --noEmit` completing with 0 errors.

## #339 - Landing Page Version Badge Auto-Sync (2026-08-08)
- **Goal**: Automatically sync the SLR Magic landing page (`index.html`) header version badge with `slr-ide`'s package version and compilation timestamp on every production build.
- **Changes**:
  - Modified [`slr-ide/scripts/bump-version.js`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/bump-version.js): Extended the prebuild script to read root `index.html`, locate the badge element by `id="platform-version-badge"`, replace inner text with `v{newVersion}`, and set `title="Compiled on: {locale datetime}"` tooltip. Falls back gracefully if `index.html` is not found.
  - Modified [`index.html`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/index.html): Added `id="platform-version-badge"` to header version badge, aligned version from `v2.5.0` → `v0.1.1` (current `slr-ide` version), added `cursor-help` class and `title="Compiled on: —"` as initial placeholder.
- **Verification**: Ran `node scripts/bump-version.js` manually — version bumped from `0.1.0` → `0.1.1` and `index.html` badge updated to `v0.1.1` with tooltip `Compiled on: Aug 8, 2026, 09:32:28 PM`. Exited with code 0.

## #339 - Dynamic Miner Schema Keys & Correct Pool Size Targets in SLR Viewer Export (2026-08-08)
- **Goal**: Fix Rolling Batch Validation (Sequential QC) producing incorrect data for any project whose Stage 4 extraction schema does not match the hardcoded default-project RQ field names, and ensure Pre-Calibration Filling Status pool targets reflect the active project's configured sizes.
- **Root Causes**:
  - `route.ts` hardcoded `minerKeys = ['rq1_operational_domains', ..., 'rq9_deployment_barriers']` for Stage 4 schema integrity and semantic agreement evaluation. Any project with a different extraction schema would always show 0% schema integrity.
  - `poolMetrics` initialization used `|| 50`, `|| 30`, `|| 20` which also collapsed truthful `0` to default. Changed to `?? 50` etc.
- **Changes**:
  - Modified [`route.ts (export/slr-viewer)`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts):
    - Replaced hardcoded `minerKeys` / `arrayKeys` arrays with a dynamic `extractionRules` list parsed from `project.pool_c_extraction_rules`.
    - Updated `calculateCohortStats` to accept `extractionRulesParam: any[] = []` and derive `targetRules` / `keysForSemantic` from the parameter, falling back to the AI extracted data's own key set when no rules are configured.
    - Improved schema integrity check: `field === undefined || field === null` instead of `!field` (prevents false positives for falsy-but-present values like `0` or `""`).
    - Fixed `poolMetrics` initialization to use `??` (nullish coalescing) so a project's explicitly-set `0` is not overridden by the hardcoded default.
    - Passed `extractionRules` through `calculateCohortStats` calls for both cumulative and individual batch stats.
- **Verification**: Clean `npx tsc --noEmit` (0 errors) in `slr-ide`.

## #338 - Fix SLR Viewer Export Pool Size Targets & Rolling Batch QA Score Key Matching (2026-08-08)
- **Goal**: Fix target hardcoding and rolling batch statistical evaluation errors when importing `.slr-viewer` snapshot datasets into `slr-viewer`.
- **Changes**:
  - Modified [`route.ts (export/slr-viewer)`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Dynamicized `poolMetrics` initialization (`pool_a_size`, `pool_b_size`, `pool_c_size`) to read `project.pool_a_size`, `project.pool_b_size`, and `project.pool_c_size` instead of hardcoding `50 / 30 / 20`. Realigned `calculateCohortStats` in `/api/export/slr-viewer` to use alphanumeric cleaning (`cleanCode = codeLower.replace(/[^a-z0-9]/g, '')`) and `score ?? value ?? val` property extraction, fixing QA score key matching failures (e.g., `"QA-1"` matching `"qa1_aims"`).
  - Modified [`PoolMetricsPanel.jsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/PoolMetricsPanel.jsx): Prioritized `pool_a.target` in target fallback resolution.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors) and confirmed export payload correctly writes `20 / 10 / 10` pool targets and 100% agreement stats.

## #337 - Python LLM Pipeline QA Score Parsing Fallback & Rolling Batch Sync (2026-08-08)
- **Goal**: Fix root cause issue where rerunning Stage 3 Scientist LLM pipeline on a paper (e.g. `Liu_2023_Intelligentdigi_640a3_1`) did not update its `ai_quality_assessment` score (leaving stale `0.0` score in the breakdown).
- **Root Cause & Fix**:
  - In [`python_engine/llm/queue_handler.py`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/queue_handler.py): `qa_scores_json` was extracted via `to_json_str(response.get("qa_scores"))`. When `qa_scores` was nested inside `structured_output` JSON string instead of top-level `response` dict, `qa_scores_json` evaluated to `None`, causing `COALESCE(None, ai_quality_assessment)` to silently skip updating the `papers` table.
  - Added fallback in `queue_handler.py` to parse `qa_scores` directly from `struct_out` when `response.get("qa_scores")` is `None`.
  - Added explicit update to `rolling_batch_papers` table upon LLM completion so active/historical rolling batch paper records are kept in sync with LLM pipeline runs.
  - Synced existing latest Scientist QA scores for `Liu_2023_Intelligentdigi_640a3_1` (`QA-7` = `0.5`, Critical Miss Rate = `0.0%`).
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors) and confirmed Critical Miss Rate for Batch #1 drops to 0.0%.

## #336 - Batch Failure Reason Diagnostics & Breakdown Modal (2026-08-08)
- **Goal**: Provide transparent failure reason diagnostics explaining why rolling batches fail quality control gating thresholds.
- **Changes**:
  - Modified [`route.ts (rolling-batch/stats)`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/stats/route.ts): Extended `calculateCohortStats` to track paper-level failure items: `criticalMissDetails` (1.0+ point QA score deviations between AI & Gold) and `schemaDiscrepancies` (missing extraction keys).
  - Created [`BatchFailureBreakdownModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/BatchFailureBreakdownModal.tsx): Interactive breakdown modal rendering Audit Gating Rule comparisons (Stage 3 Critical Miss Rate, Stage 3 CI Lower, Stage 4 Schema Integrity, Stage 4 CI Lower) and a paper-by-paper failure table listing Paper ID, criterion, AI score vs Gold score, and deviation.
  - Modified [`RollingBatchView.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchView.tsx): Converted `Failed` / `Passed` status badges in the **Historical Batch Performance** table into interactive buttons with hover tooltips (`Click for failure breakdown`) and mounted `<BatchFailureBreakdownModal />`.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors).

## #335 - Fix SQL NOT NULL Constraint Failure on Rolling Batch Paper Import (2026-08-08)
- **Goal**: Fix root cause error `Reviewer 1 Import Failed: 0 papers matched the active rolling batch in the uploaded .slr file.` during batch import.
- **Root Cause & Fix**:
  - `rolling_batch_papers` table schema defines `Import_Date` and `Import_Source` as `NOT NULL` without default values.
  - In [`route.ts (rolling-batch/import)`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts), both `INSERT OR IGNORE INTO rolling_batch_papers` queries omitted `Import_Date` and `Import_Source` from the column list, causing SQLite to throw `SQLITE_CONSTRAINT_NOTNULL` errors and silently ignore every paper insertion.
  - Added `Import_Date`, `Import_Source`, and `Local_PDF_Status` to the column lists and SQL parameters in both INSERT queries in `route.ts`.
- **Verification**: Tested insert query in SQLite node runtime (confirmed `changes: 1`). Verified clean `npx tsc --noEmit` build (0 errors).

## #334 - Deep Analysis & Edge-Case Bug Hunting: Standby Import Workflow (2026-08-08)
- **Goal**: Perform comprehensive audit and fix potential bugs, missing implementation details, and edge cases in the standby batch import workflow.
- **Bugs Identified & Fixed**:
  1. **Project Paper Validation Truncation**: Replaced standard `/api/papers` query (which capped results at default page size 50) with `/api/papers?onlyIds=true` to retrieve all paper IDs in the project database without limit, preventing false `Missing in DB` warnings on large projects.
  2. **Reviewer Decision Overwrite Mismatch**: Added reviewer name collision detection in [`ImportBatchStandbyModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/ImportBatchStandbyModal.tsx). If File 1 and File 2 share identical `reviewer_name` metadata, they are automatically distinguished (e.g. `(File 1)` / `(File 2)`), preventing File 2 from executing SQL `DELETE FROM rolling_batch_reviewer_decisions` and overwriting File 1 decisions.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors).

## #333 - Dual-Path Standby Initialization: 'Import Batch' Workflow (2026-08-08)
- **Goal**: Provide a dual-path workflow on the Audit Pipeline Standby card, allowing users to either auto-generate the paper batch or upload pre-reviewed Reviewer 1 & 2 `.slr` files directly to start the batch.
- **Changes**:
  - Created [`ImportBatchStandbyModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/ImportBatchStandbyModal.tsx): Dual-reviewer file upload modal featuring real-time client-side `.slr` parsing, project database paper existence verification, cross-reviewer alignment reconciliation, and a visual reconciliation preview table before committing.
  - Modified [`RollingBatchView.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchView.tsx): Added the **"Import Batch"** button alongside **"Initialize Next Audit Batch"** in the Audit Pipeline Standby card and mounted `<ImportBatchStandbyModal />`.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors).

## #332 - Adjudication Commit Persistence & Validation Fix (2026-08-08)
- **Goal**: Fix issue where clicking "Commit Resolution" did not persist adjudication decisions to the database.
- **Changes**:
  - Modified [route.ts (rolling-batch/adjudicate)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/adjudicate/route.ts): Enhanced database queries for project, batch, and `rolling_batch_papers` SELECT/UPDATE to use `CAST(Project_ID AS TEXT) = CAST(? AS TEXT)` matching, preventing type coercion mismatches (string vs numeric project IDs) from silently affecting database updates.
  - Modified [RollingBatchAdjudicationModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchAdjudicationModal.tsx): Fixed the commit validation gate. Unreviewed QA criteria now automatically default to `0` with explicit evidence rather than triggering a toast guard that silently blocked the commit request.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors).

## #331 - Purge-Reimport Full Paper Retention & Adjudication Visibility Fix (2026-08-08)
- **Goal**: Fix issue where purging and re-uploading .slr files only processed 3 out of 5 papers. Papers without reviewer QA data were left with `manual_decision = NULL`, excluded from the adjudication workspace, and auto-excluded on batch finalization.
- **Changes**:
  - Modified [route.ts (rolling-batch/import)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Added `decisions.length === 0` branch in re-evaluation loop to explicitly mark papers with no reviewer decisions as `PENDING_ADJUDICATION`, keeping them visible. Removed auto-exclude of `NULL` decision papers from finalization check. Changed finalization guard to `(manual_decision = 'PENDING_ADJUDICATION' OR manual_decision IS NULL)`.
  - Modified [route.ts (rolling-batch/adjudicate)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/adjudicate/route.ts): Reverted to check both `PENDING_ADJUDICATION` and `NULL` in unresolved count. Removed auto-exclude of unreviewed papers. Batch only finalizes when ALL papers have definitive decisions.
  - Modified [RollingBatchView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchView.tsx): Updated discrepancy filter to include papers with `manual_decision === null`, showing them in the adjudication workspace with ⚠️ "no reviewer data" status.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors). All 5 papers from .slr files now appear in the adjudication workspace after purge+reimport.

## #330 - Rolling Batch Finalization & Statistics Triggering Fix (2026-08-08)
- **Goal**: Fix issue where completed batch adjudication did not trigger/update statistics due to `rolling_batches.status` remaining in `'awaiting_adjudication'` when some batch papers remained with `manual_decision IS NULL`.
- **Changes**:
  - Modified [route.ts (rolling-batch/adjudicate)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/adjudicate/route.ts): Updated completion check to verify `pendingCount === 0`, default unreviewed papers to `'Exclude'`, and mark `rolling_batches.status = 'complete'`.
  - Modified [route.ts (rolling-batch/import)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Added auto-finalization when total reviewers $\ge 2$ and `pendingCount === 0`.
- **Verification**: Verified Batch 1 `status` updated to `'complete'` and cumulative statistics cards calculate and display properly on screen. Verified clean `npx tsc --noEmit` build (0 errors).

## #329 - Adjudication Workspace Project Rules Delivery & Tab Count Fix (2026-08-08)
- **Goal**: Fix cause of "Quality Assessment (0)" and "Data Extraction (0)" empty white workspace in Rolling Batch Adjudication Modal for batch `rb-fd9a52cc-c6e5-4fc3-ad65-62f6b053f3d4`.
- **Changes**:
  - Modified [route.ts (rolling-batch/decisions)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/decisions/route.ts): Added `project` details object to the GET response payload.
  - Modified [RollingBatchView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchView.tsx): Added `projectData` state and direct API fallback (`/api/projects/${projectId}`) to guarantee `qaRules` and `extractionRules` arrays are never empty.
- **Verification**: Confirmed tab counts update to **Quality Assessment (8)** and **Data Extraction (14)**, rendering the complete blinded review comparison views. Verified clean `npx tsc --noEmit` build (0 errors).

## #328 - Rolling Batch Adjudication Workspace Key Matching & Data Rendering Fix (2026-08-08)
- **Goal**: Fix issue where opening the Rolling Batch Adjudication Workspace for batch `rb-fd9a52cc-c6e5-4fc3-ad65-62f6b053f3d4` rendered empty/blank data (`—` / "No evidence") due to strict string key index lookups (`r1_qa[rule.code]`) vs hyphen-insensitive key representations or primitive/object value wrappers.
- **Changes**:
  - Modified [RollingBatchAdjudicationModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchAdjudicationModal.tsx): Replaced strict `r1_qa[rule.code]?.value` lookups with `getQaScoreObj` and `getExtDataObj` helpers using clean key matching (`codeLower.replace(/[^a-z0-9]/g, '')`) and multi-property value extraction (`item.value ?? item.score ?? item.val`).
  - Modified [AdjudicationScorecardView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/inter-rater/AdjudicationScorecardView.tsx): Implemented `getQaScoreObj` to display Reviewer Alpha and Reviewer Beta QA scores and evidence text.
  - Modified [DataExtractionComparisonView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/inter-rater/DataExtractionComparisonView.tsx): Implemented `getExtDataObj` to display Reviewer Alpha and Reviewer Beta extracted data variables and evidence text.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors) and confirmed non-empty QA score & extraction variable rendering for batch `rb-fd9a52cc-c6e5-4fc3-ad65-62f6b053f3d4`.

## #327 - Post-Purge Deep Bug Hunt & AI Metadata Binding Fixes (2026-08-08)
- **Goal**: Audit potential edge-case bugs following the "Purge All" workflow, ensuring AI evaluation metadata (`ai_quality_assessment`, `ai_extracted_data`) and `batch_number` are correctly preserved during auto-bind, and correcting SQL column casing in batch initialization.
- **Changes**:
  - Modified [route.ts (rolling-batch/initialize)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/initialize/route.ts): Fixed column casing in subquery (`CAST(rbp.Project_ID AS TEXT) = CAST(? AS TEXT)`).
  - Modified [route.ts (rolling-batch/import)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Updated `INSERT OR IGNORE INTO rolling_batch_papers` auto-bind queries to include `batch_number` and all `ai_*` fields (`ai_stage`, `ai_decision`, `ai_exclusion_code`, `ai_rationale`, `ai_quality_assessment`, `ai_extracted_data`) from `mainPaper`.
- **Verification**: Verified `npx tsc --noEmit` exited with 0 errors.

## #326 - Resilient SLR Re-import & Auto Batch Binding Post-Purge (2026-08-08)
- **Goal**: Fix issue where re-importing a previously exported `.slr` file after clicking "Purge All" failed to populate the Rolling Batch Adjudication Workspace due to batch ID mismatch errors (`fileBatchId !== activeBatch.id`) or missing active batch state.
- **Changes**:
  - Modified [route.ts (rolling-batch/import)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Added automatic batch creation if no active batch is running upon upload, removed strict `fileBatchId` mismatch rejection so purged/older batch IDs seamlessly map to `activeBatch.id`, and added dynamic paper binding to `rolling_batch_papers` if paper IDs belong to the active project.
- **Verification**: Verified `npx tsc --noEmit` exited cleanly with 0 errors.

## #325 - Rolling Batch Engine Reset Options Feature (2026-08-08)
- **Goal**: Implement granular reset options for the Post Validation Rolling Batch workflow, providing UI controls and API support to reset either the active in-progress batch or the entire rolling audit pipeline for the project.
- **Changes**:
  - Created [route.ts (rolling-batch/reset)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/reset/route.ts): Added POST endpoint supporting `mode: 'active'` (cancels active batch, clearing reviewer decisions, commit ledger, and assigned papers) and `mode: 'all'` (purges all historical and active batches for the project).
  - Modified [useRollingBatch.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useRollingBatch.ts): Added `resetBatch(mode)` helper with state rehydration and broadcast sync.
  - Created [RollingBatchResetModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchResetModal.tsx): Built confirmation modal offering clear Option 1 ("Reset Active Batch Only") and Option 2 ("Reset Entire Audit Pipeline") choices.
  - Modified [RollingBatchView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchView.tsx): Added "Reset Options" buttons in the Sequential Audit Progress header and active batch details header.
- **Verification**: Verified clean `npx tsc --noEmit` build (0 errors).

## #324 - Dynamic Extraction Rules & Stage 4 Miner Schema Fix in Rolling Batch Stats (2026-08-08)
- **Goal**: Fix cause of false 0.0% Schema Integrity Rate and FAILING status on Stage 4 Miner card in Post Validation Rolling Batch view.
- **Changes**:
  - Modified [route.ts (rolling-batch/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/stats/route.ts): Updated `calculateCohortStats` to accept project `pool_c_extraction_rules` dynamically instead of using hardcoded legacy keys (`rq1_operational_domains`), performing hyphen-insensitive clean key lookups (`codeLower.replace(/[^a-z0-9]/g, '')`) for structural integrity and semantic agreement checks.
- **Verification**: Verified Stage 4 Miner metrics update from 0.0% (FAILING) to **100.0% Schema Integrity Rate, 1.000 95% CI Lower Bound (PASS)**. Verified `npx tsc --noEmit` exited with 0 errors.

## #323 - Post Validation Rolling Batch Auto Project Resolution & Resilient Key Conflict Fixes (2026-08-08)
- **Goal**: Audit and resolve bug patterns in the Post Validation Rolling Batch workflow (`post-validation-rolling-batch`), adding automatic project ID cohort switching on `.slr` import, 0-paper import error handling, resilient QA/extracted conflict key parsing, and stale hook state resets.
- **Changes**:
  - Modified [route.ts (rolling-batch/import)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Added automatic project ID resolution from `.slr` metadata, auto-updating `ACTIVE_PROJECT_ID` config, returning `resolved_project_id`, enforcing `importedCount > 0` validation, and updating conflict detection with hyphen-insensitive rule matching and flexible property extraction (`item.score ?? item.value ?? item.val`).
  - Modified [useRollingBatch.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useRollingBatch.ts): Cleared stale states on status/stats fetch, and triggered `loadStats()` upon successful batch review import.
- **Verification**: Verified `npx tsc --noEmit` exited cleanly with 0 errors.

## #322 - SLR Viewer Snapshot Export & Viewer Parsing Alignment (2026-08-08)
- **Goal**: Align pre-computed `.slr-viewer` snapshot export pipeline in `slr-ide` and snapshot visualizer parsing in `slr-viewer` to guarantee consistent QA score extraction and stage metrics across both apps.
- **Changes**:
  - Modified [route.ts (export/slr-viewer)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Updated Stage 3 `computeStatsForPool` calculation in the SLR Viewer export endpoint to perform hyphen-insensitive rule code matching and extract `item.score ?? item.value ?? item.val`.
  - Modified [FinalCohortPanel.jsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/final-cohort/FinalCohortPanel.jsx): Updated `parseQaAssessment` in `slr-viewer` to support `val` and `numeric_score` fallback properties.
- **Verification**: Verified `npx tsc --noEmit` in `slr-ide` and `npm run build` in `slr-viewer` both built cleanly with 0 errors.

## #321 - Smart Key Parsing & Multi-Project Backward Compatibility (2026-08-08)
- **Goal**: Guarantee seamless backward compatibility for older exported `.slr` files and alternative projects using legacy QA keying formats (`QA1`, `QA-1`, `qa1_aims`), primitive scores, or object wrappers (`{ score: ... }` vs `{ value: ... }`).
- **Changes**:
  - Modified [adjudication-calculations.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/inter-rater/adjudication-calculations.ts): Updated `renderPoolCReviewerSummary` to perform hyphen-insensitive key lookups and fallback score extraction (`item.score ?? item.value ?? item.val`).
  - Modified [route.ts (adjudicate/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts): Updated `getQaItem` helper to perform both exact clean key matching and prefix clean key matching.
- **Verification**: Verified `npx tsc --noEmit` exited with 0 errors.

## #320 - Score Property Resolution & Metric Fix for Stage 3 Scientist Card (2026-08-08)
- **Goal**: Fix root cause of false 66.3% Critical Miss Rate, 0.000 Weighted Kappa, and FAIL status on the Stage 3 Scientist summary card caused by AI structured output keying (`item.score` vs `item.value`).
- **Changes**:
  - Modified [route.ts (adjudicate/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts): Updated `computeStatsForPool` to extract AI and Gold scores flexibly (`item.score ?? item.value ?? item.val`).
  - Modified [route.ts (rolling-batch/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/stats/route.ts): Updated `qaRules` loop to perform hyphen-insensitive matching and fallback score property extraction.
- **Verification**: Verified Stage 3 metrics update from 66.3% Critical Miss (FAIL) to **0.0% Critical Miss, 93.1% Raw Agreement, 0.9075 Weighted Kappa (PASS)**. Verified `npx tsc --noEmit` exited with 0 errors.

## #319 - Visual Resolution Indicators for Calibration Discrepancies (2026-08-08)
- **Goal**: Provide clear visual indicators (green checkmark icon next to Paper ID and a green 'Resolved' badge in the Action column) for calibration discrepancies that have been adjudicated.
- **Changes**:
  - Modified [route.ts (adjudicate/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts): Queried `calibration_commit_ledger` for non-import adjudication entries and added `is_resolved` boolean property to each item in `discrepancies`.
  - Modified [DiscrepancyTable.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/inter-rater/DiscrepancyTable.tsx): Rendered `CheckCircle2` green checkmark icon next to `disc.paper_id` and rendered a green `Resolved` badge in the Action column when `disc.is_resolved` is true.
- **Verification**: Verified `npx tsc --noEmit` exited with 0 errors.

## #318 - Hyphen-Insensitive QA Score Key Matching for Stage 3 Scientist Card (2026-08-08)
- **Goal**: Fix root cause of false 70.8% Critical Miss Rate, 0.000 Weighted Kappa, and FAIL status on the Stage 3 Scientist summary card caused by hyphen mismatch (`QA-1` vs `qa1_aims`).
- **Changes**:
  - Modified [route.ts (adjudicate/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts): Updated `computeStatsForPool` (Stage 3) to perform hyphen-insensitive and case-insensitive matching (`codeLower.replace(/[^a-z0-9]/g, '')`) between project rule codes (`QA-1`) and AI audit log keys (`qa1_aims`).
- **Verification**: Verified `npx tsc --noEmit` exited with 0 errors.

## #317 - Resilient Rule Key & Extracted Object Extraction for Pool C (2026-08-08)
- **Goal**: Ensure Pool C inter-rater stats calculation handles all variations in QA rule codes (`QA-1` vs `QA1`) and extracted data formats (raw strings vs `{ value: ... }` objects) without returning missing stats.
- **Changes**:
  - Modified [route.ts (adjudicate/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts): Added `getQaItem`, `getExtractedItem`, and `getExtractedVal` helpers for resilient case-insensitive and hyphen-insensitive key lookup across `qa_scores` and `extracted_data`.
- **Verification**: Verified clean `npx tsc --noEmit` build with 0 errors.

## #316 - Prevent Stale Stats Render Across Calibration Pools (2026-08-08)
- **Goal**: Fix issue where switching tabs to Pool C temporarily rendered Pool A's stats inside Pool C's card layout (causing blank numbers like `%`, missing Kappa values, and incorrect 5/15 paper counts).
- **Changes**:
  - Modified [InterRaterDashboard.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/InterRaterDashboard.tsx): Enforced calling `setStats(null)` immediately inside `handleTabChange` and `useEffect` when switching tabs or projects.
- **Verification**: Verified clean `npx tsc --noEmit` build with 0 errors.

## #315 - Inter-Rater Dashboard Target Project Stats Refresh (2026-08-08)
- **Goal**: Fix root cause of "Waiting for Second Reviewer" remaining on screen after importing `.slr` files belonging to a different project cohort than the React component's initial closure state.
- **Changes**:
  - Modified [InterRaterDashboard.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/InterRaterDashboard.tsx): Updated `fetchStatsAndLedger` to accept an explicit `targetProjectId` parameter and passed `data.resolved_project_id` upon successful `.slr` upload. Triggered `broadcastSync('SYNC_PROJECTS')` to immediately align parent UI project selector.
  - Modified [route.ts (import/inter-rater)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts): Included `resolved_project_id` and `project_id` in success JSON response.
- **Verification**: Verified `npx tsc --noEmit` exited with 0 errors.

## #314 - Automatic Inter-Rater Project Cohort Resolution (2026-08-08)
- **Goal**: Prevent project ID mismatch errors and "Waiting for Second Reviewer" states when uploading `.slr` files exported for a specific project cohort while a different active project is selected in the UI.
- **Changes**:
  - Modified [route.ts (import/inter-rater)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts): Added auto-project resolution that reads `fileProjectId` from `.slr` metadata, validates against existing project IDs, auto-routes paper decisions to the matching project, and updates `ACTIVE_PROJECT_ID`.
- **Verification**: Verified clean `npx tsc --noEmit` build with 0 errors.

## #313 - Non-Zero Paper Import Validation & Error Diagnostic (2026-08-08)
- **Goal**: Prevent false positive "Successfully imported" toasts when 0 papers in an uploaded `.slr` file match active project papers, and provide explicit diagnostic error messages when project cohort or paper IDs mismatch.
- **Changes**:
  - Modified [route.ts (import/inter-rater)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts): Added validation check returning HTTP 400 with explicit diagnostic details if `papersImported === 0` (e.g. `Import failed: 0 of X papers in .slr file matched active project papers`).
- **Verification**: Verified `npx tsc --noEmit` exited with 0 errors.

## #312 - Auto Incremental Versioning & Compilation Date-Time Injection (2026-08-08)
- **Goal**: Implement auto-incremental versioning and live compilation date-time tracking across `slr-ide`.
- **Changes**:
  - Created [bump-version.js](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scripts/bump-version.js): Node.js script that bumps patch version in `package.json` before production builds.
  - Modified [package.json](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/package.json): Added `"prebuild": "node scripts/bump-version.js"` script.
  - Created [next.config.mjs](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/next.config.mjs): Exported Next.js configuration injecting `NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_BUILD_TIME` environment variables.
  - Modified [Sidebar.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/Sidebar.tsx): Added version pill badge and compilation timestamp in the Sidebar footer.
- **Verification**: Verified `npx tsc --noEmit` exited with 0 errors.

## #311 - Strict SQL Multi-Project CAST Enforcements & Resilient Pool Matching (2026-08-08)
- **Goal**: Fix root cause of inter-rater import failures where importing two `.slr` files kept returning "Waiting for Second Reviewer" due to SQL project ID type mismatches (`1` vs `'1'`) and strict calibration pool filter mismatches.
- **Changes**:
  - Modified [route.ts (import/inter-rater)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts): Enforced `CAST(project_id AS TEXT) = CAST(? AS TEXT)` across all SQL queries (`checkReviewerExistStmt`, `countReviewersStmt`, `selectPaperStmt`, `deleteReviewerDecisionsStmt`, `updatePaperDecisionStmt`, `getPaperDecisionsStmt`), added dual pool-tag matching (`pool_c` and `CAL_Pool_C`), and added auto-cloning fallback from `papers` to `calibration_papers`.
  - Modified [route.ts (adjudicate/stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts): Enforced `CAST(project_id AS TEXT) = CAST(? AS TEXT)` on `reviewerRows` and `pairedDecisions` SQL queries.
  - Modified [StorageService.js](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/inter-rater/src/StorageService.js): Standardized export metadata across all pools (`CAL_Pool_A`, `CAL_Pool_B`, `CAL_Pool_C`) to follow standard SLR Magic snake_case schema and eliminated duplicate `projectId` & `project_id` keys.
- **Verification**: Verified `npx tsc --noEmit` exited with code 0 in `slr-ide` and `npm run build` exited with code 0 in `inter-rater`.

## #310 - Inter-Rater QA & Extraction Form Visibility on Excluded Papers (2026-08-07)
- **Goal**: Enable Quality Assessment Scoring and Data Extraction parameter form fields to remain fully active and visible when a paper's decision is set to `Exclude`.
- **Changes**:
  - Modified [BlindedReviewForm.jsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/inter-rater/src/components/BlindedReviewForm.jsx): Removed `{decision === 'Include' && (...)}` section conditional wrapper, rendering QA & extraction rules unconditionally and displaying an informative notification badge when `Exclude` is selected.
- **Verification**: Verified clean Vite build (`npm run build`) in `inter-rater`.

## #309 - Inter-Rater Pool C Array Format Support & Export Losslessness (2026-08-07)
- **Goal**: Ensure exported inter-rater POOL_C files preserve native string arrays (`value: ["MQTT", "HTTP", "TCP/UDP"]`) for multi-value keys while rendering smoothly in human review form inputs.
- **Changes**:
  - Modified [AutofillModal.jsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/inter-rater/src/components/features/modals/AutofillModal.jsx): Updated `extractDataAndEvidence` to preserve native array types in `Human_Extracted_Data`.
  - Modified [BlindedReviewForm.jsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/inter-rater/src/components/BlindedReviewForm.jsx): Added array unrolling helper for text input `value` prop (`Array.isArray(item.value) ? item.value.join(', ') : item.value`).
- **Verification**: Verified clean Vite build (`npm run build`) in `inter-rater`.

## #308 - Universal POOL_C Schema Normalization in Adjudication Engine (2026-08-07)
- **Goal**: Upgrade adjudication calculation engine (`adjudication-calculations.ts`) and Google Apps Script (`InterRaterController.js`) to parse `{ score: "1.0", exact_quote: "..." }` object properties alongside legacy `{ value: 1.0, evidence: "..." }` and primitive score formats.
- **Changes**:
  - Modified [adjudication-calculations.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/inter-rater/adjudication-calculations.ts): Updated `calculatePoolCDecision` and `getScoreIndex` with `extractNumericVal` to inspect `score`, `value`, `val`, `numeric_score`, or primitive numbers, preventing 0-score false fatal flaws and NaN Cohen's Kappa indices.
  - Modified [InterRaterController.js](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/app-script/InterRaterController.js): Updated `val` and `quote` object extraction to support `r.score` / `r.val` and `r.exact_quote` / `r.quote` / `r.text`.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #307 - Added Pool Assignment Filter & Table Row Badges in Paper Database Raw (2026-08-07)
- **Goal**: Add a Pool Assignment filter (`All Pools`, `Pool A`, `Pool B`, `Pool C`, `Unassigned`) to the Paper Database Raw view and display visual pool badges on paper table rows.
- **Changes**:
  - Modified [usePapers.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/usePapers.ts): Added `poolFilter` state (`useState('')`), passed `calibrationPool` search param to `/api/papers` GET request, updated dependency arrays, and returned `poolFilter` / `setPoolFilter`.
  - Modified [PaperDatabaseView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PaperDatabaseView.tsx): Added `poolFilter` and `setPoolFilter` props to `PaperDatabaseViewProps`, added Pool Assignment dropdown inside Advanced Filters popover, updated filter count indicator, included `calibrationPool: poolFilter` in `handleToggleSelectAll`, and rendered styled Pool badges (`Pool A`, `Pool B`, `Pool C`) in table rows next to the Stage column.
  - Modified [page.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx): Passed `poolFilter` and `setPoolFilter` from `papersHook` to `PaperDatabaseView`.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #306 - Improved QA Parsing Logic & Robustness in Final Cohort Table (2026-08-07)
- **Goal**: Resolve `[object Object]` rendering issue in `QAx_y` columns across Final Cohort tables and exports when encountering new JSON schema formats storing QA entries as objects (`{ score: "1.0", exact_quote: "..." }`).
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Enhanced `parseQaAssessment` to inspect object entries for `score` or `value` properties first, added safe fallback for primitive values, and extracted evidence quotes (`exact_quote`, `quote`, `evidence`) for the logic trace tooltips.
  - Modified [route.ts (csv-tabular)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/csv-tabular/route.ts): Updated QA entry score extraction logic in CSV tabular export route.
  - Modified [route.ts (cloud-gold-mine preview)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/preview/route.ts) & [route.ts (cloud-gold-mine export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/route.ts): Updated `parseQaScore` helpers to extract scores from object properties.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #305 - Added Raw vs Umbrellanized Value Toggle in Taxonomy Trends Quick Overview (2026-08-07)
- **Goal**: Add a checkbox toggle to allow users to switch between raw extracted string values and umbrellanized (LLM normalized) categories in Taxonomy Trends Quick Overview, updating the UI distributions, JSON download payload, and PDF print report.
- **Changes**:
  - Modified [QuickOverviewModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/QuickOverviewModal.tsx): Added `showRaw` state (`boolean`, default `false`), header checkbox toggle `Show raw extracted values (unmapped)`, updated `stats` calculation to process raw values directly without `mappingsByKey` when `showRaw` is enabled, updated `handleDownloadJson` to include `"mode": "raw" | "umbrellanized"` metadata, and passed `showRaw` to `TaxonomyTrendsPrintDocument`.
  - Modified [TaxonomyTrendsPrintDocument.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/TaxonomyTrendsPrintDocument.tsx): Added `showRaw` prop and rendered a report header badge (`Mode: Raw Extracted Values` vs `Mode: Umbrellanized Taxonomy`).
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #304 - Migrated `rq3a_edge_hardware` Values to String Array & Added Future-Proofing Normalization (2026-08-07)
- **Goal**: Cast `extracted_data.rq3a_edge_hardware.value` inside `papers -> ai_extracted_data` in `slr-ide/db/slr.db` from comma-separated strings or `'NOT_STATED'` to clean string arrays (`['NOT_STATED']` for `'NOT_STATED'`), and add future-proofing array normalization logic to Python LLM execution engine.
- **Changes**:
  - Created [migrate_rq3a_edge_hardware.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/scripts/migrate_rq3a_edge_hardware.py): Standalone migration script that parses `ai_extracted_data`, splits comma-delimited strings in `rq3a_edge_hardware.value`, trims whitespace, converts `'NOT_STATED'` to `['NOT_STATED']`, and saves changes to `slr-ide/db/slr.db`. Executed and migrated 18 matching records.
  - Modified [queue_handler.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/queue_handler.py): Added `normalize_extracted_data_payload` helper function to normalize comma-separated strings or `'NOT_STATED'` values into string arrays for extraction keys prior to writing `ai_extracted_data` to SQLite.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Logged `scripts/migrate_rq3a_edge_hardware.py` under Section 4.
- **Verification**: Verified 18 out of 18 records in `slr.db` successfully converted to string arrays, and unit-tested future-proofing payload normalization function.

## #303 - Fixed Missing paper_id Argument in PDF Scraper Integrity Verification (2026-08-05)
- **Goal**: Fix `TypeError: verify_paper_pdf() missing 1 required positional argument: 'paper_id'` when running PDF scraping via IEEE Xplore specialized handler or web scraper.
- **Changes**:
  - Modified [scrape_pdfs.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/scrape_pdfs.py): Passed required `paper_id` positional parameter to `verify_paper_pdf(...)` function call on line 204.
- **Verification**: Verified clean Python compilation with `python -m py_compile` with zero syntax/type errors.

## #302 - Separated INACCESSIBLE PDF Status from Pending PDF in Stage 2 Gatekeeper Metrics (2026-08-04)
- **Goal**: Exclude papers with `INACCESSIBLE` `Local_PDF_Status` from `Pending PDF` state in "Stage 2: Gatekeeper Metrics" on Project Dashboard, introducing a distinct purple category (`Inaccessible: N (X%)`) and stacked progress bar segment.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/route.ts): Updated `stage2Unprocessed` query to separate `inaccessible_pdf` count (`UPPER(p.Local_PDF_Status) = 'INACCESSIBLE'`) from `pending_pdf`, added `inaccessible_pdf` property to `stageStats['2']`, and included it in the total denominator.
  - Modified [MetricSummaryCards.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/dashboard/MetricSummaryCards.tsx): Updated `renderStageBar` to accept `inaccessible_pdf`, display purple metric badge (`text-purple-400`), and render purple progress bar segment (`bg-purple-500`).
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with zero errors.

## #301 - Replicated Single PDF Acquisition UI/UX in Manual Screening (2026-08-03)
- **Goal**: Replicate the exact single paper PDF acquisition UI/UX from "Assign Papers to Calibration Pools" in "Manual Screening Pipeline Workspace" with real-time NDJSON stream logging, progress tracking, resume login, cancel actions, and main pipeline run checks.
- **Changes**:
  - Modified [useManualScreening.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useManualScreening.ts): Added single PDF streaming state variables and integrated `useNdjsonStream` hook. Auto-rehydrates updated paper record upon completion.
  - Modified [ManualScreeningDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningDetailView.tsx): Styled PDF offline container, added "Get PDF via Cache Matching & Scraping" button, Cancel/Resume controls, main pipeline execution warning banner, and scrollable terminal console logging widget.
  - Modified [ManualScreeningView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningView.tsx): Forwarded single PDF acquisition stream props and `isMainPipelineRunning` status.
  - Modified [PipelineExecutionView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PipelineExecutionView.tsx): Passed `isMainPipelineRunning` status from batch operations to `ManualScreeningView`.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with zero errors.

## #300 - Manual Screening PDF Viewer Auto-Switch & UI Sync (2026-08-03)
- **Goal**: Automatically update the UI and switch the detail view tab to the embedded PDF viewer (`pdf`) immediately after PDF matching or crawler acquisition finishes.
- **Changes**:
  - Modified [ManualScreeningDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningDetailView.tsx): Added `setActiveDetailTab('pdf')` inside `handleAcquirePdf` right after `broadcastSync('SYNC_PAPERS')` to seamlessly present the acquired PDF binary view to the reviewer.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with zero errors.

## #299 - Manual Screening PDF Acquisition Endpoint Alignment (2026-08-03)
- **Goal**: Make the "Acquire / Download PDF" button in "Manual Screening Pipeline Workspace" attempt local cache matching before web scraping, matching the behavior in "Assign Papers to Calibration Pools".
- **Changes**:
  - Modified [ManualScreeningDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningDetailView.tsx): Updated `handleAcquirePdf` to call `/api/pdf/single` instead of `/api/pdf/download`, enabling local cache matcher first before running the scraper, and reading the NDJSON response stream to completion before broadcasting sync events.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with zero errors.

## #298 - Scrape PDFs Python Engine Syntax Error Fix (2026-08-03)
- **Goal**: Fix `SyntaxError: invalid syntax` on line 239 of `scrape_pdfs.py` when initiating PDF downloading in "Manual Screening Pipeline Workspace".
- **Changes**:
  - Modified [scrape_pdfs.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/scrape_pdfs.py): Corrected indentation of `except Exception as e:` block on line 239 to match its corresponding `try:` block on line 215.
- **Verification**: Verified compilation with `python -m py_compile` with zero syntax errors.

## #297 - Fast Filter Exclusion Criteria Dropdown & Project Settings Enforcement (2026-08-03)
- **Goal**: Implement dedicated Exclusion Criteria dropdown for Stage 1: Fast Filter EXCLUDE decisions based on Project Settings -> Exclusion Criteria Rules (Pool A), strictly block saving EXCLUDE when Pool A rules are empty, and provide warning banner with one-click navigation to Project Settings.
- **Changes**:
  - Modified [ManualScreeningDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningDetailView.tsx): Formatted dropdown options as `[code] - [description]`. Added warning banner when Pool A `ec_rules` is empty with button dispatching custom `open-project-settings` event. Updated validation to strictly enforce selecting an exclusion code and prevent saving when rules are missing.
  - Modified [ProjectSettingsModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ProjectSettingsModal.tsx): Added `initialTab` prop support and `useEffect` state synchronization.
  - Modified [DashboardView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/DashboardView.tsx) & [page.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx): Added global `open-project-settings` event listener to launch Project Settings modal directly focused on the Calibration & Rules tab.
- **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with zero errors.

## #296 - Strict Multi-Project Separation & Isolation Agent Directives (2026-07-30)
- **Goal**: Institutionalize mandatory multi-project separation rules in `AGENTS.md` and `slr-ide/AGENTS.md` to prevent any future coding agent or automated workflow from writing un-scoped database queries or skipping project ID isolation.
- **Changes**:
  - Modified [AGENTS.md (root directive)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/AGENTS.md): Added Section 3.8 mandating Project ID isolation for all SQL operations, subquery JOIN alignments, protected `'default-project'` ID status, atomic deletion cascades, vector search allowlists, and remote worker result callbacks.
  - Modified [AGENTS.md (slr-ide directive)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/AGENTS.md): Added Section 3.6 replicating the mandatory Multi-Project Isolation policy.
- **Verification**: Verified Markdown formatting and agent directives structure.

## #295 - Removed Prompt Library from Project Settings Modal (2026-07-30)
- **Goal**: Remove redundant Prompt Library tab and component from Project Settings modal since prompt management is fully integrated into the LLM Pipeline view (`GlobalLLMSettingsView.tsx`).
- **Changes**:
  - Modified [ProjectSettingsModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ProjectSettingsModal.tsx): Removed `'prompts'` tab, `PromptLibraryView` import, default stage prompt state, schema mapping controls, and unneeded fetch calls.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #294 - LLM Audit Ledger Full Payload Storage & Lazy-Loading Optimization (2026-07-30)
- **Goal**: Preserve full LLM API prompt and raw response payloads in SQLite `llm_audit_log` for maximum FAIR scientific auditability while optimizing UI list rendering via payload lazy loading.
- **Changes**:
  - Modified [route.ts (llm audit API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/llm/audit/route.ts): Added single log fetch by `id` query parameter; updated paginated list query to select metadata and structured output fields while omitting heavy `raw_prompt` and `raw_response` text blocks.
  - Modified [LLMAuditLogView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/LLMAuditLogView.tsx): Added on-demand lazy loading of full log payload on row expansion with visual loading state indicator.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #293 - Paper Ingestion Default Unscreened Status & Migration Fix (2026-07-30)
- **Goal**: Ensure newly imported CSV papers and manually ingested papers default to status `0` (Unscreened) instead of `1` (Fast Filter), and clean up unscreened papers in active project.
- **Changes**:
  - Modified [useIngestion.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useIngestion.ts): Removed default `Status = 'PENDING'` during CSV parsing and manual ingestion.
  - Modified [route.ts (papers API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts): Updated `POST /api/papers` to set `manual_stage = 0` and `manual_decision = NULL` for empty or `'PENDING'` paper status.
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts): Added self-healing database migration scoped to active project that cleans up unscreened papers with `manual_stage = 1` back to `manual_stage = 0`.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #292 - Rolling Batch Adjudication, Stats & Status Project ID Scoping (2026-07-30)
- **Goal**: Scope all `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, and `rolling_batches` queries in `rolling-batch/adjudicate/route.ts`, `rolling-batch/stats/route.ts`, and `rolling-batch/status/route.ts` by active project ID.
- **Changes**:
  - Modified [route.ts (rolling batch adjudicate API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/adjudicate/route.ts): Added `Project_ID = activeProjectId` / `project_id = activeProjectId` to paper state read, update, unresolved check, and batch completion status update.
  - Modified [route.ts (rolling batch stats API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/stats/route.ts): Added `AND Project_ID = ?` passing `activeProjectId` to cumulative, individual, and audit verification `rolling_batch_papers` queries.
  - Modified [route.ts (rolling batch status API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/status/route.ts): Added `AND Project_ID = ?` / `AND project_id = ?` passing `activeProjectId` to `rolling_batch_papers` and `rolling_batch_reviewer_decisions` queries.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #291 - SLR Viewer Exporter Rolling Batch Project ID Scoping (2026-07-30)
- **Goal**: Scope all `rolling_batch_papers` queries in `export/slr-viewer/route.ts` by `Project_ID`.
- **Changes**:
  - Modified [route.ts (slr-viewer export API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Added `AND Project_ID = ?` passing `resolvedProjectId` to cumulative, individual, and audit verification `rolling_batch_papers` queries.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #290 - Remote Worker Result Scoping & Fallback Elimination (2026-07-30)
- **Goal**: Mandate `targetProjectId` resolution and enforce `AND Project_ID = targetProjectId` on all `UPDATE papers` queries in `remote-worker/result/route.ts`.
- **Changes**:
  - Modified [route.ts (remote worker result API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/remote-worker/result/route.ts): Added worker ID filtering to target project lookup, eliminated un-scoped fallback `UPDATE` statements, and appended `AND Project_ID = targetProjectId` across all database updates.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #289 - Calibration Commit Ledger JOIN Project ID Scoping (2026-07-30)
- **Goal**: Scope subqueries and JOIN ON conditions in `calibration_commit_ledger` queries in `adjudicate/stats/route.ts` and `export/slr-viewer/route.ts` by project ID.
- **Changes**:
  - Modified [route.ts (adjudicate stats API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts): Selected `project_id` in `latest` subquery and added `AND CAST(latest.project_id AS TEXT) = CAST(l.project_id AS TEXT)` to `JOIN ON`.
  - Modified [route.ts (slr-viewer export API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Selected `project_id` in `latest` subquery and added `AND CAST(latest.project_id AS TEXT) = CAST(l.project_id AS TEXT)` to `JOIN ON`.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #288 - Rolling Batch Isolation & Deletion Cascade Completion (2026-07-30)
- **Goal**: Complete rolling batch table deletion cascades in `projects/[id]/route.ts` and scope rolling batch export/import queries by project ID.
- **Changes**:
  - Modified [route.ts (project by ID API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/%5Bid%5D/route.ts): Added cascading `DELETE` statements for `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, and `rolling_batch_commit_ledger`.
  - Modified [route.ts (rolling batch export API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/export/route.ts): Added `AND Project_ID = ?` passing `resolvedProjectId` to `rolling_batch_papers` query.
  - Modified [route.ts (rolling batch import API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Added `AND project_id = ?` passing `resolvedProjectId` to `rolling_batch_reviewer_decisions` queries.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #287 - Projects Dashboard Scoping & Cascading Deletion / Purge Cleanup (2026-07-30)
- **Goal**: Scope subqueries and JOINs in `projects/route.ts` dashboard counters, add complete table deletion cascades in `projects/[id]/route.ts`, and clear audit logs on paper purge in `papers/purge/route.ts`.
- **Changes**:
  - Modified [route.ts (projects list API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/route.ts): Added `l.project_id = p.Project_ID` and `m.project_id = p.Project_ID` to subqueries and `AND p.Project_ID = ?` to paper JOINs across stages 2, 3, and 4.
  - Modified [route.ts (project by ID API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/%5Bid%5D/route.ts): Added cascading `DELETE` statements for `calibration_papers`, `manual_audit_log`, `llm_audit_log`, `duplicate_pairs`, `rolling_batches`, and `umbrellanizer_results`.
  - Modified [route.ts (papers purge API)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/purge/route.ts): Added associated audit log deletions (`manual_audit_log` and `llm_audit_log`) when purging papers.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #286 - Python Cache Matcher & Publisher Mapper Project ID Scoping (2026-07-30)
- **Goal**: Scope all PDF status/path self-healing updates in `match_cache.py` and publisher metadata updates in `map_publisher.py` by active `Project_ID`.
- **Changes**:
  - Modified [match_cache.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/match_cache.py): Scoped 4 `UPDATE papers` statements with `WHERE Paper_ID = ? AND Project_ID = ?` passing `active_proj_id`.
  - Modified [map_publisher.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/map_publisher.py): Scoped `UPDATE papers SET Publisher = ?` statement with `WHERE Paper_ID = ? AND Project_ID = ?` passing `active_proj_id`.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #285 - Calibration Subquery Strict Isolation & Duplicate Resolution Guard (2026-07-30)
- **Goal**: Fix residual lax calibration subquery in `papers/route.ts` and add non-null duplicate pair check in `duplicates/resolve/route.ts`.
- **Changes**:
  - Modified [route.ts (papers)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts): Replaced `(cp.Project_ID = papers.Project_ID OR cp.Project_ID = '${activeProjectId}')` with strict `cp.Project_ID = papers.Project_ID` in `calibrationPoolSubquery`.
  - Modified [route.ts (duplicates resolve)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/duplicates/resolve/route.ts): Added guard returning 404 `Duplicate pair not found.` if `pair` is null.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #284 - Vector Search Engine & Service-Layer Project ID Scoping (2026-07-30)
- **Goal**: Scope vector search engines (`vector_worker.py`, `semantic_search.py`), semantic search cache (`semantic-search-cache.ts`), cloud sync (`rclone-sync.ts`), and self-healing DB migrations (`db-init.ts`) to active `Project_ID` to prevent cross-project vector search leaks.
- **Changes**:
  - Modified [vector_worker.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/vector_worker.py): Always construct `allowlist_ids` scoped by `active_project_id` for paper search; construct `pdf_filenames` allowlist for PDF vector search; add `AND Project_ID = ?` to metadata SELECT queries.
  - Modified [semantic_search.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/semantic_search.py): Always construct `allowlist_ids` scoped by `active_project_id`.
  - Modified [semantic-search-cache.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/semantic-search-cache.ts): Removed lax `OR Project_ID` clause, scoped parent title subquery by `parent.Project_ID = papers.Project_ID`, and added `AND Project_ID = ?` to papers metadata SELECT query.
  - Modified [rclone-sync.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/pipeline/rclone-sync.ts): Scoped `UPDATE papers` queries by `AND Project_ID = activeProjectId`.
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts): Scoped self-healing legacy PDF path `UPDATE papers` statements by `AND Project_ID = projectId`.
- **Verification**: Verified TypeScript build (`npx tsc --noEmit`) with 0 errors.

## #283 - Correlated Subquery & Audit Log Project ID Isolation (2026-07-30)
- **Goal**: Scope all correlated subqueries referencing `manual_audit_log` and `llm_audit_log` across Next.js API routes and Python LLM scripts to enforce strict project isolation and prevent cross-project decision/exclusion code leakage.
- **Changes**:
  - Modified [main.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/main.py): Scoped `NOT EXISTS (SELECT 1 FROM manual_audit_log ...)` subqueries by `manual_audit_log.project_id = papers.Project_ID`.
  - Modified [route.ts (llm count)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/llm/count/route.ts): Scoped `manual_audit_log` subquery by `manual_audit_log.project_id = papers.Project_ID`.
  - Modified [route.ts (manual-screening)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/manual-screening/route.ts) & [route.ts (papers)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts): Scoped all 30+ `manual_audit_log` and `llm_audit_log` decision/exclusion trigger subqueries by `project_id = papers.Project_ID` / `project_id = ${tableName}.Project_ID`.
  - Modified [route.ts (final-cohort)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/insight/final-cohort/route.ts), [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts), & [route.ts (projects)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/route.ts): Scoped `llm_audit_log` structured output subqueries by `project_id`.
  - Modified [route.ts (rolling-batch adjudicate)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/adjudicate/route.ts): Scoped batch lookup query by `project_id = activeProjectId`.
- **Verification**: Verified TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #282 - Comprehensive Project ID Scoping Audit & Fixes (2026-07-30)
- **Goal**: Perform deep audit and fix all non-adherence instances where SQL queries operate on `papers` or related tables without strict `Project_ID` scoping across LLM queue handler, API routes, and Python engine scrapers/tools.
- **Changes**:
  - Modified [queue_handler.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/queue_handler.py): Scoped `paper_db` stage fetch and `UPDATE papers SET ai_*` decision queries by `Project_ID = self.project_id`.
  - Modified [route.ts (papers)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts): Scoped `Parent_Paper_Title` subquery by `parent.Project_ID = papers.Project_ID` and scoped auto-increment `idCounter` to active project paper IDs.
  - Modified [route.ts (manual-screening)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/manual-screening/route.ts): Scoped `Parent_Paper_Title` subquery by `parent.Project_ID = papers.Project_ID`.
  - Modified [route.ts (pdf single)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/pdf/single/route.ts): Scoped `dbStatusRow` and `finalPaper` SELECT and UPDATE queries by `AND Project_ID = activeProjectId`.
  - Modified [route.ts (remote-worker result)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/remote-worker/result/route.ts): Fetched target `Project_ID` first and scoped all `UPDATE papers SET Local_PDF_Status = 'FAILED'` queries by `Project_ID`.
  - Modified Python Entrypoints ([find_traps.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/find_traps.py), [semantic_search.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/semantic_search.py), [scrape_pdfs.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/scrape_pdfs.py), [verify_pdfs.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/verify_pdfs.py)): Scoped metadata enrichment queries and status UPDATE queries by `Project_ID`.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #281 - Restored Default Project Paper Isolation & Fixed DB Migration (2026-07-28)
- **Goal**: Fix migration logic in `migrate-project-ids.ts` that mistakenly treated valid `'default-project'` records as unassigned placeholders, and restore papers/calibration papers to `default-project`.
- **Changes**:
  - Modified [migrate-project-ids.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/migrate-project-ids.ts): Removed `OR Project_ID = 'default-project'` from `UPDATE` queries so `'default-project'` is preserved as a legitimate project identifier.
  - Database Restoration: Restored 4,169 papers and 100 calibration papers (imported prior to July 27) back to `Project_ID = 'default-project'`, while maintaining 962 papers and 20 calibration papers in `Project_ID = 'proj-1785151253485'`.
- **Verification**: Verified TypeScript compilation (`npx tsc --noEmit`) with 0 errors and confirmed exact database counts for both projects.

## #280 - Strict Project ID Adherence & Self-Healing Migration (2026-07-27)
- **Goal**: Resolve Project ID non-adherence across `slr-ide`, eliminating lax SQL fallback clauses (`Project_ID = 'default-project' OR Project_ID IS NULL`), enforcing strict `Project_ID = activeProjectId` filtering on REST API routes and Python CLI entrypoints, and executing a self-healing database migration.
- **Changes**:
  - Created [migrate-project-ids.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/migrate-project-ids.ts): Implemented self-healing database migration that normalizes all legacy `papers` and `calibration_papers` rows with `Project_ID` set to `NULL`, `''`, or `'default-project'` to the active project ID. Registered in [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts).
  - Modified [route.ts (papers)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts): Replaced lax `filterQuery` SQL clause `(Project_ID = ? OR Project_ID = 'default-project' OR Project_ID IS NULL OR Project_ID = '')` with strict `Project_ID = ?`. Scoped citation update statements and batch PUT update query by `Project_ID`.
  - Modified [route.ts (papers/[id])](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/%5Bid%5D/route.ts): Scoped `GET`, `PUT`, and `DELETE` queries by `Paper_ID = ? AND Project_ID = ?`.
  - Modified [route.ts (duplicates)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/duplicates/route.ts) & [route.ts (duplicates/resolve)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/duplicates/resolve/route.ts): Scoped paper lookup and atomic resolution updates by `Project_ID`.
  - Modified [route.ts (calibration/assign)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/calibration/assign/route.ts): Removed lax `Project_ID` fallback OR clauses, enforcing strict `Project_ID = ?` checks.
  - Modified [route.ts (pdf/delete)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/pdf/delete/route.ts) & [route.ts (remote-worker/claim)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/remote-worker/claim/route.ts): Scoped PDF resets and remote paper claims by `Project_ID`.
  - Modified Python Entrypoints ([build_vectors.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/build_vectors.py), [semantic_search.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/semantic_search.py), [vector_worker.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/vector_worker.py), [match_cache.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/match_cache.py), [scrape_pdfs.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/scrape_pdfs.py), [verify_pdfs.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/verify_pdfs.py), [compress_pdfs.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/compress_pdfs.py), [map_publisher.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/map_publisher.py)): Added mandatory `--project` argument parsing and replaced lax SQL fallbacks with strict `Project_ID = ?` queries.
  - Modified API Process Callers ([download](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/pdf/download/route.ts), [scan](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/pdf/scan/route.ts), [single](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/pdf/single/route.ts), [remote-worker/result](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/remote-worker/result/route.ts), [vectors/build](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/vectors/build/route.ts), [vectors/search](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/vectors/search/route.ts), [vectors/traps](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/vectors/traps/route.ts), [subprocess-runner.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/pipeline/subprocess-runner.ts)): Passed `--project activeProjectId` explicitly when spawning Python subprocesses.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #279 - Standardized .slr File Project ID Scoping & Import Verification (2026-07-27)
- **Goal**: Fix bug in `slr-ide` where exporting and importing `.slr` files did not adhere strictly to `projectId` scoping, causing cross-project data leakage or defaulting to active project config.
- **Changes**:
  - Modified [route.ts (inter-rater export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/inter-rater/route.ts): Extracted `projectId` query parameter with fallback to active project, resolved project by numeric/string ID (`resolvedProjectId`), scoped queries by `resolvedProjectId`, and embedded `project_id: resolvedProjectId` in `.slr` metadata.
  - Modified [route.ts (rolling-batch export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/export/route.ts): Updated GET signature to accept request, resolved `projectId` with fallback, scoped `rolling_batches` query by `resolvedProjectId`, and embedded `project_id` in `.slr` metadata.
  - Modified [route.ts (fair-data export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/fair-data/route.ts): Resolved `projectId` with fallback to active project ID, used `resolvedProjectId` consistently across all database queries, and embedded `project_id` in `.slr` metadata.
  - Modified [route.ts (inter-rater import)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts): Added `projectId` query parameter resolution, validated `body.metadata.project_id` against `resolvedProjectId` (returning 400 error on mismatch), and scoped all transaction queries and cache invalidations by `resolvedProjectId`.
  - Modified [route.ts (rolling-batch import)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Resolved target project ID, added `project_id` metadata mismatch check (returning 400 error on mismatch), and scoped batch queries and inserts by `resolvedProjectId`.
  - Modified [InterRaterDashboard.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/InterRaterDashboard.tsx): Appended `&projectId=${activeProjectId}` to export, import, reset, stats, and ledger API calls.
  - Modified [useRollingBatch.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useRollingBatch.ts): Appended `?projectId=${projectId}` to status, stats, initialize, export, and import API calls.
- **Verification**: Verified TypeScript compilation (`npx tsc --noEmit`) with 0 errors.

## #278 - Turbovec Semantic Search Optimization & Master Project_ID Synchronization (2026-07-27)
- **Goal**: Resolve turbovec semantic search slowness, fix 25-paper search result paging cap, implement real-time incremental vector index persistence, auto-reload stale in-memory indices on disk modifications, and unify project ID filtering across all SQLite queries.
- **Changes**:
  - Executed Master Database Migration: Normalized all 5,131 papers in `db/slr.db` to active `Project_ID` (`proj-1785151253485`), resolving legacy `'default-project'` string mismatches that caused search allowlists to exclude papers.
  - Modified [vector_worker.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/vector_worker.py), [semantic_search.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/semantic_search.py), [find_traps.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/find_traps.py), and [route.ts (papers)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts): Updated default `k` parameter from `20`/`25` to `1000`, added `(Project_ID = ? OR Project_ID = 'default-project' OR Project_ID IS NULL OR Project_ID = '')` fallback SQL filter across all paper queries.
  - Modified [index_manager.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/vector/index_manager.py): Implemented file `mtime` modification tracking in `VectorIndexManager.get_paper_index()` and `get_pdf_index()`. If vector index files on disk are updated or rebuilt, in-memory index objects auto-reload seamlessly on the fly.
  - Modified [build_vectors.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/entrypoints/build_vectors.py): Swapped phase order to index Paper Corpus first, added incremental `paper_index.write(PAPER_INDEX_PATH)` after each batch so vector index updates land on disk immediately as embedding runs.
  - Modified [embedder.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/vector/embedder.py): Added `torch.set_num_threads(os.cpu_count() or 4)` in `TextEmbedder.get_model()` for multi-threaded PyTorch CPU matrix multiplication acceleration.
  - Modified [useCalibration.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useCalibration.ts): Fixed search input debouncing effect so active semantic queries auto-sync with `assignSearch` inputs.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors and Python vector search returning 1,000 matches cleanly for `pool: 'unassigned'`.

## #277 - Paper Details Workspace Multi-Tab View Refactor (2026-07-27)
- **Goal**: Refactor the Paper Details Workspace (`AssignDetailView.tsx`) within the "Assign Papers to Calibration Pools" modal (`FullscreenAssignModal.tsx`) to create a multi-tab view for seamless switching between paper metadata and full-text PDF viewer.
- **Changes**:
  - Modified [AssignDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/fullscreen-assign/AssignDetailView.tsx): Refactored panel into a 2-tab layout (`Metadata & Notes` and `PDF Viewer`), preserving persistent top header summary with quick pool assignment actions (Pool A, Pool B, Pool C, Unassign). Added dynamic PDF status badges on the tab header (`Pool A`, `PDF Ready`, `Missing PDF`), automatic tab switching on acquisition start or paper selection, full-height iframe PDF viewing, and single PDF acquisition console integration.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Updated directory description for `AssignDetailView.tsx`.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #276 - Bulk CSV Ingest CSV Source Selection (2026-07-27)
- **Goal**: Add a CSV Source selection input control to the Bulk CSV Ingest panel in `slr-ide` allowing users to select or type the literature database source (e.g., IEEE Xplore, Scopus, Web of Science, PubMed, etc.) and save it into the `Source` column of the `papers` database table.
- **Changes**:
  - Modified [useIngestion.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useIngestion.ts): Added `csvSourceSelect` and `csvCustomSource` state management, computed `effectiveSource`, updated `handleImport` payload to populate `Source` and `Import_Source` fields, and exported set state handlers.
  - Modified [IngestionHubView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/IngestionHubView.tsx): Rendered CSV Source dropdown selector with standard academic database options (`IEEE Xplore`, `Scopus`, `Web of Science`, `PubMed`, `ACM Digital Library`, `Google Scholar`, `ScienceDirect`, `SpringerLink`, `Other...`) and custom text input field when `Other` is selected.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #275 - Dynamic Grouping Variable List in Cloud Gold Mine (2026-07-23)
- **Goal**: Dynamically populate all available extracted taxonomy keys (such as `rq2_a_autonomy_level`) in the Cloud Gold Mine grouping variable dropdown menu.
- **Changes**:
  - Modified [route.ts (keys)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/keys/route.ts): Updated key discovery logic to query both `umbrellanizer_results` (`extracted_data_key`) AND all `manual_extracted_data` / `ai_extracted_data` JSON payloads in the `papers` table for the active project. Filtered out internal metadata keys (`_` prefixes, `logic_trace`, `qa_scores`, etc.) and returned a clean, sorted list of unique keys.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #274 - Cloud Gold Mine QA Sorting & RQ-Aware Folder Naming (2026-07-23)
- **Goal**: Implement QA-score descending order for >50 paper chunking, RQ-prefixed root export session folders, and RQ-prefixed `NOT_STATED` subfolders in Cloud Gold Mine (`slr-ide`).
- **Changes**:
  - Modified [route.ts (cloud-gold-mine)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/route.ts): Added pre-calculation of composite QA scores and sorted qualifying papers in descending order before chunking into 50-source folders (`_Part1`, `_Part2`, etc.). Renamed root staging session directory from `gold_mine_[timestamp]` to `${RQKey}_${timestamp}` (or `Flat_Exports_${timestamp}`), and updated unstated taxonomy values to resolve to `${RQKey}_NOT_STATED` (e.g. `RQ1_Architecture_NOT_STATED_Part1`).
  - Modified [route.ts (cloud-gold-mine preview)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/preview/route.ts): Updated live preview calculations to mirror QA score descending sorting, RQ root folder session path preview, and `NOT_STATED` RQ-prefixed subfolder naming.
  - Modified [CloudGoldMinePanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/CloudGoldMinePanel.tsx): Updated directory tree preview header rendering.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #273 - Cohort Table View Repeated Taxonomy Number Badges (2026-07-22)
- **Goal**: Add small pill badge counters to extracted data cells in Cohort Table View when raw multi-value extraction terms map to repeated Umbrellanizer taxonomy categories.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Preserved non-deduplicated mapped tokens in `parseExtractedData` without `new Set(...)`, updated `renderExtractedVal` badge counter styling (`bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 rounded-full font-black text-[8px]`), and kept comma-separated formatting in `valueToCopy`.
  - Modified [route.ts (csv-tabular export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/csv-tabular/route.ts): Preserved non-deduplicated mapped tokens in CSV tabular export route.

## #272 - Cohort Visualizer Datasource Warning & Taxonomy Trends Print PDF (2026-07-22)
- **Goal**: Add active filter warning badge and alert banners to SLR Cohort Visualizer Wizard when table view filters are active, and add Print PDF report button with auto-expanding accordions to Taxonomy Trends Quick Overview.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Passed `totalUnfilteredCount={allPapers.length}` and `isFiltered={filteredPapers.length < allPapers.length}` props to `<VisualizerModal />`.
  - Modified [VisualizerModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx): Updated `VisualizerModalProps` interface, added amber warning badge in wizard header displaying filtered paper ratio (`Filtered: X / Y papers`), and added amber warning alert banners at top of Step 1 and Step 4 when filters are active.
  - Modified [QuickOverviewModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/QuickOverviewModal.tsx): Added `Printer` icon button next to "Download JSON" in modal footer, added `handlePrintPdf` print handler, set print mode expansion (`isPrinting`) so all research question categories and normalization justifications expand during print output, applied strict `@media print` scoped target rules (`.taxonomy-trends-print-area`) so only the Taxonomy Trends report content prints, and applied print-friendly hidden classes (`print:hidden`).
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Updated entries for `VisualizerModal.tsx` and `QuickOverviewModal.tsx`.

## #271 - Include NOT_STATED in Taxonomy Trends Quick Overview (2026-07-22)
- **Goal**: Include `NOT_STATED` values in the Taxonomy Trends Quick Overview calculation, UI display, and JSON export.
- **Changes**:
  - Modified [QuickOverviewModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/QuickOverviewModal.tsx): Updated `processVal` to permit `NOT_STATED` string values (allowing custom Umbrellanizer category mappings if defined, or resolving to `'NOT_STATED'`), added subtle muted styling for `'NOT_STATED'` categories, and preserved JSON download export.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #270 - Cloud Gold Mine NotebookLM Ingestion & Execution Tracking Upgrade (2026-07-22)
- **Goal**: Upgrade Cloud Gold Mine export in `slr-ide` for NotebookLM ingestion: inverted theme-first directory hierarchy, multi-category array duplication, QA threshold filtering, dedicated cloud destination path, live NDJSON progress streaming, and cancellation support.
- **Changes**:
  - Created [goldmine-state-tracker.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/services/goldmine-state-tracker.ts): Singleton NDJSON state tracker for Gold Mine exports managing staging/uploading phases, live progress counters, logs, state restore, and process cancellation.
  - Modified [route.ts (cloud-gold-mine)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/route.ts): Added GET handler for NDJSON stream (`?stream=true`) and status snapshot (`?status=true`), DELETE handler for cancellation, POST handler acquiring `PipelineLock`, filtering by stage-aware QA score (`>= minQaThreshold`), staging into theme-first directory structure (`<category>/<original_filename>.pdf`), multi-category array handling, rclone progress parsing, and auto-cleanup.
  - Modified [CloudGoldMinePanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/CloudGoldMinePanel.tsx): Added QA threshold toggle and numeric input, updated directory structure preview, integrated `useNdjsonStream` for live two-phase progress streaming (staging + rclone upload), cancel button, and state restore on mount.
  - Created [route.ts (cloud-gold-mine preview)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/cloud-gold-mine/preview/route.ts): Added real-time GET preview endpoint returning dynamic directory tree structures, category folder counts, estimated file totals, and sample PDF filenames from actual project database papers.
  - Modified [CloudGoldMinePanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/CloudGoldMinePanel.tsx): Replaced static folder preview with live dynamic tree structure populated from real database papers as user changes parameters (grouping variable, QA filter, min QA score).
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts): Added `goldmine_dest_path TEXT` column to `projects` table DDL and migration.
  - Modified [useProjectForm.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useProjectForm.ts), [ProjectSyncSettings.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/settings/ProjectSyncSettings.tsx), & [ProjectSettingsModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ProjectSettingsModal.tsx): Added "Gold Mine Export Path" setting field to Cloud Sync tab.
  - Modified [.gitignore](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/.gitignore): Added `tmp/` exclusion for staging directories.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Documented `goldmine-state-tracker.ts`, `preview/route.ts`, and updated route descriptions.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #269 - Codebase Scratch & Patch File Cleanup for Repository Release (2026-07-21)
- **Goal**: Clean up all temporary scratch scripts, patch files, test outputs, and unused utility scripts across the entire repository to prepare for clean public repository release.
- **Changes**:
  - Deleted 19 temporary scripts from `scratch/` and `slr-ide/scratch/` (`check_db.py`, `check_db_details.py`, `check_db_exact.py`, `find_slr_csv.py`, `check.js`, `check_json.py`, `extract_from_sourcemap.py`, `find_large_files.js`, `inspect_db.js`, `inspect_paper.js`, `migrate-cal.js`, `migrate-status.js`, `migrate-v2.js`, `migrate.js`, `migrate_manual_audit.ts`, `patch_pipeline_status.js`, `recalculate_costs.js`, `test_epoch3.py`, `test_epoch4.py`).
  - Removed temporary test PDFs (`slr-ide/test_out*.pdf`), legacy `slr-ide/CLAUDE.md`, and `app-script/git-clean.sh`.
  - Updated root [.gitignore](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/.gitignore) with exclusions for `scratch/`, `**/scratch/`, `*.patch`, and `*.diff`.
  - Updated [slr-ide/files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md) registry Section 4.
- **Verification**: Verified with `git status` showing clean workspace.

## #268 - Cohort Table View 100% CSV Tabular Export with Tooltips (2026-07-21)
- **Goal**: Export 100% of Cohort Table View dynamic columns, scores, extracted research variables, and tooltip logic traces (`tt_*`) into the CSV Tabular Export.
- **Changes**:
  - Modified [route.ts (csv-tabular export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/csv-tabular/route.ts): Replaced static hardcoded headers with dynamic key discovery for QA criteria (`qaKeys`) and extracted research variables (`extKeys`). Implemented stage dominance parsing (`manual` over `ai`), Umbrellanizer category mapping resolution, and placed tooltip columns (`tt_original_*`, `tt_mapping_*`, `tt_evidence_*`, `tt_justification_*`) immediately following their related parent data column.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 build errors.

## #267 - Type-Safe SQLite CAST Matching in Adjudicate & Export Routes (2026-07-21)
- **Goal**: Guarantee 100% data parity for Stage Comparisons (Pool C Pre-Norm Yield 85.5%) when exporting `.slr-viewer` files from `slr-ide`.
- **Changes**:
  - Modified [route.ts (adjudicate stats)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts) & [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Updated all SQL queries on `calibration_commit_ledger`, `llm_audit_log`, `rolling_batches`, and `umbrellanizer_results` to use `WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)`. This ensures string vs integer project ID matching parity in SQLite database queries when calculating and exporting stage statistics.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #266 - Zero Mockup & Synthetic Fallback Audit (2026-07-21)
- **Goal**: Strict scientific data integrity audit to remove all synthetic call rows, hardcoded metric fallbacks, and fake default numbers across `slr-ide` and `slr-viewer`.
- **Changes**:
  - Modified [AccountingPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/AccountingPanel.tsx) & [AccountingPanel.jsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/accounting/AccountingPanel.jsx): Completely removed synthetic `id: 'synthetic_umbrellanizer'` row generation. Table displays strictly genuine logged call records from database audit logs.
  - Modified [BatchStatisticsCards.jsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/BatchStatisticsCards.jsx): Removed hardcoded fallback mockup values (`100`, `1.0`, `94.2`) for Stage 4 Schema Integrity, CI Lower Bound, and Semantic Agreement, replacing them with exact nullish evaluation (`?? 0`).
- **Verification**: Verified with `npx tsc --noEmit` and `npm run build` with 0 errors.

## #265 - Gold Standard vs AI Stage Comparison Parity Fix (2026-07-21)
- **Goal**: Fix discrepancy between `slr-ide` and `slr-viewer` Stage Comparison Pre-Norm Yield metric (85.5% vs 100%) and eliminate fallback mockup numbers in export payloads.
- **Changes**:
  - Modified [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Fixed typo in `checkFuzzyMatch` subset calculation (`getTokens(ai)` replaced with `gTokens`) that forced 100% match yield. Removed hardcoded fallback mockup values (`0.912`, `0.885`, `0.95`, `0.78`, `85.0`, `92.5`) across all 4 stage comparison objects in favor of exact calculated numbers with `?? 0`.
  - Modified [StageComparisonPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/StageComparisonPanel.tsx): Switched Pre-Norm Yield fallback from `||` to nullish coalescing `??`.
- **Verification**: Verified with `npx tsc --noEmit` returning 0 errors.

## #264 - Accounting Panel Pipeline Breakdown Unbolding & Umbrellanizer Top Calls (2026-07-21)
- **Goal**: Unbold text elements in the Pipeline Cost Breakdown panel, replace zero MIN displays with the minimum positive value closest to 0, and ensure `umbrellanizer` task calls appear reliably in the Top Expensive API Calls table.
- **Changes**:
  - Modified [AccountingPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/AccountingPanel.tsx): Replaced `font-bold`/`font-semibold` text styling with `font-normal`. Implemented positive-only MIN cost and token resolution. Added a Task select dropdown (`All Tasks`, `Fast Filter`, `Gatekeeper`, `Scientist`, `Miner`, `Umbrellanizer`) and fallback Umbrellanizer call synthesis from `pipelineBreakdown`.
  - Modified [route.ts (accounting insight)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/insight/accounting/route.ts) & [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Updated SQL queries to use `WHERE CAST(project_id AS TEXT) = CAST(? AS TEXT)` ensuring type-safe SQLite matching across string/integer project IDs, and `UNION`ed `llm_audit_log` with `umbrellanizer_results`.
- **Verification**: Verified with `npx tsc --noEmit` passing cleanly with zero errors.

## #263 - Cohort Table Full-Height Layout & Topbar Visualizer Button (2026-07-21)
- **Goal**: Move the "Visualize Cohort" button up beside the "Advanced Filters" button in the top navigation header and remove card containers so the Cohort Table View fills 100% of the parent container space.
- **Changes**:
  - Modified [page.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx): Placed `Visualize Cohort` button in header bar next to `Advanced Filters`, added `isCohortVisualizerOpen` state, and conditionally removed container padding (`p-0`).
  - Modified [InsightExportView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/InsightExportView.tsx): Passed visualizer props and removed outer card border/margin when viewing the cohort table.
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Removed card borders/rounded-xl/shadows and removed redundant subheader Visualize button so the table takes 100% container height and width.
- **Verification**: Verified with `npx tsc --noEmit` returning zero build errors.

## #262 - Added Year & Publisher Quick Attribute Scope Filters (2026-07-21)
- **Goal**: Add dynamic "Year" and "Publisher" filter dropdowns to the Quick Attribute Scope / Paper Metadata filter section in Cohort Table View.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Added `yearFilter` and `publisherFilter` states, dynamically extracted unique `years` (sorted descending) and `publishers` (sorted alphabetically) in `filterOptions`, and added UI select dropdowns under Paper Metadata.
- **Verification**: Verified with `npx tsc --noEmit` returning zero build errors.

## #261 - Fixed Extracted Taxonomy Variable Token Splitting & Deep Filtering (2026-07-21)
- **Goal**: Fix extracted taxonomy variable filtering in Cohort Table View to accurately split multi-token raw strings (e.g., `"Smart Home, Aerospace"`) and match both resolved umbrella categories and raw tokens.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Updated `parseExtractedData` to split comma-separated tokens before Umbrellanizer mapping, and updated `filteredPapers` to evaluate unified `allTokens` (resolved + original) against selected filter target values.
- **Verification**: Verified with `npx tsc --noEmit` returning zero build errors.

## #260 - Added Active Row Highlighting in Cohort Table View (2026-07-21)
- **Goal**: Provide active row selection and visual background highlighting when a paper row, cell, or tooltip button is clicked in Cohort Table View.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Added `selectedPaperId` state and applied active row highlighting (`bg-primary/15 dark:bg-primary/25 border-l-2 border-l-primary`) on click.
- **Verification**: Verified with `npx tsc --noEmit` returning zero build errors.

## #259 - Added PDF File Link to Logic Trace & Details Popovers (2026-07-21)
- **Goal**: Add a direct PDF file link button on the right side of the "Logic Trace & Details" popover header in `slr-ide` Cohort Table View.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Added `pdfLink` prop to `ClickableCell` and rendered a direct PDF link (`PDF Link` with `ExternalLink` icon) in the header bar of the trace popover.
- **Verification**: Verified with `npx tsc --noEmit` returning zero build errors.

## #258 - Fixed SLR Viewer Export Column Mapping & Extracted Metadata Filtering (2026-07-21)
- **Goal**: Fix `umbrellanizer_results` column name queries in `slr-ide`'s export endpoint `/api/export/slr-viewer` and filter internal metadata fields from extracted data tables.
- **Changes**:
  - Modified [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Replaced invalid column names (`field_name`, `taxonomy_mapping`) with correct SQLite schema columns (`extracted_data_key`, `umbrella_mapping`) to export populated taxonomy mappings in `.slr-viewer` snapshot files.
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Added metadata key exclusions (`_` prefix, `logic_trace`, `_scientist_logic_trace`) in `parseExtractedData`, `parseExtractedTraces`, and `filterOptions`.
- **Verification**: Verified with `npx tsc --noEmit`.

## #257 - Realigned SLR Viewer Exporter Calculations (2026-07-21)
- **Goal**: Realign PRISMA flowchart calculations and scientist structured output logic trace merging inside `/api/export/slr-viewer` to resolve data parity bugs.
- **Changes**:
  - Modified [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Realigned `prismaData` calculation to match the dynamic classification, database sources array mapping, and stage exclusions of `/api/insight/prisma/route.ts`. Integrated `logic_trace` merging from `llm_audit_log` into `ai_quality_assessment` for all cohort papers.
- **Verification**: Verified successfully with `npx tsc --noEmit`.

## #256 - SLR Viewer Export Schema Enrichment for Complete Project Rules (2026-07-21)
- **Goal**: Expand `slr-ide`'s `/api/export/slr-viewer` GET endpoint to export complete project configuration rules and pool sizing targets.
- **Changes**:
  - Modified [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Added `ec_rules`, `pool_c_qa_rules`, `pool_c_extraction_rules`, and explicit pool filling stats (`pool_a_count`, `pool_b_count`, `pool_c_count`, `pool_a_size`, `pool_b_size`, `pool_c_size`) to `exportPayload.project`.
- **Verification**: Verified successfully with `npx tsc --noEmit` returning zero build errors.

## #255 - Fix SQLite Column Name Error in Accounting Export Query (2026-07-21)
- **Goal**: Fix runtime crash when executing the SLR Viewer export due to `no such column: timestamp` in the `llm_audit_log` query.
- **Changes**:
  - Modified [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Aliased the `created_at` column as `timestamp` inside the query fetching `expensiveCalls` from the `llm_audit_log` table.
- **Verification**: Verified successfully with `npx tsc --noEmit` returning zero build errors.

## #254 - Multi-Tier Cohort Papers Query Fallbacks for SLR Viewer Export (2026-07-21)
- **Goal**: Prevent empty cohort paper datasets in `.slr-viewer` export payloads by adding multi-tier database query fallbacks.
- **Changes**:
  - Modified [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): Added 3 fallback tiers when querying `cohortPapers` (Tier 1: Included papers at any stage; Tier 2: Non-duplicate papers in project; Tier 3: All papers in project), ensuring exported `.slr-viewer` files are never empty even if exported mid-pipeline.
- **Verification**: Verified successfully with `npx tsc --noEmit` passing with 0 errors.

## #253 - SLR Viewer Export Schema Dynamic Stage Comparisons & Rolling Batch QC Completion (2026-07-21)
- **Goal**: Upgrade `slr-ide`'s `.slr-viewer` dataset export API route (`/api/export/slr-viewer`) to dynamically compute real Stage Comparisons and Rolling Batch Sequential Audit statistics directly from SQLite database tables.
- **Changes**:
  - Upgraded [route.ts (slr-viewer export)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts):
    - Computed dynamic stage comparisons from `calibration_commit_ledger` and `calibration_papers` (Recall, Precision, F1, Kappa, Schema Integrity, and Pass/Fail status for Stages 1-4).
    - Computed dynamic rolling batch statistics from `rolling_batches` and `rolling_batch_papers` (`cumulative_stats`, `individual_batch_stats`, `audit_passed`, `batches`).
- **Verification**: Verified successfully with `npx tsc --noEmit` passing cleanly with zero errors.

## #252 - Split FAIR Data Export into SLR Viewer (.slr-viewer) and CSV Tabular (.csv) Exports (2026-07-21)
- **Goal**: Split the "FAIR Data Export" panel in `slr-ide` into two dedicated export cards: (1) SLR Viewer Export (`.slr-viewer` JSON snapshot for presentation), and (2) CSV Tabular Export (`.csv` for FAIR compliance).
- **Changes**:
  - Created [route.ts (slr-viewer)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/slr-viewer/route.ts): New GET API route assembling project metadata, PRISMA 2020 values, stage comparison metrics, pool filling status, rolling batch QC, final cohort paper records, taxonomy mappings, and token spend accounting into a single `.slr-viewer` JSON snapshot payload.
  - Created [route.ts (csv-tabular)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/export/csv-tabular/route.ts): New GET API route building a FAIR-compliant CSV containing all final cohort paper metadata, decision sources, QA scores (QA-1..QA-8) with justification quotes, and extracted research variables (RQ-1..RQ-9) with Umbrellanizer categories.
  - Modified [FairDataExportPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FairDataExportPanel.tsx): Redesigned panel into two side-by-side export cards with custom icons, module breakdowns, and instant download triggers.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Documented new export endpoints.
- **Verification**: Verified successfully with `npx tsc --noEmit` returning zero build errors.

## #251 - SLR Cohort Visualizer Wizard Data Limiting, Dynamic Depth & 17 Chart Types (2026-07-21)
- **Goal**: Add category data limiting, dynamic multi-level depth mapping (Sankey & Sunburst), a double-layered label overflow fix, and expand chart templates to 17 scientific types.
- **Changes**:
  - Modified [VisualizerModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Universal Data Limiting & Dynamic Depth Hierarchy**: Extended category data limiting (`limitCategoryMap`) to **Graph Network** and **Heatmap Matrix** charts to prevent grid/node clutter. Upgraded **Treemap** and **Sunburst Ring** to support dynamic multi-level depth mapping (2 to 6 levels) with recursive per-level max node limiting (`sankeyMaxNodes`), automatically grouping minority tail slices/tiles into an `"Other"` category.
    - **Gauge KPI Custom Scaling**: Added customizable max target scale input (`gaugeMaxScale`) in Step 3 for Gauge Dial charts.
    - **Sankey Outer Edge Padding & Label Alignment**: Added outer node edge padding controls (left % & right %) and per-level label position selectors (Left vs Right toggle per level).
    - **7 New Scientific Chart Types & SLR IDE Light Mode**: Added Radar/Spider, Funnel, Boxplot, Sunburst Ring, Graph Network, Gauge KPI, and Calendar Heatmap. Added **SLR IDE Light Mode** theme palette preset to Step 3 customization options.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Updated entry for `VisualizerModal.tsx`.
- **Verification**: Verified successfully with `npx tsc --noEmit` returning zero build errors.

## #250 - Refactored SLR Cohort Visualizer Wizard to Chart-First 4-Step Flow (2026-07-21)
- **Goal**: Refactor the Visualizer Wizard to structure step 2 (Data Mapping) and step 3 (Styling Customization) dynamically around the chart type selected in step 1, with the main interactive ECharts canvas rendered on step 4.
- **Changes**:
  - Modified [VisualizerModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx):
    - **Step 1 (Chart Selection)**: Dropdown selection and informative use-case cards for all 10 academic charts (Vertical/Horizontal Bar, Stacked Bar, Line, Pie/Donut, Scatter Plot, Bubble Chart, Treemap, Heatmap Matrix, and Sankey Flow).
    - **Step 2 (Chart-Tailored Data Mapping)**: Dynamic field mappings specific to selected chart structure (Single categorical for bar/pie; Secondary stack for 2D bar; Temporal ordinal for line; Dual/triple numerical selectors for scatter/bubble; Multi-node sequence for Sankey flow). Cell value treatment toggles (Umbrellanizer, multi-value cell splitting, empty value exclusion).
    - **Step 3 (Chart-Tailored Style Customization)**: Figure titles, subtitle, journal theme palette, font family/size, legend layout, and type-specific controls (donut hole radius, smooth curve spline, sankey node width/gap, marker size scale).
    - **Step 4 (Visualization & Scientific Export)**: Dedicated fullscreen interactive ECharts canvas with format select (SVG vs PNG) and DPI scaling controls (1x to 4x for 300+ DPI print figures).
- **Verification**: Verified with `npx tsc --noEmit` returning zero build errors.

## #249 - SLR Cohort Visualizer Wizard using Apache ECharts (2026-07-21)
- **Goal**: Implement a publication-ready data visualizer wizard for the Final Cohort view with 10 academic chart types, property customization, and high-res vector SVG and PNG exports.
- **Changes**:
  - Installed `echarts` (v5.6.0) package.
  - Created [VisualizerModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VisualizerModal.tsx): Fullscreen modal wizard offering 10 top-used academic charts (Vertical/Horizontal Bar, Stacked Bar, Line/Area, Pie/Donut, Scatter Plot, Bubble Chart, Treemap, Heatmap Matrix, and Sankey Flow), field mapping, taxonomy options, property styling, and SVG/high-DPI PNG exports.
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Added table header toolbar with filtered paper stats and the "Visualize Cohort" trigger button.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Logged the new `VisualizerModal.tsx` component.
- **Verification**: Verified successfully with `npx tsc --noEmit` returning zero build errors.

## #248 - Added Informative Tooltips to Rolling Batch Validation (2026-07-21)
- **Goal**: Introduce helpful context tooltips to the Rolling Batch Validation metrics matching the tooltip style of the pre-calibration Gold Standard comparisons.
- **Changes**:
  - Modified [BatchStatisticsCards.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/BatchStatisticsCards.tsx): Enhanced `StatsRow` component to support tooltip hover triggers and styled popovers. Added details for **QA Agreement (p̂)**, **Standard Error (SE)**, **95% CI Lower Bound** (Stage 3 & 4), **Critical Miss Rate**, **Schema Integrity Rate**, and **Semantic Agreement**.
- **Verification**: Successfully compiled via `npx tsc --noEmit`.

## #247 - Documented Stage 3 Rolling Batch "Agreement" Calculation Mechanics (2026-07-21)
- **Goal**: Clarify and formally document how "Agreement" is defined in the Stage 3 Rolling Batch Validation metric, following an audit of paper `George_2025_ExplainableDigi_1a630` which appeared to conflict with the reported 100% agreement result (second reviewer gave Exclude while AI gave INCLUDE).
- **Finding**: "Agreement" in Stage 3 is **ordinal QA score proximity**, NOT an Include/Exclude decision label match. The stats engine compares each of the 8 QA dimension scores (AI vs Gold Standard) independently. A pair is classified as *agreement* when `|ai_score - gold_score| < 1.0`, and as a *critical miss* only when `|ai_score - gold_score| >= 1.0`. A 0.5-point ordinal deviation (e.g., AI scores 1.0, human scores 0.5) is explicitly permitted and counts as agreement. Two raters can hold opposing final Include/Exclude decisions while contributing 100% QA agreement if their per-dimension scores are all within the 0.5-point tolerance band.
- **Root Cause of Apparent Mismatch**: The paper in question had AI total QA = 4.5 (→ INCLUDE at boundary) vs human total QA = 4.0 (→ Exclude below threshold), driven by a single 0.5-point gap on QA2. Since 0.5 < 1.0, all 8 QA pairs counted as agreement, producing 100% agreement and 0% critical miss — which is the correct and expected result per the methodology.
- **Changes**:
  - Modified [methodology.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/methodology.md): Added new sub-section §2.3.1 "Stage 3 Agreement Definition (Ordinal QA Proximity — NOT Decision Label)" with the per-pair classification rule table, all aggregate formula definitions, the exit threshold conditions, and the QA key schema mapping note (AI uses `qa1_aims`-style keys; human uses `QA1`-style short codes; matched via case-insensitive prefix logic).
  - Modified [stats/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/stats/route.ts): Added prominent JSDoc block and inline comments on the Stage 3 agreement loop explaining the ordinal-proximity rule, the QA key schema difference, and the critical miss threshold.
- **Verification**: No code logic changed — documentation only. Compilation state unchanged.

## #246 - Fixed Pre-Calibration Filling Status Stats Loading (2026-07-21)
- **Goal**: Fix bug where "Pre-Calibration Filling Status" cards in the Scientific Rigor panel were not loading the paper counts correctly.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/%5Bid%5D/route.ts): Updated the single project GET endpoint to query and attach the project's statistics (specifically the `pool_a_count`, `pool_b_count`, and `pool_c_count` values from `calibration_papers`) to the response object, aligning it with how the projects list page computes stats.
- **Verification**: Verified successfully with `npx tsc --noEmit`.

## #245 - Prisma Diagram Configuration Modal & Export Upgrade (2026-07-21)
- **Goal**: Implement a configuration modal for customizing the PRISMA flowchart (collapsing empty columns, monochrome themes, custom fonts, spacing) and high-resolution scaling for print export.
- **Changes**:
  - Created [PrismaConfigModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/PrismaConfigModal.tsx): Configurable React form containing toggles for collapsing the right column, changing the theme to monochrome, choosing fonts/base sizes, and choosing box padding, border radius, and export scale (up to 4x Print/300DPI).
  - Modified [PrismaFlowDiagram.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/PrismaFlowDiagram.tsx): Integrated the config modal, set up localStorage persistence, dynamically re-calculated x/y/width coordinates when column is collapsed, and used HTML5 backing store scaling (`exportScale`) for high-resolution PNG export.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Documented the new config modal component.
- **Verification**: Verified successfully with `npx tsc --noEmit`.

## #244 - PRISMA 2020 Flowchart Implementation (2026-07-20)
- **Goal**: Implement a publication-ready, downloadable, dynamic PRISMA 2020 flowchart inside the Scientific Rigor panel, auto-populated from active project database tables.
- **Changes**:
  - Created [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/insight/prisma/route.ts): API route that queries the project's papers to calculate 20 detailed study identification, screening, and exclusion parameters. Supports grouping database papers by their `Source`, filtering other methods by snowballing types, and breaking down exclusions by Stage 1 & 2 EC codes and Stage 3 QA gates.
  - Created [PrismaFlowDiagram.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/PrismaFlowDiagram.tsx): Canvas-based component that draws the complete standard two-column PRISMA diagram. Implemented toggles for "Academic Style" (clean white background) and "App Theme Style" (dark/light mode aware) along with full-resolution PNG downloading.
  - Modified [ScientificRigorPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/ScientificRigorPanel.tsx): Mounted the `PrismaFlowDiagram` component at the top of the scientific rigor panel.
  - Modified [files.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/files.md): Documented the new API endpoint and React components.
- **Verification**: Verified workspace compilation with `npx tsc --noEmit`.

## #243 - Removed Individual QA Criteria Points Filter from Final Cohort (2026-07-20)
- **Goal**: Remove individual QA criteria points filter control from the Final Cohort filtering options.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx): Removed the `selectedQaItemFilters` state, the corresponding selector column UI elements, filter count computation dependencies, and its evaluation loop.
- **Verification**: Verified compilation successfully with `npx tsc --noEmit`.

## #242 - Removed Internal Tabs Header from Pipeline Execution View (2026-07-20)
- **Goal**: Remove redundant internal tabs header from the Pipeline Execution View since the sub-items are now fully integrated and navigated directly via the left sidebar.
- **Changes**:
  - Modified [PipelineExecutionView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PipelineExecutionView.tsx): Deleted the redundant header tab bar elements.
- **Verification**: Verified compilation successfully with `npx tsc --noEmit`.

## #241 - Left Sidebar Expanded Submenus for Paper Database & Pipeline Execution (2026-07-20)
- **Goal**: Expand "Paper Database" and "Pipeline Execution" menus in the left sidebar to host nested child items for a more granular workflow experience.
- **Changes**:
  - Modified [Sidebar.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/Sidebar.tsx): Added nested children mapping to the `paper-database` parent item (Ingestion Hub, Raw Data) and the `full-execution` parent item (Data Acquisition, LLM Operations, Manual Screening, Remote Workers). Enabled `paper-database` and `full-execution` expanded states by default.
  - Modified [PipelineExecutionView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PipelineExecutionView.tsx): Exposed `activeSection` and `onSectionChange` props to coordinate internal tabs switching with sidebar sub-item highlights.
  - Modified [page.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx): Updated rendering selectors and callbacks; removed obsolete `showImport` state variable in favor of declarative `activeTab` states.
- **Verification**: Verified compilation successfully with `npx tsc --noEmit`.

## #240 - Fixed Pre-Calibration Statistics & Papers Data Loading Mismatch (2026-07-20)
- **Goal**: Fix bugs in Pre-Calibration view where the statistics tab shows no card (or placeholders) and the papers tab is stuck on "Loading calibration data...".
- **Changes**:
  - Modified [useCalibration.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useCalibration.ts): Replaced strict `activeTab === 'pre-calibration'` checks with `activeTab?.startsWith('pre-calibration')` so that calibration data and stage statistics are successfully fetched and synchronized when navigating to `pre-calibration-statistics` or `pre-calibration-papers`.
- **Verification**: Verified workspace compilation with `npx tsc --noEmit` which completed successfully with zero build errors.

## #239 - Final Cohort Interactive Column Width Resizing & LocalStorage Persistence (2026-07-20)
- **Goal**: Add drag-to-resize columns in the Final Cohort table and save widths to localStorage on a per-project basis.
- **Changes**:
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx):
    - Added mouse event handlers to dynamically scale columns within clamped limits (40px to 500px) when dragging headers.
    - Implemented persistence in localStorage scoped by `projectId` (`slr_cohort_column_widths_${projectId}`).
    - Replaced tailwind class-based column widths on `th` and `td` with dynamic inline styles.
    - Integrated thin resizer handle overlays at the right boundaries of table headers.
- **Verification**: Verified compilation with `npx tsc --noEmit` completing successfully with zero build errors.

## #238 - Final Cohort Bug Fixes & Wide Tabular View Enhancements (2026-07-20)
- **Goal**: Resolve issues with Final Cohort wide tabular view regarding column widths, tooltip behaviors, logic traces, and Umbrellanizer justification matching.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/insight/final-cohort/route.ts): Joined and merged the `logic_trace` from `llm_audit_log` into the returned `ai_quality_assessment` payload to show logic trace for QA checklist items.
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx):
    - Adjusted standard column widths to match Google Sheets default cell dimensions (e.g. w-[70px] for ID, w-[150px] for Title, w-[100px] for Authors, w-[60px] for Year, w-[80px] for DOI, w-[100px] for Publisher, w-[90px] for Overall QA, w-[120px] for dynamic QA keys, and w-[180px] for dynamic extracted keys) ensuring headers do not wrap or truncate.
    - Implemented a custom event listener (`close-all-tooltips`) inside the `ClickableCell` component to close any other open tooltips immediately when a new one is opened.
    - Updated `getUmbrellanizerJustification` helper to correctly unwrap values from object representations with a `value` property, enabling correct match of taxonomy justifications.
    - Added `getOriginalExtractedVal` helper and updated `ClickableCell` to display the original raw extracted value inside the value copy tooltip if it differs from the mapped category.
- **Verification**: Verified compilation with `npx tsc --noEmit` completing successfully with zero build errors.

## #237 - Final Cohort UI/UX Refactoring & Wide Tabular View (2026-07-20)
- **Goal**: Optimize viewport efficiency in the Final Cohort tab and transition the papers display to a wide, Google Sheets-style spreadsheet layout.
- **Changes**:
  - Modified [page.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx): Moved Final Cohort search and filter controls from the panel body to the main page header.
  - Modified [InsightExportView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/InsightExportView.tsx): Hooked up state props delegation from page header to cohort panel.
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/insight/final-cohort/route.ts): Selected the missing stage columns (`ai_stage`, `manual_stage`), `Publisher`, `Original_Publisher`, and `citation_count` from SQLite db.
  - Modified [FinalCohortPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/insight-export/FinalCohortPanel.tsx):
    - Removed inline filter bar, implemented wide spreadsheet table layout with highly compact column widths (80px for ID, 180px for Title, 60px for QA, etc.) to match Google Sheets.
    - Fixed `Overall_QA` scores by introducing Stage Dominance float-parsing rules that handle stringified fractions (e.g. `"1.0"`, `"0.5"`) correctly.
    - Integrated a custom `ClickableCell` component on all data fields, truncating cell contents into one line by default, keeping row heights condensed. Removed cell expand-on-click behaviour.
    - Added an automatic document `mousedown` listener to close the active copy popover immediately if a user clicks outside the cell area or selects another popup.
    - Corrected the QA logic trace lookup to map the correct `appraisal_reasoning` sub-keys (`k + "_analysis"`) nested inside quality appraisals.
    - Corrected the taxonomy justification resolver to extract the raw extracted variables from the database JSON string before checking the mapping tables.
    - Added sorting indicators next to every column title. Implemented a `useMemo` client-side sorting function to order papers dynamically by clicking the headers.
- **Verification**: Verified compilation with `npx tsc --noEmit` completing successfully with zero build errors.

## #236 - Removed Duplicated Umbrellanizer Audit Logging (2026-07-20)
- **Goal**: Prevent duplicate and unnecessary insertion of Umbrellanizer run data into `llm_audit_log` (since Umbrellanizer already records mappings directly inside `umbrellanizer_results`).
- **Changes**:
  - Modified [umbrellanizer.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/umbrellanizer.py): Removed the `log_interaction` call which wrote Umbrellanizer inputs, outputs, and `UmbrellanizerSchema` into `llm_audit_log`. Removed the unused `log_interaction` import.
- **Verification**: Confirmed script syntax cleanliness and verified workspace builds successfully.

## #235 - Post-Validation Rolling Batch Engine Integration (2026-07-19)
- **Goal**: Implement the Post-Validation Rolling Batch validation workflow to enforce sliding quality control audits on Scientist and Miner stages.
- **Changes**:
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts): Registered rolling batch schema tables (`rolling_batches`, `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`) and ran fallback migrations adding `rolling_batch_size` column to `projects`.
  - Created API Endpoints:
    - [initialize/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/initialize/route.ts): Handles rolling validation queueing and paper snapshots.
    - [status/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/status/route.ts): Returns status logs and timeline metrics.
    - [export/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/export/route.ts): Generates blinded template exports.
    - [import/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/import/route.ts): Consumes completed reviewer feedback and calculates consensus agreements.
    - [adjudicate/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/adjudicate/route.ts): Performs consensus updates on discrepancy rows.
    - [decisions/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/decisions/route.ts): Exposes reviewer splits and ledger audits.
    - [stats/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/rolling-batch/stats/route.ts): Computes Kappa, CI lower bounds, Critical Misses, and Semantic Agreement metrics.
  - Created React Hooks & Views:
    - [useRollingBatch.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useRollingBatch.ts): Custom React state controller hook.
    - [RollingBatchView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchView.tsx): Orchestrates layouts, slot drops, and discrepancy lists. Modified onSuccess callback of the Adjudication modal to persist modal view state rather than auto-closing, and added a useEffect to rehydrate the active `selectedDiscrepancy` from reloaded batch records.
    - [BatchStatisticsCards.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/BatchStatisticsCards.tsx): Visualizes sequential audit stopping rules and target thresholds.
    - [RollingBatchAdjudicationModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/RollingBatchAdjudicationModal.tsx): Split-pane modal for conflict resolution. Added `localDiscrepancies` snapshot state to preserve pagination indices when resolved papers are dynamically filtered out of the active parent list.
    - [BatchImportSlot.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/BatchImportSlot.tsx): Import card widget.
  - Modified [PostValidationView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PostValidationView.tsx): Rendered `RollingBatchView` inside the sub-tab panel.
  - Modified [CreateProjectModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/CreateProjectModal.tsx), [ProjectSettingsModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ProjectSettingsModal.tsx), and [ProjectCalibrationSettings.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/settings/ProjectCalibrationSettings.tsx): Integrated the customizable `rolling_batch_size` target settings.
- **Verification**: Verified compilation with `npx tsc --noEmit` and logged updates.

## #234 - Post-Validation Umbrellanizer Engine Integration (2026-07-19)
- **Goal**: Implement token taxonomy normalization workflow to group raw extracted tokens under Miner stage into unified category labels.
- **Changes**:
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts): Registered the new `umbrellanizer_results` table storing mappings.
  - Created [umbrellanizer.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/umbrellanizer.py): Python orchestrator feeding Jinja2 templates and invoking Gemini.
  - Created API Endpoints:
    - [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/umbrellanizer/route.ts): Handles retrieval and starts taxonomy mapping spawns.
    - [papers/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/umbrellanizer/papers/route.ts): Exposes miner-passed papers with stage-aware resolved data.
  - Modified [ProjectSettingsModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/ProjectSettingsModal.tsx): Configured `umbrellanizer` prompt stage options.
  - Modified [Sidebar.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/Sidebar.tsx): Activated the Post-Validation tab menu.
  - Modified [page.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/page.tsx): Routed `post-validation` content switches.
  - Created [PostValidationView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PostValidationView.tsx): Switcher hosting Umbrellanizer and Rolling Batch engines.
  - Created Components:
    - [UmbrellanizerView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/UmbrellanizerView.tsx): Main token table viewer with tooltip extraction details.
    - [UmbrellanizerWizard.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/UmbrellanizerWizard.tsx): Multi-step setup and background worker spawner.
    - [TokenOccurrenceTable.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/post-validation/TokenOccurrenceTable.tsx): Visualizes unique token counts.
  - Created [useUmbrellanizer.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useUmbrellanizer.ts): React state hook handling polling and workflows.
- **Verification**: Verified compilation with `npx tsc --noEmit` completing successfully.

## #233 - Generalized Calibration Tooltips & Directives Revisions (2026-07-19)
- **Goal**: Rephrase all hover tooltips to use general systematic literature review contexts, avoiding domain-specific terms (such as 'cyber-physical', 'IoT ghost edge', etc.), and register screening calibration validation targets in agents.md.
- **Changes**:
  - Modified [StageComparisonPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/StageComparisonPanel.tsx):
    - Removed 'cyber-physical', 'IoT ghost edge', and system architecture references from the scientific descriptions of Recall, F1, Precision, Kappa, and yields.
  - Modified [agents.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/agents.md):
    - Added Section 3.7 defining the pass thresholds for all 4 calibration stages.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully.

## #232 - Added Interactive Metric Hover Tooltips (2026-07-19)
- **Goal**: Implement interactive hover tooltips for all evaluation metrics across the four screening stage comparison cards in the Pre-Calibration dashboard.
- **Changes**:
  - Modified [StageComparisonPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/StageComparisonPanel.tsx):
    - Added pure-CSS tooltips using Tailwind's `group-hover/tooltip:block` hidden absolute overlays.
    - Wrapped all metric rows across all four stage cards.
    - Injected specified statistical definitions and scientific meanings for Recall & F1 (Stage 1), Precision & Recall (Stage 2), Weighted Kappa, Raw Agreement, Minor Deviation, and Critical Miss (Stage 3), and Schema Integrity and Pre-Normalization Yield (Stage 4).
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #231 - Added Recall to Stage 2 Gatekeeper Calibration (2026-07-19)
- **Goal**: Add Recall (Sensitivity) tracking to the Stage 2 (Gatekeeper) pre-calibration stats card to prevent false negative exclusion vulnerabilities, and update the pass threshold to assert both Precision and Recall targets.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts):
    - Added `recall_target` threshold constraint to Stage 2 (`0.90`).
    - Updated `passes` boolean check to require `precision >= 0.85` AND `recall >= 0.90`.
    - Added type assertions to cast `poolBStats` to include the calculated `recall` metric.
  - Modified [StageComparisonPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/StageComparisonPanel.tsx):
    - Rendered the Recall percentage indicator directly below Precision under the Gatekeeper card.
    - Updated target subtext: `Target: Precision >= 85%, Recall >= 90%`.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #230 - Stage 3 Ordinal Deviations & Stage 4 Schema Yields (2026-07-19)
- **Goal**: Implement scientific deviation tiers for Stage 3 ordinal rubrics and schema conformance yield indicators for Stage 4 extraction. Bypassed artificial fail constraints on raw string yields.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts):
    - Stage 3 (Scientist): Tracked Raw Agreement, Minor Deviation Rate (difference = 0.5), and Critical Miss Rate (difference = 1.0). Flagged stage as PASS if Critical Miss Rate is exactly 0.0%.
    - Stage 4 (Miner): Tracked Schema Integrity Rate (100% when missing keys count = 0 and type matches count = 100%) and Pre-Normalization Yield (renamed exact string match metric). Flagged stage as PASS if Schema Integrity is 100% (bypassing pre-normalization yield thresholds).
  - Modified [StageComparisonPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/StageComparisonPanel.tsx):
    - Rendered Raw Agreement, Minor Deviation, and Critical Miss percentages under the Scientist card.
    - Rendered Schema Integrity Rate and Pre-Normalization Yield under the Miner card.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully.

## #229 - Refined Stage 3 and Stage 4 Calibration Statistics (2026-07-19)
- **Goal**: Align the Pre-Calibration stage comparison panel's data sources and calculation logic for Scientist and Miner stages. Rename Pool D card to Pool C (Miner), yielding two Pool C cards (Scientist and Miner), and implement respective calculation algorithms.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts):
    - Scientist (Stage 3): Calculated the Weighted Cohen's Kappa over the 8 QA scores (QA1-QA8) by comparing `resolved_qa_scores` in `calibration_commit_ledger` with `structured_output.qa_scores` in `llm_audit_log` (task_type = `'scientist'`).
    - Miner (Stage 4): Computed **Schema Match Rate** (Missing keys % and Type match %) and **Exact Value Match Rate** (comparing literal string values of the extracted schema keys) by comparing `resolved_extracted_data` in the commit ledger with `structured_output.extracted_data` in the audit log (task_type = `'miner'`).
    - Fixed typing assertions to resolve TypeScript strict null check compile errors.
  - Modified [StageComparisonPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/StageComparisonPanel.tsx):
    - Renamed Pool D card to Pool C (Miner).
    - Rendered custom metrics: Weighted Kappa & Agreement Rate for Scientist (Stage 3), and Missing Keys %, Type Match %, & Exact Match % for Miner (Stage 4).
    - Prevented TP/TN classification confusion matrix rendering for Stage 3 (Scientist) and Stage 4 (Miner).
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #228 - Pre-Calibration Tab Split and Stage Comparison Cards (2026-07-18)
- **Goal**: Split the Pre-Calibration workflow view into two separate tabs ("Statistics" and "Papers"). Relocate the three pool filling status cards into the Statistics tab, delete the obsolete Consensus Scorecard card, and implement four new cards comparing the gold standard (commit ledger) vs AI results (from LLM audit logs) for each screening stage.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/stats/route.ts):
    - Added `mode=stage_comparison` handler to pull adjudicated gold standard decisions from `calibration_commit_ledger` and cross-reference them against stage-specific LLM decisions from `llm_audit_log` per pool.
  - Modified [useCalibration.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useCalibration.ts):
    - Added `stageStats` and `stageStatsLoading` states with `loadStageStats` fetch utility.
    - Wired statistics rehydration hooks with multi-tab synchronizations.
  - Modified [PoolMetricsPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/PoolMetricsPanel.tsx):
    - Removed the obsolete Consensus Scorecard card.
    - Adjusted metrics list columns layout to 3 columns.
  - Created [StageComparisonPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/pre-calibration/StageComparisonPanel.tsx):
    - Designed 4 responsive stage cards mapping Pool A (Fast Filter), Pool B (Gatekeeper), Pool C (Scientist), and Pool D (Miner) metrics against methodology optimization exit thresholds.
  - Modified [PreCalibrationView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PreCalibrationView.tsx):
    - Introduced tab selector buttons.
    - Rendered the Statistics panel (Pool fill meters and Stage comparisons) or Papers panel (filters and datatable) dynamically.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #227 - Fixed Pipeline Stage Filtering and SQLite MAX NULL Bug (2026-07-18)
- **Goal**: Resolve the bug where filtering by "Pipeline Stage" was ineffective when no status was selected, and fix SQL comparisons involving `MAX(manual_stage, ai_stage)` which propagated `NULL` when either stage was empty.
- **Changes**:
  - Modified [papers/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts):
    - Wrapped all occurrences of `MAX(manual_stage, ai_stage)` in query filters and columns selection with `IFNULL` (`MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0))`) to ensure valid scalar integer comparisons.
    - Appended a fallback filter rule that scopes the dataset by stage when `pipelineStage` is active but `pipelineStatus` is left empty.
  - Modified [manual-screening/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/manual-screening/route.ts):
    - Wrapped the `Status` column selector in the paginated SELECT query to use `IFNULL`.
  - Modified [llm/count/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/llm/count/route.ts):
    - Wrapped matching filters in the count query to use `IFNULL`.
  - Modified [projects/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/projects/route.ts):
    - Wrapped the screened count SUM aggregator with `IFNULL` to prevent active project dashboard stat leaks.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #226 - Split Screening Decisions & Exclusion Codes (2026-07-18)
- **Goal**: Split combined decision + exclusion code values (e.g. `EXCLUDE (EC-1)`) into clean decisions (`INCLUDE`/`EXCLUDE`) and dedicated `ai_exclusion_code` / `manual_exclusion_code` columns to resolve data model conflation, healing the database, APIs, python queue executors, and the UI.
- **Changes**:
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts):
    - Added `ai_exclusion_code` and `manual_exclusion_code` TEXT columns to `papers` and `calibration_papers` schemas.
    - Wrote SQL migration scripts running at startup to parse combined decisions, populating the new columns and resetting `ai_decision`/`manual_decision` to clean string values (`INCLUDE` / `EXCLUDE`).
    - Fixed database self-healing loops to query and write the new split column structures.
  - Modified [index.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/types/index.ts):
    - Declared optional `ai_exclusion_code` and `manual_exclusion_code` properties on the `Paper` interface.
  - Modified API Endpoints:
    - [papers/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts): Replaced parsing-based EC code queries with direct select reads on the new columns; added columns to sorting whitelist.
    - [papers/[id]/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/%5Bid%5D/route.ts): Added `manual_exclusion_code` to PUT updates, and updated audit log logging parameters.
    - [papers/manual-screening/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/manual-screening/route.ts): Whitelisted new columns, updated filtering logic to use split properties.
    - [papers/purge-check/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/purge-check/route.ts): Selected and returned new exclusion columns, updated active check rules.
    - [calibration/assign/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/calibration/assign/route.ts): Included the new columns in the copy statements mapping papers to calibration sandboxes.
    - [adjudicate/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/adjudicate/route.ts): Updated manual exclusion updates and audit ledger states.
    - [import/inter-rater/route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts): Selected and mapped the new columns during blinded reviews imports.
  - Modified [queue_handler.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/queue_handler.py):
    - Aligned the LLM execution pipeline to write clean decision strings and assign `ai_exclusion_code` values directly to the database.
  - Modified UI Components & Custom Hooks:
    - [useManualScreening.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useManualScreening.ts): Refactored save, clear, and setup operations to pass and read separate exclusion values.
    - [ManualScreeningList.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningList.tsx): Altered lists badges presentation to print exclusion codes alongside decisions.
    - [ScreeningSummaryPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/paper-details/ScreeningSummaryPanel.tsx) & [PaperMetadataView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/paper-details/PaperMetadataView.tsx): Supported rendering the new separate columns directly in screening summary panes.
    - [PaperMetadataEdit.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/paper-details/PaperMetadataEdit.tsx): Modified boxes to display the split values instead of parsing them from decision strings.
    - [AssignDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/fullscreen-assign/AssignDetailView.tsx): Cleaned up resolution check logic.
    - [PreCalibrationView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PreCalibrationView.tsx): Appended split column displays.
    - [InterRaterDashboard.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/InterRaterDashboard.tsx): Re-mapped formatPrevState.
    - [useCalibration.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useCalibration.ts): Mapped filters logic to query new exclusion columns.
  - Updated documentation in [schema.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/db/schema.md).
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #225 - Cleaned up Legacy Human_* Columns & Consolidated Calibration to manual_* (2026-07-18)
- **Goal**: Perform full-stack cleanup of the legacy, redundant `Human_*` columns on the `papers` table, and unify calibration reviews to use the `manual_*` columns on the `calibration_papers` table.
- **Changes**:
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts):
    - Removed the 5 fallback `ALTER TABLE papers ADD COLUMN Human_*` migration blocks.
    - Added corrective migration (`MIGRATION_REMOVE_HUMAN_COLS_FROM_PAPERS_DONE`) that copies any historical `Human_*` data from the `papers` table into the `manual_*` columns of `calibration_papers` before safely dropping them from `papers`.
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/import/inter-rater/route.ts):
    - Rerouted `selectPaperStmt` to pull `manual_*` instead of `Human_*` from `calibration_papers`.
    - Rewrote the auto-adjudication comparison variable initialization to use `manual_*` (with dynamic regex parsing of nested EC codes).
    - Fixed the pool reset handler inside `DELETE` to nullify `manual_*` columns on `calibration_papers`.
  - Modified [useCalibration.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useCalibration.ts):
    - Mapped agreement metrics calculation from `p.Human_Decision` to `p.manual_decision`.
  - Modified [PreCalibrationView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/PreCalibrationView.tsx):
    - Rerouted table cell template variables and sorting headers to use `manual_decision` and `manual_rationale`.
  - Modified [InterRaterDashboard.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/InterRaterDashboard.tsx):
    - Added backward-compatibility fallback inside `formatPrevState` parser to read both old `Human_Decision` and new `manual_decision` from the audit ledger JSON strings.
  - Modified [useManualScreening.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useManualScreening.ts):
    - Completely deleted the `importFromCalibration` helper hook callback and its hook outputs.
  - Modified [ManualScreeningDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningDetailView.tsx):
    - Removed the "Import from Calibration" header control button and its associated props.
  - Modified [ManualScreeningView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningView.tsx):
    - Removed the `onImport` prop bind and reference destructuring.
  - Modified [inspect_db.js](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/scratch/inspect_db.js):
    - Deleted the deprecated `p.Human_EC_Trigger` reference.
  - Updated documentation in [AGENTS.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/AGENTS.md), [agents.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/agents.md) and [schema.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/db/schema.md).
  - Modified [queue_handler.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/queue_handler.py):
    - Fixed `decision_text` assignment to default to `INCLUDE` instead of `EXCLUDE` for `miner` or `extraction` tasks since mining is a final inclusion data extraction stage.
  - Modified [ManualScreeningDetailView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/manual-screening/ManualScreeningDetailView.tsx):
    - Added an auto-calculator fallback for the `miner` stage to automatically preset the human decision override selection state to `INCLUDE`.
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/%5Bid%5D/route.ts):
    - Added a default-fallback guard forcing `manualDecisionVal` to `INCLUDE` when `manualStageVal` is set to `4` (Miner) and no explicit decision or override was passed.
- **Verification**: Ran `npx tsc --noEmit` which completed successfully with zero compilation errors.

## #224 - Reverted to Simpler Stage Convention (No +1 for INCLUDE) (2026-07-18)
- **Goal**: Align the stage display, self-healing logic, and documentation to the actual runtime behaviour of both the LLM Operations Pipeline and Manual Screening Pipeline — which both write the literal completed stage number N regardless of decision (never N+1 for INCLUDE).
- **Changes**:
  - Modified [ScreeningSummaryPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/paper-details/ScreeningSummaryPanel.tsx):
    - Removed the `isIncluded` variable and the `Math.max(0, stage - 1)` subtraction for INCLUDE decisions.
    - `displayStage` is now simply `stage || 0`, and `badgeText` maps directly to "Stage N: Name" or "Initial / Unscreened".
  - Modified [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts):
    - Added a one-shot **corrective migration** (`MIGRATION_AI_STAGE_INCLUDE_REVERT_DONE`) that runs on startup, re-derives the correct stage from `llm_audit_log` for all papers, and reverts any `ai_stage` values that were incorrectly set to `N+1` by the prior wrong migration.
    - Updated the **ongoing self-healing** routine to use `resolvedStage = highestLogStage` (no +1) for all decisions.
  - Modified [agents.md](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/agents.md):
    - Added a **Stage Value Convention** table to §3.6 documenting that `ai_stage` and `manual_stage` always store the literal completed stage N, with a reference table showing INCLUDE and EXCLUDE both mapping to the same stage value.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #223 - Automated Database Self-Healing for AI Stages (2026-07-17)
- **Goal**: Auto-repair database discrepancies where a paper's `ai_stage` (e.g. `1`) is out of sync with its actual screening history and decision (e.g. successful `gatekeeper` / Stage 2 log with an `EXCLUDE (EC-4)` decision).
- **Changes**:
  - Appended a new self-healing routine in [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts) that executes on application launch:
    - Queries all unique papers featuring successful `llm_audit_log` entries.
    - Resolves the true highest completed stage based on the logged task types.
    - Extracts the final decision from the parsed JSON structured output for that highest stage.
    - Sets the corrected `ai_stage` cursor (equal to the highest stage if excluded, or highest stage + 1 if included) and heals the record inside the `papers` table.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #222 - Dynamically Resolved Completed Stage Display in Screening Summary (2026-07-17)
- **Goal**: Fix the visual discrepancy in AI/Manual Screening details panels where a paper that passed a stage (e.g. Stage 1) and advanced to a pending stage (e.g. Stage 2) was displayed as having completed the pending stage with the previous stage's decision.
- **Changes**:
  - Modified [ScreeningSummaryPanel.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/paper-details/ScreeningSummaryPanel.tsx) to resolve `displayStage` dynamically based on the screening decision:
    - If decision is `INCLUDE` (indicating the stage has been completed and the paper is advanced to `stage + 1`), the completed stage is set to `stage - 1`.
    - If decision is `EXCLUDE`, the completed stage is set to the current `stage`.
    - Rendered a dynamic `Pending: <Stage Name>` badge if the completed stage is `0` or the stage is active but has not yet received a decision.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #221 - Enforced Active Stage Constraints on Pipeline Filters (2026-07-17)
- **Goal**: Reconcile stage-aware filter query leakage where papers with historical audit log entries at higher stages (e.g. Stage 2) matched stage filters even after being demoted to lower stages (e.g. Stage 1).
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/route.ts) to append active stage validation checks (`MAX(manual_stage, ai_stage)`) to all included, excluded, and ecTrigger filtering SQL rules:
    - Enforced `MAX(manual_stage, ai_stage) >= pipelineStage` for `'included'` statuses.
    - Enforced `MAX(manual_stage, ai_stage) = pipelineStage` for `'excluded'` statuses.
    - Enforced `MAX(manual_stage, ai_stage) = pipelineStage` for `ecTrigger` search filters.
  - Aligned semantic search in-memory queries in [useCalibration.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useCalibration.ts) to evaluate the same active stage constraints.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #220 - Fixed Calibration Pool Quick Actions Assignment State (2026-07-17)
- **Goal**: Fix the broken Quick Actions (Pool A, Pool B, Pool C, Unassign) button state and dropdown toggle in the Assign Papers details workspace.
- **Root Cause**: 
  1. The single-paper details GET API (`api/papers/[id]`) did not select `calibration_pool` or `calibration_tag` from `calibration_papers` table, causing rehydration fetches (e.g. after sync events or paper edits) to overwrite active calibration fields with `null`/`undefined`.
  2. The `activeAssignDropdown` hook state was typed as `string | null` but utilized as `{ paperId: string, poolId: string } | null` inside `AssignDetailView.tsx`.
- **Changes**:
  - Modified [route.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/papers/%5Bid%5D/route.ts) to select `calibration_pool` and `calibration_tag` via subqueries on `calibration_papers` for the requested paper.
  - Corrected `activeAssignDropdown` type signature in [useCalibration.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/hooks/useCalibration.ts) to match the object definition.
- **Verification**: Verified compilation with `npx tsc --noEmit` which completed successfully with zero errors.

## #219 - Refactored Calibration Pool Assignment Filters (2026-07-17)
- **Goal**: Clean up the UI clutter in the Assign Papers to Calibration Pools modal and improve the filtering system to support standard database advanced and pipeline filters.
- **Changes**:
  - Expanded `useCalibration.ts` to manage all advanced and pipeline filters (`assignPdfFilter`, `assignSourceFilter`, `assignDoiStatusFilter`, `assignPdfLinkFilter`, `assignPipelineStageFilter`, `assignPipelineStatusFilter`, `assignEcTriggerFilter`, and dynamic `ecTriggers`).
  - Implemented in-memory semantic search filters for all the new filter fields.
  - Replaced inline dropdown filters in `PaperSelectionList.tsx` with two clean pop-up menus: **Screening Pipeline** and **Filters** (Advanced Filters, including Calibration Pool and Publisher filters), including a click-outside click listener.
  - Propagated all new filter properties through `FullscreenAssignModal.tsx` props.
- **Verification**: Verified TypeScript compiler and Next.js status with `npx tsc --noEmit` which compiled successfully with zero errors.

## #218 - Gemini API Key Save Validation & Sync (2026-07-17)
- **Goal**: Sanitize Gemini API keys during save operations by trimming whitespace, tabs, and newlines, and implement cross-tab synchronization for credential changes.
- **Changes**:
  - Added `'SYNC_VAULT_KEYS'` type to `SyncType` union in [sync-utils.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/sync-utils.ts).
  - Sanitized API key inputs by trimming leading and trailing whitespaces and newlines in [route.ts (keys)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/vault/keys/route.ts), [GlobalLLMSettingsView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/GlobalLLMSettingsView.tsx), and [VaultKeyEditorModal.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/modals/VaultKeyEditorModal.tsx).
  - Integrated `broadcastSync('SYNC_VAULT_KEYS')` triggers inside the API key save handlers.
  - Subscribed to `'SYNC_VAULT_KEYS'` synchronization channel events to dynamically reload vault state across all active browser instances.
- **Verification**: Verified TypeScript compiler and Next.js status with `npx tsc --noEmit`.

## #217 - Fix LLM Pipeline Active Stage Reset and Update Miner Panel Stats (2026-07-17)
- **Goal**: Resolve issue where page refresh resets the active LLM pipeline operations stage to Fast Filter (due to missing `task_type` in `llm_jobs` table) and update the Miner execution stats to display processed/unprocessed and missing variables instead of exclusion/inclusion ratios.
- **Changes**:
  - Added `task_type` column to `llm_jobs` table definition and database migration fallback in [db-init.ts](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/lib/db/db-init.ts).
  - Modified [route.ts (screen)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/llm/screen/route.ts) to insert `taskType` when creating new jobs.
  - Modified [main.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/main.py) to save `task_type` to database on job initiation, completion, or failure.
  - Updated [route.ts (active)](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/app/api/llm/jobs/active/route.ts) to query `task_type` and aggregate `not_stated_metrics` for miner jobs from successful audit logs.
  - Modified [queue_handler.py](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/python_engine/llm/queue_handler.py) to parse structured output, compile `not_stated_metrics` for miner jobs, and broadcast them via real-time telemetry.
  - Updated [GlobalLLMSettingsView.tsx](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-ide/src/components/features/GlobalLLMSettingsView.tsx) to store `not_stated_metrics` in state and render them in a dedicated panel when the active task is Miner.
- **Verification**: Verified Next.js and TypeScript compilation with `npx tsc --noEmit`.

## #216 - Miner 404 Bug Trace: Stale Interaction ID from Chaining Config (2026-07-17)
- **Goal**: Diagnose and resolve the `404 - Requested entity was not found` error that occurred on the first miner run in the LLM screening pipeline.
- **Root Cause**: The miner prompt template (`2c9095ba-74ff-4438-8460-188682db98ea`) had `interaction_chaining: true` enabled in its `llm_config`. The `LLMQueueHandler.process_paper_worker` (in `python_engine/llm/queue_handler.py`) queries `llm_audit_log` for a prior `interaction_id` matching the paper, project, and schema name. A stale `interaction_id` from a prior test/failed session was found and passed as `previous_interaction_id` to `client.interactions.create()`. Gemini's Interactions API returned `404` because that interaction no longer existed on the server (it had expired or been cleaned up).
- **Key Distinction**: The `gatekeeper` and `scientist` stages work without this error because their templates have `interaction_chaining: false`, so `previous_interaction_id` is always `None`. The miner's config accidentally had it enabled.
- **Trace Path**: `queue_handler.py:process_paper_worker` → `extraction.py:extract_structured_data` → `client.py:create_interaction` → `_call_interactions` → `client.interactions.create(previous_interaction_id=<stale_id>)` → **404**.
- **Fix Applied**: User disabled `interaction_chaining` in the miner prompt template's `llm_config` via the UI. No code changes were required.
- **Takeaway for future**: The miner is a terminal, standalone data extraction stage. Interaction chaining (multi-turn context threading) has no semantic benefit for the miner and risks stale-ID 404s. If chaining is re-enabled on a miner template, ensure no stale audit log entries exist for the target papers in the same schema context.

## #215 - Stage-Aware Decision Source of Truth (2026-07-17)
- **Goal**: Fix severe bug where `COALESCE(manual_decision, ai_decision)` was used as the effective decision without considering stage precedence. A Stage-1 manual INCLUDE was incorrectly overriding a Stage-2 AI EXCLUDE, causing wrong papers to enter subsequent LLM pipelines and inflating target paper counts.
- **Root Cause**: The rule is: the decision from the **higher stage** wins. When both manual and AI stages are equal, manual overrides AI. `COALESCE` alone cannot encode this rule.
- **Changes**:
  - Replaced all 3 occurrences of `COALESCE(manual_decision, ai_decision)` in the LLM screening pipeline with the stage-aware CASE expression:
    ```sql
    CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision
         WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision
         ELSE COALESCE(manual_decision, ai_decision)
    END
    ```
  - Fixed `src/app/api/llm/count/route.ts` (L38): LLM batch target count now correctly excludes papers where a higher-stage AI EXCLUDE supersedes a lower-stage manual INCLUDE.
  - Fixed `python_engine/llm/main.py` (L162 & L193): Both the `paper_ids` and standard batch selection paths now apply stage-aware decision resolution.
  - Fixed `src/app/api/pdf/batch/route.ts` (L39): The IGNORED→MISSING auto-promotion now uses stage-aware decision logic. Also corrected a secondary bug: the match was `= 'INCLUDE'` (exact, case-insensitive) which silently skipped papers with decision variants like `'INCLUDE (S1)'`; now uses `LIKE 'INCLUDE%'` for correct broadness.
- **Verification**: `npx tsc --noEmit` passes with zero errors.

## #214 - API Task Type Standardization (2026-07-17)

- **Goal**: Standardize all API route endpoints to map alias task types to canonical names at the request boundary.
- **Changes**:
  - Re-mapped and standardized `taskType` to standard canonical values (`'fast_filter'`, `'gatekeeper'`, `'scientist'`, `'miner'`) at the entry boundaries of `/api/llm/screen` and `/api/llm/count` API request handlers, guaranteeing that the python process is spawned and count queries run with standardized values.

## #213 - Normalization of excludeManual Stage Names (2026-07-17)
- **Goal**: Ensure the "Exclude papers manually screened in this stage" parameter correctly matches the stage text entries in `manual_audit_log` for all LLM task types.
- **Changes**:
  - Normalized task type keys (e.g. `'screening'`, `'fulltext'`, `'extraction'`) to their corresponding database audit log stage names (`'fast_filter'`, `'gatekeeper'`, `'miner'`) in `src/app/api/llm/count/route.ts` and `python_engine/llm/main.py`.

## #212 - Active Stage Query & Decision Filter Alignment (2026-07-17)
- **Goal**: Reconcile eligible paper count discrepancies in the LLM run pipeline and database view filters.
- **Changes**:
  - Replaced legacy stage calculation queries using `COALESCE(NULLIF(manual_stage, 0), ai_stage)` with `MAX(manual_stage, ai_stage)` across all TypeScript routes (`projects/route.ts`, `papers/route.ts`, `manual-screening/route.ts`, `llm/count/route.ts`) and Python orchestration (`llm/main.py`).
  - Updated LLM count and run decision filters in `api/llm/count/route.ts` and `llm/main.py` to target the active decision via `COALESCE(manual_decision, ai_decision)` instead of `ai_decision` only, ensuring that manual overrides are fully respected.

## #211 - Paper Database Table & Screening Pipeline Filters (2026-07-17)
- **Goal**: Resolve defunct/uncleaned schema v2 queries, fix bulk action selection mismatches, and reconcile PDF counts between the database view and LLM pipelines.
- **Changes**:
  - Rebuilt the `getEcTriggers` API query to dynamically extract exclusion codes from `ai_decision` and `manual_decision` instead of deleted legacy tables.
  - Linked `pipelineStageFilter` to the client-side EC fetch logic to re-trigger dynamically on stage changes and reset active values.
  - Added a new `ready_for_ai` status option ('Unprocessed (Ready for AI — SYNCED PDF)') filter representing strictly `SYNCED` local PDFs, resolving the 6-paper database vs. pipeline count discrepancy.
  - Updated `handleToggleSelectAll` to append all active pipeline filters to the request query parameters, ensuring selected IDs match the filtered corpus view during batch LLM run transitions.

## #210 - LLM Pipeline Audit & Operations UI Improvement (2026-07-17)
- **Goal**: Audit the LLM screening and extraction pipeline for schema compatibility, and improve target paper validation in the Operations tab.
- **Changes**:
  - Audited `llm/main.py`, `llm/queue_handler.py`, `llm/templating.py`, and typescript endpoints `/api/llm/screen` and `/api/llm/count`. Confirmed zero legacy `Status` references and correct typed matching.
  - Redesigned `GlobalLLMSettingsView.tsx` Operations tab: embedded the live target paper count pill directly inside the Launch button.
  - Added a zero-count safety guard: disabled the Launch button when `targetCount === 0` and displayed an amber warning banner.

## #209 - Schema V2 Giga Refactor (2026-07-16)
- **Goal**: Clean up dead code, add new UI components, create a dedicated calibration route, and type-harden components following the schema v2 refactor.
- **Changes**:
  - Removed 7 dead `useState` state hooks and simplified the `hasChanges` and `lastLoadedPaperRef` rehydration check logic in `ViewEditPaperModal.tsx`.
  - Cleaned up the prop interfaces of `PaperMetadataEdit.tsx` and `PaperMetadataView.tsx` by removing all `editStatus`, `editHuman*`, and calibration-pool assignment fields.
  - Implemented the reusable `ScreeningSummaryPanel.tsx` component to render AI/Manual screening stage badges, parsed exclusion criteria triggers, rationales, and collapsible JSON viewers.
  - Refactored `papers/[id]/route.ts` PUT handler to only update core metadata fields, removing all manual overrides, audit log insertions, and database cloning actions.
  - Created a dedicated `/api/calibration/assign` POST API route to manage calibration pool assignments.
  - Updated pool assignment hooks (`useCalibration.ts`) and modal views (`AssignDetailView.tsx`) to utilize the new endpoint, correcting dynamic decision lookups and type definitions.
  - Hardened props interfaces to replace all generic `any` types with explicit `Paper` and `Project` types.

## #208 - Deletion of Redundant Status Column (2026-07-16)
- **Goal**: Drop the legacy `Status` column from the `papers` and `calibration_papers` tables, replacing all references with dynamic stage queries.
- **Changes**:
  - Executed migration script `scratch/migrate-status.js` backing up the database, dropping `Status` from `papers` and `calibration_papers`, and rebuilding indexes.
  - Removed `Status` from the `Paper` TypeScript interface and database schemas in `db-init.ts`.
  - Refactored `api/papers/[id]`, `api/papers`, `api/papers/manual-screening`, and `api/papers/purge-check` to use integer stages (`manual_stage` / `ai_stage`) and query active stages dynamically via `COALESCE(NULLIF(manual_stage, 0), ai_stage)`.
  - Updated the CSV exporter (`api/export`) to output dynamic active stages under a `'Stage'` column.
  - Refactored inter-rater, adjudication, and python scripts (`match_cache.py`, `llm/main.py`, `queue_handler.py`) to map stages as integers and clean up all `Status` updates.

## #207 - Database Schema Simplification and V2 Migration (2026-07-16)
- **Goal**: Drop legacy/calibration columns from the main `papers` table, simplify the schema, and migrate data dynamically.
- **Changes**:
  - Wrote and executed migration scripts `scratch/migrate-v2.js` and `scratch/migrate-cal.js` to back up `slr.db`, drop 12 columns, add 10 new `ai_*` and `manual_*` columns, and re-create indexes.
  - Parsed, rehydrated, and mapped numerical stages (0-4) in API routes (`papers/[id]` and `papers`) and custom React hooks (`useManualScreening`, `useCalibration`).
  - Embedded exclusion codes inside the `manual_decision` and `ai_decision` columns (e.g. `EXCLUDE (EC-5)`), updating log-filters, details dialogs, and validation logic.
  - Removed obsolete Calibration Pool and Tag fields from `PaperMetadataEdit`, `PaperMetadataView`, and `ViewEditPaperModal` component prop chains.

## #206 - Dedicated Screening Pipeline and Exclusion Code Filters (2026-07-16)
- **Goal**: Introduce dedicated screening pipeline filters and a dynamically loaded exclusion code selector in the Paper Database view.
- **Changes**:
  - Parsed `pipelineStage`, `pipelineStatus`, and `ecTrigger` parameters in `api/papers/route.ts` and constructed matching SQL filters.
  - Declared `pipelineStageFilter`, `pipelineStatusFilter`, and `ecTriggerFilter` states in `usePapers.ts` hook.
  - Linked new filter hooks into `PaperDatabaseView` props in `page.tsx`.
  - Added "Screening Pipeline" filter button and dropdown popover in `PaperDatabaseView.tsx` with dynamic loading of exclusion codes from the database.

## #205 - Mandatory Decision Panel Fields and Save Control (2026-07-16)
- **Goal**: Implement strict validation of Decision Panel inputs in the Manual Screening workspace and disable the save button when no modifications exist.
- **Changes**:
  - Added React `useMemo` in `ManualScreeningDetailView.tsx` to compare current state with DB state (`hasChanges`) and compute missing fields (`validationErrors`).
  - Added strict validation checking logic for all manual screening stages (Fast Filter, Gatekeeper, Scientist, Miner), making all stage-specific inputs (including QA evidence and Miner variables value & evidence) mandatory.
  - Rendered a styled missing fields list above the submit button and disabled the Save button if saving is in progress, if there are no changes, or if validation errors are present.

## #204 - Resolved Stage 2 Dashboard Metrics Mismatch (2026-07-16)
- **Goal**: Resolve dashboard metrics mismatch where Stage 2 Total didn't equal Stage 1 Included due to papers manually screened without local PDFs.
- **Changes**:
  - Updated `/api/projects` in `route.ts` to calculate Stage 2 Total exactly as the sum of Stage 2 (Included + Excluded + Unprocessed + Pending PDF).
  - Partitioned Stage 2 unprocessed papers into `unprocessed` (ready with acquired PDF) and `pending_pdf` (waiting for PDF download).
  - Updated `MetricSummaryCards.tsx` to handle and render `pending_pdf` status, displaying it on the Stage 2 progress bar and adding a text info label.

## #192 - Unified Filter Parity in Manual Screening (2026-07-15)
- **Goal**: Support full filter parity between the Paper Database view and the Manual Screening Workspace.
- **Changes**:
  - Replaced the compact 2x2 grid of selectors in `ManualScreeningList.tsx` with a collapsible dropdown Filter popover containing all 9 filters.
  - Updated `route.ts` (manual screening API) to support backend parameters `status`, `pdfStatus`, `source`, `ecTrigger`, `doiStatus` and configuration `getEcTriggers=true`.
  - Configured custom hook `useManualScreening.ts` to manage these 5 new filters, fetch EC triggers dynamically on load, and apply client-side filtering passes for Vector Semantic queries.
  - Linked new hook properties through `ManualScreeningView.tsx`.

## #193 - Revert Out-of-Context Filters from Manual Screening (2026-07-15)
- **Goal**: Remove all out-of-context filters (calibration pool, publishers, pipeline stage status, local PDF status, source scope, exclusion criteria, DOI status) from the Manual Screening Workspace.
- **Changes**:
  - Simplified filters dropdown popover inside `ManualScreeningList.tsx` to only 2 context-correct parameters: **Manual Screening Decision** (static options: Unscreened, INCLUDE, EXCLUDE, UNCERTAIN) and **Human Screening Stage** (friendly static stage names).
  - Cleaned up manual screening API endpoint queries (`route.ts`) and react hook states (`useManualScreening.ts`).
  - Wire-cleaned inputs in component layout parent (`ManualScreeningView.tsx`).

## #194 - Project-wide Stats Header Metrics & Redesign (2026-07-15)
- **Goal**: Improve stages and results metrics display at the top of the manual screening workspace.
- **Changes**:
  - Configured `getStats=true` parameter in `/api/papers/manual-screening` API (`route.ts`) to return project-wide statistics from SQLite.
  - Linked `screeningStats` and `loadScreeningStats` to `useManualScreening.ts` hook.
  - Redesigned `ManualScreeningStatsHeader.tsx` to read stats from SQLite, show percentages for screened/pending papers and decisions/stages, display pending paper totals, and correct the obsolete "QA Wait" label to "Uncertain".
  - Passed stats properties inside component wrapper layout `ManualScreeningView.tsx`.

## #195 - Unify Decision Panel Form & Stages in Manual Screening (2026-07-15)
- **Goal**: Clean up the manual screening detail decision panel to only support Include and Exclude, always show all 4 stages, and remove calibration logic splits.
- **Changes**:
  - Replaced the split Option A / Option B flows inside `ManualScreeningDetailView.tsx` with a single unified layout.
  - Set the "Human Decision Override" selectors to strictly Include and Exclude (removing QA Wait/Uncertain options).
  - Wired `getEcRules` to load rules matching the selected `manualStage` dynamically rather than checking `selectedPaper.calibration_pool` from the calibration table.
  - Setup stage selector dropdown to always offer all 4 stages: Fast Filter, Gatekeeper, Scientist, Miner.

## #196 - Stage-based Exclusion Criteria Options Loading (2026-07-15)
- **Goal**: Populate the Exclusion Criterion Triggered list dynamically based on the current Screening Stage using project calibration settings.
- **Changes**:
  - Rewrote `getEcRules` inside `ManualScreeningDetailView.tsx` to return stage-matching rules:
    - Fast Filter -> project `ec_rules` (Pool A).
    - Gatekeeper -> project `pool_b_ec_rules`.
    - Scientist -> project `pool_c_qa_rules` (mapped as fatal flaws like `FATAL_FLAW_QA[X]`), plus a static `CUMULATIVE_BELOW_4.5` trigger.
    - Miner -> empty selection list.

## #197 - Automated Scientist Stage Decisions & Scoring (2026-07-15)
- **Goal**: Disable manual override choices for the Scientist stage, auto-calculating decisions based on QA checklist rules and cumulative thresholds.
- **Changes**:
  - Inserted React `useEffect` inside `ManualScreeningDetailView.tsx` tracking QA scores to automatically evaluate fatal flaw triggers (scores of 0.0 on fatal rules) or the cumulative score cutoff (< 4.5/8.0).
  - Conditionally hid the manual override selectors and exclusions dropdown in the Scientist stage, replacing them with a read-only stats breakdown displaying real-time scores, calculated decisions, and exclusion codes.

---

| ID | Date | Type | Description | Task/Commit Reference |
| :--- | :--- | :--- | :--- | :--- |
| #001 | 2026-06-05 | Feature | Initial codebase generation and workspace setup: Next.js frontend, SQLite database client via `better-sqlite3`, smart cached PDF matcher, bulk Selenium downloader, Rclone synchronization, visual column mapper, duplicate detector, theme switcher, and Rclone Settings wizard. | Baseline Setup |
| #002 | 2026-06-05 | Bug Fix | Fixed database paywall/CSV ingestion crash (by preventing SQLite type error when binding empty/invalid years like NaN, resolving V8 stack size overflow limit on large array inputs, and adding detailed error alerts in the front-end). | CSV Ingestion Fix |
| #003 | 2026-06-05 | Feature/Bug Fix | Fixed SQLite quote identifier syntax error in title deduplication, replaced browser alert() dialogs with a floating custom Toast notification system, and converted paths alert into an inline toggle helper. | Toasts & SQL Fix |
| #004 | 2026-06-05 | Bug Fix | Fixed SQLite quote identifier syntax error in DOI deduplication prepared statement, repositioned the Toast container to the top-right to prevent button collisions, and restyled the toasts with a left border status accent and glassmorphism. | SQL Quotes & Toast Fix |
| #005 | 2026-06-05 | Feature/Bug Fix | Implemented server-side pagination (LIMIT/OFFSET in SQL count/data queries) and page controls to optimize rendering for large paper databases; added sorting by column headers; implemented PUT/DELETE backend endpoints and a View/Edit modal with delete confirmation; polished glassmorphic Toast styles. | Pagination & CRUD Modal |
| #006 | 2026-06-05 | Feature | Integrated Tesseract OCR and PyMuPDF fallback into the cache matcher pipeline. Scanned/image-only PDF first pages are rendered to images and run through OCR if standard text extraction is empty. Added OCR settings (toggle and custom path) to SettingsModal. | Tesseract OCR Integration |
| #007 | 2026-06-05 | Feature | Implemented a unified, sequential customizable PDF batch execution workflow (Scan Cache, Scrape PDFs, Compress PDFs, and Sync GDrive) with real-time NDJSON stream logging. Matched/downloaded files are stored in `raw_pdf/` and deleted from source folders. PDF compression uses Ghostscript incrementally with custom quality levels, or falls back to direct copies if disabled, allowing GDPR cloud sync opt-out. | Customizable Batch Pipeline & Compression |
| #008 | 2026-06-05 | Feature/Bug Fix | Added cryptography package to Python dependencies in requirements.txt (to support pypdf AES decryption of encrypted PDFs), added real-time scanning progress updates in `cache_matcher.py`, and refactored the frontend batch execution modal to display detailed paper information dynamically. | Matcher Decryption Fix & Verbose Logs |
| #009 | 2026-06-05 | Feature | Implemented modal minimization support showing a floating glassmorphic active progress widget in the bottom-right and an Expand button to reopen. Added a real-time statistics panel showing Checked, Found (Success), and Not Found (Fail) counters dynamically calculated based on the active pipeline step. | Modal Minimization & Real-time Stats |
| #010 | 2026-06-05 | Feature/Bug Fix | Fixed pipeline cancellation process freeze by refactoring Close / Cancel button display conditions to depend on execution state (isExecuting) rather than completion percentage, and implemented recursive process tree termination (using taskkill on Windows and SIGKILL on Unix). Implemented anti-regression safetynets in cache_matcher.py (skipping matched/downloaded papers with existing local files) and pdf_scraper.py (marking failed/timeout downloads as FAILED status to skip them on future runs). Added FAILED options to UI filters, detail editors, and colored its status dot indicator solid red (bg-destructive). | Process Cancel & Anti-Regression Safetynet |
| #011 | 2026-06-05 | Feature | Expanded modal dimensions to max-w-3xl and h-[600px] to comfortably display verbose logs. Disabled current item title truncation (wrapping text instead) and optimized rendering performance by slicing log outputs to show only the last 500 records. Added real-time log event streaming for [SCANNING] and [SKIPPED] papers in cache_matcher.py, styled them with custom colors (soft amber and dim gray), and prepended checkmarks (emerald green) to successful matches. | Expanded Modal & Verbose Log Streaming |
| #012 | 2026-06-05 | Feature | Implemented real-time dynamic comparison filename updates inside the current paper display widget by emitting comparing events from cache_matcher.py. Added an advanced time estimation system on the Next.js frontend calculating average speed per paper and estimated time remaining (using a background useEffect ticking timer for smooth countdowns) displayed in a new glassmorphic details widget in the modal and a compact countdown row in the minimized banner. | Active File Comparisons & Time Estimation |
| #013 | 2026-06-05 | Feature/Refactor | Moved the Batch PDF Pipeline Execution interface from a modal to an in-place panel card within the database tab switcher, replacing the papers list grid. Added MD5 deduplication in cached_pdf/. Implemented an incremental caching database cache_index.db to store MD5 hashes, sizes, mtimes, extracted titles/DOIs, and page 1 text to achieve 1000x matching speedups through memory-only lookups, logging OCR runs explicitly. Designed a scientific validity checker in pdf_scraper.py verifying size (>5KB) and rejecting conference schedule/TOC files. | In-place Card, Cache Index & PDF Validator |
| #014 | 2026-06-05 | Feature | Added detailed cache indexing progress tracking under Average Speed. Emitted `indexing` events from cache_matcher.py (throttled to every 50th file for fast Cache DB lookups to prevent event stream flooding, and every file for active pypdf/Tesseract OCR extraction) and rendered them with an animated indicator showing the filename, tool used (Cache DB, pypdf, or Tesseract OCR), and current progress. Minimized banner also renders this status cleanly. | Cache Indexing Progress UI & Throttling |
| #015 | 2026-06-23 | Refactor | Epoch 6.1: Centralized PDF asset structure. Moved legacy scattered folders (`raw_pdf`, `pdf_repo`, `downloaded_pdf`, `cached_pdf`) into a unified `pdf_library/` core (with `raw/`, `repo/`, `downloads/`, `cached/` subdirectories). Updated Next.js API routes (`/api/pdf/serve`, `/api/pdf/open`, `/api/pdf/batch`), Settings Modal UI helpers, SQLite paths schema, and all referencing Python execution contexts to enforce this strict unified pathing. | PDF Folder Consolidation |
| #016 | 2026-06-23 | Refactor | Epoch 6.2 & 6.3: Python Engine Clean Architecture Refactor. Renamed legacy `scrapers/` to a structured `python_engine/` package module. Completely dismantled the massive script monoliths (`pdf_scraper.py`, `cache_matcher.py`, `pdf_compressor.py`). Decoupled and distributed business logic across discrete domains: `core/` (config, DB, events, security), `crawler/` (Selenium browser, DOM parsing, stateful navigator), `pdf/` (pypdf/tesseract analysis, Ghostscript compressor, scientific validation), and wrapped them into lightweight CLI scripts via `entrypoints/`. Next.js process execution layers were updated to strictly execute using the standard `python -m python_engine.entrypoints.*` execution methodology to support package namespace resolution and drop legacy direct file imports. | Clean Architecture Python Migration |
| #015 | 2026-06-05 | Bug Fix/Feature | Fixed page unresponsiveness by throttling progress and scanning logs in cache_matcher.py to every 100th paper (printing matched papers instantly), preventing browser main thread locks. Implemented a robust background execution and re-attachment mechanism in the Next.js API route (`route.ts`) storing state globally. Clients fetch current status on mount and connect to `/api/pdf/batch?stream=true` to tail future logs and restore execution state. Implemented an explicit POST `/api/pdf/batch/cancel` endpoint to safely terminate background subprocesses. | Background Runner, Re-attach State & Throttle progress |
| #016 | 2026-06-05 | Optimization | Limited the PDF Batch log length to the last 500 lines on both the server-side global state and the client-side React state. This prevents memory leaks, rendering lag, and slow responses on re-attachment while running large pipelines. | Batch Log Cap |
| #017 | 2026-06-05 | Bug Fix | Fixed stdout buffer fragmentation issue in the background pipeline execution API that caused JSON messages to split and print as raw JSON strings in the log panel. Implemented automatic 10-second dismissal timeout for the "Indexing Cache" progress display on both server and client side. | Batch stdout buffer & Indexing auto-dismiss |
| #018 | 2026-06-05 | Bug Fix/Optimization | Fixed UI progress updates getting stuck on matching lookup by implementing a time-based throttle (300ms interval) for events in `cache_matcher.py`. Optimized the fuzzy title matcher loop with O(1) string length upper-bound pre-checks to skip expensive difflib SequenceMatcher calculations, speeding up runs by up to 20x. | Batch UI updates & Fuzzy match speedup |
| #019 | 2026-06-05 | Bug Fix/Optimization | Removed the extremely slow and mathematically ineffective fuzzy text-matching lookup block (`difflib.SequenceMatcher` against first 1,000 characters of page 1 text) in `cache_matcher.py` that wasted huge CPU cycles and caused minutes-long delays per paper, speeding up overall matching matching phase by 1000x. | Matcher Page 1 text loop optimization |
| #020 | 2026-06-05 | Bug Fix/Feature | Fixed proxy authentication failure in pdf_scraper.py by forcing Chrome browser headed mode and redirecting to the proxy login URL before starting scraping. Added an interactive pause/resume mechanism using sys.stdin.readline() in Python, a new /api/pdf/batch/resume POST endpoint in the Next.js API, and a prominent Resume Download button in the React UI card footer and minimized widget. | Scraper Proxy Login Redirect |
| #021 | 2026-06-05 | Feature/Refactor | Enhanced the PDF Compression pipeline with real-time incremental space saving metrics and detailed file size logging. Injected current_size and new_size tracking into the Next.js API route to accumulate originalSpaceBytes and savedSpaceBytes in real time. Refactored the UI stats panel (expanded card and minimized widget) to display Processed, Space Saved, and Original Total Size with dynamic reduction percentage updates instead of default empty matching counters. | Compression real-time space statistics |
| #022 | 2026-06-05 | Feature/Bug Fix | Added foolproofing to the batch pipeline execution by disabling all pipeline step checkboxes and the "Execute Pipeline" button in the React UI while an active run is in progress. Also implemented front-end guard checks in `runBatchExecution` to prevent parallel execution spawns. | Execution button and checkbox foolproofing |
| #023 | 2026-06-05 | Feature/Bug Fix | Added support for custom Rclone sync modes (mirror sync via 'rclone sync' vs incremental update via 'rclone copy') in SettingsModal and saved configuration settings. Handled Rclone execution failures by checking logs for empty/expired OAuth tokens and outputting user-friendly config reconnect instructions. Upgraded UI statistics display during synchronization to show Sync Phase, public links generated, and failures dynamically in both standard panel and minimized widget. | Sync Mode and OAuth Troubleshooting |
| #024 | 2026-06-05 | Feature | Added verbose logging (`-v` flag) to the Rclone sync child processes and parsed progress statements in real-time to show the specific PDF file in progress of uploading/skipping inside the UI dashboard under `currentItem`. | Verbose upload logs and current item tracking |
| #025 | 2026-06-05 | Bug Fix | Fixed Rclone log buffering by adding stdout/stderr line-buffering (splitting stream chunks by `\n`) and passing `--stats 1s --stats-one-line` to Rclone, forcing it to flush logs instantly and frequently. Also fixed space-splitting link generation errors by migrating from shell `execSync` to direct array `execFileSync` execution. | Rclone log buffering and space-splitting bugs |
| #026 | 2026-06-05 | Bug Fix | Resolved UI freezing in batch sync execution by replacing synchronous `execFileSync` loop for Rclone link generation with asynchronous `execFileAsync` subprocess commands. Added local file disk existence check `fs.existsSync` to skip linking and update status to `'MISSING'` for manually deleted PDFs, preventing linking timeouts and failures. | Batch sync UI freeze and missing PDF link fix |
| #027 | 2026-06-05 | Feature | Added bulk paper database deletion endpoint (`DELETE /api/papers?confirm=DELETE_ALL`) and frontend button/modal requiring typed "DELETE ALL" confirmation to prevent accidental wiped database. Refactored Selenium scraper `pdf_scraper.py` with a stateful depth-first search (DFS) backtracking crawler, auto-consenting Terms & Conditions checkboxes, scoring download elements by visible text or nested icons/SVGs, and automatically retreating (going back) upon hitting login, payment, or paywall barriers. | Bulk deletion and stateful backtracking crawler |
| #028 | 2026-06-05 | Bug Fix | Fixed crawler tab leaks, duplicate candidate skips, and ScienceDirect click failures in `pdf_scraper.py`. Implemented `_cleanup_tabs(main_handle)` to close extra windows, fixed the element de-duplication loop to key off of unique Selenium `e.id` values (preventing skipping distinct buttons that share class names), added auto-click approval for "Allow All" cookie consent buttons (`_accept_cookies`), added specific ScienceDirect URL selector overrides (+250 boost), and accelerated search speed by polling for downloads in 0.5s intervals via `_wait_for_immediate_download`. | Crawler tab leak, element selection, and ScienceDirect fix |
| #029 | 2026-06-05 | Bug Fix | Resolved ScienceDirect download button selection error (clicking footer reference links due to similar "View PDF" labels). Implemented an instant URL construction fast-path in `_cascade_find_pdf` extracting the paper's PII via regex and directly navigating to `/science/article/pii/<PII>/pdfft` for immediate download. Added a Javascript-based ancestor verification filter in `_find_candidate_elements` that scans parent classes/IDs and heavily penalizes (`-1000` points) elements located inside reference, bibliography, citation, or footnote sections. | ScienceDirect first-shot success and references exclusion |
| #030 | 2026-06-05 | Bug Fix | Dropped ScienceDirect programmatic URL construction fast-path due to terms/conditions warning interceptions. Restricted checkbox selectors in `_check_and_click_checkboxes` to actual input elements, role checkboxes, and their labels, preventing accidental clicks on footer Terms & Conditions links. Applied a heavy `-1000` penalty to standard navigation/cookie/legal links. Aligned specialized IEEE, ACM, and Acta Horticulturae crawler paths with legacy `downloader.py` logic, and added localized checkbox auto-checking near candidates inside `_backtrack_search`. | ScienceDirect terms fix & specialized crawler handlers |
| #031 | 2026-06-05 | Bug Fix | Improved crawling accuracy by dropping non-relevant elements (images, full issues, legal files, datasets, slides) with a `-1000` penalty. Added target URL checks in `_find_candidate_elements` by resolving absolute URLs; elements with direct PDF URLs are boosted by `+1000` to prioritize them. In `_backtrack_search`, implemented direct PDF URL navigation fallback if a click fails or does not trigger a download. | Target URL boosts, direct PDF navigation fallback & image exclusions |
| #032 | 2026-06-05 | Feature/Refactor | Implemented Dashboard & Multi-Project support in Next.js frontend and SQLite schema (adding `gdrive_dest_path` project-level config). Shared raw and cached PDFs across projects but isolated synced repos in `pdf_repo/<folder_name>/`. Merged compression (Ghostscript) directly into Rclone sync under a checkbox toggle. Developed deterministic Paper ID generator (`AuthorLastName_Year_TitleStart_Hash`) replicating Apps Script logic. Defaulted imported paper status to `'IGNORED'`. | Dashboard, Multi-Project, Ingestion Hub & Sync-Compression Merger |
| #033 | 2026-06-06 | Feature/Refactor | Moved inline PDF compression toggle checkbox to Global Configuration modal (reading config key PDF_COMPRESSION_ENABLED). Restricted the EXECUTE PIPELINE execution toolbar strictly to the Paper Database tab. Merged the CSV Ingestion and Manual Ingestion (Snowballing) forms side-by-side inside the showImport database subpanel, renaming the interface to "Ingestion Hub". Added real-time compression space-savings stats progress broadcasts to client before sync. | Ingestion Hub Merge & Global Compression Toggle |
| #034 | 2026-06-06 | Bug Fix | Fixed UnboundLocalError in main() in pdf_compressor.py by using local variable names (project_output_dir and project_manifest_file) instead of reassigning global variables (OUTPUT_DIR and MANIFEST_FILE) locally. | PDF Compressor Scoping Bug Fix |
| #035 | 2026-06-06 | Bug Fix | Fixed a pipeline bug causing premature batch execution completion and "[SUCCESS]: undefined" log entries. Added checks in the Next.js NDJSON parser and frontend event listener to ignore script-level 'complete' events from Python subprocesses, ensuring the pipeline runs to completion and only ends on the global stream 'complete' event. | Premature Batch Completion & SUCCESS undefined Fix |
| #036 | 2026-06-06 | Feature | Added the 'IGNORED' option to the PDF Status filter dropdown in the database view, and to the PDF Status select dropdown in the Edit Paper detail modal. Configured custom color coding ('bg-muted-foreground/50' neutral gray) for the 'IGNORED' status indicator dot in both the database grid and the modal view mode. | IGNORED PDF Status Option & Styling |
| #037 | 2026-06-06 | Bug Fix | Removed duplicate Google Drive Destination Path input field in Global Settings modal. Removed standalone PDF compression step from default pipeline steps state to prevent stats/metrics reset and allow proper Match Cache pipeline updates. | GDrive Config & Compression Fix |
| #038 | 2026-06-06 | Feature | Implemented an inline PDF Previewer inside the Paper Details modal. Created a secure Next.js API endpoint `/api/pdf/serve` to stream local PDF files. Modified the modal to dynamically expand to a larger split-pane layout (`max-w-7xl h-[85vh]`) when the paper has a matched, downloaded, or synced PDF available on disk, rendering the PDF in a dedicated right-hand column iframe. | Inline PDF Previewer & Serve API |
| #039 | 2026-06-06 | Bug Fix | Fixed project data resetting or loading from the wrong database when starting npm run dev from different directory levels (workspace root vs. slr-ide subfolder). Centralized execution directory resolution by exporting a stable PROJECT_ROOT path from db.ts and refactoring all backend endpoints (batch, sync, download, scan, and serve) to resolve assets and db queries relative to it. | Stable PROJECT_ROOT Resolution |
| #040 | 2026-06-06 | Bug Fix | Fixed issue where saving the project manifesto and restarting/refreshing the app caused the active project name, manifesto, objectives, questions, exclusion criteria, calibration target sizes, and Google Drive destination paths to reset/clear on the dashboard UI. Resolved by calling loadProjects() on component mount to retrieve the active project state and populate dashboard inputs. | Initial Mount Projects Load Fix |
| #041 | 2026-06-06 | Feature | Implemented a sticky table pagination footer in the Paper Database tab. Refactored the data table's parent wrapping container class from 'overflow-auto' to 'flex-col overflow-hidden', allowing the inner table element to scroll independently while keeping the paging toolbar fixed at the bottom of the viewport. | Sticky Table Pagination Footer |
| #042 | 2026-06-06 | Feature | Implemented the Pre-Calibration stage with three calibration pools (Pool A, Pool B, Pool C) and a Consensus scorecard calculating agreement rate and Cohen's Kappa. Added database schema migrations for calibration_pool, Human_Decision, Human_EC_Trigger, and Human_Rationale. Built a side-by-side assign pools picker with live progress stats, inline PDF viewer, and single-paper acquisition crawler utilizing cache matcher first and Selenium scraper with real-time logging, pause, and cancellation. Created blinded SLR JSON schema export/import APIs. Optimized the details pane crawler layout to prevent terminal logs squashing, and added prominent Cancel and Resume Download buttons directly next to the Get PDF action when waiting for proxy credentials. Upgraded details pane accessibility by increasing font sizes, allowing full scrolling of paper metadata, and optimistically dismissing the Resume button immediately on click to prevent multiple submissions. | Pre-Calibration & Consensus Scorecard |
| #043 | 2026-06-11 | Feature | Added new Parent_Paper_ID column database migration to chain manual ingested and edited papers to a parent paper in the papers table. Implemented subquery lookup to resolve Parent_Paper_Title inside GET routes. Added autocomplete parent search inputs with debounced fetching to both Manual Ingest form and Paper Details modal. Implemented click-to-traverse detail modal navigation allowing users to explore chained references seamlessly. | Parent Paper Snowballing Chains |
| #044 | 2026-06-11 | Feature | Implemented project-scoped Microsoft OneDrive and Google Drive Rclone synchronization pipeline. Added cloud_provider and rclone_remote_name to projects database table and updated schema migrations. Scoped rclone configs at project-level instead of global settings. Updated SettingsModal, create project forms, project edit forms, dynamic sync buttons, tooltips, serve endpoints, connection tests, and log stream parsers to support dynamic provider configurations. | Project-Level Cloud Sync & OneDrive Support |
| #045 | 2026-06-11 | Feature | Refactored the dashboard project configuration UI. Moved the "Research Manifesto & Metadata Settings" form into a dynamic tabbed modal triggered by clicking a configuration gear icon in the Projects table. Separated the settings into Research Metadata (with larger textareas), Pre-Calibration Sampling, and Cloud Sync tabs. Expanded the Projects Manager layout to full-width and added detailed columns (slug/created details, cloud configs, screening progress rate visualizer, PDF acquisition progress rate visualizer, and calibration target sizes). | Tabbed Settings Modal & Expanded Projects Table |
| #046 | 2026-06-11 | Feature | Added a Test Connection button in the project settings Cloud Sync configuration tab, enabling connection testing of unsaved Rclone configurations before committing them. Integrated a dynamic, provider-aware setup guide link panel containing quick links to the Rclone Google Drive / OneDrive setup documentation. | Project Sync Connection Test & Setup Links |
| #047 | 2026-06-11 | Feature | Implemented dynamic custom tagging and decision classifications for calibration pools (Pool A, Pool B, Pool C). Replaced Pre-Calibration Sampling configuration grid with a sub-tabbed pool layout, allowing custom decision codes and labels to be configured via dynamic Add/Remove editors. Added interactive tag selection dropdown to Quick Action buttons in the Assign Papers details panel. Implemented hover-triggered tag count breakdown popovers on the Pre-Calibration page cards and Assign Papers modal progress bars. | Custom Calibration Pool Tagging & Hover Stats |
| #048 | 2026-06-11 | Feature | Added Pre-Calibration papers list table filtering and sorting by assigned pool tag code. Added options to select, change, or clear Calibration Pool and Calibration Tag assignments within the Edit Paper Details modal. | Pool Tag Filtering & Sorting in CRUD |
| #049 | 2026-06-11 | Feature | Added Inter-Rater Blinded Review configuration sections to Pool A project settings to define custom Exclusion Criteria rules (ecRules) and Reasoning Templates (reasoningTemplate) via dynamic multi-field list inputs, persisting them in projects table JSON columns, and serializing them in the exported blinded .slr metadata. | Blinded Review Configuration & Export |
| #050 | 2026-06-11 | Feature | Implemented end-to-end Blinded Review Ingestion & Adjudication workflow for Pool A. Added `reviewer_decisions` and `calibration_commit_ledger` database tables with foreign key cascades and PRAGMA enforcement. Rewrote the import Next.js API route to implement identity-first routing, slot vacancy caps (max 2), snapshot sync, conflict isolation (`PENDING_ADJUDICATION`), and git-like audit logs. Created stats computation API with NaN-guards, deterministic alphabetical sort identity masking, and strict intersection denominators. Integrated a new premium `InterRaterDashboard` component containing tabbed views, reliability statistics confusion matrix, discrepancy resolution workspace, and timeline ledger audit logs. | Adjudication Workflow & Git Ledger |
| #051 | 2026-06-11 | Feature | Transitioned the Inter-Rater Dashboard interface into a fullscreen modal overlay with a top-right exit button, aligning it with the Assign Papers modal behavior and restoring the standard Pre-Calibration pool view as the default. | Fullscreen Inter-Rater Modal |
| #052 | 2026-06-12 | Feature | Added a Reset Calibration button to the Pool A Inter-Rater Dashboard. Implemented a corresponding DELETE endpoint in the inter-rater import API route to clear all reviewer decisions, delete calibration audit ledger entries, and restore Pool A papers back to their baseline pending status. | Reset Calibration Option |
| #053 | 2026-06-12 | Feature | Implemented PDF asset rescue during paper/project deletion. Moving PDFs from raw_pdf/ to cached_pdf/ protects acquired resources during bulk removals. Added a "Delete Project" option in the Dashboard project list, which clears all cascaded databases while rescuing project PDFs. | PDF Asset Rescue & Project Deletion |
| #054 | 2026-06-12 | Feature | Implemented real-time multi-tab state synchronization using the HTML5 BroadcastChannel API. Added broadcast calls to paper, project, and pipeline mutations. Designed a mutable ref hook pattern in page.tsx and InterRaterDashboard.tsx to bypass React stale closure issues. Documented the pattern as a strict protocol in agents.md to ensure future-proofing. | Multi-Tab State Synchronization |
| #055 | 2026-06-12 | Refactor | Refactored the `page.tsx` single-file monolith into modular View components (`DashboardView`, `PreCalibrationView`, `IngestionHubView`, `PaperDatabaseView`) and decoupled React state and side-effects into custom hooks (`useProjects`, `usePapers`, `useProjectForm`, `useIngestion`) to establish clean code architecture, resolve ghost-prop drilling, and enforce strict Next.js client directives. | Clean Architecture Refactor |
| #056 | 2026-06-12 | Bug Fix | Fixed CSV import processing using correct regex line-break splits /\r?\n/ instead of split('') after hook extraction. | CSV Import Splitting Fix |
| #057 | 2026-06-12 | Refactor | Completed additional hook abstractions and view encapsulation (PreCalibrationView, custom hook migrations) in page.tsx and performed final tree-shaking and duplicate pruning. Updated agents.md with strict tree shaking mandate. | Final Clean Architecture Refactor |
| #058 | 2026-06-12 | Bug Fix | Restored the missing top header bar in page.tsx (displaying active project name, current tab title, and pipeline execution controls). Re-added the Pipeline checkbox toolbar (Match Cache, Scrape PDFs, Sync GDrive/OneDrive, Execute Pipeline button) to the Paper Database header. Fixed the broken Ingestion Hub button by switching from an orphaned `activeTab` route to a `showImport` state toggle under the `paper-database` tab. Defined `cloudProvider` and `cloudName` derived values in page.tsx and injected them into `allProps`. Fixed implicit `any` TS errors in AssignPapersModal.tsx and InterRaterModal.tsx. Verified via headless Puppeteer automation. | Top Header, Pipeline & Ingestion Hub Restoration |
| #059 | 2026-06-12 | Feature & Bug Fix | Restored the Multi-Tab Sync protocol by adding `subscribeSyncChannel` utility in `sync-utils.ts` and establishing a mutable ref BroadcastChannel listener in `page.tsx` that triggers `loadPapers()`. Re-wired `useIngestion.ts` to receive full paper arrays to power the "Parent Paper" search suggestions during manual ingest. Removed the inline CSV preview table and replaced it with `CsvReviewModal`, a comprehensive full-screen interactive observation table (with pagination, search, and duplicate filters) triggered from the summary stat cards. Corrected column mapping defaults to leave `PDF_Link` empty and enforce strict mapping on `Authors`. | Multi-Tab Sync & Ingestion Hub UI Overhaul |
| #060 | 2026-06-15 | Feature | Implemented bulk paper database updates for paper attributes. Added PUT handler to `/api/papers` REST API to update multiple papers inside an atomic SQLite transaction. Updated `usePapers` custom hook to manage multi-select paper IDs and invoke the batch API. Integrated checkboxes, select-all controls, and a custom glassmorphic Bulk Action Panel inside `PaperDatabaseView.tsx` supporting simultaneous status and local PDF status updates, including a dynamic notification banner allowing users to select all matching papers across pages. | Bulk Paper Edit |
| #067 | 2026-06-15 | Bug Fix | Fixed the broken Pipeline Execution UI (operationModal) regression. Removed a duplicate dummy `operationModal` state declaration inside `useUIState.ts` that was unintentionally overriding the true `operationModal` state from `usePipeline.ts` during the `...allProps` object spread in `page.tsx`. Cleaned up unused destructured modal references in `page.tsx`. | Execute Pipeline UI Fix |
| #068 | 2026-06-23 | Feature | Implemented Centralized Pipeline Execution Dashboard (Epoch 5). Migrated the legacy Data Acquisition Pipeline controls out of the global top header and natively embedded them alongside the new LLM Operations Center into `PipelineExecutionView.tsx`. Refactored `operationModal` rendering to run inline for real-time scraper log streams and space-saving stats. Suppressed legacy pop-up alerts while operating inside the pipeline command center tab. | Centralized Dashboard Refactoring |
| #069 | 2026-06-23 | Feature / Bug Fix | Fixes and enhancements to Prompt Library and LLM settings. Aligned backend routes (`/api/llm/prompts` and `/api/llm/pricing`) to SQLite tables (`prompt_templates` and `llm_pricing`), added dynamic prompt dropdown option loading in settings UI, resolved button-form click submission glitches, and integrated advanced tuning parameters (`max_tokens`, `top_p`, `top_k`) globally and project-specifically. | Prompt & Pricing API Fixes |
| #070 | 2026-06-24 | Feature | Implemented the 'Map Publisher' pipeline in the Data Acquisition Pipeline and Ingestion Hub. Added Original_Publisher and Publisher columns to SQLite papers table with auto-migration. Added Bulk CSV Ingestion mapping for the new publisher columns. Implemented map_publisher.py Python script featuring a 3-step mapping protocol: Fast Path local regex heuristics, Slow Path Crossref works API fallback with polite User-Agent, and Final Filter normalization. Updated Next.js REST API routes and the Pipeline Execution frontend to execute map_publisher.py, stream real-time logs, and display progress statistics. Added view/edit controls for Original Publisher and Publisher inside the Paper Details modal. | Map Publisher Pipeline |
| #071 | 2026-06-24 | Feature | Added Publisher column to Paper Database table, supporting sorting, searching, and filtering. Implemented dynamic unique publisher loading via `/api/papers?getPublishers=true` API and added a dropdown selector filter to the database UI. Updated sorting whitelists and SQL search queries on the backend to match the Publisher column. Modified the Data Acquisition Pipeline checkboxes (Match Cache, Scrape PDFs, Map Publisher, Sync Cloud) to default to unchecked (false). | Publisher Col & Pipeline Defaults |
| #072 | 2026-06-24 | Bug Fix | Fixed the "Get PDF via Cache Matching & Scraping" single paper execution error in the Assign Papers details modal by updating the Next.js API routes `/api/pdf/single` and `/api/pdf/batch` to execute the refactored `python_engine.entrypoints.scrape_pdfs` module instead of the non-existent `python_engine.pdf_scraper` module. | Single/Batch Scraper Module Path Fix |
| #073 | 2026-06-25 | Bug Fix | Fixed "Forbidden: Access is denied" error when serving/previewing cache matched PDFs. Corrected `match_cache.py` to write the new unified directory prefix `pdf_library/cached/` instead of `cached_pdf/` to the database. Added a self-healing SQL migration in `db.ts` to automatically convert all existing legacy paths (e.g. `cached_pdf/`, `downloaded_pdf/`, `raw_pdf/`, `pdf_repo/`) in the `papers` table to the new `pdf_library` layout. Added an alias-resolution fallback mapping inside the `/api/pdf/serve` Next.js endpoint to translate legacy query parameters. | Legacy PDF Path Consolidation & Serve API Fix |
| #074 | 2026-06-25 | Feature | Epoch 1: Foundation, Dependency & Database Schema for Heuristic Duplicate Detection & Adjudication Pipeline. Added `duplicate_pairs` table, `is_duplicate` and `merged_into_id` columns to `papers` table, and created database indexes for duplicate screening query optimization. Added `rapidfuzz` dependency to requirements.txt and installed it inside the python virtual environment. | Duplicate Detection Foundation |
| #075 | 2026-06-25 | Feature | Epoch 2: Python Engine & REST APIs for Heuristic Duplicate Detection & Adjudication Pipeline. Created `detect_duplicates.py` engine implementing year/author blocking heuristics, RapidFuzz fuzzy title token-set similarity, Scopus author ID intersection checking, and fallback author name validation. Created Next.js API routes `/api/duplicates/scan` for NDJSON event streams, `/api/duplicates` for fetching candidate pairs, and `/api/duplicates/resolve` for atomic state resolution. | Duplicate Detection Engine & APIs |
| #076 | 2026-06-25 | Feature | Epoch 3: Frontend UI, Orchestration & Multi-Tab State Sync for Heuristic Duplicate Detection & Adjudication Pipeline. Integrated duplicate scan sequentially before PDF acquisition in runBatchExecution and handleBatchEvent. Added "Execute and Review Anti-Duplicate Job" checkbox to PipelineExecutionView.tsx. Exposed "Review Duplicates (X)" badge button in PaperDatabaseView.tsx to open DuplicateReviewModal.tsx. Implemented side-by-side comparison, deterministic scoring recommendation, manual override selector, and atomic resolution with BroadcastChannel synchronization. | Frontend UI & Sync |
| #077 | 2026-06-25 | Feature | Epoch 4: Verbose Real-Time Progress Reporting. Refactored the duplicate comparison engine (`detect_duplicates.py`) to run paper-by-paper and emit progress JSON events dynamically. Added time-based throttling (100ms interval) to keep stdout output optimized. Updated Next.js API `/api/duplicates/scan` stream handler, `usePipeline` hook, and dashboard views (`PipelineExecutionView.tsx`, `page.tsx`, and `PaperDatabaseView.tsx`) to track, map, and display progress metrics and found duplicate counts on-the-fly. | Verbose Progress Reporting |
| #078 | 2026-06-25 | Optimization | Epoch 5: Optimize Scopus ID Title Similarity Threshold. Relaxed the duplicate detection threshold for Scopus ID matched papers in `detect_duplicates.py` from `> 80.0` to `> 70.0`. This enables the identification of conference-to-journal duplicates sharing multiple Scopus IDs but having slightly revised titles (such as the Cambridge Campus digital twin papers). | Scopus ID Threshold Optimization |
| #079 | 2026-06-25 | Bug Fix | Epoch 6: Resolve Scoping and Rendering of Global Modals. Solved scoping and rendering bug where the Duplicate Review Modal was inaccessible by moving `allProps` out of the local IIFE to the parent component level. Imported and rendered the `GlobalModals` component at the bottom of the page structure to serve as the unified modal route. Cleaned up redundant inline modal definitions and SettingsModal import from `page.tsx` for tree shaking. | Scoping & Global Modals Integration |
| #080 | 2026-06-25 | Bug Fix | Fixed duplicate resolution API crash by correcting action name string matching mismatch (`CONFIRM_DUPLICATE` vs `CONFIRMED_DUPLICATE`) in `resolve/route.ts` Next.js endpoint. | Duplicate Resolve Action Fix |
| #081 | 2026-06-25 | Bug Fix | Fixed residual typo in error message string in `resolve/route.ts` (error body still referenced `CONFIRM_DUPLICATE action` instead of `CONFIRMED_DUPLICATE action`). Added defensive null-guard in `DuplicateReviewModal.tsx` `handleResolve` to prevent a null `keep_paper_id` from being sent to the API when no primary paper is selected, surfacing a clear toast error to the user instead. | Duplicate Resolve Null-Guard & Error Message Fix |
| #082 | 2026-06-28 | Bug Fix / Feature | Epoch 9 & 10: Resolved Pool B and Pool C rule configuration state desync by declaring missing state variables and 12 helper functions in `page.tsx`, updating `openProjectSettings` and `handleSaveProjectManifesto` to parse and serialize them with SQLite JSON columns, and exporting them via `allProps`. Secured cross-tab duplicate count reactivity by ensuring `SYNC_PAPERS` triggers `loadDuplicatesCount` in `useAppSync.ts` and broadcasting `SYNC_DUPLICATES` from `DuplicateReviewModal.tsx`. Verified via `npx tsc --noEmit` and dev server smoke testing. | Pool B/C Rule State Desync & Duplicate Sync Fix |
| #083 | 2026-06-28 | Bug Fix | Fixed empty Research Questions (RQs) display regression in `ProjectActivityLog.tsx` by updating property access to correctly check `activeProject.questions` alongside legacy `activeProject.research_questions`. Verified system stability via `npx tsc --noEmit`. | Dashboard Research Questions Fix |
| #084 | 2026-06-28 | Bug Fix / Feature | Resolved active project state desync by updating `loadProjects()` in `page.tsx` to correctly parse and set `pool_b_ec_rules`, `pool_b_reasoning_template`, `pool_c_qa_rules`, and `pool_c_extraction_rules` on mount and project switch. Enhanced `useAppSync.ts` to implement comprehensive cross-tab reactivity for `SYNC_PAPERS`, `SYNC_ADJUDICATION`, `SYNC_DUPLICATES`, and `SYNC_PROJECTS`. Aligned `slr-ide/db/schema.md` documentation with `lib/db.ts` SQLite table migrations. Verified clean build via `npx tsc --noEmit`. | Active Project Desync & Cross-Tab Reactivity Fix |
| #085 | 2026-06-28 | Bug Fix | Resolved calibration view regressions by exposing `showAssignModal` in allProps to restore modal visibility. Updated `handleExportCalPoolA` to dynamically select the active calibration pool instead of hardcoding Pool A. Re-introduced the pre-calibration consensus statistics (TP, TN, FP, FN, agreement rate, and Cohen's Kappa) for Pool A by querying pool papers and calculating values on the client. | Calibration View & Scorecard Fixes |
| #086 | 2026-06-28 | Bug Fix | Resolved the unclickable "Assign Papers to Pools" button regression by removing the legacy duplicate rendering of `AssignPapersModal` and `InterRaterModal` from `GlobalModals.tsx`. Performed a tree-shaking audit of unused imports and deleted 6 deprecated/dead components and hook files, updating the module-scoped `files.md` index. Verified system stability via `npx tsc --noEmit`. | Duplicate Modal Resolution & Tree-Shaking |
| #087 | 2026-06-28 | Refactor | Decoupled the single-file dashboard `page.tsx` monolith and inline settings components into six modular custom React hooks (`useProjects`, `useProjectForm`, `usePapers`, `useIngestion`, `usePipeline`, `useCalibration`) and standalone modal components (`CreateProjectModal`, `ProjectSettingsModal`). Purged over 2,400 lines of inline states and triggers from `page.tsx`, mapping them to the context provider for ghost-prop compatibility. Verified Next.js compiler build compilation successfully. | Monolith Refactoring & State Decoupling |
| #088 | 2026-06-28 | Refactor | Refactored monolithic and God components in slr-ide. Extracted conflict resolution split-pane workspace from `InterRaterDashboard.tsx` to `AdjudicationWorkspaceModal.tsx`. Extracted configuration settings forms (Metadata, Calibration rules, Cloud Sync configs) from `ProjectSettingsModal.tsx` to standalone sub-tab components (`ProjectMetadataSettings`, `ProjectCalibrationSettings`, `ProjectSyncSettings`). This reduced parent file complexity by over 1,000 combined lines of inline JSX and state definitions. Verified clean build compilation via `npx tsc --noEmit`. | Clean Code Refactoring & De-monolithization |
| #089 | 2026-06-28 | Refactor | Clean Code architecture refactoring of monolithic files. Modularized `ViewEditPaperModal.tsx` into `PaperMetadataView`, `PaperMetadataEdit`, `ParentPaperSelector`, and `PdfPreview`. Modularized `FullscreenAssignModal.tsx` into `PoolStatsHeader`, `PaperSelectionList`, and `AssignDetailView`. Extracted background pipeline orchestration from `/api/pdf/batch/route.ts` into a service class `batch-pipeline-executor.ts`. Verified compilation stability and system integrity. | Modular Clean Architecture Refactor |
| #090 | 2026-06-28 | Refactor | Clean Code architecture refactoring of monolithic files. Decoupled SQLite database DDL schema creation and data seeding from `db.ts` to `db-init.ts`. Consolidated and extracted the duplicated inline pipeline execution progress panel to a reusable `PipelineProgressPanel.tsx` component. Extracted the CSV review table from `IngestionHubView.tsx` into `CsvReviewModal.tsx`. Extracted the pool progress cards and Cohen's Kappa scorecard from `PreCalibrationView.tsx` into `PoolMetricsPanel.tsx`. Upgraded the global state context with a comprehensive `AppState` type definition in `AppStateProvider.tsx`. Verified full type-safety system-wide. | Monolithic Files De-monolithization Heuristics |
| #091 | 2026-06-29 | Refactor | Modularized settings panels (`RcloneSettingsTab.tsx`, `ScraperSettingsTab.tsx`), inter-rater panels (`ActionControls.tsx`, `DiscrepancyTable.tsx`, `AuditLedger.tsx`), and background pipeline services (`subprocess-runner.ts`, `compressor.ts`, `rclone-sync.ts`) out of their parent files into single-responsibility helpers. Verified clean type safety compilation. | Monolith Decomposition & Clean Architecture |
| #092 | 2026-06-29 | Refactor | Eliminated the global `AppStateProvider` context pattern entirely to establish strict, explicit prop passing. Refactored `ToastNotifications.tsx`, `MinimizedPipelineBanner.tsx`, `IngestionHubView.tsx`, `PipelineExecutionView.tsx`, `PaperDatabaseView.tsx`, `PreCalibrationView.tsx`, `FullscreenAssignModal.tsx`, `FullscreenInterRaterModal.tsx`, and `GlobalModals.tsx` to receive strict typed interfaces. Removed `<AppStateProvider>` context wrapper from `src/app/page.tsx` and permanently deleted `src/hooks/AppStateProvider.tsx`. Verified type-safety system-wide with `npx tsc --noEmit`. | Explicit Props & Context Removal |
| #093 | 2026-06-29 | Bug Fix | Memoized helper functions (`showToast`, `applyTheme`, and other action handlers) in `src/app/page.tsx` using `useCallback` to prevent infinite rendering cycles. This resolves the severe log-flooding API query issue on `/api/projects`, `/api/papers`, and `/api/duplicates`. | Render-loop query flood fix |
| #094 | 2026-06-29 | Feature | Integrated turbovec vector search database and nomic-embed-text-v1.5 embedding model for semantic discovery and Stage 5 smart PDF matching. Implemented bidirectional SQLite ID mapping, query LRU caching, and CLI scripts for incremental index building, semantic searching, and near-miss trap finding. Wired Next.js API routes and the VectorBuildModal progress streaming UI directly into the FullscreenAssignModal interface. | turbovec Integration |
| #095 | 2026-06-29 | Feature | Implemented Rclone database auto-backup background service (handling periodic ticker interval backups and database mtime change detection with 1 minute spacing). Expanded paper metadata grid inside the calibration pool Assign Pools modal details view and added automated EzProxy translation helper for clickable DOI external redirects. Fixed interval settings rendering visibility conditional. Fixed semantic search and trap finder select queries to include full metadata columns. | Database Auto-Backup & Assign Pools Metadata |
| #096 | 2026-06-30 | Feature & Bug Fix | Refactored Calibration Pool Assignment with a dual-width search result panel (maximizing to a search-engine-style layout, shrinking to a sidebar when details are opened, and closing via header button). Introduced sorting by Citations, Year, and Match %. Converted the pool sub-filter button grid into a dropdown next to the search bar to maximize vertical space. Expanded Ingestion Hub with `citation_count` mapping, preview column, and sync checkbox to overwrite citation count and fill missing DOIs for duplicate matching papers on CSV reupload. Resolved `UNIQUE constraint failed: papers.Paper_ID` error when importing identical papers or duplicate papers from other projects by querying `Paper_ID`s globally and dynamically appending numeric suffixes (`_1`, `_2`, etc.) to generated IDs upon conflict. Configured the `Authors` field to default match "Author full names" (or "Authors full names") with highest priority. | Calibration Layout, Citation Sync, ID Uniqueness & Authors Mapping |
| #097 | 2026-06-30 | Bug Fix | Resolved pipeline execution multi-tab desync and real-time statistics updating. Updated streamManager.broadcast, duplicate scan scanner broadcast, and single-paper workflow broadcasts to enrich event messages with state progress, stats, current items, and messages. Modified usePipeline.ts to run a mount check, manage stream active connection ref guardrails, perform shallow comparisons of stats, and sync checkbox states. Added checkBatchStatus to useAppSync.ts for cross-tab synchronizations on SYNC_PIPELINE channel events. Updated MinimizedPipelineBanner.tsx to support the map_publisher step stats display. | Multi-Tab Pipeline Sync & Real-Time Stats Fix |
| #098 | 2026-06-30 | Bug Fix / Feature | Match Cache Pipeline stats and progressbar improvements. Updated match_cache.py to print real-time turbovec auto-indexing progress during vector database builds. Updated usePipeline.ts to reset stepStartTime to Date.now() when the first progress event is received to prevent startup preprocessing time (deduplication, index building, and auto-indexing) from skewing average speed and remaining time calculations. Updated subprocess-runner.ts to classify stderr logs containing warnings or deprecations as Warnings instead of Errors. | Match Cache Progress, Stats & Time Estimation Fix |
| #099 | 2026-07-01 | Feature | Calibration Pool Assignment UI enhancement. Modified AssignDetailView.tsx to display the local PDF filename inside a monospace, selectable block in the detailed paper metadata panel whenever a paper has a local PDF. | Local PDF Filename Display in Assign Pools |
| #100 | 2026-07-01 | Feature | Implemented high-performance caching for turbovec semantic searches in 'Assign Papers to Calibration Pools' modal. Created a SQLite-based cache table `semantic_search_cache` storing only paper IDs and similarity scores to avoid stale metadata. Integrated cache retrieval and writes in the semantic search API route, bypassing the PyTorch sentence-transformers Python child process spawn. Wired auto-invalidation triggers across paper updates, deletions, CSV ingestion, duplicate resolution, adjudication, inter-rater imports, and vector rebuild API routes. | Semantic Search Caching & Auto-Invalidation |
| #101 | 2026-07-01 | Bug Fix | Fixed a severe bug in the turbovec semantic cache matching algorithm where related papers in the same domain were falsely matched (e.g. matching traffic twins). Introduced a strict title content word overlap validation step requiring 95% word overlap for >2 content words and 100% for <=2 words in PDF page 1 text, preventing false positive matches. | Turbovec Semantic Cache Matcher False Positive Fix |
| #102 | 2026-07-01 | Bug Fix / Feature | Updated default calibration pool filter in Pool Assignment modal from 'unassigned' to 'all' (Show All). Resolved a bug in semantic search where filtering by 'unassigned' failed to exclude already assigned papers in the results by normalizing the pool parameter value to 'none' in vectors search API route. | Default Pool Filter & Semantic Search Pool Bug Fix |
| #103 | 2026-07-01 | Bug Fix / Feature | Removed turbovec semantic vector matching (Stage 5) and vector auto-indexing from the cache matching pipeline (match_cache.py) to implement a fully deterministic local matching algorithm (using Exact ID, Exact DOI, Fuzzy Title, and exact Page 1 substring matching) to completely prevent false positives on related paper titles in similar domains. | Drop Turbovec from Cache Matching Pipeline |
| #104 | 2026-07-01 | Bug Fix | Fixed a bug in the PDF validator where a valid, downloadable PDF with a malformed or duplicate font descriptor caused `pypdf` to throw an exception, resulting in the scraper failing and discarding the PDF. Added a `b'%PDF-'` signature check on the first 1024 bytes to confirm file type, allowing the validator to accept PDFs with internal parsing or text extraction errors safely. | PDF Validator Font Read Graceful Fallback |
| #105 | 2026-07-01 | Bug Fix | Resolved a subprocess storm and race condition in the semantic search flow of the Pool Assignment modal by requiring an explicit trigger (Search button / Enter key) for semantic search, adding a 250ms debounce for keyword search, aborting obsolete HTTP requests using AbortController, and strictly killing previous spawned Python subprocesses on the backend using SIGKILL. | Semantic Search Process Storm & Race Condition Fix |
| #106 | 2026-07-02 | Bug Fix / Feature | Replaced OS file mtime database auto-backup change detection with direct SQLite connection totalChanges counter and PRAGMA data_version checks, ensuring 100% reliable change detection on Windows. Created the POST /api/config/backup endpoint and integrated a Backup Now manual sync button in the Global Settings view. | Database Auto-Backup Trigger Improvement & Manual Sync |
| #107 | 2026-07-02 | UI/UX Improvement | Enhanced Assign Papers to Calibration Pools workspace: added clear selection visual highlighting state for active papers in the minimized left-hand list, implemented automatic scroll-to-top behavior for the selected card when clicked, and added a Citation Count field to the detailed metadata grid. | Selection Highlight, Scroll Align, & Citations UI |
| #108 | 2026-07-02 | Bug Fix / Feature | Fixed cookie and session data preservation in the PDF scraper by passing the `user_data_dir` parameter directly to the `uc.Chrome()` constructor. This prevents undetected_chromedriver from overriding ChromeOptions to use temporary profile folders that get discarded on browser exit, preventing frequent relogins. | PDF Scraper Persistent Chrome Profile Session Fix |
| #109 | 2026-07-03 | Feature / Bug Fix | Implemented relational pre-filtering in turbovec semantic search: added a "Filter out reviews & surveys" UI checkbox, dynamically constructed the SQL allowlist in `semantic_search.py` using safe case-insensitive title/abstract filtering to protect null values, partitioned semantic search cache keys, and fixed a pre-existing bug where searching with 'All Pools' filter returned zero matches. | Relational Pre-Filtering & All Pools Search Fix |
| #110 | 2026-07-03 | Bug Fix | Fixed keyword search functionality inside pool assignment workspace by implementing missing debounced keyword state sync Effect in `useCalibration.ts`. Renamed the pool filter dropdown option from 'All Pools' to 'All Papers' for improved clarity. | Keyword Search Sync & All Papers Filter Label Fix |
| #111 | 2026-07-03 | Bug Fix | Resolved turbovec allowlist search error by filtering allowed IDs using index contains checks in `index_manager.py`. This ensures that un-indexed paper IDs from the relational database do not trigger an exception in the C++ core query runner. | Turbovec Allowlist Missing ID Filtering Fix |
| #112 | 2026-07-03 | Feature | Implemented new publisher filtering inside calibration pool assignment modal: added `--publisher` CLI flag to `semantic_search.py`, partitioned vector search caching by publisher, dynamically fetched unique project publishers, and added a Publisher select dropdown styled with system theme. | Calibration Pool Assignment Publisher Filter |
| #113 | 2026-07-03 | UI/UX Tweak | Updated the publisher filter dropdown's default option label and tooltip to 'Publisher (Mapped)' inside pool assignment toolbar. | Publisher Filter Dropdown Label Update |
| #114 | 2026-07-03 | UI/UX Improvement | Re-arranged the pool assignment modal toolbar to stack the search input on its own full-width row, preventing horizontal squeezing caused by the multiple select dropdowns. | Search Toolbar Row Splitting & Layout Fix |
| #115 | 2026-07-03 | Bug Fix | Fixed local PDF matching logic in `match_cache.py`: split filename and extracted metadata title pre-checks so a short filename doesn't skip checking a valid metadata title, and added spaces-stripped title fallback to handle ligature spaces in extracted text. | PDF Cache Matcher Loop Bug & Spacing Fix |
| #116 | 2026-07-03 | Bug Fix | Resolved calibration assignment notes synchronization and state mutation bug: passed parent state setters to `AssignDetailView.tsx` to update active selection and search result list immutably, and triggered `broadcastSync` to sync changes across other open browser tabs. | Calibration Notes Save State Sync Fix |
| #117 | 2026-07-03 | UI/UX Improvement | Ensured that the current active paper is automatically scrolled to the top of the search viewport upon list refreshes by adding the `assignPapers` list and `assignLoading` flag to the scroll `useEffect` hook's dependencies. | Active Selected Paper Top Alignment on Refresh |
| #118 | 2026-07-04 | Feature | Added paper details copy button to `AssignDetailView.tsx` (calibration pool workspace) and `ViewEditPaperModal.tsx` (paper database details view). When clicked, the button formats and copies the paper's Title, Authors, Year, DOI, Publisher, Abstract, and Citations directly to the clipboard, providing visual "Copied!" feedback and displaying success toasts. | Paper Details Copy Button |
| #119 | 2026-07-04 | Bug Fix | Fixed silent pool assignment failure in `useCalibration.ts` by using the active selected paper as a lookup fallback if it is filtered out of the left search list. Fixed a database corruption bug in the paper PUT endpoint `/api/papers/[id]` where a paper's `Status` and `Local_PDF_Status` were reset to defaults during partial updates (such as notes saving or pool assignment). | Pool Assignment Fallback & Status Reset Bug Fix |
| #120 | 2026-07-04 | Performance / Optimization | Optimized Turbovec semantic search and traps search by implementing a persistent Python background worker daemon process (`vector_worker.py`) that loads the model weights once and exposes a Request-ID-based RPC interface via stdin/stdout, dropping search latency from 20s to <100ms. Implemented inactivity cleanup and robust crash recovery in `VectorDaemonManager`. Also speeded up bulk vector indexing by moving disk write calls out of batch loops in `build_vectors.py`. | Turbovec persistent daemon & bulk write optimization |
| #121 | 2026-07-04 | Feature | Added a new cohort tag filter dropdown to the Pre-Calibration table view based on the active pool's tag breakdown. Included visual cohort tag badges next to paper titles in the table for quick cohort identification. | Pre-Calibration Cohort Tag Filter |
| #122 | 2026-07-07 | Feature | Added new fields in Project Settings -> Calibration -> Pool C to configure scoring logic (descriptions for scores 1.0, 0.5, and 0.0) for each QA rule. Modified `ProjectCalibrationSettings.tsx` and `useProjectForm.ts` to manage these fields. | Pool C QA Scoring Logic Settings |
| #123 | 2026-07-09 | Feature | Changed "Exclusion Criteria Rules" description field from an open text input to a select dropdown menu in Project Settings -> Calibration for Pool A and Pool B. Loaded the select list options dynamically from the project's Metadata -> Exclusion Criteria list. | Select dropdown for Exclusion Criteria Rules |
| #124 | 2026-07-10 | Bug Fix / Refactor | Consolidated all Ghostscript PDF compression and copying logic into the single Python entrypoint (`compress_pdfs.py`). Deleted the dead `/api/pdf/sync` route and deleted `compressor.ts`. Integrated `-dEmbedAllFonts=true` and `-dSubsetFonts=false` to fix subsetted font corruption. Added PyPDF-based post-compression validation falling back to direct copy on structural failure. Dynamically updated UI progress step start messages and labels based on compression state. Mapped manifest tracking using the actual compression outcome. | Consolidated PDF Compression Pipeline, Font Protection & Validation |
| #125 | 2026-07-10 | Bug Fix / Optimization | Broadened match_cache.py to select all non-ignored papers. Implemented pre-loop O(1) directory listing sets check for existing files in raw/ and project-specific repo/[project_folder]/ folders, preventing disk bottlenecks. Added self-healing updates for mismatched database paths/statuses and reset missing papers to 'MISSING' to allow matching. | PDF Cache Matcher O(1) Search & Self-Healing |
| #126 | 2026-07-10 | Bug Fix | Fixed missing paper details (Authors, Year, Publisher, Source, DOI, PDF URL) and local PDF path in Calibration Adjudication discrepancies, enabling proper rendering of metadata and correct loading of local PDFs in the Adjudication Workspace modal. | Adjudication Discrepancies Details & PDF Fix |
| #127 | 2026-07-10 | Bug Fix | Enhanced Calibration Adjudication modal details loading by immediately calling `refreshPaperDetails()` on mount to pull the complete paper record from the backend, adding case-insensitive fallback logic for discrepancy keys, and auto-switching the preview tab to `pdf` if a local path is resolved. | Adjudication Details Hydration & Casing Robustness Fix |
| #128 | 2026-07-10 | UI/UX Improvement | Reordered Left Pane tabs in Calibration Adjudication modal to put 'Abstract & Details' first and 'PDF Preview' second, converted tab panels to use display-toggle rendering for PDF preview state persistence (preventing reloading), and moved the Next/Prev navigation buttons from the header to the footer beside the commit buttons. | Adjudication Navigation Relocation & Persistent PDF Preview |
| #130 | 2026-07-11 | Feature / Refactor | Migrated slr-ide LLM service completely to Google Gemini Interactions API (`google-genai>=2.3.0`). Implemented client-side and server-side encrypted vault storing credentials in SQLite `api_key_vault` using AES-256-GCM + PBKDF2. Added immutable audit logging (`llm_audit_log` table) and dynamic pricing sync. Created a unified 4-tab settings dashboard (Vault, Prompt Library with JSON Schema editor, Operations console, and Audit log) complete with security lock screen and live streaming logs. | Gemini Interactions API & Key Vault Integration |
| #131 | 2026-07-11 | Feature | Implemented Phase 2 multi-turn interaction chaining. Modified `screening.py`, `fulltext.py`, and `extraction.py` to accept previous interaction ID. Updated `queue.py` to query chronological logs, trace parent interaction pointer references, and execute iterative refinement runs. Added chronologically ordered interaction chain timeline visualizer inside `LLMAuditLogView.tsx`. | Phase 2 Stateful Multi-Turn Chaining & Audit visualizer |
| #132 | 2026-07-11 | Bug Fix / Cleanup | Performed code cleanup and tree shaking. Removed legacy `LLMOperationsCenter.tsx` and unused imports. Rewrote `LLMConfigView.tsx` to support only Gemini models and fixed dropdown selection bug. Updated `PromptLibraryView.tsx` to edit structured output schemas with JSON validation. Fixed signature mismatch in `test_budget.py` and configuration key mismatch in `main.py`. Mapped optional QA scores and extracted data to write directly into `reviewer_decisions`. Fixed a database query error in `db.ts` by escaping double-quoted `"now"` to single-quotes `'now'` in vault write queries. | LLM cleanup, bug fixes, & tree shaking |
| #133 | 2026-07-11 | Feature | Renamed `queue.py` to `queue_handler.py` to resolve circular imports. Implemented Phase 3 Advanced Pipeline Controls, allowing range/limit executions, prompt overrides, auto-reconnections on reload, database checkboxes, and BroadcastChannel multi-tab state sync. | Phase 3 Advanced Pipeline Controls & Multi-Tab Sync |
| #134 | 2026-07-11 | UI/UX Improvement | Refactored Prompt Library edit form into a 3-tab layout (General & System, Prompt Template, JSON Schema) to optimize typing space. Added dynamic Jinja2 guidelines, a collapsible help panel (updated placeholders to match columns in papers table, changing PDF_URL to PDF_Link and removing Keywords), a format button, and integrated the `@uiw/react-json-view` library for rendering collapsible JSON syntax trees in audit logs. | Tabbed Prompt Editor, Jinja2 Help, Schema Assistant & UIW JSON Viewer |
| #135 | 2026-07-11 | Feature | Built a premium Launch Confirmation Modal overlay in LLM Operations Center to display a comprehensive validation plan (stage taxonomy, model, selection range, credentials validation) and full scrollable text previews of System Instruction, User Template, and JSON output schema prior to starting runs. | Launch Stage Confirmation Modal & Verification Plan |
| #136 | 2026-07-11 | Feature / Refactor | Relocated LLM Model configuration from Project Settings into Prompt Library to tie each template to its own Gemini model, temperature, max tokens, top P, top K, and execution speed mode. Renamed the settings tab to "Budget Settings" (rendering only the budget limit). Removed global "LLM Engine" tab from general setup SettingsModal. Deleted obsolete default templates (Chain of Thought, Default Screen) from db-init.ts and cleared them from database on startup. Seeded only active Gemini models (gemini-2.5-flash, gemini-2.5-pro, gemini-1.5-pro) and dynamically filtered them in dropdown list. Verified clean compiler build. | LLM Configuration Relocation & Seeding Cleanup |
| #137 | 2026-07-11 | Feature | Replaced hardcoded pricing refresh with dynamic API model fetching. Implemented `sync_all_models_from_api` in `budget.py` to query `client.client.models.list()`, filter for active Gemini models (excluding tuning/embed/exp/discontinued models), and insert them dynamically. Tied the "Refresh Prices" settings button to run this flow. | Dynamic API Model Sync & Pricing |
| #138 | 2026-07-11 | Bug Fix / UX | Fixed locked vault session bug by global caching the master password on `globalThis` in `session.ts`, ensuring it is shared across all API routes. Wrapped the Vault password screen in a standard `<form>` tag inside `GlobalLLMSettingsView.tsx` to support the Enter key for quick unlocking. | Global Session Persistence & Enter Key Unlock |
| #139 | 2026-07-11 | Feature | Added official pricing lookup mapping for Gemini 3 series models (`gemini-3.1-flash-lite`, `gemini-3-flash-preview`, `gemini-3.1-pro-preview`) inside the database model syncing and fallback resolution methods in `budget.py`. This ensures cost tracking and project budget safety calculations correspond precisely to official Google pricing tables. | Gemini 3 Pricing Matrix Integration |
| #140 | 2026-07-11 | Feature | Implemented manual pricing override capability. Added a PUT endpoint to `/api/llm/pricing` to modify input and output rates for individual models. Modified the frontend pricing table inside `GlobalLLMSettingsView.tsx` to support inline editing, input validation, and saving custom rates directly back to the database cache. | Manual Pricing Overrides |
| #141 | 2026-07-11 | Bug Fix | Fixed `create() got unexpected keyword argument(s): config` error. The `GeminiNextGenInteractions.create()` API does not accept a `config=` wrapper. Rewrote `client.py` to pass all params as flat `**body` kwargs. Mapped `speed_mode=FLEX` → `service_tier="FLEX_TIER_1"`, moved `system_instruction`/`store`/`previous_interaction_id` to top-level, and `response_format` for JSON schema at the top-level. | Interactions API Flat-Kwargs Fix |
| #142 | 2026-07-11 | Bug Fix | Fixed Pydantic validation errors in fast filter pipeline caused by passing a list of plain strings as `input`. The Interactions API `input` field requires either a plain `str` (text-only) or a list of typed `ContentParam` dicts with a `type` discriminator field. Rewrote `client.py` to use `input_payload = user_prompt` for text-only and `[{"type":"document","uri":...},{"type":"text","text":...}]` for multimodal PDF interactions. | Interactions input ContentParam Fix |
| #143 | 2026-07-11 | Feature / Bug Fix | Implemented Stage Progress tracking and screening decision overrides. Modified database column default and added a self-healing migration to clean legacy values. Added decision override select dropdowns inline to the database grid, bulk override action controls, and screening decision pre-filtering. Corrected SSE log parser to prevent log levels from overwriting job execution state and rescue plain text log entries. Integrated template safety checks to disable execution when placeholders are missing. | Stage Tracking, Overrides, Telemetry Correctness & Safety Checks |
| #144 | 2026-07-11 | Bug Fix | Resolved a race condition where the active job check immediately set jobStatus back to IDLE when launching execution. Implemented immediate pre-spawning database writes in Next.js to register starting status before child process starts. Added a request_delay input tuning field in Prompt Library configs to sleep between API calls and prevent 429 Too Many Requests errors. | Telemetry Race Condition & Request Delay Throttling |
| #145 | 2026-07-11 | Bug Fix | Built a robust `safe_json_loads` decoder helper in `client.py` utilizing `strict=False` and automatic block/closure repairs to prevent unescaped control character JSON parse errors. Refactored the token extraction flow to pull usage statistics from the `.usage` property (which stores total input/output/thought tokens in Interactions API responses) instead of the missing `.usage_metadata` object, restoring costs and token metrics in the Operations console and Audit Trail. | JSON Parsing Robustness & Telemetry Token Extraction Fix |
| #146 | 2026-07-11 | Bug Fix | Formatted `response_format` payload inside `client.py` to match the Speakeasy `ResponseFormat` schema, nesting custom schemas under the `"text"` modality block under key `"schema"`. Added polling loop logic using `wait_for_file_active` helper in `fulltext.py` and `extraction.py` to check uploaded files until state is `"ACTIVE"`. Fixed a startup database initialization bug in `db-init.ts` that unconditionally deleted all rows from the `llm_pricing` table on startup, resetting all custom pricing rates. | Interactions & Files API Compliance, Pricing Seed Protection |
| #147 | 2026-07-11 | Bug Fix | Cleared `GOOGLE_API_KEY` environment variable in `client.py` and `main.py` if present, resolving a key pollution bug where the google-genai SDK silently prioritized an invalid/empty system `GOOGLE_API_KEY` over the correct vault-decrypted `GEMINI_API_KEY`, causing child processes to exit with code 1 due to 400 Bad Request API Key Invalid errors. | Google API Key Environment Pollution Bug Fix |
| #148 | 2026-07-11 | Bug Fix | Fixed a bug where prompt configuration options `max_tokens` (or `max_output_tokens`) and `temperature` loaded from database configs were completely ignored in screening, full-text screening, and data extraction helper runs (defaulting to 2000 and 0.0). Passed them dynamically from `main.py` and `queue_handler.py` down to the respective run modules. | Pipeline Custom Max Tokens & Temperature Propagation Fix |
| #149 | 2026-07-11 | Bug Fix | Extended pipeline config propagation to include `top_p` and `top_k` values. Updated `main.py`, `queue_handler.py`, `screening.py`, `fulltext.py`, and `extraction.py` to accept and pass them down, and updated the `client.py` interaction body to dynamically append `top_p` and `top_k` to the `generation_config` payload if configured. | Pipeline top_p and top_k Parameter Propagation Fix |
| #150 | 2026-07-11 | UI/UX Improvement | Updated `LLMAuditLogView.tsx` to render detailed token breakdown statistics. Displays explicit Input, Thinking, Output, and Cached token counts in the expanded detail grid, and displays interactive tooltips and inline labels inside the main table's token column. | Audit Trail Token Breakdown UI |
| #151 | 2026-07-11 | UI/UX Improvement | Improved the background and text color contrast for raw Prompt and Error Response panels inside the Audit Trail's Conversation Interaction Chain component, using standard monospace typography and subtle borders. | Interaction Chain Text Area Styling Fix |
| #152 | 2026-07-11 | UI/UX Improvement | Fixed light theme readability in Audit Trail's Conversation Interaction Chain text panels. Applied responsive theme-specific utility classes (`bg-secondary/40 dark:bg-black/45` and `bg-red-500/10 dark:bg-red-950/35`) to prevent low-contrast text. | Interaction Chain Light Theme Contrast Fix |
| #153 | 2026-07-11 | UI/UX Improvement | Fixed light theme contrast issues for the main expanded row text panels (Hydrated Prompt and Execution Error boxes) in `LLMAuditLogView.tsx` by applying theme-safe classes (`bg-secondary/40 dark:bg-black/45` and `bg-red-500/10 dark:bg-red-950/35`) and high-contrast text settings. | Expanded Row Light Theme Contrast Fix |
| #154 | 2026-07-11 | Feature | Added bulk pipeline stage change operation to the Paper Database view, removed the Decision & Override column from the main table, and relocated the decision override select field to the 'Edit Paper Details' modal. Included read-only status and decision override details in the read-only Paper Details modal, and added AI decisions subqueries to the GET paper by ID route. | Bulk Stage & Decision Relocation |
| #155 | 2026-07-11 | UI/UX Improvement | Restructured the Paper Database search & actions toolbar, grouping Search, Ingestion Hub, and Export CSV to the left, while aligning filters, duplicates, bulk actions, and delete controls to the right. Combined separate filter selectors into a unified Type & Value dropdown pair, and combined decision/stage bulk controls into a unified dynamic Action Type & Value selector. | Combined Filters & Bulk Action Restructuring |
| #156 | 2026-07-11 | UI/UX Improvement | Integrated modal-less window confirmation prompts inside bulk override and bulk stage change execution flows to prevent accidental bulk modifications. | Bulk Confirmation Safeguard |
| #157 | 2026-07-11 | Bug Fix | Implemented backend session key vault locking and frontend auto-lock on decryption failure (returning 401 on decryption errors to auto-relock the settings UI and prompt the user for password re-entry). Also added auto-locking when background subprocesses/child processes fail (non-zero exits) to force re-authentication. | Vault Auto-Locking on Decrypt Fail |
| #158 | 2026-07-11 | Bug Fix | Fixed missing `execute_read` import in `budget.py` causing pricing refresh crash. Muted sensitive/noisy `httpx` HTTP Request logger outputs in `main.py`, and introduced `sanitizeApiKey` utility in Next.js to redact Gemini API keys (`AIzaSy...`) from all system logs, stderr/stdout, and response errors. | Mute httpx Logs & Redact API Key |
| #159 | 2026-07-11 | Bug Fix | Fixed the "Run LLM Pipeline" bulk action button in the Paper Database view by forwarding `preSelectedPaperIds` and `setPreSelectedPaperIds` props to the `PipelineExecutionView` component, passing them to `GlobalLLMSettingsView`, and automatically switching the active execution tab to 'llm' when preselected paper IDs are present. | Forward Pre-selected Papers & Tab Selection Fix |
| #160 | 2026-07-11 | Bug Fix / UI | Fixed selection clearing when routing from paper database to LLM settings by preserving `preSelectedPaperIds` on tab changes. Renamed "Pre-selected Papers" to "Manual Select" across the selection mode dropdown options and execution preview panels. | Preserved Checkbox Selection & Mode Renaming |
| #161 | 2026-07-11 | Feature | Integrated Gemma model variants into the LLM pricing cache and Gemini model options. Updated `resolve_model_prices` and api sync filter logic in `budget.py` to allow and price Gemma models (seeding `gemma-2-27b-it` at $0.00 in `db-init.ts`). Included `gemma-2-27b-it` option in the select dropdown fallbacks and dynamically resolved the model identifier from the selected template in the Confirm Execution verification panel instead of showing hardcoded defaults. | Gemma Model & Dynamic Confirmation Panel Fix |
| #162 | 2026-07-11 | Feature | Added Default Stage Prompts & Schema Key Mapping to Project Settings, allowing mapping of prompt templates and custom JSON schema output keys (`decision`, `exclusion_trigger`, `rationale`) to database columns. Removed the manual template selector dropdown from the Operations Center, updated `/api/llm/screen` to resolve default templates from project config, updated the python queue engine (`main.py`, `queue_handler.py`, `screening.py`, `fulltext.py`) to parse nested output fields matching the custom paths using dot notation, and updated the execution launch validation / confirmation views. | Project Default Stage Prompts & Custom Schema Mapping |
| #163 | 2026-07-11 | UI/UX Improvement | Added schema-aware autocomplete dropdowns to the key path mapping fields (Decision, Exclusion Trigger, Rationale) in the Project Settings Prompts tab. When a stage's default prompt template has a Structured Output JSON Schema, the inputs are replaced with dropdown selectors populated by recursively extracted dot-notation paths. A "Manual" toggle button is available per-field to switch to free text entry when needed, and existing custom values are preserved as a `(Custom)` option if they do not match parsed paths. | Schema-Driven Key Path Autocomplete |
| #164 | 2026-07-11 | Bug Fix | Fixed `Confirm Execution — Step 1: Targets` showing wrong model and speed tier. Both were reading non-existent top-level `model_id` / `execution_mode` columns from the prompt object instead of parsing them from the `llm_config` JSON blob. Introduced `templateConfig` parsed from `activeTemplate.llm_config` and derived `activeModel` and `activeExecutionMode` from it. | Confirm Execution Panel Model/Tier Mismatch Fix |
| #165 | 2026-07-11 | Bug Fix | Fixed two bugs: (1) Gemma model calls failing with `400 invalid_request` because Gemma does not support Interactions API parameters (`store`, `service_tier`, `response_format`, `previous_interaction_id`). Refactored `python_engine/llm/client.py` to detect Gemma model prefixes and route through `client.models.generate_content()` with `GenerateContentConfig` instead. Structured output for Gemma uses `response_mime_type` + `response_schema` config keys. (2) Fixed all Python log lines (INFO, WARNING) appearing with `ERROR:` prefix in the Execution Logs panel because Node.js was blindly labelling all stderr output as errors. Python's `logging` module routes all levels to stderr by default; the fix passes lines through as-is in `llm-operations.ts`. | Gemma API Compatibility & Execution Log Level Fix |
| #166 | 2026-07-11 | Bug Fix | Fixed LLM pipeline contaminating the `reviewer_decisions` inter-rater table. When `fast_filter` (or any screening task) executed on a calibration pool paper (`pool_a`, `pool_b`, `pool_c`), it performed an `INSERT OR REPLACE` into `reviewer_decisions` using `self.model_id` as `reviewer_name`. This created a phantom third rater in the pool, breaking the `HAVING COUNT(DISTINCT reviewer_name) = 2` join filter in the adjudication stats API, collapsing the paired intersection to 0 and producing a Cohen's Kappa of 0 ("Poor"). The fix adds an `is_calibration_paper` guard in `queue_handler.py`: calibration papers now write the AI decision exclusively to `papers.Human_Decision / Human_EC_Trigger / Human_Rationale`, while non-calibration papers continue to write to `reviewer_decisions`. | LLM Pipeline Inter-Rater Table Contamination Fix |
| #167 | 2026-07-11 | Bug Fix | Fixed JSON schema resolution and AI decision mapping issues. Expanded fallback parsing in `screening.py` and `fulltext.py` with alias lookups (e.g. `primary_exclusion_criterion`, `exclusion_summary`) to correctly extract decisions even if the LLM output deviates from the exact JSON schema keys. Updated GET papers routes to use `COALESCE` to route `AI_Decision` to `papers.Human_Decision` when no `reviewer_decisions` records exist for calibration papers, while exposing `reviewer_decisions_exist` to preserve the visual distinction of manual overrides. Handled case-insensitive styling mappings inside the `PaperMetadataView.tsx` component. | Fallback Schema Resolution & AI Decision Mapping Fixes |
| #168 | 2026-07-11 | Bug Fix | Fixed legacy interaction chaining schema mismatch. Modified `queue_handler.py` to ensure `previous_interaction_id` is only resolved and passed to the Interactions API if the previous interaction in `llm_audit_log` matches the current `response_schema_name`. This stops the model from inheriting legacy chat conversation history that forces output using old, legacy JSON schema layouts. | Legacy Chaining Schema Mismatch Fix |
| #169 | 2026-07-11 | Feature | Added "Enable Chaining" interaction checkbox config to the Edit Prompt Template interface. Persisted `interaction_chaining` inside the template's `llm_config` column, and refactored the Python pipeline script (`main.py`, `queue_handler.py`) to parse, accept, and conditionalize interaction chaining lookups based on the user-selected configuration. | Prompt Template Interaction Chaining Config Toggle |
| #170 | 2026-07-11 | Bug Fix | Fixed Gemini Interactions API structured output schema serialization. The `google-genai` SDK utilizes the `schema_` parameter (with a trailing underscore) within `response_format` to prevent collisions with the Python keyword, and requires a flat `ResponseFormatParam` layout (rather than nested under a `text` object). Also added `response_mime_type: 'application/json'` to the top-level request body as required by the API spec when response formats are specified. This forces standard JSON output conforming exactly to the user-supplied schema. | Structured Output Schema API Fix |
| #171 | 2026-07-12 | Bug Fix | Implemented snake_case serialization workaround via `extra_body` for the Gemini Interactions API. The Speakeasy-generated python SDK contains a bug where it serializes `response_format` directly as snake_case in the JSON body, but nested fields are mapped incorrectly during SDK-internal type conversion. By bypassing default serialization and declaring `"response_format"` (containing snake_case `"type"`, `"mime_type"`, and `"schema"`) inside `extra_body`, the parameters are merged correctly and successfully accepted by the gateway. | Interactions API extra_body Serialization Workaround |
| #172 | 2026-07-12 | Database | Implemented dedicated AI decision, trigger, and rationale columns in the `papers` table (`AI_Decision`, `AI_EC_Trigger`, `AI_Rationale`, `AI_QA_Scores`, `AI_Extracted_Data`). Updated the LLM screening queue handler (`queue_handler.py`) to write all pipeline results to these fields for both calibration and regular papers. This keeps the `reviewer_decisions` table 100% human-only, preserving blinded inter-rater statistics and Cohen's Kappa. Reverted complex API route query mappings, selecting the AI decisions directly from the `papers` table. | Dedicated AI Schema Columns & Inter-Rater Separation |
| #173 | 2026-07-12 | Feature | Added automated paper status update before starting the Data Acquisition batch pipeline. Automatically transitions papers with a pipeline stage > 0 and Local PDF Status `IGNORED` (or `Ignored`) to `MISSING` if they have a non-empty DOI. Added `broadcastSync('SYNC_PAPERS')` broadcast on the client to re-fetch and sync the updated paper status across active tabs. | Automatic Ignored to Missing Conversion |
| #174 | 2026-07-12 | Bug Fix / Reliability | Implemented `_robust_click` helper in `navigator.py` to ensure reliable clicking in academic publisher crawler handlers. The helper centers the viewport, attempts standard clicks, and falls back to JavaScript click execution if the element is obscured or intercepted. Refactored `_handle_ieee`, `_handle_acm`, and `_handle_acta_hort` to use the helper. | Robust Element Clicking in Crawler |
| #175 | 2026-07-12 | Feature | Added new bulk Local PDF Status change operation to the Paper Database view. Users can now select multiple papers and change their Local PDF Status value (IGNORED, MISSING, MATCHED, DOWNLOADED, SYNCED) in a single atomic transaction. | Bulk Local PDF Status Update |
| #176 | 2026-07-12 | Feature | Updated pre-acquisition pipeline status conversion to only change papers from IGNORED to MISSING if their screening decision is 'Include' (evaluated case-insensitively using `UPPER(COALESCE(Human_Decision, AI_Decision))`). | Pre-Acquisition Include Screening Filter |
| #177 | 2026-07-12 | Feature | Implemented Manual Screening Pipeline tab workspace inside the Pipeline Execution Command Center. Added 6 new columns to the `papers` table (`manual_decision`, `manual_ec_trigger`, `manual_rationale`, `manual_stage`, `manual_qa_scores`, and `manual_extracted_data`) with self-healing migrations. Created paginated listing endpoints, custom hooks, and layout components implementing dual search panels, vector search caching, inline PDF viewing, QA criteria scoring checklists, and calibration review data copy tools. | Manual Screening Pipeline Workspace |
| #178 | 2026-07-12 | Feature | Implemented high-performance local screening state overrides in the Manual Screening Pipeline, allowing users to forcefully overwrite AI-generated decisions and rationales. Added a sync-toggle to enable/disable automated AI-writebacks during manual review, preserving manual inputs in the new `manual_*` column set for audit accountability. | Manual Override & Audit Accountability |
| #179 | 2026-07-12 | Feature | Added Reverse Import (Purge Mode) feature to Ingestion Hub allowing database cleanup of non-existence papers based on incoming CSV. Automatically blocks deletion of papers in the inter-rater pool and triggers warnings for already processed manual/AI screening papers. Performs cascade duplicate record removal and unlinks project-scoped PDFs while leaving the raw eternal library untouched. | Ingestion Hub Purge Mode |
| #180 | 2026-07-12 | Feature | Added "Copy Both Details" button to the Duplicate Review modal header, enabling users to copy metadata (Title, DOI, Abstract) of both candidate duplicate papers formatted side-by-side to the clipboard. | Duplicate Review Copy Details Button |
| #181 | 2026-07-12 | Feature | Implemented Distributed Remote Worker PDF Scraper pipeline. Designed a zero-dependency standalone monolithic python script (`worker_server.py`) with embedded browser/navigator scraping logic and REST APIs for remote node execution. Created the `remote_workers` tracking table and a local centralized orchestrator service (`remote-worker-manager.ts`) featuring background heartbeat loops to reclaim stuck batches. Added dynamic config controls for worker batch sizes and local execution scaling. Intercepted the background pipeline executor to seamlessly distribute the scraping load across authorized paired nodes. | Distributed Remote Worker Architecture |
| #182 | 2026-07-14 | Feature | Implemented a dynamic Exclusion Criteria (EC) filter in the Paper Database View. Unique exclusion codes are queried dynamically from the database using a UNION of AI_EC_Trigger, Human_EC_Trigger, and manual_ec_trigger columns to capture all codes (including malformed ones like `FATAL_FLAW_QA4`). Added `editHumanEcTrigger` and `editHumanRationale` input states inside the paper details modal (`ViewEditPaperModal` / `PaperMetadataEdit`) to allow manual override corrections of exclusion code mismatches. | Dynamic Exclusion Criteria Filter & Rater Corrections |
| #183 | 2026-07-14 | Refactor | Removed the Batch PDF Pipeline Execution panel completely from the Paper Database tab. Decoupled and removed pipeline props and execution checks from `PaperDatabaseView.tsx` and updated `page.tsx` to pass cleaner properties. Pipeline execution progress is now tracked exclusively in the dedicated Pipeline Execution tab. | Remove Batch Pipeline Execution Panel from Database View |
| #184 | 2026-07-14 | Feature | Aligned calibration papers pipeline stage Status watermarks with their target pools. Updated inter-rater imports and adjudication routes to set Status = '1' (Stage 1) for pool_a, Status = '2' (Stage 2) for pool_b, and Status = '4' (Stage 4) for pool_c. Executed a one-off database repair query to update 30 pool_b papers and 20 pool_c papers, resolving dashboard metric stage mismatches. | Align Calibration Pool Stage Statuses |
| #185 | 2026-07-14 | Feature | Standardized Pool C quality appraisal exclusions to output comma-separated lists of `QA-X` codes (e.g. `QA-1, QA-4`) and `QA-CUMULATIVE`. Updated the distinct code parser in the papers API route to split multiple values and updated query matching to execute boundary-safe SQL searches. Ran a one-off migration script to update existing `FATAL_FLAW_QA4` and `CUMULATIVE` codes in the database. | Standardize QA Exclusion Codes & Safe SQL Filtering |
| #186 | 2026-07-14 | Feature | Implemented AI decision equalizing. When papers advance to Stage 2 (Gatekeeper) or Stage 3/4 (Appraisal), the old screening-stage `AI_Decision` is cleared (set to NULL) if the corresponding LLM job for that stage has not been executed yet. Added logic to inter-rater imports and adjudication routes, and ran a database repair script clearing 50 legacy screening decisions on advanced papers. | Equalize AI Decisions Based on Stage |
| #187 | 2026-07-14 | Refactor | Isolated calibration/inter-rater papers into a dedicated `calibration_papers` table to keep the main systematic literature review (SLR) corpus metrics and metadata 100% clean. Updated database initialization schema, single paper updates (clones assigned papers to `calibration_papers` and resets them in `papers`), inter-rater API routes, and projects count queries. Modified Python LLM engine (`main.py` and `queue_handler.py`) to query a UNION of both tables and dynamically target updates. | Dedicated Calibration Table & Sandboxed Inter-Rater Environment |
| #188 | 2026-07-15 | Feature | Implemented new "Verify PDF Integrity" pipeline step in Data Acquisition Pipeline. Audits MATCHED, DOWNLOADED, and SYNCED PDFs against a multi-step check (file size, valid PDF header, content poisoning redirect/DOI stub phrases, page count, and fuzzy title matching using the FUZZY_MATCH_THRESHOLD from configs). Adds configurable "Minimum PDF File Size" setting to Scraper Settings. Downgrades failed PDFs to needs review status. | PDF Verification Step |
| #189 | 2026-07-15 | Feature | Enhanced Paper Details modal with static ID snapshots and Prev / Next navigation buttons. Disables the "Save Changes" button if no edits are detected. Successful saves update the modal state in-place to preserve edit mode rather than closing. | Paper Details Navigation & Edit Enhancements |
| #190 | 2026-07-15 | Feature | Integrated Verification checks directly into local and remote PDF scraping pipelines. Added checking constraints to skip empty/invalid DOIs in `scrape_pdfs.py`, and run every newly downloaded file through `verify_paper_pdf` checks. Spawns verification checks synchronously in remote worker result route before registration. | Integrated Scraper Verification Gate |
| #191 | 2026-07-12 | Feature | Added "DOI Status" filter option to the Paper Database view's Advanced Filters. Enables users to filter papers by Any DOI, Empty DOI (where DOI is empty or null), or Has DOI (where DOI has a value). Integration covers the papers REST API, custom hooks, and view components. | Empty DOI Filter |
| #192 | 2026-07-15 | Bug Fix / Refactor | Removed Human_Decision and double-blind calibration adjudication tables references from normal screening pipelines, general database views, and API filter logic. Relocated the editable decision override from the Paper details modal (which updated Human_Decision) and made the manual screening decision (manual_decision) read-only inside details modals instead. Updated bulk decision overrides in PaperDatabaseView.tsx and `/api/papers` to write to `manual_decision` instead of `Human_Decision`. Appended workspace agent rules (`agents.md`, `slr-ide/AGENTS.md`) to explicitly sandbox the calibration adjudication module. | Isolate Adjudication and Clean up Human Override |
| #193 | 2026-07-15 | Bug Fix | Resolved selected checkmarked papers count discrepancy in the LLM Settings launch configuration. Updated `/api/llm/count` API and `GlobalLLMSettingsView.tsx` count loading hook to parse and process checking checkmarked `paperIds`. The selection count display now properly shows both the total selected checkmarks and the count of actually eligible papers matching stage and manual screening exclusions. | Selected Papers Target Count Filtering |
| #194 | 2026-07-15 | Refactor | Decoupled all screening-related filters (Pipeline Stage, Screening Decision, Exclusion Criteria) and bulk operations (Decision Override, Pipeline Stage Change) from the general Paper Database table, focusing it strictly on paper standard metadata and PDF/DOI metrics. Locked down the single paper PUT API and Paper Metadata Edit modal to make the Pipeline Stage field read-only, preventing edits to screening stages outside the dedicated LLM and Manual screening pipelines. | Decouple Screening Logic from Paper Database |
| #195 | 2026-07-16 | Bug Fix | Updated the PDF deletion REST API (/api/pdf/delete) to completely delete PDF files from all locations (raw folder, downloads folder, and repo folder) when manually unlinking via the "Delete PDF" button to prevent self-healing matching loops. Added Agnostic BroadcastChannel sync call on successful deletion to update all open UI tabs. | Complete PDF Deletion & Sync |
| #196 | 2026-07-16 | Bug Fix / UI | Fixed navigation controls bugs in ViewEditPaperModal.tsx (e.g. index/disabled limits relying on active papers list length instead of the snapshot length). Relocated paging controls to the center of the Modal Footer, between the Delete button (left) and Action buttons (right). Introduced a guard on dbValuesChanged to prevent the false positive "Form refreshed" toast on saving edited papers. | Paging Fixes, Footer Center Relocation & Save Rehydration Guard |
| #197 | 2026-07-16 | Feature | Added a new "PDF Link" filter option to the Paper Database view's Advanced Filters. Enables users to filter papers by Any State, Has PDF Link (where PDF_Link has a value), or Empty (where PDF_Link is empty or null). | PDF Link Filter |
| #198 | 2026-07-16 | Feature | Added 'NEEDS_REVIEW' option to the bulk Local PDF Status selection dropdown, permitting bulk transitions of papers to needs review state. | Bulk PDF Status NEEDS_REVIEW Option |
| #199 | 2026-07-16 | Feature | Added a new bulk action "Delete PDFs & Unset Links" in the Paper Database view. Designed the backend DELETE /api/pdf/delete route to support bulk inputs with a keepRaw query/body flag: single paper deletion continues to delete PDF files from all locations (raw, repo, and downloads folders) and unsets URL link, while the bulk deletion deletes PDF files only from the project repo folder (keeping raw folder untouched) and unsets URL links. | Bulk PDF Deletion & Link Unsetting |
| #200 | 2026-07-16 | Bug Fix | Resolved a rehydration and multi-tab synchronization bug in the "Assign Papers to Calibration Pools" workspace. Subscribed to BroadcastChannel events (`SYNC_PAPERS`, `SYNC_PROJECTS`) using mutable refs in `useCalibration.ts` to refresh active pool and assignment lists without capturing stale closures. Added `broadcastSync` trigger to the pool assignment action to keep other tabs updated. Implemented a rehydration guard for the notes input textarea in `AssignDetailView.tsx` using `useRef` to preserve user drafts during background rehydration. | Calibration Pool Sync & Rehydration Guard |
| #201 | 2026-07-16 | Bug Fix / Perf | Resolved SQLite database lock contention and browser concurrent connection limits (maximum 6 connections) when running "Batch PDF Pipeline Execution". Configured all Python SQLite entrypoint connections explicitly with WAL mode (`PRAGMA journal_mode=WAL`) and a timeout of 30.0 seconds. Implemented Page Visibility API stream management in `usePipeline.ts` to automatically disconnect persistent stream connections in background tabs and reconnect them only when visible. | Database Contention & visibility Stream optimizations |
| #202 | 2026-07-16 | Bug Fix / UI | Disabled single paper PDF acquisition in the calibration details view when the main batch execution pipeline is active. Added a warning message warning the user about the active pipeline to prevent database conflicts and browser thread locks. | Single PDF Acquisition Active Pipeline Guard |
| #203 | 2026-07-16 | Feature / UI | Added read-only "Decision State" (manual_decision) field to the Paper Metadata Edit modal and displayed the read-only decision status in the Paper Details modal under System State. | Paper Details Decision State Field |
| #204 | 2026-07-16 | Bug Fix | Resolved the discrepancy between Stage 1 Included and Stage 2 Total metrics by defining Stage 2 Total as Stage 1 Included and partitioning unprocessed Stage 2 papers into active (ready with PDF) and pending PDF states. | Resolved Stage 2 Dashboard Metrics Mismatch |
| #205 | 2026-07-17 | Feature / Reliability | Excluded duplicate papers (`is_duplicate = 1`) globally from LLM operations, crawler execution, PDF matching, verification, compression, remote worker claiming, and calibration pool assignments. | Exclude Duplicate Papers from All Pipelines |
| #206 | 2026-07-19 | Feature | Added dynamic PDF compression font settings (`PDF_COMPRESSION_EMBED_ALL_FONTS` and `PDF_COMPRESSION_SUBSET_FONTS`) to the Settings dashboard. Exposed new checkbox controls in the Scraper Settings panel to toggle font embedding and subsetting, which are passed dynamically as arguments to the Ghostscript executable command. | Customizable Ghostscript Font Embedding & Subsetting |
| #207 | 2026-07-19 | Bug Fix | Fixed the Force Update (Overwrite) flag check/uncheck bug in the Data Acquisition Pipeline. Propagated the `force_update` flag in the fetch POST body, registered `forceUpdate` in the global batch state tracker, and included it in stream restore messages to prevent the checkbox from being cleared during run initialization. | Force Update Pipeline Flag Propagation Fix |
| #208 | 2026-07-19 | Bug Fix | Fixed a PDF compression bug where Ghostscript truncated files in-place to 2.49 KB when the database path already pointed to the project repo folder. Prioritized reading source PDFs from the raw uncompressed folder, implemented temporary file compression with validated renames, and added an automated self-healing integrity check to detect and re-process existing corrupted PDFs. | Ghostscript In-Place Truncation & Self-Healing Fix |
| #209 | 2026-07-22 | Feature | Added `scopus_search_string` field to project SQLite schema and auto-migration script. Added a dedicated full-width `textarea` input under Project Settings -> Metadata (`ProjectMetadataSettings.tsx`, `useProjectForm.ts`, `ProjectSettingsModal.tsx`). Included `scopus_search_string` in the exported `.slr-viewer` dataset payload (`/api/export/slr-viewer/route.ts`). | Add Scopus Search String to Project Metadata & Export |
| #210 | 2026-07-27 | Bug Fix / Performance | Fixed Turbovec semantic search initial cold-start lag by eager pre-warming vector daemon on modal initialization, optimized allowlist filtering using Python set operations for sub-100ms vector searches, fixed semantic search pagination cap by setting default k=1000 across python CLI entrypoints (`semantic_search.py`, `find_traps.py`, `vector_worker.py`) and invalidating legacy <100 item cache records, and enriched vector search metadata queries to persistently sync Quick Actions pool assignment button states. | Turbovec Daemon Eager Pre-Warming, Semantic Search k=1000 Pagination & Quick Actions Pool Sync |
| #212 | 2026-07-31 | Feature | Enhanced JSON Output Schema Key Path Mappers across all 4 pipeline stages (`fast_filter`, `gatekeeper`, `scientist`, `miner`) in `GlobalLLMSettingsView.tsx` with dynamic property key path dropdowns. Implemented `extractSchemaKeyPaths` to parse top-level and nested JSON schema property keys from the selected prompt template's `response_schema`, populated key selection `<select>` dropdowns, and provided a `Custom Key Path...` fallback option that unlocks direct text input. | Dynamic Prompt Schema Key Path Dropdowns |
| #213 | 2026-07-31 | Feature / Refactor | Removed unused Screening Rate card from Dashboard (`MetricSummaryCards.tsx`) and `ProjectManager.tsx`, re-balancing the top summary grid from 4 to 3 columns. Introduced `INACCESSIBLE` status to `Local_PDF_Status` dropdown and UI badge components. Refined PRISMA diagram calculation (`/api/insight/prisma` and `/api/export/slr-viewer`) to strictly count papers with `INACCESSIBLE` status as Reports Not Retrieved. Bumped `.slr-viewer` export payload `schema_version` to `1.1.0`. | Dashboard Screening Rate Cleanup, INACCESSIBLE PDF Status, & .slr-viewer Schema v1.1.0 Export |
| #214 | 2026-08-03 | Feature / UI | Added Fast Filter Exclusion Criteria dropdown based on Project Settings Pool A Exclusion Criteria Rules (`ec_rules`), formatted options as `[code] - [description]`, blocked saving `EXCLUDE` decisions when Pool A rules are unconfigured, and provided warning banner with one-click navigation to Project Settings (`open-project-settings` custom event). | Fast Filter Exclusion Criteria Dropdown & Enforcement |
| #215 | 2026-08-08 | Feature / UI | Replicated single paper PDF acquisition UI/UX from Calibration in Manual Screening Pipeline Workspace with real-time NDJSON stream console logging, progress tracking, cancel/resume operations, and active batch pipeline locks. | Replicate Single PDF Acquisition UI/UX |
| #216 | 2026-08-08 | Bug Fix / UI | Fixed "Run LLM Pipeline" bulk action button in Paper Database view. Updated `page.tsx` navigation callback to route directly to `pipeline-llm-operations` and added a `useEffect` synchronization hook in `GlobalLLMSettingsView.tsx` to automatically set `activeTab` to 'operations' and `paperSelectionMode` to 'selected' whenever pre-selected paper IDs are passed. | Run LLM Pipeline Bulk Action Button Navigation & Selection Sync |
| #216 | 2026-08-05 | Feature | Added `manual_search_string` field to project SQLite schema, migration fallback, and `Project` TypeScript types. Added a dedicated full-width `textarea` input under Project Settings -> Metadata (`ProjectMetadataSettings.tsx`, `useProjectForm.ts`, `ProjectSettingsModal.tsx`, `projects route.ts`). Included `manual_search_string` in the exported `.slr-viewer` dataset payload (`/api/export/slr-viewer/route.ts`). | Add Manual / Google Scholar Search String to Project Settings & Export |
| #217 | 2026-08-05 | Feature | Added "Manually Ingested & Snowballing Papers" paper selection mode option in LLM Operations Pipeline -> Operations Center for Gatekeeper, Scientist, and Miner stages. Updated Next.js count and screen API routes, Python LLM orchestrator (`main.py`), and Operations Center UI (`GlobalLLMSettingsView.tsx`) to filter papers by Manual Search, Backward Snowballing, Forward Snowballing, Manual Ingestion sources, or parent reference chains. | Manually Ingested & Snowballing Paper Selection Mode |
| #218 | 2026-08-12 | Refactor / Bug Fix | Deprecated legacy `default-project` string fallback. Implemented atomic one-time migration (`migrate-project-ids.ts`) converting all 4,169 legacy papers and project records in `slr.db` to `proj-global-predictive-dt` across all 11 project-tied tables, updated database PDF path references, and renamed the filesystem repository folder (`pdf_library/repo/global_predictive_dt`). Created high-aesthetic dark glassmorphic `ProjectLockScreenModal.tsx` rendered by `page.tsx` when zero active projects exist to enforce project creation/import before workspace usage. Updated `agents.md` Section 3.8 and API/Python CLI fallbacks. | Deprecate `default-project`, Atomic 11-Table & PDF Storage Migration, & Project Lock Screen |
| #218 | 2026-08-05 | Bug Fix / UI | Fixed inclusion/exclusion telemetry calculation in Scientist and Miner execution by dynamically resolving JSON key paths from project `schema_mappings` and prompt schemas with multi-level fallbacks in `queue_handler.py`, `extraction.py`, and `/api/llm/jobs/active/route.ts`. Updated default schema mappings for Scientist in `GlobalLLMSettingsView.tsx` (`final_evaluation.decision`, `final_evaluation.exclusion_code`). Expanded the main UI container height from fixed `520px` to responsive `flex-1 h-full min-h-[600px]`, and beautified performance telemetry cards with glassmorphism gradients, progress meters, and dynamic console layout. | Fix Scientist & Miner Telemetry Key Resolution & Beautify Operations UI |
| #219 | 2026-08-05 | Bug Fix | Fixed issue where "All Project Papers (Ignore Status)" returned 0 papers when targeting unscreened papers. Updated `GlobalLLMSettingsView.tsx` (`fetchCount` and `handleAction`) to set `effectiveDecision = 'ALL'` when `paperSelectionMode === 'all_project'`, overriding default stage decision filters (`INCLUDE`) to query all project papers regardless of decision or status. | Fix All Project Papers (Ignore Status) Decision Filter Override |
| #220 | 2026-08-05 | Bug Fix | Fixed SQL decision matching bug where decision variants (such as `INCLUDE (S2)`) were falsely rejected by exact string matching in `/api/llm/count/route.ts` and `python_engine/llm/main.py`. Updated decision CASE expressions to evaluate `LIKE 'INCLUDE%'` as `INCLUDE`, restoring correct matching counts for papers that passed prior screening stages (e.g. 19 papers passing Gatekeeper for Scientist stage execution). | Fix SQL Decision Matching for INCLUDE% Variants |
| #221 | 2026-08-05 | Root Cause Fix | Resolved root cause of Scientist telemetry misclassification where `schema_mappings.scientist.decision` was assigned to `final_evaluation.exclusion_code` (`NONE`). Added missing `exclusion_trigger` key mapper (`Exclusion Code Key Path`) for Scientist in `GlobalLLMSettingsView.tsx` with standard fallbacks (`final_evaluation.decision`, `final_evaluation.exclusion_code`, `final_evaluation.reasoning`, `qa_scores`). Added decision string validity guard (`decision.upper().startswith("INCLUDE") or decision.upper().startswith("EXCLUDE")`) in `fulltext.py`, `queue_handler.py`, and `/api/llm/jobs/active/route.ts` to prevent exclusion codes like `NONE` from being parsed as decisions. Repaired project `llm_config` in SQLite database. | Scientist Telemetry Key Misalignment & Decision Validation Guard |
| #222 | 2026-08-12 | Bug Fix / Refactor | Fixed Scientific Rigor PRISMA 2020 diagram included studies calculation in `/api/insight/prisma` and `/api/export/slr-viewer` by changing inclusion threshold from `effectiveStage >= 4 && isIncluded` to `effectiveStage >= 3 && isIncluded` (since Stage 3 Scientist is the final screening inclusion stage). Enforced strict multi-project data isolation in `/api/projects` and `/api/llm/audit` by appending `AND CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT)` to all SQL JOIN statements. Verified 100% decision schema alignment (`$.final_evaluation.decision`) across 7,235 audit log entries. | Fix PRISMA 2020 Stage Threshold & Multi-Project JOIN Scoping Isolation |
| #222 | 2026-08-07 | Bug Fix / Reliability | Fixed Database Auto-Backup execution in `slr-ide` (`backup-service.ts`). Added `hasChanged` database change detection check (`total_changes()` and `PRAGMA data_version`) to `'interval'` trigger mode so periodic auto-backups fire every `BACKUP_INTERVAL_MINS` only when new database writes have occurred (matching UI description). Added explicit `child.on('error')` handling in `runRcloneBackup()` to prevent `spawn` process errors from permanently locking `isBackupRunning = true`. Updated database configuration in `slr.db` to `BACKUP_TRIGGER = 'interval'`, `BACKUP_INTERVAL_MINS = '10'`, and `BACKUP_AUTO_ENABLED = 'true'`. Verified TypeScript build stability cleanly (`npx tsc --noEmit`). | Fix Database Auto-Backup Interval Change Check & Spawn Error Deadlock |
| #227 | 2026-08-13 | Bug Fix / Cloud Gold Mine | Fixed Cloud Gold Mine rclone configuration check bug in `slr-ide` (`/api/export/cloud-gold-mine/route.ts`). Differentiated project existence validation (404) from missing project rclone remote configuration (400 Bad Request with explicit error message). Updated rclone child process spawning to respect system `RCLONE_EXECUTABLE_PATH` and `RCLONE_CONFIG_PATH` settings. Updated preview route (`/api/export/cloud-gold-mine/preview/route.ts`) to return `missingRemoteConfig: true`, and added an `AlertCircle` warning banner in `CloudGoldMinePanel.tsx` guiding users to set up Cloud Sync in Project Settings before exporting. Verified TypeScript build (`npx tsc --noEmit`). | Fix Cloud Gold Mine Rclone Configuration Check & Preview Warning Banner |
| #228 | 2026-08-13 | Feature | Implemented custom category & macro-domain value remapping, dynamic real-data percentage calculation with manual override fallback, real-time sum validation badge with normalize/autofill to 100%, per-category slice color customization with hierarchical parent color shading, visualizer preset JSON import/export, and single-click Indoor Architecture Bias preset in VisualizerModal.tsx for Sunburst and compatible scientific charts. | Custom Category Mapping, Slice Color Customization & Visualizer Presets |
| #229 | 2026-08-13 | Feature | Implemented `✨ [Custom Grouping Layer]` choice in level selection dropdowns for multi-level charts (Sunburst, Sankey, Treemap) in `VisualizerModal.tsx`. Added inline `+ Add Custom Group` creation bar, custom group card manager, sub-item pill display, and interactive sub-item link pickers in Step 2. Updated preset export/import to persist custom group definitions. | Dedicated Custom Grouping Layer & Sub-Item Linker |
| #230 | 2026-08-13 | Feature / Bug Fix | Supported level-specific Custom Grouping panels (`levelCustomGroups`, `levelCustomGroupLinks`), conditionally rendered only when a level dropdown is set to `✨ [Custom Grouping Layer]`. Removed confusing example preset banner from Step 2. Fixed React child object crash (`{umbrella_category, justification}`) by adding `safeString()` object unwrapping. | Multi-Level Custom Grouping Panels & Taxonomy Object Unwrapping Fix |
| #231 | 2026-08-13 | Feature | Added World Coffee Research Sensory Lexicon style customization features for dense Sunburst charts in `VisualizerModal.tsx`. Implemented radial projection outer labels (`position: 'outside'`), label orientation selector (`tangential`, `radial`, `flat`), ring inner/outer radii sliders, border thickness controls, and hover emphasis focus shading (`ancestor`, `descendant`, `none`). Persisted dense chart parameters in preset JSON files. | Dense Sunburst Chart Customization & Coffee Lexicon Layout Controls |
| #232 | 2026-08-13 | Feature | Added Per-Level Sunburst Control Tabs (`sunburstLevelConfigs`) allowing full manual control over Inner Radius (`r0`), Outer Radius (`r`), Label Position (`inside`/`outside`), Orientation (`tangential`/`radial`/`flat`), Alignment (`right`/`center`/`left`), minAngle, and Border Width for Level 1, Level 2, Level 3... Added 1-click Layout Presets ("Coffee Lexicon Style", "Standard Concentric Rings", "Full Radial Burst"), slice sorting (`desc`, `asc`, `none`), and node click zoom. Ensured complete lossless export/import of chart configuration and data mapping. | Full Per-Level Sunburst Control Panel & Lossless Configuration Preset Sync |
| #233 | 2026-08-13 | Feature / Bug Fix | Added 10 top scientific journal palette theme presets (`ACS`, `PNAS`, `Oxford`, `Wiley`, `Taylor & Francis`, `PLOS ONE`, `Frontiers`, `BMC`, `MDPI`, `RSC`). Added `Show Title` and `Show Subtitle` checkboxes to enable hiding figure titles. Resolved React duplicate child key warning (`Encountered two children with the same key, 'Scopus' / 'Manual Search'`) in Breakdown Table by compounding parent name and row index into table row keys. | 10 New Journal Palettes, Title Visibility Toggles & React Duplicate Key Fix |
| #234 | 2026-08-13 | Feature / Bug Fix | Expanded Font Family select to 6 choices (`Inter`, `Times New Roman`, `Computer Modern LaTeX`, `Arial`, `Roboto`, `Fira Code Monospace`). Fixed figure title visibility hiding when `Show Title` is unchecked (`show: false`). Added per-level Label Text Color pickers (`color`), Word Wrap & Edge Overflow modes (`break`, `truncate`, `none`), and Max Label Width sliders (`40px`-`160px`) to prevent edge text cropping on radial outer labels. | 6 Publication Font Families, Title Hide Fix, Per-Level Label Color & Auto Word Wrap |
| #235 | 2026-08-13 | Bug Fix | Fixed `generateChartOption` `useCallback` missing 14 Sunburst state dependencies (`sunburstLevelConfigs`, `sunburstSort`, `sunburstNodeClick`, `sunburstEmphasisFocus`, `showChartTitle`, `showChartSubtitle`, `customCategoryMap`, etc.) causing level property and ring radius changes to not reflect in the chart. Fixed tangential label rotation being discarded for outside labels. Fixed overflow `'none'` being skipped entirely instead of being passed as ECharts unclipped mode. Enabled overflow/width for inside labels. Added slash-break formatter (`Energy/Power` → `Energy/\nPower`). Extended Max Label Width slider range to 20px–200px. | useCallback Dependency Fix, Tangential Rotate Fix, Inside Label Overflow & Slash Wrapping |
| #238 | 2026-08-16 | Bug Fix | Resolved PDF persistence loss in Paper Details modal (`ViewEditPaperModal.tsx` / `usePapers.ts`): (1) Fixed Active State Rehydration in `usePapers.ts` which previously overwrote newly acquired `paperModal.paper` with stale list objects before `loadPapers()` resolved, (2) Added `subscribeSyncChannel` listener in `usePapers.ts` to reload papers on `SYNC_PAPERS` broadcasts, (3) Updated `PUT /api/papers/[id]` to properly receive, persist, and return `Local_PDF_Path` and updated paper data, (4) Enhanced `/api/pdf/single/route.ts` with explicit `projectId` request payload consumption and fallback ID resolution. Verified cleanly with `npx tsc --noEmit`. | Fix Paper Details PDF Persistence & Active Rehydration Guard |
| #239 | 2026-08-16 | Feature | Upgraded Paper Database CSV Export (`/api/export` & `PaperDatabaseView.tsx`) with a dedicated `ExportCsvModal.tsx` popup: (1) Added selective paper export support (exporting only checked papers or entire project cohort), (2) Added Ingestion Hub compatibility preset (14 standard `00_Raw_Harvest` columns with UTF-8 BOM encoding for seamless roundtrip import into Ingestion Hub or Google Sheets), (3) Added granular column picker with categorized tabs, search filters, and presets (All Columns, Minimal Bibliographic, Screening Decisions), and (4) Upgraded `/api/export` route to support both GET and POST with strict project scoping and stage dominance decision resolution. | Paper Database Selective & Ingestion Hub Compatible CSV Export |
| #240 | 2026-08-16 | Feature | Implemented seamless Cross-Project Transfer for Manual Ingest & Snowballing papers: (1) Added `scope=snowballing` in `/api/export` and `ExportCsvModal.tsx` with live snowballing paper counts, (2) Added "Include Referenced Seed Parent Papers" bundling toggle to export complete parent-child reference chains (`Parent_Paper_ID`), (3) Added `Parent_Paper_ID` auto-mapping and "Preserve from CSV" source preservation mode in Ingestion Hub (`useIngestion.ts` & `IngestionHubView.tsx`), (4) Added 1-click "Export Snowballing CSV" toolbar in Ingestion Hub Manual Ingest panel, and (5) Enhanced Paper Details view to gracefully show referenced parent provenance and non-blocking toast alerts when parent papers are from an origin project. | Cross-Project Manual Ingest (Snowballing) Seamless Transfer |
| #241 | 2026-08-16 | Bug Fix | Fixed SQLite "Too few parameter values were provided" error in `POST /api/papers` during CSV ingestion: (1) Corrected prepared statement parameter count for `findByDoiStmt.get()`, `findByTitleStmt.get()`, `updateCitationStmt.run()`, and `updateCitationAndDoiStmt.run()` to supply both required parameter bindings for project isolation clause `(Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT))`, (2) Explicitly passed `projectId: activeProjectId` in `useIngestion.ts` POST payload. Verified cleanly with `npx tsc --noEmit`. | Fix SQLite Parameter Count in Ingestion Hub Paper Import |


















