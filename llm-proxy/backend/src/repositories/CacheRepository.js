const Database = require('better-sqlite3');
const crypto = require('crypto');
const stringify = require('json-stable-stringify');

class CacheRepository {
  constructor(dbFile) {
    this.dbFile = dbFile;
    this.db = new Database(dbFile);
    this._initDb();
  }

  static generateHash(messages) {
    const messageStr = stringify(messages);
    return crypto.createHash('sha256').update(messageStr).digest('hex');
  }

  async get(payloadHash) {
    const stmt = this.db.prepare('SELECT response_json FROM cache WHERE payload_hash = ?');
    const row = stmt.get(payloadHash);
    return row ? JSON.parse(row.response_json) : null;
  }

  async set(payloadHash, responseData) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO cache (payload_hash, response_json) VALUES (?, ?)');
    stmt.run(payloadHash, JSON.stringify(responseData));
  }

  async logHistory(modelName, requestData, responseData, durationMs, endpointUrl = "") {
    const stmt = this.db.prepare(
      'INSERT INTO history (model_name, request_json, response_json, duration_ms, endpoint_url) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(modelName, JSON.stringify(requestData), JSON.stringify(responseData), durationMs, endpointUrl);
  }

  async getEndpoints() {
    const stmt = this.db.prepare('SELECT DISTINCT endpoint_url FROM history WHERE endpoint_url IS NOT NULL');
    const rows = stmt.all();
    return rows.map(row => row.endpoint_url);
  }

  async getEndpointLabels() {
    const stmt = this.db.prepare('SELECT endpoint_url, label FROM endpoint_labels');
    const rows = stmt.all();
    const result = {};
    for (const row of rows) {
      result[row.endpoint_url] = row.label;
    }
    return result;
  }

  async getStats() {
    const stmt = this.db.prepare(`
      SELECT
          h.model_name,
          h.endpoint_url,
          COALESCE(l.label, h.endpoint_url) as endpoint_label,
          l.label as raw_label,
          l.is_gpu,
          l.gpu_model,
          l.cpu_model,
          l.ram_size,
          COUNT(*) as request_count,
          SUM(h.duration_ms) as total_duration_ms,
          AVG(h.duration_ms) as avg_duration_ms,
          MIN(h.duration_ms) as min_duration_ms,
          MAX(h.duration_ms) as max_duration_ms
      FROM history h
      LEFT JOIN endpoint_labels l ON h.endpoint_url = l.endpoint_url
      WHERE h.endpoint_url IS NOT NULL
      GROUP BY h.model_name, h.endpoint_url
      ORDER BY h.model_name ASC, request_count DESC
    `);
    const metrics = stmt.all();

    const totalRequestsStmt = this.db.prepare('SELECT COUNT(*) as count FROM history');
    const totalRequestsRow = totalRequestsStmt.get();
    const totalRequests = totalRequestsRow ? totalRequestsRow.count : 0;

    const cacheHitsStmt = this.db.prepare('SELECT COUNT(*) as count FROM cache');
    const cacheHitsRow = cacheHitsStmt.get();
    const cacheHits = cacheHitsRow ? cacheHitsRow.count : 0;

    return {
      metrics,
      total_requests: totalRequests,
      cache_hits: cacheHits
    };
  }

  async setEndpointProperties(endpointUrl, label, isGpu, gpuModel, cpuModel, ramSize) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO endpoint_labels
      (endpoint_url, label, is_gpu, gpu_model, cpu_model, ram_size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(endpointUrl, label, isGpu ? 1 : 0, gpuModel, cpuModel, ramSize);
  }

  async getAllEndpointConfigs() {
    const stmt = this.db.prepare(`
      SELECT
        c.endpoint_url,
        c.enabled,
        c.custom_model,
        c.api_key,
        c.extra_config,
        c.stream_mode,
        l.label,
        l.gpu_model,
        l.cpu_model,
        l.ram_size
      FROM endpoints_config c
      LEFT JOIN endpoint_labels l ON c.endpoint_url = l.endpoint_url
    `);
    return stmt.all();
  }

  async getCloudEndpoints() {
    const stmt = this.db.prepare('SELECT * FROM cloud_endpoints');
    const rows = stmt.all();
    return rows.map(row => ({
      ...row,
      thinking_mode: !!row.thinking_mode,
      streaming: !!row.streaming,
      structured_output: !!row.structured_output,
      flex_inference: !!row.flex_inference,
      thinking_type: row.thinking_type || 'level',
      thinking_level: row.thinking_level || 'low',
      thinking_budget: row.thinking_budget || 1024,
      models_cache: row.models_cache ? JSON.parse(row.models_cache) : null
    }));
  }

  async upsertCloudEndpoint(id, provider, name, apiKey, modelPrefix, thinkingMode, streaming, structuredOutput, flexInference, thinkingType, thinkingLevel, thinkingBudget) {
    if (!id) {
      id = crypto.randomUUID();
    }
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cloud_endpoints
      (id, provider, name, api_key, model_prefix, thinking_mode, streaming, structured_output, flex_inference, thinking_type, thinking_level, thinking_budget, models_cache)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT models_cache FROM cloud_endpoints WHERE id = ?), '[]'))
    `);
    stmt.run(id, provider, name, apiKey, modelPrefix, thinkingMode ? 1 : 0, streaming ? 1 : 0, structuredOutput ? 1 : 0, flexInference ? 1 : 0, thinkingType || 'level', thinkingLevel || 'low', thinkingBudget || 1024, id);
    return id;
  }

  async deleteCloudEndpoint(id) {
    const stmt = this.db.prepare('DELETE FROM cloud_endpoints WHERE id = ?');
    stmt.run(id);
  }

  async updateCloudModelsCache(id, modelsCache) {
    const stmt = this.db.prepare('UPDATE cloud_endpoints SET models_cache = ? WHERE id = ?');
    stmt.run(JSON.stringify(modelsCache), id);
  }

  async getCloudEndpointById(id) {
    const stmt = this.db.prepare('SELECT * FROM cloud_endpoints WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return {
      ...row,
      thinking_mode: !!row.thinking_mode,
      streaming: !!row.streaming,
      structured_output: !!row.structured_output,
      flex_inference: !!row.flex_inference,
      thinking_type: row.thinking_type || 'level',
      thinking_level: row.thinking_level || 'low',
      thinking_budget: row.thinking_budget || 1024,
      models_cache: row.models_cache ? JSON.parse(row.models_cache) : null
    };
  }

  async upsertEndpointConfig(endpointUrl, enabled, customModel, apiKey = "", extraConfig = "", streamMode = false) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO endpoints_config
      (endpoint_url, enabled, custom_model, api_key, extra_config, stream_mode)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(endpointUrl, enabled ? 1 : 0, customModel, apiKey, extraConfig, streamMode ? 1 : 0);
  }

  async deleteEndpointConfig(endpointUrl) {
    const stmt = this.db.prepare('DELETE FROM endpoints_config WHERE endpoint_url = ?');
    stmt.run(endpointUrl);
  }

  async getHistory(search = null, endpoint = null, page = 1, limit = 50, sortBy = "id", sortDesc = true, timeStart = null, timeEnd = null) {
    const offset = (page - 1) * limit;

    const validSortColumns = new Set(["id", "model_name", "endpoint_url", "created_at", "duration_ms"]);
    if (!validSortColumns.has(sortBy)) {
      sortBy = "id";
    }

    const sortOrder = sortDesc ? "DESC" : "ASC";

    let countQuery = "SELECT COUNT(*) as count FROM history h";
    let selectQuery = "SELECT h.*, l.is_gpu, l.gpu_model, l.cpu_model, l.ram_size FROM history h LEFT JOIN endpoint_labels l ON h.endpoint_url = l.endpoint_url";

    const params = [];
    const conditions = [];

    if (search) {
      conditions.push("(h.model_name LIKE ? OR h.request_json LIKE ? OR h.response_json LIKE ?)");
      const likeTerm = `%${search}%`;
      params.push(likeTerm, likeTerm, likeTerm);
    }

    if (endpoint) {
      conditions.push("h.endpoint_url = ?");
      params.push(endpoint);
    }

    if (timeStart) {
      conditions.push("h.created_at >= ?");
      params.push(timeStart);
    }

    if (timeEnd) {
      conditions.push("h.created_at <= ?");
      params.push(timeEnd);
    }

    if (conditions.length > 0) {
      const whereClause = " WHERE " + conditions.join(" AND ");
      countQuery += whereClause;
      selectQuery += whereClause;
    }

    const countStmt = this.db.prepare(countQuery);
    const totalRow = countStmt.get(...params);
    const total = totalRow.count;

    selectQuery += ` ORDER BY h.${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    const selectParams = [...params, limit, offset];

    const selectStmt = this.db.prepare(selectQuery);
    const data = selectStmt.all(...selectParams);

    return {
      data,
      total,
      page,
      limit
    };
  }

  async deleteHistoryItem(itemId) {
    const getStmt = this.db.prepare("SELECT request_json FROM history WHERE id = ?");
    const row = getStmt.get(itemId);

    if (row) {
      const requestData = JSON.parse(row.request_json);
      const messages = requestData.messages || [];
      const payloadHash = CacheRepository.generateHash(messages);

      const deleteCacheStmt = this.db.prepare("DELETE FROM cache WHERE payload_hash = ?");
      deleteCacheStmt.run(payloadHash);
    }

    const deleteHistoryStmt = this.db.prepare("DELETE FROM history WHERE id = ?");
    deleteHistoryStmt.run(itemId);
  }

  async deleteHistoryItems(itemIds) {
    if (!itemIds || itemIds.length === 0) return;

    const placeholders = itemIds.map(() => '?').join(',');
    const getStmt = this.db.prepare(`SELECT request_json FROM history WHERE id IN (${placeholders})`);
    const rows = getStmt.all(...itemIds);

    const deleteCacheStmt = this.db.prepare("DELETE FROM cache WHERE payload_hash = ?");
    const deleteCacheTransaction = this.db.transaction((hashes) => {
      for (const hash of hashes) {
        deleteCacheStmt.run(hash);
      }
    });

    const hashesToDelete = [];
    for (const row of rows) {
      if (row) {
        const requestData = JSON.parse(row.request_json);
        const messages = requestData.messages || [];
        const payloadHash = CacheRepository.generateHash(messages);
        hashesToDelete.push(payloadHash);
      }
    }

    deleteCacheTransaction(hashesToDelete);

    const deleteHistoryStmt = this.db.prepare(`DELETE FROM history WHERE id IN (${placeholders})`);
    deleteHistoryStmt.run(...itemIds);
  }

  async clearHistory() {
    this.db.exec("DELETE FROM history");
    this.db.exec("DELETE FROM sqlite_sequence WHERE name='history'");
    this.db.exec("DELETE FROM cache");
  }

  async getConfig(key) {
    const stmt = this.db.prepare("SELECT value FROM general_config WHERE key = ?");
    const row = stmt.get(key);
    return row ? row.value : null;
  }

  async setConfig(key, value) {
    const stmt = this.db.prepare("INSERT OR REPLACE INTO general_config (key, value) VALUES (?, ?)");
    stmt.run(key, value);
  }

  _initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        payload_hash TEXT PRIMARY KEY,
        response_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT,
        request_json TEXT,
        response_json TEXT,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure endpoint_url column exists in history
    const historyCols = this.db.pragma('table_info(history)');
    if (!historyCols.find(col => col.name === 'endpoint_url')) {
      this.db.exec('ALTER TABLE history ADD COLUMN endpoint_url TEXT');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS endpoint_labels (
        endpoint_url TEXT PRIMARY KEY,
        label TEXT
      )
    `);

    // Ensure new columns exist in endpoint_labels
    const labelsCols = this.db.pragma('table_info(endpoint_labels)');
    if (!labelsCols.find(col => col.name === 'is_gpu')) {
      this.db.exec('ALTER TABLE endpoint_labels ADD COLUMN is_gpu BOOLEAN DEFAULT 0');
    }
    if (!labelsCols.find(col => col.name === 'gpu_model')) {
      this.db.exec("ALTER TABLE endpoint_labels ADD COLUMN gpu_model TEXT DEFAULT ''");
    }
    if (!labelsCols.find(col => col.name === 'cpu_model')) {
      this.db.exec("ALTER TABLE endpoint_labels ADD COLUMN cpu_model TEXT DEFAULT ''");
    }
    if (!labelsCols.find(col => col.name === 'ram_size')) {
      this.db.exec("ALTER TABLE endpoint_labels ADD COLUMN ram_size TEXT DEFAULT ''");
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cloud_endpoints (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        api_key TEXT,
        model_prefix TEXT NOT NULL,
        thinking_mode BOOLEAN DEFAULT 0,
        streaming BOOLEAN DEFAULT 0,
        structured_output BOOLEAN DEFAULT 0,
        flex_inference BOOLEAN DEFAULT 0,
        models_cache TEXT,
        thinking_type TEXT DEFAULT 'level',
        thinking_level TEXT DEFAULT 'low',
        thinking_budget INTEGER DEFAULT 1024
      )
    `);

    // Ensure thinking columns exist in cloud_endpoints for backwards compatibility
    const cloudEndpointsCols = this.db.pragma('table_info(cloud_endpoints)');
    if (!cloudEndpointsCols.find(col => col.name === 'thinking_type')) {
      this.db.exec("ALTER TABLE cloud_endpoints ADD COLUMN thinking_type TEXT DEFAULT 'level'");
    }
    if (!cloudEndpointsCols.find(col => col.name === 'thinking_level')) {
      this.db.exec("ALTER TABLE cloud_endpoints ADD COLUMN thinking_level TEXT DEFAULT 'low'");
    }
    if (!cloudEndpointsCols.find(col => col.name === 'thinking_budget')) {
      this.db.exec('ALTER TABLE cloud_endpoints ADD COLUMN thinking_budget INTEGER DEFAULT 1024');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS endpoints_config (
        endpoint_url TEXT PRIMARY KEY,
        enabled BOOLEAN DEFAULT 1,
        custom_model TEXT,
        api_key TEXT,
        extra_config TEXT
      )
    `);

    // Ensure api_key, extra_config, and stream_mode columns exist in endpoints_config
    const endpointsConfigCols = this.db.pragma('table_info(endpoints_config)');
    if (!endpointsConfigCols.find(col => col.name === 'api_key')) {
      this.db.exec('ALTER TABLE endpoints_config ADD COLUMN api_key TEXT');
    }
    if (!endpointsConfigCols.find(col => col.name === 'extra_config')) {
      this.db.exec('ALTER TABLE endpoints_config ADD COLUMN extra_config TEXT');
    }
    if (!endpointsConfigCols.find(col => col.name === 'stream_mode')) {
      this.db.exec('ALTER TABLE endpoints_config ADD COLUMN stream_mode BOOLEAN DEFAULT 0');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS general_config (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS research_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta_prompt_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  // Meta Prompting
  async getResearchContexts() {
    return this.db.prepare('SELECT * FROM research_contexts ORDER BY id ASC').all();
  }

  async createResearchContext(name, content) {
    const stmt = this.db.prepare('INSERT INTO research_contexts (name, content) VALUES (?, ?)');
    const info = stmt.run(name, content);
    return info.lastInsertRowid;
  }

  async updateResearchContext(id, name, content) {
    const stmt = this.db.prepare('UPDATE research_contexts SET name = ?, content = ? WHERE id = ?');
    stmt.run(name, content, id);
  }

  async deleteResearchContext(id) {
    const stmt = this.db.prepare('DELETE FROM research_contexts WHERE id = ?');
    stmt.run(id);
  }

  async getMetaPromptTemplates() {
    return this.db.prepare('SELECT * FROM meta_prompt_templates ORDER BY id ASC').all();
  }

  async createMetaPromptTemplate(name, content) {
    const stmt = this.db.prepare('INSERT INTO meta_prompt_templates (name, content) VALUES (?, ?)');
    const info = stmt.run(name, content);
    return info.lastInsertRowid;
  }

  async updateMetaPromptTemplate(id, name, content) {
    const stmt = this.db.prepare('UPDATE meta_prompt_templates SET name = ?, content = ? WHERE id = ?');
    stmt.run(name, content, id);
  }

  async deleteMetaPromptTemplate(id) {
    const stmt = this.db.prepare('DELETE FROM meta_prompt_templates WHERE id = ?');
    stmt.run(id);
  }

}
module.exports = CacheRepository;
