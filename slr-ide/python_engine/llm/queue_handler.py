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
        self.discount = float(config.get("discount", 0.0))
        self.tax_rate = float(config.get("tax_rate", 0.0))
        
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
        self.not_stated_metrics = {}
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
            "not_stated_metrics": self.not_stated_metrics,
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
        user_prompt = hydrate_template(self.user_template, execute_read_one("SELECT * FROM projects WHERE (id = ? OR CAST(id AS TEXT) = CAST(? AS TEXT))", (self.project_id, self.project_id)), paper)

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
                WHERE paper_id = ? AND (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND status = 'SUCCESS' 
                  AND response_schema_name = ? AND interaction_id IS NOT NULL 
                ORDER BY created_at DESC 
                LIMIT 1
                """,
                (paper_id, self.project_id, self.project_id, schema_name)
            )
            previous_interaction_id = prev_row.get("interaction_id") if prev_row else None

        # Pre-flight budget check
        est = estimate_cost(self.model_id, user_prompt, pdf_path, speed_mode=self.speed_mode, discount=self.discount, tax_rate=self.tax_rate)
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
                    request_delay=self.request_delay, thinking_level=self.thinking_level
                )
            elif self.task_type in ('gatekeeper', 'scientist', 'fulltext'):
                from llm.fulltext import screen_fulltext
                response = screen_fulltext(
                    self.client, self.model_id, pdf_path, self.system_instruction, user_prompt, prompt_schema, self.speed_mode, previous_interaction_id,
                    temperature=self.temperature, max_output_tokens=self.max_output_tokens, top_p=self.top_p, top_k=self.top_k,
                    request_delay=self.request_delay, thinking_level=self.thinking_level
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
            
            price_multiplier = 1.0 - self.discount
            input_price *= price_multiplier
            output_price *= price_multiplier

            input_tokens    = response.get("input_tokens")    or 0
            output_tokens   = response.get("output_tokens")   or 0
            thinking_tokens = response.get("thinking_tokens") or 0
            cached_tokens   = response.get("cached_tokens")   or 0
            
            # Discount applied tokens
            billable_input_tokens = max(0, input_tokens - cached_tokens)
            raw_cost = ((billable_input_tokens / 1_000_000.0) * input_price) + ((output_tokens / 1_000_000.0) * output_price)
            actual_cost = raw_cost * (1.0 + self.tax_rate)

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

            default_decision = "INCLUDE" if self.task_type in ('miner', 'extraction') else "EXCLUDE"
            decision_text = response.get("decision") or default_decision
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

            # Map task_type to stage
            stage_map = {
                'fast_filter': 1, 'screening': 1,
                'gatekeeper': 2, 'fulltext': 2,
                'scientist': 3,
                'miner': 4, 'extraction': 4
            }
            incoming_stage = stage_map.get(self.task_type, 0)

            ai_decision = decision_text
            ai_exclusion_code = None
            if decision_text.upper() == "EXCLUDE":
                ai_decision = "EXCLUDE"
                ai_exclusion_code = ec_trigger if (ec_trigger and ec_trigger != "NONE") else None

            def normalize_extracted_data_payload(ext_payload):
                """
                Future-proofing helper:
                Normalizes any extraction key's 'value' field if it is a comma-separated string
                or 'NOT_STATED' into a clean list of trimmed strings.
                """
                if not ext_payload:
                    return ext_payload
                
                if isinstance(ext_payload, str):
                    try:
                        import json
                        parsed = json.loads(ext_payload)
                        normalized = normalize_extracted_data_payload(parsed)
                        return json.dumps(normalized, ensure_ascii=False)
                    except Exception:
                        return ext_payload

                if isinstance(ext_payload, dict):
                    target_dict = ext_payload.get("extracted_data") if "extracted_data" in ext_payload and isinstance(ext_payload["extracted_data"], dict) else ext_payload
                    for k, v in list(target_dict.items()):
                        if k.startswith("_") or k in ("logic_trace", "qa_scores"):
                            continue
                        if isinstance(v, dict) and "value" in v:
                            val = v["value"]
                            if isinstance(val, str):
                                s_val = val.strip()
                                if s_val.upper() == 'NOT_STATED':
                                    v["value"] = ["NOT_STATED"]
                                elif ',' in s_val:
                                    items = [item.strip() for item in s_val.split(',') if item.strip()]
                                    v["value"] = items if items else ["NOT_STATED"]
                            elif isinstance(val, list):
                                normalized_items = []
                                for item in val:
                                    if isinstance(item, str):
                                        s_item = item.strip()
                                        if s_item.upper() == 'NOT_STATED':
                                            normalized_items.append("NOT_STATED")
                                        elif s_item:
                                            normalized_items.append(s_item)
                                    else:
                                        normalized_items.append(str(item))
                                v["value"] = normalized_items if normalized_items else ["NOT_STATED"]
                    return ext_payload

                return ext_payload

            def to_json_str(val):
                if not val:
                    return None
                if isinstance(val, str):
                    return val
                import json
                return json.dumps(val)

            qa_scores_json = to_json_str(response.get("qa_scores"))
            if not qa_scores_json and struct_out:
                try:
                    import json
                    parsed_so = json.loads(struct_out)
                    if isinstance(parsed_so, dict) and "qa_scores" in parsed_so:
                        qa_scores_json = to_json_str(parsed_so["qa_scores"])
                except Exception:
                    pass

            raw_ext_data = response.get("extracted_data")
            if self.task_type in ('miner', 'extraction') and not raw_ext_data and struct_out:
                try:
                    import json
                    parsed_so = json.loads(struct_out)
                    raw_ext_data = parsed_so.get("extracted_data") or parsed_so
                except Exception:
                    raw_ext_data = None

            if raw_ext_data:
                raw_ext_data = normalize_extracted_data_payload(raw_ext_data)

            extracted_data_json = to_json_str(raw_ext_data)

            # Extract logic_trace object if available
            logic_trace_obj = response.get("logic_trace")
            if not logic_trace_obj and struct_out:
                try:
                    import json
                    parsed_so = json.loads(struct_out)
                    if isinstance(parsed_so, dict):
                        logic_trace_obj = parsed_so.get("logic_trace") or parsed_so.get("logicTrace")
                except Exception:
                    pass
            logic_trace_json = to_json_str(logic_trace_obj)

            # If re-running an earlier stage and decision is EXCLUDE, purge downstream records (stage > incoming_stage)
            if ai_decision == "EXCLUDE" and incoming_stage > 0:
                execute_write(
                    "DELETE FROM llm_screening_records WHERE (project_id = ? OR CAST(project_id AS TEXT) = CAST(? AS TEXT)) AND paper_id = ? AND stage > ?",
                    (self.project_id, self.project_id, paper_id, incoming_stage)
                )

            # Write verified gate state to llm_screening_records (triggers will automatically sync papers & rolling_batch_papers)
            now_iso = datetime.utcnow().isoformat()
            execute_write(
                """
                INSERT INTO llm_screening_records (
                    project_id, paper_id, stage, task_type, decision, exclusion_code,
                    rationale, quality_assessment, extracted_data, logic_trace, structured_output,
                    model_id, job_id, cost_usd, total_tokens, latency_ms, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, paper_id, stage) DO UPDATE SET
                    task_type = excluded.task_type,
                    decision = excluded.decision,
                    exclusion_code = excluded.exclusion_code,
                    rationale = excluded.rationale,
                    quality_assessment = excluded.quality_assessment,
                    extracted_data = excluded.extracted_data,
                    logic_trace = excluded.logic_trace,
                    structured_output = excluded.structured_output,
                    model_id = excluded.model_id,
                    job_id = excluded.job_id,
                    cost_usd = excluded.cost_usd,
                    total_tokens = excluded.total_tokens,
                    latency_ms = excluded.latency_ms,
                    updated_at = excluded.updated_at
                """,
                (
                    self.project_id, paper_id, incoming_stage, self.task_type, ai_decision, ai_exclusion_code,
                    rationale_text or None, qa_scores_json, extracted_data_json, logic_trace_json, struct_out,
                    self.model_id, self.job_id, actual_cost, (input_tokens + output_tokens + thinking_tokens),
                    response.get("latency_ms", 0), now_iso, now_iso
                )
            )
            logger.info(f"AI screening record for paper {paper_id} saved to llm_screening_records (stage {incoming_stage}).")

            if self.task_type in ('miner', 'extraction'):
                from llm.fulltext import resolve_path
                ext_data = None
                if self.schema_mapping and self.schema_mapping.get("extracted_data"):
                    ext_data = resolve_path(response.get("structured_output") or {}, self.schema_mapping.get("extracted_data"))
                if not ext_data:
                    ext_data = response.get("extracted_data")
                if not ext_data and struct_out:
                    try:
                        import json
                        parsed_struct = json.loads(struct_out)
                        if self.schema_mapping and self.schema_mapping.get("extracted_data"):
                            ext_data = resolve_path(parsed_struct, self.schema_mapping.get("extracted_data"))
                        if not ext_data:
                            ext_data = parsed_struct.get("extracted_data") or parsed_struct
                    except:
                        pass
                
                if ext_data and isinstance(ext_data, dict):
                    def is_not_stated(val):
                        if isinstance(val, str):
                            return val.strip().upper() == 'NOT_STATED'
                        if isinstance(val, list):
                            return any(isinstance(item, str) and item.strip().upper() == 'NOT_STATED' for item in val)
                        return False
                    
                    with self.lock:
                        for key, field_obj in ext_data.items():
                            val = None
                            if isinstance(field_obj, dict):
                                val = field_obj.get("value")
                            else:
                                val = field_obj
                            
                            if is_not_stated(val):
                                self.not_stated_metrics[key] = self.not_stated_metrics.get(key, 0) + 1



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
                flex_discount=self.discount,
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

            # Compute cost for any tokens consumed during failed/retried attempts
            err_input_tokens = 0
            err_output_tokens = 0
            err_thinking_tokens = 0
            err_cached_tokens = 0
            err_cost = 0.0
            resp_obj = response if ('response' in locals() and isinstance(response, dict)) else None

            if resp_obj:
                err_input_tokens = resp_obj.get("input_tokens") or 0
                err_output_tokens = resp_obj.get("output_tokens") or 0
                err_thinking_tokens = resp_obj.get("thinking_tokens") or 0
                err_cached_tokens = resp_obj.get("cached_tokens") or 0

                if err_input_tokens > 0 or err_output_tokens > 0:
                    try:
                        from llm.budget import get_model_pricing
                        pricing = get_model_pricing(self.model_id)
                        in_price = pricing["input_token_price"] * (1.0 - self.discount)
                        out_price = pricing["output_token_price"] * (1.0 - self.discount)
                        billable_in = max(0, err_input_tokens - err_cached_tokens)
                        raw_c = ((billable_in / 1_000_000.0) * in_price) + ((err_output_tokens / 1_000_000.0) * out_price)
                        err_cost = raw_c * (1.0 + self.tax_rate)

                        with self.lock:
                            self.total_cost += err_cost
                            update_project_spend(self.project_id, err_cost)
                    except Exception as cost_err:
                        logger.warning(f"Failed to compute failure cost for paper {paper_id}: {cost_err}")

            # Log failure to LLM Audit Log
            log_interaction(
                paper_id=paper_id,
                project_id=self.project_id,
                job_id=self.job_id,
                interaction_id=resp_obj.get("interaction_id") if resp_obj else None,
                previous_interaction_id=previous_interaction_id,
                model_id=self.model_id,
                task_type=self.task_type,
                input_tokens=err_input_tokens,
                output_tokens=err_output_tokens,
                thinking_tokens=err_thinking_tokens,
                cached_tokens=err_cached_tokens,
                cost_usd=err_cost,
                flex_discount=self.discount,
                speed_mode=self.speed_mode,
                raw_prompt=user_prompt,
                raw_response=resp_obj.get("raw_response", "") if resp_obj else "",
                response_schema_name=prompt_schema.get("name", "custom_schema"),
                structured_output="",
                status="ERROR",
                error_message=str(e),
                latency_ms=resp_obj.get("latency_ms", 0) if resp_obj else 0,
                retry_count=resp_obj.get("retry_count", 3) if resp_obj else 3
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
            from llm.fulltext import resolve_path
            from llm.client import safe_json_loads
            
            logs = execute_read(
                """
                SELECT structured_output
                FROM llm_audit_log
                WHERE job_id = ? AND status = 'SUCCESS'
                """,
                (self.job_id,)
            )
            for row in logs:
                struct_str = row.get("structured_output")
                if not struct_str:
                    continue
                try:
                    parsed = safe_json_loads(struct_str)
                    if not isinstance(parsed, dict):
                        continue

                    if self.task_type in ('miner', 'extraction'):
                        ext_val = None
                        if self.schema_mapping and self.schema_mapping.get("extracted_data"):
                            ext_val = resolve_path(parsed, self.schema_mapping.get("extracted_data"))
                        if not ext_val:
                            ext_val = parsed.get("extracted_data") or parsed
                        if isinstance(ext_val, dict):
                            def is_not_stated(val):
                                if isinstance(val, str):
                                    return val.strip().upper() == 'NOT_STATED'
                                if isinstance(val, list):
                                    return any(isinstance(item, str) and item.strip().upper() == 'NOT_STATED' for item in val)
                                return False
                            for key, field_obj in ext_val.items():
                                val = field_obj.get("value") if isinstance(field_obj, dict) else field_obj
                                if is_not_stated(val):
                                    self.not_stated_metrics[key] = self.not_stated_metrics.get(key, 0) + 1
                    else:
                        decision = None
                        exc_trigger = None

                        # Priority 1: Standardized baseline structure (final_evaluation)
                        final_eval = parsed.get("final_evaluation") if isinstance(parsed, dict) else None
                        if isinstance(final_eval, dict):
                            decision = final_eval.get("decision")
                            exc_trigger = final_eval.get("exclusion_code") or final_eval.get("exclusion_trigger")

                        if decision and not isinstance(decision, str):
                            decision = str(decision)
                        if decision and not (decision.upper().startswith("INCLUDE") or decision.upper().startswith("EXCLUDE")):
                            decision = None

                        _EC_ALIASES = ("exclusion_trigger", "exclusion_code", "primary_exclusion_criterion", "ec_trigger", "ec_code", "exclusion_criterion")
                        if not decision:
                            decision = parsed.get("decision")
                            if decision and not (isinstance(decision, str) and (decision.upper().startswith("INCLUDE") or decision.upper().startswith("EXCLUDE"))):
                                decision = None
                        if not exc_trigger:
                            for k in _EC_ALIASES:
                                exc_trigger = parsed.get(k)
                                if exc_trigger:
                                    break

                        if not decision or not exc_trigger:
                            _SUBOBJ_KEYS = ["final_evaluation", "evaluation", "result", "output", "verdict"]
                            candidates = [parsed.get(k) for k in _SUBOBJ_KEYS if isinstance(parsed.get(k), dict)] + [v for k, v in parsed.items() if isinstance(v, dict) and k not in _SUBOBJ_KEYS]
                            for sub in candidates:
                                if not decision:
                                    sub_dec = sub.get("decision")
                                    if sub_dec and isinstance(sub_dec, str) and (sub_dec.upper().startswith("INCLUDE") or sub_dec.upper().startswith("EXCLUDE")):
                                        decision = sub_dec
                                if not exc_trigger:
                                    for k in _EC_ALIASES:
                                        exc_trigger = sub.get(k)
                                        if exc_trigger:
                                            break
                                if decision and exc_trigger:
                                    break

                        decision_str = (decision or "EXCLUDE").upper()
                        if decision_str.startswith("INCLUDE"):
                            self.included_papers += 1
                        else:
                            self.excluded_papers += 1
                            if exc_trigger:
                                self.exclusion_reasons[exc_trigger] = self.exclusion_reasons.get(exc_trigger, 0) + 1
                except Exception:
                    pass
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
