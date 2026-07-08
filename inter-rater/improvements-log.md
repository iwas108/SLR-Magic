# SLR Magic Inter-Rater: Improvements Log

This document tracks all changes, refactors, and feature additions applied to the **SLR Magic Inter-Rater SPA** module.

---

## [#001] Giga-Refactor & SLR-IDE Integration - 2026-06-11

- **Vite SPA Re-Route**: Migrated systematic review workflow connection from Google Apps Script (GAS) to local `slr-ide` Next.js desktop workspace.
- **Project Name Schema Fix**: Added robust fallback checks inside the database layer to resolve and persist the project name regardless of formatting variables (`projectName`, `Project_Name`, `project_name`, `name`).
- **Strict Blinded Review Blinding**:
  - Removed "Reviewer Name" input variables from the import wizard and the pre-screening page.
  - Eliminated "Reviewer" displays on the dashboard table cells.
  - Hardcoded empty strings for legacy reviewer attributes on database saves and file exports.
- **Premium Dashboard UI/UX Refactor**:
  - Replaced the card grid view with a highly performant, paginated, searchable, and sortable table view.
  - Added clean summary stats cards: Active Projects, Ingested Papers, Completed Appraisals, and Overall Progress.
- **Viewport-Locked Split Screen Review Panel**:
  - Refactored `ReviewScreen.jsx` and `BlindedReviewForm.jsx` to lock the layout height (`h-[calc(100vh-140px)]`) and overflow behavior.
  - Enabled independent scrollbars for the Abstract reading panel and the Blinded Evaluation Form to eliminate browser scrollbar nesting.

## [#002] Premium Active Review Redesign & Blinded Form Redesign - 2026-06-11

- **CAL_Pool_A Blinded Interface Redesign**:
  - Hid the empty abstract tab panel for CAL_Pool_A, rendering the Exclusion Criteria guidelines checklist directly on the left side of the split screen.
  - Implemented window-level keyboard screening shortcuts (`I` for Include, `E` for Exclude, `1` to `9` to select exclusion rule codes, and Arrow/Enter keys for paper navigation) with forms typing safety checks.
  - Added a visual keyboard shortcuts legend in the bottom sticky action bar.
  - Fixed a reference to an undefined `project_name` variable in the Research Cookbook modal reference.
- **Blinded Review Form Premium Styling**:
  - Redesigned the "Include" and "Exclude" decision segmented actions into card-styled selector blocks with hover transitions, background accent glows, and interactive indicator check/cross circles.
  - Redesigned the Exclusion Trigger selector buttons as clean list-card components with left-hand radio check indicators, inline code badges, and keyboard shortcut hints.
  - Standardized the CAL_Pool_A `.slr` JSON schema (snake_case project metadata and 6-key whitelisted paper metadata) and documented it in `architecture.md`.

## [#003] Abstract Metadata Inclusion & Page-Level Scrolling - 2026-06-11

- **Abstract Key Support**:
  - Expanded `CAL_Pool_A` paper metadata to allow the `Abstract` key (now a strict 7-key whitelisted schema).
  - Modified the Next.js export API (`export/inter-rater/route.ts`) to include and export `Abstract` text.
  - Updated `StorageService.js` to whitelist `Abstract` on ingestion (`createSession` and `updateSessionData`) and preserve it on export (`exportSession`).
- **Page-Level Scrolling UX Refactor**:
  - Removed viewport height constraints (`h-[calc(100vh-140px)]`) and overflow locks (`overflow-hidden`) from the main review layout in `ReviewScreen.jsx`.
  - Discarded nested, independent panel scrollbars in both left details/abstract panels and right evaluation form columns, letting pages scroll naturally with browser scrollbars.
  - Stacks Abstract and Exclusion Criteria rules sequentially in the left panel for Pool A sessions, allowing easy vertical scanning.
  - Updated Pool A review header subtitle to display "Title, Year & Abstract Mode".
