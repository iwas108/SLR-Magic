/**
 * QualityCheckController.js
 * Handles the logic for sampling data for Human Quality Check and the Assistant UI.
 */

var QualityCheckController = (function() {

  /**
   * Shows the configuration dialog for mapping AI columns.
   */
  function showQualityCheckSetupDialog() {
      const html = HtmlService.createHtmlOutputFromFile('QualityCheckSetupUI')
        .setWidth(400)
        .setHeight(350)
        .setTitle('Quality Check Configuration');
      SpreadsheetApp.getUi().showModalDialog(html, 'Quality Check Configuration');
  }

  /**
   * Saves the user-defined column mapping.
   * @param {Object} config { decisionColumn, reasoningColumn, samplingSize }
   */
  function saveQualityCheckConfig(config) {
      try {
          PropertiesService.getScriptProperties().setProperty("QC_COLUMN_MAPPING", JSON.stringify(config));
          return true;
      } catch (e) {
          throw new Error("Failed to save configuration: " + e.message);
      }
  }

  /**
   * Opens the Setup UI. This is now the entry point for Generation.
   */
  function generateQualityCheck() {
    showQualityCheckSetupDialog();
  }

  /**
   * Saves config and triggers generation immediately.
   */
  function submitQualityCheckSetup(config) {
    try {
      saveQualityCheckConfig(config);
      return executeQualityCheckGeneration(config);
    } catch (e) {
      throw new Error("Setup failed: " + e.message);
    }
  }

  /**
   * Executes the sampling logic.
   * @param {Object} [config] - Optional config object. If null, loads from props.
   */
  function executeQualityCheckGeneration(config) {
    console.log("[QualityCheck] Starting Human Quality Check sampling...");

    try {
      // 0. Check Configuration
      let qcConfig = config;
      if (!qcConfig) {
          const qcConfigProp = PropertiesService.getScriptProperties().getProperty("QC_COLUMN_MAPPING");
          if (!qcConfigProp) {
             throw new Error("Configuration missing.");
          }
          qcConfig = JSON.parse(qcConfigProp);
      }

      const decisionCol = qcConfig.decisionColumn;

      // Separate sampling percentages (default to 10% if missing)
      const percentInclude = (qcConfig.samplePercentInclude ? parseInt(qcConfig.samplePercentInclude) : 10) / 100;
      const percentExclude = (qcConfig.samplePercentExclude ? parseInt(qcConfig.samplePercentExclude) : 10) / 100;

      // User selected columns to copy (plus defaults)
      const userColumns = qcConfig.columnsToCopy || [];

      // Ensure Mandatory Columns
      const mandatory = ['Paper_ID', 'PDF', 'decision', 'exclusion_code', 'reasoning'];
      mandatory.forEach(col => {
         if (!userColumns.includes(col)) {
             userColumns.push(col);
         }
      });

      // 1. Get Source Data
      const sourceSheetName = "02_fulltext_screening";
      const sourceSheet = SheetUtils.getSheetByName(sourceSheetName);
      if (!sourceSheet) {
        SheetUtils.alert(`Sheet "${sourceSheetName}" not found.`);
        return;
      }
      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);
      // Fetch source notes and headers for mapping
      const sourceNotes = sourceSheet.getDataRange().getNotes();
      const sourceHeadersRaw = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
      // Normalize headers for robust matching (trim whitespace)
      const sourceHeaders = sourceHeadersRaw.map(h => String(h).trim());

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

      // 3. Stratify by Recommendation using Dynamic Column
      const included = eligibleRows.filter(r => String(r[decisionCol]).trim().toUpperCase() === "INCLUDE");
      const excluded = eligibleRows.filter(r => String(r[decisionCol]).trim().toUpperCase() === "EXCLUDE");

      console.log(`[QualityCheck] Found ${included.length} Includes and ${excluded.length} Excludes.`);

      // 4. Sample (User Defined %)
      const sampleSizeInclude = Math.ceil(included.length * percentInclude);
      const sampleSizeExclude = Math.ceil(excluded.length * percentExclude);

      console.log(`[QualityCheck] Sampling target: ${sampleSizeInclude} Include (${percentInclude*100}%), ${sampleSizeExclude} Exclude (${percentExclude*100}%).`);

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
      // We explicitly copy only: Paper_ID (mandatory), State (mandatory), Selected Cols, QC Cols
      const targetHeaderMap = SheetUtils.getHeaderMap(targetSheet);

      const columnsToEnsure = new Set(["Paper_ID", "State"]);
      userColumns.forEach(c => columnsToEnsure.add(c));

      const qcColumns = [
          "HUMAN_QC_Decision_Agree",
          "HUMAN_QC_Reason_Valid",
          "HUMAN_QC_Data_Extraction_Score",
          "HUMAN_QC_Critical_Correction"
      ];
      qcColumns.forEach(c => columnsToEnsure.add(c));

      // Ensure they exist in target
      columnsToEnsure.forEach(header => {
          SheetUtils.ensureColumn(targetSheet, header, targetHeaderMap);
      });

      // 7. Filter Duplicates & Prepare Data
      const existingTargetData = SheetUtils.getDataAsObjects(targetSheet);
      const existingIds = new Set(existingTargetData.map(r => r["Paper_ID"]));

      const newRows = [];
      const newNotes = [];

      finalSample.forEach(sourceRow => {
         if (existingIds.has(sourceRow["Paper_ID"])) return;

         // Construct new row object with only desired columns + State: 0
         const newRow = {
             "Paper_ID": sourceRow["Paper_ID"],
             "State": 0
         };

         // Helper to get note for a column from source
         // sourceRow._rowIndex is 1-based index
         // sourceNotes[0] is Row 1 (Header)
         // So data for row N is at sourceNotes[N-1]
         const rIdx = sourceRow._rowIndex - 1;
         const sourceRowNotes = (rIdx < sourceNotes.length) ? sourceNotes[rIdx] : null;

         const newRowNote = {};

         // Copy user columns
         userColumns.forEach(col => {
             // Copy Value
             if (sourceRow.hasOwnProperty(col)) {
                 newRow[col] = sourceRow[col];
             }

             // Copy Note
             // Find column index in source header
             if (sourceRowNotes) {
                 const colIndex = sourceHeaders.indexOf(col);
                 if (colIndex !== -1 && sourceRowNotes[colIndex]) {
                     newRowNote[col] = sourceRowNotes[colIndex];
                 }
             }
         });

         newRows.push(newRow);
         newNotes.push(newRowNote);
      });

      console.log(`[QualityCheck] New unique rows to add: ${newRows.length}`);

      if (newRows.length === 0) {
          SheetUtils.alert("Selected samples are already in the Quality Check sheet.");
          return;
      }

      // 9. Append Data
      console.log(`[QualityCheck] Appending ${newRows.length} rows to target sheet...`);
      SheetUtils.appendDataMapped(targetSheet, newRows, targetHeaderMap, newNotes);
      console.log(`[QualityCheck] Append complete.`);

      const msg = `Quality Check Preparation Complete.\n\n` +
        `Total Eligible: ${eligibleRows.length}\n` +
        `Sampled: ${finalSample.length} (${sampledInclude.length} Include, ${sampledExclude.length} Exclude)\n` +
        `Added to Sheet: ${newRows.length}`;

      console.log(msg);
      // We don't alert here because we are called from client side usually, which handles success.
      // But for robustness if run manually, we can log.
      return msg;

    } catch (e) {
      console.error(e);
      // Re-throw so the UI catches it
      throw new Error(`Error in Quality Check: ${e.message}`);
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

  /**
   * Opens the Human Quality Check Assistant UI.
   */
  function runQualityCheck() {
    try {
      // Check if sheet exists first
      const sheet = SheetUtils.getSheetByName("03_quality_check");
      if (!sheet) {
        SheetUtils.alert("Sheet '03_quality_check' not found. Please run 'Generate Quality Check List' first.");
        return;
      }

      const html = HtmlService.createTemplateFromFile('QualityCheckUI')
          .evaluate()
          .setWidth(800)
          .setHeight(800);
      SpreadsheetApp.getUi().showModalDialog(html, 'Human Quality Check Assistant');
    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error opening Assistant: ${e.message}`);
    }
  }

  /**
   * Retrieves data from 03_quality_check for the UI.
   * Only returns rows with State == 0 (Unprocessed).
   */
  function getQualityCheckData() {
    try {
      const sheet = SheetUtils.getSheetByName("03_quality_check");
      const allRows = sheet ? SheetUtils.getDataAsObjects(sheet) : [];

      // Filter for unprocessed rows (State is 0 or "0")
      // Also treat empty/missing state as 0 just in case.
      const rows = allRows.filter(r => {
          const state = r["State"];
          return state == 0 || state === "" || state === undefined;
      });

      // Attach Notes
      if (sheet && rows.length > 0) {
          const notes = sheet.getDataRange().getNotes();
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

          rows.forEach(row => {
             // _rowIndex is 1-based index in the sheet.
             // notes array is 0-based. notes[0] is Row 1 (Header).
             // row data is at notes[row._rowIndex - 1]
             const rIdx = row._rowIndex - 1;

             if (rIdx < notes.length) {
                 row._notes = {};
                 headers.forEach((h, cIdx) => {
                     if (h && notes[rIdx][cIdx]) {
                         row._notes[h.trim()] = notes[rIdx][cIdx];
                     }
                 });
             }
          });
      }

      // Get Prompt Context (Fallback to manifest check if needed, but currently unused in UI heavily)
      // Since FULLTEXT_SCREENING_PROMPT is gone, we might return empty or new prompts.
      // For now returning empty string if not found.
      let promptContext = "";
      try {
        const config = ConfigManager.getAll();
        promptContext = config["FULLTEXT_SCREENING_PROMPT"] || "Multi-stage prompting enabled.";
      } catch (err) {
        console.warn("[QualityCheck] Could not fetch prompt configuration:", err);
      }

      return {
        rows: rows,
        promptContext: promptContext
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Updates a row in 03_quality_check with human inputs.
   */
  function saveQualityCheckRow(paperId, data) {
    try {
      const sheet = SheetUtils.getSheetByName("03_quality_check");
      const allRows = SheetUtils.getDataAsObjects(sheet);
      const rowObj = allRows.find(r => r["Paper_ID"] === paperId);

      if (rowObj) {
        const headerMap = SheetUtils.getHeaderMap(sheet);
        SheetUtils.updateRow(sheet, rowObj._rowIndex, data, headerMap);
      } else {
        console.warn(`[QualityCheck] Paper_ID ${paperId} not found.`);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * Calculates and displays the Quality Check Score Report.
   */
  function calculateQCScore() {
    try {
      // 0. Check Configuration
      const qcConfigProp = PropertiesService.getScriptProperties().getProperty("QC_COLUMN_MAPPING");
      if (!qcConfigProp) {
         showQualityCheckSetupDialog();
         return;
      }
      const qcConfig = JSON.parse(qcConfigProp);
      const decisionCol = qcConfig.decisionColumn;

      const sheet = SheetUtils.getSheetByName("03_quality_check");
      if (!sheet) {
        SheetUtils.alert("Sheet '03_quality_check' not found.");
        return;
      }

      const rows = SheetUtils.getDataAsObjects(sheet);

      // Filter rows where QC decision has been made
      const qcRows = rows.filter(r => {
        const val = r["HUMAN_QC_Decision_Agree"];
        return val !== null && val !== undefined && String(val).trim() !== "";
      });

      if (qcRows.length === 0) {
        SheetUtils.alert("No Quality Check data found (HUMAN_QC_Decision_Agree is empty).");
        return;
      }

      // Initialize Confusion Matrix Counters
      let TP = 0, FP = 0, TN = 0, FN = 0;

      // Initialize Quality Metrics Counters
      let validReasonCount = 0;
      let criticalCorrectionCount = 0;
      let totalExtractionScore = 0;
      let extractionScoreCount = 0;

      qcRows.forEach(r => {
        const aiDecision = String(r[decisionCol]).trim().toUpperCase();

        // Parse Human Agreement (Boolean-like)
        const agreeVal = String(r["HUMAN_QC_Decision_Agree"]).trim().toUpperCase();
        const isAgreed = (agreeVal === "YES" || agreeVal === "TRUE" || agreeVal === "AGREE");

        // Confusion Matrix Logic
        // Assumption: Binary Classification (Include vs Exclude)
        if (aiDecision === "INCLUDE") {
           if (isAgreed) {
             TP++; // AI=Include, Human=Agree -> Human=Include (True Positive)
           } else {
             FP++; // AI=Include, Human=Disagree -> Human=Exclude (False Positive)
           }
        } else if (aiDecision === "EXCLUDE") {
           if (isAgreed) {
             TN++; // AI=Exclude, Human=Agree -> Human=Exclude (True Negative)
           } else {
             FN++; // AI=Exclude, Human=Disagree -> Human=Include (False Negative)
           }
        }

        // Quality Metrics
        // Reason Validity
        const validVal = String(r["HUMAN_QC_Reason_Valid"]).trim().toUpperCase();
        if (validVal === "YES" || validVal === "TRUE" || validVal === "VALID") {
          validReasonCount++;
        }

        // Critical Correction
        const criticalVal = String(r["HUMAN_QC_Critical_Correction"]).trim();
        if (criticalVal !== "" && criticalVal.toUpperCase() !== "NO" && criticalVal.toUpperCase() !== "NONE") {
          criticalCorrectionCount++;
        }

        // Extraction Score
        const scoreVal = parseFloat(r["HUMAN_QC_Data_Extraction_Score"]);
        if (!isNaN(scoreVal)) {
          totalExtractionScore += scoreVal;
          extractionScoreCount++;
        }
      });

      // Calculate Derived Metrics
      const total = TP + FP + TN + FN;
      // Avoid division by zero
      const safeDiv = (num, den) => (den === 0 ? 0 : num / den);

      const sensitivity = safeDiv(TP, TP + FN);
      const specificity = safeDiv(TN, TN + FP);
      const precision = safeDiv(TP, TP + FP);
      const npv = safeDiv(TN, TN + FN);
      const f1 = safeDiv(2 * TP, 2 * TP + FP + FN);
      const accuracy = safeDiv(TP + TN, total);

      const stats = {
        confusionMatrix: { TP, FP, TN, FN, total },
        metrics: {
          sensitivity: (sensitivity * 100).toFixed(1),
          specificity: (specificity * 100).toFixed(1),
          precision: (precision * 100).toFixed(1),
          npv: (npv * 100).toFixed(1),
          f1: f1.toFixed(3),
          accuracy: (accuracy * 100).toFixed(1)
        },
        quality: {
          reasonValidityRate: (safeDiv(validReasonCount, total) * 100).toFixed(1),
          criticalCorrectionRate: (safeDiv(criticalCorrectionCount, total) * 100).toFixed(1),
          avgExtractionScore: safeDiv(totalExtractionScore, extractionScoreCount).toFixed(2),
          count: total
        }
      };

      const template = HtmlService.createTemplateFromFile('QualityCheckScoreReport');
      template.data = stats;
      const html = template.evaluate()
        .setWidth(600)
        .setHeight(600);

      SpreadsheetApp.getUi().showModalDialog(html, 'Quality Check Score Report');

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error calculating QC Score: ${e.message}`);
    }
  }

  /**
   * Syncs included PDFs to the Gold Mine folder.
   */
  function syncGoldMine() {
    console.log("[QualityCheck] Starting Gold Mine Sync...");
    try {
      // 1. Get Configuration
      const config = ConfigManager.getAll();
      const goldMineUrl = config["GOLD_MINE"];

      if (!goldMineUrl) {
        return "Error: GOLD_MINE URL is missing in Configuration.";
      }

      let targetFolderId;
      try {
        targetFolderId = DriveUtils.getFileIdFromUrl(goldMineUrl);
      } catch (e) {
        return `Error parsing GOLD_MINE URL: ${e.message}`;
      }

      let targetFolder;
      try {
        targetFolder = DriveApp.getFolderById(targetFolderId);
      } catch (e) {
        return `Error accessing Gold Mine folder (ID: ${targetFolderId}): ${e.message}`;
      }

      // 2. Get Source Data
      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      if (!sheet) {
        return "Error: Sheet '02_fulltext_screening' not found.";
      }
      const data = SheetUtils.getDataAsObjects(sheet);

      // 3. Filter Included Rows
      // Priority: Human Decision > AI Recommendation (or just Human Decision based on requirement)
      // The requirement says "included PDF file". We assume Human Decision = Include.
      const includedRows = data.filter(r => {
        const humanDecision = String(r["Human_Decision"] || "").trim().toUpperCase();
        return humanDecision === "INCLUDE";
      });

      if (includedRows.length === 0) {
        return "No papers with Human_Decision = 'Include' found.";
      }

      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // 4. Process Each Row
      includedRows.forEach(row => {
        const paperId = row["Paper_ID"];
        const pdfUrl = row["PDF"];

        if (!paperId) {
          errorCount++; // Should not happen usually
          return;
        }

        if (!pdfUrl || String(pdfUrl).trim() === "") {
          console.warn(`[GoldMine] Skipping ${paperId}: No PDF linked.`);
          skippedCount++;
          return;
        }

        const targetFilename = `${paperId}.pdf`;

        try {
          // Check if file exists in target folder
          // DriveUtils.searchFile uses 'contains', we need exact match usually, but here we can iterate
          // However, getFilesByName is standard DriveApp
          const existingFiles = targetFolder.getFilesByName(targetFilename);
          if (existingFiles.hasNext()) {
            console.log(`[GoldMine] Exists: ${targetFilename}`);
            skippedCount++;
            return;
          }

          // Get Source File
          const sourceFileId = DriveUtils.getFileIdFromUrl(pdfUrl);
          const sourceFile = DriveApp.getFileById(sourceFileId);

          // Copy
          sourceFile.makeCopy(targetFilename, targetFolder);
          console.log(`[GoldMine] Synced: ${targetFilename}`);
          syncedCount++;

        } catch (e) {
          console.error(`[GoldMine] Error syncing ${paperId}: ${e.message}`);
          errorCount++;
        }
      });

      return `Sync Complete.\nSynced: ${syncedCount}\nSkipped (Exists/No PDF): ${skippedCount}\nErrors: ${errorCount}`;

    } catch (e) {
      console.error(e);
      return `Unexpected Error: ${e.message}`;
    }
  }

  return {
    generateQualityCheck,
    executeQualityCheckGeneration,
    submitQualityCheckSetup,
    runQualityCheck,
    getQualityCheckData,
    saveQualityCheckRow,
    calculateQCScore,
    syncGoldMine,
    showQualityCheckSetupDialog,
    saveQualityCheckConfig
  };

})();
