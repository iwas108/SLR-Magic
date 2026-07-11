import os
import sys
import json
import time
import logging
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from llm.database import execute_write, execute_read_one
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
        self.speed_mode = config.get("speed_mode", "FLEX")
        self.concurrency = int(config.get("concurrency", 5))
        self.batch_queue_size = int(config.get("batch_queue_size", 100))
        self.temperature = float(config.get("temperature", 0.0))
        
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
        prev_row = execute_read_one(
            """
            SELECT interaction_id 
            FROM llm_audit_log 
            WHERE paper_id = ? AND project_id = ? AND status = 'SUCCESS' AND interaction_id IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 1
            """,
            (paper_id, self.project_id)
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

        try:
            logger.info(f"Processing paper {paper_id}: '{title}' using task type {self.task_type}")
            
            # Flex mode rate limiting delays (slightly higher wait)
            if self.speed_mode == 'FLEX':
                time.sleep(1.0)

            # Call appropriate adapter flow based on task type (supports new taxonomy & backward compatibility)
            response = None
            if self.task_type in ('fast_filter', 'screening'):
                from llm.screening import screen_title_abstract
                response = screen_title_abstract(
                    self.client, self.model_id, self.system_instruction, user_prompt, prompt_schema, self.speed_mode, previous_interaction_id
                )
            elif self.task_type in ('gatekeeper', 'scientist', 'fulltext'):
                from llm.fulltext import screen_fulltext
                response = screen_fulltext(
                    self.client, self.model_id, pdf_path, self.system_instruction, user_prompt, prompt_schema, self.speed_mode, previous_interaction_id
                )
            elif self.task_type in ('miner', 'extraction'):
                from llm.extraction import extract_structured_data
                response = extract_structured_data(
                    self.client, self.model_id, self.system_instruction, user_prompt, prompt_schema, pdf_path, self.speed_mode, previous_interaction_id
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

            input_tokens = response.get("input_tokens", 0)
            output_tokens = response.get("output_tokens", 0)
            thinking_tokens = response.get("thinking_tokens", 0)
            cached_tokens = response.get("cached_tokens", 0)
            
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
            pool = paper.get("calibration_pool") or "pool_a"
            decision_text = response.get("decision", "EXCLUDE")
            ec_trigger = response.get("exclusion_trigger")
            rationale_text = response.get("rationale", "")
            struct_out = response.get("structured_output", "")

            # Writes depend on task type: screening/fulltext (and taxonomy equivalents) updates reviewer_decisions.
            # Structured data extraction/miner updates papers table directly.
            if self.task_type in ('fast_filter', 'gatekeeper', 'scientist', 'screening', 'fulltext'):
                execute_write(
                    """
                    INSERT OR REPLACE INTO reviewer_decisions (
                        paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, imported_at, qa_scores, extracted_data
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (paper_id, self.project_id, pool, self.model_id, 
                     decision_text, ec_trigger, rationale_text, datetime.utcnow().isoformat(),
                     response.get("qa_scores"), response.get("extracted_data"))
                )
            elif self.task_type in ('miner', 'extraction'):
                execute_write(
                    "UPDATE papers SET Human_Extracted_Data = ?, Status = 'COMPLETED' WHERE Paper_ID = ?",
                    (struct_out, paper_id)
                )

            # Update paper state
            execute_write("UPDATE papers SET Status = 'COMPLETED' WHERE Paper_ID = ?", (paper_id,))

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
            execute_write("UPDATE papers SET Status = 'FAILED' WHERE Paper_ID = ?", (paper_id,))
            
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
        
        # Start resume trigger checker
        def check_stdin():
            while self.is_paused or not self.run_event.is_set():
                try:
                    line = sys.stdin.readline()
                    if line:
                        logger.info("Resume signal caught on stdin.")
                        self.run_event.set()
                        break
                except Exception:
                    break
        
        # Spawn execution threads
        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            for paper in papers_to_process:
                # Stale locks check
                if self.is_paused:
                    stdin_thread = threading.Thread(target=check_stdin, daemon=True)
                    stdin_thread.start()
                    
                executor.submit(self.process_paper_worker, paper, prompt_schema)
                
        # Mark completion
        execute_write(
            "UPDATE llm_jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), self.job_id)
        )
        self.broadcast_telemetry("COMPLETED", "Queue execution finished successfully.")
