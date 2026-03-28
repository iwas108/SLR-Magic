/**
 * VllmAdapter.js
 * Adapter to interact with a vLLM server via an OpenAI-compatible API.
 */

const VllmAdapter = (function() {

  /**
   * Calls the vLLM API with the given prompt and configuration.
   * @param {string} prompt The full prompt to send.
   * @param {string} apiUrl The vLLM server API URL (e.g., http://localhost:8000/v1/chat/completions).
   * @param {string} apiKey The Bearer token (optional).
   * @param {string} model The model name.
   * @param {number} temperature
   * @param {number} maxTokens
   * @param {GoogleAppsScript.Base.Blob} [fileBlob] Optional file blob to include as an image.
   * @returns {Object} The JSON object parsed from the response.
   */
  function callVllm(prompt, apiUrl, apiKey, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob) {
    if (!apiUrl) {
      throw new Error("vLLM API URL is missing in Configuration.");
    }

    if (!model) {
       console.warn("Model was undefined! The vLLM server might require a specific model name.");
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
      messages: messages,
      temperature: parseFloat(temperature) || 0,
      max_tokens: parseInt(maxTokens) || 8192
    };

    // Note: vLLM chat completions typically don't have built-in "thinking" config like Gemini.
    // If specific vLLM configurations for thinking are required, they would go here.

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
        console.log(`[VllmAdapter] Attempt ${attempt + 1}/${MAX_RETRIES + 1}: Sending request to ${model} at ${apiUrl}...`);
        const startTime = new Date().getTime();

        const response = UrlFetchApp.fetch(apiUrl, options);

        const endTime = new Date().getTime();
        const duration = endTime - startTime;
        console.log(`[VllmAdapter] Response received in ${duration}ms. Status: ${response.getResponseCode()}`);

        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (responseCode === 429 || responseCode >= 500) {
           if (attempt < MAX_RETRIES) {
             const delay = (BASE_DELAY_MS * Math.pow(2, attempt)) + (Math.random() * 500);
             const errorType = responseCode === 429 ? "Rate Limit (429)" : `Server Error (${responseCode})`;
             console.warn(`[VllmAdapter] ${errorType} hit. Waiting ${Math.round(delay)}ms before retry...`);

             Utilities.sleep(delay);
             attempt++;
             continue;
           } else {
             throw new Error(`vLLM API Error (${responseCode}): Failed after ${MAX_RETRIES + 1} attempts. Response: ${responseText}`);
           }
        }

        if (responseCode !== 200) {
          throw new Error(`vLLM API Error (${responseCode}): ${responseText}`);
        }

        const jsonResponse = JSON.parse(responseText);
        console.log(`JSON Response from vLLM: ${JSON.stringify(jsonResponse, null, 2)}`);

        if (jsonResponse.choices && jsonResponse.choices.length > 0) {
          const choice = jsonResponse.choices[0];
          const contentText = choice.message?.content;

          if (!contentText) {
            throw new Error(`vLLM response missing message content. Finish Reason: ${choice.finish_reason || "Unknown"}`);
          }

          try {
              const cleanedText = contentText.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsedContent = JSON.parse(cleanedText);

              // Standardize usage metadata mapping to what the rest of the application expects
              const usage = jsonResponse.usage || {};
              const mappedUsage = {
                  promptTokenCount: usage.prompt_tokens || 0,
                  candidatesTokenCount: usage.completion_tokens || 0,
                  totalTokenCount: usage.total_tokens || 0,
                  thoughtsTokenCount: 0 // Typically not separate in vLLM unless specified by a custom extension
              };

              return {
                  content: parsedContent,
                  usageMetadata: mappedUsage
              };
          } catch (e) {
              throw new Error(`Failed to parse JSON from vLLM response: ${contentText}`);
          }
        } else {
          throw new Error("No choices returned from vLLM API.");
        }

      } catch (e) {
        if (e.message.includes("vLLM API Error") || e.message.includes("vLLM response missing")) {
            throw e;
        }

        console.error(`[VllmAdapter] Unexpected error: ${e.message}`);
        if (attempt < MAX_RETRIES) {
            const delay = (BASE_DELAY_MS * Math.pow(2, attempt));
            console.warn(`[VllmAdapter] Retrying after unexpected error in ${Math.round(delay)}ms...`);
            Utilities.sleep(delay);
            attempt++;
        } else {
            throw e;
        }
      }
    }
  }

  return {
    callVllm
  };

})();
