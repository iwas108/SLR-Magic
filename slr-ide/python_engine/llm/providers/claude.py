import os
import json
import base64
import logging
import anthropic

from llm.providers.base import BaseLLMAdapter, retry_with_backoff
from llm.budget import get_model_pricing

logger = logging.getLogger("ClaudeAdapter")

class ClaudeAdapter(BaseLLMAdapter):
    def __init__(self, model_id, api_key, config_params=None):
        super().__init__(model_id, api_key, config_params)
        self.client = anthropic.Anthropic(api_key=self.api_key)

    @retry_with_backoff(max_retries=3)
    def screen_paper(self, system_instruction, user_prompt, pdf_path=None):
        # Default Claude Messages API call
        pdf_data = None
        if pdf_path and os.path.exists(pdf_path):
            try:
                with open(pdf_path, "rb") as f:
                    pdf_data = base64.b64encode(f.read()).decode("utf-8")
            except Exception as e:
                logger.error(f"Failed to read PDF for Claude: {e}")

        # Construct messages content array
        user_content = []
        if pdf_data:
            logger.info(f"Injecting PDF {pdf_path} as base64 document block into Claude...")
            user_content.append({
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": pdf_data
                }
            })
            
        user_content.append({
            "type": "text",
            "text": user_prompt
        })

        # Pre-fill completion technique to enforce JSON format
        messages = [
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": "{"}
        ]

        # Use beta endpoint for PDF document block support
        if pdf_data:
            response = self.client.beta.messages.create(
                model=self.model_id,
                betas=["pdfs-2024-09-25"],
                max_tokens=2000,
                system=system_instruction,
                messages=messages,
                temperature=self.config_params.get("temperature", 0.0)
            )
        else:
            response = self.client.messages.create(
                model=self.model_id,
                max_tokens=2000,
                system=system_instruction,
                messages=messages,
                temperature=self.config_params.get("temperature", 0.0)
            )

        # Parse text output (pre-appending the pre-filled opening bracket)
        response_text = response.content[0].text
        full_json_str = "{" + response_text
        
        try:
            result = json.loads(full_json_str)
        except Exception as parse_err:
            logger.error(f"Failed to parse Claude JSON response: {full_json_str}")
            # Try to recover if Claude returned more text after the JSON
            try:
                # Find the last closing bracket
                end_idx = full_json_str.rfind("}")
                if end_idx != -1:
                    result = json.loads(full_json_str[:end_idx+1])
                else:
                    raise parse_err
            except Exception:
                result = {
                    "decision": "EXCLUDE",
                    "exclusion_trigger": "MALFORMED_RESPONSE",
                    "rationale": f"Claude API returned malformed JSON: {full_json_str}"
                }

        # Token usage metrics
        input_tokens = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        thinking_tokens = getattr(response.usage, "thinking_tokens", 0)

        # Calculate cost dynamically
        pricing = get_model_pricing(self.model_id)
        input_rate = pricing["input_token_price"]
        output_rate = pricing["output_token_price"]
        thinking_rate = pricing.get("thinking_token_price") or output_rate
        
        if self.config_params.get("batch_mode", False):
            input_rate *= pricing.get("batch_discount", 0.5)
            output_rate *= pricing.get("batch_discount", 0.5)
            thinking_rate *= pricing.get("batch_discount", 0.5)

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
