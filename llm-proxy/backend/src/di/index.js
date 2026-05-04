const logger = require("../utils/logger");
const config = require('../config');
const CacheRepository = require('../repositories/CacheRepository');
const { OllamaService, streamBroadcaster } = require('../services/OllamaService');
const CloudService = require('../services/CloudService');

// Initialize dependencies
const cacheRepo = new CacheRepository(config.DB_FILE);
const ollamaService = new OllamaService(config.OLLAMA_URLS);
const cloudService = new CloudService(cacheRepo, streamBroadcaster);

// Synchronize endpoint configurations from DB on startup
async function initDependencies() {
    try {
        let dbConfigs = await cacheRepo.getLocalEndpoints();

        // Fallback to CLI/ENV URLs if DB is empty, mimicking Python `lifespan`
        if (!dbConfigs || dbConfigs.length === 0) {
            for (const url of config.OLLAMA_URLS) {
                await cacheRepo.upsertLocalEndpoint(null, "ollama", url, true, false);
            }
            dbConfigs = await cacheRepo.getLocalEndpoints();
        }

        ollamaService.syncEndpoints(dbConfigs);

        // Seed initial UPDATE_CACHE from config if it doesn't exist
        const currentUpdateCache = await cacheRepo.getConfig('UPDATE_CACHE');
        if (currentUpdateCache === null || currentUpdateCache === undefined) {
            await cacheRepo.setConfig('UPDATE_CACHE', config.UPDATE_CACHE ? 'true' : 'false');
        }

        logger.info(`[DI] Dependencies initialized and synchronized.`);
    } catch (e) {
        logger.error(`[DI] Error initializing dependencies:`, e);
    }
}

// In-flight request management for coalescing (mimicking Python `in_flight_requests`)
const inFlightRequests = {};

module.exports = {
    cacheRepo,
    ollamaService,
    cloudService,
    streamBroadcaster,
    initDependencies,
    inFlightRequests
};
