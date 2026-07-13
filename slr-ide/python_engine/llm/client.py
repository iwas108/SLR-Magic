import time
import json
import logging
from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

# Models that are Gemma family (use generate_content, NOT the Interactions API)
GEMMA_MODEL_PREFIXES = ("gemma-",)

def _is_gemma(model_id: str) -> bool:
    """Returns True if the model is a Gemma variant (not a Gemini model)."""
    return any(model_id.lower().startswith(p) for p in GEMMA_MODEL_PREFIXES)


def safe_json_loads(text: str) -> dict:
    """Safely parses JSON string, stripping markdown fences and permitting control characters."""
    text = text.strip()
    if not text:
        raise ValueError("Empty JSON string")
        
    # Strip markdown block fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
        
    # Attempt strict parsing first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
        
    # Attempt parsing with strict=False to handle raw newlines / control characters
    return json.loads(text, strict=False)

def wait_for_file_active(client, file_name: str, timeout_seconds: int = 45) -> None:
    """Polls the Gemini Files API until the uploaded file state is ACTIVE."""
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        try:
            file_info = client.files.get(name=file_name)
            state_str = getattr(file_info, "state", None)
            state_name = ""
            if state_str:
                if hasattr(state_str, "name"):
                    state_name = state_str.name
                else:
                    state_name = str(state_str)
                    
            if state_name == "ACTIVE":
                logger.info(f"File {file_name} is active and ready for use.")
                return
            elif state_name == "FAILED":
                error_msg = "Unknown error"
                if hasattr(file_info, "error") and file_info.error:
                    error_msg = getattr(file_info.error, "message", str(file_info.error))
                raise RuntimeError(f"Gemini file processing failed: {error_msg}")
                
            logger.info(f"File {file_name} state is {state_name}. Waiting...")
        except Exception as e:
            if "not found" in str(e).lower():
                # Allow a short grace period if the uploaded file is not immediately visible to GET
                pass
            else:
                logger.warning(f"Error checking file status: {e}")
        time.sleep(1.5)
        
    raise TimeoutError(f"Gemini file activation timed out after {timeout_seconds} seconds.")

