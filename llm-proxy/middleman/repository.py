import sqlite3
import json
import hashlib

# =====================================================================
# Repository Layer
# =====================================================================

class CacheRepository:
    def __init__(self, db_file: str):
        self.db_file = db_file
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS cache (
                    payload_hash TEXT PRIMARY KEY,
                    response_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            conn.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    model_name TEXT,
                    request_json TEXT,
                    response_json TEXT,
                    duration_ms INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

            # Ensure endpoint_url column exists
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(history)")
            columns = [column[1] for column in cursor.fetchall()]
            if "endpoint_url" not in columns:
                conn.execute("ALTER TABLE history ADD COLUMN endpoint_url TEXT")

            conn.execute('''
                CREATE TABLE IF NOT EXISTS endpoint_labels (
                    endpoint_url TEXT PRIMARY KEY,
                    label TEXT
                )
            ''')

            # Ensure new columns exist in endpoint_labels
            cursor.execute("PRAGMA table_info(endpoint_labels)")
            labels_columns = [column[1] for column in cursor.fetchall()]
            if "is_gpu" not in labels_columns:
                conn.execute("ALTER TABLE endpoint_labels ADD COLUMN is_gpu BOOLEAN DEFAULT 0")
            if "gpu_model" not in labels_columns:
                conn.execute("ALTER TABLE endpoint_labels ADD COLUMN gpu_model TEXT DEFAULT ''")
            if "cpu_model" not in labels_columns:
                conn.execute("ALTER TABLE endpoint_labels ADD COLUMN cpu_model TEXT DEFAULT ''")
            if "ram_size" not in labels_columns:
                conn.execute("ALTER TABLE endpoint_labels ADD COLUMN ram_size TEXT DEFAULT ''")

            conn.execute('''
                CREATE TABLE IF NOT EXISTS endpoints_config (
                    endpoint_url TEXT PRIMARY KEY,
                    enabled BOOLEAN DEFAULT 1,
                    custom_model TEXT
                )
            ''')

    @staticmethod
    def generate_hash(messages: list) -> str:
        message_str = json.dumps(messages, sort_keys=True)
        return hashlib.sha256(message_str.encode('utf-8')).hexdigest()

    def get(self, payload_hash: str) -> dict | None:
        with sqlite3.connect(self.db_file) as conn:
            c = conn.cursor()
            c.execute("SELECT response_json FROM cache WHERE payload_hash = ?", (payload_hash,))
            row = c.fetchone()
            return json.loads(row[0]) if row else None

    def set(self, payload_hash: str, response_data: dict):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (payload_hash, response_json) VALUES (?, ?)",
                (payload_hash, json.dumps(response_data))
            )

    def log_history(self, model_name: str, request_data: dict, response_data: dict, duration_ms: int, endpoint_url: str = ""):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute(
                "INSERT INTO history (model_name, request_json, response_json, duration_ms, endpoint_url) VALUES (?, ?, ?, ?, ?)",
                (model_name, json.dumps(request_data), json.dumps(response_data), duration_ms, endpoint_url)
            )

    def get_endpoints(self):
        with sqlite3.connect(self.db_file) as conn:
            c = conn.cursor()
            c.execute("SELECT DISTINCT endpoint_url FROM history WHERE endpoint_url IS NOT NULL")
            return [row[0] for row in c.fetchall()]

    def get_endpoint_labels(self) -> dict:
        with sqlite3.connect(self.db_file) as conn:
            c = conn.cursor()
            c.execute("SELECT endpoint_url, label FROM endpoint_labels")
            return {row[0]: row[1] for row in c.fetchall()}

    def get_stats(self) -> list:
        with sqlite3.connect(self.db_file) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("""
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
            """)
            return [dict(row) for row in c.fetchall()]

    def set_endpoint_properties(self, endpoint_url: str, label: str, is_gpu: bool, gpu_model: str, cpu_model: str, ram_size: str):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO endpoint_labels (endpoint_url, label, is_gpu, gpu_model, cpu_model, ram_size) VALUES (?, ?, ?, ?, ?, ?)",
                (endpoint_url, label, 1 if is_gpu else 0, gpu_model, cpu_model, ram_size)
            )

    def get_all_endpoint_configs(self) -> list:
        with sqlite3.connect(self.db_file) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT endpoint_url, enabled, custom_model FROM endpoints_config")
            return [dict(row) for row in c.fetchall()]

    def upsert_endpoint_config(self, endpoint_url: str, enabled: bool, custom_model: str):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO endpoints_config (endpoint_url, enabled, custom_model) VALUES (?, ?, ?)",
                (endpoint_url, 1 if enabled else 0, custom_model)
            )

    def delete_endpoint_config(self, endpoint_url: str):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute("DELETE FROM endpoints_config WHERE endpoint_url = ?", (endpoint_url,))

    def get_history(self, search: str = None, endpoint: str = None, page: int = 1, limit: int = 50, sort_by: str = "id", sort_desc: bool = True) -> dict:
        offset = (page - 1) * limit

        valid_sort_columns = {"id", "model_name", "endpoint_url", "created_at", "duration_ms"}
        if sort_by not in valid_sort_columns:
            sort_by = "id"

        sort_order = "DESC" if sort_desc else "ASC"

        with sqlite3.connect(self.db_file) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()

            count_query = "SELECT COUNT(*) FROM history h"
            select_query = "SELECT h.*, l.is_gpu, l.gpu_model, l.cpu_model, l.ram_size FROM history h LEFT JOIN endpoint_labels l ON h.endpoint_url = l.endpoint_url"
            params = []
            conditions = []

            if search:
                conditions.append("(h.model_name LIKE ? OR h.request_json LIKE ? OR h.response_json LIKE ?)")
                like_term = f"%{search}%"
                params.extend([like_term, like_term, like_term])

            if endpoint:
                conditions.append("h.endpoint_url = ?")
                params.append(endpoint)

            if conditions:
                where_clause = " WHERE " + " AND ".join(conditions)
                count_query += where_clause
                select_query += where_clause

            c.execute(count_query, params)
            total = c.fetchone()[0]

            select_query += f" ORDER BY h.{sort_by} {sort_order} LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            c.execute(select_query, params)
            data = [dict(row) for row in c.fetchall()]

            return {
                "data": data,
                "total": total,
                "page": page,
                "limit": limit
            }

    def delete_history_item(self, item_id: int):
        with sqlite3.connect(self.db_file) as conn:
            # 1. Fetch the request JSON to generate its cache hash
            c = conn.cursor()
            c.execute("SELECT request_json FROM history WHERE id = ?", (item_id,))
            row = c.fetchone()
            if row:
                request_data = json.loads(row[0])
                messages = request_data.get("messages", [])
                payload_hash = self.generate_hash(messages)

                # 2. Delete from cache
                conn.execute("DELETE FROM cache WHERE payload_hash = ?", (payload_hash,))

            # 3. Delete from history
            conn.execute("DELETE FROM history WHERE id = ?", (item_id,))

    def delete_history_items(self, item_ids: list):
        with sqlite3.connect(self.db_file) as conn:
            c = conn.cursor()
            placeholders = ','.join('?' * len(item_ids))
            c.execute(f"SELECT request_json FROM history WHERE id IN ({placeholders})", item_ids)
            rows = c.fetchall()

            for row in rows:
                if row:
                    request_data = json.loads(row[0])
                    messages = request_data.get("messages", [])
                    payload_hash = self.generate_hash(messages)
                    conn.execute("DELETE FROM cache WHERE payload_hash = ?", (payload_hash,))

            conn.execute(f"DELETE FROM history WHERE id IN ({placeholders})", item_ids)

    def clear_history(self):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute("DELETE FROM history")
            conn.execute("DELETE FROM cache")
