# SLR IDE SQLite Database Schema

This document outlines the schema design and database migrations for the local SQLite database used in SLR IDE.

## Database File
*   **Path**: `slr-ide/db/slr.db` (Excluded from git via `.gitignore`).

---

## 1. Schema Tables

### Table: `papers`
Stores paper metadata, screening decisions, local matching details, and cloud links.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Paper_ID` | TEXT | PRIMARY KEY | Unique paper identifier (deterministic Author_Year_TitleStart_Hash) |
| `Import_Date` | TEXT | NOT NULL | Date when the paper was imported (YYYY-MM-DD) |
| `Import_Source` | TEXT | NOT NULL | Name of the source file or source of import |
| `Source` | TEXT | | Core database source (e.g., Scopus, Web of Science) |
| `DOI` | TEXT | | Digital Object Identifier (normalized) |
| `Title` | TEXT | NOT NULL | Cleaned title of the paper |
| `Abstract` | TEXT | | Abstract content |
| `Authors` | TEXT | | Authors list |
| `Year` | INTEGER | | Publication year |
| `PDF_Link` | TEXT | | Public Google Drive link or download URL |
| `Local_PDF_Status` | TEXT | NOT NULL DEFAULT 'IGNORED' | Status of local PDF: `IGNORED`, `MISSING`, `INACCESSIBLE`, `MATCHED`, `DOWNLOADED`, `SYNCED`, `IN_PROGRESS`, `FAILED`, `NEEDS_REVIEW` |
| `Local_PDF_Path` | TEXT | | Local path to PDF file if available |
| `Project_ID` | TEXT | | Reference link to the project |
| `Parent_Paper_ID` | TEXT | | Optional reference link to parent paper for snowballing chaining |
| `Original_Publisher` | TEXT | | Original publisher string imported from CSV |
| `Publisher` | TEXT | | Mapped and normalized publisher name |
| `citation_count` | INTEGER | DEFAULT 0 | Count of citations ("Cited by") for the paper |
| `is_duplicate` | INTEGER | DEFAULT 0 | Flag indicating if this paper is an excluded duplicate (1) or not (0) |
| `merged_into_id` | TEXT | DEFAULT NULL | Scoped reference pointing to the primary Paper_ID if this is a duplicate |
| `ai_stage` | INTEGER | DEFAULT 0 | AI screening stage code (0=unscreened, 1=fast filter, 2=gatekeeper, 3=scientist, 4=miner) |
| `ai_decision` | TEXT | | AI screening decision (`INCLUDE`, `EXCLUDE` or `PENDING`) |
| `ai_exclusion_code` | TEXT | | Target AI exclusion criterion code if decision is EXCLUDE (e.g. `EC-1`) |
| `ai_rationale` | TEXT | | AI screening explanation notes |
| `ai_quality_assessment` | TEXT | | JSON string containing AI quality appraisal scores and evidence |
| `ai_extracted_data` | TEXT | | JSON string containing AI extracted data and variables |
| `manual_stage` | INTEGER | DEFAULT 0 | Manual screening stage code (0=unscreened, 1=fast filter, 2=gatekeeper, 3=scientist, 4=miner) |
| `manual_decision` | TEXT | | Manual screening decision (`INCLUDE`, `EXCLUDE` or `PENDING`) |
| `manual_exclusion_code` | TEXT | | Target manual exclusion criterion code if decision is EXCLUDE (e.g. `EC-1`) |
| `manual_rationale` | TEXT | | Manual screening annotation/explanation notes |
| `manual_quality_assessment` | TEXT | | JSON string containing manual quality appraisal scores and evidence |
| `manual_extracted_data` | TEXT | | JSON string containing manual extracted data and evidence |
| `remote_worker_id` | TEXT | DEFAULT NULL | UUID of the remote worker that claimed this paper |
| `scrape_claimed_at` | TEXT | DEFAULT NULL | Timestamp when the paper was claimed by a remote worker |

---

### Table: `calibration_papers`
Holds sandbox paper copies for inter-rater double-blind calibration. Shares the exact same columns as the `papers` table (above), but includes extra pool scoping properties:

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `calibration_pool` | TEXT | | Target calibration partition: `pool_a`, `pool_b`, `pool_c` |
| `calibration_tag` | TEXT | | Selected custom tag code for this calibration cohort |


**Indexes**:
*   `idx_papers_doi`: ON `papers(DOI)` (for fast duplicate checking during import).
*   `idx_papers_title`: ON `papers(Title)` (for fuzzy match lookup).
*   `idx_papers_is_duplicate`: ON `papers(is_duplicate)` (for excluding duplicate papers in database and pagination).
*   `idx_papers_merged_into`: ON `papers(merged_into_id)` (for tracking trace hierarchy and data lineage).

---

### Table: `projects`
Stores literature review projects metadata, target directories, and calibration pools configuration.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique identifier for the project |
| `name` | TEXT | NOT NULL | Name of the project |
| `folder_name` | TEXT | NOT NULL UNIQUE | Unique directory subfolder name inside `pdf_library/repo/` |
| `manifesto` | TEXT | | Description or manifesto of the project |
| `objective` | TEXT | | Research objective |
| `questions` | TEXT | | List of research questions |
| `qa_definition` | TEXT | | Quality assessment criteria definition |
| `exclusion_criteria` | TEXT | | Details of inclusion/exclusion rules |
| `pool_a_size` | INTEGER | DEFAULT 50 | Calibration pool A size percentage / count |
| `pool_b_size` | INTEGER | DEFAULT 30 | Calibration pool B size percentage / count |
| `pool_c_size` | INTEGER | DEFAULT 20 | Calibration pool C size percentage / count |
| `gdrive_dest_path` | TEXT | DEFAULT 'SLR_Magic/PDFs' | Custom destination folder path on cloud storage |
| `cloud_provider` | TEXT | DEFAULT 'gdrive' | Active cloud provider for project: 'gdrive' or 'onedrive' |
| `rclone_remote_name` | TEXT | | Cloud provider specific remote configuration name in Rclone |
| `pool_tags` | TEXT | | JSON string storing Pool A, Pool B, and Pool C tag arrays |
| `ec_rules` | TEXT | | JSON string storing Exclusion Criteria rules for blinded review |
| `reasoning_template` | TEXT | | JSON string storing rationale templates array for blinded review |
| `pool_b_ec_rules` | TEXT | | JSON string storing Pool B Exclusion Criteria rules |
| `pool_b_reasoning_template` | TEXT | | JSON string storing Pool B rationale templates array |
| `pool_c_qa_rules` | TEXT | | JSON string storing Pool C Quality Appraisal rules |
| `pool_c_extraction_rules` | TEXT | | JSON string storing Pool C Data Extraction rules |
| `project_budget_limit` | REAL | DEFAULT 0.0 | Budget limit allocated for LLM inference on this project |
| `project_current_spend` | REAL | DEFAULT 0.0 | Running accumulation of LLM inference spend |
| `llm_config` | TEXT | DEFAULT '{}' | JSON string storing project-scoped LLM provider configurations |
| `created_at` | TEXT | NOT NULL | Timestamp of creation |

---

### Table: `llm_pricing`
Stores base token pricing and batch discount parameters across supported LLM providers.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `model_id` | TEXT | PRIMARY KEY | Model identifier (e.g., `gemini-1.5-pro`, `gpt-4o`, `claude-3-5-sonnet-latest`) |
| `provider` | TEXT | NOT NULL | Provider name (`gemini`, `openai`, `claude`) |
| `input_token_price` | REAL | NOT NULL | Cost in USD per 1M input tokens |
| `output_token_price` | REAL | NOT NULL | Cost in USD per 1M output tokens |
| `thinking_token_price` | REAL | | Cost in USD per 1M thinking tokens |
| `batch_discount` | REAL | DEFAULT 0.5 | Multiplier discount for batch API execution |
| `updated_at` | TEXT | NOT NULL | Timestamp of last price adjustment |

---

### Table: `prompt_templates`
Stores user and system prompt seeds for automated screening, extraction, and evaluation.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique prompt template identifier |
| `project_id` | TEXT | | Reference to `projects(id)` (null if global template) |
| `name` | TEXT | NOT NULL | Display name of the prompt template |
| `description` | TEXT | | Description of prompt intent |
| `prompt_type` | TEXT | | Pipeline stage classification (`fast_filter`, `gatekeeper`, `scientist`, `miner`, `umbrellanizer`) |
| `system_instruction` | TEXT | | Core system prompt guidelines and JSON output schema definition |
| `user_template` | TEXT | NOT NULL | User prompt containing mustache-like interpolation tags |
| `response_schema` | TEXT | | Standardized baseline JSON schema constraining Gemini output format |
| `llm_config` | TEXT | DEFAULT '{}' | Model parameters configuration (`model_id`, `temperature`, `max_tokens`, `top_p`, `top_k`, `execution_mode`, `thinking_level`) |
| `is_active` | INTEGER | DEFAULT 1 | Active status flag (1 = active, 0 = archived) |
| `created_at` | TEXT | NOT NULL | Timestamp of creation |
| `updated_at` | TEXT | NOT NULL | Timestamp of last edit |

**Foreign Keys**:
*   `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`

---

### Table: `llm_jobs`
Stores active and historical LLM screening, extraction, and batch inference jobs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique job identifier |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `model_id` | TEXT | NOT NULL | Reference to `llm_pricing(model_id)` |
| `mode` | TEXT | NOT NULL | Execution mode (`screen`, `extract`, `batch`) |
| `status` | TEXT | NOT NULL | Current status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`) |
| `total_papers` | INTEGER | NOT NULL | Number of papers in the target cohort |
| `processed_papers` | INTEGER | DEFAULT 0 | Count of successfully evaluated papers |
| `total_input_tokens` | INTEGER | DEFAULT 0 | Cumulative input tokens consumed |
| `total_output_tokens` | INTEGER | DEFAULT 0 | Cumulative output tokens generated |
| `total_thinking_tokens` | INTEGER | DEFAULT 0 | Cumulative thinking tokens consumed |
| `total_cost` | REAL | DEFAULT 0.0 | Calculated running spend in USD |
| `error_message` | TEXT | | Capture of fatal failure stack trace or API error |
| `created_at` | TEXT | NOT NULL | Timestamp of job initialization |
| `updated_at` | TEXT | NOT NULL | Timestamp of last state change |