class GeminiClient:
    def __init__(self, api_key: str, timeout_seconds: float = 900.0):
        if not api_key:
            raise ValueError("API key must be provided to initialize GeminiClient")
        
        # Override environment variables to align with the active vault key.
        # Explicitly delete GOOGLE_API_KEY to force the SDK to use GEMINI_API_KEY,
        # preventing the SDK from capturing an invalid GOOGLE_API_KEY from the system environment.
        import os
        if "GOOGLE_API_KEY" in os.environ:
            del os.environ["GOOGLE_API_KEY"]
        os.environ["GEMINI_API_KEY"] = api_key
        
        # Initialize the new google-genai Client with the configured timeout
        # to prevent the Python thread from hanging indefinitely if the TCP connection drops silently.
        # NOTE: The google-genai SDK's HttpOptions expects the timeout parameter in milliseconds!
        self.client = genai.Client(
            api_key=api_key,
            http_options={'timeout': int(timeout_seconds * 1000)}
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Internal: Gemini Interactions API path (supports store / service_tier /
    # response_format / previous_interaction_id)
    # ──────────────────────────────────────────────────────────────────────────
    def _call_interactions(
        self,
        model_id: str,
        input_payload,
        system_instruction: str,
        response_schema: dict,
        speed_mode: str,
        previous_interaction_id: str,
        store: bool,
        temperature: float,
        max_output_tokens: int,
        top_p: float,
        top_k: int,
    ) -> dict:
        gen_config: dict = {
            "temperature": temperature,
            "max_output_tokens": max_output_tokens,
        }
        if top_p is not None:
            gen_config["top_p"] = top_p
        if top_k is not None:
            gen_config["top_k"] = top_k

        body: dict = {
            "model": model_id,
            "input": input_payload,
            "store": store,
            "generation_config": gen_config,
        }

        if system_instruction:
            body["system_instruction"] = system_instruction

        if previous_interaction_id:
            body["previous_interaction_id"] = previous_interaction_id

        # FLEX speed → service_tier = 'flex'
        if speed_mode == "FLEX":
            body["service_tier"] = "flex"

        # JSON schema output → response_format
        # WORKAROUND: The SDK has a serialization bug where it sends snake_case keys for
        # response_mime_type and response_format, which are rejected by the Google API gateway.
        # We work around this by passing the correctly camelCased fields via extra_body.
        if response_schema:
            body["extra_body"] = {
                "response_format": {
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": response_schema,
                }
            }

        interaction = self.client.interactions.create(**body)

        usage = getattr(interaction, "usage", None)
        if usage:
            input_tokens    = (getattr(usage, "total_input_tokens",   None) or 0)
            output_tokens   = (getattr(usage, "total_output_tokens",  None) or 0)
            thinking_tokens = (getattr(usage, "total_thought_tokens", None) or 0)
            cached_tokens   = (getattr(usage, "total_cached_tokens",  None) or 0)
        else:
            usage_meta = getattr(interaction, "usage_metadata", None)
            input_tokens    = (getattr(usage_meta, "prompt_token_count",         None) or 0) if usage_meta else 0
            output_tokens   = (getattr(usage_meta, "candidates_token_count",     None) or 0) if usage_meta else 0
            thinking_tokens = (getattr(usage_meta, "thinking_token_count",       None) or 0) if usage_meta else 0
            cached_tokens   = (getattr(usage_meta, "cached_content_token_count", None) or 0) if usage_meta else 0

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
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Internal: Standard generate_content path for Gemma models.
    # Does NOT support: store, service_tier (flex), response_format,
    # previous_interaction_id, or multimodal document URIs.
    # Structured output is requested via response_mime_type + response_schema
    # inside GenerateContentConfig, and falls back to prompt-level JSON
    # instruction when schema is absent.
    # ──────────────────────────────────────────────────────────────────────────
    def _call_generate_content(
        self,
        model_id: str,
        input_payload,
        system_instruction: str,
        response_schema: dict,
        temperature: float,
        max_output_tokens: int,
        top_p: float,
        top_k: int,
    ) -> dict:
        # Build contents list
        if isinstance(input_payload, list):
            # Multimodal payload — best-effort: extract text parts only for Gemma
            text_parts = " ".join(
                item.get("text", "") for item in input_payload if isinstance(item, dict)
            )
            contents = text_parts or str(input_payload)
        else:
            contents = input_payload  # plain string

        config_kwargs: dict = {
            "temperature": temperature,
            "max_output_tokens": max_output_tokens,
        }
        if top_p is not None:
            config_kwargs["top_p"] = top_p
        if top_k is not None:
            config_kwargs["top_k"] = top_k
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction

        # Request JSON output via mime type + schema when a schema is provided
        if response_schema:
            config_kwargs["response_mime_type"] = "application/json"
            config_kwargs["response_schema"] = response_schema

        config = genai_types.GenerateContentConfig(**config_kwargs)

        response = self.client.models.generate_content(
            model=model_id,
            contents=contents,
            config=config,
        )

        output_text = ""
        if hasattr(response, "text"):
            output_text = response.text or ""
        elif hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and candidate.content.parts:
                output_text = "".join(
                    p.text for p in candidate.content.parts if hasattr(p, "text")
                )

        usage_meta = getattr(response, "usage_metadata", None)
        input_tokens    = (getattr(usage_meta, "prompt_token_count",         None) or 0) if usage_meta else 0
        output_tokens   = (getattr(usage_meta, "candidates_token_count",     None) or 0) if usage_meta else 0
        thinking_tokens = (getattr(usage_meta, "thinking_token_count",       None) or 0) if usage_meta else 0
        cached_tokens   = (getattr(usage_meta, "cached_content_token_count", None) or 0) if usage_meta else 0

        return {
            "success": True,
            "interaction_id": None,  # Gemma has no interaction chaining
            "output_text": output_text,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "thinking_tokens": thinking_tokens,
            "cached_tokens": cached_tokens,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Public unified entry point — dispatches to Interactions or generate_content
    # depending on the model family.
    # ──────────────────────────────────────────────────────────────────────────
    def create_interaction(
        self,
        model_id: str,
        user_prompt: str,
        system_instruction: str = None,
        response_schema: dict = None,
        speed_mode: str = "FLEX",
        previous_interaction_id: str = None,
        store: bool = True,
        temperature: float = 0.0,
        max_output_tokens: int = 2000,
        pdf_file_uri: str = None,
        top_p: float = None,
        top_k: int = None,
        request_delay: float = 1.0,
    ):
        """Unified LLM call. Routes to Gemma (generate_content) or Gemini
        (Interactions API) automatically based on model_id prefix."""

        # Build input payload
        if pdf_file_uri:
            input_payload = [
                {"type": "document", "uri": pdf_file_uri, "mime_type": "application/pdf"},
                {"type": "text",     "text": user_prompt},
            ]
        else:
            input_payload = user_prompt

        start_time = time.time()
        last_error = None

        for attempt in range(3):
            try:
                if _is_gemma(model_id):
                    # ── Gemma path ──────────────────────────────────────────
                    if pdf_file_uri:
                        logger.warning(
                            "Gemma models do not support PDF file URIs via the Interactions API. "
                            "Falling back to text-only mode."
                        )
                    result = self._call_generate_content(
                        model_id=model_id,
                        input_payload=input_payload,
                        system_instruction=system_instruction,
                        response_schema=response_schema,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                        top_p=top_p,
                        top_k=top_k,
                    )
                else:
                    # ── Gemini Interactions API path ────────────────────────
                    result = self._call_interactions(
                        model_id=model_id,
                        input_payload=input_payload,
                        system_instruction=system_instruction,
                        response_schema=response_schema,
                        speed_mode=speed_mode,
                        previous_interaction_id=previous_interaction_id,
                        store=store,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                        top_p=top_p,
                        top_k=top_k,
                    )

                latency_ms = int((time.time() - start_time) * 1000)
                result["latency_ms"] = latency_ms
                result["retry_count"] = attempt
                result["raw_response"] = ""  # avoid huge string in logs
                return result

            except Exception as e:
                logger.warning(f"LLM API call failed on attempt {attempt + 1}: {e}")
                last_error = e
                # Use configured request_delay as backoff base (e.g. 5s → 5s, 10s, 20s)
                backoff = request_delay * (2 ** attempt)
                logger.info(f"Retrying in {backoff:.1f}s (request_delay={request_delay}s, attempt {attempt + 1})...")
                time.sleep(backoff)

        # All attempts failed
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "error_message": str(last_error),
            "latency_ms": latency_ms,
            "retry_count": 3,
        }
