const logger = require("../utils/logger");

class RoutingService {
    constructor(cacheRepo, cloudService, ollamaService) {
        this.cacheRepo = cacheRepo;
        this.cloudService = cloudService;
        this.ollamaService = ollamaService;
    }

    async routeRequest(payload, reqHash, expectsJson) {
        const requestedModel = payload.model || "";
        const maxRetries = expectsJson ? 3 : 1;

        let matchingCloudEndpoint = await this._findCloudEndpoint(requestedModel);

        let responseData = null;
        let endpointUrl = "unknown";
        let modelName = "unknown";
        let durationMs = 0;
        let isValidJson = false;

        const startTime = Date.now();

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (matchingCloudEndpoint) {
                logger.info(`☁️ Routing [${reqHash.substring(0, 8)}] to Cloud Endpoint (${matchingCloudEndpoint.provider}): ${matchingCloudEndpoint.name}`);
                responseData = await this.cloudService.fetchCompletion(matchingCloudEndpoint, payload, reqHash);
            } else {
                // Determine best local endpoint using Least Connections
                const bestLocalUrl = await this.ollamaService.getBestLocalEndpoint(requestedModel);

                if (!bestLocalUrl) {
                    throw new Error(`None of the available endpoints have the requested model: ${requestedModel}`);
                }

                logger.info(`🖥️ Routing [${reqHash.substring(0, 8)}] to Local Endpoint: ${bestLocalUrl}`);
                responseData = await this.ollamaService.fetchCompletion(payload, reqHash, bestLocalUrl);
            }

            modelName = responseData.model || "unknown";
            endpointUrl = responseData.endpoint_url || "unknown";
            delete responseData.endpoint_url;

            durationMs = responseData.endpoint_duration_ms !== undefined ? responseData.endpoint_duration_ms : (Date.now() - startTime);
            delete responseData.endpoint_duration_ms;

            if (expectsJson) {
                const { extractJsonFromMixedText } = require('../utils/parsers');
                const choices = responseData.choices || [{}];
                let content = choices[0].message ? (choices[0].message.content || "") : "";

                const extracted = extractJsonFromMixedText(content);
                isValidJson = false;

                if (extracted) {
                    try {
                        const parsed = JSON.parse(extracted);
                        if (typeof parsed === 'object' && parsed !== null) {
                            isValidJson = true;
                        }
                    } catch (e) {
                        // pass
                    }
                }

                if (isValidJson) {
                    break;
                } else {
                    logger.warn(`⚠️ Invalid JSON detected for [${reqHash.substring(0, 8)}] on attempt ${attempt + 1}/${maxRetries}. Retrying...`);
                    if (attempt === maxRetries - 1) {
                        throw new Error("LLM failed to produce valid JSON after retries.");
                    }
                }
            } else {
                break;
            }
        }

        return {
            responseData,
            modelName,
            endpointUrl,
            durationMs
        };
    }

    async _findCloudEndpoint(requestedModel) {
        const cloudEndpoints = await this.cacheRepo.getCloudEndpoints();
        for (const ce of cloudEndpoints) {
            if (ce.model_prefix) {
                const prefixes = ce.model_prefix.split(',').map(p => p.trim());
                for (const prefix of prefixes) {
                    if (requestedModel.startsWith(prefix)) {
                        return ce;
                    }
                }
            }
        }
        return null;
    }
}

module.exports = RoutingService;