**Foreign Keys**:
*   `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`

---

### Table: `llm_batch_jobs`
Stores cloud provider specific batch processing metadata and file identifiers.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique batch record key |
| `job_id` | TEXT | NOT NULL | Reference to `llm_jobs(id)` |
| `provider` | TEXT | NOT NULL | LLM provider name |
| `cloud_batch_id` | TEXT | | Cloud provider's remote batch ID |
| `status` | TEXT | NOT NULL | Remote cloud batch status |
| `input_file_id` | TEXT | | Remote JSONL input file upload ID |
| `output_file_id` | TEXT | | Remote JSONL output results file ID |
| `submitted_at` | TEXT | NOT NULL | Timestamp of submission to cloud provider |
| `checked_at` | TEXT | | Timestamp of last status poll |
| `completed_at` | TEXT | | Timestamp of remote completion |

**Foreign Keys**:
*   `FOREIGN KEY(job_id) REFERENCES llm_jobs(id) ON DELETE CASCADE`

---

### Table: `llm_audit_log`
Stores immutable audit trails of all LLM interactions, decisions, and token costs.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique audit log ID |
| `paper_id` | TEXT | | Reference to `papers(Paper_ID)` |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `job_id` | TEXT | | Reference to batch `llm_jobs` if applicable |
| `interaction_id` | TEXT | | Upstream provider interaction/generation ID |
| `previous_interaction_id` | TEXT | | For chaining multi-turn context |
| `model_id` | TEXT | NOT NULL | LLM model used |
| `task_type` | TEXT | NOT NULL | e.g. `fast_filter`, `gatekeeper`, `scientist` |
| `input_tokens` | INTEGER | DEFAULT 0 | Input token count |
| `output_tokens` | INTEGER | DEFAULT 0 | Output token count |
| `thinking_tokens` | INTEGER | DEFAULT 0 | Thinking token count |
| `cached_tokens` | INTEGER | DEFAULT 0 | Cached token count |
| `total_tokens` | INTEGER | DEFAULT 0 | Total token count |
| `cost_usd` | REAL | DEFAULT 0.0 | Calculated cost |
| `flex_discount` | REAL | DEFAULT 0.0 | Discount applied |
| `speed_mode` | TEXT | DEFAULT 'FLEX' | e.g. 'FLEX', 'FAST' |
| `prompt_hash` | TEXT | | Hash of the raw prompt |
| `raw_prompt` | TEXT | | Full prompt sent to LLM |
| `raw_response` | TEXT | | Full raw text response from LLM |
| `response_schema_name` | TEXT | | Expected JSON schema name |
| `structured_output` | TEXT | | Extracted JSON payload |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' | Status: `SUCCESS`, `ERROR`, etc. |
| `error_message` | TEXT | | Error details if failed |
| `error_code` | TEXT | | Provider error code |
| `latency_ms` | INTEGER | | Time taken to generate response |
| `retry_count` | INTEGER | DEFAULT 0 | Number of retries |
| `api_version` | TEXT | | API version used |
| `created_at` | TEXT | NOT NULL | Timestamp |

