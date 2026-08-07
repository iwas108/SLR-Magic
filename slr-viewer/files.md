# SLR Viewer File & Function Directory (`files.md`)

This document serves as a comprehensive index of every file within the `slr-viewer` module, detailing each file's specific function, architectural layer, and core purpose.

---

## 1. Root Configuration & Documentation (`slr-viewer/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `README.md` | Documentation | Module-scoped overview detailing standalone viewer features, IndexedDB storage, and setup instructions. |
| `architecture.md` | Documentation | Module-scoped blueprint detailing the offline React SPA design, Dexie database model, and GitHub Pages deployment configuration. |
| `improvements-log.md` | Documentation | Chronological log tracking iterations, feature creation, and bug fixes for `slr-viewer`. |
| `files.md` | Documentation | Directory index of every file in `slr-viewer` adhering to mandatory agent directory requirements. |
| `package.json` | Configuration | Defines dependencies (`dexie`, `echarts`, `papaparse`, `react`, `tailwindcss`) and build scripts. |
| `vite.config.js` | Build Config | Vite 8 configuration setting base path `/SLR-Magic/slr-viewer/dist/` for GitHub Pages deployment and dev port `3002`. |
| `index.html` | Entrypoint | HTML5 mount point for the React SPA. |

---

## 2. Source Code (`slr-viewer/src/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `src/main.jsx` | Entrypoint | React entrypoint mounting `<ViewerProvider><App /></ViewerProvider>` on DOM. |
| `src/App.jsx` | App Shell / Router | Shell managing light/dark/system themes, topbar header with active workspace selector, and tab routing. |
| `src/context/ViewerContext.jsx` | State Management | React Context provider managing active session, IndexedDB sync, tab routing, and toast notifications. |
| `src/index.css` | Styling | Global CSS defining Tailwind CSS 4 variables and design system tokens. |
| `src/StorageService.js` | Database / DAO | Dexie.js IndexedDB wrapper handling session CRUD and `.slr-viewer` JSON file persistence. |
| `src/lib/csv-export.js` | Utility | Exports Final Cohort table records into FAIR-compliant CSV format with PapaParse. |
| `src/components/Dashboard.jsx` | View Component | Project list board with KPI cards, search, sorting, pagination, and session CRUD actions. |
| `src/components/ImportWorkflow.jsx` | View Component | Drag & drop ingestion wizard parsing `.slr-viewer` JSON snapshot files into IndexedDB. |
| `src/components/Sidebar.jsx` | Navigation | Left collapsible navigation sidebar matching SLR-IDE branding, tabs, theme switcher, and collapse toggle. |
| `src/components/ProjectViewer.jsx` | Container Component| Tab bar container switching between Scientific Rigor, Final Cohort, and Accounting panels. |
| `src/components/scientific-rigor/ScientificRigorPanel.jsx` | View Aggregator | Container aggregating PRISMA canvas, pool status, stage comparison, and rolling batch QC panels. |
| `src/components/scientific-rigor/PrismaFlowDiagram.jsx` | View Component | HTML5 2D Canvas layout engine rendering PRISMA 2020 flowcharts with PNG download. |
| `src/components/scientific-rigor/PrismaConfigModal.jsx` | Modal Component | Styling modal for adjusting canvas font size, corner radius, and color palettes. |
| `src/components/scientific-rigor/PoolMetricsPanel.jsx` | UI Component | Renders progress bars for Pre-Calibration Pools A, B, and C. |
| `src/components/scientific-rigor/StageComparisonPanel.jsx` | UI Component | Renders Gold Standard vs AI stage comparison metric cards and pass/fail badges. |
| `src/components/scientific-rigor/RollingBatchPanel.jsx` | UI Component | Renders sequential quality control (QC) audit stopping criteria status. |
| `src/components/final-cohort/FinalCohortPanel.jsx` | View Component | Renders final cohort papers table with search, sorting, pagination, CSV export, and visualizer trigger. |
| `src/components/final-cohort/ClickableCell.jsx` | UI Component | Condensed clickable cell helper with copy & trace tooltips. |
| `src/components/final-cohort/VisualizerModal.jsx` | Modal Component | ECharts 4-step visualization wizard modal rendering 17 scientific chart types, active table filter warning badges and alert banners, data limiting, multi-level Sankey flows, styling controls, vector SVG and high-DPI PNG exports with dual string/object data handling matching SLR-IDE. |
| `src/components/final-cohort/FairExportModal.jsx` | Modal Component | FAIR-compliant CSV export modal. |
| `src/components/accounting/AccountingPanel.jsx` | View Component | Renders cumulative spend summary, per-stage cost cards grid, and top expensive API calls table. |
| `src/components/insight-export/FairDataExportPanel.jsx` | View Component | Renders side-by-side export cards allowing users to re-export `.slr-viewer` snapshot files or FAIR `.csv` dataset files. |
| `src/components/research-workflow/ResearchWorkflowPanel.jsx` | View Component | Dynamic 5-group interactive flowchart populated with live metrics from activeSession, featuring step-by-step node walkthrough playback and click-to-inspect drawers for Group 1 (Scopus and Manual / Google Scholar search query string cards with copy buttons) and Group 3 screening pipeline (Stage 1 Fast Filter EC counters, Stage 2 Gatekeeper structural failure counters, Stage 2.2 Scientist Dual-Gate QA rules, and Stage 2.3 Miner Taxonomy Trends Quick Overview with JSON download and Print PDF report export). |
| `src/utils/schemaMigration.js` | Schema Utility | Central schema versioning & backward compatibility normalization layer handling v1.0.0 and v1.1.0+ snapshot files. |
