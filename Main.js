/**
 * SLR Magic - Main Entry Point
 * * Orchestrates the flow between Config, Drive, and Sheet modules.
 */

// --- Global Constants ---
const CONSTANTS = {
  SHEET_MANIFEST: "Manifest",
  SHEET_SCREENING: "First Screening",
  KEY_PDF_DB: "PDF Database",
  KEY_PDF_REPO: "PDF Repo",
  HEADER_TITLE: "title",
  HEADER_PDF: "PDF"
};

/**
 * Creates the menu when the spreadsheet opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SLR Magic')
    .addItem('Attach PDF', 'runAttachPdfWorkflow')
    .addToUi();
}

/**
 * The main workflow controller.
 */
function runAttachPdfWorkflow() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Use a shared toaster for UI feedback
  const toaster = (msg) => ss.toast(msg, "SLR Magic 🪄");

  try {
    // 1. Configuration Phase
    toaster("Reading Manifest...");
    const config = ConfigModule.load(ss);
    
    // 2. Data Gathering Phase
    toaster("Fetching PDF Database...");
    const csvData = DriveUtils.fetchCsvData(config.dbUrl);
    const titleToFilenameMap = DataProcessor.mapCsvData(csvData);

    toaster("Scanning Drive Folder...");
    const folderFiles = DriveUtils.scanFolder(config.repoUrl, toaster);
    
    // 3. Execution Phase
    toaster("Matching & Updating Sheets...");
    const updateStats = SheetUtils.updatePdfLinks(ss, titleToFilenameMap, folderFiles);

    // 4. Report
    toaster("Done!");
    ui.alert("SLR Magic Complete", 
      `Scanned ${folderFiles.size} files in repo.\nMatched ${updateStats.matches} PDFs to titles.`, 
      ui.ButtonSet.OK);

  } catch (e) {
    console.error(e);
    ui.alert("Error Encountered", e.message, ui.ButtonSet.OK);
  }
}