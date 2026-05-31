/**
 * FullTextScreeningController.js
 * Orchestrates the AI Full-Text Screening process stages.
 */

const FullTextScreeningController = (function () {

  /**
   * Shows the PDF Import dialog.
   */
  function showPDFImportDialog() {
    const html = HtmlService.createHtmlOutputFromFile('PDFImportUI')
      .setWidth(450)
      .setHeight(400)
      .setTitle('Import PDF Files');
    SpreadsheetApp.getUi().showModalDialog(html, 'Import PDF Files');
  }

  /**
   * Imports metadata from CSV URL.
   */
  function runImportFileMetadata() {
    try {
      const config = ConfigManager.getAll();
      const csvUrl = config["PDF_METADATA"];

      if (!csvUrl) {
        SheetUtils.alert("PDF_METADATA key is missing in Configuration.");
        return;
      }

      const csvContent = DriveUtils.getFileContent(csvUrl);
      if (!csvContent) {
        SheetUtils.alert("Fetched CSV content is empty.");
        return;
      }

      const csvData = Utilities.parseCsv(csvContent);
      if (!csvData || csvData.length === 0) {
        SheetUtils.alert("Parsed CSV data is empty.");
        return;
      }

      const sheet = SheetUtils.getSheetByName("98_file_metadata");
      sheet.clear();
      sheet.getRange(1, 1, csvData.length, csvData[0].length).setValues(csvData);

      SheetUtils.alert(`Successfully imported ${csvData.length - 1} rows into 98_file_metadata.`);
    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error importing metadata: ${e.message}`);
    }
  }

  /**
   * Imports PDF URLs.
   */
  function runImportPDFs() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      console.log("Could not acquire lock for PDF Import.");
      return;
    }

    try {
      const sheet = SheetUtils.getSheetByName("03_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);

      ['PDF', 'Page_Count', 'PDF_Validity', 'PDF_Status'].forEach(col => {
        SheetUtils.ensureColumn(sheet, col, headerMap);
      });

      const config = ConfigManager.getAll();
      const pdfRepoUrl = config["PDF_REPO"];

      if (!pdfRepoUrl) {
        SheetUtils.alert("PDF_REPO is missing in Configuration.");
        return;
      }

      const batchSizeProp = ConfigManager.get("PDF_IMPORT_BATCH_SIZE");
      const batchSize = batchSizeProp ? parseInt(batchSizeProp) : 50;

      const metadataMap = {};
      try {
        const metaSheet = SheetUtils.getSheetByName("98_file_metadata");
        if (metaSheet) {
          const metaData = SheetUtils.getDataAsObjects(metaSheet);
          metaData.forEach(row => {
            if (row["Paper_ID"]) {
              metadataMap[row["Paper_ID"]] = row;
            }
          });
        }
      } catch (e) {
        console.log("Metadata sheet not accessible.");
      }

      const data = SheetUtils.getDataAsObjects(sheet);
      const rowsToUpdate = data.filter(row => {
        const pdfMissing = !row["PDF"] || row["PDF"].toString().trim() === "";
        const metadataMissing = (!row["PDF_Validity"] && row["PDF_Validity"] !== false) || !row["Page_Count"] || !row["PDF_Status"];
        if (pdfMissing) return true;
        if (metadataMissing && metadataMap[row["Paper_ID"]]) return true;
        return false;
      });

      if (rowsToUpdate.length === 0) {
        SheetUtils.toast("No papers found needing PDF import or metadata update.", "PDF Import", 3);
        return;
      }

      const batch = rowsToUpdate.slice(0, batchSize);
      SheetUtils.toast(`Processing PDFs for ${batch.length} papers...`, "Importing", -1);

      let updatedCount = 0;
      batch.forEach(row => {
        const paperId = row["Paper_ID"];
        const updateData = {};

        if (!paperId) return;

        if (metadataMap[paperId]) {
          const meta = metadataMap[paperId];
          const verStatus = meta["Verification_Status"];
          updateData["Page_Count"] = meta["Page_Count"];
          updateData["PDF_Validity"] = (verStatus === "Confirmed");
          updateData["PDF_Status"] = verStatus;
        }

        if (!row["PDF"] || row["PDF"].toString().trim() === "") {
          try {
            const pdfUrl = DriveUtils.searchFile(pdfRepoUrl, paperId);
            if (pdfUrl) {
              updateData["PDF"] = pdfUrl;
            }
          } catch (err) {
            console.error(`Error searching PDF for ${paperId}: ${err.message}`);
          }
        }

        if (Object.keys(updateData).length > 0) {
          try {
            SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);
            updatedCount++;
          } catch (err) {
            console.error(`Error updating row: ${err.message}`);
          }
        }
      });

      SheetUtils.toast(`PDF Import Batch Complete. Updated: ${updatedCount}/${batch.length}`, "Done", 5);
    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error importing PDFs: ${e.message}`);
    } finally {
      lock.releaseLock();
    }
  }



  /**
   * Universal Helper to run a full-text stage
   */
  function runFullTextStage(stageName, sourceSheetName, destSheetName, promptKey, modelKey) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
        console.log(`Could not acquire lock for ${stageName}. Another instance is running.`);
        return;
    }

    try {
      const config = ConfigManager.getAll();
      const modelName = config[modelKey] || config["MODEL_NAME"] || "deepseek-r1";
      const batchSize = parseInt(config["BATCH_SIZE"] || "3");
      const parallelRequestSize = parseInt(config["PARALLEL_REQUEST_SIZE"] || "1");
      const systemPrompt = config[promptKey];
      const pdfRepoId = config["PDF_REPO_FOLDER_ID"] || config["PDF_REPO"] || "";

      if (!systemPrompt) {
        throw new Error(`${promptKey} is missing in Configuration.`);
      }

      const sourceSheet = SheetUtils.getSheetByName(sourceSheetName);
      const sourceHeaderMap = SheetUtils.getHeaderMap(sourceSheet);
      
      SheetUtils.ensureColumn(sourceSheet, "Status", sourceHeaderMap);
      
      const allSourceData = SheetUtils.getDataAsObjects(sourceSheet);
      const pendingRows = allSourceData.filter(row => {
        const dec = String(row["decision_Value"] || "").trim().toUpperCase();
        const status = String(row["Status"] || "").trim().toUpperCase();
        return dec === "INCLUDE" && status !== "PROCESSED" && status !== "ERROR";
      });

      if (pendingRows.length === 0) {
        SheetUtils.alert(`No pending included papers found in ${sourceSheetName} for ${stageName}.`);
        return;
      }

      const batch = pendingRows.slice(0, batchSize);
      SheetUtils.toast(`Starting ${stageName} for ${batch.length} papers.`, "Processing", 5);

      const destSheet = SheetUtils.getSheetByName(destSheetName);
      const destHeaderMap = SheetUtils.getHeaderMap(destSheet);

      let processedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < batch.length; i += parallelRequestSize) {
        const subBatch = batch.slice(i, i + parallelRequestSize);
        const promptsData = [];
        const activeSubBatch = [];

        subBatch.forEach(row => {
          let pdfBlob = null;
          let pdfLink = row["PDF_Link"] || row["PDF"] || "";
          
          if (!pdfLink && pdfRepoId) {
            const foundUrl = DriveUtils.searchFile(pdfRepoId, row["Paper_ID"]);
            if (foundUrl) {
              pdfLink = foundUrl;
              if (sourceHeaderMap["PDF_Link"]) {
                sourceSheet.getRange(row._rowIndex, sourceHeaderMap["PDF_Link"]).setValue(pdfLink);
              }
            }
          }

          if (pdfLink) {
            try {
              pdfBlob = DriveUtils.getFileBlob(pdfLink);
            } catch (err) {
              console.error(`Failed to load PDF for ${row["Paper_ID"]}: ${err.message}`);
            }
          }

          if (!pdfBlob) {
            console.error(`No PDF found or accessible for paper ${row["Paper_ID"]}`);
            sourceSheet.getRange(row._rowIndex, sourceHeaderMap["Status"])
              .setValue("Error")
              .setNote(`API_ERROR: PDF file not found or inaccessible in repository folder.`);
            errorCount++;
            return;
          }

          promptsData.push({ prompt: systemPrompt, fileBlob: pdfBlob });
          activeSubBatch.push(row);
        });

        if (promptsData.length === 0) continue;

        try {
          const responses = LlmService.fetchFromProxy(promptsData, modelName);

          responses.forEach((response, idx) => {
            const row = activeSubBatch[idx];
            
            if (response.error) {
              console.error(`API Error on row ${row._rowIndex}: ${response.message}`);
              sourceSheet.getRange(row._rowIndex, sourceHeaderMap["Status"])
                .setValue("API_ERROR")
                .setNote(`API_ERROR: ${response.message}`);
              errorCount++;
              return;
            }

            try {
              const result = response.content;
              const sheetHeaders = Object.keys(destHeaderMap);
              const mappedRow = SheetUtils.mapJsonToRow(result, sheetHeaders);

              const baseHeaders = ['Paper_ID', 'Import_Date', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
              baseHeaders.forEach(h => {
                mappedRow[h] = row[h] !== undefined ? row[h] : "";
              });

              if (response.usageMetadata) {
                mappedRow["Input_Tokens"] = response.usageMetadata.promptTokenCount || 0;
                mappedRow["Thinking_Tokens"] = response.usageMetadata.thoughtsTokenCount || 0;
                mappedRow["Output_Tokens"] = response.usageMetadata.candidatesTokenCount || 0;
                mappedRow["Total_Tokens"] = response.usageMetadata.totalTokenCount || 0;
                mappedRow["Tokens_Used"] = response.usageMetadata.totalTokenCount || 0;
              }

              const updatedDestHeaderMap = SheetUtils.getHeaderMap(destSheet);
              Object.keys(mappedRow).forEach(k => {
                SheetUtils.ensureColumn(destSheet, k, updatedDestHeaderMap);
              });
              const finalHeaderMap = SheetUtils.getHeaderMap(destSheet);
              SheetUtils.appendDataMapped(destSheet, [mappedRow], finalHeaderMap);

              sourceSheet.getRange(row._rowIndex, sourceHeaderMap["Status"]).setValue("Processed").clearNote();
              processedCount++;

            } catch (e) {
              console.error(`Error mapping response for row ${row._rowIndex}:`, e);
              sourceSheet.getRange(row._rowIndex, sourceHeaderMap["Status"])
                .setValue("API_ERROR")
                .setNote(`Mapping Error: ${e.message}`);
              errorCount++;
            }
          });
        } catch (e) {
          console.error(`Error processing parallel batch:`, e);
          activeSubBatch.forEach(row => {
            sourceSheet.getRange(row._rowIndex, sourceHeaderMap["Status"])
              .setValue("API_ERROR")
              .setNote(`API_ERROR: ${e.message}`);
            errorCount++;
          });
        }
      }

      const msg = `${stageName} Complete.\nProcessed: ${processedCount}\nErrors: ${errorCount}`;
      SheetUtils.toast(msg, "Job Done", 10);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`An unexpected error occurred: ${e.message}`);
    } finally {
      lock.releaseLock();
    }
  }

  function runStage21Gatekeeper() {
    runFullTextStage("Stage 2.1 (Gatekeeper)", "01_Fast_Filter", "02_Gatekeeper", "STAGE_2_1_PROMPT", "STAGE_2_1_MODEL");
  }

  function runStage22Scientist() {
    runFullTextStage("Stage 2.2 (Scientist)", "02_Gatekeeper", "03_Scientist", "STAGE_2_2_PROMPT", "STAGE_2_2_MODEL");
  }

  function runStage23Miner() {
    runFullTextStage("Stage 2.3 (Miner)", "03_Scientist", "04_Miner", "STAGE_2_3_PROMPT", "STAGE_2_3_MODEL");
  }

  return {
    runImportPDFs,
    showPDFImportDialog,
    runImportFileMetadata,
    runStage21Gatekeeper,
    runStage22Scientist,
    runStage23Miner
  };

})();

