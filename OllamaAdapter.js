/**
 * OllamaAdapter.js
 * Adapter to interact with a Ollama server via an OpenAI-compatible API.
 */

const OllamaAdapter = (function() {

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
   * @returns {Object} The JSON object parsed from the response.
   */
  function callOllama(prompt, apiUrl, apiKey, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob, enableGenericThinking) {
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
        console.log(`[OllamaAdapter] Response received in ${duration}ms. Status: ${response.getResponseCode()}`);

        const responseCode = response.getResponseCode();
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
              let cleanedText = contentText;
              
              // 1. Strip out the entire <think> block so JSON.parse doesn't crash
              cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/think>/gi, '');
              
              // 2. Strip markdown code blocks
              cleanedText = cleanedText.replace(/```json/gi, '').replace(/```/g, '').trim();

              // 3. (Optional but Safe) Isolate just the JSON object in case of trailing text
              const jsonStartIndex = cleanedText.indexOf('{');
              const jsonEndIndex = cleanedText.lastIndexOf('}');
              
              if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                  cleanedText = cleanedText.substring(jsonStartIndex, jsonEndIndex + 1);
              }

              const parsedContent = JSON.parse(cleanedText);

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
              throw new Error(`Failed to parse JSON from Ollama response: ${e.message}\nCleaned Text Attempt: ${cleanedText}`);
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

  return {
    callOllama
  };

})();
