# SLR Magic: Google Apps Script Core ✨

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Platform: Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-4285F4.svg)

## Overview

This module is the core orchestration hub of the SLR Magic Google Sheets application. It manages the Systematic Literature Review pipeline, supporting metadata ingestion, manual review screening, synthesis, and visual analysis.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Workspace](#running-the-workspace)

## Key Features

- **Automated Environment Setup:** Instantly generates the necessary worksheet structures (`00_Raw_Harvest` and `05_Synthesis`).
- **Structured Metadata Ingestion:** Bulk ingest CSV records from Scopus or Web of Science with interactive column mapping and fuzzy-matching, or add manual references.
- **Deduplication Guardrail:** Prevents importing duplicates by normalising DOIs and paper Titles.
- **Manual review screening & synthesis:** Tags chosen literature with Status `INCLUDE` and copies them to the synthesis collection sheet.
- **Visual Analytics:** Generates built-in charts (Sankey, Pie, Bar, Stack Bar, Line, Radar) directly in the spreadsheet from reviews using ECharts.

## Prerequisites

- **Node.js:** Needed to run `clasp` locally. Install from [nodejs.org](https://nodejs.org/).
- **Clasp (Command Line Apps Script Projects):** Install globally via npm:
  ```bash
  npm install -g @google/clasp
  ```
- **Google Account:** Ensure the Apps Script API is enabled at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).

## Installation

This project uses **clasp** to push local code to Google's servers.

1. **Login to Google:**
   ```bash
   clasp login
   ```
   *(This opens a browser window for authorization).*

2. **Create or Clone the Project:**
   - **Option A (Fresh Setup - Recommended):** Create a new bound Google Sheet project:
     ```bash
     clasp create --type sheets --title "SLR Magic Project"
     ```
   - **Option B (Existing Project):**
     ```bash
     clasp clone <your-script-id>
     ```

3. **Deploy Code:**
   Push the local files from the `app-script/` directory to the Google cloud:
   ```bash
   clasp push
   ```

4. **Open the Sheet:**
   ```bash
   clasp open
   ```

## Configuration

1. In the newly opened Google Sheet, select the **SLR Magic > Configure Settings** menu.
2. Under **Research Manifesto**, set up the Project Name, Manifesto, Objectives, and Questions.
3. Use the **Ingestion Hub** to import your bibliography files.

## Running the Workspace

1. **Initialization:** Click **SLR Magic > Initialize Workspace** to generate the required sheets.
2. **Metadata Ingestion:** Import your bibliography exports inside the Ingestion Hub.
3. **Screening:** Review papers in `00_Raw_Harvest` and set the `Status` column to `INCLUDE` for the chosen papers.
4. **Data Sync:** Click **SLR Magic > Process Data Collection** to compile the selected papers into `05_Synthesis`.
5. **Visualization:** Open chart dialogues to explore categories and trends.
