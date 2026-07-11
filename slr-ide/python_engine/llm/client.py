import time
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

class GeminiClient:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("API key must be provided to initialize GeminiClient")
        # Initialize the new google-genai Client
        self.client = genai.Client(api_key=api_key)

    def create_interaction(
        self,
        model_id: str,
        user_prompt: str,
        system_instruction: str = None,
        response_schema: dict = None,
        speed_mode: str = 'FLEX',
        previous_interaction_id: str = None,
        store: bool = True,
        temperature: float = 0.0,
        max_output_tokens: int = 2000,
        pdf_file_uri: str = None
    ):
        """Calls the Gemini Interactions API using the google-genai SDK.
        
        The interactions.create() call accepts flat **body kwargs — no config= wrapper.
        Schema:
          - model, input, store, system_instruction, previous_interaction_id, service_tier
            → top-level kwargs
          - temperature, max_output_tokens → nested in generation_config={}
          - JSON schema → nested in response_format={"type":"text","mime_type":"application/json","schema_": ...}
        """
        
        # Prepare content inputs
        inputs = []
        if pdf_file_uri:
            inputs.append(types.Part.from_uri(file_uri=pdf_file_uri, mime_type="application/pdf"))
        
        inputs.append(user_prompt)

        # Build flat body kwargs as required by GeminiNextGenInteractions.create()
        body: dict = {
            "model": model_id,
            "input": inputs,
            "store": store,
            "generation_config": {
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
            }
        }

        # System instruction at the top level
        if system_instruction:
            body["system_instruction"] = system_instruction

        # Previous interaction chaining
        if previous_interaction_id:
            body["previous_interaction_id"] = previous_interaction_id

        # FLEX speed → service_tier = "FLEX_TIER_1", otherwise omit (STANDARD)
        if speed_mode == 'FLEX':
            body["service_tier"] = "FLEX_TIER_1"

        # JSON schema output → use response_format at top level
        if response_schema:
            body["response_mime_type"] = "application/json"
            body["response_format"] = {
                "type": "text",
                "mime_type": "application/json",
                "schema_": response_schema
            }

        # Trace latency
        start_time = time.time()
        
        # Make the API call with retries
        last_error = None
        for attempt in range(3):
            try:
                interaction = self.client.interactions.create(**body)
                
                latency_ms = int((time.time() - start_time) * 1000)
                
                # Try to extract usage metadata
                usage = getattr(interaction, "usage_metadata", None)
                input_tokens = getattr(usage, "prompt_token_count", 0) if usage else 0
                output_tokens = getattr(usage, "candidates_token_count", 0) if usage else 0
                thinking_tokens = getattr(usage, "thinking_token_count", 0) if usage else 0
                cached_tokens = getattr(usage, "cached_content_token_count", 0) if usage else 0
                
                # Output text
                output_text = getattr(interaction, "output_text", "")
                if not output_text and hasattr(interaction, "outputs") and interaction.outputs:
                    output_text = interaction.outputs[-1].text

                return {
                    "success": True,
                    "interaction_id": getattr(interaction, "id", None),
                    "output_text": output_text,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "thinking_tokens": thinking_tokens,
                    "cached_tokens": cached_tokens,
                    "latency_ms": latency_ms,
                    "retry_count": attempt,
                    "raw_response": str(interaction)
                }
            except Exception as e:
                logger.warning(f"Gemini API call failed on attempt {attempt + 1}: {e}")
                last_error = e
                time.sleep(2 ** attempt)

        # All attempts failed
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "error_message": str(last_error),
            "latency_ms": latency_ms,
            "retry_count": 3
        }
