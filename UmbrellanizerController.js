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
   * Applies the LLM-generated formula to a new "_fixed" column.
   * Note: The isMultiLabel flag is passed from UI if we need it for specific logic later.
   * The formula string passed is the raw formula e.g. !=GEMINI(...)
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
        // We don't strictly need to update headerMap for this one operation,
        // but it's good practice if other functions run later.
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

      // Convert the source formula text (which references A2 usually)
      // into a dynamic formula for each row.

      // We assume the user wrote `... INPUT: '" & A2 & "' ...` or similar.
      // We need to replace the column letter 'A' with the actual source column letter.

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

      // We need to prepare an array of formulas.
      const formulas = [];

      // Google Sheets formulas must start with = not !=.
      let baseFormula = formulaText;
      if (baseFormula.startsWith("!=")) {
          baseFormula = baseFormula.substring(1); // Remove !
      } else if (!baseFormula.startsWith("=")) {
          baseFormula = "=" + baseFormula;
      }

      // If the user literally copied our placeholder '" & A2 & "' we can smartly replace it.
      // But a more robust approach:
      // We will look for A2, B2, etc in the formula string and replace the letter with the actual source letter.
      // Wait, a simpler approach is to tell the user to literally use A2 in the prompt copy, and we replace 'A2' with '${sourceColLetter}${rowIndex}'.
      // Let's do a regex replacement for the dynamic cell reference.

      // The prompt generation in the UI creates a formula like: !=GEMINI("...INPUT: '" & A2 & "'...")
      // or similar concatenation structures relying on `& A2 &`.
      // The user might paste `... & A2 & ...` or `...&A2&...`
      // We safely target `A2` only when surrounded by `&` and optional whitespace.

      for (let i = 2; i <= lastRow; i++) {
        const dynamicCell = `${sourceColLetter}${i}`;
        // More specific regex: Replace A2 if it's flanked by ampersands (typical concatenation)
        // or just rely on a strict match if the user followed instructions.
        // Let's replace the whole string `& A2 &` to be very safe against replacing regular "A2" strings.
        // But what if they wrote `&A2&` or `&   A2  &`?
        // Let's use `&\s*A2\s*&` to match, and replace it with `& ${dynamicCell} &`
        // Wait, what if the A2 is at the very end of the formula? (Unlikely for our prompt).
        // Let's fall back to a word boundary replacement to avoid replacing "A2" inside a word (though unlikely).
        // Regex: `\bA2\b`
        // But what if "A2" is literally in their prompt (e.g., "Category A2")?
        // The safest approach is targeting the exact string expected from the template:

        // This regex looks for an ampersand, optional space, A2, optional space, ampersand
        let rowFormula = baseFormula;
        if (/&\s*A2\s*&/.test(rowFormula)) {
             rowFormula = rowFormula.replace(/&\s*A2\s*&/g, `& ${dynamicCell} &`);
        } else {
             // Fallback if they modified the concatenation slightly
             rowFormula = rowFormula.replace(/\bA2\b/g, dynamicCell);
        }

        formulas.push([rowFormula]);
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
