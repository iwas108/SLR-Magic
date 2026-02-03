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
      const config = SheetUtils.getConfigMap("00_manifest");
      const models = [
        config["ABSTRACT_SCREENING_MODEL"],
        config["THE_GATEKEEPER_MODEL"],
        config["THE_SCIENTIST_MODEL"],
        config["THE_MINER_MODEL"],
        config["THE_EXTENDED_MINER_MODEL"]
      ];

      // Filter distinct, non-empty values
      const unique = Array.from(new Set(models.filter(m => m && m.trim() !== "")));
      return unique.length > 0 ? unique : ["gemini-2.0-flash-lite"];
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
      const config = SheetUtils.getConfigMap("00_manifest");
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
       SheetUtils.setConfigValue("MODEL_PRICING", csvString);
       return "Pricing updated.";
     } catch (e) {
       console.error(e);
       throw new Error("Failed to save pricing: " + e.message);
     }
  }

  /**
   * Calculates the project costs based on provided model prices.
   * @param {Object} priceMap Map of modelName -> { price, tokens }
   * @returns {Object} Cost analysis stats for Abstract and Full-Text screening.
   */
  function calculateProjectCosts(priceMap) {
    try {
        const config = SheetUtils.getConfigMap("00_manifest");

        // Helper: Get price per token for a model
        const getRate = (modelName) => {
            if (!modelName) return 0;
            const entry = priceMap[modelName];
            if (!entry) return 0;
            const price = parseFloat(entry.price) || 0;
            const count = parseFloat(entry.tokenCount) || 1;
            return price / count;
        };

        const absModel = config["ABSTRACT_SCREENING_MODEL"];
        const gkModel = config["THE_GATEKEEPER_MODEL"];
        const sciModel = config["THE_SCIENTIST_MODEL"];
        const minerModel = config["THE_MINER_MODEL"];
        const extMinerModel = config["THE_EXTENDED_MINER_MODEL"];

        const absRate = getRate(absModel);
        const gkRate = getRate(gkModel);
        const sciRate = getRate(sciModel);
        const minerRate = getRate(minerModel);
        const extMinerRate = getRate(extMinerModel);

        // --- Abstract Screening ---
        const absStats = { total: 0, min: Infinity, max: 0, avg: 0, count: 0 };
        const absSheet = SheetUtils.getSheetByName("01_abstract_screening");
        const absData = SheetUtils.getDataAsObjects(absSheet);
        let absTotalCost = 0;
        let absPaperCount = 0;

        absData.forEach(row => {
             if (row["AI_Status"] === "Done") {
                 const input = parseInt(row["Input_Token_Abstract_Screening"] || 0);
                 const thinking = parseInt(row["Thinking_Token_Abstract_Screening"] || 0);
                 const candidate = parseInt(row["Candidate_Token_Abstract_Screening"] || 0);

                 const totalTokens = input + thinking + candidate;
                 const cost = totalTokens * absRate;

                 absTotalCost += cost;
                 absPaperCount++;

                 if (cost < absStats.min) absStats.min = cost;
                 if (cost > absStats.max) absStats.max = cost;
             }
        });

        if (absPaperCount > 0) {
            absStats.total = absTotalCost;
            absStats.avg = absTotalCost / absPaperCount;
            absStats.count = absPaperCount;
        } else {
            absStats.min = 0;
        }

        // --- Full-Text Screening ---
        const ftStats = { total: 0, min: Infinity, max: 0, avg: 0, count: 0 };
        const ftSheet = SheetUtils.getSheetByName("02_fulltext_screening");
        const ftData = SheetUtils.getDataAsObjects(ftSheet);
        let ftTotalCost = 0;
        let ftPaperCount = 0;

        ftData.forEach(row => {
             // For Extended Miner, status might be Done, or just Extended.
             // We accumulate costs regardless of state if tokens exist, but usually we filter by Done.
             if (row["AI_Status"] === "Done") {
                 let rowCost = 0;

                 // Gatekeeper
                 const gkInput = parseInt(row["Input_Token_The_Gatekeeper"] || 0);
                 const gkThink = parseInt(row["Thinking_Token_The_Gatekeeper"] || 0);
                 const gkCand = parseInt(row["Candidate_Token_The_Gatekeeper"] || 0);
                 rowCost += (gkInput + gkThink + gkCand) * gkRate;

                 // Scientist
                 const sciInput = parseInt(row["Input_Token_The_Scientist"] || 0);
                 const sciThink = parseInt(row["Thinking_Token_The_Scientist"] || 0);
                 const sciCand = parseInt(row["Candidate_Token_The_Scientist"] || 0);
                 rowCost += (sciInput + sciThink + sciCand) * sciRate;

                 // Miner
                 const minerInput = parseInt(row["Input_Token_The_Miner"] || 0);
                 const minerThink = parseInt(row["Thinking_Token_The_Miner"] || 0);
                 const minerCand = parseInt(row["Candidate_Token_The_Miner"] || 0);
                 rowCost += (minerInput + minerThink + minerCand) * minerRate;

                 // Extended Miner
                 const extInput = parseInt(row["Input_Token_The_Extended_Miner"] || 0);
                 const extThink = parseInt(row["Thinking_Token_The_Extended_Miner"] || 0);
                 const extCand = parseInt(row["Candidate_Token_The_Extended_Miner"] || 0);
                 rowCost += (extInput + extThink + extCand) * extMinerRate;

                 ftTotalCost += rowCost;
                 ftPaperCount++;

                 if (rowCost < ftStats.min) ftStats.min = rowCost;
                 if (rowCost > ftStats.max) ftStats.max = rowCost;
             }
        });

        if (ftPaperCount > 0) {
            ftStats.total = ftTotalCost;
            ftStats.avg = ftTotalCost / ftPaperCount;
            ftStats.count = ftPaperCount;
        } else {
            ftStats.min = 0;
        }

        return {
            abstract: absStats,
            fulltext: ftStats
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
      .setWidth(600)
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
