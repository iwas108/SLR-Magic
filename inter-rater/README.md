# SLR Magic: Inter-Rater SPA ✨

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Frontend: React](https://img.shields.io/badge/Frontend-React-61DAFB.svg)
![Build: Vite](https://img.shields.io/badge/Build-Vite-646CFF.svg)

## Overview

This module contains the offline-capable Inter-Rater Single-Page Application (SPA) for the SLR Magic ecosystem. It allows researchers to conduct independent, **Blinded Reviews** without needing to interact directly with Google Sheets or seeing any prior AI decisions.

The app uses `localStorage` to autosave progress and manage review sessions. Data integrity is maintained securely using a standard `.slr` (JSON) format synchronized with the Google Apps Script backend.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Service](#running-the-service)
- [Deployment (GitHub Pages)](#deployment-github-pages)
- [Workflow Instructions](#workflow-instructions)

## Prerequisites

- **Node.js & npm:** Install the latest stable version from [nodejs.org](https://nodejs.org/).

## Installation

1. Navigate to the `inter-rater` directory:
   ```bash
   cd inter-rater
   ```

2. Install the necessary dependencies:
   ```bash
   npm install
   ```

## Running the Service

To run the application locally on your machine for development or immediate use:

```bash
npm run dev
```

*The console will provide a local URL (e.g., `http://localhost:5173`) to view the app in your browser.*

## Deployment (GitHub Pages)

This application is configured to be hosted natively on GitHub Pages.

1. Build the production application:
   ```bash
   npm run build
   ```

2. The compiled static files will be located in the `inter-rater/dist/` folder. Configure your repository's GitHub Pages settings to serve from the branch and path where the `dist/` folder is pushed.
   *(Note: The `vite.config.js` is set up with `base: '/SLR-Magic/inter-rater/dist/'` to correctly resolve relative asset paths when hosted on GitHub Pages).*

## Workflow Instructions

### 1. Export Data
- Open your SLR Magic Google Sheet.
- Run the **Inter-Rater Export** from the SLR Magic menu to generate a `.slr` file containing the blinded review dataset.

### 2. Independent Review
- Open the hosted SPA (or your local dev server).
- Click **Import New Review** and upload the `.slr` file.
- Review each paper independently and provide your Include/Exclude decision, reasoning, and confidence score. The app autosaves your progress.
- Click **Download Results** to generate the finalized `.slr` file.

### 3. Sync Back
- Return to your SLR Magic Google Sheet.
- Use the **Inter-Rater Import** utility to upload the finalized `.slr` file, merging your human review data back into the main database.
