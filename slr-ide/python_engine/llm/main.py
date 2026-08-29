import os
import sys
import json
import logging
import argparse
from datetime import datetime

# Add the scrapers directory to sys.path to resolve submodules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.database import execute_read, execute_write, execute_read_one
from llm.client import GeminiClient
from llm.queue_handler import LLMQueueHandler
from llm.schema_registry import validate_json_schema, validate_stage_schema
from llm.budget import sync_all_models_from_api

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
# Mute noisy and sensitive third-party logs (prevent leaking key in URLs)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("LLMMainOrchestrator")

def fail_job(job_id, project_id, error_message, task_type="fast_filter"):
    """Saves a failed job state in the database and prints failure JSON to stdout."""
    execute_write(
        """
        INSERT OR REPLACE INTO llm_jobs (id, project_id, task_type, model_id, mode, status, total_papers, error_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, project_id, task_type, "unknown", "standard", "FAILED", 0, error_message, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
    )
    print(json.dumps({
        "status": "FAILED",
        "job_id": job_id,
        "project_id": project_id,
        "message": error_message
    }), flush=True)
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="SLR Magic Gemini Interactions API Orchestrator")
    parser.add_argument('--project-id', required=True, help="Active Project ID")
    parser.add_argument('--job-id', required=True, help="Unique LLM execution Job ID")
    parser.add_argument('--task-type', default='fast_filter', choices=['fast_filter', 'gatekeeper', 'scientist', 'miner', 'umbrellanizer', 'screening', 'fulltext', 'extraction'], help="Type of LLM task")
    parser.add_argument('--action', default='screen', choices=['screen', 'refresh-pricing'], help="Action to execute")
    parser.add_argument('--limit', type=int, default=0, help="Max number of papers to screen")
    parser.add_argument('--offset', type=int, default=0, help="Offset of papers to skip")
    parser.add_argument('--paper-ids', default='', help="Comma-separated list of Paper IDs to run")
    parser.add_argument('--template-id', default='', help="Prompt Template ID override")
    parser.add_argument('--status-filter', default='0', help="Target paper pipeline Status filter code ('0', '1', '2', etc.)")
    parser.add_argument('--decision-filter', default='ALL', help="Target paper AI decision filter ('ALL', 'PENDING', 'INCLUDE', 'EXCLUDE')")
    parser.add_argument('--exclude-manual', action='store_true', help="Exclude manually screened papers")
    parser.add_argument('--paper-selection-mode', default='all', help="Paper selection mode ('all', 'snowballing', 'limit', 'range', 'selected')")
    parser.add_argument('--key', default='', help="Extracted data key for umbrellanizer task")
    parser.add_argument('--raw-tokens', default='', help="JSON encoded raw tokens for umbrellanizer task")
    parser.add_argument('--rich-tokens', default='', help="JSON encoded rich tokens with evidence quotes and logic traces for umbrellanizer task")
    parser.add_argument('--payload-file', default='', help="Path to JSON payload file containing tokens and metadata")
    parser.add_argument('--target-variable-name', default='', help="Legacy target variable name for umbrellanizer task")
    parser.add_argument('--target-research-question', default='', help="Target research question for umbrellanizer task")
    parser.add_argument('--target-research-question-description', default='', help="Target research question description for umbrellanizer task")
    args = parser.parse_args()

    job_id = args.job_id
    project_id = args.project_id
    stage_map = {
        'fast_filter': 'fast_filter',
        'screening': 'fast_filter',
        'gatekeeper': 'gatekeeper',
        'fulltext': 'gatekeeper',
        'scientist': 'scientist',
        'miner': 'miner',
        'extraction': 'miner',
        'umbrellanizer': 'umbrellanizer'
    }
    task_type = stage_map.get(args.task_type, args.task_type or 'fast_filter')
    action = args.action
    status_filter = args.status_filter
    decision_filter = args.decision_filter
    exclude_manual = args.exclude_manual

    logger.info(f"Starting Gemini Orchestrator for project {project_id}, job {job_id}, task {task_type}, status filter {status_filter}, decision filter {decision_filter}")

    # Resolve API Key
    api_key = os.environ.get("GEMINI_API_KEY")
    if "GOOGLE_API_KEY" in os.environ:
        del os.environ["GOOGLE_API_KEY"]
    if not api_key:
        fail_job(job_id, project_id, "Gemini API Key is missing. Unlock the vault first.", task_type=task_type)

    # Instantiate Gemini client
    try:
        client = GeminiClient(api_key=api_key)
    except Exception as init_err:
        fail_job(job_id, project_id, f"Failed to initialize GeminiClient: {init_err}", task_type=task_type)

    # Action: refresh-pricing
    if action == 'refresh-pricing':
        try:
            synced = sync_all_models_from_api(client)
            print(json.dumps({
                "status": "SUCCESS",
                "message": f"Successfully synced {len(synced)} Gemini models directly from the API."
            }), flush=True)
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"status": "FAILED", "message": f"Failed to refresh pricing: {e}"}), flush=True)
            sys.exit(1)

    # 1. Fetch active project details from SQLite
    project = execute_read_one("SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))", (project_id, project_id))
    if not project:
        fail_job(job_id, project_id, f"Project '{project_id}' not found in database.", task_type=task_type)

    # 2. Resolve prompt template (must be supplied by user)
    selected_template_id = args.template_id
    if not selected_template_id:
        fail_job(job_id, project_id, "No prompt template specified. A template must always be selected to execute the pipeline.", task_type=task_type)

    template_row = execute_read_one("SELECT * FROM prompt_templates WHERE id = ?", (selected_template_id,))
    if not template_row:
        fail_job(job_id, project_id, f"Prompt template '{selected_template_id}' not found in database.", task_type=task_type)

    # Special handling for umbrellanizer task type
    if task_type == 'umbrellanizer':
        from llm.umbrellanizer import run_umbrellanizer_execution
        key = args.key or 'default_key'
        target_rq = args.target_research_question or args.target_variable_name or key
        target_desc = args.target_research_question_description or ""

        # Resolve RQ description from project llm_config if not explicitly provided
        if not target_desc and project:
            try:
                p_config = json.loads(project.get("llm_config") or "{}")
                rq_descs = p_config.get("research_question_descriptions", {})
                target_desc = rq_descs.get(target_rq) or rq_descs.get(key) or ""
            except Exception:
                pass

        raw_tokens_list = []
        rich_tokens_list = []

        if getattr(args, 'payload_file', None) and os.path.isfile(args.payload_file):
            try:
                with open(args.payload_file, 'r', encoding='utf-8') as f:
                    payload_data = json.load(f)
                    if isinstance(payload_data, dict):
                        raw_tokens_list = payload_data.get('rawTokens') or payload_data.get('raw_tokens') or []
                        rich_tokens_list = payload_data.get('richTokens') or payload_data.get('rich_tokens') or []
                    elif isinstance(payload_data, list):
                        raw_tokens_list = payload_data
            except Exception as pe:
                logger.warning(f"Failed to read payload file {args.payload_file}: {pe}")

        if not raw_tokens_list and args.raw_tokens:
            try:
                if os.path.isfile(args.raw_tokens):
                    with open(args.raw_tokens, 'r', encoding='utf-8') as f:
                        raw_tokens_list = json.load(f)
                else:
                    raw_tokens_list = json.loads(args.raw_tokens)
            except Exception:
                pass

        if not rich_tokens_list and args.rich_tokens:
            try:
                if os.path.isfile(args.rich_tokens):
                    with open(args.rich_tokens, 'r', encoding='utf-8') as f:
                        rich_tokens_list = json.load(f)
                else:
                    rich_tokens_list = json.loads(args.rich_tokens)
            except Exception:
                pass

        if not raw_tokens_list and rich_tokens_list:
            raw_tokens_list = [item.get("token") or item.get("raw_token") for item in rich_tokens_list if isinstance(item, dict) and (item.get("token") or item.get("raw_token"))]

        if not raw_tokens_list:
            # Dynamically extract unique raw tokens and rich context from Miner-passed papers for key
            papers_data = execute_read(
                """
                SELECT p.Paper_ID, p.Title,
                       p.ai_extracted_data, p.manual_extracted_data,
                       lsr.logic_trace as miner_logic_trace
                FROM papers p
                LEFT JOIN llm_screening_records lsr 
                  ON lsr.paper_id = p.Paper_ID 
                 AND (lsr.project_id = p.Project_ID OR CAST(lsr.project_id AS TEXT) = CAST(p.Project_ID AS TEXT))
                 AND lsr.stage = 4
                WHERE (p.Project_ID = ? OR CAST(p.Project_ID AS TEXT) = CAST(? AS TEXT)) 
                  AND (MAX(IFNULL(p.manual_stage, 0), IFNULL(p.ai_stage, 0)) >= 4 OR p.ai_extracted_data IS NOT NULL OR p.manual_extracted_data IS NOT NULL)
                """,
                (project_id, project_id)
            )
            token_map = {}
            for p in papers_data:
                p_id = p.get("Paper_ID") or ""
                p_title = p.get("Title") or ""
                ext = p.get("manual_extracted_data") or p.get("ai_extracted_data")
                if not ext:
                    continue
                try:
                    parsed = json.loads(ext) if isinstance(ext, str) else ext
                    if isinstance(parsed, dict) and key in parsed:
                        val_obj = parsed[key]
                        val = val_obj.get("value") if isinstance(val_obj, dict) else val_obj
                        
                        evidence_quote = ""
                        if isinstance(val_obj, dict):
                            evidence_quote = val_obj.get("evidence") or val_obj.get("exact_quote") or val_obj.get("quote") or ""
                        
                        logic_trace_text = ""
                        miner_lt = p.get("miner_logic_trace")
                        if miner_lt:
                            try:
                                parsed_lt = json.loads(miner_lt) if isinstance(miner_lt, str) else miner_lt
                                em = parsed_lt.get("extraction_mapping") or parsed_lt
                                logic_trace_text = em.get(f"locate_{key}") or em.get(key) or ""
                            except Exception:
                                pass
                        if not logic_trace_text and isinstance(val_obj, dict):
                            logic_trace_text = val_obj.get("reasoning") or val_obj.get("justification") or ""

                        tokens = []
                        if isinstance(val, list):
                            tokens = [str(item).strip() for item in val if str(item).strip() and str(item).strip().upper() != 'NOT_STATED']
                        elif isinstance(val, str):
                            t_str = val.strip()
                            if t_str and t_str.upper() != 'NOT_STATED':
                                if ',' in t_str and not key.startswith('rq1a'):
                                    tokens = [sub.strip() for sub in t_str.split(',') if sub.strip() and sub.strip().upper() != 'NOT_STATED']
                                else:
                                    tokens = [t_str]
                        
                        for t in tokens:
                            if t not in token_map:
                                token_map[t] = {
                                    "token": t,
                                    "count": 0,
                                    "papers": [],
                                    "evidence_quotes": [],
                                    "logic_traces": []
                                }
                            token_map[t]["count"] += 1
                            token_map[t]["papers"].append({"id": p_id, "title": p_title})
                            if evidence_quote and evidence_quote.upper() != 'NOT_STATED':
                                if not any(eq.get("quote") == evidence_quote for eq in token_map[t]["evidence_quotes"]):
                                    token_map[t]["evidence_quotes"].append({"paper_id": p_id, "quote": evidence_quote})
                            if logic_trace_text and logic_trace_text.strip():
                                if not any(lt.get("trace") == logic_trace_text for lt in token_map[t]["logic_traces"]):
                                    token_map[t]["logic_traces"].append({"paper_id": p_id, "trace": logic_trace_text})
                except Exception:
                    pass
            
            raw_tokens_list = sorted(list(token_map.keys()))
            if not rich_tokens_list and token_map:
                rich_tokens_list = sorted(list(token_map.values()), key=lambda x: x["count"], reverse=True)

        run_umbrellanizer_execution(
            project_id=project_id,
            job_id=job_id,
            key=key,
            template_id=selected_template_id,
            raw_tokens_list=raw_tokens_list,
            target_var=target_rq,
            target_desc=target_desc,
            rich_tokens_list=rich_tokens_list
        )
        sys.exit(0)

    system_instruction = template_row.get("system_instruction") or ""
    user_template = template_row.get("user_template") or ""

    # 3. Parse LLM configuration JSON from the selected template
    llm_config_str = template_row.get("llm_config") or "{}"
    try:
        llm_config = json.loads(llm_config_str)
    except Exception as parse_err:
        logger.error(f"Failed to parse llm_config from template: {llm_config_str}")
        llm_config = {}

    # Extract configuration options
    model_id = llm_config.get("model_id") or "gemini-2.5-flash"
    temperature = float(llm_config.get("temperature", 0.0))
    max_output_tokens = int(llm_config.get("max_tokens") or llm_config.get("max_output_tokens") or 2000)
    top_p = float(llm_config.get("top_p", 0.9))
    top_k = int(llm_config.get("top_k", 40))
    timeout_seconds = float(llm_config.get("timeout_seconds", 900.0))
    discount = float(llm_config.get("discount", 0.0))
    
    # Re-instantiate client with user-configured timeout
    try:
        client = GeminiClient(api_key=api_key, timeout_seconds=timeout_seconds)
    except Exception as init_err:
        fail_job(job_id, project_id, f"Failed to initialize GeminiClient with config: {init_err}", task_type=task_type)
    
    concurrency_limit = int(llm_config.get("concurrency", 1))
    batch_queue_size = int(llm_config.get("batch_queue_size", 100))

    # Resolve and normalize execution/speed mode (Standard vs Flex)
    raw_mode = llm_config.get("execution_mode", "flex").upper()
    speed_mode = raw_mode
    if speed_mode not in ['FLEX', 'STANDARD']:
        speed_mode = 'FLEX'
    # 4. Resolve JSON Schema from prompt template
    schema_str = template_row.get("response_schema")
    is_valid, err_msg, prompt_schema = validate_json_schema(schema_str)
    if not is_valid:
        fail_job(job_id, project_id, f"JSON Schema validation failed for prompt template '{selected_template_id}': {err_msg}", task_type=task_type)

    stage_valid, stage_err = validate_stage_schema(task_type, prompt_schema)
    if not stage_valid:
        fail_job(job_id, project_id, f"Baseline stage schema validation failed for task '{task_type}': {stage_err}", task_type=task_type)

    # 5. Fetch papers pending screening with range/selection constraints matching status_filter
    requires_pdf = task_type in ('gatekeeper', 'scientist', 'miner', 'fulltext', 'extraction')
    selection_mode = getattr(args, 'paper_selection_mode', 'all')
    if args.paper_ids:
      # User specified concrete Paper IDs. Fetch paper records directly to allow force rerun on any stage.
      query = "SELECT * FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)"
      params = [project_id, project_id]
      if requires_pdf:
          query += " AND Local_PDF_Path IS NOT NULL AND Local_PDF_Path != '' AND Local_PDF_Status = 'SYNCED'"
      query += " ORDER BY Paper_ID ASC"
      all_papers = execute_read(query, tuple(params))
      parsed_ids = [p_id.strip() for p_id in args.paper_ids.split(",") if p_id.strip()]
      id_set = set(parsed_ids)
      papers = [p for p in all_papers if p["Paper_ID"] in id_set]
    else:
      # Standard range/limit batch query
      if status_filter == 'ALL':
          query = "SELECT * FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND (is_duplicate IS NULL OR is_duplicate = 0)"
          params = [project_id, project_id]
      else:
          query = "SELECT * FROM papers WHERE (Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)) AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) = ? AND (is_duplicate IS NULL OR is_duplicate = 0)"
          params = [project_id, project_id, int(status_filter)]
      if decision_filter != 'ALL':
          query += " AND (CASE WHEN (CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision ELSE COALESCE(manual_decision, ai_decision) END) LIKE 'EXCLUDE%' THEN 'EXCLUDE' WHEN (CASE WHEN IFNULL(manual_stage, 0) > IFNULL(ai_stage, 0) THEN manual_decision WHEN IFNULL(ai_stage, 0) > IFNULL(manual_stage, 0) THEN ai_decision ELSE COALESCE(manual_decision, ai_decision) END) LIKE 'INCLUDE%' THEN 'INCLUDE' ELSE 'PENDING' END) = ?"
          params.append(decision_filter)
      if requires_pdf:
          query += " AND Local_PDF_Path IS NOT NULL AND Local_PDF_Path != '' AND Local_PDF_Status = 'SYNCED'"
      if selection_mode == 'snowballing':
          query += " AND (Source IN ('Manual Search', 'Backward Snowball', 'Forward Snowball', 'Manual Ingestion') OR Import_Source IN ('Manual Search', 'Backward Snowball', 'Forward Snowball', 'Manual Ingestion') OR (Parent_Paper_ID IS NOT NULL AND Parent_Paper_ID != ''))"
      if exclude_manual:
          stage_map = {
              'fast_filter': 'fast_filter',
              'screening': 'fast_filter',
              'gatekeeper': 'gatekeeper',
              'fulltext': 'gatekeeper',
              'scientist': 'scientist',
              'miner': 'miner',
              'extraction': 'miner'
          }
          db_stage_name = stage_map.get(task_type, task_type)
          query += " AND NOT EXISTS (SELECT 1 FROM manual_audit_log WHERE manual_audit_log.paper_id = papers.Paper_ID AND (manual_audit_log.project_id = papers.Project_ID OR CAST(manual_audit_log.project_id AS TEXT) = CAST(papers.Project_ID AS TEXT)) AND manual_audit_log.manual_stage = ?)"
          params.append(db_stage_name)
      query += " ORDER BY Paper_ID ASC"
      
      # We must apply LIMIT/OFFSET after ORDER BY
      if args.limit > 0:
        query += " LIMIT ?"
        params.append(args.limit)
      if args.offset > 0:
        query += " OFFSET ?"
        params.append(args.offset)
      papers = execute_read(query, tuple(params))

    if not papers:
        # No work to do, close job as complete immediately
        execute_write(
            """
            INSERT OR REPLACE INTO llm_jobs (id, project_id, task_type, model_id, mode, status, total_papers, processed_papers, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (job_id, project_id, task_type, model_id, speed_mode, "COMPLETED", 0, 0, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
        )
        print(json.dumps({
            "status": "COMPLETED",
            "job_id": job_id,
            "project_id": project_id,
            "processed_papers": 0,
            "total_papers": 0,
            "message": "No pending papers found for processing."
        }), flush=True)
        sys.exit(0)

    # 6. Initialize job record in database
    execute_write(
        """
        INSERT OR REPLACE INTO llm_jobs (id, project_id, task_type, model_id, mode, status, total_papers, processed_papers, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, project_id, task_type, model_id, speed_mode, "RUNNING", len(papers), 0, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
    )

    # Parse project llm_config for custom schema mappings
    project_llm_config_str = project.get("llm_config") or "{}"
    try:
        project_llm_config = json.loads(project_llm_config_str)
    except Exception:
        project_llm_config = {}
    schema_mapping = project_llm_config.get("schema_mappings", {}).get(task_type, {})
    project_tax = float(project.get("project_tax") or 0.0)

    # 7. Start Queue Handler
    config_queue = {
        "model_id": model_id,
        "speed_mode": speed_mode,
        "concurrency": concurrency_limit,
        "batch_queue_size": batch_queue_size,
        "temperature": temperature,
        "max_output_tokens": max_output_tokens,
        "top_p": top_p,
        "top_k": top_k,
        "thinking_level": llm_config.get("thinking_level", "none"),
        "request_delay": float(llm_config.get("request_delay", 1.0)),
        "interaction_chaining": bool(llm_config.get("interaction_chaining", True)),
        "schema_mapping": schema_mapping,
        "discount": discount,
        "tax_rate": project_tax
    }
    
    handler = LLMQueueHandler(
        project_id=project_id,
        job_id=job_id,
        client=client,
        system_instruction=system_instruction,
        user_template=user_template,
        config=config_queue,
        task_type=task_type
    )

    try:
        # Process the paper list
        handler.run_queue(papers, prompt_schema)
    except Exception as run_err:
        logger.error(f"Error running queue: {run_err}")
        execute_write("UPDATE llm_jobs SET status = 'FAILED', error_message = ? WHERE id = ?", (str(run_err), job_id))
        print(json.dumps({
            "status": "FAILED",
            "job_id": job_id,
            "project_id": project_id,
            "message": f"Queue failed: {run_err}"
        }), flush=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
