# SLR Viewer Sub-module Blueprint (`architecture.md`)

The **SLR Viewer** (`slr-viewer/`) is a standalone, read-only React 19 SPA designed to visualize, present, and analyze `.slr-viewer` snapshot datasets exported from `slr-ide`.

---

## 1. High-Level Architecture Flow

```
slr-ide (Export .slr-viewer) ──> ImportWorkflow.jsx ──> StorageService.js (Dexie DAO)
                                                                │
                                                         IndexedDB Store
                                                                │
                                         ┌──────────────────────┴──────────────────────┐
                                         ▼                                             ▼
                                    Dashboard.jsx                              ProjectViewer.jsx
                                (Sessions CRUD Table)                      (Tab Container SPA)
                                                                                       │
                                                        ┌──────────────────────────────┼──────────────────────────────┐
                                                        ▼                              ▼                              ▼
                                             ScientificRigorPanel.jsx        FinalCohortPanel.jsx            AccountingPanel.jsx
                                             • PRISMA 2020 Canvas            • Cohort Table                  • Per-stage spend grid
                                             • Stage Comparisons             • VisualizerModal (ECharts)     • Top expensive calls
                                             • Pool Progress                 • CSV Tabular Exporter
                                             • Sequential QC Audit
```

---

## 2. Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 19.2.5 + Vite 8.0.16 |
| **Styling** | Tailwind CSS 4.1.10 (`@tailwindcss/vite`) |
| **Local Database** | Dexie.js 4.4.3 (IndexedDB Wrapper) |
| **Visualizations** | Apache ECharts 6.1.0 |
| **CSV Parsing & Export** | PapaParse 5.5.3 |
| **Icons** | Lucide React 1.17.0 |

---

## 3. GitHub Pages Deployment Configuration

The module builds to static assets using relative or subpath configuration in `vite.config.js`:
- Production path: `/SLR-Magic/slr-viewer/dist/`
- Local dev server port: `3002`
