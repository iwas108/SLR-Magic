/**
 * QualityCheckController.js
 * Handles the logic for sampling data for Human Quality Check.
 */

var QualityCheckController = (function() {

  /**
   * Main function to execute the Quality Check sampling process.
   */
  function runQualityCheck() {
    console.log("[QualityCheck] Starting Human Quality Check sampling...");

    try {
      // 1. Get Source Data
      const sourceSheetName = "02_fulltext_screening";
      const sourceSheet = SheetUtils.getSheetByName(sourceSheetName);
      if (!sourceSheet) {
        SheetUtils.alert(`Sheet "${sourceSheetName}" not found.`);
        return;
      }
      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);
      console.log(`[QualityCheck] Source data loaded: ${sourceData.length} rows.`);

      // 2. Filter Eligible Rows
      const eligibleRows = sourceData.filter(row => {
        // PDF_Validity might be boolean true or string "TRUE" or "true"
        const isValid = (row["PDF_Validity"] === true || String(row["PDF_Validity"]).toUpperCase() === "TRUE");
        const isDone = (String(row["AI_Status"]).toUpperCase() === "DONE");
        return isValid && isDone;
      });

      console.log(`[QualityCheck] Eligible rows (PDF Valid & AI Done): ${eligibleRows.length}`);

      if (eligibleRows.length === 0) {
        SheetUtils.alert("No eligible rows found (PDF_Validity=TRUE and AI_Status=Done).");
        return;
      }

      // 3. Stratify by Recommendation
      const included = eligibleRows.filter(r => String(r["AI_Recommendation"]).trim().toUpperCase() === "INCLUDE");
      const excluded = eligibleRows.filter(r => String(r["AI_Recommendation"]).trim().toUpperCase() === "EXCLUDE");

      console.log(`[QualityCheck] Found ${included.length} Includes and ${excluded.length} Excludes.`);

      // 4. Sample 5%
      const sampleSizeInclude = Math.ceil(included.length * 0.05);
      const sampleSizeExclude = Math.ceil(excluded.length * 0.05);

      console.log(`[QualityCheck] Sampling target: ${sampleSizeInclude} Include, ${sampleSizeExclude} Exclude.`);

      const sampledInclude = getRandomSample(included, sampleSizeInclude);
      const sampledExclude = getRandomSample(excluded, sampleSizeExclude);

      const finalSample = [...sampledInclude, ...sampledExclude];

      if (finalSample.length === 0) {
        SheetUtils.alert("Not enough data to sample.");
        return;
      }

      // 5. Prepare Target Sheet
      const targetSheetName = "03_quality_check";
      let targetSheet;
      try {
          // Check if exists, otherwise create
          const ss = SheetUtils.getSpreadsheet();
          targetSheet = ss.getSheetByName(targetSheetName);
          if (!targetSheet) {
             targetSheet = ss.insertSheet(targetSheetName);
             console.log(`[QualityCheck] Created new sheet: ${targetSheetName}`);
          }
      } catch (e) {
         console.error(e);
         SheetUtils.alert(`Error accessing/creating sheet ${targetSheetName}: ${e.message}`);
         return;
      }

      // 6. Sync Headers
      // We want all headers from source + QC headers
      const sourceHeaderMap = SheetUtils.getHeaderMap(sourceSheet);
      // We re-fetch target map every time we add a column, or just maintain it manually.
      // SheetUtils.ensureColumn updates the map if passed, but let's be careful.
      const targetHeaderMap = SheetUtils.getHeaderMap(targetSheet);

      // Get source headers sorted by index to maintain order roughly
      const sourceHeaders = Object.keys(sourceHeaderMap).sort((a,b) => sourceHeaderMap[a] - sourceHeaderMap[b]);

      // Ensure source headers exist in target
      sourceHeaders.forEach(header => {
          SheetUtils.ensureColumn(targetSheet, header, targetHeaderMap);
      });

      // 7. Add QC Columns
      const qcColumns = [
          "HUMAN_QC_Decision_Agree",
          "HUMAN_QC_Reason_Valid",
          "HUMAN_QC_Data_Extraction_Score",
          "HUMAN_QC_Critical_Correction"
      ];

      qcColumns.forEach(header => {
          SheetUtils.ensureColumn(targetSheet, header, targetHeaderMap);
      });

      // 8. Filter Duplicates
      const existingTargetData = SheetUtils.getDataAsObjects(targetSheet);
      const existingIds = new Set(existingTargetData.map(r => r["Paper_ID"]));

      const newRows = finalSample.filter(r => !existingIds.has(r["Paper_ID"]));

      console.log(`[QualityCheck] New unique rows to add: ${newRows.length}`);

      if (newRows.length === 0) {
          SheetUtils.alert("Selected samples are already in the Quality Check sheet.");
          return;
      }

      // 9. Append Data
      SheetUtils.appendDataMapped(targetSheet, newRows, targetHeaderMap);

      SheetUtils.alert(
        `Quality Check Preparation Complete.\n\n` +
        `Total Eligible: ${eligibleRows.length}\n` +
        `Sampled (5%): ${finalSample.length} (${sampledInclude.length} Include, ${sampledExclude.length} Exclude)\n` +
        `Added to Sheet: ${newRows.length}`
      );

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error in Quality Check: ${e.message}`);
    }
  }

  /**
   * Randomly selects n items from an array.
   * @param {Array} array
   * @param {number} count
   * @returns {Array}
   */
  function getRandomSample(array, count) {
    if (count <= 0) return [];
    if (count >= array.length) return array.slice(0); // Return all if request >= available

    const shuffled = array.slice(0);
    // Fisher-Yates Shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  return {
    runQualityCheck
  };

})();
