# SLR Viewer File Inventory (`files.md`)

This document lists all source files and structural directories within `slr-viewer/`.

---

## 1. Root & Infrastructure Files
- [`package.json`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/package.json) - Module dependencies, scripts (`predev`, `prebuild` mirror hooks, `typecheck`, `build`).
- [`tsconfig.json`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/tsconfig.json) - TypeScript compiler options with `@/*` path alias.
- [`vite.config.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/vite.config.ts) - Vite configuration with Tailwind CSS plugin and GitHub Pages base path.
- [`index.html`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/index.html) - HTML entry point loading `/src/main.tsx`.

---

## 2. Core Application & State (`src/`)
- [`src/main.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/main.tsx) - React 19 root bootstrap mounting `ViewerProvider` and `App`.
- [`src/App.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/App.tsx) - Main application shell, top bar, dynamic panel switcher, search & filter routing.
- [`src/StorageService.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/StorageService.ts) - Dexie.js IndexedDB DAO with typed `SessionRecord` interface.
- [`src/context/ViewerContext.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/context/ViewerContext.tsx) - Global state provider with URL loader (`?url=...`).
- [`src/vite-env.d.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/vite-env.d.ts) - Ambient TypeScript definitions.

---

## 3. Utilities & Compression (`src/utils/`)
- [`src/utils/compression.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/utils/compression.ts) - Dual-mode Gzip `DecompressionStream` & `CompressionStream` utility with JSON fallback.
- [`src/utils/schemaValidator.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/utils/schemaValidator.ts) - Strict schema validation (`>= 1.1.0`).

---

## 4. Shared Services (`src/lib/services/` - Mirrored from `slr-ide`)
- [`src/lib/services/cohort-metrics.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/lib/services/cohort-metrics.ts) - Hare-Hamilton quota-balanced distribution engine.
- [`src/lib/services/taxonomy-resolver.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/lib/services/taxonomy-resolver.ts) - Umbrellanizer canonicalization & mapping logic.
- [`src/lib/services/trace-normalizer.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/lib/services/trace-normalizer.ts) - AI logic trace & evidence quote extractor.
- [`src/lib/csv-export.ts`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/lib/csv-export.ts) - FAIR-compliant CSV exporter.

---

## 5. UI Components & Feature Panels (`src/components/`)
- [`src/components/Sidebar.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/Sidebar.tsx) - Collapsible navigation sidebar matching `slr-ide`.
- [`src/components/Dashboard.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/Dashboard.tsx) - Multi-session CRUD board with search, sort, and update tools.
- [`src/components/ImportWorkflow.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/ImportWorkflow.tsx) - Drag-and-drop dual-mode `.slr-viewer` snapshot ingestion.
- [`src/components/common/FullscreenErrorModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/common/FullscreenErrorModal.tsx) - Interceptor modal for corrupted or outdated files.
- [`src/components/final-cohort/FinalCohortPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/final-cohort/FinalCohortPanel.tsx) - Interactive cohort data table with inline trace viewer.
- [`src/components/final-cohort/ClickableCell.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/final-cohort/ClickableCell.tsx) - Cell renderer with popover trace justification.
- [`src/components/final-cohort/VisualizerModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/final-cohort/VisualizerModal.tsx) - Cohort Visualizer modal (mirrored).
- [`src/components/final-cohort/LlmContextBuilderModal.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/final-cohort/LlmContextBuilderModal.tsx) - LLM context synthesizer modal (mirrored).
- [`src/components/final-cohort/visualizer/`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/final-cohort/visualizer) - 18 ECharts generators, style configs, and presets (mirrored).
- [`src/components/scientific-rigor/ScientificRigorPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/ScientificRigorPanel.tsx) - Scientific rigor presentation shell.
- [`src/components/scientific-rigor/PrismaFlowDiagram.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/PrismaFlowDiagram.tsx) - PRISMA 2020 Canvas flow diagram (mirrored).
- [`src/components/scientific-rigor/PoolMetricsPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/PoolMetricsPanel.tsx) - Pre-calibration pools panel (mirrored).
- [`src/components/scientific-rigor/BlindedAdjudicationPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/BlindedAdjudicationPanel.tsx) - Blinded review agreement and discrepancy adjudication panel with tooltips (mirrored).
- [`src/components/scientific-rigor/StageComparisonPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/StageComparisonPanel.tsx) - Stage comparison agreement panel (mirrored).
- [`src/components/scientific-rigor/RollingBatchPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/RollingBatchPanel.tsx) - Sequential QC rolling batch validation panel.
- [`src/components/scientific-rigor/BatchStatisticsCards.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/scientific-rigor/BatchStatisticsCards.tsx) - Sequential audit metrics cards.
- [`src/components/accounting/AccountingPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/accounting/AccountingPanel.tsx) - LLM token expenditure grid (mirrored).
- [`src/components/research-workflow/ResearchWorkflowPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/research-workflow/ResearchWorkflowPanel.tsx) - 5-Stage interactive pipeline architecture flow.
- [`src/components/research-workflow/TaxonomyTrendsPrintDocument.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/research-workflow/TaxonomyTrendsPrintDocument.tsx) - Printable taxonomy report document.
- [`src/components/insight-export/FairDataExportPanel.tsx`](file:///c:/Users/Aditya%20Suranata/Downloads/github/SLR-Magic/slr-viewer/src/components/insight-export/FairDataExportPanel.tsx) - FAIR export hub for `.slr-viewer` and tabular `.csv`.
