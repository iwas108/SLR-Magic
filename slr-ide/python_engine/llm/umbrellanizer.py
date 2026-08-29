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

def fail_job(job_id, project_id, error_message, key, input_tokens=0, output_tokens=0, thinking_tokens=0, cost_usd=0.0, prompt_id="unknown", model_id="unknown"):
    # Update result table to FAILED status with actual token/cost tracking if available
    execute_write(
        """
        INSERT OR REPLACE INTO umbrellanizer_results 
        (project_id, extracted_data_key, prompt_id, model_id, raw_tokens_input, umbrella_mapping, 
         input_tokens, output_tokens, thinking_tokens, cost_usd, status, error_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, '[]', '{}', ?, ?, ?, ?, 'ERROR', ?, datetime('now'), datetime('now'))
        """,
        (project_id, key, prompt_id, model_id, input_tokens, output_tokens, thinking_tokens, cost_usd, error_message)
    )
    if cost_usd > 0.0:
        update_project_spend(project_id, cost_usd)
        
    print(json.dumps({
        "status": "FAILED",
        "job_id": job_id,
        "project_id": project_id,
        "message": error_message
    }), flush=True)
    sys.exit(1)

def format_rich_tokens_markdown(rich_tokens_list, raw_tokens_list):
    if rich_tokens_list and isinstance(rich_tokens_list, list) and len(rich_tokens_list) > 0:
        blocks = []
        for item in rich_tokens_list:
            if not isinstance(item, dict):
                continue
            token = item.get("token") or item.get("raw_token") or ""
            if not token:
                continue
            count = item.get("count", 1)
            papers = item.get("papers", [])
            paper_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in papers]
            paper_ids_str = ", ".join(paper_ids) if paper_ids else f"{count} papers"

            block = [f'### Extracted Token: "{token}" (Occurrences: {count} paper{"s" if count != 1 else ""} [{paper_ids_str}])']
            
            ev_quotes = item.get("evidence_quotes", [])
            if ev_quotes:
                block.append("- **Verbatim Evidence Quotes**:")
                for eq in ev_quotes:
                    if isinstance(eq, dict):
                        p_id = eq.get("paper_id", "")
                        q_txt = eq.get("quote", "")
                        block.append(f'  * [{p_id}]: "{q_txt}"')
                    else:
                        block.append(f'  * "{eq}"')
            else:
                block.append("- **Verbatim Evidence Quotes**: None extracted.")

            l_traces = item.get("logic_traces", [])
            if l_traces:
                block.append("- **Extraction Logic Traces**:")
                for lt in l_traces:
                    if isinstance(lt, dict):
                        p_id = lt.get("paper_id", "")
                        t_txt = lt.get("trace", "")
                        block.append(f'  * [{p_id}]: {t_txt}')
                    else:
                        block.append(f'  * {lt}')
            else:
                block.append("- **Extraction Logic Traces**: None logged.")

            blocks.append("\n".join(block))
        return "\n\n".join(blocks)
    
    # Fallback to simple bulleted list if rich_tokens is not provided
    return "\n".join([f'- "{t}"' for t in raw_tokens_list])

