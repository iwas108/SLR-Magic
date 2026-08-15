# SLR Viewer Improvements Log (`improvements-log.md`)

All notable changes, refactoring milestones, and feature additions to `slr-viewer/` are documented in this log.

---

## [2026-08-15] - Granular & Bulk Copy Functionality for Project Governance (1.1) and Frozen Prompts (2.4)

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

## [2026-08-15] - Fix Multi-Project Snapshot Export Scoping & Ingestion Hydration

### Fixed
- **Project Selection & Scoping**:
  - `slr-ide` export endpoint (`/api/export/slr-viewer`) now strictly respects `projectId` and `ACTIVE_PROJECT_ID` configs rather than defaulting to the first alphabetical project.
  - SQL queries for cohort papers, calibration papers, and rolling batches now enforce dual string/number matching (`WHERE Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)`).
- **Viewer Hydration & Session State**:
  - Updated `ViewerContext.tsx` and `ImportWorkflow.tsx` to refresh the session list immediately and switch active workspace seamlessly upon importing `.slr-viewer` snapshot files.
  - Resolved `PoolMetricsPanel.tsx` property lookups to support `activeProj.pool_a_count` / `activeProj.pool_a_size` directly.
  - Cleaned duplicate toolbar header controls from `FinalCohortPanel.tsx`.

## [2026-08-15] - SLR Viewer TypeScript Upgrade, Dual-Mode Compression & Code Mirroring Pipeline

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
