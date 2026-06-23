import os
import sys
import json
import logging
import argparse
from datetime import datetime

# Add the scrapers directory to sys.path to resolve submodules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.database import execute_read, execute_write, execute_read_one
from llm.providers import get_provider_adapter
from llm.queue_handler import LLMQueueHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
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
    parser = argparse.ArgumentParser(description="SLR Magic LLM Screening Orchestrator")
    parser.add_argument('--project-id', required=True, help="Active Project ID")
    parser.add_argument('--job-id', required=True, help="Unique LLM execution Job ID")
    parser.add_argument('--mode', default='standard', choices=['standard', 'flex', 'batch'], help="Execution mode")
    parser.add_argument('--action', default='screen', choices=['screen', 'check-batch'], help="Action to execute")
    args = parser.parse_args()

    job_id = args.job_id
    project_id = args.project_id
    mode = args.mode
    action = args.action

    if action == 'check-batch':
        from llm.batch_handler import harvest_active_batches
        harvest_active_batches()
        sys.exit(0)

    logger.info(f"Starting LLM Orchestrator for project {project_id}, job {job_id}, mode {mode}, action {action}")

    # 1. Fetch active project details from SQLite
    project = execute_read_one("SELECT * FROM projects WHERE id = ?", (project_id,))
    if not project:
        fail_job(job_id, project_id, f"Project '{project_id}' not found in database.")

    # 2. Parse LLM configuration JSON
    llm_config_str = project.get("llm_config") or "{}"
    try:
        llm_config = json.loads(llm_config_str)
    except Exception as parse_err:
        logger.error(f"Failed to parse llm_config: {llm_config_str}")
        llm_config = {}

    # Extract configuration options with fallbacks
    provider = llm_config.get("provider", "gemini")
    model_id = llm_config.get("model_id", "gemini-1.5-flash")
    prompt_template_id = llm_config.get("prompt_template_id", "default-screen")
    concurrency_limit = int(llm_config.get("concurrency_limit", 5))
    batch_queue_size = int(llm_config.get("batch_queue_size", 100))
    temperature = float(llm_config.get("temperature", 0.0))

    # 3. Resolve API Keys from process environment block
    provider_lower = provider.lower()
    api_key = None
    if provider_lower == 'gemini':
        api_key = os.environ.get("GEMINI_API_KEY")
    elif provider_lower == 'openai':
        api_key = os.environ.get("OPENAI_API_KEY")
    elif provider_lower in ('claude', 'anthropic'):
        api_key = os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        fail_job(
            job_id, 
            project_id, 
            f"API Key for provider '{provider}' is missing. Please set the appropriate environment variable (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY)."
        )

    # 4. Resolve prompt template
    template_row = execute_read_one("SELECT * FROM prompt_templates WHERE id = ?", (prompt_template_id,))
    if not template_row:
        # Fall back to global default template if custom not found
        template_row = execute_read_one("SELECT * FROM prompt_templates WHERE id = 'default-screen'")
        
    if not template_row:
        fail_job(job_id, project_id, "No prompt templates found in prompt_templates database table.")

    system_instruction = template_row.get("system_instruction") or ""
    user_template = template_row.get("user_template") or ""

    # 5. Fetch papers pending screening
    papers = execute_read("SELECT * FROM papers WHERE Project_ID = ? AND Status = 'PENDING'", (project_id,))
    if not papers:
        # No work to do, close job as complete immediately
        execute_write(
            """
            INSERT OR REPLACE INTO llm_jobs (id, project_id, model_id, mode, status, total_papers, processed_papers, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (job_id, project_id, model_id, mode, "COMPLETED", 0, 0, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
        )
        print(json.dumps({
            "status": "COMPLETED",
            "job_id": job_id,
            "project_id": project_id,
            "processed_papers": 0,
            "total_papers": 0,
            "message": "No pending papers found for screening."
        }), flush=True)
        sys.exit(0)

    # 6. Initialize job record in database
    execute_write(
        """
        INSERT OR REPLACE INTO llm_jobs (id, project_id, model_id, mode, status, total_papers, processed_papers, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, project_id, model_id, mode, "RUNNING", len(papers), 0, datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
    )

    # If running in cloud batch mode, submit the batch job and exit early
    if mode == 'batch':
        print(json.dumps({
            "status": "RUNNING", 
            "job_id": job_id, 
            "project_id": project_id,
            "message": "Submitting cloud batch prediction job..."
        }), flush=True)
        
        try:
            from llm.batch_handler import submit_batch_job
            cloud_id = submit_batch_job(project_id, job_id, provider, model_id, system_instruction, user_template, papers)
            
            # Update parent job status to PROCESSING_BATCH
            execute_write(
                "UPDATE llm_jobs SET status = 'PROCESSING_BATCH', updated_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), job_id)
            )
            
            print(json.dumps({
                "status": "PROCESSING_BATCH",
                "job_id": job_id,
                "project_id": project_id,
                "message": f"Successfully submitted cloud batch job. Cloud ID: {cloud_id}"
            }), flush=True)
            sys.exit(0)
            
        except Exception as batch_err:
            logger.error(f"Failed to submit batch: {batch_err}")
            fail_job(job_id, project_id, f"Batch submission failed: {batch_err}")

    # 7. Instantiate provider adapter
    config_params = {
        "temperature": temperature,
        "batch_mode": (mode == 'batch'),
        "mode": mode
    }
    
    try:
        adapter = get_provider_adapter(provider, model_id, api_key, config_params)
    except Exception as factory_err:
        fail_job(job_id, project_id, f"Failed to load adapter factory: {factory_err}")

    # 8. Start Queue Handler
    config_queue = {
        "concurrency_limit": concurrency_limit,
        "batch_queue_size": batch_queue_size,
        "mode": mode
    }
    
    handler = LLMQueueHandler(
        project_id=project_id,
        job_id=job_id,
        adapter=adapter,
        system_instruction=system_instruction,
        user_template=user_template,
        config=config_queue
    )

    try:
        # Process the paper list
        handler.run_queue(papers)
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
