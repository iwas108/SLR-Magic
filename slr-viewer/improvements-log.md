# SLR Viewer Improvements Log (`improvements-log.md`)

All notable changes, refactoring milestones, and feature additions to `slr-viewer/` are documented in this log.

## [#017] [2026-09-09] - Raw Extracted Value Parity in Final Cohort Cell Value Popover

### Added & Enhanced
- **Raw Extracted Value Display in Value Popover (`ClickableCell.tsx`)**:
  - Brought `ClickableCell` in `slr-viewer` into 100% parity with `slr-ide` by rendering the unmapped `originalValue` inside the "Copy Cell Value" popover whenever it is present and differs from `valueToCopy`.
  - Added dedicated "Original Value" sub-header, pre-wrapped scrollable content box, and 1-click copy button with animated confirmation state (`copiedType === 'original'`).
  - Restored full transparency for researchers to inspect and copy both post-Umbrellanizer canonical terms and original raw LLM extractions directly from final cohort tables.
- **Verification**:
  - Confirmed 0 TypeScript type errors (`tsc --noEmit`).
  - Generated clean production bundle in `dist/` with updated asset fingerprints (`npm run build:viewer`).
  - Updated `slr-viewer/files.md`.

---

## [#016] [2026-09-09] - Codebase Cleanup, Tree Shaking & Production Build Audit for GitHub Release

### Cleanup & Verification
- **Test Scripts Purge**: Removed scratch verification scripts and restored clean monorepo configuration in preparation for public GitHub release.
- **Service & Asset Synchronization**: Executed `npm run mirror:viewer` to ensure 100% parity across mirrored pure services (`taxonomy-resolver.ts`, `cohort-data-source.ts`, `trace-normalizer.ts`, `adjudication-calculations.ts`) and offline fonts.
- **Production Verification**:
  - Confirmed 0 TypeScript type errors (`npm run typecheck`).
  - Generated clean production bundle in `dist/` with updated asset fingerprints (`npm run build:viewer`).
  - Verified cataloging integrity in `slr-viewer/files.md`.

---

## [#015] [2026-09-09] - 1-Click Cross-Panel Navigation Across Research Workflow Flowchart Nodes

### Added & Enhanced
- **Interactive Cross-Panel Navigation in Research Workflow (`ResearchWorkflowPanel.tsx`)**:
  - Embedded direct 1-click cross-panel navigation across all 20 pipeline flowchart nodes (spanning all 5 groups: Database Builder & Ingestion, Pre-Calibration & Prompt Optimization, LLM & Manual Screening Pipeline, Post-Validation & Quality Audit, and FAIR Data Export & Reporting).
  - Configured precise navigation targets for each node (`insight-export-rigor`, `insight-export-screening-ledger`, `insight-export-cohort`, `insight-export-accounting`, and `insight-export-fair-data`).
  - Added dedicated navigation button in each flowchart grid card footer with `e.stopPropagation()`, ensuring users can jump directly to the target tab while still being able to click the card body to open the telemetry inspection drawer.
  - Added a prominent Quick Navigation Callout Banner at the top of the slide-over inspection drawer (below the Live Telemetry Metric box) displaying the related workspace section, an informative description of what can be explored there, and a primary action button with an external link indicator.
  - Added a secondary "Go to [Section]" navigation button in the drawer footer for fluid scrolling ergonomics.
  - Integrated global toast notification (`showToast("Navigated to [Section]", "info")`) providing instant visual feedback on navigation.
- **Verification**:
  - TypeScript typecheck passed with 0 errors (`tsc --noEmit`).
  - All monorepo test suites passed 100% (`npm test`).
  - Clean production build verified (`vite build`, v1.1.24).

---

## [#014] [2026-09-09] - Multi-Source Systematic Search Queries & IEEE Xplore Ingestion Hub Transparency (PRISMA 2020 Item 7)

### Added & Enhanced
- **Multi-Source Systematic Search Queries in Node 1.2 (`ResearchWorkflowPanel.tsx`)**:
  - Upgraded **Node 1.2 (Literature Ingestion Hub)** from legacy hardcoded Scopus and Google Scholar cards to a dynamic multi-repository search strategy viewer.
  - Dynamically extracts and renders all documented database search strings from `project.search_queries` and `scientific_rigor.systematic_search_strategies.search_queries`, seamlessly displaying IEEE Xplore, Scopus, Google Scholar, Web of Science, ACM Digital Library, PubMed, etc.
  - Added repository-aware source badges and styling (`getDatabaseSourceStyle`) providing distinct visual hierarchy across IEEE Xplore (blue/indigo), Scopus (amber/orange), Google Scholar (emerald), Web of Science (purple), and ACM (cyan).
  - Added individual 1-click "Copy Query" buttons with toast feedback and 2-second confirmation state.
  - Added 1-click "Copy All" button allowing researchers and auditors to copy all documented search strategies with repository headers and filter notes in one click for PRISMA appendices.
  - Provided clean formatted syntax code blocks (`font-mono text-xs max-h-52 select-all`) with filter notes and parameters.
  - Maintained graceful backward compatibility: if only legacy strings (`scopus_search_string`, `manual_search_string`) exist, they automatically normalize into the new query card structure.
