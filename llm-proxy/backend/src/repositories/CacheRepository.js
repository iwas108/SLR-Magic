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
    const stmt = this.db.prepare('SELECT endpoint_url, provider as label FROM local_endpoints');
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
          COALESCE(e.id, h.endpoint_url) as endpoint_label,
          e.id as raw_label,
          CASE WHEN e.gpu_model IS NOT NULL AND e.gpu_model != '' THEN 1 ELSE 0 END as is_gpu,
          e.gpu_model,
          e.cpu_model,
          e.ram_size,
          COUNT(*) as request_count,
          SUM(h.duration_ms) as total_duration_ms,
          AVG(h.duration_ms) as avg_duration_ms,
          MIN(h.duration_ms) as min_duration_ms,
          MAX(h.duration_ms) as max_duration_ms
      FROM history h
      LEFT JOIN local_endpoints e ON h.endpoint_url = e.endpoint_url
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





  async getHistory(search = null, endpoint = null, page = 1, limit = 50, sortBy = "id", sortDesc = true, timeStart = null, timeEnd = null) {
    const offset = (page - 1) * limit;

    const validSortColumns = new Set(["id", "model_name", "endpoint_url", "created_at", "duration_ms"]);
    if (!validSortColumns.has(sortBy)) {
      sortBy = "id";
    }

    const sortOrder = sortDesc ? "DESC" : "ASC";

    let countQuery = "SELECT COUNT(*) as count FROM history h";
    let selectQuery = "SELECT h.*, CASE WHEN e.gpu_model IS NOT NULL AND e.gpu_model != '' THEN 1 ELSE 0 END as is_gpu, e.gpu_model, e.cpu_model, e.ram_size FROM history h LEFT JOIN local_endpoints e ON h.endpoint_url = e.endpoint_url";

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

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cloud_endpoints (
        id TEXT PRIMARY KEY,
        name TEXT,
        provider TEXT,
        model_prefix TEXT,
        api_key TEXT,
        is_enabled BOOLEAN DEFAULT 1,
        is_streaming BOOLEAN DEFAULT 0,
        models_list_cache TEXT DEFAULT '[]'
      )
    `);

    const cloudEndpointsCount = this.db.prepare('SELECT COUNT(*) as count FROM cloud_endpoints').get();
    if (cloudEndpointsCount && cloudEndpointsCount.count === 0) {
      this.db.prepare(`
        INSERT INTO cloud_endpoints (id, name, provider, model_prefix, api_key, is_enabled, is_streaming, models_list_cache)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), 'Google Gemini API', 'gemini', 'gemini,gemma', '', 0, 0, '[]');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cloud_models (
        id TEXT PRIMARY KEY,
        cloud_endpoint_id TEXT,
        name TEXT,
        default_config TEXT,
        FOREIGN KEY(cloud_endpoint_id) REFERENCES cloud_endpoints(id) ON DELETE CASCADE
      )
    `);

    this.db.exec(`
      DROP TABLE IF EXISTS endpoint_labels;
      DROP TABLE IF EXISTS endpoints_config;
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_endpoints (
        id TEXT PRIMARY KEY,
        provider TEXT,
        endpoint_url TEXT,
        is_enabled BOOLEAN DEFAULT 1,
        is_streaming BOOLEAN DEFAULT 0,
        models_list_cache TEXT DEFAULT '[]',
        cpu_model TEXT,
        gpu_model TEXT,
        ram_size TEXT,
        running_environment TEXT
      )
    `);

    // Ensure new columns exist in local_endpoints for existing databases
    const localEndpointsCols = this.db.pragma('table_info(local_endpoints)');
    if (!localEndpointsCols.find(col => col.name === 'models_list_cache')) {
      this.db.exec('ALTER TABLE local_endpoints ADD COLUMN models_list_cache TEXT DEFAULT \'[]\'');
    }
    if (!localEndpointsCols.find(col => col.name === 'cpu_model')) {
      this.db.exec('ALTER TABLE local_endpoints ADD COLUMN cpu_model TEXT');
      this.db.exec('ALTER TABLE local_endpoints ADD COLUMN gpu_model TEXT');
      this.db.exec('ALTER TABLE local_endpoints ADD COLUMN ram_size TEXT');
      this.db.exec('ALTER TABLE local_endpoints ADD COLUMN running_environment TEXT');
    }

    const localModelsCols = this.db.pragma('table_info(local_models)');
    if (localModelsCols.length > 0 && localModelsCols.find(col => col.name === 'cpu_model')) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS local_models_new (
          id TEXT PRIMARY KEY,
          local_endpoint_id TEXT,
          name TEXT,
          default_config TEXT,
          FOREIGN KEY(local_endpoint_id) REFERENCES local_endpoints(id) ON DELETE CASCADE
        )
      `);
      this.db.exec(`
        INSERT INTO local_models_new (id, local_endpoint_id, name, default_config)
        SELECT id, local_endpoint_id, name, default_config FROM local_models
      `);
      this.db.exec(`DROP TABLE local_models`);
      this.db.exec(`ALTER TABLE local_models_new RENAME TO local_models`);
    } else {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS local_models (
          id TEXT PRIMARY KEY,
          local_endpoint_id TEXT,
          name TEXT,
          default_config TEXT,
          FOREIGN KEY(local_endpoint_id) REFERENCES local_endpoints(id) ON DELETE CASCADE
        )
      `);
    }
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

// Appending missing endpoints

CacheRepository.prototype.getCloudEndpoints = async function() {
    const stmt = this.db.prepare(`
      SELECT
        e.id, e.name as endpoint_name, e.provider, e.model_prefix, e.api_key, e.is_enabled, e.is_streaming, e.models_list_cache,
        m.id as model_id, m.name as model_name, m.default_config
      FROM cloud_endpoints e
      LEFT JOIN cloud_models m ON e.id = m.cloud_endpoint_id
    `);
    const rows = stmt.all();

    const endpointsMap = new Map();
    for (const row of rows) {
      if (!endpointsMap.has(row.id)) {
        endpointsMap.set(row.id, {
          id: row.id,
          name: row.endpoint_name,
          provider: row.provider,
          model_prefix: row.model_prefix,
          api_key: row.api_key,
          is_enabled: !!row.is_enabled,
          is_streaming: !!row.is_streaming,
          models_list_cache: row.models_list_cache ? JSON.parse(row.models_list_cache) : [],
          models: []
        });
      }

      if (row.model_id) {
        endpointsMap.get(row.id).models.push({
          id: row.model_id,
          name: row.model_name,
          default_config: row.default_config
        });
      }
    }

    return Array.from(endpointsMap.values());
  };

CacheRepository.prototype.getCloudEndpointById = async function(id) {
    const stmt = this.db.prepare('SELECT * FROM cloud_endpoints WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;

    const modelsStmt = this.db.prepare('SELECT * FROM cloud_models WHERE cloud_endpoint_id = ?');
    const models = modelsStmt.all(id);

    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      model_prefix: row.model_prefix,
      api_key: row.api_key,
      is_enabled: !!row.is_enabled,
      is_streaming: !!row.is_streaming,
      models_list_cache: row.models_list_cache ? JSON.parse(row.models_list_cache) : [],
      models: models
    };
  };

CacheRepository.prototype.upsertCloudEndpoint = async function(id, name, provider, modelPrefix, apiKey, isEnabled, isStreaming, modelsListCache) {
    if (!id) {
      id = crypto.randomUUID();
    }
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cloud_endpoints
      (id, name, provider, model_prefix, api_key, is_enabled, is_streaming, models_list_cache)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let cacheToSave = modelsListCache;
    if (cacheToSave === undefined) {
      const existing = this.db.prepare('SELECT models_list_cache FROM cloud_endpoints WHERE id = ?').get(id);
      cacheToSave = existing && existing.models_list_cache ? existing.models_list_cache : '[]';
    } else if (typeof cacheToSave !== 'string') {
      cacheToSave = JSON.stringify(cacheToSave);
    }

    stmt.run(id, name, provider, modelPrefix, apiKey, isEnabled ? 1 : 0, isStreaming ? 1 : 0, cacheToSave);
    return id;
  };

CacheRepository.prototype.upsertCloudModel = async function(id, cloudEndpointId, name, defaultConfig) {
    if (!id) {
      id = crypto.randomUUID();
    }
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cloud_models
      (id, cloud_endpoint_id, name, default_config)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, cloudEndpointId, name, defaultConfig);
    return id;
  };

CacheRepository.prototype.deleteCloudEndpoint = async function(id) {
    const stmt = this.db.prepare('DELETE FROM cloud_endpoints WHERE id = ?');
    stmt.run(id);
  };

CacheRepository.prototype.deleteCloudModel = async function(id) {
    const stmt = this.db.prepare('DELETE FROM cloud_models WHERE id = ?');
    stmt.run(id);
  };

CacheRepository.prototype.deleteCloudModelsByEndpointId = async function(cloudEndpointId) {
    const stmt = this.db.prepare('DELETE FROM cloud_models WHERE cloud_endpoint_id = ?');
    stmt.run(cloudEndpointId);
  };

CacheRepository.prototype.updateCloudModelsCache = async function(id, modelsListCache) {
    const stmt = this.db.prepare('UPDATE cloud_endpoints SET models_list_cache = ? WHERE id = ?');
    stmt.run(typeof modelsListCache === 'string' ? modelsListCache : JSON.stringify(modelsListCache), id);
  };

CacheRepository.prototype.updateLocalModelsCache = async function(id, modelsListCache) {
    const stmt = this.db.prepare('UPDATE local_endpoints SET models_list_cache = ? WHERE id = ?');
    stmt.run(typeof modelsListCache === 'string' ? modelsListCache : JSON.stringify(modelsListCache), id);
  };

CacheRepository.prototype.getLocalEndpoints = async function() {
    const stmt = this.db.prepare(`
      SELECT
        e.id, e.provider, e.endpoint_url, e.is_enabled, e.is_streaming, e.models_list_cache,
        e.cpu_model, e.gpu_model, e.ram_size, e.running_environment,
        m.id as model_id, m.name as model_name, m.default_config
      FROM local_endpoints e
      LEFT JOIN local_models m ON e.id = m.local_endpoint_id
    `);
    const rows = stmt.all();

    const endpointsMap = new Map();
    for (const row of rows) {
      if (!endpointsMap.has(row.id)) {
        endpointsMap.set(row.id, {
          id: row.id,
          provider: row.provider,
          endpoint_url: row.endpoint_url,
          is_enabled: !!row.is_enabled,
          is_streaming: !!row.is_streaming,
          models_list_cache: row.models_list_cache ? JSON.parse(row.models_list_cache) : [],
          cpu_model: row.cpu_model,
          gpu_model: row.gpu_model,
          ram_size: row.ram_size,
          running_environment: row.running_environment,
          models: []
        });
      }

      if (row.model_id) {
        endpointsMap.get(row.id).models.push({
          id: row.model_id,
          name: row.model_name,
          default_config: row.default_config
        });
      }
    }

    return Array.from(endpointsMap.values());
  };

CacheRepository.prototype.getLocalEndpointById = async function(id) {
    const stmt = this.db.prepare('SELECT * FROM local_endpoints WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;

    const modelsStmt = this.db.prepare('SELECT * FROM local_models WHERE local_endpoint_id = ?');
    const models = modelsStmt.all(id);

    return {
      id: row.id,
      provider: row.provider,
      endpoint_url: row.endpoint_url,
      is_enabled: !!row.is_enabled,
      is_streaming: !!row.is_streaming,
      models_list_cache: row.models_list_cache ? JSON.parse(row.models_list_cache) : [],
      cpu_model: row.cpu_model,
      gpu_model: row.gpu_model,
      ram_size: row.ram_size,
      running_environment: row.running_environment,
      models: models
    };
  };

CacheRepository.prototype.upsertLocalEndpoint = async function(id, provider, endpointUrl, isEnabled, isStreaming, modelsListCache, cpuModel, gpuModel, ramSize, runningEnvironment, models = []) {
    if (!id) {
      id = crypto.randomUUID();
    }

    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO local_endpoints
        (id, provider, endpoint_url, is_enabled, is_streaming, models_list_cache, cpu_model, gpu_model, ram_size, running_environment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let cacheToSave = modelsListCache;
      if (cacheToSave === undefined) {
        const existing = this.db.prepare('SELECT models_list_cache FROM local_endpoints WHERE id = ?').get(id);
        cacheToSave = existing && existing.models_list_cache ? existing.models_list_cache : '[]';
      } else if (typeof cacheToSave !== 'string') {
        cacheToSave = JSON.stringify(cacheToSave);
      }

      stmt.run(id, provider, endpointUrl, isEnabled ? 1 : 0, isStreaming ? 1 : 0, cacheToSave, cpuModel || '', gpuModel || '', ramSize || '', runningEnvironment || '');

      // Delete existing models for this endpoint
      const deleteModelsStmt = this.db.prepare('DELETE FROM local_models WHERE local_endpoint_id = ?');
      deleteModelsStmt.run(id);

      // Insert the new models
      if (Array.isArray(models)) {
        const insertModelStmt = this.db.prepare(`
          INSERT INTO local_models
          (id, local_endpoint_id, name, default_config)
          VALUES (?, ?, ?, ?)
        `);

        for (const model of models) {
          const modelId = model.id || crypto.randomUUID();
          insertModelStmt.run(
            modelId,
            id,
            model.name,
            model.default_config || ''
          );
        }
      }
    });

    transaction();
    return id;
  };

CacheRepository.prototype.upsertLocalModel = async function(id, localEndpointId, name, defaultConfig) {
    if (!id) {
      id = crypto.randomUUID();
    }
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO local_models
      (id, local_endpoint_id, name, default_config)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, localEndpointId, name, defaultConfig);
    return id;
  };

CacheRepository.prototype.deleteLocalEndpoint = async function(id) {
    const stmt = this.db.prepare('DELETE FROM local_endpoints WHERE id = ?');
    stmt.run(id);
  };

CacheRepository.prototype.deleteLocalModel = async function(id) {
    const stmt = this.db.prepare('DELETE FROM local_models WHERE id = ?');
    stmt.run(id);
  };
