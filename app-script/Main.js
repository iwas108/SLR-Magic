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
    .addSubMenu(SpreadsheetApp.getUi().createMenu('⚙️ Setup & Configuration')
        .addItem('Initialize Workspace', 'runInitialization')
        .addItem('Configure Settings', 'showConfigurationDialog')
        .addItem('Project Cost Preview', 'showCostPreviewDialog')
        .addItem('About SLR-Magic', 'showWelcomeDialog'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🧪 Phase 1: Pre-Calibration')
        .addItem('Assign Papers to Pools', 'runAssignToPools')
        .addSeparator()
        .addItem('Export Blinded Review Sample (.slr)', 'exportTitleAbsInterRater')
        .addItem('Import Blinded Results Sample (.slr)', 'importTitleAbsInterRater')
        .addItem('Calculate Inter-Rater Score', 'calculateTitleAbsInterRaterScore'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🚀 Phase 2: Autonomous Execution')
        .addItem('Run Stage 1: Abstract Screening', 'runStage1AbstractScreening')
        .addItem('Manage Stage 1 Trigger', 'manageStage1Trigger')
        .addSeparator()
        .addItem('Run Stage 2.1: Gatekeeper', 'runStage21Gatekeeper')
        .addItem('Run Stage 2.2: Scientist', 'runStage22Scientist')
        .addItem('Run Stage 2.3: Miner', 'runStage23Miner')
        .addSeparator()
        .addItem('Manage Stage 2.1 Trigger', 'manageStage21Trigger')
        .addItem('Manage Stage 2.2 Trigger', 'manageStage22Trigger')
        .addItem('Manage Stage 2.3 Trigger', 'manageStage23Trigger'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('⚖️ Phase 3: Sequential QC Audit')
        .addItem('Generate QC Audit Batch', 'runQCAuditorChecks')
        .addItem('Export Blinded QC Review (.slr)', 'exportQCAuditBatch')
        .addItem('Import Blinded QC Results (.slr)', 'importQCAuditBatch')
        .addItem('Calculate QC Inter-Rater Score', 'calculateQCAuditScore'))
    .addSubMenu(SpreadsheetApp.getUi().createMenu('📊 Phase 4: Synthesis & Visuals')
        .addItem('Umbrellanizer (Data Categorizer)', 'runUmbrellanizer')
        .addItem('Process Data Collection', 'runDataCollection')
        .addSeparator()
        .addSubMenu(SpreadsheetApp.getUi().createMenu('Visualizer Graphs')
            .addItem('Sankey Diagram', 'openSankeyVisualizer')
            .addItem('Pie Chart', 'openPieChartVisualizer')
            .addItem('Bar Chart', 'openBarChartVisualizer')
            .addItem('Stack Bar Chart', 'openBarStackVisualizer')
            .addItem('Line Chart', 'openLineChartVisualizer')
            .addItem('Radar Chart', 'openRadarChartVisualizer')))
    .addToUi();

  // Attempt to show welcome screen if configured
  checkWelcomeScreen();
}

/**
 * Checks if the welcome screen should be shown.
 */
function checkWelcomeScreen() {
  try {
    const config = ConfigManager.getAll();
    const showPopup = config["SHOW_OPENING_POPUP"];

    if (showPopup && String(showPopup).toUpperCase().trim() === "FALSE") {
      return;
    }

    showWelcomeDialog();
  } catch (e) {
    console.log("Could not show welcome screen (likely simple trigger restriction): " + e.message);
  }
}

/**
 * Shows the Welcome / Help Dialog.
 */
function showWelcomeDialog() {
  const html = HtmlService.createHtmlOutputFromFile('WelcomeUI')
    .setWidth(600)
    .setHeight(500)
    .setTitle('About SLR-Magic');
  SpreadsheetApp.getUi().showModalDialog(html, 'About SLR-Magic');
}

/**
 * Saves the user's preference for showing the welcome screen.
 * @param {boolean} show - Whether to show the popup next time.
 */
function saveWelcomePreference(show) {
  ConfigManager.set("SHOW_OPENING_POPUP", show ? "TRUE" : "FALSE");
}

/**
 * Shows the Configuration Dialog.
 */
function showConfigurationDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ConfigurationUI')
    .setWidth(700)
    .setHeight(600)
    .setTitle('SLR Magic Configuration');
  SpreadsheetApp.getUi().showModalDialog(html, 'SLR Magic Configuration');
}

/**
 * Server-side handler for getting configuration (called from ConfigurationUI).
 */
function getConfiguration() {
  const config = ConfigManager.getAll();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("00_Raw_Harvest");
    config["_RAW_HARVEST_COUNT"] = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  } catch (e) {
    config["_RAW_HARVEST_COUNT"] = 0;
  }
  return config;
}

