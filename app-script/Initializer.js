/**
 * Initializer.js
 * Handles the state initialization and dynamic sheet creation of SLR Magic workspace.
 */

const Initializer = (function() {

  const BASE_HEADERS = ['Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
  const EVAL_HEADERS = ['decision_Value', 'decision_Quote', 'exclusion_code_Value', 'exclusion_code_Quote', 'reasoning_Value', 'reasoning_Quote'];

  /**
   * Wipes all contents and formats, or creates sheet if missing.
   */
  function clearOrCreateSheet(ss, name) {
    let sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clear();
      sheet.setFrozenRows(0);
      sheet.setFrozenColumns(0);
    } else {
      sheet = ss.insertSheet(name);
    }
    return sheet;
  }

  /**
   * Sets up a sheet with specific headers, bold style, and frozen top row.
   */
  function setupSheet(sheet, headers) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  /**
   * Main workspace initialization logic.
   */
  function runInitialization() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();

    // 1. Clean up legacy script properties if they exist
    const legacyKeys = [
      "ABSTRACT_SCREENING_PROMPT", "THE_GATEKEEPER_PROMPT", "THE_SCIENTIST_PROMPT", 
      "THE_MINER_PROMPT", "DATA_SCHEMA", "OLLAMA_BASE_URL", "VLLM_API_KEY", 
      "VLLM_MODEL_NAME", "VLLM_BASE_URL", "GEMINI_API_KEY", "GEMINI_MODEL_NAME",
      "STAGE_1_SCHEMA", "STAGE_2_1_SCHEMA", "STAGE_2_2_SCHEMA", "STAGE_2_3_SCHEMA"
    ];
    try {
      const scriptProps = PropertiesService.getScriptProperties();
      legacyKeys.forEach(k => scriptProps.deleteProperty(k));
      console.log("[Initializer] Purged legacy script properties.");
    } catch (e) {
      console.warn("[Initializer] Could not purge legacy script properties: " + e.message);
    }

    // 2. Initialize configuration defaults if not present
    ConfigManager.initializeDefaults();

    // 3. Clear/Create required sheets
    
    // -- 00_Raw_Harvest: Base + Status
    const sheetRaw = clearOrCreateSheet(ss, "00_Raw_Harvest");
    setupSheet(sheetRaw, [...BASE_HEADERS, 'Status']);

    // -- 05_Synthesis: Base headers only
    const sheetSynth = clearOrCreateSheet(ss, "05_Synthesis");
    setupSheet(sheetSynth, BASE_HEADERS);

    // -- CAL_Pool_A: Base + Human_Decision, Human_EC_Trigger, Human_Rationale + EVAL
    const sheetCalA = clearOrCreateSheet(ss, "CAL_Pool_A");
    setupSheet(sheetCalA, [...BASE_HEADERS, 'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', ...EVAL_HEADERS]);

    // -- CAL_Pool_B: Base + Human_Decision, Human_EC_Trigger, Human_Rationale + EVAL
    const sheetCalB = clearOrCreateSheet(ss, "CAL_Pool_B");
    setupSheet(sheetCalB, [...BASE_HEADERS, 'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', ...EVAL_HEADERS]);

    // -- CAL_Pool_C: Base + Human_Decision + EVAL
    const sheetCalC = clearOrCreateSheet(ss, "CAL_Pool_C");
    setupSheet(sheetCalC, [...BASE_HEADERS, 'Human_Decision', ...EVAL_HEADERS]);

    // 4. Alert user with completion message and Google Sheet Table instruction
    const alertMessage = "Workspace Initialized Successfully!\n\n" +
      "All 5 sheets have been generated with required system columns.\n\n" +
      "⚠️ NOTE: Google Sheets Table conversion is not programmatically supported by Apps Script. " +
      "For a premium experience, you can manually convert the generated sheets to tables. " +
      "To do this: select each sheet, click 'Format' in the top Google Sheets menu, and select 'Convert to table'.";
      
    ui.alert(alertMessage);
  }

  return {
    runInitialization
  };

})();

/**
 * Global function called by the SLR Magic menu item.
 */
function runInitialization() {
  Initializer.runInitialization();
}
