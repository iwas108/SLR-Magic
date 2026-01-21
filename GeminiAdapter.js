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
  function callGemini(prompt, apiKey, model, temperature, maxTokens, fileBlob) {
    // --- FIX 1: Safety Default ---
    // If model is undefined/null, default to Flash-Lite to prevent crash
    if (!model) {
       console.warn("Model was undefined! Defaulting to 'gemini-2.0-flash-lite'");
       model = "gemini-2.0-flash-lite";
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

    // 3. Dynamic Logic
    if (safeModel.indexOf("gemini-3") !== -1 && safeModel.indexOf("flash") !== -1) {
      // Gemini 3 Flash uses 'thinkingLevel'.
      myThinkingConfig.thinkingLevel = "medium";

    } else if (safeModel.indexOf("flash") !== -1) {
      // Flash models (2.5+) use 'thinkingBudget'. 0 = Disabled.
      myThinkingConfig.thinkingBudget = 0; 
      
    } else if (safeModel.indexOf("gemini-3") !== -1 && safeModel.indexOf("pro") !== -1) {
      // Gemini 3 Pro uses 'thinkingLevel'.
      myThinkingConfig.thinkingLevel = "LOW";

    } else if (safeModel.indexOf("gemini-2.5") !== -1 && safeModel.indexOf("pro") !== -1) {
      // Gemini 2.5 Pro uses 'thinkingBudget' (Min 128).
      myThinkingConfig.thinkingBudget = 128; 
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

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode !== 200) {
        throw new Error(`Gemini API Error (${responseCode}): ${responseText}`);
      }

      const jsonResponse = JSON.parse(responseText);

      // Log the full response for debugging
      // console.log("Gemini Response:", JSON.stringify(jsonResponse));

      // Extract the text content
      if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {
        const candidate = jsonResponse.candidates[0];

        // Check for content existence
        if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
             const reason = candidate.finishReason || "Unknown";
             let msg = `Gemini response missing content/parts. Finish Reason: ${reason}.`;
             if (reason === "MAX_TOKENS") {
                 msg += " Try increasing MAX_TOKENS in 00_manifest.";
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
      console.error(e);
      throw e;
    }
  }

  return {
    callGemini
  };

})();