/**
 * Proxy function to fetch available Ollama models.
 */
function fetchOllamaModelsProxy(baseUrl, apiKey) {
  try {
    let apiUrl = baseUrl;
    if (apiUrl.endsWith('/v1/chat/completions')) {
      apiUrl = apiUrl.replace('/v1/chat/completions', '/api/tags');
    } else if (apiUrl.endsWith('/')) {
      apiUrl += 'api/tags';
    } else {
      apiUrl += '/api/tags';
    }

    let options = {
      method: "get",
      muteHttpExceptions: true
    };

    if (apiKey) {
      options.headers = {
        "Authorization": "Bearer " + apiKey
      };
    }

    var response = UrlFetchApp.fetch(apiUrl, options);

    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      throw new Error("HTTP Error: " + response.getResponseCode());
    }
  } catch (e) {
    throw new Error("Failed to fetch models: " + e.message);
  }
}

/**
 * Server-side handler for saving configuration (called from ConfigurationUI).
 */
function saveConfiguration(config) {
  for (const [key, val] of Object.entries(config)) {
    ConfigManager.set(key, val);
  }
}

/**
 * Placeholder for Phase 3 QC Audit Configuration.
 */
function showQCAuditPlaceholder() {
  SpreadsheetApp.getUi().alert("Sequential QC Audit Configuration will be enabled in Epoch 3: Sequential QC Audit & Human-in-the-Loop.");
}

/**
 * Placeholder for Phase 3 QC Verification Checks.
 */
function runQCVerificationPlaceholder() {
  SpreadsheetApp.getUi().alert("Sequential QC Verification checks will be enabled in Epoch 3: Sequential QC Audit & Human-in-the-Loop.");
}

/**
 * Shows the Project Cost Preview Dialog.
 */
function showCostPreviewDialog() {
  CostAnalysisController.showCostPreviewDialog();
}

/**
 * Server-side handler for getting cost analysis unique models.
 */
function getUniqueModels() {
  return CostAnalysisController.getUniqueModels();
}

/**
 * Server-side handler for saving model pricing.
 */
function saveModelPricing(pricingData) {
  return CostAnalysisController.saveModelPricing(pricingData);
}

/**
 * Server-side handler for parsing model pricing.
 */
function parseModelPricing() {
  return CostAnalysisController.parseModelPricing();
}

/**
 * Server-side handler for calculating project costs.
 */
function calculateProjectCosts(priceMap) {
  return CostAnalysisController.calculateProjectCosts(priceMap);
}

/**
// Ingestion wrappers are now handled directly by ingestCSVData and ingestManualPaperData below.

function runStage1AbstractScreening() {
  ScreeningController.runStage1AbstractScreening();
}

function runStage21Gatekeeper() {
  FullTextScreeningController.runStage21Gatekeeper();
}

function runStage22Scientist() {
  FullTextScreeningController.runStage22Scientist();
}

function runStage23Miner() {
  FullTextScreeningController.runStage23Miner();
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

/**
 * Opens the Umbrellanizer (Data Categorizer) UI.
 */
