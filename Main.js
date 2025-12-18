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
    .addItem('Enable Background Screening (Every 10 mins)', 'createScreeningTrigger')
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

/**
 * Creates a time-driven trigger to run screening in the background.
 * Checks for Pending items and runs every 10 minutes.
 * Can be called manually or by a user setup.
 */
function createScreeningTrigger() {
  // Check if trigger already exists to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'runScreening') {
      SpreadsheetApp.getUi().alert('Screening trigger already exists.');
      return;
    }
  }

  ScriptApp.newTrigger('runScreening')
    .timeBased()
    .everyMinutes(10)
    .create();

  SpreadsheetApp.getUi().alert('Background screening trigger created. It will run every 10 minutes.');
}
