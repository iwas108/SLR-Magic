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
    .addItem('Import PDF Files', 'presentPDFImportUI')
    .addItem('Import PDF Metadata (CSV)', 'runImportFileMetadata')
    .addItem('Manage Background PDF Import', 'managePDFImportTrigger')
    .addItem('Prepare Manual Download (Proxy Links)', 'runTransformDOILinks')
    .addItem('Start AI Full-Text Screening', 'runFullTextScreening')
    .addItem('Manage Background Screening (Full Text)', 'manageFullTextScreeningTrigger')
    .addSeparator()
    .addItem('Generate Quality Check List', 'generateQualityCheck')
    .addItem('Run Quality Check Assistant', 'runQualityCheck')
    .addItem('Calculate QC Score', 'calculateQCScore')
    .addSeparator()
    .addItem('Process Data Collection', 'runDataCollection')
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

/**
 * Shows the PDF Import UI.
 */
function presentPDFImportUI() {
  FullTextScreeningController.showPDFImportDialog();
}

/**
 * Runs the Metadata Import.
 */
function runImportFileMetadata() {
  FullTextScreeningController.runImportFileMetadata();
}

function runTransformDOILinks() {
  FullTextScreeningController.runTransformDOILinks();
}

function runFullTextScreening() {
  FullTextScreeningController.runScreening();
}

/**
 * Generates the sample list for Quality Check.
 * (Renamed from runQualityCheck)
 */
function generateQualityCheck() {
  QualityCheckController.generateQualityCheck();
}

/**
 * Opens the Assistant UI.
 */
function runQualityCheck() {
  QualityCheckController.runQualityCheck();
}

/**
 * Calculates and summarizes the quality check score.
 */
function calculateQCScore() {
  QualityCheckController.calculateQCScore();
}

/**
 * Processes data collection JSON in '04_data_collection'.
 */
function runDataCollection() {
  DataCollectionController.run();
}

/**
 * Wrapper for syncing PDFs to Gold Mine.
 */
function syncGoldMine() {
  return QualityCheckController.syncGoldMine();
}

/**
 * Server-side handler for getting data.
 */
function getQualityCheckData() {
  return QualityCheckController.getQualityCheckData();
}

/**
 * Server-side handler for saving data.
 */
function saveQualityCheckRow(paperId, data) {
  return QualityCheckController.saveQualityCheckRow(paperId, data);
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
 * Manages the background trigger for PDF Import.
 * Asks for Batch Size and Frequency.
 */
function managePDFImportTrigger() {
  const ui = SpreadsheetApp.getUi();
  const validMinutes = [1, 5, 10, 15, 30];
  const functionName = 'runImportPDFs';
  const jobName = 'PDF Import';

  // 1. Check existing status
  const triggers = ScriptApp.getProjectTriggers();
  let existingTrigger = null;
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === functionName) {
      existingTrigger = trigger;
      break;
    }
  }

  const currentBatchSize = PropertiesService.getScriptProperties().getProperty("PDF_IMPORT_BATCH_SIZE") || "Not Set";
  const statusMsg = existingTrigger
    ? `Current Status: ACTIVE (${jobName} is running)\nCurrent Batch Size: ${currentBatchSize}`
    : `Current Status: INACTIVE`;

  // 2. Prompt for Batch Size
  const batchPrompt = `${statusMsg}\n\n` +
    `Step 1: Enter BATCH SIZE (number of files to search per run).\n` +
    `Recommended: 20-50 to avoid timeouts.\n` +
    `Enter '0' or 'OFF' to disable background import.`;

  const batchResponse = ui.prompt(`${jobName} Setup (1/2)`, batchPrompt, ui.ButtonSet.OK_CANCEL);

  if (batchResponse.getSelectedButton() !== ui.Button.OK) {
    return; // Cancelled
  }

  const batchInput = batchResponse.getResponseText().trim().toUpperCase();

  // Handle OFF
  if (batchInput === '0' || batchInput === 'OFF') {
    if (existingTrigger) {
      ScriptApp.deleteTrigger(existingTrigger);
      ui.alert(`${jobName} has been DISABLED.`);
    } else {
      ui.alert(`${jobName} is already disabled.`);
    }
    return;
  }

  const batchSize = parseInt(batchInput);
  if (isNaN(batchSize) || batchSize <= 0) {
    ui.alert("Invalid Batch Size. Please enter a positive integer.");
    return;
  }

  // 3. Prompt for Frequency
  const freqPrompt = `Step 2: Enter run frequency in minutes (${validMinutes.join(", ")}).`;
  const freqResponse = ui.prompt(`${jobName} Setup (2/2)`, freqPrompt, ui.ButtonSet.OK_CANCEL);

  if (freqResponse.getSelectedButton() !== ui.Button.OK) {
    return; // Cancelled
  }

  const freqInput = freqResponse.getResponseText().trim();
  const minutes = parseInt(freqInput);

  if (isNaN(minutes) || !validMinutes.includes(minutes)) {
    ui.alert(`Invalid input. Please enter one of these values: ${validMinutes.join(", ")}`);
    return;
  }

  // 4. Save Settings and Create Trigger
  PropertiesService.getScriptProperties().setProperty("PDF_IMPORT_BATCH_SIZE", batchSize.toString());

  if (existingTrigger) {
    ScriptApp.deleteTrigger(existingTrigger);
  }

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyMinutes(minutes)
    .create();

  ui.alert(`${jobName} ENABLED.\nBatch Size: ${batchSize}\nFrequency: Every ${minutes} minutes.`);
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

/**
 * Server-side handler for getting abstract screening columns.
 */
function getAbstractScreeningColumns() {
  return FullTextScreeningController.getAbstractScreeningColumns();
}

/**
 * Server-side handler for getting unique values for a column.
 */
function getUniqueValuesForAbstractColumn(columnName) {
  return FullTextScreeningController.getUniqueValuesForColumn(columnName);
}

/**
 * Server-side handler for processing the copy operation.
 */
function processCopyScreenedPapers(columnName, includedValues, columnsToCopy) {
  return FullTextScreeningController.processCopyScreenedPapers(columnName, includedValues, columnsToCopy);
}