- **Enhanced SLR Viewer Snapshot Export (`slr-ide/src/app/api/export/slr-viewer/route.ts`)**:
  - Guaranteed `parsedSearchQueries` are exported into `project.search_queries` and embedded `systematic_search_strategies` at the top level and in `scientific_rigor`.
- **Automated Verification Suite**:
  - Added dedicated test suite `scripts/test-literature-ingestion-hub.mjs` (`npm run test:ingestion`) verifying repository extraction, dynamic rendering, PRISMA Item 7 compliance, and live SQLite `slr.db` data presence for IEEE Xplore.
  - Verified 0 TypeScript errors and clean production build (`v1.1.23`).

---

## [#013] [2026-09-09] - Interactive Pre-Calibration & Post-Validation Adjudication Transparency Hub

### Added & Enhanced
- **Interactive Pre-Calibration Adjudication Explorer (`BlindedAdjudicationPanel.tsx`)**:
  - Embedded an interactive adjudication and ground truth explorer directly within Section 1.5 of the Scientific Rigor page.
  - Implemented multi-pool selection pills: Pool A (Fast Filter, n=50), Pool B (Gatekeeper, n=30), and Pool C (QA & Miner, n=20).
  - Added sub-tab switching between **Cohort & Discrepancies** and the **Cryptographically Signed Calibration Ledger**.
  - Implemented dual-mode filtering: toggle between "Conflicts Only" and "All Paired Papers", with dynamic count badges.
  - Implemented full-text client search across Paper ID, Title, DOI, and Authors.
  - Rendered comprehensive paired reviewer comparison tables: Reviewer Alpha vs Reviewer Beta vs Adjudicated Consensus with color-coded decision badges and rationales.
  - Rendered immutable calibration audit ledger table featuring 7-char short commit hashes, one-click copy buttons, timestamps, adjudicator roles, and resolution commit messages.
- **Interactive Rolling Batch Adjudication & Micro-Audit Explorer (`RollingBatchPanel.tsx`)**:
  - Embedded micro-batch adjudication exploration directly beneath the sequential Wald/Fleiss-Cohen historical performance metrics in Section 3.
  - Added batch selector pills (`Batch #1 (n=20)`, `Batch #2 (n=20)`, etc.) with active batch synchronization.
  - Added sub-tab switching between **Sampled Papers & Discrepancies** and the **Cryptographically Signed Batch Commit Ledger**.
  - Enabled dual-mode filtering ("Conflicts Only" vs "All Sampled Papers (20)") with instant text search.
  - Rendered side-by-side QA decision summaries (e.g. `Include (6.5/8.0)` vs `Exclude (3.0/8.0)`) and consensus status across all 20 sampled papers.
- **Deep Side-by-Side Adjudication Inspection Modal (`AdjudicationInspectionModal.tsx`)**:
  - Built a comprehensive dual-pane inspection modal shared across Pool A, Pool B, Pool C, and Rolling Batches.
  - **Left Pane (Bibliographic & PRISMA Evidence)**: Displays Paper ID, publication year, title, authors, journal/source, clickable DOI and PDF links, full study abstract, and commit hash stamp.
  - **Right Pane (Blinded Rater Arbitration)**:
    - **Pool A & Pool B**: Rater Alpha vs Rater Beta vs Adjudicated Ground Truth (Decision, Exclusion Criteria codes, and detailed rationales).
    - **Pool C & Rolling Batches**: Sub-tabs for **Dual-Gate Quality Appraisal (QA1–QA8)** and **Structured Entity Mining (RQ1–RQ9)**.
    - Full rubric criteria breakdown with exact scoring rules, fatal flaw indicators, reviewer scores, reviewer evidence quotes, and adjudicated consensus.
    - Miner extraction view displaying entity keys, rater values, evidence quotes, and adjudicated values.
  - Modal includes keyboard navigation (Left/Right arrows for item cycling, Escape to close) and signed consensus commit footer.
- **Centralized Service & Calculator Mirroring (`scripts/mirror-to-viewer.mjs`)**:
  - Registered `adjudication-calculations.ts` and `AdjudicationInspectionModal.tsx` in `scripts/mirror-to-viewer.mjs` ensuring 100% sync between `slr-ide` and `slr-viewer`.
  - Upgraded `renderPoolCReviewerSummary` to accept both serialized JSON strings and parsed object payloads.
