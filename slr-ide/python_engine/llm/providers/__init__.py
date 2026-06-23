from llm.providers.gemini import GeminiAdapter
from llm.providers.openai import OpenAIAdapter
from llm.providers.claude import ClaudeAdapter

def get_provider_adapter(provider, model_id, api_key, config_params=None):
    """Factory function to resolve the correct LLM adapter based on the provider."""
    provider_lower = provider.lower()
    if provider_lower == 'gemini':
        return GeminiAdapter(model_id, api_key, config_params)
    elif provider_lower == 'openai':
        return OpenAIAdapter(model_id, api_key, config_params)
    elif provider_lower == 'claude' or provider_lower == 'anthropic':
        return ClaudeAdapter(model_id, api_key, config_params)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")
