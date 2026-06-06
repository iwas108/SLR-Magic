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

**Indexes**:
*   `idx_papers_doi`: ON `papers(DOI)` (for fast duplicate checking during import).
*   `idx_papers_title`: ON `papers(Title)` (for fuzzy match lookup).

---

### Table: `projects`
Stores literature review projects metadata, target directories, and calibration pools configuration.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Unique identifier for the project |
| `name` | TEXT | NOT NULL | Name of the project |
| `folder_name` | TEXT | NOT NULL UNIQUE | Unique directory subfolder name inside `pdf_repo/` |
| `manifesto` | TEXT | | Description or manifesto of the project |
| `objective` | TEXT | | Research objective |
| `questions` | TEXT | | List of research questions |
| `qa_definition` | TEXT | | Quality assessment criteria definition |
| `exclusion_criteria` | TEXT | | Details of inclusion/exclusion rules |
| `pool_a_size` | INTEGER | DEFAULT 50 | Calibration pool A size percentage / count |
| `pool_b_size` | INTEGER | DEFAULT 30 | Calibration pool B size percentage / count |
| `pool_c_size` | INTEGER | DEFAULT 20 | Calibration pool C size percentage / count |
| `gdrive_dest_path` | TEXT | DEFAULT 'SLR_Magic/PDFs' | Custom destination folder path on Google Drive |
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

## 2. Schema Incremental Changes

### Baseline (2026-06-05)
*   Initial creation of `papers` and `configs` tables.
*   Added index on `papers(DOI)` and `papers(Title)`.

### Multi-Project & Ingestion Updates (2026-06-05)
*   Added `projects` table to hold multi-project metadata, custom calibration sizes, and Google Drive upload path configs.
*   Added `Project_ID` column to the `papers` table to scope papers within projects.
*   Updated default `Local_PDF_Status` of `papers` to `'IGNORED'`.