- **Verification**:
  - TypeScript check passed with 0 errors (`npm --prefix slr-viewer run typecheck`).
  - Production build succeeded cleanly (`npm --prefix slr-viewer run build`, v1.1.22).
  - All 4 monorepo test suites passed 100% (`npm test`).

---

## [#012] [2026-09-09] - Tailwind CSS v4 Class-Based Dark Mode Fix & Maximum Contrast Overhaul

### Fixed & Enhanced
- **Tailwind CSS v4 Dark Variant Selector Isolation (`index.css`)**:
  - Diagnosed critical root cause where `slr-viewer/src/index.css` lacked `@custom-variant dark (&:where(.dark, .dark *));`.
  - In Tailwind CSS v4, without this directive, all `dark:*` utility classes default to `@media (prefers-color-scheme: dark)`. Because developer/user operating systems frequently have Dark Mode enabled at the OS level, `@media (prefers-color-scheme: dark)` matched globally. Consequently, all pale/pastel `dark:*` text classes (`dark:text-amber-100`, `dark:text-emerald-200`, `dark:text-amber-400`) were inappropriately rendered on top of white/light card backgrounds (`#ffffff`), producing completely washed-out, illegible text in light mode.
  - Added `@custom-variant dark (&:where(.dark, .dark *));` directly after `@import "tailwindcss";`, properly scoping all `dark:*` utility selectors strictly to `:where(.dark, .dark *)`.
- **Deep Opaque Text Colors & Zero Opacity Transparency**:
  - Replaced semi-transparent text opacity (`text-emerald-800/80`, `text-amber-800/80`) with 100% opaque, high-contrast paired colors:
    - **Passed Steps / Cards**: `text-emerald-950 dark:text-emerald-200` (Title), `text-emerald-900 dark:text-emerald-300` (Description), `text-emerald-900 dark:text-emerald-300` (Status Tag), `text-emerald-700 dark:text-emerald-400` (Icon).
    - **Inaccessible PDF Steps / Cards**: `text-amber-950 dark:text-amber-200` (Title), `text-amber-900 dark:text-amber-300` (Description), `text-amber-900 dark:text-amber-300` (Status Tag), `text-amber-700 dark:text-amber-400` (Icon).
    - **Excluded Steps / Cards**: `text-rose-950 dark:text-rose-200` (Title), `text-rose-900 dark:text-rose-300` (Description), `text-rose-800 dark:text-rose-300` (Status Tag), `text-rose-700 dark:text-rose-400` (Icon).
- **PRISMA Phase 2b Warning Banner (`PaperInspectionModal.tsx`)**:
  - Upgraded header to `text-amber-900 dark:text-amber-300 font-black` with `text-amber-700 dark:text-amber-400` icon.
  - Body paragraph set to `text-amber-950 dark:text-amber-100 font-semibold leading-relaxed`.
- **Decision & Trigger Badges (`ScreeningLedgerPanel.tsx` & `PaperInspectionModal.tsx`)**:
  - Upgraded badges with deep contrast: `text-amber-900 dark:text-amber-300` (Unretrieved), `text-orange-800 dark:text-orange-300` (Duplicate), `text-emerald-900 dark:text-emerald-300` (Included), and `text-rose-800 dark:text-rose-300` (Excluded).
  - Upgraded Local PDF Status `INACCESSIBLE` badge to `text-rose-800 dark:text-rose-300 font-black`.
- **Verification**:
  - Verified built CSS: all `dark:*` selectors now compile to `:where(.dark, .dark *)` instead of `@media (prefers-color-scheme: dark)`.
  - All 5 test suites passed (`npm test`: 22/22 ledger tests, 42/42 visualizer tests).
  - Production build completed cleanly (`vite build`, v1.1.21).

---

## [#011] [2026-09-09] - High-Contrast Theme-Adaptive Typography & UI Coloring (Light & Dark Theme Parity)

### Fixed & Enhanced
- **High-Contrast Triggered Exclusion Criterion Card (`PaperInspectionModal.tsx`)**:
  - Eliminated washed-out, illegible pink-on-pink text in light theme where `text-rose-200/90` and `text-rose-300` had an inaccessible contrast ratio (< 1.5:1) against light backgrounds.
  - Replaced low-contrast classes with theme-adaptive typography: `text-rose-950 dark:text-rose-100` (10.5:1 contrast in light theme, 11:1 in dark theme), `bg-rose-500/10 dark:bg-rose-500/15`, `border-2 border-rose-500/30 dark:border-rose-500/40`, and `font-semibold`.
  - Replaced exclusion code badge with `font-black text-rose-800 dark:text-rose-200 bg-rose-500/20 border-rose-500/30`.
