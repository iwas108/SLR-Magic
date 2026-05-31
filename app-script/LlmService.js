/**
 * LlmService.js
 * A unified interface for interacting with LLM providers (Ollama only).
 * Routes API calls to the Ollama adapter.
 */

const LlmService = (function() {

  /**
   * Helper to retrieve endpoint and key from ConfigManager (Document Properties).
   */
  function getProxyCredentials() {
    const config = ConfigManager.getAll();
    const endpoint = config["LLM_PROXY_URL"] || config["PROXY_API_ENDPOINT"] || "";
    const apiKey = config["API_KEY"] || config["PROXY_API_KEY"] || "";
    return { endpoint, apiKey };
  }

  /**
   * Sends parallel prompts directly to the LLM Proxy, omitting client-side parameters.
   * @param {Array<Object>} promptsData Array of { prompt, fileBlob }
   * @param {string} model Model name
   */
  function fetchFromProxy(promptsData, model) {
    const { endpoint, apiKey } = getProxyCredentials();
    if (!endpoint) {
      throw new Error("LLM Proxy URL (LLM_PROXY_URL) is missing in Configuration.");
    }
    return OllamaAdapter.callOllamaParallel(
      promptsData, 
      endpoint, 
      apiKey, 
      model, 
      undefined, // temperature
      undefined, // maxTokens
      undefined, // thinkingLevel
      undefined, // thinkingBudget
      undefined, // enableGenericThinking
      undefined, // keepAlive
      undefined  // numCtx
    );
  }

  /**
   * Routes the LLM call directly to Ollama.
   * @param {string} prompt The full prompt to send.
   * @param {string} model The model name.
   * @param {number} temperature
   * @param {number} maxTokens
   * @param {string} [thinkingLevel] Unused, kept for signature compatibility.
   * @param {number} [thinkingBudget] Unused, kept for signature compatibility.
   * @param {GoogleAppsScript.Base.Blob} [fileBlob] Optional file blob.
   * @returns {Object} The JSON object parsed from the response along with usageMetadata.
   */
  function callLlm(prompt, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob) {
    const { endpoint, apiKey } = getProxyCredentials();
    const config = ConfigManager.getAll();
    const enableGenericThinking = config["ENABLE_GENERIC_THINKING"] === "TRUE";
    const rawKeepAlive = config["OLLAMA_KEEP_ALIVE"];
    const keepAlive = (rawKeepAlive !== undefined && rawKeepAlive !== "") ? rawKeepAlive : "0";

    const rawNumCtx = config["OLLAMA_NUM_CTX"];
    const numCtx = (rawNumCtx !== undefined && rawNumCtx !== "") ? parseInt(rawNumCtx) : 4096;

    if (!endpoint) {
      throw new Error("LLM Proxy URL (LLM_PROXY_URL) is missing in Configuration.");
    }
    return OllamaAdapter.callOllama(prompt, endpoint, apiKey, model, temperature, maxTokens, undefined, undefined, fileBlob, enableGenericThinking, keepAlive, numCtx);
  }

  /**
   * Routes the parallel LLM call to the Ollama adapter.
   * @param {Array<Object>} promptsData Array of { prompt, fileBlob }
   * @returns {Array<Object>} Array of results { content, usageMetadata }
   */
  function callLlmParallel(promptsData, model, temperature, maxTokens, thinkingLevel, thinkingBudget) {
    const { endpoint, apiKey } = getProxyCredentials();
    const config = ConfigManager.getAll();
    const enableGenericThinking = config["ENABLE_GENERIC_THINKING"] === "TRUE";
    const rawKeepAlive = config["OLLAMA_KEEP_ALIVE"];
    const keepAlive = (rawKeepAlive !== undefined && rawKeepAlive !== "") ? rawKeepAlive : "0";
    const rawNumCtx = config["OLLAMA_NUM_CTX"];
    const numCtx = (rawNumCtx !== undefined && rawNumCtx !== "") ? parseInt(rawNumCtx) : 4096;

    if (!endpoint) {
      throw new Error("LLM Proxy URL (LLM_PROXY_URL) is missing in Configuration.");
    }
    return OllamaAdapter.callOllamaParallel(promptsData, endpoint, apiKey, model, temperature, maxTokens, undefined, undefined, enableGenericThinking, keepAlive, numCtx);
  }

  return {
    callLlm,
    callLlmParallel,
    fetchFromProxy
  };

})();
