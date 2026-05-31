/**
 * CostAnalysisController.js
 * Handles the logic for Project Cost Preview and Analysis.
 */

var CostAnalysisController = (function() {

  /**
   * Retrieves the unique models used in the project configuration.
   * @returns {Array<string>} List of unique model names.
   */
  function getUniqueModels() {
    try {
      const config = ConfigManager.getAll();
      const models = [
        config["STAGE_1_MODEL"] || config["MODEL_NAME"],
        config["STAGE_2_1_MODEL"] || config["MODEL_NAME"],
        config["STAGE_2_2_MODEL"] || config["MODEL_NAME"],
        config["STAGE_2_3_MODEL"] || config["MODEL_NAME"]
      ];

      // Filter distinct, non-empty values
      const unique = Array.from(new Set(models.filter(m => m && m.trim() !== "")));
      return unique.length > 0 ? unique : ["llama3"];
    } catch (e) {
      console.error(e);
      return ["gemini-2.0-flash-lite"];
    }
  }

  /**
   * Parses the MODEL_PRICING CSV string from manifest.
   * Format: ModelName,InputPrice,OutputPrice,PerCount
   */
  function parseModelPricing() {
    try {
      const config = ConfigManager.getAll();
      const pricingRaw = config["MODEL_PRICING"];

      const pricingMap = {};

      if (pricingRaw) {
        // Split by newline
        const lines = pricingRaw.split(/\r?\n/);
        lines.forEach(line => {
           const parts = line.split(',');
           if (parts.length >= 4) {
               const model = parts[0].trim();
               pricingMap[model] = {
                   inputPrice: parseFloat(parts[1]) || 0,
                   outputPrice: parseFloat(parts[2]) || 0,
                   inputTokenCount: parseFloat(parts[3]) || 1, // Usually same for both
                   outputTokenCount: parseFloat(parts[3]) || 1
               };
           }
        });
      }
      return pricingMap;
    } catch (e) {
      console.error("Error parsing model pricing: " + e.message);
      return {};
    }
  }

  /**
   * Saves pricing data back to manifest.
   * pricingData: Object { modelName: { inputPrice, outputPrice, count } }
   */
  function saveModelPricing(pricingData) {
     try {
       // Convert object to CSV string
       let csvLines = [];
       for (const [model, data] of Object.entries(pricingData)) {
           // model, inputPrice, outputPrice, count
           csvLines.push(`${model},${data.inputPrice},${data.outputPrice},${data.inputTokenCount}`);
       }

       const csvString = csvLines.join("\n");
       ConfigManager.set("MODEL_PRICING", csvString);
       return "Pricing updated.";
     } catch (e) {
       console.error(e);
       throw new Error("Failed to save pricing: " + e.message);
     }
  }

  /**
   * Calculates the project costs based on provided model prices.
   * @param {Object} priceMap Map of modelName -> { price, tokens }
   * @returns {Object} Cost analysis stats broken down by stage.
   */
  function calculateProjectCosts(priceMap) {
    try {
        const config = ConfigManager.getAll();

        // Helper: Get input/output rates for a model
        const getRates = (modelName) => {
            if (!modelName) return { input: 0, output: 0 };
            const entry = priceMap[modelName];
            if (!entry) return { input: 0, output: 0 };

            const inPrice = parseFloat(entry.inputPrice) !== undefined ? parseFloat(entry.inputPrice) : (parseFloat(entry.price) || 0);
            const outPrice = parseFloat(entry.outputPrice) || 0;

            const inCount = parseFloat(entry.inputTokenCount) || (parseFloat(entry.tokenCount) || 1);
            const outCount = parseFloat(entry.outputTokenCount) || (parseFloat(entry.tokenCount) || 1);

            return {
                input: inPrice / inCount,
                output: outPrice / outCount
            };
        };

        const absModel = config["STAGE_1_MODEL"] || config["MODEL_NAME"] || "deepseek-r1";
        const gkModel = config["STAGE_2_1_MODEL"] || config["MODEL_NAME"] || "deepseek-r1";
        const sciModel = config["STAGE_2_2_MODEL"] || config["MODEL_NAME"] || "deepseek-r1";
        const minerModel = config["STAGE_2_3_MODEL"] || config["MODEL_NAME"] || "deepseek-r1";

        const absRates = getRates(absModel);
        const gkRates = getRates(gkModel);
        const sciRates = getRates(sciModel);
        const minerRates = getRates(minerModel);

        // --- Stats Initialization ---
        const initStats = () => ({
            total: 0, min: Infinity, max: 0, avg: 0, count: 0,
            input: 0, thinking: 0, candidate: 0
        });

        const absStats = initStats();
        const gkStats = initStats();
        const sciStats = initStats();
        const minerStats = initStats();

        // Assign model names for UI display
        absStats.model = absModel;
        gkStats.model = gkModel;
        sciStats.model = sciModel;
        minerStats.model = minerModel;

        const processSheet = (sheetName, stats, rates) => {
            try {
                const sheet = SheetUtils.getSheetByName(sheetName);
                const data = SheetUtils.getDataAsObjects(sheet);

                data.forEach(row => {
                     const input = parseInt(row["Input_Tokens"] || 0);
                     const thinking = parseInt(row["Thinking_Tokens"] || 0);
                     const output = parseInt(row["Output_Tokens"] || 0);

                     if (input + thinking + output > 0) {
                         const cost = (input * rates.input) + ((thinking + output) * rates.output);

                         stats.total += cost;
                         stats.count++;
                         stats.input += input;
                         stats.thinking += thinking;
                         stats.candidate += output;

                         if (cost < stats.min) stats.min = cost;
                         if (cost > stats.max) stats.max = cost;
                     }
                });
            } catch (err) {
                console.warn(`[CostAnalysis] Could not read costs for ${sheetName}: ${err.message}`);
            }

            if (stats.count > 0) {
                stats.avg = stats.total / stats.count;
            } else {
                stats.min = 0;
            }
        };

        processSheet("01_Fast_Filter", absStats, absRates);
        processSheet("02_Gatekeeper", gkStats, gkRates);
        processSheet("03_Scientist", sciStats, sciRates);
        processSheet("04_Miner", minerStats, minerRates);

        // Calculate Grand Total
        const grandTotal = absStats.total + gkStats.total + sciStats.total + minerStats.total;

        return {
            abstract: absStats,
            gatekeeper: gkStats,
            scientist: sciStats,
            miner: minerStats,
            grandTotal: grandTotal
        };

    } catch (e) {
        console.error(e);
        throw new Error("Calculation failed: " + e.message);
    }
  }

  /**
   * Shows the Cost Preview Dialog.
   */
  function showCostPreviewDialog() {
    const html = HtmlService.createHtmlOutputFromFile('CostPreviewUI')
      .setWidth(800)
      .setHeight(600)
      .setTitle('Project Cost Preview');
    SpreadsheetApp.getUi().showModalDialog(html, 'Project Cost Preview');
  }

  return {
    getUniqueModels,
    calculateProjectCosts,
    showCostPreviewDialog,
    parseModelPricing,
    saveModelPricing
  };

})();
