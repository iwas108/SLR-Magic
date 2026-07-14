import Database from 'better-sqlite3';
const db = new Database('db/slr.db');
const projId = 'proj-1736798059048';

const proj = db.prepare("SELECT id FROM projects LIMIT 1").get();
if (!proj) process.exit();

const unprocessedRows = db.prepare(`
  SELECT p.Status as stage, COUNT(p.Paper_ID) as unprocessed
  FROM papers p
  WHERE p.Project_ID = ? AND (p.is_duplicate IS NULL OR p.is_duplicate = 0) AND p.Status IN ('1', '2')
    AND NOT EXISTS (
      SELECT 1 FROM llm_audit_log l 
      WHERE l.paper_id = p.Paper_ID AND l.status = 'SUCCESS' AND json_valid(l.structured_output) = 1
        AND ((p.Status = '1' AND l.task_type = 'fast_filter') OR (p.Status = '2' AND l.task_type = 'gatekeeper'))
    )
    AND NOT EXISTS (
      SELECT 1 FROM manual_audit_log m
      WHERE m.paper_id = p.Paper_ID 
        AND ((p.Status = '1' AND m.manual_stage = 'fast_filter') OR (p.Status = '2' AND m.manual_stage = 'gatekeeper'))
    )
  GROUP BY p.Status
`).all(proj.id);

console.log('Unprocessed Rows:', unprocessedRows);
