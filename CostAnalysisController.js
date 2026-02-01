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
        config["THE_MINER_MODEL"]
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
   * Calculates the project costs based on provided model prices.
   * @param {Object} priceMap Map of modelName -> { price, tokens } (e.g. { "gemini-pro": { price: 0.5, tokens: 1000000 } })
   * @returns {Object} Cost analysis stats for Abstract and Full-Text screening.
   */
  function calculateProjectCosts(priceMap) {
    try {
        const config = SheetUtils.getConfigMap("00_manifest");

        // Helper: Get price per token for a model
        // Note: We treat Thinking & Candidate as Input as per instruction.
        const getRate = (modelName) => {
            if (!modelName) return 0;
            const entry = priceMap[modelName];
            if (!entry) return 0;
            // Calculate rate: Price / TokenCount
            // We use the INPUT price/count as requested
            const price = parseFloat(entry.price) || 0;
            const count = parseFloat(entry.tokenCount) || 1; // Avoid division by zero
            return price / count;
        };

        const absModel = config["ABSTRACT_SCREENING_MODEL"];
        const gkModel = config["THE_GATEKEEPER_MODEL"];
        const sciModel = config["THE_SCIENTIST_MODEL"];
        const minerModel = config["THE_MINER_MODEL"];

        const absRate = getRate(absModel);
        const gkRate = getRate(gkModel);
        const sciRate = getRate(sciModel);
        const minerRate = getRate(minerModel);

        // --- Abstract Screening ---
        const absStats = { total: 0, min: Infinity, max: 0, avg: 0, count: 0 };
        const absSheet = SheetUtils.getSheetByName("01_abstract_screening");
        const absData = SheetUtils.getDataAsObjects(absSheet);
        let absTotalCost = 0;
        let absPaperCount = 0;

        absData.forEach(row => {
            // Only consider processed rows for "Current Cost"
             if (row["AI_Status"] === "Done") {
                 const input = parseInt(row["Input_Token_Abstract_Screening"] || 0);
                 const thinking = parseInt(row["Thinking_Token_Abstract_Screening"] || 0);
                 const candidate = parseInt(row["Candidate_Token_Abstract_Screening"] || 0);

                 // "thinking and candidate token is regarded as input"
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
    showCostPreviewDialog
  };

})();