def run_umbrellanizer_execution(project_id, job_id, key, template_id, raw_tokens_list, target_var, target_desc="", rich_tokens_list=None):
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
    rich_tokens_markdown = format_rich_tokens_markdown(rich_tokens_list, raw_tokens_list)
    json_raw_tokens = json.dumps(raw_tokens_list)
    context_dict = {
        "target_variable": target_var,
        "target_variable_description": target_desc or "",
        "raw_tokens_with_context": rich_tokens_markdown,
        "umbrellanizer_rich_tokens_context": rich_tokens_markdown,
        "rich_tokens_context": rich_tokens_markdown,
        "umbrellanizer_target_research_question": target_var,
        "umbrellanizer_target_research_question_description": target_desc or "",
        "umbrellanizer_raw_tokens_array": json_raw_tokens,
        "target_variable_name": target_var,
        "raw_tokens": json_raw_tokens,
        "raw_tokens_array": json_raw_tokens
    }

    try:
        from jinja2 import Template
        user_prompt = Template(user_template).render(**context_dict)
    except Exception as j2_err:
        logger.warning(f"Jinja2 render fallback to literal replace: {j2_err}")
        user_prompt = (user_template
                       .replace("{{ target_variable }}", target_var)
                       .replace("{{ target_variable_description }}", target_desc or "")
                       .replace("{{ raw_tokens_with_context }}", rich_tokens_markdown)
                       .replace("{{ umbrellanizer_rich_tokens_context }}", rich_tokens_markdown)
                       .replace("{{ rich_tokens_context }}", rich_tokens_markdown)
                       .replace("{{ umbrellanizer_target_research_question }}", target_var)
                       .replace("{{ umbrellanizer_target_research_question_description }}", target_desc or "")
                       .replace("{{ umbrellanizer_raw_tokens_array }}", json_raw_tokens)
                       .replace("{{ target_variable_name }}", target_var)
                       .replace("{{ raw_tokens }}", json_raw_tokens)
                       .replace("{{ raw_tokens_array }}", json_raw_tokens))

    print(json.dumps({
        "status": "RUNNING",
        "job_id": job_id,
        "project_id": project_id,
        "message": "Sending taxonomy request to Gemini..."
    }), flush=True)

    # Pre-flight budget check
    project = execute_read_one("SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))", (project_id, project_id))
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

    resp_input_tokens = response.get("input_tokens", 0) or 0 if response else 0
    resp_output_tokens = response.get("output_tokens", 0) or 0 if response else 0
    resp_thinking_tokens = response.get("thinking_tokens", 0) or 0 if response else 0
    resp_cached_tokens = response.get("cached_tokens", 0) or 0 if response else 0

    fail_cost = 0.0
    if resp_input_tokens > 0 or resp_output_tokens > 0:
        pricing = get_model_pricing(model_id)
        in_p = pricing["input_token_price"]
        out_p = pricing["output_token_price"]
        billable_in = max(0, resp_input_tokens - resp_cached_tokens)
        raw_c = ((billable_in / 1_000_000.0) * in_p) + ((resp_output_tokens / 1_000_000.0) * out_p)
        fail_cost = raw_c * (1.0 + project_tax)

    if not response or not response.get("success"):
        fail_job(job_id, project_id, response.get("error_message", "Unknown LLM error") if response else "No response", key,
                 input_tokens=resp_input_tokens, output_tokens=resp_output_tokens, thinking_tokens=resp_thinking_tokens,
                 cost_usd=fail_cost, prompt_id=template_id, model_id=model_id)

    output_text = response.get("output_text", "").strip()
    try:
        parsed_res = safe_json_loads(output_text)
    except Exception as parse_err:
        fail_job(job_id, project_id, f"Failed to parse LLM JSON response: {parse_err}. Raw text: {output_text}", key,
                 input_tokens=resp_input_tokens, output_tokens=resp_output_tokens, thinking_tokens=resp_thinking_tokens,
                 cost_usd=fail_cost, prompt_id=template_id, model_id=model_id)

    # Expected response structure: { taxonomy_mapping: [{ raw_token, umbrella_category, justification }] }
    taxonomy_mapping = parsed_res.get("taxonomy_mapping")
    if not taxonomy_mapping or not isinstance(taxonomy_mapping, list):
        fail_job(job_id, project_id, f"Taxonomy mapping list missing in output: {parsed_res}", key,
                 input_tokens=resp_input_tokens, output_tokens=resp_output_tokens, thinking_tokens=resp_thinking_tokens,
                 cost_usd=fail_cost, prompt_id=template_id, model_id=model_id)

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
    parser.add_argument('--rich-tokens', default='', help="JSON encoded array of rich token objects with evidence and traces")
    parser.add_argument('--payload-file', default='', help="Path to JSON payload file containing tokens and metadata")
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
        except Exception as e:
            fail_job(job_id, project_id, f"Failed to parse raw-tokens argument: {e}", key)

    if not rich_tokens_list and args.rich_tokens:
        try:
            if os.path.isfile(args.rich_tokens):
                with open(args.rich_tokens, 'r', encoding='utf-8') as f:
                    rich_tokens_list = json.load(f)
            else:
                rich_tokens_list = json.loads(args.rich_tokens)
        except Exception as e:
            logger.warning(f"Failed to parse rich-tokens: {e}")

    if not raw_tokens_list and rich_tokens_list:
        raw_tokens_list = [item.get("token") or item.get("raw_token") for item in rich_tokens_list if isinstance(item, dict) and (item.get("token") or item.get("raw_token"))]

    if not raw_tokens_list:
        # Dynamically extract unique raw tokens and rich context from Miner-passed papers for key
        papers = execute_read(
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
        for p in papers:
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

    run_umbrellanizer_execution(project_id, job_id, key, template_id, raw_tokens_list, target_var, target_desc, rich_tokens_list=rich_tokens_list)

if __name__ == '__main__':
    main()

