# SLR Viewer File & Function Directory (`files.md`)

This document serves as a comprehensive index of every file within the `slr-viewer` module, detailing each file's specific function, architectural layer, and core purpose.

---

## 1. Root Configuration & Infrastructure (`slr-viewer/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `package.json` | Dependency / Build Scripts | Module manifest, npm dependencies (React 19, Lucide, Dexie, Tailwind CSS, jsPDF, svg2pdf.js), scripts (`predev`, `prebuild` mirror hooks, `typecheck`, `build`). |
| `package-lock.json` | Dependency Lockfile | Lockfile guaranteeing reproducible dependency installations across environments. |
| `tsconfig.json` | Build Configuration | TypeScript compiler options enforcing strict type-checking and `@/*` path alias resolution. |
| `tsconfig.tsbuildinfo` | Build Cache | Incremental TypeScript compiler cache accelerating compilation times. |
| `vite.config.ts` | Bundler Configuration | Vite configuration with Tailwind CSS plugin and GitHub Pages base path (`/SLR-Magic/slr-viewer/`). |
| `index.html` | Application Entrypoint | HTML shell with root DOM mount element (`#root`) loading `/src/main.tsx`. |
| `files.md` | Governance / Index | Comprehensive directory index documenting all files, layers, and purposes conforming to AGENTS.md §2.4. |
| `improvements-log.md` | Documentation | Chronological improvements log tracking feature additions, parity migrations, and bug fixes with sequential IDs. |
| `README.md` | Documentation | General developer documentation and usage guide for the standalone SLR Viewer SPA. |

---

## 2. Core Application & State Management (`slr-viewer/src/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `src/main.tsx` | Bootstrap / Entrypoint | React 19 root bootstrap mounting `ViewerProvider` and `App` with global style imports. |
| `src/App.tsx` | Shell / Layout | Primary application layout shell, top navigation bar, active session banner, dynamic view routing, and global search/filter bar. |
| `src/StorageService.ts` | Persistence / DAO | Dexie.js IndexedDB client managing local snapshot persistence, session CRUD, and multi-session isolation with typed `SessionRecord` interface. |
| `src/context/ViewerContext.tsx` | State Provider | React context provider managing active session, loaded datasets, UI view switches, toasts, and URL parameter auto-loading (`?url=...`). |
| `src/vite-env.d.ts` | Type Declarations | Ambient TypeScript definitions for Vite client environment. |

---

## 3. Utilities & Compression (`slr-viewer/src/utils/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `src/utils/compression.ts` | Serialization / Compression | Dual-mode streaming Gzip decompressor (`DecompressionStream`) and compressor (`CompressionStream`) with fallback to uncompressed JSON. |
| `src/utils/schemaValidator.ts` | Schema Validation | Strict snapshot schema validator (`>= 1.1.0`) validating and sanitizing incoming `.slr-viewer` payloads, systematic search queries, and scientific rigor stats. |

---

## 4. Pure Services & Types (`slr-viewer/src/lib/` & `src/types/` - Mirrored from `slr-ide`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `src/types/index.ts` | Domain Types | Unified TypeScript interfaces for papers, projects, LLM extraction schemas, calibration metrics, and PRISMA flows. |
| `src/lib/services/cohort-metrics.ts` | Domain Calculation | Pure mathematical engine calculating Unique Paper Prevalence ($N$) and Hare-Hamilton quota-balanced Tag Share distributions ($100.00\%$). |
| `src/lib/services/cohort-data-source.ts` | Data Aggregation | Universal data adapter resolving cohort field values, study prevalence deduplication, and cross-tabulation metrics. |
| `src/lib/services/taxonomy-resolver.ts` | Canonicalization Engine | Post-pipeline canonicalization resolver mapping raw terms to Umbrellanizer taxonomy categories using strict equality matching. |
| `src/lib/services/trace-normalizer.ts` | Normalization Engine | AI logic trace mapping and reasoning quote extractor providing single source of truth for evidence quotes. |
| `src/lib/services/prisma-svg-generator.ts` | Vector Graphics Engine | Standalone PRISMA 2020 SVG diagram generator producing publication-ready vector markup with customizable themes. |
| `src/lib/services/pdf-export-service.ts` | Document Exporter | Client-side PDF export service converting vector SVGs and canvas diagrams into high-resolution vector PDF documents via jsPDF + svg2pdf.js. |
| `src/lib/csv-export.ts` | Export Utility | RFC 4180-compliant tabular CSV export utility with UTF-8 BOM (`\uFEFF`) and study prevalence deduplication. |

---

