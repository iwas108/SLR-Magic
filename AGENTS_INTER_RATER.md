# Agent Instructions: Inter-Rater Single-Page Application (SPA) Workflow

## Purpose
This document provides a comprehensive, step-by-step guide to building a robust, foolproof offline-capable inter-rater workflow for the SLR Magic tool. This workflow replaces the need for reviewers to interact directly with the Google Apps Script UI or Google Sheets, allowing them to use a mobile-first Single-Page Application (SPA) hosted on GitHub Pages.

## Core Requirements & Architecture
* **Frontend:** A React Single-Page Application (SPA) built with Vite and Bootstrap 5.
* **Hosting:** The SPA source will live in the `inter-rater/` directory, and the built files will be output to `inter-rater/dist/` for GitHub Pages hosting.
* **State Management:** The SPA must rely on `localStorage` (or `IndexedDB` via a wrapper) to allow users to pause, resume, and manage multiple in-progress and finished review sessions.
* **Backend (Google Apps Script):** Enhancements to `QualityCheckController.js` and `Main.js` to safely export Data to CSV and import (sync) Data from the finalized CSV back into the Google Sheet.
* **Primary Key:** `Paper_ID` is the strict primary key used to match and update rows during the sync process.

## Guiding Principles
* **FAIR Principles:** Ensure data is Findable, Accessible, Interoperable, and Reusable. The CSV structure should clearly represent the data schema, and the SPA should maintain data integrity without altering source fields unexpectedly.
* **Clean Code Architecture:** Separate concerns. In the React app, separate UI components from local storage logic and CSV parsing logic. In Apps Script, separate the UI handlers from the business logic of finding rows and updating values.
* **Foolproof & Robust:** Validate CSV headers on import. Ensure the user cannot export or import broken data. Prevent accidental data loss in the SPA by autosaving on every action.

---

## Part 1: Building the React SPA (`inter-rater/` directory)

### Step 1.1: Initialization
1. Initialize a new React project using Vite in the `inter-rater/` folder: `npm create vite@latest inter-rater -- --template react` (or `react-ts`).
2. Install Bootstrap 5 and any necessary CSV parsing libraries (e.g., `papaparse`): `npm install bootstrap papaparse`.
3. Configure `vite.config.js` with `base: './'` or the appropriate GitHub Pages sub-path so assets load correctly when deployed from the `dist/` folder.

### Step 1.2: Local Storage & State Management
1. Create a service layer (e.g., `StorageService.js`) to handle multiple review sessions.
2. **Schema Design:**
   * A "Session" object should contain: `sessionId` (timestamp or UUID), `filename` (original imported CSV name), `reviewerName`, `status` (e.g., 'in-progress', 'completed'), `lastModified`, `data` (array of row objects from CSV), and `currentIndex` (where the user left off).
3. The app must autosave the current session state to local storage immediately whenever a user makes a rating decision or advances a row.

### Step 1.3: Mobile-First User Interface (Bootstrap 5)
Create the following views/components:
1. **Dashboard:**
   * Lists all existing sessions (Active and Completed).
   * Provides a clear "Import New Review (CSV)" button.
   * Allows users to resume an 'in-progress' session, export a 'completed' session, or delete a session.
2. **Import Workflow:**
   * A file upload component that accepts CSV.
   * Prompts the user to enter their `reviewerName` (if not already in the CSV).
   * Validates that the CSV contains the required `Paper_ID` column.
3. **Review Screen (Mobile-First):**
   * **Data Display:** Show `Title`, `Abstract`, AI `decision`, AI `reasoning`, and any other crucial fields in a clean, scrollable card. Use accordions or tabs for long text if necessary to save vertical space.
   * **Input Controls:** Replicate the controls from `QualityCheckUI.html`. E.g., toggles/checkboxes for "Decision Agree", "Reasoning Valid", a dropdown for "Data Extraction Score", and a text area for "Critical Correction".
   * **Navigation:** "Previous" and "Next/Save" buttons fixed at the bottom of the screen for easy thumb access.
   * **Progress Indicator:** Show `Row X of Y`.
4. **Completion & Export:**
   * When the user reaches the end, prompt them to finalize the review.
   * Provide a "Download Finalized CSV" button. Use `papaparse` (or similar) to unparse the session `data` array back into a CSV file.

---

## Part 2: Enhancing the Apps Script Backend (`src/` directory)

### Step 2.1: Implement CSV Export
1. Add a menu item in `Main.js` under Title-Abstract and Full-Text Quality Check menus: "Export Quality Check to CSV".
2. In `QualityCheckController.js`, create an export function that:
   * Identifies the active quality check sheet (`02_titleabs_quality_check` or `04_fulltext_quality_check`).
   * Fetches all rows.
   * Generates a CSV string containing `Paper_ID`, context columns (`Title`, `Abstract`, `decision`, etc.), and the empty/partially filled `HUMAN_QC_` columns.
   * Creates a file in Google Drive or prompts the user to download the file directly using a temporary HTML dialog with a download link (or data URI).

### Step 2.2: Implement CSV Import / Sync
1. Add a menu item in `Main.js`: "Import Quality Check from CSV".
2. Create an HTML UI (`ImportQCUI.html`) containing a file picker or Google Drive picker.
3. In `QualityCheckController.js`, create a sync function that:
   * Parses the uploaded/selected CSV file.
   * Validates the presence of `Paper_ID`.
   * Iterates through the CSV rows. For each row:
     * Finds the matching row in the target Google Sheet using `Paper_ID`.
     * **Safety Check:** Ensure the match is exact. If a `Paper_ID` is missing in the sheet, log a warning but do not crash.
     * Updates **only** the `HUMAN_QC_` columns (`HUMAN_QC_Decision_Agree`, `HUMAN_QC_Reason_Valid`, `HUMAN_QC_Data_Extraction_Score`, `HUMAN_QC_Critical_Correction`). Do not overwrite `Title`, `Abstract`, or AI decisions.
   * Logs a summary of the sync operation (e.g., "Successfully updated 50 rows.").

### Step 2.3: Validation & Foolproofing
* **Frontend:**
  * Ensure the React app gracefully handles corrupted local storage by offering a way to clear data.
  * Warn the user before they delete an un-exported completed session.
* **Backend:**
  * Use batch operations (`getRange().setValues()`) if possible to avoid Google Sheets API rate limits when updating hundreds of rows during import.
  * Add error handling blocks (`try...catch`) around the sync process to prevent partial updates if an error occurs mid-sync.

## Development Workflow
1. Initialize the Vite app and commit the skeleton.
2. Develop the Apps Script Export functionality to get real test CSV data.
3. Build the React SPA using the test CSV data, focusing on the Dashboard, Import, Review Screen, and local storage state.
4. Export a finalized CSV from the SPA.
5. Develop the Apps Script Import/Sync functionality and test it against the finalized CSV.
6. Verify the UI across mobile and desktop viewports.
7. Build the SPA (`npm run build`) and verify the `inter-rater/dist` folder structure.