function runUmbrellanizer() {
  UmbrellanizerController.showDialog();
}

/**
 * Server-side handler for getting Umbrellanizer columns.
 */
function getUmbrellanizerColumns() {
  return UmbrellanizerController.getColumnsAndValues();
}

/**
 * Server-side handler for getting Umbrellanizer unique values for a column.
 */
function getUmbrellanizerUniqueValues(columnName) {
  return UmbrellanizerController.getUniqueValues(columnName);
}

/**
 * Server-side handler for applying the Umbrellanizer taxonomy mapping.
 */
function applyUmbrellanizer(columnName, replacementType) {
  return UmbrellanizerController.applyUmbrellanizer(columnName, replacementType);
}

/**
 * Server-side handler for fetching the UMBRELLANIZER_PROMPT configuration template.
 */
function getUmbrellanizerPrompt() {
  return ConfigManager.get("UMBRELLANIZER_PROMPT") || "";
}

/**
 * Processes data collection JSON and generates the downstream Synthesis Report.
 */
function runDataCollection() {
  DataCollectionController.runSynthesisReport();
}

/**
 * Expose runSynthesisReport globally for other modules or menus.
 */
function runSynthesisReport() {
  DataCollectionController.runSynthesisReport();
}

/**
 * Expose QC Auditor checks.
 */
function runQCAuditorChecks() {
  InterRaterController.runQCAuditorChecks();
}

function exportQCAuditBatch() {
  InterRaterController.showExportDialog("QC_Audit_Batch");
}

function importQCAuditBatch() {
  InterRaterController.showImportDialog("QC_Audit_Batch");
}

function calculateQCAuditScore() {
  InterRaterController.calculateScore("QC_Audit_Batch");
}

/**
 * Inter-Rater endpoints
 */
function exportTitleAbsInterRater() {
  InterRaterController.showExportDialog("title-abs");
}

function importTitleAbsInterRater() {
  InterRaterController.showImportDialog("title-abs");
}

function calculateTitleAbsInterRaterScore() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Calculate Inter-Rater Score",
    "Enter the Calibration Pool sheet name to analyze (CAL_Pool_A, CAL_Pool_B, or CAL_Pool_C):",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() === ui.Button.OK) {
    const poolName = response.getResponseText().trim();
    if (poolName === "CAL_Pool_A" || poolName === "CAL_Pool_B" || poolName === "CAL_Pool_C") {
      InterRaterController.calculateScore(poolName);
    } else {
      ui.alert("Invalid calibration pool name. Please enter CAL_Pool_A, CAL_Pool_B, or CAL_Pool_C.");
    }
  }
}

function processInterRaterExport(poolName, sampleType, sampleValue, ecRules) {
  return InterRaterController.processExport(poolName, sampleType, sampleValue, ecRules);
}

function processInterRaterImport(poolName, jsonData) {
  return InterRaterController.processImport(poolName, jsonData);
}


/**
 * Manages background trigger for Stage 1.
 */
function manageStage1Trigger() {
  manageTrigger('runStage1AbstractScreening', 'Stage 1 Abstract Screening');
}

/**
 * Manages background trigger for Stage 2.1.
 */
function manageStage21Trigger() {
  manageTrigger('runStage21Gatekeeper', 'Stage 2.1 Gatekeeper');
}

/**
 * Manages background trigger for Stage 2.2.
 */
function manageStage22Trigger() {
  manageTrigger('runStage22Scientist', 'Stage 2.2 Scientist');
}

/**
 * Manages background trigger for Stage 2.3.
 */
