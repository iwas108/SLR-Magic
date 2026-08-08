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
| `scripts/bump-version.js` | Build Automation | Node.js script executing prior to build (`prebuild`) to auto-increment the patch version in `package.json`. |
| `vite.config.js` | Build Config | Vite 8 configuration setting base path `/SLR-Magic/slr-viewer/dist/`, dev port `3002`, and global `__APP_VERSION__` + `__BUILD_TIME__` defines. |
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
| `src/components/final-cohort/FinalCohortPanel.jsx` | View Component | Dynamic table filtering and sorting final cohort papers with cell tooltips. |
| `src/components/final-cohort/ClickableCell.jsx` | UI Component | Renders cell value popover showing logic trace, original quotes, and PDF link. |
| `src/components/final-cohort/VisualizerModal.jsx` | Charting Modal | ECharts visualization modal supporting 17 chart types and multi-level Sankey flows. |
| `src/components/accounting/AccountingPanel.jsx` | View Component | Aggregates LLM token usage, cost breakdowns per stage, and top expensive API calls. |
| `src/components/insight-export/FairDataExportPanel.jsx` | View Component | Renders FAIR data export options and download triggers for CSV/JSON snapshots. |
| `src/components/research-workflow/ResearchWorkflowPanel.jsx` | View Component | Dynamic 5-group interactive SVG flowchart rendering SLR Magic's 5-phase research workflow execution. |
| `src/components/research-workflow/TaxonomyTrendsPrintDocument.jsx` | Printable Report | Dedicated print report view for Taxonomy Trends Quick Overview with print styling. |
| `src/utils/schemaMigration.js` | Schema Utility | Central snapshot schema migration layer normalizing legacy v1.0.0 and modern v1.1.0+ snapshot structures. |
