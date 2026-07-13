import sqlite3
import json

conn = sqlite3.connect('db/slr.db')
cursor = conn.cursor()
cursor.execute("SELECT paper_id, structured_output FROM llm_audit_log WHERE status='SUCCESS'")
corrupted = []
for row in cursor.fetchall():
    paper_id, text = row
    if not text:
        continue
    
    # Strip markdown block fences if present (like safe_json_loads does)
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
        
    try:
        json.loads(text)
    except Exception:
        corrupted.append(paper_id)

print('Count:', len(corrupted))
for pid in corrupted:
    print(pid)
