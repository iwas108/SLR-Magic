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

        return res.json({
            total_endpoints: totalCount,
            active_requests: activeCount,
            pending_requests: ollamaService.pendingRequests,
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
        const { search = null, endpoint = null, page = 1, limit = 50, sort_by = "id", sort_desc = "true" } = req.query;
        const isDesc = String(sort_desc).toLowerCase() === "true";
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;

        const history = await cacheRepo.getHistory(search, endpoint, pageNum, limitNum, sort_by, isDesc);
        return res.json(history);
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

module.exports = {
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