**Foreign Keys**:
*   `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`

**Indexes**:
*   `idx_audit_project`: ON `llm_audit_log(project_id)`
*   `idx_audit_paper`: ON `llm_audit_log(paper_id)`
*   `idx_audit_job`: ON `llm_audit_log(job_id)`

---

### Table: `manual_audit_log`
Stores immutable audit trails of all manual screening decisions per stage.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique audit log ID |
| `paper_id` | TEXT | NOT NULL | Reference to `papers(Paper_ID)` |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `manual_stage` | TEXT | NOT NULL | e.g. `fast_filter`, `gatekeeper`, `scientist` |
| `decision` | TEXT | NOT NULL | The manual decision (`INCLUDE`, `EXCLUDE`, `QA_WAIT`) |
| `ec_trigger` | TEXT | | Exclusion criteria trigger code |
| `rationale` | TEXT | | Manual annotation notes |
| `qa_scores` | TEXT | | JSON string containing QA rules mapped to values and evidence |
| `extracted_data` | TEXT | | JSON string containing extractions mapped to values and evidence |
| `created_at` | TEXT | NOT NULL | Timestamp of decision |

**Foreign Keys**:
*   `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`
*   `FOREIGN KEY(paper_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE`

**Indexes**:
*   `idx_manual_audit_project`: ON `manual_audit_log(project_id)`
*   `idx_manual_audit_paper`: ON `manual_audit_log(paper_id)`

