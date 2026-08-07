import json
import os
import logging
from llm.client import GeminiClient

logger = logging.getLogger(__name__)

def resolve_path(data, path_str):
    if not path_str or not isinstance(data, dict):
        return None
    parts = path_str.split('.')
    curr = data
    for part in parts:
        if isinstance(curr, dict) and part in curr:
            curr = curr[part]
        else:
            return None
    return curr

def screen_fulltext(
    client: GeminiClient,
    model_id: str,
    pdf_path: str,
    system_instruction: str,
    user_prompt: str,
    response_schema: dict,
    speed_mode: str = 'FLEX',
    previous_interaction_id: str = None,
    temperature: float = 0.0,
    max_output_tokens: int = 2000,
    top_p: float = None,
    top_k: int = None,
    schema_mapping: dict = None,
    request_delay: float = 1.0,
    thinking_level: str = "none"
) -> dict:
    """Executes a full-text screening/QA query, uploading the PDF to Gemini Files API
    and ensuring cleanup afterwards.
    """
    if not pdf_path or not os.path.exists(pdf_path):
        return {
            "success": False,
            "error_message": f"PDF file not found at path: {pdf_path}"
        }

    file_ref = None
    try:
        # 1. Upload the PDF file via the new google-genai Files API
        logger.info(f"Uploading PDF to Gemini Files API: {pdf_path}")
        file_ref = client.client.files.upload(file=pdf_path)
        
        # Poll and block until file is ACTIVE
        from llm.client import wait_for_file_active
        wait_for_file_active(client.client, file_ref.name)
        
        # 2. Call Interactions API using the file reference URI
        result = client.create_interaction(
            model_id=model_id,
            user_prompt=user_prompt,
            system_instruction=system_instruction,
            response_schema=response_schema,
            speed_mode=speed_mode,
            pdf_file_uri=file_ref.uri,
            previous_interaction_id=previous_interaction_id,
            store=True,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            top_p=top_p,
            top_k=top_k,
            request_delay=request_delay,
            thinking_level=thinking_level
        )
        
        if not result["success"]:
            return result

        # 3. Parse JSON output
        output_text = result["output_text"].strip()
        try:
            from llm.client import safe_json_loads
            parsed_output = safe_json_loads(output_text)
            
            # Resolve using custom mapping
            decision = None
            exc_trigger = None
            rationale = None

            if schema_mapping:
                decision = resolve_path(parsed_output, schema_mapping.get("decision"))
                exc_trigger = resolve_path(parsed_output, schema_mapping.get("exclusion_trigger"))
                rationale = resolve_path(parsed_output, schema_mapping.get("rationale"))

            # Extended alias keys that Gemini models often emit instead of the schema-mandated names
            _EC_ALIASES = (
                "exclusion_trigger", "exclusion_code", "primary_exclusion_criterion",
                "ec_trigger", "ec_code", "exclusion_criterion"
            )
            _RATIONALE_ALIASES = (
                "rationale", "reasoning", "exclusion_summary", "explanation",
                "conclusion", "justification", "summary"
            )

            # Validate decision format (must start with INCLUDE or EXCLUDE, not an exclusion code like NONE)
            if decision and not isinstance(decision, str):
                decision = str(decision)
            if decision and not (decision.upper().startswith("INCLUDE") or decision.upper().startswith("EXCLUDE")):
                decision = None

            # Fallback — Level 1: top-level flat keys
            if not decision:
                decision = parsed_output.get("decision")
                if decision and not (isinstance(decision, str) and (decision.upper().startswith("INCLUDE") or decision.upper().startswith("EXCLUDE"))):
                    decision = None
            if not exc_trigger:
                for k in _EC_ALIASES:
                    exc_trigger = parsed_output.get(k)
                    if exc_trigger:
                        break
            if not rationale:
                for k in _RATIONALE_ALIASES:
                    rationale = parsed_output.get(k)
                    if rationale:
                        break

            # Fallback — Level 2: well-known sub-object keys, then any top-level dict value
            if not decision or not rationale or not exc_trigger:
                _SUBOBJ_KEYS = ["final_evaluation", "evaluation", "result", "output", "verdict"]
                # Walk known sub-object keys first, then fall back to any dict value at the top level
                candidates = [
                    parsed_output.get(k) for k in _SUBOBJ_KEYS if isinstance(parsed_output.get(k), dict)
                ] + [
                    v for k, v in parsed_output.items()
                    if isinstance(v, dict) and k not in _SUBOBJ_KEYS
                ]
                for sub in candidates:
                    if not decision:
                        decision = sub.get("decision")
                    if not exc_trigger:
                        for k in _EC_ALIASES:
                            exc_trigger = sub.get(k)
                            if exc_trigger:
                                break
                    if not rationale:
                        for k in _RATIONALE_ALIASES:
                            rationale = sub.get(k)
                            if rationale:
                                break
                    if decision and exc_trigger and rationale:
                        break

            result["decision"] = decision or "EXCLUDE"
            result["exclusion_trigger"] = exc_trigger
            result["rationale"] = rationale or ""
            result["structured_output"] = output_text
            
            # Support optional QA scores and extracted data in the schema response
            if "qa_scores" in parsed_output:
                qa = parsed_output["qa_scores"]
                result["qa_scores"] = json.dumps(qa) if isinstance(qa, (dict, list)) else str(qa)
            if "extracted_data" in parsed_output:
                ext = parsed_output["extracted_data"]
                result["extracted_data"] = json.dumps(ext) if isinstance(ext, (dict, list)) else str(ext)
        except Exception as e:
            logger.warning(f"Failed to parse structured JSON response: {e}. Raw response: {output_text}")
            result["success"] = False
            result["error_message"] = f"JSON parse error: {e}"
            
        return result

    except Exception as e:
        logger.error(f"Error in full-text screening: {e}")
        return {
            "success": False,
            "error_message": str(e)
        }
        
    finally:
        # 4. Clean up the uploaded file to prevent leakage or cluttering developer storage
        if file_ref:
            try:
                logger.info(f"Deleting uploaded file from Gemini storage: {file_ref.name}")
                client.client.files.delete(name=file_ref.name)
            except Exception as delete_err:
                logger.warning(f"Failed to delete Gemini file {file_ref.name}: {delete_err}")