function manageStage23Trigger() {
  manageTrigger('runStage23Miner', 'Stage 2.3 Miner');
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

  const currentBatchSize = ConfigManager.get("PDF_IMPORT_BATCH_SIZE") || "Not Set";
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
  ConfigManager.set("PDF_IMPORT_BATCH_SIZE", batchSize.toString());

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
 * Server-side handler for getting data collection columns.
 */
function getDataCollectionColumns() {
  return DataCollectionController.getDataCollectionColumns();
}

/**
 * Server-side handler for syncing data collection.
 */
function syncDataCollection(selectedColumns) {
  return DataCollectionController.syncDataCollection(selectedColumns);
}



/**
 * Visualizer Module Functions
 */
function openSankeyVisualizer() {
  VisualizerController.openSankeySettings();
}

function getVisualizerColumns() {
  return VisualizerController.getDataCollectionColumns();
}

function generateSankeyData(config) {
  return VisualizerController.processSankeyData(config);
}

function openPieChartVisualizer() {
  VisualizerController.openPieChartSettings();
}

function generatePieChartData(config) {
  return VisualizerController.processPieChartData(config);
}

function openBarChartVisualizer() {
  VisualizerController.openBarChartSettings();
}

function generateBarChartData(config) {
  return VisualizerController.processBarChartData(config);
}

function openBarStackVisualizer() {
  VisualizerController.openBarStackSettings();
}

function generateBarStackData(config) {
  return VisualizerController.processBarStackData(config);
}

function openLineChartVisualizer() {
  VisualizerController.openLineChartSettings();
}

function generateLineChartData(config) {
  return VisualizerController.processLineChartData(config);
}

function openRadarChartVisualizer() {
  VisualizerController.openRadarChartSettings();
}

function generateRadarChartData(config) {
  return VisualizerController.processRadarChartData(config);
}

/**
 * Ingests CSV data from the Ingestion Hub.
 * Routes to ImportController for strict deduplication.
 */
function ingestCSVData(csvString, sourceName, importDate, columnMapping, secondaryColumns) {
  return ImportController.ingestCSVData(csvString, sourceName, importDate, columnMapping, secondaryColumns);
}

/**
 * Ingests a single manually entered paper from the Ingestion Hub.
 * Routes to ImportController for strict deduplication.
 */
function ingestManualPaperData(paperData) {
  return ImportController.ingestManualPaperData(paperData);
}

/**
 * Shows the Pool Assignment Dialog.
 */
function runAssignToPools() {
  const html = HtmlService.createHtmlOutputFromFile('PoolAssignmentUI')
    .setWidth(850)
    .setHeight(600)
    .setTitle('Calibration Pool Assignment');
  SpreadsheetApp.getUi().showModalDialog(html, 'Calibration Pool Assignment');
}

/**
 * Server-side handler: Gets all papers from 00_Raw_Harvest.
 */
function getHarvestedPapers() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("00_Raw_Harvest");
    if (!sheet) return [];
    
    // Load assigned IDs from calibration pools to find existing assignments
    const assignedPools = {};
    const pools = ["CAL_Pool_A", "CAL_Pool_B", "CAL_Pool_C"];
    pools.forEach(poolName => {
      const poolSheet = ss.getSheetByName(poolName);
      if (poolSheet) {
        const poolData = SheetUtils.getDataAsObjects(poolSheet);
        poolData.forEach(r => {
          const id = r["Paper_ID"];
          if (id) {
            assignedPools[String(id)] = poolName;
          }
        });
      }
    });
    
    const data = SheetUtils.getDataAsObjects(sheet);
    return data.map(r => {
      const pid = r["Paper_ID"] || "";
      return {
        Paper_ID: pid,
        Title: r["Title"] || "",
        Authors: r["Authors"] || "",
        Year: r["Year"] || "",
        DOI: r["DOI"] || "",
        Abstract: r["Abstract"] || "",
        Assigned_Pool: assignedPools[String(pid)] || null
      };
    });
  } catch (e) {
    console.error(e);
    throw new Error("Failed to load harvested papers: " + e.message);
  }
}

/**
 * Server-side handler: Copies literature row from 00_Raw_Harvest to target CAL pool sheet.
 */
