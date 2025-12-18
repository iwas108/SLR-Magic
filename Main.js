/**
 * SLR Magic - Main Entry Point
 * * Orchestrates the flow between Config, Drive, and Sheet modules.
 */

// --- Global Constants ---
const CONSTANTS = {

};

/**
 * Creates the menu when the spreadsheet opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SLR Magic')
    .addItem('Import Raw CSV', 'runImportRawCSV')
    .addToUi();
}

/**
 * The main workflow controller.
 */
function runImportRawCSV() {
  
}