- **Theme-Adaptive Multi-Stage Screening Trajectory Stepper (`PaperInspectionModal.tsx`)**:
  - Upgraded stepper cards to theme-adaptive text and border scales:
    - **Excluded Nodes**: `text-rose-950 dark:text-rose-100`, step title `text-rose-900 dark:text-rose-200 font-black`, description `text-rose-800/80 dark:text-rose-300/80`, status tag `text-rose-700 dark:text-rose-300 border-rose-500/20`.
    - **Passed Nodes**: `text-emerald-950 dark:text-emerald-100`, step title `text-emerald-900 dark:text-emerald-200 font-black`, description `text-emerald-800/80 dark:text-emerald-300/80`, status tag `text-emerald-800 dark:text-emerald-300 border-emerald-500/20`.
    - **Retrieval Inaccessible**: `text-amber-950 dark:text-amber-100`, step title `text-amber-900 dark:text-amber-200 font-black`, description `text-amber-800/80 dark:text-amber-300/80`, status tag `text-amber-800 dark:text-amber-300`.
    - **Skipped / Unreached**: Removed artificial opacity haze (`opacity-60`), applying crisp `text-foreground/75 dark:text-foreground/70 font-bold` and subtle `bg-card/70 dark:bg-secondary/30`.
- **High-Contrast PRISMA Phase 2b & Phase 1 Warning Banners (`PaperInspectionModal.tsx`)**:
  - Inaccessible PDF banner upgraded to `text-amber-800 dark:text-amber-400 font-extrabold` header and `text-amber-950 dark:text-amber-100` body with `border-2 border-amber-500/30 dark:border-amber-500/40`.
  - Duplicate notice banner upgraded to `text-orange-800 dark:text-orange-400 font-extrabold` header and `text-orange-950 dark:text-orange-100` body with `border-2 border-orange-500/30 dark:border-orange-500/40`.
- **High-Contrast Decision Badges & Rationales (`PaperInspectionModal.tsx`)**:
  - Header decision badge uses deep, crisp text in light theme and vibrant pastel in dark theme: `text-rose-700 dark:text-rose-400` (EXCLUDE), `text-emerald-800 dark:text-emerald-400` (INCLUDE), `text-amber-800 dark:text-amber-400` (UNRETRIEVED), `text-orange-700 dark:text-orange-400` (DUPLICATE).
  - AI rationale box rendered in `text-[13px] text-foreground font-sans leading-relaxed` on `bg-secondary/40 dark:bg-secondary/30`.
  - Human reviewer evaluation card rendered in `text-amber-800 dark:text-amber-400` header with `text-amber-950 dark:text-amber-100` rationale on `bg-amber-500/10 dark:bg-amber-500/15`.
- **Screening Ledger KPI Cards & Table Cells (`ScreeningLedgerPanel.tsx`)**:
  - Replaced washed-out 400-level text in light mode across KPI buttons with high-contrast dual-theme classes: `text-orange-700 dark:text-orange-400`, `text-blue-700 dark:text-blue-400`, `text-amber-800 dark:text-amber-400`, `text-purple-700 dark:text-purple-400`, `text-rose-700 dark:text-rose-400`, `text-emerald-800 dark:text-emerald-400`, and `text-slate-700 dark:text-slate-400`.
  - Fixed legacy snapshot banner from low-contrast `text-amber-300` to `text-amber-900 dark:text-amber-300`.
  - Table stage badges and decision badges upgraded with dark/light paired color palettes (`text-*-700 dark:text-*-400`).
  - Table typography enhanced: Paper ID set to `select-text font-semibold`, Title set to `font-bold text-foreground text-xs`, Authors set to `text-foreground/80 dark:text-muted-foreground font-medium`, and Year set to `font-mono text-foreground font-bold`.
- **Verification**:
  - Production build compiled cleanly in 10.26s (`vite build`).
  - All 5 test suites passed (`npm test`: fonts, date, parity, ledger, visualizer, 22/22 ledger tests).

---

## [#010] [2026-09-08] - Strict PRISMA 2020 Stage Parity & Full-Text Retrieval Gate Audit

### Fixed & Enhanced
- **Deterministic PRISMA 2020 Phase Categorization (`ScreeningLedgerPanel.tsx`, `PaperInspectionModal.tsx`, `types/index.ts`)**:
  - Traced and resolved discrepancy between database `ai_decision = 'INCLUDE'` counts (82 papers) and PRISMA Final Included Cohort (46 papers). 36 papers passed Stage 1 Fast Filter but were halted at PRISMA Phase 2b (*Reports Not Retrieved*) due to inaccessible full-text PDFs (`Local_PDF_Status === 'INACCESSIBLE'`).
  - Traced duplicate exclusion collision where 1 duplicate record had `ai_stage = 1, ai_decision = 'EXCLUDE'`. Enforced pre-screening deduplication priority according to PRISMA 2020 standards, ensuring Stage 1 exclusions correctly equal exactly **937** non-duplicates.
  - Implemented deterministic `prisma_phase` resolution with strict mathematical partitioning across all 1,803 ingested papers:
    - **Pre-Screening Duplicates Purged**: 8
    - **Stage 1 Fast Filter Excluded**: 937
    - **Reports Not Retrieved (PDF Inaccessible)**: 36
    - **Stage 2 Gatekeeper Excluded**: 774
    - **Stage 3 Scientist QA Excluded**: 2
    - **Stage 4 Miner Final Included Cohort**: 46
    - **Total Non-Duplicate Excluded (S1+S2+S3)**: 1,713
    - **Exact Mathematical Partition**: $8 + 937 + 36 + 774 + 2 + 46 = 1,803$ (100.00% exact match to PRISMA flow diagram).