- **Documentation**:
  - Updated standardized Pool A `.slr` schemas and UI/UX design definitions in both module-level and system-level blueprints (`architecture.md`).

## [#004] System Architecture Alignment & Module Redefinition - 2026-06-11

- **Module Redefinition**:
  - Formally integrated `inter-rater` as one of the three active modules of SLR Magic in `agents.md`.
  - Documented the role of `slr-ide` as the comprehensive workflow hub and `app-script` strictly as a FAIR-compliant database storage sink.
  - Specified deprecated legacy folders (`llm-proxy` and `pdfhelper`) for future removal.
- **Architectural Update**:
  - Refactored architecture blueprints (`architecture.md`) to represent the new local-first, laptop-focused architecture using file-based synchronization (`.slr` and `.csv`) and dropping complex network infrastructures (VPN, HAProxy).

## [#005] Reviewer Name Prompt & localStorage Caching - 2026-06-11

- **Reviewer Identity Prompting**:
  - Implemented an Export Identity Modal prompting for the reviewer's short name upon clicking "Export Results".
  - Automatically appends a unique 4-character random hex suffix (e.g. `shortname_a8f2`) and previews the generated identity token live.
- **Identity Caching**:
  - Implemented `localStorage` caching of the confirmed reviewer identifier under key `slr_reviewer_identity` to prepopulate subsequent export prompts.
  - Passed the confirmed identifier to `StorageService.exportSession` to inject `reviewer_name` directly into the exported `.slr` metadata block.

## [#006] Calibration Refactor, PDF Viewer, & Layout/Shortcuts Optimization - 2026-07-07

- **Pool-Adaptive Calibration Context**:
  - Refactored `PreScreen.jsx` and the Research Cookbook modal in `ReviewScreen.jsx` to dynamically render calibration details per pool type.
  - Pool B displays the Quality Assurance Definition.
  - Pool C displays the Quality Assurance Definition, QA Scoring Rules, and the Data Extraction Schema.
- **Embedded Fallback PDF Reader**:
  - Created a new `PdfViewer.jsx` component implementing a tiered fallback mechanism (Native `<iframe>` → Google Docs viewer proxy → Error state with external browser fallback).
  - Integrated this viewer into a new "Full-Text PDF Reader" tab inside the left details panel of the review interface for Pool B and C.
- **Viewport-Locked Dual-Scroll Layout**:
  - Combined the session header details, autosave status, progress counter, cookbook button, and theme selection directly into a unified top navigation bar, saving ~80px of vertical space.
  - Implemented viewport-locked independent scrolling (`h-screen overflow-hidden` wrapper in `App.jsx` + flex-1 content area in `ReviewScreen.jsx`) so left details/reader panels and right dynamic forms scroll separately with a non-overlapping bottom action bar.
  - Simplified Pool A layout by removing EC guidelines from the left panel (since they exist dynamically in the form) and granting the Abstract full container height.
- **Comprehensive Keyboard Shortcuts**:
  - Added new quick action shortcuts: `R` to toggle the Research Cookbook reference modal, `P` to focus the PDF viewer tab (Pool B/C), `A` to switch back to the Abstract tab, `Escape` to close active overlays, and `Ctrl+S` to simulate manual save comfort feedback.
  - Refactored shortcuts legend in the bottom action bar.
- **Documentation**:
  - Logged file index modifications in `slr-ide/files.md` and updated component list details in `architecture.md`.

## [#007] Embedded Offline PDF Integration & Blob URL Renderer - 2026-07-07

- **Base64 PDF Export (`slr-ide`)**:
  - Refactored Next.js inter-rater export API route in `slr-ide` to dynamically read local downloaded PDFs from disk and append their raw data encoded in Base64 under the `PDF_Base64` field.
