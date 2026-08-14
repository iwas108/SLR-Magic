<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


### 3.4 Refactoring & Tree Shaking
*   **Mandatory Tree Shaking**: Whenever a coding agent refactors large monolithic files or extracts components/hooks, the agent **MUST** perform rigorous tree-shaking and compilation checks (`npx tsc --noEmit`). 
*   Always remove dead code, unused states, unused imports, and duplicate variable declarations left behind after extracting logic.
*   Do not leave fragmented code blocks that cause silent failures or typescript errors.

### 3.5 Isolation of Double-Blind Calibration Adjudication
*   **Calibration Data Sandbox**: The double-blind calibration adjudication tables (`reviewer_decisions`, `calibration_commit_ledger`, and `calibration_papers`) and columns (`manual_decision`, `manual_rationale`, `manual_quality_assessment`, `manual_extracted_data`, `manual_stage` on `calibration_papers`) are standalone modules strictly reserved for prompt and agreement calibration.
*   **Zero Integration Policy**: Do NOT connect, source, or reference these tables or columns inside the general screening pipeline (such as fast filter, gatekeeper, scientist, or miner), general database view/filtering, or main paper details editing/sourcing flows.
*   **Manual Screening Precedence**: General human overrides during manual review MUST exclusively use the manual screening columns (`manual_decision`, `manual_rationale`, `manual_quality_assessment`, `manual_extracted_data` on `papers`) and the corresponding `manual_audit_log` table.

### 3.6 Strict Multi-Project Separation & Isolation Policy
*   **Absolute Multi-Project Isolation**: Every SQL query (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `JOIN`, or subquery) operating on project-tied database tables (`papers`, `reviewer_decisions`, `calibration_commit_ledger`, `calibration_papers`, `manual_audit_log`, `llm_audit_log`, `duplicate_pairs`, `rolling_batches`, `rolling_batch_papers`, `rolling_batch_reviewer_decisions`, `rolling_batch_commit_ledger`, `umbrellanizer_results`) **MUST** explicitly include and enforce `Project_ID = ?` (or `project_id = ?` / `CAST(project_id AS TEXT) = CAST(? AS TEXT)`).
*   **Zero Un-scoped Queries**: Coding agents **MUST NEVER** execute database reads, updates, deletes, or subqueries on paper records, audit logs, calibration tables, or rolling batch tables without filtering by `Project_ID` / `project_id`.
*   **Subquery & JOIN Alignment**: When writing correlated subqueries or `JOIN` conditions involving `llm_audit_log`, `manual_audit_log`, `calibration_commit_ledger`, or `rolling_batch_papers`, coding agents **MUST** explicitly link project IDs in the `JOIN ON` clause (e.g., `AND l.project_id = p.Project_ID` or `AND CAST(latest.project_id AS TEXT) = CAST(l.project_id AS TEXT)`).
*   **Zero Default-Project & Mandatory Project Lock Screen**: `'default-project'` is deprecated and MUST NOT be used as a synthetic fallback. All project-tied operations require a valid user-created or migrated project ID (`proj-*`). If zero projects exist or no active project is selected, the application MUST present a Project Lock Screen forcing project creation/selection before any workspace features are accessible.
*   **Cascading Project Deletion**: When deleting a project, all associated records in all 11 project-tied tables **MUST** be deleted inside an atomic SQLite transaction filtered strictly by `Project_ID` / `project_id`.
*   **Vector Search & Scraper Allowlisting**: FAISS vector search engines (`vector_worker.py`, `semantic_search.py`), PDF integrity verification tools (`verify_pdfs.py`), and scraper scripts (`scrape_pdfs.py`, `match_cache.py`) **MUST** restrict candidate allowlists and file updates strictly to the active `project_id`.
*   **Remote Worker Result Scoping**: Callbacks handling PDF download or scrape results (`remote-worker/result/route.ts`) **MUST** resolve the target paper's `Project_ID` and include `AND Project_ID = targetProjectId` on all database updates to prevent cross-project state corruption.



