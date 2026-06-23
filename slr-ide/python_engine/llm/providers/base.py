import time
import functools
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("LLMProvider")

def retry_with_backoff(max_retries=5, initial_delay=2, backoff_factor=2):
    """Decorator to retry API calls with exponential backoff."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_err = None
            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_err = e
                    # Common transient errors to retry: rate limits (429), server errors (5xx)
                    err_msg = str(e).lower()
                    # We retry all API exceptions to be resilient against network errors
                    if attempt == max_retries:
                        break
                    logger.warning(f"LLM API attempt {attempt} failed: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                    delay *= backoff_factor
            logger.error(f"LLM API failed after {max_retries} attempts.")
            raise last_err
        return wrapper
    return decorator

class BaseLLMAdapter(ABC):
    def __init__(self, model_id, api_key, config_params=None):
        self.model_id = model_id
        self.api_key = api_key
        self.config_params = config_params or {}
        
    @abstractmethod
    def screen_paper(self, system_instruction, user_prompt, pdf_path=None):
        """Screens a paper using the model.
        
        Args:
            system_instruction (str): The system prompt/guidelines.
            user_prompt (str): The hydrated user prompt template.
            pdf_path (str, optional): Absolute path to the PDF if visual PDF is uploaded.
            
        Returns:
            dict: {
                "decision": "INCLUDE" | "EXCLUDE",
                "exclusion_trigger": str | None,
                "rationale": str,
                "input_tokens": int,
                "output_tokens": int,
                "thinking_tokens": int,
                "cost": float
            }
        """
        pass