---

### Table: `remote_workers`
Stores registered remote worker nodes for distributed PDF scraping.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique UUID identifier for the worker |
| `label` | TEXT | NOT NULL | User-facing display name (e.g., "Laptop B") |
| `host` | TEXT | NOT NULL | Worker HTTP server URL (e.g., "http://192.168.1.42:7291") |
| `session_token` | TEXT | | Bearer token generated during pairing (NULL if not paired) |
| `status` | TEXT | NOT NULL DEFAULT 'OFFLINE' | Current worker status: `OFFLINE`, `IDLE`, `SCRAPING`, `WAITING_LOGIN`, `ERROR` |
| `last_seen_at` | TEXT | | ISO timestamp of the last successful heartbeat poll |
| `is_enabled` | INTEGER | NOT NULL DEFAULT 1 | Whether the worker is active (1) or paused (0) |
| `created_at` | TEXT | NOT NULL | Timestamp of registration |

---

### Table: `configs`
Stores user configurations, scraping settings, and cloud sync paths.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `key` | TEXT | PRIMARY KEY | Configuration key |
| `value` | TEXT | NOT NULL | Configuration value (stored as JSON if structure is complex) |

**Default Configurations**:
*   `SCRAPER_PROXY_BASE_URL`: `https://ezproxy.library.domain.com/login?url=https://doi.org/`
*   `SCRAPER_DELAY_SECONDS`: `20`
*   `SCRAPER_JITTER_SECONDS`: `5`
*   `SCRAPER_HEADED_MODE`: `false`
*   `SCRAPER_CHROME_PROFILE_DIR`: `./chrome_profile`
*   `RCLONE_EXECUTABLE_PATH`: `rclone`
*   `RCLONE_REMOTE_NAME`: `gdrive`
*   `RCLONE_CONFIG_PATH`: `` (Empty by default, will scan standard system paths)
*   `FUZZY_MATCH_THRESHOLD`: `90`
*   `OCR_ENABLED`: `false`
*   `TESSERACT_PATH`: `tesseract`
*   `PDF_COMPRESSION_ENABLED`: `false`
*   `PDF_COMPRESSION_LEVEL`: `/ebook`
*   `PDF_COMPRESSION_EMBED_ALL_FONTS`: `true`
*   `PDF_COMPRESSION_SUBSET_FONTS`: `true`
*   `GHOSTSCRIPT_PATH`: ``
*   `SEMANTIC_MATCH_THRESHOLD`: `0.65`
*   `EMBEDDING_MODEL`: `nomic-ai/nomic-embed-text-v1.5`
*   `REMOTE_WORKER_BATCH_SIZE`: `10`
*   `REMOTE_WORKER_LOCAL_SCRAPER_ENABLED`: `true`

