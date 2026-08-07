/**
 * InterRaterController.js
 * Handles the logic for Blinded Inter-Rater Review (Exporting, Importing, Scoring)
 * rewritten for Calibration Pools (CAL_Pool_A, CAL_Pool_B, CAL_Pool_C) and QC_Audit_Batch.
 */

const InterRaterController = (function() {

  const DEFAULT_SCHEMAS = {
    "STAGE_1_SCHEMA": ["decision", "exclusion_code", "reasoning"],
    "STAGE_2_1_SCHEMA": ["decision", "exclusion_code", "reasoning"],
    "STAGE_2_2_SCHEMA": [
      "qa1_aims", "qa2_context", "qa3_reproducibility", "qa4_ingestion", 
      "qa5_transparency", "qa6_reliability", "qa7_friction", "qa8_transferability", 
      "decision", "exclusion_code", "reasoning"
    ],
    "STAGE_2_3_SCHEMA": [
      "rq1.1_primary_domain", "rq1.2_operational_status", "rq1.3_computational_topology", 
      "rq1.4_communication_protocol", "rq1.5_algorithmic_classification", 
      "rq1.6_predictive_performance_metrics", "rq1.7_computational_overhead", 
      "rq1.8_documented_frictions", "rq1.9_infrastructural_incompatibility"
    ]
  };

  /**
   * Safe helper to parse schema from config. Falls back to default if parsing fails.
   */
  function parseSchema(config, key) {
    const rawVal = config[key];
    if (!rawVal) {
      return DEFAULT_SCHEMAS[key];
    }
    try {
      const parsed = JSON.parse(rawVal);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error(`[InterRaterController] Error parsing schema ${key}: ${e.message}`);
    }
    return DEFAULT_SCHEMAS[key];
  }

  /**
   * Opens the Export UI.
   */
  function showExportDialog(phase) {
    const template = HtmlService.createTemplateFromFile('InterRaterExportUI');
    template.phase = phase;
    const html = template.evaluate()
      .setWidth(500)
      .setHeight(550)
      .setTitle('Export Blinded Review (.slr)');
    SpreadsheetApp.getUi().showModalDialog(html, 'Export Blinded Review (.slr)');
  }

  /**
   * Opens the Import UI.
   */
  function showImportDialog(phase) {
    const template = HtmlService.createTemplateFromFile('InterRaterImportUI');
    template.phase = phase;
    const html = template.evaluate()
      .setWidth(500)
      .setHeight(380)
      .setTitle('Import Blinded Results (.slr)');
    SpreadsheetApp.getUi().showModalDialog(html, 'Import Blinded Results (.slr)');
  }

  /**
   * Randomly selects n items from an array.
   */
  function getRandomSample(array, count) {
    if (count <= 0) return [];
    if (count >= array.length) return array.slice(0);

    const shuffled = array.slice(0);
    // Fisher-Yates Shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  /**
   * Generates a random sample of 20 included papers from 04_Miner and writes to QC_Audit_Batch sheet permanently.
   */
  function runQCAuditorChecks() {
    const ui = SpreadsheetApp.getUi();
    try {
      const minerSheet = SheetUtils.getSheetByName("04_Miner");
      if (!minerSheet) {
        throw new Error("Sheet 04_Miner not found.");
      }

      // 1. Read all rows from 04_Miner
      const minerData = SheetUtils.getDataAsObjects(minerSheet);
      
      // 2. Filter papers where decision_Value === "INCLUDE"
      const includedPapers = minerData.filter(row => {
        const decision = String(row["decision_Value"] || "").trim().toUpperCase();
        return decision === "INCLUDE";
      });

      if (includedPapers.length === 0) {
        ui.alert("No papers with decision_Value = 'INCLUDE' found in 04_Miner to audit.");
        return;
      }

      // 3. Randomly sample 20 papers using Fisher-Yates shuffle
      const sampleSize = Math.min(20, includedPapers.length);
      const sampled = getRandomSample(includedPapers, sampleSize);

      // 4. Get or create target sheet QC_Audit_Batch
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let auditSheet = ss.getSheetByName("QC_Audit_Batch");
      if (!auditSheet) {
        auditSheet = ss.insertSheet("QC_Audit_Batch");
      } else {
        auditSheet.clear();
        auditSheet.setFrozenRows(0);
        auditSheet.setFrozenColumns(0);
      }

      // 5. Build headers for QC_Audit_Batch
      const baseHeaders = ['Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
      const calExtra = ['Human_Decision', 'Human_EC_Trigger', 'Human_Rationale'];

      // Get headers from 04_Miner
      const lastCol = minerSheet.getLastColumn();
      let minerHeaders = [];
      if (lastCol > 0) {
        minerHeaders = minerSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
      }
      
      const nonBaseHeaders = minerHeaders.filter(h => !baseHeaders.includes(h) && !calExtra.includes(h));
      const auditHeaders = [...baseHeaders, ...calExtra, ...nonBaseHeaders];

      // Setup sheet headers
      auditSheet.getRange(1, 1, 1, auditHeaders.length).setValues([auditHeaders]);
      auditSheet.getRange(1, 1, 1, auditHeaders.length).setFontWeight("bold");
      auditSheet.setFrozenRows(1);

      // Write data
      const outputValues = sampled.map(row => {
        return auditHeaders.map(header => {
          if (calExtra.includes(header)) {
            return ""; // Keep human fields empty initially
          }
          return row[header] !== undefined ? row[header] : "";
        });
      });

      if (outputValues.length > 0) {
        auditSheet.getRange(2, 1, outputValues.length, auditHeaders.length).setValues(outputValues);
      }

      ui.alert(`QC Audit Batch Generated successfully!\nSampled ${outputValues.length} papers to QC_Audit_Batch.`);
    } catch (e) {
      console.error(e);
      ui.alert("QC Audit Batch Generation failed: " + e.message);
    }
  }

  /**
   * Processes the generation of the blinded .slr JSON export for a pool.
   */
  function processExport(poolName, sampleType, sampleValue, ecRules = []) {
    try {
      console.log(`[InterRater] Starting Export for pool: ${poolName}, Type: ${sampleType}, Value: ${sampleValue}, EC Rules count: ${ecRules.length}`);

      // 1. Identify Source Sheet
      const sourceSheet = SheetUtils.getSheetByName(poolName);
      if (!sourceSheet) {
        throw new Error(`Calibration pool or audit sheet "${poolName}" not found.`);
      }

      // 2. Load Data
      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);
      if (sourceData.length === 0) {
        throw new Error(`No papers found in "${poolName}" to export.`);
      }

      // 3. Apply Sampling
      let finalSample = [];
      if (sampleType === 'all') {
        finalSample = sourceData;
      } else {
        let totalSampleSize = 0;
        if (sampleType === 'percentage') {
          const percent = Math.min(100, Math.max(1, sampleValue)) / 100;
          totalSampleSize = Math.ceil(sourceData.length * percent);
        } else {
          totalSampleSize = Math.min(sourceData.length, Math.max(1, sampleValue));
        }
        finalSample = getRandomSample(sourceData, totalSampleSize);
      }

      // Shuffle sample to blind pattern order
      finalSample = getRandomSample(finalSample, finalSample.length);

      // 4. Fetch dynamic schemas to package blinded questions
      const config = ConfigManager.getAll();
      let schemaKeys = [];

      const getKeysFromSheet = (sheetName) => {
        try {
          const sheet = SheetUtils.getSheetByName(sheetName);
          const headers = Object.keys(SheetUtils.getHeaderMap(sheet));
          // Filter out base headers, Status, and token headers
          const exclude = ['Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link', 'Status', 'Tokens_Used', 'Input_Tokens', 'Thinking_Tokens', 'Output_Tokens', 'Total_Tokens'];
          const keys = [];
          headers.forEach(h => {
            if (h.endsWith("_Value")) {
              const baseKey = h.substring(0, h.length - 6);
              if (!exclude.includes(baseKey) && !keys.includes(baseKey)) {
                keys.push(baseKey);
              }
            }
          });
          return keys;
        } catch (e) {
          return [];
        }
      };

      if (poolName === "CAL_Pool_A") {
        schemaKeys = getKeysFromSheet("01_Fast_Filter");
        if (schemaKeys.length === 0) schemaKeys = parseSchema(config, "STAGE_1_SCHEMA");
      } else if (poolName === "CAL_Pool_B") {
        schemaKeys = getKeysFromSheet("02_Gatekeeper");
        if (schemaKeys.length === 0) schemaKeys = parseSchema(config, "STAGE_2_1_SCHEMA");
      } else if (poolName === "CAL_Pool_C") {
        const keysSci = getKeysFromSheet("03_Scientist");
        const keysMin = getKeysFromSheet("04_Miner");
        const seen = new Set();
        keysSci.concat(keysMin).forEach(k => seen.add(k));
        schemaKeys = Array.from(seen);
        if (schemaKeys.length === 0) {
          const stage22 = parseSchema(config, "STAGE_2_2_SCHEMA");
          const stage23 = parseSchema(config, "STAGE_2_3_SCHEMA");
          const seenDef = new Set();
          [stage22, stage23].forEach(keys => keys.forEach(k => seenDef.add(k)));
          schemaKeys = Array.from(seenDef);
        }
      } else if (poolName === "QC_Audit_Batch") {
        schemaKeys = getKeysFromSheet("04_Miner");
        if (schemaKeys.length === 0) schemaKeys = parseSchema(config, "STAGE_2_3_SCHEMA");
      }

      // 5. Blind data and build JSON papers array
      const blindedPapers = finalSample.map(row => {
         const paperObj = {
           "Paper_ID": row["Paper_ID"] || "",
           "Title": row["Title"] || "",
           "Abstract": row["Abstract"] || "",
           "Authors": row["Authors"] || "",
           "Year": row["Year"] || "",
           "DOI": row["DOI"] || "",
           "PDF_Link": row["PDF_Link"] || "",
           "Import_Source": row["Import_Source"] || "",
           "Source": row["Source"] || "",
           "Import_Date": row["Import_Date"] || ""
         };

         // Add empty Human fields (markdown-friendly)
         paperObj["Human_Decision"] = "";
         if (poolName === "CAL_Pool_A" || poolName === "CAL_Pool_B" || poolName === "QC_Audit_Batch") {
           paperObj["Human_EC_Trigger"] = "";
           paperObj["Human_Rationale"] = "";
         }

         // Add nested schema responses
         if (poolName === "CAL_Pool_C" || poolName === "QC_Audit_Batch") {
           schemaKeys.forEach(k => {
             paperObj[k] = { value: "", evidence: "" };
           });
         }

         return paperObj;
      });

      // 6. Build Metadata block
      const metadata = {
        projectName: config["PROJECT_NAME"] || "Unnamed Project",
        researchManifesto: config["RESEARCH_MANIFESTO"] || "",
        researchObjective: config["RESEARCH_OBJECTIVE"] || "",
        researchQuestions: config["RESEARCH_QUESTIONS"] || "",
        qualityAssuranceDefinition: config["QUALITY_ASSURANCE_DEFINITION"] || "",
        exclusionCriteria: config["EXCLUSION_CRITERIA"] || "",
        poolType: poolName,
        exportDate: new Date().toISOString(),
        ecRules: ecRules
      };

      const payload = {
        metadata: metadata,
        papers: blindedPapers
      };

      const message = `Sampled and blinded ${blindedPapers.length} papers from "${poolName}".`;

      return {
        message: message,
        jsonPayload: JSON.stringify(payload, null, 2)
      };

    } catch (e) {
      console.error(e);
      throw new Error(`Export failed: ${e.message}`);
    }
  }

  /**
   * Processes the import of the completed .slr JSON file into a pool.
   */
  function processImport(poolName, jsonDataStr) {
    try {
      console.log(`[InterRater] Starting Import into pool: ${poolName}`);
      const data = JSON.parse(jsonDataStr);

      if (!data || !data.metadata || !data.papers || !Array.isArray(data.papers)) {
        throw new Error("Invalid .slr format: missing papers or metadata block.");
      }

      // Check poolType mismatch
      const filePoolType = data.metadata.poolType || data.metadata.phase;
      let normalizedFilePool = filePoolType;
      if (filePoolType === "title-abs") normalizedFilePool = "CAL_Pool_A";
      if (filePoolType === "full-text") normalizedFilePool = "CAL_Pool_C";

      if (normalizedFilePool !== poolName) {
        throw new Error(`Pool Mismatch: Target pool selected is "${poolName}" but file belongs to "${normalizedFilePool}".`);
      }

      // Get target sheet
      const targetSheet = SheetUtils.getSheetByName(poolName);
      if (!targetSheet) {
        throw new Error(`Target calibration/audit sheet "${poolName}" not found.`);
      }

      const headerMap = SheetUtils.getHeaderMap(targetSheet);
      const numRows = targetSheet.getLastRow() - 1;
      if (numRows <= 0) {
        return "No rows to update in the selected sheet.";
      }

      // Load config and schemas
      const config = ConfigManager.getAll();
      let schemaKeys = [];
      if (poolName === "CAL_Pool_A") {
        schemaKeys = parseSchema(config, "STAGE_1_SCHEMA");
      } else if (poolName === "CAL_Pool_B") {
        schemaKeys = parseSchema(config, "STAGE_2_1_SCHEMA");
      } else if (poolName === "CAL_Pool_C") {
        const stage22 = parseSchema(config, "STAGE_2_2_SCHEMA");
        const stage23 = parseSchema(config, "STAGE_2_3_SCHEMA");
        const seen = new Set();
        [stage22, stage23].forEach(keys => {
          keys.forEach(k => {
            if (!seen.has(k)) {
              seen.add(k);
              schemaKeys.push(k);
            }
          });
        });
      } else if (poolName === "QC_Audit_Batch") {
        schemaKeys = parseSchema(config, "STAGE_2_3_SCHEMA");
      }

      // Get values and build indices
      const range = targetSheet.getRange(2, 1, numRows, targetSheet.getLastColumn());
      const values = range.getValues();

      const headerIndices = {};
      for (const [colName, colIdx1] of Object.entries(headerMap)) {
        headerIndices[colName] = colIdx1 - 1;
      }

      const pidIdx = headerIndices["Paper_ID"];
      if (pidIdx === undefined) throw new Error("Paper_ID column is missing in target sheet.");

      let updateCount = 0;

      data.papers.forEach(paper => {
        const pid = String(paper.Paper_ID).trim();
        // Find matching row
        const rowArray = values.find(r => String(r[pidIdx]).trim() === pid);
        if (rowArray) {
          updateCount++;

          const decVal = paper.Human_Decision || paper.Reviewer_Decision || "";
          const ecVal = paper.Human_EC_Trigger || paper.Reviewer_EC_Code || "";
          const ratVal = paper.Human_Rationale || paper.Reviewer_Reasoning || "";

          // Update human decision fields
          if (headerIndices["Human_Decision"] !== undefined) rowArray[headerIndices["Human_Decision"]] = decVal;
          if (poolName === "CAL_Pool_A" || poolName === "CAL_Pool_B" || poolName === "QC_Audit_Batch") {
            if (headerIndices["Human_EC_Trigger"] !== undefined) rowArray[headerIndices["Human_EC_Trigger"]] = ecVal;
            if (headerIndices["Human_Rationale"] !== undefined) rowArray[headerIndices["Human_Rationale"]] = ratVal;
          }

          // Map dynamic schema keys
          schemaKeys.forEach(key => {
            const { value, quote } = extractKeyValueAndQuote(paper, key);
            const valCol = key + "_Value";
            const quoteCol = key + "_Quote";

            if (headerIndices[valCol] !== undefined) rowArray[headerIndices[valCol]] = value;
            if (headerIndices[quoteCol] !== undefined) rowArray[headerIndices[quoteCol]] = quote;
          });
        }
      });

      // Batch write updated data
      range.setValues(values);
      return `Successfully imported blinded review for ${updateCount} papers into "${poolName}".`;

    } catch (e) {
      console.error(e);
      throw new Error(`Import failed: ${e.message}`);
    }
  }

  /**
   * Helper to resolve dynamic value and evidence/quote from paper object.
   */
  function extractKeyValueAndQuote(paper, key) {
    let val = "";
    let quote = "";

    if (paper[key] !== undefined) {
      if (typeof paper[key] === 'object' && paper[key] !== null) {
        val = paper[key].value !== undefined ? paper[key].value : "";
        quote = paper[key].evidence || paper[key].quote || "";
      } else {
        val = paper[key];
      }
    } 
    else if (paper.responses && paper.responses[key] !== undefined) {
      const r = paper.responses[key];
      if (typeof r === 'object' && r !== null) {
        val = r.value !== undefined ? r.value : (r.score !== undefined ? r.score : (r.val !== undefined ? r.val : ""));
        quote = r.exact_quote || r.quote || r.evidence || r.text || "";
      } else {
        val = r;
      }
    }
    else if (paper.qa_scores && paper.qa_scores[key] !== undefined) {
      const r = paper.qa_scores[key];
      if (typeof r === 'object' && r !== null) {
        val = r.value !== undefined ? r.value : (r.score !== undefined ? r.score : (r.val !== undefined ? r.val : ""));
        quote = r.exact_quote || r.quote || r.evidence || r.text || "";
      } else {
        val = r;
      }
    }
    else if (paper.extracted_data && paper.extracted_data[key] !== undefined) {
      const r = paper.extracted_data[key];
      if (typeof r === 'object' && r !== null) {
        val = r.value !== undefined ? r.value : (r.score !== undefined ? r.score : (r.val !== undefined ? r.val : ""));
        quote = r.exact_quote || r.quote || r.evidence || r.text || "";
      } else {
        val = r;
      }
    }

    return { value: String(val).trim(), quote: String(quote).trim() };
  }

  /**
   * Calculates Inter-Rater Score comparing Human Consensus vs AI Decision.
   */
  function calculateScore(poolName) {
    try {
      console.log(`[InterRater] Calculating Score for pool: ${poolName}`);

      const sheet = SheetUtils.getSheetByName(poolName);
      if (!sheet) {
        SheetUtils.alert(`Sheet "${poolName}" not found. Please run environment initialization.`);
        return;
      }

      const rows = SheetUtils.getDataAsObjects(sheet);
      // Filter rows where human decision has been inputted
      const reviewedRows = rows.filter(r => {
        const dec = String(r["Human_Decision"] || "").trim().toUpperCase();
        return dec === "INCLUDE" || dec === "EXCLUDE";
      });

      if (reviewedRows.length === 0) {
        SheetUtils.alert(`No papers with human decisions ("Include" or "Exclude") found in "${poolName}". Please import blinded results first.`);
        return;
      }

      // Calculate confusion matrix
      let TP = 0, FP = 0, TN = 0, FN = 0;
      
      // Determine the AI decision column.
      const decisionCol = "decision_Value";

      reviewedRows.forEach(row => {
        const humanDec = String(row["Human_Decision"]).trim().toUpperCase();
        const aiDec = String(row[decisionCol] || "").trim().toUpperCase();

        if (aiDec === "INCLUDE" && humanDec === "INCLUDE") TP++;
        else if (aiDec === "INCLUDE" && humanDec === "EXCLUDE") FP++; // AI said include, human said exclude (AI False Positive)
        else if (aiDec === "EXCLUDE" && humanDec === "EXCLUDE") TN++;
        else if (aiDec === "EXCLUDE" && humanDec === "INCLUDE") FN++; // AI said exclude, human said include (AI False Negative)
      });

      const totalAIvsHuman = TP + FP + TN + FN;
      const safeDiv = (num, den) => (den === 0 ? 0 : num / den);

      const accuracy = safeDiv(TP + TN, totalAIvsHuman);
      const precision = safeDiv(TP, TP + FP);
      const recall = safeDiv(TP, TP + FN);
      const f1 = safeDiv(2 * TP, 2 * TP + FP + FN);

      // Cohen's Kappa for AI vs Human
      let p_o = accuracy;
      let p_yes = safeDiv((TP + FP) * (TP + FN), totalAIvsHuman * totalAIvsHuman);
      let p_no = safeDiv((TN + FN) * (TN + FP), totalAIvsHuman * totalAIvsHuman);
      let p_e = p_yes + p_no;

      let aiKappa = "N/A";
      if (totalAIvsHuman > 0) {
        if (p_e === 1) {
          aiKappa = "1.000";
        } else {
          aiKappa = ((p_o - p_e) / (1 - p_e)).toFixed(3);
        }
      }

      const stats = {
        totalPapersReviewed: reviewedRows.length,
        avgRatersPerPaper: "1.00",
        humanKappa: "N/A",
        humanAgreementRate: "N/A",
        aiVsHuman: {
          cm: { TP, FP, TN, FN },
          accuracy: (accuracy * 100).toFixed(1),
          precision: (precision * 100).toFixed(1),
          recall: (recall * 100).toFixed(1),
          f1: f1.toFixed(3),
          kappa: aiKappa
        }
      };

      const template = HtmlService.createTemplateFromFile('InterRaterScoreReport');
      template.phase = poolName;
      template.stats = stats;
      const html = template.evaluate()
        .setWidth(600)
        .setHeight(650)
        .setTitle('Inter-Rater Score Report');

      SpreadsheetApp.getUi().showModalDialog(html, 'Inter-Rater Score Report');

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Score calculation failed: ${e.message}`);
    }
  }

  return {
    showExportDialog: showExportDialog,
    showImportDialog: showImportDialog,
    runQCAuditorChecks: runQCAuditorChecks,
    processExport: processExport,
    processImport: processImport,
    calculateScore: calculateScore
  };

})();
