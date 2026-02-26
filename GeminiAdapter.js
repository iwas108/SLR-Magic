/**
 * GeminiAdapter.js
 * Adapter to interact with the Google Gemini API.
 */

const GeminiAdapter = (function() {

  /**
   * Calls the Gemini API with the given prompt and configuration.
   * @param {string} prompt The full prompt to send.
   * @param {string} apiKey The Gemini API Key.
   * @param {string} model The model name (e.g., "gemini-pro").
   * @param {number} temperature
   * @param {number} maxTokens
   * @param {GoogleAppsScript.Base.Blob} [fileBlob] Optional file blob (PDF, image) to include.
   * @returns {Object} The JSON object parsed from the response.
   */
  function callGemini(prompt, apiKey, model, temperature, maxTokens, thinkingLevel, thinkingBudget, fileBlob) {
    // --- FIX 1: Safety Default ---
    // If model is undefined/null, default to Flash-Lite to prevent crash
    if (!model) {
       console.warn("Model was undefined! Defaulting to 'gemini-2.5-flash-lite'");
       model = "gemini-2.5-flash-lite";
    }
    // Ensure it is a string for .indexOf()
    var safeModel = String(model).toLowerCase();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [{
      text: prompt
    }];

    if (fileBlob) {
      const base64Data = Utilities.base64Encode(fileBlob.getBytes());
      const mimeType = fileBlob.getContentType();
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    }

    var myThinkingConfig = {
      includeThoughts: false // Keeps the JSON response clean for both models
    };

    if (thinkingLevel) {
        myThinkingConfig.thinkingLevel = thinkingLevel;
    }

    // Check strict null/undefined/empty string to allow 0 as a valid budget
    if (thinkingBudget !== undefined && thinkingBudget !== null && String(thinkingBudget).trim() !== "") {
        myThinkingConfig.thinkingBudget = parseInt(thinkingBudget);
    }

    const payload = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
        thinkingConfig: myThinkingConfig
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    // Retry Configuration
    const MAX_RETRIES = 0;
    const BASE_DELAY_MS = 2000;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        console.log(`[GeminiAdapter] Attempt ${attempt + 1}/${MAX_RETRIES + 1}: Sending request to ${model}...`);
        const startTime = new Date().getTime();

        const response = UrlFetchApp.fetch(url, options);

        const endTime = new Date().getTime();
        const duration = endTime - startTime;
        console.log(`[GeminiAdapter] Response received in ${duration}ms. Status: ${response.getResponseCode()}`);

        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        // Handle Rate Limit (429) and Server Errors (5xx)
        if (responseCode === 429 || responseCode >= 500) {
           if (attempt < MAX_RETRIES) {
             const delay = (BASE_DELAY_MS * Math.pow(2, attempt)) + (Math.random() * 500); // Exponential backoff + jitter
             const errorType = responseCode === 429 ? "Rate Limit (429)" : `Server Error (${responseCode})`;
             console.warn(`[GeminiAdapter] ${errorType} hit. Waiting ${Math.round(delay)}ms before retry...`);

             Utilities.sleep(delay);
             attempt++;
             continue;
           } else {
             throw new Error(`Gemini API Error (${responseCode}): Failed after ${MAX_RETRIES + 1} attempts. Response: ${responseText}`);
           }
        }

        if (responseCode !== 200) {
          throw new Error(`Gemini API Error (${responseCode}): ${responseText}`);
        }

        const jsonResponse = JSON.parse(responseText);
        // Angka 2 di belakang artinya berikan indentasi 2 spasi
        console.log(`JSON Response from Gemini: ${JSON.stringify(jsonResponse, null, 2)}`);

        // Extract the text content
        if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {
          const candidate = jsonResponse.candidates[0];

          // Check for content existence
          if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
               const reason = candidate.finishReason || "Unknown";
               let msg = `Gemini response missing content/parts. Finish Reason: ${reason}.`;
               if (reason === "MAX_TOKENS") {
                   msg += " Try increasing MAX_TOKENS in Configuration.";
               }
               throw new Error(msg);
          }

          const contentText = candidate.content.parts[0].text;

          // Try to parse the contentText as JSON
          try {
              // Remove any markdown code blocks if present (though responseMimeType should handle it)
              const cleanedText = contentText.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsedContent = JSON.parse(cleanedText);

              return {
                  content: parsedContent,
                  usageMetadata: jsonResponse.usageMetadata || {}
              };
          } catch (e) {
              throw new Error(`Failed to parse JSON from Gemini response: ${contentText}`);
          }
        } else {
          throw new Error("No candidates returned from Gemini API.");
        }

      } catch (e) {
        // If it's a "known" error from above (retries exhausted or non-retriable), rethrow
        if (e.message.includes("Gemini API Error") || e.message.includes("Gemini response missing")) {
            throw e;
        }

        // For unexpected errors (e.g. network timeout exception from UrlFetchApp), retry if quota allows
        console.error(`[GeminiAdapter] Unexpected error: ${e.message}`);
        if (attempt < MAX_RETRIES) {
            const delay = (BASE_DELAY_MS * Math.pow(2, attempt));
            console.warn(`[GeminiAdapter] Retrying after unexpected error in ${Math.round(delay)}ms...`);
            Utilities.sleep(delay);
            attempt++;
        } else {
            throw e;
        }
      }
    }
  }

  return {
    callGemini
  };

})();
