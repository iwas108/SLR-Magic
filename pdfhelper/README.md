# SLR Magic: PDF Helper Service ✨

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Backend: Python](https://img.shields.io/badge/Backend-Python-3776AB.svg)
![Framework: FastAPI](https://img.shields.io/badge/Framework-FastAPI-009688.svg)

## Overview

The `pdfhelper` module is a crucial pipeline within the SLR Magic ecosystem. Following a Clean Code Architecture approach and adhering to FAIR principles (Findable, Accessible, Interoperable, and Reusable), it standardizes the process of acquiring, verifying, and preparing research papers for the LLM to read.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Service](#running-the-service)

## Key Features

1. **Web Scraping & PDF Download:** Reads the input `database.csv`, scrapes DOIs, and securely downloads PDFs via institutional proxies (like EzProxy) using `undetected_chromedriver` to bypass bot protections.
2. **Verify Downloaded PDFs:** Extracts text using `PyMuPDF` and fuzzy-matches it against the expected title in the database to ensure the correct paper was retrieved. Outputs a validation CSV.
3. **Compress PDFs:** Optimizes file sizes using Ghostscript to save massive amounts of local and remote storage space.
4. **Sync to Google Drive:** Uses `rclone` to automatically back up the compressed, validated PDFs to your designated Google Drive repo for the App Script Hub to access.

## Prerequisites

- **Python:** Version 3.8+ installed.
- **Node.js & npm:** Required to build the Tailwind CSS dashboard stylesheet.
- **Chrome Browser:** Ensure Google Chrome is installed, as the scraper utilizes its engine.
- **Ghostscript:** Required for PDF compression.
  - **Windows:** Download from [Ghostscript.com](https://ghostscript.com/releases/gsdnld.html). Add `gswin64c` to your system PATH.
  - **Linux:** `sudo apt install ghostscript`
  - **macOS:** `brew install ghostscript`
- **rclone:** Required for syncing to Google Drive. Install from [rclone.org](https://rclone.org/) and configure a remote named `gdrive`.

## Installation

1. Navigate to the `pdfhelper` directory:
   ```bash
   cd pdfhelper
   ```

2. Create and activate a Python virtual environment (Recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Install Node.js dependencies and build the Tailwind stylesheet:
   ```bash
   npm install
   npm run build:css
   ```

## Configuration

Settings such as directories, delay intervals, fuzzy matching thresholds, and target Google Drive paths are defined directly within their respective service classes in `app/services/`. You can modify these directly to adjust the pipeline strictly to your institutional needs.

Ensure you place your `database.csv` file in the root `pdfhelper` directory before starting. It must contain at least `Paper_ID`, `Title`, `decision`, and `DOI_Link` columns.

## Running the Service

1. **Start the Server:**
   Run the FastAPI web server using `uvicorn`:
   ```bash
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Access the Dashboard:**
   Open your browser and navigate to `http://localhost:8000`.

3. **Follow the Steps:**
   Use the web UI to click through the sequential pipeline: Start Download -> Start Verification -> Start Compression -> Start Sync.
