# SLR Magic: App Script FAIR Database (`app-script/`) ✨

![Module: App Script](https://img.shields.io/badge/Module-App%20Script-blue.svg)
![Platform: Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-4285F4.svg)
![Database: Google Sheets](https://img.shields.io/badge/Database-Google%20Sheets-34A853.svg)

## Overview

The **App Script** module is a lightweight Google Apps Script codebase that operates directly within the Google Sheets environment. Under SLR Magic's local-first architecture, this module **only acts as a FAIR-compliant database endpoint** to ingest, organize, and visualize exported `.csv` datasets from `slr-ide`. 

By decoupling heavy LLM processing and storing credentials locally in `slr-ide`, the Google Apps Script footprint requires **zero sensitive Google OAuth app permissions**, ensuring maximum data security, privacy, and trust compliance.

---

## Key Features

- **FAIR Data Compliance:** Ingests exported CSV datasets from `slr-ide` into structured, findable, accessible, interoperable, and reusable Google Sheets tables.
- **Automated Sheet Initialization:** Dynamically generates standardized worksheet structures (`00_Raw_Harvest` for full bibliographies and `05_Synthesis` for included literature).
- **Interactive ECharts Visualizations:** Renders rich ECharts chart dialogs directly within Google Sheets (Sankey diagrams, Bar charts, Stack Bar, Pie charts, Line plots, and Radar graphs).
- **Metadata Deduplication:** Guardrails against duplicate record creation using DOI and Title normalization.
- **Inter-Rater & Cohort Importers:** Supports importing blinded inter-rater datasets and final cohort synthesis exports.

---

## Prerequisites & Installation

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **Clasp (Command Line Apps Script Projects):** Install globally:
  ```bash
  npm install -g @google/clasp
  ```
- **Google Account:** Enable the Google Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).

### Deployment via Clasp

1. **Login to Google Account:**
   ```bash
   clasp login
   ```

2. **Create or Clone Project:**
   - **New Project:**
     ```bash
     clasp create --type sheets --title "SLR Magic FAIR Database"
     ```
   - **Existing Script:**
     ```bash
     clasp clone <your-script-id>
     ```

3. **Push Code to Google Servers:**
   ```bash
   cd app-script
   clasp push
   ```

4. **Open Bound Spreadsheet:**
   ```bash
   clasp open
   ```

---

## Usage Workflow

1. **Initialize Workspace:** Open the Google Sheet and select **SLR Magic > Initialize Workspace** to build required sheets.
2. **Ingest Exported Dataset:** Select **SLR Magic > Ingestion Hub** to import `.csv` datasets exported from `slr-ide`.
3. **Explore Visual Analytics:** Open the chart dialogs (**SLR Magic > Visualizations**) to view dynamic Sankey flows, breakdown charts, and synthesis metrics.

---

## Documentation

- 📐 **[Module Architecture (`architecture.md`)](./architecture.md)**
- 📜 **[Technical Debt Ledger (`technical_debt_ledger.md`)](./technical_debt_ledger.md)**
