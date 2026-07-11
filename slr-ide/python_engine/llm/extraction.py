import json
import os
import logging
from llm.client import GeminiClient

logger = logging.getLogger(__name__)

def extract_structured_data(
    client: GeminiClient,
    model_id: str,
    system_instruction: str,
    user_prompt: str,
    response_schema: dict,
    pdf_path: str = None,
    speed_mode: str = 'FLEX',
    previous_interaction_id: str = None
) -> dict:
    """Executes a generic structured data extraction query, supporting optional PDF uploads."""
    
    file_ref = None
    try:
        pdf_uri = None
        if pdf_path and os.path.exists(pdf_path):
            logger.info(f"Uploading PDF for extraction: {pdf_path}")
            file_ref = client.client.files.upload(file=pdf_path)
            pdf_uri = file_ref.uri

        result = client.create_interaction(
            model_id=model_id,
            user_prompt=user_prompt,
            system_instruction=system_instruction,
            response_schema=response_schema,
            speed_mode=speed_mode,
            pdf_file_uri=pdf_uri,
            previous_interaction_id=previous_interaction_id,
            store=True,
            temperature=0.0
        )
        
        if not result["success"]:
            return result

        # Validate structured JSON format
        output_text = result["output_text"].strip()
        try:
            # Parse to ensure it is valid JSON
            json.loads(output_text)
            result["structured_output"] = output_text
        except Exception as e:
            logger.warning(f"Structured extraction response is not valid JSON: {e}. Output: {output_text}")
            result["success"] = False
            result["error_message"] = f"JSON Validation Error: {e}"

        return result

    except Exception as e:
        logger.error(f"Error in structured data extraction: {e}")
        return {
            "success": False,
            "error_message": str(e)
        }
        
    finally:
        if file_ref:
            try:
                logger.info(f"Deleting extraction file from Gemini storage: {file_ref.name}")
                client.client.files.delete(name=file_ref.name)
            except Exception as delete_err:
                logger.warning(f"Failed to delete Gemini file {file_ref.name}: {delete_err}")
