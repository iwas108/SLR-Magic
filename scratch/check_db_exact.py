import sqlite3
import os

db_path = r"c:\Users\Aditya Suranata\Downloads\github\SLR-Magic\slr-ide\db\slr.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    
    for table in tables:
        try:
            cursor.execute(f"PRAGMA table_info({table});")
            columns = [col[1] for col in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {table};")
            rows = cursor.fetchall()
            for r_idx, row in enumerate(rows):
                for c_idx, val in enumerate(row):
                    if val and isinstance(val, str):
                        if "rq6_forecasting_engines" in val or "rq6_forecasting_engines " in val:
                            print(f"EXACT MATCH Table '{table}' Row {r_idx} Col '{columns[c_idx]}'")
                            print(val[:200])
        except Exception as e:
            print(f"Error reading table {table}: {e}")
    conn.close()
else:
    print("No database file found.")
