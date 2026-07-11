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
from llm.schema_registry import validate_json_schema
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

def fail_job(job_id, project_id, error_message):
    """Saves a failed job state in the database and prints failure JSON to stdout."""
    execute_write(
        """
        INSERT OR REPLACE INTO llm_jobs (id, project_id, model_id, mode, status, total_papers, error_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, project_id, "unknown", "standard", "FAILED", 0, error_message, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
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
    parser.add_argument('--task-type', default='fast_filter', choices=['fast_filter', 'gatekeeper', 'scientist', 'miner', 'screening', 'fulltext', 'extraction'], help="Type of LLM task")
    parser.add_argument('--action', default='screen', choices=['screen', 'refresh-pricing'], help="Action to execute")
    parser.add_argument('--limit', type=int, default=0, help="Max number of papers to screen")
    parser.add_argument('--offset', type=int, default=0, help="Offset of papers to skip")
    parser.add_argument('--paper-ids', default='', help="Comma-separated list of Paper IDs to run")
    parser.add_argument('--template-id', default='', help="Prompt Template ID override")
    parser.add_argument('--status-filter', default='0', help="Target paper pipeline Status filter code ('0', '1', '2', etc.)")
    args = parser.parse_args()

    job_id = args.job_id
    project_id = args.project_id
    task_type = args.task_type
    action = args.action
    status_filter = args.status_filter

    logger.info(f"Starting Gemini Orchestrator for project {project_id}, job {job_id}, task {task_type}, status filter {status_filter}")

    # Resolve API Key
    api_key = os.environ.get("GEMINI_API_KEY")
    if "GOOGLE_API_KEY" in os.environ:
        del os.environ["GOOGLE_API_KEY"]
    if not api_key:
        fail_job(job_id, project_id, "Gemini API Key is missing. Unlock the vault first.")

    # Instantiate Gemini client
    try:
        client = GeminiClient(api_key=api_key)
    except Exception as init_err:
        fail_job(job_id, project_id, f"Failed to initialize GeminiClient: {init_err}")

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
    project = execute_read_one("SELECT * FROM projects WHERE id = ?", (project_id,))
    if not project:
        fail_job(job_id, project_id, f"Project '{project_id}' not found in database.")

    # 2. Resolve prompt template (must be supplied by user)
    selected_template_id = args.template_id
    if not selected_template_id:
        fail_job(job_id, project_id, "No prompt template specified. A template must always be selected to execute the pipeline.")

    template_row = execute_read_one("SELECT * FROM prompt_templates WHERE id = ?", (selected_template_id,))
    if not template_row:
        fail_job(job_id, project_id, f"Prompt template '{selected_template_id}' not found in database.")

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
    max_output_tokens = int(llm_config.get("max_tokens", 2000))
    top_p = float(llm_config.get("top_p", 0.9))
    top_k = int(llm_config.get("top_k", 40))
    
    concurrency_limit = 5
    batch_queue_size = 100

    # Resolve and normalize execution/speed mode (Standard vs Flex)
    raw_mode = llm_config.get("execution_mode", "flex").upper()
    speed_mode = raw_mode
    if speed_mode not in ['FLEX', 'STANDARD']:
        speed_mode = 'FLEX'

    # 4. Resolve JSON Schema from prompt template
    schema_str = template_row.get("response_schema")
    is_valid, err_msg, prompt_schema = validate_json_schema(schema_str)
    if not is_valid:
        fail_job(job_id, project_id, f"JSON Schema validation failed for prompt template '{selected_template_id}': {err_msg}")

    # 5. Fetch papers pending screening with range/selection constraints matching status_filter
    if args.paper_ids:
      # User specified concrete Paper IDs. Fetch all pending papers and filter in memory to avoid parameter limit exceptions.
      parsed_ids = [p_id.strip() for p_id in args.paper_ids.split(",") if p_id.strip()]
      all_papers = execute_read("SELECT * FROM papers WHERE Project_ID = ? AND Status = ? ORDER BY rowid ASC", (project_id, status_filter))
      id_set = set(parsed_ids)
      papers = [p for p in all_papers if p["Paper_ID"] in id_set]
    else:
      # Standard range/limit batch query
      query = "SELECT * FROM papers WHERE Project_ID = ? AND Status = ? ORDER BY rowid ASC"
      params = [project_id, status_filter]
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
            INSERT OR REPLACE INTO llm_jobs (id, project_id, model_id, mode, status, total_papers, processed_papers, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (job_id, project_id, model_id, speed_mode, "COMPLETED", 0, 0, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
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
        INSERT OR REPLACE INTO llm_jobs (id, project_id, model_id, mode, status, total_papers, processed_papers, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, project_id, model_id, speed_mode, "RUNNING", len(papers), 0, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
    )

    # Parse project llm_config for custom schema mappings
    project_llm_config_str = project.get("llm_config") or "{}"
    try:
        project_llm_config = json.loads(project_llm_config_str)
    except Exception:
        project_llm_config = {}
    schema_mapping = project_llm_config.get("schema_mappings", {}).get(task_type, {})

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
        "request_delay": float(llm_config.get("request_delay", 1.0)),
        "interaction_chaining": bool(llm_config.get("interaction_chaining", True)),
        "schema_mapping": schema_mapping
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
