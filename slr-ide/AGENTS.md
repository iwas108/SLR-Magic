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


