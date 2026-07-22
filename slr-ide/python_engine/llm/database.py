import os
import sqlite3
import queue
import threading

# Determine database path
SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(os.path.dirname(SCRAPER_DIR), "db", "slr.db")

class DatabaseWriter(threading.Thread):
    def __init__(self, db_path):
        super().__init__(daemon=True)
        self.db_path = db_path
        self.queue = queue.Queue()
        self._stop_event = threading.Event()
        self.name = "DatabaseWriterThread"

    def run(self):
        # Open connection in the dedicated thread
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        # Enable WAL mode for concurrency
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        
        while not self._stop_event.is_set() or not self.queue.empty():
            try:
                # Wait for a query item
                item = self.queue.get(timeout=0.1)
            except queue.Empty:
                continue

            sql, params, callback_event, result_holder = item
            try:
                cursor = conn.cursor()
                cursor.execute(sql, params or ())
                conn.commit()
                # Store details of execution
                result_holder['lastrowid'] = cursor.lastrowid
                result_holder['rowcount'] = cursor.rowcount
                result_holder['success'] = True
            except Exception as e:
                conn.rollback()
                result_holder['error'] = e
                result_holder['success'] = False
            finally:
                callback_event.set()
                self.queue.task_done()
                
        conn.close()

    def execute_write(self, sql, params=None):
        """Enqueue a write operation and wait for completion."""
        callback_event = threading.Event()
        result_holder = {'success': False, 'error': None, 'lastrowid': None, 'rowcount': None}
        self.queue.put((sql, params, callback_event, result_holder))
        # Wait for the writer thread to complete
        callback_event.wait()
        if not result_holder['success']:
            raise result_holder['error']
        return result_holder

# Initialize the global writer thread
_writer = DatabaseWriter(DB_PATH)
_writer.start()

def execute_write(sql, params=None):
    """Execute a query that modifies the database (INSERT, UPDATE, DELETE)."""
    return _writer.execute_write(sql, params)

def execute_read(sql, params=None):
    """Execute a query that reads from the database."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or ())
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def execute_read_one(sql, params=None):
    """Execute a query and return a single row or None."""
    rows = execute_read(sql, params)
    return rows[0] if rows else None
