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

  /**
   * Reads all data from the sheet and returns as an array of objects.
   * Adds a special property `_rowIndex` (1-based) to each object.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @returns {Array<Object>}
   */
  function getDataAsObjects(sheet) {
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    if (values.length < 2) return []; // No data

    const headers = values[0];
    const data = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const obj = { _rowIndex: i + 1 };

      headers.forEach((header, colIndex) => {
        if (header) {
          obj[header.trim()] = row[colIndex];
        }
      });
      data.push(obj);
    }
    return data;
  }

  /**
   * Updates a single row in the sheet based on the dataObject and headerMap.
   * Only updates columns present in the dataObject.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} rowIndex 1-based row index
   * @param {Object} dataObject Data to update
   * @param {Object} headerMap Map of { "HeaderName": ColumnIndex }
   */
  function updateRow(sheet, rowIndex, dataObject, headerMap) {
    const lastCol = sheet.getLastColumn();
    // Optimization: Read the current row first to preserve other data?
    // Actually, setValues for specific cells is better if we are updating sparse data.
    // But here we likely update multiple columns.
    // Let's assume we want to update only the keys present in dataObject.

    // To do this efficiently without reading, we can iterate keys in dataObject.
    // But making multiple set calls is slow.
    // Better to read the row, update the array, write back.

    const rowRange = sheet.getRange(rowIndex, 1, 1, lastCol);
    const rowValues = rowRange.getValues()[0];

    let changed = false;
    for (const [key, value] of Object.entries(dataObject)) {
      const colIdx = headerMap[key];
      if (colIdx && colIdx <= lastCol) {
        rowValues[colIdx - 1] = value;
        changed = true;
      }
    }

    if (changed) {
      rowRange.setValues([rowValues]);
    }
  }

  return {
    getSheetByName,
    getConfigMap,
    getHeaderMap,
    appendDataMapped,
    getDataAsObjects,
    updateRow
  };

})();
