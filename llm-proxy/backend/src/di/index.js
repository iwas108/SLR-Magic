const config = require('../config');
const CacheRepository = require('../repositories/CacheRepository');
const { OllamaService, streamBroadcaster } = require('../services/OllamaService');

// Initialize dependencies
const cacheRepo = new CacheRepository(config.DB_FILE);
const ollamaService = new OllamaService(config.OLLAMA_URLS, config.STREAM_OLLAMA);

// Synchronize endpoint configurations from DB on startup
async function initDependencies() {
    try {
        let dbConfigs = await cacheRepo.getAllEndpointConfigs();

        // Fallback to CLI/ENV URLs if DB is empty, mimicking Python `lifespan`
        if (!dbConfigs || dbConfigs.length === 0) {
            for (const url of config.OLLAMA_URLS) {
                await cacheRepo.upsertEndpointConfig(url, true, "", "");
            }
            dbConfigs = await cacheRepo.getAllEndpointConfigs();
        }

        ollamaService.syncEndpoints(dbConfigs);
        console.log(`[DI] Dependencies initialized and synchronized.`);
    } catch (e) {
        console.error(`[DI] Error initializing dependencies:`, e);
    }
}

// In-flight request management for coalescing (mimicking Python `in_flight_requests`)
const inFlightRequests = {};

module.exports = {
    cacheRepo,
    ollamaService,
    streamBroadcaster,
    initDependencies,
    inFlightRequests
};
