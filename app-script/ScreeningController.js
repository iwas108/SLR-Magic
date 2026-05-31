/**
 * ScreeningController.js
 * Orchestrates the Stage 1: Title-Abstract Screening process.
 */

const ScreeningController = (function() {

  /**
   * Main entry point called from global runStage1AbstractScreening()
   */
  function runStage1AbstractScreening() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
        console.log("Could not acquire lock. Another instance of Screening is likely running.");
        return;
    }

    try {
      // 1. Read Configuration
      const config = ConfigManager.getAll();
      const modelName = config["STAGE_1_MODEL"] || config["MODEL_NAME"] || "deepseek-r1";
      const batchSize = parseInt(config["BATCH_SIZE"] || "5");
      const parallelRequestSize = parseInt(config["PARALLEL_REQUEST_SIZE"] || "1");
      const systemPrompt = config["STAGE_1_PROMPT"];

      if (!systemPrompt) {
        throw new Error("STAGE_1_PROMPT is missing in Configuration.");
      }

      // 2. Get Data from 00_Raw_Harvest
      const harvestSheet = SheetUtils.getSheetByName("00_Raw_Harvest");
      const harvestHeaderMap = SheetUtils.getHeaderMap(harvestSheet);
      
      // Ensure 'Status' column exists in 00_Raw_Harvest
      SheetUtils.ensureColumn(harvestSheet, "Status", harvestHeaderMap);
      
      const allHarvestData = SheetUtils.getDataAsObjects(harvestSheet);

      // 3. Filter Pending Rows (where Status != Processed)
      const pendingRows = allHarvestData.filter(row => {
        const status = String(row["Status"] || "").trim().toUpperCase();
        return status !== "PROCESSED" && status !== "ERROR";
      });

      if (pendingRows.length === 0) {
        SheetUtils.alert("No pending papers found in 00_Raw_Harvest.");
        return;
      }

      // 4. Process Batch
      const batch = pendingRows.slice(0, batchSize);
      SheetUtils.toast(`Starting Stage 1 screening for ${batch.length} papers.`, "Processing", 5);

      const destSheet = SheetUtils.getSheetByName("01_Fast_Filter");
      const destHeaderMap = SheetUtils.getHeaderMap(destSheet);

      let processedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < batch.length; i += parallelRequestSize) {
        const subBatch = batch.slice(i, i + parallelRequestSize);
        const promptsData = subBatch.map(row => {
          const title = row["Title"] || "";
          const abstract = row["Abstract"] || "";
          const fullPrompt = `${systemPrompt}\n\n---\n\nPaper to Evaluate:\nTitle: ${title}\nAbstract: ${abstract}`;
          return { prompt: fullPrompt, fileBlob: null };
        });

        try {
          const responses = LlmService.fetchFromProxy(promptsData, modelName);

          responses.forEach((response, idx) => {
            const row = subBatch[idx];
            
            if (response.error) {
              console.error(`API Error on row ${row._rowIndex}: ${response.message}`);
              harvestSheet.getRange(row._rowIndex, harvestHeaderMap["Status"])
                .setValue("API_ERROR")
                .setNote(`API_ERROR: ${response.message}`);
              errorCount++;
              return;
            }

            try {
              const result = response.content;
              
              // Map dynamic JSON response to target sheet row
              const sheetHeaders = Object.keys(destHeaderMap);
              const mappedRow = SheetUtils.mapJsonToRow(result, sheetHeaders);

              // Copy base metadata fields from harvest row
              const baseHeaders = ['Paper_ID', 'Import_Date', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
              baseHeaders.forEach(h => {
                mappedRow[h] = row[h] !== undefined ? row[h] : "";
              });

              // Add token usage metadata to mapped row if available
              if (response.usageMetadata) {
                mappedRow["Input_Tokens"] = response.usageMetadata.promptTokenCount || 0;
                mappedRow["Thinking_Tokens"] = response.usageMetadata.thoughtsTokenCount || 0;
                mappedRow["Output_Tokens"] = response.usageMetadata.candidatesTokenCount || 0;
                mappedRow["Total_Tokens"] = response.usageMetadata.totalTokenCount || 0;
                mappedRow["Tokens_Used"] = response.usageMetadata.totalTokenCount || 0;
              }

              // Append mapped record to 01_Fast_Filter
              const updatedDestHeaderMap = SheetUtils.getHeaderMap(destSheet);
              Object.keys(mappedRow).forEach(k => {
                SheetUtils.ensureColumn(destSheet, k, updatedDestHeaderMap);
              });
              const finalHeaderMap = SheetUtils.getHeaderMap(destSheet);
              SheetUtils.appendDataMapped(destSheet, [mappedRow], finalHeaderMap);

              // Mark raw harvest paper as Processed
              harvestSheet.getRange(row._rowIndex, harvestHeaderMap["Status"]).setValue("Processed").clearNote();
              processedCount++;

            } catch (e) {
              console.error(`Error mapping response for row ${row._rowIndex}:`, e);
              harvestSheet.getRange(row._rowIndex, harvestHeaderMap["Status"])
                .setValue("API_ERROR")
                .setNote(`Mapping Error: ${e.message}`);
              errorCount++;
            }
          });
        } catch (e) {
          console.error(`Error processing parallel batch:`, e);
          subBatch.forEach(row => {
            harvestSheet.getRange(row._rowIndex, harvestHeaderMap["Status"])
              .setValue("API_ERROR")
              .setNote(`API_ERROR: ${e.message}`);
            errorCount++;
          });
        }
      }

      const msg = `Stage 1 Screening Complete.\nProcessed: ${processedCount}\nErrors: ${errorCount}`;
      SheetUtils.toast(msg, "Job Done", 10);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`An unexpected error occurred: ${e.message}`);
    } finally {
      lock.releaseLock();
    }
  }

  return {
    runStage1AbstractScreening
  };

})();
