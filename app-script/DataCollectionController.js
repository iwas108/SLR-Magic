/**
 * DataCollectionController.js
 * Handles the logic for syncing Included papers from 04_Miner to 05_Synthesis.
 */

const DataCollectionController = (function() {

  /**
   * Reads all papers from 04_Miner where decision_Value === "INCLUDE",
   * gathers all their properties across all stages, and writes them to 05_Synthesis.
   */
  function runSynthesisReport() {
    const ui = SpreadsheetApp.getUi();
    try {
      const minerSheet = SheetUtils.getSheetByName("04_Miner");
      const synthSheet = SheetUtils.getSheetByName("05_Synthesis");
      if (!minerSheet) {
        throw new Error("Sheet 04_Miner not found.");
      }
      if (!synthSheet) {
        throw new Error("Sheet 05_Synthesis not found.");
      }

      // 1. Read all rows from 04_Miner
      const minerData = SheetUtils.getDataAsObjects(minerSheet);
      
      // 2. Filter papers where decision_Value === "INCLUDE"
      const includedMinerPapers = minerData.filter(row => {
        const decision = String(row["decision_Value"] || "").trim().toUpperCase();
        return decision === "INCLUDE";
      });

      if (includedMinerPapers.length === 0) {
        ui.alert("No papers with decision_Value = 'INCLUDE' found in 04_Miner.");
        return;
      }

      // 3. Gather all columns across stages
      const stages = ["01_Fast_Filter", "02_Gatekeeper", "03_Scientist", "04_Miner"];
      const stageDataMaps = {}; // paperId -> combined properties

      stages.forEach(sheetName => {
        try {
          const sh = SheetUtils.getSheetByName(sheetName);
          if (sh) {
            const data = SheetUtils.getDataAsObjects(sh);
            data.forEach(row => {
              const paperId = row["Paper_ID"];
              if (paperId) {
                if (!stageDataMaps[paperId]) {
                  stageDataMaps[paperId] = {};
                }
                // Copy all properties except _rowIndex
                Object.keys(row).forEach(k => {
                  if (k !== "_rowIndex") {
                    stageDataMaps[paperId][k] = row[k];
                  }
                });
              }
            });
          }
        } catch (e) {
          console.warn("Could not read sheet " + sheetName + ": " + e.message);
        }
      });

      // Get the current headers of 05_Synthesis
      const lastCol = synthSheet.getLastColumn();
      if (lastCol === 0) {
        throw new Error("05_Synthesis has no headers initialized.");
      }
      const synthHeaders = synthSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());

      // Prepare rows to write
      const outputValues = [];
      includedMinerPapers.forEach(minerRow => {
        const paperId = minerRow["Paper_ID"];
        const mergedData = stageDataMaps[paperId] || minerRow;

        const rowValues = synthHeaders.map(header => {
          return mergedData[header] !== undefined ? mergedData[header] : "";
        });
        outputValues.push(rowValues);
      });

      // 4. Overwrite 05_Synthesis
      synthSheet.clear();
      
      // Write headers
      synthSheet.getRange(1, 1, 1, synthHeaders.length).setValues([synthHeaders]);
      synthSheet.getRange(1, 1, 1, synthHeaders.length).setFontWeight("bold");
      synthSheet.setFrozenRows(1);

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
