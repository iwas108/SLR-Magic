const fs = require('fs');

let content = fs.readFileSync('llm-proxy/backend/src/services/OllamaService.js', 'utf8');

// The file still has Gemini logic inside fetchCompletion. Let's fix that.

// Remove `const isGeminiOrGemma...`
content = content.replace(/const isGeminiOrGemma = .*?;\n/g, '');

// Clean up modelName selection in dequeue loop
content = content.replace(
`                let modelName;
                if (isGeminiOrGemma) {
                    modelName = baseModel;
                } else {
                    modelName = this.customModels[endpointUrl] || baseModel;
                }`,
`                let modelName = this.customModels[endpointUrl] || baseModel;`
);

// Clean up Gemini model checking skip
content = content.replace(
`                if (isGeminiOrGemma) {
                    // Skip model checking for Gemini
                    break;
                } else {
                    // Check if model is available on this endpoint`,
`                // Check if model is available on this endpoint`
);

// Clean up closing brace of that else block
// It's after `break;`
// We need to carefully remove `}`
content = content.replace(
`                    } else {
                        // Found it or couldn't verify (assume it might have it)
                        break;
                    }
                }`,
`                    } else {
                        // Found it or couldn't verify (assume it might have it)
                        break;
                    }`
);

// Clean up modelName re-assignment
content = content.replace(
`        let modelName;
        if (isGeminiOrGemma) {
            modelName = baseModel;
        } else {
            modelName = this.customModels[endpointUrl] || baseModel;
        }`,
`        let modelName = this.customModels[endpointUrl] || baseModel;`
);

// Clean up Gemini logging
content = content.replace(
`        if (modelName.toLowerCase().startsWith("gemini") || modelName.toLowerCase().startsWith("gemma")) {
            logger.info(\`🚀 Dispatching request [\${shortHash}] to endpoint: Gemini API (Model: \${modelName})\`);
        } else {
            logger.info(\`🚀 Dispatching request [\${shortHash}] to endpoint: \${endpointUrl} (Model: \${modelName})\`);
        }`,
`        logger.info(\`🚀 Dispatching request [\${shortHash}] to endpoint: \${endpointUrl} (Model: \${modelName})\`);`
);

// Clean up Gemini request dispatching
content = content.replace(
`            if (modelName.toLowerCase().startsWith("gemini") || modelName.toLowerCase().startsWith("gemma")) {
                let apiKey = this.apiKeys[endpointUrl] || "";
                if (!apiKey) {
                    for (const key of Object.values(this.apiKeys)) {
                        if (key) {
                            apiKey = key;
                            break;
                        }
                    }
                }

                let forceStream = false;
                const extraConfigStr = this.extraConfigs[endpointUrl] || "";
                if (extraConfigStr) {
                    try {
                        const extraConf = JSON.parse(extraConfigStr);
                        forceStream = extraConf.streamMode || false;
                    } catch (e) {}
                }

                if (openaiPayload.stream || forceStream) {
                    result = await this._fetchViaStreamGemini(openaiPayload, modelName, endpointUrl, reqHash, apiKey);
                } else {
                    result = await this._fetchGemini(openaiPayload, modelName, endpointUrl, reqHash, apiKey);
                }
            } else if (this.streamModes[endpointUrl]) {`,
`            if (this.streamModes[endpointUrl]) {`
);

fs.writeFileSync('llm-proxy/backend/src/services/OllamaService.js', content);
