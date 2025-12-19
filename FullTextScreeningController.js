/**
 * FullTextScreeningController.js
 * Orchestrates the AI Full-Text Screening process.
 */

const FullTextScreeningController = (function() {

  /**
   * Copies "Include" and "Maybe" papers from Abstract Screening to Full Text Screening.
   */
  function runCopyScreenedPapers() {
    try {
      const sourceSheet = SheetUtils.getSheetByName("01_abstract_screening");
      const destSheet = SheetUtils.getSheetByName("02_fulltext_screening");

      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);
      const destData = SheetUtils.getDataAsObjects(destSheet);

      // Get existing Paper IDs in destination to avoid duplicates
      const existingIds = new Set(destData.map(row => row["Paper_ID"]));

      // Filter rows to copy
      const rowsToCopy = sourceData.filter(row => {
        const decision = (row["Human_Decision"] || "").trim();
        return (decision === "Include" || decision === "Maybe");
      });

      if (rowsToCopy.length === 0) {
        SheetUtils.alert("No papers marked as 'Include' or 'Maybe' found in abstract screening.");
        return;
      }

      const newRows = [];
      rowsToCopy.forEach(row => {
        if (!existingIds.has(row["Paper_ID"])) {
          newRows.push({
            "Paper_ID": row["Paper_ID"],
            "Title": row["Title"],
            "Abstract": row["Abstract"],
            "Year": row["Year"],
            "Authors": row["Authors"],
            "DOI_Link": row["DOI_Link"],
            "Source_DB": row["Source_DB"],
            "AI_Status": "Pending" // Reset status for full text screening
          });
        }
      });

      if (newRows.length > 0) {
        const destHeaderMap = SheetUtils.getHeaderMap(destSheet);
        SheetUtils.appendDataMapped(destSheet, newRows, destHeaderMap);
        SheetUtils.alert(`Copied ${newRows.length} papers to Full-Text Screening.`);
      } else {
        SheetUtils.alert("All relevant papers are already present in Full-Text Screening.");
      }

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error copying papers: ${e.message}`);
    }
  }

  /**
   * Imports PDF URLs into the Full-Text Screening sheet.
   */
  function runImportPDFs() {
    try {
      const config = SheetUtils.getConfigMap("00_manifest");
      const pdfRepoUrl = config["PDF_REPO"];

      if (!pdfRepoUrl) {
        SheetUtils.alert("PDF_REPO is missing in 00_manifest.");
        return;
      }

      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);
      const data = SheetUtils.getDataAsObjects(sheet);

      let foundCount = 0;

      // Determine which rows need PDF search
      // We can search for all, or just those with empty PDF column.
      // To be robust, let's search for those with empty PDF column.
      const rowsToUpdate = data.filter(row => !row["PDF"]);

      if (rowsToUpdate.length === 0) {
        SheetUtils.alert("All papers already have PDF links or the sheet is empty.");
        return;
      }

      SheetUtils.toast(`Searching PDFs for ${rowsToUpdate.length} papers...`, "Importing PDFs", -1);

      rowsToUpdate.forEach(row => {
        const paperId = row["Paper_ID"];
        if (paperId) {
          const pdfUrl = DriveUtils.searchFile(pdfRepoUrl, paperId);
          if (pdfUrl) {
            SheetUtils.updateRow(sheet, row._rowIndex, { "PDF": pdfUrl }, headerMap);
            foundCount++;
          }
        }
      });

      SheetUtils.toast(`PDF Import Complete. Found: ${foundCount}/${rowsToUpdate.length}`, "Done", 5);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error importing PDFs: ${e.message}`);
    }
  }

  /**
   * Runs the AI Full-Text Screening.
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
      const config = SheetUtils.getConfigMap("00_manifest");
      const apiKey = config["API_KEY"];
      const modelName = config["MODEL_NAME"] || "gemini-1.5-flash";
      const temperature = parseFloat(config["TEMPERATURE"] || "0.7");
      const maxTokens = parseInt(config["MAX_TOKENS"] || "1024");
      // Use FULLTEXT_SCREENING_PROMPT
      const systemPrompt = config["FULLTEXT_SCREENING_PROMPT"];
      // Reuse BATCH_SIZE or define a new one? Assuming BATCH_SIZE is shared or small enough.
      // Full text processing takes longer, so maybe smaller batch size is better, but let's stick to config.
      const batchSize = parseInt(config["BATCH_SIZE"] || "3");

      if (!apiKey) {
        throw new Error("API_KEY is missing in 00_manifest.");
      }
      if (!systemPrompt) {
        throw new Error("FULLTEXT_SCREENING_PROMPT is missing in 00_manifest.");
      }

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
      SheetUtils.toast(`Starting full-text screening for ${batch.length} papers...`, "Processing", -1);

      let processedCount = 0;
      let errorCount = 0;

      batch.forEach((row, index) => {
        const pdfUrl = row["PDF"];
        const updateData = {};

        if (!pdfUrl) {
          // No PDF found, mark as Exclude EC4_WrongDoc
          updateData["AI_Status"] = "Done";
          updateData["AI_Recommendation"] = "EXCLUDE";
          updateData["Exclusion_Reason"] = "EC4_WrongDoc";
          updateData["AI_Reasoning"] = "No PDF file linked.";

          SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);
          processedCount++; // Counted as processed even if skipped
          return;
        }

        try {
          const pdfBlob = DriveUtils.getFileBlob(pdfUrl);

          // Call Gemini
          const result = GeminiAdapter.callGemini(systemPrompt, apiKey, modelName, temperature, maxTokens, pdfBlob);

          // Map result to sheet columns
          updateData["AI_Status"] = "Done";
          updateData["AI_Relevance_Score"] = result.confidence_score;
          updateData["AI_Recommendation"] = result.decision;
          updateData["AI_Reasoning"] = result.reasoning;
          updateData["Exclusion_Reason"] = result.exclusion_code || "";

          // extraction_preview is not mapped as there are no columns for it yet,
          // but if needed we could put it in Notes.
          // For now, adhere to columns requested.

          processedCount++;

        } catch (e) {
          console.error(`Error processing row ${row._rowIndex}:`, e);
          updateData["AI_Status"] = "Error";
          updateData["Notes"] = `Error: ${e.message}`;
          errorCount++;
        }

        // Update Sheet
        SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);

        // Delay between calls
        if (index < batch.length - 1) {
          Utilities.sleep(5000); // Increased sleep for full text as it might be heavier on quotas
        }
      });

      SheetUtils.toast(`Full-Text Screening Complete.\nProcessed: ${processedCount}\nErrors: ${errorCount}`, "Job Done", 10);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`An unexpected error occurred: ${e.message}`);
    } finally {
        lock.releaseLock();
    }
  }

  return {
    runCopyScreenedPapers,
    runImportPDFs,
    runScreening
  };

})();
