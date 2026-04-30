require('dotenv').config();

const config = {
  PORT: process.env.PORT || 8899,
  OLLAMA_URLS: process.env.OLLAMA_URLS
    ? process.env.OLLAMA_URLS.split(',').map(url => url.trim())
    : ["http://127.0.0.1:11434/api/chat"],
  DB_FILE: process.env.DB_FILE || "slr_cache.db",
  UPDATE_CACHE: process.env.UPDATE_CACHE === 'true'
};

module.exports = config;
