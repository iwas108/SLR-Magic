/**
 * ScreeningController.js
 * Orchestrates the AI Title-Abstract Screening process.
 */

const ScreeningController = (function() {

  function run() {
    try {
      // 1. Read Configuration
      const config = SheetUtils.getConfigMap("00_manifest");
      const apiKey = config["API_KEY"];
      const modelName = config["MODEL_NAME"] || "gemini-1.5-flash";
      const temperature = parseFloat(config["TEMPERATURE"] || "0.7");
      const maxTokens = parseInt(config["MAX_TOKENS"] || "1024");
      const batchSize = parseInt(config["BATCH_SIZE"] || "5");
      const systemPrompt = config["ABSTRACT_SCREENING_PROMPT"];

      if (!apiKey) {
        throw new Error("API_KEY is missing in 00_manifest.");
      }
      if (!systemPrompt) {
        throw new Error("ABSTRACT_SCREENING_PROMPT is missing in 00_manifest.");
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

      // 4. Process Batch
      const batch = pendingRows.slice(0, batchSize);
      SheetUtils.toast(`Starting screening for ${batch.length} papers. This may take a while.`, "Processing", 5);

      let processedCount = 0;
      let errorCount = 0;

      batch.forEach((row, index) => {
        const title = row["Title"] || "";
        const abstract = row["Abstract"] || "";

        // Construct the prompt
        // We append the specific paper details to the system prompt
        const fullPrompt = `${systemPrompt}\n\n---\n\nPaper to Evaluate:\nTitle: ${title}\nAbstract: ${abstract}`;

        const updateData = {};

        try {
          // Call Gemini
          const result = GeminiAdapter.callGemini(fullPrompt, apiKey, modelName, temperature, maxTokens);

          // Map result to sheet columns
          updateData["AI_Status"] = "Done";
          updateData["AI_Relevance_Score"] = result.relevance_score;
          updateData["AI_Recommendation"] = result.recommendation;
          updateData["AI_Reasoning"] = result.reasoning;
          updateData["Exclusion_Reason"] = result.exclusion_reason || "";

          processedCount++;

        } catch (e) {
          console.error(`Error processing row ${row._rowIndex}:`, e);
          updateData["AI_Status"] = "Error";
          updateData["Notes"] = `Error: ${e.message}`; // Append to notes? Or just overwrite.
          errorCount++;
        }

        // Update Sheet immediately
        SheetUtils.updateRow(sheet, row._rowIndex, updateData, headerMap);

        // Ideal delay to prevent rate limits (e.g., 2 seconds)
        // Only delay if it's not the last item
        if (index < batch.length - 1) {
          Utilities.sleep(2000);
        }
      });

      // 5. Final Feedback
      const msg = `Screening Complete.\nProcessed: ${processedCount}\nErrors: ${errorCount}`;
      SheetUtils.toast(msg, "Job Done", 10);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`An unexpected error occurred: ${e.message}`);
    }
  }

  return {
    run
  };

})();
