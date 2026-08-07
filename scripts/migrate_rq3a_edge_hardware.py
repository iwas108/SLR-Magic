import sqlite3
import json
import os
import sys

def normalize_value(val):
    """
    Normalizes a value into an array of strings:
    - If 'NOT_STATED' (string or item), converts to ['NOT_STATED']
    - If comma-separated string, splits by comma and trims items
    - If list, trims each string item
    """
    if val is None:
        return ["NOT_STATED"]
    
    if isinstance(val, str):
        s_val = val.strip()
        if s_val.upper() == 'NOT_STATED':
            return ["NOT_STATED"]
        items = [item.strip() for item in s_val.split(',') if item.strip()]
        return items if items else ["NOT_STATED"]
    
    if isinstance(val, list):
        normalized = []
        for item in val:
            if isinstance(item, str):
                s_item = item.strip()
                if s_item.upper() == 'NOT_STATED':
                    normalized.append("NOT_STATED")
                elif s_item:
                    normalized.append(s_item)
            else:
                normalized.append(str(item))
        return normalized if normalized else ["NOT_STATED"]
    
    return [str(val)]

def migrate_database(db_path):
    print(f"Connecting to database: {db_path}")
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT Paper_ID, ai_extracted_data 
        FROM papers 
        WHERE ai_extracted_data IS NOT NULL AND ai_extracted_data LIKE '%rq3a_edge_hardware%'
    """)
    rows = cursor.fetchall()
    print(f"Found {len(rows)} matching papers with 'rq3a_edge_hardware'.")

    updated_count = 0

    for paper_id, ai_data_str in rows:
        try:
            data = json.loads(ai_data_str)
            ext = data.get("extracted_data") if isinstance(data, dict) and "extracted_data" in data else data
            
            if isinstance(ext, dict) and "rq3a_edge_hardware" in ext:
                field_obj = ext["rq3a_edge_hardware"]
                
                if isinstance(field_obj, dict) and "value" in field_obj:
                    old_value = field_obj["value"]
                    new_value = normalize_value(old_value)
                    
                    if old_value != new_value:
                        field_obj["value"] = new_value
                        new_ai_data_str = json.dumps(data, ensure_ascii=False)
                        
                        cursor.execute("""
                            UPDATE papers 
                            SET ai_extracted_data = ? 
                            WHERE Paper_ID = ?
                        """, (new_ai_data_str, paper_id))
                        
                        updated_count += 1
                        print(f"Updated {paper_id}: {repr(old_value)} -> {repr(new_value)}")
                elif not isinstance(field_obj, dict):
                    # If field_obj itself was stored as a string
                    old_value = field_obj
                    new_value = normalize_value(old_value)
                    ext["rq3a_edge_hardware"] = {"value": new_value, "evidence": "NOT_STATED"}
                    new_ai_data_str = json.dumps(data, ensure_ascii=False)
                    cursor.execute("""
                        UPDATE papers 
                        SET ai_extracted_data = ? 
                        WHERE Paper_ID = ?
                    """, (new_ai_data_str, paper_id))
                    updated_count += 1
                    print(f"Updated raw field {paper_id}: {repr(old_value)} -> {repr(new_value)}")

        except Exception as e:
            print(f"Error processing paper {paper_id}: {e}")

    conn.commit()
    conn.close()
    print(f"\nMigration complete. Total updated papers: {updated_count}")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(script_dir, ".."))
    db_file = os.path.join(repo_root, "slr-ide", "db", "slr.db")
    migrate_database(db_file)
