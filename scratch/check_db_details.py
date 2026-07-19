import sqlite3
import os
import json

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
                        if "rq6_forecasting_engines" in val:
                            print(f"--- MATCH: Table '{table}', Row ID/Index {r_idx}, Col '{columns[c_idx]}' ---")
                            # If it's json, pretty print it
                            try:
                                parsed = json.loads(val)
                                print(json.dumps(parsed, indent=2)[:500])
                                print("... (truncated)")
                            except:
                                print(val[:500])
        except Exception as e:
            print(f"Error reading table {table}: {e}")
    conn.close()