- **PRISMA-Grouped Interactive KPI Header (`ScreeningLedgerPanel.tsx`)**:
  - Redesigned top metric cards grouped by PRISMA stage with visual stage separators (`Pre-Screening`, `Phase 1: Title/Abstract`, `Phase 2a: Retrieval`, `Phase 2b: Full-Text`, and `Phase 3: Included`).
  - Added dedicated 1-click filter cards for `PDF Inaccessible (36)` and `Duplicates (8)`.
  - Fixed Unscreened filter behavior so it no longer forces `non-duplicates` when zero unscreened non-duplicates exist.
- **5-Stage Full-Text Retrieval Gate Visualizer (`PaperInspectionModal.tsx`)**:
  - Expanded paper inspection stepper to 5 steps, introducing the explicit `PDF Retrieval Gate` between Fast Filter and Gatekeeper.
  - Added PRISMA Phase 2b warning banner explaining the full-text acquisition failure rationale and showing the paper's Stage 1 inclusion status.
  - Added PRISMA Phase 1 duplicate notice banner for pre-screening purged records.
  - Differentiated header badge between `Stage 1 Include • PDF Inaccessible (Unretrieved)` (amber) and `FINAL INCLUDED` (emerald).
- **Automated Verification**:
  - Expanded `scripts/test-screening-ledger.mjs` with 8 PRISMA assertion tests validating exact cohort counts, duplicate isolation, and 100% partition coverage (22/22 tests passed).

---

## [#009] [2026-09-08] - Full Screening Corpus Transparency Suite ("Screening Ledger" & Paper Inspection Modal)

### Added
- **"Screening Ledger" Navigation Item (`Sidebar.tsx`, `App.tsx`)**:
  - Integrated new top-level navigation item `{ id: 'insight-export-screening-ledger', label: 'Screening Ledger', icon: Layers }` positioned directly above **Final Cohort** in the "Insight & Export" section.
  - Wired dedicated edge-to-edge view container (`p-0 flex flex-col h-full`) in `App.tsx` hosting `ScreeningLedgerPanel`.
- **Wide Tabular Data Grid (`ScreeningLedgerPanel.tsx`)**:
  - Built high-performance wide table displaying all 1,800+ input papers with independent scrolling and sticky header.
  - **KPI Summary Cards**: Quick-filter pills displaying Total Ingested (1,803), Total Excluded (1,714), Stage 1 Excluded (938), Stage 2 Excluded (774), Stage 3 Excluded (2), Final Included (46), Duplicates (8), and Unscreened.
  - **Comprehensive Multi-Field Search**: Real-time searching across Paper ID, Title, Authors, DOI, Abstract, Publisher, Exclusion Codes, and AI/Manual rationales.
  - **Multi-Attribute Filter Drawer**: Filters for Screening Stage (0 to 4), Decision (INCLUDE, EXCLUDE, UNSCREENED), Trigger Code (EC-1..EC-4), PDF Status (SYNCED, DOWNLOADED, MATCHED, MISSING, INACCESSIBLE, FAILED, IGNORED), Source Database (Scopus, WoS, IEEE, PubMed, Manual), Duplicates (Exclude, Include, Only), and Calibration Pool (Pool A, Pool B, Pool C, Non-calibration).
  - **12 Dynamic Columns**: Paper ID, Title, Authors, Year, DOI, Source, Stage badge, Effective Decision badge (with Human Override indicator), Exclusion Trigger, PDF Status dot/link, Citations, and Inspect action button.
  - **Column Resizing & Persistence**: Hover-active draggable column borders with `localStorage` persistence scoped per project.
  - **1-Click RFC 4180 CSV Export**: Integrated "Export CSV" button generating UTF-8 BOM (`\uFEFF`) spreadsheets of the entire screened literature corpus or filtered subsets.
