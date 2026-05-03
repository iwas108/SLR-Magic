const express = require('express');
const ProxyController = require('../controllers/ProxyController');
const WebApiController = require('../controllers/WebApiController');

const apiRouter = express.Router();
const webApiRouter = express.Router();

// Proxy API Route
apiRouter.post('/v1/chat/completions', ProxyController.proxyToOllama);
apiRouter.get('/api/tags', ProxyController.proxyTags);

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


// Meta Prompting Routes
webApiRouter.get('/api/research_contexts', WebApiController.getResearchContexts);
webApiRouter.post('/api/research_contexts', WebApiController.createResearchContext);
webApiRouter.put('/api/research_contexts/:id', WebApiController.updateResearchContext);
webApiRouter.delete('/api/research_contexts/:id', WebApiController.deleteResearchContext);

webApiRouter.get('/api/meta_prompt_templates', WebApiController.getMetaPromptTemplates);
webApiRouter.post('/api/meta_prompt_templates', WebApiController.createMetaPromptTemplate);
webApiRouter.put('/api/meta_prompt_templates/:id', WebApiController.updateMetaPromptTemplate);
webApiRouter.delete('/api/meta_prompt_templates/:id', WebApiController.deleteMetaPromptTemplate);

module.exports = {
    apiRouter,
    webApiRouter
};
