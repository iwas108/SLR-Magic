import os
import json
import logging
from openai import OpenAI

from llm.providers.base import BaseLLMAdapter, retry_with_backoff
from llm.budget import get_model_pricing

logger = logging.getLogger("OpenAIAdapter")

def extract_pdf_text(pdf_path):
    """Extracts text content from a PDF file using pypdf."""
    try:
        from pypdf import PdfReader
        if not os.path.exists(pdf_path):
            return ""
        reader = PdfReader(pdf_path)
        text_pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n--- PDF PAGE BREAK ---\n\n".join(text_pages)
    except Exception as e:
        logger.error(f"Error extracting PDF text: {e}")
        return f"[PDF Text Extraction Failed: {e}]"

class OpenAIAdapter(BaseLLMAdapter):
    def __init__(self, model_id, api_key, config_params=None):
        super().__init__(model_id, api_key, config_params)
        self.client = OpenAI(api_key=self.api_key)

    @retry_with_backoff(max_retries=3)
    def screen_paper(self, system_instruction, user_prompt, pdf_path=None):
        hydrated_user_prompt = user_prompt

        # For OpenAI, extract PDF text locally and append it to the prompt
        if pdf_path and os.path.exists(pdf_path):
            logger.info(f"Extracting local PDF text for OpenAI model from {pdf_path}...")
            pdf_text = extract_pdf_text(pdf_path)
            if pdf_text:
                hydrated_user_prompt += f"\n\n--- ATTACHED PDF FILE TEXT CONTENT ---\n\n{pdf_text}"

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": hydrated_user_prompt}
        ]

        # Call OpenAI Chat Completions API
        completion_params = {
            "model": self.model_id,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": self.config_params.get("temperature", 0.0)
        }
        if self.config_params.get("max_tokens") is not None:
            completion_params["max_completion_tokens"] = self.config_params["max_tokens"]
        if self.config_params.get("top_p") is not None:
            completion_params["top_p"] = self.config_params["top_p"]

        response = self.client.chat.completions.create(**completion_params)

        content = response.choices[0].message.content or "{}"
        
        # Parse output JSON
        try:
            result = json.loads(content)
        except Exception as parse_err:
            logger.error(f"Failed to parse OpenAI JSON response: {content}")
            result = {
                "decision": "EXCLUDE",
                "exclusion_trigger": "MALFORMED_RESPONSE",
                "rationale": f"OpenAI API returned malformed JSON: {content}"
            }

        # Parse token usage metrics including reasoning / thinking tokens
        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        thinking_tokens = 0
        
        if hasattr(response.usage, "completion_tokens_details") and response.usage.completion_tokens_details:
            thinking_tokens = getattr(response.usage.completion_tokens_details, "reasoning_tokens", 0)

        # Calculate cost dynamically
        pricing = get_model_pricing(self.model_id)
        input_rate = pricing["input_token_price"]
        output_rate = pricing["output_token_price"]
        thinking_rate = pricing.get("thinking_token_price") or output_rate
        
        if self.config_params.get("batch_mode", False):
            input_rate *= pricing.get("batch_discount", 0.5)
            output_rate *= pricing.get("batch_discount", 0.5)
            thinking_rate *= pricing.get("batch_discount", 0.5)

        # Compute cost separating thinking and regular completion tokens
        regular_output_tokens = max(0, output_tokens - thinking_tokens)
        cost = (
            (input_tokens / 1_000_000.0) * input_rate +
            (regular_output_tokens / 1_000_000.0) * output_rate +
            (thinking_tokens / 1_000_000.0) * thinking_rate
        )

        return {
            "decision": result.get("decision", "EXCLUDE"),
            "exclusion_trigger": result.get("exclusion_trigger"),
            "rationale": result.get("rationale", ""),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "thinking_tokens": thinking_tokens,
            "cost": cost
        }
