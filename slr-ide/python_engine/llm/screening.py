import json
import logging
from llm.client import GeminiClient

logger = logging.getLogger(__name__)

def screen_title_abstract(
    client: GeminiClient,
    model_id: str,
    system_instruction: str,
    user_prompt: str,
    response_schema: dict,
    speed_mode: str = 'FLEX',
    previous_interaction_id: str = None
) -> dict:
    """Executes a title-abstract (text-only) screening query using Gemini Interactions API."""
    
    # Execute single interaction
    result = client.create_interaction(
        model_id=model_id,
        user_prompt=user_prompt,
        system_instruction=system_instruction,
        response_schema=response_schema,
        speed_mode=speed_mode,
        previous_interaction_id=previous_interaction_id,
        store=True,
        temperature=0.0
    )
    
    if not result["success"]:
        return result

    # Parse and structure outputs
    output_text = result["output_text"].strip()
    try:
        parsed_output = json.loads(output_text)
        result["decision"] = parsed_output.get("decision", "EXCLUDE")
        result["exclusion_trigger"] = parsed_output.get("exclusion_trigger") or parsed_output.get("exclusion_code")
        result["rationale"] = parsed_output.get("rationale") or parsed_output.get("reasoning", "")
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
        result["error_message"] = f"JSON Parse Error: {e}"
        
    return result
