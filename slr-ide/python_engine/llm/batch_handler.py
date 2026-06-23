import os
import json
import base64
import logging
import uuid
import time
from datetime import datetime

from llm.database import execute_read, execute_write, execute_read_one
from llm.budget import get_model_pricing, update_project_spend

logger = logging.getLogger("BatchHandler")

def submit_openai_batch(api_key, model_id, system_instruction, user_template, project_row, papers, job_id, config_params=None):
    """Compiles and submits a batch job to OpenAI API."""
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    
    if config_params is None:
        config_params = {}
    
    lines = []
    for paper in papers:
        paper_id = paper["Paper_ID"]
        from llm.templating import hydrate_template
        user_prompt = hydrate_template(user_template, project_row, paper)
        
        # OpenAI local PDF text extraction
        from llm.providers.openai import extract_pdf_text
        pdf_path = paper.get("Local_PDF_Path")
        if pdf_path:
            if not os.path.isabs(pdf_path):
                SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                pdf_path = os.path.join(os.path.dirname(SCRAPER_DIR), pdf_path)
            if os.path.exists(pdf_path):
                pdf_text = extract_pdf_text(pdf_path)
                if pdf_text:
                    user_prompt += f"\n\n--- ATTACHED PDF FILE TEXT CONTENT ---\n\n{pdf_text}"

        body_params = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": config_params.get("temperature", 0.0)
        }
        if config_params.get("max_tokens") is not None:
            body_params["max_completion_tokens"] = config_params["max_tokens"]
        if config_params.get("top_p") is not None:
            body_params["top_p"] = config_params["top_p"]

        line = {
            "custom_id": paper_id,
            "method": "POST",
            "url": "/v1/chat/completions",
            "body": body_params
        }
        lines.append(json.dumps(line))
        
    jsonl_content = "\n".join(lines)
    
    # Save input JSONL locally
    SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_dir = os.path.join(SCRAPER_DIR, "temp_batch")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"input_{job_id}.jsonl")
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(jsonl_content)
        
    # Upload input file to OpenAI
    with open(temp_path, "rb") as f:
        file_ref = client.files.create(file=f, purpose="batch")
        
    # Launch batch execution
    batch = client.batches.create(
        input_file_id=file_ref.id,
        endpoint="/v1/chat/completions",
        completion_window="24h"
    )
    
    # Clean up local temp file
    try:
        os.remove(temp_path)
    except Exception:
        pass
        
    return {
        "cloud_batch_id": batch.id,
        "input_file_id": file_ref.id,
        "status": "PROCESSING"
    }

