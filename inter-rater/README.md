# SLR Magic: Inter-Rater Single-Page Application (SPA)

This is the mobile-first, offline-capable Inter-Rater Single-Page Application (SPA) for the SLR Magic tool. It allows reviewers to conduct human quality checks and resolve disagreements without needing to interact directly with the Google Apps Script UI or Google Sheets.

The app uses `localStorage` to manage review sessions, autosaving progress so users can pause and resume seamlessly. Data integrity is maintained strictly via a `Paper_ID` primary key.

## Architecture & Technologies
- **Frontend Framework:** React
- **Build Tool:** Vite
- **Styling:** Bootstrap 5
- **State Management:** `localStorage` for multiple, resumable sessions.
- **Data Exchange:** CSV import/export synchronized with the SLR Magic Google Apps Script backend.

---

## 🛠️ Installation & Local Development

To run the application locally on your machine:

1. **Navigate to the directory:**
   ```bash
   cd inter-rater
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   *The console will provide a local URL (e.g., `http://localhost:5173`) to view the app in your browser.*

---

## 🚀 Building & Deployment (GitHub Pages)

This application is configured to be hosted on GitHub Pages. The build process packages the source code into the `dist/` directory.

1. **Build the production application:**
   ```bash
   npm run build
   ```

2. **Deployment:**
   - The compiled static files will be located in the `inter-rater/dist/` folder.
   - Configure your repository's GitHub Pages settings to serve from the branch and path where the `dist/` folder is pushed.
   - Note: The `vite.config.js` is set up with `base: './'` to correctly resolve relative asset paths when hosted on GitHub Pages.

---

## 🔄 Workflow Instructions

### 1. Exporting Data from SLR Magic (Google Sheets)
- Open your SLR Magic Google Sheet.
- Under the **SLR Magic** menu, navigate to either **Title-Abstract Quality Check** or **Full-Text Quality Check**.
- Select **Export Quality Check to CSV** and download the file.

### 2. Using the SPA
- Open the hosted SPA (or your local dev server).
- On the **Dashboard**, click **Import New Review (CSV)** and upload the exported file.
- Enter your reviewer name if prompted.
- **Review Screen:** Navigate through papers and make your ratings (e.g., Agreement, Reason Validity). The app autosaves automatically.
- Once completed, click **Download Finalized CSV**.

### 3. Syncing Data Back to SLR Magic
- Return to your SLR Magic Google Sheet.
- Under the **SLR Magic -> Utilities** menu, select **Import Quality Check from CSV**.
- Upload the finalized CSV file. The backend will use `Paper_ID` to find matching rows and update **only** your human review columns (`HUMAN_QC_...`) without altering any AI reasoning or source text.