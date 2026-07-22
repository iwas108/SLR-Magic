# Inter-Rater SPA File & Function Directory (`files.md`)

This document serves as a comprehensive index of every file within the `inter-rater` module, detailing each file's specific function, architectural layer, and core purpose. This directory is specifically designed to assist coding agents in rapid codebase navigation, function searching, and architectural understanding.

---

## 1. Root Configuration & Documentation (`inter-rater/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `agents.md` | Governance / Directives | Master workspace directives and behavioral guidelines for coding agents operating in `inter-rater`. |
| `architecture.md` | Documentation | Module-scoped blueprint detailing the offline React SPA, IndexedDB synchronization schema, and component layout structure. |
| `improvements-log.md` | Documentation | Chronological log of incremental features, bug fixes, refactoring iterations, and optimizations with sequential IDs. |
| `package.json` | Dependency / Scripts | Defines NPM package dependencies, Tailwind v4 + `@tailwindcss/vite`, project metadata, and execution scripts (e.g., `dev`, `build`, `lint`). |
| `package-lock.json` | Dependency | Lockfile ensuring reproducible dependency tree installation across environments. |
| `vite.config.js` | Build Configuration | Vite bundler configuration including `@tailwindcss/vite` plugin, dev server port mappings, and React plugin integrations. |
| `eslint.config.js` | Linting Configuration | ESLint configuration file defining strict code quality rules and linting standards. |
| `index.html` | Entrypoint | Main HTML document housing the Vite SPA bundle mount point `<div id="root">`. |
| `README.md` | Documentation | General developer onboarding guide and quickstart instructions for the `inter-rater` SPA workspace. |
| `.gitignore` | Security / Git | Git exclusion rules preventing local dependencies, environment variables, and build outputs from leaking. |

---

## 2. Core Application Logic (`inter-rater/src/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `main.jsx` | Entrypoint | React application mount entrypoint initializing the main render loop onto the HTML root node. |
| `App.jsx` | Routing / Shell | Root application routing wrapper coordinating global theme states and view rendering switches. |
| `App.css` | Styling | Global application CSS styling definitions and CSS variables for light/dark themes. |
| `index.css` | Styling | Base CSS entrypoint importing Tailwind CSS v4 `@import "tailwindcss"`, platform HSL CSS theme tokens, and `@theme` mappings. |
| `StorageService.js` | Database / Services | Direct interface wrapping IndexedDB (via Dexie) for local storage, CRUD actions, session creation, paper validation, and export generation. |

---

## 3. UI Presentation Components (`inter-rater/src/components/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `Dashboard.jsx` | View Component | Project-wide Session Board featuring review session lists, overall progress meters, completion stats, export action controllers, direct Drag-and-Drop upload hero section for zero-project state, and quick dropzone for active projects. |
| `ImportWorkflow.jsx` | View Component | Ingestion wizard parsing imported `.slr` JSON review packages, verifying schemas, and adding records to the Dexie store. |
| `PreScreen.jsx` | View Component | Onboarding screen displaying research objectives, pre-calibration guidelines, and reviewer name registration prior to review start. |
| `ReviewScreen.jsx` | View Component | Viewport-locked split-screen editor integrating navigation headers, PDF embeds, abstract readers, keyboard event keybinds, and the evaluation form drawer. |
| `BlindedReviewForm.jsx` | Presentation Component | Encapsulated input form mapping decisions, exclusion criteria tags, quality scores, and data extractions to the active paper appraisal. |
| `PdfViewer.jsx` | View Component | Sandbox viewport rendering PDF documents locally from Blob URLs with double fail-soft fallbacks. |
| `features/modals/AutofillModal.jsx` | Modal Component | Standalone secret modal triggered via `Ctrl+J` providing direct JSON validation and mapping inputs to auto-fill the active review form. |

---

## 4. Static Media Assets (`inter-rater/src/assets/`)

| File Path | Architectural Layer | Function & Purpose |
| :--- | :--- | :--- |
| `hero.png` | Asset | Branding illustration displayed on the dashboard workspace views. |
| `react.svg` | Asset | React vector logo asset utilized in project templates. |
| `vite.svg` | Asset | Vite vector logo asset utilized in project templates. |