function assignPaperToPool(paperId, poolName) {
  try {
    if (!paperId || !poolName) throw new Error("Missing parameters.");
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const harvestSheet = ss.getSheetByName("00_Raw_Harvest");
    if (!harvestSheet) throw new Error("00_Raw_Harvest sheet not found.");
    
    const targetSheet = ss.getSheetByName(poolName);
    if (!targetSheet) throw new Error(`Target pool sheet "${poolName}" not found. Please run environment initialization.`);
    
    const harvestData = SheetUtils.getDataAsObjects(harvestSheet);
    const paperRecord = harvestData.find(r => String(r["Paper_ID"]) === String(paperId));
    if (!paperRecord) throw new Error(`Paper with ID "${paperId}" not found in raw harvest.`);

    // Enforce configured pool size limits
    ConfigManager.initializeDefaults();
    let limitKey = "";
    if (poolName === "CAL_Pool_A") limitKey = "POOL_A_SIZE";
    else if (poolName === "CAL_Pool_B") limitKey = "POOL_B_SIZE";
    else if (poolName === "CAL_Pool_C") limitKey = "POOL_C_SIZE";

    if (limitKey) {
      const limit = parseInt(ConfigManager.get(limitKey)) || 0;
      const targetData = SheetUtils.getDataAsObjects(targetSheet);
      if (targetData.length >= limit) {
        return `Cannot assign paper. Calibration Pool "${poolName}" has reached its configured limit of ${limit} papers.`;
      }
    }
    
    // Check if already assigned to ANY calibration pool to enforce mathematically independent, non-overlapping pools
    const pools = ["CAL_Pool_A", "CAL_Pool_B", "CAL_Pool_C"];
    for (const pool of pools) {
      const otherSheet = ss.getSheetByName(pool);
      if (otherSheet) {
        const otherData = SheetUtils.getDataAsObjects(otherSheet);
        const exists = otherData.some(r => String(r["Paper_ID"]) === String(paperId));
        if (exists) {
          return `Paper "${paperRecord.Title}" is already assigned to "${pool}". To maintain mathematically independent, non-overlapping pools, it cannot be assigned to "${poolName}".`;
        }
      }
    }
    
    const targetHeaderMap = SheetUtils.getHeaderMap(targetSheet);
    
    const newRecord = {};
    const baseHeaders = ['Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
    baseHeaders.forEach(h => {
      newRecord[h] = paperRecord[h] !== undefined ? paperRecord[h] : "";
    });
    
    if (!newRecord["Import_Date"]) {
      newRecord["Import_Date"] = new Date().toISOString().split('T')[0];
    }
    
    SheetUtils.appendDataMapped(targetSheet, [newRecord], targetHeaderMap);
    return `Successfully assigned "${newRecord.Title}" to "${poolName}".`;
  } catch (e) {
    console.error(e);
    throw new Error("Assignment failed: " + e.message);
  }
}

/**
 * Server-side handler: Gets calibration pool target sizes and current sheet counts.
 */
function getCalibrationPoolProgress() {
  try {
    ConfigManager.initializeDefaults();
    const targetA = parseInt(ConfigManager.get("POOL_A_SIZE")) || 50;
    const targetB = parseInt(ConfigManager.get("POOL_B_SIZE")) || 30;
    const targetC = parseInt(ConfigManager.get("POOL_C_SIZE")) || 20;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const getCount = (sheetName) => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return 0;
      try {
        const data = SheetUtils.getDataAsObjects(sheet);
        return data.length;
      } catch (e) {
        const rows = sheet.getLastRow();
        return rows > 0 ? rows - 1 : 0;
      }
    };
    
    return {
      poolA: { count: getCount("CAL_Pool_A"), target: targetA },
      poolB: { count: getCount("CAL_Pool_B"), target: targetB },
      poolC: { count: getCount("CAL_Pool_C"), target: targetC }
    };
  } catch (e) {
    console.error(e);
    throw new Error("Failed to load pool progress: " + e.message);
  }
}