- **Comprehensive & Beautiful Paper Inspection Modal (`PaperInspectionModal.tsx`)**:
  - Full-featured modal dialog (`max-w-5xl`, `h-[92vh]`) with smooth backdrop blur.
  - **4-Stage Visual Stepper**: Displays paper trajectory through Fast Filter, Gatekeeper, Scientist QA, and Miner Extraction, highlighting where exclusions occurred.
  - **Triggered Exclusion Criterion Card**: Surfaces rule code and full rule description.
  - **Side-by-Side Rationale Comparison**: AI Screening Rationale contrasted with Human Reviewer Evaluation.
  - **Multi-Stage Audit History**: Chronological run timeline detailing stage, model ID, tokens, latency, and cost per screening execution.
  - **Abstract & Provenance Tab**: Full scrollable paper abstract with word count, 1-click copy, and bibliographic provenance metadata.
  - **Evaluation Data Tab**: Formatted JSON syntax views for Stage 3 QA scores and Stage 4 Miner extraction variables.
  - **Rapid Audit Navigation**: Keyboard arrow keys (`Left`/`Right`), `Escape` dismissal, and Prev/Next buttons for auditing papers sequentially without closing the modal.
- **Schema Validation & Backwards-Compatible Storage (`schemaValidator.ts`, `StorageService.ts`)**:
  - Validates and sanitizes `screened_corpus` with graceful fallback for legacy v1.1.0/v1.2.0 snapshots.
  - Tracked `totalCorpusCount` in `SessionRecord` and enhanced `Dashboard.tsx` session cards to display both final cohort count and total screened corpus count.
- **Automated Verification**:
  - Tested with `scripts/test-screening-ledger.mjs` verifying 1,803 papers, stage-dominant decision resolution, screening audit logs, and component mountings (17/17 passed).

---

## [#008] [2026-09-08] - Fix Accounting Top Expensive API Calls "Invalid Date" Timestamp Parsing

### Fixed
- **Resilient Timestamp Helper Suite (`AccountingPanel.tsx`)**:
  - Resolved critical display defect where the `TIMESTAMP` column rendered `"Invalid Date"` across all rows in the Accounting panel.
  - Implemented `parseTimestampToMs` and `formatTimestampSafe` handling ISO-8601 strings, SQLite space-separated datetime strings (converts space to `'T'` and appends timezone `'Z'`), numeric epoch timestamps, and null/empty states with graceful fallbacks.
  - Resolved attribute naming discrepancy by dynamically inspecting `call.created_at || call.timestamp || call.time || call.date`.
- **Safe Date Formatting in Rolling Batch Panel (`RollingBatchPanel.tsx`)**:
  - Upgraded date rendering for `batch.finalized_at` and `batch.created_at` with `formatDateSafe`, eliminating potential invalid date errors on SQLite date strings.
- **Automated Verification**:
  - Tested with `scripts/test-date-parsing.mjs` verifying 100% valid formatted dates and zero `"Invalid Date"` occurrences across all supported formats.

---

## [#007] [2026-09-08] - Self-Hosted Offline Publication Font Suite & Zero CDN Network Leakage

### Added
- **Self-Hosted WOFF2 Publication Assets (`public/fonts/`)**:
  - Mirrored full publication font suite (20 optimized `.woff2` files) from `slr-ide` via `scripts/mirror-to-viewer.mjs`.
  - Guarantees 100% offline rendering parity across Windows, macOS, and Linux without depending on local OS font availability or external network CDNs.
  - Bundled families: `Computer Modern`, `STIX Two Text`, `Carlito`, `EB Garamond`, and `Roboto`.
- **Offline `@font-face` Declarations (`index.css`)**:
  - Declared full `@font-face` blocks for all 5 core academic typefaces in `src/index.css`.
  - Verified 0 external HTTP/HTTPS CDN links in CSS, fulfilling strict airgap and FAIR data requirements.
- **Automated Verification**:
  - Integrated into monorepo test runner (`npm run test:fonts` / `npm test`).
  - Successfully built production Vite bundle with all font assets preserved in `dist/fonts/`.

---

## [#006] [2026-09-08] - Fix Visualizer Studio Data Sourcing & Taxonomy Resolution Across Bundled Datasets

### Fixed
- **Isomorphic Data Resolution Architecture (`taxonomy-resolver.ts`)**:
  - Implemented multi-type inspector `isNonEmptyPayload` in `taxonomy-resolver.ts` that safely validates both raw SQLite JSON strings (from `slr-ide`) and parsed JavaScript objects (from exported `.slr-viewer` snapshot bundles).
  - Fixed root cause bug where `getStageDominantExtractedDataStr` checked `typeof str === 'string'`, erroneously returning `""` for object payloads and collapsing all Visualizer Studio charts (Sankey, Sunburst, Treemap, Clustered Bar, Radar, Cross-Tab Matrix) into `Unspecified (~100%)`.
  - Added centralized `getStageDominantQualityAssessmentStr` helper to provide symmetrical, stage-dominant QA score resolution for both string and object formats.
