/**
 * OllamaAdapter.js
 * Adapter to interact with a Ollama server via an OpenAI-compatible API.
 */

const OllamaAdapter = (function() {

  function extractAndParseJSON(text) {
    let originalText = text;
    // 1. Remove <think> blocks
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 2. Try to extract from markdown code blocks
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = text.match(jsonBlockRegex);
    if (match) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            // Ignore and fall through to manual extraction
        }
    }

    // 3. Fallback to finding outermost {} or []
    const firstCurly = text.indexOf('{');
    const lastCurly = text.lastIndexOf('}');
    const firstSquare = text.indexOf('[');
    const lastSquare = text.lastIndexOf(']');

    let startIndex = -1;
    let endIndex = -1;

    if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
        startIndex = firstCurly;
        endIndex = lastCurly;
    } else if (firstSquare !== -1) {
        startIndex = firstSquare;
        endIndex = lastSquare;
    }

    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        const extracted = text.substring(startIndex, endIndex + 1);
        try {
            return JSON.parse(extracted);
        } catch (e) {
            // Try to fix common JSON errors (like trailing commas) or let it throw
            try {
                // Very basic repair: remove trailing commas before } or ]
                const repaired = extracted.replace(/,\s*([}\]])/g, '$1');
                return JSON.parse(repaired);
            } catch (e2) {
                throw new Error("Extracted string is not valid JSON.");
            }
        }
    }

    // 4. If all else fails, try parsing the original text
    return JSON.parse(originalText);
  }

  /**
   * Calls the Ollama API with the given prompt and configuration.
   * @param {string} prompt The full prompt to send.
   * @param {string} apiUrl The Ollama server API URL (e.g., http://localhost:8000/v1/chat/completions).
   * @param {string} apiKey The Bearer token (optional).
   * @param {string} model The model name.
   * @param {number} temperature
   * @param {number} maxTokens
   * @param {GoogleAppsScript.Base.Blob} [fileBlob] Optional file blob to include as an image.
   * @param {boolean} [enableGenericThinking] Optional flag to enable generic thinking.
   * @param {string} [keepAlive] Optional keep alive duration.
   * @param {number} [numCtx] Optional context window size.
   * @returns {Object} The JSON object parsed from the response.
   */
  function callOllama(prompt, apiUrl, apiKey, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob, enableGenericThinking, keepAlive, numCtx) {
    if (!apiUrl) {
      throw new Error("Ollama API URL is missing in Configuration.");
    }

    if (!model) {
       console.warn("Model was undefined! The Ollama server might require a specific model name.");
    }

    let messages = [];

    if (fileBlob) {
      // Encode fileBlob as an image URL for vision models
      const base64Data = Utilities.base64Encode(fileBlob.getBytes());
      const mimeType = fileBlob.getContentType();
      const imageUrl = `data:${mimeType};base64,${base64Data}`;

      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: prompt
      });
    }

    const payload = {
      model: model,
      messages: messages
    };

    // Centralize standard OpenAI-like options
    payload.temperature = parseFloat(temperature) !== undefined && !isNaN(parseFloat(temperature)) ? parseFloat(temperature) : 0.6;
    payload.max_tokens = parseInt(maxTokens) || 8192;

    // Send advanced options mapped to the new middleman feature
    payload.options = {};
    if (enableGenericThinking) {
      payload.options.think = true;
    }
    if (keepAlive !== undefined) {
      payload.keep_alive = keepAlive;
    }
    if (numCtx !== undefined) {
      payload.options.num_ctx = numCtx;
    }

    // Additional parameters like context size could also be set here dynamically
    // based on user configurations (e.g., payload.options.num_ctx = ...)

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    if (apiKey && apiKey.trim() !== "") {
      options.headers = {
        "Authorization": `Bearer ${apiKey.trim()}`
      };
    }

    // Logging parameters
    console.log(`[OllamaAdapter] Request Params -> Endpoint: ${apiUrl}, Model: ${model}, num_ctx: ${payload.options?.num_ctx || 'default'}, max_tokens: ${payload.max_tokens}, temperature: ${payload.temperature}`);

    // Retry Configuration
    const MAX_RETRIES = 0;
    const BASE_DELAY_MS = 2000;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        console.log(`[OllamaAdapter] Attempt ${attempt + 1}/${MAX_RETRIES + 1}: Sending request to ${model} at ${apiUrl}...`);
        const startTime = new Date().getTime();

        const response = UrlFetchApp.fetch(apiUrl, options);

        const endTime = new Date().getTime();
        const duration = endTime - startTime;
        const responseCode = response.getResponseCode();
        console.log(`[OllamaAdapter] Response received in ${duration}ms. Status: ${responseCode}`);

        const responseText = response.getContentText();

        if (responseCode === 429 || responseCode >= 500) {
           if (attempt < MAX_RETRIES) {
             const delay = (BASE_DELAY_MS * Math.pow(2, attempt)) + (Math.random() * 500);
             const errorType = responseCode === 429 ? "Rate Limit (429)" : `Server Error (${responseCode})`;
             console.warn(`[OllamaAdapter] ${errorType} hit. Waiting ${Math.round(delay)}ms before retry...`);

             Utilities.sleep(delay);
             attempt++;
             continue;
           } else {
             throw new Error(`Ollama API Error (${responseCode}): Failed after ${MAX_RETRIES + 1} attempts. Response: ${responseText}`);
           }
        }

        if (responseCode !== 200) {
          throw new Error(`Ollama API Error (${responseCode}): ${responseText}`);
        }

        const jsonResponse = JSON.parse(responseText);
        console.log(`JSON Response from Ollama: ${JSON.stringify(jsonResponse, null, 2)}`);

        if (jsonResponse.choices && jsonResponse.choices.length > 0) {
          const choice = jsonResponse.choices[0];
          const contentText = choice.message?.content;

          if (!contentText) {
            throw new Error(`Ollama response missing message content. Finish Reason: ${choice.finish_reason || "Unknown"}`);
          }

          try {
              const parsedContent = extractAndParseJSON(contentText);

              // Standardize usage metadata mapping
              const usage = jsonResponse.usage || {};
              const mappedUsage = {
                  promptTokenCount: usage.prompt_tokens || 0,
                  candidatesTokenCount: usage.completion_tokens || 0,
                  totalTokenCount: usage.total_tokens || 0,
                  thoughtsTokenCount: 0 
              };

              return {
                  content: parsedContent,
                  usageMetadata: mappedUsage
              };
          } catch (e) {
              throw new Error(`Failed to parse JSON from Ollama response: ${e.message}\nContent Attempted: ${contentText}`);
          }
        } else {
          throw new Error("No choices returned from Ollama API.");
        }

      } catch (e) {
        if (e.message.includes("Ollama API Error") || e.message.includes("Ollama response missing")) {
            throw e;
        }

        console.error(`[OllamaAdapter] Unexpected error: ${e.message}`);
        if (attempt < MAX_RETRIES) {
            const delay = (BASE_DELAY_MS * Math.pow(2, attempt));
            console.warn(`[OllamaAdapter] Retrying after unexpected error in ${Math.round(delay)}ms...`);
            Utilities.sleep(delay);
            attempt++;
        } else {
            throw e;
        }
      }
    }
  }

  /**
   * Calls the Ollama API with multiple prompts in parallel.
   * @param {Array<Object>} promptsData Array of { prompt, fileBlob }
   * @returns {Array<Object>} Array of results { content, usageMetadata }
   */
  function callOllamaParallel(promptsData, apiUrl, apiKey, model, temperature, maxTokens, thinkingLevel, thinkingBudget, enableGenericThinking, keepAlive, numCtx) {
    if (!apiUrl) throw new Error("Ollama API URL is missing in Configuration.");
    if (!promptsData || promptsData.length === 0) return [];
    if (!model) console.warn("Model was undefined! The Ollama server might require a specific model name.");

    const requests = promptsData.map((data, idx) => {
      const { prompt, fileBlob } = data;
      let messages = [];

      if (fileBlob) {
        const base64Data = Utilities.base64Encode(fileBlob.getBytes());
        const mimeType = fileBlob.getContentType();
        const imageUrl = `data:${mimeType};base64,${base64Data}`;
        messages.push({
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        });
      } else {
        messages.push({
          role: "user",
          content: prompt
        });
      }

      const payload = { model: model, messages: messages };
      payload.temperature = parseFloat(temperature) !== undefined && !isNaN(parseFloat(temperature)) ? parseFloat(temperature) : 0.6;
      payload.max_tokens = parseInt(maxTokens) || 8192;
      payload.options = {};

      if (enableGenericThinking) payload.options.think = true;
      if (keepAlive !== undefined) payload.keep_alive = keepAlive;
      if (numCtx !== undefined) payload.options.num_ctx = numCtx;

      console.log(`[OllamaAdapter] Request ${idx} Params -> Endpoint: ${apiUrl}, Model: ${model}, num_ctx: ${payload.options?.num_ctx || 'default'}, max_tokens: ${payload.max_tokens}, temperature: ${payload.temperature}`);

      const options = {
        url: apiUrl,
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      if (apiKey && apiKey.trim() !== "") {
        options.headers = { "Authorization": `Bearer ${apiKey.trim()}` };
      }

      return options;
    });

    console.log(`[OllamaAdapter] Sending ${requests.length} parallel requests...`);
    const startTime = new Date().getTime();

    // Attempt parallel fetch (retries could be implemented per request, but UrlFetchApp.fetchAll fails or succeeds as a batch)
    // For simplicity, we assume robust proxy or let it throw
    const responses = UrlFetchApp.fetchAll(requests);

    const endTime = new Date().getTime();
    console.log(`[OllamaAdapter] Received ${responses.length} parallel responses in ${endTime - startTime}ms.`);

    return responses.map((response, idx) => {
      try {
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();
        console.log(`[OllamaAdapter] Response ${idx} Status: ${responseCode}`);
        console.log(`[OllamaAdapter] Response ${idx} Content: ${responseText.substring(0, 200)}...`);

        if (responseCode !== 200) {
           return { error: true, message: `Ollama API Error (${responseCode}) on request ${idx}: ${responseText}` };
        }

        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.choices && jsonResponse.choices.length > 0) {
          const choice = jsonResponse.choices[0];
          const contentText = choice.message?.content;

          if (!contentText) {
            return { error: true, message: `Ollama response missing message content on request ${idx}.` };
          }

          try {
              const parsedContent = extractAndParseJSON(contentText);
              const usage = jsonResponse.usage || {};
              const mappedUsage = {
                  promptTokenCount: usage.prompt_tokens || 0,
                  candidatesTokenCount: usage.completion_tokens || 0,
                  totalTokenCount: usage.total_tokens || 0,
                  thoughtsTokenCount: 0
              };

              return {
                  content: parsedContent,
                  usageMetadata: mappedUsage
              };
          } catch (e) {
              return { error: true, message: `Failed to parse JSON from Ollama response on request ${idx}: ${e.message}` };
          }
        } else {
          return { error: true, message: `No choices returned from Ollama API on request ${idx}.` };
        }
      } catch (e) {
        return { error: true, message: `Unexpected error processing request ${idx}: ${e.message}` };
      }
    });
  }

  return {
    callOllama,
    callOllamaParallel
  };

})();
