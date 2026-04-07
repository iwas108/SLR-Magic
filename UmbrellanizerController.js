/**
 * UmbrellanizerController.js
 * Handles the logic for the "Umbrellanizer (Data Categorizer)" feature.
 */

var UmbrellanizerController = (function() {

  /**
   * Shows the Umbrellanizer UI dialog.
   */
  function showDialog() {
    const html = HtmlService.createHtmlOutputFromFile('UmbrellanizerUI')
      .setWidth(600)
      .setHeight(650)
      .setTitle('Umbrellanizer (Data Categorizer)');
    SpreadsheetApp.getUi().showModalDialog(html, 'Umbrellanizer (Data Categorizer)');
  }

  /**
   * Retrieves headers from 03_fulltext_screening for selection.
   */
  function getColumnsAndValues() {
    try {
      const sheet = SheetUtils.getSheetByName("03_fulltext_screening");
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) return [];

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
        .filter(h => h && h.toString().trim() !== "");

      return headers;
    } catch (e) {
      console.warn("Error fetching columns from 03_fulltext_screening", e);
      return [];
    }
  }

  /**
   * Retrieves unique values for a given column from 03_fulltext_screening.
   * Splits by comma to ensure distinct tags.
   */
  function getUniqueValues(columnName) {
    try {
      const sheet = SheetUtils.getSheetByName("03_fulltext_screening");
      const data = SheetUtils.getDataAsObjects(sheet);

      const uniqueSet = new Set();

      data.forEach(row => {
        let val = row[columnName];
        if (val !== null && val !== undefined) {
          const str = String(val).trim();
          if (str !== "") {
            // Assume comma-separated multi-values
            const parts = str.split(',').map(s => s.trim()).filter(s => s !== "");
            parts.forEach(p => uniqueSet.add(p));
          }
        }
      });

      // Convert Set to sorted Array
      return Array.from(uniqueSet).sort();
    } catch (e) {
      console.warn(`Error fetching unique values for column ${columnName}`, e);
      return [];
    }
  }

  /**
   * Applies the LLM-generated prompt to a new "_fixed" column.
   * Note: The isMultiLabel flag is passed from UI if we need it for specific logic later.
   * The formula string passed is the raw plaintext prompt containing {{CELL_REF}}.
   */
  function applyUmbrellanizer(columnName, decisionColumn, decisionValue, isMultiLabel, formulaText) {
    try {
      const sheet = SheetUtils.getSheetByName("03_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);

      // Ensure source and decision columns exist
      if (!headerMap[columnName]) {
        throw new Error(`Column '${columnName}' not found.`);
      }
      if (!headerMap[decisionColumn]) {
        throw new Error(`Decision Column '${decisionColumn}' not found.`);
      }

      const sourceColIdx = headerMap[columnName]; // 1-based index
      let decisionColIdx = headerMap[decisionColumn]; // 1-based index
      const fixedColumnName = `${columnName}_fixed`;

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
          throw new Error("No data found to process.");
      }

      // Read decision column values BEFORE any column insertions to avoid index shifting bugs
      const decisionRange = sheet.getRange(2, decisionColIdx, lastRow - 1, 1);
      const decisionValues = decisionRange.getDisplayValues().map(row => row[0].trim());

      // Find or insert the new column to the right of the source column
      let targetColIdx = headerMap[fixedColumnName];
      let isNewColumn = false;

      if (!targetColIdx) {
        // We want to insert to the right of sourceColIdx
        sheet.insertColumnAfter(sourceColIdx);
        targetColIdx = sourceColIdx + 1;
        isNewColumn = true;
        // Set header name
        sheet.getRange(1, targetColIdx).setValue(fixedColumnName);

        // If the decision column was to the right of the source column, its index has now shifted by 1
        if (decisionColIdx > sourceColIdx) {
            decisionColIdx++;
        }
      }

      // Instead of clearing the target column, we fetch existing formulas/values to preserve non-matching rows
      let existingTargetData = [];
      if (!isNewColumn) {
          existingTargetData = sheet.getRange(2, targetColIdx, lastRow - 1, 1).getFormulas();
          const displayValues = sheet.getRange(2, targetColIdx, lastRow - 1, 1).getValues();
          // getFormulas returns empty string if it's not a formula, so fallback to display value
          for (let i = 0; i < existingTargetData.length; i++) {
              if (existingTargetData[i][0] === "") {
                  existingTargetData[i][0] = displayValues[i][0];
              }
          }
      } else {
          // Initialize with empty strings if it's a new column
          existingTargetData = new Array(lastRow - 1).fill().map(() => [""]);
      }

      // Determine source column letter
      const getColumnLetter = (colIndex) => {
        let temp, letter = '';
        while (colIndex > 0) {
          temp = (colIndex - 1) % 26;
          letter = String.fromCharCode(temp + 65) + letter;
          colIndex = (colIndex - temp - 1) / 26;
        }
        return letter;
      };

      const sourceColLetter = getColumnLetter(sourceColIdx);

      // Prepare the array of formulas to write back.
      const formulas = [];

      // 1. Escape double quotes in the plaintext to prepare it for a Google Sheets string literal
      const escapedPrompt = formulaText.replace(/"/g, '""');

      // 2. Iterate and apply conditionally
      const targetDecisionStr = String(decisionValue).trim().toLowerCase();

      for (let i = 0; i < lastRow - 1; i++) {
        const currentRowDecision = String(decisionValues[i]).toLowerCase();

        if (currentRowDecision === targetDecisionStr) {
            const rowIndex = i + 2; // 0-based array index back to 1-based sheet row index starting at 2
            const dynamicCell = `${sourceColLetter}${rowIndex}`;

            // Replace {{CELL_REF}} with `" & dynamicCell & "`
            const promptWithDynamicCell = escapedPrompt.replace(/\{\{CELL_REF\}\}/g, `" & ${dynamicCell} & "`);

            // Wrap in `=GEMINI(...)`
            const finalRowFormula = `=GEMINI("${promptWithDynamicCell}")`;

            formulas.push([finalRowFormula]);
        } else {
            // Preserve existing value/formula if it doesn't match the current decision criteria
            formulas.push([existingTargetData[i][0]]);
        }
      }

      // Set the formulas in the sheet
      // Note: we use setValues to handle both formulas (starting with =) and plain strings
      const targetRange = sheet.getRange(2, targetColIdx, formulas.length, 1);

      // Google Apps Script setValues() handles strings that start with '=' automatically by parsing them as formulas.
      targetRange.setValues(formulas);

      return "Success";
    } catch (e) {
      console.error(e);
      throw new Error("Error applying Umbrellanizer formula: " + e.message);
    }
  }

  return {
    showDialog,
    getColumnsAndValues,
    getUniqueValues,
    applyUmbrellanizer
  };

})();
