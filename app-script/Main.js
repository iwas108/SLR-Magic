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
        .addItem('About SLR-Magic', 'showWelcomeDialog'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🧪 Phase 1: Pre-Calibration')
        .addItem('Assign Papers to Pools', 'runAssignToPools')
        .addSeparator()
        .addItem('Export Blinded Review Sample (.slr)', 'exportTitleAbsInterRater')
        .addItem('Import Blinded Results Sample (.slr)', 'importTitleAbsInterRater'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('📊 Synthesis & Visuals')
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
 * Server-side handler for saving configuration (called from ConfigurationUI).
 */
function saveConfiguration(config) {
  for (const [key, val] of Object.entries(config)) {
    ConfigManager.set(key, val);
  }
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

/**
 * Inter-Rater endpoints
 */
function exportTitleAbsInterRater() {
  InterRaterController.showExportDialog("title-abs");
}

function importTitleAbsInterRater() {
  InterRaterController.showImportDialog("title-abs");
}

function processInterRaterExport(poolName, sampleType, sampleValue, ecRules) {
  return InterRaterController.processExport(poolName, sampleType, sampleValue, ecRules);
}

function processInterRaterImport(poolName, jsonData) {
  return InterRaterController.processImport(poolName, jsonData);
}
