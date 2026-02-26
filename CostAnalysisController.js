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

            // Prefer explicit input/output fields, fallback to generic price for input if missing (legacy safety)
            const inPrice = parseFloat(entry.inputPrice) !== undefined ? parseFloat(entry.inputPrice) : (parseFloat(entry.price) || 0);
            const outPrice = parseFloat(entry.outputPrice) || 0;

            const inCount = parseFloat(entry.inputTokenCount) || (parseFloat(entry.tokenCount) || 1);
            const outCount = parseFloat(entry.outputTokenCount) || (parseFloat(entry.tokenCount) || 1);

            return {
                input: inPrice / inCount,
                output: outPrice / outCount
            };
        };

        const absModel = config["ABSTRACT_SCREENING_MODEL"];
        const gkModel = config["THE_GATEKEEPER_MODEL"];
        const sciModel = config["THE_SCIENTIST_MODEL"];
        const minerModel = config["THE_MINER_MODEL"];
        const extMinerModel = config["THE_EXTENDED_MINER_MODEL"];

        const absRates = getRates(absModel);
        const gkRates = getRates(gkModel);
        const sciRates = getRates(sciModel);
        const minerRates = getRates(minerModel);
        const extRates = getRates(extMinerModel);

        // --- Stats Initialization ---
        const initStats = () => ({
            total: 0, min: Infinity, max: 0, avg: 0, count: 0,
            input: 0, thinking: 0, candidate: 0
        });

        const absStats = initStats();
        const gkStats = initStats();
        const sciStats = initStats();
        const minerStats = initStats();
        const extStats = initStats();

        // Assign model names for UI display
        absStats.model = absModel;
        gkStats.model = gkModel;
        sciStats.model = sciModel;
        minerStats.model = minerModel;
        extStats.model = extMinerModel;

        // --- Abstract Screening ---
        const absSheet = SheetUtils.getSheetByName("01_abstract_screening");
        const absData = SheetUtils.getDataAsObjects(absSheet);

        absData.forEach(row => {
             if (row["AI_Status"] === "Done") {
                 const input = parseInt(row["Input_Token_Abstract_Screening"] || 0);
                 const thinking = parseInt(row["Thinking_Token_Abstract_Screening"] || 0);
                 const candidate = parseInt(row["Candidate_Token_Abstract_Screening"] || 0);

                 // Input cost + Output cost (thinking + candidate)
                 const cost = (input * absRates.input) + ((thinking + candidate) * absRates.output);

                 absStats.total += cost;
                 absStats.count++;
                 absStats.input += input;
                 absStats.thinking += thinking;
                 absStats.candidate += candidate;

                 if (cost < absStats.min) absStats.min = cost;
                 if (cost > absStats.max) absStats.max = cost;
             }
        });

        if (absStats.count > 0) {
            absStats.avg = absStats.total / absStats.count;
        } else {
            absStats.min = 0;
        }

        // --- Full-Text & Extended Miner ---
        const ftSheet = SheetUtils.getSheetByName("02_fulltext_screening");
        const ftData = SheetUtils.getDataAsObjects(ftSheet);

        ftData.forEach(row => {
             if (row["AI_Status"] === "Done") {

                 // Gatekeeper
                 const gkInput = parseInt(row["Input_Token_The_Gatekeeper"] || 0);
                 const gkThink = parseInt(row["Thinking_Token_The_Gatekeeper"] || 0);
                 const gkCand = parseInt(row["Candidate_Token_The_Gatekeeper"] || 0);

                 if (gkInput + gkThink + gkCand > 0) {
                     const cost = (gkInput * gkRates.input) + ((gkThink + gkCand) * gkRates.output);
                     gkStats.total += cost;
                     gkStats.count++;
                     gkStats.input += gkInput;
                     gkStats.thinking += gkThink;
                     gkStats.candidate += gkCand;

                     if (cost < gkStats.min) gkStats.min = cost;
                     if (cost > gkStats.max) gkStats.max = cost;
                 }

                 // Scientist
                 const sciInput = parseInt(row["Input_Token_The_Scientist"] || 0);
                 const sciThink = parseInt(row["Thinking_Token_The_Scientist"] || 0);
                 const sciCand = parseInt(row["Candidate_Token_The_Scientist"] || 0);

                 if (sciInput + sciThink + sciCand > 0) {
                     const cost = (sciInput * sciRates.input) + ((sciThink + sciCand) * sciRates.output);
                     sciStats.total += cost;
                     sciStats.count++;
                     sciStats.input += sciInput;
                     sciStats.thinking += sciThink;
                     sciStats.candidate += sciCand;

                     if (cost < sciStats.min) sciStats.min = cost;
                     if (cost > sciStats.max) sciStats.max = cost;
                 }

                 // Miner
                 const minerInput = parseInt(row["Input_Token_The_Miner"] || 0);
                 const minerThink = parseInt(row["Thinking_Token_The_Miner"] || 0);
                 const minerCand = parseInt(row["Candidate_Token_The_Miner"] || 0);

                 if (minerInput + minerThink + minerCand > 0) {
                     const cost = (minerInput * minerRates.input) + ((minerThink + minerCand) * minerRates.output);
                     minerStats.total += cost;
                     minerStats.count++;
                     minerStats.input += minerInput;
                     minerStats.thinking += minerThink;
                     minerStats.candidate += minerCand;

                     if (cost < minerStats.min) minerStats.min = cost;
                     if (cost > minerStats.max) minerStats.max = cost;
                 }

                 // Extended Miner
                 const extInput = parseInt(row["Input_Token_The_Extended_Miner"] || 0);
                 const extThink = parseInt(row["Thinking_Token_The_Extended_Miner"] || 0);
                 const extCand = parseInt(row["Candidate_Token_The_Extended_Miner"] || 0);

                 if (extInput + extThink + extCand > 0) {
                     const cost = (extInput * extRates.input) + ((extThink + extCand) * extRates.output);
                     extStats.total += cost;
                     extStats.count++;
                     extStats.input += extInput;
                     extStats.thinking += extThink;
                     extStats.candidate += extCand;

                     if (cost < extStats.min) extStats.min = cost;
                     if (cost > extStats.max) extStats.max = cost;
                 }
             }
        });

        // Calculate Averages / Reset Min
        const finalizeStats = (stats) => {
            if (stats.count > 0) {
                stats.avg = stats.total / stats.count;
            } else {
                stats.min = 0;
            }
        };

        finalizeStats(gkStats);
        finalizeStats(sciStats);
        finalizeStats(minerStats);
        finalizeStats(extStats);

        // Calculate Grand Total
        const grandTotal = absStats.total + gkStats.total + sciStats.total + minerStats.total + extStats.total;

        return {
            abstract: absStats,
            gatekeeper: gkStats,
            scientist: sciStats,
            miner: minerStats,
            extended_miner: extStats,
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
