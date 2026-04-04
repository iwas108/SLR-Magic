# PDF Helper Application

A step-by-step pipeline to manage research paper PDFs. This application follows a Clean Code Architecture approach and adheres to FAIR principles (Findable, Accessible, Interoperable, and Reusable) by standardizing the downloading, verifying, and compressing of scientific PDFs into an accessible layout.

## Features

1. **Web Scraping & PDF Download**: Reads `database.csv`, scrapes DOIs, and downloads PDFs via EzProxy. Uses `undetected_chromedriver` to bypass bot protections.
2. **Verify Downloaded PDFs**: Matches the downloaded PDF text against the expected title in the database using fuzzy matching to ensure correct downloads. Allows downloading the validation results as a CSV file.
3. **Compress PDFs**: Optimizes the file size of the downloaded PDFs using Ghostscript to save local and remote storage space.
4. **Sync to Google Drive**: Uses `rclone` to back up the compressed PDFs to a designated Google Drive remote.

## Project Structure

```
pdfhelper/
├── app/
│   ├── main.py                # FastAPI Application and Routes
│   ├── services/              # Core business logic separated by domain
│   │   ├── downloader.py      # Selenium-based downloading logic
│   │   ├── verifier.py        # PyMuPDF and thefuzz based verification
│   │   ├── compressor.py      # Ghostscript based compression
│   │   └── syncer.py          # Subprocess rclone syncing
│   └── templates/
│       └── index.html         # Bootstrap 5 Dashboard UI
├── requirements.txt           # Python dependencies
├── README.md                  # This documentation
└── database.csv               # Input database containing paper information (Needs to be provided)
```

## Prerequisites

1.  **Python 3.8+**
2.  **Chrome Browser**: Ensure you have Google Chrome installed. The scraper uses the latest Chrome engine.
3.  **Ghostscript**: Required for PDF compression.
    *   **Windows**: Download and install from [Ghostscript.com](https://ghostscript.com/releases/gsdnld.html). Ensure `gswin64c` or `gswin32c` is in your system PATH.
    *   **Linux**: `sudo apt install ghostscript`
    *   **macOS**: `brew install ghostscript`
4.  **rclone**: Required for syncing to Google Drive.
    *   Install from [rclone.org](https://rclone.org/).
    *   Configure a remote named `gdrive`. See rclone documentation on how to authenticate with Google Drive.

## Installation

1.  Navigate to the project directory:
    ```bash
    cd pdfhelper
    ```

2.  (Optional but recommended) Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  **Prepare Database**: Place your `database.csv` file in the root `pdfhelper` directory. It must contain at least `Paper_ID`, `Title`, `decision`, and `DOI_Link` columns as configured in the application.

2.  **Start the Server**:
    Run the FastAPI web server using uvicorn:
    ```bash
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```
    *(Alternatively, you can just run `python app/main.py` if configured)*

3.  **Access Dashboard**:
    Open your web browser and navigate to `http://localhost:8000`.

4.  **Follow the Steps**:
    Use the intuitive web interface to click through the pipeline:
    *   **Start Download**: Triggers the scraping process. Check the terminal for any login prompts or errors.
    *   **Start Verification**: Verifies the content. Click **Download Validation CSV** to see the results.
    *   **Start Compression**: Compresses the verified PDFs into a `compressed` folder.
    *   **Start Sync**: Uploads the `compressed` folder to your configured Google Drive.

## Configuration

Settings such as directories, delay intervals, fuzzy matching thresholds, and target Google drive paths are defined as classes within their respective service files in `app/services/`. Modify them directly to adjust the pipeline to your needs.

## Adherence to FAIR Principles
- **Findable**: Downloads and standardizes filenames using the specific `Paper_ID`.
- **Accessible**: Provides a unified web interface for operations and saves reports in standard CSV format.
- **Interoperable**: The pipeline utilizes universal standard formats (PDF, CSV).
- **Reusable**: The modular architecture allows swapping out the specific scraper logic or syncing mechanism without affecting the rest of the pipeline.
