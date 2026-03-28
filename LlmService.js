/**
 * LlmService.js
 * A unified interface for interacting with LLM providers (Gemini, vLLM).
 * Routes API calls to the appropriate adapter based on configuration.
 */

const LlmService = (function() {

  /**
   * Routes the LLM call to the appropriate adapter based on ConfigManager.
   * @param {string} prompt The full prompt to send.
   * @param {string} model The model name.
   * @param {number} temperature
   * @param {number} maxTokens
   * @param {string} thinkingLevel
   * @param {number} thinkingBudget
   * @param {GoogleAppsScript.Base.Blob} [fileBlob] Optional file blob.
   * @returns {Object} The JSON object parsed from the response along with usageMetadata.
   */
  function callLlm(prompt, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob) {
    const config = ConfigManager.getAll();
    const provider = config["LLM_API_PROVIDER"] || "Gemini";
    const apiKey = config["API_KEY"];

    if (provider === "Gemini") {
      if (!apiKey) {
        throw new Error("API_KEY is missing in Configuration for Gemini.");
      }
      return GeminiAdapter.callGemini(prompt, apiKey, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob);
    } else if (provider === "vLLM") {
      const apiUrl = config["VLLM_API_URL"];
      if (!apiUrl) {
        throw new Error("VLLM_API_URL is missing in Configuration for vLLM.");
      }
      return VllmAdapter.callVllm(prompt, apiUrl, apiKey, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob);
    } else {
      throw new Error(`Unsupported LLM_API_PROVIDER: ${provider}`);
    }
  }

  return {
    callLlm
  };

})();
