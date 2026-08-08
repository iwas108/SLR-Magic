import os
import sys
import json
import logging
import argparse
from datetime import datetime

# Add root folder to path to allow submodules resolution
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm.database import execute_read, execute_write, execute_read_one
from llm.client import GeminiClient
from llm.schema_registry import validate_json_schema, validate_stage_schema
from llm.budget import estimate_cost, update_project_spend, get_model_pricing
from llm.client import safe_json_loads

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger("UmbrellanizerExecutor")

def fail_job(job_id, project_id, error_message, key):
    # Update result table to FAILED status
    execute_write(
        """
        INSERT OR REPLACE INTO umbrellanizer_results 
        (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, status, error_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'ERROR', ?, datetime('now'), datetime('now'))
        """,
        (project_id, key, "unknown", "unknown", "[]", "{}", error_message)
    )
    print(json.dumps({
        "status": "FAILED",
        "job_id": job_id,
        "project_id": project_id,
        "message": error_message
    }), flush=True)
    sys.exit(1)

def run_umbrellanizer_execution(project_id, job_id, key, template_id, raw_tokens_list, target_var, target_desc=""):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        fail_job(job_id, project_id, "Gemini API Key is missing. Unlock the vault first.", key)

    # 1. Fetch template
    template_row = execute_read_one("SELECT * FROM prompt_templates WHERE id = ?", (template_id,))
    if not template_row:
        fail_job(job_id, project_id, f"Prompt template '{template_id}' not found.", key)

    system_instruction = template_row.get("system_instruction") or ""
    user_template = template_row.get("user_template") or ""
    response_schema_str = template_row.get("response_schema")

    is_valid, err_msg, response_schema = validate_json_schema(response_schema_str)
    if not is_valid:
        fail_job(job_id, project_id, f"Schema validation failed: {err_msg}", key)

    stage_valid, stage_err = validate_stage_schema("umbrellanizer", response_schema)
    if not stage_valid:
        fail_job(job_id, project_id, f"Umbrellanizer stage schema validation failed: {stage_err}", key)

    # 2. Setup llm config from template
    llm_config_str = template_row.get("llm_config") or "{}"
    try:
        llm_config = json.loads(llm_config_str)
    except:
        llm_config = {}

    model_id = llm_config.get("model_id") or "gemini-2.5-flash"
    temperature = float(llm_config.get("temperature", 0.0))
    max_output_tokens = int(llm_config.get("max_tokens", 2000))
    top_p = float(llm_config.get("top_p", 0.9))
    top_k = int(llm_config.get("top_k", 40))
    thinking_level = llm_config.get("thinking_level") or "none"
    timeout_seconds = float(llm_config.get("timeout_seconds", 900.0))
    
    raw_mode = llm_config.get("execution_mode", "flex").upper()
    speed_mode = raw_mode if raw_mode in ['FLEX', 'STANDARD'] else 'FLEX'
    discount = float(llm_config.get("discount", 0.0))

    # 3. Instantiate client
    try:
        client = GeminiClient(api_key=api_key, timeout_seconds=timeout_seconds)
    except Exception as init_err:
        fail_job(job_id, project_id, f"Failed to initialize GeminiClient: {init_err}", key)

    # 4. Hydrate prompt templates using Jinja2 with new & legacy placeholders
    json_raw_tokens = json.dumps(raw_tokens_list)
    context_dict = {
        "umbrellanizer_target_research_question": target_var,
        "umbrellanizer_target_research_question_description": target_desc or "",
        "umbrellanizer_raw_tokens_array": json_raw_tokens,
        "target_variable_name": target_var,
        "raw_tokens_array": json_raw_tokens
    }

    try:
        from jinja2 import Template
        user_prompt = Template(user_template).render(**context_dict)
    except Exception as j2_err:
        logger.warning(f"Jinja2 render fallback to literal replace: {j2_err}")
        user_prompt = (user_template
                       .replace("{{ umbrellanizer_target_research_question }}", target_var)
                       .replace("{{ umbrellanizer_target_research_question_description }}", target_desc or "")
                       .replace("{{ umbrellanizer_raw_tokens_array }}", json_raw_tokens)
                       .replace("{{ target_variable_name }}", target_var)
                       .replace("{{ raw_tokens_array }}", json_raw_tokens))

    print(json.dumps({
        "status": "RUNNING",
        "job_id": job_id,
        "project_id": project_id,
        "message": "Sending taxonomy request to Gemini..."
    }), flush=True)

    # Pre-flight budget check
    project = execute_read_one("SELECT * FROM projects WHERE id = ?", (project_id,))
    project_tax = float(project.get("project_tax") or 0.0) if project else 0.0
    est = estimate_cost(model_id, user_prompt, None, speed_mode=speed_mode, discount=discount, tax_rate=project_tax)
    est_cost = est["estimated_cost"]

    from llm.budget import check_budget_limit
    ok, budget_msg = check_budget_limit(project_id, est_cost)
    if not ok:
        fail_job(job_id, project_id, f"Budget limit check failed: {budget_msg}", key)

    # Call Gemini Interactions API
    response = client.create_interaction(
        model_id=model_id,
        user_prompt=user_prompt,
        system_instruction=system_instruction,
        response_schema=response_schema,
        speed_mode=speed_mode,
        pdf_file_uri=None,
        previous_interaction_id=None,
        store=True,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        top_p=top_p,
        top_k=top_k,
        thinking_level=thinking_level
    )

    if not response or not response.get("success"):
        fail_job(job_id, project_id, response.get("error_message", "Unknown LLM error"), key)

    output_text = response.get("output_text", "").strip()
    try:
        parsed_res = safe_json_loads(output_text)
    except Exception as parse_err:
        fail_job(job_id, project_id, f"Failed to parse LLM JSON response: {parse_err}. Raw text: {output_text}", key)

    # Expected response structure: { taxonomy_mapping: [{ raw_token, umbrella_category, justification }] }
    taxonomy_mapping = parsed_res.get("taxonomy_mapping")
    if not taxonomy_mapping or not isinstance(taxonomy_mapping, list):
        fail_job(job_id, project_id, f"Taxonomy mapping list missing in output: {parsed_res}", key)

    # Build flat mapping dictionary: { "raw_token": { "umbrella_category": string, "justification": string } }
    mapping_dict = {}
    for entry in taxonomy_mapping:
        tok = entry.get("raw_token")
        cat = entry.get("umbrella_category")
        just = entry.get("justification") or ""
        if tok:
            mapping_dict[tok] = {
                "umbrella_category": cat,
                "justification": just
            }

    # Calculate actual cost
    pricing = get_model_pricing(model_id)
    input_price = pricing["input_token_price"]
    output_price = pricing["output_token_price"]

    input_tokens = response.get("input_tokens") or 0
    output_tokens = response.get("output_tokens") or 0
    thinking_tokens = response.get("thinking_tokens") or 0
    cached_tokens = response.get("cached_tokens") or 0

    billable_input = max(0, input_tokens - cached_tokens)
    raw_cost = ((billable_input / 1_000_000.0) * input_price) + ((output_tokens / 1_000_000.0) * output_price)
    actual_cost = raw_cost * (1.0 + project_tax)

    # Save results & update spend (enforce CAST(project_id AS TEXT) multi-project isolation)
    execute_write(
        """
        INSERT OR REPLACE INTO umbrellanizer_results 
        (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping,
         input_tokens, output_tokens, thinking_tokens, cost_usd, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESS', datetime('now'), datetime('now'))
        """,
        (project_id, key, template_id, model_id, json_raw_tokens, json.dumps(mapping_dict),
         input_tokens, output_tokens, thinking_tokens, actual_cost)
    )

    update_project_spend(project_id, actual_cost)

    print(json.dumps({
        "status": "COMPLETED",
        "job_id": job_id,
        "project_id": project_id,
        "message": f"Successfully mapped {len(mapping_dict)} tokens under key '{key}'",
        "umbrella_mapping": mapping_dict
    }), flush=True)

