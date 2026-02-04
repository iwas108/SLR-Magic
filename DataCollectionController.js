/**
 * DataCollectionController.js
 * Handles the logic for syncing Included papers to 04_data_collection.
 */

var DataCollectionController = (function() {

  /**
   * Shows the Data Collection Sync UI.
   */
  function run() {
    const html = HtmlService.createHtmlOutputFromFile('DataCollectionSyncUI')
      .setWidth(400)
      .setHeight(500)
      .setTitle('Sync to Data Collection');
    SpreadsheetApp.getUi().showModalDialog(html, 'Sync to Data Collection');
  }

  /**
   * Gets headers from 02_fulltext_screening for selection.
   */
  function getDataCollectionColumns() {
    const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    return headers.filter(h => h && h.toString().trim() !== "");
  }

  /**
   * Syncs selected columns for "Included" papers to 04_data_collection.
   */
  function syncDataCollection(selectedColumns) {
    try {
      const sourceSheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const destSheet = SheetUtils.getSheetByName("04_data_collection");

      // 1. Get Source Data
      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);
      // Retrieve all notes to copy them as well
      const allNotes = sourceSheet.getDataRange().getNotes();
      const headerMap = SheetUtils.getHeaderMap(sourceSheet); // Map of Header -> Col Index (1-based)

      // 2. Filter "Include" papers (decision = Include)
      // "The source of truth is 02_fulltext_screening. Sync Included paper."
      const includedRows = sourceData.filter(row => {
          const decision = String(row["decision"] || "").trim().toUpperCase();
          return decision === "INCLUDE";
      });

      if (includedRows.length === 0) {
          throw new Error("No papers found with decision = 'Include' in 02_fulltext_screening.");
      }

      // 3. Prepare Destination Data
      const finalColumns = ['Paper_ID', ...selectedColumns];

      // Clear destination
      destSheet.clear();

      // Write Header
      destSheet.getRange(1, 1, 1, finalColumns.length).setValues([finalColumns]);

      // Map Data
      const outputValues = [];
      const outputNotes = [];

      includedRows.forEach(row => {
          const rowValues = [];
          const rowNotes = [];

          // Row index in source sheet (0-based for notes array)
          const sourceRowIdx = row._rowIndex - 1;
          const sourceRowNotes = allNotes[sourceRowIdx];

          finalColumns.forEach(col => {
              // Lookup key: trim it to match getDataAsObjects behavior
              const key = String(col).trim();

              // Value
              rowValues.push(row[key] || "");

              // Note
              let note = "";
              // headerMap keys are trimmed.
              if (headerMap[key]) {
                  const colIdx = headerMap[key] - 1; // 1-based to 0-based
                  if (sourceRowNotes && sourceRowNotes[colIdx]) {
                      note = sourceRowNotes[colIdx];
                  }
              }
              rowNotes.push(note);
          });
          outputValues.push(rowValues);
          outputNotes.push(rowNotes);
      });

      // Write Data
      if (outputValues.length > 0) {
          const rows = outputValues.length;
          const cols = finalColumns.length;
          const targetRange = destSheet.getRange(2, 1, rows, cols);
          targetRange.setValues(outputValues);
          targetRange.setNotes(outputNotes);
      }

      return `Sync Complete.\nSynced ${outputValues.length} papers.\n\nPlease do not modify any value in the destination sheet (read only). Make modifications in the source sheet and sync again.`;

    } catch (e) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  return {
    run,
    getDataCollectionColumns,
    syncDataCollection
  };

})();
