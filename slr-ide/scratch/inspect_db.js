const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../db/slr.db');
const db = new Database(dbPath);

const papers = db.prepare(`
  WITH combined_logs AS (
    SELECT paper_id, task_type, 
           UPPER(json_extract(structured_output, '$.final_evaluation.decision')) as decision,
           UPPER(json_extract(structured_output, '$.final_evaluation.exclusion_code')) as ec_trigger,
           created_at,
           0 as priority
    FROM llm_audit_log
    WHERE status = 'SUCCESS' AND json_valid(structured_output) = 1
    UNION ALL
    SELECT paper_id, manual_stage as task_type,
           UPPER(decision) as decision,
           ec_trigger as ec_trigger,
           created_at,
           1 as priority
    FROM manual_audit_log
  ),
  ranked_decisions AS (
    SELECT *, ROW_NUMBER() OVER(PARTITION BY paper_id, task_type ORDER BY priority DESC, created_at DESC) as rn
    FROM combined_logs
  )
  SELECT 
    d.paper_id,
    d.ec_trigger,
    p.AI_EC_Trigger,
    p.Human_EC_Trigger,
    p.manual_ec_trigger
  FROM ranked_decisions d
  JOIN papers p ON p.Paper_ID = d.paper_id
  WHERE d.rn = 1 AND d.task_type = 'gatekeeper' AND d.decision LIKE 'EXCLUDE%'
    AND (d.ec_trigger IS NULL OR d.ec_trigger = '' OR d.ec_trigger = 'NONE')
`).all();

console.log("Mismatched unspecified papers:", papers);
