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
    .addSeparator()
    .addItem('Start AI Title-Abstract Screening', 'runScreening')
    .addItem('Manage Background Screening (Abstract)', 'manageScreeningTrigger')
    .addSeparator()
    .addItem('Copy Screened Title-Abstract', 'runCopyScreenedPapers')
    .addItem('Import PDF Files', 'runImportPDFs')
    .addItem('Start AI Full-Text Screening', 'runFullTextScreening')
    .addItem('Manage Background Screening (Full Text)', 'manageFullTextScreeningTrigger')
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

function runCopyScreenedPapers() {
  FullTextScreeningController.runCopyScreenedPapers();
}

function runImportPDFs() {
  FullTextScreeningController.runImportPDFs();
}

function runFullTextScreening() {
  FullTextScreeningController.runScreening();
}

/**
 * Manages the background screening trigger for Abstract Screening.
 */
function manageScreeningTrigger() {
  manageTrigger('runScreening', 'Abstract Screening');
}

/**
 * Manages the background screening trigger for Full Text Screening.
 */
function manageFullTextScreeningTrigger() {
  manageTrigger('runFullTextScreening', 'Full-Text Screening');
}

/**
 * Generic function to manage triggers.
 */
function manageTrigger(functionName, jobName) {
  const ui = SpreadsheetApp.getUi();
  const validMinutes = [1, 5, 10, 15, 30];

  // 1. Check existing status
  const triggers = ScriptApp.getProjectTriggers();
  let existingTrigger = null;
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === functionName) {
      existingTrigger = trigger;
      break;
    }
  }

  const statusMsg = existingTrigger
    ? `Current Status: ACTIVE (${jobName} is running)`
    : `Current Status: INACTIVE`;

  // 2. Prompt User
  const promptMsg = `${statusMsg}\n\n` +
    `Enter run frequency in minutes (${validMinutes.join(", ")}).\n` +
    `Or enter '0' or 'OFF' to disable background screening.`;

  const response = ui.prompt(`${jobName} Setup`, promptMsg, ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() !== ui.Button.OK) {
    return; // Cancelled
  }

  const input = response.getResponseText().trim().toUpperCase();

  // 3. Handle "OFF"
  if (input === '0' || input === 'OFF') {
    if (existingTrigger) {
      ScriptApp.deleteTrigger(existingTrigger);
      ui.alert(`${jobName} has been DISABLED.`);
    } else {
      ui.alert(`${jobName} is already disabled.`);
    }
    return;
  }

  // 4. Handle Number
  const minutes = parseInt(input);
  if (isNaN(minutes) || !validMinutes.includes(minutes)) {
    ui.alert(`Invalid input. Please enter one of these values: ${validMinutes.join(", ")}`);
    return;
  }

  // 5. Update Trigger
  // Remove old one first if exists
  if (existingTrigger) {
    ScriptApp.deleteTrigger(existingTrigger);
  }

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyMinutes(minutes)
    .create();

  ui.alert(`${jobName} ENABLED. Running every ${minutes} minutes.`);
}