- **Stage Dominance & Centralized Utility Enforcement (`AGENTS.md` §3.6 & §3.10)**:
  - Eliminated islanded local parsing fallbacks in `LlmContextBuilderModal.tsx` and `FinalCohortPanel.tsx` by importing and calling centralized `getStageDominantExtractedDataStr` and `getStageDominantQualityAssessmentStr`.
  - Preserved strict stage-aware dominance (`MAX(manual_stage, ai_stage)`) and tie-breaking (`manual_stage >= ai_stage`).
- **Safety Audit False-Positive Prevention (`cohort-data-source.ts`)**:
  - Normalized object and string representations in `validateCohortDataIntegrity` before equality assertions, eliminating false-positive stage dominance violation flags on bundled datasets.
- **Automated Verification**:
  - Created standalone parity test suite `scripts/test-data-sourcing-parity.mjs` verifying string/object parity, stage dominance overrides, variable discovery, field resolution, and 0% "Unspecified" guarantee in Sankey flows (13/13 tests passing).
  - All 42 visualizer anti-regression unit tests passing without errors.

---

## [#005] [2026-09-08] - Full Feature & Service Parity with SLR IDE (PDF/SVG Vector Engine, Systematic Search Strategy, Scientific Rigor LLM Context Builder, Taxonomy Mappings Export & Study Prevalence Deduplication)

### Added
- **Client-Side PDF & SVG Vector Export Engine**:
  - Integrated `jspdf` and `svg2pdf.js` into `slr-viewer/package.json`.
  - Mirrored `pdf-export-service.ts`, `prisma-svg-generator.ts`, and `cohort-data-source.ts` via `scripts/mirror-to-viewer.mjs`.
  - Enables 1-click vector SVG and high-resolution PDF exports directly in the standalone viewer for PRISMA 2020 flow diagrams.
- **Systematic Search Strategy & Queries Disclosure (PRISMA 2020 Items 6 & 7)**:
  - Updated snapshot export route (`/api/export/slr-viewer`) to extract structured `systematic_search_strategies` from `project.search_queries` (with legacy fallback).
  - Hardened `schemaValidator.ts` in `slr-viewer` to validate and preserve `systematic_search_strategies` across `scientific_rigor` and `prisma_flow_data`.
- **Scientific Rigor LLM Context Builder Modal & Top Action Bar**:
  - Mirrored `ScientificRigorLlmModal.tsx` into `slr-viewer` supporting offline standalone execution with `initialData`.
  - Added "PRISMA 2020 Validated" badge, 1-click "Download Rigor JSON" action, and "Extract LLM Context" launcher in `ScientificRigorPanel.tsx`.
- **Post-Pipeline Taxonomy Mappings Export in FAIR Data Hub**:
  - Implemented 3rd export card in `FairDataExportPanel.tsx`: "Umbrellanizer Taxonomy Mappings Export".
  - Generates RFC 4180 CSV (with UTF-8 BOM `\uFEFF`) and structured JSON client-side, compiling raw-to-umbrella mappings, justification notes, occurrence frequencies, and paper citations.
- **Unique Study Prevalence Deduplication**:
  - Applied `Array.from(new Set(...))` deduplication per study across `FinalCohortPanel.tsx` and `csv-export.ts`, guaranteeing multi-token categories report unique study prevalence accurately without duplicate counts.

### Changed
- Extended automated mirroring pipeline (`scripts/mirror-to-viewer.mjs`) to synchronize all newly required pure services and modals.
- Clean build verification with 0 TypeScript compiler errors (`tsc --noEmit`) and successful production bundling (`vite build`).

---

## [#004] [2026-08-16] - Blinded Review & Adjudication Results Panel Parity and Snapshot Schema Support

### Added
- **Blinded Review & Adjudication Results (`BlindedAdjudicationPanel.tsx`)**:
  - Mirrored `BlindedAdjudicationPanel.tsx` from `slr-ide` into `slr-viewer/src/components/scientific-rigor/`.
  - Integrated into `ScientificRigorPanel.tsx` directly under **Pre-Calibration Filling Status** and above **Gold Standard vs AI Stage Comparisons**.
  - Displays Cohen's Kappa, Observed Agreement, Expected Chance Agreement, Precision, Weighted Kappa, Schema Match %, and Adjudication Resolution progress complete with rich hover tooltips across all 3 pools.
- **Snapshot Export/Import Parity (`schemaValidator.ts`)**:
  - Updated `slr-viewer/src/utils/schemaValidator.ts` to recognize and preserve `scientific_rigor.blinded_adjudication_stats`.
  - Added support for `.slr-viewer` exported bundles containing pre-computed blinded review statistics and adjudication resolutions.

---

## [#003] [2026-08-15] - Granular & Bulk Copy Functionality for Project Governance (1.1) and Frozen Prompts (2.4)

