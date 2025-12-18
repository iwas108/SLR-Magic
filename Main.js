/**
 * SLR Magic - Main Entry Point
 * * Orchestrates the flow between Config, Drive, and Sheet modules.
 */

/**
 * Creates the menu when the spreadsheet opens.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SLR Magic')
    .addItem('Import Raw CSV', 'runImportRawCSV')
    .addItem('Start AI Title-Abstract Screening', 'runScreening')
    .addToUi();
}

/**
 * The main workflow controller wrapper.
 * Needs to be a top-level function to be assigned to a menu item.
 */
function runImportRawCSV() {
  ImportController.run();
}

function runScreening() {
  ScreeningController.run();
}
