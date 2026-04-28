/**
 * InterRaterController.js
 * Handles the logic for Blinded Inter-Rater Review (Exporting, Importing, Scoring)
 */

var InterRaterController = (function() {

  /**
   * Opens the Export UI.
   */
  function showExportDialog(phase) {
    const template = HtmlService.createTemplateFromFile('InterRaterExportUI');
    template.phase = phase;
    const html = template.evaluate()
      .setWidth(450)
      .setHeight(400)
      .setTitle('Export Blinded Review');
    SpreadsheetApp.getUi().showModalDialog(html, 'Export Blinded Review');
  }

  /**
   * Opens the Import UI.
   */
  function showImportDialog(phase) {
    const template = HtmlService.createTemplateFromFile('InterRaterImportUI');
    template.phase = phase;
    const html = template.evaluate()
      .setWidth(450)
      .setHeight(300)
      .setTitle('Import Blinded Results');
    SpreadsheetApp.getUi().showModalDialog(html, 'Import Blinded Results');
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
   * Processes the generation of the blinded .slr JSON export.
   */
  function processExport(phase, sampleType, sampleValue) {
    try {
      console.log(`[InterRater] Starting Export for phase: ${phase}, Type: ${sampleType}, Value: ${sampleValue}`);

      // 1. Identify Source Sheet
      let sourceSheetName = phase === "title-abs" ? "01_abstract_screening" : "03_fulltext_screening";
      const sourceSheet = SheetUtils.getSheetByName(sourceSheetName);
      if (!sourceSheet) {
        throw new Error(`Source sheet "${sourceSheetName}" not found.`);
      }

      // 2. Load Data and filter eligible
      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);
      const eligibleRows = sourceData.filter(row => {
        if (phase === "title-abs") {
            return String(row["AI_Status"]).toUpperCase() === "DONE";
        } else {
            const isValid = (row["PDF_Validity"] === true || String(row["PDF_Validity"]).toUpperCase() === "TRUE");
            const isDone = (String(row["AI_Status"]).toUpperCase() === "DONE");
            return isValid && isDone;
        }
      });

      if (eligibleRows.length === 0) {
        throw new Error("No eligible rows found (AI_Status=Done).");
      }

      // 3. Stratify by AI Decision
      // We must determine which column holds the decision.
      // Usually "decision" for title-abs, or maybe "AI_Decision"
      // We look for 'decision' or 'AI_Decision'. Fallback to 'decision'.
      let decisionCol = "decision";
      if (eligibleRows.length > 0 && !eligibleRows[0].hasOwnProperty("decision") && eligibleRows[0].hasOwnProperty("AI_Decision")) {
        decisionCol = "AI_Decision";
      }

      const included = eligibleRows.filter(r => String(r[decisionCol]).trim().toUpperCase() === "INCLUDE");
      const excluded = eligibleRows.filter(r => String(r[decisionCol]).trim().toUpperCase() === "EXCLUDE");

      console.log(`[InterRater] Stratification: ${included.length} Includes, ${excluded.length} Excludes.`);

      // 4. Calculate target sample size per stratum (50/50 split)
      let totalSampleSize = 0;
      if (sampleType === 'percentage') {
        const percent = Math.min(100, Math.max(1, sampleValue)) / 100;
        totalSampleSize = Math.ceil(eligibleRows.length * percent);
      } else {
        totalSampleSize = Math.min(eligibleRows.length, Math.max(1, sampleValue));
      }

      // Ensure even number for 50/50 split
      if (totalSampleSize % 2 !== 0) {
        totalSampleSize++;
      }
      let stratumSize = totalSampleSize / 2;

      // Adjust if one stratum doesn't have enough
      let includeTarget = stratumSize;
      let excludeTarget = stratumSize;

      if (included.length < stratumSize) {
         includeTarget = included.length;
         excludeTarget = Math.min(excluded.length, totalSampleSize - includeTarget);
      } else if (excluded.length < stratumSize) {
         excludeTarget = excluded.length;
         includeTarget = Math.min(included.length, totalSampleSize - excludeTarget);
      }

      // 5. Sample & Combine
      const sampledInclude = getRandomSample(included, includeTarget);
      const sampledExclude = getRandomSample(excluded, excludeTarget);
      const combinedSample = [...sampledInclude, ...sampledExclude];

      if (combinedSample.length === 0) {
        throw new Error("Not enough data to sample after stratification.");
      }

      // 6. Final Shuffle to hide the pattern
      const finalSample = getRandomSample(combinedSample, combinedSample.length);

      // 7. Blind the data (Remove AI outputs)
      const blindFields = ["decision", "AI_Decision", "reasoning", "exclusion_code", "AI_Status", "Gatekeeper_Decision", "Gatekeeper_Reasoning", "Scientist_Decision", "Scientist_Reasoning", "_rowIndex", "_notes"];

      const blindedPapers = finalSample.map(row => {
         let blindedRow = {};
         for (let key in row) {
           if (!blindFields.includes(key)) {
             blindedRow[key] = row[key];
           }
         }
         return blindedRow;
      });

      // 8. Fetch Metadata
      const config = ConfigManager.getAll();
      const metadata = {
        projectName: config["PROJECT_NAME"] || "Unnamed Project",
        researchQuestions: config["RESEARCH_QUESTIONS"] || "",
        inclusionCriteria: config["INCLUSION_CRITERIA"] || "",
        exclusionCriteria: config["EXCLUSION_CRITERIA"] || "",
        phase: phase,
        exportDate: new Date().toISOString()
      };

      const payload = {
        metadata: metadata,
        papers: blindedPapers
      };

      const message = `Sampled ${blindedPapers.length} papers (${sampledInclude.length} Include, ${sampledExclude.length} Exclude).`;

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
   * Processes the import of the completed .slr JSON file.
   */
  function processImport(phase, jsonDataStr) {
    try {
      console.log(`[InterRater] Starting Import for phase: ${phase}`);
      const data = JSON.parse(jsonDataStr);

      if (!data || !data.papers || !Array.isArray(data.papers)) {
        throw new Error("Invalid .slr format: missing papers array.");
      }

      // Identify Target Sheet
      const targetSheetName = phase === "title-abs" ? "02_titleabs_inter_rater" : "04_fulltext_inter_rater";
      let targetSheet = SheetUtils.getSheetByName(targetSheetName);
      if (!targetSheet) {
         // Create if missing
         const ss = SpreadsheetApp.getActiveSpreadsheet();
         targetSheet = ss.insertSheet(targetSheetName);
      }

      // Ensure minimal Headers
      const headersToEnsure = ["Paper_ID", "Reviewer", "Decision", "Reason", "Timestamp"];
      const targetHeaderMap = SheetUtils.getHeaderMap(targetSheet);
      headersToEnsure.forEach(h => SheetUtils.ensureColumn(targetSheet, h, targetHeaderMap));

      // Re-fetch header map after potential additions
      const finalHeaderMap = SheetUtils.getHeaderMap(targetSheet);

      // Append new data
      const newRows = [];
      const timestamp = new Date().toISOString();

      data.papers.forEach(paper => {
        // Only append if it has a decision
        if (paper.Reviewer_Decision && paper.Reviewer_Decision !== "") {
           const row = {
             "Paper_ID": paper.Paper_ID,
             "Reviewer": paper.Reviewer_Name || "Unknown",
             "Decision": paper.Reviewer_Decision,
             "Reason": paper.Reviewer_Reasoning || "",
             "Timestamp": timestamp
           };
           newRows.push(row);
        }
      });

      if (newRows.length === 0) {
        return "No valid reviewer decisions found to import.";
      }

      SheetUtils.appendDataMapped(targetSheet, newRows, finalHeaderMap);

      return `Successfully imported ${newRows.length} reviewer decisions.`;

    } catch (e) {
      console.error(e);
      throw new Error(`Import failed: ${e.message}`);
    }
  }

  /**
   * Calculates Inter-Rater Score and AI vs Human Consensus.
   */
  function calculateScore(phase) {
    try {
      console.log(`[InterRater] Calculating Score for phase: ${phase}`);

      const interRaterSheetName = phase === "title-abs" ? "02_titleabs_inter_rater" : "04_fulltext_inter_rater";
      const interRaterSheet = SheetUtils.getSheetByName(interRaterSheetName);
      if (!interRaterSheet) {
         SheetUtils.alert(`Sheet "${interRaterSheetName}" not found. Please import blinded results first.`);
         return;
      }

      const sourceSheetName = phase === "title-abs" ? "01_abstract_screening" : "03_fulltext_screening";
      const sourceSheet = SheetUtils.getSheetByName(sourceSheetName);
      if (!sourceSheet) {
         SheetUtils.alert(`Source sheet "${sourceSheetName}" not found.`);
         return;
      }

      const irData = SheetUtils.getDataAsObjects(interRaterSheet);
      if (irData.length === 0) {
         SheetUtils.alert("No inter-rater data available.");
         return;
      }

      const sourceData = SheetUtils.getDataAsObjects(sourceSheet);

      // Group inter-rater decisions by Paper_ID
      const groupedByPaper = {};
      irData.forEach(row => {
        const pid = row["Paper_ID"];
        if (!pid) return;
        const decision = String(row["Decision"] || "").trim().toUpperCase();
        if (decision === "INCLUDE" || decision === "EXCLUDE") {
           if (!groupedByPaper[pid]) {
             groupedByPaper[pid] = [];
           }
           groupedByPaper[pid].push(decision);
        }
      });

      const paperIds = Object.keys(groupedByPaper);
      if (paperIds.length === 0) {
         SheetUtils.alert("No valid Include/Exclude decisions found.");
         return;
      }

      // --- 1. Human vs Human (Fleiss' Kappa approximation for multiple raters) ---
      let totalPapersReviewed = paperIds.length;
      let totalRatersCount = 0;
      let perfectAgreementCount = 0;

      // For Fleiss Kappa calculation:
      // Rows = papers, Cols = categories (Include, Exclude)
      let sumOfPj = 0; // for calculating overall proportion of assignments to a category
      let n_i = []; // array of total raters per paper
      let categoryCounts = { "INCLUDE": 0, "EXCLUDE": 0 };
      let sumOfPi = 0; // Sum of agreement proportions per subject

      paperIds.forEach(pid => {
         const decisions = groupedByPaper[pid];
         const n = decisions.length;
         n_i.push(n);
         totalRatersCount += n;

         let inc = decisions.filter(d => d === "INCLUDE").length;
         let exc = decisions.filter(d => d === "EXCLUDE").length;

         categoryCounts["INCLUDE"] += inc;
         categoryCounts["EXCLUDE"] += exc;

         if (n > 1) {
             let Pi = ((inc * inc) + (exc * exc) - n) / (n * (n - 1));
             sumOfPi += Pi;
             if (inc === n || exc === n) {
                 perfectAgreementCount++;
             }
         }
      });

      const avgRatersPerPaper = (totalRatersCount / totalPapersReviewed).toFixed(2);

      let humanKappa = "N/A";
      let papersWithMultipleRaters = n_i.filter(n => n > 1).length;
      let humanAgreementRate = papersWithMultipleRaters > 0 ? ((perfectAgreementCount / papersWithMultipleRaters) * 100).toFixed(1) : "N/A";

      if (papersWithMultipleRaters > 0) {
          // Fleiss Kappa
          let Pbar = sumOfPi / papersWithMultipleRaters;
          let Pbar_e = 0;
          let totalAssignments = totalRatersCount;

          let p_inc = categoryCounts["INCLUDE"] / totalAssignments;
          let p_exc = categoryCounts["EXCLUDE"] / totalAssignments;

          Pbar_e = (p_inc * p_inc) + (p_exc * p_exc);

          if (Pbar_e === 1) {
              humanKappa = "1.000"; // Perfect agreement, avoid division by zero
          } else {
              let kappa = (Pbar - Pbar_e) / (1 - Pbar_e);
              humanKappa = kappa.toFixed(3);
          }
      }

      // --- 2. Human Consensus vs AI Decision ---
      let TP = 0, FP = 0, TN = 0, FN = 0;

      let decisionCol = "decision";
      if (sourceData.length > 0 && !sourceData[0].hasOwnProperty("decision") && sourceData[0].hasOwnProperty("AI_Decision")) {
        decisionCol = "AI_Decision";
      }

      paperIds.forEach(pid => {
         const decisions = groupedByPaper[pid];
         let incCount = decisions.filter(d => d === "INCLUDE").length;
         let excCount = decisions.filter(d => d === "EXCLUDE").length;

         // Majority vote consensus
         let consensus = incCount > excCount ? "INCLUDE" : (excCount > incCount ? "EXCLUDE" : "TIE");

         // Look up AI decision
         const sourceRow = sourceData.find(r => String(r["Paper_ID"]) === String(pid));
         if (sourceRow) {
            let aiDec = String(sourceRow[decisionCol]).trim().toUpperCase();

            // If TIE, we'll exclude from binary confusion matrix or consider it a mismatch.
            // For rigorous science, we'll skip ties in the confusion matrix or count as FN/FP based on AI.
            // Let's only count clear consensus.
            if (consensus === "INCLUDE" || consensus === "EXCLUDE") {
               if (aiDec === "INCLUDE" && consensus === "INCLUDE") TP++;
               else if (aiDec === "INCLUDE" && consensus === "EXCLUDE") FP++; // AI said include, human consensus said exclude (AI False Positive)
               else if (aiDec === "EXCLUDE" && consensus === "EXCLUDE") TN++;
               else if (aiDec === "EXCLUDE" && consensus === "INCLUDE") FN++; // AI said exclude, human consensus said include (AI False Negative)
            }
         }
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
          totalPapersReviewed,
          avgRatersPerPaper,
          humanKappa,
          humanAgreementRate,
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
      template.phase = phase;
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
    showExportDialog,
    showImportDialog,
    processExport,
    processImport,
    calculateScore
  };

})();