---

### Table: `reviewer_decisions`
Stores individual reviewer decisions for double-blind calibration (Pool A, Pool B, Pool C).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record key |
| `paper_id` | TEXT | NOT NULL | Reference to `papers(Paper_ID)` |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `pool` | TEXT | NOT NULL DEFAULT 'pool_a' | Calibration pool identification |
| `reviewer_name` | TEXT | NOT NULL | Unique reviewer name formatted as `shortname_xxxx` |
| `decision` | TEXT | | Reviewer decision: `Include` or `Exclude` |
| `ec_trigger` | TEXT | | Exclusion criteria rule trigger code |
| `rationale` | TEXT | | Strategic annotation / rationale notes |
| `imported_at` | TEXT | NOT NULL | Timestamp of import |
| `qa_scores` | TEXT | | JSON string containing reviewer's QA scores |
| `extracted_data` | TEXT | | JSON string containing reviewer's extractions |

**Unique Constraints**:
*   `UNIQUE(paper_id, project_id, pool, reviewer_name)`

**Foreign Keys**:
*   `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`
*   `FOREIGN KEY(paper_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE`

**Indexes**:
*   `idx_rd_paper`: ON `reviewer_decisions(paper_id, project_id)`
*   `idx_rd_reviewer`: ON `reviewer_decisions(reviewer_name, project_id)`

---

### Table: `calibration_commit_ledger`
Stores immutable audit log tracking adjudication commits and auto-adjudication import histories.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record key |
| `commit_hash` | TEXT | NOT NULL | 8-character SHA-256 commit hash |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `paper_id` | TEXT | NOT NULL | Reference to `papers(Paper_ID)` |
| `pool` | TEXT | NOT NULL DEFAULT 'pool_a' | Calibration pool identification |
| `adjudicator` | TEXT | NOT NULL | Name of adjudicator or system import source |
| `previous_state` | TEXT | NOT NULL | JSON string representation of paper's prior decision state |
| `resolved_decision` | TEXT | NOT NULL | Decision committed (e.g. `Include`, `Exclude`) |
| `resolved_ec` | TEXT | | Exclusion criterion triggered, if any |
| `resolved_rationale` | TEXT | NOT NULL | Final strategic rationale annotating the choice |
| `commit_message` | TEXT | NOT NULL | Git-like commit comment |
| `timestamp` | TEXT | NOT NULL | ISO date-time string of resolution |
| `resolved_qa_scores` | TEXT | | JSON string containing resolved QA scores |
| `resolved_extracted_data` | TEXT | | JSON string containing resolved extractions |

**Foreign Keys**:
*   `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`
*   `FOREIGN KEY(paper_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE`

**Indexes**:
*   `idx_ledger_project`: ON `calibration_commit_ledger(project_id)`

---

### Table: `duplicate_pairs`
Stores potential duplicate pairs identified by the fuzzy heuristic matching engine for human-in-the-loop review.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record key |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `paper1_id` | TEXT | NOT NULL | Reference to first paper in comparison (`papers(Paper_ID)`) |
| `paper2_id` | TEXT | NOT NULL | Reference to second paper in comparison (`papers(Paper_ID)`) |
| `similarity_score` | REAL | NOT NULL | Fuzzy match token set ratio (0.0 to 100.0) |
| `shared_authors_count` | INTEGER | NOT NULL | Number of overlapping Scopus Author IDs / author last names |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' | Review status: `PENDING`, `FALSE_FLAG`, `CONFIRMED_DUPLICATE` |
| `keep_paper_id` | TEXT | | ID of the primary paper kept during resolution |
| `exclude_paper_id` | TEXT | | ID of the duplicate paper excluded during resolution |
| `created_at` | TEXT | NOT NULL | Timestamp of pair detection |

