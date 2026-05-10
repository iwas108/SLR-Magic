const { cacheRepo, ollamaService, streamBroadcaster } = require('../di');

async function getQueueStats(req, res) {
    try {
        const totalCount = ollamaService.urls.length;
        const labels = await cacheRepo.getEndpointLabels();

        const endpointsData = ollamaService.urls.map(url => {
            const status = ollamaService.endpointStatus[url] || "idle";
            const activeConns = ollamaService.activeConnections ? (ollamaService.activeConnections[url] || 0) : 0;
            const label = labels[url] || url;
            return {
                url,
                label,
                status: activeConns > 0 ? "active" : "idle",
                active_connections: activeConns
            };
        });

        let pendingInQueue = ollamaService.queuedRequests || 0;

        return res.json({
            total_endpoints: totalCount,
            active_requests: ollamaService.activeRequests,
            pending_requests: pendingInQueue + ollamaService.activeRequests,
            pending_in_queue: pendingInQueue,
            total_processed: ollamaService.totalProcessed,
            max_concurrent_requests: ollamaService.maxConcurrentRequests,
            endpoints: endpointsData
        });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function getStats(req, res) {
    try {
        const stats = await cacheRepo.getStats();
        return res.json(stats);
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function setEndpointProperties(req, res) {
    try {
        const { endpoint_url, label = "", is_gpu = false, gpu_model = "", cpu_model = "", ram_size = "" } = req.body;
        if (!endpoint_url) {
            return res.status(400).json({ error: "endpoint_url is required" });
        }
        await cacheRepo.setEndpointProperties(endpoint_url, label, is_gpu, gpu_model, cpu_model, ram_size);
        return res.json({ status: "success" });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function getEndpoints(req, res) {
    try {
        const endpoints = await cacheRepo.getEndpoints();
        return res.json(endpoints);
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function getCloudEndpoints(req, res) {
    try {
        const configs = await cacheRepo.getCloudEndpoints();
        return res.json(configs);
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function upsertCloudEndpoint(req, res) {
    try {
        const { id, name, provider, model_prefix, api_key, enabled, streaming, models_cache, models } = req.body;
        const resultId = await cacheRepo.upsertCloudEndpoint(
            id, name, provider, model_prefix, api_key, enabled, streaming, models_cache
        );

        if (models && Array.isArray(models)) {
            // Delete all current models and re-insert to keep in sync
            await cacheRepo.deleteCloudModelsByEndpointId(resultId);
            for (let model of models) {
                await cacheRepo.upsertCloudModel(model.id, resultId, model.name, model.default_config);
            }
        }

        return res.json({ status: "success", id: resultId });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function deleteCloudEndpoint(req, res) {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: "id is required" });
        await cacheRepo.deleteCloudEndpoint(id);
        return res.json({ status: "success" });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function syncCloudModels(req, res) {
    try {
        console.log("syncCloudModels req.body:", req.body);
        const id = req.body.id;
        if (!id) return res.status(400).json({ error: "id is required. Received body: " + JSON.stringify(req.body) });

        const endpoint = await cacheRepo.getCloudEndpointById(id);
        if (!endpoint) return res.status(404).json({ error: "Endpoint not found" });

        if (endpoint.provider === 'google' || endpoint.provider === 'gemini') {
            const { GoogleGenAI } = require('@google/genai');
            const ai = new GoogleGenAI({ apiKey: endpoint.api_key });
            const response = await ai.models.list();

            const models = [];
            const prefixes = endpoint.model_prefix.split(',').map(p => p.trim()).filter(p => p);

            for await (const model of response) {
                const modelName = model.name.replace('models/', '');
                const matchesPrefix = prefixes.some(prefix => modelName.includes(prefix));

                if (matchesPrefix || prefixes.length === 0) {
                    models.push({
                        name: modelName,
                        modified_at: new Date().toISOString(),
                        size: 0,
                        digest: model.name,
                        details: {
                            format: 'cloud',
                            family: 'gemini',
                            parameter_size: 'unknown',
                            quantization_level: 'none'
                        }
                    });
                }
            }

            await cacheRepo.updateCloudModelsCache(id, models);
            return res.json({ status: "success", models });
        } else {
            return res.status(400).json({ error: `Provider ${endpoint.provider} not supported for model sync` });
        }
    } catch (e) {
        console.error("Error in syncCloudModels:", e);
        return res.status(e.status || 500).json({ error: e.message || String(e) });
    }
}


async function getLocalEndpoints(req, res) {
    try {
        const configs = await cacheRepo.getLocalEndpoints();
        return res.json(configs);
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function upsertLocalEndpoint(req, res) {
    try {
        const {
            id,
            provider,
            endpoint_url,
            is_enabled,
            is_streaming,
            models_list_cache,
            models,
            cpu_model,
            gpu_model,
            ram_size,
            running_environment
        } = req.body;

        if (!endpoint_url) {
            return res.status(400).json({ error: "endpoint_url is required" });
        }

        const resultId = await cacheRepo.upsertLocalEndpoint(
            id,
            provider,
            endpoint_url,
            is_enabled,
            is_streaming,
            models_list_cache,
            cpu_model || '',
            gpu_model || '',
            ram_size || '',
            running_environment || '',
            models
        );

        if (models && Array.isArray(models)) {
            // Delete all current models and re-insert to keep in sync
            const currentEndpoint = await cacheRepo.getLocalEndpointById(resultId);
            if (currentEndpoint && currentEndpoint.models) {
                 for (let m of currentEndpoint.models) {
                     await cacheRepo.deleteLocalModel(m.id);
                 }
            }
            for (let model of models) {
                await cacheRepo.upsertLocalModel(model.id, resultId, model.name, model.default_config);
            }
        }

        // Ensure OllamaService is synced with latest endpoints to avoid routing errors
        const updatedEndpoints = await cacheRepo.getLocalEndpoints();
        ollamaService.syncEndpoints(updatedEndpoints);

        return res.json({ status: "success", id: resultId });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function deleteLocalEndpoint(req, res) {
    try {
        const id = req.query.id;
        if (!id) return res.status(400).json({ error: "id is required" });
        await cacheRepo.deleteLocalEndpoint(id);

        // Ensure OllamaService is synced with latest endpoints
        const updatedEndpoints = await cacheRepo.getLocalEndpoints();
        ollamaService.syncEndpoints(updatedEndpoints);

        return res.json({ status: "success" });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function getHistory(req, res) {
    try {
        const { search = null, endpoint = null, page = 1, limit = 50, sort_by = "id", sort_desc = "true", time_start = null, time_end = null } = req.query;
        const isDesc = String(sort_desc).toLowerCase() === "true";
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;

        let sortByFixed = sort_by;
        if (sort_by === 'timestamp') {
            sortByFixed = 'created_at';
        } else if (sort_by === 'model') {
            sortByFixed = 'model_name';
        }

        const result = await cacheRepo.getHistory(search, endpoint, pageNum, limitNum, sortByFixed, isDesc, time_start, time_end);

        // Format history to match frontend expectations
        const formattedHistory = result.data.map(item => {
            let prompt = "";
            let response = "";
            let prompt_tokens = 0;
            let completion_tokens = 0;

            try {
                const reqJson = JSON.parse(item.request_json);
                const resJson = JSON.parse(item.response_json);

                if (reqJson.messages && reqJson.messages.length > 0) {
                    // Usually the last user message or a concatenation
                    prompt = reqJson.messages[reqJson.messages.length - 1].content;
                } else if (reqJson.prompt) {
                    prompt = reqJson.prompt;
                }

                if (resJson.choices && resJson.choices.length > 0) {
                    response = resJson.choices[0].message?.content || "";
                } else if (resJson.response) {
                    response = resJson.response;
                }

                if (resJson.usage) {
                    prompt_tokens = resJson.usage.prompt_tokens || 0;
                    completion_tokens = resJson.usage.completion_tokens || 0;
                }
            } catch (e) {
                // ignore parsing errors
            }

            let thinking = null;
            const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/);
            if (thinkMatch) {
                thinking = thinkMatch[1].trim();
                response = response.replace(/<think>[\s\S]*?<\/think>/, '').trim();
            } else {
                const logicMatch = response.match(/### LOGIC TRACE([\s\S]*?)(?:### FINAL DECISION|$)/);
                if (logicMatch) {
                    thinking = logicMatch[1].trim();
                    response = response.replace(/### LOGIC TRACE[\s\S]*?(?:### FINAL DECISION|$)/, '').trim();
                }
            }

            return {
                id: item.id,
                timestamp: item.created_at,
                model: item.model_name,
                endpoint: item.endpoint_url,
                prompt: prompt,
                response: response,
                prompt_tokens: prompt_tokens,
                completion_tokens: completion_tokens,
                total_duration: item.duration_ms,
                is_cached: false, // Could infer if needed
                thinking: thinking,
                hardware: {
                    gpu_model: item.gpu_model || null,
                    cpu_model: item.cpu_model || null,
                    ram_size: item.ram_size || null
                }
            };
        });

        return res.json({
            history: formattedHistory,
            total: result.total,
            page: result.page,
            limit: result.limit
        });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function bulkDeleteHistory(req, res) {
    try {
        const { ids = [] } = req.body;
        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: "No IDs provided" });
        }
        await cacheRepo.deleteHistoryItems(ids);
        return res.json({ status: "success", message: `Deleted ${ids.length} items` });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function deleteHistoryItem(req, res) {
    try {
        const itemId = parseInt(req.params.item_id);
        if (isNaN(itemId)) {
             return res.status(400).json({ error: "Invalid item ID" });
        }
        await cacheRepo.deleteHistoryItem(itemId);
        return res.json({ status: "success", message: `Deleted item ${itemId}` });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function clearHistory(req, res) {
    try {
        await cacheRepo.clearHistory();
        return res.json({ status: "success", message: "All history cleared" });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function getActiveStreams(req, res) {
    try {
        return res.json(streamBroadcaster.activeStreams);
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function getConfig(req, res) {
    try {
        const { key } = req.params;
        const val = await cacheRepo.getConfig(key);
        return res.json({ value: val !== null && val !== undefined ? val : "" });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function setConfig(req, res) {
    try {
        const { key } = req.params;
        const { value = "" } = req.body;
        await cacheRepo.setConfig(key, value);
        return res.json({ status: "ok" });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}


// Meta Prompting Controllers
async function getResearchContexts(req, res) {
    try {
        const data = await cacheRepo.getResearchContexts();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createResearchContext(req, res) {
    try {
        const { name, content } = req.body;
        const id = await cacheRepo.createResearchContext(name, content);
        res.json({ id, name, content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function updateResearchContext(req, res) {
    try {
        const { id } = req.params;
        const { name, content } = req.body;
        await cacheRepo.updateResearchContext(id, name, content);
        res.json({ id, name, content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function deleteResearchContext(req, res) {
    try {
        const { id } = req.params;
        await cacheRepo.deleteResearchContext(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getMetaPromptTemplates(req, res) {
    try {
        const data = await cacheRepo.getMetaPromptTemplates();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createMetaPromptTemplate(req, res) {
    try {
        const { name, content } = req.body;
        const id = await cacheRepo.createMetaPromptTemplate(name, content);
        res.json({ id, name, content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function updateMetaPromptTemplate(req, res) {
    try {
        const { id } = req.params;
        const { name, content } = req.body;
        await cacheRepo.updateMetaPromptTemplate(id, name, content);
        res.json({ id, name, content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function deleteMetaPromptTemplate(req, res) {
    try {
        const { id } = req.params;
        await cacheRepo.deleteMetaPromptTemplate(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}


async function fetchLocalModels(req, res) {
    try {
        const { endpoint_url } = req.body;
        if (!endpoint_url) return res.status(400).json({ error: "endpoint_url is required" });

        let baseUrl = endpoint_url;
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

        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const response = await fetch(tagsUrl, { timeout: 10000 });
        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch models: ${response.statusText}` });
        }
        const data = await response.json();
        return res.json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function syncLocalModels(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: "id is required" });

        const endpoint = await cacheRepo.getLocalEndpointById(id);
        if (!endpoint) return res.status(404).json({ error: "Endpoint not found" });

        let baseUrl = endpoint.endpoint_url;
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

        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const response = await fetch(tagsUrl, { timeout: 10000 });
        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch models: ${response.statusText}` });
        }
        const data = await response.json();
        const crypto = require('crypto');
        const rawModels = data.models || [];
        const models = rawModels.map(m => ({
            id: crypto.randomUUID(),
            name: m.name,
            modified_at: m.modified_at,
            size: m.size,
            digest: m.digest,
            details: {
                format: m.details?.format || 'unknown',
                family: m.details?.family || 'unknown',
                parameter_size: m.details?.parameter_size || 'unknown',
                quantization_level: m.details?.quantization_level || 'unknown'
            }
        }));

        await cacheRepo.updateLocalModelsCache(id, models);

        return res.json({ status: "success", models });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

module.exports = {
    fetchLocalModels,
    syncLocalModels,

    getResearchContexts,
    createResearchContext,
    updateResearchContext,
    deleteResearchContext,
    getMetaPromptTemplates,
    createMetaPromptTemplate,
    updateMetaPromptTemplate,
    deleteMetaPromptTemplate,

    getQueueStats,
    getStats,
    setEndpointProperties,
    getEndpoints,
    getCloudEndpoints,
    upsertCloudEndpoint,
    deleteCloudEndpoint,
    syncCloudModels,
    getLocalEndpoints,
    upsertLocalEndpoint,
    deleteLocalEndpoint,
    getHistory,
    bulkDeleteHistory,
    deleteHistoryItem,
    clearHistory,
    getActiveStreams,
    getConfig,
    setConfig
};
