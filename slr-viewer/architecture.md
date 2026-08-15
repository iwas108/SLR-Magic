# SLR Viewer Sub-module Blueprint (`architecture.md`)

The **SLR Viewer** (`slr-viewer/`) is a standalone, 100% pure TypeScript React 19 SPA designed to visualize, present, and evaluate `.slr-viewer` snapshot datasets exported from `slr-ide`. It deploys seamlessly as a static web application on GitHub Pages.

---

## 1. High-Level Architecture Flow

```
slr-ide (Export .slr-viewer with Gzip / JSON >= v1.1.0)
         │
         ▼
[Automated Code Mirroring Pipeline: scripts/mirror-to-viewer.mjs]
(Syncs Shared Services, Types, Visualizer 18 Generators, Presentation Modals)
         │
         ▼
ImportWorkflow.tsx / Dashboard.tsx / URL Param (?url=...)
         │
         ▼
compression.ts (Transparent Gzip Decompression + Plain JSON Fallback)
         │
         ▼
schemaValidator.ts (Strict Schema Validation >= 1.1.0)
   ├── Incompatible / Corrupted ──> FullscreenErrorModal.tsx (Actionable Re-export Guide)
   └── Valid Schema ──> StorageService.ts (Dexie IndexedDB DAO)
                              │
                              ▼
                      ViewerContext.tsx (Global Workspace State)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        Dashboard.tsx                     App.tsx (Navigation Shell & Panels)
    (Sessions CRUD Board)                     │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
            ScientificRigorPanel     FinalCohortPanel        AccountingPanel
            • PRISMA 2020 Canvas     • Dynamic Cohort Table  • Per-stage spend grid
            • Calibration Pools      • Modular Visualizer    • Top expensive calls
            • Stage Comparisons        (18 Charts, SVG/PNG)  • Token usage metrics
            • Rolling Batch QC       • LLM Context Builder
                                       (Gemini 3.1 Pro ready,
                                        Hare-Hamilton balanced)
                      │                       │
                      ▼                       ▼
            ResearchWorkflowPanel   FairDataExportPanel
            • 5-Stage Interactive   • FAIR CSV Tabular
              Architecture Flow     • Gzip Snapshot Re-Export
```

---

## 2. Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 19.2.5 + TypeScript 5.8.0 + Vite 8.1.5 |
| **Styling** | Tailwind CSS 4.1.10 (`@tailwindcss/vite`) + Lucide React Icons |
| **Code Mirroring** | Automated pre-build & pre-dev mirroring pipeline (`scripts/mirror-to-viewer.mjs`) |
| **Compression** | Browser `CompressionStream` / `DecompressionStream` (Gzip) with UTF-8 fallback |
| **Local Storage** | Dexie.js 4.4.3 (IndexedDB Wrapper) with strict TypeScript schema validation |
| **Visualizations** | Apache ECharts 6.1.0 (Modular Canvas / SVG engine, 18 chart types) |
| **CSV Parsing & Export** | PapaParse 5.5.3 |
| **Protocols & Services** | Centralized `trace-normalizer.ts`, `taxonomy-resolver.ts`, `cohort-metrics.ts` |

---

## 3. Strict Schema Policy & Protocols

### A. Schema Versioning & Dual-Mode Interchange
- **Minimum Supported Version**: `1.1.0`.
- **Dual-Mode Interchange**: Supports both Gzip-compressed binary `.slr-viewer` files (~90% size reduction) and standard JSON `.slr-viewer` files.
- **Incompatible Snapshot Interception**: Outdated or malformed payloads trigger `FullscreenErrorModal.tsx` with copyable diagnostics and re-export guidance.

### B. Trace Normalization (`agents.md` §3.9)
- Logic traces from AI and manual screening are normalized using `trace-normalizer.ts` (`extractMappingReasoning`, `extractEvidenceQuote`).
- Preserves 100% data integrity for prompt auditing and human verification.

### C. Taxonomy Resolution (`agents.md` §3.10)
- Extracted taxonomy variables are canonicalized and mapped using `taxonomy-resolver.ts` (`resolveUmbrellanizerValue`, `extractPaperFieldValues`, `getUmbrellanizerJustification`).
- Dynamic delimiter handling (commas vs compound phrases) and stage dominance resolution.

### D. Cohort Metrics & Statistical Balancing
- `cohort-metrics.ts` computes statistical distributions using the Hare-Hamilton largest remainder quota balancing method to ensure all normalized percentages sum precisely to 100.0%.

---

## 4. GitHub Pages Deployment Configuration

The module builds to static assets in `slr-viewer/dist/` using subpath configuration in `vite.config.ts`:
- **Production Base Path**: `/SLR-Magic/slr-viewer/dist/`
- **Local Dev Server Port**: `3002`
- **Path Alias**: `@/*` -> `./src/*`
