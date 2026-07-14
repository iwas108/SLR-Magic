import os
import sys
import json
import time
import logging
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from llm.database import execute_write, execute_read_one, execute_read
from llm.budget import estimate_cost, check_budget_limit, update_project_spend
from llm.audit import log_interaction

logger = logging.getLogger(__name__)

class LLMQueueHandler:
    def __init__(self, project_id, job_id, client, system_instruction, user_template, config, task_type):
        self.project_id = project_id
        self.job_id = job_id
        self.client = client
        self.system_instruction = system_instruction
        self.user_template = user_template
        self.config = config
        self.task_type = task_type
        
        self.model_id = config.get("model_id", "gemini-3.5-flash")
        self.schema_mapping = config.get("schema_mapping", {})
        self.speed_mode = config.get("speed_mode", "FLEX")
        self.concurrency = int(config.get("concurrency", 1))
        self.batch_queue_size = int(config.get("batch_queue_size", 100))
        self.temperature = float(config.get("temperature", 0.0))
        self.max_output_tokens = int(config.get("max_output_tokens", 2000))
        self.top_p = float(config.get("top_p")) if config.get("top_p") is not None else None
        self.top_k = int(config.get("top_k")) if config.get("top_k") is not None else None
        self.request_delay = float(config.get("request_delay", 1.0))
        self.interaction_chaining = bool(config.get("interaction_chaining", True))
        self.thinking_level = config.get("thinking_level", "none")
        
        self.run_event = threading.Event()
        self.run_event.set() # True means running
        
        self.lock = threading.Lock()
        self.is_paused = False
        
        # Telemetry counts
        self.total_papers = 0
        self.processed_papers = 0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_thinking_tokens = 0
        self.total_cached_tokens = 0
        self.total_cost = 0.0
        self.included_papers = 0
        self.excluded_papers = 0
        self.exclusion_reasons = {}
        self.total_latency_ms = 0

    def broadcast_telemetry(self, status, message=None, current_paper=None):
        telemetry = {
            "status": status,
            "job_id": self.job_id,
            "project_id": self.project_id,
            "processed_papers": self.processed_papers,
            "total_papers": self.total_papers,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_thinking_tokens": self.total_thinking_tokens,
            "total_cached_tokens": self.total_cached_tokens,
            "total_cost": self.total_cost,
            "included_papers": self.included_papers,
            "excluded_papers": self.excluded_papers,
            "exclusion_reasons": self.exclusion_reasons,
            "average_execution_time_ms": self.total_latency_ms / max(1, self.processed_papers),
        }
        if message:
            telemetry["message"] = message
        if current_paper:
            telemetry["current_paper"] = current_paper
            
        print(json.dumps(telemetry), flush=True)

    def process_paper_worker(self, paper, prompt_schema):
        paper_id = paper["Paper_ID"]
        title = paper["Title"]
        
        self.run_event.wait()
        
        with self.lock:
            if not self.run_event.is_set():
                return

        # Determine target pipeline stage status
        next_status = "0"
        if self.task_type in ('fast_filter', 'screening'):
            next_status = "1"
        elif self.task_type in ('gatekeeper', 'fulltext'):
            next_status = "2"
        elif self.task_type in ('scientist',):
            next_status = "3"
        elif self.task_type in ('miner', 'extraction'):
            next_status = "4"

        # Template prompt hydration
        from llm.templating import hydrate_template
        user_prompt = hydrate_template(self.user_template, execute_read_one("SELECT * FROM projects WHERE id = ?", (self.project_id,)), paper)

        # Resolve PDF Path
        pdf_path = paper.get("Local_PDF_Path")
        if pdf_path:
            if not os.path.isabs(pdf_path):
                SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                pdf_path = os.path.join(os.path.dirname(SCRAPER_DIR), pdf_path)

        # Resolve previous_interaction_id for multi-turn chaining (Phase 2)
        # CRITICAL GUARD: Only chain if the previous interaction used the exact same JSON schema and chaining is enabled.
        # Otherwise, the model inherits the legacy chat context and ignores the new response_schema format.
        previous_interaction_id = None
        if self.interaction_chaining:
            schema_name = prompt_schema.get("name") or prompt_schema.get("title") or "custom_schema"
            prev_row = execute_read_one(
                """
                SELECT interaction_id 
                FROM llm_audit_log 
                WHERE paper_id = ? AND project_id = ? AND status = 'SUCCESS' 
                  AND response_schema_name = ? AND interaction_id IS NOT NULL 
                ORDER BY created_at DESC 
                LIMIT 1
                """,
                (paper_id, self.project_id, schema_name)
            )
            previous_interaction_id = prev_row.get("interaction_id") if prev_row else None

        # Pre-flight budget check
        est = estimate_cost(self.model_id, user_prompt, pdf_path, speed_mode=self.speed_mode)
        est_cost = est["estimated_cost"]
        
        with self.lock:
            ok, msg = check_budget_limit(self.project_id, est_cost)
            if not ok:
                self.is_paused = True
                self.run_event.clear()
                
                execute_write(
                    "UPDATE llm_jobs SET status = 'PAUSED_BUDGET', updated_at = ? WHERE id = ?",
                    (datetime.utcnow().isoformat(), self.job_id)
                )
                self.broadcast_telemetry("PAUSED_BUDGET", f"Budget limit exceeded! {msg}")
                self.run_event.wait()
                
                self.is_paused = False
                self.run_event.set()
            elif "WARNING_BUDGET" in msg:
                self.broadcast_telemetry("WARNING", f"⚠️ {msg}")

        try:
            logger.info(f"Processing paper {paper_id}: '{title}' using task type {self.task_type}")
            
            # Throttling delay between API calls to prevent 429 rate limit errors
            if self.request_delay > 0.0:
                time.sleep(self.request_delay)

            # Call appropriate adapter flow based on task type (supports new taxonomy & backward compatibility)
            response = None
            if self.task_type in ('fast_filter', 'screening'):
                from llm.screening import screen_title_abstract
                response = screen_title_abstract(
                    self.client, self.model_id, self.system_instruction, user_prompt, prompt_schema, self.speed_mode, previous_interaction_id,
                    temperature=self.temperature, max_output_tokens=self.max_output_tokens, top_p=self.top_p, top_k=self.top_k,
                    schema_mapping=self.schema_mapping, request_delay=self.request_delay, thinking_level=self.thinking_level
                )
            elif self.task_type in ('gatekeeper', 'scientist', 'fulltext'):
                from llm.fulltext import screen_fulltext
                response = screen_fulltext(
                    self.client, self.model_id, pdf_path, self.system_instruction, user_prompt, prompt_schema, self.speed_mode, previous_interaction_id,
                    temperature=self.temperature, max_output_tokens=self.max_output_tokens, top_p=self.top_p, top_k=self.top_k,
                    schema_mapping=self.schema_mapping, request_delay=self.request_delay, thinking_level=self.thinking_level
                )
            elif self.task_type in ('miner', 'extraction'):
                from llm.extraction import extract_structured_data
                response = extract_structured_data(
                    self.client, self.model_id, self.system_instruction, user_prompt, prompt_schema, pdf_path, self.speed_mode, previous_interaction_id,
                    temperature=self.temperature, max_output_tokens=self.max_output_tokens, top_p=self.top_p, top_k=self.top_k,
                    thinking_level=self.thinking_level
                )
            else:
                raise ValueError(f"Unsupported task execution type: {self.task_type}")

            if not response or not response.get("success"):
                err_msg = response.get("error_message") if response else "Unknown Error"
                raise RuntimeError(err_msg)

            # Calculate cost based on usage metadata and dynamic rates
            from llm.budget import get_model_pricing
            pricing = get_model_pricing(self.model_id)
            input_price = pricing["input_token_price"]
            output_price = pricing["output_token_price"]
            
            if self.speed_mode == 'FLEX':
                discount = pricing.get("batch_discount", 0.5)
                input_price *= discount
                output_price *= discount

            input_tokens    = response.get("input_tokens")    or 0
            output_tokens   = response.get("output_tokens")   or 0
            thinking_tokens = response.get("thinking_tokens") or 0
            cached_tokens   = response.get("cached_tokens")   or 0
            
            # Discount applied tokens
            billable_input_tokens = max(0, input_tokens - cached_tokens)
            actual_cost = ((billable_input_tokens / 1_000_000.0) * input_price) + ((output_tokens / 1_000_000.0) * output_price)

            with self.lock:
                self.processed_papers += 1
                self.total_input_tokens += input_tokens
                self.total_output_tokens += output_tokens
                self.total_thinking_tokens += thinking_tokens
                self.total_cached_tokens += cached_tokens
                self.total_cost += actual_cost
                self.total_latency_ms += response.get("latency_ms", 0)
                
                update_project_spend(self.project_id, actual_cost)
                
                execute_write(
                    """
                    UPDATE llm_jobs 
                    SET processed_papers = ?, total_input_tokens = ?, total_output_tokens = ?, 
                        total_thinking_tokens = ?, total_cost = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (self.processed_papers, self.total_input_tokens, self.total_output_tokens, 
                     self.total_thinking_tokens, self.total_cost, datetime.utcnow().isoformat(), self.job_id)
                )

            # Insert decisions or extractions into database
            calibration_pool = paper.get("calibration_pool") or ""
            is_calibration_paper = calibration_pool in ("pool_a", "pool_b", "pool_c")
            decision_text = response.get("decision", "EXCLUDE")
            ec_trigger = response.get("exclusion_trigger")
            rationale_text = response.get("rationale", "")
            struct_out = response.get("structured_output", "")

            # Save AI results directly to dedicated AI_ columns in the papers table
            with self.lock:
                if decision_text.upper() == "INCLUDE":
                    self.included_papers += 1
                else:
                    self.excluded_papers += 1
                    if ec_trigger:
                        self.exclusion_reasons[ec_trigger] = self.exclusion_reasons.get(ec_trigger, 0) + 1

            if self.task_type in ('fast_filter', 'gatekeeper', 'scientist', 'screening', 'fulltext'):
                execute_write(
                    """
                    UPDATE papers
                    SET AI_Decision = ?,
                        AI_EC_Trigger = ?,
                        AI_Rationale = ?,
                        AI_QA_Scores = ?,
                        AI_Extracted_Data = ?
                    WHERE Paper_ID = ?
                    """,
                    (decision_text, ec_trigger, rationale_text,
                     response.get("qa_scores"), response.get("extracted_data"), paper_id)
                )
                logger.info(f"AI screening decision for paper {paper_id} saved to papers table AI_ columns.")
            elif self.task_type in ('miner', 'extraction'):
                execute_write(
                    "UPDATE papers SET AI_Extracted_Data = ? WHERE Paper_ID = ?",
                    (struct_out, paper_id)
                )
                logger.info(f"AI extracted data for paper {paper_id} saved to papers.AI_Extracted_Data.")

            # Update paper state to next stage status code
            execute_write("UPDATE papers SET Status = ? WHERE Paper_ID = ?", (next_status, paper_id))

            # Log interaction to LLM Audit Log
            log_interaction(
                paper_id=paper_id,
                project_id=self.project_id,
                job_id=self.job_id,
                interaction_id=response.get("interaction_id"),
                previous_interaction_id=previous_interaction_id,
                model_id=self.model_id,
                task_type=self.task_type,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                thinking_tokens=thinking_tokens,
                cached_tokens=cached_tokens,
                cost_usd=actual_cost,
                flex_discount=0.5 if self.speed_mode == 'FLEX' else 0.0,
                speed_mode=self.speed_mode,
                raw_prompt=user_prompt,
                raw_response=response.get("raw_response", ""),
                response_schema_name=prompt_schema.get("name", "custom_schema"),
                structured_output=struct_out,
                status="SUCCESS",
                latency_ms=response.get("latency_ms", 0),
                retry_count=response.get("retry_count", 0)
            )
            
            self.broadcast_telemetry("RUNNING", f"Processed: {title}", current_paper=title)

        except Exception as e:
            logger.error(f"Failed to process paper {paper_id}: {e}")
            execute_write("UPDATE papers SET Status = ? WHERE Paper_ID = ?", (paper.get("Status", "0"), paper_id))
            
            # Log failure to LLM Audit Log
            log_interaction(
                paper_id=paper_id,
                project_id=self.project_id,
                job_id=self.job_id,
                interaction_id=None,
                previous_interaction_id=previous_interaction_id,
                model_id=self.model_id,
                task_type=self.task_type,
                input_tokens=0,
                output_tokens=0,
                thinking_tokens=0,
                cached_tokens=0,
                cost_usd=0.0,
                flex_discount=0.0,
                speed_mode=self.speed_mode,
                raw_prompt=user_prompt,
                raw_response="",
                response_schema_name=prompt_schema.get("name", "custom_schema"),
                structured_output="",
                status="ERROR",
                error_message=str(e),
                latency_ms=0,
                retry_count=3
            )
            
            self.broadcast_telemetry("RUNNING", f"FAILED: {title} ({e})")

    def run_queue(self, papers_to_process, prompt_schema):
        self.total_papers = len(papers_to_process)
        
        execute_write(
            "UPDATE llm_jobs SET total_papers = ?, status = 'RUNNING', updated_at = ? WHERE id = ?",
            (self.total_papers, datetime.utcnow().isoformat(), self.job_id)
        )
        
        self.broadcast_telemetry("RUNNING", f"Starting queue processing of {self.total_papers} papers...")
        
        # Calculate initial included/excluded stats from audit log for resumed jobs
        try:
            stats_rows = execute_read(
                """
                SELECT json_extract(structured_output, '$.decision') as decision,
                       json_extract(structured_output, '$.exclusion_trigger') as ec_trigger,
                       COUNT(*) as count
                FROM llm_audit_log
                WHERE job_id = ? AND status = 'SUCCESS'
                GROUP BY decision, ec_trigger
                """,
                (self.job_id,)
            )
            for row in stats_rows:
                decision = (row["decision"] or "").upper()
                count = row["count"]
                if decision == "INCLUDE":
                    self.included_papers += count
                else:
                    self.excluded_papers += count
                    ec = row["ec_trigger"]
                    if ec:
                        self.exclusion_reasons[ec] = self.exclusion_reasons.get(ec, 0) + count
        except Exception as e:
            logger.error(f"Failed to load initial stats from audit log: {e}")
        
        # Start continuous stdin command listener
        def stdin_listener():
            while True:
                try:
                    line = sys.stdin.readline()
                    if not line:
                        break # EOF
                    cmd = line.strip()
                    if cmd == 'PAUSE':
                        logger.info("Pause signal caught on stdin.")
                        self.is_paused = True
                        self.run_event.clear()
                        execute_write(
                            "UPDATE llm_jobs SET status = 'PAUSED_USER', updated_at = ? WHERE id = ?",
                            (datetime.utcnow().isoformat(), self.job_id)
                        )
                        self.broadcast_telemetry("PAUSED_USER", "Job manually paused by user.")
                    elif cmd == 'RESUME' or cmd == '':
                        logger.info("Resume signal caught on stdin.")
                        self.is_paused = False
                        self.run_event.set()
                        execute_write(
                            "UPDATE llm_jobs SET status = 'RUNNING', updated_at = ? WHERE id = ?",
                            (datetime.utcnow().isoformat(), self.job_id)
                        )
                        self.broadcast_telemetry("RUNNING", "Job resumed.")
                except Exception:
                    break
        
        stdin_thread = threading.Thread(target=stdin_listener, daemon=True)
        stdin_thread.start()
        
        # Spawn execution threads
        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            for paper in papers_to_process:
                executor.submit(self.process_paper_worker, paper, prompt_schema)
                
        # Mark completion
        execute_write(
            "UPDATE llm_jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), self.job_id)
        )
        self.broadcast_telemetry("COMPLETED", "Queue execution finished successfully.")
