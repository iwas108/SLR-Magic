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
    return stmt.all();
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
    const stmt = this.db.prepare('SELECT endpoint_url, enabled, custom_model, api_key, extra_config FROM endpoints_config');
    return stmt.all();
  }

  async upsertEndpointConfig(endpointUrl, enabled, customModel, apiKey = "", extraConfig = "") {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO endpoints_config
      (endpoint_url, enabled, custom_model, api_key, extra_config)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(endpointUrl, enabled ? 1 : 0, customModel, apiKey, extraConfig);
  }

  async deleteEndpointConfig(endpointUrl) {
    const stmt = this.db.prepare('DELETE FROM endpoints_config WHERE endpoint_url = ?');
    stmt.run(endpointUrl);
  }

  async getHistory(search = null, endpoint = null, page = 1, limit = 50, sortBy = "id", sortDesc = true) {
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
      CREATE TABLE IF NOT EXISTS endpoints_config (
        endpoint_url TEXT PRIMARY KEY,
        enabled BOOLEAN DEFAULT 1,
        custom_model TEXT,
        api_key TEXT,
        extra_config TEXT
      )
    `);

    // Ensure api_key and extra_config columns exist in endpoints_config
    const endpointsConfigCols = this.db.pragma('table_info(endpoints_config)');
    if (!endpointsConfigCols.find(col => col.name === 'api_key')) {
      this.db.exec('ALTER TABLE endpoints_config ADD COLUMN api_key TEXT');
    }
    if (!endpointsConfigCols.find(col => col.name === 'extra_config')) {
      this.db.exec('ALTER TABLE endpoints_config ADD COLUMN extra_config TEXT');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS general_config (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }
}

module.exports = CacheRepository;
