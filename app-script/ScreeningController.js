/**
 * ScreeningController.js
 * Orchestrates the AI Title-Abstract Screening process.
 */

const ScreeningController = (function() {

  function run() {
    // Acquire Lock to prevent race conditions (e.g., overlapping triggers)
    const lock = LockService.getScriptLock();
    // Try to acquire lock for 10 seconds. If failed, it means another instance is running.
    if (!lock.tryLock(10000)) {
        console.log("Could not acquire lock. Another instance of Screening is likely running.");
        // We do not alert here because this is likely a background trigger overlap.
        return;
    }

    try {
      // 1. Read Configuration
      const config = ConfigManager.getAll();
            const modelName = config["ABSTRACT_SCREENING_MODEL"] || "gemini-2.0-flash-lite";
      const temperature = parseFloat(config["TEMPERATURE"] || "0.7");
      const maxTokens = parseInt(config["MAX_TOKENS"] || "1024");

      // Automatic Reasoning Selection
      let thinkingLevel = undefined;
      let thinkingBudget = undefined;

      const lowerModel = modelName.toLowerCase();
      if (lowerModel.includes("gemini-2.5") || lowerModel.includes("flash-thinking")) {
          // Rule: Gemini 2.5 uses thinking budget
          thinkingBudget = config["THINKING_BUDGET"];
      } else if (lowerModel.includes("gemini-3")) {
          // Rule: Gemini 3 uses thinking level
          thinkingLevel = config["THINKING_LEVEL"];
      }

      const batchSize = parseInt(config["BATCH_SIZE"] || "5");
      const systemPrompt = config["ABSTRACT_SCREENING_PROMPT"];

            if (!systemPrompt) {
        throw new Error("ABSTRACT_SCREENING_PROMPT is missing in Configuration.");
      }

      // 2. Get Data
      const sheet = SheetUtils.getSheetByName("01_abstract_screening");
      const headerMap = SheetUtils.getHeaderMap(sheet);
      const allData = SheetUtils.getDataAsObjects(sheet);

      // 3. Filter Pending Rows
      const pendingRows = allData.filter(row => row["AI_Status"] === "Pending");

      if (pendingRows.length === 0) {
        SheetUtils.alert("No pending rows found for screening.");
        return;
      }

      const parallelRequestSize = parseInt(config["PARALLEL_REQUEST_SIZE"] || "1");

      // 4. Process Batch
      const batch = pendingRows.slice(0, batchSize);
      SheetUtils.toast(`Starting screening for ${batch.length} papers. This may take a while.`, "Processing", 5);

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
          const responses = LlmService.callLlmParallel(promptsData, modelName, temperature, maxTokens, thinkingLevel, thinkingBudget);

          responses.forEach((response, idx) => {
            const row = subBatch[idx];
            const updateData = {};

            if (response.error) {
              console.error(`Error mapping row ${row._rowIndex}:`, response.message);
              updateData["AI_Status"] = "Error";
              const statusColIdx = headerMap["AI_Status"];
              if (statusColIdx) sheet.getRange(row._rowIndex, statusColIdx).setNote(`Error: ${response.message}`);
              errorCount++;
              SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);
              return;
            }

            try {
              const result = response.content;
              updateData["AI_Status"] = "Done";

              let finalEval = result.final_evaluation || result;

              for (const [key, value] of Object.entries(finalEval)) {
                SheetUtils.ensureColumn(sheet, key, headerMap);
                updateData[key] = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
              }

              if (result.logic_trace) {
                SheetUtils.ensureColumn(sheet, "Logic_Trace", headerMap);
                updateData["Logic_Trace"] = typeof result.logic_trace === 'object' && result.logic_trace !== null ? JSON.stringify(result.logic_trace) : result.logic_trace;
              }

              if (response.usageMetadata) {
                const thinkingTokens = response.usageMetadata.thoughtsTokenCount || 0;
                const candidateTokens = response.usageMetadata.candidatesTokenCount || 0;
                const promptTokens = response.usageMetadata.promptTokenCount || 0;
                const totalTokens = response.usageMetadata.totalTokenCount || 0;

                SheetUtils.ensureColumn(sheet, "Thinking_Token_Abstract_Screening", headerMap);
                SheetUtils.ensureColumn(sheet, "Candidate_Token_Abstract_Screening", headerMap);
                SheetUtils.ensureColumn(sheet, "Input_Token_Abstract_Screening", headerMap);
                SheetUtils.ensureColumn(sheet, "Total_Token_Abstract_Screening", headerMap);

                updateData["Thinking_Token_Abstract_Screening"] = thinkingTokens;
                updateData["Candidate_Token_Abstract_Screening"] = candidateTokens;
                updateData["Input_Token_Abstract_Screening"] = promptTokens;
                updateData["Total_Token_Abstract_Screening"] = totalTokens;
              }

              processedCount++;
            } catch (e) {
              console.error(`Error mapping row ${row._rowIndex}:`, e);
              updateData["AI_Status"] = "Error";
              const statusColIdx = headerMap["AI_Status"];
              if (statusColIdx) sheet.getRange(row._rowIndex, statusColIdx).setNote(`Error: ${e.message}`);
              errorCount++;
            }
            SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);
          });
        } catch (e) {
          console.error(`Error processing parallel batch:`, e);
          // If the whole parallel fetch fails, mark all in this sub-batch as error
          subBatch.forEach(row => {
            const updateData = { "AI_Status": "Error" };
            const statusColIdx = headerMap["AI_Status"];
            if (statusColIdx) sheet.getRange(row._rowIndex, statusColIdx).setNote(`Batch Error: ${e.message}`);
            SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);
            errorCount++;
          });
        }

        if (i + parallelRequestSize < batch.length) {
          Utilities.sleep(2000);
        }
      }

      // 5. Final Feedback
      const msg = `Screening Complete.\nProcessed: ${processedCount}\nErrors: ${errorCount}`;
      SheetUtils.toast(msg, "Job Done", 10);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`An unexpected error occurred: ${e.message}`);
    } finally {
        // Always release the lock
        lock.releaseLock();
    }
  }

  return {
    run
  };

})();
