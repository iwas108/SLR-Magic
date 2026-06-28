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
| `Status` | TEXT | NOT NULL DEFAULT 'PENDING' | Status matching Google Sheet: `PENDING`, `INCLUDE`, `EXCLUDE`, etc. |
| `Local_PDF_Status` | TEXT | NOT NULL DEFAULT 'IGNORED' | Status of local PDF: `IGNORED`, `MISSING`, `MATCHED`, `DOWNLOADED`, `SYNCED` |
| `Local_PDF_Path` | TEXT | | Local path to PDF file if available |
| `Project_ID` | TEXT | | Reference link to the project |
| `Parent_Paper_ID` | TEXT | | Optional reference link to parent paper for snowballing chaining |
| `calibration_pool` | TEXT | | Target calibration partition: `pool_a`, `pool_b`, `pool_c` |
| `calibration_tag` | TEXT | | Selected custom tag code for this calibration cohort |
| `Human_Decision` | TEXT | | Reviewer decision input: `INCLUDE`, `EXCLUDE`, `QA_WAIT` |
| `Human_EC_Trigger` | TEXT | | Reviewer exclusion criteria trigger code |
| `Human_Rationale` | TEXT | | Reviewer annotation or explanation notes |
| `Original_Publisher` | TEXT | | Original publisher string imported from CSV |
| `Publisher` | TEXT | | Mapped and normalized publisher name |
| `Human_QA_Scores` | TEXT | | JSON string containing QA rules mapped to values and evidence |
| `Human_Extracted_Data` | TEXT | | JSON string containing extractions mapped to values and evidence |
| `is_duplicate` | INTEGER | DEFAULT 0 | Flag indicating if this paper is an excluded duplicate (1) or not (0) |
| `merged_into_id` | TEXT | DEFAULT NULL | Scoped reference pointing to the primary Paper_ID if this is a duplicate |

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
| `created_at` | TEXT | NOT NULL | Timestamp of creation |

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
*   `GHOSTSCRIPT_PATH`: ``

---

### Table: `reviewer_decisions`
Stores individual reviewer decisions for double-blind calibration (Pool A).

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

