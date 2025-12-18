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
   * @returns {Object} The JSON object parsed from the response.
   */
  function callGemini(prompt, apiKey, model, temperature, maxTokens) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json"
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

      // Extract the text content
      if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {
        const contentText = jsonResponse.candidates[0].content.parts[0].text;

        // Try to parse the contentText as JSON
        try {
            // Remove any markdown code blocks if present (though responseMimeType should handle it)
            const cleanedText = contentText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
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
