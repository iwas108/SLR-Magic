/**
 * Setup.js
 * Handles the initialization of the SLR Magic environment.
 */

const Setup = (function() {

  const SHEETS_TO_CREATE = [
    "01_abstract_screening",
    "02_titleabs_quality_check",
    "03_fulltext_screening",
    "04_fulltext_quality_check",
    "05_data_collection",
    "98_file_metadata"
  ];

  /**
   * Main initialization function.
   */
  function runInitialization() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Initialize Configuration (Script Properties)
    // Migrates from 00_manifest if it exists, otherwise sets defaults.
    ConfigManager.initializeDefaults();
    ConfigManager.migrateFromManifest();

    // 2. Create sheets
    SHEETS_TO_CREATE.forEach(sheetName => {
      createSheetIfNotExists(ss, sheetName);
    });

    // 3. Inform user
    SpreadsheetApp.getUi().alert("Environment Initialized Successfully! Configuration is now managed via the 'SLR Magic > Configuration' menu.");
  }

  /**
   * Creates a sheet if it doesn't exist.
   */
  function createSheetIfNotExists(ss, sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      console.log(`[Setup] Created sheet: ${sheetName}`);
    } else {
      console.log(`[Setup] Sheet ${sheetName} already exists. Skipping.`);
    }
    return sheet;
  }

  return {
    runInitialization
  };

})();

/**
 * Global function to be called from the menu.
 */
function runInitialization() {
  Setup.runInitialization();
}
