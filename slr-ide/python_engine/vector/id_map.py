import os
import sqlite3
import hashlib
from python_engine.core.config import PROJECT_DIR

# Database path for the vector ID map
ID_MAP_DB_PATH = os.path.join(PROJECT_DIR, 'db', 'vector_id_map.db')

class IDMap:
    _conn = None

    @classmethod
    def get_connection(cls):
        """Get or create the SQLite connection for ID mapping."""
        if cls._conn is None:
            os.makedirs(os.path.dirname(ID_MAP_DB_PATH), exist_ok=True)
            cls._conn = sqlite3.connect(ID_MAP_DB_PATH)
            cls._conn.execute("""
                CREATE TABLE IF NOT EXISTS id_map (
                    uint64_id INTEGER PRIMARY KEY,
                    string_id TEXT UNIQUE NOT NULL,
                    source TEXT NOT NULL,
                    embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cls._conn.execute("CREATE INDEX IF NOT EXISTS idx_string_id ON id_map(string_id)")
            cls._conn.commit()
        return cls._conn

    @classmethod
    def get_or_create_uint64(cls, string_id: str, source: str) -> int:
        """
        Deterministic, collision-safe 63-bit integer generation from string ID.
        Stores the mapping in SQLite vector_id_map.db for reverse lookup.
        """
        if not string_id:
            raise ValueError("string_id cannot be empty")
        
        # Calculate 63-bit hash to fit safely in SQLite's signed 64-bit INTEGER
        h = hashlib.md5(string_id.encode('utf-8')).digest()
        uint64_val = int.from_bytes(h[:8], byteorder='big') & 0x7FFFFFFFFFFFFFFF

        conn = cls.get_connection()
        try:
            # Attempt to insert, ignore if already exists (primary key or unique constraint)
            conn.execute(
                "INSERT OR IGNORE INTO id_map (uint64_id, string_id, source) VALUES (?, ?, ?)",
                (uint64_val, string_id, source)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # In case of collision or other issues, check if the string_id is already mapped
            cursor = conn.cursor()
            cursor.execute("SELECT uint64_id FROM id_map WHERE string_id = ?", (string_id,))
            row = cursor.fetchone()
            if row:
                return row[0]
            raise
        
        return uint64_val

    @classmethod
    def resolve_uint64(cls, uint64_id: int) -> str:
        """Resolve a uint64 integer back to its original string ID."""
        conn = cls.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT string_id FROM id_map WHERE uint64_id = ?", (int(uint64_id),))
        row = cursor.fetchone()
        return row[0] if row else None

    @classmethod
    def bulk_resolve(cls, uint64_ids: list) -> dict:
        """Resolve a list of uint64 integers to their string IDs."""
        if not uint64_ids:
            return {}
        
        # NumPy integer types (like np.uint64) don't bind correctly in standard sqlite3.
        # We must cast them explicitly to standard Python ints.
        py_ids = [int(x) for x in uint64_ids]
        
        conn = cls.get_connection()
        cursor = conn.cursor()
        # Convert list to tuple for SQL IN clause
        placeholders = ",".join(["?"] * len(py_ids))
        cursor.execute(
            f"SELECT uint64_id, string_id FROM id_map WHERE uint64_id IN ({placeholders})",
            tuple(py_ids)
        )
        return {row[0]: row[1] for row in cursor.fetchall()}
    
    @classmethod
    def remove(cls, string_id: str):
        """Remove a mapping from the database."""
        conn = cls.get_connection()
        conn.execute("DELETE FROM id_map WHERE string_id = ?", (string_id,))
        conn.commit()
