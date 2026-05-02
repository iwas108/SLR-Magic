const { cacheRepo, ollamaService, streamBroadcaster } = require('../di');

async function getQueueStats(req, res) {
    try {
        let activeCount = 0;
        for (const url in ollamaService.endpointStatus) {
            if (ollamaService.endpointStatus[url] === "active") {
                activeCount++;
            }
        }

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

        let pendingInQueue = ollamaService.pendingRequests - activeCount;
        if (pendingInQueue < 0) pendingInQueue = 0;

        return res.json({
            total_endpoints: totalCount,
            active_requests: activeCount,
            pending_requests: ollamaService.pendingRequests,
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
                thinking: null, // Or extract if available
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