### Added
- **1.1 Project Metadata & Governance Copy Actions**:
  - Master **Copy Full Spec** button at the top of the 1.1 drawer exporting structured Markdown of the entire governance manifesto, objectives, RQs, ECs, and QA rubrics.
  - Granular copy buttons on Project Name, Description, Research Manifesto, Research Objective, and Research Questions.
  - **Exclusion Criteria**: "Copy All ECs" section button plus individual copy buttons on every EC criterion card.
  - **Quality Assurance & Fatal Flaw Gates**: "Copy All QA Rules" section button, full rule copy buttons on every QA gate, and granular copy buttons on individual score tiers (Score 1.0 Full Pass, Score 0.5 Partial, Score 0.0 Fail, and Generic Score Definitions).
- **2.4 Frozen Prompt & Schema Mount Copy Actions**:
  - Registry header **Copy All Templates** button exporting all registered prompt templates into structured Markdown.
  - Per-template **Copy Template** button compiling full template metadata, stage badges, system instructions, user prompts, and response JSON schemas.
  - Individual copy buttons on System Instruction, User Template Prompt, and Response JSON Schema code blocks.
- **Dynamic Clipboard Feedback System**:
  - Centralized `handleCopy` helper with dynamic key-based 2-second auto-resetting checkmark indicator pill (`isCopied` state transition).
  - Synchronized global toast notification alerts using `ViewerContext.showToast`.

---

## [#002] [2026-08-15] - Fix Multi-Project Snapshot Export Scoping & Ingestion Hydration

### Fixed
- **Project Selection & Scoping**:
  - `slr-ide` export endpoint (`/api/export/slr-viewer`) now strictly respects `projectId` and `ACTIVE_PROJECT_ID` configs rather than defaulting to the first alphabetical project.
  - SQL queries for cohort papers, calibration papers, and rolling batches now enforce dual string/number matching (`WHERE Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)`).
- **Viewer Hydration & Session State**:
  - Updated `ViewerContext.tsx` and `ImportWorkflow.tsx` to refresh the session list immediately and switch active workspace seamlessly upon importing `.slr-viewer` snapshot files.
  - Resolved `PoolMetricsPanel.tsx` property lookups to support `activeProj.pool_a_count` / `activeProj.pool_a_size` directly.
  - Cleaned duplicate toolbar header controls from `FinalCohortPanel.tsx`.

---

## [#001] [2026-08-15] - SLR Viewer TypeScript Upgrade, Dual-Mode Compression & Code Mirroring Pipeline

### Added
- **TypeScript Infrastructure**:
  - Upgraded the entire `slr-viewer` codebase to React 19 + TypeScript (`tsconfig.json`, `vite-env.d.ts`, `vite.config.ts`).
  - Added `@/*` path aliasing matching `slr-ide` for 1:1 component import interoperability.
- **Automated Code Mirroring Pipeline (`scripts/mirror-to-viewer.mjs`)**:
  - Automatic synchronization of 40+ files from `slr-ide` into `slr-viewer` before every dev and build run (`predev` and `prebuild` hooks).
  - Synchronizes pure services (`cohort-metrics.ts`, `taxonomy-resolver.ts`, `trace-normalizer.ts`), data types (`types/index.ts`), complete visualizer module (18 chart generators, hooks, constants, utilities), and feature panels (`PrismaFlowDiagram.tsx`, `AccountingPanel.tsx`, `StageComparisonPanel.tsx`, `PoolMetricsPanel.tsx`).
- **Dual-Mode Compressed Interchange**:
  - Browser-native transparent compression & decompression (`src/utils/compression.ts`) using `CompressionStream('gzip')` and `DecompressionStream('gzip')`.
  - Achieves ~90% file size reduction for `.slr-viewer` snapshot exchanges with graceful fallback to uncompressed JSON.
  - Server export route in `slr-ide` (`src/app/api/export/slr-viewer/route.ts`) produces Gzip-compressed binary payloads by default with optional `?compressed=false` flag.
- **Online Presentation & Remote Loading**:
  - Added URL parameter ingestion (`?url=https://.../dataset.slr-viewer`) in `ViewerContext.tsx` to load remote datasets automatically upon landing on the GitHub Pages deployment.
- **Root Monorepo Automation**:
  - Added root `package.json` with scripts `npm run mirror:viewer`, `npm run build:viewer`, `npm run build:ide`, `npm run build:all`.

### Changed / Refactored
- Converted all 16 UI components in `slr-viewer` from `.jsx`/`.js` to `.tsx`/`.ts`.
- Removed all legacy duplicate `.jsx`/`.js` files.
- Verified zero TypeScript compilation errors (`tsc --noEmit`) and successful static production bundling (`vite build`) targeting `/SLR-Magic/slr-viewer/dist/`.
