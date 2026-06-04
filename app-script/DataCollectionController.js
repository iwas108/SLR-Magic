/**
 * DataCollectionController.js
 * Handles the logic for syncing Included papers from 00_Raw_Harvest to 05_Synthesis.
 */

const DataCollectionController = (function() {

  /**
   * Reads all papers from 00_Raw_Harvest where Status === "INCLUDE",
   * and writes them to 05_Synthesis.
   */
  function runSynthesisReport() {
    const ui = SpreadsheetApp.getUi();
    try {
      const rawSheet = SheetUtils.getSheetByName("00_Raw_Harvest");
      const synthSheet = SheetUtils.getSheetByName("05_Synthesis");
      if (!rawSheet) {
        throw new Error("Sheet 00_Raw_Harvest not found.");
      }
      if (!synthSheet) {
        throw new Error("Sheet 05_Synthesis not found.");
      }

      // 1. Read all rows from 00_Raw_Harvest
      const rawData = SheetUtils.getDataAsObjects(rawSheet);
      
      // 2. Filter papers where Status === "INCLUDE" or "INCLUDED"
      const includedPapers = rawData.filter(row => {
        const status = String(row["Status"] || "").trim().toUpperCase();
        return status === "INCLUDE" || status === "INCLUDED";
      });

      if (includedPapers.length === 0) {
        ui.alert("No papers with Status = 'INCLUDE' found in 00_Raw_Harvest.");
        return;
      }

      // Get the current headers of 05_Synthesis
      const lastCol = synthSheet.getLastColumn();
      if (lastCol === 0) {
        throw new Error("05_Synthesis has no headers initialized. Please run Initialize Workspace.");
      }
      const synthHeaders = synthSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());

      // Prepare rows to write
      const outputValues = [];
      includedPapers.forEach(row => {
        const rowValues = synthHeaders.map(header => {
          return row[header] !== undefined ? row[header] : "";
        });
        outputValues.push(rowValues);
      });

      // 3. Overwrite 05_Synthesis content (leaving headers intact)
      synthSheet.clearContents();
      
      if (outputValues.length > 0) {
        synthSheet.getRange(2, 1, outputValues.length, synthHeaders.length).setValues(outputValues);
      }

      ui.alert(`Synthesis Report Generated successfully!\nSynced ${outputValues.length} papers to 05_Synthesis.`);
    } catch (e) {
      console.error(e);
      ui.alert("Synthesis Generation failed: " + e.message);
    }
  }

  return {
    runSynthesisReport: runSynthesisReport
  };

})();
