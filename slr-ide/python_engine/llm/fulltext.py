import json
import os
import logging
from llm.client import GeminiClient

logger = logging.getLogger(__name__)

def screen_fulltext(
    client: GeminiClient,
    model_id: str,
    pdf_path: str,
    system_instruction: str,
    user_prompt: str,
    response_schema: dict,
    speed_mode: str = 'FLEX',
    previous_interaction_id: str = None
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
            temperature=0.0
        )
        
        if not result["success"]:
            return result

        # 3. Parse JSON output
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
