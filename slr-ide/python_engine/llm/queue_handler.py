import os
import sys
import time
import json
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from llm.database import execute_read, execute_write, execute_read_one
from llm.budget import estimate_cost, check_budget_limit, update_project_spend
from llm.templating import hydrate_template

logger = logging.getLogger("QueueHandler")

class LLMQueueHandler:
    def __init__(self, project_id, job_id, adapter, system_instruction, user_template, config):
        self.project_id = project_id
        self.job_id = job_id
        self.adapter = adapter
        self.system_instruction = system_instruction
        self.user_template = user_template
        self.config = config
        
        self.concurrency = int(config.get("concurrency_limit", 5))
        self.batch_size = int(config.get("batch_queue_size", 100))
        self.mode = config.get("mode", "standard")
        
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
            "total_cost": self.total_cost,
        }
        if message:
            telemetry["message"] = message
        if current_paper:
            telemetry["current_paper"] = current_paper
            
        print(json.dumps(telemetry), flush=True)

    def process_paper_worker(self, paper):
        paper_id = paper["Paper_ID"]
        title = paper["Title"]
        
        # 1. Wait if the execution is paused by the budget kill switch
        self.run_event.wait()
        
        # Double-check safety lock
        with self.lock:
            if self.is_paused:
                self.run_event.wait()

        # 2. Query project variables for template hydration
        project = execute_read_one("SELECT * FROM projects WHERE id = ?", (self.project_id,))
        
        # 3. Hydrate template
        user_prompt = hydrate_template(self.user_template, project, paper)
        
        # 4. Resolve local PDF path
        pdf_path = paper.get("Local_PDF_Path")
        if pdf_path:
            if not os.path.isabs(pdf_path):
                SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                pdf_path = os.path.join(os.path.dirname(SCRAPER_DIR), pdf_path)

        # 5. Pre-flight budget check
        est = estimate_cost(self.adapter.model_id, user_prompt, pdf_path, batch_mode=False)
        est_cost = est["estimated_cost"]
        
        with self.lock:
            ok, msg = check_budget_limit(self.project_id, est_cost)
            if not ok:
                # Exceeded budget! Halt workers
                self.is_paused = True
                self.run_event.clear()
                
                # Update DB state to PAUSED_BUDGET
                execute_write(
                    "UPDATE llm_jobs SET status = 'PAUSED_BUDGET', updated_at = ? WHERE id = ?",
                    (datetime.utcnow().isoformat(), self.job_id)
                )
                
                # Broadcast pause notification
                self.broadcast_telemetry("PAUSED_BUDGET", f"Budget limit exceeded! {msg}")
                
                # Workers block here
                self.run_event.wait()
                
                # Cleared on resume
                self.is_paused = False
                self.run_event.set()

        # 6. Execute actual LLM call
        try:
            logger.info(f"Screening paper {paper_id}: '{title}'")
            
            # Flex pacing delay
            if self.mode == "flex":
                time.sleep(2)
                
            response = self.adapter.screen_paper(self.system_instruction, user_prompt, pdf_path)
            
            # 7. Atomically save actual stats & cost
            with self.lock:
                self.processed_papers += 1
                self.total_input_tokens += response["input_tokens"]
                self.total_output_tokens += response["output_tokens"]
                self.total_thinking_tokens += response["thinking_tokens"]
                self.total_cost += response["cost"]
                
                # Update spend in DB
                update_project_spend(self.project_id, response["cost"])
                
                # Update job record in SQLite
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

            # 8. Insert screening decision into reviewer_decisions
            pool = paper.get("calibration_pool") or "pool_a"
            execute_write(
                """
                INSERT OR REPLACE INTO reviewer_decisions (paper_id, project_id, pool, reviewer_name, decision, ec_trigger, rationale, imported_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (paper_id, self.project_id, pool, self.adapter.model_id, 
                 response["decision"], response["exclusion_trigger"], response["rationale"], datetime.utcnow().isoformat())
            )
            
            # 9. Update paper status to COMPLETED
            execute_write("UPDATE papers SET Status = 'COMPLETED' WHERE Paper_ID = ?", (paper_id,))
            
            # 10. Broadcast progress
            self.broadcast_telemetry("RUNNING", f"Screened: {title}", current_paper=title)

        except Exception as e:
            logger.error(f"Failed to screen paper {paper_id}: {e}")
            execute_write("UPDATE papers SET Status = 'FAILED' WHERE Paper_ID = ?", (paper_id,))
            self.broadcast_telemetry("RUNNING", f"FAILED: {title} ({e})")

    def run_queue(self, papers_to_screen):
        self.total_papers = len(papers_to_screen)
        
        # Update job record in SQLite with initial total_papers
        execute_write(
            "UPDATE llm_jobs SET total_papers = ?, status = 'RUNNING', updated_at = ? WHERE id = ?",
            (self.total_papers, datetime.utcnow().isoformat(), self.job_id)
        )
        
        self.broadcast_telemetry("RUNNING", f"Starting queue processing of {self.total_papers} papers...")
        
        # Start daemon thread monitoring stdin control inputs
        stdin_thread = threading.Thread(target=self.handle_stdin_resume_loop, daemon=True)
        stdin_thread.start()

        # Process in batches of 100
        for b_idx in range(0, self.total_papers, self.batch_size):
            batch = papers_to_screen[b_idx : b_idx + self.batch_size]
            
            logger.info(f"Processing batch of size {len(batch)}...")
            
            # Parallel execution inside batch using ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
                futures = [executor.submit(self.process_paper_worker, paper) for paper in batch]
                for future in as_completed(futures):
                    try:
                        future.result()
                    except Exception as e:
                        logger.error(f"Worker thread error: {e}")

        # Update job to COMPLETED when done
        execute_write(
            "UPDATE llm_jobs SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), self.job_id)
        )
        self.broadcast_telemetry("COMPLETED", "Queue execution finished successfully.")

    def handle_stdin_resume_loop(self):
        """Runs in a background thread, monitoring stdin for resume commands."""
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            
            # Resume trigger
            if self.is_paused:
                logger.info("Resume signal received via stdin. Resuming workers...")
                
                # Update status back to RUNNING in database
                execute_write(
                    "UPDATE llm_jobs SET status = 'RUNNING', updated_at = ? WHERE id = ?",
                    (datetime.utcnow().isoformat(), self.job_id)
                )
                
                # Release wait block
                self.is_paused = False
                self.run_event.set()
                self.broadcast_telemetry("RUNNING", "Execution resumed by user.")
