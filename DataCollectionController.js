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
      const outputValues = includedRows.map(row => {
          return finalColumns.map(col => {
              // Handle Paper_ID specifically if needed, but it should be in row object
              return row[col] || "";
          });
      });

      // Write Data
      if (outputValues.length > 0) {
          destSheet.getRange(2, 1, outputValues.length, finalColumns.length).setValues(outputValues);
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
