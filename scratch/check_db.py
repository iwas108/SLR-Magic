import sqlite3
import os

db_path = r"c:\Users\Aditya Suranata\Downloads\github\SLR-Magic\slr-ide\db\slr.db"
if not os.path.exists(db_path):
    print("Database not found at:", db_path)
    # Check other locations
    possible_paths = [
        r"c:\Users\Aditya Suranata\Downloads\github\SLR-Magic\slr-ide\slr.db",
        r"c:\Users\Aditya Suranata\Downloads\github\SLR-Magic\db\slr.db",
    ]
    for p in possible_paths:
        if os.path.exists(p):
            db_path = p
            print("Found database at:", db_path)
            break

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print("Tables:", tables)
    
    for table in tables:
        try:
            cursor.execute(f"PRAGMA table_info({table});")
            columns = [col[1] for col in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {table};")
            rows = cursor.fetchall()
            for r_idx, row in enumerate(rows):
                for c_idx, val in enumerate(row):
                    if val and isinstance(val, str) and "rq6" in val:
                        print(f"Table '{table}' Row {r_idx} Col '{columns[c_idx]}': {val[:100]}...")
        except Exception as e:
            print(f"Error reading table {table}: {e}")
    conn.close()
else:
    print("No database file found.")
