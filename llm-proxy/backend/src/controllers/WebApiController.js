const { cacheRepo, ollamaService, streamBroadcaster } = require('../di');

async function getQueueStats(req, res) {
    try {
        const totalCount = ollamaService.urls.length;
        const labels = await cacheRepo.getEndpointLabels();

        const endpointsData = ollamaService.urls.map(url => {
            const status = ollamaService.endpointStatus[url] || "idle";
            const label = labels[url] || url;
            return {
                url,
                label,
                status
            };
        });

        let pendingInQueue = ollamaService.queuedRequests;

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
        const { id, provider, name, enabled, api_key, model_prefix, thinking_mode, streaming, structured_output, flex_inference, thinking_type, thinking_level, thinking_budget } = req.body;
        const resultId = await cacheRepo.upsertCloudEndpoint(
            id, provider, name, enabled, api_key, model_prefix,
            thinking_mode, streaming, structured_output, flex_inference,
            thinking_type, thinking_level, thinking_budget
        );
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
            for await (const model of response) {
                if (model.name.includes(endpoint.model_prefix) || model.name.replace('models/', '').includes(endpoint.model_prefix)) {
                    models.push({
                        name: model.name.replace('models/', ''),
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

async function getEndpointsConfig(req, res) {
    try {
        const configs = await cacheRepo.getAllEndpointConfigs();
        return res.json(configs);
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function upsertEndpointConfig(req, res) {
    try {
        const { endpoint_url, enabled = true, custom_model = "", api_key = "", extra_config = "", stream_mode = false } = req.body;
        if (!endpoint_url) {
            return res.status(400).json({ error: "endpoint_url is required" });
        }

        await cacheRepo.upsertEndpointConfig(endpoint_url, enabled, custom_model, api_key, extra_config, stream_mode);

        // Sync with service
        const configs = await cacheRepo.getAllEndpointConfigs();
        ollamaService.syncEndpoints(configs);

        return res.json({ status: "success" });
    } catch (e) {
        return res.status(500).json({ error: e.message || String(e) });
    }
}

async function deleteEndpointConfig(req, res) {
    try {
        const { endpoint_url } = req.body;
        if (!endpoint_url) {
            return res.status(400).json({ error: "endpoint_url is required" });
        }

        await cacheRepo.deleteEndpointConfig(endpoint_url);

        // Sync with service
        const configs = await cacheRepo.getAllEndpointConfigs();
        ollamaService.syncEndpoints(configs);

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

module.exports = {

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
    getEndpointsConfig,
    upsertEndpointConfig,
    deleteEndpointConfig,
    getHistory,
    bulkDeleteHistory,
    deleteHistoryItem,
    clearHistory,
    getActiveStreams,
    getConfig,
    setConfig
};
