/**
 * ExtendedMinerController.js
 * Logic for the Independent Extended Miner.
 */

const ExtendedMinerController = (function() {

  /**
   * Helper to process fields (flattening and value/evidence).
   * Duplicated from FullTextScreeningController to ensure independence.
   */
  function processContent(content, targetData, targetNotes) {
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
  }

  /**
   * Helper to accumulate token usage.
   */
  function accumulateTokens(rowUpdateData, stageName, newUsage) {
      if (!newUsage) return;

      const thinking = newUsage.thoughtsTokenCount || 0;
      const candidate = newUsage.candidatesTokenCount || 0;
      const input = newUsage.promptTokenCount || 0;
      const total = newUsage.totalTokenCount || 0;

      rowUpdateData[`Thinking_Token_${stageName}`] = thinking;
      rowUpdateData[`Candidate_Token_${stageName}`] = candidate;
      rowUpdateData[`Input_Token_${stageName}`] = input;
      rowUpdateData[`Total_Token_${stageName}`] = total;
  }

  /**
   * Runs the Extended Miner.
   */
  function run() {
    // Acquire Lock
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
        console.log("Could not acquire lock. Another instance is likely running.");
        return;
    }

    try {
      // 1. Read Configuration
      const config = ConfigManager.getAll();

      const model = config["THE_EXTENDED_MINER_MODEL"] || "gemini-2.0-flash-lite";
      const prompt = config["THE_EXTENDED_MINER_PROMPT"];

      const temperature = parseFloat(config["TEMPERATURE"] || "0.7");
      const maxTokens = parseInt(config["MAX_TOKENS"] || "8192");
      const batchSize = parseInt(config["BATCH_SIZE"] || "3");

            if (!prompt) throw new Error("THE_EXTENDED_MINER_PROMPT is missing in Configuration.");

      // Reasoning Config
      const lowerModel = (model || "").toLowerCase();
      let thinkingLevel = undefined;
      let thinkingBudget = undefined;

      if (lowerModel.includes("gemini-2.5") || lowerModel.includes("flash-thinking")) {
          thinkingBudget = config["THINKING_BUDGET"];
      } else if (lowerModel.includes("gemini-3")) {
          thinkingLevel = config["THINKING_LEVEL"];
      }

      // 2. Get Data
      const sheet = SheetUtils.getSheetByName("02_fulltext_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);
      const allData = SheetUtils.getDataAsObjects(sheet);

      // 3. Filter Rows: AI_Status == "Extend" AND decision == "Include"
      const targetRows = allData.filter(row => {
          const status = String(row["AI_Status"] || "").trim();
          const decision = String(row["decision"] || "").trim().toUpperCase();
          return status === "Extend" && decision === "INCLUDE";
      });

      if (targetRows.length === 0) {
        SheetUtils.toast("No rows found with AI_Status='Extend' and decision='Include'.", "Extended Miner", 3);
        return;
      }

      // 4. Process Batch
      const batch = targetRows.slice(0, batchSize);
      SheetUtils.toast(`Processing ${batch.length} papers for Extended Miner...`, "Processing", -1);

      let processedCount = 0;
      let errorCount = 0;

      batch.forEach((row, index) => {
        const pdfUrl = row["PDF"];
        console.log(`Processing Row ${row._rowIndex}, PDF: ${pdfUrl}`);

        const rowUpdateData = { "AI_Status": "Done" };
        const rowUpdateNotes = {};

        const pdfValidity = row["PDF_Validity"];

        if (!pdfValidity) {
             // If PDF is not valid, we cannot extend. Mark as Error.
             rowUpdateData["AI_Status"] = "Error";
             rowUpdateData["Notes"] = "Cannot run Extended Miner: PDF invalid or missing.";
             SheetUtils.updateRow(sheet, row._rowIndex, rowUpdateData, headerMap);
             errorCount++;
             return;
        }

        try {
            const pdfBlob = DriveUtils.getFileBlob(pdfUrl);

            const response = LlmService.callLlm(prompt, model, temperature, maxTokens, thinkingLevel, thinkingBudget, pdfBlob);

            accumulateTokens(rowUpdateData, "The_Extended_Miner", response.usageMetadata);
            processContent(response.content, rowUpdateData, rowUpdateNotes);

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
            rowUpdateData["Notes"] = `Extended Miner Error: ${e.message}`;
            SheetUtils.updateRow(sheet, row._rowIndex, rowUpdateData, headerMap);
            errorCount++;
        }

        if (index < batch.length - 1) {
            Utilities.sleep(3000);
        }
      });

      SheetUtils.toast(`Extended Miner Batch Complete.\nProcessed: ${processedCount}\nErrors: ${errorCount}`, "Job Done", 10);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`An unexpected error occurred: ${e.message}`);
    } finally {
        lock.releaseLock();
    }
  }

  /**
   * Manages the background trigger.
   */
  function manageTrigger() {
      const ui = SpreadsheetApp.getUi();
      const validMinutes = [1, 5, 10, 15, 30];
      const functionName = 'runExtendedMiner';
      const jobName = 'Extended Miner';

      // 1. Check existing status
      const triggers = ScriptApp.getProjectTriggers();
      let existingTrigger = null;
      for (const trigger of triggers) {
        if (trigger.getHandlerFunction() === functionName) {
          existingTrigger = trigger;
          break;
        }
      }

      const statusMsg = existingTrigger
        ? `Current Status: ACTIVE (${jobName} is running)`
        : `Current Status: INACTIVE`;

      // 2. Prompt User
      const promptMsg = `${statusMsg}\n\n` +
        `Enter run frequency in minutes (${validMinutes.join(", ")}).\n` +
        `Or enter '0' or 'OFF' to disable background miner.`;

      const response = ui.prompt(`${jobName} Setup`, promptMsg, ui.ButtonSet.OK_CANCEL);

      if (response.getSelectedButton() !== ui.Button.OK) {
        return; // Cancelled
      }

      const input = response.getResponseText().trim().toUpperCase();

      // 3. Handle "OFF"
      if (input === '0' || input === 'OFF') {
        if (existingTrigger) {
          ScriptApp.deleteTrigger(existingTrigger);
          ui.alert(`${jobName} has been DISABLED.`);
        } else {
          ui.alert(`${jobName} is already disabled.`);
        }
        return;
      }

      // 4. Handle Number
      const minutes = parseInt(input);
      if (isNaN(minutes) || !validMinutes.includes(minutes)) {
        ui.alert(`Invalid input. Please enter one of these values: ${validMinutes.join(", ")}`);
        return;
      }

      // 5. Update Trigger
      if (existingTrigger) {
        ScriptApp.deleteTrigger(existingTrigger);
      }

      ScriptApp.newTrigger(functionName)
        .timeBased()
        .everyMinutes(minutes)
        .create();

      ui.alert(`${jobName} ENABLED. Running every ${minutes} minutes.`);
  }

  return {
    run,
    manageTrigger
  };

})();
