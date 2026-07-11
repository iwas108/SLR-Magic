import hashlib
from datetime import datetime
from llm.database import execute_write

def compute_prompt_hash(prompt: str) -> str:
    """Computes SHA-256 hash of the prompt for deduplication detection."""
    if not prompt:
        return ""
    return hashlib.sha256(prompt.encode('utf-8')).hexdigest()

def log_interaction(
    paper_id: str,
    project_id: str,
    job_id: str,
    interaction_id: str,
    previous_interaction_id: str,
    model_id: str,
    task_type: str,
    input_tokens: int,
    output_tokens: int,
    thinking_tokens: int,
    cached_tokens: int,
    cost_usd: float,
    flex_discount: float,
    speed_mode: str,
    raw_prompt: str,
    raw_response: str,
    response_schema_name: str,
    structured_output: str,
    status: str,
    error_message: str = None,
    error_code: str = None,
    latency_ms: int = 0,
    retry_count: int = 0,
    api_version: str = "google-genai-2.3.0"
):
    """Inserts a single API interaction record into the llm_audit_log table."""
    prompt_hash = compute_prompt_hash(raw_prompt)
    total_tokens = input_tokens + output_tokens

    sql = """
        INSERT INTO llm_audit_log (
            paper_id, project_id, job_id, interaction_id, previous_interaction_id,
            model_id, task_type, input_tokens, output_tokens, thinking_tokens,
            cached_tokens, total_tokens, cost_usd, flex_discount, speed_mode,
            prompt_hash, raw_prompt, raw_response, response_schema_name,
            structured_output, status, error_message, error_code, latency_ms,
            retry_count, api_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    params = (
        paper_id, project_id, job_id, interaction_id, previous_interaction_id,
        model_id, task_type, input_tokens, output_tokens, thinking_tokens,
        cached_tokens, total_tokens, cost_usd, flex_discount, speed_mode,
        prompt_hash, raw_prompt, raw_response, response_schema_name,
        structured_output, status, error_message, error_code, latency_ms,
        retry_count, api_version, datetime.utcnow().isoformat()
    )
    
    execute_write(sql, params)
