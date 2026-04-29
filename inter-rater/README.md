# SLR Magic: Inter-Rater Single-Page Application (SPA)

This is the mobile-first, offline-capable Inter-Rater Single-Page Application (SPA) for the SLR Magic tool. It allows reviewers to conduct independent **Blinded Reviews** without needing to interact directly with the Google Apps Script UI or Google Sheets. The human reviewer makes determinations based on the paper's title and abstract (or full text) and the project's research context, without seeing any prior AI decisions.

The app uses `localStorage` to manage review sessions, autosaving progress so users can pause and resume seamlessly. Data integrity is maintained strictly via a `Paper_ID` primary key.

## Architecture & Technologies
- **Frontend Framework:** React
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** `localStorage` for multiple, resumable sessions.
- **Data Exchange:** JSON (`.slr` format) import/export synchronized with the SLR Magic Google Apps Script backend.

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
   - Note: The `vite.config.js` is set up with `base: '/SLR-Magic/inter-rater/dist/'` to correctly resolve relative asset paths when hosted on GitHub Pages for this specific repository.

---

## 🔄 Workflow Instructions

### 1. Exporting Data from SLR Magic (Google Sheets)
- Open your SLR Magic Google Sheet.
- Run the backend export script from the SLR Magic menu to generate the blinded review dataset.
- This will export a JSON file with a `.slr` extension containing the project metadata and a 50/50 stratified random sampling of papers with all AI decisions stripped out (Zero-Trust Blinded Review).

### 2. Using the SPA
- Open the hosted SPA (or your local dev server).
- On the **Dashboard**, click **Import New Review** and upload the `.slr` (JSON) file.
- **Pre-Screen:** Before starting, you will be presented with the research context (Project Name, Research Questions, Inclusion/Exclusion Criteria). You must enter your Reviewer Name to proceed.
- **Review Screen:** Navigate through papers and independently evaluate them. For each paper, you must provide:
  - **Reviewer Decision:** Include or Exclude.
  - **Reviewer Reasoning:** A mandatory text explanation for your choice.
  - **Reviewer Confidence:** A score from 1 (Low) to 5 (High).
  - *Note: AI decisions and reasoning are entirely hidden.*
- The app autosaves automatically.
- Once all papers are reviewed, click **Download Results** to generate the finalized `.slr` (JSON) file.

### 3. Syncing Data Back to SLR Magic
- Return to your SLR Magic Google Sheet.
- Use the Apps Script import utility to upload the finalized `.slr` file.
- The backend uses the `Paper_ID` primary key to merge the human review data safely without altering the original source text or AI reasoning.