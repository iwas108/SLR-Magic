# SLR Magic: App Script FAIR Database (`app-script/`) ✨
### *Google Sheets Endpoint & Zero-OAuth Spreadsheet Integration*

[![Module: App Script](https://img.shields.io/badge/Module-App%20Script-0052CC.svg?style=for-the-badge&logo=googleappsscript&logoColor=white)](.)
[![Platform: Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-4285F4.svg?style=for-the-badge&logo=googleappsscript&logoColor=white)](https://script.google.com)
[![Database: Google Sheets](https://img.shields.io/badge/Database-Google%20Sheets-34A853.svg?style=for-the-badge&logo=googlesheets&logoColor=white)](https://sheets.google.com)
[![Security: Zero OAuth](https://img.shields.io/badge/Security-Zero%20OAuth%20Permissions-success.svg?style=for-the-badge&logo=shield&logoColor=white)](../architecture.md)

---

## 📑 Overview

The **App Script** module is a lightweight Google Apps Script codebase operating directly within Google Sheets. Under SLR Magic's local-first architecture, it serves as a **FAIR-compliant database endpoint** to ingest, structure, and visualize exported `.csv` datasets from `slr-ide`.

By storing credentials and executing LLMs locally in `slr-ide`, the Google Apps Script integration requires **zero sensitive Google OAuth app permissions**, ensuring maximum data privacy and security.

| FAIR Data Export | Google Sheets Synchronized Endpoint |
| :---: | :---: |
| ![FAIR Export](../docs/ss/29-slr-ide-insight-and-export-scientific-rigor-FAIR-Data-Export.jpg) | ![Cloud Gold Mine](../docs/ss/30-slr-ide-insight-and-export-scientific-rigor-cloud-gold-mine.jpg) |
| *Figure 1: CSV dataset exporter.* | *Figure 2: Synchronized Google Sheets FAIR endpoint.* |

---

## 🌟 Key Features

- **FAIR Data Compliance:** Converts exported CSV datasets from `slr-ide` into findable, accessible, interoperable, and reusable Google Sheets tables.
- **Automated Sheet Structure:** Dynamically builds standardized worksheets (`00_Raw_Harvest` for full bibliographies, `05_Synthesis` for included literature).
- **Interactive In-Sheet Visualizations:** Renders ECharts dialogs (Sankey, Bar, Stacked Bar, Pie, Radar) directly within Google Sheets.
- **Metadata Deduplication:** Guardrails against duplicate paper records using DOI and Title normalization.

---

## ⚡ Deployment via Clasp

```bash
# 1. Install clasp globally
npm install -g @google/clasp

# 2. Login to Google Account
clasp login

# 3. Deploy to Google Apps Script
cd app-script
clasp push
```

---

## 📘 Documentation Index

- 📐 **[Module Architecture (`architecture.md`)](./architecture.md)**
- 📜 **[Technical Debt Ledger (`technical_debt_ledger.md`)](./technical_debt_ledger.md)**
