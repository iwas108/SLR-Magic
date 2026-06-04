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
