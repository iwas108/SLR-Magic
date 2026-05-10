const logger = require("../utils/logger");
const { cacheRepo, ollamaService, cloudService, routingService, inFlightRequests } = require('../di');
const { extractJsonFromMixedText } = require('../utils/parsers');

async function proxyToOllama(req, res) {
    let payload;
    try {
        payload = req.body;
    } catch (e) {
        return res.status(400).json({ error: "Invalid JSON payload" });
    }

    const messages = payload.messages || [];
    if (!messages || messages.length === 0) {
        return res.status(400).json({ error: "No messages found in payload" });
    }

    // `CacheRepository.generateHash` must be used from DI/repo instance.
    // In our implementation `generateHash` is a static method of CacheRepository.
    const CacheRepository = require('../repositories/CacheRepository');
    const reqHash = CacheRepository.generateHash(messages);
    const shortHash = reqHash.substring(0, 8);

    logger.info(`📥 Received request [${shortHash}] for model: ${payload.model || 'unknown'}`);

    const startTime = Date.now();

    // UPDATE_CACHE logic from general_config
    const updateCacheStr = await cacheRepo.getConfig('UPDATE_CACHE');
    const updateCache = updateCacheStr === 'true';

    if (!updateCache) {
        const cachedResponse = await cacheRepo.get(reqHash);
        if (cachedResponse) {
            const durationMs = Date.now() - startTime;
            const modelName = cachedResponse.model || "unknown";

            const endpointUrl = cachedResponse.endpoint_url || "cache";
            delete cachedResponse.endpoint_url;
            logger.info(`⚡ Cache Hit [${shortHash}] - Fulfilled instantly`);

            // Intercept cached response to repair previously saved bad JSON
            const expectsJson = (payload.response_format && payload.response_format.type === "json_object") ||
                messages.some(msg => msg.content && msg.content.toLowerCase().includes("json"));

            if (expectsJson) {
                const choices = cachedResponse.choices || [{}];
                let content = choices[0].message ? (choices[0].message.content || "") : "";
                const extracted = extractJsonFromMixedText(content);

                if (extracted && extracted !== content) {
                    try {
                        const parsed = JSON.parse(extracted);
                        if (typeof parsed === 'object' && parsed !== null) {
                            cachedResponse.choices[0].message.content = extracted;
                            const cachedResponseCopy = { ...cachedResponse };
                            cachedResponseCopy.endpoint_url = endpointUrl;
                            await cacheRepo.set(reqHash, cachedResponseCopy);
                            logger.info(`🔧 Repaired previously malformed JSON from cache for [${shortHash}]`);
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }

            return res.json(cachedResponse);
        }
    }

    // Coalescing in-flight requests
    if (inFlightRequests[reqHash]) {
        logger.info(`⏳ Coalescing [${shortHash}] - Waiting for an identical in-flight request...`);
        try {
            await new Promise((resolve) => {
                inFlightRequests[reqHash].push(resolve);
            });
        } catch (e) {
            logger.error(`Error waiting for in-flight request: ${e}`);
        }

        const cachedResponse = await cacheRepo.get(reqHash);
        if (cachedResponse) {
            const durationMs = Date.now() - startTime;
            const modelName = cachedResponse.model || "unknown";

            const endpointUrl = cachedResponse.endpoint_url || "cache";
            delete cachedResponse.endpoint_url;
            logger.info(`⚡ Cache Hit [${shortHash}] - Fulfilled after waiting ${durationMs}ms`);

            // Intercept cached response to repair previously saved bad JSON
            const expectsJson = (payload.response_format && payload.response_format.type === "json_object") ||
                messages.some(msg => msg.content && msg.content.toLowerCase().includes("json"));

            if (expectsJson) {
                const choices = cachedResponse.choices || [{}];
                let content = choices[0].message ? (choices[0].message.content || "") : "";
                const extracted = extractJsonFromMixedText(content);

                if (extracted && extracted !== content) {
                    try {
                        const parsed = JSON.parse(extracted);
                        if (typeof parsed === 'object' && parsed !== null) {
                            cachedResponse.choices[0].message.content = extracted;
                            const cachedResponseCopy = { ...cachedResponse };
                            cachedResponseCopy.endpoint_url = endpointUrl;
                            await cacheRepo.set(reqHash, cachedResponseCopy);
                            logger.info(`🔧 Repaired previously malformed JSON from coalesced cache for [${shortHash}]`);
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }

            return res.json(cachedResponse);
        } else {
            console.warn(`⚠️ Coalescing [${shortHash}] - Woke up but cache was empty. This shouldn't happen.`);
        }
    }

    // First request, register it in inFlightRequests
    inFlightRequests[reqHash] = [];

    try {
        let expectsJson = false;
        if (payload.response_format && payload.response_format.type === "json_object") {
            expectsJson = true;
        } else {
            for (const msg of messages) {
                if (msg.content && msg.content.toLowerCase().includes("json")) {
                    expectsJson = true;
                    break;
                }
            }
        }

        const routeResult = await routingService.routeRequest(payload, reqHash, expectsJson);
        const { responseData, modelName, endpointUrl, durationMs } = routeResult;

        await cacheRepo.set(reqHash, responseData);
        await cacheRepo.logHistory(modelName, payload, responseData, durationMs, endpointUrl);

        logger.info(`✅ Completed [${shortHash}] - Duration: ${durationMs}ms, Endpoint: ${endpointUrl}`);
        return res.json(responseData);

    } catch (e) {
        logger.error(`❌ Internal Server Error [${shortHash}]: ${e.message || e}`);
        if (e.message && e.message.includes('fetch')) {
            return res.status(502).json({ error: `Ollama connection error: ${e.message}` });
        }
        return res.status(500).json({ error: e.message || String(e) });
    } finally {
        // Resolve all waiting requests
        if (inFlightRequests[reqHash]) {
            for (const resolve of inFlightRequests[reqHash]) {
                resolve();
            }
            delete inFlightRequests[reqHash];
        }
    }
}

async function proxyTags(req, res) {
    try {
        const uniqueModelsMap = new Map();

        // Fetch models from all configured URLs
        const activeUrls = ollamaService.urls || [];
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

        const fetchPromises = activeUrls.map(async (endpointUrl) => {
            try {
                let baseUrl = endpointUrl;
                if (baseUrl.endsWith('/v1/chat/completions')) {
                    baseUrl = baseUrl.replace('/v1/chat/completions', '');
                } else if (baseUrl.endsWith('/v1/completions')) {
                    baseUrl = baseUrl.replace('/v1/completions', '');
                } else if (baseUrl.endsWith('/api/chat')) {
                    baseUrl = baseUrl.replace('/api/chat', '');
                } else if (baseUrl.endsWith('/api/generate')) {
                    baseUrl = baseUrl.replace('/api/generate', '');
                }
                if (baseUrl.endsWith('/')) {
                    baseUrl = baseUrl.slice(0, -1);
                }

                const tagsUrl = `${baseUrl}/api/tags`;
                const response = await fetch(tagsUrl, { timeout: 5000 });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.models && Array.isArray(data.models)) {
                        data.models.forEach(model => {
                            if (model && model.name && !uniqueModelsMap.has(model.name)) {
                                uniqueModelsMap.set(model.name, model);
                            }
                        });
                    }
                }
            } catch (err) {
                logger.error(`Failed to fetch tags from ${endpointUrl}: ${err.message}`);
            }
        });

        await Promise.allSettled(fetchPromises);

        // Inject cloud models
        const cloudEndpoints = await cacheRepo.getCloudEndpoints();
        for (const ce of cloudEndpoints) {
            const modelsCache = typeof ce.models_list_cache === 'string'
                ? JSON.parse(ce.models_list_cache || '[]')
                : (ce.models_list_cache || []);

            if (Array.isArray(modelsCache)) {
                for (const model of modelsCache) {
                    let parsedModel = typeof model === 'string' ? { name: model } : model;
                    if (parsedModel && parsedModel.name && !uniqueModelsMap.has(parsedModel.name)) {
                        uniqueModelsMap.set(parsedModel.name, parsedModel);
                    }
                }
            }
        }

        const models = Array.from(uniqueModelsMap.values());
        return res.json({ models });
    } catch (e) {
        logger.error(`❌ Internal Server Error [proxyTags]: ${e.message || e}`);
        return res.status(500).json({ error: e.message || String(e) });
    }
}

module.exports = {
    proxyToOllama,
    proxyTags
};
