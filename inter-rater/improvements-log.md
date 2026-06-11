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
