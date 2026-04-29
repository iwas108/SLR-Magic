const express = require('express');
const ProxyController = require('../controllers/ProxyController');
const WebApiController = require('../controllers/WebApiController');

const apiRouter = express.Router();
const webApiRouter = express.Router();

// Proxy API Route
apiRouter.post('/v1/chat/completions', ProxyController.proxyToOllama);

// Web API Routes
webApiRouter.get('/api/queue_stats', WebApiController.getQueueStats);
webApiRouter.get('/api/stats', WebApiController.getStats);
webApiRouter.post('/api/stats/properties', WebApiController.setEndpointProperties);

webApiRouter.get('/api/endpoints', WebApiController.getEndpoints);
webApiRouter.get('/api/endpoints/config', WebApiController.getEndpointsConfig);
webApiRouter.post('/api/endpoints/config', WebApiController.upsertEndpointConfig);
webApiRouter.delete('/api/endpoints/config', WebApiController.deleteEndpointConfig);

webApiRouter.get('/api/history', WebApiController.getHistory);
webApiRouter.delete('/api/history/bulk_delete', WebApiController.bulkDeleteHistory);
webApiRouter.delete('/api/history/:item_id', WebApiController.deleteHistoryItem);
webApiRouter.delete('/api/history', WebApiController.clearHistory);

webApiRouter.get('/api/streams/active', WebApiController.getActiveStreams);

webApiRouter.get('/api/config/:key', WebApiController.getConfig);
webApiRouter.post('/api/config/:key', WebApiController.setConfig);

module.exports = {
    apiRouter,
    webApiRouter
};