- **IndexedDB Ingestion (`inter-rater`)**:
  - Added `PDF_Base64` to `STANDARD_METADATA_KEYS` in `StorageService.js` to ensure the Base64 field is safely stored in IndexedDB on SLR session imports.
- **Offline Blob URL Rendering (`inter-rater`)**:
  - Updated `PdfViewer.jsx` to dynamically convert `PDF_Base64` into a same-origin local `Blob` URL.
  - Implemented automatic object URL cleanup using a `useEffect` cleanup hook to prevent memory leaks when switching papers or unmounting.
  - Configured conditional tab validation in `ReviewScreen.jsx` to show the full-text PDF reader tab if either `PDF_Link` or `PDF_Base64` is populated.

## [#008] Full-Screen PDF Reader Layout & Sliding Evaluation Drawer - 2026-07-07

- **Clutter-Free Left-Aligned Tab Sidebar**:
  - Removed the top paper metadata block from the main review page.
  - Moved the horizontal tab navigation into a left-aligned vertical tabs sidebar (w-48) with descriptive icons. This maximizes the vertical viewport height for the PDF viewer.
  - Added a new **ℹ️ Paper Details** tab displaying Title, Year, Authors, DOI, and Original PDF link in a clean structured layout.
  - Enabled the unified tab layout across all pools (including Pool A) and made the **Exclusion Rules (EC)** tab visible for Pool A. Special for CAL_Pool_A, the Paper Details tab link is hidden, and all metadata is rendered directly inside the **Abstract** tab above the abstract text.
- **Full-Width Main Content**:
  - Removed the two-column grid layout, making the PDF Reader/Abstract panel take up 100% of the screen width for a comfortable reading experience.
  - Removed the "Viewer Mode" and "Open in Browser" header bar from `PdfViewer.jsx`, letting the PDF reader iframe fill the entire vertical and horizontal viewport area of the container.
- **Sliding side drawer**:
  - Moved the Blinded Evaluation form into a fixed-position sliding side drawer that appears from the right.
  - Added a backdrop click-away behavior and close header to dismiss the drawer.
  - Placed a premium Floating Action Button (FAB) at the bottom-right corner to toggle the drawer.
- **Integrated Shortcuts**:
  - Configured `Space / V` to toggle the drawer, and `Esc` to close the drawer or cookbook.
  - Programmatically set `I` (Include) or `E` (Exclude) to automatically open the side drawer with the decision preselected and focus the reasoning text area.

## [#009] Nested QA Scores & Data Extraction Support for Pool C Reviews - 2026-07-07

- **Session Metadata Persistence**:
  - Refactored `StorageService.js` (`createSession` and `updateSessionData`) to persist `qa_rules` and `extraction_rules` array objects into the session's metadata block inside Dexie DB on import.
- **Nested State Updater**:
  - Implemented `handleNestedDynamicChange` callback inside `ReviewScreen.jsx` to dynamically update sub-objects (`Human_QA_Scores` and `Human_Extracted_Data`) for the active paper and write the updates to the local database.
- **Structured Form Inputs for Pool C**:
  - Refactored `BlindedReviewForm.jsx` to dynamically render dedicated Quality Assessment (QA) scoring sections (using 1.0, 0.5, 0.0 buttons + justification evidence) and Data Extraction parameter sections (using text inputs + justification evidence) for each custom rule when reviewing a Pool C paper.
- **Session Validation & Progress Meter**:
  - Updated completion verification in `StorageService.js` and `isPaperValid` in `ReviewScreen.jsx` to validate that every custom QA score and data extraction field is completed with valid rationale before marking a Pool C paper as completed.

## [#010] Refine Pool C Evaluation Form and Add Schema Preview Tabs - 2026-07-07

- **Removed Reasoning Textarea for Pool C**:
  - Excluded the general "Reviewer Reasoning / Rationale" text box from `BlindedReviewForm.jsx` for Pool C papers (since justifications are captured at the rule-level).
  - Updated basic validation in `StorageService.js` and `isPaperValid` in `ReviewScreen.jsx` to allow Pool C papers to be valid without general rationale.
