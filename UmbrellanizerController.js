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
   * Retrieves headers from 02_fulltext_screening for selection.
   */
  function getColumnsAndValues() {
    try {
      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) return [];

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
        .filter(h => h && h.toString().trim() !== "");

      return headers;
    } catch (e) {
      console.warn("Error fetching columns from 02_fulltext_screening", e);
      return [];
    }
  }

  /**
   * Retrieves unique values for a given column from 02_fulltext_screening.
   * Splits by comma to ensure distinct tags.
   */
  function getUniqueValues(columnName) {
    try {
      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
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
  function applyUmbrellanizer(columnName, isMultiLabel, formulaText) {
    try {
      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);

      // Ensure source column exists
      if (!headerMap[columnName]) {
        throw new Error(`Column '${columnName}' not found.`);
      }

      const sourceColIdx = headerMap[columnName]; // 1-based index
      const fixedColumnName = `${columnName}_fixed`;

      // Find or insert the new column to the right of the source column
      let targetColIdx = headerMap[fixedColumnName];
      if (!targetColIdx) {
        // We want to insert to the right of sourceColIdx
        sheet.insertColumnAfter(sourceColIdx);
        targetColIdx = sourceColIdx + 1;
        // Set header name
        sheet.getRange(1, targetColIdx).setValue(fixedColumnName);
      } else {
        // Clear existing data in target column except header
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
            sheet.getRange(2, targetColIdx, lastRow - 1, 1).clearContent();
        }
      }

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
          throw new Error("No data found to process.");
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

      // Prepare the array of formulas.
      const formulas = [];

      // 1. First, we must escape double quotes in the plaintext to prepare it for a Google Sheets string literal
      const escapedPrompt = formulaText.replace(/"/g, '""');

      // 2. We locate the placeholder {{CELL_REF}}
      // To properly inject the cell value dynamically into the `=GEMINI(...)` formula,
      // we need to break out of the string literal using quotes and ampersands.
      // So {{CELL_REF}} becomes `" & A2 & "`

      for (let i = 2; i <= lastRow; i++) {
        const dynamicCell = `${sourceColLetter}${i}`;

        // We replace {{CELL_REF}} with `" & dynamicCell & "`
        const promptWithDynamicCell = escapedPrompt.replace(/\{\{CELL_REF\}\}/g, `" & ${dynamicCell} & "`);

        // Finally, wrap everything in `=GEMINI("...")`
        const finalRowFormula = `=GEMINI("${promptWithDynamicCell}")`;

        formulas.push([finalRowFormula]);
      }

      // Set the formulas in the sheet
      sheet.getRange(2, targetColIdx, formulas.length, 1).setFormulas(formulas);

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
