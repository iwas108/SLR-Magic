import sqlite3
from python_engine.core.config import DB_PATH, CACHE_INDEX_DB_PATH

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def get_cache_index_connection():
    return sqlite3.connect(CACHE_INDEX_DB_PATH)

def get_configs(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM configs")
    rows = cursor.fetchall()
    return {r[0]: r[1] for r in rows}
