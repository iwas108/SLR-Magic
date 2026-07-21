# SLR Viewer Sub-module (`slr-viewer/`) ✨

![Module: SLR Viewer](https://img.shields.io/badge/Module-SLR%20Viewer-blue.svg)
![Frontend: React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg)
![Build: Vite](https://img.shields.io/badge/Build-Vite%208-646CFF.svg)
![Database: Dexie.js](https://img.shields.io/badge/Database-IndexedDB%20(Dexie)-003B57.svg)

## Overview

**SLR Viewer** is a standalone, read-only React 19 Single-Page Application (SPA) designed to visualize, analyze, and present `.slr-viewer` snapshot datasets exported from `slr-ide`. 

It operates completely offline in the browser using Dexie.js (IndexedDB), providing researchers, stakeholders, and peer reviewers with an interactive environment to explore scientific rigor metrics, PRISMA 2020 flowcharts, cohort synthesis tables, ECharts analytics, and LLM accounting breakdowns without needing access to `slr-ide` or a backend server.

---

## Key Features

### 1. 📂 Offline Snapshot Ingestion
- Drag-and-drop `.slr-viewer` JSON snapshot file importer.
- Local browser session persistence using **Dexie.js (IndexedDB)**.
- Workspace switcher supporting multiple loaded review sessions.

### 2. 🧬 Scientific Rigor & PRISMA 2020 Canvas
- **PRISMA 2020 Flowchart Engine:** Renders interactive 2D canvas PRISMA flowcharts depicting identification, screening, eligibility, and inclusion numbers.
- **Canvas Customization & Export:** Adjust font size, corner radii, and color palettes, and export high-resolution PNG images.
- **Methodological Metrics:** Displays Gold Standard vs AI stage comparisons, Pre-Calibration pool metrics, and rolling batch quality control (QC) audit stopping criteria.

### 3. 📊 Final Cohort Table & ECharts Visualizer
- **Interactive Data Table:** Wide synthesis table with dynamic column resizing, column sorting, pagination, and search filters.
- **Logic Trace Popovers:** Inspect raw LLM rationale, evidence snippets, and Umbrellanizer taxonomy mappings directly inside cell tooltips.
- **17 Scientific ECharts Visualizations:** Multi-level Sankey flow diagrams, Bar charts, Stacked Bar charts, Radar graphs, Line plots, and Pie charts with vector SVG and high-DPI PNG export options.

### 4. 💰 Accounting & Spend Analytics
- Cumulative project LLM spend metrics and per-stage cost distribution grid (Fast Filter, Gatekeeper, Scientist, Miner, Umbrellanizer).
- Top expensive API calls log table detailing model used, tokens consumed, and cost per request.

### 5. 📤 FAIR Data Re-Export
- Re-export loaded sessions back to `.slr-viewer` JSON snapshot files.
- Export Final Cohort datasets to FAIR-compliant tabular `.csv` files.

---

## Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 19.2.5 + Vite 8.0.16 |
| **Styling** | Tailwind CSS 4.1.10 (`@tailwindcss/vite`) |
| **Local Database** | Dexie.js 4.4.3 (IndexedDB) |
| **Visualizations** | Apache ECharts 6.1.0 |
| **CSV Exporter** | PapaParse 5.5.3 |
| **Icons** | Lucide React |

---

## Prerequisites & Setup

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher

### Local Development
1. Navigate to `slr-viewer`:
   ```bash
   cd slr-viewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3002` in your browser.

---

## Deployment (GitHub Pages)

Compile static production assets:
```bash
npm run build
```
Static assets will be generated in `slr-viewer/dist/`.
*(Note: `vite.config.js` sets `base: '/SLR-Magic/slr-viewer/dist/'` for GitHub Pages hosting).*

---

## Documentation

- 📐 **[Module Architecture (`architecture.md`)](./architecture.md)**
- 📁 **[File Directory Index (`files.md`)](./files.md)**
- 📜 **[Iteration Log (`improvements-log.md`)](./improvements-log.md)**