**Foreign Keys**:
*   `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`
*   `FOREIGN KEY(paper1_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE`
*   `FOREIGN KEY(paper2_id) REFERENCES papers(Paper_ID) ON DELETE CASCADE`

**Indexes**:
*   `idx_dp_project_status`: ON `duplicate_pairs(project_id, status)` (for filtering active duplicates)

---

### Table: `rolling_batches`
Tracks the lifecycle of rolling audit batches.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique UUID identifier for the batch |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `batch_number` | INTEGER | NOT NULL | Sequential batch number within project |
| `status` | TEXT | NOT NULL DEFAULT 'pending_review' | State: `pending_review`, `awaiting_adjudication`, `complete` |
| `created_at` | TEXT | NOT NULL | Timestamp of creation |
| `finalized_at` | TEXT | | Timestamp when adjudication was finalized |

---

### Table: `rolling_batch_papers`
Holds snapshots of papers selected for a rolling batch. Shares exact schema parity with the `papers` (and `calibration_papers`) table, mapped to specific batches.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `Paper_ID` | TEXT | PRIMARY KEY (with `batch_id`) | Unique paper identifier |
| `batch_id` | TEXT | NOT NULL | Reference to `rolling_batches(id)` |
| `batch_number` | INTEGER | NOT NULL | Sequential batch number |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| *Other columns* | | | Shares all metadata/decision/extraction columns of the `papers` table |

---

### Table: `rolling_batch_reviewer_decisions`
Stores individual reviewer decisions for rolling batch double-blind review.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record key |
| `batch_id` | TEXT | NOT NULL | Reference to `rolling_batches(id)` |
| `batch_number` | INTEGER | NOT NULL | Sequential batch number |
| `paper_id` | TEXT | NOT NULL | Reference to `rolling_batch_papers(Paper_ID)` |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `reviewer_name` | TEXT | NOT NULL | Unique reviewer shortname |
| `qa_scores` | TEXT | | JSON string containing reviewer's QA scores |
| `extracted_data` | TEXT | | JSON string containing reviewer's extractions |
| `imported_at` | TEXT | NOT NULL | Timestamp of import |

---

### Table: `rolling_batch_commit_ledger`
Tracks immutable audit trail for rolling batch adjudication commits.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique record key |
| `commit_hash` | TEXT | NOT NULL | 8-character SHA-256 commit hash |
| `batch_id` | TEXT | NOT NULL | Reference to `rolling_batches(id)` |
| `batch_number` | INTEGER | NOT NULL | Sequential batch number |
| `project_id` | TEXT | NOT NULL | Reference to `projects(id)` |
| `paper_id` | TEXT | NOT NULL | Reference to `rolling_batch_papers(Paper_ID)` |
| `adjudicator` | TEXT | NOT NULL | Name of adjudicator or system import source |
| `previous_state` | TEXT | NOT NULL | JSON string representation of paper's prior decision state |
| `resolved_qa_scores` | TEXT | | JSON string of resolved consensus QA scores |
| `resolved_extracted_data` | TEXT | | JSON string of resolved consensus extractions |
| `commit_message` | TEXT | NOT NULL | Commit comment/adjudication message |
| `timestamp` | TEXT | NOT NULL | ISO datetime of resolution |

---


## 2. Schema Incremental Changes

### Baseline (2026-06-05)
*   Initial creation of `papers` and `configs` tables.
*   Added index on `papers(DOI)` and `papers(Title)`.

### Multi-Project & Ingestion Updates (2026-06-05)
*   Added `projects` table to hold multi-project metadata, custom calibration sizes, and Google Drive upload path configs.
*   Added `Project_ID` column to the `papers` table to scope papers within projects.
*   Updated default `Local_PDF_Status` of `papers` to `'IGNORED'`.