def submit_claude_batch(api_key, model_id, system_instruction, user_template, project_row, papers, job_id, config_params=None):
    """Compiles and submits a Message Batch to Anthropic API."""
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    
    if config_params is None:
        config_params = {}
        
    requests = []
    for paper in papers:
        paper_id = paper["Paper_ID"]
        from llm.templating import hydrate_template
        user_prompt = hydrate_template(user_template, project_row, paper)
        
        user_content = []
        pdf_path = paper.get("Local_PDF_Path")
        if pdf_path:
            if not os.path.isabs(pdf_path):
                SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                pdf_path = os.path.join(os.path.dirname(SCRAPER_DIR), pdf_path)
            if os.path.exists(pdf_path):
                try:
                    with open(pdf_path, "rb") as f:
                        pdf_data = base64.b64encode(f.read()).decode("utf-8")
                        user_content.append({
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_data
                            }
                        })
                except Exception as e:
                    logger.error(f"Failed to read PDF for Claude batch: {e}")
                    
        user_content.append({
            "type": "text",
            "text": user_prompt
        })
        
        # Prefill opening bracket for JSON enforcement
        messages = [
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": "{"}
        ]
        
        params = {
            "model": model_id,
            "max_tokens": config_params.get("max_tokens", 2000),
            "system": system_instruction,
            "messages": messages,
            "temperature": config_params.get("temperature", 0.0)
        }
        if config_params.get("top_p") is not None:
            params["top_p"] = config_params["top_p"]
        if config_params.get("top_k") is not None:
            params["top_k"] = config_params["top_k"]

        request = {
            "custom_id": paper_id,
            "params": params
        }
        requests.append(request)
        
    # Submit batch using Messages Batches API (using PDF support beta)
    batch = client.beta.messages.batches.create(
        requests=requests,
        betas=["pdfs-2024-09-25"]
    )
    
    return {
        "cloud_batch_id": batch.id,
        "input_file_id": None,
        "status": "PROCESSING"
    }

def submit_gemini_batch(model_id, project_id, job_id, papers):
    """Simulates Gemini Batch processing locally via a daemon thread."""
    import threading
    
    def simulate_processing():
        # Wait 10 seconds to simulate cloud execution turnaround
        time.sleep(10)
        
        # Complete mock paper screening decisions
        for paper in papers:
            paper_id = paper["Paper_ID"]
            execute_write(
                """
                INSERT OR REPLACE INTO reviewer_decisions (paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, imported_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (paper_id, project_id, paper.get("calibration_pool") or "pool_a", model_id, 
                 "INCLUDE" if hash(paper_id) % 2 == 0 else "EXCLUDE", None, "Simulated Gemini batch screening decision.", datetime.utcnow().isoformat())
            )
            execute_write("UPDATE papers SET Status = 'COMPLETED' WHERE Paper_ID = ?", (paper_id,))
            
        # Update batch states in DB
        execute_write("UPDATE llm_batch_jobs SET status = 'SUCCESS', completed_at = ? WHERE job_id = ?", (datetime.utcnow().isoformat(), job_id))
        execute_write("UPDATE llm_jobs SET status = 'COMPLETED', processed_papers = total_papers, updated_at = ? WHERE id = ?", (datetime.utcnow().isoformat(), job_id))
        
        print(json.dumps({
            "status": "COMPLETED", 
            "job_id": job_id, 
            "message": "Simulated Gemini batch job finished successfully."
        }), flush=True)

    t = threading.Thread(target=simulate_processing, daemon=True)
    t.start()
    
    return {
        "cloud_batch_id": f"simulated-gemini-{job_id}",
        "input_file_id": None,
        "status": "PROCESSING"
    }

def submit_batch_job(project_id, job_id, provider, model_id, system_instruction, user_template, papers, llm_config=None):
    """Aggregates and submits paper batches based on selected provider."""
    project = execute_read_one("SELECT * FROM projects WHERE id = ?", (project_id,))
    
    if llm_config is None:
        llm_config = {}
        
    config_params = {
        "temperature": float(llm_config.get("temperature", 0.0)),
        "max_tokens": int(llm_config.get("max_tokens", 2000)),
        "top_p": llm_config.get("top_p"),
        "top_k": llm_config.get("top_k")
    }
    if config_params["top_p"] is not None:
        config_params["top_p"] = float(config_params["top_p"])
    if config_params["top_k"] is not None:
        try:
            config_params["top_k"] = int(config_params["top_k"])
        except (ValueError, TypeError):
            config_params["top_k"] = None
            
    # Resolve API keys from environments
    provider_lower = provider.lower()
    api_key = None
    if provider_lower == 'openai':
        api_key = os.environ.get("OPENAI_API_KEY")
    elif provider_lower in ('claude', 'anthropic'):
        api_key = os.environ.get("ANTHROPIC_API_KEY")

    # Launch submissions
    if provider_lower == 'openai':
        res = submit_openai_batch(api_key, model_id, system_instruction, user_template, project, papers, job_id, config_params)
    elif provider_lower in ('claude', 'anthropic'):
        res = submit_claude_batch(api_key, model_id, system_instruction, user_template, project, papers, job_id, config_params)
    elif provider_lower == 'gemini':
        res = submit_gemini_batch(model_id, project_id, job_id, papers)
    else:
        raise ValueError(f"Batch prediction not supported for provider: {provider}")

    # Record in llm_batch_jobs
    batch_uuid = str(uuid.uuid4())
    execute_write(
        """
        INSERT INTO llm_batch_jobs (id, job_id, provider, cloud_batch_id, status, input_file_id, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (batch_uuid, job_id, provider, res["cloud_batch_id"], res["status"], res["input_file_id"], datetime.utcnow().isoformat())
    )
    
    return res["cloud_batch_id"]

def harvest_active_batches():
    """Polls provider endpoints for all pending batches and downloads results if complete."""
    active_batches = execute_read("SELECT * FROM llm_batch_jobs WHERE status = 'PROCESSING'")
    if not active_batches:
        print(json.dumps({"status": "HARVEST_CHECK", "message": "No active batch jobs found."}), flush=True)
        return

    print(json.dumps({"status": "HARVEST_CHECK", "message": f"Checking {len(active_batches)} active batches..."}), flush=True)

    for b in active_batches:
        job_id = b["job_id"]
        provider = b["provider"]
        cloud_id = b["cloud_batch_id"]
        
        # Load parent job
        job_row = execute_read_one("SELECT * FROM llm_jobs WHERE id = ?", (job_id,))
        if not job_row:
            continue
        project_id = job_row["project_id"]
        model_id = job_row["model_id"]

        provider_lower = provider.lower()
        if provider_lower == 'gemini':
            # Gemini simulated batch is updated in background thread
            continue

        api_key = os.environ.get("OPENAI_API_KEY") if provider_lower == 'openai' else os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            logger.warning(f"API key missing for batch {cloud_id} harvest.")
            continue

        try:
            if provider_lower == 'openai':
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                
                status_obj = client.batches.retrieve(cloud_id)
                logger.info(f"OpenAI Batch {cloud_id} status: {status_obj.status}")
                
                if status_obj.status == 'completed':
                    # Download results
                    output_file_id = status_obj.output_file_id
                    content_resp = client.files.content(output_file_id)
                    results_text = content_resp.text
                    
                    # Parse output JSONL lines
                    total_cost = 0.0
                    input_tokens = 0
                    output_tokens = 0
                    count = 0
                    
                    pricing = get_model_pricing(model_id)
                    input_rate = pricing["input_token_price"] * 0.5 # 50% discount
                    output_rate = pricing["output_token_price"] * 0.5
                    
                    for line in results_text.splitlines():
                        if not line.strip():
                            continue
                        item = json.loads(line)
                        paper_id = item["custom_id"]
                        
                        # Extract response body
                        resp_body = item["response"]["body"]
                        content_str = resp_body["choices"][0]["message"]["content"]
                        
                        try:
                            verdict = json.loads(content_str)
                        except Exception:
                            verdict = {"decision": "EXCLUDE", "exclusion_trigger": "MALFORMED", "rationale": content_str}
                            
                        # Usage
                        usage = item["response"]["body"].get("usage", {})
                        prompt_tokens = usage.get("prompt_tokens", 0)
                        completion_tokens = usage.get("completion_tokens", 0)
                        
                        input_tokens += prompt_tokens
                        output_tokens += completion_tokens
                        cost = (prompt_tokens / 1_000_000.0) * input_rate + (completion_tokens / 1_000_000.0) * output_rate
                        total_cost += cost
                        
                        # Find pool
                        paper_row = execute_read_one("SELECT calibration_pool FROM papers WHERE Paper_ID = ?", (paper_id,))
                        pool = paper_row.get("calibration_pool") if paper_row else "pool_a"
                        
                        # Write decision
                        execute_write(
                            """
                            INSERT OR REPLACE INTO reviewer_decisions (paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, imported_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (paper_id, project_id, pool, model_id, verdict.get("decision"), verdict.get("exclusion_trigger"), verdict.get("rationale"), datetime.utcnow().isoformat())
                        )
                        execute_write("UPDATE papers SET Status = 'COMPLETED' WHERE Paper_ID = ?", (paper_id,))
                        count += 1
                        
                    # Update budget spend
                    update_project_spend(project_id, total_cost)
                    
                    # Update DB states
                    execute_write(
                        "UPDATE llm_batch_jobs SET status = 'SUCCESS', output_file_id = ?, completed_at = ? WHERE id = ?",
                        (output_file_id, datetime.utcnow().isoformat(), b["id"])
                    )
                    execute_write(
                        """
                        UPDATE llm_jobs 
                        SET status = 'COMPLETED', processed_papers = ?, total_input_tokens = ?, 
                            total_output_tokens = ?, total_cost = ?, updated_at = ? 
                        WHERE id = ?
                        """,
                        (count, input_tokens, output_tokens, total_cost, datetime.utcnow().isoformat(), job_id)
                    )
                    print(json.dumps({"status": "COMPLETED", "job_id": job_id, "message": f"Harvested {count} papers from OpenAI Batch."}), flush=True)

                elif status_obj.status in ('failed', 'expired', 'cancelled'):
                    execute_write("UPDATE llm_batch_jobs SET status = 'FAILED', completed_at = ? WHERE id = ?", (datetime.utcnow().isoformat(), b["id"]))
                    execute_write("UPDATE llm_jobs SET status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?", (f"OpenAI batch failed with status: {status_obj.status}", datetime.utcnow().isoformat(), job_id))
                    execute_write("UPDATE papers SET Status = 'FAILED' WHERE Project_ID = ? AND Status = 'PENDING'", (project_id,))
                    print(json.dumps({"status": "FAILED", "job_id": job_id, "message": f"OpenAI batch failed with status: {status_obj.status}"}), flush=True)

            elif provider_lower in ('claude', 'anthropic'):
                import anthropic
                client = anthropic.Anthropic(api_key=api_key)
                
                status_obj = client.beta.messages.batches.retrieve(cloud_id)
                logger.info(f"Claude Batch {cloud_id} status: {status_obj.processing_status}")
                
                if status_obj.processing_status == 'ended':
                    # Harvest batch outputs
                    results_iterator = client.beta.messages.batches.results(cloud_id)
                    
                    total_cost = 0.0
                    input_tokens = 0
                    output_tokens = 0
                    count = 0
                    
                    pricing = get_model_pricing(model_id)
                    input_rate = pricing["input_token_price"] * 0.5
                    output_rate = pricing["output_token_price"] * 0.5
                    
                    for result_item in results_iterator:
                        paper_id = result_item.custom_id
                        
                        if result_item.result.type == 'succeeded':
                            msg_content = result_item.result.message.content[0].text
                            full_json_str = "{" + msg_content
                            
                            try:
                                verdict = json.loads(full_json_str)
                            except Exception:
                                verdict = {"decision": "EXCLUDE", "exclusion_trigger": "MALFORMED", "rationale": full_json_str}
                                
                            # Usage
                            usage = result_item.result.message.usage
                            in_t = usage.input_tokens
                            out_t = usage.output_tokens
                            
                            input_tokens += in_t
                            output_tokens += out_t
                            cost = (in_t / 1_000_000.0) * input_rate + (out_t / 1_000_000.0) * output_rate
                            total_cost += cost
                            
                            paper_row = execute_read_one("SELECT calibration_pool FROM papers WHERE Paper_ID = ?", (paper_id,))
                            pool = paper_row.get("calibration_pool") if paper_row else "pool_a"
                            
                            execute_write(
                                """
                                INSERT OR REPLACE INTO reviewer_decisions (paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, imported_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                """,
                                (paper_id, project_id, pool, model_id, verdict.get("decision"), verdict.get("exclusion_trigger"), verdict.get("rationale"), datetime.utcnow().isoformat())
                            )
                            execute_write("UPDATE papers SET Status = 'COMPLETED' WHERE Paper_ID = ?", (paper_id,))
                            count += 1
                        else:
                            # Single request failed
                            execute_write("UPDATE papers SET Status = 'FAILED' WHERE Paper_ID = ?", (paper_id,))

                    update_project_spend(project_id, total_cost)
                    execute_write("UPDATE llm_batch_jobs SET status = 'SUCCESS', completed_at = ? WHERE id = ?", (datetime.utcnow().isoformat(), b["id"]))
                    execute_write(
                        """
                        UPDATE llm_jobs 
                        SET status = 'COMPLETED', processed_papers = ?, total_input_tokens = ?, 
                            total_output_tokens = ?, total_cost = ?, updated_at = ? 
                        WHERE id = ?
                        """,
                        (count, input_tokens, output_tokens, total_cost, datetime.utcnow().isoformat(), job_id)
                    )
                    print(json.dumps({"status": "COMPLETED", "job_id": job_id, "message": f"Harvested {count} papers from Claude Batch."}), flush=True)

        except Exception as e:
            logger.error(f"Error harvesting batch {cloud_id}: {e}")
