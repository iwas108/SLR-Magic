import os
import json
import logging
import google.generativeai as genai
import typing_extensions as typing

from llm.providers.base import BaseLLMAdapter, retry_with_backoff
from llm.budget import get_model_pricing

logger = logging.getLogger("GeminiAdapter")

class ScreenResponse(typing.TypedDict):
    decision: typing.Literal["INCLUDE", "EXCLUDE"]
    exclusion_trigger: typing.Optional[str]
    rationale: str

class GeminiAdapter(BaseLLMAdapter):
    def __init__(self, model_id, api_key, config_params=None):
        super().__init__(model_id, api_key, config_params)
        genai.configure(api_key=self.api_key)

    @retry_with_backoff(max_retries=3)
    def screen_paper(self, system_instruction, user_prompt, pdf_path=None):
        file_ref = None
        contents = []

        try:
            # Upload PDF to Gemini Files API if path is valid
            if pdf_path and os.path.exists(pdf_path):
                logger.info(f"Uploading PDF {pdf_path} to Gemini Files API...")
                file_ref = genai.upload_file(path=pdf_path)
                contents.append(file_ref)
                
            contents.append(user_prompt)

            model = genai.GenerativeModel(
                model_name=self.model_id,
                system_instruction=system_instruction
            )

            # Request structured JSON output matching the TypedDict schema
            gen_config = {
                "response_mime_type": "application/json",
                "response_schema": ScreenResponse,
                "temperature": self.config_params.get("temperature", 0.0)
            }
            if self.config_params.get("max_tokens") is not None:
                gen_config["max_output_tokens"] = self.config_params["max_tokens"]
            if self.config_params.get("top_p") is not None:
                gen_config["top_p"] = self.config_params["top_p"]
            if self.config_params.get("top_k") is not None:
                gen_config["top_k"] = self.config_params["top_k"]

            response = model.generate_content(
                contents,
                generation_config=genai.GenerationConfig(**gen_config)
            )

            # Parse structured JSON response
            try:
                result = json.loads(response.text)
            except Exception as parse_err:
                logger.error(f"Failed to parse Gemini JSON response: {response.text}")
                result = {
                    "decision": "EXCLUDE",
                    "exclusion_trigger": "MALFORMED_RESPONSE",
                    "rationale": f"Gemini API returned malformed text: {response.text}"
                }

            # Parse token usage metrics
            input_tokens = 0
            output_tokens = 0
            if response.usage_metadata:
                input_tokens = response.usage_metadata.prompt_token_count
                output_tokens = response.usage_metadata.candidates_token_count

            # Calculate cost dynamically using active pricing rates
            pricing = get_model_pricing(self.model_id)
            input_rate = pricing["input_token_price"]
            output_rate = pricing["output_token_price"]
            
            if self.config_params.get("batch_mode", False):
                input_rate *= pricing.get("batch_discount", 0.5)
                output_rate *= pricing.get("batch_discount", 0.5)

            cost = (input_tokens / 1_000_000.0) * input_rate + (output_tokens / 1_000_000.0) * output_rate

            return {
                "decision": result.get("decision", "EXCLUDE"),
                "exclusion_trigger": result.get("exclusion_trigger"),
                "rationale": result.get("rationale", ""),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "thinking_tokens": 0,
                "cost": cost
            }

        finally:
            # Ensure clean up of uploaded file from Gemini cloud server
            if file_ref:
                try:
                    logger.info(f"Cleaning up uploaded Gemini file: {file_ref.name}")
                    genai.delete_file(name=file_ref.name)
                except Exception as cleanup_err:
                    logger.warning(f"Failed to delete uploaded file {file_ref.name}: {cleanup_err}")
