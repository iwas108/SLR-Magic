/**
 * SheetUtils.js
 * Handles low-level Spreadsheet operations.
 */

const SheetUtils = (function() {

  /**
   * Helper to get the active spreadsheet or open by ID.
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  function getSpreadsheet() {
    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (sheetId) {
      return SpreadsheetApp.openById(sheetId);
    }
    // Fallback to active spreadsheet (works in container-bound scripts, but not triggers if standalone)
    try {
        return SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
        throw new Error("Could not access spreadsheet. Please set 'SHEET_ID' in Script Properties.");
    }
  }

  /**
   * Gets a sheet by name or throws an error if missing.
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function getSheetByName(sheetName) {
    const ss = getSpreadsheet();
    if (!ss) throw new Error("No active spreadsheet found.");

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
   * Updates or adds a Key-Value pair in the configuration sheet.
   * @param {string} key
   * @param {string} value
   */
  function setConfigValue(key, value) {
    const sheetName = "00_manifest";
    const sheet = getSheetByName(sheetName);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];

    const keyIdx = headers.indexOf('Key'); // 0-based
    const valueIdx = headers.indexOf('Value'); // 0-based

    if (keyIdx === -1 || valueIdx === -1) {
      throw new Error(`Sheet "${sheetName}" must have "Key" and "Value" columns.`);
    }

    // Search for existing key
    for (let i = 1; i < values.length; i++) {
      if (values[i][keyIdx] === key) {
        // Update existing (row is i+1)
        // Column is valueIdx + 1
        sheet.getRange(i + 1, valueIdx + 1).setValue(value);
        console.log(`[SheetUtils] Updated ${key} to ${value}`);
        return;
      }
    }

    // Not found, append
    // Construct row based on headers size
    const newRow = new Array(headers.length).fill("");
    newRow[keyIdx] = key;
    newRow[valueIdx] = value;
    sheet.appendRow(newRow);
    console.log(`[SheetUtils] Added ${key} = ${value}`);
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
   * @param {Array<Object>} [notesObjects] Optional list of objects { "HeaderName": "Note" }
   */
  function appendDataMapped(sheet, dataObjects, headerMap, notesObjects = null) {
    if (dataObjects.length === 0) return;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    const numRows = dataObjects.length;
    // Initialize empty 2D arrays
    const outputValues = [];
    const outputNotes = notesObjects ? [] : null;

    for (let i = 0; i < numRows; i++) {
      const rowData = new Array(lastCol).fill(""); // Fill with empty strings
      const rowNotes = notesObjects ? new Array(lastCol).fill("") : null;

      const obj = dataObjects[i];
      const noteObj = notesObjects ? notesObjects[i] : null;

      // Map Values
      for (const [key, value] of Object.entries(obj)) {
        const colIdx = headerMap[key];
        if (colIdx && colIdx <= lastCol) {
          rowData[colIdx - 1] = value; // Array is 0-based, colIdx is 1-based
        }
      }
      outputValues.push(rowData);

      // Map Notes
      if (notesObjects && noteObj) {
        for (const [key, note] of Object.entries(noteObj)) {
            const colIdx = headerMap[key];
            if (colIdx && colIdx <= lastCol) {
                rowNotes[colIdx - 1] = note;
            }
        }
        outputNotes.push(rowNotes);
      }
    }

    // Write to sheet
    const targetRange = sheet.getRange(lastRow + 1, 1, numRows, lastCol);
    targetRange.setValues(outputValues);

    if (outputNotes) {
        targetRange.setNotes(outputNotes);
    }
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
   * Ensures a column exists for the given header name.
   * If not, adds it to the sheet and updates the headerMap.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {string} headerName
   * @param {Object} headerMap
   */
  function ensureColumn(sheet, headerName, headerMap) {
    if (!headerName) return;
    const cleanHeader = headerName.trim();
    if (headerMap.hasOwnProperty(cleanHeader)) {
      return;
    }

    // Add new column
    const newColIdx = sheet.getLastColumn() + 1;
    sheet.getRange(1, newColIdx).setValue(cleanHeader);

    // Update map
    headerMap[cleanHeader] = newColIdx;
    console.log(`[SheetUtils] Created column '${cleanHeader}' at index ${newColIdx}`);
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

  /**
   * Updates notes for a single row in the sheet based on the notesObject and headerMap.
   * Only updates notes for columns present in the notesObject.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} rowIndex 1-based row index
   * @param {Object} notesObject Data to update { "HeaderName": "Note Content" }
   * @param {Object} headerMap Map of { "HeaderName": ColumnIndex }
   */
  function updateRowNotes(sheet, rowIndex, notesObject, headerMap) {
    const lastCol = sheet.getLastColumn();

    const rowRange = sheet.getRange(rowIndex, 1, 1, lastCol);
    const rowNotes = rowRange.getNotes()[0];

    let changed = false;
    for (const [key, note] of Object.entries(notesObject)) {
      const colIdx = headerMap[key];
      if (colIdx && colIdx <= lastCol) {
        rowNotes[colIdx - 1] = note;
        changed = true;
      }
    }

    if (changed) {
      rowRange.setNotes([rowNotes]);
    }
  }

  /**
   * Safely attempts to show a toast message.
   * Does nothing if UI is not available (e.g., time trigger).
   */
  function toast(msg, title, timeoutSeconds) {
    try {
        const ss = getSpreadsheet();
        ss.toast(msg, title, timeoutSeconds);
    } catch (e) {
        console.log(`[TOAST] ${title}: ${msg}`);
    }
  }

  /**
   * Safely attempts to show an alert.
   * Logs to console if UI is not available.
   */
  function alert(msg) {
    try {
        SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
        console.log(`[ALERT] ${msg}`);
    }
  }

  return {
    getSpreadsheet,
    getSheetByName,
    getConfigMap,
    setConfigValue,
    getHeaderMap,
    appendDataMapped,
    getDataAsObjects,
    updateRow,
    updateRowNotes,
    ensureColumn,
    toast,
    alert
  };

})();
