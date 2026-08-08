import json
import logging

logger = logging.getLogger(__name__)

def normalize_schema_types(schema: dict) -> dict:
    """Recursively converts all 'type' string values in a JSON schema to uppercase
    as required by the Gemini API spec (e.g., 'object' -> 'OBJECT').
    """
    if not isinstance(schema, dict):
        return schema

    normalized = {}
    for key, value in schema.items():
        if key == 'type' and isinstance(value, str):
            normalized[key] = value.upper()
        elif isinstance(value, dict):
            normalized[key] = normalize_schema_types(value)
        elif isinstance(value, list):
            normalized[key] = [normalize_schema_types(item) if isinstance(item, dict) else item for item in value]
        else:
            normalized[key] = value
            
    return normalized

def validate_json_schema(schema_str: str) -> tuple[bool, str | None, dict | None]:
    """Validates that a string is a valid JSON schema for Gemini.
    Returns (is_valid, error_message, parsed_dict).
    """
    if not schema_str:
        return False, "Schema is empty", None
        
    try:
        schema_dict = json.loads(schema_str)
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON syntax: {e}", None

    if not isinstance(schema_dict, dict):
        return False, "JSON schema must be a JSON object", None

    if "type" not in schema_dict:
        return False, "JSON schema must specify a top-level 'type'", None

    # Check top-level type
    top_type = str(schema_dict["type"]).upper()
    if top_type not in ["OBJECT", "ARRAY"]:
        return False, "Top-level JSON schema type must be 'OBJECT' or 'ARRAY'", None

    try:
        normalized = normalize_schema_types(schema_dict)
        return True, None, normalized
    except Exception as e:
        return False, f"Normalization error: {e}", None

def validate_stage_schema(prompt_type: str, schema_dict: dict) -> tuple[bool, str | None]:
    """Validates that a parsed JSON schema dictionary satisfies the mandatory baseline properties
    for the specified pipeline stage / prompt_type.
    """
    if not prompt_type or not isinstance(schema_dict, dict):
        return True, None
        
    props = schema_dict.get("properties", {})
    ptype = str(prompt_type).lower()
    
    if ptype in ["fast_filter", "gatekeeper", "screening", "fulltext"]:
        if "logic_trace" not in props:
            return False, f"[{ptype}] schema missing required top-level property 'logic_trace'"
        if "final_evaluation" not in props:
            return False, f"[{ptype}] schema missing required top-level property 'final_evaluation'"
        final_props = props["final_evaluation"].get("properties", {}) if isinstance(props.get("final_evaluation"), dict) else {}
        for req in ["decision", "exclusion_code", "reasoning"]:
            if req not in final_props:
                return False, f"[{ptype}] final_evaluation missing required property '{req}'"
                
    elif ptype == "scientist":
        if "logic_trace" not in props:
            return False, "[scientist] schema missing required top-level property 'logic_trace'"
        if "qa_scores" not in props:
            return False, "[scientist] schema missing required top-level property 'qa_scores'"
        if "final_evaluation" not in props:
            return False, "[scientist] schema missing required top-level property 'final_evaluation'"
            
    elif ptype in ["miner", "extraction"]:
        if "logic_trace" not in props:
            return False, "[miner] schema missing required top-level property 'logic_trace'"
        if "extracted_data" not in props:
            return False, "[miner] schema missing required top-level property 'extracted_data'"
            
    elif ptype == "umbrellanizer":
        if "taxonomy_mapping" not in props:
            return False, "[umbrellanizer] schema missing required top-level property 'taxonomy_mapping'"
            
    return True, None

