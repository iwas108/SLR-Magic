/**
 * UmbrellanizerController.js
 * Handles the logic for the "Umbrellanizer (Data Categorizer)" feature.
 */

const UmbrellanizerController = (function() {

  /**
   * Shows the Umbrellanizer UI dialog.
   */
  function showDialog() {
    const html = HtmlService.createHtmlOutputFromFile('UmbrellanizerUI')
      .setWidth(600)
      .setHeight(450)
      .setTitle('Umbrellanizer (Data Categorizer)');
    SpreadsheetApp.getUi().showModalDialog(html, 'Umbrellanizer (Data Categorizer)');
  }

  /**
   * Retrieves headers from 05_Synthesis for selection.
   */
  function getColumnsAndValues() {
    try {
      const sheet = SheetUtils.getSheetByName("05_Synthesis");
      if (!sheet) return [];
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) return [];

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
        .map(h => String(h).trim())
        .filter(h => h !== "");

      const baseHeaders = ['Paper_ID', 'Import_Date', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
      // Filter out base headers and also any header ending in _Umbrella
      return headers.filter(h => !baseHeaders.includes(h) && !h.endsWith("_Umbrella"));
    } catch (e) {
      console.warn("Error fetching columns from 05_Synthesis", e);
      return [];
    }
  }

  /**
   * Runs the Umbrellanizer autonomously in a single LLM request.
   * @param {string} columnName Name of the column to process
   * @param {string} replacementType "single" or "multi"
   */
  function applyUmbrellanizer(columnName, replacementType) {
    try {
      const synthSheet = SheetUtils.getSheetByName("05_Synthesis");
      if (!synthSheet) throw new Error("05_Synthesis sheet not found.");

      const headerMap = SheetUtils.getHeaderMap(synthSheet);
      if (!headerMap[columnName]) {
        throw new Error(`Column '${columnName}' not found in 05_Synthesis.`);
      }

      // Compile unique list of non-empty values
      const data = SheetUtils.getDataAsObjects(synthSheet);
      const uniqueValues = new Set();
      data.forEach(row => {
        const val = row[columnName];
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          if (str !== "") {
            uniqueValues.add(str);
          }
        }
      });

      if (uniqueValues.size === 0) {
        throw new Error(`No non-empty values found in column '${columnName}'.`);
      }

      // Fetch prompt template
      const config = ConfigManager.getAll();
      const modelName = config["MODEL_NAME"] || "deepseek-r1";
      const systemPrompt = config["UMBRELLANIZER_PROMPT"];
      if (!systemPrompt) {
        throw new Error("UMBRELLANIZER_PROMPT is missing in Configuration.");
      }

      // Format constraints and attach unique values
      let constraints = "";
      if (replacementType === "single") {
        constraints = "CARDINALITY CONSTRAINT: You must map each original value to exactly ONE standardized category. Do not output multiple categories or lists.";
      } else {
        constraints = "CARDINALITY CONSTRAINT: You may map each original value to multiple standardized categories, separated by commas.";
      }

      const fullPrompt = `${systemPrompt}\n\n${constraints}\n\nList of Unique Values to Process:\n${JSON.stringify(Array.from(uniqueValues), null, 2)}`;

      // Execute single LLM call
      const response = LlmService.callLlm(fullPrompt, modelName);
      if (!response || !response.content) {
        throw new Error("Empty response from LLM Proxy.");
      }

      const result = response.content;
      const mappings = result.mappings || result; // Try mappings dict or direct response

      if (typeof mappings !== "object" || mappings === null) {
        throw new Error("Invalid mappings returned by LLM. Expected a JSON object mapping original values to standardized categories.");
      }

      // Determine target column name
      const umbrellaColName = columnName.endsWith("_Value") 
        ? columnName.replace(/_Value$/, "") + "_Umbrella" 
        : columnName + "_Umbrella";

      // Locate or insert the target column
      let targetColIdx = headerMap[umbrellaColName];
      if (!targetColIdx) {
        const sourceColIdx = headerMap[columnName];
        synthSheet.insertColumnAfter(sourceColIdx);
        targetColIdx = sourceColIdx + 1;
        synthSheet.getRange(1, targetColIdx).setValue(umbrellaColName);
        synthSheet.getRange(1, targetColIdx).setFontWeight("bold");
      }

      // Read target values and write mapping
      const lastRow = synthSheet.getLastRow();
      if (lastRow > 1) {
        const sourceColIdx = SheetUtils.getHeaderMap(synthSheet)[columnName]; // Refetch in case index shifted
        const sourceRange = synthSheet.getRange(2, sourceColIdx, lastRow - 1, 1);
        const sourceValues = sourceRange.getValues();
        const targetValues = [];

        for (let i = 0; i < sourceValues.length; i++) {
          const rawVal = String(sourceValues[i][0]).trim();
          if (rawVal === "") {
            targetValues.push([""]);
          } else {
            const mappedVal = mappings[rawVal];
            targetValues.push([mappedVal !== undefined ? String(mappedVal).trim() : rawVal]);
          }
        }

        const targetRange = synthSheet.getRange(2, targetColIdx, targetValues.length, 1);
        targetRange.setValues(targetValues);
      }

      return "Success";
    } catch (e) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  return {
    showDialog: showDialog,
    getColumnsAndValues: getColumnsAndValues,
    applyUmbrellanizer: applyUmbrellanizer
  };

})();
