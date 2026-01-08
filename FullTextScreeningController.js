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
      const config = SheetUtils.getConfigMap("00_manifest");
      const pdfRepoUrl = config["PDF_REPO"];

      if (!pdfRepoUrl) {
        SheetUtils.alert("PDF_REPO is missing in 00_manifest.");
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

      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);
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

                    // If we didn't get status from metadata, set a default?
                    // The prompt doesn't specify default if metadata missing, but usually we want to know it's there.
                    // Leaving it empty if no metadata is safer unless we want to invent a status.
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
      // Avoid alerts in background if possible, but keeping safety check inside SheetUtils.alert/toast
      SheetUtils.alert(`Error importing PDFs: ${e.message}`);
    } finally {
      lock.releaseLock();
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
      const modelName = config["MODEL_NAME"] || "gemini-2.0-flash-lite";
      const temperature = parseFloat(config["TEMPERATURE"] || "0.7");
      const maxTokens = parseInt(config["MAX_TOKENS"] || "8192");
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
        console.log(`Processing Row ${row._rowIndex}, PDF: ${pdfUrl}`);
        const updateData = {};
        const PDFValidity = row["PDF_Validity"];
      
        if (!PDFValidity){
          updateData["AI_Status"] = "Done";
          updateData["AI_Recommendation"] = "Exclude";
          updateData["Exclusion_Reason"] = "EC5_WrongDoc";
          updateData["AI_Reasoning"] = "No PDF file linked.";

          SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);
          processedCount++; // Counted as processed even if skipped
          return;
        }

        try {
          const pdfBlob = DriveUtils.getFileBlob(pdfUrl);

          // Call Gemini
          const response = GeminiAdapter.callGemini(systemPrompt, apiKey, modelName, temperature, maxTokens, pdfBlob);
          const result = response.content;
          
          // Map result to sheet columns
          updateData["AI_Status"] = "Done";
          updateData["AI_Relevance_Score"] = result.confidence_score;
          updateData["AI_Recommendation"] = result.decision;
          updateData["AI_Reasoning"] = result.reasoning;
          updateData["Exclusion_Reason"] = result.exclusion_code || "";

          // Capture Token Usage
          if (response.usageMetadata) {
            const thinkingTokens = response.usageMetadata.thoughtsTokenCount || 0;
            const candidateTokens = response.usageMetadata.candidatesTokenCount || 0;
            const promptTokens = response.usageMetadata.promptTokenCount || 0;
            const totalTokens = response.usageMetadata.totalTokenCount || 0;

            // Ensure columns exist
            SheetUtils.ensureColumn(sheet, "Thinking_Token", headerMap);
            SheetUtils.ensureColumn(sheet, "Candidate_Token", headerMap);
            SheetUtils.ensureColumn(sheet, "Input_Token", headerMap);
            SheetUtils.ensureColumn(sheet, "Total_Token", headerMap);

            updateData["Thinking_Token"] = thinkingTokens;
            updateData["Candidate_Token"] = candidateTokens;
            updateData["Input_Token"] = promptTokens;
            updateData["Total_Token"] = totalTokens;
          }

          if (result.extraction_preview) {
            // Dynamically map all keys in extraction_preview to Sheet Columns
            // Assumes Sheet Column Name == JSON Key Name (as per user instruction)
            for (const [key, value] of Object.entries(result.extraction_preview)) {
              SheetUtils.ensureColumn(sheet, key, headerMap);
              updateData[key] = value;
            }
          }

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

  /**
   * Transforms DOI Links to use a web proxy for manual download.
   * Pattern: www.domain.com -> www-domain-com.proxy.url
   */
  function runTransformDOILinks() {
    try {
      console.log("[DEBUG] Starting runTransformDOILinks");
      // 1. Get Proxy Config
      const config = SheetUtils.getConfigMap("00_manifest");
      const proxyUrl = config["WEB_PROXY_URL"];
      console.log(`[DEBUG] Proxy URL: ${proxyUrl}`);

      if (!proxyUrl) {
        SheetUtils.alert("WEB_PROXY_URL is missing in 00_manifest.");
        return;
      }

      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);
      console.log(`[DEBUG] Header Map: ${JSON.stringify(headerMap)}`);

      const data = SheetUtils.getDataAsObjects(sheet);
      console.log(`[DEBUG] Total Rows fetched: ${data.length}`);

      if (data.length > 0) {
          console.log(`[DEBUG] First Row Sample: ${JSON.stringify(data[0])}`);
      }

      let updatedCount = 0;

      // 2. Iterate and Transform
      // Only process if PDF is missing
      const rowsToProcess = data.filter(row => {
          const pdf = row["PDF"];
          const doi = row["DOI_Link"];
          // Check for missing PDF (undefined, null, or empty string after trim)
          const isPdfMissing = !pdf || pdf.toString().trim() === "";
          // Check for present DOI
          const isDoiPresent = doi && doi.toString().trim() !== "";
          return isPdfMissing && isDoiPresent;
      });

      console.log(`[DEBUG] Rows to process (No PDF + Has DOI): ${rowsToProcess.length}`);

      if (rowsToProcess.length === 0) {
        SheetUtils.alert("No rows with missing PDFs and valid DOI Links found.");
        return;
      }

      rowsToProcess.forEach(row => {
        const originalUrl = row["DOI_Link"].toString().trim();

        try {
          // Simple check to avoid double proxying
          if (originalUrl.includes(proxyUrl)) {
            console.log(`[DEBUG] Skipping row ${row._rowIndex}, already proxied: ${originalUrl}`);
            return;
          }

          // Parse URL using Regex to avoid ReferenceError: URL is not defined in some GAS environments
          // Matches: protocol (http/s), hostname (stops at / or ?), and rest
          const urlRegex = /^(https?:\/\/)([^/?#]+)(.*)$/;
          const match = originalUrl.match(urlRegex);

          if (!match) {
             console.warn(`[DEBUG] Could not parse URL for row ${row._rowIndex}: ${originalUrl}`);
             return;
          }

          const protocol = match[1]; // "https://"
          const hostname = match[2]; // "www.scopus.com"
          const rest = match[3];     // "/inward/record.uri?..."

          // Transform hostname: replace . with -
          const transformedHostname = hostname.replace(/\./g, '-');

          // Construct new URL
          const newUrl = `${protocol}${transformedHostname}.${proxyUrl}${rest}`;

          console.log(`[DEBUG] Row ${row._rowIndex}: ${originalUrl} -> ${newUrl}`);

          // Update Sheet
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
    runTransformDOILinks
  };

})();