## 5. Presentation Components & Feature Panels (`slr-viewer/src/components/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `src/components/Sidebar.tsx` | Navigation / UI | Collapsible sidebar navigation menu matching SLR IDE layout with status badges and section links. |
| `src/components/Dashboard.tsx` | Workspace Board | Multi-session management dashboard with search, sort, file metadata inspection, and session deletion. |
| `src/components/ImportWorkflow.tsx` | File Ingestion | Drag-and-drop file ingestion area supporting both `.slr-viewer` (Gzip binary) and `.json` uncompressed snapshot bundles. |
| `src/components/common/FullscreenErrorModal.tsx` | Error Handling | Interceptor modal displaying actionable error messages when snapshot validation fails or file corruptions occur. |
| `src/components/final-cohort/FinalCohortPanel.tsx` | Data Grid / Table | Comprehensive final cohort data grid with column filters, search, inline trace popovers, and launch actions for Visualizer and LLM Context Builder. |
| `src/components/final-cohort/ClickableCell.tsx` | Grid Cell Renderer | Interactive table cell renderer displaying extracted values with popover trace justification and quotes. |
| `src/components/final-cohort/VisualizerModal.tsx` | Data Visualization | Full-featured Visualizer Studio modal housing the 18-chart generation studio and publication export tools. |
| `src/components/final-cohort/LlmContextBuilderModal.tsx` | LLM Context Builder | Synthesis modal extracting structured Markdown context from final cohort papers across customizable research dimensions. |
| `src/components/scientific-rigor/ScientificRigorPanel.tsx` | Quality Assessment | Top-level scientific rigor dashboard featuring PRISMA 2020 validation status, 1-click Rigor JSON export, and LLM Context Extraction. |
| `src/components/scientific-rigor/PrismaFlowDiagram.tsx` | Diagram Presentation | PRISMA 2020 Canvas & SVG flow diagram with vector SVG/PDF export actions, zoom/pan controls, and customizable themes. |
| `src/components/scientific-rigor/PrismaConfigModal.tsx` | Diagram Configuration | Configuration modal for adjusting PRISMA counts, box text labels, layout dimensions, and node visibility. |
| `src/components/scientific-rigor/ScientificRigorLlmModal.tsx` | LLM Context Builder | Scientific Rigor context extraction modal synthesizing PRISMA flow, pre-calibration pools, blinded agreement, stage comparisons, and rolling audits across 8 dimensions. |
| `src/components/scientific-rigor/PoolMetricsPanel.tsx` | Quality Assessment | Pre-calibration pool filling progress and consensus scorecard displaying Pool A, Pool B, and Pool C metrics. |
| `src/components/scientific-rigor/BlindedAdjudicationPanel.tsx` | Quality Assessment | Blinded review agreement panel displaying Cohen's Kappa, Observed Agreement, Expected Chance Agreement, and Discrepancy Adjudication progress. |
| `src/components/scientific-rigor/StageComparisonPanel.tsx` | Quality Assessment | Gold Standard vs AI stage screening comparison panel auditing Fast Filter and Gatekeeper agreement and transition accuracy. |
| `src/components/scientific-rigor/RollingBatchPanel.tsx` | Quality Assessment | Sequential Quality Control rolling batch validation panel displaying batch metrics and audit progression. |
| `src/components/scientific-rigor/BatchStatisticsCards.tsx` | Quality Assessment | High-level sequential audit metrics cards summarizing rolling batch screening accuracy. |
| `src/components/accounting/AccountingPanel.tsx` | Financial Audit | Token expenditure and cost audit panel tracking input/output tokens and financial costs per screening stage. |
| `src/components/research-workflow/ResearchWorkflowPanel.tsx` | Methodology View | 5-stage interactive pipeline architecture flow detailing the SLR review methodology from ingestion to final cohort. |
| `src/components/research-workflow/TaxonomyTrendsPrintDocument.tsx` | Report Generator | Printable taxonomy report document rendering formatted distribution tables and methodological summaries. |
| `src/components/insight-export/FairDataExportPanel.tsx` | FAIR Data Hub | FAIR-compliant data export hub providing 1-click downloads for `.slr-viewer` snapshots, tabular cohort `.csv`, and Umbrellanizer Taxonomy Mappings (`.csv` and `.json`). |

---

## 6. Visualizer Studio Subsystem (`src/components/final-cohort/visualizer/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `visualizer/index.ts` | Module Facade | Public exports of Visualizer Studio components, hooks, types, presets, and generators. |
| `visualizer/types.ts` | Type Declarations | Detailed configuration and state types for all 18 chart categories, themes, color palettes, and layouts. |
| `visualizer/components/VisualizerStudio.tsx` | Studio Orchestrator | Core multi-step visualizer studio layout orchestrating Chart Selection, Data Mapping, Style Customization, and Preview Stage. |
| `visualizer/components/VisualizerHeader.tsx` | Header Controls | Studio top bar with chart title, preset selector, and action buttons. |
| `visualizer/components/Step1ChartSelector.tsx` | Step 1 Selector | Interactive gallery for selecting among 18 ECharts visualization categories. |
| `visualizer/components/Step2DataMapping.tsx` | Step 2 Mapping | Dynamic data mapping interface for dimensions, grouping, series, and aggregation functions. |
| `visualizer/components/Step3StyleCustomization.tsx` | Step 3 Styling | Deep styling panel for colors, typography, grids, legends, tooltips, and hatch patterns. |
| `visualizer/components/Step4PreviewStage.tsx` | Step 4 Preview | Full viewport chart canvas preview with camera controls, split preview, and export controls. |
| `visualizer/components/subcomponents/` | Modular Studio Panels | Dedicated configuration panels for Clustered Bar, Horizontal Bar, Stacked Bar, Treemap, Sunburst, Radar/Spider, Sankey, Cross-Tab Matrix, and Scientific Axes. |
| `visualizer/generators/` | Chart Option Engines | Pure ECharts option generation functions for all 18 chart types adhering to strict type safety. |
| `visualizer/hooks/` | Custom State Hooks | Specialized hooks managing visualizer camera zoom/pan, chart options, data mapping, presets, and styling. |
| `visualizer/utils/` | Algorithmic Utilities | Color palettes, data extractors, export formatters, hatch pattern engines, Hare-Hamilton quota balancer, and statistical estimators. |
