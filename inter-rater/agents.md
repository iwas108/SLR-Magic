# Inter-Rater SPA Refactoring: Blinded Review Implementation

This document provides detailed, step-by-step instructions for refactoring the Inter-Rater Single Page Application (SPA).
The current SPA is designed for a "Quality Control" (QC) workflow where the user sees the AI's decisions and grades them.
We are changing the entire workflow to a **Blinded Review**, where the human reviewer does *not* see the AI's decision, and instead makes an independent determination based on the paper's title and abstract (or full text) and the project's research context.

**CRITICAL DIRECTIVES:**
*   **Prevent Hallucination/Oversized Tasks:** Execute these phases sequentially. Do not jump ahead. Verify the functionality of each phase before proceeding to the next.
*   **Architecture:** Adhere strictly to Clean Code Architecture and FAIR principles. Use functional React components, hooks, and standard Tailwind CSS utility classes.
*   **Data Structure:** The backend Google Apps Script (`InterRaterController.js`) exports `.slr` (JSON) files containing `metadata` and blinded `papers`. The SPA must read this, collect reviewer input, and export it back in a compatible format.

---

## Phase 1: Update Data Model & Storage (`StorageService.js` & `ImportWorkflow.jsx`)

**Goal:** Modify how the application parses and stores session data so it can accommodate project metadata, reviewer details, and the new required fields.

1.  **Update `StorageService.js`:**
    *   Ensure the session object structure can store top-level `metadata` (Project Name, Research Questions, Inclusion/Exclusion Criteria) extracted from the imported `.slr` JSON file.
    *   Ensure the session object can store a `reviewerName` string.
    *   *Verification:* Check that creating and updating a session with these new fields persists correctly in `localStorage`.

2.  **Update `ImportWorkflow.jsx`:**
    *   The imported file will be a JSON file with a `.slr` extension.
    *   Parse the JSON. It will have the structure: `{ metadata: { ... }, papers: [ { Paper_ID: "...", Title: "...", Abstract: "..." }, ... ] }`.
    *   Ensure the `papers` array is correctly mapped to the session's data. Note that `decision`, `reasoning`, and AI QC fields will *not* be present in the imported `papers` array, as they are stripped by the backend export script.
    *   *Verification:* Import a mock `.slr` file and verify `console.log` shows the correct `metadata` and `papers` being saved to `StorageService`.

---

## Phase 2: Create Pre-Screen Context UI

**Goal:** Before a user begins reviewing papers in a session, they must be presented with the research context and asked for their name.

1.  **Create a Pre-Screen Component (e.g., `PreScreen.jsx` or an addition to `Dashboard.jsx`/`ReviewScreen.jsx` initialization):**
    *   When a user clicks "Continue" or "Start" on a session from the Dashboard, intercept the navigation.
    *   Display the `metadata` loaded from the session:
        *   Project Name
        *   Research Questions
        *   Inclusion Criteria
        *   Exclusion Criteria
    *   Add an input field: "Reviewer Name".
    *   If `reviewerName` is already saved in the session, pre-fill it.
    *   Require the user to enter their name before the "Start Reviewing" button becomes active.
2.  **State Management:**
    *   Save the `reviewerName` to the session via `StorageService.updateSession()`.
    *   Transition to the actual `ReviewScreen.jsx` only after this step is complete.
    *   *Verification:* Start a session, view the metadata, enter a name, and verify the name is saved to local storage before the review screen appears.

---

## Phase 3: Refactor `ReviewScreen.jsx` for Blinded Review

**Goal:** Remove the old Quality Control interface and implement the independent Blinded Review interface.

1.  **Remove Old QC Fields:**
    *   Strip out the "AI Decision & Reasoning" expandable section completely. The reviewer *must not* see this.
    *   Remove all `HUMAN_QC_*` fields (Agree with AI, Reasoning is Valid, Data Extraction Score, Critical Correction).
2.  **Implement Blinded Review Fields:**
    *   **Reviewer Decision:** Add a mandatory radio button group or dropdown for the inclusion decision. Options must be strictly: `Include` and `Exclude`. Map this to a state/field named `Reviewer_Decision`.
    *   **Reviewer Reasoning:** Add a mandatory textarea for the reviewer to explain their choice. Map this to a state/field named `Reviewer_Reasoning`.
    *   **Reviewer Confidence:** Add a numeric selector (1 to 5) or a star-rating style input. Label it "Confidence Score (1=Low, 5=High)". Map this to a state/field named `Reviewer_Confidence`.
3.  **State and Validation Updates:**
    *   Update `handleInputChange` to modify these new fields (`Reviewer_Decision`, `Reviewer_Reasoning`, `Reviewer_Confidence`).
    *   (Optional but recommended): Prevent the user from clicking "Next" if they haven't made a Decision and provided Reasoning.
4.  **UI/UX Improvements:**
    *   Keep the Title and Abstract prominently displayed.
    *   Ensure the styling uses existing Tailwind dark/light mode patterns.
    *   *Verification:* Open a session in the Review Screen. Verify no AI decisions are visible. Fill out the new Decision, Reasoning, and Confidence fields. Click Next, then Previous, and verify the values are retained.

---

## Phase 4: Update Export Workflow

**Goal:** Ensure the finalized review session exports data in a format the Apps Script backend expects.

1.  **Modify the Export Functionality (likely in `Dashboard.jsx` or a dedicated export util):**
    *   When the user clicks "Download Results" or completes a session, generate a JSON file (or CSV, depending on how `Dashboard.jsx` is currently implemented, but JSON `.slr` is preferred to mirror the import).
    *   The exported payload should be a JSON string of the completed data.
    *   Crucially, ensure the following fields exist for every paper row exported:
        *   `Paper_ID`
        *   `Reviewer_Name` (pulled from the session state established in Phase 2)
        *   `Reviewer_Decision` (Include/Exclude)
        *   `Reviewer_Reasoning`
        *   `Reviewer_Confidence`
2.  **Format Compliance:**
    *   Ensure the exported keys match exactly what the Apps Script `InterRaterController.js` `processImport` function expects (`Paper_ID`, `Reviewer_Name`, `Reviewer_Decision`, `Reviewer_Reasoning`).
    *   *Verification:* Complete a dummy review session. Download the result file. Inspect the file to ensure `Reviewer_Name`, `Decision`, `Reasoning`, and `Confidence` are present for the reviewed rows, and that AI fields are entirely absent.

---

## Phase 5: Code Cleanup & FAIR Verification

**Goal:** Final polish to adhere to Clean Code Architecture.

1.  **Component Cleanliness:**
    *   Ensure components are small and focused. If `ReviewScreen.jsx` has become too large, extract the input form into a separate `BlindedReviewForm.jsx` component.
2.  **Tailwind consistency:**
    *   Verify all newly added UI elements (Pre-Screen, new inputs) support dark mode using the `dark:` variant.
3.  **Remove Dead Code:**
    *   Search for any remaining variables or functions referencing `QC`, `Data_Extraction_Score`, or `Agree`. Remove them completely to prevent future confusion.
    *   *Verification:* Run the app locally, switch between light and dark modes, and ensure there are no React console warnings regarding missing keys or uncontrolled inputs.