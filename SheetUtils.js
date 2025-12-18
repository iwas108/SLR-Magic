/**
 * SheetUtils.js
 * Handles low-level Spreadsheet operations.
 */

const SheetUtils = (function() {

  /**
   * Gets a sheet by name or throws an error if missing.
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function getSheetByName(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found. Please create it.`);
    }
    return sheet;
  }

  /**
   * Reads a Key-Value sheet and returns a Map/Object.
   * Assumes Row 1 is header, Data starts at Row 2.
   * Checks for specific "Key" and "Value" columns.
   * @param {string} sheetName
   * @returns {Object} Key-Value pairs
   */
  function getConfigMap(sheetName) {
    const sheet = getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find column indices
    const keyIdx = headers.indexOf('Key');
    const valueIdx = headers.indexOf('Value');

    if (keyIdx === -1 || valueIdx === -1) {
      throw new Error(`Sheet "${sheetName}" must have "Key" and "Value" columns.`);
    }

    const config = {};
    // Start from row index 1 (row 2)
    for (let i = 1; i < data.length; i++) {
      const key = data[i][keyIdx];
      const value = data[i][valueIdx];
      if (key) {
        config[key] = value;
      }
    }
    return config;
  }

  /**
   * Returns a map of Header Name -> Column Index (1-based).
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @returns {Object} { "Paper_ID": 1, "Title": 2, ... }
   */
  function getHeaderMap(sheet) {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return {};

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};
    headers.forEach((header, index) => {
      if (header) {
        map[header.trim()] = index + 1; // 1-based index
      }
    });
    return map;
  }

  /**
   * Appends multiple rows of mapped data to the sheet.
   * This is more efficient than appending row by row.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Array<Object>} dataObjects List of objects { "Paper_ID": "...", "Title": "..." }
   * @param {Object} headerMap Map of { "HeaderName": ColumnIndex }
   */
  function appendDataMapped(sheet, dataObjects, headerMap) {
    if (dataObjects.length === 0) return;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // Create a 2D array matching the sheet columns
    // We need to know the max column index from the headerMap
    // But we should rely on sheet.getLastColumn() to define the width,
    // or the max index in headerMap.
    // Usually, we write to the width of the existing headers.

    const numRows = dataObjects.length;
    // Initialize empty 2D array
    const outputValues = [];

    for (let i = 0; i < numRows; i++) {
      const rowData = new Array(lastCol).fill(""); // Fill with empty strings
      const obj = dataObjects[i];

      for (const [key, value] of Object.entries(obj)) {
        const colIdx = headerMap[key];
        if (colIdx && colIdx <= lastCol) {
          rowData[colIdx - 1] = value; // Array is 0-based, colIdx is 1-based
        }
      }
      outputValues.push(rowData);
    }

    // Write to sheet
    sheet.getRange(lastRow + 1, 1, numRows, lastCol).setValues(outputValues);
  }

  return {
    getSheetByName,
    getConfigMap,
    getHeaderMap,
    appendDataMapped
  };

})();