def main():
    parser = argparse.ArgumentParser(description="SLR Magic Umbrellanizer Task Executor")
    parser.add_argument('--project-id', required=True)
    parser.add_argument('--job-id', required=True)
    parser.add_argument('--key', required=True, help="extracted_data key to process")
    parser.add_argument('--template-id', required=True)
    parser.add_argument('--raw-tokens', default='', help="JSON encoded array of unique raw tokens")
    parser.add_argument('--target-variable-name', default='', help="Legacy argument for target research question")
    parser.add_argument('--target-research-question', default='', help="Target research question variable name")
    parser.add_argument('--target-research-question-description', default='', help="Detailed description of target research question")
    args = parser.parse_args()

    project_id = args.project_id
    job_id = args.job_id
    key = args.key
    template_id = args.template_id
    target_var = args.target_research_question or args.target_variable_name or key
    target_desc = args.target_research_question_description or ""

    raw_tokens_list = []
    if args.raw_tokens:
        try:
            raw_tokens_list = json.loads(args.raw_tokens)
        except Exception as e:
            fail_job(job_id, project_id, f"Failed to parse raw-tokens argument: {e}", key)

    if not raw_tokens_list:
        # Dynamically extract unique raw tokens from Miner-passed papers for key
        papers = execute_read(
            """
            SELECT ai_extracted_data, manual_extracted_data 
            FROM papers 
            WHERE Project_ID = ? AND MAX(IFNULL(manual_stage, 0), IFNULL(ai_stage, 0)) >= 4
            """,
            (project_id,)
        )
        tokens_set = set()
        for p in papers:
            ext = p.get("manual_extracted_data") or p.get("ai_extracted_data")
            if not ext:
                continue
            try:
                parsed = json.loads(ext) if isinstance(ext, str) else ext
                if isinstance(parsed, dict) and key in parsed:
                    val_obj = parsed[key]
                    val = val_obj.get("value") if isinstance(val_obj, dict) else val_obj
                    if isinstance(val, list):
                        for item in val:
                            t = str(item).strip()
                            if t and t.upper() != 'NOT_STATED':
                                tokens_set.add(t)
                    elif isinstance(val, str):
                        t = val.strip()
                        if t and t.upper() != 'NOT_STATED':
                            tokens_set.add(t)
            except Exception:
                pass
        raw_tokens_list = sorted(list(tokens_set))

    run_umbrellanizer_execution(project_id, job_id, key, template_id, raw_tokens_list, target_var, target_desc)

if __name__ == '__main__':
    main()

