# SLR Magic: Inter-Rater SPA (`inter-rater/`) ✨
### *Standalone Offline Blinded Human Reviewer & Calibration Workspace*

[![Module: Inter-Rater SPA](https://img.shields.io/badge/Module-Inter--Rater%20SPA-0052CC.svg?style=for-the-badge&logo=react&logoColor=white)](.)
[![Frontend: React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Build: Vite 8](https://img.shields.io/badge/Build-Vite%208-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Validation: Cohen's Kappa](https://img.shields.io/badge/Validation-Cohen's%20Kappa%20%CE%BA-purple.svg?style=for-the-badge&logo=analytics&logoColor=white)](../methodology.md)

---

## 👥 Overview

The **Inter-Rater SPA** is a standalone, offline-capable React Single-Page Application (SPA) engineered for independent **Blinded Human Reviews** and inter-rater agreement calibration. It guarantees un-biased evaluation by isolating human raters from peer choices and AI pipeline decisions.

| Blinded Review Workspace | Cohen's Kappa Agreement Dashboard |
| :---: | :---: |
| ![Blinded Review](../docs/ss/32-inter-rater-blinded-inter-rater-review-workspace-1.jpg) | ![Inter-Rater Agreement](../docs/ss/08-slr-ide-pre-calibration-inter-rater-dashboard-pool-a.jpg) |
| *Figure 1: Blinded paper review interface.* | *Figure 2: Statistical inter-rater agreement matrix.* |

---

## 🌟 Key Features

- **Blinded Review Mode:** Evaluates paper abstracts and full-text PDFs without displaying AI screening decisions or peer choices.
- **Inter-Rater Calibration Metrics:** Automatically computes **Cohen's Kappa ($\kappa$)**, percentage agreement, and Quality Assessment (QA) score discrepancies.
- **Offline Session Persistence:** Automatically syncs review state to browser `localStorage`.
- **Native `.slr` File Protocol:** Imports assigned pools from `slr-ide` and exports completed human review files.

---

## 🛠️ Technical Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | React 19 + Vite 8 | Ultra-fast client-side rendering SPA |
| **Styling** | Tailwind CSS 4 | Modern utility-first CSS styling |
| **Icons** | Lucide React | High-contrast icon kit |
| **Portability** | Standalone SPA | Zero Next.js server dependencies |

---

## ⚡ Quick Start Setup

### Automated Setup (From Workspace Root)
Run the root automated installer to install all workspace dependencies:
- **Linux / macOS**: `./install.sh`
- **Windows**: `.\install.ps1` (or `install.bat` / `npm run setup`)

### Manual Setup
```bash
# 1. Install dependencies
cd inter-rater
npm install

# 2. Run dev server
npm run dev
```
Open **`http://localhost:3001`** (or `http://localhost:5173`) in your browser.

---

## 📘 Documentation Index

- 📐 **[Module Architecture (`architecture.md`)](./architecture.md)**
- 📁 **[File Directory Index (`files.md`)](./files.md)**
- 📜 **[Iteration Log (`improvements-log.md`)](./improvements-log.md)**
