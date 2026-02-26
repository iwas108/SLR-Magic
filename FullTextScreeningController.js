/**
 * FullTextScreeningController.js
 * Orchestrates the AI Full-Text Screening process.
 */

const FullTextScreeningController = (function() {

  /**
   * Shows the Copy Screened Papers dialog.
   */
  function showCopyScreenedPapersDialog() {
    const html = HtmlService.createHtmlOutputFromFile('CopyScreenedPapersUI')
      .setWidth(400)
      .setHeight(500)
      .setTitle('Copy Screened Papers');
    SpreadsheetApp.getUi().showModalDialog(html, 'Copy Screened Papers');
  }

  /**
   * Helper: Get headers from Abstract Screening sheet.
   */
  function getAbstractScreeningColumns() {
    const sheet = SheetUtils.getSheetByName("01_abstract_screening");
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    return headers.filter(h => h && h.toString().trim() !== "");
  }

  /**
   * Helper: Get headers from Full-Text Screening sheet.
   */
  function getFullTextScreeningColumns() {
    const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    return headers.filter(h => h && h.toString().trim() !== "");
  }

  /**
   * Helper: Get unique values for a specific column in Abstract Screening.
   */
  function getUniqueValuesForColumn(columnName) {
    const sheet = SheetUtils.getSheetByName("01_abstract_screening");
    const data = SheetUtils.getDataAsObjects(sheet);
    const values = new Set();

    data.forEach(row => {
      const val = row[columnName];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        values.add(String(val).trim());
      }
    });

    return Array.from(values);
  }

  /**
   * Process the copy operation based on user selection.
   * @param {string} columnName The column to filter by.
   * @param {Array<string>} includedValues The values to include.
   * @param {Array<string>} columnsToCopy The columns to copy from source to dest.
   */
  function processCopyScreenedPapers(columnName, includedValues, columnsToCopy) {
    try {
      const sourceSheet = SheetUtils.getSheetByName("01_abstract_screening");
      const destSheet = SheetUtils.getSheetByName("02_fulltext_screening");

      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);
      // Handle potential empty destination sheet
      let destData = [];
      if (destSheet.getLastRow() > 1) {
          destData = SheetUtils.getDataAsObjects(destSheet);
      }

      // Get existing Paper IDs in destination to avoid duplicates
      // "always use the 02_fulltext_screening as the source of truth"
      const existingIds = new Set(destData.map(row => row["Paper_ID"]));

      // Filter rows to copy
      const rowsToCopy = sourceData.filter(row => {
        const rowVal = String(row[columnName] || "").trim();
        // Check if value is in the included list
        // includedValues comes from client, ensure we compare correctly
        return includedValues.includes(rowVal);
      });

      if (rowsToCopy.length === 0) {
        return "No papers match the selected criteria.";
      }

      const newRows = [];
      let skippedCount = 0;

      rowsToCopy.forEach(row => {
        if (!existingIds.has(row["Paper_ID"])) {
          const newRow = {
            "Paper_ID": row["Paper_ID"], // Always copy Paper_ID
            "AI_Status": "Pending"       // Reset status for full text screening
          };

          // Copy selected columns
          if (columnsToCopy && Array.isArray(columnsToCopy)) {
            columnsToCopy.forEach(col => {
              // Exclude AI_Status to prevent overwriting "Pending"
              if (row[col] !== undefined && col !== 'AI_Status') {
                newRow[col] = row[col];
              }
            });
          }

          newRows.push(newRow);
        } else {
          skippedCount++;
        }
      });

      if (newRows.length > 0) {
        // Ensure columns exist in destination sheet (in case it's empty)
        // We pass a potentially empty map if the sheet is empty
        const destHeaderMap = SheetUtils.getHeaderMap(destSheet);

        // Use keys from the first row to check/create columns
        // The object structure is uniform for all newRows
        // We use all columnsToCopy to ensure structure, plus Paper_ID and AI_Status
        const sampleRow = newRows[0];
        Object.keys(sampleRow).forEach(key => {
            SheetUtils.ensureColumn(destSheet, key, destHeaderMap);
        });

        // Re-fetch header map to ensure we have the correct indices for the newly created columns
        const updatedHeaderMap = SheetUtils.getHeaderMap(destSheet);

        SheetUtils.appendDataMapped(destSheet, newRows, updatedHeaderMap);
        return `Copied ${newRows.length} papers to Full-Text Screening.\n(Skipped ${skippedCount} existing papers)`;
      } else {
        return `All matching papers are already present in Full-Text Screening.\n(Skipped ${skippedCount} existing papers)`;
      }

    } catch (e) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  /**
   * Wraps the dialog display for external calls.
   * Keeps the name runCopyScreenedPapers for compatibility with existing menu.
   */
  function runCopyScreenedPapers() {
      showCopyScreenedPapersDialog();
  }

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
   * Imports metadata from CSV URL specified in 00_manifest.
   */
  function runImportFileMetadata() {
    try {
      const config = ConfigManager.getAll();
      const csvUrl = config["PDF_METADATA"];

      if (!csvUrl) {
        SheetUtils.alert("PDF_METADATA key is missing in Configuration. Please add the CSV URL.");
        return;
      }

      // Fetch CSV
      const csvContent = DriveUtils.getFileContent(csvUrl);

      if (!csvContent) {
        SheetUtils.alert("Fetched CSV content is empty.");
        return;
      }

      // Parse CSV
      // We use Utilities.parseCsv to get raw 2D array for exact replication
      const csvData = Utilities.parseCsv(csvContent);

      if (!csvData || csvData.length === 0) {
        SheetUtils.alert("Parsed CSV data is empty.");
        return;
      }

      const sheet = SheetUtils.getSheetByName("98_file_metadata");

      // Clear existing content
      sheet.clear();

      // Write new content
      sheet.getRange(1, 1, csvData.length, csvData[0].length).setValues(csvData);

      SheetUtils.alert(`Successfully imported ${csvData.length - 1} metadata rows into 98_file_metadata.`);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error importing metadata: ${e.message}`);
    }
  }

  /**
   * Imports PDF URLs into the Full-Text Screening sheet.
   * Supports background processing with batch size.
   * improved to read 98_file_metadata for PDF validity and page count.
   */
  function runImportPDFs() {
    // Acquire Lock to prevent race conditions
    const lock = LockService.getScriptLock();
    // Try to acquire lock for 30 seconds
    if (!lock.tryLock(30000)) {
        console.log("Could not acquire lock. Another instance of PDF Import is likely running.");
        return;
    }

    try {
      // 0. Ensure target columns exist in 02_fulltext_screening
      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);

      // Ensure columns required for import exist
      ['PDF', 'Page_Count', 'PDF_Validity', 'PDF_Status'].forEach(col => {
        SheetUtils.ensureColumn(sheet, col, headerMap);
      });

      const config = ConfigManager.getAll();
      const pdfRepoUrl = config["PDF_REPO"];

      if (!pdfRepoUrl) {
        SheetUtils.alert("PDF_REPO is missing in Configuration.");
        return;
      }

      // Check for batch size property (from user input via background setup)
      const batchSizeProp = PropertiesService.getScriptProperties().getProperty("PDF_IMPORT_BATCH_SIZE");
      // Default to 50 if not set or invalid
      const batchSize = batchSizeProp ? parseInt(batchSizeProp) : 50;

      // 1. Read Metadata Sheet (98_file_metadata)
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
        console.log("Metadata sheet '98_file_metadata' not found or accessible. Proceeding with basic import.");
      }

      // Re-fetch data objects after ensuring columns (though ensureColumn updates headerMap in place ideally,
      // but let's just proceed with existing map or refresh if needed.
      // SheetUtils.ensureColumn updates the passed map object, so headerMap is valid).
      const data = SheetUtils.getDataAsObjects(sheet);

      let updatedCount = 0;

      // Determine which rows need update
      // Logic: Row needs update if (PDF is missing) OR (PDF is present but metadata is missing in sheet AND present in metadataMap)
      // Metadata columns: PDF_Validity, Page_Count, PDF_Status
      const rowsToUpdate = data.filter(row => {
        const pdfMissing = !row["PDF"] || row["PDF"].toString().trim() === "";

        // Check if metadata columns are empty in the destination sheet
        // We consider them "empty" if they are falsy (empty string, null, etc.)
        const metadataMissing = (!row["PDF_Validity"] && row["PDF_Validity"] !== false) || !row["Page_Count"] || !row["PDF_Status"];

        // If PDF is missing, we definitely want to process it (to try finding PDF)
        if (pdfMissing) return true;

        // If PDF exists, but metadata is missing AND we have metadata available for this Paper_ID
        if (metadataMissing && metadataMap[row["Paper_ID"]]) {
          return true;
        }

        return false;
      });

      if (rowsToUpdate.length === 0) {
        SheetUtils.toast("No papers found needing PDF import or metadata update.", "PDF Import", 3);
        return;
      }

      // Slice to batch size
      const batch = rowsToUpdate.slice(0, batchSize);

      SheetUtils.toast(`Processing PDFs/Metadata for ${batch.length} papers...`, "Importing", -1);

      batch.forEach(row => {
        const paperId = row["Paper_ID"];
        const updateData = {};

        if (!paperId) return;

        // 1. Apply Metadata if available
        if (metadataMap[paperId]) {
          const meta = metadataMap[paperId];
          const verStatus = meta["Verification_Status"];

          updateData["Page_Count"] = meta["Page_Count"];
          // PDF_Validity: TRUE if Verification_Status is "Confirmed"
          updateData["PDF_Validity"] = (verStatus === "Confirmed");
          // PDF_Status: mapped from Verification_Status
          updateData["PDF_Status"] = verStatus;
        }

        // 2. Search PDF if missing
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

        // 3. Update Sheet if we have data to write
        if (Object.keys(updateData).length > 0) {
          try {
            SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);
            updatedCount++;
          } catch (err) {
            console.error(`Error updating row ${row._rowIndex}: ${err.message}`);
          }
        }
      });

      SheetUtils.toast(`PDF Import/Update Batch Complete. Updated: ${updatedCount}/${batch.length}`, "Done", 5);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error importing PDFs: ${e.message}`);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Runs the AI Full-Text Screening with Multi-Stage Prompting.
   */
  function runScreening() {
    // Acquire Lock
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
        console.log("Could not acquire lock. Another instance of Full Text Screening is likely running.");
        return;
    }

    try {
      // 1. Read Configuration
      const config = ConfigManager.getAll();
      const apiKey = config["API_KEY"];

      // Load Stage Models
      const gatekeeperModel = config["THE_GATEKEEPER_MODEL"] || "gemini-2.0-flash-lite";
      const scientistModel = config["THE_SCIENTIST_MODEL"] || "gemini-2.0-flash-lite";
      const minerModel = config["THE_MINER_MODEL"] || "gemini-2.0-flash-lite";

      const temperature = parseFloat(config["TEMPERATURE"] || "0.7");
      const maxTokens = parseInt(config["MAX_TOKENS"] || "8192");

      // Load 3 Prompts
      const gatekeeperPrompt = config["THE_GATEKEEPER_PROMPT"];
      const scientistPrompt = config["THE_SCIENTIST_PROMPT"];
      const minerPrompt = config["THE_MINER_PROMPT"];
      const batchSize = parseInt(config["BATCH_SIZE"] || "3");

      if (!apiKey) throw new Error("API_KEY is missing in Configuration.");
      if (!gatekeeperPrompt) throw new Error("THE_GATEKEEPER_PROMPT is missing in Configuration.");
      if (!scientistPrompt) throw new Error("THE_SCIENTIST_PROMPT is missing in Configuration.");
      if (!minerPrompt) throw new Error("THE_MINER_PROMPT is missing in Configuration.");

      // Reasoning Config Helper
      const getReasoningConfig = (model) => {
          const lowerModel = (model || "").toLowerCase();
          let level = undefined;
          let budget = undefined;

          if (lowerModel.includes("gemini-2.5") || lowerModel.includes("flash-thinking")) {
              budget = config["THINKING_BUDGET"];
          } else if (lowerModel.includes("gemini-3")) {
              level = config["THINKING_LEVEL"];
          }
          return { level, budget };
      };

      // 2. Get Data
      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);
      const allData = SheetUtils.getDataAsObjects(sheet);

      // 3. Filter Pending Rows
      const pendingRows = allData.filter(row => row["AI_Status"] === "Pending");

      if (pendingRows.length === 0) {
        SheetUtils.toast("No pending rows found for full-text screening.", "Info", 3);
        return;
      }

      // 4. Process Batch
      const batch = pendingRows.slice(0, batchSize);
      SheetUtils.toast(`Starting multi-stage screening for ${batch.length} papers...`, "Processing", -1);

      let processedCount = 0;
      let errorCount = 0;

      // Helper function to accumulate usage metadata per stage
      const accumulateTokens = (usageMap, stageName, newUsage) => {
          if (!newUsage) return;
          if (!usageMap[stageName]) {
              usageMap[stageName] = { thinking: 0, candidate: 0, input: 0, total: 0 };
          }
          const current = usageMap[stageName];
          current.thinking += (newUsage.thoughtsTokenCount || 0);
          current.candidate += (newUsage.candidatesTokenCount || 0);
          current.input += (newUsage.promptTokenCount || 0);
          current.total += (newUsage.totalTokenCount || 0);
      };

      // Helper to process fields (flattening and value/evidence)
      const processContent = (content, targetData, targetNotes) => {
          for (const [key, value] of Object.entries(content)) {
               if (value && typeof value === 'object' && value.hasOwnProperty('value')) {
                   targetData[key] = value.value;
                   if (value.hasOwnProperty('evidence')) {
                      targetNotes[key] = value.evidence;
                   }
               } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                   // Recursive flatten for nested objects that are NOT value/evidence pairs
                   processContent(value, targetData, targetNotes);
               } else {
                   // Primitive or Array
                   targetData[key] = value;
               }
          }
      };

      batch.forEach((row, index) => {
        const pdfUrl = row["PDF"];
        console.log(`Processing Row ${row._rowIndex}, PDF: ${pdfUrl}`);

        const rowUpdateData = { "AI_Status": "Done" };
        const rowUpdateNotes = {};
        const tokenUsageByStage = {};

        const pdfValidity = row["PDF_Validity"];

        // Initial PDF Check
        if (!pdfValidity) {
            rowUpdateData["AI_Recommendation"] = "Exclude";
            rowUpdateData["Exclusion_Reason"] = "EC5_WrongDoc";
            rowUpdateData["AI_Reasoning"] = "No PDF file linked.";

            SheetUtils.updateRow(sheet, row._rowIndex, rowUpdateData, headerMap);
            processedCount++;
            return;
        }

        try {
            const pdfBlob = DriveUtils.getFileBlob(pdfUrl);

            // --- STAGE 1: THE GATEKEEPER ---
            const gkReasoning = getReasoningConfig(gatekeeperModel);
            const stage1Resp = GeminiAdapter.callGemini(gatekeeperPrompt, apiKey, gatekeeperModel, temperature, maxTokens, gkReasoning.level, gkReasoning.budget, pdfBlob);
            accumulateTokens(tokenUsageByStage, "The_Gatekeeper", stage1Resp.usageMetadata);
            processContent(stage1Resp.content, rowUpdateData, rowUpdateNotes);

            let decision = rowUpdateData["decision"];
            // Normalize decision check
            let isExcluded = (String(decision).trim().toUpperCase() === "EXCLUDE");
            let isIncluded = (String(decision).trim().toUpperCase() === "INCLUDE");

            if (isExcluded) {
                // Stop here, write data
            } else if (isIncluded) {

                // --- STAGE 2: THE SCIENTIST ---
                const sciReasoning = getReasoningConfig(scientistModel);
                const stage2Resp = GeminiAdapter.callGemini(scientistPrompt, apiKey, scientistModel, temperature, maxTokens, sciReasoning.level, sciReasoning.budget, pdfBlob);
                accumulateTokens(tokenUsageByStage, "The_Scientist", stage2Resp.usageMetadata);
                processContent(stage2Resp.content, rowUpdateData, rowUpdateNotes);

                decision = rowUpdateData["decision"]; // Update decision from Stage 2
                isExcluded = (String(decision).trim().toUpperCase() === "EXCLUDE");
                isIncluded = (String(decision).trim().toUpperCase() === "INCLUDE");

                if (isExcluded) {
                    // Stop here
                } else if (isIncluded) {

                    // --- STAGE 3: THE MINER ---
                    const minerReasoning = getReasoningConfig(minerModel);
                    const stage3Resp = GeminiAdapter.callGemini(minerPrompt, apiKey, minerModel, temperature, maxTokens, minerReasoning.level, minerReasoning.budget, pdfBlob);
                    accumulateTokens(tokenUsageByStage, "The_Miner", stage3Resp.usageMetadata);
                    // Stage 3 is pure extraction, no decision check
                    processContent(stage3Resp.content, rowUpdateData, rowUpdateNotes);
                }
            }

            // Write Token Usage per Stage
            Object.keys(tokenUsageByStage).forEach(stageName => {
                const usage = tokenUsageByStage[stageName];
                // Append stage name to columns
                rowUpdateData[`Thinking_Token_${stageName}`] = usage.thinking;
                rowUpdateData[`Candidate_Token_${stageName}`] = usage.candidate;
                rowUpdateData[`Input_Token_${stageName}`] = usage.input;
                rowUpdateData[`Total_Token_${stageName}`] = usage.total;
            });

            // Ensure columns exist
            for (const key of Object.keys(rowUpdateData)) {
                SheetUtils.ensureColumn(sheet, key, headerMap);
            }

            // Write Data
            SheetUtils.updateRow(sheet, row._rowIndex, rowUpdateData, headerMap);
            if (Object.keys(rowUpdateNotes).length > 0) {
                SheetUtils.updateRowNotes(sheet, row._rowIndex, rowUpdateNotes, headerMap);
            }

            processedCount++;

        } catch (e) {
            console.error(`Error processing row ${row._rowIndex}:`, e);
            rowUpdateData["AI_Status"] = "Error";
            rowUpdateData["Notes"] = `Error: ${e.message}`;
            SheetUtils.updateRow(sheet, row._rowIndex, rowUpdateData, headerMap);
            errorCount++;
        }

        if (index < batch.length - 1) {
            Utilities.sleep(3000);
        }
      });

      SheetUtils.toast(`Multi-Stage Screening Complete.\nProcessed: ${processedCount}\nErrors: ${errorCount}`, "Job Done", 10);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`An unexpected error occurred: ${e.message}`);
    } finally {
        lock.releaseLock();
    }
  }

  /**
   * Transforms DOI Links to use a web proxy for manual download.
   */
  function runTransformDOILinks() {
    try {
      console.log("[DEBUG] Starting runTransformDOILinks");
      const config = ConfigManager.getAll();
      const proxyUrl = config["WEB_PROXY_URL"];
      console.log(`[DEBUG] Proxy URL: ${proxyUrl}`);

      if (!proxyUrl) {
        SheetUtils.alert("WEB_PROXY_URL is missing in Configuration.");
        return;
      }

      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);
      const data = SheetUtils.getDataAsObjects(sheet);
      let updatedCount = 0;

      const rowsToProcess = data.filter(row => {
          const pdf = row["PDF"];
          const doi = row["DOI_Link"];
          const isPdfMissing = !pdf || pdf.toString().trim() === "";
          const isDoiPresent = doi && doi.toString().trim() !== "";
          return isPdfMissing && isDoiPresent;
      });

      if (rowsToProcess.length === 0) {
        SheetUtils.alert("No rows with missing PDFs and valid DOI Links found.");
        return;
      }

      rowsToProcess.forEach(row => {
        const originalUrl = row["DOI_Link"].toString().trim();
        try {
          if (originalUrl.includes(proxyUrl)) return;

          const urlRegex = /^(https?:\/\/)([^/?#]+)(.*)$/;
          const match = originalUrl.match(urlRegex);

          if (!match) return;

          const protocol = match[1];
          const hostname = match[2];
          const rest = match[3];

          const transformedHostname = hostname.replace(/\./g, '-');
          const newUrl = `${protocol}${transformedHostname}.${proxyUrl}${rest}`;

          SheetUtils.updateRow(sheet, row._rowIndex, { "DOI_Link": newUrl }, headerMap);
          updatedCount++;

        } catch (err) {
            console.warn(`Could not transform URL for row ${row._rowIndex}: ${originalUrl}`, err);
        }
      });

      SheetUtils.alert(`Transformed ${updatedCount} DOI Links.`);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error transforming DOI links: ${e.message}`);
    }
  }

  return {
    runCopyScreenedPapers,
    runImportPDFs,
    runScreening,
    runTransformDOILinks,
    showCopyScreenedPapersDialog,
    getAbstractScreeningColumns,
    getUniqueValuesForColumn,
    processCopyScreenedPapers,
    showPDFImportDialog,
    runImportFileMetadata,
    getFullTextScreeningColumns
  };

})();
