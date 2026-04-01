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

    def get_history(self, search: str = None) -> list:
        with sqlite3.connect(self.db_file) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()

            if search:
                query = "SELECT * FROM history WHERE model_name LIKE ? OR request_json LIKE ? OR response_json LIKE ? ORDER BY id DESC LIMIT 50"
                like_term = f"%{search}%"
                c.execute(query, (like_term, like_term, like_term))
            else:
                c.execute("SELECT * FROM history ORDER BY id DESC LIMIT 50")

            return [dict(row) for row in c.fetchall()]

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

    def clear_history(self):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute("DELETE FROM history")
            conn.execute("DELETE FROM cache")