### Pre-Calibration, Snowballing & Cloud Sync Updates (2026-06-11)
*   Added `Parent_Paper_ID` column to the `papers` table to enable hierarchical parent-child snowballing chains.
*   Added `cloud_provider` and `rclone_remote_name` columns to the `projects` table to support scoped Microsoft OneDrive and Google Drive configurations.
*   Added `calibration_pool` (`pool_a`, `pool_b`, `pool_c`) and human reviewer classification fields (`Human_Decision`, `Human_EC_Trigger`, `Human_Rationale`) columns to the `papers` table.
*   Added `calibration_tag` column to the `papers` table and `pool_tags` JSON config column to the `projects` table to persist custom decision classification tagging.
*   Added `ec_rules` and `reasoning_template` JSON config columns to the `projects` table to support Inter-Rater Blinded Review configuration.

### Inter-Rater Adjudication & Ledger Updates (2026-06-11)
*   Added `reviewer_decisions` table to store double-blind reviewer inputs with foreign key cascades.
*   Added `calibration_commit_ledger` table to record audit log files of calibration commits with foreign key cascades.
*   Added indexes `idx_rd_paper`, `idx_rd_reviewer`, and `idx_ledger_project`.
*   Enforced database connection busy timeout of `5000ms` and `PRAGMA foreign_keys = ON` in application database context wrapper.

### Pool B & Pool C Inter-Rater Dashboard Updates (2026-06-24)
*   Added `Human_QA_Scores` and `Human_Extracted_Data` columns to the `papers` table.
*   Added `qa_scores` and `extracted_data` columns to the `reviewer_decisions` table.
*   Added `resolved_qa_scores` and `resolved_extracted_data` columns to the `calibration_commit_ledger` table.

### Heuristic Duplicate Detection & Adjudication Pipeline (2026-06-25)
*   Added `is_duplicate` and `merged_into_id` columns to `papers` table.
*   Added `duplicate_pairs` table to hold potential duplicate pairs and status.
*   Added indexes `idx_papers_is_duplicate`, `idx_papers_merged_into`, and `idx_dp_project_status`.

### Manual Screening Pipeline Migration (2026-07-12)
*   Added `manual_decision`, `manual_ec_trigger`, `manual_rationale`, `manual_stage`, `manual_qa_scores`, and `manual_extracted_data` columns to `papers` table to support manual screening data collection.

### Distributed Remote Scraper (2026-07-12)
*   Added `remote_workers` table.
*   Added `remote_worker_id` and `scrape_claimed_at` columns to `papers`.
*   Added `IN_PROGRESS` as a valid status for `Local_PDF_Status`.
*   Added `REMOTE_WORKER_BATCH_SIZE` and `REMOTE_WORKER_LOCAL_SCRAPER_ENABLED` keys to `configs` defaults.

### Calibration Cleanup & Human Columns Removal (2026-07-18)
*   Deprecated and removed all legacy `Human_Decision`, `Human_EC_Trigger`, `Human_Rationale`, `Human_QA_Scores`, and `Human_Extracted_Data` columns from the `papers` table.
*   Routed all calibration reviewer consensus data flows to use the existing `manual_decision`, `manual_rationale`, `manual_quality_assessment`, `manual_extracted_data`, and `manual_stage` columns on the `calibration_papers` table.

### Schema Split: Exclusion Codes Migration (2026-07-18)
*   Split combined `ai_decision` and `manual_decision` values (e.g. `EXCLUDE (EC-1)`) into clean decisions (`INCLUDE`/`EXCLUDE`) and dedicated `ai_exclusion_code` / `manual_exclusion_code` columns.
*   Applied changes to both `papers` and `calibration_papers` tables.

### Rolling Batch Post-Validation Update (2026-07-19)
*   Added `rolling_batches` table to track lifecycle of rolling audit batches.
*   Added `rolling_batch_papers` table to hold snapshots of papers in a batch.
*   Added `rolling_batch_reviewer_decisions` table to store double-blind reviewer responses.
*   Added `rolling_batch_commit_ledger` table to record immutable adjudication audit trail.
*   Added `rolling_batch_size` column (INTEGER, default 20) to `projects` table.


