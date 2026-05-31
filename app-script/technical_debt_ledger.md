# SLR Magic Technical Debt Ledger

This document tracks all broken dependencies, skeleton implementations, and refactoring items introduced during the structural epoch transitions.

## Resolved Debt

### 1. Ingestion Sheet Redirect (`00_Raw_Harvest` vs `01_abstract_screening`)
- **Status**: RESOLVED (Epoch 2).
- **Resolution**: `Initializer.js` now creates the `00_Raw_Harvest` sheet upon workspace initialization, and the CSV/manual ingestion functions in `Main.js` have been updated to write to `00_Raw_Harvest` exclusively.

### 2. Deprecated Script Properties Cleanup
- **Status**: RESOLVED (Epoch 2).
- **Resolution**: `Initializer.js` now executes a targeted purge of legacy script properties (e.g. `ABSTRACT_SCREENING_PROMPT`, `THE_GATEKEEPER_PROMPT`, etc.) when workspace initialization runs.

### 3. Disconnected Prompt References
- **Status**: RESOLVED (Epoch 5).
- **Resolution**: Refactored both `ScreeningController.js` and `FullTextScreeningController.js` to load prompt keys (`STAGE_1_PROMPT`, `STAGE_2_1_PROMPT`, etc.) dynamically from `ConfigManager`.

### 4. Phase 3: Sequential QC Audit Menu Placeholders
- **Status**: RESOLVED (Epoch 6).
- **Resolution**: Implemented QC Auditor batch sampling (`QC_Audit_Batch` sheet generation) and wired the blinded export/import `.slr` file flow and Kappa score reports.

### 5. Deduplication Bypass in Ingestion Hub
- **Status**: RESOLVED (Epoch 6).
- **Resolution**: Wired `ImportController.js` CSV and Snowballed import tasks to use double key (normalized DOI primary, stripped alphanumeric Title secondary) deduplication before adding records to `00_Raw_Harvest`.

---

## Active Refactoring Debt
*No active refactoring debt remaining. All epochs successfully refactored and verified.*
