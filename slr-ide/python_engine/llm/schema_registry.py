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