- **Rule Question Fields Rendering**:
  - Added rendering for `rule.question` directly under rule labels in the Quality Assessment (QA) Scoring and Data Extraction blocks in `BlindedReviewForm.jsx`.
## [#011] Pool C Scoring Logic and IndexedDB Reload Fix - 2026-07-07

- **IndexedDB Reload Fix**:
  - Fixed a ReferenceError bug inside `StorageService.js` `getSessions()` where the code referenced `poolType` outside of its declared scope, causing page reloads to fail and display an empty dashboard. Defined `poolType` within the session mapping loop.
- **Form Scoring Logic Block**:
  - Rendered configured scoring logic descriptions (1.0, 0.5, 0.0) inside `BlindedReviewForm.jsx` below the score segmented buttons for Pool C reviews.
- **QA Schema Tab Update**:
  - Updated the QA Schema preview tab in `ReviewScreen.jsx` to render the custom scoring logic details directly under the question text for each quality assessment rule.
- **QA/Extraction Schema Visibility Fix**:
  - Resolved schema visibility bug in `PreScreen.jsx` and `ReviewScreen.jsx` (Cookbook reference modal & tab filters) by normalizing the pool type matching logic to support both `pool_x` and `CAL_Pool_X` formats.
- **QA/Extraction Schema Empty Cards Fix**:
  - Fixed a bug where the QA Scoring Rules and Data Extraction Schema preview cards displayed blank content. Mapped the components to display the correct `rule.question` property instead of nonexistent properties like `rule.title`, `rule.label`, or `rule.description`, and included custom scoring logic details.
- **QA Score Button Click Selection Fix**:
  - Fixed a bug inside `BlindedReviewForm.jsx` where clicking on `1.0` and `0.0` score buttons successfully updated the database state but failed to toggle the visual highlight state in the DOM. Replaced string-based comparison (`'1' === '1.0'`) with safe numeric comparison (`Number(item.value) === Number(val)`).

## [#012] Fix EACCES Permission Denied Port Error - 2026-07-08

- **Vite Port Re-routing**:
  - Configured Vite's `server.port` to `3001` in `vite.config.js` to circumvent port `5173` which lies inside Windows/Hyper-V/WinNAT's default excluded port ranges (`5141-5240`). This avoids the `listen EACCES: permission denied 0.0.0.0:5173` crash.

## [#013] PDF Viewer State Preservation & Iframe Src Warning Fix - 2026-07-08

- **Iframe Empty Src Warning Fix**:
  - Refactored `PdfViewer.jsx` to avoid rendering the iframe element when the compiled embed URL is empty/null (e.g. while base64 string conversion to Blob URL is in progress). This prevents the browser warning regarding empty strings passed to the `src` attribute.
- **PDF Scroll State Preservation**:
  - Re-architected tab viewport rendering in `ReviewScreen.jsx` to keep the `PdfViewer` component permanently mounted in the DOM when a PDF exists, toggling its visibility via style display toggle (`display: block` or `display: none`) instead of conditionally unmounting it. This preserves the scroll position and prevents page/iframe reload cycles when the user toggles between the PDF reader and other metadata/abstract tabs.

## [#014] Blinded Evaluation Sidebar Scroll State Preservation - 2026-07-08

- **Sidebar Scroll State Caching**:
  - Added a ref `prevScrollTop` and attached a ref `drawerScrollRef` to the scrollable container of the `BlindedReviewForm` inside the sliding side drawer.
  - Cached the active scroll height when closing the evaluation drawer, and restored it upon opening.
  - Configured `focus({ preventScroll: true })` when focusing input/textarea fields on drawer open to prevent the browser from snapping the scroll back to the focused element.
  - Reset the scroll position cache back to `0` when switching active papers to ensure a clean evaluation state.
